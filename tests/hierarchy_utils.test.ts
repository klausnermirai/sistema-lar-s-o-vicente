import {
  normalizeName,
  validateHierarchyIdShape,
  maskSensitiveValue,
  sanitizeAuditChanges,
} from '../lib/hierarchy_utils.js';

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
console.log(' Executando Testes de Validação Técnica de Hieraquia');
console.log('===================================================\n');

// ----------------------------------------------------
// 1. Testes para normalizeName
// ----------------------------------------------------
console.log('[TEST GROUP 1] Normalização de Nomes (normalizeName)');

assertEqual(
  normalizeName('São José'),
  'SAO JOSE',
  '“São José” deve resultar em “SAO JOSE”'
);

assertEqual(
  normalizeName('São-José'),
  'SAO JOSE',
  '“São-José” deve resultar em “SAO JOSE”'
);

assertEqual(
  normalizeName('São. José'),
  'SAO JOSE',
  '“São. José” deve resultar em “SAO JOSE”'
);

assertEqual(
  normalizeName('Conferência São Vicente de Paulo'),
  'CONFERENCIA SAO VICENTE DE PAULO',
  'Deve remover acentos e converter para CAIXA ALTA'
);

assertEqual(
  normalizeName('N. Sra. das Graças / CP (Jaboticabal) - D\'Ávila!'),
  'N SRA DAS GRACAS CP JABOTICABAL D AVILA',
  'Deve substituir toda pontuação e símbolos (ponto, barra, hífen, parênteses, apóstrofo) por espaço e compactar'
);

assertEqual(
  normalizeName('  Conselho   Particular   Norte   '),
  'CONSELHO PARTICULAR NORTE',
  'Deve colapsar múltiplos espaços consecutivos e remover espaços nas pontas'
);

assertEqual(
  normalizeName('conferência   são   judas  tadeu'),
  'CONFERENCIA SAO JUDAS TADEU',
  'Deve tratar minúsculas com múltiplos espaços e acentuação'
);

assertEqual(
  normalizeName(''),
  '',
  'Deve retornar string vazia para entrada vazia'
);

assertEqual(
  normalizeName(null as any),
  '',
  'Deve retornar string vazia para entrada null'
);

assertEqual(
  normalizeName(undefined as any),
  '',
  'Deve retornar string vazia para entrada undefined'
);


// ----------------------------------------------------
// 2. Testes para validateHierarchyIdShape
// ----------------------------------------------------
console.log('\n[TEST GROUP 2] Validação Sintática de IDs (validateHierarchyIdShape)');

assertEqual(
  validateHierarchyIdShape({ centralId: 'central-123' }),
  { valid: true },
  'Deve ser válido apenas com centralId'
);

assertEqual(
  validateHierarchyIdShape({ centralId: 'central-123', particularId: 'cp-456' }),
  { valid: true },
  'Deve ser válido com centralId e particularId'
);

assertEqual(
  validateHierarchyIdShape({ centralId: 'central-123', particularId: 'cp-456', conferenciaId: 'conf-789' }),
  { valid: true },
  'Deve ser válido com a cadeia completa centralId + particularId + conferenciaId'
);

assertEqual(
  validateHierarchyIdShape({ particularId: 'cp-456' }),
  { valid: false, error: 'particularId requer que centralId também seja informado.' },
  'Deve rejeitar particularId sem centralId'
);

assertEqual(
  validateHierarchyIdShape({ conferenciaId: 'conf-789' }),
  { valid: false, error: 'conferenciaId requer que particularId e centralId também sejam informados.' },
  'Deve rejeitar conferenciaId sem particularId/centralId'
);

assertEqual(
  validateHierarchyIdShape({ centralId: '   ' }),
  { valid: false, error: 'centralId deve ser uma string não vazia.' },
  'Deve rejeitar centralId contendo apenas espaços'
);

assertEqual(
  validateHierarchyIdShape({ centralId: 'central-123', particularId: '' }),
  { valid: false, error: 'particularId deve ser uma string não vazia.' },
  'Deve rejeitar particularId sendo string vazia'
);


// ----------------------------------------------------
// 3. Testes para Ocultação de Dados Sensíveis (sanitizeAuditChanges)
// ----------------------------------------------------
console.log('\n[TEST GROUP 3] Sanitização e Mascaramento de Auditoria (LGPD)');

assertEqual(
  maskSensitiveValue('cpf', '123.456.789-00'),
  '***.456.789-**',
  'Deve mascarar o CPF preservando dígitos intermediários'
);

assertEqual(
  maskSensitiveValue('phone', '(16) 99876-5432'),
  '(**) *****-5432',
  'Deve mascarar telefone mantendo últimos 4 dígitos sem palavras extras'
);

assertEqual(
  maskSensitiveValue('email', 'vicentino@dominio.com.br'),
  'v***o@dominio.com.br',
  'Deve mascarar e-mail mantendo primeiro e último caractere do usuário'
);

const auditPayload = {
  name: { before: 'Conferência Antiga', after: 'Conferência Nova' },
  status: { before: 'ativo', after: 'ativo' },
  cpf: { before: '123.456.789-00', after: '987.654.321-11' },
  phone: { before: '(16) 99999-0000', after: '(16) 98888-1111' },
  email: { before: 'antigo@ssvp.org', after: 'novo@ssvp.org' }
};

const sanitized = sanitizeAuditChanges(auditPayload);

assert(
  sanitized.name.before === 'Conferência Antiga' && sanitized.name.after === 'Conferência Nova',
  'Campo "name" não sensível deve permanecer sem alterações'
);

assert(
  sanitized.cpf.before === '***.456.789-**' && sanitized.cpf.after === '***.654.321-**',
  'Campo "cpf" deve ser mascarado em before e after'
);

assert(
  sanitized.phone.before === '(**) *****-0000' && sanitized.phone.after === '(**) *****-1111',
  'Campo "phone" deve ser mascarado em before e after sem a palavra "custom"'
);

assert(
  !sanitized.phone.before.includes('custom') && !sanitized.phone.after.includes('custom'),
  'Mascaramento de telefone não deve conter a palavra "custom"'
);

assert(
  sanitized.email.before === 'a***o@ssvp.org' && sanitized.email.after === 'n***o@ssvp.org',
  'Campo "email" deve ser mascarado em before e after'
);


console.log('\n===================================================');
console.log(` RESULTADOS DOS TESTES: ${passedTests} Passou | ${failedTests} Falhou`);
console.log('===================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
