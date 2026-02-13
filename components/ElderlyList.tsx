
import React from 'react';
import { Search, Plus, Filter, UserPlus, ChevronRight, AlertCircle, Calendar } from 'lucide-react';
import { Resident, SubTab } from '../types';

interface ElderlyListProps {
  residents: Resident[];
  activeSubTab: SubTab;
  onAdd: () => void;
  onEdit: (resident: Resident) => void;
}

const ElderlyList: React.FC<ElderlyListProps> = ({ residents, activeSubTab, onAdd, onEdit }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cpf.includes(searchTerm)
  );

  const getActionText = () => {
    switch(activeSubTab) {
      case 'familiares-visitantes': return 'Gerenciar Visitas';
      case 'financeiro': return 'Lançar Financeiro';
      case 'itens': return 'Ver Itens';
      case 'saude': return 'Ver Saúde';
      case 'medicamentos': return 'Controle Farmácia';
      case 'convenio': return 'Ver Convênios';
      default: return 'Abrir Ficha Geral';
    }
  };

  const renderModuleSummary = (resident: Resident) => {
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
      case 'saude':
        const lastHealth = resident.healthUpdates[0];
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Última Evolução:</div>
            <div className="font-bold text-gray-700">{lastHealth ? lastHealth.date : 'Nenhum registro'}</div>
          </div>
        );
      case 'medicamentos':
        const lowStock = resident.medications.some(m => m.stock <= 5);
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Medicações:</div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700">{resident.medications.length} Ativas</span>
              {lowStock && <AlertCircle size={12} className="text-red-500 animate-pulse" />}
            </div>
          </div>
        );
      default:
        return (
          <div className="text-[10px] uppercase">
            <div className="font-black text-gray-400">Unidade:</div>
            <div className="font-bold text-red-600">{resident.room || 'Não Alocado'}</div>
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
            Visualizando informações de <span className="text-[#004c99]">{activeSubTab.replace('-', ' ')}</span> • {residents.length} Idosos cadastrados
          </p>
        </div>
        <button
          onClick={onAdd}
          className="bg-[#004c99] hover:bg-blue-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-xl transition-all font-black text-xs uppercase"
        >
          <UserPlus size={18} />
          <span>Cadastrar Idoso</span>
        </button>
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
                    <button 
                      onClick={() => onEdit(resident)}
                      className="px-6 py-2.5 bg-white border border-gray-200 text-[#004c99] hover:bg-[#004c99] hover:text-white rounded-xl transition-all inline-flex items-center gap-2 font-black text-[10px] uppercase shadow-sm group-hover:shadow-blue-200"
                    >
                      <span>{getActionText()}</span>
                      <ChevronRight size={14} />
                    </button>
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
    </div>
  );
};

export default ElderlyList;
