import React, { useState } from 'react';
import { Resident, IncidentReport, ShiftHandover, MuralMessage } from '../types';
import { 
  AlertTriangle, 
  RotateCcw, 
  Users, 
  FileText, 
  Share2, 
  Save, 
  CheckCircle2, 
  X,
  AlertCircle,
  Megaphone,
  ClipboardList,
  Clock,
  Download,
  History,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HandoverTabProps {
  handovers: ShiftHandover[];
  residents: Resident[];
  onSaveIncident: (incident: IncidentReport) => void;
  onSaveHandover: (handover: ShiftHandover) => void;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const HandoverTab: React.FC<HandoverTabProps> = ({ 
  handovers,
  residents, 
  onSaveIncident, 
  onSaveHandover, 
  onPostToMural 
}) => {
  const [viewMode, setViewMode] = useState<'registrar' | 'historico'>('registrar');
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [shift, setShift] = useState<ShiftHandover['shift']>('manha');
  const [summary, setSummary] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');
  
  const [hasIncident, setHasIncident] = useState(false);
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [conduct, setConduct] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentReport['type']>('clinica');
  
  const [shareOnMural, setShareOnMural] = useState(true);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString('pt-BR');
    
    doc.setFontSize(16);
    doc.text(`Relatório Unificado de Plantão e Intercorrências`, 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Data: ${dateStr}`, 14, 28);
    doc.text(`Turno: ${shift.toUpperCase()}`, 14, 34);

    let currentY = 44;

    // Plantão Details
    doc.setFontSize(14);
    doc.text('Passagem de Plantão', 14, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    autoTable(doc, {
      startY: currentY,
      head: [['Relatório de Atividades / Eventos', 'Pendências']],
      body: [
        [summary || 'Nenhum relato', pendingTasks || 'Nenhuma pendência']
      ],
      headStyles: { fillColor: [0, 76, 153] },
      styles: { cellPadding: 4, minCellHeight: 20 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Intercorrência Details
    if (hasIncident) {
      doc.setFontSize(14);
      doc.text('Intercorrência Registrada', 14, currentY);
      currentY += 8;

      const residentNames = residents
        .filter(r => selectedResidentIds.includes(r.id))
        .map(r => r.name)
        .join(', ');

      doc.setFontSize(10);
      autoTable(doc, {
        startY: currentY,
        head: [['Tipo', 'Residentes', 'Descrição', 'Conduta']],
        body: [
          [
            incidentType.toUpperCase(),
            residentNames || 'Nenhum selecionado',
            description || '-',
            conduct || '-'
          ]
        ],
        headStyles: { fillColor: [220, 38, 38] },
        styles: { cellPadding: 4, minCellHeight: 20 }
      });
    }

    doc.save(`plantao_${shift}_${dateStr.replace(/\//g, '-')}.pdf`);
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

    // 1. Save Handover
    const handover: ShiftHandover = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      shift,
      summary,
      pendingTasks,
      shareOnMural,
      professionalName: 'Supervisor de Turno' // Placeholder
    };
    onSaveHandover(handover);

    let incidentMsg = '';

    // 2. Save Incident if applied
    if (hasIncident) {
      const incident: IncidentReport = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        residentIds: selectedResidentIds,
        type: incidentType,
        description,
        conduct,
        shareOnMural,
        professionalName: 'Equipe de Enfermagem' // Placeholder
      };
      onSaveIncident(incident);

      const residentNames = residents
        .filter(r => selectedResidentIds.includes(r.id))
        .map(r => r.name)
        .join(', ');
      
      incidentMsg = `\n🚨 INTERCORRÊNCIA [${incidentType.toUpperCase()}]: Residentes: ${residentNames}. Descrição: ${description}. Conduta: ${conduct}`;
    }

    // 3. Post to Mural
    if (shareOnMural) {
      // Post Shift Handover
      onPostToMural({
        author: `Relatório de Plantão - ${shift.toUpperCase()}`,
        text: `🔄 Resumo do Turno Adicionado`,
        detailedContent: `RESUMO DO TURNO:\n${summary}\n\nPENDÊNCIAS:\n${pendingTasks || 'Nenhuma'}`
      });

      // Post Incident separately for better visibility if it exists
      if (hasIncident) {
        const residentNames = residents
          .filter(r => selectedResidentIds.includes(r.id))
          .map(r => r.name)
          .join(', ');
        
        onPostToMural({
          author: `🚨 INTERCORRÊNCIA [${incidentType.toUpperCase()}]`,
          text: `🚩 Nova intercorrência registrada para: ${residentNames}`,
          detailedContent: `Descrição:\n${description}\n\nConduta:\n${conduct}`,
        });
      }
    }

    // Reset State
    setSummary('');
    setPendingTasks('');
    setHasIncident(false);
    setSelectedResidentIds([]);
    setDescription('');
    setConduct('');
    
    alert('Plantão (e intercorrências) registrados com sucesso!');
  };

  const getIncidentsForDate = (dateStr: string) => {
    return residents.flatMap(r => (r.incidents || []).map(inc => ({ ...inc, residentName: r.name })))
      .filter(inc => new Date(inc.timestamp).toISOString().split('T')[0] === dateStr);
  };

  const getHandoversForDate = (dateStr: string) => {
    return handovers.filter(h => new Date(h.timestamp).toISOString().split('T')[0] === dateStr);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/10">
      {/* Header Selector */}
      <div className="bg-white border-b px-8 py-6 flex items-center justify-between shadow-sm">
        <div className="flex gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="text-[#004c99]" size={24} />
            <h2 className="text-sm font-black uppercase text-gray-800 tracking-widest">
              Passagem de Plantão Diária
            </h2>
          </div>
          <div className="flex gap-2 ml-4">
            <button 
              onClick={() => setViewMode('registrar')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'registrar' ? 'bg-[#004c99] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              Registrar
            </button>
            <button 
              onClick={() => setViewMode('historico')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'historico' ? 'bg-[#004c99] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <History size={14} /> Histórico
            </button>
          </div>
        </div>

        {viewMode === 'registrar' && (
          <div className="flex items-center gap-4">
           <div className={`p-4 rounded-2xl flex items-center gap-3 transition-all border ${shareOnMural ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
              <Megaphone size={18} />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">Compartilhar no Mural</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] font-bold uppercase">{shareOnMural ? 'Ativado' : 'Desativado'}</span>
                  <button 
                    onClick={() => setShareOnMural(!shareOnMural)}
                    className={`w-8 h-4 rounded-full relative transition-all ${shareOnMural ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${shareOnMural ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
           </div>

          <button 
             onClick={handleExportPDF}
             className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center gap-2 border"
           >
             <Download size={18} /> Exportar PDF
           </button>
        </div>
        )}
        {viewMode === 'historico' && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Data:</label>
            <input 
              type="date" 
              value={selectedHistoryDate}
              onChange={e => setSelectedHistoryDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#004c99]/10"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {viewMode === 'historico' ? (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <h3 className="text-sm font-black uppercase text-gray-800 tracking-widest mb-6 flex items-center gap-2">
                <Clock size={16} className="text-[#004c99]"/> Plantões Registrados
              </h3>
              <div className="space-y-4">
                {getHandoversForDate(selectedHistoryDate).length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold uppercase py-4 text-center">Nenhum plantão registrado nesta data.</p>
                ) : (
                  getHandoversForDate(selectedHistoryDate).map(h => (
                    <div key={h.id} className="p-4 border rounded-2xl bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black bg-[#004c99] text-white px-2 py-1 rounded-lg uppercase">
                          Turno: {h.shift}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(h.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {h.professionalName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mb-2"><strong>Resumo:</strong> {h.summary}</p>
                      {h.pendingTasks && <p className="text-xs text-red-600 font-medium"><strong>Pendências:</strong> {h.pendingTasks}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border shadow-sm border-red-100">
              <h3 className="text-sm font-black uppercase text-red-600 tracking-widest mb-6 flex items-center gap-2">
                <AlertTriangle size={16} /> Intercorrências Registradas
              </h3>
              <div className="space-y-4">
                {getIncidentsForDate(selectedHistoryDate).length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold uppercase py-4 text-center">Nenhuma intercorrência registrada nesta data.</p>
                ) : (
                  getIncidentsForDate(selectedHistoryDate).map(inc => (
                    <div key={inc.id} className="p-4 border border-red-200 rounded-2xl bg-red-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black bg-red-600 text-white px-2 py-1 rounded-lg uppercase">
                          {inc.type}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(inc.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {inc.residentName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mb-2"><strong>Fatos:</strong> {inc.description}</p>
                      {inc.conduct && <p className="text-xs text-gray-600 font-medium"><strong>Conduta:</strong> {inc.conduct}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
            
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
               {['manha', 'tarde', 'noite'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setShift(s as any)}
                    className={`py-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all border ${
                      shift === s 
                        ? 'bg-[#004c99] text-white border-[#004c99] shadow-lg scale-[1.02]' 
                        : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <Clock size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Turno {s}</span>
                  </button>
               ))}
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Relatório de Atividades e Eventos (obrigatório)</label>
                <textarea 
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="Resuma como foi o turno, estado geral dos idosos..."
                  className="w-full p-6 bg-gray-50 border rounded-3xl text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#004c99]/20 transition-all min-h-[150px]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pendências para o próximo turno</label>
                <textarea 
                  value={pendingTasks}
                  onChange={e => setPendingTasks(e.target.value)}
                  placeholder="Medicamentos a chegar, agendamentos confirmados, observações específicas..."
                  className="w-full p-6 bg-gray-50 border rounded-3xl text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#004c99]/20 transition-all min-h-[100px]"
                />
              </div>
            </div>
          </div>

          {/* Intercorrência Toggle */}
          <div className="bg-white p-8 rounded-[40px] border shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className={hasIncident ? "text-red-500" : "text-gray-400"} size={24} />
                <div>
                  <h4 className="text-sm font-black uppercase text-gray-800 tracking-widest">Houve Intercorrência neste plantão?</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-black">Clique no botão ao lado para registrar uma intercorrência</p>
                </div>
              </div>
              <button 
                onClick={() => setHasIncident(!hasIncident)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  hasIncident 
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                    : 'bg-[#004c99] text-white shadow-md hover:bg-blue-800 hover:scale-105'
                }`}
              >
                {hasIncident ? 'Cancelar Intercorrência' : 'Registrar Intercorrência'}
              </button>
            </div>

            {hasIncident && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-8 border-t mt-8 space-y-6"
              >
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Tipo de Ocorrência</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['queda', 'comportamental', 'clinica', 'outros'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setIncidentType(t as any)}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all border ${
                          incidentType === t 
                            ? 'bg-red-600 text-white border-red-600 shadow-sm ring-2 ring-red-600/10' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:border-slate-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Residentes Envolvidos ({selectedResidentIds.length})</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                    {residents.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedResidentIds(prev => 
                          prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                        )}
                        className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border text-center ${
                          selectedResidentIds.includes(r.id) 
                            ? 'bg-red-100 border-red-300 text-red-700 shadow-sm ring-2 ring-red-500/10' 
                            : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-white'
                        }`}
                      >
                        {r.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Descrição dos Fatos</label>
                    <textarea 
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Relate detalhadamente o ocorrido..."
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-red-100 transition-all min-h-[120px]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Condutas Tomadas</label>
                    <textarea 
                      value={conduct}
                      onChange={e => setConduct(e.target.value)}
                      placeholder="Ex: Realizada higienização, comunicado enfermeiro responsável..."
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-red-100 transition-all min-h-[120px]"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              id="save-handover-button"
              onClick={handleSaveAll}
              disabled={!summary.trim() || (hasIncident && (!description.trim() || selectedResidentIds.length === 0))}
              className="px-10 py-5 bg-[#004c99] text-white rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 transition-all flex items-center gap-3"
            >
              <Save size={20} /> Finalizar Turno e Salvar Registros
            </button>
          </div>

            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4 mt-8">
              <AlertCircle className="text-blue-600 shrink-0" size={24} />
              <div className="space-y-1">
                <p className="text-xs font-black text-blue-800 uppercase tracking-tight">Registro Unificado</p>
                <p className="text-[11px] text-blue-600 font-medium">As informações deste painel criam um relatório unificado em PDF e, caso ativado, publicam automaticamente no mural.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HandoverTab;

