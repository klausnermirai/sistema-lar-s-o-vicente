import {
  buildSecureAuthorizationContext,
  UserProfileWithAuthUid,
} from '../lib/secure_authorization_context.js';
import { TokenValidationResult } from '../lib/auth_token_validator.js';
import { InstitutionDocMock } from '../lib/institution_authorization.js';

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
console.log(' Executando Testes do Contexto Seguro de Autorização');
console.log('===================================================\n');

async function runTests() {
  const validTokenResult: TokenValidationResult = {
    valid: true,
    identity: {
      uid: 'firebase-uid-999',
      email: 'psicologa@ssvp.org',
      emailVerified: true,
    },
  };

  const validUserProfile: UserProfileWithAuthUid = {
    id: 'user-internal-001',
    authUid: 'firebase-uid-999',
    email: 'psicologa@ssvp.org',
    status: 'ativo',
    accessLevel: 'cuidados',
    institutionId: 'inst-001',
    institutionIds: ['inst-001', 'inst-002'],
  };

  const validInstitutionDoc: InstitutionDocMock = {
    id: 'inst-001',
    name: 'Lar São Vicente - Unidade 1',
    status: 'ativo',
    entityType: 'obra_unida',
  };

  // ----------------------------------------------------
  // 1. Teste de Sucesso
  // ----------------------------------------------------
  console.log('[TEST 1] Sucesso de Autorização');
  const resSuccess = buildSecureAuthorizationContext(
    validTokenResult,
    validUserProfile,
    'inst-001',
    validInstitutionDoc
  );
  assertEqual(
    resSuccess,
    {
      authorized: true,
      code: 'AUTHORIZED',
      reason: 'Contexto de autorização validado e autorizado com sucesso.',
      uid: 'firebase-uid-999',
      userId: 'user-internal-001',
      institutionId: 'inst-001',
      validatedCentralId: 'inst-001',
    },
    'Deve autorizar quando token é válido, authUid coincide e instituição é permitida'
  );

  // ----------------------------------------------------
  // 2. Teste: Token Inválido ou Nulo
  // ----------------------------------------------------
  console.log('\n[TEST 2] Token Inválido / Nulo');
  const invalidTokenResult: TokenValidationResult = {
    valid: false,
    error: 'Token de autenticação expirado ou corrompido.',
    code: 'EXPIRED_TOKEN',
  };
  const resInvalidToken = buildSecureAuthorizationContext(
    invalidTokenResult,
    validUserProfile,
    'inst-001',
    validInstitutionDoc
  );
  assertEqual(
    resInvalidToken,
    {
      authorized: false,
      code: 'INVALID_TOKEN',
      reason: 'Token de autenticação expirado ou corrompido.',
    },
    'Deve rejeitar quando o token estiver inválido'
  );

  const resNullToken = buildSecureAuthorizationContext(
    null,
    validUserProfile,
    'inst-001',
    validInstitutionDoc
  );
  assertEqual(
    resNullToken,
    {
      authorized: false,
      code: 'INVALID_TOKEN',
      reason: 'Token de autenticação inválido ou ausente.',
    },
    'Deve rejeitar quando o token for nulo'
  );

  // ----------------------------------------------------
  // 3. Teste: authUid Ausente no Perfil do Usuário
  // ----------------------------------------------------
  console.log('\n[TEST 3] authUid Ausente no Perfil do Usuário');
  const userWithoutAuthUid: UserProfileWithAuthUid = {
    id: 'user-internal-001',
    authUid: null, // Sem authUid vinculado
    email: 'psicologa@ssvp.org',
    status: 'ativo',
    institutionId: 'inst-001',
    institutionIds: ['inst-001'],
  };
  const resMissingAuthUid = buildSecureAuthorizationContext(
    validTokenResult,
    userWithoutAuthUid,
    'inst-001',
    validInstitutionDoc
  );
  assertEqual(
    resMissingAuthUid,
    {
      authorized: false,
      code: 'MISSING_USER_AUTHUID',
      reason: 'O perfil do usuário não possui o campo authUid vinculado. Acesso negado.',
      uid: 'firebase-uid-999',
      userId: 'user-internal-001',
    },
    'Deve rejeitar quando o perfil do usuário não possui authUid'
  );

  // ----------------------------------------------------
  // 4. Teste: authUid Divergente (Tentativa de usar userId ou e-mail como substituto)
  // ----------------------------------------------------
  console.log('\n[TEST 4] authUid Divergente (Substituto Rejeitado)');
  const userDivergentAuthUid: UserProfileWithAuthUid = {
    id: 'user-internal-001',
    authUid: 'outro-firebase-uid-888', // Diverge do token (firebase-uid-999)
    email: 'psicologa@ssvp.org',
    status: 'ativo',
    institutionId: 'inst-001',
    institutionIds: ['inst-001'],
  };
  const resDivergentAuthUid = buildSecureAuthorizationContext(
    validTokenResult,
    userDivergentAuthUid,
    'inst-001',
    validInstitutionDoc
  );
  assertEqual(
    resDivergentAuthUid,
    {
      authorized: false,
      code: 'AUTHUID_MISMATCH',
      reason: 'O authUid do perfil do usuário diverge do UID validado no ID Token.',
      uid: 'firebase-uid-999',
      userId: 'user-internal-001',
    },
    'Deve rejeitar quando authUid do perfil for diferente do UID do token'
  );

  // Tentativa de passar userId como se fosse authUid
  const userUserIdAsAuthUid: UserProfileWithAuthUid = {
    id: 'user-internal-001',
    authUid: 'user-internal-001', // Tentou usar userId interno como authUid
    email: 'psicologa@ssvp.org',
    status: 'ativo',
    institutionId: 'inst-001',
    institutionIds: ['inst-001'],
  };
  const resUserIdAsAuthUid = buildSecureAuthorizationContext(
    validTokenResult,
    userUserIdAsAuthUid,
    'inst-001',
    validInstitutionDoc
  );
  assertEqual(
    resUserIdAsAuthUid,
    {
      authorized: false,
      code: 'AUTHUID_MISMATCH',
      reason: 'O authUid do perfil do usuário diverge do UID validado no ID Token.',
      uid: 'firebase-uid-999',
      userId: 'user-internal-001',
    },
    'Não deve aceitar userId interno como substituto do authUid'
  );

  // ----------------------------------------------------
  // 5. Teste: Instituição Não Autorizada (Escopo Falhou)
  // ----------------------------------------------------
  console.log('\n[TEST 5] Instituição Não Autorizada');
  const externalInstitutionDoc: InstitutionDocMock = {
    id: 'inst-999', // Instituição fora da lista do usuário ['inst-001', 'inst-002']
    name: 'Unidade Externa Fora do Escopo',
    status: 'ativo',
    entityType: 'obra_unida',
  };
  const resUnauthorizedScope = buildSecureAuthorizationContext(
    validTokenResult,
    validUserProfile,
    'inst-999',
    externalInstitutionDoc
  );
  assertEqual(
    resUnauthorizedScope,
    {
      authorized: false,
      code: 'SCOPE_AUTHORIZATION_FAILED',
      reason: 'Acesso negado: A instituição solicitada não pertence à lista de instituições permitidas para este usuário.',
      uid: 'firebase-uid-999',
      userId: 'user-internal-001',
      institutionId: 'inst-999',
    },
    'Deve retornar SCOPE_AUTHORIZATION_FAILED quando a instituição não for autorizada'
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
