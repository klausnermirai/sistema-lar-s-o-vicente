import React, { useState, useEffect } from 'react';
import { Resident, IncidentReport, ShiftHandover, MuralMessage, InstitutionSettings, OperationalShift, ShiftProcedureLog } from '../types';
import { getCurrentShift, getOperationalDate } from '../lib/shiftUtils';
import { fetchProcedureLogs } from '../lib/api';
import { Clock, CheckSquare, Activity, AlertTriangle, FileText, ChevronRight, Save, User, Calendar, Plus } from 'lucide-react';
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
  const [incidentType, setIncidentType] = useState<IncidentReport['type']>('clinica');
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

  // Parse prevLogs for the routine block
  const banhos = prevLogs.filter(l => l.tipoProcedimento === 'banho');
  const higieneOral = prevLogs.filter(l => l.tipoProcedimento === 'higiene_oral');
  const decubito = prevLogs.filter(l => l.tipoProcedimento === 'decubito');
  const barbaTrico = prevLogs.filter(l => l.tipoProcedimento === 'barba_trico');
  const unhas = prevLogs.filter(l => l.tipoProcedimento === 'unhas');
  const fralda = prevLogs.filter(l => l.tipoProcedimento === 'fralda');
  const alimentacao = prevLogs.filter(l => l.tipoProcedimento === 'alimentacao');

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
    const { getProfessionalSignature } = await import('../lib/api');
    const sigAuth = getProfessionalSignature() as { name: string, role: string, doc: string };
    const { printHandoverHtmlPdf } = await import('../lib/printHandover');
    await printHandoverHtmlPdf(prevHandover, prevLogs, prevVitalSigns, prevIncidents, settings, sigAuth);
  };

  const handleSaveAll = () => {
    if (!summary.trim()) {
      alert("Por favor, preencha o resumo do plantão.");
      return;
    }

    if (hasIncident && (!description.trim() || selectedResidentIds.length === 0)) {
      alert("Para registrar uma intercorrência, selecione os residentes e preencha a descrição.");
      return;
    }

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
      professionalName: 'Profissional Logado'
    };
    onSaveHandover(handover);

    if (hasIncident) {
      const incident: IncidentReport = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        institutionId: settings?.id,
        dataOperacional: opDate,
        turnoId: currentShift?.id,
        turnoNome: currentShift?.nomeTurno,
        residentIds: selectedResidentIds,
        type: incidentType,
        description,
        conduct,
        visibilidade,
        professionalName: 'Profissional Logado'
      };
      onSaveIncident(incident);
    }
    
    // Post to Mural
    if (visibilidade.length > 0) {
      onPostToMural({
        author: `Relatório de Plantão - ${(currentShift?.nomeTurno || 'Manual').toUpperCase()}`,
        text: `🔄 Resumo do Turno Adicionado`,
        detailedContent: `RESUMO DO TURNO:\n${summary}\n\nPENDÊNCIAS:\n${pendingTasks || 'Nenhuma'}`,
        visibilidade
      });

      if (hasIncident) {
        const residentNames = residents
          .filter(r => selectedResidentIds.includes(r.id))
          .map(r => r.name)
          .join(', ');
        
        onPostToMural({
          author: `🚨 INTERCORRÊNCIA [${incidentType.toUpperCase()}]`,
          text: `🚩 Nova intercorrência registrada para: ${residentNames}`,
          detailedContent: `Descrição:\n${description}\n\nConduta:\n${conduct}`,
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
    alert('Plantão registrado com sucesso!');
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
      </div>

      <div className="space-y-6 w-full pb-20">
        
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4">
              <span className="text-[10px] font-black uppercase text-gray-500 block">Banho</span>
              <span className="text-2xl font-black text-[#004c99]">{banhos.length} reg.</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <span className="text-[10px] font-black uppercase text-gray-500 block">Higiene Oral</span>
              <span className="text-2xl font-black text-[#004c99]">{higieneOral.length} reg.</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <span className="text-[10px] font-black uppercase text-gray-500 block">Fraldas</span>
              <span className="text-2xl font-black text-[#004c99]">{fralda.length} reg.</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <span className="text-[10px] font-black uppercase text-gray-500 block">Alimentação</span>
              <span className="text-2xl font-black text-[#004c99]">{alimentacao.length} reg.</span>
            </div>
          </div>
          {prevLogs.length === 0 && (
            <p className="text-xs font-bold uppercase text-gray-400 py-4 text-center">Nenhuma rotina registrada no turno anterior.</p>
          )}
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
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-200">
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
                
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Residentes Envolvidos ({selectedResidentIds.length})</label>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-2 bg-gray-50 rounded-2xl border">
                    {residents.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedResidentIds(prev => 
                          prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                        )}
                        className={`px-4 py-3 rounded-xl text-xs font-black uppercase transition-all ${
                          selectedResidentIds.includes(r.id) 
                            ? 'bg-red-600 text-white shadow-md' 
                            : 'bg-white text-gray-600 border hover:bg-gray-100'
                        }`}
                      >
                        {r.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
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
            className="px-10 py-5 bg-green-600 text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-xl hover:bg-green-700 transition-all flex items-center gap-3"
          >
            <Save size={24} /> Concluir e Salvar Plantão
          </button>
        </div>

      </div>
    </>
  );
};

export default HandoverTabletView;
