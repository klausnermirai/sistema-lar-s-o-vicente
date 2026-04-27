import { GroupActivity } from '../types';

export const loadGroupActivities = async (institutionId: string): Promise<GroupActivity[]> => {
  const response = await fetch(`/api/groupActivities?institutionId=${institutionId}`);
  if (!response.ok) throw new Error('Erro ao buscar atividades em grupo');
  return response.json();
};

export const saveGroupActivity = async (activity: GroupActivity): Promise<GroupActivity> => {
  const response = await fetch('/api/groupActivities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(activity)
  });
  if (!response.ok) throw new Error('Erro ao salvar atividade em grupo');
  return response.json();
};

export const deleteGroupActivity = async (activityId: string): Promise<void> => {
  const response = await fetch(`/api/groupActivities/${activityId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Erro ao excluir atividade');
};
