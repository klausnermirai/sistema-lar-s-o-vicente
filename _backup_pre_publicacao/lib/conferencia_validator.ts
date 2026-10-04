/**
 * Validador Puro para Criação e Edição de Conferência (StandaloneConferencia).
 * 
 * Regras Estritas:
 * - NENHUMA chamada de rede, acesso a banco de dados ou efeitos colaterais.
 * - O nome é obrigatório (string não vazia).
 * - validatedCentralId e particularId são obrigatórios e provêm do contexto seguro.
 * - Exige a presença do Conselho Particular pai (parentParticular).
 * - Exige que parentParticular.id === particularId (código: PARENT_PARTICULAR_ID_MISMATCH).
 * - Exige que parentParticular.centralId === validatedCentralId (código: PARENT_PARTICULAR_CENTRAL_MISMATCH).
 * - Exige que parentParticular.status === 'ativo' (código: INACTIVE_PARENT_PARTICULAR).
 * - Rejeita centralId ou particularId fornecidos no formulário se forem divergentes.
 * - id, centralId, particularId, createdAt e createdBy são estritamente imutáveis na edição.
 * - Aceita somente status 'ativo' ou 'inativo'.
 * - Gera automaticamente o campo `normalizedName` utilizando normalizeName().
 * - Nunca muta os objetos recebidos.
 * - Retorna resultado estruturado contendo { valid, code, error, normalizedData }.
 */

import { StandaloneConferencia, StandaloneConselhoParticular } from '../types.js';
import { normalizeName } from './hierarchy_utils.js';

export type ConferenciaValidationCode =
  | 'VALID'
  | 'INVALID_PAYLOAD'
  | 'MISSING_VALIDATED_CENTRAL_ID'
  | 'MISSING_PARTICULAR_ID'
  | 'PARENT_PARTICULAR_NOT_FOUND'
  | 'PARENT_PARTICULAR_ID_MISMATCH'
  | 'PARENT_PARTICULAR_CENTRAL_MISMATCH'
  | 'INACTIVE_PARENT_PARTICULAR'
  | 'MISSING_NAME'
  | 'CENTRAL_ID_MISMATCH'
  | 'PARTICULAR_ID_MISMATCH'
  | 'IMMUTABLE_FIELD_MODIFIED'
  | 'INVALID_STATUS';

export interface ConferenciaValidationResult {
  valid: boolean;
  code: ConferenciaValidationCode;
  error?: string;
  normalizedData?: StandaloneConferencia;
}

export interface ValidateConferenciaOptions {
  isEdit?: boolean;
  existingRecord?: StandaloneConferencia | null;
  currentUserId?: string;
}

/**
 * Valida e normaliza os dados para criação ou edição de uma Conferência.
 */
export function validateConferenciaInput(
  rawInput: Record<string, any> | null | undefined,
  validatedCentralId: string | null | undefined,
  particularId: string | null | undefined,
  parentParticular: StandaloneConselhoParticular | null | undefined,
  options: ValidateConferenciaOptions = {}
): ConferenciaValidationResult {
  // 1. Validar payload bruto
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return {
      valid: false,
      code: 'INVALID_PAYLOAD',
      error: 'Payload de entrada para a Conferência é inválido ou ausente.',
    };
  }

  // 2. Validar validatedCentralId do contexto seguro
  const cleanValidatedCentralId = typeof validatedCentralId === 'string' ? validatedCentralId.trim() : '';
  if (!cleanValidatedCentralId) {
    return {
      valid: false,
      code: 'MISSING_VALIDATED_CENTRAL_ID',
      error: 'validatedCentralId é obrigatório e deve ser derivado do contexto seguro de autorização.',
    };
  }

  // 3. Validar particularId obrigatório
  const cleanParticularId = typeof particularId === 'string' ? particularId.trim() : '';
  if (!cleanParticularId) {
    return {
      valid: false,
      code: 'MISSING_PARTICULAR_ID',
      error: 'particularId é obrigatório para associar a Conferência ao Conselho Particular.',
    };
  }

  // 4. Validar o Conselho Particular pai (parentParticular)
  if (!parentParticular || typeof parentParticular !== 'object') {
    return {
      valid: false,
      code: 'PARENT_PARTICULAR_NOT_FOUND',
      error: 'O Conselho Particular pai informado não foi encontrado.',
    };
  }

  // 4a. Verificar se parentParticular.id === particularId
  const parentId = typeof parentParticular.id === 'string' ? parentParticular.id.trim() : '';
  if (parentId !== cleanParticularId) {
    return {
      valid: false,
      code: 'PARENT_PARTICULAR_ID_MISMATCH',
      error: `O ID do Conselho Particular pai (${parentId}) não coincide com o particularId informado (${cleanParticularId}).`,
    };
  }

  // 4b. Verificar se parentParticular pertence ao mesmo Conselho Central
  const parentCentralId = typeof parentParticular.centralId === 'string' ? parentParticular.centralId.trim() : '';
  if (parentCentralId !== cleanValidatedCentralId) {
    return {
      valid: false,
      code: 'PARENT_PARTICULAR_CENTRAL_MISMATCH',
      error: `O Conselho Particular pai pertence ao Conselho Central (${parentCentralId}), divergente do contexto seguro (${cleanValidatedCentralId}).`,
    };
  }

  // 4c. Verificar se o Conselho Particular pai está ativo
  if (parentParticular.status !== 'ativo') {
    return {
      valid: false,
      code: 'INACTIVE_PARENT_PARTICULAR',
      error: 'Não é possível vincular ou editar uma Conferência em um Conselho Particular inativo.',
    };
  }

  // 5. Validar nome obrigatório
  const rawName = typeof rawInput.name === 'string' ? rawInput.name.trim() : '';
  if (!rawName) {
    return {
      valid: false,
      code: 'MISSING_NAME',
      error: 'O nome da Conferência é obrigatório e não pode ser vazio.',
    };
  }

  // 6. Validar se centralId enviado no formulário diverge do contexto seguro
  if (rawInput.centralId !== undefined && rawInput.centralId !== null) {
    const formCentralId = typeof rawInput.centralId === 'string' ? rawInput.centralId.trim() : String(rawInput.centralId);
    if (formCentralId && formCentralId !== cleanValidatedCentralId) {
      return {
        valid: false,
        code: 'CENTRAL_ID_MISMATCH',
        error: 'O centralId fornecido no formulário não coincide com o centralId do contexto seguro.',
      };
    }
  }

  // 7. Validar se particularId enviado no formulário diverge do particularId validado
  if (rawInput.particularId !== undefined && rawInput.particularId !== null) {
    const formParticularId = typeof rawInput.particularId === 'string' ? rawInput.particularId.trim() : String(rawInput.particularId);
    if (formParticularId && formParticularId !== cleanParticularId) {
      return {
        valid: false,
        code: 'PARTICULAR_ID_MISMATCH',
        error: 'O particularId fornecido no formulário não coincide com o particularId do contexto seguro.',
      };
    }
  }

  // 8. Validar status (somente 'ativo' ou 'inativo')
  const rawStatus = rawInput.status !== undefined ? rawInput.status : (options.existingRecord?.status || 'ativo');
  if (rawStatus !== 'ativo' && rawStatus !== 'inativo') {
    return {
      valid: false,
      code: 'INVALID_STATUS',
      error: "O status da Conferência deve ser exclusivamente 'ativo' ou 'inativo'.",
    };
  }

  // 9. Regras de Imutabilidade na Edição
  const isEdit = options.isEdit || Boolean(options.existingRecord);
  const existingRecord = options.existingRecord;

  if (isEdit && existingRecord) {
    // A. id é imutável
    if (rawInput.id !== undefined && rawInput.id !== null) {
      const inputId = String(rawInput.id).trim();
      if (inputId && inputId !== existingRecord.id.trim()) {
        return {
          valid: false,
          code: 'IMMUTABLE_FIELD_MODIFIED',
          error: 'O campo id da Conferência é imutável e não pode ser alterado.',
        };
      }
    }

    // B. centralId é imutável
    if (rawInput.centralId !== undefined && rawInput.centralId !== null) {
      const inputCentralId = String(rawInput.centralId).trim();
      if (inputCentralId && inputCentralId !== existingRecord.centralId.trim()) {
        return {
          valid: false,
          code: 'IMMUTABLE_FIELD_MODIFIED',
          error: 'O campo centralId é imutável e não pode ser alterado.',
        };
      }
    }

    // C. particularId é imutável
    if (rawInput.particularId !== undefined && rawInput.particularId !== null) {
      const inputParticularId = String(rawInput.particularId).trim();
      if (inputParticularId && inputParticularId !== existingRecord.particularId.trim()) {
        return {
          valid: false,
          code: 'IMMUTABLE_FIELD_MODIFIED',
          error: 'O campo particularId é imutável e não pode ser alterado.',
        };
      }
    }

    // D. createdAt é imutável
    if (rawInput.createdAt !== undefined && rawInput.createdAt !== null) {
      if (String(rawInput.createdAt) !== existingRecord.createdAt) {
        return {
          valid: false,
          code: 'IMMUTABLE_FIELD_MODIFIED',
          error: 'O campo createdAt é imutável e não pode ser alterado.',
        };
      }
    }

    // E. createdBy é imutável
    if (rawInput.createdBy !== undefined && rawInput.createdBy !== null) {
      if (String(rawInput.createdBy) !== existingRecord.createdBy) {
        return {
          valid: false,
          code: 'IMMUTABLE_FIELD_MODIFIED',
          error: 'O campo createdBy é imutável e não pode ser alterado.',
        };
      }
    }
  }

  // 10. Construir objeto normalizado sem mutar os objetos recebidos
  const nowIso = new Date().toISOString();
  const userId = options.currentUserId || 'system';

  const docId = isEdit && existingRecord
    ? existingRecord.id
    : (rawInput.id ? String(rawInput.id).trim() : '');

  const createdAt = isEdit && existingRecord
    ? existingRecord.createdAt
    : (rawInput.createdAt ? String(rawInput.createdAt) : nowIso);

  const createdBy = isEdit && existingRecord
    ? existingRecord.createdBy
    : (rawInput.createdBy ? String(rawInput.createdBy) : userId);

  const normalizedName = normalizeName(rawName);

  const addressStreet = rawInput.addressStreet ? String(rawInput.addressStreet).trim() : (existingRecord?.addressStreet || undefined);
  const addressNumber = rawInput.addressNumber ? String(rawInput.addressNumber).trim() : (existingRecord?.addressNumber || undefined);
  const addressComplement = rawInput.addressComplement ? String(rawInput.addressComplement).trim() : (existingRecord?.addressComplement || undefined);
  const addressNeighborhood = rawInput.addressNeighborhood ? String(rawInput.addressNeighborhood).trim() : (existingRecord?.addressNeighborhood || undefined);
  const addressCity = rawInput.addressCity ? String(rawInput.addressCity).trim() : (existingRecord?.addressCity || undefined);
  const addressState = rawInput.addressState ? String(rawInput.addressState).trim().toUpperCase().substring(0, 2) : (existingRecord?.addressState || undefined);
  const addressZip = rawInput.addressZip ? String(rawInput.addressZip).trim() : (existingRecord?.addressZip || undefined);

  let fullAddress = rawInput.fullAddress ? String(rawInput.fullAddress).trim() : (existingRecord?.fullAddress || undefined);
  if (!fullAddress && addressStreet) {
    const parts = [
      addressStreet,
      addressNumber ? `nº ${addressNumber}` : '',
      addressComplement,
      addressNeighborhood,
      addressCity,
      addressState,
      addressZip ? `CEP: ${addressZip}` : ''
    ].filter(Boolean);
    if (parts.length > 0) {
      fullAddress = parts.join(', ');
    }
  }

  const normalizedData: StandaloneConferencia = {
    id: docId,
    particularId: cleanParticularId,
    centralId: cleanValidatedCentralId,
    name: rawName,
    normalizedName,
    code: rawInput.code ? String(rawInput.code).trim() : (existingRecord?.code || undefined),
    foundationDate: rawInput.foundationDate ? String(rawInput.foundationDate) : (existingRecord?.foundationDate || undefined),
    aggregationDate: rawInput.aggregationDate ? String(rawInput.aggregationDate) : (existingRecord?.aggregationDate || undefined),
    meetingDay: rawInput.meetingDay ? String(rawInput.meetingDay).trim() : (existingRecord?.meetingDay || undefined),
    meetingTime: rawInput.meetingTime ? String(rawInput.meetingTime).trim() : (existingRecord?.meetingTime || undefined),
    location: rawInput.location ? String(rawInput.location).trim() : (existingRecord?.location || undefined),
    addressStreet,
    addressNumber,
    addressComplement,
    addressNeighborhood,
    addressCity,
    addressState,
    addressZip,
    fullAddress,
    phone: rawInput.phone ? String(rawInput.phone).trim() : (existingRecord?.phone || undefined),
    email: rawInput.email ? String(rawInput.email).trim() : (existingRecord?.email || undefined),
    startDate: rawInput.startDate ? String(rawInput.startDate) : (existingRecord?.startDate || undefined),
    endDate: rawInput.endDate ? String(rawInput.endDate) : (existingRecord?.endDate || undefined),
    presidente: rawInput.presidente ? { ...rawInput.presidente } : (existingRecord?.presidente ? { ...existingRecord.presidente } : undefined),
    vicePresidente: rawInput.vicePresidente ? { ...rawInput.vicePresidente } : (existingRecord?.vicePresidente ? { ...existingRecord.vicePresidente } : undefined),
    secretario: rawInput.secretario ? { ...rawInput.secretario } : (existingRecord?.secretario ? { ...existingRecord.secretario } : undefined),
    segundoSecretario: rawInput.segundoSecretario ? { ...rawInput.segundoSecretario } : (existingRecord?.segundoSecretario ? { ...existingRecord.segundoSecretario } : undefined),
    tesoureiro: rawInput.tesoureiro ? { ...rawInput.tesoureiro } : (existingRecord?.tesoureiro ? { ...existingRecord.tesoureiro } : undefined),
    segundoTesoureiro: rawInput.segundoTesoureiro ? { ...rawInput.segundoTesoureiro } : (existingRecord?.segundoTesoureiro ? { ...existingRecord.segundoTesoureiro } : undefined),
    legacyCounts: rawInput.legacyCounts ? { ...rawInput.legacyCounts } : (existingRecord?.legacyCounts ? { ...existingRecord.legacyCounts } : undefined),
    countsCache: rawInput.countsCache ? { ...rawInput.countsCache } : (existingRecord?.countsCache ? { ...existingRecord.countsCache } : undefined),
    mandateHistory: Array.isArray(rawInput.mandateHistory)
      ? rawInput.mandateHistory.map((m: any) => ({ ...m }))
      : (existingRecord?.mandateHistory ? existingRecord.mandateHistory.map((m: any) => ({ ...m })) : undefined),
    notes: rawInput.notes ? String(rawInput.notes).trim() : (existingRecord?.notes || undefined),
    status: rawStatus as 'ativo' | 'inativo',
    createdAt,
    updatedAt: nowIso,
    createdBy,
    updatedBy: userId,
    migrationId: rawInput.migrationId ? String(rawInput.migrationId) : (existingRecord?.migrationId || undefined),
  };

  return {
    valid: true,
    code: 'VALID',
    normalizedData,
  };
}
