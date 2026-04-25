import React, { useState } from 'react';
import { Resident, Medication, ClinicalProgressEntry } from '../types';
import { 
  Stethoscope, 
  Search, 
  User, 
  FileText, 
  Pill, 
  Plus, 
  Save, 
  Printer, 
  ChevronRight,
  ClipboardList,
  History,
  AlertCircle,
  Activity,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import MedicationTab from './MedicationTab';

interface MedicalModuleProps {
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
}

const MedicalModule: React.FC<MedicalModuleProps> = ({ residents, onSaveResident }) => {
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'prontuario' | 'receituario' | 'evolucao'>('prontuario');
  const [isMedicationModalOpen, setIsMedicationModalOpen] = useState(false);
  
  // State for new medical note
  const [newNote, setNewNote] = useState('');
  
  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedResident = residents.find(r => r.id === selectedResidentId);

  const handleAddEvolution = () => {
    if (!selectedResident || !newNote.trim()) return;

    const entry: ClinicalProgressEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      professionalName: 'Dr. Lucas Ribeiro',
      crm: 'CRM/SP 123456',
      note: newNote
    };

    const updatedPer = {
      ...(selectedResident.per || { 
        lastUpdated: new Date().toISOString(),
        vitalSignsHistory: [],
        diagnoses: [],
        allergies: '',
        clinicalHistory: '',
        functionalStatus: { mobility: 'deambula', continence: 'continente', consciousness: 'lucido', dependencyLevel: 'independente' }
       }),
      clinicalProgress: [entry, ...(selectedResident.per?.clinicalProgress || [])]
    };

    onSaveResident({ ...selectedResident, per: updatedPer });
    setNewNote('');
    alert('Evolução médica salva com sucesso!');
  };

  const handleUpdateMedication = (meds: Medication[]) => {
    if (!selectedResident) return;
    onSaveResident({ ...selectedResident, medications: meds });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500 p-2">
      {/* Residents Sidebar */}
      <div className="w-80 bg-white border border-gray-200 rounded-[40px] shadow-sm flex flex-col overflow-hidden shrink-0">
        <div className="p-6 border-b bg-gray-50/50">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Escolha o Residente</h3>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filteredResidents.map(resident => (
            <button
              key={resident.id}
              onClick={() => setSelectedResidentId(resident.id)}
              className={`w-full p-4 rounded-[28px] flex items-center gap-4 transition-all ${
                selectedResidentId === resident.id 
                  ? 'bg-[#004c99] text-white shadow-xl' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border-2 ${
                selectedResidentId === resident.id ? 'bg-white/20 border-white/40' : 'bg-blue-50 border-blue-100 text-[#004c99]'
              }`}>
                {resident.name.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-tight">{resident.name.split(' ')[0]}</p>
                <p className={`text-[10px] ${selectedResidentId === resident.id ? 'text-white/60' : 'text-gray-400'}`}>
                  Quarto {resident.room}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Medical View */}
      <div className="flex-1 bg-white border border-gray-200 rounded-[40px] shadow-sm flex flex-col overflow-hidden relative">
        {!selectedResidentId ? (
          <div className="flex flex-col items-center justify-center h-full p-20 text-center">
            <div className="p-8 bg-blue-50 rounded-[40px] text-[#004c99] mb-6">
              <Stethoscope size={64} />
            </div>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Área Médica Exclusiva</h3>
            <p className="max-w-md text-xs text-gray-400 font-bold uppercase tracking-widest mt-2 leading-relaxed">
              Inicie um atendimento selecionando um residente ao lado para acesso ao prontuário completo, evoluções e receituário.
            </p>
          </div>
        ) : (
          <>
            {/* Header com Abas Médicas */}
            <div className="px-8 py-6 border-b bg-gray-50/50 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white shadow-sm border rounded-2xl flex items-center justify-center text-blue-600">
                  <User size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">{selectedResident?.name}</h2>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg uppercase">
                      Prontuário: {selectedResident?.id.slice(-6)}
                    </span>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg uppercase">
                      Convênio: {selectedResident?.healthInsurance || 'Particular'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex bg-white p-1.5 rounded-2xl border shadow-sm self-stretch md:self-auto overflow-x-auto no-scrollbar">
                {[
                  { id: 'prontuario', label: 'Prontuário', icon: FileText },
                  { id: 'receituario', label: 'Receituário', icon: Pill },
                  { id: 'evolucao', label: 'Evolução', icon: ClipboardList }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeTab === tab.id ? 'bg-[#004c99] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/20">
              <AnimatePresence mode="wait">
                {activeTab === 'prontuario' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Diagnósticos e Alergias */}
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-[32px] border shadow-sm">
                           <h4 className="text-xs font-black uppercase text-gray-800 tracking-widest flex items-center gap-2 mb-6">
                            <AlertCircle className="text-red-500" size={18} /> Diagnósticos Ativos
                           </h4>
                           <div className="flex flex-wrap gap-2">
                             {selectedResident?.per?.diagnoses?.map((d, i) => (
                               <span key={i} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase border border-red-100">
                                 {d}
                               </span>
                             ))}
                             {(!selectedResident?.per?.diagnoses || selectedResident.per.diagnoses.length === 0) && (
                               <p className="text-[10px] text-gray-400 uppercase font-black">Nenhum diagnóstico informado</p>
                             )}
                           </div>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border shadow-sm">
                           <h4 className="text-xs font-black uppercase text-gray-800 tracking-widest flex items-center gap-2 mb-6">
                            <Activity className="text-orange-500" size={18} /> Alergias e Restrições
                           </h4>
                           <p className="p-4 bg-orange-50 text-orange-700 rounded-2xl text-xs font-bold leading-relaxed border border-orange-100">
                             {selectedResident?.per?.allergies || 'Nenhuma alergia conhecida relatada.'}
                           </p>
                        </div>
                      </div>

                      {/* Histórico Clínico Resumido */}
                      <div className="bg-white p-8 rounded-[32px] border shadow-sm flex flex-col">
                        <h4 className="text-xs font-black uppercase text-gray-800 tracking-widest flex items-center gap-2 mb-6">
                          <History className="text-blue-500" size={18} /> Antecedentes e História
                        </h4>
                        <div className="bg-gray-50 p-6 rounded-2xl flex-1 text-xs text-gray-600 font-medium leading-loose border">
                          {selectedResident?.per?.clinicalHistory || 'Sem histórico detalhado disponível.'}
                        </div>
                      </div>
                    </div>

                    {/* Sinais Vitais Recentes (Informativo para o médico) */}
                    <div className="bg-white p-8 rounded-[40px] border shadow-sm">
                      <h4 className="text-xs font-black uppercase text-gray-800 tracking-widest flex items-center gap-2 mb-8">
                        <Heart className="text-red-500" size={18} /> Última Verificação Clínica
                      </h4>
                      {selectedResident?.per?.vitalSignsHistory?.[0] ? (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                           <div className="space-y-1">
                             <p className="text-[9px] font-black text-gray-400 uppercase">PA</p>
                             <p className="text-2xl font-black text-gray-900">{selectedResident.per.vitalSignsHistory[0].paSystolic}/{selectedResident.per.vitalSignsHistory[0].paDiastolic} <span className="text-[8px] font-bold">mmHg</span></p>
                           </div>
                           <div className="space-y-1">
                             <p className="text-[9px] font-black text-gray-400 uppercase">FC</p>
                             <p className="text-2xl font-black text-gray-900">{selectedResident.per.vitalSignsHistory[0].fc} <span className="text-[8px] font-bold">BPM</span></p>
                           </div>
                           <div className="space-y-1">
                             <p className="text-[9px] font-black text-gray-400 uppercase">Temp</p>
                             <p className="text-2xl font-black text-gray-900">{selectedResident.per.vitalSignsHistory[0].temperature}° <span className="text-[8px] font-bold">C</span></p>
                           </div>
                           <div className="space-y-1">
                             <p className="text-[9px] font-black text-gray-400 uppercase">Sat O2</p>
                             <p className="text-2xl font-black text-gray-900">{selectedResident.per.vitalSignsHistory[0].spo2}%</p>
                           </div>
                           <div className="space-y-1">
                             <p className="text-[9px] font-black text-gray-400 uppercase">HGT</p>
                             <p className="text-2xl font-black text-gray-900">{selectedResident.per.vitalSignsHistory[0].hgtValue} <span className="text-[8px] font-bold">mg/dL</span></p>
                             <p className="text-[8px] font-black text-[#004c99] uppercase">{selectedResident.per.vitalSignsHistory[0].hgtType}</p>
                           </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 font-bold uppercase italic">Nenhum dado vital recente registrado.</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'receituario' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-between items-center bg-blue-50/50 p-6 rounded-[32px] border border-blue-100">
                       <div>
                          <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight">Gestão Farmacêutica</h4>
                          <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Alteração de dosagens e frequências</p>
                       </div>
                       <div className="flex gap-3">
                        <button 
                          onClick={() => setIsMedicationModalOpen(true)}
                          className="px-6 py-3 bg-white text-[#004c99] border-2 border-[#004c99] rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 transition-all shadow-sm"
                        >
                            <Pill size={16} /> Gerenciar Grade
                        </button>
                        <button className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-800 transition-all shadow-lg active:scale-95">
                            <Printer size={16} /> Gerar Receita PDF
                        </button>
                       </div>
                    </div>

                    <div className="bg-white border rounded-[40px] shadow-sm overflow-hidden divide-y">
                       {selectedResident?.medications?.map((med, idx) => (
                         <div key={idx} className="p-8 hover:bg-slate-50/40 transition-all group">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                               <div className="w-14 h-14 bg-white border-2 border-blue-50 rounded-2xl flex items-center justify-center text-[#004c99] shadow-sm">
                                 <Pill size={24} />
                               </div>
                               <div className="flex-1 space-y-1">
                                  <h5 className="text-base font-black text-gray-900 uppercase tracking-tight">{med.name}</h5>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{med.administrationWay} - {med.dosage}</p>
                               </div>
                               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full md:w-auto">
                                  <div className="bg-gray-50 px-4 py-2 rounded-xl text-center border">
                                     <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Horários</p>
                                     <div className="flex gap-1 justify-center">
                                        {med.hours.map((h, i) => (
                                          <span key={i} className="text-xs font-black text-gray-800">{h}{i < med.hours.length - 1 ? ',' : ''}</span>
                                        ))}
                                     </div>
                                  </div>
                                  <div className="bg-gray-50 px-4 py-2 rounded-xl text-center border">
                                     <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Via</p>
                                     <p className="text-xs font-black text-gray-800 uppercase">{med.administrationWay}</p>
                                  </div>
                                  <button className="col-span-2 px-6 py-2 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100">
                                    Ajustar Dose
                                  </button>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="flex justify-center pt-4">
                      <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-widest transition-all">
                        <Plus size={16} /> Adicionar Nova Medicação
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'evolucao' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-10"
                  >
                    {/* New Evolution Form */}
                    <div className="bg-white p-8 rounded-[40px] border shadow-2xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-focus-within:bg-blue-100 transition-all" />
                       
                       <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                             <Plus size={24} />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Inserir Nova Evolução Médica</h4>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registros de visitas clínicas e condutas</p>
                          </div>
                       </div>

                       <textarea 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Descreva o estado clínico, alterações de conduta e orientações..."
                        className="w-full p-8 bg-gray-50 border-2 border-transparent rounded-[32px] text-sm font-medium outline-none focus:bg-white focus:border-blue-100 transition-all min-h-[250px] mb-6 resize-none leading-relaxed"
                       />

                       <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-6 border-t border-dashed">
                          <div className="flex items-center gap-4 px-6 py-3 bg-gray-100 rounded-2xl border">
                             <User className="text-gray-400" size={18} />
                             <div>
                                <p className="text-xs font-black text-gray-800 uppercase tracking-tight">Assinado como: Dr. Lucas Ribeiro</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase">CRM/SP 123456</p>
                             </div>
                          </div>
                          <button 
                            onClick={handleAddEvolution}
                            disabled={!newNote.trim()}
                            className="w-full md:w-auto px-12 py-5 bg-[#004c99] text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                          >
                            <Save size={20} /> Salvar Evolução
                          </button>
                       </div>
                    </div>

                    {/* Historical Evolutions */}
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-4 italic">
                        Histórico de Evoluções e Condutas Clínicas
                       </h4>
                       <div className="space-y-4">
                          {selectedResident?.per?.clinicalProgress?.map((entry) => (
                            <div key={entry.id} className="bg-white border rounded-[32px] p-8 shadow-sm hover:shadow-md transition-all">
                               <div className="flex justify-between items-start mb-6">
                                  <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 bg-blue-50 rounded-2xl flex flex-col items-center justify-center text-[#004c99]">
                                        <span className="text-[10px] font-black uppercase">{new Date(entry.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                                        <span className="text-xl font-black">{new Date(entry.date).getDate()}</span>
                                     </div>
                                     <div>
                                        <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{entry.professionalName}</p>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{entry.crm || 'CRM não informado'}</p>
                                     </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(entry.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                               <div className="p-6 bg-slate-50 border rounded-2xl text-[11px] text-gray-600 font-medium leading-loose">
                                  {entry.note}
                               </div>
                            </div>
                          ))}
                          {(!selectedResident?.per?.clinicalProgress || selectedResident.per.clinicalProgress.length === 0) && (
                            <div className="text-center py-16 bg-white rounded-[40px] border-2 border-dashed border-gray-100 opacity-50">
                               <ClipboardList className="mx-auto text-gray-300 mb-2" size={48} />
                               <p className="text-xs font-black text-gray-400 uppercase italic">Nenhuma evolução anterior registrada.</p>
                            </div>
                          )}
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Medication Management Modal */}
            {isMedicationModalOpen && selectedResident && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-8 border-b bg-[#004c99] text-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Pill size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter">Gerenciar Receituário</h3>
                        <p className="text-[10px] font-bold uppercase opacity-80">{selectedResident.name}</p>
                      </div>
                    </div>
                    <button onClick={() => setIsMedicationModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                      <ChevronRight size={28} className="rotate-90" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                    <MedicationTab 
                      medications={selectedResident.medications || []}
                      onUpdateMedications={handleUpdateMedication}
                    />
                  </div>
                  <div className="p-8 border-t bg-gray-50 flex justify-end">
                    <button 
                      onClick={() => setIsMedicationModalOpen(false)}
                      className="px-10 py-4 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all"
                    >
                      Concluído
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MedicalModule;
