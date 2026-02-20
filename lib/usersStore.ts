
export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  accessLevel: 'gerencial';
  password?: string;
}

const STORAGE_KEY = 'ssvp_users';

export const loadUsers = (): User[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return [
    {
      id: 'admin',
      username: 'admin',
      fullName: 'Administrador Padrão',
      role: 'TI / Gestão',
      accessLevel: 'gerencial',
      password: 'admin123'
    }
  ];
};

export const saveUsers = (users: User[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};
