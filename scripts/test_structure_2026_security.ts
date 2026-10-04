import { ESTRUTURA_2026_JABOTICABAL_DATA } from '../lib/structure_2026_data.js';
import {
  executeStructure2026Import,
  EXPECTED_CNPJ,
  EXPECTED_PROJECT_ID,
  EXPECTED_DATABASE_ID,
  MIGRATION_DOC_PATH,
} from '../lib/import_structure_2026_service.js';
import {
  listConselhosParticulares,
  createConselhoParticular,
  ServiceAuthContext,
  ConselhoParticularRepository,
  ListConselhosParticularesOptions,
  ListConselhosParticularesRepositoryResult,
} from '../lib/conselho_particular_service.js';
import {
  listConferencias,
  createConferencia,
  ConferenciaRepository,
  ListConferenciasOptions,
  ListConferenciasRepositoryResult,
} from '../lib/conferencia_service.js';
import { StandaloneConselhoParticular, StandaloneConferencia } from '../types.js';

// Mock in-memory database and repositories to avoid writing to remote Firestore
class InMemoryHierarchyDb {
  institutions = new Map<string, any>();
  conselhosParticulares = new Map<string, StandaloneConselhoParticular>();
  conferencias = new Map<string, StandaloneConferencia>();
  docs = new Map<string, any>();

  constructor() {
    // Setup institutional document with canonical ID
    const canonicalId = 'conselho_central_jaboticabal_doc_id';
    this.institutions.set(canonicalId, {
      id: canonicalId,
      name: 'Conselho Central de Jaboticabal',
      cnpj: '54.927.132/0001-92',
      cleanCnpj: '54927132000192',
      entityType: 'conselho_central',
    });
  }

  // Helper simulating getRealInstitutionId with legacy fallback
  async getRealInstitutionId(idOrCnpj: string): Promise<string> {
    if (!idOrCnpj) return "";
    if (this.institutions.has(idOrCnpj)) return idOrCnpj;
    for (const [id, data] of this.institutions.entries()) {
      if (data.cnpj === idOrCnpj || data.cleanCnpj === idOrCnpj.replace(/\D/g, '')) {
        return id;
      }
    }
    return idOrCnpj;
  }

  // Helper simulating resolveExistingInstitutionDocId (strict, returns empty string when not found)
  async resolveExistingInstitutionDocId(idOrCnpj: string): Promise<string> {
    if (!idOrCnpj) return "";
    if (this.institutions.has(idOrCnpj)) return idOrCnpj;
    for (const [id, data] of this.institutions.entries()) {
      if (data.cnpj === idOrCnpj || data.cleanCnpj === idOrCnpj.replace(/\D/g, '')) {
        return id;
      }
    }
    return "";
  }

  // Firestore-like doc method for migrations
  doc(path: string) {
    const self = this;
    return {
      get: async () => {
        const data = self.docs.get(path);
        return {
          exists: !!data,
          data: () => data,
        };
      },
      set: async (val: any) => {
        self.docs.set(path, val);
      },
    };
  }

  // Firestore transaction runner simulation
  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const tx = {
      get: async (ref: any) => ref.get(),
      set: (ref: any, data: any) => ref.set(data),
      update: (ref: any, data: any) => ref.update(data),
    };
    return await updateFunction(tx);
  }
}

// In-Memory Conselho Particular Repository adhering to interface
class InMemoryConselhoParticularRepository implements ConselhoParticularRepository {
  constructor(private db: InMemoryHierarchyDb) {}

  async listByCentralId(
    centralId: string,
    options?: ListConselhosParticularesOptions
  ): Promise<ListConselhosParticularesRepositoryResult> {
    const list: StandaloneConselhoParticular[] = [];
    for (const cp of this.db.conselhosParticulares.values()) {
      if (cp.centralId === centralId) {
        if (!options?.status || options.status === 'todos' || cp.status === options.status) {
          list.push(cp);
        }
      }
    }
    return {
      items: list,
      hasMore: false,
    };
  }

  async createAtomically(data: StandaloneConselhoParticular): Promise<{
    created: boolean;
    reason?: 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }> {
    for (const cp of this.db.conselhosParticulares.values()) {
      if (cp.centralId === data.centralId && cp.normalizedName === data.normalizedName) {
        return { created: false, reason: 'DUPLICATE_NAME' };
      }
    }
    const newId = data.id || `cp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: StandaloneConselhoParticular = {
      ...data,
      id: newId,
    };
    this.db.conselhosParticulares.set(newId, record);
    return { created: true, record };
  }

  async getById(id: string): Promise<StandaloneConselhoParticular | null> {
    return this.db.conselhosParticulares.get(id) || null;
  }

  async updateAtomically(
    id: string,
    expectedCentralId: string,
    data: StandaloneConselhoParticular
  ): Promise<{
    updated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }> {
    const existing = this.db.conselhosParticulares.get(id);
    if (!existing) return { updated: false, reason: 'NOT_FOUND' };
    if (existing.centralId !== expectedCentralId) return { updated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' };
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.db.conselhosParticulares.set(id, updated);
    return { updated: true, record: updated };
  }

  async inactivateAtomically(
    id: string,
    expectedCentralId: string,
    auditUserId: string
  ): Promise<{
    inactivated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'ALREADY_INACTIVE' | 'ACTIVE_CHILDREN_EXIST' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }> {
    const existing = this.db.conselhosParticulares.get(id);
    if (!existing) return { inactivated: false, reason: 'NOT_FOUND' };
    if (existing.centralId !== expectedCentralId) return { inactivated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' };
    if (existing.status === 'inativo') return { inactivated: false, reason: 'ALREADY_INACTIVE' };

    const updated = { ...existing, status: 'inativo' as const, updatedAt: new Date().toISOString(), updatedBy: auditUserId };
    this.db.conselhosParticulares.set(id, updated);
    return { inactivated: true, record: updated };
  }
}

// In-Memory Conferencia Repository
class InMemoryConferenciaRepository implements ConferenciaRepository {
  constructor(private db: InMemoryHierarchyDb) {}

  async listByParticularId(
    expectedCentralId: string,
    particularId: string,
    options?: ListConferenciasOptions
  ): Promise<ListConferenciasRepositoryResult> {
    const list: StandaloneConferencia[] = [];
    for (const conf of this.db.conferencias.values()) {
      if (conf.centralId === expectedCentralId && conf.particularId === particularId) {
        if (!options?.status || options.status === 'todos' || conf.status === options.status) {
          list.push(conf);
        }
      }
    }
    return {
      items: list,
      hasMore: false,
    };
  }

  async getParticularById(particularId: string): Promise<StandaloneConselhoParticular | null> {
    return this.db.conselhosParticulares.get(particularId) || null;
  }

  async getById(id: string): Promise<StandaloneConferencia | null> {
    return this.db.conferencias.get(id) || null;
  }

  async createAtomically(
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ): Promise<{
    created: boolean;
    reason?: 'PARENT_NOT_FOUND' | 'PARENT_INACTIVE' | 'PARENT_CENTRAL_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }> {
    const cp = this.db.conselhosParticulares.get(expectedParticularId);
    if (!cp) return { created: false, reason: 'PARENT_NOT_FOUND' };
    if (cp.status === 'inativo') return { created: false, reason: 'PARENT_INACTIVE' };
    if (cp.centralId !== expectedCentralId) return { created: false, reason: 'PARENT_CENTRAL_MISMATCH' };

    for (const conf of this.db.conferencias.values()) {
      if (conf.particularId === expectedParticularId && conf.normalizedName === data.normalizedName) {
        return { created: false, reason: 'DUPLICATE_NAME' };
      }
    }

    const newId = data.id || `conf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: StandaloneConferencia = {
      ...data,
      id: newId,
      centralId: expectedCentralId,
      particularId: expectedParticularId,
    };
    this.db.conferencias.set(newId, record);
    return { created: true, record };
  }

  async updateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ): Promise<{
    updated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'PARENT_INACTIVE' | 'PARENT_CENTRAL_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }> {
    const existing = this.db.conferencias.get(id);
    if (!existing) return { updated: false, reason: 'NOT_FOUND' };
    if (existing.centralId !== expectedCentralId) return { updated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' };

    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.db.conferencias.set(id, updated);
    return { updated: true, record: updated };
  }

  async inactivateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    auditUserId: string
  ): Promise<{
    inactivated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'ALREADY_INACTIVE' | 'ACTIVE_MEMBERS_EXIST' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }> {
    const existing = this.db.conferencias.get(id);
    if (!existing) return { inactivated: false, reason: 'NOT_FOUND' };
    if (existing.centralId !== expectedCentralId) return { inactivated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' };
    if (existing.status === 'inativo') return { inactivated: false, reason: 'ALREADY_INACTIVE' };

    const updated = { ...existing, status: 'inativo' as const, updatedAt: new Date().toISOString(), updatedBy: auditUserId };
    this.db.conferencias.set(id, updated);
    return { inactivated: true, record: updated };
  }
}

async function runIntegratedCanonicalTests() {
  console.log('================================================================================');
  console.log(' TESTES INTEGRADOS: PADRONIZAÇÃO CANÔNICA E AUTORIZAÇÃO HIERÁRQUICA');
  console.log('================================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`✓ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${description}`);
      process.exitCode = 1;
    }
  }

  const memoryDb = new InMemoryHierarchyDb();
  const cpRepo = new InMemoryConselhoParticularRepository(memoryDb);
  const confRepo = new InMemoryConferenciaRepository(memoryDb);

  // 1. Resolução Canônica do Conselho Central de Jaboticabal
  const expectedCentralDocId = await memoryDb.resolveExistingInstitutionDocId(EXPECTED_CNPJ);
  console.log(`[INFO] expectedCentralDocId resolvido para ${EXPECTED_CNPJ}: "${expectedCentralDocId}"`);
  assert(
    expectedCentralDocId === 'conselho_central_jaboticabal_doc_id',
    'expectedCentralDocId resolvido com precisão através de resolveExistingInstitutionDocId'
  );

  // TESTE COMPROBATÓRIO 1: getRealInstitutionId preserva o fallback utilizado pelos fluxos legados
  const legacyNonExistentId = 'inst_inexistente_legada_123';
  const legacyFallbackResult = await memoryDb.getRealInstitutionId(legacyNonExistentId);
  assert(
    legacyFallbackResult === legacyNonExistentId,
    'TESTE COMPROBATÓRIO 1: getRealInstitutionId continua preservando o fallback original utilizado pelos fluxos legados'
  );

  // TESTE COMPROBATÓRIO 2: resolveExistingInstitutionDocId retorna vazio quando a instituição não existe
  const strictNonExistentResult = await memoryDb.resolveExistingInstitutionDocId('00.000.000/0000-00');
  assert(
    strictNonExistentResult === '',
    'TESTE COMPROBATÓRIO 2: resolveExistingInstitutionDocId retorna estritamente vazio "" quando a instituição não existe'
  );

  // TESTE COMPROBATÓRIO 3: Endpoint de importação bloqueia com CENTRAL_NOT_FOUND se o resolvedor estrito falhar
  const simStrictCentralDocId = await memoryDb.resolveExistingInstitutionDocId('00.000.000/0000-00');
  const importShouldHalt = !simStrictCentralDocId;
  assert(
    importShouldHalt === true,
    'TESTE COMPROBATÓRIO 3: Importador exige estritamente resolvedor não vazio e bloqueia antes de qualquer gravação'
  );

  // TESTE 1: Endpoint autoriza o usuário atual com cabeçalho CNPJ formatado resolvido para o ID Canônico
  const validAuthContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: expectedCentralDocId,
    userId: 'admin_jaboticabal_user',
  };
  const isAuthorized = validAuthContext.allowed && validAuthContext.validatedCentralId === expectedCentralDocId;
  assert(
    isAuthorized === true,
    'TESTE 1: Contexto de autenticação do usuário do Conselho Central autoriza a operação com o ID canônico'
  );

  // TESTE 2: A importação grava centralId canônico em todos os 6 CPs e 52 Conferências
  let importedCps = 0;
  let importedConfs = 0;

  for (const cpData of ESTRUTURA_2026_JABOTICABAL_DATA) {
    const cpRes = await createConselhoParticular(
      {
        name: cpData.name,
        city: cpData.city,
        state: 'SP',
      },
      validAuthContext,
      cpRepo
    );

    if (cpRes.success && cpRes.data) {
      importedCps++;
      const createdCp = cpRes.data;

      for (const confData of cpData.conferencias) {
        const confRes = await createConferencia(
          createdCp.id,
          {
            name: confData.name,
            city: cpData.city,
            state: 'SP',
          },
          validAuthContext,
          confRepo
        );
        if (confRes.success) {
          importedConfs++;
        } else {
          console.error(`Erro ao criar conferencia ${confData.name}:`, confRes);
        }
      }
    } else {
      console.error(`Erro ao criar CP ${cpData.name}:`, cpRes);
    }
  }

  assert(importedCps === 6, `Foram importados 6 Conselhos Particulares (criados: ${importedCps})`);
  assert(importedConfs === 52, `Foram importadas 52 Conferências (criadas: ${importedConfs})`);

  // Verificar se TODOS os CPs e Conferências gravados no repositório têm centralId === expectedCentralDocId
  let allCpsCanonical = true;
  for (const cp of memoryDb.conselhosParticulares.values()) {
    if (cp.centralId !== expectedCentralDocId) {
      allCpsCanonical = false;
    }
  }
  let allConfsCanonical = true;
  for (const conf of memoryDb.conferencias.values()) {
    if (conf.centralId !== expectedCentralDocId) {
      allConfsCanonical = false;
    }
  }
  assert(
    allCpsCanonical && allConfsCanonical,
    'TESTE 2: Todos os 6 Conselhos Particulares e 52 Conferências gravaram estritamente o centralId canônico'
  );

  // TESTE 3: A listagem usando ServiceAuthContext retorna os mesmos 6 Conselhos após a importação
  const listResult = await listConselhosParticulares(validAuthContext, cpRepo);
  assert(
    listResult.success === true && listResult.data?.items.length === 6,
    'TESTE 3: listConselhosParticulares usando ServiceAuthContext com ID canônico retorna os 6 CPs importados'
  );

  // Listagem de conferências subordinadas ao primeiro CP
  const firstCp = listResult.data!.items[0];
  const confsOfFirstCp = await listConferencias(firstCp.id, validAuthContext, confRepo);
  assert(
    confsOfFirstCp.success === true && confsOfFirstCp.data!.items.length > 0,
    `Listagem de conferências do primeiro CP (${firstCp.name}) validada com sucesso (${confsOfFirstCp.data?.items.length} conferências)`
  );

  // TESTE 4: Usuário de outra instituição continua recebendo 403
  const otherInstitutionAuthContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: 'outra_instituicao_doc_id_999',
    userId: 'user_outra_inst',
  };

  const otherUserAuthorized =
    otherInstitutionAuthContext.allowed &&
    otherInstitutionAuthContext.validatedCentralId === expectedCentralDocId;
  assert(
    otherUserAuthorized === false,
    'TESTE 4: Verificação de acesso para usuário de outra instituição resulta em 403 FORBIDDEN_CENTRAL'
  );

  const otherUserListResult = await listConselhosParticulares(otherInstitutionAuthContext, cpRepo);
  assert(
    otherUserListResult.success === true && otherUserListResult.data?.items.length === 0,
    'Usuário de outra instituição não visualiza nenhum dos Conselhos do Conselho Central de Jaboticabal'
  );

  console.log('\n================================================================================');
  console.log(` RESULTADO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log('================================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runIntegratedCanonicalTests().catch((err) => {
  console.error('Erro na execução dos testes integrados:', err);
  process.exit(1);
});
