import React, { useState, useEffect } from 'react';
import { Search, Users, Activity, Plus, FileText, AlertCircle, TrendingUp, TrendingDown, List, Building2, Package } from 'lucide-react';
import { Resident, Medication, ResidentMedicationStockMovement, InstitutionSettings } from '../types';
import { fetchMedicationStockMovements, saveMedicationStockMovement } from '../lib/api';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const IndividualInventoryTab: React.FC<{ residents: Resident[], session: any, settings?: InstitutionSettings }> = ({ residents, session, settings }) => {
  const [isGeneralListModalOpen, setIsGeneralListModalOpen] = useState(false);
  
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
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'positivo' | 'negativo'>('positivo');
  
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
    
    const normalize = (n: string) => (n || '').trim().toLowerCase();
    const searchName = normalize(medName || '');

    const itemMovements = movements.filter(m => {
       const isOwnerMatch = (m.ownerType === ownerType && m.ownerId === ownerId) || 
                            (!m.ownerType && ownerType === 'resident' && m.residentId === ownerId);
       
       const mName = normalize(m.medicamentoPrescritoTexto);
       let isMedMatch = (mName === searchName);
       if (!isMedMatch && ownerType === 'resident' && prescriptionId && m.prescriptionId === prescriptionId) {
          isMedMatch = true;
       }
       
       return isOwnerMatch && isMedMatch;
    });
    
    // Sort chronological to ensure we get the latest critical level if multiple variations exist
    const sortedMovements = [...itemMovements].sort((a,b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
    
    sortedMovements.forEach(m => {
      if (m.tipoMovimentacao === 'entrada' || (m.tipoMovimentacao as any) === 'ajuste_positivo' || (m.tipoMovimentacao === 'ajuste' && m.ajusteTipo === 'positivo')) {
        current += Number(m.quantidade);
        entradas += Number(m.quantidade);
      } else if (m.tipoMovimentacao === 'saida' || (m.tipoMovimentacao as any) === 'ajuste_negativo' || (m.tipoMovimentacao === 'ajuste' && m.ajusteTipo === 'negativo')) {
        current -= Number(m.quantidade);
        saidas += Number(m.quantidade);
      }
      if (m.nivelCritico !== undefined) lastCritical = m.nivelCritico;
    });

    return { current, entradas, saidas, lastCritical, itemMovements: sortedMovements };
  };

  const handleSaveMovement = async (type: 'entrada' | 'saida' | 'ajuste') => {
    if (!selectedMedContext || !quantity) return;
    
    // validate observation for adjustment
    if (type === 'ajuste' && !observation) {
      return alert("A observação é obrigatória para realizar um ajuste de estoque.");
    }
    
    const finalName = selectedMedContext.isNew ? newMedName : selectedMedContext.name;
    if (!finalName) return alert("Preencha o nome do medicamento.");

    setIsLoading(true);

    // Validate output quantity vs stock
    const stats = calculateStock(selectedMedContext.ownerType, selectedMedContext.ownerId, selectedMedContext.prescriptionId, selectedMedContext.name);
    const amountToDeduct = (type === 'saida' || (type === 'ajuste' && adjustType === 'negativo')) ? Number(quantity) : 0;
    
    if (amountToDeduct > stats.current) {
      if (!observation) {
        setIsLoading(false);
        return alert(`Atenção: Você está tentando baixar uma quantidade (${amountToDeduct}) maior que o estoque atual (${stats.current}). É OBRIGATÓRIO preencher o campo Observações com uma justificativa válida.`);
      }
    }

    const newMovement: any = {
      institutionId: session?.institutionId,
      ownerType: selectedMedContext.ownerType,
      ownerId: selectedMedContext.ownerId,
      residentId: selectedMedContext.ownerType === 'resident' ? selectedMedContext.ownerId : undefined,
      prescriptionId: selectedMedContext.prescriptionId || '',
      medicamentoPrescritoTexto: finalName,
      tipoMovimentacao: type,
      motivo: reason,
      quantidade: Number(quantity),
      dataHora: new Date().toISOString(),
      responsavelUserId: session?.userId || '',
      responsavelNome: session?.userName || 'Usuário Atual',
      origem: 'manual',
      observacoes: observation,
      saldoAnterior: stats.current,
      nivelCritico: criticalLevel ? Number(criticalLevel) : undefined
    };

    if (type === 'ajuste') {
      newMovement.ajusteTipo = adjustType;
      newMovement.saldoAtual = stats.current + (adjustType === 'positivo' ? Number(quantity) : -Number(quantity));
    } else {
      newMovement.saldoAtual = stats.current + (type === 'entrada' ? Number(quantity) : -Number(quantity));
    }

    try {
      const saved = await saveMedicationStockMovement(newMovement);
      setMovements(prev => [...prev, { ...newMovement, id: saved.id || Math.random().toString() }]);
      setIsEntryModalOpen(false);
      setIsExitModalOpen(false);
      setIsAdjustModalOpen(false);
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
    const normalize = (n: string) => (n || '').trim().toLowerCase();
    
    const uniqueMedsMap = new Map<string, string>();
    instMovements.forEach(m => {
       uniqueMedsMap.set(normalize(m.medicamentoPrescritoTexto), m.medicamentoPrescritoTexto);
    });
    
    return Array.from(uniqueMedsMap.values()).map(name => {
       const stats = calculateStock('institution', session?.institutionId || '', undefined, name);
       return { name, ...stats };
    });
  };

  const getResidentMergedMeds = (resident: Resident) => {
    const medMap = new Map<string, { id?: string; name: string }>();
    const normalize = (n: string) => (n || '').trim().toLowerCase();
    
    // Add all active prescriptions first
    if (resident.medications) {
       resident.medications.forEach(m => {
          const norm = normalize(m.name);
          if (!medMap.has(norm)) {
             medMap.set(norm, { id: m.id, name: m.name });
          }
       });
    }
    
    // Add any medication from movements that is not in active prescriptions
    const resMovements = movements.filter(m => (m.ownerType === 'resident' && m.ownerId === resident.id) || (!m.ownerType && m.residentId === resident.id));
    resMovements.forEach(m => {
       const norm = normalize(m.medicamentoPrescritoTexto);
       if (!medMap.has(norm)) {
          medMap.set(norm, { id: m.prescriptionId || undefined, name: m.medicamentoPrescritoTexto });
       }
    });
    
    return Array.from(medMap.values());
  };

  const exportToPdf = () => {
    const doc = new jsPDF();
    
    if (settings) {
       addPdfHeaderAndFooter(doc, settings, 'RELATÓRIO DE ESTOQUE DE MEDICAMENTOS');
    } else {
       doc.setFontSize(16);
       doc.text('RELATÓRIO DE ESTOQUE DE MEDICAMENTOS', 14, 20);
    }
    
    let currentY = settings ? 45 : 30;

    residents.forEach(r => {
       const meds = getResidentMergedMeds(r);
       if (meds.length === 0) return;

       const tableBody = meds.map(med => {
          const stats = calculateStock('resident', r.id, med.id, med.name);
          const current = stats.current;
          const critical = stats.lastCritical;
          let statusLabel = 'Normal';
          if (current <= 0) {
             statusLabel = 'Zerado';
          } else if (critical > 0 && current <= critical) {
             statusLabel = 'Crítico';
          }
          return [med.name, current.toString(), critical > 0 ? critical.toString() : '--', statusLabel];
       });

       doc.setFontSize(12);
       doc.setFont('helvetica', 'bold');
       doc.text(`Residente: ${r.name}`, 14, currentY);
       currentY += 5;

       autoTable(doc, {
          startY: currentY,
          head: [['Medicamento', 'Estoque atual', 'Nível crítico', 'Status']],
          body: tableBody,
          theme: 'grid',
          headStyles: { fillColor: [0, 76, 153], textColor: [255, 255, 255], fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            currentY = data.cursor ? data.cursor.y + 10 : currentY;
          }
       });
       currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    const instMeds = getInstitutionalMeds();
    if (instMeds.length > 0) {
       const tableBody = instMeds.map(med => {
          const stats = calculateStock('institution', session?.institutionId || '', undefined, med.name);
          const current = stats.current;
          const critical = stats.lastCritical;
          let statusLabel = 'Normal';
          if (current <= 0) {
             statusLabel = 'Zerado';
          } else if (critical > 0 && current <= critical) {
             statusLabel = 'Crítico';
          }
          return [med.name, current.toString(), critical > 0 ? critical.toString() : '--', statusLabel];
       });

       if (currentY > 250) {
          doc.addPage();
          currentY = 20;
       }

       doc.setFontSize(12);
       doc.setFont('helvetica', 'bold');
       doc.text(`Instituição`, 14, currentY);
       currentY += 5;

       autoTable(doc, {
          startY: currentY,
          head: [['Medicamento', 'Estoque atual', 'Nível crítico', 'Status']],
          body: tableBody,
          theme: 'grid',
          headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
       });
    }

    doc.save(`Estoque_Medicamentos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
  };

  const renderMedRow = (medName: string, stats: any, context: any, hideActions: boolean = false) => {
    const isCritical = stats.lastCritical > 0 && stats.current <= stats.lastCritical;

    if (filterGeneral === 'critico' && !isCritical) return null;
    if (filterGeneral === 'zerado' && stats.current > 0) return null;

    if (searchTermGeneral) {
      const s = searchTermGeneral.toLowerCase();
      if (!medName.toLowerCase().includes(s)) {
         return null;
      }
    }

    const current = stats.current;
    const critical = stats.lastCritical;
    
    let statusLabel = 'Normal';
    let statusColor = 'bg-green-100 text-green-700 border-green-200';
    if (current <= 0) {
       statusLabel = 'Zerado';
       statusColor = 'bg-red-100 text-red-700 border-red-200';
    } else if (critical > 0 && current <= critical) {
       statusLabel = 'Crítico';
       statusColor = 'bg-orange-100 text-orange-700 border-orange-200';
    }

    return (
      <tr key={`${context.ownerId}-${context.prescriptionId || medName}`} className={`border-b border-gray-100 hover:bg-gray-50/80 transition-colors ${statusLabel === 'Zerado' ? 'bg-red-50/20' : ''}`}>
         <td className="p-4 text-sm font-black text-gray-800 uppercase max-w-[200px]" title={medName}>
           <div className="line-clamp-2">{medName}</div>
         </td>
         <td className="p-4">
             <span className={`text-lg font-black ${current > 0 ? 'text-[#004c99]' : 'text-red-500'}`}>{current}</span>
         </td>
         <td className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{critical > 0 ? critical : '-'}</td>
         <td className="p-4">
             <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded border ${statusColor} inline-block whitespace-nowrap text-center`}>
                {statusLabel}
             </span>
         </td>
         {!hideActions && (
         <td className="p-4">
             <div className="flex flex-wrap gap-2">
               <button onClick={() => { setSelectedMedContext(context); setCriticalLevel(stats.lastCritical || ''); setIsEntryModalOpen(true); }} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-green-200 flex items-center gap-1"><TrendingUp size={12}/> Entrada</button>
               <button onClick={() => { setSelectedMedContext(context); setCriticalLevel(stats.lastCritical || ''); setIsExitModalOpen(true); }} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-red-200 flex items-center gap-1"><TrendingDown size={12}/> Saída</button>
               <button onClick={() => { setSelectedMedContext(context); setCriticalLevel(stats.lastCritical || ''); setIsAdjustModalOpen(true); }} className="px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-orange-200 flex items-center gap-1"><AlertCircle size={12}/> Ajuste</button>
               <button onClick={() => { setSelectedMedContext(context); setIsHistoryModalOpen(true); }} className="px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-gray-200 flex items-center gap-1"><FileText size={12}/> Histórico</button>
             </div>
         </td>
         )}
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full">
       
       <div className="bg-white rounded-[30px] p-6 flex justify-between items-center border shadow-sm shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-[#004c99]/10 rounded-2xl flex items-center justify-center text-[#004c99]">
                <Package size={24} />
             </div>
             <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-800">Controle de Estoque</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">Conferência e Movimentação</p>
             </div>
          </div>
          <button 
             onClick={() => setIsGeneralListModalOpen(true)} 
             className="px-6 py-4 bg-[#004c99] text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[#003366] transition-all flex items-center gap-2 shadow-md shadow-[#004c99]/20"
          >
             <List size={16} /> Abrir Lista Completa
          </button>
       </div>

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
                <div className="mb-6 pb-4 border-b flex justify-between items-center">
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight text-gray-800">{selectedResident.name}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                       {getResidentMergedMeds(selectedResident).length} Itens monitorados
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedMedContext({ ownerType: 'resident', ownerId: selectedResident.id, name: '', isNew: true });
                      setIsEntryModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#003366] transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Plus size={16} /> Nova Entrada Avulsa
                  </button>
                </div>

                {getResidentMergedMeds(selectedResident).length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-3xl border border-dashed flex flex-col items-center">
                    <Package size={32} className="text-gray-400 mb-3" />
                    <p className="text-sm font-bold text-gray-600 uppercase mb-4">Nenhum medicamento encontrado para este residente</p>
                    <button 
                      onClick={() => {
                        setSelectedMedContext({ ownerType: 'resident', ownerId: selectedResident.id, name: '', isNew: true });
                        setIsEntryModalOpen(true);
                      }}
                      className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#003366] transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Plus size={16} /> Lançar Primeira Entrada
                    </button>
                  </div>
                ) : (
                  <div className="bg-white border rounded-[30px] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-gray-50/50 border-b border-gray-100">
                           <tr>
                              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest w-[30%]">Medicamento</th>
                              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Estoque Atual</th>
                              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Nível Crítico</th>
                              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Status</th>
                              <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Ações</th>
                           </tr>
                         </thead>
                         <tbody>
                           {getResidentMergedMeds(selectedResident).map(med => {
                             const stats = calculateStock('resident', selectedResident.id, med.id, med.name);
                             const ctx = { ownerType: 'resident' as const, ownerId: selectedResident.id, prescriptionId: med.id, name: med.name };
                             return renderMedRow(med.name, stats, ctx);
                           })}
                         </tbody>
                      </table>
                    </div>
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

       {isGeneralListModalOpen && (
         <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden animate-in fade-in">
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 shadow-sm relative z-20">
               <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-[#004c99]">Lista Geral de Estoque</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Visão completa e relatórios</p>
               </div>
               <div className="flex gap-3">
                  <button onClick={exportToPdf} className="px-5 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm">
                     <FileText size={16} /> Exportar PDF
                  </button>
                  <button onClick={() => setIsGeneralListModalOpen(false)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">
                     Fechar
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-auto p-6 md:p-8">
               <div className="max-w-6xl mx-auto flex flex-col gap-6">
                  <div className="flex flex-wrap gap-4 shrink-0 bg-white p-6 rounded-[30px] border shadow-sm">
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

                  {/* Residents loop */}
                  {filterGeneral !== 'institucional' && residents.map(r => {
                     const mergedMeds = getResidentMergedMeds(r);
                     if (mergedMeds.length > 0) {
                        const residentCards = mergedMeds.map(med => {
                           const stats = calculateStock('resident', r.id, med.id, med.name);
                           const ctx = { ownerType: 'resident' as const, ownerId: r.id, prescriptionId: med.id, name: med.name };
                           return renderMedRow(med.name, stats, ctx, false);
                        }).filter(Boolean); // Filter out nulls from filter logic

                        if (residentCards.length > 0) {
                          return (
                             <div key={r.id} className="bg-white rounded-[30px] border shadow-sm overflow-hidden">
                               <div className="flex items-center gap-3 p-6 bg-gray-50/50 border-b border-gray-100">
                                 <div className="w-10 h-10 rounded-full bg-[#004c99]/10 flex items-center justify-center text-[#004c99]">
                                   <Users size={18} />
                                 </div>
                                 <h4 className="text-lg font-black uppercase text-gray-800 tracking-tight">{r.name}</h4>
                               </div>
                               <div className="overflow-x-auto">
                                  <table className="w-full text-left">
                                     <thead className="bg-white border-b border-gray-100">
                                       <tr>
                                          <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest w-[30%]">Medicamento</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Estoque Atual</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Nível Crítico</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Status</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Ações</th>
                                       </tr>
                                     </thead>
                                     <tbody>
                                       {residentCards}
                                     </tbody>
                                  </table>
                               </div>
                             </div>
                          );
                        }
                     }
                     return null;
                  })}

                  {/* Institution Loop */}
                  {(filterGeneral === 'todos' || filterGeneral === 'institucional' || filterGeneral === 'critico' || filterGeneral === 'zerado') && (
                     <div className="bg-gray-800 rounded-[30px] border border-gray-700 shadow-lg relative overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-gray-700 relative z-10 bg-gray-900/50">
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

                        <div className="relative z-10 overflow-x-auto">
                           <table className="w-full text-left">
                              <thead className="bg-[#1f2937]/80 border-b border-gray-700">
                                <tr>
                                   <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest w-[30%]">Medicamento</th>
                                   <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Estoque Atual</th>
                                   <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Nível Crítico</th>
                                   <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Status</th>
                                   <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getInstitutionalMeds().map(instMed => {
                                  const ctx = { ownerType: 'institution' as const, ownerId: session?.institutionId || '', name: instMed.name };
                                  const isCritical = instMed.lastCritical > 0 && instMed.current <= instMed.lastCritical;

                                  if (filterGeneral === 'critico' && !isCritical) return null;
                                  if (filterGeneral === 'zerado' && instMed.current > 0) return null;

                                  if (searchTermGeneral) {
                                    const s = searchTermGeneral.toLowerCase();
                                    if (!instMed.name.toLowerCase().includes(s)) {
                                       return null;
                                    }
                                  }

                                  const current = instMed.current;
                                  const critical = instMed.lastCritical;
                                  
                                  let statusLabel = 'Normal';
                                  let statusColor = 'bg-blue-900/40 text-blue-300 border-blue-800';
                                  if (current <= 0) {
                                     statusLabel = 'Zerado';
                                     statusColor = 'bg-red-900/40 text-red-400 border-red-800';
                                  } else if (critical > 0 && current <= critical) {
                                     statusLabel = 'Crítico';
                                     statusColor = 'bg-orange-900/40 text-orange-400 border-orange-800';
                                  }

                                  return (
                                    <tr key={`institution-${instMed.name}`} className={`border-b border-gray-700 hover:bg-gray-700/50 transition-colors ${statusLabel === 'Zerado' ? 'bg-red-900/20' : ''}`}>
                                      <td className="p-4 text-sm font-black text-gray-200 uppercase max-w-[200px]" title={instMed.name}>
                                        <div className="line-clamp-2">{instMed.name}</div>
                                      </td>
                                      <td className="p-4">
                                          <span className={`text-lg font-black ${current > 0 ? 'text-blue-400' : 'text-red-400'}`}>{current}</span>
                                      </td>
                                      <td className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{critical > 0 ? critical : '-'}</td>
                                      <td className="p-4">
                                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded border ${statusColor} inline-block whitespace-nowrap text-center`}>
                                             {statusLabel}
                                          </span>
                                      </td>
                                      <td className="p-4">
                                          <div className="flex flex-wrap gap-2">
                                            <button onClick={() => { setSelectedMedContext(ctx); setCriticalLevel(instMed.lastCritical || ''); setIsEntryModalOpen(true); }} className="px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-green-500/20 flex items-center gap-1"><TrendingUp size={12}/> Entrada</button>
                                            <button onClick={() => { setSelectedMedContext(ctx); setCriticalLevel(instMed.lastCritical || ''); setIsExitModalOpen(true); }} className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-red-500/20 flex items-center gap-1"><TrendingDown size={12}/> Saída</button>
                                            <button onClick={() => { setSelectedMedContext(ctx); setCriticalLevel(instMed.lastCritical || ''); setIsAdjustModalOpen(true); }} className="px-3 py-1.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-orange-500/20 flex items-center gap-1"><AlertCircle size={12}/> Ajuste</button>
                                            <button onClick={() => { setSelectedMedContext(ctx); setIsHistoryModalOpen(true); }} className="px-3 py-1.5 bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-gray-500/20 flex items-center gap-1"><FileText size={12}/> Histórico</button>
                                          </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                           </table>

                           {getInstitutionalMeds().length === 0 && (
                              <div className="p-8 text-center text-gray-400 border-t border-gray-700 bg-gray-900/20">
                                Nenhum medicamento lançado para a instituição
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>
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
                      <option>Transferência recebida</option>
                      <option>Retirada em Alto Custo</option>
                      <option>Devolução ao estoque</option>
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
                      <option>Fora de prescrição</option>
                      <option>Transferido para outro estoque</option>
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

       {/* Adjust Modal */}
       {isAdjustModalOpen && selectedMedContext && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-[30px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 border border-orange-100">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700">
                   <AlertCircle size={20} />
                 </div>
                 <div>
                   <h3 className="text-sm font-black uppercase text-orange-800 tracking-widest">Ajuste de Estoque</h3>
                   <p className="text-xs text-gray-500 font-bold mt-1 line-clamp-1">{selectedMedContext.name}</p>
                 </div>
               </div>

               <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Tipo de Ajuste</label>
                    <div className="flex gap-2">
                       <button onClick={() => setAdjustType('positivo')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${adjustType === 'positivo' ? 'bg-green-100 text-green-700 shadow-inner border border-green-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Positivo (+)</button>
                       <button onClick={() => setAdjustType('negativo')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${adjustType === 'negativo' ? 'bg-red-100 text-red-700 shadow-inner border border-red-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Negativo (-)</button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Qtd a Ajustar (Unidades)</label>
                    <input type="number" placeholder="Ex: 5" value={quantity} onChange={e=>setQuantity(e.target.value)} className={`w-full p-4 bg-gray-50 border rounded-xl text-lg font-black text-center outline-none focus:ring-2 ${adjustType === 'positivo' ? 'text-green-700 focus:ring-green-100' : 'text-red-700 focus:ring-red-100'}`} />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Observações (Obrigatório)</label>
                    <textarea value={observation} onChange={e=>setObservation(e.target.value)} className={`w-full p-4 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 ${adjustType === 'positivo' ? 'focus:ring-green-100' : 'focus:ring-red-100'}`} rows={3} placeholder="Motivo do ajuste..."></textarea>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                     <button onClick={() => setIsAdjustModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                     <button disabled={isLoading || !observation} onClick={() => { setReason('Ajuste Manual'); handleSaveMovement('ajuste'); }} className={`flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white rounded-xl transition-shadow shadow-md disabled:opacity-50 ${adjustType === 'positivo' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}>
                       {isLoading ? 'Salvando...' : 'Confirmar Ajuste'}
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
                                        (m.tipoMovimentacao === 'entrada' || (m.tipoMovimentacao as any) === 'ajuste_positivo' || (m.tipoMovimentacao === 'ajuste' && m.ajusteTipo === 'positivo')) ? 'bg-green-100 text-green-700' : 
                                        (m.tipoMovimentacao === 'saida' || (m.tipoMovimentacao as any) === 'ajuste_negativo' || (m.tipoMovimentacao === 'ajuste' && m.ajusteTipo === 'negativo')) ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {(m.tipoMovimentacao === 'entrada' || (m.tipoMovimentacao as any) === 'ajuste_positivo' || (m.tipoMovimentacao === 'ajuste' && m.ajusteTipo === 'positivo')) ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                        {m.tipoMovimentacao === 'ajuste' ? `Ajuste (${m.ajusteTipo})` : m.tipoMovimentacao.replace('_', ' ')}
                                      </span>
                                   </td>
                                   <td className={`p-4 font-black ${
                                     (m.tipoMovimentacao === 'entrada' || (m.tipoMovimentacao as any) === 'ajuste_positivo' || (m.tipoMovimentacao === 'ajuste' && m.ajusteTipo === 'positivo')) ? 'text-green-600' : 'text-red-600'
                                   }`}>
                                      {(m.tipoMovimentacao === 'entrada' || (m.tipoMovimentacao as any) === 'ajuste_positivo' || (m.tipoMovimentacao === 'ajuste' && m.ajusteTipo === 'positivo')) ? '+' : '-'}{m.quantidade}
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
