/**
 * Política Pura e Isolada de Autorização Institucional.
 * NENHUMA chamada de rede, NENHUMA importação de SDK, NENHUM efeito colateral ou acesso ao banco/Firebase Auth.
 */

export interface UserProfileScopeMock {
  id: string;
  email?: string;
  status?: string; // ex: 'ativo', 'inativo'
  accessLevel?: string; // ex: 'administrador', 'gerencial', 'cuidados', etc.
  isGlobalAdmin?: boolean; // Apenas superusuário de TI/Infra
  institutionId?: string; // Instituição padrão/legada
  institutionIds?: string[]; // Lista de IDs de instituições permitidas ao usuário
}

export interface InstitutionDocMock {
  id: string; // ID interno imutável do documento
  cnpj?: string;
  name?: string;
  status?: string; // ex: 'ativo', 'inativo'
  entityType?: string; // ex: 'conselho_central', 'obra_unida', 'conselho_metropolitano', etc.
  type?: string;
}

export interface ScopeAuthorizationOptions {
  requireCentralCouncil?: boolean;
}

export type AuthorizationCode =
  | 'AUTHORIZED'
  | 'MISSING_USER'
  | 'USER_INACTIVE'
  | 'MISSING_INSTITUTION_ID'
  | 'INSTITUTION_ID_MISMATCH'
  | 'INSTITUTION_INACTIVE'
  | 'ACCESS_DENIED_NOT_IN_PERMITTED_LIST'
  | 'NOT_CENTRAL_COUNCIL';

export interface ScopeAuthorizationResult {
  allowed: boolean;
  code: AuthorizationCode;
  reason: string;
  validatedCentralId?: string;
}

/**
 * Valida o escopo de autorização de um usuário para acessar uma instituição específica.
 */
export function authorizeInstitutionScope(
  userProfile: UserProfileScopeMock | null | undefined,
  requestedInstitutionId: string | null | undefined,
  institutionData: InstitutionDocMock | null | undefined,
  options: ScopeAuthorizationOptions = {}
): ScopeAuthorizationResult {
  // 1. Rejeitar usuário ausente
  if (!userProfile) {
    return {
      allowed: false,
      code: 'MISSING_USER',
      reason: 'Perfil de usuário não fornecido para validação de escopo.',
    };
  }

  // 1b. Rejeitar usuário com status diferente de ativo
  if (userProfile.status !== 'ativo') {
    return {
      allowed: false,
      code: 'USER_INACTIVE',
      reason: 'O usuário encontra-se inativo no sistema.',
    };
  }

  // 2. Rejeitar requestedInstitutionId vazio ou nulo
  if (!requestedInstitutionId || typeof requestedInstitutionId !== 'string' || requestedInstitutionId.trim().length === 0) {
    return {
      allowed: false,
      code: 'MISSING_INSTITUTION_ID',
      reason: 'O identificador da instituição solicitada (x-institution-id) é obrigatório.',
    };
  }

  const cleanRequestedId = requestedInstitutionId.trim();

  // 3. Confirmar que o ID solicitado corresponde exatamente ao ID do documento da instituição recebido
  if (!institutionData || institutionData.id !== cleanRequestedId) {
    return {
      allowed: false,
      code: 'INSTITUTION_ID_MISMATCH',
      reason: 'A instituição solicitada não foi localizada ou não corresponde ao documento fornecido.',
    };
  }

  // 5. Rejeitar instituição com status diferente de ativo
  if (institutionData.status !== 'ativo') {
    return {
      allowed: false,
      code: 'INSTITUTION_INACTIVE',
      reason: 'A instituição solicitada encontra-se inativa.',
    };
  }

  // 6 & 7. Para usuário comum ou administrador institucional (isGlobalAdmin !== true),
  // exigir que o ID solicitado esteja em userProfile.institutionIds ou seja igual ao userProfile.institutionId
  const isGlobalAdmin = userProfile.isGlobalAdmin === true;

  if (!isGlobalAdmin) {
    const defaultInstId = userProfile.institutionId;
    const permittedList = Array.isArray(userProfile.institutionIds) ? userProfile.institutionIds : [];

    const isPermitted = (defaultInstId && defaultInstId === cleanRequestedId) || permittedList.includes(cleanRequestedId);

    if (!isPermitted) {
      return {
        allowed: false,
        code: 'ACCESS_DENIED_NOT_IN_PERMITTED_LIST',
        reason: 'Acesso negado: A instituição solicitada não pertence à lista de instituições permitidas para este usuário.',
      };
    }
  }

  // 9. Quando requireCentralCouncil === true, exigir que a instituição seja do tipo conselho_central
  if (options.requireCentralCouncil === true) {
    const isCentralCouncil = institutionData.entityType === 'conselho_central' || institutionData.type === 'conselho_central';
    if (!isCentralCouncil) {
      return {
        allowed: false,
        code: 'NOT_CENTRAL_COUNCIL',
        reason: 'A instituição solicitada não é um Conselho Central válido.',
      };
    }
  }

  // 10. Retornar decisão autorizada
  return {
    allowed: true,
    code: 'AUTHORIZED',
    reason: 'Acesso à instituição autorizado com sucesso.',
    validatedCentralId: cleanRequestedId,
  };
}
