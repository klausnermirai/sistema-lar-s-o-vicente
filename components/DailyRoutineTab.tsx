import React, { useState, useMemo, useEffect } from 'react';
import { Resident, DailyRoutineLog, OperationalShift, ShiftProcedureLog, MealConfiguration } from '../types';
import { getCurrentShift, getOperationalDate } from '../lib/shiftUtils';
import { fetchProcedureLogs, saveProcedureLog, fetchMeals, fetchMural } from '../lib/api';
import { 
  CheckCircle2, 
  XCircle, 
  UserCircle2, 
  Filter, 
  Users, 
  Square, 
  CheckSquare,
  Search,
  ChevronDown,
  Info,
  Save,
  Coffee,
  Bath,
  Scissors,
  Smile,
  Microwave,
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Clock,
  Bandage,
  FileText
} from 'lucide-react';

interface DailyRoutineTabProps {
  residents: Resident[];
  onSaveLogs: (updates: { residentId: string, log: DailyRoutineLog }[]) => void;
  isTabletMode?: boolean;
  shifts?: OperationalShift[];
  onPostToMural?: (message: any) => void;
}

const ROUTINE_TASKS = [
  { id: 'banho', name: 'Banho', icon: Bath, careNeedKey: 'bathAssistance' as const, isMandatory: true, category: 'Higiene', careLabelName: 'Precisa de auxílio', occurrenceType: 'daily' },
  { id: 'higiene_oral', name: 'Higiene Oral', icon: Smile, careNeedKey: 'oralHygieneAssistance' as const, isMandatory: true, category: 'Higiene', careLabelName: 'Precisa de auxílio', occurrenceType: 'daily' },
  { id: 'alimentacao', name: 'Alimentação', icon: Coffee, careNeedKey: 'feedingAssistance' as const, isMandatory: true, category: 'Nutrição', careLabelName: 'Precisa de auxílio', occurrenceType: 'recurrent' },
  { id: 'fraldas', name: 'Troca de Fraldas', icon: (props: any) => <Microwave {...props} />, careNeedKey: 'diaperChangeAssistance' as const, isMandatory: true, category: 'Cuidado', careLabelName: 'Usa fralda', occurrenceType: 'recurrent' },
  { id: 'decubito', name: 'Mudança de Decúbito', icon: AlertTriangle, careNeedKey: 'decubitusChangeAssistance' as const, isMandatory: true, category: 'Preventivo', careLabelName: 'Necessita decúbito', occurrenceType: 'recurrent' },
  { id: 'barba', name: 'Tricotomia / Barba', icon: Scissors, careNeedKey: 'tricotomyAssistance' as const, isMandatory: false, category: 'Higiene', careLabelName: 'Acompanhamento', occurrenceType: 'daily' },
  { id: 'unhas', name: 'Corte de Unhas', icon: Scissors, careNeedKey: 'nailCareAssistance' as const, isMandatory: false, category: 'Higiene', careLabelName: 'Acompanhamento', occurrenceType: 'daily' },
  { id: 'curativos', name: 'Curativos', icon: Bandage, careNeedKey: 'woundCareAssistance' as const, isMandatory: false, category: 'Cuidado', careLabelName: 'Necessita curativo', occurrenceType: 'recurrent' },
];

const DailyRoutineTab: React.FC<DailyRoutineTabProps> = ({ residents, onSaveLogs, isTabletMode, shifts = [], onPostToMural }) => {
  const [tabletStep, setTabletStep] = useState<'menu' | 'register' | 'summary'>('menu');
  const [selectedTaskId, setSelectedTaskId] = useState(ROUTINE_TASKS[0].id);
  const [genderFilter, setGenderFilter] = useState<'todos' | 'masculino' | 'feminino'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [procedureLogs, setProcedureLogs] = useState<ShiftProcedureLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [meals, setMeals] = useState<MealConfiguration[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealConfiguration | null>(null);
  const [mealRecords, setMealRecords] = useState<Record<string, 'comeu' | 'comeu_pouco' | 'nao_comeu' | 'recusou'>>({});
  
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [operationalDate, setOperationalDate] = useState<string>('');

  useEffect(() => {
    if(!selectedTime || !selectedDate) return;
    
    // Obter data baseada na seleção
    const baseDate = new Date(`${selectedDate}T${selectedTime}:00`);
    
    if (shifts.length > 0) {
      const shift = getCurrentShift(shifts, baseDate);
      if (shift) setSelectedShift(shift.nomeTurno);
      
      const opDate = getOperationalDate(shifts, baseDate);
      setOperationalDate(opDate);
    } else {
      // Fallback
      const hour = parseInt(selectedTime.split(':')[0]);
      if (hour < 12) setSelectedShift('Manhã');
      else if (hour < 18) setSelectedShift('Tarde');
      else setSelectedShift('Noite');
      setOperationalDate(selectedDate);
    }
  }, [selectedTime, selectedDate, shifts]);

  useEffect(() => {
    if (!operationalDate) return;
    let isMounted = true;
    
    const loadLogs = async () => {
      try {
        setIsLoadingLogs(true);
        let institutionId = '';
        try {
          const session = JSON.parse(localStorage.getItem('ssvp_session') || '{}');
          institutionId = session.institutionId || session.cnpj;
        } catch(e) {}
        
        if (institutionId) {
          const logs = await fetchProcedureLogs(institutionId, operationalDate);
          if (isMounted) setProcedureLogs(logs);
          
          if (selectedTaskId === 'alimentacao') {
             const ms = await fetchMeals(institutionId);
             if (isMounted) setMeals(ms);
          }
        }
      } catch(err) {
        console.error('Failed to load procedure logs', err);
      } finally {
        if (isMounted) setIsLoadingLogs(false);
      }
    };
    
    loadLogs();
    
    return () => { isMounted = false; };
  }, [operationalDate, selectedTaskId]);

  const selectedTask = ROUTINE_TASKS.find(t => t.id === selectedTaskId)!;

  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = genderFilter === 'todos' || r.gender === genderFilter;
      return matchesSearch && matchesGender;
    });
  }, [residents, searchTerm, genderFilter]);

  const handleToggleSelect = (id: string) => {
    setSelectedResidentIds(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      if (tabletStep === 'register') {
        const isDaily = (selectedTask as any).occurrenceType === 'daily';
        const selectableIds = filteredResidents.filter(r => {
          if (!isDaily) return true;
          const hasCompletedToday = procedureLogs.some(log => log.tipoProcedimento === selectedTask.id && log.residentesSelecionados.includes(r.id));
          return !hasCompletedToday;
        }).map(r => r.id);
        setSelectedResidentIds(selectableIds);
      } else {
        setSelectedResidentIds(filteredResidents.map(r => r.id));
      }
    } else {
      setSelectedResidentIds([]);
    }
  };

  const logTask = (status: 'concluido' | 'nao_concluido' | 'ausente') => {
    if (selectedResidentIds.length === 0) return;

    // Use current session professional name instead of hardcoded
    let authorName = 'Sistema';
    try {
      const session = JSON.parse(localStorage.getItem('ssvp_session') || '{}');
      authorName = session.nomeCompleto || session.username || 'Sistema';
    } catch(e) {}

    const updates = selectedResidentIds.map(residentId => ({
      residentId,
      log: {
        id: Math.random().toString(36).substr(2, 9),
        taskId: selectedTask.id,
        taskName: selectedTask.name,
        status,
        date: operationalDate, // Using operational date here for reporting
        time: selectedTime,
        shift: selectedShift,
        timestamp: new Date().toISOString(),
        performedBy: authorName,
        observation: status === 'nao_concluido' ? 'Marcado como exceção' : undefined
      } as DailyRoutineLog
    }));

    onSaveLogs(updates);
    setSelectedResidentIds([]);
    alert(`${updates.length} registros salvos com sucesso!`);
  };

  if (tabletStep === 'menu') {
    return (
      <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2 text-center">Plano de Rotinas</h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center mb-8">Selecione o procedimento a ser realizado</p>
        <div className="flex-1 w-full max-w-5xl mx-auto overflow-y-auto custom-scrollbar pb-8 pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {ROUTINE_TASKS.map(task => (
              <button type="button"
                key={task.id}
                onClick={() => {
                  setSelectedTaskId(task.id);
                  setSelectedResidentIds([]);
                  setTabletStep('register');
                }}
                className="flex flex-col items-center justify-center p-8 bg-white border-2 border-gray-100 rounded-[32px] hover:border-[#004c99] hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="w-24 h-24 rounded-3xl bg-blue-50 text-[#004c99] flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-500">
                  {typeof task.icon === 'function' ? task.icon({ size: 40 }) : React.createElement(task.icon, { size: 40 })}
                </div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter text-center leading-tight mb-2">{task.name}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{task.category}</p>
              </button>
            ))}
            <button type="button"
               onClick={() => setTabletStep('summary')}
               className="col-span-2 md:col-span-3 lg:col-span-4 flex flex-col items-center justify-center p-8 bg-blue-50 border-2 border-blue-200 rounded-[32px] hover:border-[#004c99] hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
            >
               <div className="w-16 h-16 rounded-2xl bg-white text-[#004c99] flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <FileText size={32} />
               </div>
               <h3 className="text-xl font-black text-[#004c99] uppercase tracking-tighter text-center leading-tight">Resumo do Dia</h3>
               <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest mt-1">Histórico completo de rotinas</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleProcedureLog = async () => {
    try {
      let authorName = 'Sistema';
      let userId = 'usuario_desconhecido';
      let institutionId = '';
      try {
        const session = JSON.parse(localStorage.getItem('ssvp_session') || '{}');
        authorName = session.nomeCompleto || session.username || 'Sistema';
        userId = session.id || userId;
        institutionId = session.institutionId || session.cnpj;
      } catch(e) {}

      // Identify dependent residents
      const careKey = selectedTask.careNeedKey as string | undefined;
      let dependentIds: string[] = [];
      if (careKey) {
        dependentIds = residents.filter(r => (r.careNeeds as any)?.[careKey]).map(r => r.id);
      }
      
      let log: ShiftProcedureLog;

      if (selectedTask.id === 'alimentacao' && selectedMeal) {
        const comeram = Object.entries(mealRecords).filter(([_, status]) => status === 'comeu').map(([id]) => id);
        const comeramPouco = Object.entries(mealRecords).filter(([_, status]) => status === 'comeu_pouco').map(([id]) => id);
        const naoComeram = Object.entries(mealRecords).filter(([_, status]) => status === 'nao_comeu').map(([id]) => id);
        const recusaram = Object.entries(mealRecords).filter(([_, status]) => status === 'recusou').map(([id]) => id);

        log = {
          institutionId,
          tipoProcedimento: 'alimentacao',
          dataOperacional: operationalDate,
          turnoId: shifts.find(s => s.nomeTurno === selectedShift)?.id || selectedShift,
          turnoNome: selectedShift,
          
          refeicaoId: selectedMeal.id,
          refeicaoNome: selectedMeal.nomeRefeicao,
          horarioAproximado: selectedMeal.horarioAproximado,
          registrosPorResidente: mealRecords,
          
          residentesComAcompanhamento: dependentIds,
          residentesAcompanhadosQueComeram: comeram.filter(id => dependentIds.includes(id)),
          residentesAcompanhadosQueComeramPouco: comeramPouco.filter(id => dependentIds.includes(id)),
          residentesAcompanhadosQueNaoComeram: naoComeram.filter(id => dependentIds.includes(id)),
          residentesAcompanhadosQueRecusaram: recusaram.filter(id => dependentIds.includes(id)),
          
          totalComeram: comeram.length,
          totalComeramPouco: comeramPouco.length,
          totalNaoComeram: naoComeram.length,
          totalRecusaram: recusaram.length,
          totalAcompanhamento: dependentIds.length,
          
          residentesSelecionados: [],
          residentesDependentes: [],
          residentesDependentesAtendidos: [],
          residentesDependentesPendentes: [],
          totalSelecionados: 0,
          totalDependentes: 0,
          totalDependentesAtendidos: 0,
          totalDependentesPendentes: 0,
          
          responsavelUserId: userId,
          responsavelNome: authorName,
          criadoEm: new Date().toISOString()
        };
      } else {
        const dependentAttendedCount = selectedResidentIds.filter(id => dependentIds.includes(id)).length;
        const dependentNotAttendedIds = dependentIds.filter(id => !selectedResidentIds.includes(id));
        
        log = {
          institutionId,
          tipoProcedimento: selectedTask.id,
          dataOperacional: operationalDate,
          turnoId: shifts.find(s => s.nomeTurno === selectedShift)?.id || selectedShift,
          turnoNome: selectedShift,
          residentesSelecionados: selectedResidentIds,
          residentesDependentes: dependentIds,
          residentesDependentesAtendidos: selectedResidentIds.filter(id => dependentIds.includes(id)),
          residentesDependentesPendentes: dependentNotAttendedIds,
          totalSelecionados: selectedResidentIds.length,
          totalDependentes: dependentIds.length,
          totalDependentesAtendidos: dependentAttendedCount,
          totalDependentesPendentes: dependentNotAttendedIds.length,
          responsavelUserId: userId,
          responsavelNome: authorName,
          criadoEm: new Date().toISOString()
        };
      }

      await saveProcedureLog(log);
      
      if (institutionId) {
        const logs = await fetchProcedureLogs(institutionId, operationalDate);
        setProcedureLogs(logs);
      }
      
      if (selectedTask.id === 'alimentacao') {
        alert(`Alimentação registrada: ${Object.keys(mealRecords).length} residentes registrados (de ${dependentIds.length} acompanhados).`);
        setSelectedMeal(null);
        setMealRecords({});
      } else {
        alert(`${selectedTask.name} registrado: ${selectedResidentIds.length} residentes (sendo ${selectedResidentIds.filter(id => dependentIds.includes(id)).length} de ${dependentIds.length} com necessidade marcada).`);
        setTabletStep('menu');
      }
    } catch(err) {
      alert(`Erro ao salvar registro de ${selectedTask.name.toLowerCase()}.`);
      console.error(err);
    }
  };

  const renderRegisterContent = () => {
    if (selectedTask.id === 'alimentacao' && !selectedMeal) {
      return (
        <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center gap-4 mb-8 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 shrink-0">
            
              <button type="button" 
                onClick={() => setTabletStep('menu')}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all"
              >
                <ChevronLeft size={28} />
              </button>
            <div>
              <h2 className="text-2xl font-black text-[#004c99] uppercase tracking-tighter">Refeições de Hoje</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Selecione qual refeição registrar</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {meals.map(meal => {
                const hasRecords = procedureLogs.some(l => l.tipoProcedimento === 'alimentacao' && l.refeicaoId === meal.id);
                
                return (
                  <button type="button"
                    key={meal.id}
                    onClick={() => {
                      setSelectedMeal(meal);
                      const existingLog = procedureLogs.find(l => l.tipoProcedimento === 'alimentacao' && l.refeicaoId === meal.id);
                      if (existingLog && existingLog.registrosPorResidente) {
                          setMealRecords(existingLog.registrosPorResidente);
                      } else {
                          setMealRecords({}); 
                      }
                    }}
                    className="flex flex-col items-center justify-center p-8 bg-white border-2 border-gray-100 rounded-[32px] hover:border-[#004c99] hover:shadow-xl transition-all duration-300 group"
                  >
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-sm transition-transform duration-500 ${
                      hasRecords ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-[#004c99]'
                    }`}>
                      {hasRecords ? <CheckCircle2 size={32} /> : <Coffee size={32} />}
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter text-center leading-tight mb-2">{meal.nomeRefeicao}</h3>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-lg">~ {meal.horarioAproximado}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{meal.turnoNome}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (selectedTask.id === 'alimentacao' && selectedMeal) {
      return (
        <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col lg:flex-row items-center gap-4 mb-8 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 shrink-0">
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <button type="button" 
                onClick={() => setSelectedMeal(null)}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all shrink-0"
              >
                <ChevronLeft size={28} />
              </button>
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-black text-[#004c99] uppercase tracking-tighter">{selectedMeal.nomeRefeicao}</h2>
                <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                  Registro de Alimentação - {selectedMeal.horarioAproximado}
                </p>
              </div>
            </div>
            <div className="w-full lg:flex-1 lg:flex lg:justify-end">
              <div className="bg-blue-50 px-4 md:px-6 py-4 rounded-2xl flex flex-col md:flex-row gap-4 md:gap-6 items-center w-full lg:w-auto shadow-sm border border-blue-100">
              <div className="text-[10px] uppercase font-black text-[#004c99] tracking-widest flex flex-row items-center justify-between md:flex-col gap-1 md:text-right md:border-r border-[#004c99]/20 md:pr-6 w-full md:w-auto border-b border-[#004c99]/10 md:border-b-0 pb-2 md:pb-0">
                <span className="text-gray-500">Registrados</span>
                <span className="text-lg leading-none">{Object.keys(mealRecords).length} / {residents.length}</span>
              </div>
              <div className="text-[10px] uppercase font-black text-[#004c99] tracking-widest flex flex-row items-center justify-between md:flex-col gap-1 md:text-right w-full md:w-auto">
                <span className="text-gray-500">Data</span>
                <span>{operationalDate.split('-').reverse().join('/')}</span>
              </div>
              <button type="button" 
                  onClick={handleProcedureLog}
                  className="w-full md:w-auto md:ml-4 py-3 md:py-4 px-6 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-md flex justify-center items-center gap-2 mt-2 md:mt-0"
                >
                  <CheckCircle2 size={20} />
                  Finalizar Reg.
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {residents.map(r => {
                const needsAssistance = r.careNeeds?.feedingAssistance;
                const currentStatus = mealRecords[r.id];
                
                const setStatus = (status: 'comeu' | 'comeu_pouco' | 'nao_comeu' | 'recusou') => {
                   setMealRecords(prev => {
                     if (prev[r.id] === status) {
                       const next = {...prev};
                       delete next[r.id];
                       return next;
                     }
                     return { ...prev, [r.id]: status };
                   });
                };
                
                return (
                  <div key={r.id} className="border-2 border-gray-100 rounded-2xl p-4 flex flex-col gap-4 hover:border-gray-200 transition-all relative">
                    {needsAssistance && (
                      <span className="absolute -top-3 right-4 px-3 py-1 bg-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-widest rounded-lg border border-orange-200 shadow-sm z-10">
                        Acompanhamento alimentar
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <UserCircle2 size={32} className="text-gray-300" />
                      <div>
                        <p className="text-sm font-black uppercase tracking-tighter truncate leading-none text-[#004c99]">{r.name}</p>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Q. {r.room || '--'} • L. {r.bedNumber || '--'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      <button type="button" onClick={() => setStatus('comeu')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'comeu' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Comeu</button>
                      <button type="button" onClick={() => setStatus('comeu_pouco')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'comeu_pouco' ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Pouco</button>
                      <button type="button" onClick={() => setStatus('nao_comeu')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'nao_comeu' ? 'bg-red-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Não</button>
                      <button type="button" onClick={() => setStatus('recusou')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'recusou' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Recusou</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col lg:flex-row items-center gap-4 mb-8 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 shrink-0">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            
              <button type="button" 
                onClick={() => setTabletStep('menu')}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all shrink-0"
              >
                <ChevronLeft size={28} />
              </button>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-black text-[#004c99] uppercase tracking-tighter">Registro de {selectedTask.name}</h2>
              <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Marque quem realizou neste turno</p>
            </div>
          </div>
          <div className="w-full lg:flex-1 lg:flex lg:justify-end">
            <div className="bg-blue-50 px-4 md:px-6 py-4 rounded-2xl flex flex-col md:flex-row gap-4 md:gap-6 items-center w-full lg:w-auto mt-0 shadow-sm border border-blue-100">
            <div className="text-[10px] uppercase font-black text-[#004c99] tracking-widest flex flex-row items-center justify-between md:flex-col gap-1 md:text-right md:border-r border-[#004c99]/20 md:pr-6 w-full md:w-auto border-b border-[#004c99]/10 md:border-b-0 pb-2 md:pb-0">
              <span className="text-gray-500">Total Selecionado</span>
              <span className="text-lg leading-none">{selectedResidentIds.length}</span>
            </div>
            <div className="text-[10px] uppercase font-black text-[#004c99] tracking-widest flex flex-row items-center justify-between md:flex-col gap-1 md:text-right w-full md:w-auto">
              <span className="text-gray-500">Data e Turno</span>
              <span>{operationalDate.split('-').reverse().join('/')} - {selectedShift || '--'}</span>
            </div>
            <button type="button" 
                onClick={handleProcedureLog}
                className="w-full md:w-auto md:ml-4 py-3 md:py-4 px-6 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-md flex justify-center items-center gap-2 mt-2 md:mt-0"
              >
                <CheckCircle2 size={20} />
                Finalizar Reg.
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
          <div className="flex flex-col xl:flex-row gap-6 max-w-6xl mx-auto w-full h-auto xl:h-full">
          {/* Form Controls - Shift Config */}
          <div className="w-full xl:w-1/3 flex flex-col gap-6 shrink-0 xl:shrink overflow-y-auto custom-scrollbar xl:pr-2 z-10 bottom-0 left-0 right-0 bg-gray-50 xl:bg-transparent p-4 xl:p-0 border-t xl:border-0 border-gray-200">
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Configuração</h3>
              <div className="mb-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Turno Operacional</label>
                  <div className="grid grid-cols-1 gap-3">
                    {(shifts.length > 0 ? shifts.map(s => s.nomeTurno) : ['Manhã', 'Tarde', 'Noite']).map(s => (
                      <button type="button"
                        key={s}
                        onClick={() => setSelectedShift(s)}
                        className={`py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all text-left px-6 ${
                          selectedShift === s ? 'bg-[#004c99] text-white shadow-xl' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
              </div>
            </div>
          </div>

          {/* Resident List */}
          <div className="w-full xl:w-2/3 flex flex-col bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden relative min-h-[500px]">
            {isLoadingLogs && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <Loader2 className="animate-spin text-[#004c99]" size={40} />
              </div>
            )}
            <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Lista de Residentes</h3>
              <button type="button" 
                onClick={() => {
                  const isDaily = (selectedTask as any).occurrenceType === 'daily';
                  const selectableCount = residents.filter(r => {
                    if (!isDaily) return true;
                    return !procedureLogs.some(log => log.tipoProcedimento === selectedTask.id && log.residentesSelecionados.includes(r.id));
                  }).length;
                  handleSelectAll(selectedResidentIds.length !== selectableCount)
                }}
                className="text-[10px] font-black text-[#004c99] uppercase tracking-widest hover:underline"
              >
                {selectedResidentIds.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4 content-start">
              {residents.map(r => {
                const careKey = selectedTask.careNeedKey as string | undefined;
                const needsAssistance = careKey ? (r.careNeeds as any)?.[careKey] : false;
                
                // Fetch logs for this specific task and this resident
                const residentLogs = procedureLogs.filter(log => log.tipoProcedimento === selectedTask.id && log.residentesSelecionados.includes(r.id)).sort((a,b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
                
                const isDaily = (selectedTask as any).occurrenceType === 'daily';
                const hasCompletedToday = residentLogs.length > 0;
                
                const isCompletedDaily = isDaily && hasCompletedToday;
                const lastLog = residentLogs[0];
                
                // For recurrent, they are selectable. For daily, if completed, they are not selectable.
                const isSelectable = !isCompletedDaily;
                const isSelected = selectedResidentIds.includes(r.id);

                return (
                  <button type="button"
                    key={r.id}
                    disabled={!isSelectable}
                    onClick={() => handleToggleSelect(r.id)}
                    className={`border-2 rounded-2xl p-4 flex flex-col gap-4 text-left hover:border-gray-200 transition-all relative ${
                      isSelected
                        ? 'border-[#004c99] bg-blue-50/50'
                        : isCompletedDaily
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-gray-100 bg-white hover:border-gray-300'
                    } ${needsAssistance && !isSelected && !isCompletedDaily ? 'ring-2 ring-orange-100' : ''}`}
                  >
                    {/* Badge de acompanhamento (se precisar e não estiver selecionado/concluído) */}
                    {needsAssistance && !isCompletedDaily && !isSelected && (
                      <span className="absolute -top-3 right-4 px-3 py-1 bg-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-widest rounded-lg border border-orange-200 shadow-sm z-10">
                        {(selectedTask as any).careLabelName || 'Precisa de Auxílio'}
                      </span>
                    )}

                    {/* Badge Realizado */}
                    {isCompletedDaily && (
                      <span className="absolute -top-3 right-4 px-3 py-1 bg-green-100 text-green-700 text-[9px] font-black uppercase tracking-widest rounded-lg border border-green-200 shadow-sm z-10 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Realizado
                      </span>
                    )}

                    <div className="flex items-center gap-4 w-full">
                      {/* Ícone */}
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#004c99] text-white shadow-md' : isCompletedDaily ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isSelected || isCompletedDaily ? <CheckCircle2 size={24} /> : <UserCircle2 size={24} />}
                      </div>

                      {/* Dados (Nome + Info) */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-black uppercase tracking-tighter leading-tight break-words ${
                          isSelected ? 'text-[#004c99]' : isCompletedDaily ? 'text-green-700' : 'text-gray-800'
                        }`}>
                          {r.name}
                        </p>

                        {!hasCompletedToday ? (
                          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-1">Qt. {r.room || '-'} • Lt. {r.bedNumber || '-'}</p>
                        ) : (
                          <div className="mt-2 space-y-1 bg-white/60 rounded-xl p-2 border border-gray-100 text-left">
                            {isDaily ? (
                              <>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#004c99] truncate">Turno: {lastLog.turnoNome}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 truncate">Por: {lastLog.responsavelNome}</p>
                              </>
                            ) : (
                              <>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#004c99] truncate">Registros hoje: {residentLogs.length}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 truncate">Último: {new Date(lastLog.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {lastLog.turnoNome}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const handleGenerateMuralSummary = async (dateStr: string) => {
    if (!onPostToMural) {
       alert("Funcionalidade de mural não disponível.");
       return;
    }

    const savedSession = localStorage.getItem('ssvp_session');
    const session = savedSession ? JSON.parse(savedSession) : null;
    const currentInstId = session?.institutionId || session?.cnpj;

    if (!currentInstId) {
       alert("Não foi possível identificar a instituição.");
       return;
    }

    const title = `Resumo das Rotinas — ${dateStr.split('-').reverse().join('/')}`;

    try {
      const messages = await fetchMural(currentInstId);
      const alreadyPosted = messages.some((m: any) => m.text === title);
      
      if (alreadyPosted) {
        if (!window.confirm(`Já existe um resumo de rotinas publicado para o dia ${dateStr.split('-').reverse().join('/')}. Deseja publicar novamente e atualizar a informação?`)) {
           return;
        }
      } else {
        if (!window.confirm(`Deseja gerar e publicar no mural o resumo das rotinas do dia ${dateStr.split('-').reverse().join('/')}?`)) {
           return;
        }
      }
    } catch (e) {
      console.warn("Could not check duplicate murals", e);
      if (!window.confirm(`Deseja gerar e publicar no mural o resumo das rotinas do dia ${dateStr.split('-').reverse().join('/')}?`)) {
         return;
      }
    }

    let summaryText = '';

    ROUTINE_TASKS.forEach(task => {
      summaryText += `*${task.name}*:`;

      const realizados: string[] = [];
      const tabletLogs = procedureLogs.filter(log => log.tipoProcedimento === task.id);
      
      // Get legacy/desktop logs
      residents.forEach(r => {
          const log = (r.dailyRoutines || []).find(dr => dr.taskId === task.id && dr.date === dateStr);
          if (log && log.status !== 'nao_concluido' && log.status !== 'ausente') {
              if (!realizados.includes(r.name)) {
                  realizados.push(r.name);
              }
          }
      });

      if (task.id === 'alimentacao') {
          const refeicoes = Array.from(new Set(tabletLogs.map(t => t.refeicaoNome)));
          if (refeicoes.length === 0) {
             summaryText += `- Nenhum registro.`;
             return;
          }

          refeicoes.forEach(rNome => {
              const logsRefeicao = tabletLogs.filter(t => t.refeicaoNome === rNome);
              const pendentesLocal: string[] = [];
              const targetResidents = residents.filter(r => r.careNeeds?.feedingAssistance);

              const attended = new Set<string>();
              logsRefeicao.forEach(tLog => {
                 if (tLog.registrosPorResidente) {
                    Object.entries(tLog.registrosPorResidente).forEach(([resId, status]) => {
                       if (status !== 'ausente') attended.add(resId);
                    });
                 }
              });

              targetResidents.forEach(r => {
                 if (!attended.has(r.id)) pendentesLocal.push(r.name);
              });

              if (pendentesLocal.length === 0) {
                  summaryText += `- _${rNome}_: todos registrados.`;
              } else {
                  summaryText += `- _${rNome}_: sem registro: ${pendentesLocal.join(', ')}.`;
              }
          });
          summaryText += ``;
          return;
      }

      tabletLogs.forEach(tLog => {
          tLog.residentesSelecionados.forEach(resId => {
             const r = residents.find(res => res.id === resId);
             if (r && !realizados.includes(r.name)) {
                 realizados.push(r.name);
             }
          });
      });

      if (task.isMandatory) {
          const pendentes = [];
          let targetResidents = residents;
          if (task.careNeedKey) {
             targetResidents = residents.filter(r => r.careNeeds && r.careNeeds[task.careNeedKey as keyof typeof r.careNeeds]);
          }

          targetResidents.forEach(r => {
             if (!realizados.includes(r.name)) {
                pendentes.push(r.name);
             }
          });

          if (pendentes.length > 0) {
             summaryText += `- Sem registro: ${pendentes.join(', ')}`;
          } else {
             summaryText += `- Todos registrados.`;
          }
      } else {
          // Eventuais
          if (realizados.length > 0) {
             summaryText += `- Realizado em: ${realizados.join(', ')}`;
          } else {
             summaryText += `- Nenhum registro no dia.`;
          }
      }
    });

    onPostToMural({
      author: 'Sistema',
      text: title,
      detailedContent: summaryText.trim(),
      visibilidade: ['Equipe', 'Gestão']
    });

    alert('Resumo gerado e publicado no mural com sucesso!');
  };

  const renderSummary = () => {
    const hasLogs = procedureLogs.length > 0 || residents.some(r => (r.dailyRoutines || []).some(dr => dr.date === selectedDate));

    return (
      <div className="flex flex-col h-full bg-gray-50/10">
        <div className="p-8 border-b bg-white shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest rounded-full">Histórico</span>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Relatório do Dia</h2>
              </div>
              <p className="text-sm text-gray-500 font-medium max-w-2xl">
                Acompanhe o relatório das rotinas.
              </p>
            </div>
            
              <button type="button" 
                onClick={() => setTabletStep('menu')}
                className="w-12 h-12 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-all"
              >
                <ChevronLeft size={24} />
              </button>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-gray-400">Data:</label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-4 py-2 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#004c99]/10"
              />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {isLoadingLogs ? (
             <div className="flex items-center justify-center py-12">
               <Loader2 className="animate-spin text-[#004c99]" size={40} />
             </div>
          ) : !hasLogs ? (
             <div className="flex flex-col items-center justify-center py-16 text-center">
               <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="text-gray-400" size={32} />
               </div>
               <p className="text-gray-500 font-medium text-lg text-center">Nenhum registro de rotina encontrado para esta data.</p>
             </div>
          ) : (
             <div className="space-y-6 max-w-5xl mx-auto pb-12">
               {ROUTINE_TASKS.map(task => {
                 const realizados: { resident: Resident, time: string, author: string, status: string }[] = [];
                 const tabletLogs = procedureLogs.filter(log => log.tipoProcedimento === task.id);
                 
                 // Collect desktop local logs
                 residents.forEach(r => {
                     const log = (r.dailyRoutines || []).find(dr => dr.taskId === task.id && dr.date === selectedDate);
                     if (log && !realizados.find(x => x.resident.id === r.id)) {
                         realizados.push({ 
                             resident: r, 
                             time: log.time || '', 
                             author: log.performedBy || 'Sistema', 
                             status: log.status 
                         });
                     }
                 });

                 if (task.id === 'alimentacao') {
                     const refeicoes = Array.from(new Set(tabletLogs.map(t => t.refeicaoNome)));
                     const dependentes = residents.filter(r => r.careNeeds && r.careNeeds.feedingAssistance);
                     
                     return (
                       <div key={task.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-4 bg-gray-50/80 border-b flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#004c99] shadow-sm">
                                 {typeof task.icon === 'function' ? task.icon({ size: 16 }) : React.createElement(task.icon, { size: 16 })}
                               </div>
                               <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{task.name}</h3>
                            </div>
                            <div className="p-6 space-y-6">
                              {refeicoes.length === 0 && <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Sem registro para {task.name.toLowerCase()} nesta data</p>}
                              {refeicoes.map(rNome => {
                                  const logsRefeicao = tabletLogs.filter(t => t.refeicaoNome === rNome);
                                  
                                  const pendentesOuNao = dependentes.filter(r => {
                                      let status = null;
                                      logsRefeicao.forEach(tLog => {
                                          if (tLog.registrosPorResidente && tLog.registrosPorResidente[r.id]) {
                                              status = tLog.registrosPorResidente[r.id];
                                          }
                                      });
                                      return !status || status === 'nao_comeu' || status === 'recusou';
                                  }).map(r => {
                                      let statusDesc = 'Sem registro';
                                      let author = '';
                                      let time = '';
                                      let finalStatus = 'sem_registro';
                                      logsRefeicao.forEach(tLog => {
                                          if (tLog.registrosPorResidente && tLog.registrosPorResidente[r.id]) {
                                              const st = tLog.registrosPorResidente[r.id];
                                              if (st === 'nao_comeu') { statusDesc = 'Não comeu'; finalStatus = st; }
                                              if (st === 'recusou') { statusDesc = 'Recusou'; finalStatus = st; }
                                              author = tLog.responsavelNome || '';
                                              time = tLog.criadoEm ? new Date(tLog.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                                          }
                                      });
                                      return { resident: r, status: statusDesc, reqStatus: finalStatus, author, time };
                                  });

                                  return (
                                     <div key={rNome} className="space-y-3">
                                        <h4 className="text-[11px] font-black text-[#004c99] uppercase tracking-widest bg-blue-50/50 inline-block px-3 py-1.5 rounded-lg">{rNome}</h4>
                                        {pendentesOuNao.length === 0 ? (
                                            <p className="text-xs font-bold text-gray-500">Todos os dependentes registrados.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                               {pendentesOuNao.map((item, i) => (
                                                   <div key={i} className="flex items-center justify-between bg-orange-50/50 border border-orange-100 p-3 rounded-xl">
                                                      <div>
                                                         <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter truncate w-32 sm:w-48">{item.resident.name}</p>
                                                         {item.author && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate">{item.author} às {item.time}</p>}
                                                      </div>
                                                      <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-orange-100 text-orange-700">
                                                         {item.status}
                                                      </span>
                                                   </div>
                                               ))}
                                            </div>
                                        )}
                                     </div>
                                  )
                              })}
                            </div>
                       </div>
                     );
                 }
                 
                 // Process tablet normal procedures
                 tabletLogs.forEach(tLog => {
                      tLog.residentesSelecionados.forEach(resId => {
                         const r = residents.find(res => res.id === resId);
                         if (r && !realizados.find(x => x.resident.id === resId)) {
                             realizados.push({
                                 resident: r,
                                 time: new Date(tLog.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                                 author: tLog.responsavelNome,
                                 status: 'concluido'
                             });
                         }
                      });
                 });

                 const isOccasional = task.id === 'barba' || task.id === 'unhas';

                 if (isOccasional) {
                     return (
                        <div key={task.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                             <div className="p-4 bg-gray-50/80 border-b flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#004c99] shadow-sm">
                                  {typeof task.icon === 'function' ? task.icon({ size: 16 }) : React.createElement(task.icon, { size: 16 })}
                                </div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{task.name}</h3>
                             </div>
                             <div className="p-6">
                                {realizados.length === 0 ? (
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum registro.</p>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Realizado em:</p>
                                        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {realizados.map((item, i) => (
                                                <li key={i} className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                                                   <div>
                                                      <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter">{item.resident.name}</p>
                                                      <p className="text-[9px] uppercase font-bold tracking-widest text-blue-400/80">{item.author + (item.time ? " - " + item.time : "")}</p>
                                                   </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                             </div>
                        </div>
                     );
                 }

                 let pendentes = [];
                 if (task.careNeedKey) {
                    pendentes = residents.filter(r => 
                       r.careNeeds && 
                       r.careNeeds[task.careNeedKey] && 
                       !realizados.find(x => x.resident.id === r.id)
                    );
                 } else {
                    pendentes = residents.filter(r => !realizados.find(x => x.resident.id === r.id));
                 }

                 const naoConcluidosEExcecoes = realizados.filter(x => x.status === 'nao_concluido' || x.status === 'ausente');
                 
                 const showEmpty = pendentes.length === 0 && naoConcluidosEExcecoes.length === 0;

                 return (
                    <div key={task.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                         <div className="p-4 bg-gray-50/80 border-b flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#004c99] shadow-sm">
                              {typeof task.icon === 'function' ? task.icon({ size: 16 }) : React.createElement(task.icon, { size: 16 })}
                            </div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{task.name}</h3>
                         </div>
                         
                         <div className="p-6">
                            {showEmpty ? (
                                <p className="text-xs font-bold text-gray-400 pr-8">Todos registrados.</p>
                            ) : (
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {pendentes.map((r, i) => (
                                        <li key={"p-"+i} className="bg-orange-50/20 p-3 rounded-xl border border-orange-100/30 flex justify-between items-center">
                                           <div>
                                             <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter line-clamp-1">{r.name}</p>
                                             <p className="text-[9px] uppercase font-bold tracking-widest text-orange-400 mt-0.5" title={task.careNeedKey ? 'Necessita de acompanhamento' : 'Aguardando registro'}>
                                                {task.careNeedKey ? 'Necessita acompanhamento' : 'Aguardando'}
                                             </p>
                                           </div>
                                           <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-orange-100 text-orange-700">Sem Registro</span>
                                        </li>
                                    ))}
                                    {naoConcluidosEExcecoes.map((item, i) => (
                                        <li key={"nc-"+i} className="bg-red-50/20 p-3 rounded-xl border border-red-100/30 flex justify-between items-center">
                                           <div>
                                              <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter line-clamp-1">{item.resident.name}</p>
                                              <p className="text-[9px] uppercase font-bold tracking-widest text-red-400 mt-0.5">{item.author + (item.time ? " - " + item.time : "")}</p>
                                           </div>
                                           <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-red-100 text-red-700">
                                              {item.status === 'ausente' ? 'Ausente' : 'Não Realizado'}
                                           </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                         </div>
                    </div>
                 );
               })}
            </div>
          )}
        </div>
      </div>
    );
  };
  if (tabletStep === 'summary') {
    return (
      <div className="h-full bg-white flex flex-col animate-in fade-in duration-300">
        {renderSummary()}
      </div>
    );
  }

  return renderRegisterContent();
}

export default DailyRoutineTab;