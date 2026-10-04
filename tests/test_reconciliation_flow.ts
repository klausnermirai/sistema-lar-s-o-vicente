import {
  computeAllDedupKeys,
  normalizeStringForSearch,
  normalizePhoneStrict,
} from '../lib/member_deduplication_crypto.ts';
import {
  submitPublicMemberRegistration,
  reconcileAndSyncPendingSubmissions,
} from '../lib/public_member_registration_service.ts';
import type {
  PublicRegistrationRepository,
  PublicRegistrationTransaction,
  SolicitacaoCadastroMembro,
} from '../lib/public_member_registration_service.ts';

// Testes automatizados da nova rotina e testes de regressão do que já existia

class MockPublicRegistrationRepo implements PublicRegistrationRepository {
  public dedupKeys = new Map<string, any>();
  public members = new Map<string, any>();
  public submissions = new Map<string, any>();
  public tokens = new Map<string, any>();
  public cps = new Map<string, any>();
  public confs = new Map<string, any>();

  constructor() {
    this.tokens.set('valid_token', {
      token: 'valid_token',
      centralId: 'central_1',
      enabled: true,
    });
    this.cps.set('cp_1', {
      id: 'cp_1',
      centralId: 'central_1',
      status: 'ativo',
    });
    this.confs.set('conf_santa_rita', {
      id: 'conf_santa_rita',
      centralId: 'central_1',
      particularId: 'cp_1',
      conselhoParticularId: 'cp_1',
      name: 'Conferência Santa Rita',
      status: 'ativo',
    });
  }

  async getCentralTokenConfig(token: string) {
    return this.tokens.get(token) || null;
  }
  async getParticularById(id: string) {
    return this.cps.get(id) || null;
  }
  async getConferenciaById(id: string) {
    return this.confs.get(id) || null;
  }
  async getDedupKeyRecord(key: string) {
    return this.dedupKeys.get(key) || null;
  }
  async saveDedupKeyRecord(key: string, data: any) {
    this.dedupKeys.set(key, data);
  }
  async createMembroRecord(membro: any) {
    const id = `membro_${this.members.size + 1}`;
    const record = { ...membro, id };
    this.members.set(id, record);
    return { id };
  }
  async getMembroById(id: string) {
    return this.members.get(id) || null;
  }
  async listActiveMembersByConferencia(conferenciaId: string) {
    return Array.from(this.members.values()).filter(
      (m) => m.conferenciaId === conferenciaId && m.status === 'ativo'
    );
  }
  async listPendingSubmissionsByConferencia(conferenciaId: string) {
    return Array.from(this.submissions.values()).filter(
      (s) =>
        s.conferenciaId === conferenciaId &&
        ['aguardando_aprovacao', 'aguardando_revisao_duplicidade'].includes(s.status)
    );
  }
  async createSubmission(sub: any) {
    const id = sub.id || `sub_${this.submissions.size + 1}`;
    const record = { ...sub, id };
    this.submissions.set(id, record);
    return record;
  }
  async updateSubmission(id: string, updates: any) {
    const existing = this.submissions.get(id) || {};
    const updated = { ...existing, ...updates, id };
    this.submissions.set(id, updated);
    return updated;
  }
  async getSubmissionById(id: string) {
    return this.submissions.get(id) || null;
  }
  async listSubmissions(centralId: string, options?: any) {
    return Array.from(this.submissions.values()).filter((s) => {
      if (s.centralId !== centralId) return false;
      if (options?.status && s.status !== options.status) return false;
      if (options?.conferenciaId && s.conferenciaId !== options.conferenciaId) return false;
      return true;
    });
  }
  async findExistingMembers(centralId: string, name: string, phone?: string, email?: string) {
    return Array.from(this.members.values()).filter((m) => {
      if (m.centralId !== centralId) return false;
      if (m.normalizedName === name) return true;
      if (phone && m.normalizedPhone === phone) return true;
      if (email && m.email && m.email.toLowerCase() === email.toLowerCase()) return true;
      return false;
    });
  }

  async executeTransaction<T>(updateFunction: (txn: PublicRegistrationTransaction) => Promise<T>): Promise<T> {
    const self = this;
    const txn: PublicRegistrationTransaction = {
      async getCentralTokenConfig(token: string) {
        return self.getCentralTokenConfig(token);
      },
      async getRequestId(reqId: string) {
        return null;
      },
      async saveRequestId(reqId: string, res: any) {},
      async getDedupKey(key: string) {
        return self.dedupKeys.get(key) || null;
      },
      async setDedupKey(key: string, data: any) {
        self.dedupKeys.set(key, data);
      },
      async getParticularById(id: string) {
        return self.getParticularById(id);
      },
      async getConferenciaById(id: string) {
        return self.getConferenciaById(id);
      },
      async getMembroById(id: string) {
        return self.getMembroById(id);
      },
      async createMembroRecord(membro: any) {
        return self.createMembroRecord(membro);
      },
      async updateMembroRecord(id: string, updates: any) {
        const m = self.members.get(id);
        if (m) self.members.set(id, { ...m, ...updates });
      },
      async getSubmissionById(id: string) {
        return self.getSubmissionById(id);
      },
      async createSubmission(sub: any) {
        return self.createSubmission(sub);
      },
      async updateSubmission(id: string, updates: any) {
        return self.updateSubmission(id, updates);
      },
      async saveAuditLog(log: any) {},
    };
    return await updateFunction(txn);
  }
}

async function runTests() {
  console.log('--- INICIANDO BATERIA DE TESTES DE REGRESSÃO E VALIDAÇÃO ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Teste de Autocadastro de 7 membros na Conferência Santa Rita (sem colisão indevida)
  const repo = new MockPublicRegistrationRepo();
  const membrosSantaRita = [
    { fullName: 'Ana Paula Silva', phone: '(16) 99111-0001', email: 'ana@teste.com', type: 'consocia' },
    { fullName: 'Carlos Alberto Souza', phone: '(16) 99111-0002', email: 'carlos@teste.com', type: 'confrade' },
    { fullName: 'Beatriz Santos', phone: '(16) 99111-0003', email: 'beatriz@teste.com', type: 'consocia' },
    { fullName: 'Daniel Oliveira', phone: '(16) 99111-0004', email: 'daniel@teste.com', type: 'confrade' },
    { fullName: 'Elena Martins', phone: '(16) 99111-0005', email: 'elena@teste.com', type: 'consocia' },
    { fullName: 'Fernando Lima', phone: '(16) 99111-0006', email: 'fernando@teste.com', type: 'confrade' },
    { fullName: 'Gabriela Costa', phone: '(16) 99111-0007', email: 'gabriela@teste.com', type: 'consocia' },
  ];

  for (let i = 0; i < membrosSantaRita.length; i++) {
    const m = membrosSantaRita[i];
    const res = await submitPublicMemberRegistration(
      'valid_token',
      {
        particularId: 'cp_1',
        conferenciaId: 'conf_santa_rita',
        fullName: m.fullName,
        phone: m.phone,
        email: m.email,
        type: m.type,
        termVersion: '1.0',
      },
      repo
    );
    assert(
      res.success && res.data?.status === 'processado_automaticamente',
      `Submissão ${i + 1} (${m.fullName}) processada automaticamente`
    );
  }

  assert(repo.members.size === 7, 'Exatamente 7 membros registrados no banco de membros_ssvp');
  assert(repo.submissions.size === 7, 'Exatamente 7 solicitações registradas');

  // 2. Teste de submissão por terceiro com mesmo telefone de representante (não bloqueia membro legítimo)
  const repRes = await submitPublicMemberRegistration(
    'valid_token',
    {
      particularId: 'cp_1',
      conferenciaId: 'conf_santa_rita',
      fullName: 'Helena Costa Filho',
      phone: '(16) 99111-0001', // Mesmo telefone da mãe/representante Ana Paula
      isThirdPartySubmission: true,
      representativeName: 'Ana Paula Silva',
      termVersion: '1.0',
    },
    repo
  );
  assert(
    repRes.success && repRes.data?.status === 'processado_automaticamente',
    'Submissão por terceiro com telefone compartilhado de familiar foi aceita com sucesso'
  );

  // 3. Teste da Rotina de Conciliação e Sincronização em Massa
  // Simular uma solicitação com status processado_automaticamente que porventura perdeu o vínculo
  const orphanSub = await repo.createSubmission({
    centralId: 'central_1',
    particularId: 'cp_1',
    conferenciaId: 'conf_santa_rita',
    fullName: 'Igor Rocha',
    phone: '(16) 99222-3344',
    email: 'igor@teste.com',
    type: 'confrade',
    status: 'processado_automaticamente',
    membroId: undefined, // Sem membroId vinculado
  });

  const authContext = {
    allowed: true,
    validatedCentralId: 'central_1',
    userId: 'admin_test',
    userRole: 'admin',
  };

  const syncRes = await reconcileAndSyncPendingSubmissions('central_1', authContext as any, repo);
  assert(syncRes.success === true, 'Rotina de conciliação executada com sucesso');
  assert((syncRes.data?.syncedCount ?? 0) >= 1, 'Pelo menos 1 membro órfão foi reconciliado e criado');
  assert(
    repo.members.has((repo.submissions.get(orphanSub.id) as any)?.membroId),
    'Membro órfão teve membro_ssvp criado e id vinculado na solicitação'
  );

  console.log(`\n========================================`);
  console.log(`RESULTADO FINAL: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
