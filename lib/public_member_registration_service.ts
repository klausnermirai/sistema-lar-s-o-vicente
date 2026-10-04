import crypto from 'crypto';
import {
  ConselhoCentralPublicTokenConfig,
  PublicHierarchyStructureResponse,
  PublicMemberLookupItem,
  PublicMemberMaskedDetails,
  SolicitacaoCadastroMembro,
  StandaloneConferencia,
  StandaloneConselhoParticular,
} from '../types.ts';
import {
  CURRENT_LGPD_TERM_TEXT,
  CURRENT_LGPD_TERM_TITLE,
  CURRENT_LGPD_TERM_VERSION,
  validatePublicMemberSubmissionInput,
} from './public_member_registration_validator.ts';
import {
  generateOpaqueMemberToken,
  verifyAndDecodeOpaqueMemberToken,
  maskPhone,
  maskEmail,
  maskBirthDate,
  getDateStatus,
} from './public_member_masking.ts';
import { validatePublicMemberUpdateInput } from './public_member_update_validator.ts';
import {
  computeAllDedupKeys,
  computePhoneDedupKey,
  computeEmailDedupKey,
  computeNameConfDedupKey,
  getDedupHmacSecret,
} from './member_deduplication_crypto.ts';
import { validateAndNormalizeBirthDate } from './date_utils.ts';

export interface ServiceAuthContext {
  allowed?: boolean;
  validatedCentralId?: string;
  userId?: string;
}

export interface PublicRegistrationServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?:
    | 'UNAUTHORIZED'
    | 'TOKEN_NOT_FOUND'
    | 'TOKEN_REVOKED'
    | 'CENTRAL_NOT_FOUND'
    | 'INVALID_PAYLOAD'
    | 'PARTICULAR_NOT_FOUND'
    | 'PARTICULAR_INACTIVE'
    | 'CONFERENCIA_NOT_FOUND'
    | 'CONFERENCIA_INACTIVE'
    | 'HIERARCHY_MISMATCH'
    | 'DUPLICATE_SUBMISSION_COOLDOWN'
    | 'RATE_LIMIT_EXCEEDED'
    | 'SUBMISSION_NOT_FOUND'
    | 'ALREADY_PROCESSED'
    | 'MISSING_REJECTION_REASON'
    | 'INVALID_OPAQUE_TOKEN'
    | 'MEMBER_NOT_FOUND'
    | 'ALREADY_PENDING_UPDATE'
    | 'CONFIG_ERROR'
    | 'STORAGE_ERROR';
  errors?: string[];
}

export interface ListSubmissionsOptions {
  status?:
    | 'aguardando_aprovacao'
    | 'aprovado'
    | 'recusado'
    | 'processado_automaticamente'
    | 'aguardando_revisao_duplicidade'
    | 'parcialmente_processado'
    | 'todos';
  particularId?: string;
  conferenciaId?: string;
}

export interface PublicRegistrationTransaction {
  getCentralTokenConfig(token: string): Promise<ConselhoCentralPublicTokenConfig | null>;
  getRequestId(requestId: string): Promise<any | null>;
  saveRequestId(requestId: string, result: any): Promise<void>;
  getDedupKey(keyHash: string): Promise<{ membroId: string; type: string; createdAt: string } | null>;
  setDedupKey(keyHash: string, data: { membroId: string; type: string; createdAt: string }): Promise<void>;
  getParticularById(particularId: string): Promise<StandaloneConselhoParticular | null>;
  getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null>;
  getMembroById(membroId: string): Promise<any | null>;
  createMembroRecord(membro: any): Promise<{ id: string }>;
  updateMembroRecord(membroId: string, updates: any): Promise<void>;
  getSubmissionById(id: string): Promise<SolicitacaoCadastroMembro | null>;
  createSubmission(submission: Omit<SolicitacaoCadastroMembro, 'id'> & { id?: string }): Promise<SolicitacaoCadastroMembro>;
  updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>): Promise<SolicitacaoCadastroMembro>;
  saveAuditLog(audit: any): Promise<void>;
}

export interface PublicRegistrationRepository {
  getCentralTokenConfig(token: string): Promise<ConselhoCentralPublicTokenConfig | null>;
  getCentralTokenConfigByCentralId(centralId: string): Promise<ConselhoCentralPublicTokenConfig | null>;
  saveCentralTokenConfig(config: ConselhoCentralPublicTokenConfig): Promise<void>;
  getInstitution(centralId: string): Promise<{ id: string; name: string } | null>;
  listActiveParticulares(centralId: string): Promise<Array<{ id: string; name: string }>>;
  listActiveConferencias(centralId: string): Promise<Array<{ id: string; particularId: string; name: string }>>;
  getParticularById(particularId: string): Promise<StandaloneConselhoParticular | null>;
  getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null>;
  findRecentPendingSubmission(
    conferenciaId: string,
    normalizedName: string,
    normalizedPhone: string
  ): Promise<SolicitacaoCadastroMembro | null>;
  createSubmission(submission: Omit<SolicitacaoCadastroMembro, 'id'> & { id?: string }): Promise<SolicitacaoCadastroMembro>;
  getSubmissionById(id: string): Promise<SolicitacaoCadastroMembro | null>;
  listSubmissions(centralId: string, options?: ListSubmissionsOptions): Promise<SolicitacaoCadastroMembro[]>;
  updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>): Promise<SolicitacaoCadastroMembro>;
  findExistingMembers(
    centralId: string,
    normalizedName: string,
    normalizedPhone?: string,
    email?: string
  ): Promise<Array<{ id: string; fullName: string; conferenciaId: string; conferenciaName?: string; phone: string; email?: string }>>;
  createMembroRecord(membro: any): Promise<{ id: string }>;
  listActiveMembersByConferencia?(conferenciaId: string): Promise<Array<any>>;
  listPendingSubmissionsByConferencia?(conferenciaId: string): Promise<Array<SolicitacaoCadastroMembro>>;
  getMembroById?(membroId: string): Promise<any | null>;
  findPendingUpdateForTarget?(targetType: 'membro' | 'submission', targetId: string): Promise<SolicitacaoCadastroMembro | null>;
  updateMembroRecord?(membroId: string, updates: any): Promise<void>;
  saveAuditLog?(audit: any): Promise<void>;
  getRequestIdRecord?(requestId: string): Promise<any | null>;
  saveRequestIdRecord?(requestId: string, result: any): Promise<void>;
  getDedupKeyRecord?(keyHash: string): Promise<{ membroId: string; type: string; createdAt: string } | null>;
  saveDedupKeyRecord?(keyHash: string, data: { membroId: string; type: string; createdAt: string }): Promise<void>;
  executeTransaction?<T>(updateFunction: (txn: PublicRegistrationTransaction) => Promise<T>): Promise<T>;
}

export function generateSecureToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// In-memory sliding window rate limiter per IP / Token
const submissionRateLimiterMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_ATTEMPTS = 10; // máx 10 tentativas por minuto por chave

export function checkAndIncrementRateLimit(
  key: string,
  maxAttempts = RATE_LIMIT_MAX_ATTEMPTS,
  windowMs = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const timestamps = submissionRateLimiterMap.get(key) || [];

  // Limpar timestamps fora da janela
  const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (validTimestamps.length >= maxAttempts) {
    submissionRateLimiterMap.set(key, validTimestamps);
    return false; // Bloqueado
  }

  validTimestamps.push(now);
  submissionRateLimiterMap.set(key, validTimestamps);
  return true; // Permitido
}

export function resetRateLimiterForTesting(): void {
  submissionRateLimiterMap.clear();
}

/**
 * Cria uma transação em memória adaptativa quando o repositório não implementa executeTransaction nativo.
 */
function createFallbackTransactionAdapter(repo: PublicRegistrationRepository): PublicRegistrationTransaction {
  return {
    async getCentralTokenConfig(token: string) {
      return repo.getCentralTokenConfig(token);
    },
    async getRequestId(requestId: string) {
      return repo.getRequestIdRecord ? repo.getRequestIdRecord(requestId) : null;
    },
    async saveRequestId(requestId: string, result: any) {
      if (repo.saveRequestIdRecord) {
        await repo.saveRequestIdRecord(requestId, result);
      }
    },
    async getDedupKey(keyHash: string) {
      return repo.getDedupKeyRecord ? repo.getDedupKeyRecord(keyHash) : null;
    },
    async setDedupKey(keyHash: string, data: { membroId: string; type: string; createdAt: string }) {
      if (repo.saveDedupKeyRecord) {
        await repo.saveDedupKeyRecord(keyHash, data);
      }
    },
    async getParticularById(particularId: string) {
      return repo.getParticularById(particularId);
    },
    async getConferenciaById(conferenciaId: string) {
      return repo.getConferenciaById(conferenciaId);
    },
    async getMembroById(membroId: string) {
      return repo.getMembroById ? repo.getMembroById(membroId) : null;
    },
    async createMembroRecord(membro: any) {
      return repo.createMembroRecord(membro);
    },
    async updateMembroRecord(membroId: string, updates: any) {
      if (repo.updateMembroRecord) {
        await repo.updateMembroRecord(membroId, updates);
      }
    },
    async getSubmissionById(id: string) {
      return repo.getSubmissionById(id);
    },
    async createSubmission(submission: any) {
      return repo.createSubmission(submission);
    },
    async updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>) {
      return repo.updateSubmission(id, updates);
    },
    async saveAuditLog(audit: any) {
      if (repo.saveAuditLog) {
        await repo.saveAuditLog(audit);
      }
    },
  };
}

/**
 * 1. Gera ou regenera o token público de um Conselho Central.
 */
export async function generateOrRotateCentralPublicToken(
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository
): Promise<PublicRegistrationServiceResult<ConselhoCentralPublicTokenConfig>> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const institution = await repo.getInstitution(centralId);
    if (!institution) {
      return {
        success: false,
        error: 'Conselho Central não encontrado no cadastro.',
        code: 'CENTRAL_NOT_FOUND',
      };
    }

    const now = new Date().toISOString();
    const token = generateSecureToken();
    const config: ConselhoCentralPublicTokenConfig = {
      id: centralId,
      centralId,
      token,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      createdBy: authContext.userId || 'system',
    };

    await repo.saveCentralTokenConfig(config);

    if (repo.saveAuditLog) {
      await repo.saveAuditLog({
        entityType: 'institution',
        entityId: centralId,
        action: 'generate_public_token',
        changedBy: authContext.userId || 'system',
        timestamp: now,
        notes: 'Token público de autocadastro gerado/atualizado',
      });
    }

    return {
      success: true,
      data: config,
    };
  } catch (err: any) {
    console.error('Erro ao gerar token público:', err);
    return {
      success: false,
      error: 'Falha ao gerar link do formulário público.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 2. Revoga o token público de um Conselho Central.
 */
export async function revokeCentralPublicToken(
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository
): Promise<PublicRegistrationServiceResult<{ revoked: boolean }>> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const existing = await repo.getCentralTokenConfigByCentralId(centralId);
    if (!existing) {
      return {
        success: false,
        error: 'Nenhum formulário público configurado para este Conselho Central.',
        code: 'TOKEN_NOT_FOUND',
      };
    }

    const now = new Date().toISOString();
    const updated: ConselhoCentralPublicTokenConfig = {
      ...existing,
      enabled: false,
      revokedAt: now,
      updatedAt: now,
    };

    await repo.saveCentralTokenConfig(updated);

    if (repo.saveAuditLog) {
      await repo.saveAuditLog({
        entityType: 'institution',
        entityId: centralId,
        action: 'revoke_public_token',
        changedBy: authContext.userId || 'system',
        timestamp: now,
        notes: 'Token público de autocadastro revogado/desativado',
      });
    }

    return {
      success: true,
      data: { revoked: true },
    };
  } catch (err: any) {
    console.error('Erro ao revogar token público:', err);
    return {
      success: false,
      error: 'Falha ao desativar formulário público.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 3. Consulta a configuração do token público de um Conselho Central.
 */
export async function getCentralPublicTokenConfig(
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository
): Promise<PublicRegistrationServiceResult<ConselhoCentralPublicTokenConfig | null>> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const config = await repo.getCentralTokenConfigByCentralId(centralId);
    return {
      success: true,
      data: config,
    };
  } catch (err: any) {
    console.error('Erro ao consultar configuração do token público:', err);
    return {
      success: false,
      error: 'Falha ao consultar link do formulário público.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 4. Carrega a estrutura hierárquica pública (CPs e Conferências ativas) a partir de um token público válido.
 */
export async function getPublicHierarchyStructure(
  token: string,
  repo: PublicRegistrationRepository
): Promise<PublicRegistrationServiceResult<PublicHierarchyStructureResponse>> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Token do formulário não fornecido.',
      code: 'TOKEN_NOT_FOUND',
    };
  }

  try {
    const tokenConfig = await repo.getCentralTokenConfig(token.trim());
    if (!tokenConfig || !tokenConfig.enabled) {
      return {
        success: false,
        error: 'Este link de formulário não é válido ou foi desativado.',
        code: tokenConfig ? 'TOKEN_REVOKED' : 'TOKEN_NOT_FOUND',
      };
    }

    const centralId = tokenConfig.centralId;
    const [inst, particulares, conferencias] = await Promise.all([
      repo.getInstitution(centralId),
      repo.listActiveParticulares(centralId),
      repo.listActiveConferencias(centralId),
    ]);

    const centralName = inst?.name || 'Conselho Central SSVP';

    return {
      success: true,
      data: {
        centralName,
        conselhosParticulares: particulares,
        conferencias,
        termVersion: CURRENT_LGPD_TERM_VERSION,
        termTitle: CURRENT_LGPD_TERM_TITLE,
        termText: CURRENT_LGPD_TERM_TEXT,
      },
    };
  } catch (err: any) {
    console.error('Erro ao carregar estrutura pública hierárquica:', err);
    return {
      success: false,
      error: 'Falha ao carregar formulário público.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 4b. Lista pública de membros para complementação de cadastro.
 */
export async function listPublicConferenciaMembers(
  token: string,
  conferenciaId: string,
  repo: PublicRegistrationRepository
): Promise<PublicRegistrationServiceResult<PublicMemberLookupItem[]>> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Token do formulário não fornecido.',
      code: 'TOKEN_NOT_FOUND',
    };
  }

  if (!conferenciaId || typeof conferenciaId !== 'string' || !conferenciaId.trim()) {
    return {
      success: false,
      error: 'Conferência não informada.',
      code: 'CONFERENCIA_NOT_FOUND',
    };
  }

  try {
    const tokenConfig = await repo.getCentralTokenConfig(token.trim());
    if (!tokenConfig || !tokenConfig.enabled) {
      return {
        success: false,
        error: 'Este link de formulário não é válido ou foi desativado.',
        code: tokenConfig ? 'TOKEN_REVOKED' : 'TOKEN_NOT_FOUND',
      };
    }

    const centralId = tokenConfig.centralId;
    const conferencia = await repo.getConferenciaById(conferenciaId.trim());
    if (!conferencia || conferencia.centralId !== centralId) {
      return {
        success: false,
        error: 'Conferência não encontrada no Conselho Central deste formulário.',
        code: 'CONFERENCIA_NOT_FOUND',
      };
    }

    if (conferencia.status !== 'ativo') {
      return {
        success: false,
        error: 'A Conferência selecionada encontra-se inativa.',
        code: 'CONFERENCIA_INACTIVE',
      };
    }

    const [activeMembers, pendingSubmissions] = await Promise.all([
      repo.listActiveMembersByConferencia ? repo.listActiveMembersByConferencia(conferenciaId.trim()) : [],
      repo.listPendingSubmissionsByConferencia
        ? repo.listPendingSubmissionsByConferencia(conferenciaId.trim())
        : [],
    ]);

    const itemsMap = new Map<
      string,
      { originType: 'membro' | 'submission'; realId: string; fullName: string; type: 'confrade' | 'consocia' | 'auxiliar' | 'aspirante' }
    >();

    for (const m of activeMembers) {
      const normName = (m.normalizedName || m.fullName || m.name || '').trim().toUpperCase();
      const normPhone = (m.normalizedPhone || (m.phone ? m.phone.replace(/\D/g, '') : '')).trim();
      const dedupKey = `${normName}_${normPhone || m.id}`;

      itemsMap.set(dedupKey, {
        originType: 'membro',
        realId: m.id,
        fullName: m.fullName || m.name || '',
        type: m.type || 'confrade',
      });
    }

    for (const sub of pendingSubmissions) {
      if (sub.tipo === 'atualizacao_cadastral' || sub.tipo === 'complementacao_cadastro') {
        continue;
      }

      const normName = (sub.normalizedName || sub.fullName || '').trim().toUpperCase();
      const normPhone = (sub.normalizedPhone || (sub.phone ? sub.phone.replace(/\D/g, '') : '')).trim();
      const dedupKey = `${normName}_${normPhone || sub.id}`;

      if (!itemsMap.has(dedupKey)) {
        itemsMap.set(dedupKey, {
          originType: 'submission',
          realId: sub.id,
          fullName: sub.fullName,
          type: sub.type || 'confrade',
        });
      }
    }

    const lookupList: PublicMemberLookupItem[] = [];
    for (const item of itemsMap.values()) {
      if (!item.fullName) continue;

      const idOpaco = generateOpaqueMemberToken({
        originType: item.originType,
        realId: item.realId,
        centralId,
        conferenciaId: conferenciaId.trim(),
      });

      lookupList.push({
        idOpaco,
        fullName: item.fullName,
        type: item.type,
      });
    }

    lookupList.sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR', { sensitivity: 'base' }));

    return {
      success: true,
      data: lookupList,
    };
  } catch (err: any) {
    console.error('Erro ao listar membros públicos da conferência:', err);
    return {
      success: false,
      error: 'Falha ao buscar lista de membros.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 4c. Consulta dados mascarados para complementação pública de cadastro.
 */
export async function getPublicMemberMaskedDetails(
  token: string,
  idOpaco: string,
  repo: PublicRegistrationRepository
): Promise<PublicRegistrationServiceResult<PublicMemberMaskedDetails>> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Token do formulário não fornecido.',
      code: 'TOKEN_NOT_FOUND',
    };
  }

  if (!idOpaco || typeof idOpaco !== 'string' || !idOpaco.trim()) {
    return {
      success: false,
      error: 'Identificador do membro não fornecido.',
      code: 'INVALID_OPAQUE_TOKEN',
    };
  }

  try {
    const tokenConfig = await repo.getCentralTokenConfig(token.trim());
    if (!tokenConfig || !tokenConfig.enabled) {
      return {
        success: false,
        error: 'Este link de formulário não é mais válido ou foi desativado.',
        code: tokenConfig ? 'TOKEN_REVOKED' : 'TOKEN_NOT_FOUND',
      };
    }

    const centralId = tokenConfig.centralId;
    const decoded = verifyAndDecodeOpaqueMemberToken(idOpaco.trim(), centralId);
    if (!decoded) {
      return {
        success: false,
        error: 'A seleção do membro expirou ou é inválida. Selecione o membro novamente.',
        code: 'INVALID_OPAQUE_TOKEN',
      };
    }

    let fullName = '';
    let type: 'confrade' | 'consocia' | 'auxiliar' | 'aspirante' = 'confrade';
    let phone: string | undefined;
    let email: string | undefined;
    let birthDate: string | undefined;
    let admissionDate: string | undefined;
    let acclamationDate: string | undefined;
    let proclamationDate: string | undefined;
    let particularId = '';
    let conferenciaId = '';

    if (decoded.originType === 'membro') {
      const membro = repo.getMembroById ? await repo.getMembroById(decoded.realId) : null;
      if (!membro || membro.centralId !== centralId || membro.status !== 'ativo') {
        return {
          success: false,
          error: 'Membro não encontrado ou inativo.',
          code: 'MEMBER_NOT_FOUND',
        };
      }
      fullName = membro.fullName || membro.name || '';
      type = membro.type || 'confrade';
      phone = membro.phone;
      email = membro.email;
      birthDate = membro.birthDate;
      admissionDate = membro.admissionDate;
      acclamationDate = membro.acclamationDate;
      proclamationDate = membro.proclamationDate;
      particularId = membro.particularId;
      conferenciaId = membro.conferenciaId;
    } else {
      const sub = await repo.getSubmissionById(decoded.realId);
      if (!sub || sub.centralId !== centralId || (sub.status !== 'aguardando_aprovacao' && sub.status !== 'aguardando_revisao_duplicidade')) {
        return {
          success: false,
          error: 'Solicitação de cadastro não encontrada ou já processada.',
          code: 'SUBMISSION_NOT_FOUND',
        };
      }
      fullName = sub.fullName;
      type = (sub.type === 'confrade' || sub.type === 'consocia' || sub.type === 'auxiliar' || sub.type === 'aspirante') ? sub.type : 'confrade';
      phone = sub.phone;
      email = sub.email;
      birthDate = sub.birthDate;
      admissionDate = sub.admissionDate;
      acclamationDate = sub.acclamationDate;
      proclamationDate = sub.proclamationDate;
      particularId = sub.particularId;
      conferenciaId = sub.conferenciaId;
    }

    const [particular, conferencia] = await Promise.all([
      particularId ? repo.getParticularById(particularId) : Promise.resolve(null),
      conferenciaId ? repo.getConferenciaById(conferenciaId) : Promise.resolve(null),
    ]);

    const sourceObj = decoded.originType === 'membro' ? await repo.getMembroById?.(decoded.realId) : await repo.getSubmissionById(decoded.realId);

    const maskedDetails: PublicMemberMaskedDetails = {
      idOpaco: idOpaco.trim(),
      fullName,
      type,
      gender: sourceObj?.gender,
      profession: sourceObj?.profession,
      particularName: particular?.name || 'Conselho Particular',
      conferenciaName: conferencia?.name || 'Conferência',
      maskedPhone: maskPhone(phone),
      maskedPhoneResidential: sourceObj?.phoneResidential ? maskPhone(sourceObj.phoneResidential) : null,
      maskedPhoneCommercial: sourceObj?.phoneCommercial ? maskPhone(sourceObj.phoneCommercial) : null,
      maskedCpf: sourceObj?.cpf ? maskPhone(sourceObj.cpf) : null,
      maskedEmail: maskEmail(email),
      maskedBirthDate: maskBirthDate(birthDate),
      maskedAddress: sourceObj?.fullAddress || (sourceObj?.addressStreet ? `${sourceObj.addressStreet}, ${sourceObj.addressCity || ''}` : null),
      addressStreet: sourceObj?.addressStreet || null,
      addressNumber: sourceObj?.addressNumber || null,
      addressComplement: sourceObj?.addressComplement || null,
      addressNeighborhood: sourceObj?.addressNeighborhood || null,
      addressCity: sourceObj?.addressCity || null,
      addressState: sourceObj?.addressState || null,
      addressZip: sourceObj?.addressZip || null,
      admissionDateStatus: getDateStatus(admissionDate),
      acclamationDateStatus: getDateStatus(acclamationDate),
      proclamationDateStatus: getDateStatus(proclamationDate),
    };

    return {
      success: true,
      data: maskedDetails,
    };
  } catch (err: any) {
    console.error('Erro ao buscar detalhes mascarados do membro:', err);
    return {
      success: false,
      error: 'Falha ao consultar dados do membro.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 5. Submissão pública de Autocadastro de Membro com Deduplicação HMAC e Idempotência por requestId.
 */
export async function submitPublicMemberRegistration(
  token: string,
  payload: any,
  repo: PublicRegistrationRepository,
  meta?: { ip?: string; userAgent?: string }
): Promise<
  PublicRegistrationServiceResult<{
    submissionId: string;
    membroId?: string;
    status: 'processado_automaticamente' | 'aguardando_revisao_duplicidade' | 'aguardando_aprovacao';
    message: string;
    idempotentReplay?: boolean;
  }>
> {
  // A. Verificação estrita e segura do segredo HMAC antes de qualquer operação
  let dedupSecret: string;
  try {
    dedupSecret = getDedupHmacSecret();
  } catch (configErr: any) {
    console.error('ERRO DE SEGURANÇA NO BACKEND:', configErr.message);
    return {
      success: false,
      error: 'Configuração de segurança do servidor incompleta. Operação abortada por segurança.',
      code: 'CONFIG_ERROR',
    };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Token do formulário não fornecido.',
      code: 'TOKEN_NOT_FOUND',
    };
  }

  // B. Rate Limiting por Token e IP
  const rateLimitKey = `${meta?.ip || 'anonymous'}_${token.trim()}`;
  const isAllowed = checkAndIncrementRateLimit(rateLimitKey);
  if (!isAllowed) {
    return {
      success: false,
      error: 'Muitas tentativas de envio em um curto intervalo de tempo. Aguarde um momento antes de tentar novamente.',
      code: 'RATE_LIMIT_EXCEEDED',
    };
  }

  // C. Validação dos dados do formulário
  const validation = validatePublicMemberSubmissionInput(payload);
  if (!validation.valid || !validation.cleanData) {
    return {
      success: false,
      error: validation.errors[0] || 'Dados inválidos no formulário.',
      errors: validation.errors,
      code: 'INVALID_PAYLOAD',
    };
  }

  const clean = validation.cleanData;
  const requestId =
    typeof payload?.requestId === 'string' && payload.requestId.trim().length >= 8
      ? payload.requestId.trim()
      : `req_${crypto.randomBytes(12).toString('hex')}`;

  const runner = async (
    txn: PublicRegistrationTransaction
  ): Promise<
    PublicRegistrationServiceResult<{
      submissionId: string;
      membroId?: string;
      status: 'aguardando_aprovacao' | 'processado_automaticamente' | 'aguardando_revisao_duplicidade';
      message: string;
      idempotentReplay?: boolean;
    }>
  > => {
    const existingReq = await txn.getRequestId(requestId);
    if (existingReq) {
      return {
        success: true,
        data: {
          ...existingReq,
          idempotentReplay: true,
        },
      };
    }

    // 2. Validação do Token e Conselho Central
    const tokenConfig = await txn.getCentralTokenConfig(token.trim());
    if (!tokenConfig || !tokenConfig.enabled) {
      return {
        success: false,
        error: 'Este link de formulário não é mais válido ou foi desativado.',
        code: tokenConfig ? 'TOKEN_REVOKED' : 'TOKEN_NOT_FOUND',
      };
    }

    const centralId = tokenConfig.centralId;

    // 3. Validação do Conselho Particular
    const particular = await txn.getParticularById(clean.particularId);
    if (!particular) {
      return {
        success: false,
        error: 'O Conselho Particular selecionado não foi encontrado.',
        code: 'PARTICULAR_NOT_FOUND',
      };
    }
    if (particular.status !== 'ativo') {
      return {
        success: false,
        error: 'O Conselho Particular selecionado encontra-se inativo.',
        code: 'PARTICULAR_INACTIVE',
      };
    }
    if (particular.centralId !== centralId) {
      return {
        success: false,
        error: 'O Conselho Particular não pertence ao Conselho Central deste formulário.',
        code: 'HIERARCHY_MISMATCH',
      };
    }

    // 4. Validação da Conferência
    const conferencia = await txn.getConferenciaById(clean.conferenciaId);
    if (!conferencia) {
      return {
        success: false,
        error: 'A Conferência selecionada não foi encontrada.',
        code: 'CONFERENCIA_NOT_FOUND',
      };
    }
    if (conferencia.status !== 'ativo') {
      return {
        success: false,
        error: 'A Conferência selecionada encontra-se inativa.',
        code: 'CONFERENCIA_INACTIVE',
      };
    }
    if (conferencia.particularId !== clean.particularId || conferencia.centralId !== centralId) {
      return {
        success: false,
        error: 'A Conferência selecionada não está vinculada ao Conselho Particular informado.',
        code: 'HIERARCHY_MISMATCH',
      };
    }

    // 5. Cálculo das Chaves HMAC Determinísticas (sem PII no ID do documento)
    const dedupKeys = computeAllDedupKeys({
      centralId,
      conferenciaId: clean.conferenciaId,
      fullName: clean.fullName,
      phone: clean.phone,
      email: clean.email,
      customSecret: dedupSecret,
    });

    // 6. Leitura e checagem de colisão das chaves determinísticas
    // Para submissões feitas por terceiros (representante), o mesmo telefone do representante pode ter sido usado para mais de um membro familiar/vicentino
    const checkPhoneCollision = !clean.isThirdPartySubmission;

    const [phoneDedupSnap, nameConfDedupSnap, emailDedupSnap] = await Promise.all([
      checkPhoneCollision ? txn.getDedupKey(dedupKeys.phoneKey) : Promise.resolve(null),
      txn.getDedupKey(dedupKeys.nameConfKey),
      clean.email && dedupKeys.emailKey ? txn.getDedupKey(dedupKeys.emailKey) : Promise.resolve(null),
    ]);

    const duplicityReasons: string[] = [];
    if (phoneDedupSnap) {
      duplicityReasons.push('Telefone já registrado em membro ativo do Conselho Central.');
    }
    if (nameConfDedupSnap) {
      duplicityReasons.push('Nome já registrado em membro ativo desta Conferência.');
    }
    if (emailDedupSnap) {
      duplicityReasons.push('E-mail já registrado em membro ativo do Conselho Central.');
    }

    const now = new Date().toISOString();
    const ipHash = meta?.ip
      ? crypto.createHash('sha256').update(meta.ip).digest('hex').substring(0, 16)
      : undefined;

    // CENÁRIO A: COLISÃO DETERMINÍSTICA DETECTADA
    // Não descarta o dado e não aborta com erro feio: encaminha para moderação segura de duplicidade!
    if (duplicityReasons.length > 0) {
      const submissionRecord: Omit<SolicitacaoCadastroMembro, 'id'> = {
        centralId,
        particularId: clean.particularId,
        conferenciaId: clean.conferenciaId,
        fullName: clean.fullName,
        normalizedName: clean.normalizedName,
        type: clean.type,
        gender: clean.gender,
        birthDate: clean.birthDate,
        cpf: clean.cpf,
        profession: clean.profession,
        addressStreet: clean.addressStreet,
        addressNumber: clean.addressNumber,
        addressComplement: clean.addressComplement,
        addressNeighborhood: clean.addressNeighborhood,
        addressCity: clean.addressCity,
        addressState: clean.addressState,
        addressZip: clean.addressZip,
        fullAddress: clean.fullAddress,
        phone: clean.phone,
        normalizedPhone: clean.normalizedPhone,
        phoneResidential: clean.phoneResidential,
        phoneCommercial: clean.phoneCommercial,
        email: clean.email,
        admissionDate: clean.admissionDate,
        acclamationDate: clean.acclamationDate,
        proclamationDate: clean.proclamationDate,
        isThirdPartySubmission: clean.isThirdPartySubmission,
        representativeName: clean.representativeName,
        consent: {
          accepted: true,
          acceptedAt: now,
          termVersion: clean.termVersion,
          ipHash,
          userAgentSnippet: meta?.userAgent ? meta.userAgent.substring(0, 100) : undefined,
          isThirdParty: clean.isThirdPartySubmission,
          representativeName: clean.representativeName,
        },
        status: 'aguardando_revisao_duplicidade',
        tipo: 'novo_cadastro',
        requestId,
        duplicityReasons,
        submittedAt: now,
      };

      const savedSub = await txn.createSubmission(submissionRecord);

      await txn.saveAuditLog({
        entityType: 'membro_ssvp',
        entityId: savedSub.id,
        action: 'create',
        changedBy: 'public_form',
        timestamp: now,
        notes: `Cadastro retido para moderação por possível duplicidade: ${duplicityReasons.join('; ')}`,
      });

      const resultPayload = {
        submissionId: savedSub.id,
        status: 'aguardando_revisao_duplicidade' as const,
        message:
          'Cadastro recebido com sucesso. Como já localizamos um registro com dados semelhantes, sua solicitação foi encaminhada para revisão da diretoria.',
      };

      await txn.saveRequestId(requestId, resultPayload);

      return {
        success: true,
        data: resultPayload,
      };
    }

    // CENÁRIO B: NENHUMA COLISÃO -> CRIAÇÃO AUTOMÁTICA DIRETA
    const newMembroPayload = {
      centralId,
      particularId: clean.particularId,
      conferenciaId: clean.conferenciaId,
      fullName: clean.fullName,
      normalizedName: clean.normalizedName,
      type: clean.type,
      gender: clean.gender,
      birthDate: clean.birthDate,
      cpf: clean.cpf,
      profession: clean.profession,
      addressStreet: clean.addressStreet,
      addressNumber: clean.addressNumber,
      addressComplement: clean.addressComplement,
      addressNeighborhood: clean.addressNeighborhood,
      addressCity: clean.addressCity,
      addressState: clean.addressState,
      addressZip: clean.addressZip,
      fullAddress: clean.fullAddress,
      phone: clean.phone,
      normalizedPhone: clean.normalizedPhone,
      phoneResidential: clean.phoneResidential,
      phoneCommercial: clean.phoneCommercial,
      email: clean.email,
      admissionDate: clean.admissionDate,
      acclamationDate: clean.acclamationDate,
      proclamationDate: clean.proclamationDate,
      status: 'ativo',
      origin: 'autocadastro_publico',
      createdAt: now,
      updatedAt: now,
      createdBy: 'public_auto_registration',
    };

    const createdMembro = await txn.createMembroRecord(newMembroPayload);

    // Gravação das chaves determinísticas HMAC apontando para o novo membro
    await Promise.all([
      txn.setDedupKey(dedupKeys.phoneKey, { membroId: createdMembro.id, type: 'phone', createdAt: now }),
      txn.setDedupKey(dedupKeys.nameConfKey, { membroId: createdMembro.id, type: 'name_conf', createdAt: now }),
      dedupKeys.emailKey
        ? txn.setDedupKey(dedupKeys.emailKey, { membroId: createdMembro.id, type: 'email', createdAt: now })
        : Promise.resolve(),
    ]);

    // Grava a solicitação com status processado_automaticamente e vínculo ao membroId
    const submissionRecord: Omit<SolicitacaoCadastroMembro, 'id'> = {
      centralId,
      particularId: clean.particularId,
      conferenciaId: clean.conferenciaId,
      fullName: clean.fullName,
      normalizedName: clean.normalizedName,
      type: clean.type,
      gender: clean.gender,
      birthDate: clean.birthDate,
      cpf: clean.cpf,
      profession: clean.profession,
      addressStreet: clean.addressStreet,
      addressNumber: clean.addressNumber,
      addressComplement: clean.addressComplement,
      addressNeighborhood: clean.addressNeighborhood,
      addressCity: clean.addressCity,
      addressState: clean.addressState,
      addressZip: clean.addressZip,
      fullAddress: clean.fullAddress,
      phone: clean.phone,
      normalizedPhone: clean.normalizedPhone,
      phoneResidential: clean.phoneResidential,
      phoneCommercial: clean.phoneCommercial,
      email: clean.email,
      admissionDate: clean.admissionDate,
      acclamationDate: clean.acclamationDate,
      proclamationDate: clean.proclamationDate,
      isThirdPartySubmission: clean.isThirdPartySubmission,
      representativeName: clean.representativeName,
      consent: {
        accepted: true,
        acceptedAt: now,
        termVersion: clean.termVersion,
        ipHash,
        userAgentSnippet: meta?.userAgent ? meta.userAgent.substring(0, 100) : undefined,
        isThirdParty: clean.isThirdPartySubmission,
        representativeName: clean.representativeName,
      },
      status: 'processado_automaticamente',
      tipo: 'novo_cadastro',
      membroId: createdMembro.id,
      requestId,
      submittedAt: now,
      reviewedAt: now,
      reviewedBy: 'sistema_automatico',
    };

    const savedSub = await txn.createSubmission(submissionRecord);

    await txn.saveAuditLog({
      entityType: 'membro_ssvp',
      entityId: createdMembro.id,
      action: 'create',
      changedBy: 'public_auto_registration',
      timestamp: now,
      notes: 'Autocadastro público processado automaticamente com sucesso.',
      submissionId: savedSub.id,
    });

    const resultPayload = {
      submissionId: savedSub.id,
      membroId: createdMembro.id,
      status: 'processado_automaticamente' as const,
      message: 'Cadastro processado e confirmado com sucesso.',
    };

    await txn.saveRequestId(requestId, resultPayload);

    return {
      success: true,
      data: resultPayload,
    };
  };

  try {
    if (repo.executeTransaction) {
      return await repo.executeTransaction(runner);
    }
    const adapter = createFallbackTransactionAdapter(repo);
    return await runner(adapter);
  } catch (err: any) {
    console.error('Erro na submissão de cadastro público:', err);
    return {
      success: false,
      error: 'Falha ao processar cadastro de membro. Tente novamente mais tarde.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 6. Complementação pública e alteração cadastral com aplicação direta não destrutiva e moderação seletiva.
 */
export async function submitPublicMemberUpdateRequest(
  token: string,
  idOpaco: string,
  payload: any,
  repo: PublicRegistrationRepository,
  meta?: { ip?: string; userAgent?: string }
): Promise<
  PublicRegistrationServiceResult<{
    submissionId: string;
    status: 'processado_automaticamente' | 'parcialmente_processado' | 'aguardando_aprovacao';
    appliedChanges?: Record<string, any>;
    requestedChanges?: Record<string, any>;
    message: string;
    idempotentReplay?: boolean;
  }>
> {
  let dedupSecret: string;
  try {
    dedupSecret = getDedupHmacSecret();
  } catch (configErr: any) {
    console.error('ERRO DE SEGURANÇA NO BACKEND:', configErr.message);
    return {
      success: false,
      error: 'Configuração de segurança do servidor incompleta. Operação abortada por segurança.',
      code: 'CONFIG_ERROR',
    };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Token do formulário não fornecido.',
      code: 'TOKEN_NOT_FOUND',
    };
  }

  if (!idOpaco || typeof idOpaco !== 'string' || !idOpaco.trim()) {
    return {
      success: false,
      error: 'Identificador do membro não fornecido.',
      code: 'INVALID_OPAQUE_TOKEN',
    };
  }

  const rateLimitKey = `${meta?.ip || 'anonymous'}_update_${token.trim()}`;
  const isAllowed = checkAndIncrementRateLimit(rateLimitKey);
  if (!isAllowed) {
    return {
      success: false,
      error: 'Muitas tentativas de envio em um curto intervalo de tempo. Aguarde um momento.',
      code: 'RATE_LIMIT_EXCEEDED',
    };
  }

  const requestId =
    typeof payload?.requestId === 'string' && payload.requestId.trim().length >= 8
      ? payload.requestId.trim()
      : `req_upd_${crypto.randomBytes(12).toString('hex')}`;

  const runner = async (
    txn: PublicRegistrationTransaction
  ): Promise<
    PublicRegistrationServiceResult<{
      submissionId: string;
      status: 'aguardando_aprovacao' | 'processado_automaticamente' | 'parcialmente_processado';
      appliedChanges?: Record<string, any>;
      requestedChanges?: Record<string, any>;
      message: string;
      idempotentReplay?: boolean;
    }>
  > => {
    const existingReq = await txn.getRequestId(requestId);
    if (existingReq) {
      return {
        success: true,
        data: {
          ...existingReq,
          idempotentReplay: true,
        },
      };
    }

    const tokenConfig = await txn.getCentralTokenConfig(token.trim());
    if (!tokenConfig || !tokenConfig.enabled) {
      return {
        success: false,
        error: 'Este link de formulário não é mais válido ou foi desativado.',
        code: tokenConfig ? 'TOKEN_REVOKED' : 'TOKEN_NOT_FOUND',
      };
    }

    const centralId = tokenConfig.centralId;
    const decoded = verifyAndDecodeOpaqueMemberToken(idOpaco.trim(), centralId);
    if (!decoded) {
      return {
        success: false,
        error: 'A seleção do membro expirou ou é inválida. Selecione o membro novamente na lista.',
        code: 'INVALID_OPAQUE_TOKEN',
      };
    }

    let targetMembro: any = null;
    let targetSubmission: any = null;

    if (decoded.originType === 'membro') {
      targetMembro = await txn.getMembroById(decoded.realId);
      if (!targetMembro || targetMembro.centralId !== centralId || targetMembro.status !== 'ativo') {
        return {
          success: false,
          error: 'Membro não encontrado ou inativo.',
          code: 'MEMBER_NOT_FOUND',
        };
      }
    } else {
      targetSubmission = await txn.getSubmissionById(decoded.realId);
      if (!targetSubmission || targetSubmission.centralId !== centralId) {
        return {
          success: false,
          error: 'Solicitação original não encontrada.',
          code: 'SUBMISSION_NOT_FOUND',
        };
      }
    }

    if (repo.findPendingUpdateForTarget) {
      const pending = await repo.findPendingUpdateForTarget(decoded.originType, decoded.realId);
      if (pending) {
        return {
          success: false,
          error: 'Já existe uma solicitação de alteração cadastral pendente de moderação para este registro.',
          code: 'ALREADY_PENDING_UPDATE',
        };
      }
    }

    const currentBase = targetMembro || targetSubmission;
    const validation = validatePublicMemberUpdateInput(payload, {
      admissionDate: currentBase.admissionDate,
      acclamationDate: currentBase.acclamationDate,
      proclamationDate: currentBase.proclamationDate,
    });

    if (!validation.valid || !validation.cleanChanges) {
      return {
        success: false,
        error: validation.errors[0] || 'Dados inválidos na solicitação.',
        errors: validation.errors,
        code: 'INVALID_PAYLOAD',
      };
    }

    const clean = validation.cleanChanges;
    const now = new Date().toISOString();
    const ipHash = meta?.ip
      ? crypto.createHash('sha256').update(meta.ip).digest('hex').substring(0, 16)
      : undefined;

    // Se for membro oficial ativo:
    if (decoded.originType === 'membro') {
      const appliedChanges: Record<string, any> = {};
      const requestedChanges: Record<string, any> = {};

      const checkField = (field: string, newVal: any) => {
        if (newVal === undefined || newVal === null) return;
        const currentVal = targetMembro[field];
        const isCurrentEmpty =
          currentVal === undefined || currentVal === null || (typeof currentVal === 'string' && currentVal.trim() === '');

        if (isCurrentEmpty) {
          // Preenchimento de campo vazio -> Aplicação direta imediata
          appliedChanges[field] = newVal;
        } else if (String(currentVal).trim() !== String(newVal).trim()) {
          // Divergência em campo já existente -> Exige moderação
          requestedChanges[field] = newVal;
        }
      };

      checkField('fullName', clean.fullName);
      if (appliedChanges.fullName) {
        appliedChanges.normalizedName = clean.normalizedName;
      }
      if (requestedChanges.fullName) {
        requestedChanges.normalizedName = clean.normalizedName;
      }

      checkField('type', clean.type);
      checkField('gender', clean.gender);
      checkField('cpf', clean.cpf);
      checkField('profession', clean.profession);
      checkField('addressStreet', clean.addressStreet);
      checkField('addressNumber', clean.addressNumber);
      checkField('addressComplement', clean.addressComplement);
      checkField('addressNeighborhood', clean.addressNeighborhood);
      checkField('addressCity', clean.addressCity);
      checkField('addressState', clean.addressState);
      checkField('addressZip', clean.addressZip);
      checkField('fullAddress', clean.fullAddress);
      checkField('phone', clean.phone);
      if (appliedChanges.phone) {
        appliedChanges.normalizedPhone = clean.normalizedPhone;
      }
      if (requestedChanges.phone) {
        requestedChanges.normalizedPhone = clean.normalizedPhone;
      }
      checkField('phoneResidential', clean.phoneResidential);
      checkField('phoneCommercial', clean.phoneCommercial);

      checkField('email', clean.email);
      checkField('birthDate', clean.birthDate);
      checkField('admissionDate', clean.admissionDate);
      checkField('acclamationDate', clean.acclamationDate);
      checkField('proclamationDate', clean.proclamationDate);

      if (clean.conferenciaId && clean.conferenciaId !== targetMembro.conferenciaId) {
        // Transferência de conferência sempre requer moderação
        requestedChanges.conferenciaId = clean.conferenciaId;
        if (clean.particularId) requestedChanges.particularId = clean.particularId;
      }

      const appliedCount = Object.keys(appliedChanges).length;
      const requestedCount = Object.keys(requestedChanges).length;

      if (appliedCount === 0 && requestedCount === 0) {
        return {
          success: false,
          error: 'Nenhum dado novo ou alterado foi informado.',
          code: 'INVALID_PAYLOAD',
        };
      }

      let finalStatus: 'processado_automaticamente' | 'parcialmente_processado' | 'aguardando_aprovacao';
      let message: string;

      if (appliedCount > 0 && requestedCount === 0) {
        finalStatus = 'processado_automaticamente';
        message = 'Dados complementados e atualizados com sucesso.';
      } else if (appliedCount > 0 && requestedCount > 0) {
        finalStatus = 'parcialmente_processado';
        message =
          'Campos vazios foram complementados com sucesso. As alterações em informações pré-existentes foram enviadas para aprovação da diretoria.';
      } else {
        finalStatus = 'aguardando_aprovacao';
        message = 'Solicitação de alteração cadastral enviada com sucesso para aprovação da diretoria.';
      }

      // Se houver appliedChanges, aplica DIRETAMENTE no registro do membro oficial
      if (appliedCount > 0) {
        await txn.updateMembroRecord(targetMembro.id, {
          ...appliedChanges,
          updatedAt: now,
          lastUpdatedBy: 'public_auto_completion',
        });

        // Se telefone ou e-mail foram preenchidos pela primeira vez, atualiza chaves determinísticas HMAC
        if (appliedChanges.normalizedPhone) {
          const pKey = computePhoneDedupKey(centralId, appliedChanges.normalizedPhone, dedupSecret);
          await txn.setDedupKey(pKey, { membroId: targetMembro.id, type: 'phone', createdAt: now });
        }
        if (appliedChanges.email) {
          const eKey = computeEmailDedupKey(centralId, appliedChanges.email, dedupSecret);
          await txn.setDedupKey(eKey, { membroId: targetMembro.id, type: 'email', createdAt: now });
        }
      }

      // Cria a solicitação correspondente registrando appliedChanges e requestedChanges
      const submissionRecord: Omit<SolicitacaoCadastroMembro, 'id'> = {
        centralId,
        particularId: clean.particularId || targetMembro.particularId,
        conferenciaId: clean.conferenciaId || targetMembro.conferenciaId,
        fullName: clean.fullName || targetMembro.fullName,
        normalizedName: clean.normalizedName || targetMembro.normalizedName,
        type: clean.type || targetMembro.type,
        gender: clean.gender !== undefined ? clean.gender : targetMembro.gender,
        birthDate: clean.birthDate !== undefined ? clean.birthDate : targetMembro.birthDate,
        cpf: clean.cpf !== undefined ? clean.cpf : targetMembro.cpf,
        profession: clean.profession !== undefined ? clean.profession : targetMembro.profession,
        addressStreet: clean.addressStreet !== undefined ? clean.addressStreet : targetMembro.addressStreet,
        addressNumber: clean.addressNumber !== undefined ? clean.addressNumber : targetMembro.addressNumber,
        addressComplement: clean.addressComplement !== undefined ? clean.addressComplement : targetMembro.addressComplement,
        addressNeighborhood: clean.addressNeighborhood !== undefined ? clean.addressNeighborhood : targetMembro.addressNeighborhood,
        addressCity: clean.addressCity !== undefined ? clean.addressCity : targetMembro.addressCity,
        addressState: clean.addressState !== undefined ? clean.addressState : targetMembro.addressState,
        addressZip: clean.addressZip !== undefined ? clean.addressZip : targetMembro.addressZip,
        fullAddress: clean.fullAddress !== undefined ? clean.fullAddress : targetMembro.fullAddress,
        phone: clean.phone || targetMembro.phone,
        normalizedPhone: clean.normalizedPhone || targetMembro.normalizedPhone,
        phoneResidential: clean.phoneResidential !== undefined ? clean.phoneResidential : targetMembro.phoneResidential,
        phoneCommercial: clean.phoneCommercial !== undefined ? clean.phoneCommercial : targetMembro.phoneCommercial,
        email: clean.email !== undefined ? clean.email : targetMembro.email,
        admissionDate: clean.admissionDate !== undefined ? clean.admissionDate : targetMembro.admissionDate,
        acclamationDate: clean.acclamationDate !== undefined ? clean.acclamationDate : targetMembro.acclamationDate,
        proclamationDate: clean.proclamationDate !== undefined ? clean.proclamationDate : targetMembro.proclamationDate,
        isThirdPartySubmission: clean.isThirdPartySubmission,
        representativeName: clean.representativeName,
        consent: {
          accepted: true,
          acceptedAt: now,
          termVersion: clean.termVersion,
          ipHash,
          userAgentSnippet: meta?.userAgent ? meta.userAgent.substring(0, 100) : undefined,
          isThirdParty: clean.isThirdPartySubmission,
          representativeName: clean.representativeName,
        },
        status: finalStatus,
        tipo: finalStatus === 'aguardando_aprovacao' ? 'atualizacao_cadastral' : 'complementacao_cadastro',
        targetMembroId: targetMembro.id,
        membroId: targetMembro.id,
        appliedChanges,
        requestedChanges,
        requestId,
        submittedAt: now,
        reviewedAt: finalStatus === 'processado_automaticamente' ? now : undefined,
        reviewedBy: finalStatus === 'processado_automaticamente' ? 'sistema_automatico' : undefined,
      };

      const savedSub = await txn.createSubmission(submissionRecord);

      await txn.saveAuditLog({
        entityType: 'membro_ssvp',
        entityId: targetMembro.id,
        action: 'update',
        changedBy: 'public_form',
        timestamp: now,
        notes: `Complementação cadastral: status=${finalStatus}`,
        changes: {
          applied: appliedChanges,
          requested: requestedChanges,
        },
        submissionId: savedSub.id,
      });

      const resultPayload = {
        submissionId: savedSub.id,
        status: finalStatus,
        appliedChanges,
        requestedChanges,
        message,
      };

      await txn.saveRequestId(requestId, resultPayload);

      return {
        success: true,
        data: resultPayload,
      };
    }

    // Se o alvo for uma solicitação pendente anterior:
    const newSubmissionRecord: Omit<SolicitacaoCadastroMembro, 'id'> = {
      centralId,
      particularId: clean.particularId || targetSubmission.particularId,
      conferenciaId: clean.conferenciaId || targetSubmission.conferenciaId,
      fullName: clean.fullName || targetSubmission.fullName,
      normalizedName: clean.normalizedName || targetSubmission.normalizedName,
      type: clean.type || targetSubmission.type,
      phone: clean.phone || targetSubmission.phone,
      normalizedPhone: clean.normalizedPhone || targetSubmission.normalizedPhone,
      email: clean.email !== undefined ? clean.email : targetSubmission.email,
      birthDate: clean.birthDate !== undefined ? clean.birthDate : targetSubmission.birthDate,
      admissionDate: clean.admissionDate !== undefined ? clean.admissionDate : targetSubmission.admissionDate,
      acclamationDate: clean.acclamationDate !== undefined ? clean.acclamationDate : targetSubmission.acclamationDate,
      proclamationDate: clean.proclamationDate !== undefined ? clean.proclamationDate : targetSubmission.proclamationDate,
      isThirdPartySubmission: clean.isThirdPartySubmission,
      representativeName: clean.representativeName,
      consent: {
        accepted: true,
        acceptedAt: now,
        termVersion: clean.termVersion,
        ipHash,
        userAgentSnippet: meta?.userAgent ? meta.userAgent.substring(0, 100) : undefined,
        isThirdParty: clean.isThirdPartySubmission,
        representativeName: clean.representativeName,
      },
      status: 'aguardando_aprovacao',
      tipo: 'complementacao_cadastro',
      targetSubmissionId: targetSubmission.id,
      requestedChanges: clean,
      requestId,
      submittedAt: now,
    };

    const saved = await txn.createSubmission(newSubmissionRecord);

    const resultPayload = {
      submissionId: saved.id,
      status: 'aguardando_aprovacao' as const,
      appliedChanges: {},
      requestedChanges: clean,
      message: 'Complementação enviada com sucesso! As alterações serão analisadas pela diretoria.',
    };

    await txn.saveRequestId(requestId, resultPayload);

    return {
      success: true,
      data: resultPayload,
    };
  };

  try {
    if (repo.executeTransaction) {
      return await repo.executeTransaction(runner);
    }
    const adapter = createFallbackTransactionAdapter(repo);
    return await runner(adapter);
  } catch (err: any) {
    console.error('Erro ao submeter complementação cadastral:', err);
    return {
      success: false,
      error: 'Erro ao processar solicitação de complementação. Tente novamente mais tarde.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 7. Listar Solicitações de Cadastro do Conselho Central.
 */
export async function listCentralMemberSubmissions(
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository,
  options?: ListSubmissionsOptions
): Promise<PublicRegistrationServiceResult<SolicitacaoCadastroMembro[]>> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const list = await repo.listSubmissions(centralId, options);
    return {
      success: true,
      data: list,
    };
  } catch (err: any) {
    console.error('Erro ao listar solicitações de cadastro:', err);
    return {
      success: false,
      error: 'Falha ao buscar solicitações de cadastro.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 8. Checar Possíveis Duplicidades de Cadastro.
 */
export async function checkSubmissionDuplicates(
  centralId: string,
  normalizedName: string,
  normalizedPhone: string,
  email: string | undefined,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository
): Promise<
  PublicRegistrationServiceResult<
    Array<{ id: string; fullName: string; conferenciaId: string; conferenciaName?: string; phone: string; email?: string }>
  >
> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const duplicates = await repo.findExistingMembers(centralId, normalizedName, normalizedPhone, email);
    return {
      success: true,
      data: duplicates,
    };
  } catch (err: any) {
    console.error('Erro ao verificar duplicidades:', err);
    return {
      success: false,
      error: 'Falha ao verificar duplicidades.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 9. Aprovação de Solicitação com atuação estrita em requestedChanges (sem reaplicar appliedChanges).
 */
export async function approveMemberSubmission(
  submissionId: string,
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository,
  correctedData?: Partial<SolicitacaoCadastroMembro>
): Promise<PublicRegistrationServiceResult<{ submission: SolicitacaoCadastroMembro; membroId: string }>> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  let dedupSecret: string;
  try {
    dedupSecret = getDedupHmacSecret();
  } catch (configErr: any) {
    console.error('ERRO DE SEGURANÇA NO BACKEND:', configErr.message);
    return {
      success: false,
      error: 'Configuração de segurança do servidor incompleta. Operação abortada.',
      code: 'CONFIG_ERROR',
    };
  }

  try {
    const existing = await repo.getSubmissionById(submissionId);
    if (!existing || existing.centralId !== centralId) {
      return {
        success: false,
        error: 'Solicitação de cadastro não encontrada.',
        code: 'SUBMISSION_NOT_FOUND',
      };
    }

    if (existing.status === 'aprovado' || existing.status === 'recusado' || existing.status === 'processado_automaticamente') {
      return {
        success: false,
        error: `Esta solicitação já foi processada ou finalizada (status: ${existing.status}).`,
        code: 'ALREADY_PROCESSED',
      };
    }

    const now = new Date().toISOString();

    // CENÁRIO 1: Solicitação referente a membro oficial existente (atualização ou complementação parcial)
    if (existing.targetMembroId) {
      const targetMembro = repo.getMembroById ? await repo.getMembroById(existing.targetMembroId) : null;
      if (!targetMembro) {
        return {
          success: false,
          error: 'Membro alvo original não foi localizado para aplicação da alteração.',
          code: 'MEMBER_NOT_FOUND',
        };
      }

      // Atua SOMENTE em requestedChanges ou correções fornecidas pelo moderador (NUNCA reaplica appliedChanges)
      const changesToApply = correctedData?.requestedChanges || existing.requestedChanges || {};
      const updates: any = {
        ...changesToApply,
        updatedAt: now,
        lastUpdatedBy: authContext.userId || 'system',
      };

      if (correctedData?.fullName) {
        updates.fullName = correctedData.fullName.trim();
        updates.normalizedName = correctedData.fullName.trim().toUpperCase();
      }
      if (correctedData?.phone) {
        updates.phone = correctedData.phone.trim();
        updates.normalizedPhone = correctedData.phone.replace(/\D/g, '').trim();
      }
      if (correctedData?.email !== undefined) {
        updates.email = correctedData.email ? correctedData.email.trim() : undefined;
      }
      if (correctedData?.type) {
        updates.type = correctedData.type;
      }

      if (repo.updateMembroRecord) {
        await repo.updateMembroRecord(existing.targetMembroId, updates);
      }

      // Atualiza chaves HMAC se telefone ou e-mail foram modificados
      if (updates.normalizedPhone && repo.saveDedupKeyRecord) {
        const pKey = computePhoneDedupKey(centralId, updates.normalizedPhone, dedupSecret);
        await repo.saveDedupKeyRecord(pKey, { membroId: existing.targetMembroId, type: 'phone', createdAt: now });
      }
      if (updates.email && repo.saveDedupKeyRecord) {
        const eKey = computeEmailDedupKey(centralId, updates.email, dedupSecret);
        await repo.saveDedupKeyRecord(eKey, { membroId: existing.targetMembroId, type: 'email', createdAt: now });
      }

      if (repo.saveAuditLog) {
        await repo.saveAuditLog({
          entityType: 'membro_ssvp',
          entityId: existing.targetMembroId,
          action: 'atualizacao_cadastral_aprovada',
          changedBy: authContext.userId || 'system',
          changes: {
            before: targetMembro,
            appliedRequestedChanges: updates,
          },
          submissionId: existing.id,
          timestamp: now,
        });
      }

      const updatedSubmission = await repo.updateSubmission(existing.id, {
        status: 'aprovado',
        reviewedAt: now,
        reviewedBy: authContext.userId || 'system',
        membroId: existing.targetMembroId,
      });

      return {
        success: true,
        data: {
          submission: updatedSubmission,
          membroId: existing.targetMembroId,
        },
      };
    }

    // CENÁRIO 1.5: Solicitação de complementação vinculada a uma submissão pendente
    if (existing.targetSubmissionId) {
      const origSub = await repo.getSubmissionById(existing.targetSubmissionId);
      if (origSub) {
        if (origSub.membroId) {
          const targetMembro = repo.getMembroById ? await repo.getMembroById(origSub.membroId) : null;
          const changesToApply = correctedData?.requestedChanges || existing.requestedChanges || {};
          const updates: any = {
            ...changesToApply,
            updatedAt: now,
            lastUpdatedBy: authContext.userId || 'system',
          };
          if (repo.updateMembroRecord && targetMembro) {
            await repo.updateMembroRecord(origSub.membroId, updates);
          }
          const updatedSubmission = await repo.updateSubmission(existing.id, {
            status: 'aprovado',
            reviewedAt: now,
            reviewedBy: authContext.userId || 'system',
            membroId: origSub.membroId,
          });
          return {
            success: true,
            data: {
              submission: updatedSubmission,
              membroId: origSub.membroId,
            },
          };
        } else {
          const mergedData: any = {
            ...origSub,
            ...(existing.requestedChanges || {}),
            ...(correctedData?.requestedChanges || {}),
          };

          const birthValidation = validateAndNormalizeBirthDate(mergedData.birthDate, { required: true });
          if (!birthValidation.valid) {
            return {
              success: false,
              error: birthValidation.error || 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
              code: 'INVALID_PAYLOAD',
            };
          }

          const newMembroPayload = {
            centralId,
            particularId: mergedData.particularId,
            conferenciaId: mergedData.conferenciaId,
            fullName: mergedData.fullName,
            normalizedName: mergedData.normalizedName || mergedData.fullName.toUpperCase(),
            type: mergedData.type || 'confrade',
            phone: mergedData.phone,
            normalizedPhone: mergedData.normalizedPhone || (mergedData.phone ? mergedData.phone.replace(/\D/g, '') : undefined),
            email: mergedData.email,
            birthDate: birthValidation.normalizedDate,
            admissionDate: mergedData.admissionDate,
            acclamationDate: mergedData.acclamationDate,
            proclamationDate: mergedData.proclamationDate,
            status: 'ativo',
            origin: 'autocadastro_publico_aprovado',
            originSubmissionId: origSub.id,
            createdBy: authContext.userId || 'system',
            createdAt: now,
            updatedAt: now,
          };
          const createdMembro = await repo.createMembroRecord(newMembroPayload);
          if (repo.saveDedupKeyRecord) {
            const dedupKeys = computeAllDedupKeys({
              centralId,
              conferenciaId: mergedData.conferenciaId,
              fullName: mergedData.fullName,
              phone: mergedData.phone,
              email: mergedData.email,
              customSecret: dedupSecret,
            });
            await Promise.all([
              repo.saveDedupKeyRecord(dedupKeys.phoneKey, { membroId: createdMembro.id, type: 'phone', createdAt: now }),
              repo.saveDedupKeyRecord(dedupKeys.nameConfKey, { membroId: createdMembro.id, type: 'name_conf', createdAt: now }),
              dedupKeys.emailKey
                ? repo.saveDedupKeyRecord(dedupKeys.emailKey, { membroId: createdMembro.id, type: 'email', createdAt: now })
                : Promise.resolve(),
            ]);
          }
          await repo.updateSubmission(origSub.id, {
            status: 'aprovado',
            reviewedAt: now,
            reviewedBy: authContext.userId || 'system',
            membroId: createdMembro.id,
          });
          const updatedComp = await repo.updateSubmission(existing.id, {
            status: 'aprovado',
            reviewedAt: now,
            reviewedBy: authContext.userId || 'system',
            membroId: createdMembro.id,
          });
          return {
            success: true,
            data: {
              submission: updatedComp,
              membroId: createdMembro.id,
            },
          };
        }
      }
    }

    // CENÁRIO 2: Novo Cadastro (aguardando_aprovacao ou aguardando_revisao_duplicidade)
    const finalParticularId = (correctedData?.particularId || existing.particularId).trim();
    const finalConferenciaId = (correctedData?.conferenciaId || existing.conferenciaId).trim();
    const finalFullName = (correctedData?.fullName || existing.fullName).trim();
    const finalType = correctedData?.type || existing.type;
    const finalGender = correctedData?.gender !== undefined ? correctedData.gender : existing.gender;
    const finalCpf = correctedData?.cpf !== undefined ? correctedData.cpf : existing.cpf;
    const finalProfession = correctedData?.profession !== undefined ? correctedData.profession : existing.profession;
    const finalAddressStreet = correctedData?.addressStreet !== undefined ? correctedData.addressStreet : existing.addressStreet;
    const finalAddressNumber = correctedData?.addressNumber !== undefined ? correctedData.addressNumber : existing.addressNumber;
    const finalAddressComplement = correctedData?.addressComplement !== undefined ? correctedData.addressComplement : existing.addressComplement;
    const finalAddressNeighborhood = correctedData?.addressNeighborhood !== undefined ? correctedData.addressNeighborhood : existing.addressNeighborhood;
    const finalAddressCity = correctedData?.addressCity !== undefined ? correctedData.addressCity : existing.addressCity;
    const finalAddressState = correctedData?.addressState !== undefined ? correctedData.addressState : existing.addressState;
    const finalAddressZip = correctedData?.addressZip !== undefined ? correctedData.addressZip : existing.addressZip;
    const finalFullAddress = correctedData?.fullAddress !== undefined ? correctedData.fullAddress : existing.fullAddress;
    const finalPhone = (correctedData?.phone || existing.phone).trim();
    const finalPhoneResidential = correctedData?.phoneResidential !== undefined ? correctedData.phoneResidential : existing.phoneResidential;
    const finalPhoneCommercial = correctedData?.phoneCommercial !== undefined ? correctedData.phoneCommercial : existing.phoneCommercial;
    const finalEmail = correctedData?.email !== undefined ? (correctedData.email?.trim() || undefined) : existing.email;
    const finalBirthDate = correctedData?.birthDate || existing.birthDate;
    const finalAdmissionDate = correctedData?.admissionDate || existing.admissionDate;
    const finalAcclamationDate = correctedData?.acclamationDate || existing.acclamationDate;
    const finalProclamationDate = correctedData?.proclamationDate || existing.proclamationDate;

    const validation = validatePublicMemberSubmissionInput({
      particularId: finalParticularId,
      conferenciaId: finalConferenciaId,
      fullName: finalFullName,
      type: finalType,
      gender: finalGender,
      cpf: finalCpf,
      profession: finalProfession,
      addressStreet: finalAddressStreet,
      addressNumber: finalAddressNumber,
      addressComplement: finalAddressComplement,
      addressNeighborhood: finalAddressNeighborhood,
      addressCity: finalAddressCity,
      addressState: finalAddressState,
      addressZip: finalAddressZip,
      fullAddress: finalFullAddress,
      phone: finalPhone,
      phoneResidential: finalPhoneResidential,
      phoneCommercial: finalPhoneCommercial,
      email: finalEmail,
      birthDate: finalBirthDate,
      admissionDate: finalAdmissionDate,
      acclamationDate: finalAcclamationDate,
      proclamationDate: finalProclamationDate,
      consentAccepted: true,
      termVersion: existing.consent.termVersion,
    });

    if (!validation.valid || !validation.cleanData) {
      return {
        success: false,
        error: validation.errors[0] || 'Dados de cadastro inválidos.',
        code: 'INVALID_PAYLOAD',
        errors: validation.errors,
      };
    }

    const clean = validation.cleanData;

    const particular = await repo.getParticularById(clean.particularId);
    if (!particular || particular.centralId !== centralId) {
      return {
        success: false,
        error: 'Conselho Particular inválido ou não pertencente a este Conselho Central.',
        code: 'PARTICULAR_NOT_FOUND',
      };
    }

    const conferencia = await repo.getConferenciaById(clean.conferenciaId);
    if (!conferencia || conferencia.centralId !== centralId) {
      return {
        success: false,
        error: 'Conferência inválida ou não pertencente a este Conselho Central.',
        code: 'CONFERENCIA_NOT_FOUND',
      };
    }

    if (conferencia.particularId !== clean.particularId) {
      return {
        success: false,
        error: 'A Conferência selecionada não pertence ao Conselho Particular informado.',
        code: 'HIERARCHY_MISMATCH',
      };
    }

    const newMembroPayload = {
      centralId,
      particularId: clean.particularId,
      conferenciaId: clean.conferenciaId,
      fullName: clean.fullName,
      normalizedName: clean.normalizedName,
      type: clean.type,
      gender: clean.gender,
      birthDate: clean.birthDate,
      cpf: clean.cpf,
      profession: clean.profession,
      addressStreet: clean.addressStreet,
      addressNumber: clean.addressNumber,
      addressComplement: clean.addressComplement,
      addressNeighborhood: clean.addressNeighborhood,
      addressCity: clean.addressCity,
      addressState: clean.addressState,
      addressZip: clean.addressZip,
      fullAddress: clean.fullAddress,
      phone: clean.phone,
      normalizedPhone: clean.normalizedPhone,
      phoneResidential: clean.phoneResidential,
      phoneCommercial: clean.phoneCommercial,
      email: clean.email,
      admissionDate: clean.admissionDate,
      acclamationDate: clean.acclamationDate,
      proclamationDate: clean.proclamationDate,
      status: 'ativo',
      origin: 'autocadastro_publico_aprovado',
      originSubmissionId: existing.id,
      createdBy: authContext.userId || 'system',
      createdAt: now,
      updatedAt: now,
    };

    const createdMembro = await repo.createMembroRecord(newMembroPayload);

    // Gravação das chaves determinísticas HMAC
    if (repo.saveDedupKeyRecord) {
      const dedupKeys = computeAllDedupKeys({
        centralId,
        conferenciaId: clean.conferenciaId,
        fullName: clean.fullName,
        phone: clean.phone,
        email: clean.email,
        customSecret: dedupSecret,
      });

      await Promise.all([
        repo.saveDedupKeyRecord(dedupKeys.phoneKey, { membroId: createdMembro.id, type: 'phone', createdAt: now }),
        repo.saveDedupKeyRecord(dedupKeys.nameConfKey, { membroId: createdMembro.id, type: 'name_conf', createdAt: now }),
        dedupKeys.emailKey
          ? repo.saveDedupKeyRecord(dedupKeys.emailKey, { membroId: createdMembro.id, type: 'email', createdAt: now })
          : Promise.resolve(),
      ]);
    }

    const updatedSubmission = await repo.updateSubmission(existing.id, {
      particularId: clean.particularId,
      conferenciaId: clean.conferenciaId,
      fullName: clean.fullName,
      normalizedName: clean.normalizedName,
      type: clean.type,
      gender: clean.gender,
      birthDate: clean.birthDate,
      cpf: clean.cpf,
      profession: clean.profession,
      addressStreet: clean.addressStreet,
      addressNumber: clean.addressNumber,
      addressComplement: clean.addressComplement,
      addressNeighborhood: clean.addressNeighborhood,
      addressCity: clean.addressCity,
      addressState: clean.addressState,
      addressZip: clean.addressZip,
      fullAddress: clean.fullAddress,
      phone: clean.phone,
      normalizedPhone: clean.normalizedPhone,
      phoneResidential: clean.phoneResidential,
      phoneCommercial: clean.phoneCommercial,
      email: clean.email,
      admissionDate: clean.admissionDate,
      acclamationDate: clean.acclamationDate,
      proclamationDate: clean.proclamationDate,
      status: 'aprovado',
      reviewedAt: now,
      reviewedBy: authContext.userId || 'system',
      membroId: createdMembro.id,
    });

    return {
      success: true,
      data: {
        submission: updatedSubmission,
        membroId: createdMembro.id,
      },
    };
  } catch (err: any) {
    console.error('Erro ao aprovar solicitação de cadastro:', err);
    return {
      success: false,
      error: 'Falha ao processar aprovação do cadastro.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 10. Recusa a solicitação de autocadastro, exigindo motivo e preservando o registro histórico.
 */
export async function rejectMemberSubmission(
  submissionId: string,
  centralId: string,
  rejectionReason: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository
): Promise<PublicRegistrationServiceResult<SolicitacaoCadastroMembro>> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    return {
      success: false,
      error: 'É obrigatório informar o motivo da recusa.',
      code: 'MISSING_REJECTION_REASON',
    };
  }

  try {
    const existing = await repo.getSubmissionById(submissionId);
    if (!existing || existing.centralId !== centralId) {
      return {
        success: false,
        error: 'Solicitação de cadastro não encontrada.',
        code: 'SUBMISSION_NOT_FOUND',
      };
    }

    if (existing.status === 'aprovado' || existing.status === 'recusado') {
      return {
        success: false,
        error: `Esta solicitação já foi ${existing.status === 'aprovado' ? 'aprovada' : 'recusada'}.`,
        code: 'ALREADY_PROCESSED',
      };
    }

    const now = new Date().toISOString();
    const updated = await repo.updateSubmission(existing.id, {
      status: 'recusado',
      rejectionReason: rejectionReason.trim(),
      reviewedAt: now,
      reviewedBy: authContext.userId || 'system',
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err: any) {
    console.error('Erro ao recusar solicitação de cadastro:', err);
    return {
      success: false,
      error: 'Falha ao processar recusa da solicitação.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 11. Rotina de Dry-Run Idempotente e Estritamente Read-Only de Solicitações Legadas.
 * Não altera nada no banco de dados.
 * Não expõe dados pessoais (PII) no retorno.
 */
export async function runLegacySubmissionsDryRun(
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository
): Promise<
  PublicRegistrationServiceResult<{
    totalAnalyzed: number;
    eligibleForAutoCreation: number;
    forwardedToDuplicityReview: number;
    candidateSubmissionIds: string[];
    duplicityReviewSubmissionIds: string[];
    dryRun: true;
  }>
> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  let dedupSecret: string;
  try {
    dedupSecret = getDedupHmacSecret();
  } catch (configErr: any) {
    console.error('ERRO DE SEGURANÇA NO BACKEND:', configErr.message);
    return {
      success: false,
      error: 'Configuração de segurança do servidor incompleta para avaliação do dry-run.',
      code: 'CONFIG_ERROR',
    };
  }

  try {
    const pendingList = await repo.listSubmissions(centralId, {
      status: 'aguardando_aprovacao',
    });

    const newRegistrationList = pendingList.filter((s) => !s.tipo || s.tipo === 'novo_cadastro');

    let eligibleForAutoCreation = 0;
    let forwardedToDuplicityReview = 0;
    const candidateSubmissionIds: string[] = [];
    const duplicityReviewSubmissionIds: string[] = [];

    for (const sub of newRegistrationList) {
      if (!sub.conferenciaId || !sub.fullName || !sub.phone) {
        forwardedToDuplicityReview++;
        duplicityReviewSubmissionIds.push(sub.id);
        continue;
      }

      const dedupKeys = computeAllDedupKeys({
        centralId,
        conferenciaId: sub.conferenciaId,
        fullName: sub.fullName,
        phone: sub.phone,
        email: sub.email,
        customSecret: dedupSecret,
      });

      const [phoneSnap, nameConfSnap, emailSnap, existingMatches] = await Promise.all([
        repo.getDedupKeyRecord ? repo.getDedupKeyRecord(dedupKeys.phoneKey) : Promise.resolve(null),
        repo.getDedupKeyRecord ? repo.getDedupKeyRecord(dedupKeys.nameConfKey) : Promise.resolve(null),
        dedupKeys.emailKey && repo.getDedupKeyRecord
          ? repo.getDedupKeyRecord(dedupKeys.emailKey)
          : Promise.resolve(null),
        repo.findExistingMembers(centralId, sub.normalizedName, sub.normalizedPhone, sub.email),
      ]);

      const hasKeyCollision = Boolean(phoneSnap || nameConfSnap || emailSnap);
      const hasMemberMatch = existingMatches && existingMatches.length > 0;

      if (hasKeyCollision || hasMemberMatch) {
        forwardedToDuplicityReview++;
        duplicityReviewSubmissionIds.push(sub.id);
      } else {
        eligibleForAutoCreation++;
        candidateSubmissionIds.push(sub.id);
      }
    }

    return {
      success: true,
      data: {
        totalAnalyzed: newRegistrationList.length,
        eligibleForAutoCreation,
        forwardedToDuplicityReview,
        candidateSubmissionIds,
        duplicityReviewSubmissionIds,
        dryRun: true,
      },
    };
  } catch (err: any) {
    console.error('Erro ao executar dry-run de solicitações legadas:', err);
    return {
      success: false,
      error: 'Falha ao executar análise de dry-run.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 12. Confirma o cadastro de uma solicitação e garante seu envio/criação/atualização
 * direta na respectiva Conferência, recalculando contadores e vinculando o membro definitivo.
 * Permite ao moderador/administrador forçar o envio direto à Conferência para solicitações
 * pendentes, em duplicidade ou já pré-processadas.
 */
export async function confirmAndSendMemberSubmission(
  submissionId: string,
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository,
  overrideData?: any
): Promise<
  PublicRegistrationServiceResult<{
    submission: SolicitacaoCadastroMembro;
    membroId: string;
    conferenciaId: string;
    actionTaken: 'created' | 'updated';
  }>
> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  let dedupSecret: string;
  try {
    dedupSecret = getDedupHmacSecret();
  } catch (configErr: any) {
    console.error('ERRO DE SEGURANÇA NO BACKEND:', configErr?.message);
    return {
      success: false,
      error: 'Configuração de segurança do servidor incompleta. Operação abortada.',
      code: 'CONFIG_ERROR',
    };
  }

  try {
    const existing = await repo.getSubmissionById(submissionId);
    if (!existing || existing.centralId !== centralId) {
      return {
        success: false,
        error: 'Solicitação de cadastro não encontrada.',
        code: 'SUBMISSION_NOT_FOUND',
      };
    }

    const now = new Date().toISOString();
    const finalParticularId = (overrideData?.particularId || existing.particularId || '').trim();
    const finalConferenciaId = (overrideData?.conferenciaId || existing.conferenciaId || '').trim();
    const finalFullName = (overrideData?.fullName || existing.fullName || '').trim();
    const finalType = overrideData?.type || existing.type || 'confrade';
    const finalGender = overrideData?.gender !== undefined ? overrideData.gender : existing.gender;
    const finalCpf = overrideData?.cpf !== undefined ? overrideData.cpf : existing.cpf;
    const finalProfession = overrideData?.profession !== undefined ? overrideData.profession : existing.profession;
    const finalAddressStreet = overrideData?.addressStreet !== undefined ? overrideData.addressStreet : existing.addressStreet;
    const finalAddressNumber = overrideData?.addressNumber !== undefined ? overrideData.addressNumber : existing.addressNumber;
    const finalAddressComplement = overrideData?.addressComplement !== undefined ? overrideData.addressComplement : existing.addressComplement;
    const finalAddressNeighborhood = overrideData?.addressNeighborhood !== undefined ? overrideData.addressNeighborhood : existing.addressNeighborhood;
    const finalAddressCity = overrideData?.addressCity !== undefined ? overrideData.addressCity : existing.addressCity;
    const finalAddressState = overrideData?.addressState !== undefined ? overrideData.addressState : existing.addressState;
    const finalAddressZip = overrideData?.addressZip !== undefined ? overrideData.addressZip : existing.addressZip;
    const finalFullAddress = overrideData?.fullAddress !== undefined ? overrideData.fullAddress : existing.fullAddress;
    const finalPhone = (overrideData?.phone || existing.phone || '').trim();
    const finalPhoneResidential = overrideData?.phoneResidential !== undefined ? overrideData.phoneResidential : existing.phoneResidential;
    const finalPhoneCommercial = overrideData?.phoneCommercial !== undefined ? overrideData.phoneCommercial : existing.phoneCommercial;
    const finalEmail = overrideData?.email !== undefined ? (overrideData.email?.trim() || undefined) : existing.email;
    const finalBirthDate = overrideData?.birthDate || existing.birthDate;
    const finalAdmissionDate = overrideData?.admissionDate || existing.admissionDate;
    const finalAcclamationDate = overrideData?.acclamationDate || existing.acclamationDate;
    const finalProclamationDate = overrideData?.proclamationDate || existing.proclamationDate;

    if (!finalFullName || !finalConferenciaId) {
      return {
        success: false,
        error: 'Nome do membro e Conferência de destino são obrigatórios.',
        code: 'INVALID_PAYLOAD',
      };
    }

    const particular = finalParticularId ? await repo.getParticularById(finalParticularId) : null;
    const conferencia = await repo.getConferenciaById(finalConferenciaId);
    if (!conferencia || conferencia.centralId !== centralId) {
      return {
        success: false,
        error: 'Conferência inválida ou não pertencente a este Conselho Central.',
        code: 'CONFERENCIA_NOT_FOUND',
      };
    }

    const resolvedParticularId = finalParticularId || conferencia.particularId;
    const normalizedName = finalFullName.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const normalizedPhone = finalPhone.replace(/\D/g, '').trim();

    let targetMembroId = existing.membroId || existing.targetMembroId;
    let actionTaken: 'created' | 'updated' = 'created';

    if (targetMembroId && repo.getMembroById) {
      const existingMembro = await repo.getMembroById(targetMembroId);
      if (existingMembro) {
        actionTaken = 'updated';
        if (repo.updateMembroRecord) {
          await repo.updateMembroRecord(targetMembroId, {
            centralId,
            particularId: resolvedParticularId,
            conferenciaId: finalConferenciaId,
            fullName: finalFullName,
            normalizedName,
            type: finalType,
            gender: finalGender,
            birthDate: finalBirthDate,
            cpf: finalCpf,
            profession: finalProfession,
            addressStreet: finalAddressStreet,
            addressNumber: finalAddressNumber,
            addressComplement: finalAddressComplement,
            addressNeighborhood: finalAddressNeighborhood,
            addressCity: finalAddressCity,
            addressState: finalAddressState,
            addressZip: finalAddressZip,
            fullAddress: finalFullAddress,
            phone: finalPhone,
            normalizedPhone,
            phoneResidential: finalPhoneResidential,
            phoneCommercial: finalPhoneCommercial,
            email: finalEmail,
            admissionDate: finalAdmissionDate,
            acclamationDate: finalAcclamationDate,
            proclamationDate: finalProclamationDate,
            status: 'ativo',
            updatedAt: now,
            lastUpdatedBy: authContext.userId || 'admin',
          });
        }
      } else {
        targetMembroId = undefined;
      }
    }

    if (!targetMembroId) {
      actionTaken = 'created';
      const birthValidation = validateAndNormalizeBirthDate(finalBirthDate, { required: true });
      if (!birthValidation.valid) {
        return {
          success: false,
          error: birthValidation.error || 'Informe uma data de nascimento válida para concluir o cadastro e criar o acesso.',
          code: 'INVALID_PAYLOAD',
        };
      }

      const newMembroPayload = {
        centralId,
        particularId: resolvedParticularId,
        conferenciaId: finalConferenciaId,
        fullName: finalFullName,
        normalizedName,
        type: finalType,
        gender: finalGender,
        birthDate: birthValidation.normalizedDate,
        cpf: finalCpf,
        profession: finalProfession,
        addressStreet: finalAddressStreet,
        addressNumber: finalAddressNumber,
        addressComplement: finalAddressComplement,
        addressNeighborhood: finalAddressNeighborhood,
        addressCity: finalAddressCity,
        addressState: finalAddressState,
        addressZip: finalAddressZip,
        fullAddress: finalFullAddress,
        phone: finalPhone,
        normalizedPhone,
        phoneResidential: finalPhoneResidential,
        phoneCommercial: finalPhoneCommercial,
        email: finalEmail,
        admissionDate: finalAdmissionDate,
        acclamationDate: finalAcclamationDate,
        proclamationDate: finalProclamationDate,
        status: 'ativo',
        origin: 'autocadastro_publico_confirmado',
        originSubmissionId: existing.id,
        createdBy: authContext.userId || 'admin',
        createdAt: now,
        updatedAt: now,
      };

      const createdMembro = await repo.createMembroRecord(newMembroPayload);
      targetMembroId = createdMembro.id;

      if (repo.saveDedupKeyRecord) {
        const dedupKeys = computeAllDedupKeys({
          centralId,
          conferenciaId: finalConferenciaId,
          fullName: finalFullName,
          phone: finalPhone,
          email: finalEmail,
          customSecret: dedupSecret,
        });

        await Promise.all([
          repo.saveDedupKeyRecord(dedupKeys.phoneKey, { membroId: targetMembroId, type: 'phone', createdAt: now }),
          repo.saveDedupKeyRecord(dedupKeys.nameConfKey, { membroId: targetMembroId, type: 'name_conf', createdAt: now }),
          dedupKeys.emailKey
            ? repo.saveDedupKeyRecord(dedupKeys.emailKey, { membroId: targetMembroId, type: 'email', createdAt: now })
            : Promise.resolve(),
        ]);
      }
    }

    // Atualiza a submissão com status de sucesso e vínculo definitivo ao membro
    const updatedSubmission = await repo.updateSubmission(existing.id, {
      particularId: resolvedParticularId,
      conferenciaId: finalConferenciaId,
      fullName: finalFullName,
      normalizedName,
      phone: finalPhone,
      normalizedPhone,
      email: finalEmail,
      status: 'processado_automaticamente',
      reviewedAt: now,
      reviewedBy: authContext.userId || 'admin',
      membroId: targetMembroId,
      duplicityReasons: [],
    });

    if (repo.saveAuditLog) {
      await repo.saveAuditLog({
        centralId,
        action: 'CONFIRM_SEND_MEMBER_SUBMISSION',
        userId: authContext.userId || 'admin',
        submissionId: existing.id,
        membroId: targetMembroId,
        conferenciaId: finalConferenciaId,
        actionTaken,
        timestamp: now,
      });
    }

    return {
      success: true,
      data: {
        submission: updatedSubmission,
        membroId: targetMembroId,
        conferenciaId: finalConferenciaId,
        actionTaken,
      },
    };
  } catch (err: any) {
    console.error('Erro ao confirmar e enviar membro para a conferência:', err);
    return {
      success: false,
      error: 'Falha ao confirmar cadastro e enviar para a Conferência.',
      code: 'STORAGE_ERROR',
    };
  }
}

/**
 * 13. Conciliação e Sincronização em Massa de Solicitações do Conselho Central.
 * Identifica solicitações que deveriam ter membros vinculados ou que precisam de conciliação
 * atômica com a Conferência de destino (incluindo recálculo de contadores).
 */
export async function reconcileAndSyncPendingSubmissions(
  centralId: string,
  authContext: ServiceAuthContext,
  repo: PublicRegistrationRepository,
  options?: { targetConferenciaId?: string }
): Promise<
  PublicRegistrationServiceResult<{
    totalEvaluated: number;
    syncedCount: number;
    alreadyLinkedCount: number;
    pendingReviewCount: number;
    conferenciasUpdated: string[];
    details: Array<{
      submissionId: string;
      fullName: string;
      conferenciaId: string;
      status: string;
      action: 'created_membro' | 'relinked' | 'skipped_duplicate_review' | 'already_active';
      membroId?: string;
    }>;
  }>
> {
  if (!authContext.allowed || authContext.validatedCentralId !== centralId) {
    return {
      success: false,
      error: 'Operação não autorizada para esta instituição.',
      code: 'UNAUTHORIZED',
    };
  }

  let dedupSecret: string;
  try {
    dedupSecret = getDedupHmacSecret();
  } catch (configErr: any) {
    console.error('ERRO DE SEGURANÇA NO BACKEND:', configErr?.message);
    return {
      success: false,
      error: 'Configuração de segurança do servidor incompleta. Operação abortada.',
      code: 'CONFIG_ERROR',
    };
  }

  try {
    const listOptions: any = {};
    if (options?.targetConferenciaId) {
      listOptions.conferenciaId = options.targetConferenciaId;
    }
    const allSubmissions = await repo.listSubmissions(centralId, listOptions);
    const now = new Date().toISOString();

    let syncedCount = 0;
    let alreadyLinkedCount = 0;
    let pendingReviewCount = 0;
    const conferenciasSet = new Set<string>();
    const details: any[] = [];

    for (const sub of allSubmissions) {
      if (!sub.conferenciaId || !sub.fullName) continue;

      conferenciasSet.add(sub.conferenciaId);

      // Caso 1: Solicitação com status 'processado_automaticamente' ou 'aprovado'
      if (sub.status === 'processado_automaticamente' || sub.status === 'aprovado') {
        let existingMembro = null;
        if (sub.membroId && repo.getMembroById) {
          existingMembro = await repo.getMembroById(sub.membroId);
        }

        if (existingMembro) {
          alreadyLinkedCount++;
          details.push({
            submissionId: sub.id,
            fullName: sub.fullName,
            conferenciaId: sub.conferenciaId,
            status: sub.status,
            action: 'already_active',
            membroId: existingMembro.id,
          });
          continue;
        }

        // Se tem status de processado mas não tem o membro criado ou o ID é inválido, cria agora atomicamente
        const birthValidation = validateAndNormalizeBirthDate(sub.birthDate, { required: true });
        if (!birthValidation.valid) {
          details.push({
            submissionId: sub.id,
            fullName: sub.fullName,
            conferenciaId: sub.conferenciaId,
            status: sub.status,
            action: 'skipped_missing_birth_date',
            error: 'Data de nascimento ausente ou inválida.',
          });
          continue;
        }

        const normalizedName = (sub.normalizedName || sub.fullName).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const normalizedPhone = sub.normalizedPhone || (sub.phone ? sub.phone.replace(/\D/g, '') : '');

        const newMembroPayload = {
          centralId,
          particularId: sub.particularId,
          conferenciaId: sub.conferenciaId,
          fullName: sub.fullName,
          normalizedName,
          type: sub.type || 'confrade',
          gender: sub.gender,
          birthDate: birthValidation.normalizedDate,
          cpf: sub.cpf,
          profession: sub.profession,
          addressStreet: sub.addressStreet,
          addressNumber: sub.addressNumber,
          addressComplement: sub.addressComplement,
          addressNeighborhood: sub.addressNeighborhood,
          addressCity: sub.addressCity,
          addressState: sub.addressState,
          addressZip: sub.addressZip,
          fullAddress: sub.fullAddress,
          phone: sub.phone,
          normalizedPhone,
          phoneResidential: sub.phoneResidential,
          phoneCommercial: sub.phoneCommercial,
          email: sub.email,
          admissionDate: sub.admissionDate,
          acclamationDate: sub.acclamationDate,
          proclamationDate: sub.proclamationDate,
          status: 'ativo',
          origin: 'autocadastro_publico_conciliado',
          originSubmissionId: sub.id,
          createdBy: authContext.userId || 'system_reconciliation',
          createdAt: sub.submittedAt || now,
          updatedAt: now,
        };

        const createdMembro = await repo.createMembroRecord(newMembroPayload);

        if (repo.saveDedupKeyRecord) {
          const dedupKeys = computeAllDedupKeys({
            centralId,
            conferenciaId: sub.conferenciaId,
            fullName: sub.fullName,
            phone: sub.phone,
            email: sub.email,
            customSecret: dedupSecret,
          });

          await Promise.all([
            repo.saveDedupKeyRecord(dedupKeys.phoneKey, { membroId: createdMembro.id, type: 'phone', createdAt: now }),
            repo.saveDedupKeyRecord(dedupKeys.nameConfKey, { membroId: createdMembro.id, type: 'name_conf', createdAt: now }),
            dedupKeys.emailKey
              ? repo.saveDedupKeyRecord(dedupKeys.emailKey, { membroId: createdMembro.id, type: 'email', createdAt: now })
              : Promise.resolve(),
          ]);
        }

        await repo.updateSubmission(sub.id, {
          membroId: createdMembro.id,
          reviewedAt: now,
          reviewedBy: authContext.userId || 'system_reconciliation',
        });

        syncedCount++;
        details.push({
          submissionId: sub.id,
          fullName: sub.fullName,
          conferenciaId: sub.conferenciaId,
          status: sub.status,
          action: 'created_membro',
          membroId: createdMembro.id,
        });
      } else if (sub.status === 'aguardando_revisao_duplicidade' || sub.status === 'aguardando_aprovacao') {
        pendingReviewCount++;
        details.push({
          submissionId: sub.id,
          fullName: sub.fullName,
          conferenciaId: sub.conferenciaId,
          status: sub.status,
          action: 'skipped_duplicate_review',
        });
      }
    }

    return {
      success: true,
      data: {
        totalEvaluated: allSubmissions.length,
        syncedCount,
        alreadyLinkedCount,
        pendingReviewCount,
        conferenciasUpdated: Array.from(conferenciasSet),
        details,
      },
    };
  } catch (err: any) {
    console.error('Erro na conciliação de solicitações de membros:', err);
    return {
      success: false,
      error: 'Falha ao conciliar solicitações de cadastro.',
      code: 'STORAGE_ERROR',
    };
  }
}

