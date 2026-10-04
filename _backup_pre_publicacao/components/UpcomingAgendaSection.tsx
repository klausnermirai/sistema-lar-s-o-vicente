import React, { useState, useEffect } from 'react';
import { loadAgendaEvents } from '../lib/agendaStore';
import { AgendaEvent } from '../types';
import { Calendar as CalendarIcon, Clock, ChevronRight } from 'lucide-react';
import { getLocalDateString, parseLocalDate } from '../lib/utils';

interface UpcomingAgendaSectionProps {
  institutionId: string;
  onNavigateToAgenda: () => void;
}

const UpcomingAgendaSection: React.FC<UpcomingAgendaSectionProps> = ({ institutionId, onNavigateToAgenda }) => {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        if (!institutionId) return;
        setLoading(true);
        const data = await loadAgendaEvents(institutionId);
        
        const now = new Date();
        const next7Days = new Date(now);
        next7Days.setDate(next7Days.getDate() + 7);
        next7Days.setHours(23, 59, 59, 999);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const upcoming = data.filter(ev => {
          // Do not show cancelled events in upcoming summary
          if (ev.status === 'cancelado') return false;
          
          const evDate = parseLocalDate(ev.date);
          if (ev.time) {
            const [hh, mm] = ev.time.split(':').map(Number);
            evDate.setHours(hh || 0, mm || 0, 0, 0);
          } else {
            evDate.setHours(12, 0, 0, 0);
          }
          return evDate >= todayStart && evDate <= next7Days;
        }).sort((a, b) => {
          const dateA = parseLocalDate(a.date);
          const dateB = parseLocalDate(b.date);
          if (a.time) {
            const [hh, mm] = a.time.split(':').map(Number);
            dateA.setHours(hh || 0, mm || 0, 0, 0);
          }
          if (b.time) {
            const [hh, mm] = b.time.split(':').map(Number);
            dateB.setHours(hh || 0, mm || 0, 0, 0);
          }
          return dateA.getTime() - dateB.getTime();
        });

        setEvents(upcoming);
      } catch (error) {
        console.error('Error loading agenda:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [institutionId]);

  const todayStr = getLocalDateString();

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
          <CalendarIcon size={16} className="text-[#004c99]" /> Agenda
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {loading ? (
          <div className="text-xs text-gray-400 text-center py-4 font-bold uppercase tracking-widest">Carregando...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
            <CalendarIcon size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-[10px] font-black uppercase tracking-widest">Sem eventos nos<br/>próximos 7 dias</p>
          </div>
        ) : (
          events.map(event => {
            const isToday = event.date === todayStr;
            const eventDate = parseLocalDate(event.date);
            
            return (
              <div key={event.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${isToday ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-600 border shadow-sm'}`}>
                  <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{isToday ? 'HOJE' : eventDate.getDate()}</span>
                  {!isToday && <span className="text-[8px] font-bold uppercase">{eventDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-gray-800 uppercase tracking-tight truncate">{event.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <Clock size={10} /> {event.time || 'Dia todo'}
                    </div>
                  </div>
                  {event.professionalName && (
                    <p className="text-[9px] font-medium text-gray-400 uppercase mt-1 truncate">
                      {event.professionalName} ({event.professionalRole})
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button 
        onClick={onNavigateToAgenda}
        className="mt-4 w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-gray-200"
      >
        Ver Agenda Completa <ChevronRight size={14} />
      </button>
    </div>
  );
};

export default UpcomingAgendaSection;
