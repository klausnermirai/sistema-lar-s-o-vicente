
import { getAuthHeaders, apiFetch } from './api';

export interface SupportMessage {
  id?: string;
  institutionId: string;
  text: string;
  sender: string;
  role: 'user' | 'support';
  createdAt: string;
}

export async function fetchSupportMessages(institutionId: string): Promise<SupportMessage[]> {
  const response = await apiFetch(`/api/support/messages?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar mensagens de suporte');
  return response.json();
}

export async function sendSupportMessage(institutionId: string, text: string, sender: string): Promise<SupportMessage> {
  const response = await apiFetch('/api/support/messages', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, text, sender, role: 'user' })
  });
  if (!response.ok) throw new Error('Erro ao enviar mensagem de suporte');
  return response.json();
}
