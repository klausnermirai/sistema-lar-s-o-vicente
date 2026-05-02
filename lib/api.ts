
export interface Session {
  id?: string;
  cnpj: string;
  username: string;
  fullName?: string;
  role?: string;
  professionalRegistration?: string;
  accessLevel: string;
  institutionId?: string;
  signature?: any;
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

// Helper function to get auth headers from local storage
export const getAuthHeaders = (): HeadersInit => {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  try {
    const saved = localStorage.getItem('ssvp_session');
    if (saved) {
      const session = JSON.parse(saved);
      if (session.id) {
        headers['Authorization'] = `Bearer ${session.id}`;
        headers['x-institution-id'] = session.institutionId || session.cnpj;
      }
    }
  } catch (e) {}
  return headers;
};

export const getProfessionalSignature = () => {
    try {
        const saved = localStorage.getItem('ssvp_session');
        if (!saved) return {};
        const session = JSON.parse(saved);
        if (session.signature && session.signature.profissionalAssinaturaTexto) {
            return session.signature;
        }

        let fullName = session.fullName;
        if (!fullName || fullName.includes('@')) {
            fullName = 'Profissional não identificado';
        }

        const role = session.role || 'Profissional';
        const registration = session.professionalRegistration ? `\n${session.professionalRegistration}` : '';

        return {
             profissionalId: session.id,
             profissionalNome: fullName,
             profissionalFuncao: role,
             profissionalAssinaturaTexto: `${fullName}\n${role}${registration}`
        };
    } catch (e) {
        return {};
    }
};

export const fetchResidents = async (institutionId: string, type: string = 'obra_unida') => {
  const response = await fetch(`/api/residents?institutionId=${institutionId}&type=${type}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar residentes');
  return response.json();
};

export const saveResident = async (resident: any) => {
  const response = await fetch('/api/residents', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(resident)
  });
  if (!response.ok) throw new Error('Erro ao salvar residente');
  return response.json();
};

export const fetchResidentById = async (id: string, institutionId: string) => {
  const response = await fetch(`/api/residents/${id}?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar residente completo');
  return response.json();
};

export const fetchJobCandidates = async (institutionId: string) => {
  const response = await fetch(`/api/job-candidates?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar candidatos a vagas');
  return response.json();
};

export const saveJobCandidate = async (candidate: any) => {
  const response = await fetch('/api/job-candidates', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(candidate)
  });
  if (!response.ok) throw new Error('Erro ao salvar candidato a vaga');
  return response.json();
};

export const deleteJobCandidate = async (candidateId: string) => {
  const response = await fetch(`/api/job-candidates/${candidateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir candidato a vaga');
  return response.json();
};

export const fetchCandidates = async (institutionId: string, type: string = 'obra_unida') => {
  const response = await fetch(`/api/candidates?institutionId=${institutionId}&type=${type}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar candidatos');
  return response.json();
};

export const fetchCandidateById = async (id: string, institutionId: string) => {
  const response = await fetch(`/api/candidates/${id}?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar candidato completo');
  return response.json();
};

export const fetchMultidisciplinaryHistory = async (institutionId: string, competence: string) => {
  const response = await fetch(`/api/multidisciplinary/history?institutionId=${institutionId}&competence=${competence}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar histórico multidisciplinar');
  return response.json();
};

export const saveCandidate = async (candidate: any) => {
  const response = await fetch('/api/candidates', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(candidate)
  });
  if (!response.ok) throw new Error('Erro ao salvar candidato');
  return response.json();
};

export const bulkSaveCandidates = async (candidates: any[]) => {
  const response = await fetch('/api/candidates/bulk', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ candidates })
  });
  if (!response.ok) throw new Error('Erro ao salvar candidatos em massa');
  return response.json();
};

export const bulkSaveResidents = async (residents: any[]) => {
  const response = await fetch('/api/residents/bulk', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ residents })
  });
  if (!response.ok) throw new Error('Erro ao salvar residentes em massa');
  return response.json();
};

export const fetchSettings = async (institutionId: string) => {
  const response = await fetch(`/api/settings?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Erro ao buscar configurações");
  return response.json();
};

export const saveSettings = async (institutionId: string, settings: any) => {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, ...settings })
  });
  if (!response.ok) throw new Error('Erro ao salvar configurações');
  return response.json();
};

export const fetchMural = async (institutionId: string) => {
  const response = await fetch(`/api/mural?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar mural');
  return response.json();
};

export const saveMuralMessage = async (message: any) => {
  const response = await fetch('/api/mural', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(message)
  });
  if (!response.ok) throw new Error('Erro ao salvar no mural');
  return response.json();
};

export const fetchUsers = async (institutionId: string) => {
  const response = await fetch(`/api/users?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar usuários');
  return response.json();
};

export const saveUser = async (user: any) => {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(user)
  });
  if (!response.ok) throw new Error('Erro ao salvar usuário');
  return response.json();
};

export const deleteUser = async (userId: string) => {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir usuário');
  return response.json();
};

export const deleteCandidate = async (candidateId: string) => {
  const response = await fetch(`/api/candidates/${candidateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir candidato');
  return response.json();
};

export const deleteResident = async (residentId: string) => {
  const response = await fetch(`/api/residents/${residentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir residente');
  return response.json();
};

export const fetchInventory = async (institutionId: string) => {
  const response = await fetch(`/api/inventory?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar estoque');
  return response.json();
};

export const bulkSaveInventory = async (institutionId: string, items: any[]) => {
  const response = await fetch('/api/inventory/bulk', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, items })
  });
  if (!response.ok) throw new Error('Erro ao salvar estoque de medicamentos');
  return response.json();
};

export const fetchGlobalVisits = async (institutionId: string) => {
  const response = await fetch(`/api/global-visits?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar visitas');
  return response.json();
};

export const saveGlobalVisit = async (visit: any) => {
  const response = await fetch('/api/global-visits', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(visit)
  });
  if (!response.ok) throw new Error('Erro ao salvar visita');
  return response.json();
};

export const fetchCompanions = async (institutionId: string) => {
  const response = await fetch(`/api/companions?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar acompanhantes');
  return response.json();
};

export const saveCompanion = async (companion: any) => {
  const response = await fetch('/api/companions', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(companion)
  });
  if (!response.ok) throw new Error('Erro ao salvar acompanhante');
  return response.json();
};

export const deleteCompanion = async (id: string) => {
  const response = await fetch(`/api/companions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir acompanhante');
  return response.json();
};
