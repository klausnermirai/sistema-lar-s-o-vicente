import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateOpaqueMemberToken,
  verifyAndDecodeOpaqueMemberToken,
  maskPhone,
  maskEmail,
  maskBirthDate,
  getDateStatus,
} from '../lib/public_member_masking.ts';
import { validatePublicMemberUpdateInput } from '../lib/public_member_update_validator.ts';
import {
  listPublicConferenciaMembers,
  getPublicMemberMaskedDetails,
  submitPublicMemberUpdateRequest,
  approveMemberSubmission,
  PublicRegistrationRepository,
} from '../lib/public_member_registration_service.ts';
import { SolicitacaoCadastroMembro } from '../types.ts';

// Mock Repository em memória para testes isolados
class InMemoryPublicRegistrationRepository implements PublicRegistrationRepository {
  tokenConfigs = new Map<string, any>();
  institutions = new Map<string, any>();
  particulares = new Map<string, any>();
  conferencias = new Map<string, any>();
  membros = new Map<string, any>();
  submissions = new Map<string, SolicitacaoCadastroMembro>();
  dedupKeys = new Map<string, any>();
  idempotencyStore = new Map<string, any>();
  auditLogs: any[] = [];

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
    this.tokenConfigs.set(config.token, config);
  }
  async getInstitution(centralId: string) {
    return this.institutions.get(centralId) || null;
  }
  async listActiveParticulares(centralId: string) {
    return Array.from(this.particulares.values()).filter(p => p.centralId === centralId && p.status === 'ativo');
  }
  async listActiveConferencias(centralId: string) {
    return Array.from(this.conferencias.values()).filter(c => c.centralId === centralId && c.status === 'ativo');
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
        sub.normalizedName === normalizedName &&
        sub.normalizedPhone === normalizedPhone &&
        (sub.status === 'aguardando_aprovacao' || sub.status === 'aguardando_revisao_duplicidade')
      ) {
        return sub;
      }
    }
    return null;
  }
  async createSubmission(sub: Omit<SolicitacaoCadastroMembro, 'id'> & { id?: string }) {
    const id = sub.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const full = { ...sub, id } as SolicitacaoCadastroMembro;
    this.submissions.set(id, full);
    return full;
  }
  async getSubmissionById(id: string) {
    return this.submissions.get(id) || null;
  }
  async listSubmissions(centralId: string, options?: any) {
    return Array.from(this.submissions.values()).filter(s => s.centralId === centralId);
  }
  async updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>) {
    const existing = this.submissions.get(id);
    if (!existing) throw new Error('Submission not found');
    const updated = { ...existing, ...updates };
    this.submissions.set(id, updated);
    return updated;
  }
  async findExistingMembers(centralId: string, normalizedName: string) {
    return [];
  }
  async createMembroRecord(membro: any) {
    const id = `membro_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.membros.set(id, { ...membro, id });
    return { id };
  }
  async listActiveMembersByConferencia(conferenciaId: string) {
    return Array.from(this.membros.values()).filter(m => m.conferenciaId === conferenciaId && m.status === 'ativo');
  }
  async listPendingSubmissionsByConferencia(conferenciaId: string) {
    return Array.from(this.submissions.values()).filter(s => s.conferenciaId === conferenciaId && s.status === 'aguardando_aprovacao');
  }
  async getMembroById(membroId: string) {
    return this.membros.get(membroId) || null;
  }
  async findPendingUpdateForTarget(targetType: 'membro' | 'submission', targetId: string) {
    for (const sub of this.submissions.values()) {
      if (sub.status === 'aguardando_aprovacao' || sub.status === 'parcialmente_processado') {
        if (targetType === 'membro' && sub.targetMembroId === targetId) return sub;
        if (targetType === 'submission' && sub.targetSubmissionId === targetId) return sub;
      }
    }
    return null;
  }
  async updateMembroRecord(membroId: string, updates: any) {
    const existing = this.membros.get(membroId);
    if (!existing) throw new Error('Membro not found');
    this.membros.set(membroId, { ...existing, ...updates });
  }
  async saveAuditLog(audit: any) {
    this.auditLogs.push(audit);
  }
  async getRequestIdRecord(requestId: string) {
    return this.idempotencyStore.get(requestId) || null;
  }
  async saveRequestIdRecord(requestId: string, result: any) {
    this.idempotencyStore.set(requestId, result);
  }
  async getDedupKeyRecord(keyHash: string) {
    return this.dedupKeys.get(keyHash) || null;
  }
  async saveDedupKeyRecord(keyHash: string, data: any) {
    this.dedupKeys.set(keyHash, data);
  }
}

describe('Verificação Abrangente de Complementação e Atualização Cadastral', () => {
  let repo: InMemoryPublicRegistrationRepository;
  const centralId = 'central_123';
  const token = 'token_abc123';
  const particularId = 'cp_456';
  const conferenciaId = 'conf_789';

  beforeEach(() => {
    process.env.DEDUP_HMAC_SECRET = 'test-secret-2026-ssvp';
    process.env.OPAQUE_TOKEN_SECRET = 'test-opaque-secret-2026';
    repo = new InMemoryPublicRegistrationRepository();
    repo.tokenConfigs.set(token, {
      id: centralId,
      centralId,
      token,
      enabled: true,
    });
    repo.institutions.set(centralId, { id: centralId, name: 'Conselho Central de Franca' });
    repo.particulares.set(particularId, { id: particularId, centralId, name: 'CP São Vicente', status: 'ativo' });
    repo.conferencias.set(conferenciaId, { id: conferenciaId, particularId, centralId, name: 'Conf. Santa Rita', status: 'ativo' });
  });

  describe('1. Membro Ativo: Consulta Mascarada e Atualização', () => {
    it('deve listar membro ativo, mascarar dados confidenciais e aplicar atualização após aprovação', async () => {
      repo.membros.set('m1', {
        id: 'm1',
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Antônio Carlos',
        normalizedName: 'ANTONIO CARLOS',
        phone: '16998765432',
        normalizedPhone: '16998765432',
        email: 'antonio@email.com',
        birthDate: '1975-03-20',
        admissionDate: '2005-01-10',
        type: 'confrade',
        status: 'ativo',
      });

      const listRes = await listPublicConferenciaMembers(token, conferenciaId, repo);
      expect(listRes.success).toBe(true);
      expect(listRes.data?.length).toBe(1);
      const opaqueId = listRes.data![0].idOpaco;

      const detailsRes = await getPublicMemberMaskedDetails(token, opaqueId, repo);
      expect(detailsRes.success).toBe(true);
      expect(detailsRes.data?.fullName).toBe('Antônio Carlos');
      expect(detailsRes.data?.maskedPhone).toBe('(16) 9****-5432');
      expect(detailsRes.data?.maskedEmail).toBe('a***@email.com');
      expect(detailsRes.data?.maskedBirthDate).toBe('**/**/1975');
      expect(detailsRes.data?.admissionDateStatus).toBe('informada');
      expect(detailsRes.data?.acclamationDateStatus).toBe('nao_informada');

      // Submete atualização de telefone e aclamação
      const updateRes = await submitPublicMemberUpdateRequest(
        token,
        opaqueId,
        {
          phone: '16988881234',
          acclamationDate: '2006-05-15',
          consentAccepted: true,
        },
        repo
      );
      expect(updateRes.success).toBe(true);
      expect(updateRes.data?.status).toBe('parcialmente_processado');
      expect(updateRes.data?.appliedChanges).toEqual({
        acclamationDate: '2006-05-15',
      });

      // Aprova
      const auth = { allowed: true, validatedCentralId: centralId, userId: 'admin_1' };
      const appRes = await approveMemberSubmission(updateRes.data!.submissionId, centralId, auth, repo);
      expect(appRes.success).toBe(true);
      expect(appRes.data?.membroId).toBe('m1');

      // Verifica membro ativo com diff aplicado
      const updated = repo.membros.get('m1');
      expect(updated.phone).toBe('16988881234');
      expect(updated.acclamationDate).toBe('2006-05-15');
      expect(updated.admissionDate).toBe('2005-01-10'); // intacto
      expect(updated.email).toBe('antonio@email.com'); // intacto
    });
  });

  describe('2. Solicitação Pendente: Consulta Pública e Identificação', () => {
    it('deve permitir que solicitante pendente consulte seus dados mascarados com identificador de submission', async () => {
      repo.submissions.set('sub_pendente_1', {
        id: 'sub_pendente_1',
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Beatriz Martins',
        normalizedName: 'BEATRIZ MARTINS',
        phone: '16981112233',
        normalizedPhone: '16981112233',
        email: 'beatriz@email.com',
        type: 'consocia',
        status: 'aguardando_aprovacao',
        submittedAt: new Date().toISOString(),
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: '1.0' },
      });

      const listRes = await listPublicConferenciaMembers(token, conferenciaId, repo);
      expect(listRes.success).toBe(true);
      expect(listRes.data?.find(m => m.fullName === 'Beatriz Martins')).toBeDefined();

      const item = listRes.data!.find(m => m.fullName === 'Beatriz Martins')!;
      const detailsRes = await getPublicMemberMaskedDetails(token, item.idOpaco, repo);
      expect(detailsRes.success).toBe(true);
      expect(detailsRes.data?.fullName).toBe('Beatriz Martins');
      expect(detailsRes.data?.type).toBe('consocia');
      expect(detailsRes.data?.maskedPhone).toBe('(16) 9****-2233');
    });
  });

  describe('3. Complementação de Solicitação Pendente', () => {
    it('deve vincular a complementação à solicitação pendente sem tentar atualizar membro oficial inexistente', async () => {
      repo.submissions.set('sub_orig_1', {
        id: 'sub_orig_1',
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Cláudio Ferreira',
        normalizedName: 'CLAUDIO FERREIRA',
        phone: '16991114455',
        normalizedPhone: '16991114455',
        type: 'aspirante',
        status: 'aguardando_aprovacao',
        submittedAt: new Date().toISOString(),
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: '1.0' },
      });

      const opaqueId = generateOpaqueMemberToken({
        originType: 'submission',
        realId: 'sub_orig_1',
        centralId,
        conferenciaId,
      });

      const submitRes = await submitPublicMemberUpdateRequest(
        token,
        opaqueId,
        {
          admissionDate: '2023-01-10',
          birthDate: '1990-10-15',
          consentAccepted: true,
        },
        repo
      );

      expect(submitRes.success).toBe(true);
      const complementacaoId = submitRes.data!.submissionId;
      const compSub = repo.submissions.get(complementacaoId);

      expect(compSub?.tipo).toBe('complementacao_cadastro');
      expect(compSub?.targetSubmissionId).toBe('sub_orig_1');
      expect(compSub?.targetMembroId).toBeUndefined(); // NÃO aponta para membro oficial
      expect(compSub?.requestedChanges?.admissionDate).toBe('2023-01-10');
      expect(compSub?.requestedChanges?.birthDate).toBe('1990-10-15');
    });
  });

  describe('4. Aprovação em Ordens Diferentes (Sem Duplicidade de Membro)', () => {
    it('Ordem A: Aprovação da complementação primeiro deve unificar dados, criar 1 membro único e aprovar ambas as solicitações', async () => {
      // 1. Solicitação original
      const origSub = await repo.createSubmission({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Daniela Alencar',
        normalizedName: 'DANIELA ALENCAR',
        phone: '16992223344',
        normalizedPhone: '16992223344',
        email: 'daniela@ssvp.org.br',
        type: 'consocia',
        status: 'aguardando_aprovacao',
        submittedAt: new Date().toISOString(),
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: '1.0' },
      });

      // 2. Complementação vinculada
      const compSub = await repo.createSubmission({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Daniela Alencar',
        normalizedName: 'DANIELA ALENCAR',
        phone: '16992223344',
        normalizedPhone: '16992223344',
        email: 'daniela@ssvp.org.br',
        admissionDate: '2021-04-10',
        acclamationDate: '2022-04-10',
        type: 'consocia',
        status: 'aguardando_aprovacao',
        submittedAt: new Date().toISOString(),
        tipo: 'complementacao_cadastro',
        targetSubmissionId: origSub.id,
        requestedChanges: { admissionDate: '2021-04-10', acclamationDate: '2022-04-10' },
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: '1.0' },
      });

      const initialMemberCount = repo.membros.size;

      // Aprova a COMPLEMENTAÇÃO primeiro
      const auth = { allowed: true, validatedCentralId: centralId, userId: 'admin_1' };
      const appRes = await approveMemberSubmission(compSub.id, centralId, auth, repo);

      expect(appRes.success).toBe(true);
      const createdMembroId = appRes.data!.membroId;

      // Deve ter criado EXATAMENTE 1 novo membro
      expect(repo.membros.size).toBe(initialMemberCount + 1);

      const membro = repo.membros.get(createdMembroId);
      expect(membro.fullName).toBe('Daniela Alencar');
      expect(membro.email).toBe('daniela@ssvp.org.br'); // veio da sub original
      expect(membro.admissionDate).toBe('2021-04-10'); // veio da complementação
      expect(membro.acclamationDate).toBe('2022-04-10'); // veio da complementação

      // Ambas as solicitações devem estar com status 'aprovado' e apontando para o mesmo membroId
      expect(repo.submissions.get(compSub.id)?.status).toBe('aprovado');
      expect(repo.submissions.get(compSub.id)?.membroId).toBe(createdMembroId);
      expect(repo.submissions.get(origSub.id)?.status).toBe('aprovado');
      expect(repo.submissions.get(origSub.id)?.membroId).toBe(createdMembroId);
    });

    it('Ordem B: Aprovação do primeiro cadastro primeiro, seguida de aprovação da complementação, deve atualizar o membro existente sem criar duplicidade', async () => {
      // 1. Solicitação original
      const origSub = await repo.createSubmission({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Eduardo Ramos',
        normalizedName: 'EDUARDO RAMOS',
        phone: '16993334455',
        normalizedPhone: '16993334455',
        type: 'confrade',
        status: 'aguardando_aprovacao',
        submittedAt: new Date().toISOString(),
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: '1.0' },
      });

      // 2. Complementação vinculada
      const compSub = await repo.createSubmission({
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Eduardo Ramos',
        normalizedName: 'EDUARDO RAMOS',
        phone: '16993334455',
        normalizedPhone: '16993334455',
        birthDate: '1988-08-18',
        admissionDate: '2019-02-20',
        type: 'confrade',
        status: 'aguardando_aprovacao',
        submittedAt: new Date().toISOString(),
        tipo: 'complementacao_cadastro',
        targetSubmissionId: origSub.id,
        requestedChanges: { birthDate: '1988-08-18', admissionDate: '2019-02-20' },
        consent: { accepted: true, acceptedAt: new Date().toISOString(), termVersion: '1.0' },
      });

      const initialMemberCount = repo.membros.size;
      const auth = { allowed: true, validatedCentralId: centralId, userId: 'admin_1' };

      // 1º Passo: Aprova o PRIMEIRO CADASTRO
      const appOrigRes = await approveMemberSubmission(origSub.id, centralId, auth, repo);
      expect(appOrigRes.success).toBe(true);
      const originalMembroId = appOrigRes.data!.membroId;
      expect(repo.membros.size).toBe(initialMemberCount + 1);

      // 2º Passo: Aprova a COMPLEMENTAÇÃO posteriormente
      const appCompRes = await approveMemberSubmission(compSub.id, centralId, auth, repo);
      expect(appCompRes.success).toBe(true);
      expect(appCompRes.data!.membroId).toBe(originalMembroId); // mesmo membroId!

      // NÃO pode ter criado outro membro (total de membros permanece +1)
      expect(repo.membros.size).toBe(initialMemberCount + 1);

      // O membro existente deve ter recebido as datas complementadas
      const membroAtualizado = repo.membros.get(originalMembroId);
      expect(membroAtualizado.birthDate).toBe('1988-08-18');
      expect(membroAtualizado.admissionDate).toBe('2019-02-20');
    });
  });

  describe('5. Bloqueio de Duplicidade de Solicitações Pendentes', () => {
    it('deve impedir o envio de múltiplas complementações simultâneas para o mesmo alvo', async () => {
      repo.membros.set('m_dupl', {
        id: 'm_dupl',
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Fernando Costa',
        normalizedName: 'FERNANDO COSTA',
        phone: '16994445566',
        normalizedPhone: '16994445566',
        type: 'confrade',
        status: 'ativo',
      });

      const opaqueId = generateOpaqueMemberToken({
        originType: 'membro',
        realId: 'm_dupl',
        centralId,
        conferenciaId,
      });

      // Primeiro envio
      const res1 = await submitPublicMemberUpdateRequest(
        token,
        opaqueId,
        { phone: '16994440000', consentAccepted: true },
        repo
      );
      expect(res1.success).toBe(true);

      // Segundo envio enquanto o primeiro está pendente
      const res2 = await submitPublicMemberUpdateRequest(
        token,
        opaqueId,
        { email: 'fernando.novo@email.com', consentAccepted: true },
        repo
      );
      expect(res2.success).toBe(false);
      expect(res2.code).toBe('ALREADY_PENDING_UPDATE');
    });
  });

  describe('6. Expiração e Integridade do Identificador Opaco (idOpaco)', () => {
    it('deve rejeitar identificador opaco com TTL expirado', () => {
      const expiredOpaque = generateOpaqueMemberToken({
        originType: 'membro',
        realId: 'm_exp',
        centralId,
        conferenciaId,
        ttlMs: -1000, // expirado há 1 segundo
      });

      const decoded = verifyAndDecodeOpaqueMemberToken(expiredOpaque, centralId);
      expect(decoded).toBeNull();
    });

    it('deve rejeitar identificador opaco com assinatura HMAC adulterada', () => {
      const validOpaque = generateOpaqueMemberToken({
        originType: 'membro',
        realId: 'm_tamper',
        centralId,
        conferenciaId,
      });

      const [payloadPart] = validOpaque.split('.');
      const tamperedOpaque = `${payloadPart}.assinatura_falsa_12345`;

      const decoded = verifyAndDecodeOpaqueMemberToken(tamperedOpaque, centralId);
      expect(decoded).toBeNull();
    });
  });

  describe('7. Validação Estrita de Datas Incoerentes e Futuras', () => {
    it('deve rejeitar data de ingresso posterior à aclamação ou proclamação', () => {
      const res1 = validatePublicMemberUpdateInput({
        admissionDate: '2022-01-01',
        acclamationDate: '2020-01-01',
        consentAccepted: true,
      });
      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain('A Data de Ingresso não pode ser posterior à Data de Aclamação.');

      const res2 = validatePublicMemberUpdateInput({
        acclamationDate: '2023-01-01',
        proclamationDate: '2021-01-01',
        consentAccepted: true,
      });
      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain('A Data de Aclamação não pode ser posterior à Data de Proclamação.');
    });

    it('deve rejeitar datas futuras além de hoje', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = validatePublicMemberUpdateInput({
        admissionDate: tomorrow,
        consentAccepted: true,
      });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('A Data de Ingresso não pode ser uma data futura.');
    });
  });

  describe('8. Preservação de Dados: Campos Vazios Não Apagam Dados Existentes', () => {
    it('deve preservar dados pré-existentes de contato e cadastro quando campos são omitidos na atualização', async () => {
      const originalMembro = {
        id: 'm_intacto',
        centralId,
        particularId,
        conferenciaId,
        fullName: 'Gabriela Vasconcelos',
        normalizedName: 'GABRIELA VASCONCELOS',
        phone: '16997778899',
        normalizedPhone: '16997778899',
        email: 'gabriela.importante@email.com',
        birthDate: '1982-11-25',
        admissionDate: '2012-06-01',
        acclamationDate: '2013-06-01',
        type: 'consocia',
        status: 'ativo',
      };
      repo.membros.set('m_intacto', originalMembro);

      const opaqueId = generateOpaqueMemberToken({
        originType: 'membro',
        realId: 'm_intacto',
        centralId,
        conferenciaId,
      });

      // Atualiza SOMENTE a data de proclamação (telefone, email, nascimento mantidos intocados)
      const updateRes = await submitPublicMemberUpdateRequest(
        token,
        opaqueId,
        {
          proclamationDate: '2015-09-10',
          consentAccepted: true,
        },
        repo
      );
      expect(updateRes.success).toBe(true);

      const auth = { allowed: true, validatedCentralId: centralId, userId: 'admin_1' };
      await approveMemberSubmission(updateRes.data!.submissionId, centralId, auth, repo);

      const posUpdate = repo.membros.get('m_intacto');
      expect(posUpdate.proclamationDate).toBe('2015-09-10'); // atualizado
      // Todos os outros dados permanecem rigorosamente inalterados:
      expect(posUpdate.email).toBe('gabriela.importante@email.com');
      expect(posUpdate.phone).toBe('16997778899');
      expect(posUpdate.birthDate).toBe('1982-11-25');
      expect(posUpdate.admissionDate).toBe('2012-06-01');
      expect(posUpdate.acclamationDate).toBe('2013-06-01');
      expect(posUpdate.fullName).toBe('Gabriela Vasconcelos');
      expect(posUpdate.type).toBe('consocia');
    });
  });
});
