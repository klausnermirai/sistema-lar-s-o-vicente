import {
  fetchConselhosParticulares,
  createConselhoParticular,
  updateConselhoParticular,
  inactivateConselhoParticular,
  fetchConferencias,
  createConferencia,
  updateConferencia,
  inactivateConferencia,
  HierarchyApiError
} from '../lib/hierarchy_api';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    testsFailed++;
  }
}

// Mock global fetch
const originalFetch = global.fetch;

async function runHierarchyApiClientTests() {
  console.log('======================================================================');
  console.log(' Executando Testes do Cliente Hierarchy API (lib/hierarchy_api.ts)');
  console.log('======================================================================');

  // TEST 1: fetchConselhosParticulares com filtro e sucesso
  console.log('\n[TEST 1] fetchConselhosParticulares envia status e cabeçalhos corretos');
  let lastUrl = '';
  let lastOptions: any = null;

  global.fetch = async (url: any, init?: any) => {
    lastUrl = url.toString();
    lastOptions = init;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [
        { id: 'cp-1', name: 'CP São Vicente', centralId: 'cc-1', status: 'ativo' }
      ]
    } as any;
  };

  const cps = await fetchConselhosParticulares('ativo');
  assert(cps.length === 1, 'Deve retornar 1 Conselho');
  assert(cps[0].id === 'cp-1', 'ID do Conselho deve ser cp-1');
  assert(lastUrl.includes('/api/conselhos-particulares?status=ativo'), 'URL deve conter query status=ativo');

  // TEST 2: createConselhoParticular envia POST e payload
  console.log('\n[TEST 2] createConselhoParticular envia POST e payload formatado');
  global.fetch = async (url: any, init?: any) => {
    lastUrl = url.toString();
    lastOptions = init;
    return {
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'cp-new', name: 'CP Santo Antônio', status: 'ativo' })
    } as any;
  };

  const createdCp = await createConselhoParticular({ name: 'CP Santo Antônio' });
  assert(createdCp.id === 'cp-new', 'Novo CP retornado com id correto');
  assert(lastOptions.method === 'POST', 'Método HTTP deve ser POST');
  assert(lastUrl === '/api/conselhos-particulares', 'URL de criação correta');
  assert(JSON.parse(lastOptions.body).name === 'CP Santo Antônio', 'Payload contém nome correto');

  // TEST 3: Tratamento de Erro e HierarchyApiError
  console.log('\n[TEST 3] Erro do backend é encapsulado em HierarchyApiError');
  global.fetch = async () => {
    return {
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Já existe um Conselho com este nome.', code: 'DUPLICATE_NAME' })
    } as any;
  };

  try {
    await createConselhoParticular({ name: 'CP Duplicado' });
    assert(false, 'Deveria ter lançado erro');
  } catch (err: any) {
    assert(err instanceof HierarchyApiError, 'Erro deve ser instância de HierarchyApiError');
    assert(err.code === 'DUPLICATE_NAME', 'Código do erro deve ser DUPLICATE_NAME');
    assert(err.statusCode === 409, 'Status code deve ser 409');
    assert(err.message === 'Já existe um Conselho com este nome.', 'Mensagem de erro preservada');
  }

  // TEST 4: fetchConferencias com particularId e status
  console.log('\n[TEST 4] fetchConferencias isolado por particularId');
  global.fetch = async (url: any, init?: any) => {
    lastUrl = url.toString();
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [
        { id: 'conf-1', name: 'Conferência Santa Luzia', particularId: 'cp-10', status: 'ativo' }
      ]
    } as any;
  };

  const confs = await fetchConferencias('cp-10', 'ativo');
  assert(confs.length === 1, 'Deve retornar 1 Conferência');
  assert(lastUrl.includes('/api/conselhos-particulares/cp-10/conferencias?status=ativo'), 'URL de conferências com particularId e status');

  // TEST 5: inactivateConselhoParticular
  console.log('\n[TEST 5] inactivateConselhoParticular chama rota POST /inativar');
  global.fetch = async (url: any, init?: any) => {
    lastUrl = url.toString();
    lastOptions = init;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'cp-1', status: 'inativo' })
    } as any;
  };

  const inactCP = await inactivateConselhoParticular('cp-1');
  assert(inactCP.status === 'inativo', 'CP inativado com sucesso');
  assert(lastUrl === '/api/conselhos-particulares/cp-1/inativar', 'URL de inativação de CP correta');
  assert(lastOptions.method === 'POST', 'Método de inativação deve ser POST');

  // TEST 6: inactivateConferencia
  console.log('\n[TEST 6] inactivateConferencia chama rota POST /inativar');
  global.fetch = async (url: any, init?: any) => {
    lastUrl = url.toString();
    lastOptions = init;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'conf-1', particularId: 'cp-1', status: 'inativo' })
    } as any;
  };

  const inactConf = await inactivateConferencia('cp-1', 'conf-1');
  assert(inactConf.status === 'inativo', 'Conferência inativada com sucesso');
  assert(lastUrl === '/api/conselhos-particulares/cp-1/conferencias/conf-1/inativar', 'URL de inativação de Conferência correta');
  assert(lastOptions.method === 'POST', 'Método de inativação deve ser POST');

  // Restaura fetch
  global.fetch = originalFetch;

  console.log('======================================================================');
  console.log(` RESULTADOS DOS TESTES: ${testsPassed} Passou | ${testsFailed} Falhou`);
  console.log('======================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runHierarchyApiClientTests().catch((err) => {
  console.error('Erro fatal nos testes do cliente:', err);
  process.exit(1);
});
