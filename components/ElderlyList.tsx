
import React from 'react';
import { Search, Plus, Filter, UserPlus, ChevronRight, AlertCircle, Calendar, Archive, Trash2, X, ArchiveX } from 'lucide-react';
import { Resident, SubTab, Relative } from '../types';
import { INITIAL_RESIDENT } from '../constants';

interface ElderlyListProps {
  residents: Resident[];
  activeSubTab: SubTab;
  onAdd: () => void;
  onEdit: (resident: Resident) => void;
  onSave: (resident: Resident) => void;
  onDelete: (id: string) => void;
}

const ElderlyList: React.FC<ElderlyListProps> = ({ residents, activeSubTab, onAdd, onEdit, onSave, onDelete }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showArchived, setShowArchived] = React.useState(false);
  const [archivingResident, setArchivingResident] = React.useState<Resident | null>(null);
  const [archivingReason, setArchivingReason] = React.useState<Resident['archivingReason']>('inadaptacao');
  const [archivingNotes, setArchivingNotes] = React.useState('');

  const filteredResidents = residents.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.cpf.includes(searchTerm);
    const matchesStatus = showArchived ? r.isArchived === true : !r.isArchived;
    return matchesSearch && matchesStatus;
  });

  const handleArchive = () => {
    if (!archivingResident) return;
    
    const updatedResident: Resident = {
      ...archivingResident,
      isArchived: true,
      archivingDate: new Date().toISOString().split('T')[0],
      archivingReason: archivingReason,
      archivingNotes: archivingNotes
    };
    
    onSave(updatedResident);
    setArchivingResident(null);
    setArchivingReason('inadaptacao');
    setArchivingNotes('');
  };

  const getActionText = () => {
    switch(activeSubTab) {
      case 'familiares-visitantes': return 'Gerenciar Visitas';
      case 'financeiro': return 'Lançar Financeiro';
      case 'itens': return 'Ver Itens';
      case 'prontuario': return 'Ver Prontuário Multidisciplinar';
      case 'prontuario-medico': return 'Ver Prontuário Clínico';
      case 'medicamentos': return 'Gerenciar Medicamentos';
      case 'pia': return 'Ver PIA';
      default: return 'Abrir Ficha Geral';
    }
  };

  const renderModuleSummary = (resident: Resident) => {
    if (resident.isArchived) {
      const reasons: Record<string, string> = {
        inadaptacao: 'Inadaptação',
        quebra_regras: 'Quebra de Regras',
        desistencia: 'Desistência',
        vontade_familiar: 'Vontade Familiar',
        falecimento: 'Falecimento'
      };
      return (
        <div className="text-[10px] uppercase">
          <div className="font-black text-red-600 flex items-center gap-1">
            <Archive size={10} /> Arquivado em {resident.archivingDate ? new Date(resident.archivingDate).toLocaleDateString('pt-BR') : 'N/D'}
          </div>
          <div className="font-bold text-gray-500 mt-1">
            Motivo: {reasons[resident.archivingReason || ''] || 'N/D'}
          </div>
        </div>
      );
    }

    switch(activeSubTab) {
      case 'familiares-visitantes':
        const resp = resident.relatives.find(r => r.isResponsible);
        const lastVisit = resident.visitRecords[resident.visitRecords.length - 1];
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Responsável: {resp ? resp.name : 'N/D'}</div>
            <div className="font-bold text-blue-700 flex items-center gap-1 mt-1">
              <Calendar size={10} /> Ult. Visita: {lastVisit ? lastVisit.date : 'Sem registro'}
            </div>
          </div>
        );
      case 'financeiro':
        const balance = resident.financials.reduce((acc, curr) => 
          curr.type === 'entrada' ? acc + curr.amount : acc - curr.amount, 0);
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Saldo Atual:</div>
            <div className={`font-black ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        );
      case 'itens':
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Patrimônio:</div>
            <div className="font-bold text-gray-700">{resident.personalItems.length} Itens Catalogados</div>
          </div>
        );
      case 'medicamentos':
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Farmácia:</div>
            <div className="font-bold text-blue-700">{(resident.medications || []).length} Prescrições Ativas</div>
          </div>
        );
      case 'prontuario-medico':
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Status Clínico:</div>
            <div className="font-bold text-red-600 truncate max-w-[200px]">
              {resident.per?.diagnoses?.[0] || 'Sem diagnóstico principal'}
              {resident.per?.diagnoses?.length && resident.per.diagnoses.length > 1 ? ` +${resident.per.diagnoses.length - 1}` : ''}
            </div>
          </div>
        );
      default:
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Ocupação:</div>
            <div className="font-bold text-red-600">
              {resident.room || 'Não Alocado'} {resident.bedNumber ? ` - Leito: ${resident.bedNumber}` : ''}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Módulo de Residentes</h1>
          <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">
            Visualizando <span className="text-[#004c99]">{showArchived ? 'RESTAURADOS/ARQUIVADOS' : activeSubTab.replace('-', ' ')}</span> • {filteredResidents.length} Idosos listados
          </p>
        </div>
        <div className="flex gap-2">
          {!showArchived && (
            <button
              onClick={onAdd}
              className="bg-[#004c99] hover:bg-blue-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-xl transition-all font-black text-xs uppercase"
            >
              <UserPlus size={18} />
              <span>Cadastrar Idoso</span>
            </button>
          )}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-black text-xs uppercase shadow-sm border ${
              showArchived 
                ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' 
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            {showArchived ? <ArchiveX size={18} /> : <Archive size={18} />}
            <span>{showArchived ? 'Ver Ativos' : 'Arquivados'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/30">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-inner text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2.5 border rounded-xl text-gray-500 hover:bg-white hover:shadow-md transition-all flex items-center gap-2 text-xs font-black uppercase tracking-tighter bg-gray-50/50">
              <Filter size={16} />
              Filtrar Lista
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/80 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
              <tr>
                <th className="px-8 py-5">Identificação do Residente</th>
                <th className="px-8 py-5">Resumo {activeSubTab.replace('-', ' ')}</th>
                <th className="px-8 py-5 text-right">Ação Direta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResidents.map((resident) => (
                <tr key={resident.id} className="hover:bg-blue-50/20 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img 
                          src={resident.photo || `https://ui-avatars.com/api/?name=${resident.name}&background=004c99&color=fff`} 
                          alt={resident.name}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-md group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div>
                        <div className="font-black text-gray-900 uppercase text-xs tracking-tighter">{resident.name}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">CPF: {resident.cpf}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {renderModuleSummary(resident)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button 
                        onClick={() => onEdit(resident)}
                        className={`px-6 py-2.5 bg-white border border-gray-200 rounded-xl transition-all inline-flex items-center gap-2 font-black text-[10px] uppercase shadow-sm ${
                          showArchived ? 'text-amber-600 hover:bg-amber-50' : 'text-[#004c99] hover:bg-[#004c99] hover:text-white'
                        }`}
                      >
                        <span>{showArchived ? 'Ver Histórico' : getActionText()}</span>
                        <ChevronRight size={14} />
                      </button>
                      
                      {showArchived ? (
                        <button 
                          onClick={() => onDelete(resident.id)}
                          className="p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-red-100 shadow-sm"
                          title="Excluir Definitivamente"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => setArchivingResident(resident)}
                          className="p-2.5 bg-gray-50 text-gray-400 hover:bg-amber-100 hover:text-amber-700 rounded-xl transition-all border border-gray-100 shadow-sm"
                          title="Arquivar Residente"
                        >
                          <Archive size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredResidents.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <Search size={48} />
                      <span className="font-black uppercase text-xs">Nenhum residente encontrado</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal de Arquivamento */}
      {archivingResident && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-50 p-6 border-b border-amber-100 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-amber-900 uppercase tracking-tighter">Arquivar Residente</h3>
                <p className="text-[10px] font-bold text-amber-700 uppercase mt-1">Desacolhimento do idoso: {archivingResident.name}</p>
              </div>
              <button 
                onClick={() => setArchivingResident(null)}
                className="p-2 hover:bg-amber-100 rounded-full text-amber-900"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo do Desacolhimento</label>
                <select 
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-amber-500 focus:outline-none font-bold text-sm text-gray-700 transition-all"
                  value={archivingReason}
                  onChange={(e) => setArchivingReason(e.target.value as any)}
                >
                  <option value="inadaptacao">Inadaptação</option>
                  <option value="quebra_regras">Quebra de Regras</option>
                  <option value="desistencia">Desistência do Idoso</option>
                  <option value="vontade_familiar">Vontade Familiar</option>
                  <option value="falecimento">Falecimento</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações Adicionais</label>
                <textarea 
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-amber-500 focus:outline-none font-medium text-sm text-gray-700 min-h-[100px] resize-none"
                  placeholder="Detalhes sobre o arquivamento..."
                  value={archivingNotes}
                  onChange={(e) => setArchivingNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setArchivingResident(null)}
                  className="flex-1 py-4 px-6 border-2 border-gray-100 rounded-2xl text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 bg-white transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleArchive}
                  className="flex-1 py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-amber-100 transition-all flex items-center justify-center gap-2"
                >
                  <Archive size={16} />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElderlyList;
