/**
 * Validador Puro para Criação e Edição de Conselho Particular (StandaloneConselhoParticular).
 * 
 * Regras Estritas:
 * - NENHUMA chamada de rede, acesso a banco de dados ou efeitos colaterais.
 * - O nome é obrigatório (string não vazia).
 * - O validatedCentralId é obrigatório e provém do contexto seguro de autorização.
 * - Rejeita centralId se fornecido no formulário e divergente de validatedCentralId.
 * - id, centralId, createdAt e createdBy são estritamente imutáveis na edição.
 * - Aceita somente status 'ativo' ou 'inativo'.
 * - Gera automaticamete o campo `normalizedName` utilizando normalizeName().
 * - Nunca muta os objetos recebidos.
 * - Retorna resultado estruturado contendo { valid, code, error, normalizedData }.
 */

import { StandaloneConselhoParticular } from '../types.js';
import { normalizeName } from './hierarchy_utils.js';

export type ConselhoParticularValidationCode =
  | 'VALID'
  | 'INVALID_PAYLOAD'
  | 'MISSING_NAME'
  | 'MISSING_VALIDATED_CENTRAL_ID'
  | 'CENTRAL_ID_MISMATCH'
  | 'IMMUTABLE_FIELD_MODIFIED'
  | 'INVALID_STATUS';

export interface ConselhoParticularValidationResult {
  valid: boolean;
  code: ConselhoParticularValidationCode;
  error?: string;
  normalizedData?: StandaloneConselhoParticular;
}

export interface ValidateConselhoParticularOptions {
  isEdit?: boolean;
  existingRecord?: StandaloneConselhoParticular | null;
  currentUserId?: string;
}

/**
 * Valida e normaliza os dados para criação ou edição de um Conselho Particular.
 */
export function validateConselhoParticularInput(
  rawInput: Record<string, any> | null | undefined,
  validatedCentralId: string | null | undefined,
  options: ValidateConselhoParticularOptions = {}
): ConselhoParticularValidationResult {
  // 1. Validar payload bruto
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return {
      valid: false,
      code: 'INVALID_PAYLOAD',
      error: 'Payload de entrada para o Conselho Particular é inválido ou ausente.',
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

  // 3. Validar nome obrigatorio
  const rawName = typeof rawInput.name === 'string' ? rawInput.name.trim() : '';
  if (!rawName) {
    return {
      valid: false,
      code: 'MISSING_NAME',
      error: 'O nome do Conselho Particular é obrigatório e não pode ser vazio.',
    };
  }

  // 4. Se centralId for enviado no formulário, rejeitar se divergente de validatedCentralId
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

  // 5. Validar status (somente 'ativo' ou 'inativo')
  const rawStatus = rawInput.status !== undefined ? rawInput.status : (options.existingRecord?.status || 'ativo');
  if (rawStatus !== 'ativo' && rawStatus !== 'inativo') {
    return {
      valid: false,
      code: 'INVALID_STATUS',
      error: "O status do Conselho Particular deve ser exclusivamente 'ativo' ou 'inativo'.",
    };
  }

  // 6. Regras de Imutabilidade na Edição
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
          error: 'O campo id do Conselho Particular é imutável e não pode ser alterado.',
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

    // C. createdAt é imutável
    if (rawInput.createdAt !== undefined && rawInput.createdAt !== null) {
      if (String(rawInput.createdAt) !== existingRecord.createdAt) {
        return {
          valid: false,
          code: 'IMMUTABLE_FIELD_MODIFIED',
          error: 'O campo createdAt é imutável e não pode ser alterado.',
        };
      }
    }

    // D. createdBy é imutável
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

  // 7. Construir objeto normalizado sem mutar rawInput nem existingRecord
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

  const normalizedData: StandaloneConselhoParticular = {
    id: docId,
    centralId: cleanValidatedCentralId,
    name: rawName,
    normalizedName,
    code: rawInput.code ? String(rawInput.code).trim() : (existingRecord?.code || undefined),
    institutionDate: rawInput.institutionDate ? String(rawInput.institutionDate) : (existingRecord?.institutionDate || undefined),
    city: addressCity || (rawInput.city ? String(rawInput.city).trim() : (existingRecord?.city || undefined)),
    phone: rawInput.phone ? String(rawInput.phone).trim() : (existingRecord?.phone || undefined),
    email: rawInput.email ? String(rawInput.email).trim() : (existingRecord?.email || undefined),
    addressStreet,
    addressNumber,
    addressComplement,
    addressNeighborhood,
    addressCity,
    addressState,
    addressZip,
    fullAddress,
    startDate: rawInput.startDate ? String(rawInput.startDate) : (existingRecord?.startDate || undefined),
    endDate: rawInput.endDate ? String(rawInput.endDate) : (existingRecord?.endDate || undefined),
    presidente: rawInput.presidente ? { ...rawInput.presidente } : (existingRecord?.presidente ? { ...existingRecord.presidente } : undefined),
    vicePresidente: rawInput.vicePresidente ? { ...rawInput.vicePresidente } : (existingRecord?.vicePresidente ? { ...existingRecord.vicePresidente } : undefined),
    secretario: rawInput.secretario ? { ...rawInput.secretario } : (existingRecord?.secretario ? { ...existingRecord.secretario } : undefined),
    tesoureiro: rawInput.tesoureiro ? { ...rawInput.tesoureiro } : (existingRecord?.tesoureiro ? { ...existingRecord.tesoureiro } : undefined),
    ecafo: rawInput.ecafo ? { ...rawInput.ecafo } : (existingRecord?.ecafo ? { ...existingRecord.ecafo } : undefined),
    coordenadorCCA: rawInput.coordenadorCCA ? { ...rawInput.coordenadorCCA } : (existingRecord?.coordenadorCCA ? { ...existingRecord.coordenadorCCA } : undefined),
    customRoles: Array.isArray(rawInput.customRoles)
      ? rawInput.customRoles.map((r: any) => ({ ...r }))
      : (existingRecord?.customRoles ? existingRecord.customRoles.map((r: any) => ({ ...r })) : undefined),
    mandateHistory: Array.isArray(rawInput.mandateHistory)
      ? rawInput.mandateHistory.map((m: any) => ({ ...m }))
      : (existingRecord?.mandateHistory ? existingRecord.mandateHistory.map((m: any) => ({ ...m })) : undefined),
    countsCache: rawInput.countsCache ? { ...rawInput.countsCache } : (existingRecord?.countsCache ? { ...existingRecord.countsCache } : undefined),
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
