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
  { id: 'banho', name: 'Banho', icon: Bath, isMandatory: true, category: 'Higiene' },
  { id: 'higiene_oral', name: 'Higiene Oral', icon: Smile, isMandatory: true, category: 'Higiene' },
  { id: 'alimentacao', name: 'Alimentação', icon: Coffee, isMandatory: true, category: 'Nutrição' },
  { id: 'fraldas', name: 'Troca de Fraldas', icon: microwave => <Microwave size={18} />, isMandatory: true, category: 'Cuidado' },
  { id: 'decubito', name: 'Mudança de Decúbito', icon: AlertTriangle, isMandatory: true, category: 'Preventivo' },
  { id: 'barba', name: 'Tricotomia / Barba', icon: Scissors, isMandatory: false, category: 'Higiene' },
  { id: 'unhas', name: 'Corte de Unhas', icon: Scissors, isMandatory: false, category: 'Higiene' },
];

const DailyRoutineTab: React.FC<DailyRoutineTabProps> = ({ residents, onSaveLogs }) => {
  const [selectedTaskId, setSelectedTaskId] = useState(ROUTINE_TASKS[0].id);
  const [genderFilter, setGenderFilter] = useState<'todos' | 'masculino' | 'feminino'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  
  const selectedTask = ROUTINE_TASKS.find(t => t.id === selectedTaskId)!;
  const today = new Date().toISOString().split('T')[0];

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
        date: today,
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
    <div className="flex bg-gray-50/10 min-h-full animate-in fade-in duration-500">
      {/* Task Selector Sidebar */}
      <div className="w-72 border-r bg-white flex flex-col shrink-0">
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
          <div className="flex justify-between items-start mb-8">
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

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border">
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

        {/* Residents Grid */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredResidents.map(resident => {
              const isSelected = selectedResidentIds.includes(resident.id);
              return (
                <button
                  key={resident.id}
                  onClick={() => handleToggleSelect(resident.id)}
                  className={`relative group bg-white border rounded-[32px] p-6 text-left transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-[#004c99] bg-blue-50/30' : 'hover:border-blue-200'}`}
                >
                  <div className="absolute top-4 right-4 transition-transform duration-300" style={{ transform: isSelected ? 'scale(1.2)' : 'scale(1)' }}>
                    {isSelected ? (
                      <CheckCircle2 className="text-[#004c99]" size={24} />
                    ) : (
                      <div className="w-6 h-6 border-2 border-gray-200 rounded-full group-hover:border-blue-200"></div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 border-2 border-white shadow-sm flex-shrink-0">
                      {resident.photo ? (
                        <img src={resident.photo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-300">
                          <UserCircle2 size={32} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tighter line-clamp-1">{resident.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {resident.gender === 'masculino' ? 'ALA MASCULINA' : 'ALA FEMININA'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-dashed space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="text-gray-400">Quarto:</span>
                      <span className="text-gray-900">{resident.room || '--'}</span>
                    </div>
                    {/* Exemplo de status hoje - estático por enquanto */}
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="text-gray-400">Status Hoje:</span>
                      <span className="text-orange-500">Pendente</span>
                    </div>
                  </div>
                </button>
              );
            })}
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
