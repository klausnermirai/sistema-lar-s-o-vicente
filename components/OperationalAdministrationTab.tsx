import React, { useState, useEffect } from 'react';
import { Pill, CheckCircle2, AlertCircle, Clock, Users, X, Syringe } from 'lucide-react';
import { Resident, Medication, MedicationAdministrationLog, OperationalShift, SosProtocol } from '../types';
import { fetchShifts, fetchMedicationAdministrationLogs, saveMedicationAdministrationLog, fetchSosProtocols } from '../lib/api';

export const OperationalAdministrationTab: React.FC<{ residents: Resident[], session: any }> = ({ residents, session }) => {
  const [activeTab, setActiveTab] = useState<'fixa' | 'sos'>('fixa');

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shifts, setShifts] = useState<OperationalShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  
  const allTimes = Array.from(new Set(residents.flatMap(r => r.medications?.flatMap(m => m.times) || []))).sort();
  const availableTimes = allTimes.length > 0 ? allTimes : ['Manhã', 'Tarde', 'Noite'];
  const [shift, setShift] = useState<string>(availableTimes[0] || 'Manhã'); // Time of medication (not shift id)

  const [logs, setLogs] = useState<MedicationAdministrationLog[]>([]);
  const [sosProtocols, setSosProtocols] = useState<SosProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Action sheet for signing
  const [activeAction, setActiveAction] = useState<{resident: Resident, med: Medication, time: string} | null>(null);
  const [activeSosAction, setActiveSosAction] = useState<{resident: Resident, protocol?: SosProtocol | null} | null>(null);

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
      
      fetchSosProtocols(session.institutionId).then(data => {
        setSosProtocols(data || []);
      }).catch(console.error);
    }
  }, [session?.institutionId]);

  // Fetch logs for the specific date
  useEffect(() => {
    if (session?.institutionId && date) {
       const fetchLogs = async () => {
         let allFetchedLogs: MedicationAdministrationLog[] = [];
         
         // Fetch for all residents if in SOS to show history or just fetch for all.
         const activeResidents = activeTab === 'sos' ? residents : residents.filter(r => 
           (r.medications || []).some(m => !m.times || m.times.length === 0 || m.times.some(t => t.toLowerCase() === shift.toLowerCase()))
         );
         
         for (const r of activeResidents) {
            try {
              const resLogs = await fetchMedicationAdministrationLogs(session.institutionId, r.id, date);
              allFetchedLogs = [...allFetchedLogs, ...resLogs];
            } catch (err) {
              console.error(err);
            }
         }
         
         // If activeTab is sos, we might need logs from previous days to check intervals. Let's fetch the last 3 days for the residents we care about?
         // Actually, for interval checking we need to look at history. We'll do that at the SOS modal level or trust the logs fetched.
         // Let's just set the logs we fetched.
         setLogs(allFetchedLogs);
       };
       fetchLogs();
    } else {
       setLogs([]);
    }
  }, [session?.institutionId, date, shift, residents, activeTab]);

  const handleAdminister = async () => {
    if (!activeAction || !selectedShiftId) return;
    setIsLoading(true);
    
    const shiftObj = shifts.find(s => s.id === selectedShiftId);

    const newLog: any = {
      institutionId: session?.institutionId,
      residentId: activeAction.resident.id,
      prescriptionId: activeAction.med.id,
      medicamentoPrescritoTexto: activeAction.med.name,
      horarioPrevisto: activeAction.time,
      dataOperacional: date,
      turnoId: shiftObj?.id,
      turnoNome: shiftObj?.nomeTurno || 'Manual',
      statusAdministracao: status,
      dataHoraRegistro: new Date().toISOString(),
      responsavelUserId: session?.userId || '',
      responsavelNome: session?.userName || 'Usuário Atual',
      observacoes: observation,
      tipoMinistracao: 'fixa'
    };

    try {
      const saved = await saveMedicationAdministrationLog(newLog);
      setLogs(prev => [...prev.filter(l => !(l.prescriptionId === newLog.prescriptionId && l.horarioPrevisto === newLog.horarioPrevisto && l.residentId === activeAction.resident.id)), { ...newLog, id: saved.id || Math.random().toString() }]);
      setActiveAction(null);
      setObservation('');
      setStatus('administrado');
    } catch (err) {
      alert("Erro ao registrar administração");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdministerSos = async () => {
    if (!activeSosAction || !selectedShiftId) return;
    setIsLoading(true);
    
    const shiftObj = shifts.find(s => s.id === selectedShiftId);
    
    // If protocol is null, it's an intercurrence without medication.
    const medName = activeSosAction.protocol ? activeSosAction.protocol.medicamentoAutorizado : 'Sem medicação / Apenas Observação';

    const newLog: any = {
      institutionId: session?.institutionId,
      residentId: activeSosAction.resident.id,
      condutaSosId: activeSosAction.protocol ? activeSosAction.protocol.id : null,
      sintomaOuQueixa: activeSosAction.protocol ? activeSosAction.protocol.sintomaOuQueixa : 'Outro / Não cadastrado',
      medicamentoPrescritoTexto: medName,
      dosagem: activeSosAction.protocol?.dosagem,
      quantidade: activeSosAction.protocol?.quantidade,
      formaFarmaceutica: activeSosAction.protocol?.formaFarmaceutica,
      via: activeSosAction.protocol?.via,
      origemEstoque: activeSosAction.protocol?.estoquePreferencial || 'sem_baixa_automatica',
      autorizadoPorNome: activeSosAction.protocol?.autorizadoPorNome,
      autorizadoPorFuncao: activeSosAction.protocol?.autorizadoPorFuncao,
      autorizadoPorRegistro: activeSosAction.protocol?.autorizadoPorRegistro,
      horarioPrevisto: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      dataOperacional: date,
      turnoId: shiftObj?.id,
      turnoNome: shiftObj?.nomeTurno || 'Manual',
      statusAdministracao: activeSosAction.protocol ? status : 'outro', // If no protocol, we just register 'outro' or 'observacao' 
      dataHoraRegistro: new Date().toISOString(),
      responsavelUserId: session?.userId || '',
      responsavelNome: session?.userName || 'Usuário Atual',
      observacoes: observation,
      tipoMinistracao: 'eventual_sos'
    };

    try {
      const saved = await saveMedicationAdministrationLog(newLog);
      setLogs(prev => [...prev, { ...newLog, id: saved.id || Math.random().toString() }]);
      setActiveSosAction(null);
      setObservation('');
      setStatus('administrado');
    } catch (err) {
      alert("Erro ao registrar administração SOS");
    } finally {
      setIsLoading(false);
    }
  };

  const getLogForMedTime = (residentId: string, medId: string, time: string) => {
    const matched = logs.filter(l => l.residentId === residentId && l.prescriptionId === medId && l.horarioPrevisto === time && l.tipoMinistracao !== 'eventual_sos');
    if (matched.length > 0) {
       return matched.sort((a,b) => new Date(b.dataHoraRegistro).getTime() - new Date(a.dataHoraRegistro).getTime())[0];
    }
    return null;
  };

  const getShiftMeds = (resident: Resident) => {
    return (resident.medications || []).filter(m => {
      if (!m.times || m.times.length === 0) return true;
      return m.times.some(time => time.toLowerCase() === shift.toLowerCase());
    });
  };

  const residentsWithMeds = residents.filter(r => getShiftMeds(r).length > 0);
  const residentsWithSosProtocols = residents.filter(r => sosProtocols.some(p => p.residentId === r.id && p.status === 'ativo'));

  // Sos Interval Helper
  const checkIntervalWarning = (protocol: SosProtocol) => {
     if (!protocol.intervaloMinimoHoras) return null;
     
     // Find last log for this protocol
     const sosLogs = logs.filter(l => l.condutaSosId === protocol.id);
     if (sosLogs.length === 0) return null;
     
     const lastLog = sosLogs.sort((a,b) => new Date(b.dataHoraRegistro).getTime() - new Date(a.dataHoraRegistro).getTime())[0];
     
     const diffMs = new Date().getTime() - new Date(lastLog.dataHoraRegistro).getTime();
     const diffHours = diffMs / (1000 * 60 * 60);
     
     if (diffHours < protocol.intervaloMinimoHoras) {
        return `Atenção: A última administração foi há ${Math.floor(diffHours)}h. O intervalo mínimo é de ${protocol.intervaloMinimoHoras}h.`;
     }
     return null;
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full relative pb-20">
      
      <div className="flex bg-white rounded-3xl p-1 mb-6 border shadow-sm shrink-0">
         <button onClick={() => setActiveTab('fixa')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${activeTab === 'fixa' ? 'bg-[#004c99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Medicação Fixa</button>
         <button onClick={() => setActiveTab('sos')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${activeTab === 'sos' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Medicação Eventual / SOS</button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border p-6 flex flex-col md:flex-row gap-6 items-center shrink-0 mb-6">
          <div className="md:w-1/3 w-full">
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Turno Operacional</label>
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

          <div className="md:w-1/3 w-full">
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Data Operacional</label>
            <input 
               type="date" 
               value={date} 
               onChange={e=>setDate(e.target.value)} 
               className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 text-sm"
            />
          </div>

          {activeTab === 'fixa' && (
            <div className="md:w-1/3 w-full">
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Horário da Prescrição</label>
              <select
                 value={shift}
                 onChange={e => setShift(e.target.value)}
                 className="w-full p-4 bg-purple-50 border border-purple-100 rounded-2xl outline-none font-black text-purple-700 uppercase tracking-widest text-sm"
              >
                {availableTimes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
      </div>

      <div className="flex-1 overflow-auto space-y-6">
         {activeTab === 'fixa' && (
           residentsWithMeds.length === 0 ? (
             <div className="py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-200">
               <Pill className="text-gray-200 mx-auto mb-4" size={48} />
               <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhuma medicação fixa para as {shift}</p>
             </div>
           ) : (
             residentsWithMeds.map(r => {
               const meds = getShiftMeds(r);
               return (
                 <div key={r.id} className="bg-white rounded-[32px] shadow-sm border p-6 flex flex-col md:flex-row gap-6">
                    <div className="md:w-64 shrink-0 flex items-center md:items-start md:flex-col gap-4 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-6">
                      <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 font-black shadow-inner overflow-hidden border border-purple-100/50">
                        {r.photo ? <img src={r.photo} className="w-full h-full object-cover"/> : <Users size={24}/>}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg leading-none">{r.name}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Quarto {r.room || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                       {meds.map(m => {
                          const log = getLogForMedTime(r.id, m.id, shift);
                          const isHandled = !!log;
                          
                          return (
                            <div key={m.id} className={`p-4 rounded-2xl border transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${isHandled ? 'bg-gray-50 border-gray-200' : 'bg-white border-purple-100'}`}>
                               <div className="flex-1">
                                 <h5 className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
                                   <Pill size={14} className={isHandled ? 'text-gray-400' : 'text-purple-500'}/> {m.name}
                                 </h5>
                                 <p className="text-xs uppercase font-bold text-gray-400 mt-1">
                                   {m.concentration && `${m.concentration} • `}{m.dose || `Via: ${m.route || 'Não informada'}`}
                                 </p>
                               </div>

                               {isHandled ? (
                                  <div className="flex flex-col items-end gap-1 min-w-[200px]">
                                    <span className={`px-3 py-1.5 flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest 
                                        ${log.statusAdministracao === 'administrado' ? 'bg-green-100 text-green-800' : 
                                          log.statusAdministracao === 'recusado' ? 'bg-red-100 text-red-800' : 
                                          log.statusAdministracao === 'nao_administrado' ? 'bg-orange-100 text-orange-800' :
                                          'bg-gray-200 text-gray-800'}`}>
                                        {log.statusAdministracao.replace('_', ' ')}
                                    </span>
                                    <span className="text-[9px] text-gray-400 font-bold uppercase">Resp: {log.responsavelNome}</span>
                                  </div>
                               ) : (
                                  <button 
                                    onClick={() => setActiveAction({resident: r, med: m, time: shift})}
                                    className="w-full sm:w-auto px-6 py-3 bg-white border border-purple-200 text-purple-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                                  >
                                    Checar
                                  </button>
                               )}
                            </div>
                          )
                       })}
                    </div>
                 </div>
               )
             })
           )
         )}

         {activeTab === 'sos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {residents.map(r => {
                 const protocols = sosProtocols.filter(p => p.residentId === r.id && p.status === 'ativo');
                 
                 return (
                   <div key={r.id} className="bg-white rounded-[32px] shadow-sm border p-6 flex flex-col">
                      <div className="flex items-center gap-4 border-b border-gray-100 pb-4 mb-4">
                        <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 font-black shadow-inner overflow-hidden border border-purple-100/50">
                          {r.photo ? <img src={r.photo} className="w-full h-full object-cover"/> : <Users size={20}/>}
                        </div>
                        <div>
                          <h3 className="font-black text-gray-900 uppercase tracking-tight text-sm leading-none">{r.name}</h3>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Quarto {r.room || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3">
                         {protocols.length === 0 ? (
                           <div className="text-center py-6">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sem condutas SOS cadastradas</p>
                              <button onClick={() => setActiveSosAction({resident: r, protocol: null})} className="mt-4 px-4 py-2 bg-gray-50 border rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors w-full">
                                Apenas Registrar Intercorrência
                              </button>
                           </div>
                         ) : (
                           protocols.map(p => (
                             <button
                               key={p.id}
                               onClick={() => setActiveSosAction({resident: r, protocol: p})}
                               className="w-full p-4 bg-white border border-purple-100 rounded-2xl hover:bg-purple-50 hover:border-purple-200 transition-all text-left flex flex-col gap-2 group"
                             >
                                <span className="text-xs font-black text-gray-800 uppercase group-hover:text-purple-700">{p.sintomaOuQueixa}</span>
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-[9px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded uppercase font-bold">{p.medicamentoAutorizado}</span>
                                  {p.dosagem && <span className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase font-bold">{p.dosagem}</span>}
                                </div>
                             </button>
                           ))
                         )}
                         {protocols.length > 0 && (
                            <button onClick={() => setActiveSosAction({resident: r, protocol: null})} className="mt-2 px-4 py-2 bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors w-full">
                              Intercorrência s/ Medicação SOS
                            </button>
                         )}
                      </div>
                   </div>
                 )
              })}
            </div>
         )}
      </div>

      {/* Action Sheet Modal for Fixa */}
      {activeAction && activeTab === 'fixa' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-end md:justify-center p-4">
           {/* Modal Body for Fixa - same as before */}
           <div className="bg-white rounded-t-[40px] md:rounded-[40px] p-8 w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-8 md:zoom-in-95">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-inner">
                     <CheckCircle2 size={24} />
                   </div>
                   <div>
                     <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest leading-none">Registrar Ministração Fixa</h3>
                     <h4 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none mt-2">{activeAction.resident.name}</h4>
                   </div>
                </div>
                <button onClick={() => setActiveAction(null)} className="p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl mb-6 flex flex-col gap-1">
                 <p className="text-sm font-black text-gray-800 uppercase">{activeAction.med.name}</p>
                 <p className="text-xs text-gray-500 font-bold uppercase">{activeAction.med.concentration && `${activeAction.med.concentration} • `}{activeAction.med.dose || `Via: ${activeAction.med.route || 'Não informada'}`}</p>
                 <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mt-2 flex items-center gap-1">
                   <Clock size={12}/> Horário Previsto: {activeAction.time}
                 </p>
              </div>

              <div className="space-y-6">
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">Status da Administração</label>
                   
                   <div className="grid grid-cols-2 gap-3">
                     {[
                       { v: 'administrado', l: 'Administrado', bg: 'bg-green-50 focus:ring-green-500 border-green-200 text-green-800' },
                       { v: 'recusado', l: 'Recusou', bg: 'bg-red-50 focus:ring-red-500 border-red-200 text-red-800' },
                       { v: 'nao_administrado', l: 'Não Administrado', bg: 'bg-orange-50 focus:ring-orange-500 border-orange-200 text-orange-800' },
                       { v: 'em_falta', l: 'Em Falta', bg: 'bg-gray-50 focus:ring-gray-500 border-gray-300 text-gray-800' },
                       { v: 'suspenso', l: 'Suspenso', bg: 'bg-blue-50 focus:ring-blue-500 border-blue-200 text-blue-800' },
                     ].map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setStatus(opt.v as any)}
                          className={`p-4 border rounded-2xl text-xs font-black uppercase tracking-widest transition-all
                            ${status === opt.v ? opt.bg : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                          {opt.l}
                        </button>
                     ))}
                   </div>
                 </div>
                 
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Observações Relevantes / Justificativa</label>
                   <textarea 
                     value={observation} 
                     onChange={e=>setObservation(e.target.value)} 
                     className="w-full p-4 bg-gray-50 border rounded-xl text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-purple-100" 
                     placeholder={(status !== 'administrado') ? 'A justificativa é obrigatória para este status...' : 'Observações opcionais...'}
                   ></textarea>
                 </div>

                 <button disabled={isLoading || (status !== 'administrado' && !observation)} onClick={handleAdminister} className="w-full py-5 text-xs font-black uppercase tracking-widest text-white bg-[#004c99] rounded-2xl hover:bg-blue-800 transition-colors shadow-xl shadow-[#004c99]/20 disabled:opacity-50 flex items-center justify-center gap-2">
                   {isLoading ? 'Salvando...' : 'Confirmar Registro no Prontuário'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Action Sheet Modal for SOS */}
      {activeSosAction && activeTab === 'sos' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-end md:justify-center p-4">
           <div className="bg-white rounded-t-[40px] md:rounded-[40px] p-8 w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-8 md:zoom-in-[95%]">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-inner">
                     <Syringe size={24} />
                   </div>
                   <div>
                     <h3 className="text-sm font-black uppercase text-purple-600 tracking-widest leading-none">Medicação Eventual / SOS</h3>
                     <h4 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none mt-2">{activeSosAction.resident.name}</h4>
                   </div>
                </div>
                <button onClick={() => setActiveSosAction(null)} className="p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              {activeSosAction.protocol ? (
                <>
                  {checkIntervalWarning(activeSosAction.protocol) && (
                    <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-2xl mb-6 flex items-start gap-3">
                       <AlertCircle size={20} className="shrink-0 mt-0.5" />
                       <p className="text-xs font-black font-mono">{checkIntervalWarning(activeSosAction.protocol)}</p>
                    </div>
                  )}
                  <div className="bg-purple-50 border border-purple-100 p-5 rounded-[24px] mb-6 flex flex-col gap-2">
                     <div className="flex justify-between items-start border-b border-purple-100 pb-3 mb-1">
                       <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Sintoma / Queixa</p>
                       <p className="text-sm font-black text-purple-900 uppercase">{activeSosAction.protocol.sintomaOuQueixa}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Administrar</p>
                       <p className="text-base font-black text-gray-900 uppercase">{activeSosAction.protocol.medicamentoAutorizado} <span className="text-gray-500 font-bold ml-1">{activeSosAction.protocol.dosagem} {activeSosAction.protocol.quantidade}</span></p>
                       <p className="text-xs text-gray-600 font-bold uppercase mt-1">Via {activeSosAction.protocol.via}</p>
                     </div>
                  </div>
                  
                  <div className="space-y-6">
                     <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">Status da Administração</label>
                       
                       <div className="grid grid-cols-2 gap-3">
                         {[
                           { v: 'administrado', l: 'Administrado', bg: 'bg-green-50 focus:ring-green-500 border-green-200 text-green-800' },
                           { v: 'recusado', l: 'Recusou', bg: 'bg-red-50 focus:ring-red-500 border-red-200 text-red-800' },
                           { v: 'nao_administrado', l: 'Não Administrado', bg: 'bg-orange-50 focus:ring-orange-500 border-orange-200 text-orange-800' },
                           { v: 'em_falta', l: 'Em Falta', bg: 'bg-gray-50 focus:ring-gray-500 border-gray-300 text-gray-800' }
                         ].map(opt => (
                            <button
                              key={opt.v}
                              onClick={() => setStatus(opt.v as any)}
                              className={`p-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                                ${status === opt.v ? opt.bg : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                              {opt.l}
                            </button>
                         ))}
                       </div>
                     </div>
                     
                     <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Observações Relevantes / Justificativa</label>
                       <textarea 
                         value={observation} 
                         onChange={e=>setObservation(e.target.value)} 
                         className="w-full p-4 bg-gray-50 border rounded-xl text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-purple-100" 
                         placeholder="Descreva a queixa e o resultado esperado..."
                       ></textarea>
                     </div>
    
                     <button disabled={isLoading || (status !== 'administrado' && !observation)} onClick={handleAdministerSos} className="w-full py-5 text-xs font-black uppercase tracking-widest text-white bg-purple-600 rounded-[20px] hover:bg-purple-800 transition-colors shadow-xl shadow-purple-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
                       {isLoading ? 'Registrando...' : 'Confirmar Registro SOS'}
                     </button>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                   <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-2xl mb-6">
                      <p className="text-xs font-bold leading-relaxed">Sem conduta SOS cadastrada para medicação. Use este espaço apenas para registrar uma intercorrência/observação no prontuário do residente.</p>
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Relato da Intercorrência</label>
                     <textarea 
                       value={observation} 
                       onChange={e=>setObservation(e.target.value)} 
                       className="w-full p-4 bg-gray-50 border rounded-xl text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-blue-100" 
                       placeholder="Descreva a intercorrência ou observação..."
                     ></textarea>
                   </div>
                   <button disabled={isLoading || !observation} onClick={handleAdministerSos} className="w-full py-5 text-xs font-black uppercase tracking-widest text-white bg-blue-600 rounded-[20px] hover:bg-blue-800 transition-colors shadow-xl shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
                     {isLoading ? 'Registrando...' : 'Salvar Intercorrência'}
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

    </div>
  );
};
