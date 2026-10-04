import {
  authorizeInstitutionScope,
  UserProfileScopeMock,
  InstitutionDocMock,
} from '../lib/institution_authorization.js';

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
console.log(' Executando Testes de Autorização de Escopo Institucional');
console.log('===================================================\n');

async function runTests() {
  const activeUser: UserProfileScopeMock = {
    id: 'user-123',
    email: 'psicologa@ssvp.org',
    status: 'ativo',
    accessLevel: 'cuidados',
    institutionId: 'inst-001',
    institutionIds: ['inst-001', 'inst-002'],
  };

  const inst1: InstitutionDocMock = {
    id: 'inst-001',
    cnpj: '54.927.132/0001-92',
    name: 'Lar São Vicente - Unidade 1',
    status: 'ativo',
    entityType: 'obra_unida',
  };

  const inst2Central: InstitutionDocMock = {
    id: 'inst-002',
    cnpj: '52.853.397/0001-68',
    name: 'Conselho Central de São José',
    status: 'ativo',
    entityType: 'conselho_central',
  };

  const inst3External: InstitutionDocMock = {
    id: 'inst-003',
    cnpj: '11.222.333/0001-44',
    name: 'Lar de Outra Cidade',
    status: 'ativo',
    entityType: 'obra_unida',
  };

  const instInactive: InstitutionDocMock = {
    id: 'inst-004',
    cnpj: '99.888.777/0001-66',
    name: 'Unidade Inativa',
    status: 'inativo',
    entityType: 'obra_unida',
  };

  // 1. Usuário comum autorizado na lista de institutionIds
  console.log('[TEST 1] Usuário comum autorizado');
  const resCommonAuthorized = authorizeInstitutionScope(activeUser, 'inst-001', inst1);
  assertEqual(
    resCommonAuthorized,
    {
      allowed: true,
      code: 'AUTHORIZED',
      reason: 'Acesso à instituição autorizado com sucesso.',
      validatedCentralId: 'inst-001',
    },
    'Deve autorizar acesso a instituição pertencente à lista institutionIds'
  );

  // 2. Acesso cruzado entre instituições (Tentativa de acessar instituição fora da lista)
  console.log('\n[TEST 2] Tentativa de acesso cruzado (Fora da lista)');
  const resCrossAccess = authorizeInstitutionScope(activeUser, 'inst-003', inst3External);
  assertEqual(
    resCrossAccess,
    {
      allowed: false,
      code: 'ACCESS_DENIED_NOT_IN_PERMITTED_LIST',
      reason: 'Acesso negado: A instituição solicitada não pertence à lista de instituições permitidas para este usuário.',
    },
    'Deve negar acesso a instituição que não está em institutionIds do usuário'
  );

  // 3. Administrador Institucional tentando burlar o escopo (não é globalAdmin)
  console.log('\n[TEST 3] Administrador Institucional tentando burlar escopo');
  const instAdminUser: UserProfileScopeMock = {
    id: 'user-admin-inst',
    email: 'admin.local@ssvp.org',
    status: 'ativo',
    accessLevel: 'administrador',
    isGlobalAdmin: false,
    institutionId: 'inst-001',
    institutionIds: ['inst-001'],
  };
  const resInstAdminBypass = authorizeInstitutionScope(instAdminUser, 'inst-003', inst3External);
  assertEqual(
    resInstAdminBypass,
    {
      allowed: false,
      code: 'ACCESS_DENIED_NOT_IN_PERMITTED_LIST',
      reason: 'Acesso negado: A instituição solicitada não pertence à lista de instituições permitidas para este usuário.',
    },
    'Administrador institucional SEM isGlobalAdmin NÃO pode acessar instituições fora da sua lista'
  );

  // 4. Administrador Global (isGlobalAdmin === true)
  console.log('\n[TEST 4] Administrador Global');
  const globalAdminUser: UserProfileScopeMock = {
    id: 'user-global-admin',
    email: 'ti.global@ssvp.org',
    status: 'ativo',
    accessLevel: 'administrador',
    isGlobalAdmin: true,
    institutionId: 'inst-001',
    institutionIds: ['inst-001'],
  };
  const resGlobalAdmin = authorizeInstitutionScope(globalAdminUser, 'inst-003', inst3External);
  assertEqual(
    resGlobalAdmin,
    {
      allowed: true,
      code: 'AUTHORIZED',
      reason: 'Acesso à instituição autorizado com sucesso.',
      validatedCentralId: 'inst-003',
    },
    'Administrador global (isGlobalAdmin: true) pode acessar qualquer instituição ativa existente'
  );

  // 5. Usuário Inativo
  console.log('\n[TEST 5] Usuário Inativo');
  const inactiveUser: UserProfileScopeMock = {
    id: 'user-inactive',
    email: 'inativo@ssvp.org',
    status: 'inativo',
    institutionIds: ['inst-001'],
  };
  const resInactiveUser = authorizeInstitutionScope(inactiveUser, 'inst-001', inst1);
  assertEqual(
    resInactiveUser,
    {
      allowed: false,
      code: 'USER_INACTIVE',
      reason: 'O usuário encontra-se inativo no sistema.',
    },
    'Deve rejeitar usuário inativo'
  );

  // 6. Instituição Inativa
  console.log('\n[TEST 6] Instituição Inativa');
  const resInactiveInst = authorizeInstitutionScope(globalAdminUser, 'inst-004', instInactive);
  assertEqual(
    resInactiveInst,
    {
      allowed: false,
      code: 'INSTITUTION_INACTIVE',
      reason: 'A instituição solicitada encontra-se inativa.',
    },
    'Deve rejeitar mesmo admin global se a instituição estiver inativa'
  );

  // 7. ID de Instituição Ausente
  console.log('\n[TEST 7] ID de Instituição Ausente');
  const resMissingId = authorizeInstitutionScope(activeUser, '', inst1);
  assertEqual(
    resMissingId,
    {
      allowed: false,
      code: 'MISSING_INSTITUTION_ID',
      reason: 'O identificador da instituição solicitada (x-institution-id) é obrigatório.',
    },
    'Deve rejeitar ID de instituição vazio ou nulo'
  );

  // 8. Comparação direta entre requestedInstitutionId e institutionData.id
  console.log('\n[TEST 8] Comparação direta de ID (CNPJ vs. ID interno)');
  const resCnpjMismatch = authorizeInstitutionScope(activeUser, '54.927.132/0001-92', inst1);
  assertEqual(
    resCnpjMismatch,
    {
      allowed: false,
      code: 'INSTITUTION_ID_MISMATCH',
      reason: 'A instituição solicitada não foi localizada ou não corresponde ao documento fornecido.',
    },
    'Se requestedInstitutionId for o CNPJ cadastral mas diferente de institutionData.id, deve retornar INSTITUTION_ID_MISMATCH'
  );

  const inst14Digits: InstitutionDocMock = {
    id: '54927132000192',
    cnpj: '54.927.132/0001-92',
    name: 'Unidade com ID de 14 dígitos',
    status: 'ativo',
    entityType: 'obra_unida',
  };

  const userWith14DigitInst: UserProfileScopeMock = {
    id: 'user-14dig',
    status: 'ativo',
    institutionId: '54927132000192',
    institutionIds: ['54927132000192'],
  };

  const res14DigitsMatch = authorizeInstitutionScope(userWith14DigitInst, '54927132000192', inst14Digits);
  assertEqual(
    res14DigitsMatch,
    {
      allowed: true,
      code: 'AUTHORIZED',
      reason: 'Acesso à instituição autorizado com sucesso.',
      validatedCentralId: '54927132000192',
    },
    'Se institutionData.id tiver 14 dígitos e for igual ao requestedInstitutionId, deve permitir normalmente'
  );

  // 9. Instituição que não é Conselho Central (quando requireCentralCouncil === true)
  console.log('\n[TEST 9] Exigência de Conselho Central');
  const resNotCentral = authorizeInstitutionScope(activeUser, 'inst-001', inst1, { requireCentralCouncil: true });
  assertEqual(
    resNotCentral,
    {
      allowed: false,
      code: 'NOT_CENTRAL_COUNCIL',
      reason: 'A instituição solicitada não é um Conselho Central válido.',
    },
    'Deve rejeitar obra_unida quando requireCentralCouncil for verdadeiro'
  );

  const resIsCentral = authorizeInstitutionScope(activeUser, 'inst-002', inst2Central, { requireCentralCouncil: true });
  assertEqual(
    resIsCentral,
    {
      allowed: true,
      code: 'AUTHORIZED',
      reason: 'Acesso à instituição autorizado com sucesso.',
      validatedCentralId: 'inst-002',
    },
    'Deve aceitar conselho_central quando requireCentralCouncil for verdadeiro'
  );

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
