import crypto from 'crypto';
import { isProductionEnvironment } from './db_errors.ts';

/**
 * Módulo de Autenticação Segura e Validação de Credenciais Server-Side
 * 
 * Emite tokens assinados com HMAC-SHA256 e valida autenticidade, integridade
 * e tempo de expiração no servidor, eliminando o aceite de IDs brutos como credencial.
 * 
 * Em produção/Cloud Run, a ausência de um segredo válido impede a inicialização do serviço.
 */

export interface AuthTokenPayload {
  userId: string;
  username: string;
  exp: number; // Timestamp Unix em segundos (deve ser finito)
}

export const isSecretRequired =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.K_SERVICE) ||
  Boolean(process.env.GAE_SERVICE);

/**
 * Obtém a chave secreta de autenticação a partir de variáveis de ambiente.
 * Quando NODE_ENV=production OU K_SERVICE estiver presente (inclusive com prefixo ais-dev-),
 * exige segredo configurado com pelo menos 32 caracteres. Sem configuração válida,
 * interrompe a inicialização com mensagem clara, sem revelar o segredo.
 */
export function getAuthSecret(): string {
  const rawSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  const secret = typeof rawSecret === 'string' ? rawSecret.trim() : '';

  if (isSecretRequired) {
    if (!secret || secret.length < 32) {
      throw new Error(
        'CONFIGURAÇÃO OBRIGATÓRIA AUSENTE OU INVÁLIDA: SESSION_SECRET (ou JWT_SECRET) deve ser configurada no ambiente com no mínimo 32 caracteres. O serviço não pode operar sem um segredo de autenticação seguro.'
      );
    }
    return secret;
  }

  if (!secret) {
    return 'dev-local-secret-ssvp-only-not-for-production';
  }
  return secret;
}

/**
 * Validação executada na inicialização do serviço.
 * Em produção ou quando K_SERVICE estiver presente, a ausência de segredo válido (>= 32 caracteres)
 * impede a inicialização.
 */
export function assertAuthConfigurationValid(): void {
  if (isSecretRequired) {
    getAuthSecret();
  }
}

/**
 * Cria uma credencial assinada com HMAC-SHA256 para o usuário autenticado com expiração (padrão 24h)
 */
export function createAuthToken(userId: string, username: string, expiresInHours = 24): string {
  if (!userId || typeof userId !== 'string' || !username || typeof username !== 'string') {
    throw new Error('userId e username válidos são obrigatórios para emissão de credencial.');
  }

  const secret = getAuthSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const payload = Buffer.from(JSON.stringify({ userId: userId.trim(), username: username.trim(), exp })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
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

  // Tokens válidos DEVEM ter exatamente 3 segmentos (header.payload.signature)
  // IDs brutos como "admin", "u1", etc. falham imediatamente nesta verificação
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { valid: false, error: 'Credencial malformada ou inválida (IDs simples não são aceitos como credencial)' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let secret: string;
  try {
    secret = getAuthSecret();
  } catch (err: any) {
    return { valid: false, error: 'Erro de configuração do servidor de autenticação' };
  }

  // Recalcular assinatura esperada com a chave secreta do servidor
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  // Comparação em tempo constante contra timing attacks
  const sigBuffer = Buffer.from(signatureB64);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Assinatura da credencial inválida ou chave divergente' };
  }

  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload: AuthTokenPayload = JSON.parse(payloadJson);

    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload da credencial inválido' };
    }

    if (!payload.userId || typeof payload.userId !== 'string') {
      return { valid: false, error: 'Campo userId ausente ou de tipo inválido' };
    }

    if (!payload.username || typeof payload.username !== 'string') {
      return { valid: false, error: 'Campo username ausente ou de tipo inválido' };
    }

    // Validação estrita de número finito para o campo de expiração
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return { valid: false, error: 'Campo exp ausente, inválido ou não-finito' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) {
      return { valid: false, error: 'Credencial expirada. Faça login novamente.' };
    }

    return { valid: true, userId: payload.userId, username: payload.username };
  } catch (err: any) {
    return { valid: false, error: 'Falha ao decodificar payload da credencial' };
  }
}
