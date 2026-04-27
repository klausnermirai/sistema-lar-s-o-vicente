import { GroupActivity } from '../types';
import { getAuthHeaders } from './api';

export const loadGroupActivities = async (institutionId: string): Promise<GroupActivity[]> => {
  const response = await fetch(`/api/groupActivities?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar atividades em grupo');
  return response.json();
};

export const saveGroupActivity = async (activity: GroupActivity): Promise<GroupActivity> => {
  const response = await fetch('/api/groupActivities', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(activity)
  });
  if (!response.ok) throw new Error('Erro ao salvar atividade em grupo');
  return response.json();
};

export const deleteGroupActivity = async (activityId: string): Promise<void> => {
  const response = await fetch(`/api/groupActivities/${activityId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir atividade');
};
