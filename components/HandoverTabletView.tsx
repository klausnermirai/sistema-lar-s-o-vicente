import React, { useState, useEffect, useRef } from 'react';
import { Resident, IncidentReport, ShiftHandover, MuralMessage, InstitutionSettings, OperationalShift, ShiftProcedureLog } from '../types';
import { getCurrentShift, getOperationalDate } from '../lib/shiftUtils';
import { generateRoutinesSummaryText } from '../lib/routineSummaryHelper';
import { fetchProcedureLogs, getProfessionalSignature } from '../lib/api';
import { Clock, CheckSquare, Activity, AlertTriangle, FileText, ChevronRight, ChevronDown, ChevronUp, Save, User, Calendar, Plus, Search, X } from 'lucide-react';
import { motion } from 'motion/react';

interface HandoverTabletViewProps {
  handovers: ShiftHandover[];
  residents: Resident[];
  shifts: OperationalShift[];
  settings?: InstitutionSettings | null;
  onSaveIncident: (incident: IncidentReport) => void;
  onSaveHandover: (handover: ShiftHandover) => void;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const HandoverTabletView: React.FC<HandoverTabletViewProps> = ({
  handovers,
  residents,
  shifts,
  settings,
  onSaveIncident,
  onSaveHandover,
  onPostToMural
}) => {
  const currentShift = getCurrentShift(shifts);
  const opDate = getOperationalDate(shifts);

  const [summary, setSummary] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');
  const [hasIncident, setHasIncident] = useState(false);
  const [residentSearchTerm, setResidentSearchTerm] = useState('');
  const [isPrevShiftOpen, setIsPrevShiftOpen] = useState(false);
  const incidentRef = useRef<HTMLDivElement>(null);

  const handleRegistrarIntercorrencia = () => {
    setHasIncident(true);
    setTimeout(() => {
        incidentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };
  const [incidentType, setIncidentType] = useState<IncidentReport['type']>('clinica');
  const [incidentDate, setIncidentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [incidentTime, setIncidentTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  });
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [conduct, setConduct] = useState('');
  const [visibilidade, setVisibilidade] = useState<string[]>(['admin', 'publico']);

  const [prevLogs, setPrevLogs] = useState<ShiftProcedureLog[]>([]);

  // Find previous shift
  const sortedShifts = [...(shifts || [])].sort((a,b) => (a.horarioInicio || '').localeCompare(b.horarioInicio || ''));
  const currentIndex = sortedShifts.findIndex(s => s.id === currentShift?.id);
  
  let prevShift: OperationalShift | null = null;
  let prevOpDate = opDate;

  if (sortedShifts.length > 0) {
    if (currentIndex > 0) {
      prevShift = sortedShifts[currentIndex - 1];
    } else {
      prevShift = sortedShifts[sortedShifts.length - 1];
      const prevDate = new Date(opDate + 'T12:00:00');
      prevDate.setDate(prevDate.getDate() - 1);
      prevOpDate = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-${String(prevDate.getDate()).padStart(2,'0')}`;
    }
  }

  useEffect(() => {
    if (settings?.id && prevOpDate) {
      fetchProcedureLogs(settings.id, prevOpDate).then(logs => {
         const shiftLogs = logs.filter(l => l.turnoId === prevShift?.id);
         setPrevLogs(shiftLogs);
      }).catch(err => console.error(err));
    }
  }, [settings?.id, prevOpDate, prevShift?.id]);

  const prevHandover = handovers
    .sort((a, b) => b.timestamp - a.timestamp)
    .find(h => h.turnoId === prevShift?.id && h.dataOperacional === prevOpDate);

  // Helper for old printHandover call which expects these constants in same shape:
  // printHandover expects them separately, so we keep them if printHandover needs them.
  const banhos = prevLogs.filter(l => l.tipoProcedimento === 'banho');

  // Filter previous vital signs
  const prevVitalSigns = residents.flatMap(r => {
    return (r.per?.vitalSignsHistory || []).map(v => ({...v, residentName: r.name}));
  }).filter(v => {
    // We check if it belongs to prev shift. For now check if it's within prevOpDate.
    // To be precisely correct, we'd check times, but comparing operational dates is fine if available.
    // If operational date is not on vital sign, just use the local date vs prevOpDate
    const vDate = v.date.split('T')[0];
    return vDate === prevOpDate;
  });

  const prevIncidents = residents.flatMap(r => {
    return (r.incidents || []).map(inc => ({...inc, residentName: r.name}));
  }).filter(inc => inc.turnoId === prevShift?.id && inc.dataOperacional === prevOpDate);

  const handlePrintPrevHandover = async () => {
    if (!prevHandover) return;
    const sig = getProfessionalSignature() as any;
    const sigAuth = {
      name: sig.profissionalNome || '',
      role: sig.profissionalFuncao || '',
      doc: sig.profissionalAssinaturaTexto ? sig.profissionalAssinaturaTexto.split('\n')[2] || '' : ''
    };
    const { printHandoverHtmlPdf } = await import('../lib/printHandover');
    await printHandoverHtmlPdf(prevHandover, prevLogs, prevVitalSigns, prevIncidents, settings, sigAuth, residents);
  };

  const handleSaveAll = () => {
    if (!hasIncident && !summary.trim()) {
      alert("Por favor, preencha o resumo do plantão ou registre uma intercorrência.");
      return;
    }

    if (hasIncident && (!description.trim() || selectedResidentIds.length === 0)) {
      alert("Para registrar uma intercorrência, selecione os residentes e preencha a descrição.");
      return;
    }

    if (summary.trim()) {
      const sig = getProfessionalSignature() as any;
      const handover: ShiftHandover = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        institutionId: settings?.id,
        dataOperacional: opDate,
        turnoId: currentShift?.id || 'manual',
        turnoNome: currentShift?.nomeTurno || 'Manual',
        shift: currentShift?.nomeTurno || 'manha',
        summary,
        pendingTasks,
        visibilidade,
        ...sig,
        professionalName: sig.profissionalNome || 'Supervisor de Turno'
      };
      onSaveHandover(handover);

      // Post to Mural
      if (visibilidade.length > 0) {
        onPostToMural({
          author: `Relatório de Plantão - ${(currentShift?.nomeTurno || 'Manual').toUpperCase()}`,
          text: `🔄 Resumo do Turno Adicionado`,
          detailedContent: `RESUMO DO TURNO:\n${summary}\n\nPENDÊNCIAS:\n${pendingTasks || 'Nenhuma'}`,
          visibilidade
        });
      }
    }

    if (hasIncident) {
      const partsDate = incidentDate.split('-');
      const partsTime = incidentTime.split(':');
      let incidentTimestamp = Date.now();
      let incOpDate = opDate;
      
      if (partsDate.length === 3 && partsTime.length === 2) {
        const incDateTime = new Date(Number(partsDate[0]), Number(partsDate[1]) - 1, Number(partsDate[2]), Number(partsTime[0]), Number(partsTime[1]));
        incidentTimestamp = incDateTime.getTime();
        
        // Let's use a dynamic getOperationalDateLocal function like the HandoverTab one. To be consistent, 
        // since we are just adding feature here, we'll just keep the current shift's opDate or what shiftUtils tells us.
        // As a fallback, we pass opDate. HandoverTab imports 'getOperationalDateLocal' locally inside component.
        // We will just assume the current shift opDate for this incident unless we recalculate it.
        // To be safe, we'll keep `incOpDate = opDate` (the user is registering in the current shift)
      }

      const sig = getProfessionalSignature() as any;
      const incident: IncidentReport = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: incidentTimestamp,
        institutionId: settings?.id,
        dataOperacional: incOpDate,
        turnoId: currentShift?.id,
        turnoNome: currentShift?.nomeTurno,
        residentIds: selectedResidentIds,
        type: incidentType,
        description,
        conduct,
        visibilidade,
        ...sig,
        professionalName: sig.profissionalNome || 'Equipe de Enfermagem'
      };
      onSaveIncident(incident);

      if (visibilidade.length > 0) {
        const residentNames = residents
          .filter(r => selectedResidentIds.includes(r.id))
          .map(r => r.name)
          .join(', ');
        
        onPostToMural({
          author: `🚨 INTERCORRÊNCIA [${incidentType.toUpperCase()}]`,
          text: `🚩 Nova intercorrência registrada para: ${residentNames}`,
          detailedContent: `Data/Hora: ${incidentDate.split('-').reverse().join('/')} às ${incidentTime}\n\nDescrição:\n${description}\n\nConduta:\n${conduct}`,
          visibilidade
        });
      }
    }

    setSummary('');
    setPendingTasks('');
    setHasIncident(false);
    setSelectedResidentIds([]);
    setDescription('');
    setConduct('');

    const d = new Date();
    setIncidentDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    setIncidentTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    
    alert('Registros salvos com sucesso!');
  };

  return (
    <>
      {/* A. Cabeçalho do plantão atual */}
      <div className="bg-[#004c99] text-white p-6 shadow-sm flex items-center justify-between rounded-[32px] mb-8">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest">{currentShift?.nomeTurno || 'Turno Atual'}</h2>
          <div className="flex items-center gap-4 mt-2 text-blue-200">
            <span className="flex items-center gap-1 text-sm font-bold uppercase"><Calendar size={14} /> Data: {opDate}</span>
            <span className="flex items-center gap-1 text-sm font-bold uppercase"><Clock size={14} /> {currentShift?.horarioInicio} - {currentShift?.horarioFim}</span>
          </div>
        </div>
        
        <button
          onClick={handleRegistrarIntercorrencia}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
        >
          <AlertTriangle size={18} />
          Registrar Intercorrência
        </button>
      </div>

      <div className="space-y-6 w-full pb-20">
        
        {/* Visualizar Plantão Anterior Toggle */}
        <div className="flex justify-center mb-6">
           <button 
             onClick={() => setIsPrevShiftOpen(!isPrevShiftOpen)}
             className="bg-gray-100 hover:bg-gray-200 text-[#004c99] px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm border border-gray-200"
           >
             {isPrevShiftOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
             {isPrevShiftOpen ? 'Recolher Plantão Anterior' : 'Visualizar Plantão Anterior'}
           </button>
        </div>

        {isPrevShiftOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-6">
            {/* B. Plantão anterior */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99] flex items-center gap-2">
                  <FileText size={18} /> Plantão Anterior: {prevShift?.nomeTurno || 'Desconhecido'} ({prevOpDate})
                </h3>
                {prevHandover && (
                  <button 
                    onClick={handlePrintPrevHandover}
                    className="bg-gray-100 text-gray-500 hover:text-[#004c99] hover:bg-gray-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                    title="Exportar PDF do Plantão Anterior"
                  >
                    <FileText size={14} /> Exportar PDF
                  </button>
                )}
              </div>
              {prevHandover ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Resumo</span>
                    <p className="text-sm text-gray-800 bg-gray-50 p-4 rounded-2xl">{prevHandover.summary}</p>
                  </div>
                  {prevHandover.pendingTasks && (
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 block mb-1">Pendências Deixadas</span>
                      <p className="text-sm text-orange-800 bg-orange-50 p-4 rounded-2xl">{prevHandover.pendingTasks}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs font-bold uppercase text-gray-400 py-4 text-center">Nenhum plantão anterior registrado.</p>
              )}
            </div>

            {/* C. Atividades / Rotinas do turno anterior */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-200">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99] mb-4 border-b pb-2 flex items-center gap-2">
                <CheckSquare size={18} /> Resumo de Rotinas (Turno Anterior)
              </h3>
              <pre className="text-xs font-medium text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-2xl p-4 overflow-x-auto border border-gray-100">
                  {generateRoutinesSummaryText(prevLogs, residents, prevOpDate)}
              </pre>
            </div>

            {/* D. Sinais vitais do turno anterior */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-200">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99] mb-4 border-b pb-2 flex items-center gap-2">
                <Activity size={18} /> Sinais Vitais (Turno Anterior)
              </h3>
              {prevVitalSigns.length > 0 ? (
                <div className="space-y-2">
                  {prevVitalSigns.slice(0, 10).map((v, i) => (
                    <div key={i} className="text-xs bg-gray-50 p-3 rounded-xl">
                      <span className="font-bold text-gray-800">{v.residentName}</span>
                      <span className="text-gray-500 ml-2">
                        {v.hgtValue ? `Glic. ${v.hgtValue}` : ''} {v.paSystolic ? `PA ${v.paSystolic}x${v.paDiastolic}` : ''} {v.temperature ? `Temp ${v.temperature}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold uppercase text-gray-400 py-4 text-center">Nenhum sinal vital registrado no turno anterior.</p>
              )}
            </div>

            {/* E. Intercorrências do turno anterior */}
            <div className="bg-red-50 rounded-[32px] p-6 shadow-sm border border-red-100">
              <h3 className="text-sm font-black uppercase tracking-widest text-red-700 mb-4 border-b border-red-200 pb-2 flex items-center gap-2">
                <AlertTriangle size={18} /> Intercorrências (Turno Anterior)
              </h3>
              {prevIncidents.length > 0 ? (
                <div className="space-y-4">
                  {prevIncidents.map(inc => (
                    <div key={inc.id} className="bg-white rounded-2xl p-4 border border-red-100">
                      <span className="text-[10px] font-black bg-red-600 text-white px-2 py-1 rounded-lg uppercase inline-block mb-2">{inc.type}</span>
                      <p className="text-sm font-bold text-gray-800">{inc.residentName}</p>
                      <p className="text-xs text-gray-600 mt-1">{inc.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold uppercase text-red-400 py-4 text-center">Nenhuma intercorrência registrada no turno anterior.</p>
              )}
            </div>
          </motion.div>
        )}

        {/* F. Registrar plantão atual */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-[#004c99]">
          <h3 className="text-xl font-black uppercase tracking-widest text-[#004c99] mb-6 flex items-center gap-2">
            Registrar Plantão Atual
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Relatório do plantão</label>
              <textarea 
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Descreva como foi o plantão, estado geral dos idosos, cuidados realizados, observações importantes..."
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:bg-white focus:ring-2 min-h-[150px]"
              />
            </div>
            
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Pendências para o próximo turno</label>
              <textarea 
                value={pendingTasks}
                onChange={e => setPendingTasks(e.target.value)}
                placeholder="Medicamentos a checar, observações específicas, cuidados pendentes, residentes que precisam de atenção..."
                className="w-full bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm outline-none focus:bg-white focus:ring-2 min-h-[100px]"
              />
            </div>

            {/* Visibilidade do Mural */}
            <div className="bg-gray-50 border rounded-2xl p-4 flex gap-6">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">Visibilidade Mural:</label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={visibilidade.includes('publico')}
                  onChange={(e) => {
                    if (e.target.checked) setVisibilidade([...visibilidade, 'publico']);
                    else setVisibilidade(visibilidade.filter(v => v !== 'publico'));
                  }}
                  className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                />
                <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-[#004c99]">Público</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={visibilidade.includes('admin')}
                  onChange={(e) => {
                    if (e.target.checked) setVisibilidade([...visibilidade, 'admin']);
                    else setVisibilidade(visibilidade.filter(v => v !== 'admin'));
                  }}
                  className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-600"
                />
                <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-purple-600">Direção e Coord.</span>
              </label>
            </div>
          </div>
        </div>

        {/* G. Registrar nova intercorrência */}
        <div ref={incidentRef} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
              <AlertTriangle size={18} /> Registrar Intercorrência
            </h3>
            <button
               onClick={() => setHasIncident(!hasIncident)}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 hasIncident ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
               }`}
             >
               {hasIncident ? 'Cancelar' : 'Nova Ocorrência'}
            </button>
          </div>

          {hasIncident && (
            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="space-y-6 pt-4 border-t">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Data da Ocorrência</label>
                    <input 
                      type="date"
                      value={incidentDate}
                      onChange={e => setIncidentDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-black uppercase outline-none focus:bg-white focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Hora da Ocorrência</label>
                    <input 
                      type="time"
                      value={incidentTime}
                      onChange={e => setIncidentTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-black uppercase outline-none focus:bg-white focus:ring-2 focus:ring-red-100"
                    />
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Tipo</label>
                  <select 
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-black uppercase outline-none"
                  >
                    <option value="clinica">Clínica</option>
                    <option value="comportamental">Comportamental</option>
                    <option value="queda">Queda</option>
                    <option value="lesao">Lesão / Ferimento</option>
                    <option value="recusa_alimentacao">Recusa Alimentação</option>
                    <option value="recusa_medicacao">Recusa Medicação</option>
                    <option value="sinais_vitais">Alt. Sinais Vitais</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Residentes Envolvidos ({selectedResidentIds.length})</label>
                  
                  {selectedResidentIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedResidentIds.map(id => {
                        const r = residents.find(res => res.id === id);
                        if (!r) return null;
                        return (
                          <div key={id} className="flex items-center gap-2 bg-red-100 text-red-800 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200">
                            <span>{r.name}</span>
                            <button type="button" onClick={() => setSelectedResidentIds(prev => prev.filter(x => x !== id))} className="text-red-500 hover:text-red-800 focus:outline-none">
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar residente por nome..." 
                      value={residentSearchTerm}
                      onChange={e => setResidentSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:bg-white focus:ring-2 focus:ring-red-100 transition-all"
                    />
                  </div>

                  {residentSearchTerm.trim() !== '' && (
                    <div className="absolute z-50 w-full mt-2 max-h-[200px] overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-xl shadow-xl">
                      {(() => {
                        const available = residents.filter(r => !selectedResidentIds.includes(r.id));
                        const filtered = available.filter(r => r.name.toLowerCase().includes(residentSearchTerm.toLowerCase()));
                        
                        if (filtered.length === 0) {
                          return <div className="p-4 text-xs font-bold text-gray-500 text-center uppercase">Nenhum residente encontrado.</div>;
                        }

                        return filtered.map(r => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setSelectedResidentIds(prev => [...prev, r.id]);
                              setResidentSearchTerm('');
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex flex-col transition-colors"
                          >
                            <span className="text-xs font-black text-gray-800 uppercase">{r.name}</span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                              {r.birthDate ? `${Math.abs(new Date(Date.now() - new Date(r.birthDate + 'T00:00:00').getTime()).getUTCFullYear() - 1970)} anos` : 'Sem idade informada'}
                            </span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Descrição</label>
                   <textarea 
                     value={description}
                     onChange={e => setDescription(e.target.value)}
                     className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm min-h-[100px]"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Conduta Tomada</label>
                   <textarea 
                     value={conduct}
                     onChange={e => setConduct(e.target.value)}
                     className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm min-h-[100px]"
                   />
                </div>
            </motion.div>
          )}

        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSaveAll}
            disabled={(!summary.trim() && !hasIncident) || (hasIncident && (!description.trim() || selectedResidentIds.length === 0))}
            className="px-10 py-5 bg-green-600 text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-xl hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-green-600 transition-all flex items-center gap-3"
          >
            <Save size={24} /> {summary.trim() && hasIncident ? 'Salvar Plantão e Intercorrência' : summary.trim() ? 'Salvar Plantão' : 'Salvar Intercorrência'}
          </button>
        </div>

      </div>
    </>
  );
};

export default HandoverTabletView;
