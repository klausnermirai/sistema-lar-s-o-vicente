
import React from 'react';
import { 
  Plus, 
  ChevronRight, 
  Search, 
  Clock, 
  UserCheck, 
  Archive, 
  ArrowRight, 
  Save, 
  Trash2, 
  ClipboardList, 
  HeartPulse, 
  Scale, 
  Printer,
  Eye,
  ArrowLeft,
  X,
  FileText,
  Calendar,
  AlertCircle,
  LayoutGrid,
  Info,
  CheckCircle2,
  Phone,
  MapPin,
  Users
} from 'lucide-react';
import { Candidate, CandidateStage, WaitlistPriority, FamilyMemberRecord, Resident, InterviewData } from '../types';
import { INITIAL_CANDIDATE } from '../constants';

interface ScreeningModuleProps {
  candidates: Candidate[];
  onSave: (candidate: Candidate) => void;
  residents: Resident[];
  onAdmit: (candidate: Candidate) => void;
}

const STAGE_THEMES: Record<string, { active: string; text: string; bg: string; border: string; iconBg: string }> = {
  indigo: { active: 'border-indigo-500 bg-indigo-50/50', text: 'text-indigo-600', bg: 'bg-indigo-500', border: 'border-indigo-100', iconBg: 'bg-indigo-50' },
  blue: { active: 'border-blue-500 bg-blue-50/50', text: 'text-blue-600', bg: 'bg-blue-500', border: 'border-blue-100', iconBg: 'bg-blue-50' },
  orange: { active: 'border-orange-500 bg-orange-50/50', text: 'text-orange-600', bg: 'bg-orange-500', border: 'border-orange-100', iconBg: 'bg-orange-50' },
  purple: { active: 'border-purple-500 bg-purple-50/50', text: 'text-purple-600', bg: 'bg-purple-500', border: 'border-purple-100', iconBg: 'bg-purple-50' },
  teal: { active: 'border-teal-500 bg-teal-50/50', text: 'text-teal-600', bg: 'bg-teal-500', border: 'border-teal-100', iconBg: 'bg-teal-50' },
  pink: { active: 'border-pink-500 bg-pink-50/50', text: 'text-pink-600', bg: 'bg-pink-500', border: 'border-pink-100', iconBg: 'bg-pink-50' },
  green: { active: 'border-green-500 bg-green-50/50', text: 'text-green-600', bg: 'bg-green-500', border: 'border-green-100', iconBg: 'bg-green-50' }
};

const ScreeningModule: React.FC<ScreeningModuleProps> = ({ candidates, onSave, residents, onAdmit }) => {
  const [editingCandidate, setEditingCandidate] = React.useState<Candidate | null>(null);
  const [managingCandidate, setManagingCandidate] = React.useState<Candidate | null>(null);
  const [isCreatingSimple, setIsCreatingSimple] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedStage, setSelectedStage] = React.useState<CandidateStage>('agendamentos');

  const stages: { id: CandidateStage; label: string; icon: any; color: string; description: string }[] = [
    { id: 'agendamentos', label: '0. Agendamentos', icon: Calendar, color: 'indigo', description: 'Pessoas aguardando visita ou entrevista inicial.' },
    { id: 'entrevista', label: '1. Entrevistas', icon: ClipboardList, color: 'blue', description: 'Coleta de dados iniciais e visita social.' },
    { id: 'aguardando_vaga', label: '2. Fila de Espera', icon: Clock, color: 'orange', description: 'Aptos aguardando vaga disponível.' },
    { id: 'decisao_diretoria', label: '3. Diretoria', icon: Scale, color: 'purple', description: 'Análise de prioridade em ata de reunião.' },
    { id: 'avaliacao_medica', label: '4. Médico/Parecer', icon: HeartPulse, color: 'teal', description: 'Avaliação clínica de compatibilidade.' },
    { id: 'integracao', label: '5. Integração', icon: Calendar, color: 'pink', description: 'Contratos e tarde de experiência.' }
  ];

  const getStageCandidates = (stage: CandidateStage) => 
    candidates.filter(c => c.stage === stage && c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const archivedCandidates = candidates.filter(c => c.stage === 'arquivado');
  const admittedCandidates = candidates.filter(c => c.stage === 'acolhido');

  const handleSaveSimpleAppointment = (data: Partial<Candidate>) => {
    const newCandidate: Candidate = {
      ...INITIAL_CANDIDATE,
      id: `C${Date.now()}`,
      name: data.name || '',
      phone: data.phone || '',
      address: data.address || '',
      scheduledDate: data.scheduledDate || new Date().toISOString().split('T')[0],
      stage: 'agendamentos',
      createdAt: new Date().toISOString()
    };
    onSave(newCandidate);
    setIsCreatingSimple(false);
    setSelectedStage('agendamentos');
  };

  if (editingCandidate) {
    return (
      <CandidateForm 
        candidate={editingCandidate} 
        onSave={(data) => {
          onSave(data);
          setEditingCandidate(null);
        }} 
        onCancel={() => setEditingCandidate(null)}
        onAdmit={() => {
           onAdmit(editingCandidate);
           setEditingCandidate(null);
        }}
      />
    );
  }

  const activeStageData = stages.find(s => s.id === selectedStage);
  const ActiveIcon = activeStageData?.icon || LayoutGrid;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header Superior */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm no-print gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Fluxo de Triagem</h1>
          <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">Gestão Social e Processos de Admissão</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
           <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <input
                type="text"
                placeholder="Buscar candidato..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-xs font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <button
             onClick={() => setIsCreatingSimple(true)}
             className="w-full sm:w-auto bg-[#004c99] hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all font-black text-xs uppercase"
           >
             <Plus size={18} />
             <span>Novo Agendamento</span>
           </button>
        </div>
      </div>

      {/* Tabs de Status */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 no-print overflow-x-auto pb-2 no-scrollbar">
        {stages.map((stage) => {
          const count = candidates.filter(c => c.stage === stage.id).length;
          const isActive = selectedStage === stage.id;
          const theme = STAGE_THEMES[stage.color];
          const StageIcon = stage.icon;
          
          return (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 group relative overflow-hidden h-full ${
                isActive 
                  ? `${theme.active} border-${stage.color}-500 shadow-lg` 
                  : 'bg-white border-transparent hover:border-gray-200 shadow-sm'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isActive ? `${theme.bg} text-white` : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
                 <StageIcon size={18} />
              </div>
              <div>
                 <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest leading-tight">{stage.label}</div>
                 <div className="text-xl font-black text-gray-900 leading-none mt-0.5">{count}</div>
              </div>
              {isActive && <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bg}`}></div>}
            </button>
          );
        })}
      </div>

      {/* Lista Empilhada */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
         <div className="p-8 border-b bg-gray-50/30 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className={`p-3 rounded-2xl bg-white shadow-sm text-gray-900 border`}>
                  <ActiveIcon size={24} />
               </div>
               <div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                     {activeStageData?.label}
                  </h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                     {activeStageData?.description}
                  </p>
               </div>
            </div>
            <div className="text-right">
               <span className="text-[10px] font-black text-gray-400 uppercase block">Cadastros</span>
               <span className="text-2xl font-black text-[#004c99]">{getStageCandidates(selectedStage).length}</span>
            </div>
         </div>

         <div className="divide-y divide-gray-50">
            {getStageCandidates(selectedStage).map(cand => (
               <div 
                 key={cand.id} 
                 onClick={() => setManagingCandidate(cand)}
                 className="p-6 flex items-center justify-between hover:bg-blue-50/20 cursor-pointer transition-all group"
               >
                  <div className="flex items-center gap-6">
                     <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 font-black text-sm uppercase group-hover:bg-[#004c99] group-hover:text-white transition-all shadow-inner border border-gray-100">
                        {cand.name.charAt(0)}
                     </div>
                     <div className="space-y-1">
                        <div className="text-sm font-black text-gray-900 uppercase tracking-tight">{cand.name}</div>
                        <div className="flex items-center gap-3">
                           <span className="text-[9px] font-bold text-gray-400 uppercase">Ficha: {cand.id.slice(-4)} • Criada em {new Date(cand.createdAt).toLocaleDateString('pt-BR')}</span>
                           {cand.priority && (
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                 cand.priority === 'social' ? 'bg-red-50 text-red-600 border-red-100' : 
                                 cand.priority === 'saude' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                              }`}>
                                 {cand.priority}
                              </span>
                           )}
                           {cand.stage === 'agendamentos' && cand.scheduledDate && (
                             <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase border bg-indigo-50 text-indigo-600 border-indigo-100 flex items-center gap-1">
                               <Clock size={10} /> {new Date(cand.scheduledDate).toLocaleDateString('pt-BR')}
                             </span>
                           )}
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="text-right hidden lg:block border-r pr-6 border-gray-100">
                        <span className="text-[9px] font-black text-gray-300 uppercase block mb-0.5 tracking-widest">Localização/Contato</span>
                        <span className="text-[11px] font-medium text-gray-600 italic max-w-xs truncate block">
                          {cand.address ? cand.address : cand.phone ? cand.phone : 'Sem detalhamento'}
                        </span>
                     </div>
                     <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase text-[#004c99] group-hover:bg-[#004c99] group-hover:text-white group-hover:shadow-lg transition-all">
                        Gerenciar Etapa <ChevronRight size={14} />
                     </button>
                  </div>
               </div>
            ))}
            {getStageCandidates(selectedStage).length === 0 && (
               <div className="p-24 text-center flex flex-col items-center justify-center gap-4 opacity-20">
                  <LayoutGrid size={48} strokeWidth={1} />
                  <span className="text-xs font-black uppercase tracking-widest">Etapa vazia no momento</span>
               </div>
            )}
         </div>
      </div>

      {/* Histórico e Acolhidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 no-print">
         <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between bg-red-50/10">
               <div className="flex items-center gap-3">
                  <Archive size={18} className="text-red-400" />
                  <h3 className="text-xs font-black uppercase text-gray-800 tracking-widest">Candidatos Arquivados</h3>
               </div>
               <span className="text-[10px] font-black bg-white px-3 py-1 rounded-full border border-red-100 text-red-500">{archivedCandidates.length}</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto no-scrollbar">
               {archivedCandidates.map(c => (
                  <div key={c.id} onClick={() => setManagingCandidate(c)} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
                     <div>
                        <div className="text-[11px] font-black text-gray-700 uppercase">{c.name}</div>
                        <div className="text-[9px] font-bold text-red-400 uppercase">{c.archiveReason || 'Desistência'}</div>
                     </div>
                     <Eye size={14} className="text-gray-300" />
                  </div>
               ))}
               {archivedCandidates.length === 0 && <div className="p-10 text-center text-[9px] font-bold uppercase text-gray-300 italic">Sem registros</div>}
            </div>
         </div>

         <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between bg-green-50/10">
               <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-green-500" />
                  <h3 className="text-xs font-black uppercase text-gray-800 tracking-widest">Acolhimentos Recentes</h3>
               </div>
               <span className="text-[10px] font-black bg-white px-3 py-1 rounded-full border border-green-100 text-green-600">{admittedCandidates.length}</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto no-scrollbar">
               {admittedCandidates.map(c => (
                  <div key={c.id} onClick={() => setManagingCandidate(c)} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
                     <div>
                        <div className="text-[11px] font-black text-gray-700 uppercase">{c.name}</div>
                        <div className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Matriculado</div>
                     </div>
                     <Eye size={14} className="text-gray-300" />
                  </div>
               ))}
               {admittedCandidates.length === 0 && <div className="p-10 text-center text-[9px] font-bold uppercase text-gray-300 italic">Sem registros</div>}
            </div>
         </div>
      </div>

      {/* MODAL SIMPLES DE CRIAÇÃO */}
      {isCreatingSimple && (
        <SimpleAppointmentModal 
          onClose={() => setIsCreatingSimple(false)} 
          onSave={handleSaveSimpleAppointment} 
        />
      )}

      {/* MODAL DE GESTÃO DE STATUS */}
      {managingCandidate && (
        <StatusManagementModal 
          candidate={managingCandidate} 
          onClose={() => setManagingCandidate(null)} 
          onSave={(data) => {
            onSave(data);
            setManagingCandidate(null);
          }}
          onEdit={() => {
            setEditingCandidate(managingCandidate);
            setManagingCandidate(null);
          }}
          onOpenFullForm={(cand: Candidate) => {
            setEditingCandidate(cand);
            setManagingCandidate(null);
          }}
          onAdmit={() => {
            onAdmit(managingCandidate);
            setManagingCandidate(null);
          }}
        />
      )}
    </div>
  );
};

// --- MODAL SIMPLES DE AGENDAMENTO ---

function SimpleAppointmentModal({ onClose, onSave }: { onClose: () => void, onSave: (data: any) => void }) {
  const [data, setData] = React.useState({
    name: '',
    address: '',
    phone: '',
    scheduledDate: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name || !data.phone || !data.scheduledDate) return;
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-8 border-b bg-indigo-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl border border-indigo-100">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Novo Agendamento</h3>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Pré-Triagem / Registro Inicial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-900 rounded-xl transition-all"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Nome do Idoso *</label>
            <input 
              required
              autoFocus
              value={data.name} 
              onChange={e => setData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none" 
              placeholder="NOME COMPLETO..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Telefone Contato *</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                <input 
                  required
                  value={data.phone} 
                  onChange={e => setData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none" 
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Data do contato *</label>
              <input 
                type="date"
                required
                value={data.scheduledDate} 
                onChange={e => setData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Endereço da Visita</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
              <input 
                value={data.address} 
                onChange={e => setData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none" 
                placeholder="RUA, NÚMERO, BAIRRO..."
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            Cadastrar Agendamento <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

// --- MODAL DE GESTÃO DE ETAPA ---

function StatusManagementModal({ candidate, onClose, onSave, onEdit, onAdmit, onOpenFullForm }: any) {
  const [data, setData] = React.useState<Candidate>(candidate);
  const [view, setView] = React.useState<'update' | 'archive'>('update');

  const updateField = (field: keyof Candidate, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const advanceStage = (nextStage: CandidateStage) => {
    const updated = { ...data, stage: nextStage };
    onSave(updated);
    onClose();
  };

  const renderStageControls = () => {
    switch (data.stage) {
      case 'agendamentos':
        return (
          <div className="space-y-6">
            <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex flex-col items-center text-center gap-4">
               <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-indigo-600">
                  <Calendar size={32} />
               </div>
               <div className="space-y-1">
                  <p className="text-[12px] font-black text-indigo-900 uppercase tracking-tighter">Visita Social Realizada?</p>
                  <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">Você pode iniciar o preenchimento da ficha agora ou apenas evoluir o status para a próxima etapa.</p>
               </div>
            </div>
            
            <div className="space-y-3">
               <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                  <div className="text-[10px] font-black uppercase text-gray-400">Data do contato:</div>
                  <div className="text-xs font-black text-gray-800">{new Date(data.scheduledDate || '').toLocaleDateString('pt-BR')}</div>
               </div>
               
               <div className="grid grid-cols-1 gap-3 pt-2">
                 <button 
                   onClick={() => onOpenFullForm(data)}
                   className="w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl text-[11px] font-black uppercase shadow-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
                 >
                   <FileText size={18} /> INICIAR ENTREVISTA (ABRIR FICHA)
                 </button>
                 <button 
                   onClick={() => advanceStage('entrevista')}
                   className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                 >
                   <ArrowRight size={20} /> EVOLUIR PARA ENTREVISTA
                 </button>
               </div>
            </div>
          </div>
        );
      case 'entrevista':
        return (
          <div className="space-y-6">
            <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-4">
               <Info className="text-blue-500 shrink-0" size={20} />
               <div className="space-y-1">
                  <p className="text-[11px] font-black text-blue-900 uppercase">Etapa 1: Entrevista Social</p>
                  <p className="text-[10px] text-blue-800 leading-relaxed font-medium">O idoso está em processo de entrevista. Ao finalizar e emitir o parecer, mova para a fila de espera.</p>
               </div>
            </div>
            <button 
              onClick={() => advanceStage('aguardando_vaga')}
              className="w-full py-4 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
            >
              Concluir Entrevista e Ir para Fila <ArrowRight size={16} />
            </button>
          </div>
        );
      case 'aguardando_vaga':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Nível de Prioridade</label>
              <select 
                value={data.priority} 
                onChange={(e) => updateField('priority', e.target.value as WaitlistPriority)}
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-orange-200 outline-none"
              >
                <option value="geral">Geral (Padrão)</option>
                <option value="saude">Saúde (Prioritário)</option>
                <option value="social">Social (Urgência)</option>
              </select>
            </div>
            <button 
              onClick={() => advanceStage('decisao_diretoria')}
              className="w-full py-4 bg-purple-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
            >
              Enviar para Parecer da Diretoria <ArrowRight size={16} />
            </button>
          </div>
        );
      case 'decisao_diretoria':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Relato da Ata / Parecer</label>
              <textarea 
                value={data.boardOpinion} 
                onChange={(e) => updateField('boardOpinion', e.target.value)}
                placeholder="Insira a decisão oficial aqui..."
                className="w-full p-5 border border-gray-200 rounded-2xl text-xs font-medium h-40 focus:ring-2 focus:ring-purple-200 outline-none uppercase"
              />
            </div>
            <button 
              disabled={!data.boardOpinion}
              onClick={() => advanceStage('avaliacao_medica')}
              className="w-full py-4 bg-teal-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Encaminhar para Parecer Médico <ArrowRight size={16} />
            </button>
          </div>
        );
      case 'avaliacao_medica':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => updateField('medicalStatus', 'favoravel')}
                className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${data.medicalStatus === 'favoravel' ? 'bg-green-50 border-green-600 text-green-700' : 'border-gray-100 text-gray-400'}`}
              >
                Apto
              </button>
              <button 
                onClick={() => updateField('medicalStatus', 'desfavoravel')}
                className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${data.medicalStatus === 'desfavoravel' ? 'bg-red-50 border-red-600 text-red-700' : 'border-gray-100 text-gray-400'}`}
              >
                Inapto
              </button>
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Observações Médicas</label>
               <textarea 
                 value={data.medicalOpinion} 
                 onChange={(e) => updateField('medicalOpinion', e.target.value)}
                 className="w-full p-5 border border-gray-200 rounded-2xl text-xs font-medium h-32 focus:ring-2 focus:ring-teal-200 outline-none uppercase"
               />
            </div>
            {data.medicalStatus === 'favoravel' && (
              <button 
                onClick={() => advanceStage('integracao')}
                className="w-full py-4 bg-pink-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-pink-700 transition-all flex items-center justify-center gap-2"
              >
                Seguir para Integração <ArrowRight size={16} />
              </button>
            )}
          </div>
        );
      case 'integracao':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Data Agendada Entrada</label>
                <input 
                  type="date" 
                  value={data.integrationDate} 
                  onChange={(e) => updateField('integrationDate', e.target.value)}
                  className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Assinatura Contrato</label>
                <select 
                  value={data.contractStatus} 
                  onChange={(e) => updateField('contractStatus', e.target.value)}
                  className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase"
                >
                  <option value="pendente">Aguardando Família</option>
                  <option value="assinado">100% Finalizado</option>
                </select>
              </div>
            </div>
            <button 
              onClick={onAdmit}
              disabled={data.contractStatus !== 'assinado'}
              className="w-full py-5 bg-green-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserCheck size={20} /> EFETIVAR MATRÍCULA
            </button>
          </div>
        );
      default:
        return <div className="text-center py-10 font-black uppercase text-gray-300 text-xs italic tracking-widest">Acesso ao Prontuário Concluído</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
       <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          <div className="p-8 border-b flex items-center justify-between bg-gray-50/50">
             <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-white rounded-3xl flex items-center justify-center text-[#004c99] shadow-xl border border-gray-100">
                   <UserCheck size={28} />
                </div>
                <div>
                   <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter leading-tight">{data.name}</h3>
                   <div className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 mt-1 inline-block">Fase: {data.stage.replace('_', ' ')}</div>
                </div>
             </div>
             <button onClick={onClose} className="p-3 text-gray-300 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all"><X size={28} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
             {view === 'update' ? (
               <>
                 {renderStageControls()}
                 <div className="pt-8 border-t flex flex-col gap-4">
                    <button onClick={onEdit} className="w-full py-4 text-[10px] font-black text-[#004c99] bg-blue-50 hover:bg-blue-100 rounded-2xl uppercase flex items-center justify-center gap-3 transition-all">
                       <FileText size={18} /> Acessar Ficha Completa
                    </button>
                    {data.stage !== 'acolhido' && data.stage !== 'arquivado' && (
                       <button onClick={() => setView('archive')} className="w-full py-4 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-2xl uppercase flex items-center justify-center gap-3 transition-all">
                          <Archive size={18} /> Arquivar Candidato
                       </button>
                    )}
                 </div>
               </>
             ) : (
               <div className="space-y-8 py-4">
                  <div className="text-center space-y-3">
                     <AlertCircle size={60} className="text-red-500 mx-auto" strokeWidth={1} />
                     <h4 className="text-lg font-black uppercase text-gray-800 tracking-tighter">Arquivar Processo?</h4>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Motivo do Descarte</label>
                    <select 
                      value={data.archiveReason} 
                      onChange={(e) => updateField('archiveReason', e.target.value)}
                      className="w-full p-5 border border-gray-200 rounded-2xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-red-200 outline-none"
                    >
                      <option value="">Selecione o motivo oficial...</option>
                      <option value="Inapto Saúde">Inapto Clínico (Médico)</option>
                      <option value="Inapto Financeiro">Perfil Financeiro incompatível</option>
                      <option value="Falta de Vagas">Sem vagas na unidade</option>
                      <option value="Desistência Familiar">Familiar Desistiu</option>
                      <option value="Falecimento">Falecimento</option>
                    </select>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => setView('update')} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:bg-gray-100 rounded-2xl">Voltar</button>
                     <button 
                       onClick={() => {
                         const updated = { ...data, stage: 'arquivado' as CandidateStage };
                         onSave(updated);
                       }}
                       disabled={!data.archiveReason}
                       className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl disabled:opacity-50 hover:bg-red-700"
                     >
                       Confirmar Arquivamento
                     </button>
                  </div>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}

// --- NOVO FORMULÁRIO DE CANDIDATO (ENTREVISTA SOCIAL OFICIAL) ---

function CandidateForm({ candidate, onSave, onCancel, onAdmit }: any) {
  const [data, setData] = React.useState<Candidate>(candidate);

  const updateField = (field: keyof Candidate, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const updateInterview = (field: keyof InterviewData, value: any) => {
    setData(prev => ({
      ...prev,
      interview: { ...prev.interview, [field]: value }
    }));
  };

  const addFamilyMember = () => {
    const newMember: FamilyMemberRecord = { id: Date.now().toString(), name: '', kinship: '', age: '', job: '', income: '' };
    updateInterview('familyTable', [...data.interview.familyTable, newMember]);
  };

  const updateFamilyMember = (id: string, field: string, value: string) => {
    const updatedTable = data.interview.familyTable.map(m => m.id === id ? { ...m, [field]: value } : m);
    updateInterview('familyTable', updatedTable);
  };

  const removeFamilyMember = (id: string) => {
    updateInterview('familyTable', data.interview.familyTable.filter(m => m.id !== id));
  };

  const Section = ({ num, title, children }: any) => (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-8">
      <div className="bg-gray-50/50 p-6 border-b flex items-center gap-4">
        <div className="w-10 h-10 bg-[#004c99] text-white rounded-2xl flex items-center justify-center font-black">{num}</div>
        <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99]">{title}</h3>
      </div>
      <div className="p-8">
        {children}
      </div>
    </div>
  );

  const Label = ({ children }: any) => (
    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">
      {children}
    </label>
  );

  const Input = (props: any) => (
    <input 
      {...props} 
      className="w-full p-2 border-b-2 border-gray-100 focus:border-blue-600 outline-none text-xs font-black uppercase bg-transparent" 
    />
  );

  const Choice = ({ label, value, current, onClick }: any) => (
    <button 
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all flex items-center gap-2 ${current === value ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
    >
      <div className={`w-3 h-3 rounded-full border-2 ${current === value ? 'bg-white border-white' : 'bg-transparent border-gray-200'}`}></div>
      {label}
    </button>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Top Sticky Bar */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-gray-200 shadow-xl no-print sticky top-4 z-40">
         <div className="flex items-center gap-4">
            <button onClick={onCancel} className="p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all text-gray-400"><ArrowLeft size={24} /></button>
            <div>
               <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Entrevista Social para Acolhimento ILPI</h2>
               <div className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 inline-block mt-0.5">Módulo Assistência Social</div>
            </div>
         </div>
         <div className="flex gap-3">
            <button onClick={() => window.print()} className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:shadow-md transition-all"><Printer size={18} /> Imprimir Ficha</button>
            <button onClick={() => onSave(data)} className="px-8 py-3 bg-[#004c99] text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-800 shadow-2xl shadow-blue-200 transition-all"><Save size={20} /> Salvar Alterações</button>
         </div>
      </div>

      {/* Identificação */}
      <Section num="1" title="IDENTIFICAÇÃO DO IDOSO">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <Label>Nome Completo</Label>
            <Input value={data.name} onChange={(e: any) => updateField('name', e.target.value)} />
          </div>
          <div>
            <Label>Data de Nascimento</Label>
            <Input type="date" value={data.birthDate} onChange={(e: any) => updateField('birthDate', e.target.value)} />
          </div>
          <div>
            <Label>Idade</Label>
            <Input value={data.age} onChange={(e: any) => updateField('age', e.target.value)} />
          </div>
          <div className="md:col-span-2 flex gap-3">
            <div className="flex-1">
              <Label>Sexo</Label>
              <div className="flex gap-2">
                {['Feminino', 'Masculino', 'Outro'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.gender} onClick={() => updateField('gender', v)} />
                ))}
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Estado Civil</Label>
            <Input value={data.maritalStatus} onChange={(e: any) => updateField('maritalStatus', e.target.value)} />
          </div>
          <div>
            <Label>RG</Label>
            <Input value={data.rg} onChange={(e: any) => updateField('rg', e.target.value)} />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={data.cpf} onChange={(e: any) => updateField('cpf', e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Label>Endereço Atual</Label>
            <Input value={data.address} onChange={(e: any) => updateField('address', e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={data.phone} onChange={(e: any) => updateField('phone', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Responsável Legal */}
      <Section num="2" title="RESPONSÁVEL LEGAL / FAMILIAR">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Label>Nome do Responsável</Label>
            <Input value={data.repName} onChange={(e: any) => updateField('repName', e.target.value)} />
          </div>
          <div>
            <Label>Grau de Parentesco</Label>
            <Input value={data.repKinship} onChange={(e: any) => updateField('repKinship', e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={data.repPhone} onChange={(e: any) => updateField('repPhone', e.target.value)} />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={data.repAddress} onChange={(e: any) => updateField('repAddress', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Composição Familiar e Rede Apoio */}
      <Section num="3" title="COMPOSIÇÃO FAMILIAR E REDE DE APOIO">
        <div className="space-y-8">
          <div>
            <Label>Com quem o idoso reside atualmente?</Label>
            <div className="flex flex-wrap gap-2">
              {['Sozinho', 'Filhos', 'Familiares', 'Outros'].map(v => (
                <Choice key={v} label={v} value={v} current={data.interview.residesWith} onClick={() => updateInterview('residesWith', v)} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label>Possui filhos?</Label>
                <div className="flex gap-2">
                  {['Sim', 'Não'].map(v => (
                    <Choice key={v} label={v} value={v} current={data.interview.hasChildren} onClick={() => updateInterview('hasChildren', v)} />
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <Label>Quantos?</Label>
                <Input value={data.interview.childrenCount} onChange={(e: any) => updateInterview('childrenCount', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Existe cuidador?</Label>
              <div className="flex flex-wrap gap-2">
                {['Não', 'Sim', 'Familiar', 'Profissional'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.hasCaregiver} onClick={() => updateInterview('hasCaregiver', v)} />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            <div>
              <Label>Possui rede de apoio (parentes, vizinhos, serviços)?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.hasSupportNetwork} onClick={() => updateInterview('hasSupportNetwork', v)} />
                ))}
              </div>
            </div>
            <div>
              <Label>Quais?</Label>
              <Input value={data.interview.supportNetworkDetails} onChange={(e: any) => updateInterview('supportNetworkDetails', e.target.value)} />
            </div>
          </div>
        </div>
      </Section>

      {/* Tabela de Composição Familiar */}
      <Section num="4" title="COMPOSIÇÃO FAMILIAR (DETALHAMENTO)">
        <div className="overflow-hidden border rounded-2xl">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Parentesco</th>
                <th className="px-6 py-4">Idade</th>
                <th className="px-6 py-4">Trabalho</th>
                <th className="px-6 py-4">Renda Mensal</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.interview.familyTable.map((m: any) => (
                <tr key={m.id} className="hover:bg-blue-50/10">
                  <td className="px-6 py-3"><Input value={m.name} onChange={(e: any) => updateFamilyMember(m.id, 'name', e.target.value)} /></td>
                  <td className="px-6 py-3"><Input value={m.kinship} onChange={(e: any) => updateFamilyMember(m.id, 'kinship', e.target.value)} /></td>
                  <td className="px-6 py-3 w-20"><Input value={m.age} onChange={(e: any) => updateFamilyMember(m.id, 'age', e.target.value)} /></td>
                  <td className="px-6 py-3"><Input value={m.job} onChange={(e: any) => updateFamilyMember(m.id, 'job', e.target.value)} /></td>
                  <td className="px-6 py-3 w-32"><Input value={m.income} onChange={(e: any) => updateFamilyMember(m.id, 'income', e.target.value)} /></td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => removeFamilyMember(m.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} className="p-4 bg-gray-50/30 text-center">
                  <button onClick={addFamilyMember} className="inline-flex items-center gap-2 text-[10px] font-black uppercase text-[#004c99] hover:bg-white px-6 py-2 rounded-xl border border-dashed border-[#004c99] transition-all">
                    <Plus size={14} /> Adicionar Familiar à Tabela
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Moradia */}
      <Section num="5" title="CONDIÇÕES DE MORADIA">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div>
            <Label>Tipo de Moradia</Label>
            <div className="flex gap-2">
              {['Própria', 'Alugada', 'Cedida'].map(v => (
                <Choice key={v} label={v} value={v} current={data.interview.housingType} onClick={() => updateInterview('housingType', v)} />
              ))}
            </div>
          </div>
          <div>
            <Label>Valor Aluguel</Label>
            <Input value={data.interview.rentValue} onChange={(e: any) => updateInterview('rentValue', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Socioeconômica */}
      <Section num="6" title="SITUAÇÃO SOCIOECONÔMICA">
        <div className="space-y-8">
          <div>
            <Label>Fonte de renda do idoso</Label>
            <div className="flex flex-wrap gap-2">
              {['Aposentadoria', 'Pensão', 'BPC/LOAS', 'Outros'].map(v => (
                <Choice key={v} label={v} value={v} current={data.interview.incomeSource} onClick={() => updateInterview('incomeSource', v)} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <Label>Valor aproximado da renda R$</Label>
              <Input value={data.interview.incomeValue} onChange={(e: any) => updateInterview('incomeValue', e.target.value)} />
            </div>
            <div className="flex items-end gap-4">
               <div className="flex-1">
                  <Label>Possui empréstimo?</Label>
                  <div className="flex gap-2">
                    {['Sim', 'Não'].map(v => (
                      <Choice key={v} label={v} value={v} current={data.interview.hasLoan} onClick={() => updateInterview('hasLoan', v)} />
                    ))}
                  </div>
               </div>
               <div className="flex-1">
                  <Label>Valor R$</Label>
                  <Input value={data.interview.loanValue} onChange={(e: any) => updateInterview('loanValue', e.target.value)} />
               </div>
            </div>
            <div>
              <Label>A família possui condições de custear cuidados?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não', 'Parcialmente'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.canAffordCare} onClick={() => updateInterview('canAffordCare', v)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Saúde */}
      <Section num="7" title="CONDIÇÕES DE SAÚDE">
        <div className="space-y-8">
          <div>
            <Label>Diagnósticos médicos</Label>
            <Input value={data.interview.medicalDiagnoses} onChange={(e: any) => updateInterview('medicalDiagnoses', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            <div>
              <Label>Uso de medicação contínua?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.continuousMedication} onClick={() => updateInterview('continuousMedication', v)} />
                ))}
              </div>
            </div>
            <div>
              <Label>Quais?</Label>
              <Input value={data.interview.medicationDetails} onChange={(e: any) => updateInterview('medicationDetails', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
            <div>
              <Label>Possui acompanhamento médico regular?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.regularMedicalFollowup} onClick={() => updateInterview('regularMedicalFollowup', v)} />
                ))}
              </div>
            </div>
            <div>
              <Label>Apresenta comprometimento cognitivo?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não', 'Em avaliação'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.cognitiveImpairment} onClick={() => updateInterview('cognitiveImpairment', v)} />
                ))}
              </div>
            </div>
            <div>
              <Label>Quais?</Label>
              <Input value={data.interview.cognitiveDetails} onChange={(e: any) => updateInterview('cognitiveDetails', e.target.value)} />
            </div>
          </div>
        </div>
      </Section>

      {/* Grau de Dependência */}
      <Section num="8" title="GRAU DE DEPENDÊNCIA (O idoso realiza sozinho?)">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {[
            { label: 'Higiene pessoal', field: 'depHygiene' },
            { label: 'Alimentação', field: 'depFeeding' },
            { label: 'Locomoção', field: 'depMobility' },
            { label: 'Uso do banheiro', field: 'depBathroom' },
            { label: 'Medicação', field: 'depMedication' }
          ].map(item => (
            <div key={item.field} className="space-y-2">
              <Label>{item.label}</Label>
              <div className="flex flex-col gap-2">
                {item.field === 'depMobility' ? 
                   ['Sim', 'Não', 'Andador', 'Cadeira de Rodas'].map(v => (
                     <Choice key={v} label={v} value={v} current={(data.interview as any)[item.field]} onClick={() => updateInterview(item.field as any, v)} />
                   ))
                : 
                   ['Sim', 'Não'].map(v => (
                     <Choice key={v} label={v} value={v} current={(data.interview as any)[item.field]} onClick={() => updateInterview(item.field as any, v)} />
                   ))
                }
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-dashed border-gray-100 flex items-center gap-6">
           <Label>Necessita de cuidador em tempo integral?</Label>
           <div className="flex gap-2">
             {['Sim', 'Não'].map(v => (
               <Choice key={v} label={v} value={v} current={data.interview.needsFullTimeCare} onClick={() => updateInterview('needsFullTimeCare', v)} />
             ))}
           </div>
        </div>
      </Section>

      {/* Psicossociais */}
      <Section num="9" title="ASPECTOS PSICOSSOCIAIS">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            <div>
              <Label>Há conflitos familiares?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.familyConflicts} onClick={() => updateInterview('familyConflicts', v)} />
                ))}
              </div>
            </div>
            <div>
              <Label>Quais?</Label>
              <Input value={data.interview.conflictDetails} onChange={(e: any) => updateInterview('conflictDetails', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <Label>O idoso concorda com o ingresso na ILPI?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não', 'Parcialmente'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.elderlyAgrees} onClick={() => updateInterview('elderlyAgrees', v)} />
                ))}
              </div>
            </div>
            <div>
              <Label>A família concorda?</Label>
              <div className="flex gap-2">
                {['Sim', 'Não'].map(v => (
                  <Choice key={v} label={v} value={v} current={data.interview.familyAgrees} onClick={() => updateInterview('familyAgrees', v)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Motivo Solicitação */}
      <Section num="10" title="MOTIVO DA SOLICITAÇÃO DO ACOLHIMENTO">
        <textarea 
          value={data.interview.requestReason} 
          onChange={(e) => updateInterview('requestReason', e.target.value)}
          placeholder="Descreva detalhadamente o motivo do pedido..."
          className="w-full p-8 border border-gray-100 rounded-2xl bg-gray-50 text-xs font-black uppercase focus:bg-white transition-all h-60 outline-none leading-relaxed"
        />
      </Section>

      {/* Parecer Social */}
      <Section num="11" title="PARECER SOCIAL">
        <textarea 
          value={data.interview.socialAnalysis} 
          onChange={(e) => updateInterview('socialAnalysis', e.target.value)}
          placeholder="Parecer técnico da Assistente Social..."
          className="w-full p-8 border-l-8 border-l-[#004c99] border-y border-r border-gray-100 rounded-2xl bg-gray-50 text-xs font-black uppercase focus:bg-white transition-all h-60 outline-none leading-relaxed"
        />
      </Section>
    </div>
  );
}

export default ScreeningModule;
