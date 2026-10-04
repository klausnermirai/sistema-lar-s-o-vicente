/**
 * Helper para identificação, validação e autorização de membros com cargo na Diretoria de Conferências SSVP.
 * Regras:
 * - Vínculo ativo: membroId idêntico ao cadastrado no cargo da conferência.
 * - Membro pertencente à mesma Conferência.
 * - Membro ativo (status === 'ativo' e não arquivado).
 * - Conferência ativa e mandate válido se houver data de término.
 * - Registros legados (somente texto/telefone sem membroId) NÃO concedem acesso.
 */

export interface BoardRoleInfo {
  isDirector: boolean;
  roles: string[];
  primaryRole?: string;
  formattedRoleTitle?: string;
  conferenciaId?: string;
  conferenciaNome?: string;
  primeiroNome?: string;
  membroId?: string;
  mandateStartDate?: string;
  mandateEndDate?: string;
}

const BOARD_ROLE_DEFINITIONS: Array<{ key: string; label: string }> = [
  { key: 'presidente', label: 'Presidente' },
  { key: 'vicePresidente', label: 'Vice-Presidente' },
  { key: 'secretario', label: 'Secretário(a)' },
  { key: 'segundoSecretario', label: 'Segundo(a) Secretário(a)' },
  { key: 'tesoureiro', label: 'Tesoureiro(a)' },
  { key: 'segundoTesoureiro', label: 'Segundo(a) Tesoureiro(a)' },
];

/**
 * Formata múltiplos cargos de forma harmoniosa no cabeçalho:
 * Ex: ['Presidente'] -> "Presidente da Conferência"
 * Ex: ['Presidente', 'Tesoureiro(a)'] -> "Presidente e Tesoureiro(a) da Conferência"
 * Ex: ['Vice-Presidente', 'Secretário(a)', 'Tesoureiro(a)'] -> "Vice-Presidente, Secretário(a) e Tesoureiro(a) da Conferência"
 */
export function formatBoardRolesTitle(roles: string[]): string {
  if (!roles || roles.length === 0) return 'Membro da Conferência';
  if (roles.length === 1) {
    return `${roles[0]} da Conferência`;
  }
  if (roles.length === 2) {
    return `${roles[0]} e ${roles[1]} da Conferência`;
  }
  const last = roles[roles.length - 1];
  const rest = roles.slice(0, -1).join(', ');
  return `${rest} e ${last} da Conferência`;
}

/**
 * Extrai o primeiro nome de forma limpa e com capitalização adequada.
 */
export function extractFirstName(fullName?: string): string {
  if (!fullName || typeof fullName !== 'string') return 'Vicentino(a)';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Vicentino(a)';
  const first = parts[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Verifica se um membro possui cargo ativo na diretoria da conferência informada.
 */
export async function verifyMemberBoardRole(
  db: any,
  membroId: string | undefined | null,
  targetConferenciaId?: string | null
): Promise<BoardRoleInfo> {
  const cleanMembroId = typeof membroId === 'string' ? membroId.trim() : '';
  if (!cleanMembroId) {
    return { isDirector: false, roles: [] };
  }

  try {
    // 1. Consulta o membro na coleção 'membros_ssvp'
    const membroDoc = await db.collection('membros_ssvp').doc(cleanMembroId).get();
    if (!membroDoc || !membroDoc.exists) {
      return { isDirector: false, roles: [] };
    }

    const membroData = membroDoc.data();
    if (!membroData) {
      return { isDirector: false, roles: [] };
    }

    // 2. O cadastro do membro DEVE estar ativo
    if (membroData.status !== 'ativo' || membroData.archived === true) {
      return { isDirector: false, roles: [] };
    }

    // 3. Determina a conferência do membro
    const membroConfId = membroData.conferenciaId ? String(membroData.conferenciaId).trim() : '';
    const resolvedConfId = targetConferenciaId ? String(targetConferenciaId).trim() : membroConfId;

    if (!resolvedConfId || (membroConfId && targetConferenciaId && membroConfId !== targetConferenciaId)) {
      // Membro não pertence à conferência alvo
      return { isDirector: false, roles: [] };
    }

    // 4. Consulta a Conferência
    const confDoc = await db.collection('conferencias').doc(resolvedConfId).get();
    if (!confDoc || !confDoc.exists) {
      return { isDirector: false, roles: [] };
    }

    const confData = confDoc.data();
    if (!confData || confData.status === 'inativa' || confData.archived === true) {
      return { isDirector: false, roles: [] };
    }

    // 5. Validação de vigência de mandato (se houver datas no modelo atual)
    if (confData.endDate && typeof confData.endDate === 'string') {
      const todayStr = new Date().toISOString().split('T')[0];
      const endStr = confData.endDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(endStr) && endStr < todayStr) {
        // Mandato expirado
        return { isDirector: false, roles: [] };
      }
    }

    // 6. Percorre os 6 cargos da Diretoria
    // Apenas concede acesso se o membroId corresponder exatamente ao membroId gravado no cargo
    const matchedRoles: string[] = [];

    for (const def of BOARD_ROLE_DEFINITIONS) {
      const cargoObj = confData[def.key];
      if (cargoObj && typeof cargoObj === 'object') {
        const cargoMembroId = cargoObj.membroId ? String(cargoObj.membroId).trim() : '';
        if (cargoMembroId && cargoMembroId === cleanMembroId) {
          matchedRoles.push(def.label);
        }
      } else if (typeof cargoObj === 'string' && cargoObj.trim() === cleanMembroId) {
        matchedRoles.push(def.label);
      }
    }

    if (matchedRoles.length === 0) {
      return { isDirector: false, roles: [] };
    }

    const formattedRoleTitle = formatBoardRolesTitle(matchedRoles);
    const primeiroNome = extractFirstName(membroData.fullName);

    return {
      isDirector: true,
      roles: matchedRoles,
      primaryRole: matchedRoles[0],
      formattedRoleTitle,
      conferenciaId: resolvedConfId,
      conferenciaNome: confData.name || 'Conferência',
      primeiroNome,
      membroId: cleanMembroId,
      mandateStartDate: confData.startDate,
      mandateEndDate: confData.endDate,
    };
  } catch (err) {
    console.error('Erro ao verificar cargo de diretoria do membro:', err);
    return { isDirector: false, roles: [] };
  }
}
