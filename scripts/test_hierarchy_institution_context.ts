import { getAuthHeaders } from '../lib/api.js';

// Mock simples de localStorage em memória para os testes em ambiente Node.js
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();
(globalThis as any).localStorage = mockStorage;

function runContextTests() {
  console.log('================================================================================');
  console.log(' EXECUTANDO TESTES DE CONTEXTO INSTITUCIONAL DA HIERARQUIA (CONSELHO CENTRAL)');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, message?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}: ${message || 'Asserção falhou'}`);
      failed++;
    }
  }

  // TESTE 1: Sessão de Conselho Central com institutionId demo/antigo e CNPJ válido
  mockStorage.setItem(
    'ssvp_session',
    JSON.stringify({
      id: 'token_user_123',
      username: 'kwarizaya@gmail.com',
      cnpj: '54.927.132/0001-92',
      institutionId: 'demo-institution-id',
      accessLevel: 'administrador',
      hierarchy: {
        type: 'central',
        centralId: '54.927.132/0001-92',
      },
    })
  );

  const headers1 = getAuthHeaders() as Record<string, string>;
  assert(
    'Sessão com hierarchy.type="central" prioriza o CNPJ válido em vez de demo-institution-id',
    headers1['x-institution-id'] === '54.927.132/0001-92' && headers1['Authorization'] === 'Bearer token_user_123',
    `Recebido x-institution-id: "${headers1['x-institution-id']}" (esperado: "54.927.132/0001-92")`
  );

  // TESTE 2: Sessão de Conselho Central sem institutionId (apenas CNPJ)
  mockStorage.setItem(
    'ssvp_session',
    JSON.stringify({
      id: 'token_user_central',
      username: 'central_jaboticabal',
      cnpj: '54.927.132/0001-92',
      accessLevel: 'administrador',
      hierarchy: {
        type: 'central',
      },
    })
  );

  const headers2 = getAuthHeaders() as Record<string, string>;
  assert(
    'Sessão com hierarchy.type="central" sem institutionId usa session.cnpj corretamente',
    headers2['x-institution-id'] === '54.927.132/0001-92',
    `Recebido: "${headers2['x-institution-id']}"`
  );

  // TESTE 3: Sessão de Obra Unida / Lar com institutionId próprio real
  mockStorage.setItem(
    'ssvp_session',
    JSON.stringify({
      id: 'token_lar_1',
      username: 'usuario_lar',
      cnpj: '11.222.333/0001-44',
      institutionId: 'inst_obra_unida_real_99',
      accessLevel: 'administrador',
      hierarchy: {
        type: 'obra_unida',
      },
    })
  );

  const headers3 = getAuthHeaders() as Record<string, string>;
  assert(
    'Sessão de Obra Unida com institutionId real preserva seu ID original',
    headers3['x-institution-id'] === 'inst_obra_unida_real_99',
    `Recebido: "${headers3['x-institution-id']}"`
  );

  // TESTE 4: Sessão de Demonstração legítima (sem CNPJ alternativo)
  mockStorage.setItem(
    'ssvp_session',
    JSON.stringify({
      id: 'demo_user',
      username: 'demo',
      cnpj: '',
      institutionId: 'demo-institution-id',
      accessLevel: 'administrador',
    })
  );

  const headers4 = getAuthHeaders() as Record<string, string>;
  assert(
    'Sessão demo pura sem CNPJ mantém demo-institution-id para ambiente de teste',
    headers4['x-institution-id'] === 'demo-institution-id',
    `Recebido: "${headers4['x-institution-id']}"`
  );

  // TESTE 5: Passagem explícita de customInstitutionId para sobrescrita segura
  mockStorage.setItem(
    'ssvp_session',
    JSON.stringify({
      id: 'token_admin',
      username: 'superadmin',
      cnpj: '00.000.000/0001-00',
      institutionId: 'inst_admin',
    })
  );

  const headers5 = getAuthHeaders('54.927.132/0001-92') as Record<string, string>;
  assert(
    'customInstitutionId explícito tem precedência direta na chamada',
    headers5['x-institution-id'] === '54.927.132/0001-92',
    `Recebido: "${headers5['x-institution-id']}"`
  );

  console.log('\n================================================================================');
  console.log(` TOTAL DE TESTES: ${passed + failed} | SUCESSO: ${passed} | FALHAS: ${failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runContextTests();
