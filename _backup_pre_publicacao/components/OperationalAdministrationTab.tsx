import React, { useState, useEffect } from 'react';
import { Pill, CheckCircle2, AlertCircle, Clock, Users, X, Syringe, Search, CheckSquare, Square, FileText } from 'lucide-react';
import { Resident, Medication, MedicationAdministrationLog, OperationalShift, SosProtocol } from '../types';
import { fetchShifts, fetchMedicationAdministrationLogs, saveMedicationAdministrationLog, fetchSosProtocols } from '../lib/api';
import { sortResidentsByName } from '../lib/utils';

export const OperationalAdministrationTab: React.FC<{ residents: Resident[], session: any }> = ({ residents, session }) => {
  const [activeTab, setActiveTab] = useState<'fixa' | 'sos' | 'prontuario'>('fixa');

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shifts, setShifts] = useState<OperationalShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  
  const allTimes = Array.from(new Set(residents.flatMap(r => r.medications?.flatMap(m => m.times) || []))).sort();
  const availableTimes = allTimes.length > 0 ? ['TODOS', ...allTimes] : ['TODOS', 'Manhã', 'Tarde', 'Noite'];
  const [shift, setShift] = useState<string>('TODOS');

  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<MedicationAdministrationLog[]>([]);
  const [sosProtocols, setSosProtocols] = useState<SosProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Batch selection state: key = `${residentId}___${medId}___${time}`
  const [checkedMeds, setCheckedMeds] = useState<Record<string, boolean>>({});
  const [batchStatus, setBatchStatus] = useState<MedicationAdministrationLog['statusAdministracao']>('administrado');
  const [batchObservation, setBatchObservation] = useState('');

  // Single Action sheet modal for signing
  const [activeAction, setActiveAction] = useState<{resident: Resident, med: Medication, time: string} | null>(null);
  const [activeSosAction, setActiveSosAction] = useState<{resident: Resident, protocol?: SosProtocol | null} | null>(null);

  const [status, setStatus] = useState<MedicationAdministrationLog['statusAdministracao']>('administrado');
  const [observation, setObservation] = useState('');

  // Individual search resident state for 'prontuario' subtab
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);

  // Fetch shifts & SOS protocols
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
         
         const activeResidents = activeTab === 'sos' ? residents : (selectedResidentId ? residents.filter(r => r.id === selectedResidentId) : residents);
         
         for (const r of activeResidents) {
            try {
              const resLogs = await fetchMedicationAdministrationLogs(session.institutionId, r.id, date);
              allFetchedLogs = [...allFetchedLogs, ...resLogs];
            } catch (err) {
              console.error(err);
            }
         }
         
         setLogs(allFetchedLogs);
       };
       fetchLogs();
    } else {
       setLogs([]);
    }
  }, [session?.institutionId, date, residents, activeTab, selectedResidentId]);

  // Helper to check if a med/time log already exists
  const getLogForMedTime = (residentId: string, medId: string, time: string) => {
    const matched = logs.filter(l => l.residentId === residentId && l.prescriptionId === medId && l.horarioPrevisto === time && l.tipoMinistracao !== 'eventual_sos');
    if (matched.length > 0) {
       return matched.sort((a,b) => new Date(b.dataHoraRegistro).getTime() - new Date(a.dataHoraRegistro).getTime())[0];
    }
    return null;
  };

  // Helper to filter medications for a resident by selected shift / time
  const getShiftMedsWithTimes = (resident: Resident) => {
    const items: { med: Medication; time: string }[] = [];
    const activeMeds = resident.medications || [];

    activeMeds.forEach(m => {
      const times = (m.times && m.times.length > 0) ? m.times : ['Horário Livre'];
      times.forEach(t => {
        if (shift === 'TODOS' || t.toLowerCase() === shift.toLowerCase()) {
          items.push({ med: m, time: t });
        }
      });
    });

    return items;
  };

  // Sort residents alphabetically (A-Z)
  const sortedResidents = sortResidentsByName(residents);

  // Filter residents who have scheduled medications for the current shift/time filter and match search
  const filteredResidents = sortedResidents.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || (r.room && r.room.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    
    if (activeTab === 'fixa') {
      const items = getShiftMedsWithTimes(r);
      return items.length > 0;
    }
    return true;
  });

  // Toggle individual checkbox
  const toggleCheckItem = (residentId: string, medId: string, time: string) => {
    const key = `${residentId}___${medId}___${time}`;
    setCheckedMeds(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Select all pending medications across visible residents
  const handleSelectAllPending = () => {
    const newChecked: Record<string, boolean> = { ...checkedMeds };
    filteredResidents.forEach(r => {
      const items = getShiftMedsWithTimes(r);
      items.forEach(({ med, time }) => {
        const existingLog = getLogForMedTime(r.id, med.id, time);
        if (!existingLog) {
          const key = `${r.id}___${med.id}___${time}`;
          newChecked[key] = true;
        }
      });
    });
    setCheckedMeds(newChecked);
  };

  // Uncheck all items
  const handleUncheckAll = () => {
    setCheckedMeds({});
  };

  // Execute Batch Administration in ONE operation
  const handleBatchAdminister = async () => {
    const selectedKeys = Object.keys(checkedMeds).filter(k => checkedMeds[k]);
    if (selectedKeys.length === 0 || !selectedShiftId) return;

    setIsLoading(true);
    const shiftObj = shifts.find(s => s.id === selectedShiftId);

    const logsToSave: any[] = [];

    for (const key of selectedKeys) {
      const [resId, medId, timeVal] = key.split('___');
      const res = residents.find(r => r.id === resId);
      const med = res?.medications?.find(m => m.id === medId);
      if (!res || !med) continue;

      logsToSave.push({
        institutionId: session?.institutionId,
        residentId: res.id,
        prescriptionId: med.id,
        medicamentoPrescritoTexto: med.name,
        horarioPrevisto: timeVal,
        dataOperacional: date,
        turnoId: shiftObj?.id,
        turnoNome: shiftObj?.nomeTurno || 'Manual',
        statusAdministracao: batchStatus,
        dataHoraRegistro: new Date().toISOString(),
        responsavelUserId: session?.userId || '',
        responsavelNome: session?.userName || 'Usuário Atual',
        observacoes: batchObservation || 'Ministração registrada em lote',
        tipoMinistracao: 'fixa'
      });
    }

    try {
      const savedResults = await Promise.all(logsToSave.map(log => saveMedicationAdministrationLog(log)));
      
      // Update local logs state
      setLogs(prev => {
        let updated = [...prev];
        savedResults.forEach((saved, idx) => {
          const original = logsToSave[idx];
          updated = updated.filter(l => !(l.residentId === original.residentId && l.prescriptionId === original.prescriptionId && l.horarioPrevisto === original.horarioPrevisto));
          updated.push({ ...original, id: saved.id || Math.random().toString() });
        });
        return updated;
      });

      setCheckedMeds({});
      setBatchObservation('');
      setSuccessBanner(`${logsToSave.length} ministrações registradas com sucesso em lote!`);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar ministrações em lote. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  // Single administration handler
  const handleAdministerSingle = async () => {
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

  // SOS administration handler
  const handleAdministerSos = async () => {
    if (!activeSosAction || !selectedShiftId) return;
    setIsLoading(true);
    
    const shiftObj = shifts.find(s => s.id === selectedShiftId);
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
      statusAdministracao: activeSosAction.protocol ? status : 'outro',
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

  // Count total selected items
  const selectedCount = Object.keys(checkedMeds).filter(k => checkedMeds[k]).length;

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto w-full relative pb-24">
      
      {/* Top Banner Message */}
      {successBanner && (
        <div className="mb-4 bg-emerald-500 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between font-black text-xs uppercase tracking-wider animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} />
            {successBanner}
          </div>
          <button onClick={() => setSuccessBanner(null)} className="p-1 hover:bg-emerald-600 rounded-lg">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-white rounded-3xl p-1.5 mb-6 border shadow-sm shrink-0">
         <button 
            type="button" 
            onClick={() => setActiveTab('fixa')} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeTab === 'fixa' ? 'bg-[#004c99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
         >
            <CheckCircle2 size={16} />
            Ministração em Lote (Ordem Alfabética)
         </button>
         <button 
            type="button" 
            onClick={() => setActiveTab('sos')} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeTab === 'sos' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
         >
            <Syringe size={16} />
            Medicação Eventual / SOS
         </button>
         <button 
            type="button" 
            onClick={() => setActiveTab('prontuario')} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeTab === 'prontuario' ? 'bg-slate-800 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
         >
            <FileText size={16} />
            Busca Individual por Prontuário
         </button>
      </div>

      {/* Control Bar: Date, Shift, Horário, Search */}
      {activeTab !== 'prontuario' && (
        <div className="bg-white rounded-[32px] shadow-sm border p-6 flex flex-col md:flex-row gap-4 items-center shrink-0 mb-6">
            <div className="w-full md:w-1/4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Turno Operacional</label>
              <select 
                 className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 text-sm focus:ring-2 focus:ring-blue-100"
                 value={selectedShiftId} 
                 onChange={e=>setSelectedShiftId(e.target.value)}
              >
                 {shifts.map(s => (
                   <option key={s.id} value={s.id}>{s.nomeTurno} - {s.horarioInicio} às {s.horarioFim}</option>
                 ))}
                 {shifts.length === 0 && <option value="">Turno Geral / Padrão</option>}
              </select>
            </div>

            <div className="w-full md:w-1/4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Data Operacional</label>
              <input 
                 type="date" 
                 value={date} 
                 onChange={e=>setDate(e.target.value)} 
                 className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 text-sm focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {activeTab === 'fixa' && (
              <div className="w-full md:w-1/4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Horário da Prescrição</label>
                <select
                   value={shift}
                   onChange={e => setShift(e.target.value)}
                   className="w-full p-4 bg-blue-50/80 border border-blue-100 rounded-2xl outline-none font-black text-[#004c99] uppercase tracking-widest text-sm focus:ring-2 focus:ring-blue-200"
                >
                  {availableTimes.map(t => (
                    <option key={t} value={t}>{t === 'TODOS' ? '• Todos os Horários' : t}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="w-full md:w-1/4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Filtrar por Idoso / Quarto</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Nome ou Quarto..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 text-sm placeholder:normal-case placeholder:font-normal focus:ring-2 focus:ring-blue-100"
                />
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
        </div>
      )}

      {/* MAIN VIEW: FIXA (Batch Administration in Alphabetical Order) */}
      {activeTab === 'fixa' && (
        <div className="flex-1 flex flex-col space-y-6">
          
          {/* Quick Selection Helper Bar */}
          <div className="flex flex-wrap items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200/80 gap-3">
             <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {filteredResidents.length} {filteredResidents.length === 1 ? 'Idoso Listado' : 'Idosos Listados em Ordem Alfabética'}
                </span>
                {selectedCount > 0 && (
                   <span className="bg-[#004c99] text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-widest">
                     {selectedCount} Selecionados
                   </span>
                )}
             </div>

             <div className="flex items-center gap-2">
                <button
                   type="button"
                   onClick={handleSelectAllPending}
                   className="px-4 py-2 bg-white border border-blue-200 text-[#004c99] hover:bg-blue-50 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                >
                   <CheckSquare size={14} /> Selecionar Todos os Pendentes
                </button>
                {selectedCount > 0 && (
                   <button
                      type="button"
                      onClick={handleUncheckAll}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5"
                   >
                      <Square size={14} /> Desmarcar
                   </button>
                )}
             </div>
          </div>

          {/* List of Residents in Alphabetical Order */}
          {filteredResidents.length === 0 ? (
             <div className="py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-200">
               <Pill className="text-gray-200 mx-auto mb-4" size={48} />
               <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhum medicamento previsto para o filtro selecionado</p>
               <p className="text-xs text-gray-400 mt-1">Altere o turno, horário ou a busca por idoso acima.</p>
             </div>
          ) : (
             filteredResidents.map(r => {
                const items = getShiftMedsWithTimes(r);
                if (items.length === 0) return null;

                const pendingCount = items.filter(({ med, time }) => !getLogForMedTime(r.id, med.id, time)).length;
                const completedCount = items.length - pendingCount;

                return (
                  <div key={r.id} className="bg-white rounded-[32px] shadow-sm border p-6 flex flex-col md:flex-row gap-6 hover:border-blue-200 transition-all">
                     
                     {/* Resident Column */}
                     <div className="md:w-64 shrink-0 flex items-center md:items-start md:flex-col gap-4 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-6">
                       <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#004c99] font-black shadow-inner overflow-hidden border border-blue-100/50 shrink-0">
                         {r.photo ? <img src={r.photo} alt={r.name} className="w-full h-full object-cover"/> : <Users size={24}/>}
                       </div>
                       <div>
                         <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg leading-tight">{r.name}</h3>
                         <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                            Quarto {r.room || 'N/A'} • Leito {r.bedNumber || (r as any).bed || 'N/A'}
                         </p>
                         <div className="flex items-center gap-1.5 mt-3">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                               {pendingCount} Pendente{pendingCount !== 1 && 's'}
                            </span>
                            {completedCount > 0 && (
                               <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {completedCount} Concluído{completedCount !== 1 && 's'}
                               </span>
                            )}
                         </div>
                       </div>
                     </div>

                     {/* Medication Items List for this Resident */}
                     <div className="flex-1 space-y-3">
                        {items.map(({ med, time }) => {
                           const log = getLogForMedTime(r.id, med.id, time);
                           const isHandled = !!log;
                           const itemKey = `${r.id}___${med.id}___${time}`;
                           const isChecked = !!checkedMeds[itemKey];

                           return (
                             <div 
                                key={`${med.id}-${time}`} 
                                onClick={() => !isHandled && toggleCheckItem(r.id, med.id, time)}
                                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between cursor-pointer ${
                                  isHandled 
                                    ? 'bg-gray-50 border-gray-200 cursor-default opacity-85' 
                                    : isChecked 
                                    ? 'bg-blue-50/80 border-blue-300 shadow-sm ring-1 ring-blue-200' 
                                    : 'bg-white border-gray-200 hover:border-blue-200'
                                }`}
                             >
                                <div className="flex items-center gap-3 flex-1">
                                   {!isHandled ? (
                                      <input 
                                         type="checkbox"
                                         checked={isChecked}
                                         onChange={() => toggleCheckItem(r.id, med.id, time)}
                                         onClick={(e) => e.stopPropagation()}
                                         className="w-5 h-5 rounded-lg border-gray-300 text-[#004c99] focus:ring-blue-500 cursor-pointer"
                                      />
                                   ) : (
                                      <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                                   )}

                                   <div>
                                     <h5 className="text-sm font-black uppercase text-gray-800 flex items-center gap-2">
                                       <Pill size={14} className={isHandled ? 'text-emerald-600' : 'text-[#004c99]'}/> {med.name}
                                     </h5>
                                     <div className="flex items-center gap-2 mt-1">
                                       <Clock size={12} className="text-gray-400" />
                                       <span className="text-xs font-bold text-[#004c99] bg-blue-50/80 px-2 py-0.5 rounded-md">{time}</span>
                                       <span className="text-xs uppercase font-bold text-gray-500">
                                         {med.concentration && `${med.concentration} • `}{med.dose || `Via: ${med.route || 'Não informada'}`}
                                       </span>
                                     </div>
                                   </div>
                                </div>

                                {isHandled ? (
                                   <div className="flex flex-col items-end gap-1 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                                     <span className={`px-3 py-1 flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest border
                                         ${log.statusAdministracao === 'administrado' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                                           log.statusAdministracao === 'recusado' ? 'bg-red-100 text-red-800 border-red-200' : 
                                           'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                         {log.statusAdministracao.replace('_', ' ')}
                                     </span>
                                     <span className="text-[9px] text-gray-400 font-bold uppercase">Resp: {log.responsavelNome}</span>
                                   </div>
                                ) : (
                                   <div className="flex items-center gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        type="button" 
                                        onClick={() => toggleCheckItem(r.id, med.id, time)}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                                           isChecked 
                                             ? 'bg-[#004c99] text-white shadow-sm' 
                                             : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-[#004c99]'
                                        }`}
                                      >
                                        {isChecked ? 'Conferido ✓' : 'Conferir'}
                                      </button>
                                      
                                      <button 
                                        type="button" 
                                        onClick={() => setActiveAction({resident: r, med, time})}
                                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                                        title="Registrar singularmente com observação"
                                      >
                                        Obs / Detalhar
                                      </button>
                                   </div>
                                )}
                             </div>
                           );
                        })}
                     </div>
                  </div>
                );
             })
          )}
        </div>
      )}

      {/* VIEW: SOS / EVENTUAL */}
      {activeTab === 'sos' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredResidents.map(r => {
              const protocols = sosProtocols.filter(p => p.residentId === r.id && p.status === 'ativo');
              
              return (
                <div key={r.id} className="bg-white rounded-[32px] shadow-sm border p-6 flex flex-col">
                   <div className="flex items-center gap-4 border-b border-gray-100 pb-4 mb-4">
                     <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 font-black shadow-inner overflow-hidden border border-purple-100/50">
                       {r.photo ? <img src={r.photo} alt={r.name} className="w-full h-full object-cover"/> : <Users size={20}/>}
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
                           <button type="button" onClick={() => setActiveSosAction({resident: r, protocol: null})} className="mt-4 px-4 py-2 bg-gray-50 border rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors w-full">
                             Apenas Registrar Intercorrência
                           </button>
                        </div>
                      ) : (
                        protocols.map(p => (
                          <button type="button"
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
                         <button type="button" onClick={() => setActiveSosAction({resident: r, protocol: null})} className="mt-2 px-4 py-2 bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors w-full">
                           Intercorrência s/ Medicação SOS
                         </button>
                      )}
                   </div>
                </div>
              );
           })}
         </div>
      )}

      {/* VIEW: PRONTUÁRIO INDIVIDUAL */}
      {activeTab === 'prontuario' && (
         <div className="bg-white rounded-[32px] shadow-sm border p-6 flex flex-col space-y-6">
            <div className="flex items-center gap-4 border-b pb-4">
               <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                 <FileText size={20} />
               </div>
               <div>
                 <h3 className="text-base font-black text-gray-900 uppercase">Consulta de Prontuário de Ministrações</h3>
                 <p className="text-xs text-gray-500 font-bold uppercase">Selecione o idoso para visualizar o histórico detalhado</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Selecione o Idoso</label>
                  <select 
                     value={selectedResidentId || ''} 
                     onChange={e => setSelectedResidentId(e.target.value)}
                     className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm font-bold uppercase text-gray-800"
                  >
                     <option value="">-- Selecionar Idoso --</option>
                     {sortedResidents.map(r => (
                        <option key={r.id} value={r.id}>{r.name} (Quarto {r.room || 'N/A'})</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Data da Ministração</label>
                  <input 
                     type="date" 
                     value={date} 
                     onChange={e => setDate(e.target.value)} 
                     className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm font-bold text-gray-800"
                  />
               </div>
            </div>

            {selectedResidentId && (
               <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-black uppercase text-slate-700">
                     Histórico de Ministrações para {residents.find(r => r.id === selectedResidentId)?.name} em {date.split('-').reverse().join('/')}
                  </h4>

                  <div className="border rounded-2xl overflow-hidden">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b">
                           <tr>
                              <th className="p-3">Horário Previsto</th>
                              <th className="p-3">Medicamento</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Responsável</th>
                              <th className="p-3">Data/Hora Registro</th>
                              <th className="p-3">Observações</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                           {logs.length === 0 ? (
                              <tr><td colSpan={6} className="p-8 text-center text-gray-400 uppercase font-bold">Nenhum registro de ministração nesta data</td></tr>
                           ) : (
                              logs.map(l => (
                                 <tr key={l.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-[#004c99]">{l.horarioPrevisto}</td>
                                    <td className="p-3 font-black text-gray-800">{l.medicamentoPrescritoTexto}</td>
                                    <td className="p-3">
                                       <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                          l.statusAdministracao === 'administrado' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                       }`}>
                                          {l.statusAdministracao}
                                       </span>
                                    </td>
                                    <td className="p-3 font-bold text-gray-700">{l.responsavelNome}</td>
                                    <td className="p-3 text-gray-500">{new Date(l.dataHoraRegistro).toLocaleString('pt-BR')}</td>
                                    <td className="p-3 text-gray-600 italic">{l.observacoes || '-'}</td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}
         </div>
      )}

      {/* FLOATING ACTION BAR FOR BATCH FINALIZATION */}
      {selectedCount > 0 && activeTab === 'fixa' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4 animate-in slide-in-from-bottom-8">
          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-2xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#004c99] flex items-center justify-center font-black text-white text-base shrink-0 shadow-inner">
                {selectedCount}
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  {selectedCount} {selectedCount === 1 ? 'Medicação Selecionada' : 'Medicações Selecionadas'}
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Operação única em lote • {date.split('-').reverse().join('/')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={batchStatus}
                onChange={e => setBatchStatus(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="administrado">Administrado com sucesso</option>
                <option value="recusado">Recusado pelo idoso</option>
                <option value="nao_administrado">Não administrado</option>
                <option value="em_falta">Medicamento em falta</option>
                <option value="suspenso">Suspenso</option>
              </select>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleBatchAdminister}
                className="px-6 py-3 bg-[#004c99] hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                {isLoading ? 'Registrando...' : <><CheckCircle2 size={18} /> Finalizar e Registrar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Sheet Modal for Fixa Individual */}
      {activeAction && activeTab === 'fixa' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-end md:justify-center p-4">
           <div className="bg-white rounded-t-[40px] md:rounded-[40px] p-8 w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-8 md:zoom-in-95">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-[#004c99] shadow-inner">
                     <CheckCircle2 size={24} />
                   </div>
                   <div>
                     <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest leading-none">Registrar Ministração Fixa</h3>
                     <h4 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none mt-2">{activeAction.resident.name}</h4>
                   </div>
                </div>
                <button type="button" onClick={() => setActiveAction(null)} className="p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl mb-6 flex flex-col gap-1">
                 <p className="text-sm font-black text-gray-800 uppercase">{activeAction.med.name}</p>
                 <p className="text-xs text-gray-500 font-bold uppercase">{activeAction.med.concentration && `${activeAction.med.concentration} • `}{activeAction.med.dose || `Via: ${activeAction.med.route || 'Não informada'}`}</p>
                 <p className="text-[10px] font-black text-[#004c99] uppercase tracking-widest mt-2 flex items-center gap-1">
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
                        <button type="button"
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
                     className="w-full p-4 bg-gray-50 border rounded-xl text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-blue-100" 
                     placeholder={(status !== 'administrado') ? 'A justificativa é obrigatória para este status...' : 'Observações opcionais...'}
                   ></textarea>
                 </div>

                 <button type="button" disabled={isLoading || (status !== 'administrado' && !observation)} onClick={handleAdministerSingle} className="w-full py-5 text-xs font-black uppercase tracking-widest text-white bg-[#004c99] rounded-2xl hover:bg-blue-800 transition-colors shadow-xl shadow-[#004c99]/20 disabled:opacity-50 flex items-center justify-center gap-2">
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
                <button type="button" onClick={() => setActiveSosAction(null)} className="p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              {activeSosAction.protocol ? (
                <>
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
                            <button type="button"
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
    
                     <button type="button" disabled={isLoading || (status !== 'administrado' && !observation)} onClick={handleAdministerSos} className="w-full py-5 text-xs font-black uppercase tracking-widest text-white bg-purple-600 rounded-[20px] hover:bg-purple-800 transition-colors shadow-xl shadow-purple-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
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
                   <button type="button" disabled={isLoading || !observation} onClick={handleAdministerSos} className="w-full py-5 text-xs font-black uppercase tracking-widest text-white bg-blue-600 rounded-[20px] hover:bg-blue-800 transition-colors shadow-xl shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
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
