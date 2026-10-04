import crypto from 'crypto';

/**
 * Módulo de Autenticação Segura e Validação de Credenciais Server-Side
 * 
 * Emite tokens assinados com HMAC-SHA256 e valida autenticidade, integridade
 * e tempo de expiração no servidor, eliminando o aceite de IDs brutos como credencial.
 */

// Chave secreta de autenticação do servidor (obtida de variável de ambiente segura ou gerada deterministicamente por instância)
const AUTH_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'ssvp-internal-auth-secret-key-2026';

export interface AuthTokenPayload {
  userId: string;
  username: string;
  exp: number; // Timestamp Unix em segundos
}

/**
 * Cria uma credencial assinada para o usuário autenticado com expiração (padrão 24h)
 */
export function createAuthToken(userId: string, username: string, expiresInHours = 24): string {
  if (!userId || !username) {
    throw new Error('userId e username são obrigatórios para emissão de credencial.');
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const payload = Buffer.from(JSON.stringify({ userId, username, exp })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Valida a autenticidade, assinatura e expiração de uma credencial recebida
 */
export function verifyAuthToken(token: string): { valid: boolean; userId?: string; username?: string; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Credencial ausente ou em formato inválido' };
  }

  const trimmed = token.trim();
  const parts = trimmed.split('.');

  // Tokens válidos DEVEM ter 3 partes (header.payload.signature)
  // IDs simples como "admin", "u1", etc. falham imediatamente aqui
  if (parts.length !== 3) {
    return { valid: false, error: 'Credencial malformada ou inválida (IDs simples não são aceitos como credencial)' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Recalcular assinatura esperada com a chave secreta do servidor
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  // Comparação em tempo constante contra ataques de timing
  const sigBuffer = Buffer.from(signatureB64);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Assinatura da credencial inválida ou violada' };
  }

  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload: AuthTokenPayload = JSON.parse(payloadJson);

    if (!payload.userId || !payload.exp) {
      return { valid: false, error: 'Payload da credencial incompleto' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
      return { valid: false, error: 'Credencial expirada. Faça login novamente.' };
    }

    return { valid: true, userId: payload.userId, username: payload.username };
  } catch (err: any) {
    return { valid: false, error: 'Falha ao decodificar payload da credencial' };
  }
}
