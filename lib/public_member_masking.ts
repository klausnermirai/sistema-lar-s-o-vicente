import crypto from 'crypto';

// Segredo do servidor para assinatura dos identificadores públicos opacos (HMAC)
const SERVER_HMAC_SECRET = process.env.OPAQUE_TOKEN_SECRET || 'ssvp-public-opaque-member-token-secret-2026';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas de validade para o token opaco da sessão

export interface OpaqueMemberTokenPayload {
  originType: 'membro' | 'submission';
  realId: string;
  centralId: string;
  conferenciaId: string;
  exp: number;
  nonce: string;
}

/**
 * Gera um identificador opaco, assinado e com validade limitada para o membro/solicitação.
 * Impede que o ID interno do Firestore seja inferido ou adivinhado por terceiros.
 */
export function generateOpaqueMemberToken(params: {
  originType: 'membro' | 'submission';
  realId: string;
  centralId: string;
  conferenciaId: string;
  ttlMs?: number;
}): string {
  const payload: OpaqueMemberTokenPayload = {
    originType: params.originType,
    realId: params.realId,
    centralId: params.centralId,
    conferenciaId: params.conferenciaId,
    exp: Date.now() + (params.ttlMs || DEFAULT_TTL_MS),
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Decodifica e valida a assinatura criptográfica e a expiração do token opaco.
 */
export function verifyAndDecodeOpaqueMemberToken(
  token: string,
  expectedCentralId?: string
): { originType: 'membro' | 'submission'; realId: string; centralId: string; conferenciaId: string } | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, providedSignature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  // Comparação segura contra timing attacks
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr) as OpaqueMemberTokenPayload;

    if (!payload || !payload.realId || !payload.originType || !payload.exp) {
      return null;
    }

    if (Date.now() > payload.exp) {
      return null; // Token expirado
    }

    if (expectedCentralId && payload.centralId !== expectedCentralId) {
      return null; // Central mismatch
    }

    return {
      originType: payload.originType,
      realId: payload.realId,
      centralId: payload.centralId,
      conferenciaId: payload.conferenciaId,
    };
  } catch {
    return null;
  }
}

/**
 * Mascara número de telefone: preserva DDD e 4 dígitos finais.
 * Ex: (16) 99999-1234 -> (16) 9****-1234
 * Ex: (16) 3333-1234 -> (16) ****-1234
 */
export function maskPhone(phone?: string): string {
  if (!phone || typeof phone !== 'string') {
    return 'Não informado';
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return '****-****';
  }

  const ddd = digits.substring(0, 2);
  const lastFour = digits.substring(digits.length - 4);
  const isNineDigit = digits.length === 11;

  if (isNineDigit) {
    const firstDigit = digits.substring(2, 3);
    return `(${ddd}) ${firstDigit}****-${lastFour}`;
  }
  return `(${ddd}) ****-${lastFour}`;
}

/**
 * Mascara e-mail: preserva inicial e domínio.
 * Ex: joao.silva@gmail.com -> j***@gmail.com
 */
export function maskEmail(email?: string): string | null {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return null;
  }
  const parts = email.trim().toLowerCase().split('@');
  const user = parts[0];
  const domain = parts[1];

  if (!user || !domain) return null;

  const firstChar = user.charAt(0);
  return `${firstChar}***@${domain}`;
}

/**
 * Mascara data de nascimento: revela apenas o ano para conferência de idade sem expor dia e mês.
 * Exemplo: 1980-05-15 -> mascara como ano final
 */
export function maskBirthDate(birthDate?: string): string | null {
  if (!birthDate || typeof birthDate !== 'string') {
    return null;
  }
  const trimmed = birthDate.trim();
  // Formato AAAA-MM-DD
  const match = trimmed.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (match) {
    const year = match[1];
    return `**/**/${year}`;
  }
  return 'Data registrada';
}

export function maskCpf(cpf?: string): string | null {
  if (!cpf || typeof cpf !== 'string') {
    return null;
  }
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) {
    return '***.***.***-**';
  }
  return `***.${digits.substring(3, 6)}.${digits.substring(6, 9)}-**`;
}

export function maskAddress(address?: string): string | null {
  if (!address || typeof address !== 'string') {
    return null;
  }
  const trimmed = address.trim();
  if (!trimmed) return null;
  return `${trimmed.substring(0, Math.min(12, trimmed.length))}... (Registrado)`;
}

/**
 * Retorna status da data (sem revelar o valor original): 'informada' ou 'nao_informada'.
 */
export function getDateStatus(dateVal?: string): 'informada' | 'nao_informada' {
  if (!dateVal || typeof dateVal !== 'string' || !dateVal.trim()) {
    return 'nao_informada';
  }
  return 'informada';
}
