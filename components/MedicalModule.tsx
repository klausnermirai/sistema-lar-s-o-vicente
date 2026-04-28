import React, { useState } from 'react';
import { Resident, Candidate, Medication, ClinicalProgressEntry, ExamRequest, MuralMessage } from '../types';
import { 
  Stethoscope, 
  Search, 
  User, 
  FileText, 
  Pill, 
  Save, 
  ChevronRight,
  ClipboardList,
  History,
  AlertCircle,
  Activity,
  Heart,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MedicationTab from './MedicationTab';
import { saveAgendaEvent } from '../lib/agendaStore';

interface MedicalModuleProps {
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  candidates?: Candidate[];
  onSaveCandidate?: (candidate: Candidate) => void;
  session?: any;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const MedicalModule: React.FC<MedicalModuleProps> = ({ residents, onSaveResident, candidates = [], onSaveCandidate, session, onPostToMural }) => {
  const [viewMode, setViewMode] = useState<'selection' | 'acolhimento' | 'interna'>('selection');
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [newNote, setNewNote] = useState('');
  const [medicalOpinion, setMedicalOpinion] = useState('');
  const [medicalStatus, setMedicalStatus] = useState<'favoravel' | 'desfavoravel' | undefined>();
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentTime, setNextAppointmentTime] = useState('');

  const [isMedicationModalOpen, setIsMedicationModalOpen] = useState(false);
  const [isProntuarioModalOpen, setIsProntuarioModalOpen] = useState(false);
  const [isFichaTriagemModalOpen, setIsFichaTriagemModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isExamsModalOpen, setIsExamsModalOpen] = useState(false);
  
  const [examTab, setExamTab] = useState<'solicitar' | 'historico'>('solicitar');
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [otherExams, setOtherExams] = useState('');
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [examResultText, setExamResultText] = useState('');

  const COMMON_EXAMS = [
    'Hemograma Completo', 'Glicemia em Jejum', 'Colesterol Total e Frações',
    'Triglicerídeos', 'Ureia e Creatinina', 'TGO e TGP', 'Gama GT',
    'TSH e T4 Livre', 'Sódio e Potássio', 'Vitamina B12 e D3',
    'Urina Tipo I', 'Urocultura', 'Raio-X de Tórax', 'ECG'
  ];

  const handlePrintExams = () => {
    // Generate a simple print view
    const printContent = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="text-align: center; margin-bottom: 20px;">Solicitação de Exames</h2>
        <p><strong>Paciente:</strong> ${selectedPerson?.name}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleDateString()}</p>
        <hr style="margin: 20px 0;" />
        <h3>Exames Solicitados:</h3>
        <ul>
          ${selectedExams.map(ex => `<li>${ex}</li>`).join('')}
        </ul>
        ${otherExams ? `<h3>Outros:</h3><p>${otherExams.replace(/\n/g, '<br/>')}</p>` : ''}
        <br/><br/><br/>
        <div style="text-align: center; margin-top: 50px;">
          <hr style="width: 200px; margin: 0 auto;" />
          <p>Assinatura Médica</p>
        </div>
      </div>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleSaveExamRequest = () => {
    if (!selectedPerson) return;
    const newRequest: ExamRequest = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      doctorName: 'Médico', // placeholder
      exams: selectedExams,
      otherExams,
      status: 'solicitado'
    };
    
    // Check if Candidate or Resident
    const currentExams = ('exams' in selectedPerson ? selectedPerson.exams : (selectedPerson as Resident).exams) || [];
    handleSaveExam([newRequest, ...currentExams]);
    
    // Clear forms and show list
    setSelectedExams([]);
    setOtherExams('');
    setExamTab('historico');
    alert('Exames solicitados e salvos no histórico!');
  };

  const handleSaveExamResult = () => {
    if (!selectedPerson || !activeExamId) return;
    const currentExams = ('exams' in selectedPerson ? selectedPerson.exams : (selectedPerson as Resident).exams) || [];
    
    const updatedExams = currentExams.map(ex => {
      if (ex.id === activeExamId) {
        return {
          ...ex,
          status: 'realizado',
          results: examResultText,
          resultsDate: new Date().toISOString()
        } as ExamRequest;
      }
      return ex;
    });

    handleSaveExam(updatedExams);
    setActiveExamId(null);
    setExamResultText('');
    alert('Resultados salvos com sucesso!');
  };

  const screeningCandidates = candidates.filter(c => c.stage === 'triagem' || c.stage === 'agendamentos');
  
  const filteredList = viewMode === 'acolhimento' 
    ? screeningCandidates.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : residents.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const selectedPerson = viewMode === 'acolhimento' 
    ? screeningCandidates.find(c => c.id === selectedId)
    : residents.find(r => r.id === selectedId);

  const handleSelectPerson = (id: string, name: string) => {
    setSelectedId(id);
    setSearchTerm(name);
    setIsDropdownOpen(false);
    setNewNote('');
    
    if (viewMode === 'acolhimento') {
      const cand = screeningCandidates.find(c => c.id === id);
      setMedicalOpinion(cand?.medicalOpinion || '');
      setMedicalStatus(cand?.medicalStatus);
    }
  };

  const handleSaveNextAppointment = async () => {
    if (nextAppointmentDate && nextAppointmentTime && session?.institutionId && selectedPerson) {
      const isCand = viewMode === 'acolhimento';
      await saveAgendaEvent({
        id: Math.random().toString(36).substr(2, 9),
        title: `Retorno Médico - ${selectedPerson.name}`,
        date: nextAppointmentDate,
        time: nextAppointmentTime,
        description: isCand ? 'Retorno de acolhimento' : 'Retorno de rotina médica',
        professionalName: session?.username || 'Médico',
        professionalRole: 'Médico',
        residentId: selectedPerson.id,
        type: 'consulta_exame',
        institutionId: session.institutionId
      });
    }
  };

  const handleSaveInterna = async () => {
    const resident = selectedPerson as Resident;
    if (!resident || !newNote.trim()) return;

    const entry: ClinicalProgressEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      professionalName: 'Médico',
      crm: 'CRM',
      note: newNote
    };

    const updatedPer = {
      ...(resident.per || { 
        lastUpdated: new Date().toISOString(),
        vitalSignsHistory: [],
        diagnoses: [],
        allergies: '',
        clinicalHistory: '',
        functionalStatus: { mobility: 'deambula', continence: 'continente', consciousness: 'lucido', dependencyLevel: 'independente' }
       }),
      clinicalProgress: [entry, ...(resident.per?.clinicalProgress || [])]
    };

    onSaveResident({ ...resident, per: updatedPer });
    await handleSaveNextAppointment();
    setNewNote('');
    setNextAppointmentDate('');
    setNextAppointmentTime('');
    if (onPostToMural) {
      onPostToMural({
        author: session?.username || 'Médico',
        text: `[Médico] Evolução clínica salva para o residente ${resident.name}.`
      });
    }
    alert('Evolução médica salva com sucesso!');
  };

  const handleSaveAcolhimento = async () => {
    const candidate = selectedPerson as Candidate;
    if (!candidate || !onSaveCandidate) return;
    
    onSaveCandidate({
      ...candidate,
      medicalOpinion,
      medicalStatus
    });
    await handleSaveNextAppointment();
    setNextAppointmentDate('');
    setNextAppointmentTime('');
    alert('Parecer médico salvo com sucesso!');
  };

  const handleUpdateMedication = (meds: Medication[]) => {
    if (!selectedPerson || viewMode !== 'interna') return;
    onSaveResident({ ...(selectedPerson as Resident), medications: meds });
  };

  const handleSaveExam = (updatedExams: ExamRequest[]) => {
    if (!selectedPerson) return;
    if (viewMode === 'interna') {
      onSaveResident({ ...(selectedPerson as Resident), exams: updatedExams });
    } else {
      if (onSaveCandidate) {
        onSaveCandidate({ ...(selectedPerson as Candidate), exams: updatedExams });
      }
    }
  };

  const renderSelection = () => (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-10 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-[#004c99] tracking-tighter uppercase mb-4 text-center">
        Área Médica
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <button 
          onClick={() => { setViewMode('acolhimento'); setSelectedId(null); setSearchTerm(''); }}
          className="flex flex-col items-center gap-6 p-12 bg-white rounded-[40px] border shadow-sm hover:shadow-xl hover:border-blue-200 hover:-translate-y-2 transition-all group"
        >
          <div className="w-24 h-24 bg-blue-50 rounded-[32px] flex items-center justify-center text-[#004c99] group-hover:bg-[#004c99] group-hover:text-white transition-colors">
            <User size={48} />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Consulta de Acolhimento</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">Avaliação de candidatos em triagem</p>
          </div>
        </button>

        <button 
          onClick={() => { setViewMode('interna'); setSelectedId(null); setSearchTerm(''); }}
          className="flex flex-col items-center gap-6 p-12 bg-white rounded-[40px] border shadow-sm hover:shadow-xl hover:border-blue-200 hover:-translate-y-2 transition-all group"
        >
          <div className="w-24 h-24 bg-blue-50 rounded-[32px] flex items-center justify-center text-[#004c99] group-hover:bg-[#004c99] group-hover:text-white transition-colors">
            <Stethoscope size={48} />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Consulta Interna</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">Atendimento aos residentes atuais</p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderConsultation = () => (
    <div className="flex flex-col h-full bg-white rounded-[24px] border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom duration-500 relative">
      {/* Header & Search */}
      <div className="p-4 px-6 border-b bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 relative z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setViewMode('selection')}
            className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#004c99] hover:bg-blue-50 transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
              {viewMode === 'acolhimento' ? 'Acolhimento Médico' : 'Consulta Interna'}
            </h2>
          </div>
        </div>

        <div className="relative w-full md:max-w-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#004c99]" size={16} />
            <input 
              type="text" 
              placeholder={`Buscando ${viewMode === 'acolhimento' ? 'candidato' : 'residente'}...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-blue-100 rounded-xl text-xs font-black text-gray-800 uppercase focus:border-[#004c99] focus:ring-2 focus:ring-blue-50 outline-none transition-all shadow-sm"
            />
          </div>
          
          {isDropdownOpen && filteredList.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar-gray z-50">
              {filteredList.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelectPerson(item.id, item.name)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 text-xs font-bold text-gray-700 uppercase tracking-tight transition-colors border-b last:border-0"
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
          
          {isDropdownOpen && searchTerm.length > 0 && filteredList.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl p-4 text-center text-xs font-bold text-gray-400 uppercase z-50">
              Não encontrado.
            </div>
          )}
        </div>
        
        {/* Overlay do dropdown para permitir o click-away */}
        {isDropdownOpen && (
           <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsDropdownOpen(false)} />
        )}
      </div>

      {/* Editor & Actions */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar-gray bg-slate-50/20 relative z-10 flex flex-col">
        {!selectedPerson ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <Stethoscope size={48} className="text-gray-300 mb-4" />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nenhum paciente selecionado</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full flex flex-col h-full gap-4 animate-in fade-in duration-300">
            {/* Paciente Header (Compacto) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border rounded-2xl shadow-sm shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-50 border border-blue-100 text-[#004c99] font-black text-sm rounded-xl flex items-center justify-center">
                   {selectedPerson.name.charAt(0)}
                 </div>
                 <div>
                   <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">{selectedPerson.name}</h3>
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                     {viewMode === 'interna' ? 'Residente Ativo' : 'Candidato em Triagem'}
                   </p>
                 </div>
               </div>
               
               <div className="flex flex-wrap gap-2">
                  {viewMode === 'acolhimento' && (
                    <button 
                      onClick={() => setIsFichaTriagemModalOpen(true)}
                      className="px-4 py-2 bg-white text-gray-600 border rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <ClipboardList size={14} /> Ficha de Triagem
                    </button>
                  )}
                  {viewMode === 'interna' && (
                    <button 
                      onClick={() => setIsProntuarioModalOpen(true)}
                      className="px-4 py-2 bg-white text-gray-600 border rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <FileText size={14} /> Prontuário
                    </button>
                  )}
                  <button 
                    onClick={() => setIsExamsModalOpen(true)}
                    className="px-4 py-2 bg-white text-purple-700 border-2 border-purple-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-50 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Activity size={14} /> Solicitar Exames
                  </button>
                  {viewMode === 'interna' && (
                    <>
                      <button 
                        onClick={() => setIsMedicationModalOpen(true)}
                        className="px-4 py-2 bg-white text-[#004c99] border-2 border-[#004c99] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-2 shadow-sm"
                      >
                        <Pill size={14} /> Receituário
                      </button>
                      <button 
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-4 py-2 bg-white text-emerald-700 border-2 border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-sm"
                      >
                        <History size={14} /> Consultas Anteriores
                      </button>
                    </>
                  )}
               </div>
            </div>

            {/* Editor Textarea (takes remaining space) */}
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col flex-1">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight mb-3 flex gap-2 items-center shrink-0">
                <ClipboardList size={14} className="text-[#004c99]" />
                {viewMode === 'acolhimento' ? 'Parecer Médico de Admissão' : 'Evolução Clínica Atual'}
              </h4>
               <textarea 
                value={viewMode === 'acolhimento' ? medicalOpinion : newNote}
                onChange={(e) => viewMode === 'acolhimento' ? setMedicalOpinion(e.target.value) : setNewNote(e.target.value)}
                placeholder="Anotações médicas..."
                className="w-full flex-1 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all resize-none leading-relaxed min-h-[200px]"
               />
               
               <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                 {viewMode === 'acolhimento' ? (
                   <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest pl-2">Parecer:</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setMedicalStatus('favoravel')}
                          className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${medicalStatus === 'favoravel' ? 'bg-green-100 text-green-700 shadow-sm border-transparent' : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                          Favorável
                        </button>
                        <button 
                          onClick={() => setMedicalStatus('desfavoravel')}
                          className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${medicalStatus === 'desfavoravel' ? 'bg-red-100 text-red-700 shadow-sm border-transparent' : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                          Desfavorável
                        </button>
                      </div>
                   </div>
                 ) : <div></div>}

                 <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                   <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 p-2 rounded-xl">
                     <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest px-1">Próxima Consulta:</span>
                     <input 
                       type="date" 
                       value={nextAppointmentDate}
                       onChange={e => setNextAppointmentDate(e.target.value)}
                       className="text-xs bg-white border border-blue-200 rounded px-2 py-1 outline-none focus:border-[#004c99]"
                     />
                     <input 
                       type="time" 
                       value={nextAppointmentTime}
                       onChange={e => setNextAppointmentTime(e.target.value)}
                       className="text-xs bg-white border border-blue-200 rounded px-2 py-1 outline-none focus:border-[#004c99]"
                     />
                   </div>

                   <button 
                     onClick={viewMode === 'acolhimento' ? handleSaveAcolhimento : handleSaveInterna}
                     className="px-8 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-blue-800 transition-all flex items-center justify-center gap-2 active:scale-95"
                   >
                     <Save size={14} /> Salvar
                   </button>
                 </div>
               </div>
            </div>
            
            {/* Histórico Recente (Apenas Interna) - Scroll horizontally if needed */}
            {viewMode === 'interna' && (selectedPerson as Resident).per?.clinicalProgress && (selectedPerson as Resident).per!.clinicalProgress!.length > 0 && (
               <div className="shrink-0 bg-white p-4 rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                    <History size={14} /> Histórico Recente
                  </h4>
                  <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar-gray">
                    {(selectedPerson as Resident).per!.clinicalProgress!.slice(0,5).map(entry => (
                       <div key={entry.id} className="min-w-[280px] p-4 bg-gray-50 border rounded-xl flex-shrink-0">
                          <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">{new Date(entry.date).toLocaleDateString()} - {entry.professionalName}</p>
                          <p className="text-xs text-gray-700 font-medium leading-relaxed line-clamp-3">{entry.note}</p>
                       </div>
                    ))}
                  </div>
               </div>
            )}
          </div>
        )}
      </div>

      {/* Prontuário Modal */}
      <AnimatePresence>
        {isProntuarioModalOpen && viewMode === 'interna' && selectedPerson && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsProntuarioModalOpen(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-3xl max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
            >
               <div className="p-8 border-b bg-gray-50 flex items-center justify-between shadow-sm z-10 shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-[#004c99]/10 text-[#004c99] rounded-2xl flex items-center justify-center">
                       <FileText size={24} />
                     </div>
                     <div>
                       <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Resumo Estratégico</h3>
                       <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">{selectedPerson.name}</p>
                     </div>
                  </div>
                  <button onClick={() => setIsProntuarioModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all">
                    <ChevronRight size={24} className="rotate-90" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar-gray space-y-8">
                   {/* Diagnósticos Ativos */}
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                       <AlertCircle className="text-red-500" size={16} /> Diagnósticos Ativos
                      </h4>
                      <div className="flex flex-wrap gap-2">
                         {(selectedPerson as Resident).per?.diagnoses?.map((d, i) => (
                           <span key={i} className="px-4 py-2 bg-white text-gray-800 rounded-xl text-xs font-bold uppercase border shadow-sm">
                             {d}
                           </span>
                         ))}
                         {(!(selectedPerson as Resident).per?.diagnoses || (selectedPerson as Resident).per!.diagnoses!.length === 0) && (
                           <span className="text-xs text-gray-400 italic">Nenhum diagnóstico estruturado.</span>
                         )}
                      </div>
                   </div>
                   
                   {/* Alergias */}
                   <div className="space-y-4 pt-4 border-t border-dashed">
                      <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                       <Activity className="text-orange-500" size={16} /> Alergias
                      </h4>
                      <p className="p-5 bg-orange-50/50 text-orange-900 rounded-2xl text-xs font-medium border border-orange-100">
                        {(selectedPerson as Resident).per?.allergies || 'Nenhuma alergia conhecida.'}
                      </p>
                   </div>
                   
                   {/* Sinais Vitais */}
                   <div className="space-y-4 pt-4 border-t border-dashed">
                      <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                       <Heart className="text-red-500" size={16} /> Sinais Vitais Mais Recentes
                      </h4>
                      <div className="bg-white p-6 rounded-[24px] border shadow-sm flex flex-wrap gap-8">
                         {((selectedPerson as Resident).per?.vitalSignsHistory && (selectedPerson as Resident).per!.vitalSignsHistory!.length > 0) ? (
                           <>
                             <div>
                               <p className="text-[9px] font-black text-gray-400 uppercase">PA</p>
                               <p className="text-lg font-black text-gray-900">{(selectedPerson as Resident).per!.vitalSignsHistory![0].paSystolic}/{(selectedPerson as Resident).per!.vitalSignsHistory![0].paDiastolic}</p>
                             </div>
                             <div>
                               <p className="text-[9px] font-black text-gray-400 uppercase">Temp</p>
                               <p className="text-lg font-black text-gray-900">{(selectedPerson as Resident).per!.vitalSignsHistory![0].temperature}°C</p>
                             </div>
                             <div>
                               <p className="text-[9px] font-black text-gray-400 uppercase">Glicemia</p>
                               <p className="text-lg font-black text-gray-900">{(selectedPerson as Resident).per!.vitalSignsHistory![0].hgtValue}</p>
                             </div>
                           </>
                         ) : (
                           <span className="text-xs text-gray-400 italic">Sem registros recentes.</span>
                         )}
                      </div>
                   </div>
  
                   {/* Histórico Clínico */}
                   <div className="space-y-4 pt-4 border-t border-dashed">
                      <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                       <History className="text-blue-500" size={16} /> Antecedentes
                      </h4>
                      <p className="p-6 bg-white rounded-2xl text-xs font-medium text-gray-700 leading-relaxed border shadow-sm">
                        {(selectedPerson as Resident).per?.clinicalHistory || 'Vazio.'}
                      </p>
                   </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Medication Management Modal */}
      <AnimatePresence>
        {isMedicationModalOpen && viewMode === 'interna' && selectedPerson && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-6xl h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b bg-[#004c99] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Pill size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter">Receituário e Medicação</h3>
                    <p className="text-[10px] font-bold uppercase opacity-80">{selectedPerson.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsMedicationModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                  <ChevronRight size={28} className="rotate-90" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/50">
                <MedicationTab 
                  resident={selectedPerson as Resident}
                  onUpdateMedications={handleUpdateMedication}
                />
              </div>
              <div className="p-8 border-t bg-white flex justify-end shrink-0">
                <button 
                  onClick={() => setIsMedicationModalOpen(false)}
                  className="px-10 py-4 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-2"
                >
                  <Save size={16} /> Concluído e Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exames Modal */}
      <AnimatePresence>
        {isExamsModalOpen && selectedPerson && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsExamsModalOpen(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b bg-purple-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-purple-900 uppercase tracking-tighter">Exames</h3>
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">{selectedPerson.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsExamsModalOpen(false)} className="p-3 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-2xl transition-all">
                  <ChevronRight size={24} className="rotate-90" />
                </button>
              </div>

              <div className="flex px-6 pt-4 border-b bg-slate-50 gap-4 shrink-0">
                <button
                  onClick={() => setExamTab('solicitar')}
                  className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${examTab === 'solicitar' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  Solicitar Exame
                </button>
                <button
                  onClick={() => setExamTab('historico')}
                  className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${examTab === 'historico' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  Histórico / Resultados
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-gray bg-white">
                {examTab === 'solicitar' ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Exames de Rotina (Selecione)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                        {COMMON_EXAMS.map(exam => (
                          <label key={exam} className="flex items-center gap-3 p-3 bg-gray-50 border rounded-xl hover:bg-white hover:border-purple-200 hover:shadow-sm cursor-pointer transition-all">
                            <input 
                              type="checkbox" 
                              checked={selectedExams.includes(exam)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedExams([...selectedExams, exam]);
                                else setSelectedExams(selectedExams.filter(x => x !== exam));
                              }}
                              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-600"
                            />
                            <span className="text-xs font-bold text-gray-700">{exam}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Outros Exames / Observações</h4>
                      <textarea 
                        value={otherExams}
                        onChange={(e) => setOtherExams(e.target.value)}
                        placeholder="Digite outros exames específicos..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium outline-none focus:bg-white focus:ring-4 focus:ring-purple-50 focus:border-purple-200 min-h-[120px] resize-none transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(('exams' in selectedPerson ? selectedPerson.exams : (selectedPerson as Resident).exams) || []).map((req: ExamRequest) => (
                      <div key={req.id} className="border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className={`inline-block px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest mb-2 ${req.status === 'realizado' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {req.status === 'realizado' ? 'Resultado Inserido' : 'Aguardando Resultado'}
                            </span>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                              Solicitado em {new Date(req.date).toLocaleDateString()}
                            </p>
                          </div>
                          {req.status === 'solicitado' && activeExamId !== req.id && (
                            <button 
                              onClick={() => setActiveExamId(req.id)}
                              className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-colors"
                            >
                              Inserir Resultado
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          {req.exams.length > 0 && <p className="text-sm font-medium text-gray-800"><strong>Rotina:</strong> {req.exams.join(', ')}</p>}
                          {req.otherExams && <p className="text-sm font-medium text-gray-800"><strong>Outros:</strong> {req.otherExams}</p>}
                        </div>

                        {req.status === 'realizado' && (
                          <div className="mt-4 p-4 bg-green-50/50 border border-green-100 rounded-xl">
                            <p className="text-[10px] font-black uppercase text-green-700 tracking-widest mb-2">Resultado inserido em {req.resultsDate ? new Date(req.resultsDate).toLocaleDateString() : 'N/A'}</p>
                            <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{req.results}</p>
                          </div>
                        )}

                        {activeExamId === req.id && (
                          <div className="mt-4 p-4 bg-gray-50 border border-purple-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-[10px] font-black text-purple-900 uppercase tracking-widest mb-2">Novo Resultado</h4>
                            <textarea 
                              value={examResultText}
                              onChange={(e) => setExamResultText(e.target.value)}
                              placeholder="Digite o resultado ou laudo do exame aqui..."
                              className="w-full p-4 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 min-h-[100px] resize-none mb-3"
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setActiveExamId(null); setExamResultText(''); }} className="px-4 py-2 text-gray-400 hover:bg-gray-100 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                Cancelar
                              </button>
                              <button onClick={handleSaveExamResult} disabled={!examResultText.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                                Salvar Resultado
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {(('exams' in selectedPerson ? selectedPerson.exams : (selectedPerson as Resident).exams) || []).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 opacity-50">
                        <Activity size={48} className="text-gray-300 mb-4" />
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Nenhum exame solicitado</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {examTab === 'solicitar' && (
                <div className="p-6 border-t bg-slate-50 flex justify-end shrink-0 gap-3">
                  <button 
                    onClick={handlePrintExams}
                    disabled={selectedExams.length === 0 && !otherExams.trim()}
                    className="px-6 py-3 bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <FileText size={16} /> Imprimir Apenas
                  </button>
                  <button 
                    onClick={handleSaveExamRequest}
                    disabled={selectedExams.length === 0 && !otherExams.trim()}
                    className="px-8 py-3 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-purple-700 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save size={16} /> Salvar Solicitação
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ficha de Triagem Modal */}
      <AnimatePresence>
        {isFichaTriagemModalOpen && selectedPerson && viewMode === 'acolhimento' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsFichaTriagemModalOpen(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-3xl max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
            >
               <div className="p-6 border-b bg-gray-50 flex items-center justify-between shadow-sm z-10 shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-gray-200 text-gray-500 rounded-2xl flex items-center justify-center">
                       <ClipboardList size={24} />
                     </div>
                     <div>
                       <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Ficha de Triagem (Resumo)</h3>
                       <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">{selectedPerson.name}</p>
                     </div>
                  </div>
                  <button onClick={() => setIsFichaTriagemModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all">
                    <ChevronRight size={24} className="rotate-90" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar-gray text-sm text-gray-700 space-y-6">
                 <div>
                   <h4 className="font-bold border-b pb-2 mb-2">Dados Básicos</h4>
                   <p><strong>Idade:</strong> {selectedPerson.age} | <strong>Sexo:</strong> {selectedPerson.gender}</p>
                   <p><strong>Motivo da Solicitação:</strong> {(selectedPerson as Candidate).requestDescription || 'Não informado'}</p>
                 </div>
                 
                 {(selectedPerson as Candidate).nursingScreening && (
                   <>
                     <div>
                       <h4 className="font-bold border-b pb-2 mb-2">Geral (Enfermagem)</h4>
                       <p><strong>Mobilidade:</strong> {(selectedPerson as Candidate).nursingScreening?.functionalAssessment?.mobility}</p>
                       <p><strong>Grau de Dependência:</strong> {(selectedPerson as Candidate).nursingScreening?.functionalAssessment?.dependencyLevel}</p>
                       <p><strong>Estado de Consciência:</strong> {(selectedPerson as Candidate).nursingScreening?.functionalAssessment?.consciousness}</p>
                       <p><strong>Integridade da Pele:</strong> {(selectedPerson as Candidate).nursingScreening?.physicalExam?.skinIntegrity}</p>
                     </div>
                     <div>
                       <h4 className="font-bold border-b pb-2 mb-2">Condições Médicas / Histórico</h4>
                       <p><strong>Comorbidades:</strong> {((selectedPerson as Candidate).nursingScreening?.clinicalHistory?.comorbidities || []).join(', ') || 'Nenhuma informada'}</p>
                       <p><strong>Alergias:</strong> {(selectedPerson as Candidate).nursingScreening?.clinicalHistory?.allergies}</p>
                       <p><strong>Cirurgias:</strong> {(selectedPerson as Candidate).nursingScreening?.clinicalHistory?.surgeries}</p>
                     </div>
                     <div>
                       <h4 className="font-bold border-b pb-2 mb-2">Sinais Vitais na Triagem</h4>
                       <p><strong>PA:</strong> {(selectedPerson as Candidate).nursingScreening?.vitalSigns?.paSystolic}/{(selectedPerson as Candidate).nursingScreening?.vitalSigns?.paDiastolic} | <strong>HGT:</strong> {(selectedPerson as Candidate).nursingScreening?.vitalSigns?.hgtValue}</p>
                     </div>
                   </>
                 )}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Consultas Anteriores Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && viewMode === 'interna' && selectedPerson && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsHistoryModalOpen(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
            >
               <div className="p-6 border-b bg-emerald-50 flex items-center justify-between shadow-sm z-10 shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                       <History size={24} />
                     </div>
                     <div>
                       <h3 className="text-xl font-black text-emerald-900 uppercase tracking-tighter">Consultas Anteriores</h3>
                       <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest">{selectedPerson.name}</p>
                     </div>
                  </div>
                  <button onClick={() => setIsHistoryModalOpen(false)} className="p-3 text-emerald-600 hover:bg-emerald-100 rounded-2xl transition-all">
                    <ChevronRight size={24} className="rotate-90" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar-gray space-y-6 text-sm text-gray-700">
                  {(selectedPerson as Resident).per?.clinicalProgress && (selectedPerson as Resident).per!.clinicalProgress!.length > 0 ? (
                    (selectedPerson as Resident).per!.clinicalProgress!.map(entry => (
                      <div key={entry.id} className="bg-white border border-gray-200 p-6 rounded-[24px] shadow-sm">
                        <div className="flex justify-between items-center mb-4 border-b pb-4">
                           <div>
                             <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest bg-emerald-50 px-3 py-1 rounded-lg inline-block mb-1">Evolução Clínica</p>
                             <p className="text-xs text-gray-500 font-bold mt-2">
                               {new Date(entry.date).toLocaleDateString()} às {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
                             </p>
                           </div>
                           <div className="text-right">
                             <p className="text-xs font-bold text-gray-800">{entry.professionalName}</p>
                           </div>
                        </div>
                        <p className="text-sm font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">{entry.note}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                      <Stethoscope size={64} className="text-gray-300 mb-6" />
                      <p className="text-sm font-black uppercase text-gray-400 tracking-widest">Nenhuma consulta anterior registrada</p>
                    </div>
                  )}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );

  return (
    <div className="h-[calc(100vh-140px)] w-full max-w-6xl mx-auto p-4 md:p-8">
      {viewMode === 'selection' ? renderSelection() : renderConsultation()}
    </div>
  );
};

export default MedicalModule;
