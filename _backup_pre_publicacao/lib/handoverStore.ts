import { ShiftHandover } from '../types.ts';
import { getAuthHeaders, apiFetch } from './api';

export const loadHandovers = async (institutionId: string): Promise<ShiftHandover[]> => {
  const response = await apiFetch(`/api/handovers?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar históricos de plantão');
  return response.json();
};

export const saveHandover = async (handover: ShiftHandover & { institutionId: string }): Promise<ShiftHandover> => {
  const response = await apiFetch('/api/handovers', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(handover)
  });
  if (!response.ok) throw new Error('Erro ao salvar histórico de plantão');
  return response.json();
};
