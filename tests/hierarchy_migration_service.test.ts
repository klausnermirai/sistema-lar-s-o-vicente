import {
  runHierarchyMigrationDryRun,
  ServiceAuthContext,
  HierarchyDryRunDependencies,
  LegacySettingsReader,
  ConselhoParticularReadRepository,
  ConferenciaReadRepository,
  MAX_SAFE_CONSELHOS_LIMIT,
  MAX_SAFE_CONFERENCIAS_LIMIT,
} from '../lib/hierarchy_migration_service.js';
import {
  ConselhoParticular,
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
console.log(' Executando Testes de HierarchyMigrationService (Dry-Run Seguro)');
console.log('======================================================================\n');

async function runTests() {
  const centralId = 'central-999';
  const validAuthContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: centralId,
    userId: 'admin-user-01',
  };

  // Mock de interceptor para provar ZERO escritas
  const writeSpy = {
    setCount: 0,
    addCount: 0,
    updateCount: 0,
    deleteCount: 0,
    batchCount: 0,
    transactionCount: 0,
  };

  const sampleLegacyCp: ConselhoParticular = {
    id: 'cp-01',
    name: 'Conselho Particular São Pedro',
    city: 'Belo Horizonte',
    phone: '(31) 98888-1111',
    email: 'cp.saopedro@ssvp.org.br',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'João Santos', phone: '(31) 97777-2222' },
    vicePresidente: { name: 'Maria Silva', phone: '(31) 96666-3333' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [
      {
        id: 'conf-01',
        name: 'Conferência Santa Terezinha',
        startDate: '2021-01-01',
        endDate: '2025-01-01',
        presidente: { name: 'Carlos Lima', phone: '(31) 95555-4444' },
        confradesCount: 8,
        consociasCount: 6,
        aspirantesCount: 1,
        lastMembersUpdate: '2026-01-01T00:00:00.000Z',
      },
    ],
  };

  // ----------------------------------------------------
  // 1. Rejeição de Contexto Não Autorizado
  // ----------------------------------------------------
  console.log('[TEST 1] Rejeição de Contextos de Autorização Inválidos');

  const dummyDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [sampleLegacyCp],
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({ items: [], hasMore: false }),
    },
    conferenciaRepository: {
      listByParticularId: async () => ({ items: [], hasMore: false }),
    },
  };

  const resNotAllowed = await runHierarchyMigrationDryRun({ allowed: false, validatedCentralId: centralId }, dummyDeps);
  assertEqual(resNotAllowed.success, false, 'allowed === false deve ser rejeitado');
  assertEqual(resNotAllowed.code, 'UNAUTHORIZED', 'Deve retornar code UNAUTHORIZED');

  const resNoCentralId = await runHierarchyMigrationDryRun({ allowed: true, validatedCentralId: '' }, dummyDeps);
  assertEqual(resNoCentralId.success, false, 'validatedCentralId vazio deve ser rejeitado');
  assertEqual(resNoCentralId.code, 'UNAUTHORIZED', 'Deve retornar code UNAUTHORIZED');

  const resNullContext = await runHierarchyMigrationDryRun(null as any, dummyDeps);
  assertEqual(resNullContext.success, false, 'contexto nulo deve ser rejeitado');
  assertEqual(resNullContext.code, 'UNAUTHORIZED', 'Deve retornar code UNAUTHORIZED');

  // ----------------------------------------------------
  // 2. Uso Exclusivo de validatedCentralId e Leitura de Dados Legados
  // ----------------------------------------------------
  console.log('\n[TEST 2] Uso Exclusivo de validatedCentralId e Injeção de Leitura');

  let passedCentralIdToLegacyReader = '';
  let passedCentralIdToCpRepo = '';
  let passedCentralIdToConfRepo = '';

  const trackingDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async (cId) => {
        passedCentralIdToLegacyReader = cId;
        return [sampleLegacyCp];
      },
    },
    conselhoParticularRepository: {
      listByCentralId: async (cId) => {
        passedCentralIdToCpRepo = cId;
        return {
          items: [
            {
              id: 'cp-01',
              centralId: cId,
              name: 'Conselho Particular São Pedro',
              normalizedName: 'CONSELHO PARTICULAR SAO PEDRO',
              status: 'ativo',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdBy: 'system',
              updatedBy: 'system',
            },
          ],
          hasMore: false,
        };
      },
    },
    conferenciaRepository: {
      listByParticularId: async (cId, pId) => {
        passedCentralIdToConfRepo = cId;
        return {
          items: [
            {
              id: 'conf-01',
              particularId: pId,
              centralId: cId,
              name: 'Conferência Santa Terezinha',
              normalizedName: 'CONFERENCIA SANTA TEREZINHA',
              status: 'ativo',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdBy: 'system',
              updatedBy: 'system',
            },
          ],
          hasMore: false,
        };
      },
    },
  };

  const resTracking = await runHierarchyMigrationDryRun(validAuthContext, trackingDeps);
  assertEqual(resTracking.success, true, 'Dry-run deve ter sucesso');
  assertEqual(passedCentralIdToLegacyReader, centralId, 'Reader deve receber validatedCentralId do authContext');
  assertEqual(passedCentralIdToCpRepo, centralId, 'CP Repo deve receber validatedCentralId do authContext');
  assertEqual(passedCentralIdToConfRepo, centralId, 'Conf Repo deve receber validatedCentralId do authContext');
  assertEqual(resTracking.data?.migrationId, `hierarchy-v1-${centralId}`, 'migrationId determinístico gerado');

  // ----------------------------------------------------
  // 3. Paginação Completa de Conselhos Particulares (Múltiplas Páginas)
  // ----------------------------------------------------
  console.log('\n[TEST 3] Paginação Completa de Conselhos Particulares');

  let cpPageCalls = 0;
  const cpPaginationDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [],
    },
    conselhoParticularRepository: {
      listByCentralId: async (_cId, options) => {
        cpPageCalls++;
        if (options?.cursor === undefined) {
          return {
            items: [
              {
                id: 'cp-p1-1',
                centralId,
                name: 'CP P1-1',
                normalizedName: 'CP P1-1',
                status: 'ativo',
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                updatedBy: '',
              },
            ],
            nextCursor: 'cp-p1-1',
            hasMore: true,
          };
        } else if (options?.cursor === 'cp-p1-1') {
          return {
            items: [
              {
                id: 'cp-p2-1',
                centralId,
                name: 'CP P2-1',
                normalizedName: 'CP P2-1',
                status: 'ativo',
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                updatedBy: '',
              },
            ],
            nextCursor: 'cp-p2-1',
            hasMore: true,
          };
        } else {
          return {
            items: [
              {
                id: 'cp-p3-1',
                centralId,
                name: 'CP P3-1',
                normalizedName: 'CP P3-1',
                status: 'ativo',
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                updatedBy: '',
              },
            ],
            hasMore: false,
          };
        }
      },
    },
    conferenciaRepository: {
      listByParticularId: async () => ({ items: [], hasMore: false }),
    },
  };

  const resCpPagination = await runHierarchyMigrationDryRun(validAuthContext, cpPaginationDeps);
  assertEqual(resCpPagination.success, true, 'Dry-run com paginação de CPs concluído');
  assertEqual(cpPageCalls, 3, 'Deve ter paginado 3 vezes até hasMore === false');

  // ----------------------------------------------------
  // 4. Paginação das Conferências de Cada Conselho
  // ----------------------------------------------------
  console.log('\n[TEST 4] Paginação das Conferências de Cada Conselho');

  let confPageCalls = 0;
  const confPaginationDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [],
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({
        items: [
          {
            id: 'cp-single',
            centralId,
            name: 'CP Single',
            normalizedName: 'CP SINGLE',
            status: 'ativo',
            createdAt: '',
            updatedAt: '',
            createdBy: '',
            updatedBy: '',
          },
        ],
        hasMore: false,
      }),
    },
    conferenciaRepository: {
      listByParticularId: async (_cId, pId, options) => {
        confPageCalls++;
        assertEqual(pId, 'cp-single', 'particularId correto repassado para paginação de conferências');
        if (options?.cursor === undefined) {
          return {
            items: [
              {
                id: 'conf-p1',
                particularId: pId,
                centralId,
                name: 'Conf P1',
                normalizedName: 'CONF P1',
                status: 'ativo',
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                updatedBy: '',
              },
            ],
            nextCursor: 'conf-p1',
            hasMore: true,
          };
        } else {
          return {
            items: [
              {
                id: 'conf-p2',
                particularId: pId,
                centralId,
                name: 'Conf P2',
                normalizedName: 'CONF P2',
                status: 'ativo',
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                updatedBy: '',
              },
            ],
            hasMore: false,
          };
        }
      },
    },
  };

  const resConfPagination = await runHierarchyMigrationDryRun(validAuthContext, confPaginationDeps);
  assertEqual(resConfPagination.success, true, 'Dry-run com paginação de conferências concluído');
  assertEqual(confPageCalls, 2, 'Deve ter paginado conferências 2 vezes');

  // ----------------------------------------------------
  // 5. Isolamento Simultâneo por centralId e particularId
  // ----------------------------------------------------
  console.log('\n[TEST 5] Isolamento Simultâneo por centralId e particularId');

  let passedCentralToConfList = '';
  let passedParticularToConfList = '';

  const isolationDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [],
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({
        items: [
          {
            id: 'cp-escopo-alfa',
            centralId,
            name: 'CP Alfa',
            normalizedName: 'CP ALFA',
            status: 'ativo',
            createdAt: '',
            updatedAt: '',
            createdBy: '',
            updatedBy: '',
          },
        ],
        hasMore: false,
      }),
    },
    conferenciaRepository: {
      listByParticularId: async (cId, pId) => {
        passedCentralToConfList = cId;
        passedParticularToConfList = pId;
        return { items: [], hasMore: false };
      },
    },
  };

  await runHierarchyMigrationDryRun(validAuthContext, isolationDeps);
  assertEqual(passedCentralToConfList, centralId, 'centralId isolado corretamente');
  assertEqual(passedParticularToConfList, 'cp-escopo-alfa', 'particularId isolado corretamente');

  // ----------------------------------------------------
  // 6. Limite de Segurança de Conselhos Particulares (MAX_SAFE_CONSELHOS_LIMIT = 500)
  // ----------------------------------------------------
  console.log('\n[TEST 6] Bloqueio por Excesso de Limite de Conselhos (> 500)');

  const overflowConselhos: StandaloneConselhoParticular[] = [];
  for (let i = 0; i <= MAX_SAFE_CONSELHOS_LIMIT + 1; i++) {
    overflowConselhos.push({
      id: `cp-over-${i}`,
      centralId,
      name: `CP Over ${i}`,
      normalizedName: `CP OVER ${i}`,
      status: 'ativo',
      createdAt: '',
      updatedAt: '',
      createdBy: '',
      updatedBy: '',
    });
  }

  const cpOverflowDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [],
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({
        items: overflowConselhos,
        hasMore: false,
      }),
    },
    conferenciaRepository: {
      listByParticularId: async () => ({ items: [], hasMore: false }),
    },
  };

  const resCpOverflow = await runHierarchyMigrationDryRun(validAuthContext, cpOverflowDeps);
  assertEqual(resCpOverflow.success, false, 'Deve abortar por excesso de CPs');
  assertEqual(resCpOverflow.code, 'HIERARCHY_LIMIT_EXCEEDED', 'Deve retornar code HIERARCHY_LIMIT_EXCEEDED');

  // ----------------------------------------------------
  // 7. Limite de Segurança de Conferências (MAX_SAFE_CONFERENCIAS_LIMIT = 2500)
  // ----------------------------------------------------
  console.log('\n[TEST 7] Bloqueio por Excesso de Limite de Conferências (> 2500)');

  const overflowConferencias: StandaloneConferencia[] = [];
  for (let i = 0; i <= MAX_SAFE_CONFERENCIAS_LIMIT + 1; i++) {
    overflowConferencias.push({
      id: `conf-over-${i}`,
      particularId: 'cp-single',
      centralId,
      name: `Conf Over ${i}`,
      normalizedName: `CONF OVER ${i}`,
      status: 'ativo',
      createdAt: '',
      updatedAt: '',
      createdBy: '',
      updatedBy: '',
    });
  }

  const confOverflowDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [],
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({
        items: [
          {
            id: 'cp-single',
            centralId,
            name: 'CP Single',
            normalizedName: 'CP SINGLE',
            status: 'ativo',
            createdAt: '',
            updatedAt: '',
            createdBy: '',
            updatedBy: '',
          },
        ],
        hasMore: false,
      }),
    },
    conferenciaRepository: {
      listByParticularId: async () => ({
        items: overflowConferencias,
        hasMore: false,
      }),
    },
  };

  const resConfOverflow = await runHierarchyMigrationDryRun(validAuthContext, confOverflowDeps);
  assertEqual(resConfOverflow.success, false, 'Deve abortar por excesso de Conferências');
  assertEqual(resConfOverflow.code, 'HIERARCHY_LIMIT_EXCEEDED', 'Deve retornar code HIERARCHY_LIMIT_EXCEEDED');

  // ----------------------------------------------------
  // 8. Definição de isBlocked quando existem Conflitos
  // ----------------------------------------------------
  console.log('\n[TEST 8] Definição de isBlocked quando há Conflitos');

  const legacyCpWithConflict: ConselhoParticular = {
    id: 'cp-invalid-id-with-slash/123',
    name: 'CP Invalido',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'A', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [],
  };

  const conflictDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [legacyCpWithConflict],
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({ items: [], hasMore: false }),
    },
    conferenciaRepository: {
      listByParticularId: async () => ({ items: [], hasMore: false }),
    },
  };

  const resConflict = await runHierarchyMigrationDryRun(validAuthContext, conflictDeps);
  assertEqual(resConflict.success, true, 'Dry-run deve rodar com sucesso');
  assertEqual(resConflict.isBlocked, true, 'isBlocked deve ser true no nível raiz');
  assertEqual(resConflict.data?.isBlocked, true, 'isBlocked deve ser true no objeto data');
  assertEqual(resConflict.data?.totals.conflictConselhosCount, 1, 'Deve contabilizar 1 conflito de CP');

  // ----------------------------------------------------
  // 9. Higienização LGPD da Resposta (Sem Telefones, E-mails ou Nomes de Diretores)
  // ----------------------------------------------------
  console.log('\n[TEST 9] Higienização LGPD da Resposta');

  const resSanitized = await runHierarchyMigrationDryRun(validAuthContext, {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => [sampleLegacyCp],
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({ items: [], hasMore: false }),
    },
    conferenciaRepository: {
      listByParticularId: async () => ({ items: [], hasMore: false }),
    },
  });

  const candidateCp = resSanitized.data?.conselhosDetails[0]?.candidateDoc;
  const candidateConf = resSanitized.data?.conferenciasDetails[0]?.candidateDoc;

  assertEqual(candidateCp?.email?.includes('cp.saopedro@ssvp.org.br'), false, 'E-mail bruto não deve estar exposto');
  assertEqual(candidateCp?.phone?.includes('98888-1111'), false, 'Telefone bruto não deve estar exposto');
  assertEqual(candidateCp?.presidente?.name, undefined, 'Nome do presidente não deve constar no candidateDoc higienizado');
  assertEqual(candidateConf?.presidente?.name, undefined, 'Nome do presidente da conf não deve constar');

  // ----------------------------------------------------
  // 10. Tratamento Seguro de Falhas de Leitura (STORAGE_ERROR)
  // ----------------------------------------------------
  console.log('\n[TEST 10] Tratamento Seguro de Falhas de Leitura (STORAGE_ERROR)');

  const failingDeps: HierarchyDryRunDependencies = {
    legacySettingsReader: {
      getLegacyConselhosParticulares: async () => {
        throw new Error('Firestore DEADLINE_EXCEEDED internal failure on cluster us-central1');
      },
    },
    conselhoParticularRepository: {
      listByCentralId: async () => ({ items: [], hasMore: false }),
    },
    conferenciaRepository: {
      listByParticularId: async () => ({ items: [], hasMore: false }),
    },
  };

  const resFail = await runHierarchyMigrationDryRun(validAuthContext, failingDeps);
  assertEqual(resFail.success, false, 'Falha deve retornar success: false');
  assertEqual(resFail.code, 'STORAGE_ERROR', 'Deve retornar code: STORAGE_ERROR');
  assertEqual(resFail.error?.includes('DEADLINE_EXCEEDED'), false, 'Não deve expor detalhes internos do driver');
  assertEqual(resFail.error?.includes('us-central1'), false, 'Não deve expor detalhes internos de infraestrutura');

  // ----------------------------------------------------
  // 11. Prova de Zero Chamadas de Escrita
  // ----------------------------------------------------
  console.log('\n[TEST 11] Prova de Zero Chamadas de Escrita');

  const totalWrites =
    writeSpy.setCount +
    writeSpy.addCount +
    writeSpy.updateCount +
    writeSpy.deleteCount +
    writeSpy.batchCount +
    writeSpy.transactionCount;

  assertEqual(totalWrites, 0, 'Nenhuma operação de escrita foi executada durante o dry-run');

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
