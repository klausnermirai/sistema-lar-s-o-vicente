import React, { useState, useMemo } from 'react';
import { Resident, DailyRoutineLog } from '../types';
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
  AlertTriangle
} from 'lucide-react';

interface DailyRoutineTabProps {
  residents: Resident[];
  onSaveLogs: (updates: { residentId: string, log: DailyRoutineLog }[]) => void;
}

const ROUTINE_TASKS = [
  { id: 'banho', name: 'Banho', icon: Bath, careNeedKey: 'bathAssistance' as const, isMandatory: true, category: 'Higiene' },
  { id: 'higiene_oral', name: 'Higiene Oral', icon: Smile, careNeedKey: 'oralHygieneAssistance' as const, isMandatory: true, category: 'Higiene' },
  { id: 'alimentacao', name: 'Alimentação', icon: Coffee, careNeedKey: 'feedingAssistance' as const, isMandatory: true, category: 'Nutrição' },
  { id: 'fraldas', name: 'Troca de Fraldas', icon: (props: any) => <Microwave {...props} />, careNeedKey: 'diaperChangeAssistance' as const, isMandatory: true, category: 'Cuidado' },
  { id: 'decubito', name: 'Mudança de Decúbito', icon: AlertTriangle, careNeedKey: 'decubitusChangeAssistance' as const, isMandatory: true, category: 'Preventivo' },
  { id: 'barba', name: 'Tricotomia / Barba', icon: Scissors, isMandatory: false, category: 'Higiene' },
  { id: 'unhas', name: 'Corte de Unhas', icon: Scissors, isMandatory: false, category: 'Higiene' },
];

const DailyRoutineTab: React.FC<DailyRoutineTabProps> = ({ residents, onSaveLogs }) => {
  const [selectedTaskId, setSelectedTaskId] = useState(ROUTINE_TASKS[0].id);
  const [genderFilter, setGenderFilter] = useState<'todos' | 'masculino' | 'feminino'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  const [selectedShift, setSelectedShift] = useState<'Manhã' | 'Tarde' | 'Noite'>(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Manhã';
    if (hour < 18) return 'Tarde';
    return 'Noite';
  });

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
      setSelectedResidentIds(filteredResidents.map(r => r.id));
    } else {
      setSelectedResidentIds([]);
    }
  };

  const logTask = (status: 'concluido' | 'nao_concluido' | 'ausente') => {
    if (selectedResidentIds.length === 0) return;

    const updates = selectedResidentIds.map(residentId => ({
      residentId,
      log: {
        id: Math.random().toString(36).substr(2, 9),
        taskId: selectedTask.id,
        taskName: selectedTask.name,
        status,
        date: selectedDate,
        time: selectedTime,
        shift: selectedShift,
        timestamp: new Date().toISOString(),
        performedBy: 'Sistema (Usuário Logado)', // Simplificado para o protótipo
        observation: status === 'nao_concluido' ? 'Marcado como exceção' : undefined
      } as DailyRoutineLog
    }));

    onSaveLogs(updates);
    setSelectedResidentIds([]);
    alert(`${updates.length} registros salvos com sucesso!`);
  };

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
                              {typeof selectedTask.icon === 'function' ? selectedTask.icon({ size: 10 }) : React.createElement(selectedTask.icon, { size: 10 })} Auxílio
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {resident.gender === 'masculino' ? 'Masculina' : 'Feminina'} {resident.room ? ` - Q${resident.room}` : ''}
                      </td>
                      <td className="p-4">
                        {!logForDate ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 text-[9px] font-black uppercase tracking-widest rounded-lg">
                            <AlertTriangle size={12} /> Pendente
                          </span>
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
