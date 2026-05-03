import React, { useState, useEffect } from 'react';
import { Search, Users, Activity, CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { Resident, Medication, MedicationAdministrationLog, OperationalShift } from '../types';
import { fetchShifts, fetchMedicationAdministrationLogs, saveMedicationAdministrationLog } from '../lib/api';

export const IndividualAdministrationTab: React.FC<{ residents: Resident[], session: any }> = ({ residents, session }) => {
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shifts, setShifts] = useState<OperationalShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [logs, setLogs] = useState<MedicationAdministrationLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [allLogs, setAllLogs] = useState<MedicationAdministrationLog[]>([]);
  const [selectedMedToAdminister, setSelectedMedToAdminister] = useState<{ med: Medication, time: string } | null>(null);

  // Admin form
  const [status, setStatus] = useState<MedicationAdministrationLog['statusAdministracao']>('administrado');
  const [observation, setObservation] = useState('');

  // Fetch shifts
  useEffect(() => {
    if (session?.institutionId) {
      fetchShifts(session.institutionId).then(data => {
        setShifts(data || []);
        if (data && data.length > 0) {
          setSelectedShiftId(data[0].id);
        }
      }).catch(console.error);
    }
  }, [session?.institutionId]);

  // Fetch logs for the specific date
  useEffect(() => {
    if (selectedResidentId && session?.institutionId && date) {
       fetchMedicationAdministrationLogs(session.institutionId, selectedResidentId, date)
         .then(setLogs)
         .catch(console.error);
    } else {
       setLogs([]);
    }
  }, [selectedResidentId, session?.institutionId, date]);

  // Fetch all logs when history modal opens
  useEffect(() => {
    if (isHistoryModalOpen && selectedResidentId && session?.institutionId) {
       fetchMedicationAdministrationLogs(session.institutionId, selectedResidentId)
         .then(setAllLogs)
         .catch(console.error);
    }
  }, [isHistoryModalOpen, selectedResidentId, session?.institutionId]);

  const selectedResident = residents.find(r => r.id === selectedResidentId);
  const filteredResidents = residents.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAdminister = async () => {
     if (!selectedResidentId || !selectedMedToAdminister || !selectedShiftId) return;
     setIsLoading(true);
     
     const shiftObj = shifts.find(s => s.id === selectedShiftId);

     const newLog: any = {
       institutionId: session?.institutionId,
       residentId: selectedResidentId,
       prescriptionId: selectedMedToAdminister.med.id,
       medicamentoPrescritoTexto: selectedMedToAdminister.med.name,
       horarioPrevisto: selectedMedToAdminister.time,
       dataOperacional: date,
       turnoId: shiftObj?.id,
       turnoNome: shiftObj?.nomeTurno || 'Manual',
       statusAdministracao: status,
       dataHoraRegistro: new Date().toISOString(),
       responsavelUserId: session?.userId || '',
       responsavelNome: session?.userName || 'Usuário Atual',
       observacoes: observation
     };

     try {
       const saved = await saveMedicationAdministrationLog(newLog);
       setLogs(prev => [...prev.filter(l => !(l.prescriptionId === newLog.prescriptionId && l.horarioPrevisto === newLog.horarioPrevisto)), { ...newLog, id: saved.id || Math.random().toString() }]);
       setIsSignModalOpen(false);
       setObservation('');
       setStatus('administrado');
     } catch (err) {
       alert("Erro ao registrar administração");
     } finally {
       setIsLoading(false);
     }
  };

  const getLogForMedTime = (medId: string, time: string) => {
    // Lacks handling of multiple logs for the same med/time on same day (assume last one wins generally)
    const matched = logs.filter(l => l.prescriptionId === medId && l.horarioPrevisto === time);
    if (matched.length > 0) {
       return matched.sort((a,b) => new Date(b.dataHoraRegistro).getTime() - new Date(a.dataHoraRegistro).getTime())[0];
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto h-full relative">
       <div className="bg-white rounded-[40px] shadow-sm border p-6 flex flex-col relative z-20">
         <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99] mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} />
            Ministração no Prontuário
         </h3>
         
         <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            <div className="md:col-span-6 relative">
              <input
                type="text"
                placeholder={selectedResident ? `Selecionado: ${selectedResident.name} (Clique para alterar)` : "Buscar residente por nome..."}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold uppercase text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:normal-case"
              />
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="md:col-span-3">
              <input 
                 type="date" 
                 value={date} 
                 onChange={e=>setDate(e.target.value)} 
                 className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 text-sm"
              />
            </div>

            <div className="md:col-span-3">
              <select 
                 className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 text-sm"
                 value={selectedShiftId} 
                 onChange={e=>setSelectedShiftId(e.target.value)}
              >
                 {shifts.map(s => (
                   <option key={s.id} value={s.id}>{s.nomeTurno} - {s.horarioInicio} às {s.horarioFim}</option>
                 ))}
                 {shifts.length === 0 && <option value="">Sem Turnos Configurados</option>}
              </select>
            </div>
         </div>

         {searchTerm && (
           <div className="absolute top-24 left-6 right-6 bg-white rounded-2xl shadow-xl border overflow-hidden max-h-60 overflow-y-auto">
             {filteredResidents.map(r => (
               <button
                 key={r.id}
                 onClick={() => {
                   setSelectedResidentId(r.id);
                   setSearchTerm('');
                 }}
                 className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 text-sm font-bold text-gray-700 uppercase"
               >
                 {r.name}
               </button>
             ))}
           </div>
         )}
       </div>

       {selectedResident && (
          <div className="bg-white rounded-[40px] shadow-sm border p-6 flex-1 overflow-auto flex flex-col pt-8">
             <div className="flex items-center justify-between mb-8 pb-4 border-b">
               <div>
                 <h4 className="text-xl font-black uppercase tracking-tight text-gray-800">{selectedResident.name}</h4>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                    Prontuário de Ministração - {date.split('-').reverse().join('/')}
                 </p>
               </div>
               <button 
                 onClick={() => setIsHistoryModalOpen(true)}
                 className="px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 font-black tracking-widest uppercase text-[10px] hover:bg-gray-100 transition-colors"
               >
                 Ver Histórico de Ministrações
               </button>
             </div>

             {(selectedResident.medications || []).length === 0 ? (
               <div className="p-8 text-center bg-gray-50 rounded-3xl border border-dashed">
                 <AlertCircle size={32} className="mx-auto text-gray-400 mb-3" />
                 <p className="text-sm font-bold text-gray-600 uppercase">Nenhuma prescrição ativa</p>
                 <p className="text-xs text-gray-500 mt-1">A ministração depende de um medicamento prescrito ativo.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {/* Here we expand all times into individual actionable items */}
                 {selectedResident.medications?.flatMap(med => 
                    (med.times || []).map(time => {
                      const log = getLogForMedTime(med.id, time);
                      const isHandled = !!log;
                      
                      return (
                       <div key={`${med.id}-${time}`} className={`rounded-2xl border p-5 flex flex-col relative transition-all ${isHandled ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-100 shadow-sm shadow-blue-50/50'}`}>
                          {/* Status Badge */}
                          {isHandled ? (
                            <div className={`absolute -top-3 -right-3 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 border
                              ${log.statusAdministracao === 'administrado' ? 'bg-green-100 text-green-700 border-green-200' : 
                                log.statusAdministracao === 'recusado' ? 'bg-red-100 text-red-700 border-red-200' :
                                'bg-orange-100 text-orange-700 border-orange-200'}
                            `}>
                              {log.statusAdministracao}
                            </div>
                          ) : (
                            <div className="absolute -top-3 -right-3 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 shadow-sm flex items-center gap-1">
                              Pendente
                            </div>
                          )}

                          <div className="mb-4 pr-16 pt-2">
                            <h5 className="text-sm font-black uppercase text-gray-800 line-clamp-2 leading-tight" title={med.name}>{med.name}</h5>
                            <div className="flex items-center gap-2 mt-2">
                               <Clock size={12} className="text-gray-400" />
                               <span className="text-xs font-bold text-[#004c99]">{time}</span>
                            </div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-1">
                              {med.concentration} {med.concentration && '•'} {med.dose || `Via: ${med.route || 'Não informada'}`}
                            </p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-gray-100/50">
                             {isHandled ? (
                               <div className="text-[10px] text-gray-500 leading-relaxed bg-white border border-gray-100 p-3 rounded-xl">
                                  <p className="font-bold text-gray-700 uppercase mb-1">Registrado por: {log?.responsavelNome}</p>
                                  <p>{new Date(log?.dataHoraRegistro || '').toLocaleTimeString('pt-BR')} • {log?.turnoNome}</p>
                                  {log?.observacoes && <p className="mt-2 text-gray-400 italic bg-gray-50 p-2 rounded text-xs border border-dashed">Obs: {log.observacoes}</p>}
                               </div>
                             ) : (
                               <button 
                                 onClick={() => { setSelectedMedToAdminister({ med, time }); setIsSignModalOpen(true); }}
                                 className="w-full py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                               >
                                 <CheckCircle2 size={14} /> Registrar Ação
                               </button>
                             )}
                          </div>
                       </div>
                      )
                    })
                 )}
               </div>
             )}
          </div>
       )}

       {/* Sign/Action Modal */}
       {isSignModalOpen && selectedMedToAdminister && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
             <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#004c99]">
                     <Activity size={20} />
                   </div>
                   <div>
                     <h3 className="text-sm font-black uppercase text-gray-800">Registrar Ministração</h3>
                     <p className="text-xs text-[#004c99] font-bold mt-0.5">{selectedMedToAdminister.time} • {selectedMedToAdminister.med.name}</p>
                   </div>
                </div>

                <div className="space-y-5">
                   <div>
                     <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Ação Realizada</label>
                     <select 
                       value={status} 
                       onChange={e=>setStatus(e.target.value as any)} 
                       className="w-full p-4 bg-gray-50 border text-sm font-bold uppercase text-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                     >
                       <option value="administrado">Administrado com sucesso</option>
                       <option value="recusado">Recusado pelo residente</option>
                       <option value="nao_administrado">Não administrado</option>
                       <option value="suspenso">Suspenso preventivamente</option>
                       <option value="em_falta">Medicamento em falta</option>
                       <option value="outro">Outro (Justificar)</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Observações Relevantes / Justificativa</label>
                     <textarea 
                       value={observation} 
                       onChange={e=>setObservation(e.target.value)} 
                       className="w-full p-4 bg-gray-50 border rounded-xl text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-blue-100" 
                       placeholder={(status !== 'administrado') ? 'A justificativa é obrigatória para este status...' : 'Observações opcionais...'}
                     ></textarea>
                   </div>

                   <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
                     <AlertCircle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
                     <p className="text-[10px] text-yellow-800 font-bold uppercase">
                       Atenção: Este registro será atrelado permanentemente ao prontuário do residente sob o seu nome.
                     </p>
                   </div>

                   <div className="flex gap-3 pt-2">
                      <button onClick={() => setIsSignModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                      <button disabled={isLoading || (status !== 'administrado' && !observation)} onClick={handleAdminister} className="flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white bg-[#004c99] rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                        {isLoading ? 'Salvando...' : 'Confirmar e Assinar'}
                      </button>
                   </div>
                </div>
             </div>
          </div>
       )}

       {/* History Modal */}
       {isHistoryModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
             <div className="bg-white rounded-[30px] p-8 w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase text-[#004c99]">Histórico Completo de Ministração</h3>
                    <p className="text-xs text-gray-600 font-bold mt-1">Prontuário de {selectedResident?.name}</p>
                  </div>
                  <button onClick={() => setIsHistoryModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-black text-gray-500 uppercase hover:bg-gray-200">Fechar</button>
                </div>

                <div className="flex-1 overflow-auto border rounded-2xl">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest sticky top-0">
                         <tr>
                           <th className="p-3 border-b">Data / Operação</th>
                           <th className="p-3 border-b">Medicamento</th>
                           <th className="p-3 border-b">Horário</th>
                           <th className="p-3 border-b">Status</th>
                           <th className="p-3 border-b">Responsável / Obs</th>
                         </tr>
                      </thead>
                      <tbody className="text-xs">
                         {allLogs.length === 0 ? (
                           <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum registro encontrado</td></tr>
                         ) : (
                             allLogs
                              .sort((a,b) => new Date(b.dataHoraRegistro).getTime() - new Date(a.dataHoraRegistro).getTime())
                              .map((m, i) => (
                               <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                                 <td className="p-3 whitespace-nowrap">
                                   <div className="font-bold text-gray-700">{m.dataOperacional.split('-').reverse().join('/')}</div>
                                   <div className="text-[10px] text-gray-400">{new Date(m.dataHoraRegistro).toLocaleString('pt-BR')}</div>
                                 </td>
                                 <td className="p-3 font-black text-gray-700">{m.medicamentoPrescritoTexto}</td>
                                 <td className="p-3">
                                   <span className="text-xs font-bold text-[#004c99] bg-blue-50 px-2 py-1 rounded">{m.horarioPrevisto}</span>
                                 </td>
                                 <td className="p-3">
                                   <span className={`px-2 py-1 flex w-max items-center justify-center rounded-md text-[10px] font-black uppercase tracking-widest 
                                      ${m.statusAdministracao === 'administrado' ? 'bg-green-100 text-green-800' : 
                                        m.statusAdministracao === 'recusado' ? 'bg-red-100 text-red-800' : 
                                        'bg-orange-100 text-orange-800'}`}>
                                      {m.statusAdministracao}
                                   </span>
                                 </td>
                                 <td className="p-3 text-gray-600">
                                   <div className="font-bold text-[10px] uppercase text-gray-500">{m.responsavelNome}</div>
                                   {m.observacoes && <div className="text-[10px] mt-1 bg-gray-100 p-1 rounded italic text-gray-500">Obs: {m.observacoes}</div>}
                                 </td>
                               </tr>
                             ))
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};
