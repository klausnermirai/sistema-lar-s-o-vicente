import { AgendaEvent, GroupActivity, Resident } from '../types.ts';
import { getAuthHeaders, apiFetch } from './api';

export const loadGroupActivities = async (institutionId: string): Promise<GroupActivity[]> => {
  const response = await apiFetch(`/api/groupActivities?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar atividades em grupo');
  return response.json();
};

export const saveGroupActivity = async (activity: GroupActivity): Promise<GroupActivity> => {
  const response = await apiFetch('/api/groupActivities', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(activity)
  });
  if (!response.ok) throw new Error('Erro ao salvar atividade em grupo');
  return response.json();
};

export const deleteGroupActivity = async (activityId: string): Promise<void> => {
  const response = await apiFetch(`/api/groupActivities/${activityId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir atividade');
};


export const buildGroupActivityAgendaEvent = (activity: GroupActivity): AgendaEvent => ({
  id: `ga-${activity.id}`,
  institutionId: activity.institutionId,
  title: `Atividade em Grupo: ${activity.type} (${activity.competence.replace('_', ' ')})`,
  date: activity.date,
  time: activity.time,
  description: activity.description,
  professionalName: activity.responsibleProfessional,
  professionalRole: activity.competence,
  type: 'atividade_grupo',
  status: activity.status === 'realizada' ? 'finalizado' : activity.status === 'cancelada' ? 'cancelado' : 'agendado'
});

export const syncGroupActivityResidents = (
  activity: GroupActivity,
  residents: Resident[],
  onSaveResident?: (resident: Resident) => void
) => {
  if (!onSaveResident) return;

  residents.forEach((resident) => {
    const shouldInclude = activity.participationType === 'Todos os residentes'
      || activity.selectedResidents.includes(resident.id);

    let current: GroupActivity[] = [];
    let updateResident: Resident = resident;

    if (activity.competence === 'nutricionista') {
      current = resident.nutrition?.groupActivities || [];
      const next = shouldInclude
        ? (current.some(a => a.id === activity.id)
          ? current.map(a => a.id === activity.id ? activity : a)
          : [activity, ...current])
        : current.filter(a => a.id !== activity.id);
      if (next === current || (next.length === current.length && next.every((a, i) => a === current[i]))) return;
      updateResident = { ...resident, nutrition: { ...resident.nutrition, groupActivities: next } };
    } else if (activity.competence === 'psicologia') {
      current = resident.psychology?.groupActivities || [];
      const next = shouldInclude
        ? (current.some(a => a.id === activity.id)
          ? current.map(a => a.id === activity.id ? activity : a)
          : [activity, ...current])
        : current.filter(a => a.id !== activity.id);
      if (next === current || (next.length === current.length && next.every((a, i) => a === current[i]))) return;
      updateResident = { ...resident, psychology: { ...resident.psychology, groupActivities: next } };
    } else if (activity.competence === 'terapeuta_ocupacional') {
      current = resident.occupationalTherapy?.groupActivities || [];
      const next = shouldInclude
        ? (current.some(a => a.id === activity.id)
          ? current.map(a => a.id === activity.id ? activity : a)
          : [activity, ...current])
        : current.filter(a => a.id !== activity.id);
      if (next === current || (next.length === current.length && next.every((a, i) => a === current[i]))) return;
      updateResident = { ...resident, occupationalTherapy: { ...resident.occupationalTherapy, groupActivities: next } };
    } else if (activity.competence === 'fisioterapeuta') {
      current = resident.physiotherapy?.groupActivities || [];
      const next = shouldInclude
        ? (current.some(a => a.id === activity.id)
          ? current.map(a => a.id === activity.id ? activity : a)
          : [activity, ...current])
        : current.filter(a => a.id !== activity.id);
      if (next === current || (next.length === current.length && next.every((a, i) => a === current[i]))) return;
      updateResident = { ...resident, physiotherapy: { ...resident.physiotherapy, groupActivities: next } };
    }

    onSaveResident(updateResident);
  });
};
