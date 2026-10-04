/**
 * Função utilitária pura e compartilhada para higienização de objetos destinados ao Firestore.
 * 
 * Requisitos estritos:
 * 1. Remove recursivamente propriedades cujo valor seja estritamente `undefined`, inclusive em objetos aninhados.
 * 2. Preserva rigorosamente:
 *    - `false`
 *    - `0`
 *    - `""` (strings vazias intencionais)
 *    - `null` (nulos intencionais)
 *    - instâncias de `Date`
 *    - instâncias de `Timestamp`, `FieldValue` ou outros objetos/sentinelas especiais do Firestore.
 * 3. Não utiliza `JSON.stringify` / `JSON.parse`.
 * 4. Não converte `undefined` em `null` ou `""`.
 */

function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  // Preserva instâncias de Date, Timestamp, FieldValue, etc.
  if (value instanceof Date) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => (isPlainObject(item) || Array.isArray(item) ? sanitizeForFirestore(item) : item)) as unknown as T;
  }

  // Se não for um objeto literal puro (ex: Date, Timestamp, FieldValue), retorna o valor intacto
  if (!isPlainObject(obj)) {
    return obj;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (isPlainObject(value) || Array.isArray(value)) {
      cleaned[key] = sanitizeForFirestore(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}
