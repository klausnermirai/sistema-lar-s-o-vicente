import { GroupActivity } from '../types';

const GROUP_ACTIVITY_KEY = 'ssvp_group_activities';

export const loadGroupActivities = (institutionId: string): GroupActivity[] => {
  const saved = localStorage.getItem(GROUP_ACTIVITY_KEY);
  if (!saved) return [];
  const allActivities: GroupActivity[] = JSON.parse(saved);
  return allActivities.filter(a => a.institutionId === institutionId);
};

export const saveGroupActivity = (activity: GroupActivity) => {
  const saved = localStorage.getItem(GROUP_ACTIVITY_KEY);
  const allActivities: GroupActivity[] = saved ? JSON.parse(saved) : [];
  allActivities.push(activity);
  localStorage.setItem(GROUP_ACTIVITY_KEY, JSON.stringify(allActivities));
};
