import React, { useState, useEffect } from 'react';
import { AgendaEvent, Resident, InstitutionSettings, MuralMessage } from '../types';
import { loadAgendaEvents, saveAgendaEvent, deleteAgendaEvent } from '../lib/agendaStore';
import { fetchSettings } from '../lib/api';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, BookOpen, User, Search, Trash2, Mail } from 'lucide-react';

interface AgendaModuleProps {
  session: any;
  residents: Resident[];
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const AgendaModule: React.FC<AgendaModuleProps> = ({ session, residents, onPostToMural }) => {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AgendaEvent>>({});
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);

  useEffect(() => {
    if (session?.institutionId) {
      loadAgendaEvents(session.institutionId).then(setEvents).catch(console.error);
      fetchSettings(session.institutionId).then(setSettings).catch(console.error);
    }
  }, [session?.institutionId]);


  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') newDate.setDate(newDate.getDate() - 1);
    else newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') newDate.setDate(newDate.getDate() + 1);
    else newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push(d);
    }
    return days;
  };

  const handleSave = async () => {
    if (!formData.title || !formData.date || !formData.time) {
      alert("Preencha título, data e hora.");
      return;
    }
    const newEvent: AgendaEvent = {
      id: Date.now().toString(),
      institutionId: session.institutionId || 'default-inst',
      title: formData.title,
      date: formData.date,
      time: formData.time,
      description: formData.description || '',
      professionalName: session.username || 'Profissional Logado',
      professionalRole: session.accessLevel || 'Profissional',
      residentId: formData.residentId,
      type: formData.type || 'comum',
      companion: formData.companion || ''
    };

    await saveAgendaEvent(newEvent);
    loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
    
    if (onPostToMural) {
      const resident = residents.find(r => r.id === newEvent.residentId);
      const isConsulta = newEvent.type === 'consulta_exame';
      onPostToMural({
        author: session.username || 'Sistema',
        text: `📅 Novo Evento na Agenda: **${newEvent.title}**\nData: ${new Date(newEvent.date).toLocaleDateString('pt-BR')} às ${newEvent.time}\n${resident ? `Relacionado a: ${resident.name}\n` : ''}${isConsulta && newEvent.companion ? `Acompanhante: ${newEvent.companion}` : ''}`
      });
    }

    setIsFormOpen(false);
    setFormData({});
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir este compromisso?")) {
      await deleteAgendaEvent(id);
      loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
    }
  };

  const currentLabel = view === 'day' 
    ? currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : `Semana de ${getWeekDays()[0].toLocaleDateString('pt-BR')} até ${getWeekDays()[6].toLocaleDateString('pt-BR')}`;

  const renderEvents = (dateStr: string) => {
    const dayEvents = events.filter(e => e.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
    return (
      <div className="space-y-4">
        {dayEvents.map(e => {
            const resident = residents.find(r => r.id === e.residentId);
            return (
              <div key={e.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative group hover:shadow-md transition-shadow">
                <button onClick={() => handleDelete(e.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16} />
                </button>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black bg-blue-100 text-[#004c99] px-2 py-1 rounded uppercase tracking-widest">{e.time}</span>
                    <h4 className="font-bold text-gray-800">{e.title}</h4>
                </div>
                {e.description && <p className="text-sm text-gray-600 mb-2">{e.description}</p>}
                
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <User size={12} />
                        <span className="font-medium">{e.professionalName} ({e.professionalRole})</span>
                    </div>
                    {resident && (
                        <div className="flex items-center gap-1 text-xs text-[#004c99] bg-blue-50 px-2 py-1 rounded">
                            <BookOpen size={12} />
                            <span className="font-bold">{resident.name}</span>
                        </div>
                    )}
                </div>
              </div>
            )
        })}
        {dayEvents.length === 0 && (
            <div className="text-center p-6 bg-gray-50 rounded-xl text-gray-400 text-sm">
                Nenhum compromisso marcado.
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3">
             <CalendarIcon className="text-[#004c99]" size={28} />
             AGENDA <span className="opacity-50">/ COMPROMISSOS</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">Controle de atendimentos e tarefas multiprofissionais</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
             <button 
                onClick={() => setView('day')}
                className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${view === 'day' ? 'bg-white shadow text-[#004c99]' : 'text-gray-500 hover:text-gray-700'}`}
             >
                 DIÁRIO
             </button>
             <button 
                onClick={() => setView('week')}
                className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${view === 'week' ? 'bg-white shadow text-[#004c99]' : 'text-gray-500 hover:text-gray-700'}`}
             >
                 SEMANAL
             </button>
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 bg-[#004c99] hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-black text-xs transition-all uppercase tracking-widest shadow-lg shadow-blue-900/20"
          >
             <Plus size={16} /> Novo Compromisso
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
            <button onClick={handlePrev} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all">
                <ChevronLeft size={20} />
            </button>
            <h3 className="text-sm font-bold text-[#004c99] uppercase tracking-widest capitalize">{currentLabel}</h3>
            <button onClick={handleNext} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all">
                <ChevronRight size={20} />
            </button>
        </div>
        
        <div className="p-6">
            {view === 'day' ? (
                <div>
                   <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Compromissos ({events.filter(e => e.date === formatDate(currentDate)).length})</h4>
                   {renderEvents(formatDate(currentDate))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  {getWeekDays().map(d => {
                      const dStr = formatDate(d);
                      const isToday = dStr === formatDate(new Date());
                      return (
                          <div key={dStr} className={`flex flex-col border rounded-xl overflow-hidden ${isToday ? 'border-[#004c99] ring-2 ring-blue-50' : 'border-gray-100'}`}>
                              <div className={`p-2 text-center border-b ${isToday ? 'bg-[#004c99] text-white' : 'bg-gray-50 text-gray-500'}`}>
                                  <div className="text-[10px] font-black uppercase tracking-widest">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                                  <div className="text-xl font-bold">{d.getDate()}</div>
                              </div>
                              <div className="p-2 flex-1 bg-gray-50/30">
                                  {events.filter(e => e.date === dStr).sort((a, b) => a.time.localeCompare(b.time)).map(e => (
                                      <div key={e.id} className="mb-2 p-2 bg-white rounded-lg border shadow-sm text-xs cursor-pointer hover:border-blue-300" onClick={() => { setCurrentDate(d); setView('day'); }}>
                                          <div className="font-bold text-[#004c99]">{e.time}</div>
                                          <div className="line-clamp-2 mt-1">{e.title}</div>
                                      </div>
                                  ))}
                                  {events.filter(e => e.date === dStr).length === 0 && (
                                      <div className="text-[10px] text-gray-300 text-center py-4">Livre</div>
                                  )}
                              </div>
                          </div>
                      )
                  })}
                </div>
            )}
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-300">
               <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                   <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Agendar Compromisso</h3>
                   <button onClick={() => setIsFormOpen(false)} className="p-2 text-gray-400 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                   </button>
               </div>
               <div className="p-6 space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo de Evento</label>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl overflow-x-auto">
                        {['comum', 'consulta_exame', 'atividade_grupo', 'triagem'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFormData({...formData, type: t as any})}
                                className={`px-4 py-2 text-xs font-bold rounded-lg capitalize whitespace-nowrap transition-all ${
                                    (formData.type || 'comum') === t 
                                    ? 'bg-white shadow-sm text-[#004c99]' 
                                    : 'text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                {t.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                 </div>
                 
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Título do Compromisso *</label>
                    <input 
                      type="text" 
                      value={formData.title || ''}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                      placeholder="Ex: Reunião Familiar, Avaliação Fono..."
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data *</label>
                         <input 
                           type="date"
                           value={formData.date || ''}
                           onChange={e => setFormData({...formData, date: e.target.value})}
                           className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                         />
                     </div>
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora *</label>
                         <input 
                           type="time" 
                           value={formData.time || ''}
                           onChange={e => setFormData({...formData, time: e.target.value})}
                           className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                         />
                     </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Residente Relacionado (Opcional)</label>
                    <select 
                      value={formData.residentId || ''}
                      onChange={e => setFormData({...formData, residentId: e.target.value})}
                      className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all text-gray-700"
                    >
                        <option value="">Selecione um residente...</option>
                        {residents.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                 </div>

                 {formData.type === 'consulta_exame' && (
                     <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acompanhante (Opcional)</label>
                        <input 
                          type="text" 
                          value={formData.companion || ''}
                          onChange={e => setFormData({...formData, companion: e.target.value})}
                          className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                          placeholder="Ex: João da Silva (Filho)"
                        />
                     </div>
                 )}

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição detalhada</label>
                    <textarea 
                      value={formData.description || ''}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all min-h-[100px]"
                      placeholder="Observações importantes..."
                    />
                 </div>
               </div>

               <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-[32px]">
                   <button onClick={() => setIsFormOpen(false)} className="px-6 py-4 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancelar</button>
                   <button onClick={handleSave} className="px-8 py-4 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-800 transition-all">Salvar</button>
               </div>
           </div>
        </div>
      )}

      {/* INSTRUCTIONS GOOGLE CALENDAR */}
      <div className="mt-8 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 flex flex-col md:flex-row gap-6">
         <div className="flex items-start gap-4 flex-1">
            <div className="bg-blue-100 text-[#004c99] p-3 rounded-full shrink-0">
                <CalendarIcon size={24} />
            </div>
            <div>
               <h4 className="text-sm font-bold text-gray-800">Agenda Centralizada da Instituição</h4>
               <p className="text-xs text-gray-600 mt-1 mb-3">Esta é a agenda centralizada da instituição. Aqui você pode registrar e consultar todos os eventos internos.</p>
               <span className="text-[10px] bg-white border border-blue-200 text-[#004c99] px-3 py-1 rounded font-black uppercase tracking-widest inline-flex items-center gap-1">
                   <CalendarIcon size={12} /> Agenda Interna
               </span>
            </div>
         </div>

         {settings && (
            <div className="flex-1 bg-white p-5 rounded-xl border border-blue-100/50 shadow-sm">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Mail size={14} className="text-[#004c99]" />
                    E-mail Centralizado da Agenda
                </h4>
                {settings.agendaCentralEmail ? (
                    <div className="space-y-2">
                        <div className="text-sm font-bold text-gray-800 bg-gray-50 border border-gray-100 p-2 rounded-lg break-all">
                            {settings.agendaCentralEmail}
                        </div>
                        <p className="text-xs text-gray-500">Este é o e-mail configurado na gestão para o qual todos os eventos são listados.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="text-sm font-bold text-gray-400 bg-gray-50 border border-gray-100 border-dashed p-2 rounded-lg italic">
                            Não configurado
                        </div>
                        <p className="text-xs text-gray-500">Você pode definir um e-mail central da instituição no Módulo de Configurações.</p>
                    </div>
                )}
            </div>
         )}
      </div>
    </div>
  );
};

export default AgendaModule;
