import { extractInitialPassword, sanitizeForUsername, handleMemberAccessAction } from '../lib/membro_auth_helper';

// In-memory mock Firestore for unit testing the Phase 2 business logic
class MockDocRef {
  id: string;
  dataStore: Map<string, any>;
  collectionName: string;

  constructor(id: string, dataStore: Map<string, any>, collectionName: string) {
    this.id = id;
    this.dataStore = dataStore;
    this.collectionName = collectionName;
  }

  async get() {
    const data = this.dataStore.get(`${this.collectionName}/${this.id}`);
    return {
      exists: !!data,
      id: this.id,
      data: () => data,
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    const key = `${this.collectionName}/${this.id}`;
    if (options?.merge && this.dataStore.has(key)) {
      const existing = this.dataStore.get(key);
      this.dataStore.set(key, { ...existing, ...data });
    } else {
      this.dataStore.set(key, data);
    }
    return Promise.resolve();
  }
}

class MockCollectionRef {
  name: string;
  dataStore: Map<string, any>;

  constructor(name: string, dataStore: Map<string, any>) {
    this.name = name;
    this.dataStore = dataStore;
  }

  doc(id?: string) {
    const docId = id || `gen-id-${Math.random().toString(36).substring(2, 9)}`;
    return new MockDocRef(docId, this.dataStore, this.name);
  }

  where(field: string, op: string, value: any) {
    return {
      get: async () => {
        const results: any[] = [];
        for (const [key, val] of this.dataStore.entries()) {
          if (key.startsWith(`${this.name}/`) && val[field] === value) {
            results.push({
              id: val.id || key.split('/')[1],
              data: () => val,
            });
          }
        }
        return {
          empty: results.length === 0,
          docs: results,
        };
      },
    };
  }
}

class MockFirestore {
  dataStore = new Map<string, any>();

  collection(name: string) {
    return new MockCollectionRef(name, this.dataStore);
  }
}

async function runTests() {
  console.log('--- INICIANDO TESTES AUTOMATIZADOS DA FASE 2 ---');
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, name: string) {
    if (cond) {
      console.log(`✅ PASSOU: ${name}`);
      passed++;
    } else {
      console.error(`❌ FALHOU: ${name}`);
      failed++;
    }
  }

  const db = new MockFirestore() as any;

  // 1. Teste de extração de senha DDMM
  assert(extractInitialPassword('1990-05-14') === '1405', 'Extração DDMM do formato YYYY-MM-DD');
  assert(extractInitialPassword('14/05/1990') === '1405', 'Extração DDMM do formato DD/MM/YYYY');
  assert(extractInitialPassword('') === null, 'Sem data de nascimento retorna null');

  // 2. Teste: Gerar acesso para membro ativo com data de nascimento
  const membro1Id = 'membro-1';
  db.dataStore.set(`membros_ssvp/${membro1Id}`, {
    id: membro1Id,
    fullName: 'Maria de Lurdes',
    status: 'ativo',
    birthDate: '1985-08-25',
    conferenciaId: 'conf-1',
    centralId: 'central-1',
  });

  const genResult = await handleMemberAccessAction(db, membro1Id, 'generate', 'admin-1');
  assert(genResult.success === true, 'Geração de acesso bem-sucedida');
  assert(genResult.hasAccess === true, 'hasAccess é true após geração');
  assert(genResult.accessStatus === 'Acesso ativo', 'Status de acesso é Acesso ativo');
  assert(genResult.username?.startsWith('maria'), 'Username gerado inicia com primeiro nome');

  // 3. Teste: Impedir redefinição de senha para membro sem data de nascimento
  const membroSemNascId = 'membro-sem-nasc';
  db.dataStore.set(`membros_ssvp/${membroSemNascId}`, {
    id: membroSemNascId,
    fullName: 'Jose Sem Data',
    status: 'ativo',
    userId: 'user-sem-nasc',
    conferenciaId: 'conf-1',
    centralId: 'central-1',
  });

  const resetSemDataResult = await handleMemberAccessAction(db, membroSemNascId, 'reset-password', 'admin-1');
  assert(resetSemDataResult.success === false, 'Bloqueio de redefinição sem data de nascimento');
  assert(
    resetSemDataResult.message.includes('data de nascimento não está cadastrada'),
    'Mensagem correta sobre data de nascimento não cadastrada'
  );

  // 4. Teste: Redefinição de senha para DDMM com sucesso quando membro tem data de nascimento e usuário
  const user1Data = db.dataStore.get(`users/${genResult.membro?.userId}`);
  assert(user1Data !== undefined, 'Documento de usuário existe no banco');

  const resetOkResult = await handleMemberAccessAction(db, membro1Id, 'reset-password', 'admin-1');
  assert(resetOkResult.success === true, 'Redefinição de senha com sucesso');
  const user1AfterReset = db.dataStore.get(`users/${genResult.membro?.userId}`);
  assert(user1AfterReset.password === '2508', 'Senha no banco de dados foi atualizada para DDMM (2508)');

  // 5. Teste: Bloquear acesso
  const blockResult = await handleMemberAccessAction(db, membro1Id, 'block', 'admin-1');
  assert(blockResult.success === true, 'Bloqueio de acesso com sucesso');
  assert(blockResult.hasAccess === false, 'hasAccess é false após bloqueio');
  assert(blockResult.accessStatus === 'Acesso inativo', 'accessStatus é Acesso inativo após bloqueio');
  const userBlocked = db.dataStore.get(`users/${genResult.membro?.userId}`);
  assert(userBlocked.active === false, 'Documento do usuário tem active: false');

  // 6. Teste: Regra 1 - Membro inativo NÃO pode ter acesso desbloqueado
  const membroInativoId = 'membro-inativo';
  db.dataStore.set(`membros_ssvp/${membroInativoId}`, {
    id: membroInativoId,
    fullName: 'Carlos Inativo',
    status: 'inativo',
    userId: 'user-inativo',
    birthDate: '1970-01-01',
    conferenciaId: 'conf-1',
    centralId: 'central-1',
  });
  db.dataStore.set(`users/user-inativo`, {
    id: 'user-inativo',
    username: 'carlos',
    active: false,
  });

  const unblockInativoResult = await handleMemberAccessAction(db, membroInativoId, 'unblock', 'admin-1');
  assert(unblockInativoResult.success === false, 'Desbloqueio de membro inativo é rejeitado');
  assert(
    unblockInativoResult.message.includes('Um membro inativo não pode ter seu acesso desbloqueado'),
    'Mensagem informativa sobre membro inativo'
  );

  // 7. Teste: Desbloquear membro ativo com sucesso
  const unblockAtivoResult = await handleMemberAccessAction(db, membro1Id, 'unblock', 'admin-1');
  assert(unblockAtivoResult.success === true, 'Desbloqueio de membro ativo com sucesso');
  assert(unblockAtivoResult.hasAccess === true, 'hasAccess é true após desbloqueio');
  const userUnblocked = db.dataStore.get(`users/${genResult.membro?.userId}`);
  assert(userUnblocked.active === true, 'Documento do usuário voltou para active: true');

  console.log(`\n--- RESULTADO DOS TESTES: ${passed} PASSARAM, ${failed} FALHARAM ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
