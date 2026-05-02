import React, { useState, useEffect } from 'react';
import { Resident } from '../types';
import { CheckSquare, Square, Search, Save, Settings2 } from 'lucide-react';

interface DependenciesTabProps {
  residents: Resident[];
  onBulkSaveResidents?: (residents: Resident[]) => void;
  onSaveResident?: (resident: Resident) => void;
}

const DependenciesTab: React.FC<DependenciesTabProps> = ({ residents, onBulkSaveResidents, onSaveResident }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  
  // Local state for edits
  const [editedMods, setEditedMods] = useState<Record<string, Record<string, boolean>>>({});
  
  const handleCheckboxChange = (residentId: string, careKey: string, checked: boolean) => {
    setEditedMods(prev => ({
      ...prev,
      [residentId]: {
        ...(prev[residentId] || {}),
        [careKey]: checked
      }
    }));
  };

  const getCareValue = (r: Resident, careKey: string) => {
    if (editedMods[r.id] && editedMods[r.id][careKey] !== undefined) {
      return editedMods[r.id][careKey];
    }
    return (r.careNeeds as any)?.[careKey] || false;
  };

  const activeResidents = residents; // Filtering for active relies on the caller or assume all passed are active

  const filteredResidents = activeResidents.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    if (filterActive) {
      // Show only if they have at least one dependency marked (either original or edited)
      const careKeys = [
        'bathAssistance',
        'oralHygieneAssistance',
        'feedingAssistance',
        'diaperChangeAssistance',
        'decubitusChangeAssistance',
        'tricotomyAssistance',
        'nailCareAssistance'
      ];
      return careKeys.some(key => getCareValue(r, key));
    }
    
    return true;
  });

  const hasChanges = Object.keys(editedMods).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;

    // Build the updated residents
    const updatedResidents = activeResidents.map(r => {
      if (editedMods[r.id]) {
        return {
          ...r,
          careNeeds: {
            ...(r.careNeeds || {}),
            ...editedMods[r.id]
          }
        };
      }
      return r;
    }).filter(r => editedMods[r.id]); // Only keep modified

    if (onBulkSaveResidents) {
      await onBulkSaveResidents(updatedResidents);
    } else if (onSaveResident) {
      for (const res of updatedResidents) {
        await onSaveResident(res);
      }
    }
    
    setEditedMods({});
    alert(`Dependências atualizadas para ${updatedResidents.length} residente(s).`);
  };

  const handleCancel = () => {
    setEditedMods({});
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 flex-1">
      <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-black text-[#004c99] uppercase tracking-tighter flex items-center gap-2">
            <Settings2 size={24} />
            Mapeamento de Dependências
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Marque as necessidades de cuidado para cada residente
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-tight focus:bg-white focus:border-blue-200 outline-none transition-all"
            />
          </div>
          
          <button 
            onClick={() => setFilterActive(!filterActive)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              filterActive ? 'bg-blue-50 text-[#004c99] border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {filterActive ? 'Ver Todos' : 'Apenas C/ Dependências'}
          </button>

          {hasChanges && (
            <>
              <button 
                onClick={handleCancel}
                className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-md flex items-center gap-2"
              >
                <Save size={14} />
                Salvar Alterações
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border text-gray-200 rounded-2xl shadow-sm overflow-hidden min-w-max">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest sticky left-0 bg-gray-50 z-10 w-64">
                  Residente
                </th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28">Banho</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28">Higiéne Oral</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28">Alimentação</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28">Fralda</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28">Decúbito</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28">Barba/Trico</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28">Unhas</th>
              </tr>
            </thead>
            <tbody>
              {filteredResidents.map(r => {
                const CareCell = ({ careKey }: { careKey: string }) => {
                  const val = getCareValue(r, careKey);
                  return (
                    <td className="p-2 border-b border-gray-50">
                      <button
                        onClick={() => handleCheckboxChange(r.id, careKey, !val)}
                        className={`w-full h-12 rounded-xl flex items-center justify-center transition-all ${
                          val 
                            ? 'bg-blue-50 text-[#004c99]' 
                            : 'hover:bg-gray-50 text-gray-300'
                        }`}
                      >
                        {val ? <CheckSquare size={24} /> : <Square size={24} />}
                      </button>
                    </td>
                  );
                };

                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 border-b border-gray-50 sticky left-0 bg-white z-10">
                      <p className="text-xs font-black uppercase text-gray-900 tracking-tight">{r.name}</p>
                      <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                        Q. {r.room || '--'} • L. {r.bedNumber || '--'}
                      </p>
                    </td>
                    <CareCell careKey="bathAssistance" />
                    <CareCell careKey="oralHygieneAssistance" />
                    <CareCell careKey="feedingAssistance" />
                    <CareCell careKey="diaperChangeAssistance" />
                    <CareCell careKey="decubitusChangeAssistance" />
                    <CareCell careKey="tricotomyAssistance" />
                    <CareCell careKey="nailCareAssistance" />
                  </tr>
                );
              })}
              
              {filteredResidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nenhum residente encontrado</p>
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

export default DependenciesTab;
