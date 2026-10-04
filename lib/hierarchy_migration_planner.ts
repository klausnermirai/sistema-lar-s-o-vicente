/**
 * Planejador Puro e Isolado de Migração da Hierarquia
 * (Conselhos Particulares e Conferências Legados -> Coleções Autônomas Standalone).
 * 
 * REGRA ABSOLUTA:
 * - NENHUMA chamada de rede, NENHUMA importação de SDK, NENHUM efeito colateral ou acesso ao banco/Firebase Auth.
 * - NENHUMA atualização ou sobrescrita de dados existentes.
 * - NENHUMA mutação dos objetos recebidos.
 */

import {
  ConselhoParticular,
  ConferenciaSubordinada,
  StandaloneConselhoParticular,
  StandaloneConferencia,
} from '../types.js';
import { normalizeName, maskSensitiveValue } from './hierarchy_utils.js';

export type HierarchyMigrationAction = 'CREATE' | 'ALREADY_MATCHING' | 'CONFLICT_REQUIRES_REVIEW';

export interface PlannedConselhoParticularMigration {
  id: string; // targetId
  legacyId: string;
  name: string;
  normalizedName: string;
  action: HierarchyMigrationAction;
  reason: string;
  targetCentralId: string;
  warnings?: string[];
  requiresManualReview?: boolean;
  candidateDoc?: StandaloneConselhoParticular;
}

export interface PlannedConferenciaMigration {
  id: string; // targetId
  legacyId: string;
  particularId: string;
  name: string;
  normalizedName: string;
  action: HierarchyMigrationAction;
  reason: string;
  targetCentralId: string;
  warnings?: string[];
  requiresManualReview?: boolean;
  candidateDoc?: StandaloneConferencia;
}

export interface MigrationIdMapping {
  legacyId: string;
  targetId: string;
  type: 'conselho_particular' | 'conferencia';
  status: HierarchyMigrationAction;
}

export interface HierarchyMigrationPlanResult {
  migrationId: string;
  validatedCentralId: string;
  timestamp: string;
  totals: {
    totalLegacyConselhos: number;
    createConselhosCount: number;
    alreadyMatchingConselhosCount: number;
    conflictConselhosCount: number;
    warningsConselhosCount: number;

    totalLegacyConferencias: number;
    createConferenciasCount: number;
    alreadyMatchingConferenciasCount: number;
    conflictConferenciasCount: number;
    warningsConferenciasCount: number;

    totalWarnings: number;
  };
  idMap: MigrationIdMapping[];
  conselhosDetails: PlannedConselhoParticularMigration[];
  conferenciasDetails: PlannedConferenciaMigration[];
  warnings: string[];
}

export type LegacyInputType = ConselhoParticular[] | { conselhosParticulares?: ConselhoParticular[] } | null | undefined;

/**
 * Valida se uma string é um Document ID válido para Firestore:
 * - Não pode ser vazio
 * - Não pode conter barras ('/')
 * - Não pode ser '.' ou '..'
 * - Não pode exceder 1500 bytes/caracteres
 * - Não pode coincidir com o padrão reservado __.*__
 */
export function isValidDocumentId(id?: string | null): boolean {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 1500) return false;
  if (trimmed.includes('/')) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (/^__.*__$/.test(trimmed)) return false;
  return true;
}

/**
 * Valida se uma data string (se fornecida) é sintaticamente e semanticamente válida.
 * Aceita vazio/undefined (campo opcional). Se preenchida, deve ser válida.
 */
export function isValidDateString(dateStr?: string | null): boolean {
  if (dateStr === undefined || dateStr === null || dateStr === '') return true;
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (trimmed === '') return true;

  // Checa formato básico ISO ou YYYY-MM-DD
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/;
  const match = trimmed.match(isoRegex);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Validação estrita de calendário usando UTC (ex: 2026-02-31 é inválido)
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return false;
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return false;

  return true;
}

/**
 * Valida se uma contagem de membros é um número inteiro não-negativo válido.
 */
export function isValidMemberCount(count: any): boolean {
  if (count === undefined || count === null) return false;
  if (typeof count !== 'number') return false;
  if (!Number.isInteger(count)) return false;
  if (isNaN(count)) return false;
  if (count < 0) return false;
  return true;
}

/**
 * Função pura e isolada para planejar a migração dos dados legados de Conselhos Particulares
 * e Conferências para as coleções autônomas no Firestore.
 */
export function planHierarchyMigration(
  legacyData: LegacyInputType,
  validatedCentralId: string,
  existingConselhos: StandaloneConselhoParticular[] = [],
  existingConferencias: StandaloneConferencia[] = [],
  migrationId: string = 'migration-default'
): HierarchyMigrationPlanResult {
  const timestamp = new Date().toISOString();
  const cleanCentralId = validatedCentralId ? validatedCentralId.trim() : '';

  // 1. Extrair lista legada de Conselhos Particulares sem mutar a entrada
  const legacyConselhosList: ConselhoParticular[] = Array.isArray(legacyData)
    ? legacyData
    : (legacyData && Array.isArray(legacyData.conselhosParticulares) ? legacyData.conselhosParticulares : []);

  // 2. Mapear registros standalone existentes para checagem de idempotência e conflitos
  const existingConselhosById = new Map<string, StandaloneConselhoParticular>();
  const existingConselhosByNormalizedName = new Map<string, StandaloneConselhoParticular>();

  for (const cp of existingConselhos) {
    if (cp && cp.id) {
      existingConselhosById.set(cp.id.trim(), cp);
    }
    if (cp && cp.normalizedName && cp.centralId === cleanCentralId) {
      existingConselhosByNormalizedName.set(cp.normalizedName.trim(), cp);
    }
  }

  const existingConferenciasById = new Map<string, StandaloneConferencia>();
  const existingConferenciasByParticularAndName = new Map<string, StandaloneConferencia>();

  for (const conf of existingConferencias) {
    if (conf && conf.id) {
      existingConferenciasById.set(conf.id.trim(), conf);
    }
    if (conf && conf.normalizedName && conf.particularId) {
      const key = `${conf.particularId.trim()}:${conf.normalizedName.trim()}`;
      existingConferenciasByParticularAndName.set(key, conf);
    }
  }

  // 3. Pré-analisar frequência de IDs e Nomes na entrada legada para detectar duplicidades
  const cpIdCounts = new Map<string, number>();
  const cpNameCounts = new Map<string, number>();
  const confIdCounts = new Map<string, number>();
  const confNameCountsByCp = new Map<string, Map<string, number>>();

  for (const cp of legacyConselhosList) {
    if (cp && cp.id && typeof cp.id === 'string' && cp.id.trim().length > 0) {
      const cleanId = cp.id.trim();
      cpIdCounts.set(cleanId, (cpIdCounts.get(cleanId) || 0) + 1);
    }
    if (cp && cp.name && typeof cp.name === 'string' && cp.name.trim().length > 0) {
      const norm = normalizeName(cp.name);
      cpNameCounts.set(norm, (cpNameCounts.get(norm) || 0) + 1);
    }

    if (cp && Array.isArray(cp.conferencias)) {
      const cpKey = cp.id ? cp.id.trim() : (cp.name ? normalizeName(cp.name) : 'unknown_cp');
      if (!confNameCountsByCp.has(cpKey)) {
        confNameCountsByCp.set(cpKey, new Map<string, number>());
      }
      const mapForCp = confNameCountsByCp.get(cpKey)!;

      for (const conf of cp.conferencias) {
        if (conf && conf.id && typeof conf.id === 'string' && conf.id.trim().length > 0) {
          const cleanId = conf.id.trim();
          confIdCounts.set(cleanId, (confIdCounts.get(cleanId) || 0) + 1);
        }
        if (conf && conf.name && typeof conf.name === 'string' && conf.name.trim().length > 0) {
          const norm = normalizeName(conf.name);
          mapForCp.set(norm, (mapForCp.get(norm) || 0) + 1);
        }
      }
    }
  }

  // Totais e Estruturas de Retorno
  const totals = {
    totalLegacyConselhos: legacyConselhosList.length,
    createConselhosCount: 0,
    alreadyMatchingConselhosCount: 0,
    conflictConselhosCount: 0,
    warningsConselhosCount: 0,

    totalLegacyConferencias: 0,
    createConferenciasCount: 0,
    alreadyMatchingConferenciasCount: 0,
    conflictConferenciasCount: 0,
    warningsConferenciasCount: 0,

    totalWarnings: 0,
  };

  const conselhosDetails: PlannedConselhoParticularMigration[] = [];
  const conferenciasDetails: PlannedConferenciaMigration[] = [];
  const idMap: MigrationIdMapping[] = [];
  const globalWarnings: string[] = [];

  // 4. Processar cada Conselho Particular e suas Conferências subordinadas
  for (const legacyCp of legacyConselhosList) {
    const rawCpId = typeof legacyCp?.id === 'string' ? legacyCp.id.trim() : '';
    const cpName = typeof legacyCp?.name === 'string' ? legacyCp.name.trim() : '';
    const cpNormName = normalizeName(cpName);
    const cpWarnings: string[] = [];

    // --- Validações de Bloqueio / Conflito no Conselho Particular ---
    let cpAction: HierarchyMigrationAction = 'CREATE';
    let cpReason = '';
    let cpRequiresManualReview = false;

    // A. ID Legado Vazio ou Inválido para Document ID
    if (!rawCpId || !isValidDocumentId(rawCpId)) {
      cpAction = 'CONFLICT_REQUIRES_REVIEW';
      cpReason = rawCpId
        ? `O ID legado do Conselho Particular ('${rawCpId}') é inválido para Document ID do Firestore.`
        : 'O Conselho Particular legado não possui ID preenchido.';
      cpRequiresManualReview = true;
    }
    // B. ID Legado Repetido na Entrada
    else if ((cpIdCounts.get(rawCpId) || 0) > 1) {
      cpAction = 'CONFLICT_REQUIRES_REVIEW';
      cpReason = `O ID legado ('${rawCpId}') está duplicado no conjunto de dados de entrada da migração.`;
      cpRequiresManualReview = true;
    }
    // C. Nome do Conselho Particular Vazio
    else if (!cpName || cpName.length === 0) {
      cpAction = 'CONFLICT_REQUIRES_REVIEW';
      cpReason = 'O Conselho Particular possui nome vazio ou em branco.';
      cpRequiresManualReview = true;
    }
    // D. Duplicidade de Nome de Conselho Particular na Entrada
    else if ((cpNameCounts.get(cpNormName) || 0) > 1) {
      cpAction = 'CONFLICT_REQUIRES_REVIEW';
      cpReason = `Existe mais de um Conselho Particular com o mesmo nome '${cpName}' no conjunto de dados de importação.`;
      cpRequiresManualReview = true;
    }
    // E. Validação de Datas do Conselho Particular
    else if (!isValidDateString(legacyCp.startDate) || !isValidDateString(legacyCp.endDate)) {
      const invalidField = !isValidDateString(legacyCp.startDate) ? `startDate ('${legacyCp.startDate}')` : `endDate ('${legacyCp.endDate}')`;
      cpAction = 'CONFLICT_REQUIRES_REVIEW';
      cpReason = `O Conselho Particular possui data inválida preenchida: ${invalidField}.`;
      cpRequiresManualReview = true;
    }
    // F. Verificações contra Base Autônoma Existente
    else {
      const existingCpMatch = existingConselhosById.get(rawCpId);

      if (existingCpMatch) {
        if (existingCpMatch.centralId !== cleanCentralId) {
          cpAction = 'CONFLICT_REQUIRES_REVIEW';
          cpReason = `Conflito de ID: O Conselho Particular (${rawCpId}) já existe na base autônoma vinculado a outro Conselho Central (${existingCpMatch.centralId}).`;
          cpRequiresManualReview = true;
        } else {
          // Verificar equivalência de dados
          const hasNameMismatch = existingCpMatch.normalizedName !== cpNormName;
          const hasPresidenteMismatch = (existingCpMatch.presidente?.name || '') !== (legacyCp.presidente?.name || '');
          const hasVicePresidenteMismatch = (existingCpMatch.vicePresidente?.name || '') !== (legacyCp.vicePresidente?.name || '');
          const hasSecretarioMismatch = (existingCpMatch.secretario?.name || '') !== (legacyCp.secretario?.name || '');
          const hasTesoureiroMismatch = (existingCpMatch.tesoureiro?.name || '') !== (legacyCp.tesoureiro?.name || '');

          const hasBoardMismatch = hasPresidenteMismatch || hasVicePresidenteMismatch || hasSecretarioMismatch || hasTesoureiroMismatch;

          if (hasNameMismatch || hasBoardMismatch) {
            cpAction = 'CONFLICT_REQUIRES_REVIEW';
            cpReason = `Conflito de dados: O Conselho Particular (${rawCpId}) possui o mesmo ID e Central, mas os dados de nome ou diretoria divergem da base autônoma.`;
            cpRequiresManualReview = true;
          } else {
            cpAction = 'ALREADY_MATCHING';
            cpReason = 'O Conselho Particular já se encontra cadastrado na coleção autônoma vinculado a este Conselho Central com dados equivalentes.';
          }
        }
      } else {
        // Verificar se existe outro Conselho Particular com nome idêntico sob o mesmo Conselho Central
        const nameMatch = existingConselhosByNormalizedName.get(cpNormName);
        if (nameMatch && nameMatch.id !== rawCpId) {
          cpAction = 'CONFLICT_REQUIRES_REVIEW';
          cpReason = `Conflito de nome: Já existe um Conselho Particular com o nome '${cpName}' cadastrado com o ID (${nameMatch.id}).`;
          cpRequiresManualReview = true;
        } else {
          cpAction = 'CREATE';
          cpReason = 'Novo Conselho Particular a ser migrado e criado na coleção autônoma.';
        }
      }
    }

    // --- Avisos Não Bloqueantes para Conselho Particular ---
    const conferenciasList: ConferenciaSubordinada[] = Array.isArray(legacyCp?.conferencias) ? legacyCp.conferencias : [];
    if (conferenciasList.length === 0) {
      const warnMsg = `O Conselho Particular '${cpName || rawCpId}' não possui Conferências cadastradas no sistema legado.`;
      cpWarnings.push(warnMsg);
      globalWarnings.push(warnMsg);
      totals.warningsConselhosCount++;
      totals.totalWarnings++;
    }

    // Atualização de Totais do CP
    if (cpAction === 'CREATE') {
      totals.createConselhosCount++;
    } else if (cpAction === 'ALREADY_MATCHING') {
      totals.alreadyMatchingConselhosCount++;
    } else {
      totals.conflictConselhosCount++;
    }

    // Documento Candidato (apenas se CREATE e sem conflito bloqueante)
    let candidateCpDoc: StandaloneConselhoParticular | undefined = undefined;
    if (cpAction === 'CREATE') {
      candidateCpDoc = {
        id: rawCpId,
        centralId: cleanCentralId,
        name: cpName,
        normalizedName: cpNormName,
        city: legacyCp.city,
        phone: legacyCp.phone,
        email: legacyCp.email,
        startDate: legacyCp.startDate,
        endDate: legacyCp.endDate,
        presidente: legacyCp.presidente,
        vicePresidente: legacyCp.vicePresidente,
        secretario: legacyCp.secretario,
        tesoureiro: legacyCp.tesoureiro,
        ecafo: legacyCp.ecafo,
        coordenadorCCA: legacyCp.coordenadorCCA,
        customRoles: legacyCp.customRoles,
        mandateHistory: legacyCp.mandateHistory,
        status: 'ativo',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'system_migration',
        updatedBy: 'system_migration',
        migrationId,
        countsCache: {
          totalConferencias: conferenciasList.length,
          totalConfrades: 0,
          totalConsocias: 0,
          totalAspirantes: 0,
        },
      };
    }

    conselhosDetails.push({
      id: rawCpId,
      legacyId: rawCpId,
      name: cpName,
      normalizedName: cpNormName,
      action: cpAction,
      reason: cpReason,
      targetCentralId: cleanCentralId,
      warnings: cpWarnings.length > 0 ? cpWarnings : undefined,
      requiresManualReview: cpRequiresManualReview || undefined,
      candidateDoc: candidateCpDoc,
    });

    idMap.push({
      legacyId: rawCpId,
      targetId: rawCpId,
      type: 'conselho_particular',
      status: cpAction,
    });

    // --- Processar Conferências Subordinadas ---
    totals.totalLegacyConferencias += conferenciasList.length;

    const cpKeyForConfMap = rawCpId || cpNormName || 'unknown_cp';
    const confNameMapForThisCp = confNameCountsByCp.get(cpKeyForConfMap);

    for (const legacyConf of conferenciasList) {
      const rawConfId = typeof legacyConf?.id === 'string' ? legacyConf.id.trim() : '';
      const confName = typeof legacyConf?.name === 'string' ? legacyConf.name.trim() : '';
      const confNormName = normalizeName(confName);
      const confWarnings: string[] = [];

      let confAction: HierarchyMigrationAction = 'CREATE';
      let confReason = '';
      let confRequiresManualReview = false;

      // A. ID Legado Vazio ou Inválido para Document ID
      if (!rawConfId || !isValidDocumentId(rawConfId)) {
        confAction = 'CONFLICT_REQUIRES_REVIEW';
        confReason = rawConfId
          ? `O ID legado da Conferência ('${rawConfId}') é inválido para Document ID do Firestore.`
          : `A Conferência '${confName}' não possui ID legado preenchido.`;
        confRequiresManualReview = true;
      }
      // B. ID Legado Repetido na Entrada
      else if ((confIdCounts.get(rawConfId) || 0) > 1) {
        confAction = 'CONFLICT_REQUIRES_REVIEW';
        confReason = `O ID legado da Conferência ('${rawConfId}') está duplicado no conjunto de dados de entrada da migração.`;
        confRequiresManualReview = true;
      }
      // C. Nome da Conferência Vazio
      else if (!confName || confName.length === 0) {
        confAction = 'CONFLICT_REQUIRES_REVIEW';
        confReason = 'A Conferência possui nome vazio ou em branco.';
        confRequiresManualReview = true;
      }
      // D. Duplicidade de Nome de Conferência dentro do Mesmo Conselho Particular
      else if (confNameMapForThisCp && (confNameMapForThisCp.get(confNormName) || 0) > 1) {
        confAction = 'CONFLICT_REQUIRES_REVIEW';
        confReason = `Existe mais de uma Conferência com o nome '${confName}' no mesmo Conselho Particular '${cpName}'.`;
        confRequiresManualReview = true;
      }
      // E. Validação de Datas da Conferência
      else if (!isValidDateString(legacyConf.startDate) || !isValidDateString(legacyConf.endDate)) {
        const invalidField = !isValidDateString(legacyConf.startDate) ? `startDate ('${legacyConf.startDate}')` : `endDate ('${legacyConf.endDate}')`;
        confAction = 'CONFLICT_REQUIRES_REVIEW';
        confReason = `A Conferência possui data inválida preenchida: ${invalidField}.`;
        confRequiresManualReview = true;
      }
      // F. Validação Estrita de Contagens (não numéricas, negativas, decimais ou NaN)
      else if (
        !isValidMemberCount(legacyConf.confradesCount) ||
        !isValidMemberCount(legacyConf.consociasCount) ||
        !isValidMemberCount(legacyConf.aspirantesCount)
      ) {
        confAction = 'CONFLICT_REQUIRES_REVIEW';
        confReason = `A Conferência possui contagens de membros inválidas (confrades: ${legacyConf.confradesCount}, consócias: ${legacyConf.consociasCount}, aspirantes: ${legacyConf.aspirantesCount}). Requer correção prévia.`;
        confRequiresManualReview = true;
      }
      // G. Conselho Pai em Conflito de ID ou Inválido
      else if (!rawCpId || !isValidDocumentId(rawCpId)) {
        confAction = 'CONFLICT_REQUIRES_REVIEW';
        confReason = `A Conferência não pode ser migrada porque seu Conselho Particular pai possui ID inválido ou ausente.`;
        confRequiresManualReview = true;
      }
      // H. Verificações contra Base Autônoma Existente
      else {
        const existingConfMatch = existingConferenciasById.get(rawConfId);

        if (existingConfMatch) {
          if (existingConfMatch.centralId !== cleanCentralId || existingConfMatch.particularId !== rawCpId) {
            confAction = 'CONFLICT_REQUIRES_REVIEW';
            confReason = `Conflito de vínculo: A Conferência (${rawConfId}) já existe na coleção autônoma vinculada a outra hierarquia (Central: ${existingConfMatch.centralId}, Particular: ${existingConfMatch.particularId}).`;
            confRequiresManualReview = true;
          } else {
            const hasNameMismatch = existingConfMatch.normalizedName !== confNormName;
            const hasPresidenteMismatch = (existingConfMatch.presidente?.name || '') !== (legacyConf.presidente?.name || '');

            if (hasNameMismatch || hasPresidenteMismatch) {
              confAction = 'CONFLICT_REQUIRES_REVIEW';
              confReason = `Conflito de dados: A Conferência (${rawConfId}) possui o mesmo ID e hierarquia, mas os dados de nome ou diretoria divergem da base autônoma.`;
              confRequiresManualReview = true;
            } else {
              confAction = 'ALREADY_MATCHING';
              confReason = 'A Conferência já se encontra cadastrada na coleção autônoma associada a este Conselho Particular e Central com dados equivalentes.';
            }
          }
        } else {
          const confNameKey = `${rawCpId}:${confNormName}`;
          const nameMatch = existingConferenciasByParticularAndName.get(confNameKey);

          if (nameMatch && nameMatch.id !== rawConfId) {
            confAction = 'CONFLICT_REQUIRES_REVIEW';
            confReason = `Conflito de nome: Já existe uma Conferência com o nome '${confName}' cadastrada neste Conselho Particular com o ID (${nameMatch.id}).`;
            confRequiresManualReview = true;
          } else {
            confAction = 'CREATE';
            confReason = 'Nova Conferência a ser migrada e criada na coleção autônoma.';
          }
        }
      }

      // Atualização de Totais da Conferência
      if (confAction === 'CREATE') {
        totals.createConferenciasCount++;
      } else if (confAction === 'ALREADY_MATCHING') {
        totals.alreadyMatchingConferenciasCount++;
      } else {
        totals.conflictConferenciasCount++;
      }

      // Documento Candidato da Conferência
      let candidateConfDoc: StandaloneConferencia | undefined = undefined;
      if (confAction === 'CREATE') {
        candidateConfDoc = {
          id: rawConfId,
          particularId: rawCpId,
          centralId: cleanCentralId,
          name: confName,
          normalizedName: confNormName,
          startDate: legacyConf.startDate,
          endDate: legacyConf.endDate,
          presidente: legacyConf.presidente,
          legacyCounts: {
            confrades: legacyConf.confradesCount,
            consocias: legacyConf.consociasCount,
            aspirantes: legacyConf.aspirantesCount,
          },
          mandateHistory: legacyConf.mandateHistory,
          status: 'ativo',
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: 'system_migration',
          updatedBy: 'system_migration',
          migrationId,
        };

        // Preservação explícita de lastMembersUpdate caso preenchido
        if (legacyConf.lastMembersUpdate) {
          (candidateConfDoc as any).lastMembersUpdate = legacyConf.lastMembersUpdate;
        }
      }

      conferenciasDetails.push({
        id: rawConfId,
        legacyId: rawConfId,
        particularId: rawCpId,
        name: confName,
        normalizedName: confNormName,
        action: confAction,
        reason: confReason,
        targetCentralId: cleanCentralId,
        warnings: confWarnings.length > 0 ? confWarnings : undefined,
        requiresManualReview: confRequiresManualReview || undefined,
        candidateDoc: candidateConfDoc,
      });

      idMap.push({
        legacyId: rawConfId,
        targetId: rawConfId,
        type: 'conferencia',
        status: confAction,
      });
    }
  }

  return {
    migrationId,
    validatedCentralId: cleanCentralId,
    timestamp,
    totals,
    idMap,
    conselhosDetails,
    conferenciasDetails,
    warnings: globalWarnings,
  };
}

/**
 * Higieniza o relatório do plano de migração da hierarquia para gravação segura em logs de auditoria (LGPD),
 * mascarando e-mails e telefones nos documentos candidatos.
 */
export function sanitizeHierarchyPlanForLogs(plan: HierarchyMigrationPlanResult): HierarchyMigrationPlanResult {
  return {
    ...plan,
    conselhosDetails: plan.conselhosDetails.map((detail) => {
      if (!detail.candidateDoc) return detail;
      const {
        presidente,
        vicePresidente,
        secretario,
        tesoureiro,
        ecafo,
        coordenadorCCA,
        customRoles,
        mandateHistory,
        ...restDoc
      } = detail.candidateDoc;

      return {
        ...detail,
        candidateDoc: {
          ...restDoc,
          email: detail.candidateDoc.email ? maskSensitiveValue('email', detail.candidateDoc.email) : undefined,
          phone: detail.candidateDoc.phone ? maskSensitiveValue('phone', detail.candidateDoc.phone) : undefined,
        },
      };
    }),
    conferenciasDetails: plan.conferenciasDetails.map((detail) => {
      if (!detail.candidateDoc) return detail;
      const { presidente, mandateHistory, ...restDoc } = detail.candidateDoc;

      return {
        ...detail,
        candidateDoc: {
          ...restDoc,
        },
      };
    }),
  };
}
