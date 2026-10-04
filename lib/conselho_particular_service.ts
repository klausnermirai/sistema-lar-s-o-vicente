/**
 * Serviço de Regras de Negócio e Gestão de Conselho Particular.
 * 
 * Operações:
 * - createConselhoParticular
 * - updateConselhoParticular
 * - inactivateConselhoParticular
 * 
 * Regras Estritas:
 * - NENHUMA importação de Firebase, rotas, servidor ou banco direto.
 * - Injeção de dependência via ConselhoParticularRepository.
 * - Exige contexto seguro de autorização (allowed === true, validatedCentralId e userId).
 * - Usar exclusivamente authContext.userId para createdBy e updatedBy.
 * - Rejeitar conselhoId ausente/vazio com MISSING_CONSELHO_ID sem chamar o repositório.
 * - Rejeitar com AUDIT_FIELDS_NOT_ALLOWED se o formulário enviar createdAt, updatedAt, createdBy ou updatedBy.
 * - Validar escopo do Conselho Central (INSTITUTION_SCOPE_MISMATCH).
 * - Impeder normalizedName duplicado no mesmo Conselho Central via operação atômica do repositório.
 * - Retorno de sucesso contém APENAS: id, name, status e centralId.
 */

import { StandaloneConselhoParticular } from '../types.js';
import { validateConselhoParticularInput } from './conselho_particular_validator.js';

/**
 * Interface do Contexto Seguro de Autorização para a camada de Serviço.
 */
export interface ServiceAuthContext {
  allowed?: boolean;
  validatedCentralId?: string;
  userId?: string;
  institutionId?: string;
  isAdmin?: boolean;
  conferenciaId?: string;
  particularId?: string;
  accessLevel?: string;
  role?: string;
}

/**
 * Interface mínima do repositório necessária para as operações do serviço.
 */
export interface ListConselhosParticularesOptions {
  status?: 'ativo' | 'inativo' | 'todos';
  limit?: number;
  cursor?: string;
}

export interface ListConselhosParticularesRepositoryResult {
  items: StandaloneConselhoParticular[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ListConselhosParticularesServiceResult {
  success: boolean;
  code: 'SUCCESS' | 'UNAUTHORIZED' | 'INVALID_OPTIONS' | 'STORAGE_ERROR';
  error?: string;
  data?: {
    items: StandaloneConselhoParticular[];
    nextCursor?: string;
    hasMore: boolean;
    totalReturned: number;
  };
}

export interface ConselhoParticularRepository {
  /**
   * Lista Conselhos Particulares de um Conselho Central com suporte a filtro de status,
   * ordenação alfabética por `normalizedName` e paginação com `cursor` e `limit`.
   */
  listByCentralId(
    centralId: string,
    options?: ListConselhosParticularesOptions
  ): Promise<ListConselhosParticularesRepositoryResult>;

  /**
   * Operação atômica que verifica se já existe um Conselho Particular com o mesmo
   * `normalizedName` dentro do mesmo `centralId` e cria o registro na mesma transação.
   */
  createAtomically(data: StandaloneConselhoParticular): Promise<{
    created: boolean;
    reason?: 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }>;

  /**
   * Busca um Conselho Particular pelo ID.
   */
  getById(id: string): Promise<StandaloneConselhoParticular | null>;

  /**
   * Operação atômica que revalida vínculo institucional e unicidade do `normalizedName`
   * (desconsiderando o próprio registro) e atualiza os dados na mesma transação.
   */
  updateAtomically(
    id: string,
    expectedCentralId: string,
    data: StandaloneConselhoParticular
  ): Promise<{
    updated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }>;

  /**
   * Operação atômica que revalida vínculo institucional, verifica ausência de Conferências ativas
   * vinculadas e altera o status para 'inativo' na mesma transação.
   */
  inactivateAtomically(
    id: string,
    expectedCentralId: string,
    auditUserId: string
  ): Promise<{
    inactivated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'ALREADY_INACTIVE' | 'ACTIVE_CHILDREN_EXIST' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }>;
}

export type ConselhoParticularServiceCode =
  | 'SUCCESS'
  | 'UNAUTHORIZED'
  | 'MISSING_USER_ID'
  | 'MISSING_CONSELHO_ID'
  | 'NOT_FOUND'
  | 'INSTITUTION_SCOPE_MISMATCH'
  | 'AUDIT_FIELDS_NOT_ALLOWED'
  | 'DUPLICATE_NAME'
  | 'ALREADY_INACTIVE'
  | 'ACTIVE_CHILDREN_EXIST'
  | 'STORAGE_ERROR'
  | string;

export interface ConselhoParticularSanitizedData {
  id: string;
  name: string;
  status: 'ativo' | 'inativo';
  centralId: string;
}

export interface ConselhoParticularServiceResponse {
  success: boolean;
  code: ConselhoParticularServiceCode;
  error?: string;
  data?: ConselhoParticularSanitizedData;
}

/**
 * Auxiliar para verificar autorização básica.
 */
function checkAuthContext(authContext: ServiceAuthContext | null | undefined): {
  authorized: boolean;
  validatedCentralId: string;
  userId: string;
  errorCode?: ConselhoParticularServiceCode;
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
 * Cria um Conselho Particular aplicando autorização segura, validação, auditoria estrita
 * e verificação atômica de unicidade.
 */
export async function createConselhoParticular(
  rawInput: Record<string, any> | null | undefined,
  authContext: ServiceAuthContext | null | undefined,
  repository: ConselhoParticularRepository
): Promise<ConselhoParticularServiceResponse> {
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

  const validationResult = validateConselhoParticularInput(rawInput, auth.validatedCentralId, {
    currentUserId: auth.userId,
  });

  if (!validationResult.valid || !validationResult.normalizedData) {
    return {
      success: false,
      code: validationResult.code,
      error: validationResult.error || 'Erro na validação do Conselho Particular.',
    };
  }

  const recordToCreate: StandaloneConselhoParticular = {
    ...validationResult.normalizedData,
    centralId: auth.validatedCentralId,
    createdBy: auth.userId,
    updatedBy: auth.userId,
  };

  try {
    const atomicResult = await repository.createAtomically(recordToCreate);

    if (!atomicResult.created) {
      if (atomicResult.reason === 'DUPLICATE_NAME') {
        return {
          success: false,
          code: 'DUPLICATE_NAME',
          error: `Já existe um Conselho Particular com o nome "${recordToCreate.name}" cadastrado neste Conselho Central.`,
        };
      }

      return {
        success: false,
        code: 'STORAGE_ERROR',
        error: 'Falha ao persistir o Conselho Particular no repositório.',
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
      },
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err?.message || 'Erro inesperado durante a criação do Conselho Particular.',
    };
  }
}

/**
 * Atualiza um Conselho Particular aplicando autorização de escopo, imutabilidade,
 * validação estrita e verificação atômica de nome duplicado.
 */
export async function updateConselhoParticular(
  conselhoId: string | null | undefined,
  rawInput: Record<string, any> | null | undefined,
  authContext: ServiceAuthContext | null | undefined,
  repository: ConselhoParticularRepository
): Promise<ConselhoParticularServiceResponse> {
  // 1. Rejeitar conselhoId ausente ou em branco sem chamar o repositório
  const cleanConselhoId = typeof conselhoId === 'string' ? conselhoId.trim() : '';
  if (!cleanConselhoId) {
    return {
      success: false,
      code: 'MISSING_CONSELHO_ID',
      error: 'O ID do Conselho Particular é obrigatório para atualização.',
    };
  }

  // 2. Verificar autorização do contexto
  const auth = checkAuthContext(authContext);
  if (!auth.authorized) {
    return {
      success: false,
      code: auth.errorCode!,
      error: auth.errorMessage,
    };
  }

  // 3. Rejeitar campos de auditoria no formulário
  if (hasAuditFieldsInPayload(rawInput)) {
    return {
      success: false,
      code: 'AUDIT_FIELDS_NOT_ALLOWED',
      error: 'Campos de auditoria (createdAt, updatedAt, createdBy, updatedBy) não são permitidos no formulário.',
    };
  }

  // 4. Buscar registro existente para validação de escopo e imutabilidade
  let existing: StandaloneConselhoParticular | null = null;
  try {
    existing = await repository.getById(cleanConselhoId);
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: 'Falha ao consultar o Conselho Particular no repositório.',
    };
  }

  if (!existing) {
    return {
      success: false,
      code: 'NOT_FOUND',
      error: `Conselho Particular com ID "${cleanConselhoId}" não foi encontrado.`,
    };
  }

  // 5. Verificar pertinência do registro ao Conselho Central do contexto seguro
  if (existing.centralId !== auth.validatedCentralId) {
    return {
      success: false,
      code: 'INSTITUTION_SCOPE_MISMATCH',
      error: 'Acesso negado. O Conselho Particular pertence a outro Conselho Central.',
    };
  }

  // 6. Validar payload de edição preservando regras de imutabilidade
  const validationResult = validateConselhoParticularInput(rawInput, auth.validatedCentralId, {
    isEdit: true,
    existingRecord: existing,
    currentUserId: auth.userId,
  });

  if (!validationResult.valid || !validationResult.normalizedData) {
    return {
      success: false,
      code: validationResult.code,
      error: validationResult.error || 'Erro na validação da atualização do Conselho Particular.',
    };
  }

  // 7. Montar registro atualizado garantindo auditoria do operador
  const nowIso = new Date().toISOString();
  const recordToUpdate: StandaloneConselhoParticular = {
    ...validationResult.normalizedData,
    id: cleanConselhoId, // Imutável
    centralId: auth.validatedCentralId, // Imutável
    createdAt: existing.createdAt, // Imutável
    createdBy: existing.createdBy, // Imutável
    updatedAt: nowIso,
    updatedBy: auth.userId,
  };

  // 8. Executar atualização atômica revalidando unicidade de nome e escopo
  try {
    const atomicResult = await repository.updateAtomically(
      cleanConselhoId,
      auth.validatedCentralId,
      recordToUpdate
    );

    if (!atomicResult.updated) {
      if (atomicResult.reason === 'NOT_FOUND') {
        return {
          success: false,
          code: 'NOT_FOUND',
          error: `Conselho Particular com ID "${cleanConselhoId}" não foi encontrado.`,
        };
      }
      if (atomicResult.reason === 'INSTITUTION_SCOPE_MISMATCH') {
        return {
          success: false,
          code: 'INSTITUTION_SCOPE_MISMATCH',
          error: 'Acesso negado. O Conselho Particular pertence a outro Conselho Central.',
        };
      }
      if (atomicResult.reason === 'DUPLICATE_NAME') {
        return {
          success: false,
          code: 'DUPLICATE_NAME',
          error: `Já existe outro Conselho Particular cadastrado com o nome "${recordToUpdate.name}" neste Conselho Central.`,
        };
      }

      return {
        success: false,
        code: 'STORAGE_ERROR',
        error: 'Falha ao atualizar o Conselho Particular no repositório.',
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
      },
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err?.message || 'Erro inesperado durante a atualização do Conselho Particular.',
    };
  }
}

/**
 * Inativa um Conselho Particular garantindo que não existam Conferências ativas vinculadas,
 * sem realizar exclusão física do registro.
 */
export async function inactivateConselhoParticular(
  conselhoId: string | null | undefined,
  authContext: ServiceAuthContext | null | undefined,
  repository: ConselhoParticularRepository
): Promise<ConselhoParticularServiceResponse> {
  // 1. Rejeitar conselhoId ausente ou em branco sem chamar o repositório
  const cleanConselhoId = typeof conselhoId === 'string' ? conselhoId.trim() : '';
  if (!cleanConselhoId) {
    return {
      success: false,
      code: 'MISSING_CONSELHO_ID',
      error: 'O ID do Conselho Particular é obrigatório para inativação.',
    };
  }

  // 2. Verificar autorização do contexto
  const auth = checkAuthContext(authContext);
  if (!auth.authorized) {
    return {
      success: false,
      code: auth.errorCode!,
      error: auth.errorMessage,
    };
  }

  // 3. Executar inativação atômica no repositório
  try {
    const atomicResult = await repository.inactivateAtomically(
      cleanConselhoId,
      auth.validatedCentralId,
      auth.userId
    );

    if (!atomicResult.inactivated) {
      if (atomicResult.reason === 'NOT_FOUND') {
        return {
          success: false,
          code: 'NOT_FOUND',
          error: `Conselho Particular com ID "${cleanConselhoId}" não foi encontrado.`,
        };
      }
      if (atomicResult.reason === 'INSTITUTION_SCOPE_MISMATCH') {
        return {
          success: false,
          code: 'INSTITUTION_SCOPE_MISMATCH',
          error: 'Acesso negado. O Conselho Particular pertence a outro Conselho Central.',
        };
      }
      if (atomicResult.reason === 'ALREADY_INACTIVE') {
        return {
          success: false,
          code: 'ALREADY_INACTIVE',
          error: 'O Conselho Particular já se encontra inativo.',
        };
      }
      if (atomicResult.reason === 'ACTIVE_CHILDREN_EXIST') {
        return {
          success: false,
          code: 'ACTIVE_CHILDREN_EXIST',
          error: 'Não é possível inativar o Conselho Particular pois existem Conferências ativas vinculadas a ele.',
        };
      }

      return {
        success: false,
        code: 'STORAGE_ERROR',
        error: 'Falha ao inativar o Conselho Particular no repositório.',
      };
    }

    const inactivatedRecord = atomicResult.record;

    return {
      success: true,
      code: 'SUCCESS',
      data: {
        id: inactivatedRecord?.id || cleanConselhoId,
        name: inactivatedRecord?.name || '',
        status: 'inativo',
        centralId: inactivatedRecord?.centralId || auth.validatedCentralId,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err?.message || 'Erro inesperado durante a inativação do Conselho Particular.',
    };
  }
}

/**
 * Lista os Conselhos Particulares pertencentes ao Conselho Central validado.
 * 
 * Regras:
 * - Valida autorização via authContext (exige allowed === true e validatedCentralId).
 * - status padrão: 'ativo', permitindo 'ativo', 'inativo' ou 'todos'.
 * - limit padrão: 50 (se não informado). Se informado e não for inteiro entre 1 e 100, retorna INVALID_OPTIONS.
 * - cursor: repassado para paginação via startAfter no repositório.
 * - Falhas de banco: retorna code 'STORAGE_ERROR' sem detalhes internos.
 */
export async function listConselhosParticulares(
  authContext: ServiceAuthContext | null | undefined,
  repository: ConselhoParticularRepository,
  options?: ListConselhosParticularesOptions
): Promise<ListConselhosParticularesServiceResult> {
  // 1. Validar autorização
  const auth = checkAuthContext(authContext);
  if (!auth.authorized) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Acesso negado. Contexto seguro de autorização é inválido ou não permitido.',
    };
  }

  // 2. Validar e sanitizar options
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

  const cleanCursor = typeof options?.cursor === 'string' && options.cursor.trim().length > 0
    ? options.cursor.trim()
    : undefined;

  // 3. Executar consulta no repositório
  try {
    if (typeof repository.listByCentralId !== 'function') {
      return {
        success: false,
        code: 'STORAGE_ERROR',
        error: 'Erro ao consultar os Conselhos Particulares no banco de dados.',
      };
    }

    const repoResult = await repository.listByCentralId(auth.validatedCentralId, {
      status: sanitizedStatus,
      limit: sanitizedLimit,
      cursor: cleanCursor,
    });

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
      error: 'Erro ao consultar os Conselhos Particulares no banco de dados.',
    };
  }
}

