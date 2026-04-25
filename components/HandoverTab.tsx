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
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HandoverTabProps {
  residents: Resident[];
  onSaveIncident: (incident: IncidentReport) => void;
  onSaveHandover: (handover: ShiftHandover) => void;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const HandoverTab: React.FC<HandoverTabProps> = ({ 
  residents, 
  onSaveIncident, 
  onSaveHandover, 
  onPostToMural 
}) => {
  const [activeMode, setActiveMode] = useState<'intercorrencia' | 'plantao'>('intercorrencia');
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [conduct, setConduct] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentReport['type']>('clinica');
  const [shareOnMural, setShareOnMural] = useState(true);
  
  // Handover state
  const [shift, setShift] = useState<ShiftHandover['shift']>('manha');
  const [summary, setSummary] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');

  const handleSaveIncident = () => {
    if (selectedResidentIds.length === 0 || !description.trim()) return;

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

    if (shareOnMural) {
      const residentNames = residents
        .filter(r => selectedResidentIds.includes(r.id))
        .map(r => r.name)
        .join(', ');

      onPostToMural({
        institutionId: residents[0]?.institutionId || '',
        author: 'Relatório de Intercorrência',
        content: `🚨 INTERCORRÊNCIA [${incidentType.toUpperCase()}]: Residentes envolvidos: ${residentNames}. Descrição: ${description}. Conduta: ${conduct}`,
        category: 'saude' as any,
        priority: 'alta' as any
      });
    }

    // Reset state
    setSelectedResidentIds([]);
    setDescription('');
    setConduct('');
    alert('Intercorrência registrada com sucesso!');
  };

  const handleSaveHandover = () => {
    if (!summary.trim()) return;

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

    if (shareOnMural) {
      onPostToMural({
        institutionId: residents[0]?.institutionId || '',
        author: `Passagem de Plantão - ${shift.toUpperCase()}`,
        content: `🔄 RESUMO DO TURNO: ${summary}. PENDÊNCIAS: ${pendingTasks || 'Nenhuma'}`,
        category: 'equipe' as any,
        priority: 'media' as any
      });
    }

    // Reset
    setSummary('');
    setPendingTasks('');
    alert('Passagem de plantão registrada!');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/10">
      {/* Header Selector */}
      <div className="bg-white border-b px-8 py-6 flex items-center justify-between shadow-sm">
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveMode('intercorrencia')}
            className={`px-6 py-3 rounded-2xl flex items-center gap-3 transition-all ${
              activeMode === 'intercorrencia' 
                ? 'bg-red-50 text-red-600 ring-2 ring-red-100' 
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle size={20} />
            <span className="text-xs font-black uppercase tracking-widest">Intercorrência</span>
          </button>
          <button 
            onClick={() => setActiveMode('plantao')}
            className={`px-6 py-3 rounded-2xl flex items-center gap-3 transition-all ${
              activeMode === 'plantao' 
                ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-100' 
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            <RotateCcw size={20} />
            <span className="text-xs font-black uppercase tracking-widest">Passagem de Plantão</span>
          </button>
        </div>

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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {activeMode === 'intercorrencia' ? (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
            {/* Resident Selection */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Users className="text-red-500" size={24} />
                <h4 className="text-sm font-black uppercase text-gray-800 tracking-widest">Residentes Envolvidos</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {residents.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedResidentIds(prev => 
                      prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                    )}
                    className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border text-center ${
                      selectedResidentIds.includes(r.id) 
                        ? 'bg-red-50 border-red-200 text-red-600' 
                        : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {r.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Incident Details */}
            <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Tipo de Ocorrência</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['queda', 'comportamental', 'clinica', 'outros'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setIncidentType(t as any)}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all border ${
                          incidentType === t 
                            ? 'bg-[#004c99] text-white border-[#004c99]' 
                            : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-white transition-all'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Descrição dos Fatos</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Relate detalhadamente o ocorrido..."
                  className="w-full p-6 bg-gray-50 border rounded-3xl text-sm font-medium outline-none focus:bg-white transition-all min-h-[150px]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Condutas Tomadas / Primeiros Socorros</label>
                <textarea 
                  value={conduct}
                  onChange={e => setConduct(e.target.value)}
                  placeholder="Ex: Realizada higienização, aplicado gelo, comunicado enfermeiro responsável..."
                  className="w-full p-6 bg-gray-50 border rounded-3xl text-sm font-medium outline-none focus:bg-white transition-all min-h-[100px]"
                />
              </div>

              <div className="pt-6 border-t flex justify-end">
                <button 
                  onClick={handleSaveIncident}
                  disabled={selectedResidentIds.length === 0 || !description.trim()}
                  className="px-10 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Save size={18} /> Registrar Intercorrência
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
             <div className="bg-white p-8 rounded-[40px] border shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <RotateCcw className="text-blue-500" size={24} />
                  <h4 className="text-sm font-black uppercase text-gray-800 tracking-widest">Resumo do Turno Atual</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                   {['manha', 'tarde', 'noite'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setShift(s as any)}
                        className={`py-6 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all border ${
                          shift === s 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105' 
                            : 'bg-gray-50 text-gray-400 border-gray-100'
                        }`}
                      >
                        <Clock size={24} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Turno {s}</span>
                      </button>
                   ))}
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Relatório de Atividades e Eventos</label>
                    <textarea 
                      value={summary}
                      onChange={e => setSummary(e.target.value)}
                      placeholder="Resuma como foi o turno, estado geral dos idosos..."
                      className="w-full p-6 bg-gray-50 border rounded-3xl text-sm font-medium outline-none focus:bg-white transition-all min-h-[200px]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Pendências para o próximo turno</label>
                    <textarea 
                      value={pendingTasks}
                      onChange={e => setPendingTasks(e.target.value)}
                      placeholder="Medicamentos a chegar, agendamentos confirmados, observações específicas..."
                      className="w-full p-6 bg-gray-50 border rounded-3xl text-sm font-medium outline-none focus:bg-white transition-all min-h-[120px]"
                    />
                  </div>

                  <div className="pt-6 border-t flex justify-end">
                    <button 
                      onClick={handleSaveHandover}
                      disabled={!summary.trim()}
                      className="px-10 py-4 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 disabled:opacity-30 transition-all flex items-center gap-2"
                    >
                      <CheckCircle2 size={18} /> Finalizar e Passar Plantão
                    </button>
                  </div>
                </div>
             </div>

             <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
                <AlertCircle className="text-blue-600 shrink-0" size={24} />
                <div className="space-y-1">
                  <p className="text-xs font-black text-blue-800 uppercase tracking-tight">Dica de Segurança</p>
                  <p className="text-[11px] text-blue-600 font-medium">Todas as passagens de plantão são arquivadas cronologicamente para auditoria e histórico de cuidados.</p>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HandoverTab;
