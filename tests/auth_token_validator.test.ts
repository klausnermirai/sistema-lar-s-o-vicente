import {
  validateFirebaseIdToken,
  validateSensitiveFirebaseIdToken,
} from '../lib/auth_token_validator.js';

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
console.log(' Executando Testes Unitários de Validação de Tokens');
console.log('===================================================\n');

async function runTests() {
  // ----------------------------------------------------
  // Mock do AuthInstance do Firebase Admin
  // ----------------------------------------------------
  const mockAuthInstance = {
    async verifyIdToken(idToken: string, checkRevoked?: boolean) {
      if (idToken === 'valid-token') {
        return {
          uid: 'user-uid-123',
          email: 'usuario@exemplo.com',
          email_verified: true,
        };
      }

      if (idToken === 'expired-token') {
        const error: any = new Error('The Firebase ID token is expired.');
        error.code = 'auth/id-token-expired';
        throw error;
      }

      if (idToken === 'forged-token' || idToken === 'invalid-token') {
        const error: any = new Error('Decoding Firebase ID token failed.');
        error.code = 'auth/argument-error';
        throw error;
      }

      if (idToken === 'revoked-token') {
        if (checkRevoked) {
          const error: any = new Error('The Firebase ID token has been revoked.');
          error.code = 'auth/id-token-revoked';
          throw error;
        } else {
          // Na verificação comum sem checkRevoked, aceitaria se a assinatura e tempo fossem válidos
          return {
            uid: 'user-uid-revoked',
            email: 'revogado@exemplo.com',
            email_verified: false,
          };
        }
      }

      const error: any = new Error('Token desconhecido.');
      error.code = 'auth/invalid-id-token';
      throw error;
    },
  };

  // ----------------------------------------------------
  // 1. Teste: Token Válido (Comum e Sensível)
  // ----------------------------------------------------
  console.log('[TEST 1] Token Válido');
  const resValidCommon = await validateFirebaseIdToken('Bearer valid-token', mockAuthInstance);
  assertEqual(
    resValidCommon,
    {
      valid: true,
      identity: {
        uid: 'user-uid-123',
        email: 'usuario@exemplo.com',
        emailVerified: true,
      },
    },
    'validateFirebaseIdToken deve retornar identidade correta para token válido'
  );

  const resValidSensitive = await validateSensitiveFirebaseIdToken('Bearer valid-token', mockAuthInstance);
  assertEqual(
    resValidSensitive,
    {
      valid: true,
      identity: {
        uid: 'user-uid-123',
        email: 'usuario@exemplo.com',
        emailVerified: true,
      },
    },
    'validateSensitiveFirebaseIdToken deve retornar identidade correta para token válido'
  );

  // ----------------------------------------------------
  // 2. Teste: Token Ausente / Vazio
  // ----------------------------------------------------
  console.log('\n[TEST 2] Token Ausente ou Vazio');
  const resNull = await validateFirebaseIdToken(null, mockAuthInstance);
  assertEqual(
    resNull,
    {
      valid: false,
      error: 'Token de autenticação não fornecido ou inválido.',
      code: 'MISSING_TOKEN',
    },
    'Deve rejeitar token null com código MISSING_TOKEN'
  );

  const resEmptyBearer = await validateFirebaseIdToken('Bearer ', mockAuthInstance);
  assertEqual(
    resEmptyBearer,
    {
      valid: false,
      error: 'Token de autenticação no formato Bearer está vazio.',
      code: 'MISSING_TOKEN',
    },
    'Deve rejeitar Bearer vazio com código MISSING_TOKEN'
  );

  // ----------------------------------------------------
  // 3. Teste: Token Falsificado / Assinatura Inválida
  // ----------------------------------------------------
  console.log('\n[TEST 3] Token Falsificado / Corrompido');
  const resForged = await validateFirebaseIdToken('Bearer forged-token', mockAuthInstance);
  assertEqual(
    resForged,
    {
      valid: false,
      error: 'Token de autenticação inválido ou corrompido.',
      code: 'INVALID_TOKEN',
    },
    'Deve rejeitar token falsificado com código INVALID_TOKEN'
  );

  // ----------------------------------------------------
  // 4. Teste: Token Expirado
  // ----------------------------------------------------
  console.log('\n[TEST 4] Token Expirado');
  const resExpired = await validateFirebaseIdToken('Bearer expired-token', mockAuthInstance);
  assertEqual(
    resExpired,
    {
      valid: false,
      error: 'Sessão expirada. Por favor, faça login novamente.',
      code: 'EXPIRED_TOKEN',
    },
    'Deve rejeitar token expirado com código EXPIRED_TOKEN'
  );

  // ----------------------------------------------------
  // 5. Teste: Token Revogado em Validação Sensível
  // ----------------------------------------------------
  console.log('\n[TEST 5] Token Revogado em Validação Sensível');
  const resRevokedSensitive = await validateSensitiveFirebaseIdToken('Bearer revoked-token', mockAuthInstance);
  assertEqual(
    resRevokedSensitive,
    {
      valid: false,
      error: 'Sessão revogada ou conta desativada. Por favor, faça login novamente.',
      code: 'REVOKED_TOKEN',
    },
    'validateSensitiveFirebaseIdToken deve detectar revogação e retornar REVOKED_TOKEN'
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
