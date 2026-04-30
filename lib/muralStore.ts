import { MuralMessage } from '../types';

const MURAL_KEY = 'ssvp_mural_messages';

export const loadMuralMessages = (institutionId: string): MuralMessage[] => {
  const saved = localStorage.getItem(MURAL_KEY);
  if (!saved) return [];
  const allMessages: MuralMessage[] = JSON.parse(saved);
  return allMessages.filter(m => m.institutionId === institutionId);
};

export const saveMuralMessage = (message: MuralMessage) => {
  const saved = localStorage.getItem(MURAL_KEY);
  const allMessages: MuralMessage[] = saved ? JSON.parse(saved) : [];
  allMessages.push(message);
  localStorage.setItem(MURAL_KEY, JSON.stringify(allMessages));
  
  // Dispatch custom event for cross-component updates
  window.dispatchEvent(new Event('mural_updated'));
};

export const toggleMuralLike = (messageId: string, username: string) => {
  const saved = localStorage.getItem(MURAL_KEY);
  if (!saved) return;
  const allMessages: MuralMessage[] = JSON.parse(saved);
  
  const updatedMessages = allMessages.map(msg => {
    if (msg.id === messageId) {
      const likes = msg.likes || [];
      if (likes.includes(username)) {
        return { ...msg, likes: likes.filter(u => u !== username) };
      } else {
        return { ...msg, likes: [...likes, username] };
      }
    }
    return msg;
  });
  
  localStorage.setItem(MURAL_KEY, JSON.stringify(updatedMessages));
  window.dispatchEvent(new Event('mural_updated'));
};

export const getLastReadTimestamp = (institutionId: string, username: string): number => {
  const key = `ssvp_mural_read_${institutionId}_${username}`;
  const saved = localStorage.getItem(key);
  return saved ? parseInt(saved, 10) : 0;
};

export const setLastReadTimestamp = (institutionId: string, username: string, timestamp: number) => {
  const key = `ssvp_mural_read_${institutionId}_${username}`;
  localStorage.setItem(key, timestamp.toString());
  window.dispatchEvent(new Event('mural_read_updated'));
};

export const getUnreadCount = (institutionId: string, username: string): number => {
  const messages = loadMuralMessages(institutionId);
  const lastRead = getLastReadTimestamp(institutionId, username);
  return messages.filter(m => m.timestamp > lastRead).length;
};
