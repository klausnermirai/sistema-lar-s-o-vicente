
export class DatabaseUnavailableError extends Error {
  isDbUnavailable = true;
  constructor(message?: string) {
    super(message || 'O banco de dados está temporariamente indisponível. Tente novamente em alguns minutos.');
    this.name = 'DatabaseUnavailableError';
  }
}

let dbUnavailable = false;
type DbAvailabilityListener = (isUnavailable: boolean) => void;
const listeners = new Set<DbAvailabilityListener>();

export const subscribeDbAvailability = (listener: DbAvailabilityListener) => {
  listeners.add(listener);
  listener(dbUnavailable);
  return () => {
    listeners.delete(listener);
  };
};

export const isDbCurrentlyUnavailable = () => dbUnavailable;

export const setDbAvailabilityState = (unavailable: boolean) => {
  if (dbUnavailable !== unavailable) {
    dbUnavailable = unavailable;
    listeners.forEach((fn) => fn(dbUnavailable));
  }
};

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const isMutation = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';

  if (dbUnavailable && isMutation) {
    throw new DatabaseUnavailableError('Gravações e alterações estão bloqueadas enquanto o banco de dados estiver indisponível.');
  }

  const response = await fetch(input, init);

  if (response.status === 503) {
    let errJson: any = null;
    try {
      errJson = await response.clone().json();
    } catch (e) {}

    if (errJson?.error === 'DATABASE_TEMPORARILY_UNAVAILABLE' || errJson?.message?.includes('indisponível')) {
      setDbAvailabilityState(true);
      throw new DatabaseUnavailableError(errJson?.message || 'O banco de dados está temporariamente indisponível.');
    }
  }

  if (response.status !== 503) {
    setDbAvailabilityState(false);
  }

  return response;
}

export interface Session {
  id?: string;
  token?: string;
  cnpj: string;
  username: string;
  fullName?: string;
  role?: string;
  professionalRegistration?: string;
  accessLevel: string;
  mustChangePassword?: boolean;
  isFirstLogin?: boolean;
  membroId?: string;
  conferenciaId?: string;
  particularId?: string;
  conferenciaNome?: string;
  particularNome?: string;
  centralId?: string;
  institutionId?: string;
  signature?: any;
  availableUnits?: Array<{
    id: string;
    name: string;
    cnpj: string;
    type: string;
    city?: string;
    state?: string;
    particularId?: string;
    conferenciaId?: string;
    centralId?: string;
    parentName?: string;
  }>;
  hierarchy?: {
    type: 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida' | string;
    nacionalId?: string;
    metropolitanoId?: string;
    centralId?: string;
    particularId?: string;
    conferenciaId?: string;
    conferenciaNome?: string;
    particularNome?: string;
  };
  boardRoleInfo?: {
    isDirector: boolean;
    roles: string[];
    primaryRole?: string;
    formattedRoleTitle?: string;
    conferenciaId?: string;
    conferenciaNome?: string;
    primeiroNome?: string;
    membroId?: string;
    mandateStartDate?: string;
    mandateEndDate?: string;
  };
}

export const login = async (credentials: any) => {
  const response = await apiFetch('/api/login', {
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

export const forgotPassword = async (data: { email: string; cnpj?: string }) => {
  const response = await apiFetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Erro ao solicitar redefinição de senha');
  }
  return response.json();
};

export const verifyResetToken = async (token: string) => {
  const response = await apiFetch(`/api/verify-reset-token?token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Token de redefinição inválido ou expirado');
  }
  return response.json();
};

export const resetPassword = async (data: { token: string; newPassword: string }) => {
  const response = await apiFetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao redefinir a senha');
  }
  return response.json();
};

export const setup = async (data: any) => {
  const response = await apiFetch('/api/setup', {
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

import { getCanonicalInstitutionId } from './canonical_units';

// Helper function to get auth headers from local storage
export const getAuthHeaders = (customInstitutionId?: string): HeadersInit => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const saved = localStorage.getItem('ssvp_session');
    if (saved) {
      const session = JSON.parse(saved);
      // Credencial autenticada emitida pelo servidor no login (session.token)
      // Não aceita mais ID simples de usuário como credencial
      const token = session.token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        
        let instId = customInstitutionId;
        if (!instId) {
          instId = session.institutionId || session.cnpj;
        }

        if (instId) {
          headers['x-institution-id'] = getCanonicalInstitutionId(instId);
        }
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
  const response = await apiFetch(`/api/residents?institutionId=${institutionId}&type=${type}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar residentes');
  return response.json();
};

export const saveResident = async (resident: any) => {
  const response = await apiFetch('/api/residents', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(resident)
  });
  if (!response.ok) throw new Error('Erro ao salvar residente');
  return response.json();
};

export const fetchResidentById = async (id: string, institutionId: string) => {
  const response = await apiFetch(`/api/residents/${id}?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar residente completo');
  return response.json();
};

export const fetchJobCandidates = async (institutionId: string) => {
  const response = await apiFetch(`/api/job-candidates?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar candidatos a vagas');
  return response.json();
};

export const saveJobCandidate = async (candidate: any) => {
  const response = await apiFetch('/api/job-candidates', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(candidate)
  });
  if (!response.ok) throw new Error('Erro ao salvar candidato a vaga');
  return response.json();
};

export const deleteJobCandidate = async (candidateId: string) => {
  const response = await apiFetch(`/api/job-candidates/${candidateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir candidato a vaga');
  return response.json();
};

export const fetchCandidates = async (institutionId: string, type: string = 'obra_unida') => {
  const response = await apiFetch(`/api/candidates?institutionId=${institutionId}&type=${type}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar candidatos');
  return response.json();
};

export const fetchCandidateById = async (id: string, institutionId: string) => {
  const response = await apiFetch(`/api/candidates/${id}?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar candidato completo');
  return response.json();
};

export const fetchMultidisciplinaryHistory = async (institutionId: string, competence: string) => {
  try {
    const response = await apiFetch(`/api/multidisciplinary/history?institutionId=${institutionId}&competence=${competence}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return [];
    return await response.json();
  } catch (err) {
    console.error('Erro ao buscar histórico multidisciplinar:', err);
    return [];
  }
};

export const saveCandidate = async (candidate: any) => {
  const response = await apiFetch('/api/candidates', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(candidate)
  });
  if (!response.ok) throw new Error('Erro ao salvar candidato');
  return response.json();
};

export const bulkSaveCandidates = async (candidates: any[]) => {
  const response = await apiFetch('/api/candidates/bulk', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ candidates })
  });
  if (!response.ok) throw new Error('Erro ao salvar candidatos em massa');
  return response.json();
};

export const bulkSaveResidents = async (residents: any[]) => {
  const response = await apiFetch('/api/residents/bulk', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ residents })
  });
  if (!response.ok) throw new Error('Erro ao salvar residentes em massa');
  return response.json();
};

export const fetchEmployees = async () => {
  const response = await apiFetch('/api/employees', { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar funcionários');
  return response.json();
};

export const fetchSettings = async (institutionId: string) => {
  const response = await apiFetch(`/api/settings?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Erro ao buscar configurações");
  return response.json();
};

export const saveSettings = async (institutionId: string, settings: any) => {
  const response = await apiFetch('/api/settings', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, ...settings })
  });
  if (!response.ok) throw new Error('Erro ao salvar configurações');
  return response.json();
};

export const fetchMural = async (institutionId: string) => {
  const response = await apiFetch(`/api/mural?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar mural');
  return response.json();
};

export const saveMuralMessage = async (message: any) => {
  const response = await apiFetch('/api/mural', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(message)
  });
  if (!response.ok) throw new Error('Erro ao salvar no mural');
  return response.json();
};

export const fetchUsers = async (institutionId?: string, all: boolean = true) => {
  let url = '/api/users?all=true';
  if (institutionId && !all) {
    url = `/api/users?institutionId=${institutionId}`;
  }
  const response = await apiFetch(url, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar usuários');
  return response.json();
};

export const fetchSystemUnits = async (institutionId?: string) => {
  const response = await apiFetch(`/api/system-units${institutionId ? `?institutionId=${institutionId}` : ''}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar unidades do sistema');
  return response.json();
};

export const saveUser = async (user: any) => {
  const response = await apiFetch('/api/users', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(user)
  });
  if (!response.ok) throw new Error('Erro ao salvar usuário');
  return response.json();
};

export const deleteUser = async (userId: string) => {
  const response = await apiFetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir usuário');
  return response.json();
};

export const deleteCandidate = async (candidateId: string) => {
  const response = await apiFetch(`/api/candidates/${candidateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir candidato');
  return response.json();
};

export const deleteResident = async (residentId: string) => {
  const response = await apiFetch(`/api/residents/${residentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir residente');
  return response.json();
};

export const fetchInventory = async (institutionId: string) => {
  const response = await apiFetch(`/api/inventory?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar estoque');
  return response.json();
};

export const bulkSaveInventory = async (institutionId: string, items: any[]) => {
  const response = await apiFetch('/api/inventory/bulk', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ institutionId, items })
  });
  if (!response.ok) throw new Error('Erro ao salvar estoque de medicamentos');
  return response.json();
};

export const fetchMedicationStockMovements = async (institutionId: string, residentId?: string) => {
  const url = residentId ? `/api/medication_stock_movements?institutionId=${institutionId}&residentId=${residentId}` : `/api/medication_stock_movements?institutionId=${institutionId}`;
  const response = await apiFetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar movimentações de estoque');
  return response.json();
};

export const saveMedicationStockMovement = async (data: any) => {
  const response = await apiFetch('/api/medication_stock_movements', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Erro ao salvar movimentação');
  return response.json();
};

export const fetchMedicationAdministrationLogs = async (institutionId: string, residentId?: string, date?: string) => {
  let url = `/api/medication_administration_logs?institutionId=${institutionId}`;
  if (residentId) url += `&residentId=${residentId}`;
  if (date) url += `&date=${date}`;
  const response = await apiFetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar logs');
  return response.json();
};

export const saveMedicationAdministrationLog = async (data: any) => {
  const response = await apiFetch('/api/medication_administration_logs', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Erro ao salvar log de ministração');
  return response.json();
};

export const fetchGlobalVisits = async (institutionId: string) => {
  const response = await apiFetch(`/api/global-visits?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar visitas');
  return response.json();
};

export const saveGlobalVisit = async (visit: any) => {
  const response = await apiFetch('/api/global-visits', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(visit)
  });
  if (!response.ok) throw new Error('Erro ao salvar visita');
  return response.json();
};

export const fetchCompanions = async (institutionId: string) => {
  const response = await apiFetch(`/api/companions?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar acompanhantes');
  return response.json();
};

export const saveCompanion = async (companion: any) => {
  const response = await apiFetch('/api/companions', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(companion)
  });
  if (!response.ok) throw new Error('Erro ao salvar acompanhante');
  return response.json();
};

export const deleteCompanion = async (id: string) => {
  const response = await apiFetch(`/api/companions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir acompanhante');
  return response.json();
};

export const fetchShifts = async (institutionId: string) => {
  const response = await apiFetch(`/api/shifts?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar turnos');
  return response.json();
};

export const saveShift = async (shift: any) => {
  const response = await apiFetch('/api/shifts', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(shift)
  });
  if (!response.ok) throw new Error('Erro ao salvar turno');
  return response.json();
};

export const deleteShift = async (shiftId: string) => {
  const response = await apiFetch(`/api/shifts/${shiftId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao inativar turno');
  return response.json();
};

export const fetchProcedureLogs = async (institutionId: string, dataOperacional?: string) => {
  let url = `/api/procedures/logs?institutionId=${institutionId}`;
  if (dataOperacional) {
    url += `&dataOperacional=${dataOperacional}`;
  }
  const response = await apiFetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar procedimentos');
  return response.json();
};

export const fetchMeals = async (institutionId: string) => {
  const response = await apiFetch(`/api/meals?institutionId=${institutionId}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar refeições');
  return response.json();
};

export const saveProcedureLog = async (log: any) => {
  const response = await apiFetch('/api/procedures/log', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(log)
  });
  if (!response.ok) throw new Error('Erro ao salvar procedimento');
  return response.json();
};

export const fetchSosProtocols = async (institutionId: string, residentId?: string) => {
  let url = `/api/sos-protocols?institutionId=${institutionId}`;
  if (residentId) {
    url += `&residentId=${residentId}`;
  }
  const response = await apiFetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar condutas SOS');
  return response.json();
};

export const saveSosProtocol = async (protocol: any) => {
  const response = await apiFetch('/api/sos-protocols', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(protocol)
  });
  if (!response.ok) throw new Error('Erro ao salvar conduta SOS');
  return response.json();
};

export const fetchStockProducts = async () => {
  const response = await apiFetch('/api/stock-products', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar produtos do estoque');
  return response.json();
};

export const saveStockProduct = async (item: any) => {
  const response = await apiFetch('/api/stock-products', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(item)
  });
  if (response.status === 409) {
    const errJson = await response.json().catch(() => ({}));
    const err: any = new Error(errJson.error || 'Já existe um produto idêntico cadastrado nesta instituição.');
    err.code = errJson.code || 'PRODUCT_DUPLICATE';
    err.status = 409;
    err.existingProductId = errJson.existingProductId;
    err.existingProduct = errJson.existingProduct;
    throw err;
  }
  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || 'Erro ao salvar produto no estoque');
  }
  return response.json();
};

export const deleteStockProduct = async (id: string) => {
  const response = await apiFetch(`/api/stock-products/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir produto do estoque');
  return response.json();
};

export const bootstrapStockProducts = async (items: any[]) => {
  const response = await apiFetch('/api/stock-products/bulk-bootstrap', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ items })
  });
  if (!response.ok) throw new Error('Erro ao carregar catálogo de produtos');
  return response.json();
};

export const fetchStockMovements = async () => {
  const response = await apiFetch('/api/stock-movements', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar histórico de movimentações');
  return response.json();
};

export const registerStockMovement = async (movement: any) => {
  const response = await apiFetch('/api/stock-movements', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(movement)
  });
  if (!response.ok) throw new Error('Erro ao registrar movimentação de estoque');
  return response.json();
};

export const fetchSuppliers = async () => {
  const response = await apiFetch('/api/suppliers', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar fornecedores');
  return response.json();
};

export const saveSupplier = async (supplier: any) => {
  const response = await apiFetch('/api/suppliers', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(supplier)
  });
  if (!response.ok) throw new Error('Erro ao salvar fornecedor');
  return response.json();
};

export const deleteSupplier = async (id: string) => {
  const response = await apiFetch(`/api/suppliers/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir fornecedor');
  return response.json();
};

export const fetchDonors = async () => {
  const response = await apiFetch('/api/donors', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar doadores');
  return response.json();
};

export const saveDonor = async (donor: any) => {
  const response = await apiFetch('/api/donors', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(donor)
  });
  if (!response.ok) throw new Error('Erro ao salvar doador');
  return response.json();
};

export const deleteDonor = async (id: string) => {
  const response = await apiFetch(`/api/donors/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir doador');
  return response.json();
};

export const fetchBenefactors = async () => {
  const response = await apiFetch('/api/benefactors', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar benfeitores');
  return response.json();
};

export const saveBenefactor = async (benefactor: any) => {
  const response = await apiFetch('/api/benefactors', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(benefactor)
  });
  if (!response.ok) throw new Error('Erro ao salvar benfeitor');
  return response.json();
};

export const deleteBenefactor = async (id: string) => {
  const response = await apiFetch(`/api/benefactors/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir benfeitor');
  return response.json();
};

export const fetchDonationCategories = async () => {
  const response = await apiFetch('/api/donation-categories', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar categorias de doação');
  return response.json();
};

export const saveDonationCategory = async (category: any) => {
  const response = await apiFetch('/api/donation-categories', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(category)
  });
  if (!response.ok) throw new Error('Erro ao salvar categoria de doação');
  return response.json();
};

export const deleteDonationCategory = async (id: string) => {
  const response = await apiFetch(`/api/donation-categories/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir categoria de doação');
  return response.json();
};

export const fetchDonations = async (startDate?: string, endDate?: string) => {
  let url = '/api/donations';
  const params: string[] = [];
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  if (params.length > 0) url += `?${params.join('&')}`;
  
  const response = await apiFetch(url, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar doações');
  return response.json();
};

export const saveDonation = async (donation: any) => {
  const response = await apiFetch('/api/donations', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(donation)
  });
  if (!response.ok) throw new Error('Erro ao salvar doação');
  return response.json();
};

export const deleteDonation = async (id: string) => {
  const response = await apiFetch(`/api/donations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir doação');
  return response.json();
};

export const fetchCarnes = async (ano?: number) => {
  let url = '/api/carnes';
  if (ano) url += `?ano=${ano}`;
  const response = await apiFetch(url, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar carnês');
  return response.json();
};

export const saveCarne = async (carne: any) => {
  const response = await apiFetch('/api/carnes', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(carne)
  });
  if (!response.ok) throw new Error('Erro ao salvar carnê');
  return response.json();
};

export const payCarneParcelas = async (carneId: string, payload: { numeros: number[], dataPagamento: string, formaPagamento: string, categoryId?: string, notes?: string }) => {
  const response = await apiFetch(`/api/carnes/${carneId}/pay-parcelas`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Erro ao dar baixa nas parcelas do carnê');
  return response.json();
};

export const deleteCarne = async (id: string) => {
  const response = await apiFetch(`/api/carnes/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao cancelar carnê');
  return response.json();
};

export const logCarneWhatsApp = async (carneId: string, payload: { messageType: 'agradecimento' | 'lembrete', parcelaNumero?: number, textPreview?: string, phone?: string }) => {
  const response = await apiFetch(`/api/carnes/${carneId}/log-whatsapp`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Erro ao registrar comunicação via WhatsApp');
  return response.json();
};

export const fetchCaixinhaMovements = async (startDate?: string, endDate?: string) => {
  let url = '/api/caixinha';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) url += `?${params.toString()}`;

  const response = await apiFetch(url, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar movimentações da caixinha');
  return response.json();
};

export const saveCaixinhaMovement = async (movement: any) => {
  const response = await apiFetch('/api/caixinha', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(movement)
  });
  if (!response.ok) throw new Error('Erro ao salvar movimentação da caixinha');
  return response.json();
};

export const deleteCaixinhaMovement = async (id: string) => {
  const response = await apiFetch(`/api/caixinha/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir movimentação da caixinha');
  return response.json();
};

export const fetchConferenciaById = async (id: string) => {
  const response = await apiFetch(`/api/conferencias/${id}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar dados da conferência');
  return response.json();
};



