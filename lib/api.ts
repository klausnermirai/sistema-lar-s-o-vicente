
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

export const fetchEmployees = async () => {
  const response = await fetch('/api/employees', { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar funcionários');
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

export const fetchMedicationStockMovements = async (institutionId: string, residentId?: string) => {
  const url = residentId ? `/api/medication_stock_movements?institutionId=${institutionId}&residentId=${residentId}` : `/api/medication_stock_movements?institutionId=${institutionId}`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar movimentações de estoque');
  return response.json();
};

export const saveMedicationStockMovement = async (data: any) => {
  const response = await fetch('/api/medication_stock_movements', {
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
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar logs');
  return response.json();
};

export const saveMedicationAdministrationLog = async (data: any) => {
  const response = await fetch('/api/medication_administration_logs', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Erro ao salvar log de ministração');
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

export const fetchShifts = async (institutionId: string) => {
  const response = await fetch(`/api/shifts?institutionId=${institutionId}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar turnos');
  return response.json();
};

export const saveShift = async (shift: any) => {
  const response = await fetch('/api/shifts', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(shift)
  });
  if (!response.ok) throw new Error('Erro ao salvar turno');
  return response.json();
};

export const deleteShift = async (shiftId: string) => {
  const response = await fetch(`/api/shifts/${shiftId}`, {
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
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar procedimentos');
  return response.json();
};

export const fetchMeals = async (institutionId: string) => {
  const response = await fetch(`/api/meals?institutionId=${institutionId}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar refeições');
  return response.json();
};

export const saveProcedureLog = async (log: any) => {
  const response = await fetch('/api/procedures/log', {
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
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erro ao buscar condutas SOS');
  return response.json();
};

export const saveSosProtocol = async (protocol: any) => {
  const response = await fetch('/api/sos-protocols', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(protocol)
  });
  if (!response.ok) throw new Error('Erro ao salvar conduta SOS');
  return response.json();
};

export const fetchStockProducts = async () => {
  const response = await fetch('/api/stock-products', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar produtos do estoque');
  return response.json();
};

export const saveStockProduct = async (item: any) => {
  const response = await fetch('/api/stock-products', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(item)
  });
  if (!response.ok) throw new Error('Erro ao salvar produto no estoque');
  return response.json();
};

export const deleteStockProduct = async (id: string) => {
  const response = await fetch(`/api/stock-products/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir produto do estoque');
  return response.json();
};

export const bootstrapStockProducts = async (items: any[]) => {
  const response = await fetch('/api/stock-products/bulk-bootstrap', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ items })
  });
  if (!response.ok) throw new Error('Erro ao carregar catálogo de produtos');
  return response.json();
};

export const fetchStockMovements = async () => {
  const response = await fetch('/api/stock-movements', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar histórico de movimentações');
  return response.json();
};

export const registerStockMovement = async (movement: any) => {
  const response = await fetch('/api/stock-movements', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(movement)
  });
  if (!response.ok) throw new Error('Erro ao registrar movimentação de estoque');
  return response.json();
};

export const fetchSuppliers = async () => {
  const response = await fetch('/api/suppliers', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar fornecedores');
  return response.json();
};

export const saveSupplier = async (supplier: any) => {
  const response = await fetch('/api/suppliers', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(supplier)
  });
  if (!response.ok) throw new Error('Erro ao salvar fornecedor');
  return response.json();
};

export const deleteSupplier = async (id: string) => {
  const response = await fetch(`/api/suppliers/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir fornecedor');
  return response.json();
};

export const fetchDonors = async () => {
  const response = await fetch('/api/donors', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar doadores');
  return response.json();
};

export const saveDonor = async (donor: any) => {
  const response = await fetch('/api/donors', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(donor)
  });
  if (!response.ok) throw new Error('Erro ao salvar doador');
  return response.json();
};

export const deleteDonor = async (id: string) => {
  const response = await fetch(`/api/donors/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir doador');
  return response.json();
};

export const fetchBenefactors = async () => {
  const response = await fetch('/api/benefactors', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar benfeitores');
  return response.json();
};

export const saveBenefactor = async (benefactor: any) => {
  const response = await fetch('/api/benefactors', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(benefactor)
  });
  if (!response.ok) throw new Error('Erro ao salvar benfeitor');
  return response.json();
};

export const deleteBenefactor = async (id: string) => {
  const response = await fetch(`/api/benefactors/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir benfeitor');
  return response.json();
};

export const fetchDonationCategories = async () => {
  const response = await fetch('/api/donation-categories', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar categorias de doação');
  return response.json();
};

export const saveDonationCategory = async (category: any) => {
  const response = await fetch('/api/donation-categories', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(category)
  });
  if (!response.ok) throw new Error('Erro ao salvar categoria de doação');
  return response.json();
};

export const deleteDonationCategory = async (id: string) => {
  const response = await fetch(`/api/donation-categories/${id}`, {
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
  
  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao buscar doações');
  return response.json();
};

export const saveDonation = async (donation: any) => {
  const response = await fetch('/api/donations', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(donation)
  });
  if (!response.ok) throw new Error('Erro ao salvar doação');
  return response.json();
};

export const deleteDonation = async (id: string) => {
  const response = await fetch(`/api/donations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Erro ao excluir doação');
  return response.json();
};

