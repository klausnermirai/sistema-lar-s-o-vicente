/**
 * Serviço de Regras de Negócio e Gestão de Conferência Vicentina.
 * 
 * Operações:
 * - createConferencia
 * - updateConferencia
 * - inactivateConferencia
 * 
 * Regras Estritas:
 * - NENHUMA importação de Firebase, rotas, servidor ou banco direto.
 * - Injeção de dependência via ConferenciaRepository.
 * - Exige contexto seguro de autorização (allowed === true, validatedCentralId e userId).
 * - particularId deve ser recebido separadamente do formulário.
 * - centralId vem exclusivamente do contexto seguro.
 * - Rejeita conferenciaId/particularId ausente ou vazio com códigos apropriados sem chamar o banco.
 * - Rejeita campos de auditoria enviados pelo formulário (AUDIT_FIELDS_NOT_ALLOWED).
 * - Auditoria preenchida exclusivamente com authContext.userId.
 * - Retorno de sucesso contém APENAS: id, name, status, centralId e particularId.
 */

import { MembroSSVP, StandaloneConferencia, StandaloneConselhoParticular } from '../types.js';
import { validateConferenciaInput } from './conferencia_validator.js';

export interface ServiceAuthContext {
  allowed?: boolean;
  validatedCentralId?: string;
  userId?: string;
}

export interface ListConferenciasOptions {
  status?: 'ativo' | 'inativo' | 'todos';
  limit?: number;
  cursor?: string;
}

export interface ListConferenciasRepositoryResult {
  items: StandaloneConferencia[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ListConferenciasServiceResult {
  success: boolean;
  code:
    | 'SUCCESS'
    | 'UNAUTHORIZED'
    | 'MISSING_PARTICULAR_ID'
    | 'PARENT_NOT_FOUND'
    | 'PARENT_CENTRAL_MISMATCH'
    | 'INVALID_OPTIONS'
    | 'STORAGE_ERROR';
  error?: string;
  data?: {
    items: StandaloneConferencia[];
    nextCursor?: string;
    hasMore: boolean;
    totalReturned: number;
  };
}

export interface ConferenciaRepository {
  /**
   * Lista Conferências pertencentes ao Conselho Particular e Conselho Central informados,
   * com suporte a filtro de status, ordenação alfabética por `normalizedName` e paginação com `cursor` e `limit`.
   */
  listByParticularId(
    expectedCentralId: string,
    particularId: string,
    options?: ListConferenciasOptions
  ): Promise<ListConferenciasRepositoryResult>;

  /**
   * Busca um Conselho Particular pelo ID.
   */
  getParticularById(particularId: string): Promise<StandaloneConselhoParticular | null>;

  /**
   * Busca uma Conferência pelo ID.
   */
  getById(id: string): Promise<StandaloneConferencia | null>;

  /**
   * Busca um membro pelo ID para validação de vínculo e escopo da diretoria.
   */
  getMembroById?(membroId: string): Promise<MembroSSVP | null>;

  /**
   * Operação atômica de criação. Relerá e revalidará o Conselho Particular pai dentro da transação.
   */
  createAtomically(
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ): Promise<{
    created: boolean;
    reason?: 'PARENT_NOT_FOUND' | 'PARENT_INACTIVE' | 'PARENT_CENTRAL_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }>;

  /**
   * Operação atômica de atualização. Revalida que o Conselho Particular pai continua ativo e no mesmo Conselho Central.
   */
  updateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ): Promise<{
    updated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'PARENT_INACTIVE' | 'PARENT_CENTRAL_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }>;

  /**
   * Operação atômica de inativação. Revalida vínculos e ausência de membros ativos vinculados.
   */
  inactivateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    auditUserId: string
  ): Promise<{
    inactivated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'ALREADY_INACTIVE' | 'ACTIVE_MEMBERS_EXIST' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }>;
}

export type ConferenciaServiceCode =
  | 'SUCCESS'
  | 'UNAUTHORIZED'
  | 'MISSING_USER_ID'
  | 'MISSING_PARTICULAR_ID'
  | 'MISSING_CONFERENCIA_ID'
  | 'PARENT_NOT_FOUND'
  | 'PARENT_INACTIVE'
  | 'PARENT_CENTRAL_MISMATCH'
  | 'NOT_FOUND'
  | 'INSTITUTION_SCOPE_MISMATCH'
  | 'AUDIT_FIELDS_NOT_ALLOWED'
  | 'DUPLICATE_NAME'
  | 'ALREADY_INACTIVE'
  | 'ACTIVE_MEMBERS_EXIST'
  | 'STORAGE_ERROR'
  | string;

export interface ConferenciaSanitizedData {
  id: string;
  name: string;
  status: 'ativo' | 'inativo';
  centralId: string;
  particularId: string;
}

export interface ConferenciaServiceResponse {
  success: boolean;
  code: ConferenciaServiceCode;
  error?: string;
  data?: ConferenciaSanitizedData;
}

/**
 * Auxiliar de autorização do contexto seguro.
 */
function checkAuthContext(authContext: ServiceAuthContext | null | undefined): {
  authorized: boolean;
  validatedCentralId: string;
  userId: string;
  errorCode?: ConferenciaServiceCode;
  errorMessage?: string;
} {
  const isAllowed = Boolean(authContext && authContext.allowed === true);
  const validatedCentralId = typeof authContext?.validatedCentralId === 'string' ? authContext.validatedCentralId.trim() : '';

  if (!isAllowed || !validatedCentralId) {
    return {
      authorized: false,
      validatedCentralId: '',
      userId: '',
      errorCode: 'UNAUTHORIZED',
      errorMessage: 'Acesso negado. Contexto seguro de autorização é inválido ou não permitido.',
    };
  }

  const userId = typeof authContext?.userId === 'string' ? authContext.userId.trim() : '';
  if (!userId) {
    return {
      authorized: false,
      validatedCentralId,
      userId: '',
      errorCode: 'MISSING_USER_ID',
      errorMessage: 'ID do usuário não foi identificado no contexto seguro de autorização.',
    };
  }

  return {
    authorized: true,
    validatedCentralId,
    userId,
  };
}

/**
 * Auxiliar para verificar presença de campos de auditoria no payload do formulário.
 */
function hasAuditFieldsInPayload(rawInput: Record<string, any> | null | undefined): boolean {
  if (!rawInput || typeof rawInput !== 'object') return false;
  return (
    rawInput.createdAt !== undefined ||
    rawInput.updatedAt !== undefined ||
    rawInput.createdBy !== undefined ||
    rawInput.updatedBy !== undefined
  );
}

/**
 * Auxiliar para validar membros vinculados aos 6 cargos da Diretoria.
 * Valida se cada membroId existe, está ativo e pertence exatamente à Conferência em questão.
 */
async function validateBoardMembers(
  data: StandaloneConferencia,
  conferenciaId: string | undefined,
  repository: ConferenciaRepository
): Promise<{ valid: boolean; code?: ConferenciaServiceCode; error?: string }> {
  if (typeof repository.getMembroById !== 'function') {
    return { valid: true };
  }

  const boardRoles: Array<{ key: keyof StandaloneConferencia; label: string }> = [
    { key: 'presidente', label: 'Presidente' },
    { key: 'vicePresidente', label: 'Vice-Presidente' },
    { key: 'secretario', label: 'Secretário(a)' },
    { key: 'segundoSecretario', label: 'Segundo(a) Secretário(a)' },
    { key: 'tesoureiro', label: 'Tesoureiro(a)' },
    { key: 'segundoTesoureiro', label: 'Segundo(a) Tesoureiro(a)' },
  ];

  for (const role of boardRoles) {
    const memberObj = data[role.key] as { membroId?: string; name?: string; phone?: string } | undefined;
    const cleanMembroId = memberObj?.membroId ? String(memberObj.membroId).trim() : '';
    if (cleanMembroId) {
      const membro = await repository.getMembroById(cleanMembroId);
      if (!membro) {
        return {
          valid: false,
          code: 'MEMBER_NOT_FOUND',
          error: `O membro selecionado para o cargo de ${role.label} não foi encontrado no sistema.`,
        };
      }

      if (membro.status !== 'ativo') {
        return {
          valid: false,
          code: 'MEMBER_INACTIVE',
          error: `O membro "${membro.fullName}" selecionado para o cargo de ${role.label} encontra-se inativo. Apenas membros ativos podem ser vinculados à diretoria.`,
        };
      }

      if (conferenciaId && membro.conferenciaId !== conferenciaId) {
        return {
          valid: false,
          code: 'MEMBER_CONFERENCIA_MISMATCH',
          error: `O membro "${membro.fullName}" selecionado para o cargo de ${role.label} pertence a outra Conferência e não pode ser vinculado a esta diretoria.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Cria uma Conferência Vicentina aplicando validações, contexto seguro e criação atômica.
 */
export async function createConferencia(
  particularId: string | null | undefined,
  rawInput: Record<string, any> | null | undefined,
  authContext: ServiceAuthContext | null | undefined,
  repository: ConferenciaRepository
): Promise<ConferenciaServiceResponse> {
  const cleanParticularId = typeof particularId === 'string' ? particularId.trim() : '';
  if (!cleanParticularId) {
    return {
      success: false,
      code: 'MISSING_PARTICULAR_ID',
      error: 'O ID do Conselho Particular pai é obrigatório.',
    };
  }

  const auth = checkAuthContext(authContext);
  if (!auth.authorized) {
    return {
      success: false,
      code: auth.errorCode!,
      error: auth.errorMessage,
    };
  }

  if (hasAuditFieldsInPayload(rawInput)) {
    return {
      success: false,
      code: 'AUDIT_FIELDS_NOT_ALLOWED',
      error: 'Campos de auditoria (createdAt, updatedAt, createdBy, updatedBy) não são permitidos no formulário.',
    };
  }

  // Buscar Conselho Particular pai para pré-validação
  let parentParticular: StandaloneConselhoParticular | null = null;
  try {
    parentParticular = await repository.getParticularById(cleanParticularId);
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: 'Falha ao consultar o Conselho Particular pai.',
    };
  }

  if (!parentParticular) {
    return {
      success: false,
      code: 'PARENT_NOT_FOUND',
      error: `Conselho Particular pai com ID "${cleanParticularId}" não foi encontrado.`,
    };
  }

  if (parentParticular.centralId !== auth.validatedCentralId) {
    return {
      success: false,
      code: 'PARENT_CENTRAL_MISMATCH',
      error: 'O Conselho Particular pai pertence a outro Conselho Central.',
    };
  }

  if (parentParticular.status !== 'ativo') {
    return {
      success: false,
      code: 'PARENT_INACTIVE',
      error: 'Não é possível vincular uma Conferência a um Conselho Particular inativo.',
    };
  }

  // Chamar o validador puro sem passar currentUserId nas opções
  const validationResult = validateConferenciaInput(
    rawInput,
    auth.validatedCentralId,
    cleanParticularId,
    parentParticular
  );

  if (!validationResult.valid || !validationResult.normalizedData) {
    return {
      success: false,
      code: validationResult.code,
      error: validationResult.error || 'Erro na validação da Conferência.',
    };
  }

  // Injetar auditoria estrita do serviço
  const nowIso = new Date().toISOString();
  const recordToCreate: StandaloneConferencia = {
    ...validationResult.normalizedData,
    centralId: auth.validatedCentralId,
    particularId: cleanParticularId,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: auth.userId,
    updatedBy: auth.userId,
  };

  // Validar membros da diretoria caso informados
  const boardValidation = await validateBoardMembers(recordToCreate, undefined, repository);
  if (!boardValidation.valid) {
    return {
      success: false,
      code: boardValidation.code || 'INVALID_BOARD_MEMBER',
      error: boardValidation.error,
    };
  }

  // Executar criação atômica no repositório com revalidação interna do pai
  try {
    const atomicResult = await repository.createAtomically(
      auth.validatedCentralId,
      cleanParticularId,
      recordToCreate
    );

    if (!atomicResult.created) {
      if (atomicResult.reason === 'PARENT_NOT_FOUND') {
        return {
          success: false,
          code: 'PARENT_NOT_FOUND',
          error: 'Conselho Particular pai não foi encontrado no momento do salvamento.',
        };
      }
      if (atomicResult.reason === 'PARENT_INACTIVE') {
        return {
          success: false,
          code: 'PARENT_INACTIVE',
          error: 'O Conselho Particular pai encontra-se inativo.',
        };
      }
      if (atomicResult.reason === 'PARENT_CENTRAL_MISMATCH') {
        return {
          success: false,
          code: 'PARENT_CENTRAL_MISMATCH',
          error: 'O Conselho Particular pai pertence a outro Conselho Central.',
        };
      }
      if (atomicResult.reason === 'DUPLICATE_NAME') {
        return {
          success: false,
          code: 'DUPLICATE_NAME',
          error: `Já existe uma Conferência cadastrada com o nome "${recordToCreate.name}" neste Conselho Particular.`,
        };
      }

      return {
        success: false,
        code: 'STORAGE_ERROR',
        error: 'Falha ao persistir a Conferência no repositório.',
      };
    }

    const createdRecord = atomicResult.record || recordToCreate;

    return {
      success: true,
      code: 'SUCCESS',
      data: {
        id: createdRecord.id,
        name: createdRecord.name,
        status: createdRecord.status,
        centralId: createdRecord.centralId,
        particularId: createdRecord.particularId,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err?.message || 'Erro inesperado durante a criação da Conferência.',
    };
  }
}

/**
 * Atualiza uma Conferência Vicentina aplicando regras de imutabilidade, escopo e atualização atômica.
 */
export async function updateConferencia(
  conferenciaId: string | null | undefined,
  particularId: string | null | undefined,
  rawInput: Record<string, any> | null | undefined,
  authContext: ServiceAuthContext | null | undefined,
  repository: ConferenciaRepository
): Promise<ConferenciaServiceResponse> {
  const cleanConferenciaId = typeof conferenciaId === 'string' ? conferenciaId.trim() : '';
  if (!cleanConferenciaId) {
    return {
      success: false,
      code: 'MISSING_CONFERENCIA_ID',
      error: 'O ID da Conferência é obrigatório para atualização.',
    };
  }

  const cleanParticularId = typeof particularId === 'string' ? particularId.trim() : '';
  if (!cleanParticularId) {
    return {
      success: false,
      code: 'MISSING_PARTICULAR_ID',
      error: 'O ID do Conselho Particular pai é obrigatório.',
    };
  }

  const auth = checkAuthContext(authContext);
  if (!auth.authorized) {
    return {
      success: false,
      code: auth.errorCode!,
      error: auth.errorMessage,
    };
  }

  if (hasAuditFieldsInPayload(rawInput)) {
    return {
      success: false,
      code: 'AUDIT_FIELDS_NOT_ALLOWED',
      error: 'Campos de auditoria (createdAt, updatedAt, createdBy, updatedBy) não são permitidos no formulário.',
    };
  }

  // Buscar registro existente
  let existing: StandaloneConferencia | null = null;
  try {
    existing = await repository.getById(cleanConferenciaId);
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: 'Falha ao consultar a Conferência no repositório.',
    };
  }

  if (!existing) {
    return {
      success: false,
      code: 'NOT_FOUND',
      error: `Conferência com ID "${cleanConferenciaId}" não foi encontrada.`,
    };
  }

  if (existing.centralId !== auth.validatedCentralId || existing.particularId !== cleanParticularId) {
    return {
      success: false,
      code: 'INSTITUTION_SCOPE_MISMATCH',
      error: 'Acesso negado. A Conferência pertence a outro Conselho Central ou Conselho Particular.',
    };
  }

  // Buscar Conselho Particular pai
  let parentParticular: StandaloneConselhoParticular | null = null;
  try {
    parentParticular = await repository.getParticularById(cleanParticularId);
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: 'Falha ao consultar o Conselho Particular pai.',
    };
  }

  if (!parentParticular) {
    return {
      success: false,
      code: 'PARENT_NOT_FOUND',
      error: `Conselho Particular pai com ID "${cleanParticularId}" não foi encontrado.`,
    };
  }

  if (parentParticular.centralId !== auth.validatedCentralId) {
    return {
      success: false,
      code: 'PARENT_CENTRAL_MISMATCH',
      error: 'O Conselho Particular pai pertence a outro Conselho Central.',
    };
  }

  if (parentParticular.status !== 'ativo') {
    return {
      success: false,
      code: 'PARENT_INACTIVE',
      error: 'O Conselho Particular pai encontra-se inativo.',
    };
  }

  // Validar edição com validador puro
  const validationResult = validateConferenciaInput(
    rawInput,
    auth.validatedCentralId,
    cleanParticularId,
    parentParticular,
    {
      isEdit: true,
      existingRecord: existing,
    }
  );

  if (!validationResult.valid || !validationResult.normalizedData) {
    return {
      success: false,
      code: validationResult.code,
      error: validationResult.error || 'Erro na validação da atualização da Conferência.',
    };
  }

  // Montar objeto de atualização com imutabilidade estrita
  const nowIso = new Date().toISOString();
  const recordToUpdate: StandaloneConferencia = {
    ...validationResult.normalizedData,
    id: cleanConferenciaId,
    centralId: auth.validatedCentralId,
    particularId: cleanParticularId,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: nowIso,
    updatedBy: auth.userId,
  };

  // Validar membros da diretoria caso informados (garantindo que pertencem à conferência atual e estão ativos)
  const boardValidation = await validateBoardMembers(recordToUpdate, cleanConferenciaId, repository);
  if (!boardValidation.valid) {
    return {
      success: false,
      code: boardValidation.code || 'INVALID_BOARD_MEMBER',
      error: boardValidation.error,
    };
  }

  try {
    const atomicResult = await repository.updateAtomically(
      cleanConferenciaId,
      auth.validatedCentralId,
      cleanParticularId,
      recordToUpdate
    );

    if (!atomicResult.updated) {
      if (atomicResult.reason === 'NOT_FOUND') {
        return {
          success: false,
          code: 'NOT_FOUND',
          error: `Conferência com ID "${cleanConferenciaId}" não foi encontrada.`,
        };
      }
      if (atomicResult.reason === 'INSTITUTION_SCOPE_MISMATCH') {
        return {
          success: false,
          code: 'INSTITUTION_SCOPE_MISMATCH',
          error: 'Acesso negado. A Conferência pertence a outro Conselho Central ou Particular.',
        };
      }
      if (atomicResult.reason === 'PARENT_INACTIVE') {
        return {
          success: false,
          code: 'PARENT_INACTIVE',
          error: 'O Conselho Particular pai encontra-se inativo.',
        };
      }
      if (atomicResult.reason === 'PARENT_CENTRAL_MISMATCH') {
        return {
          success: false,
          code: 'PARENT_CENTRAL_MISMATCH',
          error: 'O Conselho Particular pai pertence a outro Conselho Central.',
        };
      }
      if (atomicResult.reason === 'DUPLICATE_NAME') {
        return {
          success: false,
          code: 'DUPLICATE_NAME',
          error: `Já existe outra Conferência cadastrada com o nome "${recordToUpdate.name}" neste Conselho Particular.`,
        };
      }

      return {
        success: false,
        code: 'STORAGE_ERROR',
        error: 'Falha ao atualizar a Conferência no repositório.',
      };
    }

    const updatedRecord = atomicResult.record || recordToUpdate;

    return {
      success: true,
      code: 'SUCCESS',
      data: {
        id: updatedRecord.id,
        name: updatedRecord.name,
        status: updatedRecord.status,
        centralId: updatedRecord.centralId,
        particularId: updatedRecord.particularId,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err?.message || 'Erro inesperado durante a atualização da Conferência.',
    };
  }
}

/**
 * Inativa uma Conferência Vicentina garantindo que não haja membros ativos vinculados e mantendo persistência física.
 */
export async function inactivateConferencia(
  conferenciaId: string | null | undefined,
  particularId: string | null | undefined,
  authContext: ServiceAuthContext | null | undefined,
  repository: ConferenciaRepository
): Promise<ConferenciaServiceResponse> {
  const cleanConferenciaId = typeof conferenciaId === 'string' ? conferenciaId.trim() : '';
  if (!cleanConferenciaId) {
    return {
      success: false,
      code: 'MISSING_CONFERENCIA_ID',
      error: 'O ID da Conferência é obrigatório para inativação.',
    };
  }

  const cleanParticularId = typeof particularId === 'string' ? particularId.trim() : '';
  if (!cleanParticularId) {
    return {
      success: false,
      code: 'MISSING_PARTICULAR_ID',
      error: 'O ID do Conselho Particular pai é obrigatório.',
    };
  }

  const auth = checkAuthContext(authContext);
  if (!auth.authorized) {
    return {
      success: false,
      code: auth.errorCode!,
      error: auth.errorMessage,
    };
  }

  try {
    const atomicResult = await repository.inactivateAtomically(
      cleanConferenciaId,
      auth.validatedCentralId,
      cleanParticularId,
      auth.userId
    );

    if (!atomicResult.inactivated) {
      if (atomicResult.reason === 'NOT_FOUND') {
        return {
          success: false,
          code: 'NOT_FOUND',
          error: `Conferência com ID "${cleanConferenciaId}" não foi encontrada.`,
        };
      }
      if (atomicResult.reason === 'INSTITUTION_SCOPE_MISMATCH') {
        return {
          success: false,
          code: 'INSTITUTION_SCOPE_MISMATCH',
          error: 'Acesso negado. A Conferência pertence a outro Conselho Central ou Particular.',
        };
      }
      if (atomicResult.reason === 'ALREADY_INACTIVE') {
        return {
          success: false,
          code: 'ALREADY_INACTIVE',
          error: 'A Conferência já se encontra inativa.',
        };
      }
      if (atomicResult.reason === 'ACTIVE_MEMBERS_EXIST') {
        return {
          success: false,
          code: 'ACTIVE_MEMBERS_EXIST',
          error: 'Não é possível inativar a Conferência pois existem membros ativos vinculados a ela.',
        };
      }

      return {
        success: false,
        code: 'STORAGE_ERROR',
        error: 'Falha ao inativar a Conferência no repositório.',
      };
    }

    const inactivatedRecord = atomicResult.record;

    return {
      success: true,
      code: 'SUCCESS',
      data: {
        id: inactivatedRecord?.id || cleanConferenciaId,
        name: inactivatedRecord?.name || '',
        status: 'inativo',
        centralId: inactivatedRecord?.centralId || auth.validatedCentralId,
        particularId: inactivatedRecord?.particularId || cleanParticularId,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err?.message || 'Erro inesperado durante a inativação da Conferência.',
    };
  }
}

/**
 * Lista Conferências vinculadas a um Conselho Particular específico,
 * assegurando que o Conselho Particular pertença ao Conselho Central do contexto autenticado.
 *
 * Filtra simultaneamente por centralId e particularId, ordena por normalizedName (asc)
 * e pagina por cursor (startAfter).
 */
export async function listConferencias(
  particularId: string | undefined | null,
  authContext: ServiceAuthContext | undefined | null,
  repository: ConferenciaRepository,
  options?: ListConferenciasOptions
): Promise<ListConferenciasServiceResult> {
  // 1. Validação de Autorização
  const auth = checkAuthContext(authContext);
  if (!auth.authorized || !auth.validatedCentralId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Contexto de autorização inválido ou ausente.',
    };
  }

  // 2. Validação do particularId
  if (typeof particularId !== 'string' || particularId.trim().length === 0) {
    return {
      success: false,
      code: 'MISSING_PARTICULAR_ID',
      error: 'O ID do Conselho Particular é obrigatório para listagem de Conferências.',
    };
  }
  const cleanParticularId = particularId.trim();

  // 3. Validação das Opções (status e limit)
  let sanitizedStatus: 'ativo' | 'inativo' | 'todos' = 'ativo';
  if (options?.status !== undefined) {
    if (options.status !== 'ativo' && options.status !== 'inativo' && options.status !== 'todos') {
      return {
        success: false,
        code: 'INVALID_OPTIONS',
        error: 'O parâmetro status deve ser "ativo", "inativo" ou "todos".',
      };
    }
    sanitizedStatus = options.status;
  }

  let sanitizedLimit = 50;
  if (options?.limit !== undefined) {
    if (
      typeof options.limit !== 'number' ||
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > 100
    ) {
      return {
        success: false,
        code: 'INVALID_OPTIONS',
        error: 'O parâmetro limit deve ser um número inteiro entre 1 e 100.',
      };
    }
    sanitizedLimit = options.limit;
  }

  const cleanCursor =
    typeof options?.cursor === 'string' && options.cursor.trim().length > 0
      ? options.cursor.trim()
      : undefined;

  // 4. Validação da Existência e Pertença do Conselho Particular pai ao Central
  try {
    const parent = await repository.getParticularById(cleanParticularId);
    if (!parent) {
      return {
        success: false,
        code: 'PARENT_NOT_FOUND',
        error: 'O Conselho Particular informado não foi encontrado.',
      };
    }

    if (parent.centralId !== auth.validatedCentralId) {
      return {
        success: false,
        code: 'PARENT_CENTRAL_MISMATCH',
        error: 'O Conselho Particular informado pertence a outro Conselho Central.',
      };
    }

    // 5. Consulta no Repositório com filtro duplo simultâneo (centralId + particularId)
    const repoResult = await repository.listByParticularId(
      auth.validatedCentralId,
      cleanParticularId,
      {
        status: sanitizedStatus,
        limit: sanitizedLimit,
        cursor: cleanCursor,
      }
    );

    return {
      success: true,
      code: 'SUCCESS',
      data: {
        items: repoResult.items || [],
        nextCursor: repoResult.nextCursor,
        hasMore: Boolean(repoResult.hasMore),
        totalReturned: (repoResult.items || []).length,
      },
    };
  } catch {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: 'Erro ao consultar as Conferências no banco de dados.',
    };
  }
}

