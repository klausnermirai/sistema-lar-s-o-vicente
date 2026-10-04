import {
  createConselhoParticular,
  updateConselhoParticular,
  inactivateConselhoParticular,
  listConselhosParticulares,
  ConselhoParticularRepository,
  ServiceAuthContext,
} from '../lib/conselho_particular_service.js';
import {
  createConferencia,
  updateConferencia,
  inactivateConferencia,
  listConferencias,
  ConferenciaRepository,
} from '../lib/conferencia_service.js';
import {
  StandaloneConselhoParticular,
  StandaloneConferencia,
} from '../types.js';

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

console.log('======================================================================');
console.log(' Executando Testes de Rotas da API de Hierarquia (Backend)');
console.log('======================================================================\n');

async function runTests() {
  const centralId = 'central-001';
  const validAuthContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: centralId,
    userId: 'user-admin-1',
  };

  // ----------------------------------------------------
  // 1. Rota GET /api/conselhos-particulares
  // ----------------------------------------------------
  console.log('[TEST 1] Rota GET /api/conselhos-particulares');

  const mockCpListRepo: ConselhoParticularRepository = {
    createAtomically: async () => ({ created: true }),
    getById: async () => null,
    updateAtomically: async () => ({ updated: true }),
    inactivateAtomically: async () => ({ inactivated: true }),
    listByCentralId: async (cId, options) => {
      assertEqual(cId, centralId, 'GET CPs deve filtrar pelo centralId do contexto seguro');
      return {
        items: [
          {
            id: 'cp-01',
            centralId: cId,
            name: 'Conselho Particular São José',
            normalizedName: 'CONSELHO PARTICULAR SAO JOSE',
            status: 'ativo',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            createdBy: 'user-admin-1',
            updatedBy: 'user-admin-1',
          },
        ],
        hasMore: false,
      };
    },
  };

  const listCpRes = await listConselhosParticulares(validAuthContext, mockCpListRepo, { status: 'ativo', limit: 50 });
  assertEqual(listCpRes.success, true, 'Listagem de CPs deve ter sucesso');
  assertEqual(listCpRes.data?.items.length, 1, 'Deve retornar 1 Conselho Particular');
  assertEqual(listCpRes.data?.items[0].name, 'Conselho Particular São José', 'Nome do CP confere');

  // ----------------------------------------------------
  // 2. Rota POST /api/conselhos-particulares
  // ----------------------------------------------------
  console.log('\n[TEST 2] Rota POST /api/conselhos-particulares');

  let savedCpData: StandaloneConselhoParticular | null = null;
  const mockCpCreateRepo: ConselhoParticularRepository = {
    createAtomically: async (data) => {
      savedCpData = data;
      return {
        created: true,
        record: {
          ...data,
          id: 'generated-cp-id-123',
        },
      };
    },
    getById: async () => null,
    updateAtomically: async () => ({ updated: true }),
    inactivateAtomically: async () => ({ inactivated: true }),
    listByCentralId: async () => ({ items: [], hasMore: false }),
  };

  const createCpRes = await createConselhoParticular(
    {
      name: 'Conselho Particular Santa Maria',
      city: 'Belo Horizonte',
      phone: '(31) 98888-0000',
    },
    validAuthContext,
    mockCpCreateRepo
  );

  assertEqual(createCpRes.success, true, 'Criação de CP deve retornar success: true (HTTP 201)');
  assertEqual(createCpRes.data?.id, 'generated-cp-id-123', 'ID retornado confere');
  assertEqual(createCpRes.data?.centralId, centralId, 'centralId atribuído do contexto seguro');
  assertEqual(savedCpData?.createdBy, 'user-admin-1', 'Auditoria createdBy preenchida corretamente');

  // ----------------------------------------------------
  // 3. Rota PUT /api/conselhos-particulares/:id
  // ----------------------------------------------------
  console.log('\n[TEST 3] Rota PUT /api/conselhos-particulares/:id');

  const existingCp: StandaloneConselhoParticular = {
    id: 'cp-target-01',
    centralId: centralId,
    name: 'Conselho Particular Antigo',
    normalizedName: 'CONSELHO PARTICULAR ANTIGO',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  const mockCpUpdateRepo: ConselhoParticularRepository = {
    createAtomically: async () => ({ created: true }),
    getById: async (id) => (id === 'cp-target-01' ? existingCp : null),
    updateAtomically: async (_id, _cId, data) => ({
      updated: true,
      record: data,
    }),
    inactivateAtomically: async () => ({ inactivated: true }),
    listByCentralId: async () => ({ items: [], hasMore: false }),
  };

  const updateCpRes = await updateConselhoParticular(
    'cp-target-01',
    {
      name: 'Conselho Particular Atualizado',
      city: 'Nova Lima',
    },
    validAuthContext,
    mockCpUpdateRepo
  );

  assertEqual(updateCpRes.success, true, 'Atualização de CP deve retornar success: true (HTTP 200)');
  assertEqual(updateCpRes.data?.name, 'Conselho Particular Atualizado', 'Nome atualizado com sucesso');

  // ----------------------------------------------------
  // 4. Rota POST /api/conselhos-particulares/:id/inativar
  // ----------------------------------------------------
  console.log('\n[TEST 4] Rota POST /api/conselhos-particulares/:id/inativar');

  const mockCpInactivateRepo: ConselhoParticularRepository = {
    createAtomically: async () => ({ created: true }),
    getById: async (id) => (id === 'cp-target-01' ? existingCp : null),
    updateAtomically: async () => ({ updated: true }),
    inactivateAtomically: async (_id, _cId) => ({
      inactivated: true,
      record: {
        ...existingCp,
        status: 'inativo',
        updatedBy: 'user-admin-1',
      },
    }),
    listByCentralId: async () => ({ items: [], hasMore: false }),
  };

  const inactivateCpRes = await inactivateConselhoParticular(
    'cp-target-01',
    validAuthContext,
    mockCpInactivateRepo
  );

  assertEqual(inactivateCpRes.success, true, 'Inativação de CP deve retornar success: true (HTTP 200)');
  assertEqual(inactivateCpRes.data?.status, 'inativo', 'Status alterado para inativo');

  // ----------------------------------------------------
  // 5. Rota GET /api/conselhos-particulares/:particularId/conferencias
  // ----------------------------------------------------
  console.log('\n[TEST 5] Rota GET /api/conselhos-particulares/:particularId/conferencias');

  const mockConfListRepo: ConferenciaRepository = {
    getParticularById: async (pId) => (pId === 'cp-target-01' ? existingCp : null),
    createAtomically: async () => ({ created: true }),
    getById: async () => null,
    updateAtomically: async () => ({ updated: true }),
    inactivateAtomically: async () => ({ inactivated: true }),
    listByParticularId: async (cId, pId) => {
      assertEqual(cId, centralId, 'GET Conferências deve filtrar pelo centralId seguro');
      assertEqual(pId, 'cp-target-01', 'GET Conferências deve filtrar pelo particularId da rota');
      return {
        items: [
          {
            id: 'conf-01',
            particularId: pId,
            centralId: cId,
            name: 'Conferência Santa Luzia',
            normalizedName: 'CONFERENCIA SANTA LUZIA',
            status: 'ativo',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            createdBy: 'user-admin-1',
            updatedBy: 'user-admin-1',
          },
        ],
        hasMore: false,
      };
    },
  };

  const listConfRes = await listConferencias('cp-target-01', validAuthContext, mockConfListRepo, { status: 'todos' });
  assertEqual(listConfRes.success, true, 'Listagem de conferências deve ter sucesso');
  assertEqual(listConfRes.data?.items.length, 1, 'Deve retornar 1 Conferência vinculada');
  assertEqual(listConfRes.data?.items[0].particularId, 'cp-target-01', 'particularId confere');

  // ----------------------------------------------------
  // 6. Rota POST /api/conselhos-particulares/:particularId/conferencias
  // ----------------------------------------------------
  console.log('\n[TEST 6] Rota POST /api/conselhos-particulares/:particularId/conferencias');

  let savedConfData: StandaloneConferencia | null = null;
  const mockConfCreateRepo: ConferenciaRepository = {
    getParticularById: async (pId) => (pId === 'cp-target-01' ? existingCp : null),
    createAtomically: async (_cId, _pId, data) => {
      savedConfData = data;
      return {
        created: true,
        record: {
          ...data,
          id: 'generated-conf-id-456',
        },
      };
    },
    getById: async () => null,
    updateAtomically: async () => ({ updated: true }),
    inactivateAtomically: async () => ({ inactivated: true }),
    listByParticularId: async () => ({ items: [], hasMore: false }),
  };

  const createConfRes = await createConferencia(
    'cp-target-01',
    {
      name: 'Conferência Santo Antônio',
      confradesCount: 5,
      consociasCount: 7,
      aspirantesCount: 2,
    },
    validAuthContext,
    mockConfCreateRepo
  );

  assertEqual(createConfRes.success, true, 'Criação de Conferência deve retornar success: true (HTTP 201)');
  assertEqual(createConfRes.data?.id, 'generated-conf-id-456', 'ID retornado confere');
  assertEqual(createConfRes.data?.particularId, 'cp-target-01', 'particularId vinculado corretamente');
  assertEqual(savedConfData?.centralId, centralId, 'centralId atribuído pelo contexto seguro');

  // ----------------------------------------------------
  // 7. Rota PUT /api/conselhos-particulares/:particularId/conferencias/:id
  // ----------------------------------------------------
  console.log('\n[TEST 7] Rota PUT /api/conselhos-particulares/:particularId/conferencias/:id');

  const existingConf: StandaloneConferencia = {
    id: 'conf-target-01',
    particularId: 'cp-target-01',
    centralId: centralId,
    name: 'Conferência Nome Antigo',
    normalizedName: 'CONFERENCIA NOME ANTIGO',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  const mockConfUpdateRepo: ConferenciaRepository = {
    getParticularById: async (pId) => (pId === 'cp-target-01' ? existingCp : null),
    createAtomically: async () => ({ created: true }),
    getById: async (id) => (id === 'conf-target-01' ? existingConf : null),
    updateAtomically: async (_id, _cId, _pId, data) => ({
      updated: true,
      record: data,
    }),
    inactivateAtomically: async () => ({ inactivated: true }),
    listByParticularId: async () => ({ items: [], hasMore: false }),
  };

  const updateConfRes = await updateConferencia(
    'conf-target-01',
    'cp-target-01',
    {
      name: 'Conferência Nome Novo',
      confradesCount: 10,
    },
    validAuthContext,
    mockConfUpdateRepo
  );

  assertEqual(updateConfRes.success, true, 'Atualização de Conferência deve retornar success: true (HTTP 200)');
  assertEqual(updateConfRes.data?.name, 'Conferência Nome Novo', 'Nome da conferência atualizado');

  // ----------------------------------------------------
  // 8. Rota POST /api/conselhos-particulares/:particularId/conferencias/:id/inativar
  // ----------------------------------------------------
  console.log('\n[TEST 8] Rota POST /api/conselhos-particulares/:particularId/conferencias/:id/inativar');

  const mockConfInactivateRepo: ConferenciaRepository = {
    getParticularById: async (pId) => (pId === 'cp-target-01' ? existingCp : null),
    createAtomically: async () => ({ created: true }),
    getById: async (id) => (id === 'conf-target-01' ? existingConf : null),
    updateAtomically: async () => ({ updated: true }),
    inactivateAtomically: async (_id, _cId, _pId) => ({
      inactivated: true,
      record: {
        ...existingConf,
        status: 'inativo',
        updatedBy: 'user-admin-1',
      },
    }),
    listByParticularId: async () => ({ items: [], hasMore: false }),
  };

  const inactivateConfRes = await inactivateConferencia(
    'conf-target-01',
    'cp-target-01',
    validAuthContext,
    mockConfInactivateRepo
  );

  assertEqual(inactivateConfRes.success, true, 'Inativação de Conferência deve retornar success: true (HTTP 200)');
  assertEqual(inactivateConfRes.data?.status, 'inativo', 'Status da conferência alterado para inativo');

  console.log('\n======================================================================');
  console.log(` RESULTADOS DOS TESTES: ${passedTests} Passou | ${failedTests} Falhou`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal executando testes:', err);
  process.exit(1);
});
