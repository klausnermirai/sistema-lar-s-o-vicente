import { AgendaEvent } from '../types.ts';
import { getAuthHeaders, apiFetch } from './api';

export const loadAgendaEvents = async (institutionId: string): Promise<AgendaEvent[]> => {
  const response = await apiFetch(`/api/agenda?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar agenda');
  return response.json();
};

export const saveAgendaEvent = async (event: AgendaEvent): Promise<AgendaEvent> => {
  const response = await apiFetch('/api/agenda', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error('Erro ao salvar evento');
  return response.json();
};

export const deleteAgendaEvent = async (eventId: string): Promise<void> => {
  const response = await apiFetch(`/api/agenda/${eventId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir evento');
};
