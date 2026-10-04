import { validateConferenciaInput } from '../lib/conferencia_validator.js';
import { StandaloneConferencia, StandaloneConselhoParticular } from '../types.js';

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
console.log(' Executando Testes do Validador de Conferência');
console.log('===================================================\n');

async function runTests() {
  const validatedCentralId = 'central-001';
  const particularId = 'cp-100';

  const parentParticularValid: StandaloneConselhoParticular = {
    id: particularId,
    centralId: validatedCentralId,
    name: 'Conselho Particular São José',
    normalizedName: 'CONSELHO PARTICULAR SAO JOSE',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'system',
    updatedBy: 'system',
  };

  // ----------------------------------------------------
  // 1. Teste de Cadastro Válido
  // ----------------------------------------------------
  console.log('[TEST 1] Cadastro Válido de Conferência');
  const validPayload = {
    id: 'conf-200',
    name: 'Conferência Vicentina Santa Teresinha',
    meetingDay: 'Segunda-feira',
    meetingTime: '19:30',
    status: 'ativo',
    presidente: { name: 'Carlos Andrade', phone: '(31) 98888-2222' },
  };

  const resultValid = validateConferenciaInput(
    validPayload,
    validatedCentralId,
    particularId,
    parentParticularValid,
    { currentUserId: 'user-admin' }
  );

  assertEqual(resultValid.valid, true, 'Deve retornar valid: true para cadastro válido');
  assertEqual(resultValid.code, 'VALID', 'Deve retornar code: VALID');
  assertEqual(resultValid.normalizedData?.name, 'Conferência Vicentina Santa Teresinha', 'Deve preservar o nome original');
  assertEqual(resultValid.normalizedData?.centralId, validatedCentralId, 'normalizedData deve conter o validatedCentralId');
  assertEqual(resultValid.normalizedData?.particularId, particularId, 'normalizedData deve conter o particularId');
  assertEqual(resultValid.normalizedData?.normalizedName, 'CONFERENCIA VICENTINA SANTA TERESINHA', 'Deve gerar normalizedName corretamente');

  // ----------------------------------------------------
  // 2. Testes de Campos Obrigatórios Ausentes
  // ----------------------------------------------------
  console.log('\n[TEST 2] Campos Obrigatórios Ausentes (nome, validatedCentralId, particularId)');

  // A. Nome Ausente
  const missingNamePayload = { ...validPayload, name: '   ' };
  const resMissingName = validateConferenciaInput(missingNamePayload, validatedCentralId, particularId, parentParticularValid);
  assertEqual(resMissingName.valid, false, 'Deve rejeitar nome vazio');
  assertEqual(resMissingName.code, 'MISSING_NAME', 'Deve retornar code: MISSING_NAME');

  // B. validatedCentralId Ausente
  const resMissingCentral = validateConferenciaInput(validPayload, '', particularId, parentParticularValid);
  assertEqual(resMissingCentral.valid, false, 'Deve rejeitar validatedCentralId vazio');
  assertEqual(resMissingCentral.code, 'MISSING_VALIDATED_CENTRAL_ID', 'Deve retornar code: MISSING_VALIDATED_CENTRAL_ID');

  // C. particularId Ausente
  const resMissingParticular = validateConferenciaInput(validPayload, validatedCentralId, '', parentParticularValid);
  assertEqual(resMissingParticular.valid, false, 'Deve rejeitar particularId vazio');
  assertEqual(resMissingParticular.code, 'MISSING_PARTICULAR_ID', 'Deve retornar code: MISSING_PARTICULAR_ID');

  // ----------------------------------------------------
  // 3. Testes do Conselho Particular Pai (parentParticular)
  // ----------------------------------------------------
  console.log('\n[TEST 3] Validações do Conselho Particular Pai (parentParticular)');

  // A. Pai Ausente / Nulo
  const resNoParent = validateConferenciaInput(validPayload, validatedCentralId, particularId, null);
  assertEqual(resNoParent.valid, false, 'Deve rejeitar parentParticular nulo');
  assertEqual(resNoParent.code, 'PARENT_PARTICULAR_NOT_FOUND', 'Deve retornar code: PARENT_PARTICULAR_NOT_FOUND');

  // B. Pai com ID diferente do particularId
  const parentDifferentId: StandaloneConselhoParticular = {
    ...parentParticularValid,
    id: 'cp-OUTRO-999',
  };
  const resParentIdMismatch = validateConferenciaInput(validPayload, validatedCentralId, particularId, parentDifferentId);
  assertEqual(resParentIdMismatch.valid, false, 'Deve rejeitar parentParticular com ID divergente');
  assertEqual(resParentIdMismatch.code, 'PARENT_PARTICULAR_ID_MISMATCH', 'Deve retornar code: PARENT_PARTICULAR_ID_MISMATCH');

  // C. Pai pertencente a outro centralId
  const parentDifferentCentral: StandaloneConselhoParticular = {
    ...parentParticularValid,
    centralId: 'central-OUTRO-999',
  };
  const resParentCentralMismatch = validateConferenciaInput(validPayload, validatedCentralId, particularId, parentDifferentCentral);
  assertEqual(resParentCentralMismatch.valid, false, 'Deve rejeitar parentParticular com centralId divergente');
  assertEqual(resParentCentralMismatch.code, 'PARENT_PARTICULAR_CENTRAL_MISMATCH', 'Deve retornar code: PARENT_PARTICULAR_CENTRAL_MISMATCH');

  // D. Pai Inativo
  const parentInactive: StandaloneConselhoParticular = {
    ...parentParticularValid,
    status: 'inativo',
  };
  const resParentInactive = validateConferenciaInput(validPayload, validatedCentralId, particularId, parentInactive);
  assertEqual(resParentInactive.valid, false, 'Deve rejeitar parentParticular inativo');
  assertEqual(resParentInactive.code, 'INACTIVE_PARENT_PARTICULAR', 'Deve retornar code: INACTIVE_PARENT_PARTICULAR');

  // ----------------------------------------------------
  // 4. Testes de centralId e particularId Divergentes no Formulário
  // ----------------------------------------------------
  console.log('\n[TEST 4] centralId ou particularId Divergentes no Formulário');

  // A. centralId divergente no formulário
  const formCentralMismatchPayload = { ...validPayload, centralId: 'central-FORMAR-999' };
  const resFormCentralMismatch = validateConferenciaInput(formCentralMismatchPayload, validatedCentralId, particularId, parentParticularValid);
  assertEqual(resFormCentralMismatch.valid, false, 'Deve rejeitar centralId do formulário divergente');
  assertEqual(resFormCentralMismatch.code, 'CENTRAL_ID_MISMATCH', 'Deve retornar code: CENTRAL_ID_MISMATCH');

  // B. particularId divergente no formulário
  const formPartMismatchPayload = { ...validPayload, particularId: 'cp-FORMAR-999' };
  const resFormPartMismatch = validateConferenciaInput(formPartMismatchPayload, validatedCentralId, particularId, parentParticularValid);
  assertEqual(resFormPartMismatch.valid, false, 'Deve rejeitar particularId do formulário divergente');
  assertEqual(resFormPartMismatch.code, 'PARTICULAR_ID_MISMATCH', 'Deve retornar code: PARTICULAR_ID_MISMATCH');

  // ----------------------------------------------------
  // 5. Teste de Status Inválido
  // ----------------------------------------------------
  console.log('\n[TEST 5] Status Inválido');
  const invalidStatusPayload = { ...validPayload, status: 'suspenso' };
  const resInvalidStatus = validateConferenciaInput(invalidStatusPayload, validatedCentralId, particularId, parentParticularValid);
  assertEqual(resInvalidStatus.valid, false, 'Deve rejeitar status que não seja ativo/inativo');
  assertEqual(resInvalidStatus.code, 'INVALID_STATUS', 'Deve retornar code: INVALID_STATUS');

  // ----------------------------------------------------
  // 6. Testes de Imutabilidade na Edição (existingRecord)
  // ----------------------------------------------------
  console.log('\n[TEST 6] Tentativa de Alterar Campos Imutáveis em Edição');

  const existingRecord: StandaloneConferencia = {
    id: 'conf-200',
    particularId,
    centralId: validatedCentralId,
    name: 'Conferência Vicentina Santa Teresinha',
    normalizedName: 'CONFERENCIA VICENTINA SANTA TERESINHA',
    status: 'ativo',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    createdBy: 'user-original',
    updatedBy: 'user-original',
  };

  // A. Alterando id
  const editIdPayload = { ...validPayload, id: 'conf-ALTERADO-999' };
  const resEditId = validateConferenciaInput(editIdPayload, validatedCentralId, particularId, parentParticularValid, { existingRecord });
  assertEqual(resEditId.valid, false, 'Deve rejeitar alteração do id');
  assertEqual(resEditId.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve retornar code: IMMUTABLE_FIELD_MODIFIED para id');

  // B. Alterando createdAt
  const editCreatedAtPayload = { ...validPayload, createdAt: '2020-01-01T00:00:00.000Z' };
  const resEditCreatedAt = validateConferenciaInput(editCreatedAtPayload, validatedCentralId, particularId, parentParticularValid, { existingRecord });
  assertEqual(resEditCreatedAt.valid, false, 'Deve rejeitar alteração do createdAt');
  assertEqual(resEditCreatedAt.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve retornar code: IMMUTABLE_FIELD_MODIFIED para createdAt');

  // C. Alterando createdBy
  const editCreatedByPayload = { ...validPayload, createdBy: 'hacker-user' };
  const resEditCreatedBy = validateConferenciaInput(editCreatedByPayload, validatedCentralId, particularId, parentParticularValid, { existingRecord });
  assertEqual(resEditCreatedBy.valid, false, 'Deve rejeitar alteração do createdBy');
  assertEqual(resEditCreatedBy.code, 'IMMUTABLE_FIELD_MODIFIED', 'Deve retornar code: IMMUTABLE_FIELD_MODIFIED para createdBy');

  // ----------------------------------------------------
  // 7. Teste de Ausência de Mutação dos Objetos de Entrada
  // ----------------------------------------------------
  console.log('\n[TEST 7] Ausência de Mutação dos Objetos Recebidos');

  const payloadToProtect = {
    name: 'Conferência Não Mutável',
    meetingDay: 'Quarta-feira',
    presidente: { name: 'Ana Maria' },
  };
  const payloadSnapshot = JSON.stringify(payloadToProtect);
  const parentSnapshot = JSON.stringify(parentParticularValid);

  validateConferenciaInput(payloadToProtect, validatedCentralId, particularId, parentParticularValid);

  assertEqual(JSON.stringify(payloadToProtect), payloadSnapshot, 'O payload de entrada não deve sofrer mutação');
  assertEqual(JSON.stringify(parentParticularValid), parentSnapshot, 'O objeto parentParticular não deve sofrer mutação');

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
