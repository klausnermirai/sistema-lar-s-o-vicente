/**
 * Testes Unitários e de Integração: Formulário Público de Autocadastro de Membros SSVP (Backend)
 */

import {
  validatePublicMemberSubmissionInput,
  normalizeName,
  normalizePhone,
  CURRENT_LGPD_TERM_VERSION,
} from '../lib/public_member_registration_validator.ts';
import {
  generateOrRotateCentralPublicToken,
  revokeCentralPublicToken,
  getCentralPublicTokenConfig,
  getPublicHierarchyStructure,
  submitPublicMemberRegistration,
  listCentralMemberSubmissions,
  checkSubmissionDuplicates,
  approveMemberSubmission,
  confirmAndSendMemberSubmission,
  rejectMemberSubmission,
  PublicRegistrationRepository,
  checkAndIncrementRateLimit,
  resetRateLimiterForTesting,
} from '../lib/public_member_registration_service.ts';
import { buildPublicRegistrationUrl } from '../lib/hierarchy_api.ts';
import {
  ConselhoCentralPublicTokenConfig,
  SolicitacaoCadastroMembro,
  StandaloneConferencia,
  StandaloneConselhoParticular,
} from '../types.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

// Mock Repository em memória para testes isolados
class MockPublicRegistrationRepository implements PublicRegistrationRepository {
  public institutions: Map<string, { id: string; name: string }> = new Map();
  public tokens: Map<string, ConselhoCentralPublicTokenConfig> = new Map();
  public particulares: Map<string, StandaloneConselhoParticular> = new Map();
  public conferencias: Map<string, StandaloneConferencia> = new Map();
  public submissions: Map<string, SolicitacaoCadastroMembro> = new Map();
  public membros: Map<string, any> = new Map();
  public dedupKeys: Map<string, any> = new Map();
  public idempotencyStore: Map<string, any> = new Map();

  async getCentralTokenConfig(token: string): Promise<ConselhoCentralPublicTokenConfig | null> {
    for (const config of this.tokens.values()) {
      if (config.token === token) return config;
    }
    return null;
  }

  async getCentralTokenConfigByCentralId(centralId: string): Promise<ConselhoCentralPublicTokenConfig | null> {
    return this.tokens.get(centralId) || null;
  }

  async saveCentralTokenConfig(config: ConselhoCentralPublicTokenConfig): Promise<void> {
    this.tokens.set(config.centralId, config);
  }

  async getInstitution(centralId: string): Promise<{ id: string; name: string } | null> {
    return this.institutions.get(centralId) || null;
  }

  async listActiveParticulares(centralId: string): Promise<Array<{ id: string; name: string }>> {
    return Array.from(this.particulares.values())
      .filter((p) => p.centralId === centralId && p.status === 'ativo')
      .map((p) => ({ id: p.id, name: p.name }));
  }

  async listActiveConferencias(centralId: string): Promise<Array<{ id: string; particularId: string; name: string }>> {
    return Array.from(this.conferencias.values())
      .filter((c) => c.centralId === centralId && c.status === 'ativo')
      .map((c) => ({ id: c.id, particularId: c.particularId, name: c.name }));
  }

  async getParticularById(particularId: string): Promise<StandaloneConselhoParticular | null> {
    return this.particulares.get(particularId) || null;
  }

  async getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null> {
    return this.conferencias.get(conferenciaId) || null;
  }

  async findRecentPendingSubmission(
    conferenciaId: string,
    normalizedName: string,
    normalizedPhone: string
  ): Promise<SolicitacaoCadastroMembro | null> {
    for (const sub of this.submissions.values()) {
      if (
        sub.conferenciaId === conferenciaId &&
        (sub.status === 'aguardando_aprovacao' || sub.status === 'aguardando_revisao_duplicidade') &&
        (sub.normalizedName === normalizedName || (normalizedPhone && sub.normalizedPhone === normalizedPhone))
      ) {
        return sub;
      }
    }
    return null;
  }

  async createSubmission(submission: Omit<SolicitacaoCadastroMembro, 'id'> & { id?: string }): Promise<SolicitacaoCadastroMembro> {
    const id = submission.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const created: SolicitacaoCadastroMembro = {
      ...submission,
      id,
    };
    this.submissions.set(id, created);
    return created;
  }

  async getSubmissionById(id: string): Promise<SolicitacaoCadastroMembro | null> {
    return this.submissions.get(id) || null;
  }

  async listSubmissions(
    centralId: string,
    options?: { status?: any; particularId?: string; conferenciaId?: string }
  ): Promise<SolicitacaoCadastroMembro[]> {
    return Array.from(this.submissions.values()).filter((s) => {
      if (s.centralId !== centralId) return false;
      if (options?.status && options.status !== 'todos' && s.status !== options.status) return false;
      if (options?.particularId && s.particularId !== options.particularId) return false;
      if (options?.conferenciaId && s.conferenciaId !== options.conferenciaId) return false;
      return true;
    });
  }

  async updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>): Promise<SolicitacaoCadastroMembro> {
    const existing = this.submissions.get(id);
    if (!existing) throw new Error('Submission not found');
    const updated = { ...existing, ...updates };
    this.submissions.set(id, updated);
    return updated;
  }

  async findExistingMembers(
    centralId: string,
    normalizedName: string,
    normalizedPhone?: string,
    email?: string
  ): Promise<Array<{ id: string; fullName: string; conferenciaId: string; conferenciaName?: string; phone: string; email?: string }>> {
    const matches: any[] = [];
    const cleanPhone = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : '';
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    for (const m of this.membros.values()) {
      if (m.centralId !== centralId) continue;
      const mNormName = m.normalizedName || '';
      const mNormPhone = (m.phone || '').replace(/\D/g, '');
      const mEmail = (m.email || '').trim().toLowerCase();

      if (
        (normalizedName && mNormName === normalizedName) ||
        (cleanPhone && mNormPhone === cleanPhone) ||
        (cleanEmail && mEmail === cleanEmail)
      ) {
        matches.push({
          id: m.id,
          fullName: m.fullName,
          conferenciaId: m.conferenciaId,
          phone: m.phone,
          email: m.email,
        });
      }
    }
    return matches;
  }

  async createMembroRecord(membro: any): Promise<{ id: string }> {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.membros.set(id, { ...membro, id });
    return { id };
  }

  async getMembroById(membroId: string): Promise<any | null> {
    return this.membros.get(membroId) || null;
  }

  async updateMembroRecord(membroId: string, updates: any): Promise<void> {
    const existing = this.membros.get(membroId);
    if (existing) {
      this.membros.set(membroId, { ...existing, ...updates });
    }
  }

  async saveAuditLog(audit: any): Promise<void> {}

  async getRequestIdRecord(requestId: string): Promise<any | null> {
    return this.idempotencyStore.get(requestId) || null;
  }

  async saveRequestIdRecord(requestId: string, result: any): Promise<void> {
    this.idempotencyStore.set(requestId, result);
  }

  async getDedupKeyRecord(keyHash: string): Promise<any | null> {
    return this.dedupKeys.get(keyHash) || null;
  }

  async saveDedupKeyRecord(keyHash: string, data: any): Promise<void> {
    this.dedupKeys.set(keyHash, data);
  }
}

async function runTests() {
  process.env.DEDUP_HMAC_SECRET = 'test-secret-2026-ssvp';
  process.env.OPAQUE_TOKEN_SECRET = 'test-opaque-secret-2026';
  console.log('======================================================================');
  console.log(' Executando Testes: Formulário Público de Autocadastro de Membros');
  console.log('======================================================================\n');

  // Setup Base Data
  const repo = new MockPublicRegistrationRepository();
  const centralId = 'central-sp-01';
  repo.institutions.set(centralId, { id: centralId, name: 'Conselho Central de São Paulo' });

  const cp1: StandaloneConselhoParticular = {
    id: 'cp-centro',
    centralId,
    name: 'Conselho Particular Centro',
    normalizedName: 'CONSELHO PARTICULAR CENTRO',
    status: 'ativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
  const cpInativo: StandaloneConselhoParticular = {
    id: 'cp-inativo',
    centralId,
    name: 'Conselho Particular Desativado',
    normalizedName: 'CONSELHO PARTICULAR DESATIVADO',
    status: 'inativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
  repo.particulares.set(cp1.id, cp1);
  repo.particulares.set(cpInativo.id, cpInativo);

  const conf1: StandaloneConferencia = {
    id: 'conf-vicente',
    particularId: cp1.id,
    centralId,
    name: 'Conferência São Vicente de Paulo',
    normalizedName: 'CONFERENCIA SAO VICENTE DE PAULO',
    status: 'ativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
  const confInativa: StandaloneConferencia = {
    id: 'conf-inativa',
    particularId: cp1.id,
    centralId,
    name: 'Conferência Inativa',
    normalizedName: 'CONFERENCIA INATIVA',
    status: 'inativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
  repo.conferencias.set(conf1.id, conf1);
  repo.conferencias.set(confInativa.id, confInativa);

  const authContextValid = {
    allowed: true,
    validatedCentralId: centralId,
    userId: 'user-admin',
  };

  const authContextUnauthorized = {
    allowed: false,
  };

  // --------------------------------------------------------------------------------
  // [TEST 1] Validação de Dados de Entrada e Consentimento
  // --------------------------------------------------------------------------------
  console.log('[TEST 1] Validação de Dados do Formulário e Consentimento');
  const validPayload = {
    particularId: 'cp-centro',
    conferenciaId: 'conf-vicente',
    fullName: 'Maria da Silva Ozanam',
    type: 'consocia',
    phone: '(11) 98765-4321',
    email: 'maria.ozanam@email.com',
    birthDate: '1985-05-20',
    admissionDate: '2015-08-15',
    acclamationDate: '2016-08-15',
    proclamationDate: '2018-08-15',
    consentAccepted: true,
  };

  const res1 = validatePublicMemberSubmissionInput(validPayload);
  assert(res1.valid === true, 'Payload válido deve passar na validação');
  assert(res1.cleanData?.normalizedName === 'MARIA DA SILVA OZANAM', 'Nome normalizado em caixa alta sem acentos');
  assert(res1.cleanData?.normalizedPhone === '11987654321', 'Telefone normalizado apenas dígitos');
  assert(res1.cleanData?.termVersion === CURRENT_LGPD_TERM_VERSION, 'Versão do termo LGPD atribuída');

  const invalidParticular = { ...validPayload, particularId: '' };
  const resParticular = validatePublicMemberSubmissionInput(invalidParticular);
  assert(resParticular.valid === false, 'Envio sem Conselho Particular deve ser rejeitado');

  const invalidConferencia = { ...validPayload, conferenciaId: '' };
  const resConferencia = validatePublicMemberSubmissionInput(invalidConferencia);
  assert(resConferencia.valid === false, 'Envio sem Conferência deve ser rejeitado');

  const fallbackType = { ...validPayload, type: 'tipo_desconhecido' };
  const resFallback = validatePublicMemberSubmissionInput(fallbackType);
  assert(resFallback.valid === true && resFallback.cleanData?.type === 'confrade', 'Tipo desconhecido deve adotar confrade como fallback seguro');

  // --------------------------------------------------------------------------------
  // [TEST 2] Geração, Consulta e Revogação do Token Público do Conselho Central
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 2] Geração e Revogação do Token Público do Conselho Central');
  const genRes = await generateOrRotateCentralPublicToken(centralId, authContextValid, repo);
  assert(genRes.success === true, 'Geração de token deve ter sucesso');
  assert(!!genRes.data?.token, 'Token gerado deve ser uma string não vazia');
  assert(genRes.data?.enabled === true, 'Token deve estar ativo por padrão');

  const generatedToken = genRes.data!.token;

  // Consulta por CentralId
  const getRes = await getCentralPublicTokenConfig(centralId, authContextValid, repo);
  assert(getRes.success === true && getRes.data?.token === generatedToken, 'Consulta do token ativo deve retornar o token gerado');

  // Rejeição para usuário não autorizado
  const genUnauth = await generateOrRotateCentralPublicToken(centralId, authContextUnauthorized, repo);
  assert(genUnauth.success === false && genUnauth.code === 'UNAUTHORIZED', 'Tentativa não autenticada deve ser rejeitada com UNAUTHORIZED');

  // --------------------------------------------------------------------------------
  // [TEST 3] Endpoint Público de Consulta da Estrutura Hierárquica por Token
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 3] Consulta Pública da Estrutura Hierárquica por Token');
  const structRes = await getPublicHierarchyStructure(generatedToken, repo);
  assert(structRes.success === true, 'Consulta de estrutura por token válido deve ter sucesso');
  assert(structRes.data?.centralName === 'Conselho Central de São Paulo', 'Nome do Central deve ser retornado');
  assert(structRes.data?.conselhosParticulares.length === 1, 'Apenas CPs ativos devem ser listados (1 ativo, 1 inativo)');
  assert(structRes.data?.conferencias.length === 1, 'Apenas Conferências ativas devem ser listadas (1 ativa, 1 inativa)');
  assert(!!structRes.data?.termText, 'Texto do termo de consentimento deve estar presente');

  // Token inexistente
  const structFake = await getPublicHierarchyStructure('token-inexistente-123', repo);
  assert(structFake.success === false && structFake.code === 'TOKEN_NOT_FOUND', 'Token inválido deve retornar TOKEN_NOT_FOUND');

  // --------------------------------------------------------------------------------
  // [TEST 4] Submissão Pública com Validação dos Vínculos Hierárquicos
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 4] Submissão Pública e Validação de Vínculos Hierárquicos');
  const submitRes1 = await submitPublicMemberRegistration(generatedToken, validPayload, repo, {
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Mobile',
  });
  assert(submitRes1.success === true, 'Submissão válida deve ter sucesso');
  assert(submitRes1.data?.status === 'processado_automaticamente', 'Status inicial sem duplicidade deve ser processado_automaticamente');
  assert(!!submitRes1.data?.membroId, 'Membro oficial deve ser criado imediatamente');

  const savedSub = await repo.getSubmissionById(submitRes1.data!.submissionId);
  assert(savedSub !== null, 'Solicitação deve existir no repositório');
  assert(savedSub?.consent.accepted === true, 'Consentimento aceito registrado');
  assert(!!savedSub?.consent.ipHash, 'Hash anônimo do IP registrado para auditoria');
  assert(savedSub?.centralId === centralId, 'centralId vinculado corretamente');

  // Tentativa com CP inativo
  const submitCpInativo = await submitPublicMemberRegistration(
    generatedToken,
    { ...validPayload, particularId: cpInativo.id },
    repo
  );
  assert(submitCpInativo.success === false && submitCpInativo.code === 'PARTICULAR_INACTIVE', 'CP inativo deve ser rejeitado');

  // Tentativa com Conferência inativa
  const submitConfInativa = await submitPublicMemberRegistration(
    generatedToken,
    { ...validPayload, conferenciaId: confInativa.id },
    repo
  );
  assert(submitConfInativa.success === false && submitConfInativa.code === 'CONFERENCIA_INACTIVE', 'Conferência inativa deve ser rejeitada');

  // Tentativa com Conferência de outro CP (Mismatch)
  const cpOutro: StandaloneConselhoParticular = {
    id: 'cp-outro',
    centralId,
    name: 'Outro CP',
    normalizedName: 'OUTRO CP',
    status: 'ativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
  repo.particulares.set(cpOutro.id, cpOutro);

  const submitMismatch = await submitPublicMemberRegistration(
    generatedToken,
    { ...validPayload, particularId: cpOutro.id, conferenciaId: conf1.id },
    repo
  );
  assert(submitMismatch.success === false && submitMismatch.code === 'HIERARCHY_MISMATCH', 'Conferência que não pertence ao CP deve ser rejeitada');

  // --------------------------------------------------------------------------------
  // [TEST 5] Proteção e Encaminhamento de Envios Duplicados para Moderação
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 5] Proteção Contra Envios Repetidos / Duplicados');
  const duplicateSubmit = await submitPublicMemberRegistration(generatedToken, validPayload, repo);
  assert(
    duplicateSubmit.success === true && duplicateSubmit.data?.status === 'aguardando_revisao_duplicidade',
    'Envio repetido com dados de membro já existente deve ser encaminhado para aguardando_revisao_duplicidade'
  );

  // --------------------------------------------------------------------------------
  // [TEST 6] Revogação do Token Bloqueia Novos Envios e Consultas
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 6] Revogação do Token Público');
  const revokeRes = await revokeCentralPublicToken(centralId, authContextValid, repo);
  assert(revokeRes.success === true && revokeRes.data?.revoked === true, 'Revogação do token deve retornar sucesso');

  const structAfterRevoke = await getPublicHierarchyStructure(generatedToken, repo);
  assert(
    structAfterRevoke.success === false && structAfterRevoke.code === 'TOKEN_REVOKED',
    'Consulta de formulário com token revogado deve retornar TOKEN_REVOKED'
  );

  const submitAfterRevoke = await submitPublicMemberRegistration(
    generatedToken,
    { ...validPayload, fullName: 'Outro Nome de Teste' },
    repo
  );
  assert(
    submitAfterRevoke.success === false && submitAfterRevoke.code === 'TOKEN_REVOKED',
    'Envio com token revogado deve ser rejeitado'
  );

  // --------------------------------------------------------------------------------
  // [TEST 7] Rate Limiting em Memória por IP / Token (Ajustado para até 10 requisições/min)
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 7] Rate Limiting em Memória (Máx 10 requisições/min para cadastros sequenciais)');
  resetRateLimiterForTesting();
  const testKey = '192.168.1.50_token-teste';

  for (let i = 1; i <= 10; i++) {
    assert(checkAndIncrementRateLimit(testKey) === true, `Tentativa ${i} permitida dentro da cota de 10/min`);
  }
  assert(checkAndIncrementRateLimit(testKey) === false, 'Tentativa 11 bloqueada pelo limite de 10/min');

  // Outra chave/IP não deve ser afetada
  const otherKey = '192.168.1.99_token-teste';
  assert(checkAndIncrementRateLimit(otherKey) === true, 'Outro IP/chave não afetado pelo limite anterior');

  // --------------------------------------------------------------------------------
  // [TEST 7.1] Preenchimento para Outra Pessoa (Terceiros / Responsável)
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 7.1] Preenchimento por Terceiros com Responsável e Autorização');
  const thirdPartyPayload = {
    particularId: 'cp-centro',
    conferenciaId: 'conf-vicente',
    fullName: 'Sebastião Leme',
    type: 'confrade',
    phone: '(11) 99111-2222',
    consentAccepted: true,
    isThirdPartySubmission: true,
    representativeName: 'Ana Paula Secretária',
  };

  const resThirdPartyValid = validatePublicMemberSubmissionInput(thirdPartyPayload);
  assert(resThirdPartyValid.valid === true, 'Submissão de terceiros com nome do responsável é válida');
  assert(resThirdPartyValid.cleanData?.isThirdPartySubmission === true, 'isThirdPartySubmission marcado como true');
  assert(resThirdPartyValid.cleanData?.representativeName === 'Ana Paula Secretária', 'representativeName preservado');

  const resThirdPartyMissingResp = validatePublicMemberSubmissionInput({
    ...thirdPartyPayload,
    representativeName: '  ',
  });
  assert(
    resThirdPartyMissingResp.valid === true && resThirdPartyMissingResp.cleanData?.representativeName === undefined,
    'Submissão de terceiros com nome em branco normaliza para undefined'
  );

  // Submissão real por terceiro salvando no repositório (com novo token ativo)
  const genActiveTokenRes = await generateOrRotateCentralPublicToken(centralId, authContextValid, repo);
  const activeToken = genActiveTokenRes.data!.token;

  const submitThirdPartyRes = await submitPublicMemberRegistration(activeToken, thirdPartyPayload, repo, {
    ip: '192.168.1.150',
    userAgent: 'Mozilla/5.0 Desktop',
  });
  assert(submitThirdPartyRes.success === true, 'Envio por terceiro registrado com sucesso');
  const savedThirdPartySub = await repo.getSubmissionById(submitThirdPartyRes.data!.submissionId);
  assert(savedThirdPartySub?.isThirdPartySubmission === true, 'isThirdPartySubmission registrado no banco');
  assert(savedThirdPartySub?.representativeName === 'Ana Paula Secretária', 'representativeName registrado no banco');
  assert(savedThirdPartySub?.consent.isThirdParty === true, 'consent.isThirdParty registrado no consentimento');
  assert(savedThirdPartySub?.consent.representativeName === 'Ana Paula Secretária', 'consent.representativeName registrado');

  // --------------------------------------------------------------------------------
  // [TEST 8] Formato Exclusivo do Link Público (?cadastro=<TOKEN>)
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 8] Formato Exclusivo de Link Público (?cadastro=<TOKEN>)');
  const url1 = buildPublicRegistrationUrl('abc123token', 'https://ssvp-sistema.org');
  assert(url1 === 'https://ssvp-sistema.org/?cadastro=abc123token', 'Link gerado deve ter formato exclusivo ?cadastro=');
  assert(!url1.includes('?token='), 'Link não deve conter parâmetro genérico ?token=');
  assert(!url1.includes('#/cadastro-membro/'), 'Link não deve conter formato em hash');

  // --------------------------------------------------------------------------------
  // [TEST 9] Moderação: Listagem de Solicitações e Filtros
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 9] Moderação: Listagem de Solicitações e Filtros');
  const listAll = await listCentralMemberSubmissions(centralId, { allowed: true, validatedCentralId: centralId }, repo);
  assert(listAll.success === true && Array.isArray(listAll.data), 'Listagem de solicitações com autenticação permitida');

  const listUnauthorized = await listCentralMemberSubmissions(centralId, { allowed: false }, repo);
  assert(listUnauthorized.success === false && listUnauthorized.code === 'UNAUTHORIZED', 'Listagem sem autorização bloqueada');

  // --------------------------------------------------------------------------------
  // [TEST 10] Detecção de Duplicidades por Nome Normalizado, Telefone e E-mail
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 10] Detecção de Duplicidades por Nome, Telefone e E-mail');
  repo.membros.set('mem-1', {
    id: 'mem-1',
    centralId,
    fullName: 'Maria Aparecida da Silva',
    normalizedName: 'MARIA APARECIDA DA SILVA',
    phone: '(11) 98888-7777',
    email: 'maria.silva@ssvp.org',
    conferenciaId: 'conf-1',
  });

  const dupName = await checkSubmissionDuplicates(
    centralId,
    'MARIA APARECIDA DA SILVA',
    '(11) 90000-0000',
    'outro@email.com',
    { allowed: true, validatedCentralId: centralId },
    repo
  );
  assert(dupName.success === true && dupName.data?.length === 1, 'Detecta duplicidade por nome normalizado');

  const dupPhone = await checkSubmissionDuplicates(
    centralId,
    'OUTRO NOME',
    '(11) 98888-7777',
    'outro@email.com',
    { allowed: true, validatedCentralId: centralId },
    repo
  );
  assert(dupPhone.success === true && dupPhone.data?.length === 1, 'Detecta duplicidade por telefone normalizado');

  const dupEmail = await checkSubmissionDuplicates(
    centralId,
    'OUTRO NOME',
    '(11) 91111-2222',
    'maria.silva@ssvp.org',
    { allowed: true, validatedCentralId: centralId },
    repo
  );
  assert(dupEmail.success === true && dupEmail.data?.length === 1, 'Detecta duplicidade por e-mail');

  // Setup CP Sul e Conf Sul para testes de mismatch
  const cpSul: StandaloneConselhoParticular = {
    id: 'cp-sul',
    centralId,
    name: 'Conselho Particular Sul',
    normalizedName: 'CONSELHO PARTICULAR SUL',
    status: 'ativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
  const confSul: StandaloneConferencia = {
    id: 'conf-sul-1',
    particularId: cpSul.id,
    centralId,
    name: 'Conferência Sul',
    normalizedName: 'CONFERENCIA SUL',
    status: 'ativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
  repo.particulares.set(cpSul.id, cpSul);
  repo.conferencias.set(confSul.id, confSul);

  // --------------------------------------------------------------------------------
  // [TEST 11] Aprovação de Solicitação com Criação de Membro e Revalidação de Hierarquia
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 11] Aprovação de Solicitação com Revalidação Rigorosa de Hierarquia');
  const subToApprove: SolicitacaoCadastroMembro = {
    id: 'sub-aprov-1',
    centralId,
    particularId: 'cp-centro',
    conferenciaId: 'conf-vicente',
    fullName: 'Lucas Fernandes',
    normalizedName: 'LUCAS FERNANDES',
    type: 'confrade',
    phone: '(11) 97777-6666',
    normalizedPhone: '11977776666',
    email: 'lucas@exemplo.com',
    consent: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      termVersion: CURRENT_LGPD_TERM_VERSION,
    },
    status: 'aguardando_aprovacao',
    submittedAt: new Date().toISOString(),
  };
  repo.submissions.set(subToApprove.id, subToApprove);

  // Tentativa de aprovação alterando para conferência inválida / mismatch hierárquico
  const approveMismatch = await approveMemberSubmission(
    subToApprove.id,
    centralId,
    { allowed: true, validatedCentralId: centralId, userId: 'admin' },
    repo,
    { particularId: 'cp-centro', conferenciaId: 'conf-sul-1' } // conf-sul-1 pertence a cp-sul, não cp-centro!
  );
  assert(
    approveMismatch.success === false && approveMismatch.code === 'HIERARCHY_MISMATCH',
    'Bloqueia aprovação se Conferência de destino não pertencer ao CP selecionado'
  );

  // Aprovação válida com sucesso
  const approveSuccess = await approveMemberSubmission(
    subToApprove.id,
    centralId,
    { allowed: true, validatedCentralId: centralId, userId: 'admin' },
    repo
  );
  assert(approveSuccess.success === true, 'Aprovação válida executada com sucesso');
  assert(approveSuccess.data?.submission.status === 'aprovado', 'Status da solicitação atualizado para aprovado');
  assert(!!approveSuccess.data?.membroId, 'Membro oficial criado com ID retornado');

  // Tentativa de aprovação duplicada (já aprovado)
  const approveAgain = await approveMemberSubmission(
    subToApprove.id,
    centralId,
    { allowed: true, validatedCentralId: centralId, userId: 'admin' },
    repo
  );
  assert(
    approveAgain.success === false && approveAgain.code === 'ALREADY_PROCESSED',
    'Bloqueia re-aprovação de solicitação já processada'
  );

  // --------------------------------------------------------------------------------
  // [TEST 12] Recusa de Solicitação com Motivo Obrigatório e Preservação de Histórico
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 12] Recusa de Solicitação com Motivo Obrigatório');
  const subToReject: SolicitacaoCadastroMembro = {
    id: 'sub-recusa-1',
    centralId,
    particularId: 'cp-centro',
    conferenciaId: 'conf-1',
    fullName: 'Candidato Desconhecido',
    normalizedName: 'CANDIDATO DESCONHECIDO',
    type: 'aspirante',
    phone: '(11) 95555-4444',
    normalizedPhone: '11955554444',
    consent: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      termVersion: CURRENT_LGPD_TERM_VERSION,
    },
    status: 'aguardando_aprovacao',
    submittedAt: new Date().toISOString(),
  };
  repo.submissions.set(subToReject.id, subToReject);

  const rejectWithoutReason = await rejectMemberSubmission(
    subToReject.id,
    centralId,
    '',
    { allowed: true, validatedCentralId: centralId, userId: 'admin' },
    repo
  );
  assert(
    rejectWithoutReason.success === false && rejectWithoutReason.code === 'MISSING_REJECTION_REASON',
    'Exige motivo para recusa de solicitação'
  );

  const rejectSuccess = await rejectMemberSubmission(
    subToReject.id,
    centralId,
    'Candidato não compareceu às reuniões preliminares',
    { allowed: true, validatedCentralId: centralId, userId: 'admin' },
    repo
  );
  assert(rejectSuccess.success === true, 'Recusa executada com sucesso com motivo registrado');
  assert(rejectSuccess.data?.status === 'recusado', 'Status da solicitação atualizado para recusado');
  assert(
    rejectSuccess.data?.rejectionReason === 'Candidato não compareceu às reuniões preliminares',
    'Motivo da recusa preservado no registro'
  );


  // --------------------------------------------------------------------------------
  // [TEST 13] Confirmação e Envio Direto para a Conferência (confirmAndSendMemberSubmission)
  // --------------------------------------------------------------------------------
  console.log('\n[TEST 13] Confirmação e Envio Direto para a Conferência');
  const subToConfirm: SolicitacaoCadastroMembro = {
    id: 'sub-confirm-1',
    centralId,
    particularId: cp1.id,
    conferenciaId: conf1.id,
    fullName: 'Lucas Ferreira Santos',
    normalizedName: 'LUCAS FERREIRA SANTOS',
    type: 'confrade',
    phone: '(11) 97777-8888',
    normalizedPhone: '11977778888',
    email: 'lucas.santos@email.com',
    consent: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      termVersion: CURRENT_LGPD_TERM_VERSION,
    },
    status: 'aguardando_revisao_duplicidade',
    duplicityReasons: ['Cadastro sequencial'],
    submittedAt: new Date().toISOString(),
  };
  repo.submissions.set(subToConfirm.id, subToConfirm);

  // Executar confirmação e envio direto para a Conferência
  const confirmResult = await confirmAndSendMemberSubmission(
    subToConfirm.id,
    centralId,
    authContextValid,
    repo
  );
  assert(confirmResult.success === true, 'Confirmação e envio para Conferência com sucesso');
  assert(confirmResult.data?.submission.status === 'processado_automaticamente', 'Status atualizado para processado_automaticamente');
  assert(!!confirmResult.data?.membroId, 'Membro criado e vinculado à conferência');
  assert(confirmResult.data?.conferenciaId === conf1.id, 'Conferência de destino correta');
  assert(confirmResult.data?.actionTaken === 'created', 'Ação registrada como created');

  // Reenviar / Sincronizar membro já existente atualizando dados
  const reconfirmResult = await confirmAndSendMemberSubmission(
    subToConfirm.id,
    centralId,
    authContextValid,
    repo,
    { profession: 'Engenheiro de Software' }
  );
  assert(reconfirmResult.success === true, 'Reenvio e sincronização de membro existente com sucesso');
  assert(reconfirmResult.data?.actionTaken === 'updated', 'Ação registrada como updated ao sincronizar');

  // Bloqueio por permissão não autorizada
  const unauthConfirm = await confirmAndSendMemberSubmission(
    subToConfirm.id,
    centralId,
    authContextUnauthorized,
    repo
  );
  assert(unauthConfirm.success === false && unauthConfirm.code === 'UNAUTHORIZED', 'Bloqueia confirmação por usuário não autorizado');

  console.log('\n======================================================================');
  console.log(` RESULTADOS DOS TESTES: ${passed} Passou | ${failed} Falhou`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
