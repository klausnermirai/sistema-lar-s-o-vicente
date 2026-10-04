import type { Resident } from '../types.ts';

/**
 * Funcao pura para ordenar uma copia da lista de residentes em ordem alfabetica pelo nome.
 * Considera acentuacao e diferenca de maiusculas/minusculas no portugues (pt-BR).
 */
export function sortResidentsByName(residents: Resident[]): Resident[] {
  if (!Array.isArray(residents)) return [];
  return [...residents].sort((a, b) => {
    const nameA = (a.name || '').trim();
    const nameB = (b.name || '').trim();
    return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
  });
}

export function normalizeField(val: string | undefined | null): string {
  if (!val) return '';
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getNormalizedProductKey(name: string, category: string, unit: string): string {
  const normName = normalizeField(name);
  const normCategory = normalizeField(category);
  const normUnit = normalizeField(unit);
  return `${normName}||${normCategory}||${normUnit}`;
}

/**
 * Converte um objeto Date para a string 'AAAA-MM-DD' usando a data LOCAL (evita o shift de UTC de toISOString).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata com seguranca qualquer string ou objeto de data para 'DD/MM/AAAA'.
 * Nao sofre alteracao de fuso horario para datas puras no formato 'YYYY-MM-DD'.
 */
export function formatDateToBR(dateValue?: string | Date | null): string {
  if (!dateValue) return '-';
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (!trimmed) return '-';
    // Se estiver no formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm...
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [year, month, day] = trimmed.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    }
    // Se ja estiver no formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
      return trimmed.split(' ')[0];
    }
    // Outros formatos tentam parse local
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return trimmed;
  }
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    const day = String(dateValue.getDate()).padStart(2, '0');
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const year = dateValue.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return '-';
}

/**
 * Faz o parse seguro de uma string YYYY-MM-DD para um objeto Date no horario local
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0); // Define ao meio-dia para evitar shifts em qualquer calculo
  }
  return new Date(dateStr);
}

