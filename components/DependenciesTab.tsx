import React, { useState, useEffect } from 'react';
import { Resident } from '../types';
import { CheckSquare, Square, Search, Save, Settings2 } from 'lucide-react';
import { getProfessionalSignature } from '../lib/api';

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
  const [editedGrauManual, setEditedGrauManual] = useState<Record<string, number | null>>({});
  
  const handleCheckboxChange = (residentId: string, careKey: string, checked: boolean) => {
    setEditedMods(prev => ({
      ...prev,
      [residentId]: {
        ...(prev[residentId] || {}),
        [careKey]: checked
      }
    }));
  };

  const handleGrauManualChange = (residentId: string, value: number | null) => {
    setEditedGrauManual(prev => ({
      ...prev,
      [residentId]: value
    }));
  };

  const getCareValue = (r: Resident, careKey: string) => {
    if (editedMods[r.id] && editedMods[r.id][careKey] !== undefined) {
      return editedMods[r.id][careKey];
    }
    return (r.careNeeds as any)?.[careKey] || false;
  };

  // Helper to calculate computed degree based on current visible checkboxes
  const calculateComputedDegree = (r: Resident) => {
    let count = 0;
    const careKeys = [
      'bathAssistance',
      'oralHygieneAssistance',
      'feedingAssistance',
      'diaperChangeAssistance',
      'decubitusChangeAssistance',
      'tricotomyAssistance',
      'nailCareAssistance',
      'woundCareAssistance'
    ];
    
    careKeys.forEach(k => {
      if (getCareValue(r, k)) count++;
    });

    if (count <= 2) return 1;
    if (count <= 5) return 2;
    return 3;
  };

  const getFinalGrau = (r: Resident) => {
    const computed = calculateComputedDegree(r);
    // Check if edited manual degree
    if (editedGrauManual[r.id] !== undefined) {
      if (editedGrauManual[r.id] !== null) return editedGrauManual[r.id];
      return computed;
    }
    // Check if resident has manual degree
    if (r.grauDependenciaManual !== undefined && r.grauDependenciaManual !== null) {
      return r.grauDependenciaManual;
    }
    return computed;
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
        'nailCareAssistance',
        'woundCareAssistance'
      ];
      return careKeys.some(key => getCareValue(r, key));
    }
    
    return true;
  });

  const hasChanges = Object.keys(editedMods).length > 0 || Object.keys(editedGrauManual).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;

    const sigData = getProfessionalSignature();
    const updaterName = sigData.profissionalAssinaturaTexto || sigData.profissionalNome || 'Profissional';
    const now = new Date().toISOString();

    // Determine which ones were modified
    const modifiedIds = new Set([...Object.keys(editedMods), ...Object.keys(editedGrauManual)]);

    const updatedResidents = activeResidents.filter(r => modifiedIds.has(r.id)).map(r => {
      const mergedCareNeeds = {
         ...(r.careNeeds || {}),
         ...(editedMods[r.id] || {})
      };
      
      // Calculate new computed based entirely on the merged
      let count = 0;
      const careKeys = ['bathAssistance', 'oralHygieneAssistance', 'feedingAssistance', 'diaperChangeAssistance', 'decubitusChangeAssistance', 'tricotomyAssistance', 'nailCareAssistance', 'woundCareAssistance'];
      careKeys.forEach(k => { if ((mergedCareNeeds as any)[k]) count++; });
      const computed = count <= 2 ? 1 : count <= 5 ? 2 : 3;

      let manual = r.grauDependenciaManual;
      if (editedGrauManual[r.id] !== undefined) {
         manual = editedGrauManual[r.id] || null;
      }

      const finalDegree = manual !== null && manual !== undefined ? manual : computed;

      return {
        ...r,
        careNeeds: mergedCareNeeds,
        grauDependenciaCalculado: computed,
        grauDependenciaManual: manual === null ? undefined : manual,
        grauDependenciaFinal: finalDegree,
        grauDependenciaAtualizadoEm: now,
        grauDependenciaAtualizadoPor: updaterName
      };
    });

    if (onBulkSaveResidents) {
      await onBulkSaveResidents(updatedResidents);
    } else if (onSaveResident) {
      for (const res of updatedResidents) {
        await onSaveResident(res);
      }
    }
    
    setEditedMods({});
    setEditedGrauManual({});
    alert(`Dependências atualizadas para ${updatedResidents.length} residente(s).`);
  };

  const handleCancel = () => {
    setEditedMods({});
    setEditedGrauManual({});
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

      <div className="flex-1 overflow-hidden p-6 flex flex-col">
        <div className="bg-white border text-gray-200 rounded-2xl shadow-sm overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50">
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest sticky left-0 top-0 bg-gray-50 z-30 w-64 border-b border-r border-gray-100 shadow-[1px_0_0_0_#f3f4f6]">
                  Residente
                </th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Banho</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Higiene Oral</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Alimentação</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Fralda</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Decúbito</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Barba/Trico</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Unhas</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-28 bg-gray-50 border-b border-gray-100">Curativos</th>
                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center w-40 bg-gray-50 border-b border-l border-gray-100 shadow-[-1px_0_0_0_#f3f4f6]">Grau Dependência</th>
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

                const finalGrau = getFinalGrau(r);
                const computed = calculateComputedDegree(r);
                const isManual = (editedGrauManual[r.id] !== undefined && editedGrauManual[r.id] !== null) || 
                                 (editedGrauManual[r.id] === undefined && r.grauDependenciaManual !== undefined && r.grauDependenciaManual !== null);
                const isEditedDegree = editedGrauManual[r.id] !== undefined;
                const currentManualVal = isEditedDegree ? editedGrauManual[r.id] : (r.grauDependenciaManual ?? null);

                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 border-b border-gray-50 sticky left-0 bg-white z-10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase text-gray-900 tracking-tight">{r.name}</p>
                          <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                            Q. {r.room || '--'} • L. {r.bedNumber || '--'}
                          </p>
                        </div>
                        {isManual && (
                          <span title="Ajustado manualmente" className="ml-2 w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                        )}
                      </div>
                    </td>
                    <CareCell careKey="bathAssistance" />
                    <CareCell careKey="oralHygieneAssistance" />
                    <CareCell careKey="feedingAssistance" />
                    <CareCell careKey="diaperChangeAssistance" />
                    <CareCell careKey="decubitusChangeAssistance" />
                    <CareCell careKey="tricotomyAssistance" />
                    <CareCell careKey="nailCareAssistance" />
                    <CareCell careKey="woundCareAssistance" />
                    <td className="p-2 border-b border-l border-gray-100 bg-gray-50/30">
                      <div className="flex flex-col items-center gap-1 w-full relative">
                        <select
                          className={`w-full p-2 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none border transition-all text-center
                            ${finalGrau === 1 ? 'bg-green-50 text-green-700 border-green-200' : 
                              finalGrau === 2 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                'bg-red-50 text-red-700 border-red-200'}
                          `}
                          value={currentManualVal === null ? "" : currentManualVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleGrauManualChange(r.id, val === "" ? null : Number(val));
                          }}
                        >
                          <option value="" className="text-gray-600 bg-white">Auto (G{computed})</option>
                          <option value="1" className="text-gray-600 bg-white">Grau 1</option>
                          <option value="2" className="text-gray-600 bg-white">Grau 2</option>
                          <option value="3" className="text-gray-600 bg-white">Grau 3</option>
                        </select>
                      </div>
                    </td>
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
