import React, { useState, useEffect } from 'react';
import { Search, Users, Activity, Plus, FileText, AlertCircle, TrendingUp, TrendingDown, List, Building2, Package } from 'lucide-react';
import { Resident, Medication, ResidentMedicationStockMovement } from '../types';
import { fetchMedicationStockMovements, saveMedicationStockMovement } from '../lib/api';

export const IndividualInventoryTab: React.FC<{ residents: Resident[], session: any }> = ({ residents, session }) => {
  const [viewMode, setViewMode] = useState<'resident' | 'general'>('resident');
  
  // Por Residente mode
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [searchTermResident, setSearchTermResident] = useState('');
  
  // Lista Geral mode
  const [searchTermGeneral, setSearchTermGeneral] = useState('');
  const [filterGeneral, setFilterGeneral] = useState<'todos' | 'critico' | 'zerado' | 'institucional'>('todos');

  // All movements for the institution
  const [movements, setMovements] = useState<ResidentMedicationStockMovement[]>([]);
  
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [selectedMedContext, setSelectedMedContext] = useState<{
    ownerType: 'resident' | 'institution';
    ownerId: string;
    prescriptionId?: string;
    name: string;
    nivelCritico?: number;
    isNew?: boolean;
  } | null>(null);

  // Form states
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Compra');
  const [observation, setObservation] = useState('');
  const [criticalLevel, setCriticalLevel] = useState('');
  const [newMedName, setNewMedName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedResident = residents.find(r => r.id === selectedResidentId);
  const filteredResidents = residents.filter(r => r.name.toLowerCase().includes(searchTermResident.toLowerCase()));

  useEffect(() => {
    if (session?.institutionId) {
       fetchMedicationStockMovements(session.institutionId)
         .then(setMovements)
         .catch(console.error);
    }
  }, [session?.institutionId]);

  const calculateStock = (ownerType: string, ownerId: string, prescriptionId?: string, medName?: string) => {
    let current = 0;
    let entradas = 0;
    let saidas = 0;
    let lastCritical = 0;
    
    const itemMovements = movements.filter(m => {
       const isOwnerMatch = (m.ownerType === ownerType && m.ownerId === ownerId) || 
                            (!m.ownerType && ownerType === 'resident' && m.residentId === ownerId);
       const isMedMatch = prescriptionId ? (m.prescriptionId === prescriptionId) : (m.medicamentoPrescritoTexto === medName);
       return isOwnerMatch && isMedMatch;
    });
    
    // Sort chronological to ensure we get the latest critical level if multiple variations exist
    const sortedMovements = [...itemMovements].sort((a,b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
    
    sortedMovements.forEach(m => {
      if (m.tipoMovimentacao === 'entrada' || m.tipoMovimentacao === 'ajuste_positivo') {
        current += Number(m.quantidade);
        entradas += Number(m.quantidade);
      } else if (m.tipoMovimentacao === 'saida' || m.tipoMovimentacao === 'ajuste_negativo') {
        current -= Number(m.quantidade);
        saidas += Number(m.quantidade);
      }
      if (m.nivelCritico !== undefined) lastCritical = m.nivelCritico;
    });

    return { current, entradas, saidas, lastCritical, itemMovements: sortedMovements };
  };

  const handleSaveMovement = async (type: 'entrada' | 'saida') => {
    if (!selectedMedContext || !quantity) return;
    
    const finalName = selectedMedContext.isNew ? newMedName : selectedMedContext.name;
    if (!finalName) return alert("Preencha o nome do medicamento.");

    setIsLoading(true);
    const newMovement: any = {
      institutionId: session?.institutionId,
      ownerType: selectedMedContext.ownerType,
      ownerId: selectedMedContext.ownerId,
      residentId: selectedMedContext.ownerType === 'resident' ? selectedMedContext.ownerId : undefined,
      prescriptionId: selectedMedContext.prescriptionId || '',
      medicamentoPrescritoTexto: finalName,
      tipoMovimentacao: type,
      quantidade: Number(quantity),
      motivo: reason,
      dataHora: new Date().toISOString(),
      responsavelUserId: session?.userId || '',
      responsavelNome: session?.userName || 'Usuário Atual',
      observacoes: observation,
      nivelCritico: criticalLevel ? Number(criticalLevel) : undefined
    };

    try {
      const saved = await saveMedicationStockMovement(newMovement);
      setMovements(prev => [...prev, { ...newMovement, id: saved.id || Math.random().toString() }]);
      setIsEntryModalOpen(false);
      setIsExitModalOpen(false);
      setQuantity('');
      setReason('Compra');
      setObservation('');
      setCriticalLevel('');
      setNewMedName('');
    } catch (error) {
      alert("Erro ao salvar movimentação de estoque");
    } finally {
      setIsLoading(false);
    }
  };

  const getInstitutionalMeds = () => {
    const instMovements = movements.filter(m => m.ownerType === 'institution');
    const uniqueMeds = Array.from<string>(new Set(instMovements.map(m => m.medicamentoPrescritoTexto)));
    return uniqueMeds.map(name => {
       const stats = calculateStock('institution', session?.institutionId || '', undefined, name);
       return { name, ...stats };
    });
  };

  const getResidentMergedMeds = (resident: Resident) => {
    const mergedList: { id?: string; name: string }[] = [];
    
    // Add all active prescriptions first
    if (resident.medications) {
       resident.medications.forEach(m => {
          mergedList.push({ id: m.id, name: m.name });
       });
    }
    
    // Add any medication from movements that is not in active prescriptions
    const resMovements = movements.filter(m => (m.ownerType === 'resident' && m.ownerId === resident.id) || (!m.ownerType && m.residentId === resident.id));
    resMovements.forEach(m => {
       // match by prescriptionId if we have it, else by name
       const exists = mergedList.find(listItem => 
          (m.prescriptionId && listItem.id === m.prescriptionId) || 
          listItem.name === m.medicamentoPrescritoTexto
       );
       if (!exists) {
          mergedList.push({ id: m.prescriptionId || undefined, name: m.medicamentoPrescritoTexto });
       }
    });
    
    return mergedList;
  };

  const renderMedCard = (medName: string, stats: any, context: any, showOwner?: string) => {
    const isCritical = stats.lastCritical > 0 && stats.current <= stats.lastCritical;

    if (filterGeneral === 'critico' && !isCritical) return null;
    if (filterGeneral === 'zerado' && stats.current > 0) return null;

    if (searchTermGeneral) {
      const s = searchTermGeneral.toLowerCase();
      if (!medName.toLowerCase().includes(s) && !(showOwner && showOwner.toLowerCase().includes(s))) {
         return null;
      }
    }

    return (
      <div key={`${context.ownerId}-${context.prescriptionId || medName}`} className={`rounded-2xl border flex flex-col p-4 shadow-sm transition-all ${isCritical ? 'bg-red-50/50 border-red-200 shadow-red-50' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
         <div className="mb-4">
           {showOwner && <p className="text-[10px] uppercase font-black tracking-widest text-[#004c99] mb-1 opacity-70 truncate">{showOwner}</p>}
           <div className="flex justify-between items-start gap-2">
             <h5 className="text-sm font-black uppercase text-gray-800 line-clamp-2" title={medName}>{medName}</h5>
             {isCritical && <span className="px-2 py-1 bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-widest rounded-md shrink-0 border border-red-200">Estoque Crítico</span>}
           </div>
           <p className="text-[10px] font-bold text-gray-400 uppercase mt-2 tracking-widest">
             Crítico estabelecido: {stats.lastCritical > 0 ? stats.lastCritical : 'Não definido'}
           </p>
           {stats.itemMovements && stats.itemMovements.length > 0 && (
             <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest">
               Última Movimentação: {new Date(stats.itemMovements[stats.itemMovements.length - 1].dataHora).toLocaleDateString('pt-BR')}
             </p>
           )}
         </div>

         <div className="grid grid-cols-3 gap-2 mb-4 bg-gray-50/50 p-2 text-center rounded-xl border border-gray-100">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Entradas</p>
              <p className="text-lg font-black text-green-600">{stats.entradas}</p>
            </div>
            <div className="border-x border-gray-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Saídas</p>
              <p className="text-lg font-black text-red-600">{stats.saidas}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Atual</p>
              <p className={`text-xl font-black ${stats.current > 0 ? 'text-[#004c99]' : 'text-orange-500'}`}>{stats.current}</p>
            </div>
         </div>

         <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
           <button 
              onClick={() => { setSelectedMedContext(context); setCriticalLevel(stats.lastCritical || ''); setIsEntryModalOpen(true); }}
              className="flex-1 py-2.5 bg-green-50 text-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5"
           >
             <TrendingUp size={14} /> Entrada
           </button>
           <button 
              onClick={() => { setSelectedMedContext(context); setCriticalLevel(stats.lastCritical || ''); setIsExitModalOpen(true); }}
              className="flex-1 py-2.5 bg-red-50 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
           >
             <TrendingDown size={14} /> Saída
           </button>
           <button 
              onClick={() => { setSelectedMedContext(context); setIsHistoryModalOpen(true); }}
              className="w-12 flex bg-gray-50 text-gray-500 border border-gray-200 rounded-xl items-center justify-center hover:bg-gray-100 transition-colors"
              title="Histórico de Movimentações"
           >
             <FileText size={16} />
           </button>
         </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full">
       
       <div className="bg-white rounded-[30px] p-2 flex border shadow-sm shrink-0">
          <button 
             onClick={() => setViewMode('resident')} 
             className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-[20px] transition-all flex items-center justify-center gap-2 ${viewMode === 'resident' ? 'bg-[#004c99] text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
          >
             <Users size={16} /> Visão por Residente
          </button>
          <button 
             onClick={() => setViewMode('general')} 
             className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-[20px] transition-all flex items-center justify-center gap-2 ${viewMode === 'general' ? 'bg-[#004c99] text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
          >
             <List size={16} /> Lista Geral
          </button>
       </div>

       {viewMode === 'resident' && (
         <div className="flex flex-col h-full overflow-hidden">
            <div className="bg-white rounded-[40px] shadow-sm border p-6 flex flex-col relative z-20 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder={selectedResident ? `Selecionado: ${selectedResident.name} (Clique para alterar)` : "Buscar residente por nome..."}
                  value={searchTermResident}
                  onChange={e => setSearchTermResident(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold uppercase text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:normal-case"
                />
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>

              {searchTermResident && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border overflow-hidden max-h-60 overflow-y-auto">
                  {filteredResidents.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedResidentId(r.id);
                        setSearchTermResident('');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 text-sm font-bold text-gray-700 uppercase"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedResident ? (
              <div className="bg-white rounded-[40px] shadow-sm border p-6 flex-1 overflow-auto flex flex-col mt-6 pt-8">
                <div className="mb-6 pb-4 border-b">
                  <h4 className="text-xl font-black uppercase tracking-tight text-gray-800">{selectedResident.name}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                     {getResidentMergedMeds(selectedResident).length} Itens monitorados
                  </p>
                </div>

                {getResidentMergedMeds(selectedResident).length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-3xl border border-dashed">
                    <Package size={32} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-sm font-bold text-gray-600 uppercase">Sem medicamentos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getResidentMergedMeds(selectedResident).map(med => {
                      const stats = calculateStock('resident', selectedResident.id, med.id, med.name);
                      const ctx = { ownerType: 'resident' as const, ownerId: selectedResident.id, prescriptionId: med.id, name: med.name };
                      return renderMedCard(med.name, stats, ctx);
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50">
                 <Users size={48} className="text-gray-300 mb-4" />
                 <p className="text-sm font-black uppercase text-gray-500 tracking-widest">Selecione um residente</p>
              </div>
            )}
         </div>
       )}

       {viewMode === 'general' && (
         <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-wrap gap-4 mb-6 shrink-0 bg-white p-6 rounded-[30px] border shadow-sm z-20 relative">
               <div className="relative flex-1 min-w-[200px]">
                 <input 
                   type="text" 
                   value={searchTermGeneral}
                   onChange={e => setSearchTermGeneral(e.target.value)}
                   placeholder="Buscar por morador ou remédio..." 
                   className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 placeholder:normal-case"
                 />
                 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
               </div>
               <div className="flex bg-gray-50 p-1 rounded-[20px] shrink-0 border border-gray-100">
                  <button onClick={() => setFilterGeneral('todos')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-colors ${filterGeneral === 'todos' ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>Todos</button>
                  <button onClick={() => setFilterGeneral('critico')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-colors flex items-center gap-1 ${filterGeneral === 'critico' ? 'bg-red-50 text-red-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                    <AlertCircle size={12} /> Crítico
                  </button>
                  <button onClick={() => setFilterGeneral('zerado')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-colors ${filterGeneral === 'zerado' ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Zerados</button>
                  <button onClick={() => setFilterGeneral('institucional')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-colors flex items-center gap-1 ${filterGeneral === 'institucional' ? 'bg-[#004c99] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                    <Building2 size={12} /> Instituição
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-auto bg-transparent space-y-8 pr-2">
               {/* Residents loop */}
               {filterGeneral !== 'institucional' && residents.map(r => {
                 const mergedMeds = getResidentMergedMeds(r);
                 if (mergedMeds.length > 0) {
                    const residentCards = mergedMeds.map(med => {
                       const stats = calculateStock('resident', r.id, med.id, med.name);
                       const ctx = { ownerType: 'resident' as const, ownerId: r.id, prescriptionId: med.id, name: med.name };
                       return renderMedCard(med.name, stats, ctx, r.name);
                    }).filter(Boolean); // Filter out nulls from filter logic

                    if (residentCards.length > 0) {
                      return (
                         <div key={r.id} className="bg-white rounded-[40px] p-8 border shadow-sm">
                           <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                             <div className="w-10 h-10 rounded-full bg-[#004c99]/10 flex items-center justify-center text-[#004c99]">
                               <Users size={18} />
                             </div>
                             <h4 className="text-lg font-black uppercase text-gray-800 tracking-tight">{r.name}</h4>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {residentCards}
                           </div>
                         </div>
                      );
                    }
                 }
                 return null;
               })}

               {/* Institution Loop */}
               {(filterGeneral === 'todos' || filterGeneral === 'institucional' || filterGeneral === 'critico' || filterGeneral === 'zerado') && (
                 <div className="bg-gray-800 rounded-[40px] p-8 border border-gray-700 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-bl-full pointer-events-none"></div>
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-700 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-sm">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <h4 className="text-xl font-black uppercase tracking-tight text-white">Estoque Institucional</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Uso geral do Residencial</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedMedContext({ ownerType: 'institution', ownerId: session?.institutionId || '', name: '', isNew: true });
                          setIsEntryModalOpen(true);
                        }}
                        className="px-5 py-3 bg-white text-gray-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-xl"
                      >
                         <Plus size={16} /> Novo Item
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                       {getInstitutionalMeds().map(instMed => {
                         const ctx = { ownerType: 'institution' as const, ownerId: session?.institutionId || '', name: instMed.name };
                         return renderMedCard(instMed.name, instMed, ctx, 'Instituição');
                       })}
                       {getInstitutionalMeds().length === 0 && (
                          <div className="col-span-full p-8 text-center text-gray-400 border border-dashed border-gray-600 rounded-3xl">
                            Nenhum medicamento lançado para a instituição
                          </div>
                       )}
                    </div>
                 </div>
               )}
            </div>
         </div>
       )}

       {/* Entry Modal */}
       {isEntryModalOpen && selectedMedContext && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-[30px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 border border-green-100">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                   <TrendingUp size={20} />
                 </div>
                 <div>
                   <h3 className="text-sm font-black uppercase text-green-800 tracking-widest">Informar Entrada</h3>
                   {!selectedMedContext.isNew && <p className="text-xs text-gray-500 font-bold mt-1 line-clamp-1">{selectedMedContext.name}</p>}
                 </div>
               </div>

               <div className="space-y-5">
                  {selectedMedContext.isNew && (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Nome Comercial ou Princípio</label>
                      <input type="text" placeholder="Ex: Dipirona 500mg" value={newMedName} onChange={e=>setNewMedName(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl text-sm font-bold uppercase text-gray-700 outline-none focus:ring-2 focus:ring-green-100" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Qtd (Unidades)</label>
                      <input type="number" placeholder="Ex: 30" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl text-lg font-black text-green-700 text-center outline-none focus:ring-2 focus:ring-green-100" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Nível Crítico</label>
                      <input type="number" placeholder="Ex: 5" value={criticalLevel} onChange={e=>setCriticalLevel(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl text-lg font-black text-orange-500 text-center outline-none focus:ring-2 focus:ring-orange-100" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Origem/Motivo</label>
                    <select value={reason} onChange={e=>setReason(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl outline-none text-sm font-bold uppercase text-gray-600 focus:ring-2 focus:ring-green-100">
                      <option>Compra</option>
                      <option>Família</option>
                      <option>Doação Avulsa</option>
                      <option>Posto de Saúde/SUS</option>
                      <option>Ajuste de Estoque Inicial</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Observações (Opcional)</label>
                    <textarea value={observation} onChange={e=>setObservation(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-100" rows={2}></textarea>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                     <button onClick={() => setIsEntryModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                     <button disabled={isLoading} onClick={() => handleSaveMovement('entrada')} className="flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white bg-green-600 rounded-xl hover:bg-green-700 transition-shadow shadow-md shadow-green-600/20 disabled:opacity-50">
                       {isLoading ? 'Salvando...' : 'Confirmar'}
                     </button>
                  </div>
               </div>
            </div>
         </div>
       )}

       {/* Exit Modal */}
       {isExitModalOpen && selectedMedContext && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-[30px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 border border-red-100">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700">
                   <TrendingDown size={20} />
                 </div>
                 <div>
                   <h3 className="text-sm font-black uppercase text-red-800 tracking-widest">Baixar Estoque</h3>
                   <p className="text-xs text-gray-500 font-bold mt-1 line-clamp-1">{selectedMedContext.name}</p>
                 </div>
               </div>

               <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Qtd a Baixar (Unidades)</label>
                    <input type="number" placeholder="Ex: 5" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl text-lg font-black text-red-700 text-center outline-none focus:ring-2 focus:ring-red-100" />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Motivo</label>
                    <select value={reason} onChange={e=>setReason(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl outline-none text-sm font-bold uppercase text-gray-600 focus:ring-2 focus:ring-red-100">
                      <option>Administrado Manualmente</option>
                      <option>Descartado/Vencido</option>
                      <option>Devolvido à Família</option>
                      <option>Perda/Dano</option>
                      <option>Ajuste Negativo</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Observações (Opcional)</label>
                    <textarea value={observation} onChange={e=>setObservation(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-100" rows={2}></textarea>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                     <button onClick={() => setIsExitModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                     <button disabled={isLoading} onClick={() => handleSaveMovement('saida')} className="flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-xl hover:bg-red-700 transition-shadow shadow-md shadow-red-600/20 disabled:opacity-50">
                       {isLoading ? 'Salvando...' : 'Confirmar Baixa'}
                     </button>
                  </div>
               </div>
            </div>
         </div>
       )}

       {/* History Modal */}
       {isHistoryModalOpen && selectedMedContext && (() => {
          const stats = calculateStock(selectedMedContext.ownerType, selectedMedContext.ownerId, selectedMedContext.prescriptionId, selectedMedContext.name);
          return (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
               <div className="bg-white rounded-[30px] p-8 w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-sm font-black uppercase text-[#004c99]">Histórico de Movimentações</h3>
                      <p className="text-xs text-gray-600 font-bold mt-1 line-clamp-1">{selectedMedContext.name}</p>
                    </div>
                    <button onClick={() => setIsHistoryModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-gray-200">Fechar</button>
                  </div>

                  <div className="flex-1 overflow-auto border border-gray-100 rounded-2xl relative">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest sticky top-0 shadow-sm">
                           <tr>
                             <th className="p-4 border-b">Data</th>
                             <th className="p-4 border-b">Operação</th>
                             <th className="p-4 border-b">Quantidade</th>
                             <th className="p-4 border-b">Motivo</th>
                             <th className="p-4 border-b">Responsável</th>
                           </tr>
                        </thead>
                        <tbody className="text-xs">
                           {stats.itemMovements.length === 0 ? (
                             <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-bold uppercase tracking-widest">Nenhuma movimentação</td></tr>
                           ) : (
                               [...stats.itemMovements].reverse().map((m, i) => (
                                 <tr key={m.id || i} className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                                   <td className="p-4 text-gray-500 font-medium">{new Date(m.dataHora).toLocaleString('pt-BR')}</td>
                                   <td className="p-4">
                                      <span className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center justify-center w-max gap-1 ${
                                        m.tipoMovimentacao.includes('entrada') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {m.tipoMovimentacao === 'entrada' || m.tipoMovimentacao === 'ajuste_positivo' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                        {m.tipoMovimentacao}
                                      </span>
                                   </td>
                                   <td className={`p-4 font-black ${m.tipoMovimentacao.includes('entrada') ? 'text-green-600' : 'text-red-600'}`}>
                                      {m.tipoMovimentacao.includes('entrada') ? '+' : '-'}{m.quantidade}
                                   </td>
                                   <td className="p-4 text-gray-700">
                                      <div className="font-bold">{m.motivo}</div>
                                      {m.observacoes && <div className="text-[10px] text-gray-400 italic mt-0.5">{m.observacoes}</div>}
                                   </td>
                                   <td className="p-4 text-gray-500 font-black tracking-widest text-[10px] uppercase">
                                     {m.responsavelNome}
                                   </td>
                                 </tr>
                               ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
             </div>
          );
       })()}
    </div>
  );
};
