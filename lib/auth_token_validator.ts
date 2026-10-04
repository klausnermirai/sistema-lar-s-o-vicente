import admin from 'firebase-admin';

export interface ValidatedUserIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export interface TokenValidationResult {
  valid: boolean;
  identity?: ValidatedUserIdentity;
  error?: string;
  code?: 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'REVOKED_TOKEN' | 'UNKNOWN_ERROR';
}

/**
 * Valida um Firebase ID Token de forma comum (sem checagem em tempo real de revogação no servidor Firebase Auth).
 * Retorna apenas os campos mínimos e higienizados da identidade (uid, email, emailVerified).
 */
export async function validateFirebaseIdToken(
  idToken: string | undefined | null,
  authInstance: { verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<any> } = admin.auth()
): Promise<TokenValidationResult> {
  if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
    return {
      valid: false,
      error: 'Token de autenticação não fornecido ou inválido.',
      code: 'MISSING_TOKEN',
    };
  }

  const cleanToken = idToken.startsWith('Bearer ') ? idToken.slice(7).trim() : idToken.trim();

  if (!cleanToken) {
    return {
      valid: false,
      error: 'Token de autenticação no formato Bearer está vazio.',
      code: 'MISSING_TOKEN',
    };
  }

  try {
    const decodedToken = await authInstance.verifyIdToken(cleanToken, false);
    return {
      valid: true,
      identity: {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        emailVerified: !!decodedToken.email_verified,
      },
    };
  } catch (err: any) {
    const errorCode = err?.code || '';
    const message = err?.message || 'Token de autenticação inválido.';

    if (errorCode === 'auth/id-token-expired' || message.includes('expired')) {
      return {
        valid: false,
        error: 'Sessão expirada. Por favor, faça login novamente.',
        code: 'EXPIRED_TOKEN',
      };
    }

    if (errorCode === 'auth/id-token-revoked' || message.includes('revoked')) {
      return {
        valid: false,
        error: 'Sessão revogada. Faça login novamente.',
        code: 'REVOKED_TOKEN',
      };
    }

    return {
      valid: false,
      error: 'Token de autenticação inválido ou corrompido.',
      code: 'INVALID_TOKEN',
    };
  }
}

/**
 * Valida um Firebase ID Token para OPERAÇÕES SENSÍVEIS (com checagem em tempo real de revogação/desativação `checkRevoked = true`).
 * Se o token foi revogado via `revokeRefreshTokens(uid)` ou a conta foi desativada no Firebase, retorna `REVOKED_TOKEN`.
 */
export async function validateSensitiveFirebaseIdToken(
  idToken: string | undefined | null,
  authInstance: { verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<any> } = admin.auth()
): Promise<TokenValidationResult> {
  if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
    return {
      valid: false,
      error: 'Token de autenticação não fornecido ou inválido para operação sensível.',
      code: 'MISSING_TOKEN',
    };
  }

  const cleanToken = idToken.startsWith('Bearer ') ? idToken.slice(7).trim() : idToken.trim();

  if (!cleanToken) {
    return {
      valid: false,
      error: 'Token de autenticação no formato Bearer está vazio.',
      code: 'MISSING_TOKEN',
    };
  }

  try {
    const decodedToken = await authInstance.verifyIdToken(cleanToken, true); // checkRevoked = true
    return {
      valid: true,
      identity: {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        emailVerified: !!decodedToken.email_verified,
      },
    };
  } catch (err: any) {
    const errorCode = err?.code || '';
    const message = err?.message || 'Token de autenticação inválido.';

    if (errorCode === 'auth/id-token-revoked' || message.includes('revoked') || message.includes('disabled')) {
      return {
        valid: false,
        error: 'Sessão revogada ou conta desativada. Por favor, faça login novamente.',
        code: 'REVOKED_TOKEN',
      };
    }

    if (errorCode === 'auth/id-token-expired' || message.includes('expired')) {
      return {
        valid: false,
        error: 'Sessão expirada. Por favor, faça login novamente.',
        code: 'EXPIRED_TOKEN',
      };
    }

    return {
      valid: false,
      error: 'Token de autenticação inválido ou corrompido.',
      code: 'INVALID_TOKEN',
    };
  }
}
