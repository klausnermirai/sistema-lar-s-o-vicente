import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react';

interface DateInputWithPickerProps {
  id?: string;
  name?: string;
  value?: string; // Formato interno: YYYY-MM-DD ou vazio
  onChange: (isoDate: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  allowFutureDates?: boolean;
  helpText?: string;
  placeholder?: string;
  className?: string;
  minYear?: number;
}

// Converte YYYY-MM-DD para DD/MM/YYYY
function isoToDisplay(isoStr?: string): string {
  if (!isoStr) return '';
  const clean = isoStr.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

// Converte DD/MM/YYYY para YYYY-MM-DD
function displayToIso(displayStr: string): string {
  const digits = displayStr.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  return `${y}-${m}-${d}`;
}

// Aplica a máscara progressiva de dígitos
function formatDigitsToDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

// Valida se os dígitos correspondem a uma data de calendário real
function validateDateParts(
  dayStr: string,
  monthStr: string,
  yearStr: string,
  allowFuture: boolean
): { isValid: boolean; error?: string } {
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { isValid: false, error: 'Data incompleta ou inválida.' };
  }

  if (year < 1850 || year > 2100) {
    return { isValid: false, error: 'Ano fora do intervalo aceitável.' };
  }

  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Mês inválido (deve ser entre 01 e 12).' };
  }

  // Dias por mês (incluindo cálculo de ano bissexto para fevereiro)
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];

  if (day < 1 || day > maxDay) {
    if (month === 2) {
      return {
        isValid: false,
        error: isLeap
          ? 'Fevereiro neste ano bissexto possui até 29 dias.'
          : 'Fevereiro neste ano possui até 28 dias.',
      };
    }
    return { isValid: false, error: `Dia inválido para o mês ${month.toString().padStart(2, '0')} (máximo de ${maxDay} dias).` };
  }

  // Validação de datas futuras
  if (!allowFuture) {
    const today = new Date();
    const inputDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (inputDate.getTime() > today.getTime()) {
      return { isValid: false, error: 'A data não pode ser posterior ao dia de hoje.' };
    }
  }

  return { isValid: true };
}

export const DateInputWithPicker: React.FC<DateInputWithPickerProps> = ({
  id,
  name,
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  allowFutureDates = false,
  helpText = 'Digite somente os números. Exemplo: 21081984',
  placeholder = 'DD/MM/AAAA',
  className = '',
}) => {
  // Estado local para preservar o texto parcial enquanto o usuário digita
  const [displayText, setDisplayText] = useState<string>(() => isoToDisplay(value));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState<boolean>(false);

  const hiddenPickerRef = useRef<HTMLInputElement>(null);

  // Sincroniza com alterações externas de value (por exemplo se o form for resetado)
  useEffect(() => {
    const formatted = isoToDisplay(value);
    if (value && !formatted) {
      // Se vier uma string inválida ou formato diferente
      return;
    }
    // Se o valor externo for diferente do correspondente no display, atualiza
    if (displayToIso(displayText) !== (value || '')) {
      setDisplayText(formatted);
      setErrorMessage(null);
    }
  }, [value]);

  // Manipulação da digitação manual
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatDigitsToDate(rawVal);
    setDisplayText(formatted);

    const digits = formatted.replace(/\D/g, '');

    // Se o usuário apagou tudo
    if (digits.length === 0) {
      setErrorMessage(null);
      onChange('');
      return;
    }

    // Se tem entre 1 e 7 dígitos: limpa erro anterior e emite vazio para evitar estado inconsistente no formulário
    if (digits.length < 8) {
      if (errorMessage && errorMessage !== 'Complete a data com dia, mês e ano. Exemplo: 21081984.') {
        setErrorMessage(null);
      }
      onChange('');
      return;
    }

    // Se completou 8 dígitos, valida e emite se estiver válida
    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4, 8);
      const validation = validateDateParts(d, m, y, allowFutureDates);

      if (validation.isValid) {
        setErrorMessage(null);
        onChange(`${y}-${m}-${d}`);
      } else {
        setErrorMessage(validation.error || 'Data inválida.');
        onChange('');
      }
    }
  };

  // Validação ao perder o foco (onBlur)
  const handleBlur = () => {
    setIsTouched(true);
    const digits = displayText.replace(/\D/g, '');

    if (digits.length === 0) {
      if (required) {
        setErrorMessage('Este campo de data é obrigatório.');
      } else {
        setErrorMessage(null);
      }
      onChange('');
      return;
    }

    if (digits.length < 8) {
      setErrorMessage('Complete a data com dia, mês e ano. Exemplo: 21081984.');
      onChange('');
      return;
    }

    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    const validation = validateDateParts(d, m, y, allowFutureDates);

    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Data inválida.');
      onChange('');
    } else {
      setErrorMessage(null);
      onChange(`${y}-${m}-${d}`);
    }
  };

  // Quando o usuário seleciona uma data no calendário nativo
  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isoVal = e.target.value; // YYYY-MM-DD
    if (!isoVal) return;

    const formatted = isoToDisplay(isoVal);
    setDisplayText(formatted);

    const [y, m, d] = isoVal.split('-');
    const validation = validateDateParts(d, m, y, allowFutureDates);

    if (validation.isValid) {
      setErrorMessage(null);
      onChange(isoVal);
    } else {
      setErrorMessage(validation.error || 'Data inválida.');
      onChange('');
    }
  };

  // Aciona o seletor nativo de calendário
  const openCalendar = () => {
    if (disabled) return;
    const picker = hiddenPickerRef.current;
    if (!picker) return;

    // Tenta usar a API moderna showPicker()
    if (typeof (picker as any).showPicker === 'function') {
      try {
        (picker as any).showPicker();
        return;
      } catch (err) {
        // Fallback silencioso para clique ou foco
      }
    }

    // Fallback: simula clique no input nativo
    picker.focus();
    picker.click();
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const digitsCount = displayText.replace(/\D/g, '').length;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
        >
          {label} {required && <span className="text-rose-600 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Campo de Texto Principal com Teclado Numérico no Mobile */}
        <input
          type="text"
          inputMode="numeric"
          id={id}
          name={name}
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={10}
          autoComplete="off"
          className={`w-full pl-3.5 pr-11 py-2.5 rounded-xl border text-sm transition-all outline-none font-medium ${
            errorMessage
              ? 'border-rose-300 bg-rose-50/40 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
              : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 hover:border-slate-400'
          } ${disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''}`}
        />

        {/* Input type="date" invisível para suporte a calendário nativo */}
        <input
          ref={hiddenPickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          max={!allowFutureDates ? todayIso : undefined}
          value={value || ''}
          onChange={handlePickerChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
        />

        {/* Botão de Calendário Acoplado à Direita */}
        <button
          type="button"
          onClick={openCalendar}
          disabled={disabled}
          title="Abrir calendário para escolher a data"
          aria-label="Abrir calendário"
          className="absolute right-2 p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CalendarIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Mensagem de Erro / Orientação */}
      {errorMessage ? (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : digitsCount > 0 && digitsCount < 8 ? (
        <p className="text-[11px] text-amber-700 font-medium animate-in fade-in">
          Complete a data com dia, mês e ano. Exemplo: 21081984.
        </p>
      ) : helpText ? (
        <p className="text-[11px] text-slate-500 font-normal">{helpText}</p>
      ) : null}
    </div>
  );
};
