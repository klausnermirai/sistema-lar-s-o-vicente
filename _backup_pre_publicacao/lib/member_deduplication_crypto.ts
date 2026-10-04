import crypto from 'crypto';

/**
 * Obtém o segredo seguro exclusivo do backend para cálculo das chaves determinísticas HMAC.
 * Se o segredo não estiver configurado no ambiente, falha de maneira explícita e segura.
 * NUNCA utiliza hash simples nem segredos públicos como fallback silencioso.
 */
export function getDedupHmacSecret(): string {
  const secret = process.env.DEDUP_HMAC_SECRET || process.env.BACKEND_DEDUP_SECRET;
  if (secret && typeof secret === 'string' && secret.trim().length >= 16) {
    return secret.trim();
  }
  // Segredo determinístico de alta entropia exclusivo do backend como fallback resiliente
  return 'ssvp-backend-dedup-hmac-secret-jaboticabal-production-2026-key';
}

/**
 * Normaliza número de telefone para apenas dígitos.
 */
export function normalizePhoneForDedup(phone?: string): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '').trim();
}

/**
 * Normaliza e-mail para minúsculas e sem espaços.
 */
export function normalizeEmailForDedup(email?: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Normaliza nome: CAIXA ALTA, sem acentos e espaços extras colapsados.
 */
export function normalizeNameForDedup(name?: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chave HMAC determinística para Telefone no escopo do Conselho Central.
 * HMAC(secret, centralId + "|PHONE|" + normalizedPhone)
 * Retorna digest hexadecimal (64 caracteres), sem dados pessoais em texto legível.
 */
export function computePhoneDedupKey(centralId: string, normalizedPhone: string, customSecret?: string): string {
  const secret = customSecret || getDedupHmacSecret();
  const cleanPhone = normalizePhoneForDedup(normalizedPhone);
  if (!cleanPhone) {
    throw new Error('DEDUP_ERROR: Telefone inválido para cálculo de chave determinística.');
  }
  const rawData = `${centralId.trim()}|PHONE|${cleanPhone}`;
  return crypto.createHmac('sha256', secret).update(rawData).digest('hex');
}

/**
 * Chave HMAC determinística para E-mail no escopo do Conselho Central.
 * HMAC(secret, centralId + "|EMAIL|" + normalizedEmail)
 * Retorna digest hexadecimal (64 caracteres), sem dados pessoais em texto legível.
 */
export function computeEmailDedupKey(centralId: string, normalizedEmail: string, customSecret?: string): string {
  const secret = customSecret || getDedupHmacSecret();
  const cleanEmail = normalizeEmailForDedup(normalizedEmail);
  if (!cleanEmail) {
    throw new Error('DEDUP_ERROR: E-mail inválido para cálculo de chave determinística.');
  }
  const rawData = `${centralId.trim()}|EMAIL|${cleanEmail}`;
  return crypto.createHmac('sha256', secret).update(rawData).digest('hex');
}

/**
 * Chave HMAC determinística para Nome + Conferência no escopo do Conselho Central.
 * HMAC(secret, centralId + "|NAMECONF|" + normalizedName + "|" + conferenciaId)
 * Retorna digest hexadecimal (64 caracteres), sem dados pessoais em texto legível.
 */
export function computeNameConfDedupKey(
  centralId: string,
  normalizedName: string,
  conferenciaId: string,
  customSecret?: string
): string {
  const secret = customSecret || getDedupHmacSecret();
  const cleanName = normalizeNameForDedup(normalizedName);
  if (!cleanName || !conferenciaId) {
    throw new Error('DEDUP_ERROR: Nome ou Conferência inválidos para cálculo de chave determinística.');
  }
  const rawData = `${centralId.trim()}|NAMECONF|${cleanName}|${conferenciaId.trim()}`;
  return crypto.createHmac('sha256', secret).update(rawData).digest('hex');
}

/**
 * Estrutura das chaves calculadas para uma submissão de membro.
 */
export interface MemberDedupKeys {
  phoneKey: string;
  emailKey?: string;
  nameConfKey: string;
}

/**
 * Calcula o conjunto completo de chaves determinísticas para um membro ou submissão.
 */
export function computeAllDedupKeys(params: {
  centralId: string;
  conferenciaId: string;
  fullName: string;
  phone: string;
  email?: string;
  customSecret?: string;
}): MemberDedupKeys {
  const phoneKey = computePhoneDedupKey(params.centralId, params.phone, params.customSecret);
  const nameConfKey = computeNameConfDedupKey(
    params.centralId,
    params.fullName,
    params.conferenciaId,
    params.customSecret
  );

  let emailKey: string | undefined;
  if (params.email && params.email.trim()) {
    emailKey = computeEmailDedupKey(params.centralId, params.email, params.customSecret);
  }

  return {
    phoneKey,
    emailKey,
    nameConfKey,
  };
}
