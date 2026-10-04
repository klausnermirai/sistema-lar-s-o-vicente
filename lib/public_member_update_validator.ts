import {
  CURRENT_LGPD_TERM_VERSION,
  normalizeName,
  normalizePhone,
} from './public_member_registration_validator.ts';

export interface PublicMemberUpdateValidationResult {
  valid: boolean;
  errors: string[];
  cleanChanges?: {
    fullName?: string;
    normalizedName?: string;
    type?: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
    gender?: string;
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
    birthDate?: string;
    admissionDate?: string;
    acclamationDate?: string;
    proclamationDate?: string;
    particularId?: string;
    conferenciaId?: string;
    isThirdPartySubmission?: boolean;
    representativeName?: string;
    termVersion: string;
  };
  hasActualChanges: boolean;
}

export function validatePublicMemberUpdateInput(
  data: any,
  existingDataSummary?: {
    admissionDate?: string;
    acclamationDate?: string;
    proclamationDate?: string;
  }
): PublicMemberUpdateValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Payload de atualização inválido ou vazio.'], hasActualChanges: false };
  }

  const cleanChanges: any = {};
  let changedFieldCount = 0;

  // 1. Nome completo (se fornecido)
  if (data.fullName !== undefined && data.fullName !== null) {
    const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
    if (fullName) {
      cleanChanges.fullName = fullName;
      cleanChanges.normalizedName = normalizeName(fullName);
      changedFieldCount++;
    }
  }

  // 2. Classificação (se fornecida)
  if (data.type !== undefined && data.type !== null) {
    const validTypes = ['confrade', 'consocia', 'vicentino', 'aspirante', 'afastado', 'auxiliar'];
    if (validTypes.includes(data.type)) {
      cleanChanges.type = data.type;
      changedFieldCount++;
    }
  }

  // 3. Gênero
  if (data.gender !== undefined && data.gender !== null) {
    const gender = String(data.gender).trim();
    if (gender) {
      cleanChanges.gender = gender;
      changedFieldCount++;
    }
  }

  // 4. CPF e Profissão
  if (data.cpf !== undefined && data.cpf !== null) {
    const cpf = String(data.cpf).trim();
    if (cpf) {
      cleanChanges.cpf = cpf;
      changedFieldCount++;
    }
  }

  if (data.profession !== undefined && data.profession !== null) {
    const profession = String(data.profession).trim();
    if (profession) {
      cleanChanges.profession = profession;
      changedFieldCount++;
    }
  }

  // 5. Endereço completo
  if (data.addressStreet || data.addressNeighborhood || data.addressCity || data.addressZip || data.fullAddress) {
    if (data.addressStreet) cleanChanges.addressStreet = String(data.addressStreet).trim();
    if (data.addressNumber) cleanChanges.addressNumber = String(data.addressNumber).trim();
    if (data.addressComplement) cleanChanges.addressComplement = String(data.addressComplement).trim();
    if (data.addressNeighborhood) cleanChanges.addressNeighborhood = String(data.addressNeighborhood).trim();
    if (data.addressCity) cleanChanges.addressCity = String(data.addressCity).trim();
    if (data.addressState) cleanChanges.addressState = String(data.addressState).trim();
    if (data.addressZip) cleanChanges.addressZip = String(data.addressZip).trim();
    
    if (data.fullAddress) {
      cleanChanges.fullAddress = String(data.fullAddress).trim();
    } else {
      const parts = [
        cleanChanges.addressStreet ? `${cleanChanges.addressStreet}${cleanChanges.addressNumber ? ', ' + cleanChanges.addressNumber : ''}` : '',
        cleanChanges.addressComplement,
        cleanChanges.addressNeighborhood ? `Bairro: ${cleanChanges.addressNeighborhood}` : '',
        cleanChanges.addressCity ? `${cleanChanges.addressCity}${cleanChanges.addressState ? ' - ' + cleanChanges.addressState : ''}` : '',
        cleanChanges.addressZip ? `CEP: ${cleanChanges.addressZip}` : ''
      ].filter(Boolean);
      if (parts.length > 0) {
        cleanChanges.fullAddress = parts.join(' - ');
      }
    }
    changedFieldCount++;
  }

  // 6. Telefones (whatsapp, residencial, comercial)
  if (data.phone !== undefined && data.phone !== null) {
    const rawPhone = typeof data.phone === 'string' ? data.phone.trim() : '';
    if (rawPhone) {
      cleanChanges.phone = rawPhone;
      cleanChanges.normalizedPhone = normalizePhone(rawPhone);
      changedFieldCount++;
    }
  }

  if (data.phoneResidential !== undefined && data.phoneResidential !== null) {
    const phoneResidential = String(data.phoneResidential).trim();
    if (phoneResidential) {
      cleanChanges.phoneResidential = phoneResidential;
      changedFieldCount++;
    }
  }

  if (data.phoneCommercial !== undefined && data.phoneCommercial !== null) {
    const phoneCommercial = String(data.phoneCommercial).trim();
    if (phoneCommercial) {
      cleanChanges.phoneCommercial = phoneCommercial;
      changedFieldCount++;
    }
  }

  // 7. E-mail (se fornecido)
  if (data.email !== undefined && data.email !== null) {
    const email = typeof data.email === 'string' ? data.email.trim() : '';
    if (email) {
      cleanChanges.email = email;
      changedFieldCount++;
    }
  }

  // 8. Transferência / Mudança de Conselho Particular e Conferência
  if (data.conferenciaId !== undefined && data.conferenciaId !== null) {
    const confId = typeof data.conferenciaId === 'string' ? data.conferenciaId.trim() : '';
    if (confId) {
      cleanChanges.conferenciaId = confId;
      if (data.particularId) {
        cleanChanges.particularId = String(data.particularId).trim();
      }
      changedFieldCount++;
    }
  }

  // 9. Validação de Datas (birthDate, admissionDate, acclamationDate, proclamationDate)
  const validateDate = (fieldVal: any): string | undefined => {
    if (fieldVal === undefined || fieldVal === null) return undefined;
    const str = typeof fieldVal === 'string' ? fieldVal.trim() : '';
    return str || undefined;
  };

  const birthDate = validateDate(data.birthDate);
  if (birthDate) {
    cleanChanges.birthDate = birthDate;
    changedFieldCount++;
  }

  const admissionDate = validateDate(data.admissionDate);
  if (admissionDate) {
    cleanChanges.admissionDate = admissionDate;
    changedFieldCount++;
  }

  const acclamationDate = validateDate(data.acclamationDate);
  if (acclamationDate) {
    cleanChanges.acclamationDate = acclamationDate;
    changedFieldCount++;
  }

  const proclamationDate = validateDate(data.proclamationDate);
  if (proclamationDate) {
    cleanChanges.proclamationDate = proclamationDate;
    changedFieldCount++;
  }

  // 10. Preenchimento por terceiros / Responsável
  const isThirdPartySubmission = Boolean(data.isThirdPartySubmission === true || data.isThirdPartySubmission === 'true');
  cleanChanges.isThirdPartySubmission = isThirdPartySubmission;

  if (isThirdPartySubmission) {
    const representativeName = typeof data.representativeName === 'string' ? data.representativeName.trim() : '';
    if (representativeName) {
      cleanChanges.representativeName = representativeName;
    }
  }

  cleanChanges.termVersion =
    typeof data.termVersion === 'string' && data.termVersion.trim()
      ? data.termVersion.trim()
      : CURRENT_LGPD_TERM_VERSION;

  if (changedFieldCount === 0) {
    errors.push('Nenhuma alteração foi informada. Preencha pelo menos um campo que deseja atualizar.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, hasActualChanges: changedFieldCount > 0 };
  }

  return {
    valid: true,
    errors: [],
    cleanChanges,
    hasActualChanges: changedFieldCount > 0,
  };
}
