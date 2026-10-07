import { getProfessionalSignature } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { AgendaEvent, Resident, InstitutionSettings, MuralMessage, Appointment, GroupActivity } from '../types';
import { loadAgendaEvents, saveAgendaEvent, deleteAgendaEvent } from '../lib/agendaStore';
import { buildGroupActivityAgendaEvent, loadGroupActivities, saveGroupActivity, syncGroupActivityResidents } from '../lib/groupActivityStore';
import { fetchSettings } from '../lib/api';
import { getLocalDateString, formatDateToBR } from '../lib/utils';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  User, 
  Search, 
  Trash2, 
  Mail, 
  Share2, 
  Upload, 
  Pencil,
  CheckCircle2,
  XCircle,
  CalendarClock,
  RotateCcw,
  AlertTriangle,
  Filter,
  Check,
  X
} from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState<'todos' | 'agendado' | 'finalizado' | 'cancelado' | 'adiado'>('todos');
  
  // Modais de Criação/Edição
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AgendaEvent>>({});
  const [groupActivityDraft, setGroupActivityDraft] = useState<Partial<GroupActivity>>({
    status: 'agendada',
    participationType: 'Todos os residentes',
    selectedResidents: [],
    involvedProfessionals: [],
    visibilidade: ['admin', 'publico']
  });
  const [involvedProfessionalInput, setInvolvedProfessionalInput] = useState('');
  
  // Modal de Cancelamento
  const [eventToCancel, setEventToCancel] = useState<AgendaEvent | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Modal de Adiamento
  const [eventToPostpone, setEventToPostpone] = useState<AgendaEvent | null>(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeTime, setPostponeTime] = useState('');
  const [postponeReason, setPostponeReason] = useState('');

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

  const formatDate = (date: Date) => getLocalDateString(date);

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

  const getSessionCompetence = (): GroupActivity['competence'] | undefined => {
    const level = session?.accessLevel;
    return ['nutricionista', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta'].includes(level)
      ? level as GroupActivity['competence']
      : undefined;
  };

  const resetGroupActivityDraft = () => {
    setGroupActivityDraft({
      status: 'agendada',
      competence: getSessionCompetence(),
      participationType: 'Todos os residentes',
      selectedResidents: [],
      responsibleProfessional: session?.username || 'Profissional',
      involvedProfessionals: [],
      visibilidade: ['admin', 'publico']
    });
    setInvolvedProfessionalInput('');
  };

  const handleSaveGroupActivityFromAgenda = async () => {
    const institutionId = session?.institutionId;
    if (!institutionId) {
      alert('Não foi possível identificar a instituição da sessão.');
      return;
    }

    if (!formData.date || !formData.time || !formData.description || !groupActivityDraft.competence || !groupActivityDraft.type) {
      alert('Preencha data, hora, área responsável, tipo de atividade e descrição.');
      return;
    }

    if (
      (groupActivityDraft.participationType === 'Grupo específico' || groupActivityDraft.participationType === 'Participação parcial')
      && !(groupActivityDraft.selectedResidents || []).length
    ) {
      alert('Selecione pelo menos um residente.');
      return;
    }

    const existingActivityId = formData.id?.startsWith('ga-') ? formData.id.slice(3) : groupActivityDraft.id;
    const activity: GroupActivity = {
      id: existingActivityId || Date.now().toString(),
      institutionId,
      competence: groupActivityDraft.competence,
      status: groupActivityDraft.status || 'agendada',
      date: formData.date,
      time: formData.time,
      type: groupActivityDraft.type,
      description: formData.description,
      participationType: groupActivityDraft.participationType || 'Todos os residentes',
      selectedResidents: groupActivityDraft.selectedResidents || [],
      responsibleProfessional: groupActivityDraft.responsibleProfessional || session?.username || 'Profissional',
      involvedProfessionals: groupActivityDraft.involvedProfessionals || [],
      result: groupActivityDraft.result || '',
      observations: groupActivityDraft.observations || '',
      visibilidade: groupActivityDraft.visibilidade || ['admin', 'publico'],
      timestamp: groupActivityDraft.timestamp || Date.now()
    };

    const isUpdate = !!existingActivityId;
    await saveGroupActivity(activity);
    await saveAgendaEvent(buildGroupActivityAgendaEvent(activity));
    syncGroupActivityResidents(activity, residents, onSaveResident);

    if (!isUpdate && onPostToMural && activity.visibilidade?.length) {
      onPostToMural({
        author: activity.responsibleProfessional,
        text: `Atividade em Grupo (${activity.type}): ${activity.description}`,
        detailedContent: `Data e Hora: ${activity.date} às ${activity.time}\nCompetência: ${activity.competence}\nParticipantes selecionados: ${activity.selectedResidents.length}\n\nDescrição:\n${activity.description}\n\nResultado/Evolução:\n${activity.result || 'Sem resultado registrado.'}`,
        visibilidade: activity.visibilidade
      });
    }

    setEvents(await loadAgendaEvents(institutionId));
    setIsFormOpen(false);
    setFormData({});
    resetGroupActivityDraft();
  };

  const handleSave = async () => {
    if (formData.type === 'atividade_grupo') {
      await handleSaveGroupActivityFromAgenda();
      return;
    }

    if (formData.type !== 'salao_festas' && (!formData.title || !formData.date || !formData.time)) {
      alert("Preencha título, data e hora.");
      return;
    }
    
    const isUpdate = !!formData.id;
    const newEvent: AgendaEvent = {
      id: formData.id || Date.now().toString(),
      institutionId: session.institutionId || 'default-inst',
      title: formData.title || (formData.type === 'salao_festas' ? 'Reserva Salão' : 'Sem Título'),
      date: (formData.type === 'salao_festas' && formData.dates?.length ? formData.dates[0] : formData.date) || getLocalDateString(new Date()),
      time: formData.time || '00:00',
      description: formData.description || '',
      professionalName: session.username || 'Profissional Logado',
      professionalRole: session.accessLevel || 'Profissional',
      residentId: formData.residentId,
      type: formData.type || 'comum',
      companion: formData.companion || '',
      status: formData.status || 'agendado',
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
          id: Date.now().toString(), ...getProfessionalSignature(),
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
        text: `📅 Novo Evento na Agenda: **${newEvent.title}**\nData: ${formatDateToBR(newEvent.date)} às ${newEvent.time}\n${resident ? `Relacionado a: ${resident.name}\n` : ''}${isConsulta && newEvent.companion ? `Acompanhante: ${newEvent.companion}` : ''}`
      });
    }

    setIsFormOpen(false);
    setFormData({});
  };

  const handleEdit = async (event: AgendaEvent) => {
    setFormData(event);

    if (event.type === 'atividade_grupo' && session?.institutionId) {
      try {
        const activities = await loadGroupActivities(session.institutionId);
        const activityId = event.id.startsWith('ga-') ? event.id.slice(3) : event.id;
        const activity = activities.find(a => a.id === activityId);
        if (activity) setGroupActivityDraft(activity);
        else resetGroupActivityDraft();
      } catch (error) {
        console.error('Erro ao carregar atividade em grupo vinculada:', error);
        resetGroupActivityDraft();
      }
    }

    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente arquivar este compromisso?")) {
      await deleteAgendaEvent(id);
      loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
    }
  };

  // --- Ações de Ciclo de Vida do Evento ---
  const handleComplete = async (event: AgendaEvent) => {
    const updated: AgendaEvent = {
      ...event,
      status: 'finalizado',
      completedAt: new Date().toISOString(),
      completedBy: session?.username || 'Profissional'
    };
    await saveAgendaEvent(updated);
    loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
  };

  const handleReopen = async (event: AgendaEvent) => {
    const updated: AgendaEvent = {
      ...event,
      status: 'agendado',
      cancellationReason: undefined,
      cancelledAt: undefined,
      cancelledBy: undefined,
      completedAt: undefined,
      completedBy: undefined
    };
    await saveAgendaEvent(updated);
    loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
  };

  const handleOpenCancel = (event: AgendaEvent) => {
    setEventToCancel(event);
    setCancelReason('');
  };

  const handleConfirmCancel = async () => {
    if (!eventToCancel) return;
    if (!cancelReason.trim()) {
      alert("Por favor, informe o motivo do cancelamento.");
      return;
    }
    const updated: AgendaEvent = {
      ...eventToCancel,
      status: 'cancelado',
      cancellationReason: cancelReason.trim(),
      cancelledAt: new Date().toISOString(),
      cancelledBy: session?.username || 'Profissional'
    };
    await saveAgendaEvent(updated);
    loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
    setEventToCancel(null);
    setCancelReason('');
  };

  const handleOpenPostpone = (event: AgendaEvent) => {
    setEventToPostpone(event);
    setPostponeDate(event.date);
    setPostponeTime(event.time || '08:00');
    setPostponeReason('');
  };

  const handleConfirmPostpone = async () => {
    if (!eventToPostpone) return;
    if (!postponeDate || !postponeTime) {
      alert("Por favor, selecione a nova data e o novo horário.");
      return;
    }
    const historyEntry = {
      previousDate: eventToPostpone.date,
      previousTime: eventToPostpone.time,
      newDate: postponeDate,
      newTime: postponeTime,
      reason: postponeReason.trim() || undefined,
      postponedAt: new Date().toISOString(),
      postponedBy: session?.username || 'Profissional'
    };
    const updated: AgendaEvent = {
      ...eventToPostpone,
      date: postponeDate,
      time: postponeTime,
      status: 'adiado',
      postponedHistory: [...(eventToPostpone.postponedHistory || []), historyEntry]
    };
    await saveAgendaEvent(updated);
    loadAgendaEvents(session.institutionId || 'default-inst').then(setEvents);
    setEventToPostpone(null);
    setPostponeDate('');
    setPostponeTime('');
    setPostponeReason('');
  };

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
        const dayEvents = getEventsForDate(dStr, false); // export all non-cancelled
        
        if (dayEvents.length > 0) {
            hasEvents = true;
            text += `*${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}*\n`;
            dayEvents.forEach(e => {
                const resident = residents.find(r => r.id === e.residentId);
                const isBirthday = e.id.startsWith('birthday-');
                const statusTag = e.status === 'finalizado' ? ' [CONCLUÍDO]' : e.status === 'adiado' ? ' [REAGENDADO]' : '';
                if (isBirthday) {
                    text += `- 🎂 ${e.title}\n`;
                } else {
                    text += `- ${e.time} | ${e.title}${statusTag} ${resident ? `(${resident.name})` : ''}\n`;
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

  const getEventsForDate = (dateStr: string, applyStatusFilter: boolean = true) => {
    let dbEvents = events.filter(e => e.date === dateStr || (e.dates && e.dates.includes(dateStr)));
    
    // Appointments from residents
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
          status: 'agendado',
          companion: a.companionId || ''
        }));
    });

    // Birthdays
    const parts = dateStr.split('-');
    let bdayEvents: AgendaEvent[] = [];
    if (parts.length >= 3) {
      const [, month, day] = parts;
      bdayEvents = residents.filter(r => {
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
        status: 'agendado',
        companion: ''
      }));
    }

    let combined = [...bdayEvents, ...appointmentEvents, ...dbEvents];

    if (applyStatusFilter && statusFilter !== 'todos') {
      combined = combined.filter(e => {
        const evStatus = e.status || 'agendado';
        return evStatus === statusFilter;
      });
    }

    return combined.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  };

  const getCountsForStatus = () => {
    const total = events.length;
    const agendados = events.filter(e => !e.status || e.status === 'agendado').length;
    const finalizados = events.filter(e => e.status === 'finalizado').length;
    const cancelados = events.filter(e => e.status === 'cancelado').length;
    const adiados = events.filter(e => e.status === 'adiado').length;
    return { total, agendados, finalizados, cancelados, adiados };
  };

  const statusCounts = getCountsForStatus();

  const renderEvents = (dateStr: string) => {
    const dayEvents = getEventsForDate(dateStr);
    return (
      <div className="space-y-4">
        {dayEvents.map(e => {
            const resident = residents.find(r => r.id === e.residentId);
            const isBirthday = e.id.startsWith('birthday-');
            const isAppointment = e.id.startsWith('appointment-');
            const evStatus = e.status || 'agendado';

            // Background border styling based on status
            const bgClass = isBirthday ? 'bg-pink-50/70 border-pink-200' 
              : evStatus === 'finalizado' ? 'bg-emerald-50/40 border-emerald-200/80'
              : evStatus === 'cancelado' ? 'bg-rose-50/40 border-rose-200/80 opacity-80'
              : evStatus === 'adiado' ? 'bg-amber-50/40 border-amber-200/80'
              : isAppointment ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100';

            return (
              <div key={e.id} className={`p-4 sm:p-5 rounded-2xl border shadow-sm relative group hover:shadow-md transition-all ${bgClass}`}>
                {!isBirthday && !isAppointment && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button 
                      onClick={() => handleEdit(e)} 
                      className="p-2 text-gray-400 hover:text-[#004c99] bg-white/80 hover:bg-white rounded-lg transition-all shadow-sm border border-gray-100"
                      title="Editar compromisso"
                    >
                        <Pencil size={13} />
                    </button>
                    <button 
                      onClick={() => handleDelete(e.id)} 
                      className="p-2 text-gray-400 hover:text-rose-500 bg-white/80 hover:bg-white rounded-lg transition-all shadow-sm border border-gray-100"
                      title="Excluir compromisso"
                    >
                        <Trash2 size={13} />
                    </button>
                  </div>
                )}

                {/* Header: Horário, Status e Título */}
                <div className="flex flex-wrap items-center gap-2 mb-2 pr-16">
                    {!isBirthday && (
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                        isAppointment ? 'bg-white text-blue-800 border border-blue-200' : 'bg-blue-100/80 text-[#004c99]'
                      }`}>
                        {e.time}
                      </span>
                    )}

                    {/* Status Badge */}
                    {!isBirthday && (
                      <>
                        {evStatus === 'finalizado' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 uppercase tracking-wider border border-emerald-200">
                            <CheckCircle2 size={12} /> Finalizado
                          </span>
                        )}
                        {evStatus === 'cancelado' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 uppercase tracking-wider border border-rose-200">
                            <XCircle size={12} /> Cancelado
                          </span>
                        )}
                        {evStatus === 'adiado' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 uppercase tracking-wider border border-amber-200">
                            <CalendarClock size={12} /> Reagendado / Adiado
                          </span>
                        )}
                        {evStatus === 'agendado' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 uppercase tracking-wider">
                            <Clock size={11} /> Agendado
                          </span>
                        )}
                      </>
                    )}

                    <h4 className={`font-bold text-base ${isBirthday ? 'text-pink-600 text-lg' : evStatus === 'cancelado' ? 'text-gray-500 line-through' : isAppointment ? 'text-blue-900' : 'text-gray-800'}`}>
                      {e.title}
                    </h4>
                </div>

                {e.description && !isBirthday && <p className="text-sm text-gray-600 mb-2 leading-relaxed">{e.description}</p>}
                
                {/* Informações detalhadas do Salão de Festas ou Responsável */}
                {!isBirthday && (
                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100/80">
                      {e.type === 'salao_festas' ? (
                          <div className="flex flex-col gap-1 w-full text-xs text-gray-600">
                             {e.endTime && <div><strong>Término Previsto:</strong> {e.endTime}</div>}
                             {e.keyResponsible && <div><strong>Resp. Chave:</strong> {e.keyResponsible}</div>}
                             {e.responsiblePhone && <div><strong>Telefone:</strong> {e.responsiblePhone}</div>}
                             {e.group && <div><strong>Grupo:</strong> {e.group}</div>}
                             {e.dates && e.dates.length > 1 && <div><strong>Dias do evento:</strong> {e.dates.map(d => formatDateToBR(d)).join(', ')}</div>}
                          </div>
                      ) : (
                          <>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <User size={13} className="text-gray-400" />
                                  <span className="font-medium">{e.professionalName} {e.professionalRole ? `(${e.professionalRole})` : ''}</span>
                              </div>
                              {resident && (
                                  <div className="flex items-center gap-1 text-xs text-[#004c99] bg-blue-50 px-2.5 py-1 rounded-md font-bold">
                                      <BookOpen size={12} />
                                      <span>{resident.name}</span>
                                  </div>
                              )}
                          </>
                      )}
                  </div>
                )}

                {/* Box de Motivo do Cancelamento */}
                {evStatus === 'cancelado' && e.cancellationReason && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-900 flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <div>
                      <span className="font-bold">Motivo do Cancelamento:</span> {e.cancellationReason}
                      {e.cancelledBy && <span className="block text-[11px] text-rose-700 mt-0.5">Cancelado por <strong>{e.cancelledBy}</strong></span>}
                    </div>
                  </div>
                )}

                {/* Box de Histórico de Adiamento */}
                {evStatus === 'adiado' && e.postponedHistory && e.postponedHistory.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2 animate-in fade-in">
                    <CalendarClock size={15} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-bold">Compromisso Reagendado:</span> Anteriormente previsto para{' '}
                      <strong>{formatDateToBR(e.postponedHistory[e.postponedHistory.length - 1].previousDate)}</strong> às{' '}
                      <strong>{e.postponedHistory[e.postponedHistory.length - 1].previousTime || '00:00'}</strong>
                      {e.postponedHistory[e.postponedHistory.length - 1].reason && (
                        <div className="mt-0.5 text-amber-800">
                          <strong>Motivo:</strong> {e.postponedHistory[e.postponedHistory.length - 1].reason}
                        </div>
                      )}
                      {e.postponedHistory[e.postponedHistory.length - 1].postponedBy && (
                        <div className="text-[10px] text-amber-700 mt-0.5">
                          Remarcado por {e.postponedHistory[e.postponedHistory.length - 1].postponedBy}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Box de Conclusão / Finalização */}
                {evStatus === 'finalizado' && (
                  <div className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>Concluído e finalizado com sucesso{e.completedBy ? ` por ${e.completedBy}` : ''}</span>
                  </div>
                )}

                {/* Botões de Ação de Ciclo de Vida (Finalizar, Adiar, Cancelar) */}
                {!isBirthday && !isAppointment && (
                  <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                    {evStatus !== 'finalizado' && evStatus !== 'cancelado' ? (
                      <>
                        <button
                          onClick={() => handleComplete(e)}
                          className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Marcar este compromisso como concluído e realizado"
                        >
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>Finalizar</span>
                        </button>
                        <button
                          onClick={() => handleOpenPostpone(e)}
                          className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Adiar evento e definir nova data e horário"
                        >
                          <CalendarClock size={14} className="text-amber-600" />
                          <span>Adiar</span>
                        </button>
                        <button
                          onClick={() => handleOpenCancel(e)}
                          className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Cancelar compromisso informando o motivo"
                        >
                          <XCircle size={14} className="text-rose-600" />
                          <span>Cancelar</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleReopen(e)}
                        className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                        title="Reabrir este compromisso como Agendado"
                      >
                        <RotateCcw size={13} className="text-gray-500" />
                        <span>Reabrir / Reativar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
        })}
        {dayEvents.length === 0 && (
            <div className="text-center p-8 bg-gray-50 rounded-2xl text-gray-400 text-sm border-2 border-dashed border-gray-100">
                Nenhum compromisso encontrado para esta data ou filtro selecionado.
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3">
             <CalendarIcon className="text-[#004c99]" size={28} />
             AGENDA <span className="opacity-50">/ COMPROMISSOS</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">Controle de atendimentos, tarefas, consultas e eventos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-xl p-1 shadow-inner">
             <button 
                onClick={() => setView('day')}
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${view === 'day' ? 'bg-white shadow text-[#004c99]' : 'text-gray-500 hover:text-gray-700'}`}
             >
                 DIÁRIO
             </button>
             <button 
                onClick={() => setView('week')}
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${view === 'week' ? 'bg-white shadow text-[#004c99]' : 'text-gray-500 hover:text-gray-700'}`}
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
            onClick={() => {
              setFormData({ date: formatDate(currentDate), time: '08:00', type: 'comum' });
              resetGroupActivityDraft();
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 bg-[#004c99] hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-black text-xs transition-all uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95"
          >
             <Plus size={16} /> Novo Compromisso
          </button>
        </div>
      </div>

      {/* Barra de Filtros de Status */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest pl-2 pr-1 shrink-0">
          <Filter size={14} className="text-[#004c99]" />
          <span>Status:</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'todos' 
                ? 'bg-gray-900 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>Todos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'todos' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {statusCounts.total}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('agendado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'agendado' 
                ? 'bg-[#004c99] text-white shadow-sm' 
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Clock size={12} />
            <span>Agendados</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'agendado' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'}`}>
              {statusCounts.agendados}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('finalizado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'finalizado' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 size={12} />
            <span>Finalizados</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'finalizado' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {statusCounts.finalizados}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('adiado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'adiado' 
                ? 'bg-amber-600 text-white shadow-sm' 
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <CalendarClock size={12} />
            <span>Adiados / Reagendados</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'adiado' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-900'}`}>
              {statusCounts.adiados}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('cancelado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'cancelado' 
                ? 'bg-rose-600 text-white shadow-sm' 
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <XCircle size={12} />
            <span>Cancelados</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === 'cancelado' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'}`}>
              {statusCounts.cancelados}
            </span>
          </button>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/80">
            <button onClick={handlePrev} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-500 transition-all">
                <ChevronLeft size={20} />
            </button>
            <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest capitalize">{currentLabel}</h3>
            <button onClick={handleNext} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-500 transition-all">
                <ChevronRight size={20} />
            </button>
        </div>
        
        <div className="p-6">
            {view === 'day' ? (
                <div>
                   <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                     Compromissos ({getEventsForDate(formatDate(currentDate)).length})
                   </h4>
                   {renderEvents(formatDate(currentDate))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  {getWeekDays().map(d => {
                      const dStr = formatDate(d);
                      const isToday = dStr === formatDate(new Date());
                      const dayEvents = getEventsForDate(dStr);
                      return (
                          <div key={dStr} className={`flex flex-col border rounded-2xl overflow-hidden transition-all ${isToday ? 'border-[#004c99] ring-2 ring-blue-100 shadow-sm' : 'border-gray-100'}`}>
                              <div className={`p-2.5 text-center border-b ${isToday ? 'bg-[#004c99] text-white' : 'bg-gray-50 text-gray-600'}`}>
                                  <div className="text-[10px] font-black uppercase tracking-widest">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                                  <div className="text-xl font-black">{d.getDate()}</div>
                              </div>
                              <div className="p-2 flex-1 bg-gray-50/30 space-y-2">
                                  {dayEvents.map(e => {
                                      const isBirthday = e.id.startsWith('birthday-');
                                      const isAppointment = e.id.startsWith('appointment-');
                                      const evStatus = e.status || 'agendado';
                                      const bgClass = isBirthday ? 'bg-pink-100 border-pink-200' 
                                        : evStatus === 'finalizado' ? 'bg-emerald-100/60 border-emerald-300'
                                        : evStatus === 'cancelado' ? 'bg-rose-100/60 border-rose-200 opacity-75 line-through'
                                        : evStatus === 'adiado' ? 'bg-amber-100/60 border-amber-300'
                                        : isAppointment ? 'bg-blue-100 border-blue-200' : 'bg-white border-gray-200';

                                      return (
                                        <div key={e.id} className={`p-2 rounded-xl border shadow-sm text-xs cursor-pointer relative group transition-all hover:shadow ${bgClass}`}>
                                            <div onClick={() => { setCurrentDate(d); setView('day'); }}>
                                              {!isBirthday && (
                                                <div className="flex items-center justify-between">
                                                  <span className={`font-black ${isAppointment ? 'text-blue-900' : 'text-[#004c99]'}`}>{e.time}</span>
                                                  {evStatus === 'finalizado' && <CheckCircle2 size={11} className="text-emerald-700" />}
                                                  {evStatus === 'cancelado' && <XCircle size={11} className="text-rose-700" />}
                                                  {evStatus === 'adiado' && <CalendarClock size={11} className="text-amber-700" />}
                                                </div>
                                              )}
                                              <div className={`line-clamp-2 ${isBirthday ? 'font-bold text-pink-700' : isAppointment ? 'font-bold text-blue-900' : 'mt-0.5 font-medium'}`}>{e.title}</div>
                                            </div>
                                            
                                            {!isBirthday && !isAppointment && (
                                              <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                  onClick={(e_evt) => { e_evt.stopPropagation(); handleEdit(e); }}
                                                  className="p-1 bg-white border border-gray-100 rounded-md shadow-sm text-gray-400 hover:text-blue-600"
                                                  title="Editar"
                                                >
                                                  <Pencil size={10} />
                                                </button>
                                                <button 
                                                  onClick={(e_evt) => { e_evt.stopPropagation(); handleDelete(e.id); }}
                                                  className="p-1 bg-white border border-gray-100 rounded-md shadow-sm text-gray-400 hover:text-rose-500"
                                                  title="Excluir"
                                                >
                                                  <Trash2 size={10} />
                                                </button>
                                              </div>
                                            )}
                                        </div>
                                      );
                                  })}
                                  {dayEvents.length === 0 && (
                                      <div className="text-[10px] text-gray-300 text-center py-4 font-bold uppercase tracking-widest">Livre</div>
                                  )}
                              </div>
                          </div>
                      )
                  })}
                </div>
            )}
        </div>
      </div>

      {/* MODAL: Criar / Editar Compromisso */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in duration-300 flex flex-col max-h-[90vh]">
               <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                   <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">
                     {formData.id ? 'Editar Compromisso' : 'Agendar Novo Compromisso'}
                   </h3>
                   <button onClick={() => setIsFormOpen(false)} className="p-2 text-gray-400 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors">
                       <X size={18} />
                   </button>
               </div>
               <div className="p-6 space-y-6 overflow-y-auto w-full flex-grow relative custom-scrollbar">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo de Evento</label>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl overflow-x-auto">
                        {['comum', 'consulta_exame', 'atividade_grupo', 'triagem', 'salao_festas'].map(t => (
                            <button
                                key={t}
                                onClick={() => {
                                  setFormData({...formData, type: t as any});
                                  if (t === 'atividade_grupo') resetGroupActivityDraft();
                                }}
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
                 
                 {formData.type !== 'salao_festas' && formData.type !== 'atividade_grupo' && (
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Título do Compromisso *</label>
                      <input 
                        type="text" 
                        value={formData.title || ''}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                        placeholder="Ex: Consulta Cardiologista, Avaliação Fono, Visita Pastoral..."
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
                               {formatDateToBR(d)}
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
    
                     {formData.type !== 'atividade_grupo' && (
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
                     )}
                   </>
                 )}

                 {formData.type === 'atividade_grupo' && (
                   <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Área responsável *</label>
                         <select
                           value={groupActivityDraft.competence || ''}
                           onChange={e => setGroupActivityDraft({...groupActivityDraft, competence: e.target.value as GroupActivity['competence']})}
                           className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white"
                         >
                           <option value="">Selecione...</option>
                           <option value="terapeuta_ocupacional">Terapia Ocupacional</option>
                           <option value="psicologia">Psicologia</option>
                           <option value="nutricionista">Nutrição</option>
                           <option value="fisioterapeuta">Fisioterapia</option>
                         </select>
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tipo de atividade *</label>
                         <select
                           value={groupActivityDraft.type || ''}
                           onChange={e => setGroupActivityDraft({...groupActivityDraft, type: e.target.value})}
                           className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white"
                         >
                           <option value="">Selecione...</option>
                           {['Recreativa', 'Cognitiva', 'Motora', 'Social', 'Espiritual', 'Outro'].map(type => <option key={type} value={type}>{type}</option>)}
                         </select>
                       </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</label>
                         <select
                           value={groupActivityDraft.status || 'agendada'}
                           onChange={e => setGroupActivityDraft({...groupActivityDraft, status: e.target.value as GroupActivity['status']})}
                           className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white"
                         >
                           <option value="agendada">Agendada</option>
                           <option value="realizada">Realizada</option>
                           <option value="cancelada">Cancelada</option>
                         </select>
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Participação</label>
                         <select
                           value={groupActivityDraft.participationType || 'Todos os residentes'}
                           onChange={e => setGroupActivityDraft({...groupActivityDraft, participationType: e.target.value as GroupActivity['participationType'], selectedResidents: e.target.value === 'Todos os residentes' ? [] : groupActivityDraft.selectedResidents})}
                           className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white"
                         >
                           <option value="Todos os residentes">Todos os residentes</option>
                           <option value="Grupo específico">Grupo específico</option>
                           <option value="Participação parcial">Participação parcial</option>
                         </select>
                       </div>
                     </div>

                     {groupActivityDraft.participationType !== 'Todos os residentes' && (
                       <div className="space-y-2">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Residentes participantes *</label>
                         <div className="max-h-40 overflow-y-auto rounded-xl border bg-white p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                           {residents.map(resident => (
                             <label key={resident.id} className="flex items-center gap-2 text-xs font-medium text-gray-700">
                               <input
                                 type="checkbox"
                                 checked={(groupActivityDraft.selectedResidents || []).includes(resident.id)}
                                 onChange={() => {
                                   const selected = groupActivityDraft.selectedResidents || [];
                                   setGroupActivityDraft({
                                     ...groupActivityDraft,
                                     selectedResidents: selected.includes(resident.id)
                                       ? selected.filter(id => id !== resident.id)
                                       : [...selected, resident.id]
                                   });
                                 }}
                               />
                               {resident.name}
                             </label>
                           ))}
                         </div>
                       </div>
                     )}

                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Profissional responsável</label>
                       <input
                         type="text"
                         value={groupActivityDraft.responsibleProfessional || session?.username || ''}
                         onChange={e => setGroupActivityDraft({...groupActivityDraft, responsibleProfessional: e.target.value})}
                         className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white"
                       />
                     </div>

                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Profissionais envolvidos</label>
                       <div className="flex gap-2">
                         <input
                           type="text"
                           value={involvedProfessionalInput}
                           onChange={e => setInvolvedProfessionalInput(e.target.value)}
                           className="flex-1 p-3 border-2 border-gray-100 rounded-xl text-sm bg-white"
                           placeholder="Nome do profissional"
                         />
                         <button
                           type="button"
                           onClick={() => {
                             const name = involvedProfessionalInput.trim();
                             if (!name) return;
                             setGroupActivityDraft({...groupActivityDraft, involvedProfessionals: [...(groupActivityDraft.involvedProfessionals || []), name]});
                             setInvolvedProfessionalInput('');
                           }}
                           className="px-4 py-2 bg-white border border-blue-200 text-[#004c99] rounded-xl text-xs font-black uppercase"
                         >
                           Adicionar
                         </button>
                       </div>
                       <div className="flex flex-wrap gap-2">
                         {(groupActivityDraft.involvedProfessionals || []).map((name, index) => (
                           <span key={`${name}-${index}`} className="px-3 py-1 bg-white border border-blue-100 rounded-full text-xs font-bold text-gray-700">
                             {name}
                             <button
                               type="button"
                               onClick={() => setGroupActivityDraft({...groupActivityDraft, involvedProfessionals: (groupActivityDraft.involvedProfessionals || []).filter((_, i) => i !== index)})}
                               className="ml-2 text-gray-400 hover:text-red-500"
                             >
                               ×
                             </button>
                           </span>
                         ))}
                       </div>
                     </div>

                     {groupActivityDraft.status === 'realizada' && (
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Resultado / evolução</label>
                         <select
                           value={groupActivityDraft.result || ''}
                           onChange={e => setGroupActivityDraft({...groupActivityDraft, result: e.target.value})}
                           className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white"
                         >
                           <option value="">Sem resultado informado</option>
                           <option value="Excelente">Excelente</option>
                           <option value="Boa">Boa</option>
                           <option value="Regular">Regular</option>
                           <option value="Baixa adesão">Baixa adesão</option>
                         </select>
                       </div>
                     )}

                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Observações</label>
                       <textarea
                         value={groupActivityDraft.observations || ''}
                         onChange={e => setGroupActivityDraft({...groupActivityDraft, observations: e.target.value})}
                         className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm bg-white min-h-[80px]"
                       />
                     </div>
                   </div>
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
                      placeholder="Observações importantes sobre o compromisso..."
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

      {/* MODAL: Cancelar Compromisso (com Motivo) */}
      {eventToCancel && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950 uppercase tracking-tight">Cancelar Compromisso</h3>
                  <p className="text-xs text-rose-700">Informe a justificativa do cancelamento</p>
                </div>
              </div>
              <button onClick={() => setEventToCancel(null)} className="p-2 text-rose-400 hover:text-rose-700 rounded-full hover:bg-rose-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compromisso Selecionado</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{eventToCancel.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Data: {formatDateToBR(eventToCancel.date)} às {eventToCancel.time}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Ex: Médico precisou desmarcar; Acolhido indisposto; Problema de transporte..."
                  className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-50 outline-none transition-all min-h-[110px]"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400">Esta justificativa ficará salva no histórico do evento para consulta futura.</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEventToCancel(null)}
                className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-200 rounded-xl transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-rose-900/20 flex items-center gap-2 transition-all"
              >
                <XCircle size={15} /> Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Adiar Compromisso (com Nova Data e Horário) */}
      {eventToPostpone && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-amber-100 bg-amber-50/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <CalendarClock size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-950 uppercase tracking-tight">Adiar / Reagendar</h3>
                  <p className="text-xs text-amber-700">Selecione a nova data e horário</p>
                </div>
              </div>
              <button onClick={() => setEventToPostpone(null)} className="p-2 text-amber-400 hover:text-amber-700 rounded-full hover:bg-amber-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compromisso Atual</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{eventToPostpone.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Agendado atualmente para: <strong>{formatDateToBR(eventToPostpone.date)} às {eventToPostpone.time}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nova Data *</label>
                  <input
                    type="date"
                    value={postponeDate}
                    onChange={e => setPostponeDate(e.target.value)}
                    className="w-full p-3.5 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-50 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Novo Horário *</label>
                  <input
                    type="time"
                    value={postponeTime}
                    onChange={e => setPostponeTime(e.target.value)}
                    className="w-full p-3.5 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Motivo do Adiamento (Opcional)
                </label>
                <textarea
                  value={postponeReason}
                  onChange={e => setPostponeReason(e.target.value)}
                  placeholder="Ex: Reagendado a pedido da família; Consulta transferida pelo consultório..."
                  className="w-full p-3.5 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-50 outline-none transition-all min-h-[85px]"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEventToPostpone(null)}
                className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-200 rounded-xl transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmPostpone}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-amber-900/20 flex items-center gap-2 transition-all"
              >
                <CalendarClock size={15} /> Confirmar Reagendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Informações E-mail da Agenda Centralizada */}
      <div className="mt-8 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 flex flex-col md:flex-row gap-6">
         <div className="flex items-start gap-4 flex-1">
            <div className="bg-blue-100 text-[#004c99] p-3 rounded-full shrink-0">
                <CalendarIcon size={24} />
            </div>
            <div>
               <h4 className="text-sm font-bold text-gray-800">Agenda Centralizada da Instituição</h4>
               <p className="text-xs text-gray-600 mt-1 mb-3">Esta é a agenda centralizada da instituição. Aqui você pode registrar, concluir, adiar e cancelar todos os compromissos com rastreabilidade total.</p>
               <span className="text-[10px] bg-white border border-blue-200 text-[#004c99] px-3 py-1 rounded font-black uppercase tracking-widest inline-flex items-center gap-1">
                   <CalendarIcon size={12} /> Agenda Interna SSVP
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
