/**
 * Validador para formulários e payloads de Membro SSVP.
 * Garante validações de campos cadastrais completos, tipos permitidos e datas.
 */

import { MembroSSVP } from '../types.ts';
import { validateAndNormalizeBirthDate } from './date_utils.ts';

export interface MembroValidationResult {
  valid: boolean;
  errors: string[];
  cleanData?: {
    fullName: string;
    normalizedName: string;
    type: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
    gender?: 'feminino' | 'masculino' | 'outro' | string;
    birthDate?: string;
    cpf?: string;
    profession?: string;
    addressStreet?: string;
    addressNumber?: string;
    addressComplement?: string;
    addressNeighborhood?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
    fullAddress?: string;
    phone?: string;
    normalizedPhone?: string;
    phoneResidential?: string;
    phoneCommercial?: string;
    email?: string;
    admissionDate?: string;
    acclamationDate?: string;
    proclamationDate?: string;
  };
}

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export function validateMembroInput(
  data: any,
  options: { isNewMember?: boolean } = { isNewMember: false }
): MembroValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Payload inválido ou vazio.'] };
  }

  // 1. Nome completo (flexível)
  const rawFullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
  const fullName = rawFullName || 'Membro Não Informado';

  // 2. Tipo do membro
  const validTypes = ['confrade', 'consocia', 'vicentino', 'aspirante', 'afastado', 'auxiliar'];
  let type = data.type;
  if (!validTypes.includes(type)) {
    type = 'confrade';
  }

  // 3. Gênero
  let gender = typeof data.gender === 'string' && data.gender.trim() ? data.gender.trim() : undefined;

  // 4. CPF e Profissão
  let cpf = typeof data.cpf === 'string' && data.cpf.trim() ? data.cpf.trim() : undefined;
  let profession = typeof data.profession === 'string' && data.profession.trim() ? data.profession.trim() : undefined;

  // 5. Endereço completo
  let addressStreet = typeof data.addressStreet === 'string' && data.addressStreet.trim() ? data.addressStreet.trim() : undefined;
  let addressNumber = typeof data.addressNumber === 'string' && data.addressNumber.trim() ? data.addressNumber.trim() : undefined;
  let addressComplement = typeof data.addressComplement === 'string' && data.addressComplement.trim() ? data.addressComplement.trim() : undefined;
  let addressNeighborhood = typeof data.addressNeighborhood === 'string' && data.addressNeighborhood.trim() ? data.addressNeighborhood.trim() : undefined;
  let addressCity = typeof data.addressCity === 'string' && data.addressCity.trim() ? data.addressCity.trim() : undefined;
  let addressState = typeof data.addressState === 'string' && data.addressState.trim() ? data.addressState.trim() : undefined;
  let addressZip = typeof data.addressZip === 'string' && data.addressZip.trim() ? data.addressZip.trim() : undefined;
  let fullAddress = typeof data.fullAddress === 'string' && data.fullAddress.trim() ? data.fullAddress.trim() : undefined;

  if (!fullAddress && (addressStreet || addressNeighborhood || addressCity || addressZip)) {
    const parts = [
      addressStreet ? `${addressStreet}${addressNumber ? ', ' + addressNumber : ''}` : '',
      addressComplement,
      addressNeighborhood ? `Bairro: ${addressNeighborhood}` : '',
      addressCity ? `${addressCity}${addressState ? ' - ' + addressState : ''}` : '',
      addressZip ? `CEP: ${addressZip}` : ''
    ].filter(Boolean);
    if (parts.length > 0) {
      fullAddress = parts.join(' - ');
    }
  }

  // 6. Telefones (celular/whatsapp, residencial, comercial)
  let phone = typeof data.phone === 'string' ? data.phone.trim() : undefined;
  if (phone === '') phone = undefined;
  const normalizedPhone = phone ? normalizePhone(phone) : undefined;

  let phoneResidential = typeof data.phoneResidential === 'string' ? data.phoneResidential.trim() : undefined;
  if (phoneResidential === '') phoneResidential = undefined;

  let phoneCommercial = typeof data.phoneCommercial === 'string' ? data.phoneCommercial.trim() : undefined;
  if (phoneCommercial === '') phoneCommercial = undefined;

  // 7. E-mail (opcional)
  let email = typeof data.email === 'string' ? data.email.trim() : undefined;
  if (email === '') email = undefined;

  // 8. Datas (birthDate, admissionDate, acclamationDate, proclamationDate)
  const validateDateStr = (fieldVal: any): string | undefined => {
    if (!fieldVal || typeof fieldVal !== 'string') return undefined;
    const trimmed = fieldVal.trim();
    if (!trimmed) return undefined;
    return trimmed;
  };

  let birthDate: string | undefined = undefined;
  if (options.isNewMember || (data.birthDate !== undefined && data.birthDate !== null && String(data.birthDate).trim() !== '')) {
    const birthValidation = validateAndNormalizeBirthDate(data.birthDate, { required: options.isNewMember });
    if (!birthValidation.valid) {
      errors.push(birthValidation.error || 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.');
    } else {
      birthDate = birthValidation.normalizedDate;
    }
  } else {
    birthDate = validateDateStr(data.birthDate);
  }

  const admissionDate = validateDateStr(data.admissionDate);
  const acclamationDate = validateDateStr(data.acclamationDate);
  const proclamationDate = validateDateStr(data.proclamationDate);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    cleanData: {
      fullName,
      normalizedName: normalizeName(fullName),
      type: type as any,
      gender,
      birthDate,
      cpf,
      profession,
      addressStreet,
      addressNumber,
      addressComplement,
      addressNeighborhood,
      addressCity,
      addressState,
      addressZip,
      fullAddress,
      phone,
      normalizedPhone,
      phoneResidential,
      phoneCommercial,
      email,
      admissionDate,
      acclamationDate,
      proclamationDate,
    },
  };
}
