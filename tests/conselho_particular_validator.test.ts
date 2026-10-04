import { validateConselhoParticularInput } from '../lib/conselho_particular_validator.js';
import { StandaloneConselhoParticular } from '../types.js';

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
console.log(' Executando Testes do Validador de Conselho Particular');
console.log('===================================================\n');

async function runTests() {
  const validatedCentralId = 'central-001';

  // ----------------------------------------------------
  // 1. Teste de Cadastro Válido
  // ----------------------------------------------------
  console.log('[TEST 1] Cadastro Válido de Conselho Particular');
  const validPayload = {
    id: 'cp-001',
    name: 'Conselho Particular São Pedro',
    city: 'Belo Horizonte',
    phone: '(31) 99999-0000',
    email: 'cp.saopedro@ssvp.org.br',
    status: 'ativo',
    presidente: { name: 'João Silva', phone: '(31) 98888-1111' },
  };

  const resultValid = validateConselhoParticularInput(validPayload, validatedCentralId, { currentUserId: 'user-admin' });

  assertEqual(resultValid.valid, true, 'Deve retornar valid: true para cadastro válido');
  assertEqual(resultValid.code, 'VALID', 'Deve retornar code: VALID');
  assertEqual(resultValid.normalizedData?.name, 'Conselho Particular São Pedro', 'Deve preservar o nome original');
  assertEqual(resultValid.normalizedData?.centralId, validatedCentralId, 'normalizedData deve usar o validatedCentralId');
  assertEqual(resultValid.normalizedData?.normalizedName, 'CONSELHO PARTICULAR SAO PEDRO', 'Deve gerar normalizedName corretamente');

  // ----------------------------------------------------
  // 2. Teste de Nome Ausente ou Vazio
  // ----------------------------------------------------
  console.log('\n[TEST 2] Nome Ausente ou Vazio');
  const missingNamePayload = { name: '   ', status: 'ativo' };
  const resultMissingName = validateConselhoParticularInput(missingNamePayload, validatedCentralId);

  assertEqual(resultMissingName.valid, false, 'Deve rejeitar payload com nome apenas com espaços');
  assertEqual(resultMissingName.code, 'MISSING_NAME', 'Deve retornar code: MISSING_NAME');

  // ----------------------------------------------------
  // 3. Teste de validatedCentralId Ausente
  // ----------------------------------------------------
  console.log('\n[TEST 3] validatedCentralId Ausente');
  const resultMissingCentralId = validateConselhoParticularInput(validPayload, '');

  assertEqual(resultMissingCentralId.valid, false, 'Deve rejeitar quando validatedCentralId for vazio');
  assertEqual(resultMissingCentralId.code, 'MISSING_VALIDATED_CENTRAL_ID', 'Deve retornar code: MISSING_VALIDATED_CENTRAL_ID');

  // ----------------------------------------------------
  // 4. Teste de centralId Divergente do Formulário
  // ----------------------------------------------------
  console.log('\n[TEST 4] centralId no formulário divergente do contexto seguro');
  const mismatchCentralPayload = {
    name: 'Conselho Particular Santo Antônio',
    centralId: 'central-INTRUSO-999', // Divergente do validatedCentralId 'central-001'
  };

  const resultMismatch = validateConselhoParticularInput(mismatchCentralPayload, validatedCentralId);

  assertEqual(resultMismatch.valid, false, 'Deve rejeitar centralId diferente do contexto seguro');
  assertEqual(resultMismatch.code, 'CENTRAL_ID_MISMATCH', 'Deve retornar code: CENTRAL_ID_MISMATCH');

  // ----------------------------------------------------
  // 5. Teste de Status Inválido
  // ----------------------------------------------------
  console.log('\n[TEST 5] Status Inválido');
  const invalidStatusPayload = {
    name: 'Conselho Particular Santa Luzia',
    status: 'pendente', // Inválido
  };

  const resultInvalidStatus = validateConselhoParticularInput(invalidStatusPayload, validatedCentralId);

  assertEqual(resultInvalidStatus.valid, false, 'Deve rejeitar status que não seja ativo ou inativo');
  assertEqual(resultInvalidStatus.code, 'INVALID_STATUS', 'Deve retornar code: INVALID_STATUS');

  // ----------------------------------------------------
  // 6. Teste de Edição Tentando Alterar Campos Imutáveis
  // ----------------------------------------------------
  console.log('\n[TEST 6] Edição tentando alterar campos imutáveis (id, centralId, createdAt, createdBy)');

  const existingRecord: StandaloneConselhoParticular = {
    id: 'cp-001',
    centralId: validatedCentralId,
    name: 'Conselho Particular São Pedro',
    normalizedName: 'CONSELHO PARTICULAR SAO PEDRO',
    status: 'ativo',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    createdBy: 'user-original',
    updatedBy: 'user-original',
  };

  // A. Alterando id
  const editIdPayload = { ...validPayload, id: 'cp-ALTERADO-999' };
  const resultEditId = validateConselhoParticularInput(editIdPayload, validatedCentralId, { existingRecord });
  assertEqual(resultEditId.valid, false, 'Deve rejeitar alteração do campo id');
  assertEqual(resultEditId.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve retornar code: IMMUTABLE_FIELD_MODIFIED para id');

  // B. Alterando centralId
  const editCentralIdPayload = { ...validPayload, centralId: 'central-ALTERADO-999' };
  const resultEditCentralId = validateConselhoParticularInput(editCentralIdPayload, validatedCentralId, { existingRecord });
  assertEqual(resultEditCentralId.valid, false, 'Deve rejeitar alteração do campo centralId');
  assertEqual(resultEditCentralId.code, 'CENTRAL_ID_MISMATCH', 'Deve barrar centralId divergente');

  // C. Alterando createdAt
  const editCreatedAtPayload = { ...validPayload, createdAt: '2020-01-01T00:00:00.000Z' };
  const resultEditCreatedAt = validateConselhoParticularInput(editCreatedAtPayload, validatedCentralId, { existingRecord });
  assertEqual(resultEditCreatedAt.valid, false, 'Deve rejeitar alteração do campo createdAt');
  assertEqual(resultEditCreatedAt.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve retornar code: IMMUTABLE_FIELD_MODIFIED para createdAt');

  // D. Alterando createdBy
  const editCreatedByPayload = { ...validPayload, createdBy: 'hacker-user' };
  const resultEditCreatedBy = validateConselhoParticularInput(editCreatedByPayload, validatedCentralId, { existingRecord });
  assertEqual(resultEditCreatedBy.valid, false, 'Deve rejeitar alteração do campo createdBy');
  assertEqual(resultEditCreatedBy.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve retornar code: IMMUTABLE_FIELD_MODIFIED para createdBy');

  // ----------------------------------------------------
  // 7. Teste de Ausência de Mutação do Objeto de Entrada
  // ----------------------------------------------------
  console.log('\n[TEST 7] Ausência de Mutação do Objeto Recebido');
  const payloadToProtect = {
    name: 'Conselho Particular Imutável',
    city: 'Contagem',
    presidente: { name: 'Lucas Moura' },
  };

  const payloadSnapshot = JSON.stringify(payloadToProtect);

  validateConselhoParticularInput(payloadToProtect, validatedCentralId);

  const payloadAfter = JSON.stringify(payloadToProtect);

  assertEqual(payloadAfter, payloadSnapshot, 'O objeto de entrada não deve sofrer nenhuma mutação após a validação');

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
