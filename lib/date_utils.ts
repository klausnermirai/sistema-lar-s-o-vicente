/**
 * Utilitário centralizado para validação e normalização de data de nascimento de Membros SSVP.
 * 
 * Regras:
 * 1. Data real, completa e válida no calendário (inclusive bissextos).
 * 2. Data não futura (não pode ser posterior à data atual).
 * 3. Suporta formatos:
 *    - YYYY-MM-DD (ISO)
 *    - DD/MM/YYYY
 *    - DD-MM-YYYY
 * 4. Normaliza sempre para o formato padrão do sistema (YYYY-MM-DD).
 * 5. Garante que seja possível extrair a senha inicial DDMM.
 */

export interface BirthDateValidationResult {
  valid: boolean;
  normalizedDate?: string; // YYYY-MM-DD
  ddmmPassword?: string;   // DDMM
  error?: string;
}

export function validateAndNormalizeBirthDate(
  birthDateRaw: any,
  options: { required?: boolean } = { required: true }
): BirthDateValidationResult {
  const isRequired = options.required ?? true;

  if (birthDateRaw === undefined || birthDateRaw === null || birthDateRaw === '') {
    if (!isRequired) {
      return { valid: true, normalizedDate: undefined, ddmmPassword: undefined };
    }
    return {
      valid: false,
      error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
    };
  }

  if (typeof birthDateRaw !== 'string') {
    return {
      valid: false,
      error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
    };
  }

  const str = birthDateRaw.trim();
  if (!str) {
    if (!isRequired) {
      return { valid: true, normalizedDate: undefined, ddmmPassword: undefined };
    }
    return {
      valid: false,
      error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
    };
  }

  let day: number;
  let month: number;
  let year: number;

  // Formato ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  // Formato BR: DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else if (brMatch) {
    day = parseInt(brMatch[1], 10);
    month = parseInt(brMatch[2], 10);
    year = parseInt(brMatch[3], 10);
  } else {
    // Tentativa com apenas dígitos (8 dígitos: DDMMYYYY ou YYYYMMDD)
    const digitsOnly = str.replace(/\D/g, '');
    if (digitsOnly.length === 8) {
      // Se os 4 primeiros dígitos formam um ano plausível (> 1800)
      const first4 = parseInt(digitsOnly.substring(0, 4), 10);
      if (first4 >= 1800 && first4 <= 2100) {
        year = first4;
        month = parseInt(digitsOnly.substring(4, 6), 10);
        day = parseInt(digitsOnly.substring(6, 8), 10);
      } else {
        day = parseInt(digitsOnly.substring(0, 2), 10);
        month = parseInt(digitsOnly.substring(2, 4), 10);
        year = parseInt(digitsOnly.substring(4, 8), 10);
      }
    } else {
      return {
        valid: false,
        error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
      };
    }
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return {
      valid: false,
      error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
    };
  }

  // Mês válido
  if (month < 1 || month > 12) {
    return {
      valid: false,
      error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
    };
  }

  // Dias por mês (incluindo cálculo de ano bissexto para fevereiro)
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];

  if (day < 1 || day > maxDay) {
    return {
      valid: false,
      error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
    };
  }

  // Validação de não ser data futura
  const today = new Date();
  const inputDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (inputDate.getTime() > today.getTime()) {
    return {
      valid: false,
      error: 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
    };
  }

  const normalizedDay = day.toString().padStart(2, '0');
  const normalizedMonth = month.toString().padStart(2, '0');
  const normalizedYear = year.toString().padStart(4, '0');

  const normalizedDate = `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
  const ddmmPassword = `${normalizedDay}${normalizedMonth}`;

  return {
    valid: true,
    normalizedDate,
    ddmmPassword,
  };
}
