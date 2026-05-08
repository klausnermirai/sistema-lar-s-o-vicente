import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { addPdfSignatureNode } from '../lib/pdfUtils';
import { Pill, Package, Users, CheckCircle2 } from 'lucide-react';
import { Resident, MedicationSeparationLog, InstitutionSettings, ResidentMedicationStockMovement } from '../types';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';
import { saveMedicationStockMovement } from '../lib/api';

interface IndividualSeparationTabProps {
  residents: Resident[];
  session: any;
  settings?: InstitutionSettings | null;
}

export const IndividualSeparationTab: React.FC<IndividualSeparationTabProps> = ({ residents, session, settings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const allTimes = Array.from(new Set(residents.flatMap(r => r.medications?.flatMap(m => m.times) || []))).sort();
  const availableTimes = allTimes.length > 0 ? allTimes : ['Manhã', 'Tarde', 'Noite'];
  const [shift, setShift] = useState<string>(availableTimes[0] || 'Manhã');
  
  const [checkedMeds, setCheckedMeds] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<Record<string, MedicationSeparationLog>>({});

  const getShiftMeds = (resident: Resident) => {
    return (resident.medications || []).filter(m => {
      if (!m.times || m.times.length === 0) return true;
      return m.times.some(time => time.toLowerCase() === shift.toLowerCase());
    });
  };

  const handleSeparateResident = async (r: Resident) => {
    const medsToSeparate = getShiftMeds(r);
    const logId = `${r.id}-${date}-${shift}`;
    setLogs(prev => ({
      ...prev,
      [logId]: {
        id: logId,
        date,
        shift: shift as any,
        residentId: r.id,
        status: 'separado',
        separatedBy: session?.userName || 'Enfermeiro',
        separatedAt: new Date().toISOString(),
        medications: medsToSeparate.map(m => ({
          medicationId: m.id,
          medicationName: m.name,
          dose: m.dose,
          plannedTime: shift
        }))
      }
    }));

    // Generate automatic stock exit for each medication separated
    if (session?.institutionId) {
      for (const med of medsToSeparate) {
         try {
           const movement: any = {
             institutionId: session.institutionId,
             ownerType: 'resident',
             ownerId: r.id,
             residentId: r.id,
             prescriptionId: med.id,
             medicamentoPrescritoTexto: med.name,
             tipoMovimentacao: 'saida',
             motivo: 'Separação de Medicação',
             quantidade: 1, // default withdrawal for separation, you might want to adjust later based on dose
             dataHora: new Date().toISOString(),
             responsavelUserId: session?.userId || '',
             responsavelNome: session?.userName || 'Enfermeiro',
             origem: 'automatica',
             observacoes: `Separação automática para o turno: ${shift}`,
           };
           await saveMedicationStockMovement(movement);
         } catch (e) {
           console.error("Failed to save automatic stock movement for separation", e);
         }
      }
    }
  };

  const toggleCheck = (residentId: string, medId: string) => {
    const key = `${date}-${shift}-${residentId}-${medId}`;
    setCheckedMeds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    let y = 50;
    
    residents.forEach(r => {
       const shiftMeds = getShiftMeds(r);
       if (shiftMeds.length === 0) return;
       
       if (y > 270) {
         doc.addPage();
         y = 50;
       }

       doc.setFontSize(12);
       doc.setFont('helvetica', 'bold');
       doc.text(r.name, 14, y);
       y += 8;
       
       doc.setFontSize(9);
       doc.setFont('helvetica', 'normal');
       shiftMeds.forEach(m => {
           if (y > 280) {
             doc.addPage();
             y = 50;
           }
           doc.rect(14, y - 3, 4, 4);
           doc.text(`${m.name} - ${m.concentration} (${m.dose})`, 22, y);
           y += 6;
       });
       y += 6;
    });

    if (settings) {
       await addPdfHeaderAndFooter(doc, settings, `Ficha de Separação - ${shift} - ${date.split('-').reverse().join('/')}`);
    } else {
       doc.setFontSize(16);
       doc.text(`Ficha de Separação - ${shift} - ${date.split('-').reverse().join('/')}`, 14, 20);
    }
    
    addPdfSignatureNode(doc);
    doc.save(`separacao_${shift}_${date}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-full">
      <div className="bg-white rounded-[30px] p-6 flex justify-between items-center border shadow-sm shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-[#004c99]/10 rounded-2xl flex items-center justify-center text-[#004c99]">
                <Package size={24} />
             </div>
             <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-800">Separação de Medicamentos</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">Conferência por Turno e Horário</p>
             </div>
          </div>
          <button 
             onClick={() => setIsModalOpen(true)} 
             className="px-6 py-4 bg-[#004c99] text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[#003366] transition-all flex items-center gap-2 shadow-md shadow-[#004c99]/20"
          >
             <Package size={16} /> Visualizar separação em tela cheia
          </button>
       </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden animate-in fade-in">
          <div className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 shadow-sm relative z-20">
             <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-[#004c99]">Separação de Medicamentos</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Visão completa</p>
             </div>
             <div className="flex gap-3">
                <button onClick={handleExportPDF} className="px-5 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm">
                   Exportar PDF
                </button>
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">
                   Fechar
                </button>
             </div>
          </div>

          <div className="flex-1 overflow-auto p-6 md:p-8">
            <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col">
              <div className="flex gap-4 items-center justify-between mb-6 shrink-0 bg-white p-6 rounded-[30px] border shadow-sm">
                <div className="flex gap-6 items-center">
                  <div className="flex gap-4 items-center">
                    <label className="text-[10px] font-black uppercase text-gray-400">Data:</label>
                    <input 
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="border p-3 rounded-2xl text-xs font-bold bg-white"
                    />
                  </div>
                  
                  <div className="flex gap-4 items-center">
                    <label className="text-[10px] font-black uppercase text-gray-400">Horário:</label>
                    <select
                       value={shift}
                       onChange={e => setShift(e.target.value)}
                       className="border p-3 rounded-2xl text-xs font-bold bg-white uppercase"
                    >
                      {availableTimes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-6 flex-1 overflow-visible pb-10">
                {residents.filter(r => getShiftMeds(r).length > 0).length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-200">
                    <Package className="text-gray-200 mx-auto mb-4" size={48} />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhuma medicação para este horário</p>
                  </div>
                ) : (
                  residents.map(r => {
                     const shiftMeds = getShiftMeds(r);
                     if (shiftMeds.length === 0) return null;
                     
                     const logId = `${r.id}-${date}-${shift}`;
                     const isSeparated = logs[logId]?.status === 'separado';
                     
                     return (
                       <div key={r.id} className={`bg-white border rounded-[32px] p-6 shadow-sm overflow-hidden relative transition-colors ${isSeparated ? 'border-green-200 bg-green-50/20' : ''}`}>
                         {isSeparated && (
                           <div className="absolute top-0 right-0 bg-green-100 text-green-700 px-4 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
                             <CheckCircle2 size={10} /> Separado
                           </div>
                         )}
                         <div className="flex items-center gap-4 mb-6">
                           <div className="w-12 h-12 bg-[#004c99]/10 rounded-full flex items-center justify-center">
                             <Users size={20} className="text-[#004c99]" />
                           </div>
                           <div>
                             <h3 className="font-black text-gray-800 uppercase text-lg">{r.name}</h3>
                             <p className="text-[10px] text-gray-500 uppercase">{shiftMeds.length} medicamentos previstos</p>
                           </div>
                         </div>

                         <div className="space-y-3 mb-6">
                           {shiftMeds.map(m => {
                             const checkKey = `${date}-${shift}-${r.id}-${m.id}`;
                             const isChecked = checkedMeds[checkKey];
                             return (
                               <label key={m.id} className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/50 border-blue-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'}`}>
                                 <input 
                                   type="checkbox" 
                                   checked={isChecked || false} 
                                   onChange={() => toggleCheck(r.id, m.id)} 
                                   className="w-6 h-6 text-[#004c99] rounded-lg border-gray-300 focus:ring-[#004c99]"
                                 />
                                 <div className="flex-1">
                                   <p className="font-bold text-gray-800 uppercase text-sm">{m.name}</p>
                                   <p className="text-xs text-gray-500 mt-1">{m.concentration} - <span className="font-bold text-[#004c99]">{m.dose}</span></p>
                                 </div>
                               </label>
                             );
                           })}
                         </div>

                         {!isSeparated && (
                           <button 
                             onClick={() => handleSeparateResident(r)}
                             className="w-full py-4 bg-[#004c99] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                           >
                             <Package size={16} /> Concluir Separação (Residente)
                           </button>
                         )}
                       </div>
                     );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
