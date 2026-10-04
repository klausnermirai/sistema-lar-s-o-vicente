import {
  createConselhoParticular,
  updateConselhoParticular,
  inactivateConselhoParticular,
  listConselhosParticulares,
  ConselhoParticularRepository,
  ListConselhosParticularesOptions,
  ServiceAuthContext,
} from '../lib/conselho_particular_service.js';
import { StandaloneConselhoParticular } from '../types.js';

let passedTests = 0;
let failedTests = 0;

function assertEqual(actual: any, expected: any, message: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    console.log(`  ✓ PASSED: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${message}\n    Expected: ${JSON.stringify(expected)}\n    Actual:   ${JSON.stringify(actual)}`);
    failedTests++;
  }
}

console.log('===================================================');
console.log(' Executando Testes do Serviço de Conselho Particular');
console.log('===================================================\n');

/**
 * Repositório Simulado completo para os testes de Criação, Edição, Inativação e Listagem.
 */
class MockConselhoParticularRepository implements ConselhoParticularRepository {
  public records: Map<string, StandaloneConselhoParticular> = new Map();
  public activeChildrenCountMap: Map<string, number> = new Map();
  private idCounter = 0;

  public createCallCount = 0;
  public getByIdCallCount = 0;
  public updateCallCount = 0;
  public inactivateCallCount = 0;
  public listCallCount = 0;

  public shouldThrowOnCreate = false;
  public shouldThrowOnUpdate = false;
  public shouldThrowOnInactivate = false;
  public shouldThrowOnList = false;

  async listByCentralId(centralId: string, options?: ListConselhosParticularesOptions) {
    this.listCallCount++;
    if (this.shouldThrowOnList) {
      throw new Error('Erro interno confidencial do driver na listagem');
    }

    const status = options?.status || 'ativo';
    const limit = options?.limit ?? 50;
    const cursor = options?.cursor;

    let items = Array.from(this.records.values()).filter(
      (r) => r.centralId === centralId
    );

    if (status !== 'todos') {
      items = items.filter((r) => r.status === status);
    }

    items.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

    if (cursor) {
      const idx = items.findIndex((r) => r.normalizedName === cursor);
      if (idx !== -1) {
        items = items.slice(idx + 1);
      }
    }

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1].normalizedName : undefined;

    return {
      items: resultItems,
      nextCursor,
      hasMore,
    };
  }

  async createAtomically(data: StandaloneConselhoParticular) {
    this.createCallCount++;
    if (this.shouldThrowOnCreate) {
      throw new Error('Erro interno confidencial do banco na criação');
    }

    // Verificar nome duplicado no mesmo centralId
    for (const rec of this.records.values()) {
      if (rec.centralId === data.centralId && rec.normalizedName === data.normalizedName) {
        return { created: false, reason: 'DUPLICATE_NAME' as const };
      }
    }

    this.idCounter++;
    const newId = data.id || `cp-${Date.now()}-${this.idCounter}`;
    const recordToSave: StandaloneConselhoParticular = { ...data, id: newId };
    this.records.set(newId, recordToSave);

    return { created: true, record: recordToSave };
  }

  async getById(id: string) {
    this.getByIdCallCount++;
    const rec = this.records.get(id);
    return rec ? { ...rec } : null;
  }

  async updateAtomically(id: string, expectedCentralId: string, data: StandaloneConselhoParticular) {
    this.updateCallCount++;
    if (this.shouldThrowOnUpdate) {
      throw new Error('Erro interno confidencial do banco na atualização');
    }

    const existing = this.records.get(id);
    if (!existing) {
      return { updated: false, reason: 'NOT_FOUND' as const };
    }

    if (existing.centralId !== expectedCentralId) {
      return { updated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
    }

    // Verificar duplicidade de nome desconsiderando o próprio id
    for (const rec of this.records.values()) {
      if (rec.id !== id && rec.centralId === expectedCentralId && rec.normalizedName === data.normalizedName) {
        return { updated: false, reason: 'DUPLICATE_NAME' as const };
      }
    }

    const updatedRecord: StandaloneConselhoParticular = {
      ...data,
      id,
      centralId: expectedCentralId,
    };
    this.records.set(id, updatedRecord);

    return { updated: true, record: updatedRecord };
  }

  async inactivateAtomically(id: string, expectedCentralId: string, auditUserId: string) {
    this.inactivateCallCount++;
    if (this.shouldThrowOnInactivate) {
      throw new Error('Erro interno confidencial do banco na inativação');
    }

    const existing = this.records.get(id);
    if (!existing) {
      return { inactivated: false, reason: 'NOT_FOUND' as const };
    }

    if (existing.centralId !== expectedCentralId) {
      return { inactivated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
    }

    if (existing.status === 'inativo') {
      return { inactivated: false, reason: 'ALREADY_INACTIVE' as const };
    }

    const activeChildren = this.activeChildrenCountMap.get(id) || 0;
    if (activeChildren > 0) {
      return { inactivated: false, reason: 'ACTIVE_CHILDREN_EXIST' as const };
    }

    const inactivatedRecord: StandaloneConselhoParticular = {
      ...existing,
      status: 'inativo',
      updatedAt: new Date().toISOString(),
      updatedBy: auditUserId,
    };
    this.records.set(id, inactivatedRecord);

    return { inactivated: true, record: inactivatedRecord };
  }
}

async function runTests() {
  const validAuthContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: 'central-100',
    userId: 'user-operator-01',
  };

  const validFormPayload = {
    name: 'Conselho Particular São Vicente',
    city: 'Belo Horizonte',
    phone: '(31) 98765-4321',
    status: 'ativo',
  };

  // ====================================================
  // PARTE 1: TESTES DE CRIAÇÃO (createConselhoParticular)
  // ====================================================
  console.log('--- PARTE 1: TESTES DE CRIAÇÃO (createConselhoParticular) ---');

  // [TEST 1] Criação Válida
  console.log('\n[TEST 1] Criação Válida de Conselho Particular');
  const mockRepo1 = new MockConselhoParticularRepository();
  const res1 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo1);
  assertEqual(res1.success, true, 'Deve retornar success: true');
  assertEqual(res1.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(mockRepo1.createCallCount, 1, 'createAtomically deve ser chamado exatamente UMA vez');

  // [TEST 2] Contexto Não Autorizado
  console.log('\n[TEST 2] Contexto Não Autorizado (allowed: false)');
  const mockRepo2 = new MockConselhoParticularRepository();
  const res2 = await createConselhoParticular(validFormPayload, { allowed: false, validatedCentralId: 'central-100' }, mockRepo2);
  assertEqual(res2.success, false, 'Deve rejeitar com success: false');
  assertEqual(res2.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');
  assertEqual(mockRepo2.createCallCount, 0, 'Não deve invocar o repositório');

  // [TEST 3] Form com campos de auditoria
  console.log('\n[TEST 3] Bloqueio de Campos de Auditoria no Formulário de Criação');
  const mockRepo3 = new MockConselhoParticularRepository();
  const res3 = await createConselhoParticular({ ...validFormPayload, createdAt: '2020-01-01' }, validAuthContext, mockRepo3);
  assertEqual(res3.success, false, 'Deve rejeitar campo de auditoria');
  assertEqual(res3.code, 'AUDIT_FIELDS_NOT_ALLOWED', 'Deve retornar AUDIT_FIELDS_NOT_ALLOWED');
  assertEqual(mockRepo3.createCallCount, 0, 'Não deve chamar o repositório');

  // [TEST 4] Nome Duplicado na Criação
  console.log('\n[TEST 4] Nome Duplicado na Criação');
  const mockRepo4 = new MockConselhoParticularRepository();
  await createConselhoParticular(validFormPayload, validAuthContext, mockRepo4);
  const res4 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo4);
  assertEqual(res4.success, false, 'Deve rejeitar duplicidade de nome');
  assertEqual(res4.code, 'DUPLICATE_NAME', 'Deve retornar code: DUPLICATE_NAME');

  // ====================================================
  // PARTE 2: TESTES DE EDIÇÃO (updateConselhoParticular)
  // ====================================================
  console.log('\n--- PARTE 2: TESTES DE EDIÇÃO (updateConselhoParticular) ---');

  // [TEST 5] conselhoId Ausente ou Vazio
  console.log('\n[TEST 5] Rejeição de conselhoId Ausente/Vazio sem chamar repositório');
  const mockRepo5 = new MockConselhoParticularRepository();
  const res5A = await updateConselhoParticular('', validFormPayload, validAuthContext, mockRepo5);
  assertEqual(res5A.success, false, 'Deve rejeitar conselhoId em branco');
  assertEqual(res5A.code, 'MISSING_CONSELHO_ID', 'Deve retornar code: MISSING_CONSELHO_ID');
  assertEqual(mockRepo5.getByIdCallCount, 0, 'NÃO deve chamar getById');
  assertEqual(mockRepo5.updateCallCount, 0, 'NÃO deve chamar updateAtomically');

  // [TEST 6] Edição Válida
  console.log('\n[TEST 6] Edição Válida de Conselho Particular');
  const mockRepo6 = new MockConselhoParticularRepository();
  const createRes = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo6);
  const createdId = createRes.data!.id;

  const updatePayload = {
    name: 'Conselho Particular São Vicente Renovado',
    city: 'Sabará',
    phone: '(31) 97777-6666',
    status: 'ativo',
  };

  const res6 = await updateConselhoParticular(createdId, updatePayload, validAuthContext, mockRepo6);
  assertEqual(res6.success, true, 'Deve retornar success: true na atualização');
  assertEqual(res6.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(res6.data?.name, 'Conselho Particular São Vicente Renovado', 'Deve atualizar o nome no retorno');
  assertEqual(mockRepo6.updateCallCount, 1, 'updateAtomically deve ser chamado exatamente UMA vez');

  // [TEST 7] Registro Inexistente na Edição
  console.log('\n[TEST 7] Edição de Registro Inexistente (NOT_FOUND)');
  const mockRepo7 = new MockConselhoParticularRepository();
  const res7 = await updateConselhoParticular('cp-INEXISTENTE-999', updatePayload, validAuthContext, mockRepo7);
  assertEqual(res7.success, false, 'Deve retornar success: false');
  assertEqual(res7.code, 'NOT_FOUND', 'Deve retornar code: NOT_FOUND');

  // [TEST 8] Tentativa de Acesso entre Conselhos Centrais Diferentes
  console.log('\n[TEST 8] Acesso Cruzado Entre Conselhos Centrais (INSTITUTION_SCOPE_MISMATCH)');
  const mockRepo8 = new MockConselhoParticularRepository();
  mockRepo8.records.set('cp-outro-central', {
    id: 'cp-outro-central',
    centralId: 'central-INTRUSO-999',
    name: 'Conselho Particular Alheio',
    normalizedName: 'CONSELHO PARTICULAR ALHEIO',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-outro',
    updatedBy: 'user-outro',
  });

  const res8 = await updateConselhoParticular('cp-outro-central', updatePayload, validAuthContext, mockRepo8);
  assertEqual(res8.success, false, 'Deve barrar acesso cruzado');
  assertEqual(res8.code, 'INSTITUTION_SCOPE_MISMATCH', 'Deve retornar code: INSTITUTION_SCOPE_MISMATCH');

  // [TEST 9] Alteração de Campos Imutáveis (id, centralId, createdAt, createdBy)
  console.log('\n[TEST 9] Alteração de Campos Imutáveis na Edição');
  const mockRepo9 = new MockConselhoParticularRepository();
  const create9 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo9);
  const id9 = create9.data!.id;

  const res9EditId = await updateConselhoParticular(id9, { ...updatePayload, id: 'cp-MUDADO-999' }, validAuthContext, mockRepo9);
  assertEqual(res9EditId.success, false, 'Deve rejeitar alteração do ID');
  assertEqual(res9EditId.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve retornar IMMUTABLE_FIELD_MODIFIED');

  // [TEST 10] Nome Duplicado na Edição
  console.log('\n[TEST 10] Nome Duplicado na Edição com Outro Registro Existente');
  const mockRepo10 = new MockConselhoParticularRepository();
  const rec10A = await createConselhoParticular({ name: 'CP Alfa', status: 'ativo' }, validAuthContext, mockRepo10);
  const rec10B = await createConselhoParticular({ name: 'CP Beta', status: 'ativo' }, validAuthContext, mockRepo10);

  // Tentativa de editar CP Beta para ter o mesmo nome de CP Alfa
  const res10 = await updateConselhoParticular(rec10B.data!.id, { name: 'CP Alfa', status: 'ativo' }, validAuthContext, mockRepo10);
  assertEqual(res10.success, false, 'Deve rejeitar nome duplicado de outro registro');
  assertEqual(res10.code, 'DUPLICATE_NAME', 'Deve retornar code: DUPLICATE_NAME');

  // [TEST 11] Preservação e Auditoria do Operador na Edição
  console.log('\n[TEST 11] Preservação de Auditoria e Retorno Sanitizado na Edição');
  const mockRepo11 = new MockConselhoParticularRepository();
  const rec11 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo11);
  const id11 = rec11.data!.id;

  const res11 = await updateConselhoParticular(id11, { name: 'Conselho Particular Auditado', status: 'ativo' }, validAuthContext, mockRepo11);
  assertEqual(res11.success, true, 'Deve atualizar com sucesso');
  const keys11 = Object.keys(res11.data || {}).sort();
  assertEqual(keys11, ['centralId', 'id', 'name', 'status'], 'Retorno de edição deve conter SOMENTE 4 chaves permitidas');

  const updatedInDb = mockRepo11.records.get(id11);
  assertEqual(updatedInDb?.updatedBy, 'user-operator-01', 'updatedBy deve ser atualizado com authContext.userId');

  // ====================================================
  // PARTE 3: TESTES DE INATIVAÇÃO (inactivateConselhoParticular)
  // ====================================================
  console.log('\n--- PARTE 3: TESTES DE INATIVAÇÃO (inactivateConselhoParticular) ---');

  // [TEST 12] conselhoId Ausente/Vazio na Inativação
  console.log('\n[TEST 12] Rejeição de conselhoId Ausente/Vazio na Inativação');
  const mockRepo12 = new MockConselhoParticularRepository();
  const res12 = await inactivateConselhoParticular('   ', validAuthContext, mockRepo12);
  assertEqual(res12.success, false, 'Deve rejeitar conselhoId em branco');
  assertEqual(res12.code, 'MISSING_CONSELHO_ID', 'Deve retornar code: MISSING_CONSELHO_ID');
  assertEqual(mockRepo12.inactivateCallCount, 0, 'NÃO deve invocar o repositório');

  // [TEST 13] Inativação Válida
  console.log('\n[TEST 13] Inativação Válida de Conselho Particular');
  const mockRepo13 = new MockConselhoParticularRepository();
  const rec13 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo13);
  const id13 = rec13.data!.id;

  const res13 = await inactivateConselhoParticular(id13, validAuthContext, mockRepo13);
  assertEqual(res13.success, true, 'Deve inativar com sucesso');
  assertEqual(res13.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(res13.data?.status, 'inativo', 'Status no retorno deve ser inativo');

  const recordInDb13 = mockRepo13.records.get(id13);
  assertEqual(recordInDb13 !== undefined, true, 'O registro NÃO deve ter sido excluído fisicamente');
  assertEqual(recordInDb13?.status, 'inativo', 'O registro no banco deve ter status = inativo');

  // [TEST 14] Inativação de Registro Já Inativo
  console.log('\n[TEST 14] Inativação de Registro Já Inativo (ALREADY_INACTIVE)');
  const mockRepo14 = new MockConselhoParticularRepository();
  const rec14 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo14);
  const id14 = rec14.data!.id;

  await inactivateConselhoParticular(id14, validAuthContext, mockRepo14);
  const res14Second = await inactivateConselhoParticular(id14, validAuthContext, mockRepo14);

  assertEqual(res14Second.success, false, 'Não deve re-inativar');
  assertEqual(res14Second.code, 'ALREADY_INACTIVE', 'Deve retornar code: ALREADY_INACTIVE');

  // [TEST 15] Bloqueio de Inativação com Conferências Ativas Vinculadas
  console.log('\n[TEST 15] Bloqueio de Inativação com Conferências Ativas (ACTIVE_CHILDREN_EXIST)');
  const mockRepo15 = new MockConselhoParticularRepository();
  const rec15 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo15);
  const id15 = rec15.data!.id;

  // Simular presença de 2 Conferências ativas vinculadas
  mockRepo15.activeChildrenCountMap.set(id15, 2);

  const res15 = await inactivateConselhoParticular(id15, validAuthContext, mockRepo15);
  assertEqual(res15.success, false, 'Deve bloquear inativação quando houver filhos ativos');
  assertEqual(res15.code, 'ACTIVE_CHILDREN_EXIST', 'Deve retornar code: ACTIVE_CHILDREN_EXIST');

  // [TEST 16] Tratamento de Exceções sem Expor Detalhes
  console.log('\n[TEST 16] Tratamento de Exceções do Banco na Inativação');
  const mockRepo16 = new MockConselhoParticularRepository();
  const rec16 = await createConselhoParticular(validFormPayload, validAuthContext, mockRepo16);
  mockRepo16.shouldThrowOnInactivate = true;

  const res16 = await inactivateConselhoParticular(rec16.data!.id, validAuthContext, mockRepo16);
  assertEqual(res16.success, false, 'Deve falhar em erro do repositório');
  assertEqual(res16.code, 'STORAGE_ERROR', 'Deve retornar code: STORAGE_ERROR');

  // --- PARTE 4: TESTES DE LISTAGEM (listConselhosParticulares) ---

  // [TEST 17] Usuário Não Autorizado
  console.log('\n[TEST 17] Usuário Não Autorizado na Listagem');
  const mockRepo17 = new MockConselhoParticularRepository();
  const res17A = await listConselhosParticulares({ allowed: false, validatedCentralId: 'central-100', userId: 'user-1' }, mockRepo17);
  assertEqual(res17A.success, false, 'Deve rejeitar allowed === false');
  assertEqual(res17A.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');

  const res17B = await listConselhosParticulares(null, mockRepo17);
  assertEqual(res17B.success, false, 'Deve rejeitar contexto nulo');
  assertEqual(res17B.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');

  // [TEST 18] validatedCentralId Ausente
  console.log('\n[TEST 18] validatedCentralId Ausente na Listagem');
  const mockRepo18 = new MockConselhoParticularRepository();
  const res18 = await listConselhosParticulares({ allowed: true, validatedCentralId: '   ', userId: 'user-1' }, mockRepo18);
  assertEqual(res18.success, false, 'Deve rejeitar validatedCentralId em branco');
  assertEqual(res18.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');

  // [TEST 19] Status Padrão Ativo
  console.log('\n[TEST 19] Status Padrão Ativo na Listagem');
  const mockRepo19 = new MockConselhoParticularRepository();
  await createConselhoParticular({ ...validFormPayload, name: 'CP Alfa' }, validAuthContext, mockRepo19);
  const cpBeta = await createConselhoParticular({ ...validFormPayload, name: 'CP Beta' }, validAuthContext, mockRepo19);
  await inactivateConselhoParticular(cpBeta.data!.id, validAuthContext, mockRepo19);

  const res19 = await listConselhosParticulares(validAuthContext, mockRepo19);
  assertEqual(res19.success, true, 'Listagem com status padrão deve ter sucesso');
  assertEqual(res19.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(res19.data?.totalReturned, 1, 'Deve retornar apenas 1 conselho ativo');
  assertEqual(res19.data?.items[0].name, 'CP Alfa', 'Deve ser o CP Alfa ativo');

  // [TEST 20] Status Ativo, Inativo e Todos
  console.log('\n[TEST 20] Filtros Explícitos: Ativo, Inativo e Todos');
  const mockRepo20 = new MockConselhoParticularRepository();
  await createConselhoParticular({ ...validFormPayload, name: 'CP Ativo Um' }, validAuthContext, mockRepo20);
  const cpInat = await createConselhoParticular({ ...validFormPayload, name: 'CP Inativo Um' }, validAuthContext, mockRepo20);
  await inactivateConselhoParticular(cpInat.data!.id, validAuthContext, mockRepo20);

  const res20Ativo = await listConselhosParticulares(validAuthContext, mockRepo20, { status: 'ativo' });
  assertEqual(res20Ativo.data?.totalReturned, 1, 'Filtro status ativo deve retornar 1');

  const res20Inativo = await listConselhosParticulares(validAuthContext, mockRepo20, { status: 'inativo' });
  assertEqual(res20Inativo.data?.totalReturned, 1, 'Filtro status inativo deve retornar 1');
  assertEqual(res20Inativo.data?.items[0].name, 'CP Inativo Um', 'Deve retornar o registro inativo');

  const res20Todos = await listConselhosParticulares(validAuthContext, mockRepo20, { status: 'todos' });
  assertEqual(res20Todos.data?.totalReturned, 2, 'Filtro status todos deve retornar 2');

  // [TEST 21] Status Inválido Retorna INVALID_OPTIONS
  console.log('\n[TEST 21] Status Inválido Retorna INVALID_OPTIONS');
  const mockRepo21 = new MockConselhoParticularRepository();
  const res21 = await listConselhosParticulares(validAuthContext, mockRepo21, { status: 'arquivado' as any });
  assertEqual(res21.success, false, 'Deve rejeitar status inválido');
  assertEqual(res21.code, 'INVALID_OPTIONS', 'Deve retornar code: INVALID_OPTIONS');

  // [TEST 22] Limit Omitido Usa 50
  console.log('\n[TEST 22] Limit Omitido Usa 50');
  const mockRepo22 = new MockConselhoParticularRepository();
  for (let i = 1; i <= 55; i++) {
    const pad = String(i).padStart(2, '0');
    await createConselhoParticular({ ...validFormPayload, name: `CP Registro ${pad}` }, validAuthContext, mockRepo22);
  }

  const res22 = await listConselhosParticulares(validAuthContext, mockRepo22);
  assertEqual(res22.data?.totalReturned, 50, 'Limit omitido deve retornar exatamente 50 itens');
  assertEqual(res22.data?.hasMore, true, 'Deve ter hasMore === true com 55 registros');
  assertEqual(typeof res22.data?.nextCursor === 'string', true, 'Deve gerar nextCursor para próxima página');

  // [TEST 23] Limit 1 e 100 São Aceitos
  console.log('\n[TEST 23] Limit 1 e 100 São Aceitos');
  const mockRepo23 = new MockConselhoParticularRepository();
  await createConselhoParticular({ ...validFormPayload, name: 'CP Teste A' }, validAuthContext, mockRepo23);
  await createConselhoParticular({ ...validFormPayload, name: 'CP Teste B' }, validAuthContext, mockRepo23);

  const res23Min = await listConselhosParticulares(validAuthContext, mockRepo23, { limit: 1 });
  assertEqual(res23Min.success, true, 'limit = 1 deve ser aceito');
  assertEqual(res23Min.data?.totalReturned, 1, 'Deve retornar 1 item');
  assertEqual(res23Min.data?.hasMore, true, 'Deve indicar hasMore === true');

  const res23Max = await listConselhosParticulares(validAuthContext, mockRepo23, { limit: 100 });
  assertEqual(res23Max.success, true, 'limit = 100 deve ser aceito');
  assertEqual(res23Max.data?.totalReturned, 2, 'Deve retornar 2 itens');
  assertEqual(res23Max.data?.hasMore, false, 'Deve indicar hasMore === false');

  // [TEST 24] Limit Zero, Negativo, Decimal, Acima de 100 e Tipo Inválido Retornam INVALID_OPTIONS
  console.log('\n[TEST 24] Validação Estrita de Limit (INVALID_OPTIONS)');
  const mockRepo24 = new MockConselhoParticularRepository();

  const res24Zero = await listConselhosParticulares(validAuthContext, mockRepo24, { limit: 0 });
  assertEqual(res24Zero.code, 'INVALID_OPTIONS', 'limit = 0 deve retornar INVALID_OPTIONS');

  const res24Neg = await listConselhosParticulares(validAuthContext, mockRepo24, { limit: -10 });
  assertEqual(res24Neg.code, 'INVALID_OPTIONS', 'limit negativo deve retornar INVALID_OPTIONS');

  const res24Dec = await listConselhosParticulares(validAuthContext, mockRepo24, { limit: 10.5 });
  assertEqual(res24Dec.code, 'INVALID_OPTIONS', 'limit decimal deve retornar INVALID_OPTIONS');

  const res24MaxExceeded = await listConselhosParticulares(validAuthContext, mockRepo24, { limit: 101 });
  assertEqual(res24MaxExceeded.code, 'INVALID_OPTIONS', 'limit > 100 deve retornar INVALID_OPTIONS');

  const res24Str = await listConselhosParticulares(validAuthContext, mockRepo24, { limit: '50' as any });
  assertEqual(res24Str.code, 'INVALID_OPTIONS', 'limit como string deve retornar INVALID_OPTIONS');

  // [TEST 25] centralId Usado Vem Exclusivamente do authContext
  console.log('\n[TEST 25] centralId Usado Vem Exclusivamente do authContext');
  const mockRepo25 = new MockConselhoParticularRepository();
  await createConselhoParticular({ ...validFormPayload, name: 'CP Central 100' }, { allowed: true, validatedCentralId: 'central-100', userId: 'u1' }, mockRepo25);
  await createConselhoParticular({ ...validFormPayload, name: 'CP Central 200' }, { allowed: true, validatedCentralId: 'central-200', userId: 'u2' }, mockRepo25);

  const res25 = await listConselhosParticulares({ allowed: true, validatedCentralId: 'central-100', userId: 'u1' }, mockRepo25);
  assertEqual(res25.data?.totalReturned, 1, 'Deve retornar apenas registros do central-100');
  assertEqual(res25.data?.items[0].centralId, 'central-100', 'Registro retornado deve ter centralId = central-100');

  // [TEST 26] Sucesso Retorna Estrutura Completa
  console.log('\n[TEST 26] Sucesso Retorna items, hasMore, nextCursor e totalReturned');
  const mockRepo26 = new MockConselhoParticularRepository();
  await createConselhoParticular({ ...validFormPayload, name: 'CP Estrutura' }, validAuthContext, mockRepo26);

  const res26 = await listConselhosParticulares(validAuthContext, mockRepo26);
  assertEqual(res26.success, true, 'Sucesso deve ser true');
  assertEqual(res26.code, 'SUCCESS', 'Code deve ser SUCCESS');
  assertEqual(Array.isArray(res26.data?.items), true, 'items deve ser um array');
  assertEqual(typeof res26.data?.hasMore === 'boolean', true, 'hasMore deve ser boolean');
  assertEqual(res26.data?.totalReturned, 1, 'totalReturned deve ser 1');

  // [TEST 27] Falha do Repositório Retorna STORAGE_ERROR sem Mensagem Interna
  console.log('\n[TEST 27] Falha do Repositório Retorna STORAGE_ERROR sem Mensagem Interna');
  const mockRepo27 = new MockConselhoParticularRepository();
  mockRepo27.shouldThrowOnList = true;

  const res27 = await listConselhosParticulares(validAuthContext, mockRepo27);
  assertEqual(res27.success, false, 'Deve falhar');
  assertEqual(res27.code, 'STORAGE_ERROR', 'Deve retornar STORAGE_ERROR');
  assertEqual(res27.error?.includes('confidencial'), false, 'Não deve expor mensagem interna do driver');

  console.log('\n===================================================');
  console.log(` RESULTADOS DOS TESTES: ${passedTests} Passou | ${failedTests} Falhou`);
  console.log('===================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal executando testes:', err);
  process.exit(1);
});
