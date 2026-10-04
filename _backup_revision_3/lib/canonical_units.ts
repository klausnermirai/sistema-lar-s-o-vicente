/**
 * Centralizador de Identidade Canônica Institucional e Resolução de Unidades SSVP
 * 
 * Garante estabilidade e integridade na resolução de IDs institucionais,
 * evitando substituições não-determinísticas ou perdas de vínculo por ordem
 * aleatória de consulta no Firestore.
 */

export const MONTE_ALTO_OPERATIONAL_ID = 'NquBdSy0A3ixzHnyj0YF';
export const MONTE_ALTO_CNPJ = '52.853.397/0001-68';
export const MONTE_ALTO_CNPJ_CLEAN = '52853397000168';

export const MONTE_ALTO_DUPLICATE_IDS = [
  'YBGwuWDIeYkDlGokWIVX',
  'eCbHryqf5pwpPTipFFjJ'
] as const;

export const CENTRAL_JABOTICABAL_CNPJ = '54.927.132/0001-92';
export const CENTRAL_JABOTICABAL_CNPJ_CLEAN = '54927132000192';

export const DEMO_INSTITUTION_ID = 'demo-institution-id';

/**
 * Retorna true se o identificador ou CNPJ fornecido pertencer à unidade Lar São Vicente de Paulo de Monte Alto
 */
export function isMonteAltoUnit(idOrCnpj?: string | null): boolean {
  if (!idOrCnpj || typeof idOrCnpj !== 'string') return false;
  const clean = idOrCnpj.trim();
  if (clean === MONTE_ALTO_OPERATIONAL_ID) return true;
  if (clean === MONTE_ALTO_CNPJ) return true;
  if (clean.replace(/\D/g, '') === MONTE_ALTO_CNPJ_CLEAN) return true;
  return (MONTE_ALTO_DUPLICATE_IDS as readonly string[]).includes(clean);
}

/**
 * Retorna true se o ID for um dos identificadores secundários/duplicados conhecidos de Monte Alto
 */
export function isKnownDuplicateMonteAltoId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return (MONTE_ALTO_DUPLICATE_IDS as readonly string[]).includes(id.trim());
}

/**
 * Mapeia e retorna de forma determinística o ID canônico operacional de uma instituição
 */
export function getCanonicalInstitutionId(idOrCnpj?: string | null): string {
  if (!idOrCnpj || typeof idOrCnpj !== 'string') return '';
  const trimmed = idOrCnpj.trim();

  if (trimmed === DEMO_INSTITUTION_ID) {
    return DEMO_INSTITUTION_ID;
  }

  if (isMonteAltoUnit(trimmed)) {
    return MONTE_ALTO_OPERATIONAL_ID;
  }

  return trimmed;
}

/**
 * Deduplica e sanitiza a lista de unidades disponíveis para exibição e seleção,
 * preservando o ID operacional real (como NquBdSy0A3ixzHnyj0YF para Monte Alto)
 * e evitando a substituição do ID operacional pelo CNPJ.
 * Deduplicação estritamente estruturada por identificador e CNPJ,
 * sem heurísticas frágeis por nome, cidade ou semelhança textual.
 */
export function sanitizeCanonicalUnits<T extends { id: string; cnpj?: string; name?: string; type?: string; city?: string; state?: string }>(units: T[]): T[] {
  if (!Array.isArray(units)) return [];

  const seenCanonicalKeys = new Set<string>();
  const sanitizedList: T[] = [];

  for (const unit of units) {
    if (!unit || !unit.id) continue;

    let canonicalKey: string;
    let resolvedId = unit.id;

    if (isMonteAltoUnit(unit.id) || (unit.cnpj && isMonteAltoUnit(unit.cnpj))) {
      canonicalKey = MONTE_ALTO_OPERATIONAL_ID;
      resolvedId = MONTE_ALTO_OPERATIONAL_ID;
    } else {
      canonicalKey = unit.cnpj ? unit.cnpj.trim() : unit.id.trim();
    }

    if (seenCanonicalKeys.has(canonicalKey)) {
      continue;
    }
    seenCanonicalKeys.add(canonicalKey);

    sanitizedList.push({
      ...unit,
      id: resolvedId
    });
  }

  return sanitizedList;
}

/**
 * Lista de identificadores legados e canônicos para consulta de leitura em caso de compatibilidade
 */
export function getMonteAltoQueryIds(): string[] {
  return [
    MONTE_ALTO_OPERATIONAL_ID,
    ...MONTE_ALTO_DUPLICATE_IDS,
    MONTE_ALTO_CNPJ,
    MONTE_ALTO_CNPJ_CLEAN
  ];
}

/**
 * Normaliza perfil/cargo do usuário
 */
export function normalizeUserAccessLevel(roleOrLevel?: string): string {
  if (!roleOrLevel) return 'visitante';
  const clean = roleOrLevel.trim().toLowerCase().replace(/[\s\-_]+/g, '');
  
  if (clean.includes('admin') || clean.includes('gestao') || clean.includes('diretor') || clean.includes('presidente')) {
    return 'administrador';
  }
  if (clean.includes('enferm') || clean.includes('enf') || clean.includes('nurse')) {
    return 'enfermeira';
  }
  if (clean.includes('medic') || clean.includes('doutor') || clean.includes('doc')) {
    return 'medico';
  }
  if (clean.includes('social') || clean.includes('servicosocial')) {
    return 'assistente_social';
  }
  if (clean.includes('psico')) {
    return 'psicologia';
  }
  if (clean.includes('fisioter') || clean.includes('fisio')) {
    return 'fisioterapeuta';
  }
  if (clean.includes('terapeut') || clean.includes('to')) {
    return 'terapeuta_ocupacional';
  }
  if (clean.includes('nutri')) {
    return 'nutricionista';
  }
  if (clean.includes('cuidado') || clean.includes('cuidad') || clean.includes('atendente')) {
    return 'cuidados';
  }
  if (clean.includes('auxiliar') || clean.includes('secretar') || clean.includes('recepc')) {
    return 'auxiliar_administrativo';
  }
  if (clean.includes('geren') || clean.includes('coord')) {
    return 'gerencial';
  }
  return clean;
}

/**
 * Validação rigorosa de escopo: verifica se o usuário autenticado tem permissão para acessar a instituição
 */
export function isUserAuthorizedForInstitution(user: any, requestedInstitutionId?: string | null): boolean {
  if (!user) return false;
  if (!requestedInstitutionId) return false;

  // Super Admin ou Gestor Geral com multiacesso global
  if (
    user.isGlobalAdmin === true ||
    user.hasAllUnitsAccess === true ||
    user.username === 'kwarizaya@gmail.com' ||
    user.email === 'kwarizaya@gmail.com'
  ) {
    return true;
  }

  const requestedCanonical = getCanonicalInstitutionId(requestedInstitutionId);
  const userAllowed = new Set<string>();

  if (user.institutionId) {
    userAllowed.add(getCanonicalInstitutionId(user.institutionId));
  }
  if (Array.isArray(user.institutionIds)) {
    user.institutionIds.forEach((id: string) => userAllowed.add(getCanonicalInstitutionId(id)));
  }
  if (Array.isArray(user.allowedUnits)) {
    user.allowedUnits.forEach((u: any) => {
      const id = typeof u === 'string' ? u : (u?.id || u?.cnpj);
      if (id) userAllowed.add(getCanonicalInstitutionId(id));
    });
  }
  if (user.conferenciaId) {
    userAllowed.add(getCanonicalInstitutionId(user.conferenciaId));
  }
  if (user.particularId) {
    userAllowed.add(getCanonicalInstitutionId(user.particularId));
  }
  if (user.centralId) {
    userAllowed.add(getCanonicalInstitutionId(user.centralId));
  }

  return userAllowed.has(requestedCanonical);
}
