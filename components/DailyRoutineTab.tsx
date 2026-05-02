import React, { useState, useMemo, useEffect } from 'react';
import { Resident, DailyRoutineLog, OperationalShift, ShiftProcedureLog, MealConfiguration } from '../types';
import { getCurrentShift, getOperationalDate } from '../lib/shiftUtils';
import { fetchProcedureLogs, saveProcedureLog, fetchMeals } from '../lib/api';
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
  Clock
} from 'lucide-react';

interface DailyRoutineTabProps {
  residents: Resident[];
  onSaveLogs: (updates: { residentId: string, log: DailyRoutineLog }[]) => void;
  isTabletMode?: boolean;
  shifts?: OperationalShift[];
}

const ROUTINE_TASKS = [
  { id: 'banho', name: 'Banho', icon: Bath, careNeedKey: 'bathAssistance' as const, isMandatory: true, category: 'Higiene', careLabelName: 'Precisa de auxílio', occurrenceType: 'daily' },
  { id: 'higiene_oral', name: 'Higiene Oral', icon: Smile, careNeedKey: 'oralHygieneAssistance' as const, isMandatory: true, category: 'Higiene', careLabelName: 'Precisa de auxílio', occurrenceType: 'daily' },
  { id: 'alimentacao', name: 'Alimentação', icon: Coffee, careNeedKey: 'feedingAssistance' as const, isMandatory: true, category: 'Nutrição', careLabelName: 'Precisa de auxílio', occurrenceType: 'recurrent' },
  { id: 'fraldas', name: 'Troca de Fraldas', icon: (props: any) => <Microwave {...props} />, careNeedKey: 'diaperChangeAssistance' as const, isMandatory: true, category: 'Cuidado', careLabelName: 'Usa fralda', occurrenceType: 'recurrent' },
  { id: 'decubito', name: 'Mudança de Decúbito', icon: AlertTriangle, careNeedKey: 'decubitusChangeAssistance' as const, isMandatory: true, category: 'Preventivo', careLabelName: 'Necessita decúbito', occurrenceType: 'recurrent' },
  { id: 'barba', name: 'Tricotomia / Barba', icon: Scissors, careNeedKey: 'tricotomyAssistance' as const, isMandatory: false, category: 'Higiene', careLabelName: 'Acompanhamento', occurrenceType: 'daily' },
  { id: 'unhas', name: 'Corte de Unhas', icon: Scissors, careNeedKey: 'nailCareAssistance' as const, isMandatory: false, category: 'Higiene', careLabelName: 'Acompanhamento', occurrenceType: 'daily' },
];

const DailyRoutineTab: React.FC<DailyRoutineTabProps> = ({ residents, onSaveLogs, isTabletMode, shifts = [] }) => {
  const [tabletStep, setTabletStep] = useState<'menu' | 'register'>('menu');
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
      if (isTabletMode && tabletStep === 'register') {
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

  if (isTabletMode && tabletStep === 'menu') {
    return (
      <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2 text-center">Plano de Rotinas</h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center mb-8">Selecione o procedimento a ser realizado</p>
        <div className="flex-1 w-full max-w-5xl mx-auto overflow-y-auto no-scrollbar pb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {ROUTINE_TASKS.map(task => (
              <button
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

  if (isTabletMode && tabletStep === 'register' && selectedTask.id === 'alimentacao' && !selectedMeal) {
    return (
      <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center gap-4 mb-8 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 shrink-0">
          <button 
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
                <button
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

  if (isTabletMode && tabletStep === 'register' && selectedTask.id === 'alimentacao' && selectedMeal) {
    return (
      <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center gap-4 mb-4 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 shrink-0">
          <button 
            onClick={() => setSelectedMeal(null)}
            className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all"
          >
            <ChevronLeft size={28} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-[#004c99] uppercase tracking-tighter">{selectedMeal.nomeRefeicao}</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
              Registro de Alimentação - {selectedMeal.horarioAproximado}
            </p>
          </div>
          <div className="bg-blue-50 px-6 py-4 rounded-2xl flex gap-6">
            <div className="text-[10px] uppercase font-black text-[#004c99] tracking-widest flex flex-col gap-1 text-right border-r border-[#004c99]/20 pr-6">
              <span className="text-gray-500">Registrados</span>
              <span className="text-lg leading-none">{Object.keys(mealRecords).length} / {residents.length}</span>
            </div>
            <div className="text-[10px] uppercase font-black text-[#004c99] tracking-widest flex flex-col gap-1 text-right">
              <span className="text-gray-500">Data</span>
              <span>{operationalDate.split('-').reverse().join('/')}</span>
            </div>
            <button 
                onClick={handleProcedureLog}
                className="ml-4 py-3 px-6 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-md flex items-center gap-2"
              >
                <CheckCircle2 size={20} />
                Finalizar Reg.
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
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
                    <button onClick={() => setStatus('comeu')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'comeu' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Comeu</button>
                    <button onClick={() => setStatus('comeu_pouco')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'comeu_pouco' ? 'bg-yellow-400 text-yellow-900 shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Pouco</button>
                    <button onClick={() => setStatus('nao_comeu')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'nao_comeu' ? 'bg-red-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Não</button>
                    <button onClick={() => setStatus('recusou')} className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tighter text-center transition-all ${currentStatus === 'recusou' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Recusou</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (isTabletMode && tabletStep === 'register') {
    return (
      <div className="flex flex-col h-full bg-gray-50 p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center gap-4 mb-8 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 shrink-0">
          <button 
            onClick={() => setTabletStep('menu')}
            className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all"
          >
            <ChevronLeft size={28} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-[#004c99] uppercase tracking-tighter">Registro de {selectedTask.name}</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Marque quem realizou neste turno</p>
          </div>
          <div className="bg-blue-50 px-6 py-4 rounded-2xl">
            <div className="text-[10px] uppercase font-black text-[#004c99] tracking-widest flex flex-col gap-1 text-right">
              <span>Data: {operationalDate.split('-').reverse().join('/')}</span>
              <span>Turno: {selectedShift || '--'}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden max-w-6xl mx-auto w-full">
          {/* Form Controls - Shift Config */}
          <div className="w-1/3 flex flex-col gap-6">
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Configuração</h3>
              <div className="mb-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Turno Operacional</label>
                  <div className="grid grid-cols-1 gap-3">
                    {(shifts.length > 0 ? shifts.map(s => s.nomeTurno) : ['Manhã', 'Tarde', 'Noite']).map(s => (
                      <button
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

            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col justify-center gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-2">
                 <p className="text-4xl font-black text-[#004c99]">{selectedResidentIds.length}</p>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Total Selecionado</p>
              </div>
              <button 
                onClick={handleProcedureLog}
                className="w-full py-6 bg-[#004c99] text-white rounded-2xl text-lg font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl flex items-center justify-center gap-3"
              >
                <CheckCircle2 size={32} />
                Finalizar Registro
              </button>
            </div>
          </div>

          {/* Resident List */}
          <div className="w-2/3 flex flex-col bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden relative">
            {isLoadingLogs && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <Loader2 className="animate-spin text-[#004c99]" size={40} />
              </div>
            )}
            <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Lista de Residentes</h3>
              <button 
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
                  <button
                    key={r.id}
                    disabled={!isSelectable}
                    onClick={() => handleToggleSelect(r.id)}
                    className={`flex flex-col items-start p-5 rounded-3xl transition-all border-2 text-left relative overflow-hidden ${
                      isSelected
                        ? 'border-[#004c99] bg-blue-50/50'
                        : isCompletedDaily
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-gray-100 bg-white hover:border-gray-300'
                    } ${needsAssistance && !isSelected && !isCompletedDaily ? 'ring-2 ring-orange-100' : ''}`}
                  >
                    <div className="flex w-full items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#004c99] text-white shadow-md' : isCompletedDaily ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isSelected || isCompletedDaily ? <CheckCircle2 size={24} /> : <UserCircle2 size={24} />}
                      </div>
                      {needsAssistance && !isCompletedDaily && (
                        <span className="px-3 py-1.5 bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-widest rounded-lg">
                          {(selectedTask as any).careLabelName || 'Precisa de Auxílio'}
                        </span>
                      )}
                      {isCompletedDaily && (
                        <span className="px-3 py-1.5 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1">
                          <CheckCircle2 size={12} /> Realizado
                        </span>
                      )}
                    </div>
                    <div className="w-full">
                      <p className={`text-lg font-black uppercase tracking-tighter truncate leading-tight ${
                        isSelected ? 'text-[#004c99]' : isCompletedDaily ? 'text-green-700' : 'text-gray-900'
                      }`}>{r.name}</p>
                      
                      {!hasCompletedToday ? (
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                          Quarto {r.room || '--'} • Leito {r.bedNumber || '--'}
                        </p>
                      ) : (
                        <div className="mt-3 space-y-1 bg-white/50 rounded-xl p-3 border border-gray-100">
                          {isDaily ? (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-widest text-[#004c99]">Turno: {lastLog.turnoNome}</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Por: {lastLog.responsavelNome}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-black uppercase tracking-widest text-[#004c99]">Registros hoje: {residentLogs.length}</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Último: {new Date(lastLog.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {lastLog.turnoNome}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50/10 h-full min-h-0 animate-in fade-in duration-500">
      {/* Task Selector Sidebar */}
      <div className="w-72 border-r bg-white flex flex-col shrink-0 min-h-0">
        <div className="p-6 border-b">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Selecione a Rotina</h3>
          <p className="text-[11px] text-gray-500 leading-tight">Escolha qual atividade do plano de cuidados deseja registrar coletivamente.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {ROUTINE_TASKS.map(task => (
            <button
              key={task.id}
              onClick={() => {
                setSelectedTaskId(task.id);
                setSelectedResidentIds([]);
              }}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
                selectedTaskId === task.id 
                  ? 'bg-blue-50 text-[#004c99] ring-1 ring-blue-100' 
                  : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedTaskId === task.id ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
                {typeof task.icon === 'function' ? task.icon({}) : <task.icon size={20} />}
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-tighter">{task.name}</p>
                <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest">{task.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header & Controls */}
        <div className="p-8 border-b bg-white">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-[#004c99] text-white text-[9px] font-black uppercase tracking-widest rounded-full">Registro Coletivo</span>
                <span className="text-sm font-bold text-gray-400">/</span>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">{selectedTask.name}</h2>
              </div>
              <p className="text-sm text-gray-500 font-medium max-w-2xl">
                Registre a execução desta rotina para múltiplos residentes de uma vez. Marque as exceções conforme necessário.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => logTask('nao_concluido')}
                disabled={selectedResidentIds.length === 0}
                className="px-6 py-3 border border-red-200 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <XCircle size={16} /> Registrar Exceção (Não Realizado)
              </button>
              <button 
                onClick={() => logTask('concluido')}
                disabled={selectedResidentIds.length === 0}
                className="px-8 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl flex items-center gap-2"
              >
                <CheckCircle2 size={16} /> Confirmar Realização em Lote
              </button>
            </div>
          </div>
          
          {selectedTask.careNeedKey && (
            <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#004c99] text-white flex items-center justify-center">
                {typeof selectedTask.icon === 'function' ? selectedTask.icon({ size: 20 }) : React.createElement(selectedTask.icon, { size: 20 })}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-[#004c99] tracking-widest leading-tight">Indicador Especial</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">
                  <span className="font-black text-[#004c99] mr-1">{residents.filter(r => r.careNeeds && r.careNeeds[selectedTask.careNeedKey as keyof typeof r.careNeeds]).length}</span>
                  residentes cadastrados necessitam de auxílio para {(selectedTask.name).toLowerCase()}.
                </p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => {
                    const idsToSelect = residents.filter(r => r.careNeeds && r.careNeeds[selectedTask.careNeedKey as keyof typeof r.careNeeds]).map(r => r.id);
                    // Select them
                    const merged = Array.from(new Set([...selectedResidentIds, ...idsToSelect]));
                    setSelectedResidentIds(merged);
                  }}
                  className="px-4 py-2 bg-white text-[#004c99] border hover:bg-gray-50 border-gray-200 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm"
                >
                  Selecionar Todos com Necessidade
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-gray-400">Data (Histórico/Registro):</label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#004c99]/10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-gray-400">Hora (Aprox):</label>
              <input 
                type="time" 
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
                className="px-3 py-2 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#004c99]/10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-gray-400">Turno:</label>
              <select 
                value={selectedShift}
                onChange={e => setSelectedShift(e.target.value as any)}
                className="px-3 py-2 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#004c99]/10"
              >
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Noite">Noite</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border ml-4">
              <button 
                onClick={() => setGenderFilter('todos')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${genderFilter === 'todos' ? 'bg-white shadow-sm text-[#004c99]' : 'text-gray-400'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setGenderFilter('masculino')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${genderFilter === 'masculino' ? 'bg-white shadow-sm text-[#004c99]' : 'text-gray-400'}`}
              >
                Homens
              </button>
              <button 
                onClick={() => setGenderFilter('feminino')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${genderFilter === 'feminino' ? 'bg-white shadow-sm text-[#004c99]' : 'text-gray-400'}`}
              >
                Mulheres
              </button>
            </div>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <input 
                type="text"
                placeholder="Filtrar residentes por nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#004c99]/10 transition-all"
              />
            </div>

            <div className="ml-auto flex items-center gap-4">
              <button 
                onClick={() => handleSelectAll(true)}
                className="text-[10px] font-black text-[#004c99] uppercase tracking-widest hover:underline"
              >
                Selecionar Todos
              </button>
              <button 
                onClick={() => handleSelectAll(false)}
                className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
              >
                Limpar Seleção
              </button>
            </div>
          </div>
        </div>

        {/* Residents List */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/50">
          <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b">
                  <th className="p-4 w-16 text-center cursor-pointer" onClick={() => handleSelectAll(selectedResidentIds.length !== filteredResidents.length)}>
                    <button className="text-[#004c99] hover:opacity-80 transition-opacity">
                      {selectedResidentIds.length === filteredResidents.length && filteredResidents.length > 0 ? (
                        <CheckSquare size={20} />
                      ) : (
                        <Square size={20} className="text-gray-300 hover:text-blue-200" />
                      )}
                    </button>
                  </th>
                  <th className="p-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Nome do Residente</th>
                  <th className="p-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Ala / Quarto</th>
                  <th className="p-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Status em {selectedDate.split('-').reverse().join('/')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredResidents.map(resident => {
                  const isSelected = selectedResidentIds.includes(resident.id);
                  const logForDate = resident.dailyRoutines?.find(r => r.taskId === selectedTask.id && r.date === selectedDate);
                  
                  // For non-mandatory tasks, find the most recent log if none today
                  let lastRecordText = '';
                  if (!logForDate && !selectedTask.isMandatory) {
                     const history = (resident.dailyRoutines || []).filter(r => r.taskId === selectedTask.id && r.status === 'concluido').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                     if (history.length > 0) {
                       lastRecordText = `Último: ${history[0].date.split('-').reverse().join('/')}`;
                     } else {
                       lastRecordText = 'Sem registro';
                     }
                  }

                  return (
                    <tr 
                      key={resident.id}
                      onClick={() => handleToggleSelect(resident.id)}
                      className={`border-b border-gray-50 transition-all cursor-pointer hover:bg-gray-50/80 ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="p-4 text-center">
                        {isSelected ? (
                          <CheckSquare className="text-[#004c99] inline-block" size={20} />
                        ) : (
                          <Square className="text-gray-200 inline-block group-hover:text-gray-300" size={20} />
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm uppercase">{resident.name}</span>
                          {selectedTask.careNeedKey && resident.careNeeds && resident.careNeeds[selectedTask.careNeedKey as keyof typeof resident.careNeeds] && (
                            <span className="px-2 py-0.5 bg-[#004c99]/10 text-[#004c99] rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                              {typeof selectedTask.icon === 'function' ? selectedTask.icon({ size: 10 }) : React.createElement(selectedTask.icon, { size: 10 })} {(selectedTask as any).careLabelName || 'Auxílio'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {resident.gender === 'masculino' ? 'Masculina' : 'Feminina'} {resident.room ? ` - Q${resident.room}` : ''}
                      </td>
                      <td className="p-4">
                        {!logForDate ? (
                          !selectedTask.isMandatory ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 text-[9px] font-black uppercase tracking-widest rounded-lg">
                              <Info size={12} /> {lastRecordText}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 text-[9px] font-black uppercase tracking-widest rounded-lg">
                              <AlertTriangle size={12} /> Pendente
                            </span>
                          )
                        ) : logForDate.status === 'concluido' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 border border-green-100 text-[9px] font-black uppercase tracking-widest rounded-lg" title={`Hora: ${logForDate.time || '--'}`}>
                            <CheckCircle2 size={12} /> Concluído {logForDate.time ? `(${logForDate.time})` : ''} {logForDate.shift ? `- ${logForDate.shift}` : ''}
                          </span>
                        ) : logForDate.status === 'nao_concluido' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 text-[9px] font-black uppercase tracking-widest rounded-lg">
                            <XCircle size={12} /> Não Concluído
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 text-[9px] font-black uppercase tracking-widest rounded-lg">
                            <UserCircle2 size={12} /> Ausente
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredResidents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm text-gray-500">Nenhum residente encontrado com os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedResidentIds.length > 0 && (
          <div className="px-8 py-4 bg-[#004c99] text-white flex items-center justify-between animate-in slide-in-from-bottom duration-500">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                 <Users size={20} />
               </div>
               <div>
                  <p className="text-xs font-black uppercase tracking-widest">
                    {selectedResidentIds.length} Residentes Selecionados
                  </p>
                  <p className="text-[10px] opacity-70 uppercase font-bold">
                    Ação em lote será aplicada à rotina de {selectedTask.name}
                  </p>
               </div>
             </div>
             
             <div className="flex gap-4">
                <button 
                  onClick={() => handleSelectAll(false)}
                  className="px-4 py-2 text-[10px] font-black uppercase hover:bg-white/10 rounded-lg transition-all"
                >
                  Desmarcar Todos
                </button>
                <button 
                  onClick={() => logTask('concluido')}
                  className="px-8 py-4 bg-white text-[#004c99] rounded-2xl text-[10px] font-black uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  Confirmar Realização ({selectedResidentIds.length})
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyRoutineTab;
