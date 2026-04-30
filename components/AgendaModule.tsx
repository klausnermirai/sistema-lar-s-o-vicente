import React, { useState, useEffect, useRef } from 'react';
import { AgendaEvent, Resident, InstitutionSettings, MuralMessage, Appointment } from '../types';
import { loadAgendaEvents, saveAgendaEvent, deleteAgendaEvent } from '../lib/agendaStore';
import { fetchSettings } from '../lib/api';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, BookOpen, User, Search, Trash2, Mail, Share2, Upload, Pencil } from 'lucide-react';

interface AgendaModuleProps {
  session: any;
  residents: Resident[];
  onSaveResident?: (resident: Resident) => void;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const AgendaModule: React.FC<AgendaModuleProps> = ({ session, residents, onSaveResident, onPostToMural }) => {
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
    if (formData.type !== 'salao_festas' && (!formData.title || !formData.date || !formData.time)) {
      alert("Preencha título, data e hora.");
      return;
    }
    
    const isUpdate = !!formData.id;
    const newEvent: AgendaEvent = {
      id: formData.id || Date.now().toString(),
      institutionId: session.institutionId || 'default-inst',
      title: formData.title || (formData.type === 'salao_festas' ? 'Reserva Salão' : 'Sem Título'),
      date: (formData.type === 'salao_festas' && formData.dates?.length ? formData.dates[0] : formData.date) || new Date().toISOString().split('T')[0],
      time: formData.time || '00:00',
      description: formData.description || '',
      professionalName: session.username || 'Profissional Logado',
      professionalRole: session.accessLevel || 'Profissional',
      residentId: formData.residentId,
      type: formData.type || 'comum',
      companion: formData.companion || '',
      dates: formData.dates || [],
      endTime: formData.endTime || '',
      keyResponsible: formData.keyResponsible || '',
      responsiblePhone: formData.responsiblePhone || '',
      group: formData.group || ''
    };

    if (newEvent.type === 'consulta_exame' && newEvent.residentId && onSaveResident && !isUpdate) {
      const resident = residents.find(r => r.id === newEvent.residentId);
      if (resident) {
        const newAppointment: Appointment = {
          id: Date.now().toString(),
          date: newEvent.date,
          time: newEvent.time,
          location: 'Local não definido (via agenda)',
          type: 'consulta', 
          specialty: newEvent.title,
          professional: newEvent.professionalName,
          status: 'agendado',
          notes: newEvent.description,
          companionId: newEvent.companion
        };
        onSaveResident({
          ...resident,
          appointments: [...(resident.appointments || []), newAppointment]
        });
      }
    } else {
      await saveAgendaEvent(newEvent);
      loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
    }
    
    if (onPostToMural && !isUpdate) {
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

  const handleEdit = (event: AgendaEvent) => {
    setFormData(event);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente arquivar este compromisso?")) {
      await deleteAgendaEvent(id);
      loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
    }
  };

  const handleUndoImport = async () => {};
  const handleImportCalendar = async (e: React.ChangeEvent<HTMLInputElement>) => {};
  const handleExportWhatsApp = () => {
    if (!settings?.muralPhone) {
      alert("Nenhum número de WhatsApp cadastrado no Módulo de Configurações.");
      return;
    }

    const today = new Date();
    let text = "*Agendamentos dos próximos 7 dias*\n\n";
    let hasEvents = false;

    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dStr = formatDate(d);
        const dayEvents = getEventsForDate(dStr);
        
        if (dayEvents.length > 0) {
            hasEvents = true;
            text += `*${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}*\n`;
            dayEvents.forEach(e => {
                const resident = residents.find(r => r.id === e.residentId);
                const isBirthday = e.id.startsWith('birthday-');
                if (isBirthday) {
                    text += `- 🎂 ${e.title}\n`;
                } else {
                    text += `- ${e.time} | ${e.title} ${resident ? `(${resident.name})` : ''}\n`;
                }
            });
            text += "\n";
        }
    }

    if (!hasEvents) {
        text += "Nenhum compromisso marcado para os próximos 7 dias.";
    }

    const cleanPhone = settings.muralPhone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const currentLabel = view === 'day' 
    ? currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : `Semana de ${getWeekDays()[0].toLocaleDateString('pt-BR')} até ${getWeekDays()[6].toLocaleDateString('pt-BR')}`;

  const getEventsForDate = (dateStr: string) => {
    const dbEvents = events.filter(e => e.date === dateStr || (e.dates && e.dates.includes(dateStr)));
    
    // Appointments
    const appointmentEvents: AgendaEvent[] = residents.flatMap(r => {
      return (r.appointments || [])
        .filter(a => a.date === dateStr && a.status === 'agendado')
        .map(a => ({
          id: `appointment-${r.id}-${a.id}`,
          institutionId: session?.institutionId || 'default-inst',
          title: `${a.type.toUpperCase()}: ${a.specialty || a.type}`,
          date: a.date,
          time: a.time,
          description: `Local: ${a.location}\nObservações: ${a.notes || ''}`,
          professionalName: a.professional || 'Profissional não especificado',
          professionalRole: a.specialty || '',
          residentId: r.id,
          type: 'consulta_exame',
          companion: a.companionId || ''
        }));
    });

    // Birthdays
    const parts = dateStr.split('-');
    if (parts.length < 3) return [...dbEvents, ...appointmentEvents].sort((a, b) => a.time.localeCompare(b.time));
    const [, month, day] = parts;
    
    const bdayEvents: AgendaEvent[] = residents.filter(r => {
      if (!r.birthDate) return false;
      const bDateStr = r.birthDate.split('T')[0];
      const rParts = bDateStr.split('-');
      if (rParts.length >= 3) {
         return rParts[1] === month && rParts[2].substring(0, 2) === day;
      }
      return false;
    }).map(r => ({
      id: `birthday-${r.id}-${dateStr}`,
      institutionId: session?.institutionId || 'default-inst',
      title: `🎂 Aniversário: ${r.name}`,
      date: dateStr,
      time: '00:00',
      description: 'Aniversariante do dia!',
      professionalName: 'Sistema',
      professionalRole: '',
      residentId: r.id,
      type: 'comum',
      companion: ''
    }));

    return [...bdayEvents, ...appointmentEvents, ...dbEvents].sort((a, b) => a.time.localeCompare(b.time));
  };

  const renderEvents = (dateStr: string) => {
    const dayEvents = getEventsForDate(dateStr);
    return (
      <div className="space-y-4">
        {dayEvents.map(e => {
            const resident = residents.find(r => r.id === e.residentId);
            const isBirthday = e.id.startsWith('birthday-');
            const isAppointment = e.id.startsWith('appointment-');
            const bgClass = isBirthday ? 'bg-pink-50 border-pink-200' : isAppointment ? 'bg-blue-50 border-blue-200' : 'bg-white';

            return (
              <div key={e.id} className={`p-4 rounded-xl border border-gray-100 shadow-sm relative group hover:shadow-md transition-shadow ${bgClass}`}>
                {!isBirthday && !isAppointment && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(e)} 
                      className="p-2 text-gray-400 hover:text-[#004c99] bg-gray-50 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-gray-100 flex items-center justify-center"
                      title="Editar compromisso"
                    >
                        <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(e.id)} 
                      className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-gray-100"
                      title="Excluir compromisso"
                    >
                        <Trash2 size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                    {!isBirthday && <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${isAppointment ? 'bg-white text-blue-800' : 'bg-blue-100 text-[#004c99]'}`}>{e.time}</span>}
                    <h4 className={`font-bold ${isBirthday ? 'text-pink-600 text-lg' : isAppointment ? 'text-blue-900' : 'text-gray-800'}`}>{e.title}</h4>
                </div>
                {e.description && !isBirthday && <p className="text-sm text-gray-600 mb-2">{e.description}</p>}
                
                {!isBirthday && (
                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                      {e.type === 'salao_festas' ? (
                          <div className="flex flex-col gap-1 w-full text-xs text-gray-600">
                             {e.endTime && <div><strong>Término Previsto:</strong> {e.endTime}</div>}
                             {e.keyResponsible && <div><strong>Resp. Chave:</strong> {e.keyResponsible}</div>}
                             {e.responsiblePhone && <div><strong>Telefone:</strong> {e.responsiblePhone}</div>}
                             {e.group && <div><strong>Grupo:</strong> {e.group}</div>}
                             {e.dates && e.dates.length > 1 && <div><strong>Dias do evento:</strong> {e.dates.map(d => new Date(d).toLocaleDateString('pt-BR')).join(', ')}</div>}
                          </div>
                      ) : (
                          <>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <User size={12} />
                                  <span className="font-medium">{e.professionalName} {e.professionalRole ? `(${e.professionalRole})` : ''}</span>
                              </div>
                              {resident && (
                                  <div className="flex items-center gap-1 text-xs text-[#004c99] bg-blue-50 px-2 py-1 rounded">
                                      <BookOpen size={12} />
                                      <span className="font-bold">{resident.name}</span>
                                  </div>
                              )}
                          </>
                      )}
                  </div>
                )}
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
            onClick={handleExportWhatsApp}
            title="Exportar agenda dos próximos 7 dias para o WhatsApp do Mural"
            className="flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-4 py-3 rounded-xl font-black text-xs transition-all uppercase tracking-widest shadow-sm"
          >
            <Share2 size={16} /> <span className="hidden sm:inline">Exportar 7 Dias</span>
          </button>
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
                                  {getEventsForDate(dStr).map(e => {
                                      const isBirthday = e.id.startsWith('birthday-');
                                      const isAppointment = e.id.startsWith('appointment-');
                                      const bgClass = isBirthday ? 'bg-pink-100 border-pink-200 hover:border-pink-300' : isAppointment ? 'bg-blue-100 border-blue-200 hover:border-blue-300' : 'bg-white hover:border-blue-300';

                                      return (
                                        <div key={e.id} className={`mb-2 p-2 rounded-lg border shadow-sm text-xs cursor-pointer relative group ${bgClass}`}>
                                            <div onClick={() => { setCurrentDate(d); setView('day'); }}>
                                              {!isBirthday && <div className={`font-bold ${isAppointment ? 'text-blue-900' : 'text-[#004c99]'}`}>{e.time}</div>}
                                              <div className={`line-clamp-2 ${isBirthday ? 'font-bold text-pink-700' : isAppointment ? 'font-bold text-blue-900' : 'mt-1'}`}>{e.title}</div>
                                            </div>
                                            
                                            {!isBirthday && !isAppointment && (
                                              <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                  onClick={(e_evt) => { e_evt.stopPropagation(); handleEdit(e); }}
                                                  className="p-1 bg-white border border-gray-100 rounded shadow-sm text-gray-400 hover:text-blue-600"
                                                >
                                                  <Pencil size={10} />
                                                </button>
                                                <button 
                                                  onClick={(e_evt) => { e_evt.stopPropagation(); handleDelete(e.id); }}
                                                  className="p-1 bg-white border border-gray-100 rounded shadow-sm text-gray-400 hover:text-red-500"
                                                >
                                                  <Trash2 size={10} />
                                                </button>
                                              </div>
                                            )}
                                        </div>
                                      );
                                  })}
                                  {getEventsForDate(dStr).length === 0 && (
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
           <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-300 flex flex-col max-h-[90vh]">
               <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                   <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">
                     {formData.id ? 'Editar Compromisso' : 'Agendar Compromisso'}
                   </h3>
                   <button onClick={() => setIsFormOpen(false)} className="p-2 text-gray-400 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                   </button>
               </div>
               <div className="p-6 space-y-6 overflow-y-auto w-full flex-grow relative custom-scrollbar">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo de Evento</label>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl overflow-x-auto">
                        {['comum', 'consulta_exame', 'atividade_grupo', 'triagem', 'salao_festas'].map(t => (
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
                 
                 {formData.type !== 'salao_festas' && (
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
                 )}
                 
                 {formData.type === 'salao_festas' ? (
                   <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Datas Selecionadas (Permite múltiplos dias)</label>
                         <div className="flex items-center gap-2">
                           <input 
                             type="date"
                             onChange={e => {
                               if (e.target.value && !(formData.dates || []).includes(e.target.value)) {
                                 setFormData({...formData, dates: [...(formData.dates || []), e.target.value]});
                               }
                             }}
                             className="p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] outline-none"
                           />
                         </div>
                         <div className="flex flex-wrap gap-2 mt-2">
                           {(formData.dates || []).map(d => (
                             <span key={d} className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                               {new Date(d).toLocaleDateString('pt-BR')}
                               <button onClick={() => setFormData({...formData, dates: formData.dates?.filter(x => x !== d)})} className="text-blue-500 hover:text-blue-700 ml-1">x</button>
                             </span>
                           ))}
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora Início</label>
                             <input type="time" value={formData.time || ''} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] outline-none" />
                         </div>
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora Término (Previsto)</label>
                             <input type="time" value={formData.endTime || ''} onChange={e => setFormData({...formData, endTime: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] outline-none" />
                         </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Responsável pela Chave</label>
                             <input type="text" value={formData.keyResponsible || ''} onChange={e => setFormData({...formData, keyResponsible: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] outline-none" placeholder="Nome..." />
                         </div>
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Telefone Responsável</label>
                             <input type="text" value={formData.responsiblePhone || ''} onChange={e => setFormData({...formData, responsiblePhone: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] outline-none" placeholder="(00) 00000-0000" />
                         </div>
                     </div>
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grupo que faz parte</label>
                         <input type="text" value={formData.group || ''} onChange={e => setFormData({...formData, group: e.target.value})} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] outline-none" placeholder="Ex: Grupo de Jovens, Encontro de Casais..." />
                     </div>
                   </div>
                 ) : (
                   <>
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
                   </>
                 )}

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

               <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-[32px] shrink-0">
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
