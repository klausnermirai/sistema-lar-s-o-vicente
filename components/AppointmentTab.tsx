import React, { useState } from 'react';
import { Resident, Appointment, Companion, MuralMessage } from '../types';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  CheckCircle2, 
  X, 
  MessageSquare, 
  ChevronRight,
  Stethoscope,
  ClipboardList,
  AlertCircle,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AppointmentTabProps {
  resident: Resident;
  companions: Companion[];
  onUpdateResident: (resident: Resident) => void;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const AppointmentTab: React.FC<AppointmentTabProps> = ({ 
  resident, 
  companions, 
  onUpdateResident,
  onPostToMural
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const initialFormState: Omit<Appointment, 'id' | 'status'> = {
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    location: '',
    type: 'consulta',
    companionId: companions[0]?.id || ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [notes, setNotes] = useState('');

  const handleOpenModal = () => {
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = () => {
    const newAppointment: Appointment = {
      ...formData,
      id: Math.random().toString(36).substr(2, 9),
      status: 'agendado'
    };
    
    const updatedAppointments = [...(resident.appointments || []), newAppointment];
    onUpdateResident({ ...resident, appointments: updatedAppointments });
    setIsModalOpen(false);
  };

  const handleCompleteAppointment = () => {
    if (!selectedAppointment) return;

    const updatedAppointments = (resident.appointments || []).map(app => 
      app.id === selectedAppointment.id 
        ? { ...app, status: 'realizado' as const, notes } 
        : app
    );

    const newProgress = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      professionalName: `Retorno de ${selectedAppointment.type === 'consulta' ? 'Consulta Externa' : 'Exame Externo'}`,
      note: `Local: ${selectedAppointment.location}\nRelatório: ${notes}`
    };

    const currentPer = resident.per || {
      lastUpdated: new Date().toISOString(),
      vitalSignsHistory: [],
      diagnoses: [],
      allergies: '',
      clinicalHistory: '',
      functionalStatus: { mobility: '', continence: '', consciousness: '', dependencyLevel: '' }
    };

    const updatedPer = {
      ...currentPer,
      lastUpdated: new Date().toISOString(),
      clinicalProgress: [newProgress, ...(currentPer.clinicalProgress || [])]
    };

    onUpdateResident({ ...resident, appointments: updatedAppointments, per: updatedPer });

    // Post to Mural
    onPostToMural({
      author: 'Sistema de Cuidados Clínicos',
      text: `Pós-${selectedAppointment.type === 'consulta' ? 'Consulta' : 'Exame'} - ${resident.name}`,
      detailedContent: `Local: ${selectedAppointment.location}\nEspecialidade: ${selectedAppointment.specialty || 'N/A'}\n\nConclusões / Anotações:\n${notes}`
    });

    setIsNotesModalOpen(false);
    setSelectedAppointment(null);
    setNotes('');
  };

  const sortedAppointments = [...(resident.appointments || [])].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="p-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
            <Calendar className="text-[#004c99]" size={24} />
            Agendamentos Médicos e Exames
          </h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Planejamento de consultas externas e acompanhamentos
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleOpenModal}
            className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl flex items-center gap-2"
          >
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Próximos Agendamentos */}
        <div className="space-y-4">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Próximos Compromissos</h4>
          {sortedAppointments.filter(app => app.status === 'agendado').length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
               <Calendar className="text-gray-200 mx-auto mb-3" size={40} />
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum agendamento futuro</p>
            </div>
          ) : (
            sortedAppointments.filter(app => app.status === 'agendado').map(app => (
              <div key={app.id} className="bg-white border rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase tracking-widest bg-blue-100 text-[#004c99]">
                  {app.type}
                </div>
                
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex flex-col items-center justify-center text-[#004c99] border border-blue-100">
                    <span className="text-[10px] font-black uppercase leading-none">{new Date(app.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    <span className="text-2xl font-black leading-none">{new Date(app.date).getDate() + 1}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs font-black text-gray-800 uppercase tracking-tight">
                      <Clock size={14} className="text-blue-500" />
                      {app.time}h
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mt-1">
                      <MapPin size={14} className="text-gray-400" />
                      {app.location} {app.specialty ? `- ${app.specialty}` : ''} {app.professional ? `(${app.professional})` : ''}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 bg-blue-50/50 w-fit px-2 py-1 rounded-lg">
                      <User size={12} />
                      Acompanhante: {
                        app.companionId === 'familiar' ? 'Familiar' :
                        app.companionId === 'familia_responsavel' ? 'Responsabilidade da Família' :
                        companions.find(c => c.id === app.companionId)?.name || 'Não definido'
                      }
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 justify-center">
                    <button 
                      onClick={() => {
                        setSelectedAppointment(app);
                        setIsNotesModalOpen(true);
                      }}
                      className="p-3 bg-green-50 text-green-600 rounded-2xl hover:bg-green-100 transition-all border border-green-100"
                      title="Marcar como realizado"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Histórico Recente */}
        <div className="space-y-4">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Histórico de Atendimento</h4>
          {sortedAppointments.filter(app => app.status === 'realizado').length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
               <ClipboardList className="text-gray-200 mx-auto mb-3" size={40} />
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum atendimento realizado</p>
            </div>
          ) : (
            sortedAppointments.filter(app => app.status === 'realizado').reverse().map(app => (
              <div key={app.id} className="bg-gray-50/50 border rounded-[32px] p-6 shadow-sm grayscale hover:grayscale-0 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{app.type} realizado</span>
                    <h5 className="text-xs font-black text-gray-800 uppercase mt-1">{new Date(app.date).toLocaleDateString('pt-BR')} - {app.location} {app.specialty ? `- ${app.specialty}` : ''}</h5>
                  </div>
                  <CheckCircle2 size={16} className="text-green-500" />
                </div>
                
                {app.notes && (
                  <div className="bg-white p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare size={14} className="text-blue-400" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações Compartilhadas</span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium italic">"{app.notes}"</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl flex flex-col">
            <div className="p-8 border-b bg-[#004c99] text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Novo Agendamento</h3>
                  <p className="text-[10px] font-bold uppercase opacity-80">Planejamento de rotina médica</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={28} /></button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Data</label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Hora</label>
                  <input 
                    type="time" 
                    value={formData.time}
                    onChange={e => setFormData({...formData, time: e.target.value})}
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Local (Consultório / Laboratório)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Clínica Santa Maria"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Especialidade / Exame</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Cardiologia"
                    value={formData.specialty || ''}
                    onChange={e => setFormData({...formData, specialty: e.target.value})}
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Médico / Profissional</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Dr. João"
                    value={formData.professional || ''}
                    onChange={e => setFormData({...formData, professional: e.target.value})}
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Tipo</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:bg-white transition-all appearance-none"
                  >
                    <option value="consulta">Consulta</option>
                    <option value="retorno">Retorno</option>
                    <option value="exame">Exame</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Acompanhante</label>
                  <select 
                    value={formData.companionId}
                    onChange={e => setFormData({...formData, companionId: e.target.value})}
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:bg-white transition-all appearance-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="familiar">Familiar</option>
                    <option value="familia_responsavel">Responsabilidade da Família</option>
                    <optgroup label="Acompanhantes Cadastrados">
                      {companions.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-8 border-t bg-gray-50 flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400">Cancelar</button>
              <button 
                onClick={handleSaveAppointment}
                className="flex-1 py-4 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-800 transition-all"
              >
                Confirmar Agendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Notas Pós-Consulta */}
      {isNotesModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl flex flex-col">
            <div className="p-8 border-b bg-green-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Relatório do Atendimento</h3>
                  <p className="text-[10px] font-bold uppercase opacity-80">Compartilhamento de informações</p>
                </div>
              </div>
              <button onClick={() => setIsNotesModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={28} /></button>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
                <AlertCircle className="text-blue-600 shrink-0" size={20} />
                <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
                  O comentário inserido abaixo será publicado automaticamente no mural da instituição para ciência de toda a equipe.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Resultado / Prescrições / Recomendações</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Dr. solicitou exames de sangue para próxima semana. Manter mesma dosagem do Enalapril."
                  className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none focus:bg-white transition-all min-h-[150px]"
                />
              </div>
            </div>

            <div className="p-8 border-t bg-gray-50 flex gap-4">
              <button onClick={() => setIsNotesModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400">Pular Notas</button>
              <button 
                onClick={handleCompleteAppointment}
                disabled={!notes.trim()}
                className="flex-1 py-4 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} /> Salvar e Compartilhar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentTab;
