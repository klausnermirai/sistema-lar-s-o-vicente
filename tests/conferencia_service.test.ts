import {
  createConferencia,
  updateConferencia,
  inactivateConferencia,
  listConferencias,
  ConferenciaRepository,
  ListConferenciasOptions,
  ServiceAuthContext,
} from '../lib/conferencia_service.js';
import { StandaloneConferencia, StandaloneConselhoParticular } from '../types.js';

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
console.log(' Executando Testes do Serviço de Conferência Vicentina');
console.log('===================================================\n');

/**
 * Repositório Simulado em Memória para o Serviço de Conferência.
 */
class MockConferenciaRepository implements ConferenciaRepository {
  public particularesMap: Map<string, StandaloneConselhoParticular> = new Map();
  public conferenciasMap: Map<string, StandaloneConferencia> = new Map();
  public activeMembersCountMap: Map<string, number> = new Map();
  private idCounter = 0;

  public getParticularCallCount = 0;
  public getByIdCallCount = 0;
  public createCallCount = 0;
  public updateCallCount = 0;
  public inactivateCallCount = 0;

  public shouldThrowOnCreate = false;
  public shouldThrowOnUpdate = false;
  public shouldThrowOnInactivate = false;
  public shouldThrowOnList = false;

  public inactivateParentAfterGet = false;
  public changeParentCentralAfterGet = false;

  public listCallCount = 0;

  async listByParticularId(
    expectedCentralId: string,
    particularId: string,
    options?: ListConferenciasOptions
  ) {
    this.listCallCount++;
    if (this.shouldThrowOnList) {
      throw new Error('Erro interno confidencial no banco durante a listagem');
    }

    const status = options?.status || 'ativo';
    const limit = options?.limit ?? 50;
    const cursor = options?.cursor;

    let items: StandaloneConferencia[] = Array.from(this.conferenciasMap.values()).filter(
      (conf) => conf.centralId === expectedCentralId && conf.particularId === particularId
    );

    if (status !== 'todos') {
      items = items.filter((conf) => conf.status === status);
    }

    items.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

    if (cursor) {
      const idx = items.findIndex((item) => item.normalizedName === cursor);
      if (idx !== -1) {
        items = items.slice(idx + 1);
      }
    }

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const lastItem = pageItems.length > 0 ? pageItems[pageItems.length - 1] : undefined;
    const nextCursor = hasMore && lastItem ? lastItem.normalizedName : undefined;

    return {
      items: pageItems.map((item) => ({ ...item })),
      nextCursor,
      hasMore,
    };
  }

  async getParticularById(particularId: string) {
    this.getParticularCallCount++;
    const parent = this.particularesMap.get(particularId);
    if (!parent) return null;
    const result = { ...parent };
    if (this.inactivateParentAfterGet) {
      this.particularesMap.set(particularId, { ...parent, status: 'inativo' });
    }
    if (this.changeParentCentralAfterGet) {
      this.particularesMap.set(particularId, { ...parent, centralId: 'central-OUTRO-999' });
    }
    return result;
  }

  async getById(id: string) {
    this.getByIdCallCount++;
    const conf = this.conferenciasMap.get(id);
    return conf ? { ...conf } : null;
  }

  async createAtomically(
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ) {
    this.createCallCount++;
    if (this.shouldThrowOnCreate) {
      throw new Error('Erro interno confidencial do banco na criação');
    }

    // Revalidar Conselho Particular pai atomicamente
    const parent = this.particularesMap.get(expectedParticularId);
    if (!parent) {
      return { created: false, reason: 'PARENT_NOT_FOUND' as const };
    }
    if (parent.centralId !== expectedCentralId) {
      return { created: false, reason: 'PARENT_CENTRAL_MISMATCH' as const };
    }
    if (parent.status !== 'ativo') {
      return { created: false, reason: 'PARENT_INACTIVE' as const };
    }

    // Checar duplicidade de nome no mesmo particularId
    for (const conf of this.conferenciasMap.values()) {
      if (conf.particularId === expectedParticularId && conf.normalizedName === data.normalizedName) {
        return { created: false, reason: 'DUPLICATE_NAME' as const };
      }
    }

    this.idCounter++;
    const newId = data.id || `conf-${Date.now()}-${this.idCounter}`;
    const savedRecord: StandaloneConferencia = {
      ...data,
      id: newId,
      centralId: expectedCentralId,
      particularId: expectedParticularId,
    };
    this.conferenciasMap.set(newId, savedRecord);

    return { created: true, record: savedRecord };
  }

  async updateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ) {
    this.updateCallCount++;
    if (this.shouldThrowOnUpdate) {
      throw new Error('Erro interno confidencial do banco na atualização');
    }

    const existing = this.conferenciasMap.get(id);
    if (!existing) {
      return { updated: false, reason: 'NOT_FOUND' as const };
    }

    if (existing.centralId !== expectedCentralId || existing.particularId !== expectedParticularId) {
      return { updated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
    }

    // Revalidar pai
    const parent = this.particularesMap.get(expectedParticularId);
    if (!parent || parent.status !== 'ativo') {
      return { updated: false, reason: 'PARENT_INACTIVE' as const };
    }
    if (parent.centralId !== expectedCentralId) {
      return { updated: false, reason: 'PARENT_CENTRAL_MISMATCH' as const };
    }

    // Checar duplicidade de nome desconsiderando a própria conferência
    for (const conf of this.conferenciasMap.values()) {
      if (conf.id !== id && conf.particularId === expectedParticularId && conf.normalizedName === data.normalizedName) {
        return { updated: false, reason: 'DUPLICATE_NAME' as const };
      }
    }

    const updatedRecord: StandaloneConferencia = {
      ...data,
      id,
      centralId: expectedCentralId,
      particularId: expectedParticularId,
    };
    this.conferenciasMap.set(id, updatedRecord);

    return { updated: true, record: updatedRecord };
  }

  async inactivateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    auditUserId: string
  ) {
    this.inactivateCallCount++;
    if (this.shouldThrowOnInactivate) {
      throw new Error('Erro interno confidencial do banco na inativação');
    }

    const existing = this.conferenciasMap.get(id);
    if (!existing) {
      return { inactivated: false, reason: 'NOT_FOUND' as const };
    }

    if (existing.centralId !== expectedCentralId || existing.particularId !== expectedParticularId) {
      return { inactivated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
    }

    if (existing.status === 'inativo') {
      return { inactivated: false, reason: 'ALREADY_INACTIVE' as const };
    }

    const activeMembers = this.activeMembersCountMap.get(id) || 0;
    if (activeMembers > 0) {
      return { inactivated: false, reason: 'ACTIVE_MEMBERS_EXIST' as const };
    }

    const inactivatedRecord: StandaloneConferencia = {
      ...existing,
      status: 'inativo',
      updatedAt: new Date().toISOString(),
      updatedBy: auditUserId,
    };
    this.conferenciasMap.set(id, inactivatedRecord);

    return { inactivated: true, record: inactivatedRecord };
  }
}

async function runTests() {
  const validAuthContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: 'central-100',
    userId: 'user-operator-01',
  };

  const particularIdValid = 'cp-200';

  const validParentParticular: StandaloneConselhoParticular = {
    id: particularIdValid,
    centralId: 'central-100',
    name: 'Conselho Particular São José',
    normalizedName: 'CONSELHO PARTICULAR SAO JOSE',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  const validFormPayload = {
    name: 'Conferência Vicentina Santa Rita',
    meetingDay: 'Segunda-feira',
    meetingTime: '19:00',
    status: 'ativo',
  };

  // ====================================================
  // PARTE 1: TESTES DE CRIAÇÃO (createConferencia)
  // ====================================================
  console.log('--- PARTE 1: TESTES DE CRIAÇÃO (createConferencia) ---');

  // [TEST 1] Criação Válida
  console.log('\n[TEST 1] Criação Válida de Conferência Vicentina');
  const mockRepo1 = new MockConferenciaRepository();
  mockRepo1.particularesMap.set(particularIdValid, validParentParticular);

  const res1 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo1);

  assertEqual(res1.success, true, 'Deve retornar success: true');
  assertEqual(res1.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(res1.data?.centralId, 'central-100', 'centralId deve ser o do contexto seguro');
  assertEqual(res1.data?.particularId, particularIdValid, 'particularId deve ser o informado');
  assertEqual(mockRepo1.createCallCount, 1, 'createAtomically deve ser chamado exatamente UMA vez');

  // [TEST 2] Contexto Não Autorizado
  console.log('\n[TEST 2] Contexto Não Autorizado');
  const mockRepo2 = new MockConferenciaRepository();
  const res2 = await createConferencia(particularIdValid, validFormPayload, { allowed: false }, mockRepo2);
  assertEqual(res2.success, false, 'Deve rejeitar contexto não autorizado');
  assertEqual(res2.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');

  // [TEST 3] particularId Ausente ou Vazio
  console.log('\n[TEST 3] particularId Ausente/Vazio na Criação');
  const mockRepo3 = new MockConferenciaRepository();
  const res3 = await createConferencia('', validFormPayload, validAuthContext, mockRepo3);
  assertEqual(res3.success, false, 'Deve rejeitar particularId em branco');
  assertEqual(res3.code, 'MISSING_PARTICULAR_ID', 'Deve retornar code: MISSING_PARTICULAR_ID');
  assertEqual(mockRepo3.createCallCount, 0, 'Não deve chamar o repositório');

  // [TEST 4] Pai Ausente, Inativo ou de Outro Central
  console.log('\n[TEST 4] Pai Ausente, Inativo ou de Outra Central');

  // A. Pai Ausente
  const mockRepo4A = new MockConferenciaRepository();
  const res4A = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo4A);
  assertEqual(res4A.code, 'PARENT_NOT_FOUND', 'Deve retornar PARENT_NOT_FOUND');

  // B. Pai Inativo
  const mockRepo4B = new MockConferenciaRepository();
  mockRepo4B.particularesMap.set(particularIdValid, { ...validParentParticular, status: 'inativo' });
  const res4B = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo4B);
  assertEqual(res4B.code, 'PARENT_INACTIVE', 'Deve retornar PARENT_INACTIVE');

  // C. Pai de outro Conselho Central
  const mockRepo4C = new MockConferenciaRepository();
  mockRepo4C.particularesMap.set(particularIdValid, { ...validParentParticular, centralId: 'central-OUTRO-999' });
  const res4C = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo4C);
  assertEqual(res4C.code, 'PARENT_CENTRAL_MISMATCH', 'Deve retornar PARENT_CENTRAL_MISMATCH');

  // [TEST 5] Campos de Auditoria Enviados pelo Formulário na Criação
  console.log('\n[TEST 5] Rejeição de Campos de Auditoria no Formulário');
  const mockRepo5 = new MockConferenciaRepository();
  mockRepo5.particularesMap.set(particularIdValid, validParentParticular);
  const res5 = await createConferencia(particularIdValid, { ...validFormPayload, createdAt: '2026-01-01' }, validAuthContext, mockRepo5);
  assertEqual(res5.code, 'AUDIT_FIELDS_NOT_ALLOWED', 'Deve retornar AUDIT_FIELDS_NOT_ALLOWED');

  // [TEST 6] Nome Duplicado na Criação
  console.log('\n[TEST 6] Nome Duplicado no mesmo Conselho Particular');
  const mockRepo6 = new MockConferenciaRepository();
  mockRepo6.particularesMap.set(particularIdValid, validParentParticular);
  await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo6);
  const res6 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo6);
  assertEqual(res6.code, 'DUPLICATE_NAME', 'Deve retornar code: DUPLICATE_NAME');

  // ====================================================
  // PARTE 2: TESTES DE EDIÇÃO (updateConferencia)
  // ====================================================
  console.log('\n--- PARTE 2: TESTES DE EDIÇÃO (updateConferencia) ---');

  // [TEST 7] Edição Válida
  console.log('\n[TEST 7] Edição Válida de Conferência Vicentina');
  const mockRepo7 = new MockConferenciaRepository();
  mockRepo7.particularesMap.set(particularIdValid, validParentParticular);
  const created7 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo7);
  const confId7 = created7.data!.id;

  const updatePayload = {
    name: 'Conferência Vicentina Santa Rita Renovada',
    meetingDay: 'Terça-feira',
    meetingTime: '20:00',
    status: 'ativo',
  };

  const res7 = await updateConferencia(confId7, particularIdValid, updatePayload, validAuthContext, mockRepo7);
  assertEqual(res7.success, true, 'Deve atualizar com sucesso');
  assertEqual(res7.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(res7.data?.name, 'Conferência Vicentina Santa Rita Renovada', 'Nome deve ser atualizado no retorno');

  const keys7 = Object.keys(res7.data || {}).sort();
  assertEqual(keys7, ['centralId', 'id', 'name', 'particularId', 'status'], 'Retorno de edição deve conter SOMENTE as 5 chaves permitidas');

  // [TEST 8] conferenciaId ou particularId Ausente em Edição
  console.log('\n[TEST 8] conferenciaId ou particularId Ausente em Edição');
  const mockRepo8 = new MockConferenciaRepository();

  const res8A = await updateConferencia('', particularIdValid, updatePayload, validAuthContext, mockRepo8);
  assertEqual(res8A.code, 'MISSING_CONFERENCIA_ID', 'Deve retornar MISSING_CONFERENCIA_ID');

  const res8B = await updateConferencia('conf-100', '', updatePayload, validAuthContext, mockRepo8);
  assertEqual(res8B.code, 'MISSING_PARTICULAR_ID', 'Deve retornar MISSING_PARTICULAR_ID');

  // [TEST 9] Registro Inexistente ou Acesso Cruzado em Edição
  console.log('\n[TEST 9] Registro Inexistente ou Acesso Cruzado em Edição');
  const mockRepo9 = new MockConferenciaRepository();
  mockRepo9.particularesMap.set(particularIdValid, validParentParticular);

  // Inexistente
  const res9A = await updateConferencia('conf-INEXISTENTE', particularIdValid, updatePayload, validAuthContext, mockRepo9);
  assertEqual(res9A.code, 'NOT_FOUND', 'Deve retornar NOT_FOUND');

  // Acesso Cruzado (centralId diferente)
  mockRepo9.conferenciasMap.set('conf-alheia', {
    id: 'conf-alheia',
    centralId: 'central-INTRUSO',
    particularId: particularIdValid,
    name: 'Conferência Alheia',
    normalizedName: 'CONFERENCIA ALHEIA',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  });
  const res9B = await updateConferencia('conf-alheia', particularIdValid, updatePayload, validAuthContext, mockRepo9);
  assertEqual(res9B.code, 'INSTITUTION_SCOPE_MISMATCH', 'Deve retornar INSTITUTION_SCOPE_MISMATCH');

  // [TEST 10] Alteração de Campos Imutáveis na Edição (id / particularId)
  console.log('\n[TEST 10] Rejeição de Campos Imutáveis na Edição');
  const mockRepo10 = new MockConferenciaRepository();
  mockRepo10.particularesMap.set(particularIdValid, validParentParticular);
  const created10 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo10);
  const confId10 = created10.data!.id;

  const res10EditId = await updateConferencia(confId10, particularIdValid, { ...updatePayload, id: 'conf-MODIFICADO-999' }, validAuthContext, mockRepo10);
  assertEqual(res10EditId.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve rejeitar alteração do id com IMMUTABLE_FIELD_MODIFIED');

  const res10EditParticular = await updateConferencia(confId10, particularIdValid, { ...updatePayload, particularId: 'cp-NOVO-999' }, validAuthContext, mockRepo10);
  assertEqual(res10EditParticular.code, 'PARTICULAR_ID_MISMATCH', 'Deve rejeitar alteração do particularId com PARTICULAR_ID_MISMATCH');

  // [TEST 11] Nome Duplicado na Edição
  console.log('\n[TEST 11] Nome Duplicado na Edição com Outra Conferência');
  const mockRepo11 = new MockConferenciaRepository();
  mockRepo11.particularesMap.set(particularIdValid, validParentParticular);

  const confA = await createConferencia(particularIdValid, { name: 'Conferência A', status: 'ativo' }, validAuthContext, mockRepo11);
  const confB = await createConferencia(particularIdValid, { name: 'Conferência B', status: 'ativo' }, validAuthContext, mockRepo11);

  const res11 = await updateConferencia(confB.data!.id, particularIdValid, { name: 'Conferência A', status: 'ativo' }, validAuthContext, mockRepo11);
  assertEqual(res11.code, 'DUPLICATE_NAME', 'Deve retornar DUPLICATE_NAME ao tentar usar nome existente de outra conferência');

  // ====================================================
  // PARTE 3: TESTES DE INATIVAÇÃO (inactivateConferencia)
  // ====================================================
  console.log('\n--- PARTE 3: TESTES DE INATIVAÇÃO (inactivateConferencia) ---');

  // [TEST 12] conferenciaId ou particularId Ausente na Inativação
  console.log('\n[TEST 12] IDs Ausentes na Inativação');
  const mockRepo12 = new MockConferenciaRepository();

  const res12A = await inactivateConferencia('', particularIdValid, validAuthContext, mockRepo12);
  assertEqual(res12A.code, 'MISSING_CONFERENCIA_ID', 'Deve retornar MISSING_CONFERENCIA_ID');

  const res12B = await inactivateConferencia('conf-100', '', validAuthContext, mockRepo12);
  assertEqual(res12B.code, 'MISSING_PARTICULAR_ID', 'Deve retornar MISSING_PARTICULAR_ID');

  // [TEST 13] Inativação Válida
  console.log('\n[TEST 13] Inativação Válida de Conferência Vicentina');
  const mockRepo13 = new MockConferenciaRepository();
  mockRepo13.particularesMap.set(particularIdValid, validParentParticular);

  const created13 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo13);
  const confId13 = created13.data!.id;

  const res13 = await inactivateConferencia(confId13, particularIdValid, validAuthContext, mockRepo13);
  assertEqual(res13.success, true, 'Deve inativar com sucesso');
  assertEqual(res13.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(res13.data?.status, 'inativo', 'Status no retorno deve ser inativo');

  const inDb13 = mockRepo13.conferenciasMap.get(confId13);
  assertEqual(inDb13 !== undefined, true, 'O documento NÃO deve ter sido excluído fisicamente');
  assertEqual(inDb13?.status, 'inativo', 'Documento no banco deve ter status = inativo');

  // [TEST 14] Inativação de Registro Já Inativo
  console.log('\n[TEST 14] Inativação de Registro Já Inativo (ALREADY_INACTIVE)');
  const mockRepo14 = new MockConferenciaRepository();
  mockRepo14.particularesMap.set(particularIdValid, validParentParticular);
  const created14 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo14);
  const confId14 = created14.data!.id;

  await inactivateConferencia(confId14, particularIdValid, validAuthContext, mockRepo14);
  const res14Second = await inactivateConferencia(confId14, particularIdValid, validAuthContext, mockRepo14);
  assertEqual(res14Second.code, 'ALREADY_INACTIVE', 'Deve retornar ALREADY_INACTIVE');

  // [TEST 15] Bloqueio por Presença de Membros Ativos
  console.log('\n[TEST 15] Bloqueio de Inativação com Membros Ativos (ACTIVE_MEMBERS_EXIST)');
  const mockRepo15 = new MockConferenciaRepository();
  mockRepo15.particularesMap.set(particularIdValid, validParentParticular);
  const created15 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo15);
  const confId15 = created15.data!.id;

  // Simular presença de 3 membros ativos vinculados
  mockRepo15.activeMembersCountMap.set(confId15, 3);

  const res15 = await inactivateConferencia(confId15, particularIdValid, validAuthContext, mockRepo15);
  assertEqual(res15.code, 'ACTIVE_MEMBERS_EXIST', 'Deve retornar ACTIVE_MEMBERS_EXIST');

  // [TEST 16] Ausência de Mutação dos Objetos Recebidos e Erros sem Detalhes
  console.log('\n[TEST 16] Ausência de Mutação e Erros sem Detalhes Internos');
  const mockRepo16 = new MockConferenciaRepository();
  mockRepo16.particularesMap.set(particularIdValid, validParentParticular);

  const inputSnapshot = JSON.stringify(validFormPayload);
  await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo16);
  assertEqual(JSON.stringify(validFormPayload), inputSnapshot, 'Formulário de entrada não sofreu mutação');

  // Exceção de Banco
  mockRepo16.shouldThrowOnCreate = true;
  const res16Err = await createConferencia(particularIdValid, { name: 'Outra Conf', status: 'ativo' }, validAuthContext, mockRepo16);
  assertEqual(res16Err.code, 'STORAGE_ERROR', 'Deve capturar exceção e retornar STORAGE_ERROR');

  // ====================================================
  // PARTE 4: TESTES DE CONCORRÊNCIA E INVOCAÇÕES LÓGICAS
  // ====================================================
  console.log('\n--- PARTE 4: TESTES DE CONCORRÊNCIA E INVOCAÇÕES LÓGICAS ---');

  // [TEST 17] Concorrência na Criação: Pai Fica Inativo Antes de createAtomically
  console.log('\n[TEST 17] Concorrência na Criação: Pai Inativado Antes da Transação Atômica');
  const mockRepo17 = new MockConferenciaRepository();
  mockRepo17.particularesMap.set(particularIdValid, validParentParticular);
  mockRepo17.inactivateParentAfterGet = true;

  const res17 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo17);
  assertEqual(res17.success, false, 'Deve falhar na criação pois o pai ficou inativo');
  assertEqual(res17.code, 'PARENT_INACTIVE', 'Deve retornar code: PARENT_INACTIVE');

  // [TEST 18] Concorrência na Criação: CentralId do Pai Muda Antes de createAtomically
  console.log('\n[TEST 18] Concorrência na Criação: centralId do Pai Alterado Antes da Transação Atômica');
  const mockRepo18 = new MockConferenciaRepository();
  mockRepo18.particularesMap.set(particularIdValid, validParentParticular);
  mockRepo18.changeParentCentralAfterGet = true;

  const res18 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo18);
  assertEqual(res18.success, false, 'Deve falhar na criação pois a Central do pai mudou');
  assertEqual(res18.code, 'PARENT_CENTRAL_MISMATCH', 'Deve retornar code: PARENT_CENTRAL_MISMATCH');

  // [TEST 19A] Concorrência na Edição: Pai Inativado Antes de updateAtomically
  console.log('\n[TEST 19A] Concorrência na Edição: Pai Inativado Antes da Transação Atômica');
  const mockRepo19A = new MockConferenciaRepository();
  mockRepo19A.particularesMap.set(particularIdValid, validParentParticular);
  const created19A = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo19A);
  const confId19A = created19A.data!.id;

  mockRepo19A.inactivateParentAfterGet = true;
  const res19A = await updateConferencia(confId19A, particularIdValid, updatePayload, validAuthContext, mockRepo19A);
  assertEqual(res19A.success, false, 'Deve falhar na atualização pois o pai ficou inativo');
  assertEqual(res19A.code, 'PARENT_INACTIVE', 'Deve retornar code: PARENT_INACTIVE');

  // [TEST 19B] Concorrência na Edição: CentralId do Pai Alterado Antes de updateAtomically
  console.log('\n[TEST 19B] Concorrência na Edição: centralId do Pai Alterado Antes da Transação Atômica');
  const mockRepo19B = new MockConferenciaRepository();
  mockRepo19B.particularesMap.set(particularIdValid, validParentParticular);
  const created19B = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo19B);
  const confId19B = created19B.data!.id;

  mockRepo19B.changeParentCentralAfterGet = true;
  const res19B = await updateConferencia(confId19B, particularIdValid, updatePayload, validAuthContext, mockRepo19B);
  assertEqual(res19B.success, false, 'Deve falhar na atualização pois a Central do pai mudou');
  assertEqual(res19B.code, 'PARENT_CENTRAL_MISMATCH', 'Deve retornar code: PARENT_CENTRAL_MISMATCH');

  // [TEST 20] Limite de Chamadas do Repositório (Máximo de 1 para update e inactivate)
  console.log('\n[TEST 20] Limite de Chamadas Atomicas (Max 1)');
  const mockRepo20 = new MockConferenciaRepository();
  mockRepo20.particularesMap.set(particularIdValid, validParentParticular);
  const created20 = await createConferencia(particularIdValid, validFormPayload, validAuthContext, mockRepo20);
  const confId20 = created20.data!.id;

  await updateConferencia(confId20, particularIdValid, updatePayload, validAuthContext, mockRepo20);
  assertEqual(mockRepo20.updateCallCount, 1, 'updateAtomically deve ser chamado exatamente 1 vez na atualização válida');

  await inactivateConferencia(confId20, particularIdValid, validAuthContext, mockRepo20);
  assertEqual(mockRepo20.inactivateCallCount, 1, 'inactivateAtomically deve ser chamado exatamente 1 vez na inativação válida');

  // Ao passar IDs vazios, a validação ocorre antes de chamar o repositório
  const mockRepo20B = new MockConferenciaRepository();
  await updateConferencia('', particularIdValid, updatePayload, validAuthContext, mockRepo20B);
  assertEqual(mockRepo20B.updateCallCount, 0, 'updateAtomically NÃO deve ser chamado se conferenciaId for inválido');

  await inactivateConferencia('', particularIdValid, validAuthContext, mockRepo20B);
  assertEqual(mockRepo20B.inactivateCallCount, 0, 'inactivateAtomically NÃO deve ser chamado se conferenciaId for inválido');

  // [TEST 21] NOT_FOUND e INSTITUTION_SCOPE_MISMATCH na Inativação
  console.log('\n[TEST 21] NOT_FOUND e INSTITUTION_SCOPE_MISMATCH na Inativação');
  const mockRepo21 = new MockConferenciaRepository();
  mockRepo21.particularesMap.set(particularIdValid, validParentParticular);

  // A. Registro Inexistente na Inativação
  const res21NotFound = await inactivateConferencia('conf-INEXISTENTE-999', particularIdValid, validAuthContext, mockRepo21);
  assertEqual(res21NotFound.success, false, 'Inativação de inexistente deve falhar');
  assertEqual(res21NotFound.code, 'NOT_FOUND', 'Inativação de inexistente deve retornar NOT_FOUND');

  // B. Registro de Outra Central na Inativação
  mockRepo21.conferenciasMap.set('conf-alheia', {
    id: 'conf-alheia',
    centralId: 'central-INTRUSO-999',
    particularId: particularIdValid,
    name: 'Conferência Alheia',
    normalizedName: 'CONFERENCIA ALHEIA',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  });

  const res21ScopeMismatch = await inactivateConferencia('conf-alheia', particularIdValid, validAuthContext, mockRepo21);
  assertEqual(res21ScopeMismatch.success, false, 'Inativação de registro fora do escopo deve falhar');
  assertEqual(res21ScopeMismatch.code, 'INSTITUTION_SCOPE_MISMATCH', 'Deve retornar INSTITUTION_SCOPE_MISMATCH');

  // --- PARTE 5: TESTES DE LISTAGEM (listConferencias) ---
  console.log('\n--- PARTE 5: TESTES DE LISTAGEM (listConferencias) ---');

  // [TEST 22] Usuário Não Autorizado ou Contexto Inválido
  console.log('\n[TEST 22] Usuário Não Autorizado na Listagem');
  const mockRepo22 = new MockConferenciaRepository();
  mockRepo22.particularesMap.set(particularIdValid, validParentParticular);

  const res22A = await listConferencias(particularIdValid, { allowed: false, validatedCentralId: 'central-1', userId: 'u1' }, mockRepo22);
  assertEqual(res22A.success, false, 'Deve rejeitar allowed === false');
  assertEqual(res22A.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');

  const res22B = await listConferencias(particularIdValid, null, mockRepo22);
  assertEqual(res22B.success, false, 'Deve rejeitar contexto nulo');
  assertEqual(res22B.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');

  // [TEST 23] validatedCentralId Ausente na Listagem
  console.log('\n[TEST 23] validatedCentralId Ausente na Listagem');
  const mockRepo23 = new MockConferenciaRepository();
  mockRepo23.particularesMap.set(particularIdValid, validParentParticular);

  const res23 = await listConferencias(particularIdValid, { allowed: true, validatedCentralId: '   ', userId: 'u1' }, mockRepo23);
  assertEqual(res23.success, false, 'Deve rejeitar validatedCentralId em branco');
  assertEqual(res23.code, 'UNAUTHORIZED', 'Deve retornar code: UNAUTHORIZED');

  // [TEST 24] particularId Ausente ou Vazio
  console.log('\n[TEST 24] particularId Ausente ou Vazio na Listagem');
  const mockRepo24 = new MockConferenciaRepository();
  const res24A = await listConferencias('', validAuthContext, mockRepo24);
  assertEqual(res24A.success, false, 'Deve rejeitar particularId vazio');
  assertEqual(res24A.code, 'MISSING_PARTICULAR_ID', 'Deve retornar code: MISSING_PARTICULAR_ID');
  assertEqual(mockRepo24.getParticularCallCount, 0, 'NÃO deve consultar o repositório');

  const res24B = await listConferencias(undefined as any, validAuthContext, mockRepo24);
  assertEqual(res24B.success, false, 'Deve rejeitar particularId undefined');
  assertEqual(res24B.code, 'MISSING_PARTICULAR_ID', 'Deve retornar code: MISSING_PARTICULAR_ID');

  // [TEST 25] Conselho Particular Pai Inexistente (PARENT_NOT_FOUND)
  console.log('\n[TEST 25] Conselho Particular Pai Inexistente');
  const mockRepo25 = new MockConferenciaRepository();
  const res25 = await listConferencias('cp-nao-existe', validAuthContext, mockRepo25);
  assertEqual(res25.success, false, 'Deve rejeitar pai inexistente');
  assertEqual(res25.code, 'PARENT_NOT_FOUND', 'Deve retornar code: PARENT_NOT_FOUND');
  assertEqual(mockRepo25.listCallCount, 0, 'NÃO deve chamar listByParticularId');

  // [TEST 26] Conselho Particular Pai Pertence a Outra Central (PARENT_CENTRAL_MISMATCH)
  console.log('\n[TEST 26] Conselho Particular Pai Pertence a Outra Central');
  const mockRepo26 = new MockConferenciaRepository();
  mockRepo26.particularesMap.set('cp-outra-central', {
    id: 'cp-outra-central',
    centralId: 'central-OUTRA-999',
    name: 'CP Outra Central',
    normalizedName: 'CPOUTRACENTRAL',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });
  const res26 = await listConferencias('cp-outra-central', validAuthContext, mockRepo26);
  assertEqual(res26.success, false, 'Deve barrar pai de outro Conselho Central');
  assertEqual(res26.code, 'PARENT_CENTRAL_MISMATCH', 'Deve retornar code: PARENT_CENTRAL_MISMATCH');
  assertEqual(mockRepo26.listCallCount, 0, 'NÃO deve chamar listByParticularId');

  // [TEST 27] Pai Inativo é Permitido para Consulta Histórica
  console.log('\n[TEST 27] Pai Inativo é Permitido na Listagem');
  const mockRepo27 = new MockConferenciaRepository();
  mockRepo27.particularesMap.set('cp-inativo-pai', {
    id: 'cp-inativo-pai',
    centralId: validAuthContext.validatedCentralId!,
    name: 'CP Histórico Inativo',
    normalizedName: 'CPHISTORICOINATIVO',
    status: 'inativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });
  mockRepo27.conferenciasMap.set('conf-hist-1', {
    id: 'conf-hist-1',
    centralId: validAuthContext.validatedCentralId!,
    particularId: 'cp-inativo-pai',
    name: 'Conferência Histórica 1',
    normalizedName: 'CONFERENCIA HISTORICA 1',
    status: 'inativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });
  const res27 = await listConferencias('cp-inativo-pai', validAuthContext, mockRepo27, { status: 'todos' });
  assertEqual(res27.success, true, 'Deve permitir listagem mesmo com pai inativo');
  assertEqual(res27.code, 'SUCCESS', 'Deve retornar code: SUCCESS');
  assertEqual(res27.data!.items.length, 1, 'Deve retornar a conferência vinculada');

  // [TEST 28] Status Padrão Ativo e Filtros Explícitos
  console.log('\n[TEST 28] Status Padrão e Filtros Explícitos');
  const mockRepo28 = new MockConferenciaRepository();
  mockRepo28.particularesMap.set(particularIdValid, validParentParticular);
  mockRepo28.conferenciasMap.set('conf-a1', {
    id: 'conf-a1',
    centralId: validAuthContext.validatedCentralId!,
    particularId: particularIdValid,
    name: 'Conferência Ativa',
    normalizedName: 'conferenciaativa',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });
  mockRepo28.conferenciasMap.set('conf-i1', {
    id: 'conf-i1',
    centralId: validAuthContext.validatedCentralId!,
    particularId: particularIdValid,
    name: 'Conferência Inativa',
    normalizedName: 'conferenciainativa',
    status: 'inativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });

  const res28Default = await listConferencias(particularIdValid, validAuthContext, mockRepo28);
  assertEqual(res28Default.data!.items.length, 1, 'Status padrão deve retornar apenas ativas (1 item)');
  assertEqual(res28Default.data!.items[0].status, 'ativo', 'Item retornado deve ser ativo');

  const res28Inativo = await listConferencias(particularIdValid, validAuthContext, mockRepo28, { status: 'inativo' });
  assertEqual(res28Inativo.data!.items.length, 1, 'Filtro status inativo retorna 1');
  assertEqual(res28Inativo.data!.items[0].status, 'inativo', 'Item retornado deve ser inativo');

  const res28Todos = await listConferencias(particularIdValid, validAuthContext, mockRepo28, { status: 'todos' });
  assertEqual(res28Todos.data!.items.length, 2, 'Filtro status todos retorna os 2 itens');

  // [TEST 29] Status Inválido Retorna INVALID_OPTIONS
  console.log('\n[TEST 29] Status Inválido Retorna INVALID_OPTIONS');
  const mockRepo29 = new MockConferenciaRepository();
  mockRepo29.particularesMap.set(particularIdValid, validParentParticular);
  const res29 = await listConferencias(particularIdValid, validAuthContext, mockRepo29, { status: 'suspenso' as any });
  assertEqual(res29.success, false, 'Deve rejeitar status inválido');
  assertEqual(res29.code, 'INVALID_OPTIONS', 'Deve retornar code: INVALID_OPTIONS');

  // [TEST 30] Validação Estrita de Limit
  console.log('\n[TEST 30] Validação Estrita de Limit');
  const mockRepo30 = new MockConferenciaRepository();
  mockRepo30.particularesMap.set(particularIdValid, validParentParticular);

  // Popula 55 conferências
  for (let i = 1; i <= 55; i++) {
    const pad = String(i).padStart(2, '0');
    mockRepo30.conferenciasMap.set(`conf-${pad}`, {
      id: `conf-${pad}`,
      centralId: validAuthContext.validatedCentralId!,
      particularId: particularIdValid,
      name: `Conferência ${pad}`,
      normalizedName: `conferencia${pad}`,
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
      updatedBy: 'admin',
    });
  }

  // Omitido usa 50
  const res30Omit = await listConferencias(particularIdValid, validAuthContext, mockRepo30);
  assertEqual(res30Omit.data!.items.length, 50, 'Limit omitido deve retornar 50 itens');
  assertEqual(res30Omit.data!.hasMore, true, 'hasMore deve ser true com 55 itens');

  // Limit 1 e 100 aceitos
  const res30Limit1 = await listConferencias(particularIdValid, validAuthContext, mockRepo30, { limit: 1 });
  assertEqual(res30Limit1.data!.items.length, 1, 'Limit 1 aceito');
  const res30Limit100 = await listConferencias(particularIdValid, validAuthContext, mockRepo30, { limit: 100 });
  assertEqual(res30Limit100.data!.items.length, 55, 'Limit 100 aceito');

  // Rejeições de limit inválido
  const res30Zero = await listConferencias(particularIdValid, validAuthContext, mockRepo30, { limit: 0 });
  assertEqual(res30Zero.code, 'INVALID_OPTIONS', 'Limit 0 deve retornar INVALID_OPTIONS');
  const res30Neg = await listConferencias(particularIdValid, validAuthContext, mockRepo30, { limit: -5 });
  assertEqual(res30Neg.code, 'INVALID_OPTIONS', 'Limit negativo deve retornar INVALID_OPTIONS');
  const res30Dec = await listConferencias(particularIdValid, validAuthContext, mockRepo30, { limit: 10.5 });
  assertEqual(res30Dec.code, 'INVALID_OPTIONS', 'Limit decimal deve retornar INVALID_OPTIONS');
  const res30Above = await listConferencias(particularIdValid, validAuthContext, mockRepo30, { limit: 101 });
  assertEqual(res30Above.code, 'INVALID_OPTIONS', 'Limit > 100 deve retornar INVALID_OPTIONS');
  const res30Str = await listConferencias(particularIdValid, validAuthContext, mockRepo30, { limit: '50' as any });
  assertEqual(res30Str.code, 'INVALID_OPTIONS', 'Limit string deve retornar INVALID_OPTIONS');

  // [TEST 31] Isolamento Simultâneo por centralId e particularId
  console.log('\n[TEST 31] Isolamento Simultâneo por centralId e particularId');
  const mockRepo31 = new MockConferenciaRepository();
  mockRepo31.particularesMap.set(particularIdValid, validParentParticular);

  // Conf no CP certo e Central certa
  mockRepo31.conferenciasMap.set('conf-correta', {
    id: 'conf-correta',
    centralId: validAuthContext.validatedCentralId!,
    particularId: particularIdValid,
    name: 'Conferência Correta',
    normalizedName: 'conferenciacorreta',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });
  // Conf em outro CP
  mockRepo31.conferenciasMap.set('conf-outro-cp', {
    id: 'conf-outro-cp',
    centralId: validAuthContext.validatedCentralId!,
    particularId: 'cp-outro-valido',
    name: 'Conferência Outro CP',
    normalizedName: 'conferenciaoutrocp',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });
  // Conf em outra Central
  mockRepo31.conferenciasMap.set('conf-outra-central', {
    id: 'conf-outra-central',
    centralId: 'central-OUTRA',
    particularId: particularIdValid,
    name: 'Conferência Outra Central',
    normalizedName: 'conferenciaoutracentral',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
  });

  const res31 = await listConferencias(particularIdValid, validAuthContext, mockRepo31);
  assertEqual(res31.data!.items.length, 1, 'Deve retornar exclusivamente 1 conferência');
  assertEqual(res31.data!.items[0].id, 'conf-correta', 'Deve ser o ID da conferência do escopo correto');

  // [TEST 32] Sucesso Retorna items, hasMore, nextCursor e totalReturned
  console.log('\n[TEST 32] Sucesso Retorna Contrato Completo');
  const res32 = await listConferencias(particularIdValid, validAuthContext, mockRepo31);
  assertEqual(res32.success, true, 'Sucesso deve ser true');
  assertEqual(res32.code, 'SUCCESS', 'Code deve ser SUCCESS');
  assertEqual(Array.isArray(res32.data!.items), true, 'items deve ser um array');
  assertEqual(typeof res32.data!.hasMore, 'boolean', 'hasMore deve ser boolean');
  assertEqual(res32.data!.totalReturned, 1, 'totalReturned deve ser 1');

  // [TEST 33] Falha do Repositório Retorna STORAGE_ERROR sem Mensagem Interna
  console.log('\n[TEST 33] Falha do Repositório Retorna STORAGE_ERROR');
  const mockRepo33 = new MockConferenciaRepository();
  mockRepo33.particularesMap.set(particularIdValid, validParentParticular);
  mockRepo33.shouldThrowOnList = true;

  const res33 = await listConferencias(particularIdValid, validAuthContext, mockRepo33);
  assertEqual(res33.success, false, 'Deve falhar');
  assertEqual(res33.code, 'STORAGE_ERROR', 'Deve retornar STORAGE_ERROR');
  assertEqual(res33.error?.includes('confidencial'), false, 'Não deve expor mensagem interna do driver');

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

