/**
 * Testes Comprobatórios de Sanitização e Persistência do Fluxo de Cadastro Público
 * 
 * Requisitos Verificados:
 * 1. Sanitização remove recursivamente apenas propriedades estritamente undefined (inclusive em objetos aninhados como consent)
 * 2. Preserva rigorosamente: false, 0, "", null, instâncias de Date e objetos especiais
 * 3. Não converte undefined em null ou string vazia (as chaves são removidas)
 * 4. Solicitação própria com campos opcionais vazios/undefined é sanitizada e gravável sem erro no Firestore
 * 5. Solicitação por terceiro com dados de representante é sanitizada e gravável sem erro no Firestore
 * 6. updateSubmission sanitiza objetos de atualização sem enviar undefined
 * 7. createMembroRecord sanitiza criação de membro oficial sem enviar undefined
 * 8. Log de erro estruturado contém a tag PUBLIC_MEMBER_SUBMISSION_ERROR e NÃO contém dados pessoais (nome, telefone, email, IP, token, datas)
 * 9. Falhas reais de banco continuam retornando STORAGE_ERROR externamente
 */

import { sanitizeForFirestore } from '../lib/firestore_sanitizer.js';
import { FirestorePublicRegistrationRepository } from '../lib/firestore_public_registration_repository.js';
import {
  submitPublicMemberRegistration,
  approveMemberSubmission,
} from '../lib/public_member_registration_service.js';

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

console.log('================================================================================');
console.log(' TESTES DE SANITIZAÇÃO E PERSISTÊNCIA DO FLUXO DE CADASTRO PÚBLICO');
console.log('================================================================================\n');

// --------------------------------------------------------------------------------
// 1. Testes Unitários de `sanitizeForFirestore`
// --------------------------------------------------------------------------------

// 1.1 Remove undefined simples e aninhado
const sampleWithUndefined = {
  a: 'test',
  b: undefined,
  nested: {
    c: 123,
    d: undefined,
    deep: {
      e: false,
      f: undefined,
    },
  },
};
const cleanedSample = sanitizeForFirestore(sampleWithUndefined);
assert(!('b' in cleanedSample), '1a. Propriedade raiz undefined é removida');
assert(!('d' in cleanedSample.nested), '1b. Propriedade aninhada undefined é removida');
assert(!('f' in cleanedSample.nested.deep), '1c. Propriedade profundamente aninhada undefined é removida');
assert(cleanedSample.a === 'test', '1d. String normal é preservada');
assert(cleanedSample.nested.c === 123, '1e. Número é preservado');
assert(cleanedSample.nested.deep.e === false, '1f. Booleano false é preservado');

// 1.2 Preserva false, 0, "", null, Date e objetos especiais
const testDate = new Date('2026-08-24T12:00:00.000Z');
class MockFirestoreTimestamp {
  seconds = 1724500000;
  nanoseconds = 0;
  toDate() { return testDate; }
}
const mockTimestamp = new MockFirestoreTimestamp();

const preservationTest = {
  boolFalse: false,
  numberZero: 0,
  emptyString: '',
  nullValue: null,
  dateInstance: testDate,
  timestampInstance: mockTimestamp,
  arrayWithUndefined: [{ val: 1 }, { val: undefined, keep: 2 }],
  undefinedKey: undefined,
};

const sanitizedPreserved = sanitizeForFirestore(preservationTest);
assert(sanitizedPreserved.boolFalse === false, '2a. false é preservado estritamente');
assert(sanitizedPreserved.numberZero === 0, '2b. 0 é preservado estritamente');
assert(sanitizedPreserved.emptyString === '', '2c. String vazia é preservada estritamente');
assert(sanitizedPreserved.nullValue === null, '2d. null é preservado estritamente');
assert(sanitizedPreserved.dateInstance === testDate, '2e. Instância de Date é preservada');
assert(sanitizedPreserved.timestampInstance instanceof MockFirestoreTimestamp, '2f. Objeto de Timestamp especial é preservado');
assert(!('undefinedKey' in sanitizedPreserved), '2g. Chave undefined é removida e NÃO transformada em null ou ""');
assert(sanitizedPreserved.arrayWithUndefined[1].keep === 2 && !('val' in sanitizedPreserved.arrayWithUndefined[1]), '2h. Arrays aninhados têm seus objetos sanitizados recursivamente');

// --------------------------------------------------------------------------------
// 2. Simulação de Firestore sem suporte a `undefined` (como no Cloud Firestore real)
// --------------------------------------------------------------------------------

class StrictMockFirestore {
  public collections: Record<string, Record<string, any>> = {};

  collection(colName: string) {
    if (!this.collections[colName]) {
      this.collections[colName] = {};
    }
    const self = this;

    return {
      doc(id?: string) {
        const docId = id || `mock_doc_${Math.random().toString(36).substring(2, 9)}`;
        return {
          id: docId,
          async set(data: any, options?: { merge?: boolean }) {
            // Validador estrito do Firestore NodeJS SDK: rejeita qualquer undefined em qualquer profundidade
            function assertNoUndefined(obj: any, path = '') {
              if (obj === null || obj === undefined) {
                if (obj === undefined) {
                  throw new Error(`Firestore strict reject: Cannot use "undefined" as a Firestore value (found in field "${path}").`);
                }
                return;
              }
              if (typeof obj === 'object') {
                if (obj instanceof Date || obj instanceof MockFirestoreTimestamp) return;
                for (const [k, v] of Object.entries(obj)) {
                  const currentPath = path ? `${path}.${k}` : k;
                  if (v === undefined) {
                    throw new Error(`Firestore strict reject: Cannot use "undefined" as a Firestore value (found in field "${currentPath}").`);
                  }
                  if (typeof v === 'object' && v !== null) {
                    assertNoUndefined(v, currentPath);
                  }
                }
              }
            }

            assertNoUndefined(data);

            if (options?.merge && self.collections[colName][docId]) {
              self.collections[colName][docId] = {
                ...self.collections[colName][docId],
                ...data,
              };
            } else {
              self.collections[colName][docId] = { ...data };
            }
          },
          async get() {
            const data = self.collections[colName][docId];
            return {
              id: docId,
              exists: !!data,
              data: () => data ? { ...data } : undefined,
            };
          },
        };
      },
      where(field: string, op: string, val: any) {
        return {
          where(field2: string, op2: string, val2: any) {
            return {
              limit() {
                return {
                  async get() {
                    const docs = Object.entries(self.collections[colName] || {})
                      .filter(([_, d]) => d[field] === val && d[field2] === val2)
                      .map(([id, data]) => ({ id, data: () => data }));
                    return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
                  },
                };
              },
              async get() {
                const docs = Object.entries(self.collections[colName] || {})
                  .filter(([_, d]) => d[field] === val && d[field2] === val2)
                  .map(([id, data]) => ({ id, data: () => data }));
                return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
              },
            };
          },
          limit() {
            return {
              async get() {
                const docs = Object.entries(self.collections[colName] || {})
                  .filter(([_, d]) => d[field] === val)
                  .map(([id, data]) => ({ id, data: () => data }));
                return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
              },
            };
          },
          async get() {
            const docs = Object.entries(self.collections[colName] || {})
              .filter(([_, d]) => d[field] === val)
              .map(([id, data]) => ({ id, data: () => data }));
            return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
          },
        };
      },
    };
  }
}

// --------------------------------------------------------------------------------
// 3. Teste de Fluxo: Cadastro Próprio com Campos Opcionais Vazios (com undefined)
// --------------------------------------------------------------------------------

async function testSubmissionSelfWithEmptyFields() {
  const strictDb = new StrictMockFirestore() as any;
  const repo = new FirestorePublicRegistrationRepository(strictDb);

  // Setup: Token e Hierarquia
  await strictDb.collection('conselho_central_public_tokens').doc('central_test_1').set({
    centralId: 'central_test_1',
    token: 'valid_token_test_123',
    enabled: true,
    status: 'ativo',
    createdAt: new Date().toISOString(),
  });

  await strictDb.collection('conselhos_particulares').doc('cp_test_1').set({
    centralId: 'central_test_1',
    name: 'Conselho Particular Teste',
    status: 'ativo',
  });

  await strictDb.collection('conferencias').doc('conf_test_1').set({
    centralId: 'central_test_1',
    particularId: 'cp_test_1',
    name: 'Conferência Teste',
    status: 'ativo',
  });

  // Cadastro Próprio SEM email, datas vicentinas ou representante (estes serão undefined)
  const result = await submitPublicMemberRegistration(
    'valid_token_test_123',
    {
      particularId: 'cp_test_1',
      conferenciaId: 'conf_test_1',
      fullName: 'Vicentino Teste Silva',
      type: 'confrade',
      phone: '(16) 99999-8888',
      // Campos opcionais omitidos/vazios:
      email: '',
      birthDate: '',
      admissionDate: '',
      acclamationDate: '',
      proclamationDate: '',
      isThirdPartySubmission: false,
      representativeName: '',
      consentAccepted: true,
      termVersion: '2026.1',
    },
    repo,
    { ip: '127.0.0.1', userAgent: 'TestRunner/1.0' }
  );

  assert(result.success === true, '3a. Submissão própria com campos opcionais vazios é aceita com sucesso');
  assert(result.data?.status === 'aguardando_aprovacao', '3b. Status inicial é aguardando_aprovacao');

  const savedDoc = strictDb.collections['solicitacoes_cadastro_membros'][result.data!.submissionId];
  assert(savedDoc !== undefined, '3c. Documento foi persistido no banco estrito do Firestore');
  assert(!('email' in savedDoc), '3d. Campo email undefined não existe no Firestore');
  assert(!('birthDate' in savedDoc), '3e. Campo birthDate undefined não existe no Firestore');
  assert(!('representativeName' in savedDoc), '3f. Campo representativeName undefined não existe no Firestore');
  assert(savedDoc.consent.accepted === true, '3g. consent.accepted é true');
  assert(savedDoc.consent.isThirdParty === false, '3h. consent.isThirdParty é false preservado');
}

// --------------------------------------------------------------------------------
// 4. Teste de Fluxo: Cadastro por Terceiro com Representante
// --------------------------------------------------------------------------------

async function testSubmissionThirdParty() {
  const strictDb = new StrictMockFirestore() as any;
  const repo = new FirestorePublicRegistrationRepository(strictDb);

  await strictDb.collection('conselho_central_public_tokens').doc('central_test_2').set({
    centralId: 'central_test_2',
    token: 'valid_token_test_456',
    enabled: true,
    status: 'ativo',
    createdAt: new Date().toISOString(),
  });

  await strictDb.collection('conselhos_particulares').doc('cp_test_2').set({
    centralId: 'central_test_2',
    name: 'Conselho Particular Dois',
    status: 'ativo',
  });

  await strictDb.collection('conferencias').doc('conf_test_2').set({
    centralId: 'central_test_2',
    particularId: 'cp_test_2',
    name: 'Conferência Dois',
    status: 'ativo',
  });

  const result = await submitPublicMemberRegistration(
    'valid_token_test_456',
    {
      particularId: 'cp_test_2',
      conferenciaId: 'conf_test_2',
      fullName: 'Consócia Idosa Assistida',
      type: 'consocia',
      phone: '(16) 98888-7777',
      birthDate: '1945-05-10',
      isThirdPartySubmission: true,
      representativeName: 'Filha da Consócia Representante',
      consentAccepted: true,
      termVersion: '2026.1',
    },
    repo,
    { ip: '127.0.0.1', userAgent: 'TestRunner/1.0' }
  );

  assert(result.success === true, '4a. Submissão por terceiro é aceita com sucesso');
  const savedDoc = strictDb.collections['solicitacoes_cadastro_membros'][result.data!.submissionId];
  assert(savedDoc.isThirdPartySubmission === true, '4b. isThirdPartySubmission é true');
  assert(savedDoc.representativeName === 'Filha da Consócia Representante', '4c. representativeName é preservado');
  assert(savedDoc.consent.isThirdParty === true, '4d. consent.isThirdParty é true');
  assert(savedDoc.consent.representativeName === 'Filha da Consócia Representante', '4e. consent.representativeName é preservado');
}

// --------------------------------------------------------------------------------
// 5. Teste de Fluxo: Aprovação e Criação do Membro Oficial com Sanitização
// --------------------------------------------------------------------------------

async function testApprovalAndMemberCreation() {
  const strictDb = new StrictMockFirestore() as any;
  const repo = new FirestorePublicRegistrationRepository(strictDb);

  await strictDb.collection('conselho_central_public_tokens').doc('central_test_3').set({
    centralId: 'central_test_3',
    token: 'valid_token_test_789',
    enabled: true,
    status: 'ativo',
    createdAt: new Date().toISOString(),
  });

  await strictDb.collection('conselhos_particulares').doc('cp_test_3').set({
    centralId: 'central_test_3',
    name: 'Conselho Particular Três',
    status: 'ativo',
  });

  await strictDb.collection('conferencias').doc('conf_test_3').set({
    centralId: 'central_test_3',
    particularId: 'cp_test_3',
    name: 'Conferência Três',
    status: 'ativo',
  });

  // Cria submissão
  const submissionRes = await submitPublicMemberRegistration(
    'valid_token_test_789',
    {
      particularId: 'cp_test_3',
      conferenciaId: 'conf_test_3',
      fullName: 'Novo Membro Aprovado',
      type: 'confrade',
      phone: '(16) 97777-6666',
      consentAccepted: true,
      termVersion: '2026.1',
    },
    repo,
    { ip: '127.0.0.1' }
  );

  const subId = submissionRes.data!.submissionId;

  // Aprova a submissão
  const approvalRes = await approveMemberSubmission(
    subId,
    'central_test_3',
    { allowed: true, validatedCentralId: 'central_test_3', userId: 'admin_test_user' },
    repo,
    {}
  );

  assert(approvalRes.success === true, '5a. Aprovação de membro é executada com sucesso');
  const membroId = approvalRes.data!.membroId;
  const membroDoc = strictDb.collections['membros'][membroId];
  assert(membroDoc !== undefined, '5b. Registro de membro oficial criado no banco sem erro de undefined');
  assert(membroDoc.status === 'ativo', '5c. Status do membro é ativo');
  assert(!('email' in membroDoc), '5d. Membro não possui email undefined no banco');

  const updatedSubDoc = strictDb.collections['solicitacoes_cadastro_membros'][subId];
  assert(updatedSubDoc.status === 'aprovado', '5e. Solicitação atualizada para status aprovado');
  assert(updatedSubDoc.membroId === membroId, '5f. Solicitação vinculada ao membroId');
}

// --------------------------------------------------------------------------------
// 6. Teste de Log Estruturado Seguro e Tratamento de STORAGE_ERROR
// --------------------------------------------------------------------------------

async function testStructuredLogAndStorageError() {
  // Mock de repositório com erro simulado de infraestrutura
  let loggedOutput = '';
  const originalConsoleError = console.error;
  console.error = (msg: string) => {
    loggedOutput += msg;
  };

  const failingRepo: any = {
    getCentralTokenConfig: async () => ({
      centralId: 'central_fail_test',
      token: 'fail_token_123',
      enabled: true,
      status: 'ativo',
      createdAt: new Date().toISOString(),
    }),
    getParticularById: async () => ({
      centralId: 'central_fail_test',
      id: 'cp_fail_1',
      name: 'CP Falha',
      status: 'ativo',
    }),
    getConferenciaById: async () => ({
      centralId: 'central_fail_test',
      particularId: 'cp_fail_1',
      id: 'conf_fail_1',
      name: 'Conf Falha',
      status: 'ativo',
    }),
    findRecentPendingSubmission: async () => null,
    findExistingMembers: async () => [],
    createSubmission: async () => {
      const dbErr: any = new Error('Database connection timed out in storage layer');
      dbErr.code = 14; // UNAVAILABLE
      dbErr.name = 'FirebaseStorageError';
      throw dbErr;
    },
  };

  const result = await submitPublicMemberRegistration(
    'fail_token_123',
    {
      particularId: 'cp_fail_1',
      conferenciaId: 'conf_fail_1',
      fullName: 'Nome Privado Super Secreto',
      type: 'confrade',
      phone: '(16) 91111-2222',
      email: 'privado@exemplo.com',
      consentAccepted: true,
      termVersion: '2026.1',
    },
    failingRepo,
    { ip: '192.168.1.100', userAgent: 'SecretBrowser/99.0' }
  );

  console.error = originalConsoleError;

  assert(result.success === false, '6a. Falha de banco retorna success === false');
  assert(result.code === 'STORAGE_ERROR', '6b. Código de erro retornado ao chamador é STORAGE_ERROR');
  assert(result.error === 'Erro interno ao processar o formulário. Tente novamente mais tarde.', '6c. Mensagem de erro ao usuário é genérica e segura');

  // Verifica integridade e segurança do log estruturado
  assert(loggedOutput.includes('PUBLIC_MEMBER_SUBMISSION_ERROR'), '6d. Log contém tag PUBLIC_MEMBER_SUBMISSION_ERROR');
  assert(loggedOutput.includes('submitPublicMemberRegistration'), '6e. Log contém operation submitPublicMemberRegistration');
  assert(loggedOutput.includes('solicitacoes_cadastro_membros'), '6f. Log contém collection solicitacoes_cadastro_membros');
  
  // Garantia de privacidade: NENHUM dado pessoal pode ter sido registrado
  assert(!loggedOutput.includes('Nome Privado Super Secreto'), '6g. Log NÃO contém o nome do membro');
  assert(!loggedOutput.includes('91111-2222'), '6h. Log NÃO contém o telefone');
  assert(!loggedOutput.includes('privado@exemplo.com'), '6i. Log NÃO contém o email');
  assert(!loggedOutput.includes('192.168.1.100'), '6j. Log NÃO contém o IP');
  assert(!loggedOutput.includes('fail_token_123'), '6k. Log NÃO contém o token público');
}

// --------------------------------------------------------------------------------
// Execução dos Testes
// --------------------------------------------------------------------------------

async function run() {
  await testSubmissionSelfWithEmptyFields();
  await testSubmissionThirdParty();
  await testApprovalAndMemberCreation();
  await testStructuredLogAndStorageError();

  console.log('\n================================================================================');
  console.log(` RESULTADO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log('================================================================================\n');
}

run().catch((err) => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
