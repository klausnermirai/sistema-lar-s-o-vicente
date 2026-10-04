import { apiFetch, getAuthHeaders } from './api';
import {
  StandaloneConselhoParticular,
  StandaloneConferencia,
  MembroSSVP,
  FamiliaAssistidaCompleta,
  FichaSindicanciaData,
  VisitaFamiliaSSVP,
  ControleCestasMensalStats,
} from '../types';

export class HierarchyApiError extends Error {
  code?: string;
  statusCode?: number;
  data?: any;

  constructor(message: string, code?: string, statusCode?: number, data?: any) {
    super(message);
    this.name = 'HierarchyApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.data = data;
  }
}

async function handleHierarchyResponse<T>(response: Response, defaultErrorMessage: string): Promise<T> {
  if (!response.ok) {
    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {
      // Ignora erro de JSON
    }
    const message = errorData?.error || errorData?.message || defaultErrorMessage;
    const code = errorData?.code;
    throw new HierarchyApiError(message, code, response.status, errorData);
  }
  return response.json();
}

/**
 * Função utilitária defensiva para extrair arrays de respostas da API
 * com suporte tanto a formatos paginados ({ items: [...] }) quanto arrays diretos ([...]),
 * protegendo contra respostas vazias ou nulas sem quebrar a renderização.
 */
export function extractHierarchyList<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  return [];
}

/**
 * Busca a lista de Conselhos Particulares vinculados ao Conselho Central do usuário autenticado.
 */
export async function fetchConselhosParticulares(
  status?: 'ativo' | 'inativo',
  customInstitutionId?: string
): Promise<StandaloneConselhoParticular[]> {
  const queryParams = new URLSearchParams();
  if (status) {
    queryParams.set('status', status);
  }
  const url = `/api/conselhos-particulares${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiFetch(url, {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });
  const data = await handleHierarchyResponse<any>(response, 'Erro ao carregar Conselhos Particulares.');
  return extractHierarchyList<StandaloneConselhoParticular>(data);
}

/**
 * Cria um novo Conselho Particular sob o Conselho Central autenticado.
 */
export async function createConselhoParticular(
  data: Partial<StandaloneConselhoParticular>,
  customInstitutionId?: string
): Promise<StandaloneConselhoParticular> {
  const response = await apiFetch('/api/conselhos-particulares', {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify(data),
  });
  return handleHierarchyResponse<StandaloneConselhoParticular>(response, 'Erro ao cadastrar Conselho Particular.');
}

/**
 * Atualiza os dados de um Conselho Particular existente.
 */
export async function updateConselhoParticular(
  id: string,
  data: Partial<StandaloneConselhoParticular>,
  customInstitutionId?: string
): Promise<StandaloneConselhoParticular> {
  const response = await apiFetch(`/api/conselhos-particulares/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify(data),
  });
  return handleHierarchyResponse<StandaloneConselhoParticular>(response, 'Erro ao atualizar Conselho Particular.');
}

/**
 * Inativa um Conselho Particular (não exclui registro do banco).
 */
export async function inactivateConselhoParticular(
  id: string,
  customInstitutionId?: string
): Promise<StandaloneConselhoParticular> {
  const response = await apiFetch(`/api/conselhos-particulares/${encodeURIComponent(id)}/inativar`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
  });
  return handleHierarchyResponse<StandaloneConselhoParticular>(response, 'Erro ao inativar Conselho Particular.');
}

/**
 * Busca as Conferências vinculadas a um Conselho Particular.
 */
export async function fetchConferencias(
  particularId: string,
  status?: 'ativo' | 'inativo',
  customInstitutionId?: string
): Promise<StandaloneConferencia[]> {
  const queryParams = new URLSearchParams();
  if (status) {
    queryParams.set('status', status);
  }
  const url = `/api/conselhos-particulares/${encodeURIComponent(particularId)}/conferencias${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;
  const response = await apiFetch(url, {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });
  const data = await handleHierarchyResponse<any>(response, 'Erro ao carregar Conferências.');
  return extractHierarchyList<StandaloneConferencia>(data);
}

/**
 * Cria uma nova Conferência vinculada ao Conselho Particular.
 */
export async function createConferencia(
  particularId: string,
  data: Partial<StandaloneConferencia>,
  customInstitutionId?: string
): Promise<StandaloneConferencia> {
  const response = await apiFetch(`/api/conselhos-particulares/${encodeURIComponent(particularId)}/conferencias`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify(data),
  });
  return handleHierarchyResponse<StandaloneConferencia>(response, 'Erro ao cadastrar Conferência.');
}

/**
 * Atualiza os dados de uma Conferência existente.
 */
export async function updateConferencia(
  particularId: string,
  id: string,
  data: Partial<StandaloneConferencia>,
  customInstitutionId?: string
): Promise<StandaloneConferencia> {
  const response = await apiFetch(
    `/api/conselhos-particulares/${encodeURIComponent(particularId)}/conferencias/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: getAuthHeaders(customInstitutionId),
      body: JSON.stringify(data),
    }
  );
  return handleHierarchyResponse<StandaloneConferencia>(response, 'Erro ao atualizar Conferência.');
}

/**
 * Inativa uma Conferência (não exclui registro do banco).
 */
export async function inactivateConferencia(
  particularId: string,
  id: string,
  customInstitutionId?: string
): Promise<StandaloneConferencia> {
  const response = await apiFetch(
    `/api/conselhos-particulares/${encodeURIComponent(particularId)}/conferencias/${encodeURIComponent(id)}/inativar`,
    {
      method: 'POST',
      headers: getAuthHeaders(customInstitutionId),
    }
  );
  return handleHierarchyResponse<StandaloneConferencia>(response, 'Erro ao inativar Conferência.');
}

/**
 * Busca a lista de membros vinculados a uma Conferência.
 */
export async function fetchMembrosConferencia(
  conferenciaId: string,
  options?: { status?: 'ativo' | 'inativo' | 'todos'; type?: string },
  customInstitutionId?: string
): Promise<MembroSSVP[]> {
  const queryParams = new URLSearchParams();
  if (options?.status) {
    queryParams.set('status', options.status);
  }
  if (options?.type) {
    queryParams.set('type', options.type);
  }
  const url = `/api/conferencias/${encodeURIComponent(conferenciaId)}/membros${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;
  const response = await apiFetch(url, {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });
  const data = await handleHierarchyResponse<any>(response, 'Erro ao carregar membros da Conferência.');
  return extractHierarchyList<MembroSSVP>(data);
}

/**
 * Cadastra um novo membro vinculado à Conferência.
 */
export async function createMembroConferencia(
  conferenciaId: string,
  data: Partial<MembroSSVP>,
  customInstitutionId?: string
): Promise<MembroSSVP> {
  const response = await apiFetch(`/api/conferencias/${encodeURIComponent(conferenciaId)}/membros`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify(data),
  });
  return handleHierarchyResponse<MembroSSVP>(response, 'Erro ao cadastrar membro.');
}

/**
 * Atualiza os dados de um membro existente na Conferência.
 */
export async function updateMembroConferencia(
  conferenciaId: string,
  id: string,
  data: Partial<MembroSSVP>,
  customInstitutionId?: string
): Promise<MembroSSVP> {
  const response = await apiFetch(
    `/api/conferencias/${encodeURIComponent(conferenciaId)}/membros/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: getAuthHeaders(customInstitutionId),
      body: JSON.stringify(data),
    }
  );
  return handleHierarchyResponse<MembroSSVP>(response, 'Erro ao atualizar dados do membro.');
}

/**
 * Inativa um membro da Conferência (não exclui do banco).
 */
export async function inactivateMembroConferencia(
  conferenciaId: string,
  id: string,
  customInstitutionId?: string
): Promise<MembroSSVP> {
  const response = await apiFetch(
    `/api/conferencias/${encodeURIComponent(conferenciaId)}/membros/${encodeURIComponent(id)}/inativar`,
    {
      method: 'POST',
      headers: getAuthHeaders(customInstitutionId),
    }
  );
  return handleHierarchyResponse<MembroSSVP>(response, 'Erro ao inativar membro.');
}

/**
 * Executa uma ação administrativa de acesso na ficha do membro:
 * - 'generate': Gerar ou tentar gerar acesso
 * - 'reset-password': Redefinir senha para DDMM
 * - 'block': Bloquear acesso
 * - 'unblock': Desbloquear acesso
 */
export async function performMemberAccessAction(
  conferenciaId: string,
  id: string,
  action: 'generate' | 'reset-password' | 'block' | 'unblock',
  customInstitutionId?: string
): Promise<{ success: boolean; data: MembroSSVP }> {
  const response = await apiFetch(
    `/api/conferencias/${encodeURIComponent(conferenciaId)}/membros/${encodeURIComponent(id)}/access-action`,
    {
      method: 'POST',
      headers: getAuthHeaders(customInstitutionId),
      body: JSON.stringify({ action }),
    }
  );
  return handleHierarchyResponse<{ success: boolean; data: MembroSSVP }>(
    response,
    'Erro ao processar ação de acesso do membro.'
  );
}


/**
 * Consulta a configuração do token público do Conselho Central autenticado.
 */
export async function fetchCentralPublicTokenConfig(customInstitutionId?: string): Promise<any> {
  const response = await apiFetch('/api/hierarchy/central/public-token', {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao carregar token público do Conselho Central.');
}

/**
 * Gera ou regenera o token público do Conselho Central autenticado.
 */
export async function generateCentralPublicToken(customInstitutionId?: string): Promise<any> {
  const response = await apiFetch('/api/hierarchy/central/public-token/generate', {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao gerar token público do Conselho Central.');
}

/**
 * Revoga/desativa o token público do Conselho Central autenticado.
 */
export async function revokeCentralPublicToken(customInstitutionId?: string): Promise<any> {
  const response = await apiFetch('/api/hierarchy/central/public-token/revoke', {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao revogar token público do Conselho Central.');
}

/**
 * Consulta pública da estrutura hierárquica (CPs e Conferências ativas) pelo token.
 * Rota pública (não requer autenticação).
 */
export async function fetchPublicHierarchyStructure(token: string): Promise<any> {
  const response = await apiFetch(`/api/public/central/${encodeURIComponent(token)}/structure`, {
    method: 'GET',
  });
  return handleHierarchyResponse<any>(response, 'Erro ao carregar estrutura do formulário público.');
}

/**
 * Submete o cadastro público de um membro pelo token do Conselho Central.
 * Rota pública (não requer autenticação).
 */
export async function submitPublicMemberRegistrationForm(token: string, payload: any): Promise<any> {
  const response = await apiFetch(`/api/public/central/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao enviar cadastro de membro.');
}

/**
 * Consulta pública de membros de uma Conferência para seleção no fluxo de complementação cadastral.
 * Rota pública (não requer autenticação).
 */
export async function fetchPublicConferenciaMembers(
  token: string,
  conferenciaId: string
): Promise<Array<{ idOpaco: string; fullName: string; type: string; originType: 'membro' | 'submission' }>> {
  const response = await apiFetch(
    `/api/public/central/${encodeURIComponent(token)}/conferencias/${encodeURIComponent(conferenciaId)}/membros`,
    {
      method: 'GET',
    }
  );
  return handleHierarchyResponse<any>(response, 'Erro ao carregar lista de membros da conferência.');
}

/**
 * Consulta pública de detalhes cadastrais mascarados para complementação segura.
 * Rota pública (não requer autenticação).
 */
export async function fetchPublicMemberMaskedDetails(token: string, idOpaco: string): Promise<any> {
  const response = await apiFetch(
    `/api/public/central/${encodeURIComponent(token)}/membros/${encodeURIComponent(idOpaco)}/masked`,
    {
      method: 'GET',
    }
  );
  return handleHierarchyResponse<any>(response, 'Erro ao carregar detalhes cadastrais do membro.');
}

/**
 * Submete solicitação de alteração/complementação de dados cadastrais.
 * Rota pública (não requer autenticação).
 */
export async function submitPublicMemberUpdateRequestForm(
  token: string,
  idOpaco: string,
  payload: any
): Promise<any> {
  const response = await apiFetch(
    `/api/public/central/${encodeURIComponent(token)}/membros/${encodeURIComponent(idOpaco)}/update-request`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  return handleHierarchyResponse<any>(response, 'Erro ao enviar solicitação de atualização.');
}

/**
 * Monta o link público oficial e exclusivo para o formulário de autocadastro de membros.
 * Formato exclusivo e seguro: https://<origem>/?cadastro=<TOKEN>
 */
export function buildPublicRegistrationUrl(token: string, baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/?cadastro=${encodeURIComponent(token.trim())}`;
}

/**
 * Busca as solicitações de autocadastro de membros do Conselho Central.
 */
export async function fetchCentralMemberSubmissions(
  options?: {
    status?: string;
    particularId?: string;
    conferenciaId?: string;
  },
  customInstitutionId?: string
): Promise<any[]> {
  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.set('status', options.status);
  if (options?.particularId) queryParams.set('particularId', options.particularId);
  if (options?.conferenciaId) queryParams.set('conferenciaId', options.conferenciaId);

  const url = `/api/hierarchy/central/submissions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiFetch(url, {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });
  const data = await handleHierarchyResponse<any>(response, 'Erro ao carregar solicitações de cadastro.');
  return extractHierarchyList<any>(data);
}

/**
 * Checa duplicidades potenciais de um cadastro contra membros existentes.
 */
export async function checkRegistrationDuplicates(
  payload: {
    normalizedName: string;
    normalizedPhone?: string;
    email?: string;
  },
  customInstitutionId?: string
): Promise<any[]> {
  const response = await apiFetch('/api/hierarchy/central/submissions/check-duplicates', {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify(payload),
  });
  const data = await handleHierarchyResponse<any>(response, 'Erro ao verificar duplicidades.');
  return extractHierarchyList<any>(data);
}

/**
 * Aprova uma solicitação de autocadastro de membro.
 */
export async function approveMemberRegistration(
  submissionId: string,
  correctedData?: any,
  customInstitutionId?: string
): Promise<any> {
  const response = await apiFetch(`/api/hierarchy/central/submissions/${encodeURIComponent(submissionId)}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({ correctedData }),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao aprovar solicitação de cadastro.');
}

/**
 * Confirma o cadastro e garante o envio/criação direta do membro na Conferência.
 */
export async function confirmAndSendMemberRegistration(
  submissionId: string,
  overrideData?: any,
  customInstitutionId?: string
): Promise<any> {
  const response = await apiFetch(`/api/hierarchy/central/submissions/${encodeURIComponent(submissionId)}/confirm-send`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({ overrideData }),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao confirmar e enviar cadastro para a Conferência.');
}

/**
 * Recusa uma solicitação de autocadastro de membro exigindo motivo.
 */
export async function rejectMemberRegistration(
  submissionId: string,
  reason: string,
  customInstitutionId?: string
): Promise<any> {
  const response = await apiFetch(`/api/hierarchy/central/submissions/${encodeURIComponent(submissionId)}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({ reason }),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao recusar solicitação de cadastro.');
}

/**
 * Executa a rotina de conciliação e sincronização em massa de cadastros e contadores.
 */
export async function reconcileCentralMemberSubmissions(
  conferenciaId?: string,
  customInstitutionId?: string
): Promise<any> {
  const response = await apiFetch('/api/hierarchy/central/submissions/reconcile', {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({ conferenciaId }),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao sincronizar e conciliar cadastros.');
}

/**
 * Dispara a importação única da estrutura de 2026 no backend do Cloud Run.
 * Operação restrita ao Administrador do Conselho Central de Jaboticabal.
 * Nenhum dado é enviado pelo cliente no corpo da requisição.
 */
export async function importStructure2026(
  customInstitutionId?: string
): Promise<{
  success: boolean;
  message: string;
  projectId: string;
  databaseId: string;
  created: { cps: number; conferencias: number };
  ignored: { cps: number; conferencias: number };
  conflicts: { cps: number; conferencias: number };
  unimported: any[];
  migrationCompletedAt?: string;
}> {
  const response = await apiFetch('/api/admin/importar-estrutura-2026', {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({}),
  });
  return handleHierarchyResponse<any>(response, 'Erro ao executar a importação da estrutura 2026.');
}

// =========================================================================
// MÉTODOS DE CLIENTE: FAMÍLIAS ASSISTIDAS E SINDICÂNCIA SSVP
// =========================================================================

/**
 * Lista famílias assistidas de uma Conferência (com opção de filtrar por status ou busca)
 */
export async function fetchFamiliasAssistidas(
  conferenciaId: string,
  options?: { status?: 'ativo' | 'arquivado' | 'todos'; search?: string; particularId?: string },
  customInstitutionId?: string
): Promise<FamiliaAssistidaCompleta[]> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.search) params.append('search', options.search);
  if (options?.particularId) params.append('particularId', options.particularId);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const url = `/api/conferencias/${encodeURIComponent(conferenciaId || 'all')}/familias${queryStr}`;

  const response = await apiFetch(url, {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });

  const raw = await handleHierarchyResponse<any>(response, 'Erro ao buscar famílias assistidas.');
  return extractHierarchyList<FamiliaAssistidaCompleta>(raw);
}

/**
 * Cadastra uma nova família assistida com Ficha de Sindicância (1ª Visita)
 */
export async function createFamiliaAssistida(
  conferenciaId: string,
  sindicancia: FichaSindicanciaData,
  customInstitutionId?: string
): Promise<FamiliaAssistidaCompleta> {
  const response = await apiFetch(`/api/conferencias/${encodeURIComponent(conferenciaId)}/familias`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({ sindicancia }),
  });

  return handleHierarchyResponse<FamiliaAssistidaCompleta>(response, 'Erro ao cadastrar ficha de família assistida.');
}

/**
 * Atualiza os dados da família ou ficha de sindicância
 */
export async function updateFamiliaAssistida(
  id: string,
  updates: Partial<FamiliaAssistidaCompleta>,
  customInstitutionId?: string
): Promise<FamiliaAssistidaCompleta> {
  const response = await apiFetch(`/api/familias/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify(updates),
  });

  return handleHierarchyResponse<FamiliaAssistidaCompleta>(response, 'Erro ao atualizar dados da família assistida.');
}

/**
 * Arquiva uma família assistida
 */
export async function archiveFamiliaAssistida(
  id: string,
  motivo: string,
  detalhes?: string,
  customInstitutionId?: string
): Promise<FamiliaAssistidaCompleta> {
  const response = await apiFetch(`/api/familias/${encodeURIComponent(id)}/arquivar`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({ motivo, detalhes }),
  });

  return handleHierarchyResponse<FamiliaAssistidaCompleta>(response, 'Erro ao arquivar família assistida.');
}

/**
 * Desarquiva / reativa uma família assistida
 */
export async function unarchiveFamiliaAssistida(
  id: string,
  customInstitutionId?: string
): Promise<FamiliaAssistidaCompleta> {
  const response = await apiFetch(`/api/familias/${encodeURIComponent(id)}/desarquivar`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify({}),
  });

  return handleHierarchyResponse<FamiliaAssistidaCompleta>(response, 'Erro ao desarquivar família assistida.');
}

/**
 * Lista o histórico de visitas de uma família
 */
export async function fetchVisitasFamilia(
  familiaId: string,
  customInstitutionId?: string
): Promise<VisitaFamiliaSSVP[]> {
  const response = await apiFetch(`/api/familias/${encodeURIComponent(familiaId)}/visitas`, {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });

  const raw = await handleHierarchyResponse<any>(response, 'Erro ao buscar visitas da família.');
  return extractHierarchyList<VisitaFamiliaSSVP>(raw);
}

/**
 * Registra uma nova visita à família assistida
 */
export async function createVisitaFamilia(
  familiaId: string,
  visita: {
    dataVisita: string;
    visitadoresIds: string[];
    visitadoresNomes: string[];
    entregueCesta: boolean;
    quantidadeCestas?: number;
    tipoAuxilioExtra?: string;
    comentarios: string;
    proximaVisitaAgendada?: string;
  },
  customInstitutionId?: string
): Promise<VisitaFamiliaSSVP> {
  const response = await apiFetch(`/api/familias/${encodeURIComponent(familiaId)}/visitas`, {
    method: 'POST',
    headers: getAuthHeaders(customInstitutionId),
    body: JSON.stringify(visita),
  });

  return handleHierarchyResponse<VisitaFamiliaSSVP>(response, 'Erro ao registrar visita à família.');
}

/**
 * Obtém as estatísticas do controle mensal de entrega de cestas por conferência
 */
export async function fetchControleCestasMensal(
  conferenciaId: string,
  mesAno?: string,
  customInstitutionId?: string
): Promise<ControleCestasMensalStats> {
  const queryStr = mesAno ? `?mesAno=${encodeURIComponent(mesAno)}` : '';
  const response = await apiFetch(`/api/conferencias/${encodeURIComponent(conferenciaId)}/controle-cestas${queryStr}`, {
    method: 'GET',
    headers: getAuthHeaders(customInstitutionId),
  });

  return handleHierarchyResponse<ControleCestasMensalStats>(response, 'Erro ao carregar controle mensal de cestas.');
}



