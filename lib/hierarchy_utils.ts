/**
 * Funções puras de utilidade para normalização de nomes, validação de hierarquia e privacidade em auditorias.
 * NENHUMA Chamada de Banco de Dados ou efeito colateral é executado aqui.
 */

/**
 * Normaliza uma string removendo acentos, caracteres especiais extras e convertendo para CAIXA ALTA.
 * Usado para geração do campo `normalizedName` para buscas performáticas e ordenação sem acentuação.
 */
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos / acentos
    .replace(/[^\w\s]/g, ' ') // Substitui pontuação, hífen, símbolos por espaço
    .replace(/_/g, ' ') // Substitui underscore por espaço
    .replace(/\s+/g, ' ') // Compacta múltiplos espaços em um único
    .trim()
    .toUpperCase();
}

/**
 * Valida APENAS a forma sintática (formato/presença de strings não vazias) dos IDs da hierarquia.
 * ATENÇÃO: Esta é uma função pura de validação sintática e NÃO valida nem consulta relacionamentos
 * reais no banco de dados Firestore. A validação de existência e pertencimento real é feita no backend.
 * 
 * @param hierarchy Objeto contendo os IDs do Conselho Central, Conselho Particular e/ou Conferência
 */
export function validateHierarchyIdShape(hierarchy: {
  centralId?: string;
  particularId?: string;
  conferenciaId?: string;
}): { valid: boolean; error?: string } {
  const { centralId, particularId, conferenciaId } = hierarchy;

  if (centralId !== undefined) {
    if (!centralId || typeof centralId !== 'string' || centralId.trim().length === 0) {
      return { valid: false, error: 'centralId deve ser uma string não vazia.' };
    }
  }

  if (particularId !== undefined) {
    if (!particularId || typeof particularId !== 'string' || particularId.trim().length === 0) {
      return { valid: false, error: 'particularId deve ser uma string não vazia.' };
    }
  }

  if (conferenciaId !== undefined) {
    if (!conferenciaId || typeof conferenciaId !== 'string' || conferenciaId.trim().length === 0) {
      return { valid: false, error: 'conferenciaId deve ser uma string não vazia.' };
    }
  }

  // Se ambos particularId e centralId forem fornecidos, ambos devem estar preenchidos
  if (particularId && !centralId) {
    return { valid: false, error: 'particularId requer que centralId também seja informado.' };
  }

  // Se conferenciaId for fornecida, particularId e centralId devem estar preenchidos
  if (conferenciaId && (!particularId || !centralId)) {
    return { valid: false, error: 'conferenciaId requer que particularId e centralId também sejam informados.' };
  }

  return { valid: true };
}

/**
 * Mascara dados pessoais sensíveis (CPF, E-mail, Telefone) para inclusão segura nos diffs de logs de auditoria (LGPD).
 */
export function maskSensitiveValue(field: string, value: string): string {
  if (!value || typeof value !== 'string') return '';

  const cleanField = field.toLowerCase();

  // Mascarar CPF (ex: 123.456.789-00 -> ***.456.789-**)
  if (cleanField.includes('cpf')) {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    }
    return '***.***.***-**';
  }

  // Mascarar E-mail (ex: usuario@email.com -> u***o@email.com)
  if (cleanField.includes('email') || cleanField.includes('mail')) {
    const parts = value.split('@');
    if (parts.length === 2 && parts[0].length > 1) {
      const name = parts[0];
      const maskedName = `${name[0]}***${name[name.length - 1]}`;
      return `${maskedName}@${parts[1]}`;
    }
    return '***@***.***';
  }

  // Mascarar Telefone (ex: (16) 99999-8888 -> (16) *****-8888)
  if (cleanField.includes('phone') || cleanField.includes('telefone') || cleanField.includes('celular')) {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 8) {
      const lastFour = digits.slice(-4);
      return `(**) *****-${lastFour}`;
    }
    return '(**) *****-****';
  }

  return value;
}

/**
 * Sanitiza o payload de alteração em auditoria, mascarando campos sensíveis.
 */
export function sanitizeAuditChanges(changes: Record<string, { before: any; after: any }>): Record<string, { before: any; after: any }> {
  if (!changes || typeof changes !== 'object') return {};

  const sanitized: Record<string, { before: any; after: any }> = {};
  const sensitiveKeys = ['cpf', 'phone', 'telefone', 'celular', 'email', 'password', 'senha'];

  for (const [key, val] of Object.entries(changes)) {
    const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k));
    if (isSensitive) {
      sanitized[key] = {
        before: val.before ? maskSensitiveValue(key, String(val.before)) : null,
        after: val.after ? maskSensitiveValue(key, String(val.after)) : null,
      };
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
