/**
 * Validador para o Formulário Público de Autocadastro de Membros SSVP.
 * Valida dados pessoais, vicentinos, consentimento e normalização.
 */

import { validateAndNormalizeBirthDate } from './date_utils.ts';

export const CURRENT_LGPD_TERM_VERSION = 'v1.0-2026';
export const CURRENT_LGPD_TERM_TITLE = 'Termo de Consentimento e Uso Administrativo de Dados - SSVP';
export const CURRENT_LGPD_TERM_TEXT =
  'Declaro que estou ciente e concordo com o armazenamento e tratamento dos meus dados pessoais fornecidos neste formulário exclusivamente para finalidades administrativas, cadastrais e de comunicação institucional no âmbito da Sociedade de São Vicente de Paulo (SSVP), em conformidade com as diretrizes da LGPD.';
export const CURRENT_LGPD_THIRD_PARTY_TERM_TEXT =
  'Declaro que possuo autorização expressa do(a) membro(a) cadastrado(a) para fornecer seus dados pessoais à Sociedade de São Vicente de Paulo (SSVP) e concordo com o armazenamento e tratamento dos dados exclusivamente para finalidades administrativas e cadastrais, em conformidade com as diretrizes da LGPD.';

export interface PublicMemberSubmissionValidationResult {
  valid: boolean;
  errors: string[];
  cleanData?: {
    particularId: string;
    conferenciaId: string;
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
    phone: string;
    normalizedPhone: string;
    phoneResidential?: string;
    phoneCommercial?: string;
    email?: string;
    admissionDate?: string;
    acclamationDate?: string;
    proclamationDate?: string;
    termVersion: string;
    isThirdPartySubmission?: boolean;
    representativeName?: string;
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

export function validatePublicMemberSubmissionInput(data: any): PublicMemberSubmissionValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Payload de envio inválido ou vazio.'] };
  }

  // 1. Conselho Particular e Conferência
  const particularId = typeof data.particularId === 'string' ? data.particularId.trim() : '';
  if (!particularId) {
    errors.push('O Conselho Particular é obrigatório para localização.');
  }

  const conferenciaId = typeof data.conferenciaId === 'string' ? data.conferenciaId.trim() : '';
  if (!conferenciaId) {
    errors.push('A Conferência é obrigatória para localização.');
  }

  // 2. Nome completo
  const rawFullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
  const fullName = rawFullName || 'Membro Não Informado';

  // 3. Classificação (tipo)
  const validTypes = ['confrade', 'consocia', 'vicentino', 'aspirante', 'afastado', 'auxiliar'];
  let type = data.type;
  if (!validTypes.includes(type)) {
    type = 'confrade';
  }

  // 4. Gênero
  let gender = typeof data.gender === 'string' && data.gender.trim() ? data.gender.trim() : undefined;

  // 5. CPF e Profissão (facultativos)
  let cpf = typeof data.cpf === 'string' && data.cpf.trim() ? data.cpf.trim() : undefined;
  let profession = typeof data.profession === 'string' && data.profession.trim() ? data.profession.trim() : undefined;

  // 6. Endereço completo
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

  // 7. Telefones (whatsapp/celular, residencial, comercial)
  const rawPhone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const digitsPhone = normalizePhone(rawPhone);
  const phoneResidential = typeof data.phoneResidential === 'string' && data.phoneResidential.trim() ? data.phoneResidential.trim() : undefined;
  const phoneCommercial = typeof data.phoneCommercial === 'string' && data.phoneCommercial.trim() ? data.phoneCommercial.trim() : undefined;

  // 8. E-mail (opcional)
  let email = typeof data.email === 'string' ? data.email.trim() : undefined;
  if (email === '') email = undefined;

  // 9. Data de Nascimento Obrigatória para Autocadastro de Novo Membro
  let birthDate: string | undefined = undefined;
  const birthValidation = validateAndNormalizeBirthDate(data.birthDate, { required: true });
  if (!birthValidation.valid) {
    errors.push(birthValidation.error || 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.');
  } else {
    birthDate = birthValidation.normalizedDate;
  }

  // Datas vicentinas opcionais (admissionDate, acclamationDate, proclamationDate)
  const validateDateStr = (fieldVal: any): string | undefined => {
    if (!fieldVal || typeof fieldVal !== 'string') return undefined;
    const trimmed = fieldVal.trim();
    if (!trimmed) return undefined;
    return trimmed;
  };

  const admissionDate = validateDateStr(data.admissionDate);
  const acclamationDate = validateDateStr(data.acclamationDate);
  const proclamationDate = validateDateStr(data.proclamationDate);

  // 10. Preenchimento por terceiros / Responsável
  const isThirdPartySubmission = Boolean(data.isThirdPartySubmission === true || data.isThirdPartySubmission === 'true');
  let representativeName: string | undefined = undefined;
  if (isThirdPartySubmission) {
    representativeName = typeof data.representativeName === 'string' && data.representativeName.trim() ? data.representativeName.trim() : undefined;
  }

  // 11. Consentimento
  const termVersion =
    typeof data.termVersion === 'string' && data.termVersion.trim()
      ? data.termVersion.trim()
      : CURRENT_LGPD_TERM_VERSION;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    cleanData: {
      particularId,
      conferenciaId,
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
      phone: rawPhone,
      normalizedPhone: digitsPhone,
      phoneResidential,
      phoneCommercial,
      email,
      admissionDate,
      acclamationDate,
      proclamationDate,
      termVersion,
      isThirdPartySubmission,
      representativeName: isThirdPartySubmission ? representativeName : undefined,
    },
  };
}
