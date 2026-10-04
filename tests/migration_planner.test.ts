import {
  planUserMigration,
  sanitizePlanForMigrationLogs,
  InternalUserMock,
  ExistingFirebaseAuthAccountMock,
} from '../lib/migration_planner.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failedTests++;
  }
}

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
console.log(' Executando Testes do Planejador Puro de Migração');
console.log('===================================================\n');

async function runTests() {
  const mockInternalUsers: InternalUserMock[] = [
    // 1. Criar nova conta
    { id: 'user-1', email: 'novo@ssvp.org', status: 'ativo', fullName: 'Novo Usuário' },
    // 2. Coincidência de e-mail existente (Requer revisão manual)
    { id: 'user-2', email: ' EXISTENTE@SSVP.ORG ', status: 'ativo', fullName: 'Usuário Existente Auth' },
    // 3. Já vinculado e e-mail idêntico
    { id: 'user-3', email: 'vinculado@ssvp.org', status: 'ativo', authUid: 'uid-vinculado-3', fullName: 'Usuário Vinculado' },
    // 4. Inativo
    { id: 'user-4', email: 'inativo@ssvp.org', status: 'inativo', fullName: 'Usuário Inativo' },
    // 5. E-mail inválido
    { id: 'user-5', email: 'email-invalido-sem-arroba', status: 'ativo', fullName: 'E-mail Invalido' },
    // 6 e 7. E-mail duplicado
    { id: 'user-6', email: 'duplicado@ssvp.org', status: 'ativo', fullName: 'Duplicado A' },
    { id: 'user-7', email: 'duplicado@ssvp.org', status: 'ativo', fullName: 'Duplicado B' },
    // 8. Conflito de UID / E-mail
    { id: 'user-8', email: 'conflito@ssvp.org', status: 'ativo', authUid: 'uid-antigo-divergente', fullName: 'Usuário Conflito' },
    // 9. authUid não encontrado no Auth
    { id: 'user-9', email: 'naoencontrado@ssvp.org', status: 'ativo', authUid: 'uid-inexistente-123', fullName: 'Usuário Nao Encontrado' },
    // 10 e 11. authUid duplicado no cadastro interno
    { id: 'user-10', email: 'dup10@ssvp.org', status: 'ativo', authUid: 'uid-compartilhado-456', fullName: 'Dup UID A' },
    { id: 'user-11', email: 'dup11@ssvp.org', status: 'ativo', authUid: 'uid-compartilhado-456', fullName: 'Dup UID B' },
  ];

  const mockExistingAuthAccounts: ExistingFirebaseAuthAccountMock[] = [
    { uid: 'uid-existente-2', email: 'existente@ssvp.org' },
    { uid: 'uid-vinculado-3', email: 'vinculado@ssvp.org' },
    { uid: 'uid-antigo-divergente', email: 'outroemail@ssvp.org' },
    { uid: 'uid-novo-auth-8', email: 'conflito@ssvp.org' },
    { uid: 'uid-compartilhado-456', email: 'outro@ssvp.org' },
  ];

  const plan = planUserMigration(mockInternalUsers, mockExistingAuthAccounts, 'mig-test-12345');

  // Teste 1: Estrutura do relatório e meta-informações
  console.log('[TEST 1] Meta-informações do relatório');
  assertEqual(plan.migrationId, 'mig-test-12345', 'migrationId deve ser preservado');
  assertEqual(plan.isDryRun, true, 'isDryRun deve ser true por padrão');

  // Teste 2: Totais
  console.log('\n[TEST 2] Verificação de Totais');
  assertEqual(plan.totals.totalUsersProcessed, 11, 'Total de usuários processados deve ser 11');
  assertEqual(plan.totals.createAccountCount, 1, 'createAccountCount deve ser 1 (user-1)');
  assertEqual(plan.totals.reviewExistingLinkCount, 1, 'reviewExistingLinkCount deve ser 1 (user-2)');
  assertEqual(plan.totals.alreadyLinkedCount, 1, 'alreadyLinkedCount deve ser 1 (user-3)');
  assertEqual(plan.totals.ignoredInactiveCount, 1, 'ignoredInactiveCount deve ser 1 (user-4)');
  assertEqual(plan.totals.rejectedInvalidEmailCount, 1, 'rejectedInvalidEmailCount deve ser 1 (user-5)');
  assertEqual(plan.totals.blockedDuplicateEmailCount, 2, 'blockedDuplicateEmailCount deve ser 2 (user-6 e user-7)');
  assertEqual(plan.totals.conflictCount, 2, 'conflictCount deve ser 2 (user-8 e user-9)');
  assertEqual(plan.totals.blockedDuplicateAuthUidCount, 2, 'blockedDuplicateAuthUidCount deve ser 2 (user-10 e user-11)');

  // Teste 3: Detalhes por Ação e Revisão Manual
  console.log('\n[TEST 3] Detalhes individuais por ação e revisão manual');
  
  const user1 = plan.details.find((d) => d.userId === 'user-1');
  assertEqual(user1?.action, 'CREATE_AUTH_ACCOUNT', 'user-1 deve ser CREATE_AUTH_ACCOUNT');

  const user2 = plan.details.find((d) => d.userId === 'user-2');
  assertEqual(user2?.action, 'REVIEW_EXISTING_AUTH_LINK', 'user-2 com e-mail em CAIXA ALTA com espaços deve ser REVIEW_EXISTING_AUTH_LINK');
  assertEqual(user2?.requiresManualReview, true, 'user-2 deve exigir revisão manual (requiresManualReview: true)');
  assertEqual(user2?.targetAuthUid, 'uid-existente-2', 'user-2 deve ter targetAuthUid preenchido');

  const user3 = plan.details.find((d) => d.userId === 'user-3');
  assertEqual(user3?.action, 'ALREADY_LINKED', 'user-3 deve ser ALREADY_LINKED');

  const user8 = plan.details.find((d) => d.userId === 'user-8');
  assertEqual(user8?.action, 'CONFLICT_AUTHUID_EMAIL', 'user-8 deve ser CONFLICT_AUTHUID_EMAIL');

  const user9 = plan.details.find((d) => d.userId === 'user-9');
  assertEqual(user9?.action, 'CONFLICT_AUTHUID_NOT_FOUND', 'user-9 deve ser CONFLICT_AUTHUID_NOT_FOUND ao não encontrar authUid');

  const user10 = plan.details.find((d) => d.userId === 'user-10');
  assertEqual(user10?.action, 'BLOCK_DUPLICATE_AUTHUID', 'user-10 deve ser BLOCK_DUPLICATE_AUTHUID');

  const user11 = plan.details.find((d) => d.userId === 'user-11');
  assertEqual(user11?.action, 'BLOCK_DUPLICATE_AUTHUID', 'user-11 deve ser BLOCK_DUPLICATE_AUTHUID');

  // Teste 4: Higienização para migrationLogs (Mascaramento de E-mail)
  console.log('\n[TEST 4] Higienização para migrationLogs');
  const sanitizedPlan = sanitizePlanForMigrationLogs(plan);
  const user1Sanitized = sanitizedPlan.details.find((d) => d.userId === 'user-1');
  assertEqual(user1Sanitized?.email, 'n***o@ssvp.org', 'E-mail em migrationLogs deve ser mascarado');

  // Teste 5: Ausência de dados sensíveis
  console.log('\n[TEST 5] Ausência de dados sensíveis');
  const serialized = JSON.stringify(sanitizedPlan);
  assert(!serialized.includes('password') && !serialized.includes('senha') && !serialized.includes('hash'), 'Nenhum campo de senha ou hash deve constar no relatório');

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

