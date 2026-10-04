import { sanitizeForFirestore } from '../lib/firestore_conselho_particular_repository.js';
import { ESTRUTURA_2026_JABOTICABAL_DATA } from '../lib/structure_2026_data.js';
import { validateConselhoParticularInput } from '../lib/conselho_particular_validator.js';
import { validateConferenciaInput } from '../lib/conferencia_validator.js';
import { StandaloneConselhoParticular } from '../types.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, description: string) {
  total++;
  if (condition) {
    console.log(`✓ [PASS] ${description}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
}

function hasAnyUndefined(obj: any): boolean {
  if (obj === undefined) return true;
  if (obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) {
    return obj.some(item => hasAnyUndefined(item));
  }
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) return true;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (hasAnyUndefined(obj[key])) return true;
    }
  }
  return false;
}

console.log('================================================================================');
console.log(' TESTES DE SANITIZAÇÃO DE OBJETOS PARA PERSISTÊNCIA NO FIRESTORE');
console.log('================================================================================\n');

// 1. Teste: Cadastro sem 'code' remove a chave 'code' sem enviar undefined
const rawWithoutCode = {
  id: 'cp_123',
  name: 'Conselho Particular Teste',
  centralId: 'central_123',
  code: undefined,
  phone: undefined,
  email: undefined,
  status: 'ativo',
};
const sanitizedWithoutCode = sanitizeForFirestore(rawWithoutCode);
assert(!('code' in sanitizedWithoutCode), '1. Cadastro sem code não envia code ao Firestore (chave removida)');
assert(!('phone' in sanitizedWithoutCode), '1b. Chave phone com valor undefined foi removida');
assert(!('email' in sanitizedWithoutCode), '1c. Chave email com valor undefined foi removida');

// 2. Teste: Cadastro com 'code' preserva o valor
const rawWithCode = {
  id: 'cp_123',
  name: 'Conselho Particular Teste',
  centralId: 'central_123',
  code: 'CP-001',
  status: 'ativo',
};
const sanitizedWithCode = sanitizeForFirestore(rawWithCode);
assert(sanitizedWithCode.code === 'CP-001', '2. Cadastro com code preserva o valor perfeitamente');

// 3. Teste: Valores intencionais como null, 0, false e string vazia NÃO são removidos nem alterados
const rawEdgeCases = {
  membersCount: 0,
  isActive: false,
  notes: '',
  legacyParent: null,
  tags: ['tag1', 'tag2'],
  nested: {
    nestedZero: 0,
    nestedEmpty: '',
    nestedUndefined: undefined,
  },
  unwantedUndefined: undefined,
};
const sanitizedEdgeCases = sanitizeForFirestore(rawEdgeCases);
assert(sanitizedEdgeCases.membersCount === 0, '3a. Preserva número 0');
assert(sanitizedEdgeCases.isActive === false, '3b. Preserva booleano false');
assert(sanitizedEdgeCases.notes === '', '3c. Preserva string vazia ""');
assert(sanitizedEdgeCases.legacyParent === null, '3d. Preserva valor null');
assert(sanitizedEdgeCases.nested.nestedZero === 0, '3e. Preserva 0 em objetos aninhados');
assert(sanitizedEdgeCases.nested.nestedEmpty === '', '3f. Preserva string vazia em objetos aninhados');
assert(!('nestedUndefined' in sanitizedEdgeCases.nested), '3g. Remove chave undefined em objetos aninhados');
assert(!('unwantedUndefined' in sanitizedEdgeCases), '3h. Remove chave undefined no primeiro nível');

// 4. Teste: Nenhum campo do documento persistido contém undefined
assert(!hasAnyUndefined(sanitizedEdgeCases), '4. Objeto sanitizado não possui nenhum campo com undefined');

// 5. Teste: Os 6 Conselhos Particulares da importação 2026 passam pela preparação dos documentos sem valores undefined
console.log('\n--- Validando os 6 Conselhos Particulares da estrutura 2026 ---');
let cpCount = 0;
const dummyParentCp: StandaloneConselhoParticular = {
  id: 'particular_doc_id_teste',
  centralId: 'central_doc_id_teste',
  name: 'Conselho Particular Teste',
  normalizedName: 'CONSELHO PARTICULAR TESTE',
  status: 'ativo',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'user_migrador',
  updatedBy: 'user_migrador',
};

for (const rawCp of ESTRUTURA_2026_JABOTICABAL_DATA) {
  cpCount++;
  const validation = validateConselhoParticularInput(
    {
      name: rawCp.name,
      city: rawCp.city,
      phone: rawCp.phone,
      email: rawCp.email,
      startDate: rawCp.startDate,
      endDate: rawCp.endDate,
      status: 'ativo',
      presidente: {
        name: rawCp.presidenteName,
        phone: rawCp.presidentePhone,
      },
    },
    'central_doc_id_teste',
    { currentUserId: 'user_migrador' }
  );

  assert(validation.valid === true, `CP [${rawCp.name}] validado com sucesso`);
  const recordToSave = {
    ...validation.normalizedData!,
    id: `cp_test_id_${cpCount}`,
    centralId: 'central_doc_id_teste',
  };

  const sanitized = sanitizeForFirestore(recordToSave);
  assert(!hasAnyUndefined(sanitized), `CP [${rawCp.name}] sanitizado com sucesso sem nenhum valor undefined`);
}
assert(cpCount === 6, 'Exatamente 6 Conselhos Particulares processados e sanitizados');

// 6. Teste: As 52 Conferências da importação 2026 passam pela preparação dos documentos sem valores undefined
console.log('\n--- Validando as 52 Conferências da estrutura 2026 ---');
let confCount = 0;
for (const rawCp of ESTRUTURA_2026_JABOTICABAL_DATA) {
  for (const rawConf of rawCp.conferencias) {
    confCount++;
    const validation = validateConferenciaInput(
      {
        name: rawConf.name,
        status: 'ativo',
      },
      'central_doc_id_teste',
      'particular_doc_id_teste',
      dummyParentCp,
      { currentUserId: 'user_migrador' }
    );

    assert(validation.valid === true, `Conferência [${rawConf.name}] validada com sucesso`);
    const recordToSave = {
      ...validation.normalizedData!,
      id: `conf_test_id_${confCount}`,
      centralId: 'central_doc_id_teste',
      particularId: 'particular_doc_id_teste',
    };

    const sanitized = sanitizeForFirestore(recordToSave);
    assert(!hasAnyUndefined(sanitized), `Conferência [${rawConf.name}] sanitizada com sucesso sem nenhum valor undefined`);
  }
}
assert(confCount === 52, 'Exatamente 52 Conferências processadas e sanitizadas');

console.log('\n================================================================================');
console.log(` RESULTADO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
console.log('================================================================================\n');
