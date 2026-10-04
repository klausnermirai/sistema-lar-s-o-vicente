import {
  planHierarchyMigration,
  sanitizeHierarchyPlanForLogs,
  isValidDocumentId,
  isValidDateString,
  isValidMemberCount,
} from '../lib/hierarchy_migration_planner.js';
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

console.log('===================================================');
console.log(' Executando Testes do Planejador de Migração de Hierarquia');
console.log('===================================================\n');

async function runTests() {
  const centralId = 'central-001';

  const legacyCp1: ConselhoParticular = {
    id: 'cp-101',
    name: 'Conselho Particular São José',
    city: 'Belo Horizonte',
    phone: '(31) 99999-1111',
    email: 'cp.saojose@ssvp.org.br',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'João Silva', phone: '(31) 98888-2222' },
    vicePresidente: { name: 'Maria Souza', phone: '(31) 97777-3333' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [
      {
        id: 'conf-201',
        name: 'Conferência Vicentina Santo Antônio',
        startDate: '2021-05-10',
        endDate: '2025-05-10',
        presidente: { name: 'Carlos Andrade', phone: '(31) 96666-4444' },
        confradesCount: 10,
        consociasCount: 8,
        aspirantesCount: 2,
        lastMembersUpdate: '2025-12-01T10:00:00.000Z',
      },
    ],
  };

  // ----------------------------------------------------
  // 1. Criação Válida: Preservação de IDs, legacyId, idMap e lastMembersUpdate
  // ----------------------------------------------------
  console.log('[TEST 1] Criação Válida com preservação de IDs, legacyId, idMap e lastMembersUpdate');
  const planNew = planHierarchyMigration([legacyCp1], centralId, [], [], 'mig-100');

  assertEqual(planNew.totals.createConselhosCount, 1, 'Deve contabilizar 1 CP para CREATE');
  assertEqual(planNew.totals.createConferenciasCount, 1, 'Deve contabilizar 1 Conferência para CREATE');
  assertEqual(planNew.conselhosDetails[0].id, 'cp-101', 'targetId do CP deve ser cp-101');
  assertEqual(planNew.conselhosDetails[0].legacyId, 'cp-101', 'legacyId do CP deve ser cp-101');
  assertEqual(planNew.conferenciasDetails[0].id, 'conf-201', 'targetId da Conf deve ser conf-201');
  assertEqual(planNew.conferenciasDetails[0].legacyId, 'conf-201', 'legacyId da Conf deve ser conf-201');

  // Checagem de idMap
  assertEqual(planNew.idMap.length, 2, 'idMap deve conter 2 mapeamentos');
  assertEqual(planNew.idMap[0].legacyId, 'cp-101', 'idMap[0] legacyId correto');
  assertEqual(planNew.idMap[0].targetId, 'cp-101', 'idMap[0] targetId correto');
  assertEqual(planNew.idMap[0].status, 'CREATE', 'idMap[0] status CREATE');
  assertEqual(planNew.idMap[1].legacyId, 'conf-201', 'idMap[1] legacyId correto');
  assertEqual(planNew.idMap[1].targetId, 'conf-201', 'idMap[1] targetId correto');
  assertEqual(planNew.idMap[1].status, 'CREATE', 'idMap[1] status CREATE');

  // Checagem do candidateDoc
  const candidateCp = planNew.conselhosDetails[0].candidateDoc;
  const candidateConf = planNew.conferenciasDetails[0].candidateDoc;
  assertEqual(candidateCp?.id, 'cp-101', 'candidateDoc CP ID preservado');
  assertEqual(candidateCp?.centralId, centralId, 'candidateDoc CP centralId vinculado');
  assertEqual(candidateConf?.id, 'conf-201', 'candidateDoc Conf ID preservado');
  assertEqual(candidateConf?.particularId, 'cp-101', 'candidateDoc Conf particularId vinculado');
  assertEqual(candidateConf?.centralId, centralId, 'candidateDoc Conf centralId vinculado');
  assertEqual(candidateConf?.legacyCounts?.confrades, 10, 'legacyCounts confrades mapeado');
  assertEqual((candidateConf as any)?.lastMembersUpdate, '2025-12-01T10:00:00.000Z', 'lastMembersUpdate preservado');

  // ----------------------------------------------------
  // 2. Idempotência: Execução Repetida Gera ALREADY_MATCHING sem Novas Criações
  // ----------------------------------------------------
  console.log('\n[TEST 2] Idempotência com ALREADY_MATCHING');
  const existingCp: StandaloneConselhoParticular = {
    id: 'cp-101',
    centralId: centralId,
    name: 'Conselho Particular São José',
    normalizedName: 'CONSELHO PARTICULAR SAO JOSE',
    city: 'Belo Horizonte',
    phone: '(31) 99999-1111',
    email: 'cp.saojose@ssvp.org.br',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'João Silva', phone: '(31) 98888-2222' },
    vicePresidente: { name: 'Maria Souza', phone: '(31) 97777-3333' },
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  const existingConf: StandaloneConferencia = {
    id: 'conf-201',
    particularId: 'cp-101',
    centralId: centralId,
    name: 'Conferência Vicentina Santo Antônio',
    normalizedName: 'CONFERENCIA VICENTINA SANTO ANTONIO',
    presidente: { name: 'Carlos Andrade', phone: '(31) 96666-4444' },
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  const planMatching = planHierarchyMigration(
    [legacyCp1],
    centralId,
    [existingCp],
    [existingConf],
    'mig-101'
  );

  assertEqual(planMatching.totals.createConselhosCount, 0, '0 CPs a criar em execução idempotente');
  assertEqual(planMatching.totals.createConferenciasCount, 0, '0 Conferências a criar em execução idempotente');
  assertEqual(planMatching.totals.alreadyMatchingConselhosCount, 1, '1 CP em ALREADY_MATCHING');
  assertEqual(planMatching.totals.alreadyMatchingConferenciasCount, 1, '1 Conferência em ALREADY_MATCHING');
  assertEqual(planMatching.conselhosDetails[0].candidateDoc, undefined, 'Sem candidateDoc em ALREADY_MATCHING');
  assertEqual(planMatching.conferenciasDetails[0].candidateDoc, undefined, 'Sem candidateDoc em ALREADY_MATCHING');

  // ----------------------------------------------------
  // 3. Detecção de Nomes Vazios (CP e Conferência)
  // ----------------------------------------------------
  console.log('\n[TEST 3] Detecção de Nomes Vazios');
  const legacyCpEmptyName: ConselhoParticular = {
    id: 'cp-empty-name',
    name: '   ',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'Pedro', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [
      {
        id: 'conf-empty-name',
        name: '',
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        presidente: { name: 'Mário', phone: '' },
        confradesCount: 1,
        consociasCount: 1,
        aspirantesCount: 0,
      },
    ],
  };

  const planEmptyNames = planHierarchyMigration([legacyCpEmptyName], centralId, [], [], 'mig-102');
  assertEqual(planEmptyNames.conselhosDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'CP com nome vazio gera CONFLICT');
  assertEqual(planEmptyNames.conselhosDetails[0].candidateDoc, undefined, 'CP com nome vazio NÃO gera candidateDoc');
  assertEqual(planEmptyNames.conferenciasDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'Conf com nome vazio gera CONFLICT');
  assertEqual(planEmptyNames.conferenciasDetails[0].candidateDoc, undefined, 'Conf com nome vazio NÃO gera candidateDoc');

  // ----------------------------------------------------
  // 4. Detecção de Duplicidade de Nomes dentro do Mesmo Escopo
  // ----------------------------------------------------
  console.log('\n[TEST 4] Detecção de Duplicidade de Nomes dentro do Mesmo Escopo');
  const legacyCpDupName1: ConselhoParticular = {
    id: 'cp-dup-1',
    name: 'Conselho Particular Alvorada',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'A', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [
      {
        id: 'conf-dup-1',
        name: 'Conferência Santa Luzia',
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        presidente: { name: 'A', phone: '' },
        confradesCount: 2,
        consociasCount: 2,
        aspirantesCount: 0,
      },
      {
        id: 'conf-dup-2',
        name: 'Conferência Santa Luzia', // Mesmo nome no mesmo CP!
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        presidente: { name: 'B', phone: '' },
        confradesCount: 3,
        consociasCount: 3,
        aspirantesCount: 1,
      },
    ],
  };

  const legacyCpDupName2: ConselhoParticular = {
    id: 'cp-dup-2',
    name: 'Conselho Particular Alvorada', // Mesmo nome na mesma Central!
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'B', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [],
  };

  const planDupNames = planHierarchyMigration([legacyCpDupName1, legacyCpDupName2], centralId, [], [], 'mig-103');
  assertEqual(planDupNames.conselhosDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'CP com nome duplicado gera CONFLICT');
  assertEqual(planDupNames.conselhosDetails[0].candidateDoc, undefined, 'Sem candidateDoc executável para CP duplicado');
  assertEqual(planDupNames.conferenciasDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'Conf com nome duplicado no CP gera CONFLICT');
  assertEqual(planDupNames.conferenciasDetails[0].candidateDoc, undefined, 'Sem candidateDoc executável para Conf duplicada');

  // ----------------------------------------------------
  // 5. Detecção de IDs Legados Vazios ou Inválidos para Firestore
  // ----------------------------------------------------
  console.log('\n[TEST 5] Detecção de IDs Legados Vazios ou Inválidos');
  const legacyCpInvalidId: ConselhoParticular = {
    id: 'cp/invalido/com/barra',
    name: 'CP Barra Invalida',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'A', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [
      {
        id: '', // Vazio
        name: 'Conf ID Vazio',
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        presidente: { name: 'B', phone: '' },
        confradesCount: 1,
        consociasCount: 1,
        aspirantesCount: 0,
      },
    ],
  };

  const planInvalidIds = planHierarchyMigration([legacyCpInvalidId], centralId, [], [], 'mig-104');
  assertEqual(planInvalidIds.conselhosDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'ID com barra gera CONFLICT');
  assertEqual(planInvalidIds.conselhosDetails[0].candidateDoc, undefined, 'ID com barra NÃO gera candidateDoc');
  assertEqual(planInvalidIds.conferenciasDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'Conf com ID vazio gera CONFLICT');
  assertEqual(planInvalidIds.conferenciasDetails[0].candidateDoc, undefined, 'Conf com ID vazio NÃO gera candidateDoc');

  // ----------------------------------------------------
  // 6. Detecção de IDs Legados Repetidos na Entrada
  // ----------------------------------------------------
  console.log('\n[TEST 6] Detecção de IDs Legados Repetidos na Entrada');
  const legacyCpRepeatId1: ConselhoParticular = {
    id: 'cp-repetido-999',
    name: 'CP Repetido 1',
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

  const legacyCpRepeatId2: ConselhoParticular = {
    id: 'cp-repetido-999', // Mesmo ID que o CP 1!
    name: 'CP Repetido 2',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'B', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [],
  };

  const planRepeatIds = planHierarchyMigration([legacyCpRepeatId1, legacyCpRepeatId2], centralId, [], [], 'mig-105');
  assertEqual(planRepeatIds.conselhosDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'ID repetido na entrada gera CONFLICT');
  assertEqual(planRepeatIds.conselhosDetails[1].action, 'CONFLICT_REQUIRES_REVIEW', 'ID repetido na entrada gera CONFLICT');
  assertEqual(planRepeatIds.conselhosDetails[0].candidateDoc, undefined, 'Sem candidateDoc executável');

  // ----------------------------------------------------
  // 7. Detecção de Datas Inválidas
  // ----------------------------------------------------
  console.log('\n[TEST 7] Detecção de Datas Inválidas');
  const legacyCpInvalidDate: ConselhoParticular = {
    id: 'cp-invalid-date',
    name: 'CP Data Invalida',
    startDate: '2020-13-45', // Mês 13, dia 45 inválidos!
    endDate: '2024-01-01',
    presidente: { name: 'A', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [
      {
        id: 'conf-invalid-date',
        name: 'Conf Data Invalida',
        startDate: 'ontem', // Não é ISO!
        endDate: '2024-01-01',
        presidente: { name: 'B', phone: '' },
        confradesCount: 1,
        consociasCount: 1,
        aspirantesCount: 0,
      },
    ],
  };

  const planInvalidDates = planHierarchyMigration([legacyCpInvalidDate], centralId, [], [], 'mig-106');
  assertEqual(planInvalidDates.conselhosDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'Data inválida no CP gera CONFLICT');
  assertEqual(planInvalidDates.conselhosDetails[0].candidateDoc, undefined, 'Sem candidateDoc com data inválida');
  assertEqual(planInvalidDates.conferenciasDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'Data inválida na Conf gera CONFLICT');
  assertEqual(planInvalidDates.conferenciasDetails[0].candidateDoc, undefined, 'Sem candidateDoc com data inválida');

  // ----------------------------------------------------
  // 8. Detecção de Contagens Inválidas (Negativas, Decimais, Não-Numéricas)
  // ----------------------------------------------------
  console.log('\n[TEST 8] Detecção de Contagens de Membros Inválidas');
  const legacyCpInvalidCounts: ConselhoParticular = {
    id: 'cp-valid-for-counts',
    name: 'CP Valido Para Teste Contagens',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'A', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [
      {
        id: 'conf-neg-count',
        name: 'Conf Contagem Negativa',
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        presidente: { name: 'B', phone: '' },
        confradesCount: -5, // Negativo!
        consociasCount: 2,
        aspirantesCount: 0,
      },
      {
        id: 'conf-dec-count',
        name: 'Conf Contagem Decimal',
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        presidente: { name: 'C', phone: '' },
        confradesCount: 5.5, // Decimal!
        consociasCount: 2,
        aspirantesCount: 0,
      },
      {
        id: 'conf-str-count',
        name: 'Conf Contagem String',
        startDate: '2020-01-01',
        endDate: '2024-01-01',
        presidente: { name: 'D', phone: '' },
        confradesCount: 'dez' as any, // Não numérico!
        consociasCount: 2,
        aspirantesCount: 0,
      },
    ],
  };

  const planInvalidCounts = planHierarchyMigration([legacyCpInvalidCounts], centralId, [], [], 'mig-107');
  assertEqual(planInvalidCounts.conferenciasDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'Contagem negativa gera CONFLICT');
  assertEqual(planInvalidCounts.conferenciasDetails[0].candidateDoc, undefined, 'Sem candidateDoc para contagem negativa');
  assertEqual(planInvalidCounts.conferenciasDetails[1].action, 'CONFLICT_REQUIRES_REVIEW', 'Contagem decimal gera CONFLICT');
  assertEqual(planInvalidCounts.conferenciasDetails[1].candidateDoc, undefined, 'Sem candidateDoc para contagem decimal');
  assertEqual(planInvalidCounts.conferenciasDetails[2].action, 'CONFLICT_REQUIRES_REVIEW', 'Contagem string gera CONFLICT');
  assertEqual(planInvalidCounts.conferenciasDetails[2].candidateDoc, undefined, 'Sem candidateDoc para contagem string');

  // ----------------------------------------------------
  // 9. Conselhos sem Conferências Geram Aviso Não-Bloqueante
  // ----------------------------------------------------
  console.log('\n[TEST 9] Conselhos sem Conferências Geram Apenas Aviso');
  const legacyCpNoConf: ConselhoParticular = {
    id: 'cp-no-conf',
    name: 'CP Sem Conferencias',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'Presidente Sem Conf', phone: '(31) 98888-0000' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [], // Vazio!
  };

  const planNoConf = planHierarchyMigration([legacyCpNoConf], centralId, [], [], 'mig-108');
  assertEqual(planNoConf.totals.warningsConselhosCount, 1, 'Deve contabilizar 1 aviso de CP');
  assertEqual(planNoConf.totals.totalWarnings, 1, 'Deve contabilizar 1 aviso no total');
  assertEqual(planNoConf.conselhosDetails[0].action, 'CREATE', 'Ação do CP sem conferência deve ser CREATE');
  assertEqual(planNoConf.conselhosDetails[0].warnings?.length, 1, 'CP deve ter 1 aviso em sua lista');
  assertEqual(planNoConf.conselhosDetails[0].candidateDoc !== undefined, true, 'CP sem conferência GERA candidateDoc');

  // ----------------------------------------------------
  // 10. Conflitos de Pertencimento (Central/Particular cruzados) e Divergência de Dados
  // ----------------------------------------------------
  console.log('\n[TEST 10] Conflitos de Pertencimento e Dados Divergentes');
  const existingCpOtherCentral: StandaloneConselhoParticular = {
    id: 'cp-cross-1',
    centralId: 'central-OUTRO-999',
    name: 'CP Outro Central',
    normalizedName: 'CP OUTRO CENTRAL',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  const existingCpDiffBoard: StandaloneConselhoParticular = {
    id: 'cp-diff-board',
    centralId: centralId,
    name: 'CP Diretoria Divergente',
    normalizedName: 'CP DIRETORIA DIVERGENTE',
    presidente: { name: 'Diretoria Antiga', phone: '' },
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  const legacyCpCross: ConselhoParticular = {
    id: 'cp-cross-1',
    name: 'CP Outro Central',
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

  const legacyCpDiffBoard: ConselhoParticular = {
    id: 'cp-diff-board',
    name: 'CP Diretoria Divergente',
    startDate: '2020-01-01',
    endDate: '2024-01-01',
    presidente: { name: 'Diretoria Nova No Legado', phone: '' },
    vicePresidente: { name: '', phone: '' },
    secretario: { name: '', phone: '' },
    tesoureiro: { name: '', phone: '' },
    ecafo: { name: '', phone: '' },
    coordenadorCCA: { name: '', phone: '' },
    conferencias: [],
  };

  const planCross = planHierarchyMigration(
    [legacyCpCross, legacyCpDiffBoard],
    centralId,
    [existingCpOtherCentral, existingCpDiffBoard],
    [],
    'mig-109'
  );

  assertEqual(planCross.conselhosDetails[0].action, 'CONFLICT_REQUIRES_REVIEW', 'CP pertencente a outro centralId gera CONFLICT');
  assertEqual(planCross.conselhosDetails[1].action, 'CONFLICT_REQUIRES_REVIEW', 'CP com diretoria divergente gera CONFLICT');

  // ----------------------------------------------------
  // 11. Ausência de Mutação dos Objetos Recebidos
  // ----------------------------------------------------
  console.log('\n[TEST 11] Ausência de Mutação dos Objetos Recebidos');
  const legacyInputSnapshot = JSON.stringify(legacyCp1);
  planHierarchyMigration([legacyCp1], centralId, [existingCp], [existingConf], 'mig-110');
  assertEqual(JSON.stringify(legacyCp1), legacyInputSnapshot, 'Entrada legada não sofreu mutação');

  // ----------------------------------------------------
  // 12. Higienização de Relatório para Logs de Auditoria (LGPD)
  // ----------------------------------------------------
  console.log('\n[TEST 12] Higienização de Relatório para Logs de Auditoria');
  const rawPlan = planHierarchyMigration([legacyCp1], centralId, [], [], 'mig-111');
  const sanitizedPlan = sanitizeHierarchyPlanForLogs(rawPlan);

  const candidateDocSanitized = sanitizedPlan.conselhosDetails[0].candidateDoc;
  assertEqual(candidateDocSanitized?.email?.includes('cp.saojose@ssvp.org.br'), false, 'E-mail não pode estar exposto');
  assertEqual(candidateDocSanitized?.phone?.includes('99999-1111'), false, 'Telefone não pode estar exposto');
  assertEqual(candidateDocSanitized?.presidente?.name, undefined, 'Nome do presidente não pode estar exposto');

  // ----------------------------------------------------
  // 13. Testes Unitários das Funções de Validação Puras
  // ----------------------------------------------------
  console.log('\n[TEST 13] Funções de Validação Puras');
  assertEqual(isValidDocumentId('cp-123'), true, 'cp-123 é doc ID válido');
  assertEqual(isValidDocumentId(''), false, 'string vazia é doc ID inválido');
  assertEqual(isValidDocumentId('cp/123'), false, 'barra no doc ID é inválido');
  assertEqual(isValidDocumentId('..'), false, '.. é doc ID inválido');
  assertEqual(isValidDocumentId('__prefix__'), false, '__prefix__ é doc ID inválido');

  assertEqual(isValidDateString('2026-01-15'), true, '2026-01-15 é data válida');
  assertEqual(isValidDateString(undefined), true, 'undefined é data opcional válida');
  assertEqual(isValidDateString('2026-02-31'), false, '2026-02-31 é data inválida');
  assertEqual(isValidDateString('invalid-date'), false, 'invalid-date é data inválida');

  assertEqual(isValidMemberCount(10), true, '10 é contagem válida');
  assertEqual(isValidMemberCount(0), true, '0 é contagem válida');
  assertEqual(isValidMemberCount(-1), false, '-1 é contagem inválida');
  assertEqual(isValidMemberCount(2.5), false, '2.5 é contagem inválida');
  assertEqual(isValidMemberCount('5'), false, 'string é contagem inválida');
  assertEqual(isValidMemberCount(NaN), false, 'NaN é contagem inválida');

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
