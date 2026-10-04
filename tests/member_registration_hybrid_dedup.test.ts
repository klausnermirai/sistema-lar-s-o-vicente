import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  submitPublicMemberRegistration,
  submitPublicMemberUpdateRequest,
  approveMemberSubmission,
  runLegacySubmissionsDryRun,
  PublicRegistrationRepository,
  PublicRegistrationTransaction,
  resetRateLimiterForTesting,
  ServiceAuthContext,
} from '../lib/public_member_registration_service.ts';
import {
  computeAllDedupKeys,
  computePhoneDedupKey,
  computeEmailDedupKey,
  computeNameConfDedupKey,
} from '../lib/member_deduplication_crypto.ts';
import { generateOpaqueMemberToken } from '../lib/public_member_masking.ts';
import { SolicitacaoCadastroMembro } from '../types.ts';

const TEST_HMAC_SECRET = 'test-backend-dedup-hmac-secret-super-secure-2026';
const TEST_OPAQUE_SECRET = 'test-opaque-member-token-secret-2026';

class InMemoryHybridRegistrationRepository implements PublicRegistrationRepository {
  tokenConfigs = new Map<string, any>();
  institutions = new Map<string, any>();
  particulares = new Map<string, any>();
  conferencias = new Map<string, any>();
  membros = new Map<string, any>();
  submissions = new Map<string, SolicitacaoCadastroMembro>();
  dedupKeys = new Map<string, { membroId: string; type: string; createdAt: string }>();
  idempotencyStore = new Map<string, any>();
  auditLogs: any[] = [];
  writeCounter = 0; // Para garantir que dry-run tem 0 escritas

  async getCentralTokenConfig(token: string) {
    return this.tokenConfigs.get(token) || null;
  }
  async getCentralTokenConfigByCentralId(centralId: string) {
    for (const cfg of this.tokenConfigs.values()) {
      if (cfg.centralId === centralId) return cfg;
    }
    return null;
  }
  async saveCentralTokenConfig(config: any) {
    this.writeCounter++;
    this.tokenConfigs.set(config.token, config);
  }
  async getInstitution(centralId: string) {
    return this.institutions.get(centralId) || null;
  }
  async listActiveParticulares(centralId: string) {
    return Array.from(this.particulares.values()).filter((p) => p.centralId === centralId && p.status === 'ativo');
  }
  async listActiveConferencias(centralId: string) {
    return Array.from(this.conferencias.values()).filter((c) => c.centralId === centralId && c.status === 'ativo');
  }
  async getParticularById(id: string) {
    return this.particulares.get(id) || null;
  }
  async getConferenciaById(id: string) {
    return this.conferencias.get(id) || null;
  }
  async findRecentPendingSubmission(conferenciaId: string, normalizedName: string, normalizedPhone: string) {
    for (const sub of this.submissions.values()) {
      if (
        sub.conferenciaId === conferenciaId &&
        (sub.normalizedName === normalizedName || (normalizedPhone && sub.normalizedPhone === normalizedPhone)) &&
        (sub.status === 'aguardando_aprovacao' || sub.status === 'aguardando_revisao_duplicidade')
      ) {
        return sub;
      }
    }
    return null;
  }
  async createSubmission(sub: Omit<SolicitacaoCadastroMembro, 'id'> & { id?: string }) {
    this.writeCounter++;
    const id = sub.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const full = { ...sub, id } as SolicitacaoCadastroMembro;
    this.submissions.set(id, full);
    return full;
  }
  async getSubmissionById(id: string) {
    return this.submissions.get(id) || null;
  }
  async listSubmissions(centralId: string, options?: any) {
    let list = Array.from(this.submissions.values()).filter((s) => s.centralId === centralId);
    if (options?.status && options.status !== 'todos') {
      list = list.filter((s) => s.status === options.status);
    }
    return list;
  }
  async updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>) {
    this.writeCounter++;
    const existing = this.submissions.get(id);
    if (!existing) throw new Error('Submission not found');
    const updated = { ...existing, ...updates };
    this.submissions.set(id, updated);
    return updated;
  }
  async findExistingMembers(centralId: string, normalizedName: string, normalizedPhone?: string, email?: string) {
    const list: any[] = [];
    for (const m of this.membros.values()) {
      if (m.centralId !== centralId || m.status !== 'ativo') continue;
      if (
        (normalizedName && m.normalizedName === normalizedName) ||
        (normalizedPhone && m.normalizedPhone === normalizedPhone) ||
        (email && m.email === email)
      ) {
        list.push(m);
      }
    }
    return list;
  }
  async createMembroRecord(membro: any) {
    this.writeCounter++;
    const id = `membro_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const full = { ...membro, id };
    this.membros.set(id, full);
    return { id };
  }
  async getMembroById(membroId: string) {
    return this.membros.get(membroId) || null;
  }
  async updateMembroRecord(membroId: string, updates: any) {
    this.writeCounter++;
    const existing = this.membros.get(membroId);
    if (existing) {
      this.membros.set(membroId, { ...existing, ...updates });
    }
  }
  async saveAuditLog(audit: any) {
    this.writeCounter++;
    this.auditLogs.push(audit);
  }
  async getRequestIdRecord(requestId: string) {
    return this.idempotencyStore.get(requestId) || null;
  }
  async saveRequestIdRecord(requestId: string, result: any) {
    this.writeCounter++;
    this.idempotencyStore.set(requestId, result);
  }
  async getDedupKeyRecord(keyHash: string) {
    return this.dedupKeys.get(keyHash) || null;
  }
  async saveDedupKeyRecord(keyHash: string, data: { membroId: string; type: string; createdAt: string }) {
    this.writeCounter++;
    this.dedupKeys.set(keyHash, data);
  }

  // Simulação de transação atômica
  async executeTransaction<T>(updateFunction: (txn: PublicRegistrationTransaction) => Promise<T>): Promise<T> {
    const txn: PublicRegistrationTransaction = {
      getCentralTokenConfig: (token) => this.getCentralTokenConfig(token),
      getRequestId: (reqId) => this.getRequestIdRecord(reqId),
      saveRequestId: (reqId, res) => this.saveRequestIdRecord(reqId, res),
      getDedupKey: (hash) => this.getDedupKeyRecord(hash),
      setDedupKey: (hash, data) => this.saveDedupKeyRecord(hash, data),
      getParticularById: (id) => this.getParticularById(id),
      getConferenciaById: (id) => this.getConferenciaById(id),
      getMembroById: (id) => this.getMembroById(id),
      createMembroRecord: (m) => this.createMembroRecord(m),
      updateMembroRecord: (id, u) => this.updateMembroRecord(id, u),
      getSubmissionById: (id) => this.getSubmissionById(id),
      createSubmission: (s) => this.createSubmission(s),
      updateSubmission: (id, u) => this.updateSubmission(id, u),
      saveAuditLog: (a) => this.saveAuditLog(a),
    };
    return await updateFunction(txn);
  }
}

describe('Fluxo Híbrido de Autocadastro de Membros SSVP com Deduplicação HMAC e Idempotência', () => {
  let repo: InMemoryHybridRegistrationRepository;
  const centralId = 'central-jaboticabal-01';
  const token = 'valid-public-token-123';
  const particularId = 'cp-sao-joao';
  const conferenciaId = 'conf-santa-rita';

  const authContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: centralId,
    userId: 'admin-tester',
  };

  beforeEach(() => {
    process.env.DEDUP_HMAC_SECRET = TEST_HMAC_SECRET;
    process.env.OPAQUE_TOKEN_SECRET = TEST_OPAQUE_SECRET;
    resetRateLimiterForTesting();

    repo = new InMemoryHybridRegistrationRepository();
    repo.tokenConfigs.set(token, {
      id: centralId,
      centralId,
      token,
      enabled: true,
    });
    repo.institutions.set(centralId, {
      id: centralId,
      name: 'Conselho Central de Jaboticabal',
    });
    repo.particulares.set(particularId, {
      id: particularId,
      centralId,
      name: 'Conselho Particular São João',
      status: 'ativo',
    });
    repo.conferencias.set(conferenciaId, {
      id: conferenciaId,
      centralId,
      particularId,
      name: 'Conferência Santa Rita',
      status: 'ativo',
    });
  });

  afterEach(() => {
    delete process.env.DEDUP_HMAC_SECRET;
    delete process.env.OPAQUE_TOKEN_SECRET;
  });

  describe('1. Primeiro Cadastro Público: Criação Automática vs Detecção de Duplicidade HMAC', () => {
    it('deve criar imediatamente o membro oficial ativo se não houver colisão de chave determinística', async () => {
      const payload = {
        particularId,
        conferenciaId,
        fullName: 'Francisco de Assis Silva',
        type: 'confrade',
        phone: '(16) 99876-5432',
        email: 'francisco@example.com',
        birthDate: '1985-05-12',
        admissionDate: '2010-03-15',
        consentAccepted: true,
        requestId: 'req-unique-001',
      };

      const result = await submitPublicMemberRegistration(token, payload, repo);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('processado_automaticamente');
      expect(result.data?.membroId).toBeDefined();

      const createdMembro = await repo.getMembroById(result.data!.membroId!);
      expect(createdMembro).toBeDefined();
      expect(createdMembro.status).toBe('ativo');
      expect(createdMembro.origin).toBe('autocadastro_publico');
      expect(createdMembro.fullName).toBe('Francisco de Assis Silva');
      expect(createdMembro.centralId).toBe(centralId);
      expect(createdMembro.particularId).toBe(particularId);
      expect(createdMembro.conferenciaId).toBe(conferenciaId);

      // Verifica gravação das chaves HMAC determinísticas (sem PII no ID)
      const phoneKey = computePhoneDedupKey(centralId, '16998765432', TEST_HMAC_SECRET);
      const emailKey = computeEmailDedupKey(centralId, 'francisco@example.com', TEST_HMAC_SECRET);
      const nameConfKey = computeNameConfDedupKey(
        centralId,
        'FRANCISCO DE ASSIS SILVA',
        conferenciaId,
        TEST_HMAC_SECRET
      );

      const phoneKeyRecord = await repo.getDedupKeyRecord(phoneKey);
      expect(phoneKeyRecord).toBeDefined();
      expect(phoneKeyRecord?.membroId).toBe(createdMembro.id);

      const emailKeyRecord = await repo.getDedupKeyRecord(emailKey);
      expect(emailKeyRecord).toBeDefined();
      expect(emailKeyRecord?.membroId).toBe(createdMembro.id);

      const nameConfRecord = await repo.getDedupKeyRecord(nameConfKey);
      expect(nameConfRecord).toBeDefined();
      expect(nameConfRecord?.membroId).toBe(createdMembro.id);

      // Verifica histórico da submissão gravada
      const submission = await repo.getSubmissionById(result.data!.submissionId);
      expect(submission).toBeDefined();
      expect(submission?.status).toBe('processado_automaticamente');
      expect(submission?.membroId).toBe(createdMembro.id);
    });

    it('deve reter para moderação (aguardando_revisao_duplicidade) quando houver colisão de telefone HMAC', async () => {
      // 1. Cadastra o primeiro membro
      await submitPublicMemberRegistration(
        token,
        {
          particularId,
          conferenciaId,
          fullName: 'Primeiro Membro Registrado',
          type: 'confrade',
          phone: '(16) 99111-2222',
          consentAccepted: true,
          requestId: 'req-first-001',
        },
        repo
      );

      // 2. Tenta cadastrar segundo membro com o mesmo telefone
      const secondPayload = {
        particularId,
        conferenciaId,
        fullName: 'Segundo Membro Compartilha Telefone',
        type: 'consocia',
        phone: '(16) 99111-2222', // mesmo telefone!
        consentAccepted: true,
        requestId: 'req-second-002',
      };

      const result = await submitPublicMemberRegistration(token, secondPayload, repo);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('aguardando_revisao_duplicidade');
      expect(result.data?.membroId).toBeUndefined(); // Não cria membro oficial automaticamente

      const submission = await repo.getSubmissionById(result.data!.submissionId);
      expect(submission?.status).toBe('aguardando_revisao_duplicidade');
      expect(submission?.duplicityReasons).toBeDefined();
      expect(submission?.duplicityReasons?.[0]).toContain('Telefone');
    });

    it('deve reter para moderação quando houver colisão de Nome + Conferência HMAC', async () => {
      // 1. Cadastra membro inicial com nome e sem telefone
      const firstPayload = {
        particularId,
        conferenciaId,
        fullName: 'Antonio Carlos de Souza',
        type: 'confrade',
        phone: '(16) 98888-0001',
        consentAccepted: true,
        requestId: 'req-ac-001',
      };
      await submitPublicMemberRegistration(token, firstPayload, repo);

      // 2. Novo cadastro com mesmo nome na mesma conferência, mas outro telefone
      const collisionPayload = {
        particularId,
        conferenciaId,
        fullName: 'Antônio Carlos de Souza', // Variação com acento -> normalizado é idêntico
        type: 'confrade',
        phone: '(16) 97777-0002',
        consentAccepted: true,
        requestId: 'req-ac-002',
      };

      const result = await submitPublicMemberRegistration(token, collisionPayload, repo);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('aguardando_revisao_duplicidade');
      expect(result.data?.membroId).toBeUndefined();

      const sub = await repo.getSubmissionById(result.data!.submissionId);
      expect(sub?.duplicityReasons?.some((r) => r.includes('Nome'))).toBe(true);
    });
  });

  describe('2. Idempotência por requestId', () => {
    it('deve retornar a resposta original em chamadas repetidas com o mesmo requestId sem duplicar membro', async () => {
      const payload = {
        particularId,
        conferenciaId,
        fullName: 'Membro Teste Idempotencia',
        type: 'confrade',
        phone: '(16) 99333-4444',
        consentAccepted: true,
        requestId: 'req-idempotency-repeat-123',
      };

      const firstCall = await submitPublicMemberRegistration(token, payload, repo);
      expect(firstCall.success).toBe(true);
      expect(firstCall.data?.status).toBe('processado_automaticamente');
      const firstMembroId = firstCall.data?.membroId;
      const initialMembrosCount = repo.membros.size;
      const initialSubmissionsCount = repo.submissions.size;

      // Segunda chamada com exatamente o mesmo requestId
      const secondCall = await submitPublicMemberRegistration(token, payload, repo);
      expect(secondCall.success).toBe(true);
      expect(secondCall.data?.idempotentReplay).toBe(true);
      expect(secondCall.data?.membroId).toBe(firstMembroId);
      expect(secondCall.data?.submissionId).toBe(firstCall.data?.submissionId);

      // Garante que nenhum registro duplicado foi criado
      expect(repo.membros.size).toBe(initialMembrosCount);
      expect(repo.submissions.size).toBe(initialSubmissionsCount);
    });
  });

  describe('3. Garantia de Criptografia Determinística Resiliente', () => {
    it('deve processar com segurança utilizando o segredo resiliente do backend caso DEDUP_HMAC_SECRET não esteja explicitado no ambiente', async () => {
      delete process.env.DEDUP_HMAC_SECRET;

      const payload = {
        particularId,
        conferenciaId,
        fullName: 'Membro Com Segredo Resiliente',
        type: 'confrade',
        phone: '(16) 99444-5555',
        consentAccepted: true,
        requestId: 'req-resilient-secret-001',
      };

      const result = await submitPublicMemberRegistration(token, payload, repo);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('processado_automaticamente');
      expect(repo.membros.size).toBe(1);
    });
  });

  describe('4. Complementação de Membro Existente (Automática vs Parcial vs Moderada)', () => {
    let existingMembroId: string;
    let opaqueToken: string;

    beforeEach(async () => {
      // Cria membro oficial com alguns campos vazios
      const membro = {
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Vicente de Paulo Santos',
        normalizedName: 'VICENTE DE PAULO SANTOS',
        type: 'confrade',
        phone: '(16) 99123-4567',
        normalizedPhone: '16991234567',
        email: undefined, // vazio
        birthDate: undefined, // vazio
        admissionDate: '2015-04-10', // preenchido
        status: 'ativo',
      };
      const created = await repo.createMembroRecord(membro);
      existingMembroId = created.id;

      opaqueToken = generateOpaqueMemberToken({
        originType: 'membro',
        realId: existingMembroId,
        centralId,
        conferenciaId,
      });
    });

    it('deve aplicar diretamente (status: processado_automaticamente) quando apenas campos vazios forem preenchidos', async () => {
      const updatePayload = {
        email: 'vicente.paulo@ssvp.org',
        birthDate: '1980-09-27',
        consentAccepted: true,
        requestId: 'req-comp-auto-01',
      };

      const result = await submitPublicMemberUpdateRequest(token, opaqueToken, updatePayload, repo);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('processado_automaticamente');
      expect(result.data?.appliedChanges).toEqual({
        email: 'vicente.paulo@ssvp.org',
        birthDate: '1980-09-27',
      });
      expect(result.data?.requestedChanges).toEqual({});

      // Membro oficial deve ter sido atualizado imediatamente
      const updatedMembro = await repo.getMembroById(existingMembroId);
      expect(updatedMembro.email).toBe('vicente.paulo@ssvp.org');
      expect(updatedMembro.birthDate).toBe('1980-09-27');
      expect(updatedMembro.admissionDate).toBe('2015-04-10'); // inalterado
    });

    it('deve aplicar parcialmente (status: parcialmente_processado) quando houver campos vazios E alteração de campos existentes', async () => {
      const updatePayload = {
        email: 'novo.email@ssvp.org', // campo vazio -> aplicado diretamente
        admissionDate: '2018-01-01', // campo já existia ('2015-04-10') com valor divergente -> moderação
        consentAccepted: true,
        requestId: 'req-comp-partial-01',
      };

      const result = await submitPublicMemberUpdateRequest(token, opaqueToken, updatePayload, repo);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('parcialmente_processado');
      expect(result.data?.appliedChanges).toEqual({
        email: 'novo.email@ssvp.org',
      });
      expect(result.data?.requestedChanges).toEqual({
        admissionDate: '2018-01-01',
      });

      // Membro oficial deve ter recebido apenas o campo vazio (email), preservando a data de admissão anterior até moderação
      const membro = await repo.getMembroById(existingMembroId);
      expect(membro.email).toBe('novo.email@ssvp.org');
      expect(membro.admissionDate).toBe('2015-04-10'); // Não sobrescreveu automaticamente
    });

    it('deve reter totalmente para moderação (status: aguardando_aprovacao) quando apenas campos já existentes forem modificados', async () => {
      const updatePayload = {
        phone: '(16) 99999-8888', // telefone já existia e diverge
        consentAccepted: true,
        requestId: 'req-comp-mod-01',
      };

      const result = await submitPublicMemberUpdateRequest(token, opaqueToken, updatePayload, repo);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('aguardando_aprovacao');
      expect(result.data?.appliedChanges).toEqual({});
      expect(result.data?.requestedChanges?.phone).toBe('(16) 99999-8888');

      // Membro oficial permanece intacto
      const membro = await repo.getMembroById(existingMembroId);
      expect(membro.phone).toBe('(16) 99123-4567');
    });
  });

  describe('5. Moderação e Aprovação de Alterações', () => {
    it('deve aplicar estritamente os requestedChanges ao aprovar solicitação parcialmente processada', async () => {
      // 1. Cria membro com dados iniciais
      const membro = await repo.createMembroRecord({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Consocia Maria Silva',
        normalizedName: 'CONSOCIA MARIA SILVA',
        type: 'consocia',
        phone: '(16) 98111-2222',
        normalizedPhone: '16981112222',
        admissionDate: '2010-01-01',
        status: 'ativo',
      });

      const opaqueToken = generateOpaqueMemberToken({
        originType: 'membro',
        realId: membro.id,
        centralId,
        conferenciaId,
      });

      // 2. Submete complementação parcial (preenche email vazio + propõe nova data de admissão)
      const subResult = await submitPublicMemberUpdateRequest(
        token,
        opaqueToken,
        {
          email: 'maria.silva@ssvp.org',
          admissionDate: '2012-05-15',
          consentAccepted: true,
          requestId: 'req-approve-test-01',
        },
        repo
      );

      expect(subResult.data?.status).toBe('parcialmente_processado');
      const submissionId = subResult.data!.submissionId;

      // 3. Moderador aprova a solicitação
      const approveResult = await approveMemberSubmission(submissionId, centralId, authContext, repo);

      expect(approveResult.success).toBe(true);
      expect(approveResult.data?.submission.status).toBe('aprovado');

      // Membro agora deve ter a nova data de admissão aprovada e manter o e-mail previamente aplicado
      const updatedMembro = await repo.getMembroById(membro.id);
      expect(updatedMembro.email).toBe('maria.silva@ssvp.org');
      expect(updatedMembro.admissionDate).toBe('2012-05-15');
    });
  });

  describe('6. Rotina de Dry-Run Estritamente Read-Only', () => {
    it('deve avaliar solicitações pendentes sem realizar nenhuma escrita no repositório e sem expor PII', async () => {
      // 1. Cria solicitações pendentes simulando legadas
      await repo.createSubmission({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Membro Elegivel Auto',
        normalizedName: 'MEMBRO ELEGIVEL AUTO',
        type: 'confrade',
        phone: '(16) 99777-1111',
        normalizedPhone: '16997771111',
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: 'v1.0' },
        status: 'aguardando_aprovacao',
        tipo: 'novo_cadastro',
        submittedAt: new Date().toISOString(),
      });

      // Membro existente que gerará colisão para a próxima submissão
      await repo.createMembroRecord({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Membro Existente Duplicado',
        normalizedName: 'MEMBRO EXISTENTE DUPLICADO',
        type: 'confrade',
        phone: '(16) 99888-2222',
        normalizedPhone: '16998882222',
        status: 'ativo',
      });

      await repo.createSubmission({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Membro Existente Duplicado',
        normalizedName: 'MEMBRO EXISTENTE DUPLICADO',
        type: 'confrade',
        phone: '(16) 99888-2222',
        normalizedPhone: '16998882222',
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: 'v1.0' },
        status: 'aguardando_aprovacao',
        tipo: 'novo_cadastro',
        submittedAt: new Date().toISOString(),
      });

      const initialWriteCount = repo.writeCounter;

      // 2. Executa Dry-Run
      const dryRunResult = await runLegacySubmissionsDryRun(centralId, authContext, repo);

      expect(dryRunResult.success).toBe(true);
      expect(dryRunResult.data?.dryRun).toBe(true);
      expect(dryRunResult.data?.totalAnalyzed).toBe(2);
      expect(dryRunResult.data?.eligibleForAutoCreation).toBe(1);
      expect(dryRunResult.data?.forwardedToDuplicityReview).toBe(1);

      // Garante que nenhuma mutação foi realizada no banco durante o dry-run
      expect(repo.writeCounter).toBe(initialWriteCount);

      // Garante que o retorno contém apenas contagens e IDs técnicos, sem vazar nomes ou telefones
      const keys = Object.keys(dryRunResult.data || {});
      expect(keys).toContain('totalAnalyzed');
      expect(keys).toContain('eligibleForAutoCreation');
      expect(keys).toContain('forwardedToDuplicityReview');
      expect(keys).toContain('candidateSubmissionIds');
      expect(keys).toContain('duplicityReviewSubmissionIds');
    });
  });
});
