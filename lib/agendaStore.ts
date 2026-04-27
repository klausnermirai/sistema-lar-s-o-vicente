import { AgendaEvent } from '../types';

export const loadAgendaEvents = async (institutionId: string): Promise<AgendaEvent[]> => {
  const response = await fetch(`/api/agenda?institutionId=${institutionId}`);
  if (!response.ok) throw new Error('Erro ao buscar agenda');
  return response.json();
};

export const saveAgendaEvent = async (event: AgendaEvent): Promise<AgendaEvent> => {
  const response = await fetch('/api/agenda', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error('Erro ao salvar evento');
  return response.json();
};

export const deleteAgendaEvent = async (eventId: string): Promise<void> => {
  const response = await fetch(`/api/agenda/${eventId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Erro ao excluir evento');
};
