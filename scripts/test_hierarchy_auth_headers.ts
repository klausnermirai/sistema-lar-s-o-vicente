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

function runAuthHeaderTests() {
  console.log('================================================================================');
  console.log(' EXECUTANDO TESTES DE AUTENTICAÇÃO E CABEÇALHOS HTTP (AUTHORIZATION + X-INSTITUTION-ID)');
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

  // TESTE 1: Sessão ativa do Conselho Central com token canônico (session.id) e CNPJ institucional
  mockStorage.setItem(
    'ssvp_session',
    JSON.stringify({
      id: 'token_canonico_usr_98765',
      username: 'kwarizaya@gmail.com',
      cnpj: '54.927.132/0001-92',
      institutionId: '54.927.132/0001-92',
      accessLevel: 'administrador',
      hierarchy: {
        type: 'central',
        centralId: '54.927.132/0001-92',
      },
    })
  );

  const headers1 = getAuthHeaders() as Record<string, string>;
  assert(
    'Sessão envia simultaneamente Authorization: Bearer <token> e x-institution-id: 54.927.132/0001-92',
    headers1['Authorization'] === 'Bearer token_canonico_usr_98765' &&
      headers1['x-institution-id'] === '54.927.132/0001-92' &&
      headers1['Content-Type'] === 'application/json',
    `Recebido: Authorization=${headers1['Authorization']}, x-institution-id=${headers1['x-institution-id']}`
  );

  // TESTE 2: customInstitutionId altera exclusivamente x-institution-id mantendo intacto o Authorization
  const headers2 = getAuthHeaders('custom_cp_institution_id') as Record<string, string>;
  assert(
    'customInstitutionId altera exclusivamente x-institution-id sem afetar o Authorization',
    headers2['Authorization'] === 'Bearer token_canonico_usr_98765' &&
      headers2['x-institution-id'] === 'custom_cp_institution_id',
    `Recebido: Authorization=${headers2['Authorization']}, x-institution-id=${headers2['x-institution-id']}`
  );

  // TESTE 3: Sessão sem token canônico (session.id ausente/vazio) não deve gerar Authorization e deve tratar como inválida
  mockStorage.setItem(
    'ssvp_session',
    JSON.stringify({
      username: 'usuario_sem_token',
      cnpj: '54.927.132/0001-92',
      hierarchy: { type: 'central' },
    })
  );

  const headers3 = getAuthHeaders('54.927.132/0001-92') as Record<string, string>;
  assert(
    'Sessão sem token canônico (session.id ausente) não injeta Authorization nem dados falsos',
    headers3['Authorization'] === undefined && headers3['x-institution-id'] === undefined,
    `Recebido: Authorization=${headers3['Authorization']}, x-institution-id=${headers3['x-institution-id']}`
  );

  // TESTE 4: Não há vazamento de headers quando localStorage está limpo (sessão expirada/logout)
  mockStorage.clear();
  const headers4 = getAuthHeaders('54.927.132/0001-92') as Record<string, string>;
  assert(
    'Sem sessão no localStorage, não há Authorization e não cria cabeçalhos autenticados',
    headers4['Authorization'] === undefined && headers4['x-institution-id'] === undefined,
    `Recebido: Authorization=${headers4['Authorization']}`
  );

  console.log('\n================================================================================');
  console.log(` TOTAL DE TESTES: ${passed + failed} | SUCESSO: ${passed} | FALHAS: ${failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthHeaderTests();
