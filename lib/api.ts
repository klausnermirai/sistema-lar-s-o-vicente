
export interface Session {
  id?: string;
  cnpj: string;
  username: string;
  accessLevel: string;
  institutionId?: string;
  hierarchy?: {
    type: 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida';
    nacionalId?: string;
    metropolitanoId?: string;
    centralId?: string;
    particularId?: string;
    conferenciaId?: string;
  };
}

export const login = async (credentials: any) => {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao realizar login');
  }
  return response.json();
};

export const setup = async (data: any) => {
  const response = await fetch('/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao realizar setup');
  }
  return response.json();
};

export const fetchResidents = async (institutionId: string, type: string = 'obra_unida') => {
  const response = await fetch(`/api/residents?institutionId=${institutionId}&type=${type}`);
  if (!response.ok) throw new Error('Erro ao buscar residentes');
  return response.json();
};

export const saveResident = async (resident: any) => {
  const response = await fetch('/api/residents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resident)
  });
  if (!response.ok) throw new Error('Erro ao salvar residente');
  return response.json();
};

export const fetchCandidates = async (institutionId: string, type: string = 'obra_unida') => {
  const response = await fetch(`/api/candidates?institutionId=${institutionId}&type=${type}`);
  if (!response.ok) throw new Error('Erro ao buscar candidatos');
  return response.json();
};

export const saveCandidate = async (candidate: any) => {
  const response = await fetch('/api/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(candidate)
  });
  if (!response.ok) throw new Error('Erro ao salvar candidato');
  return response.json();
};

export const bulkSaveCandidates = async (candidates: any[]) => {
  const response = await fetch('/api/candidates/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidates })
  });
  if (!response.ok) throw new Error('Erro ao salvar candidatos em massa');
  return response.json();
};

export const bulkSaveResidents = async (residents: any[]) => {
  const response = await fetch('/api/residents/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ residents })
  });
  if (!response.ok) throw new Error('Erro ao salvar residentes em massa');
  return response.json();
};

export const fetchSettings = async (institutionId: string) => {
  const response = await fetch(`/api/settings?institutionId=${institutionId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Erro ao buscar configurações");
  return response.json();
};

export const saveSettings = async (institutionId: string, settings: any) => {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ institutionId, ...settings })
  });
  if (!response.ok) throw new Error('Erro ao salvar configurações');
  return response.json();
};

export const fetchMural = async (institutionId: string) => {
  const response = await fetch(`/api/mural?institutionId=${institutionId}`);
  if (!response.ok) throw new Error('Erro ao buscar mural');
  return response.json();
};

export const saveMuralMessage = async (message: any) => {
  const response = await fetch('/api/mural', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
  if (!response.ok) throw new Error('Erro ao salvar no mural');
  return response.json();
};

export const fetchUsers = async (institutionId: string) => {
  const response = await fetch(`/api/users?institutionId=${institutionId}`);
  if (!response.ok) throw new Error('Erro ao buscar usuários');
  return response.json();
};

export const saveUser = async (user: any) => {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  if (!response.ok) throw new Error('Erro ao salvar usuário');
  return response.json();
};

export const deleteUser = async (userId: string) => {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Erro ao excluir usuário');
  return response.json();
};

export const deleteCandidate = async (candidateId: string) => {
  const response = await fetch(`/api/candidates/${candidateId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Erro ao excluir candidato');
  return response.json();
};

export const deleteResident = async (residentId: string) => {
  const response = await fetch(`/api/residents/${residentId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Erro ao excluir residente');
  return response.json();
};
