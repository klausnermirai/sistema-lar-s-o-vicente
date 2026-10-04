import { TokenValidationResult } from './auth_token_validator.js';
import {
  authorizeInstitutionScope,
  UserProfileScopeMock,
  InstitutionDocMock,
  ScopeAuthorizationOptions,
} from './institution_authorization.js';

export interface UserProfileWithAuthUid extends UserProfileScopeMock {
  authUid?: string | null;
}

export type SecureAuthContextCode =
  | 'AUTHORIZED'
  | 'INVALID_TOKEN'
  | 'MISSING_TOKEN_UID'
  | 'MISSING_USER_AUTHUID'
  | 'AUTHUID_MISMATCH'
  | 'SCOPE_AUTHORIZATION_FAILED';

export interface SecureAuthorizationContextResult {
  authorized: boolean;
  code: SecureAuthContextCode;
  reason: string;
  uid?: string;
  userId?: string;
  institutionId?: string;
  validatedCentralId?: string;
}

/**
 * Função pura e isolada para construir o contexto seguro de autorização.
 * Requer validação prévia do ID Token do Firebase, checagem estrita de igualdade com `userProfile.authUid`
 * e validação do escopo institucional via `authorizeInstitutionScope`.
 */
export function buildSecureAuthorizationContext(
  validatedTokenResult: TokenValidationResult | null | undefined,
  userProfile: UserProfileWithAuthUid | null | undefined,
  requestedInstitutionId: string | null | undefined,
  institutionData: InstitutionDocMock | null | undefined,
  options: ScopeAuthorizationOptions = {}
): SecureAuthorizationContextResult {
  // 1. Rejeitar token inválido ou ausente
  if (!validatedTokenResult || !validatedTokenResult.valid) {
    return {
      authorized: false,
      code: 'INVALID_TOKEN',
      reason: validatedTokenResult?.error || 'Token de autenticação inválido ou ausente.',
    };
  }

  // 2. Rejeitar token sem UID
  const tokenUid = validatedTokenResult.identity?.uid;
  if (!tokenUid || typeof tokenUid !== 'string' || tokenUid.trim().length === 0) {
    return {
      authorized: false,
      code: 'MISSING_TOKEN_UID',
      reason: 'Token de autenticação validado não possui um UID de usuário.',
    };
  }

  const cleanTokenUid = tokenUid.trim();

  // 3. Rejeitar se userProfile não possui authUid cadastrado (NÃO aceita userId nem email como substituto)
  const userAuthUid = userProfile?.authUid;
  if (!userAuthUid || typeof userAuthUid !== 'string' || userAuthUid.trim().length === 0) {
    return {
      authorized: false,
      code: 'MISSING_USER_AUTHUID',
      reason: 'O perfil do usuário não possui o campo authUid vinculado. Acesso negado.',
      uid: cleanTokenUid,
      userId: userProfile?.id,
    };
  }

  // 4. Exigir que userProfile.authUid seja EXATAMENTE igual ao tokenUid
  const cleanUserAuthUid = userAuthUid.trim();
  if (cleanUserAuthUid !== cleanTokenUid) {
    return {
      authorized: false,
      code: 'AUTHUID_MISMATCH',
      reason: 'O authUid do perfil do usuário diverge do UID validado no ID Token.',
      uid: cleanTokenUid,
      userId: userProfile?.id,
    };
  }

  // 5. Chamar authorizeInstitutionScope para validar a permissão e o escopo da instituição
  const scopeResult = authorizeInstitutionScope(
    userProfile,
    requestedInstitutionId,
    institutionData,
    options
  );

  const cleanInstId = requestedInstitutionId ? requestedInstitutionId.trim() : undefined;

  if (!scopeResult.allowed) {
    return {
      authorized: false,
      code: 'SCOPE_AUTHORIZATION_FAILED',
      reason: scopeResult.reason,
      uid: cleanTokenUid,
      userId: userProfile?.id,
      institutionId: cleanInstId,
    };
  }

  // 6. Retornar decisão autorizada sem dados sensíveis ou tokens
  return {
    authorized: true,
    code: 'AUTHORIZED',
    reason: 'Contexto de autorização validado e autorizado com sucesso.',
    uid: cleanTokenUid,
    userId: userProfile?.id,
    institutionId: cleanInstId,
    validatedCentralId: scopeResult.validatedCentralId,
  };
}
