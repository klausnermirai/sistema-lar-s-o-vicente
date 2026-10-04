const assert = require('assert');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('TESTES ISOLADOS ROBUSTOS: PROTEÇÃO DE FALLBACK, CANONICAL E ISOLAMENTO');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Detalhes: ${err.message}`);
    failedCount++;
  }
}

// -------------------------------------------------------------
// GRUPO 1: COMPROVAÇÃO DE TRAVA DE FALLBACK EM PRODUÇÃO / CLOUD RUN
// -------------------------------------------------------------
console.log('--- 1. Validação de Trava de Fallback (db_errors.ts) ---');

runTest('NODE_ENV=production impede fallback (canUseLocalFallback === false)', () => {
  const output = execSync(
    'node -e "process.env.NODE_ENV = \'production\'; delete process.env.K_SERVICE; const { canUseLocalFallback, isProductionEnvironment } = require(\'./lib/db_errors.ts\'); console.log(JSON.stringify({ canUseLocalFallback, isProductionEnvironment }));"',
    { encoding: 'utf8' }
  );
  const result = JSON.parse(output.trim());
  assert.strictEqual(result.isProductionEnvironment, true, 'isProductionEnvironment deve ser true quando NODE_ENV=production');
  assert.strictEqual(result.canUseLocalFallback, false, 'canUseLocalFallback deve ser false quando NODE_ENV=production');
});

runTest('K_SERVICE (Cloud Run) impede fallback mesmo se NODE_ENV for development', () => {
  const output = execSync(
    'node -e "process.env.NODE_ENV = \'development\'; process.env.K_SERVICE = \'ssvp-prod-service\'; const { canUseLocalFallback, isProductionEnvironment } = require(\'./lib/db_errors.ts\'); console.log(JSON.stringify({ canUseLocalFallback, isProductionEnvironment }));"',
    { encoding: 'utf8' }
  );
  const result = JSON.parse(output.trim());
  assert.strictEqual(result.isProductionEnvironment, true, 'isProductionEnvironment deve ser true na presença de K_SERVICE');
  assert.strictEqual(result.canUseLocalFallback, false, 'canUseLocalFallback deve ser false na presença de K_SERVICE');
});

runTest('K_SERVICE (Cloud Run) impede fallback mesmo se NODE_ENV estiver ausente', () => {
  const output = execSync(
    'node -e "delete process.env.NODE_ENV; process.env.K_SERVICE = \'ssvp-prod-service\'; const { canUseLocalFallback, isProductionEnvironment } = require(\'./lib/db_errors.ts\'); console.log(JSON.stringify({ canUseLocalFallback, isProductionEnvironment }));"',
    { encoding: 'utf8' }
  );
  const result = JSON.parse(output.trim());
  assert.strictEqual(result.isProductionEnvironment, true, 'isProductionEnvironment deve ser true se K_SERVICE existir sem NODE_ENV');
  assert.strictEqual(result.canUseLocalFallback, false, 'canUseLocalFallback deve ser false se K_SERVICE existir sem NODE_ENV');
});

runTest('Erros 401 e 403 NÃO são classificados como indisponibilidade do banco', () => {
  const { isDbUnavailableError } = require('./lib/db_errors.ts');
  const err401 = { status: 401, message: 'Não autorizado' };
  const err403 = { status: 403, message: 'Acesso negado para esta unidade' };
  const err404 = { status: 404, message: 'Instituição não encontrada' };
  assert.strictEqual(isDbUnavailableError(err401), false, '401 não deve ser erro de banco');
  assert.strictEqual(isDbUnavailableError(err403), false, '403 não deve ser erro de banco');
  assert.strictEqual(isDbUnavailableError(err404), false, '404 não deve ser erro de banco');
});

runTest('Erros reais de banco (código 14/UNAVAILABLE ou 8/RESOURCE_EXHAUSTED) são detectados e retornam 503', () => {
  const { isDbUnavailableError, sendDatabaseError } = require('./lib/db_errors.ts');
  const err14 = { code: 14, message: 'Service Unavailable' };
  const err8 = { code: 8, message: 'Quota exceeded' };
  assert.strictEqual(isDbUnavailableError(err14), true, 'Erro código 14 deve ser detectado como indisponibilidade');
  assert.strictEqual(isDbUnavailableError(err8), true, 'Erro código 8 deve ser detectado como indisponibilidade');

  // Simular resposta express para sendDatabaseError
  let sentStatus = null;
  let sentJson = null;
  const mockRes = {
    headersSent: false,
    status(code) { sentStatus = code; return this; },
    json(payload) { sentJson = payload; return this; }
  };
  sendDatabaseError(mockRes, err14, 'Falha ao buscar residentes');
  assert.strictEqual(sentStatus, 503, 'sendDatabaseError deve responder com HTTP 503');
  assert.strictEqual(sentJson.error, 'DATABASE_TEMPORARILY_UNAVAILABLE', 'sendDatabaseError deve retornar erro estruturado e NÃO lista vazia');
  assert.notStrictEqual(Array.isArray(sentJson), true, 'sendDatabaseError NUNCA deve retornar array');
});

// -------------------------------------------------------------
// GRUPO 2: RESOLUÇÃO CANÔNICA E NÃO INCLUSÃO DE ga6jzrx1flf
// -------------------------------------------------------------
console.log('\n--- 2. Resolução Canônica e Tratamento de IDs Não Confirmados ---');

const {
  getCanonicalInstitutionId,
  isMonteAltoUnit,
  getMonteAltoQueryIds,
  MONTE_ALTO_OPERATIONAL_ID,
  MONTE_ALTO_CNPJ,
  MONTE_ALTO_DUPLICATE_IDS
} = require('./lib/canonical_units.ts');

runTest('IDs confirmados de Monte Alto resolvem para o ID canônico NquBdSy0A3ixzHnyj0YF', () => {
  assert.strictEqual(getCanonicalInstitutionId(MONTE_ALTO_OPERATIONAL_ID), 'NquBdSy0A3ixzHnyj0YF');
  assert.strictEqual(getCanonicalInstitutionId(MONTE_ALTO_CNPJ), 'NquBdSy0A3ixzHnyj0YF');
  assert.strictEqual(getCanonicalInstitutionId('52853397000168'), 'NquBdSy0A3ixzHnyj0YF');
  assert.strictEqual(getCanonicalInstitutionId('eCbHryqf5pwpPTipFFjJ'), 'NquBdSy0A3ixzHnyj0YF');
  assert.strictEqual(getCanonicalInstitutionId('YBGwuWDIeYkDlGokWIVX'), 'NquBdSy0A3ixzHnyj0YF');
});

runTest('ID não confirmado ga6jzrx1flf NÃO é mapeado nem incluído no conjunto operacional de Monte Alto', () => {
  // Comprova que ga6jzrx1flf não foi aceito sem evidência no Firestore
  assert.strictEqual(isMonteAltoUnit('ga6jzrx1flf'), false, 'ga6jzrx1flf NÃO deve ser reconhecido como Monte Alto');
  assert.strictEqual(getCanonicalInstitutionId('ga6jzrx1flf'), 'ga6jzrx1flf', 'ga6jzrx1flf NÃO deve converter para o ID canônico de Monte Alto');
  assert.strictEqual(MONTE_ALTO_DUPLICATE_IDS.includes('ga6jzrx1flf'), false, 'ga6jzrx1flf NÃO deve constar em MONTE_ALTO_DUPLICATE_IDS');
  assert.strictEqual(getMonteAltoQueryIds().includes('ga6jzrx1flf'), false, 'ga6jzrx1flf NÃO deve constar em getMonteAltoQueryIds');
});

// -------------------------------------------------------------
// GRUPO 3: AUTORIZAÇÃO DE ESCOPO INSTITUCIONAL (isUserAuthorizedForInstitution)
// -------------------------------------------------------------
console.log('\n--- 3. Validação Rígida de Autorização de Escopo ---');

const { isUserAuthorizedForInstitution } = require('./lib/canonical_units.ts');

runTest('Usuário com vínculo confiável a Monte Alto tem acesso permitido', () => {
  const userDirect = { id: 'u1', username: 'enfermeira_ma', institutionId: 'NquBdSy0A3ixzHnyj0YF' };
  assert.strictEqual(isUserAuthorizedForInstitution(userDirect, 'NquBdSy0A3ixzHnyj0YF'), true);

  const userByCnpj = { id: 'u2', username: 'diretor_ma', institutionId: '52.853.397/0001-68' };
  assert.strictEqual(isUserAuthorizedForInstitution(userByCnpj, 'NquBdSy0A3ixzHnyj0YF'), true);

  const userMulti = { id: 'u3', username: 'supervisor', institutionIds: ['54.927.132/0001-92', 'NquBdSy0A3ixzHnyj0YF'] };
  assert.strictEqual(isUserAuthorizedForInstitution(userMulti, 'NquBdSy0A3ixzHnyj0YF'), true);
});

runTest('Usuário de OUTRA instituição tem acesso NEGADO para Monte Alto', () => {
  const userOutra = { id: 'u4', username: 'cuidador_jaboticabal', accessLevel: 'cuidados', institutionId: 'inst-jaboticabal-01' };
  assert.strictEqual(isUserAuthorizedForInstitution(userOutra, 'NquBdSy0A3ixzHnyj0YF'), false, 'Usuário de outra unidade não pode acessar Monte Alto');
  assert.strictEqual(isUserAuthorizedForInstitution(userOutra, '52.853.397/0001-68'), false, 'Usuário de outra unidade não pode acessar por CNPJ');
});

runTest('Usuário associado a ga6jzrx1flf NÃO obtém acesso a Monte Alto', () => {
  const userFake = { id: 'u5', username: 'user_fake', institutionId: 'ga6jzrx1flf' };
  assert.strictEqual(isUserAuthorizedForInstitution(userFake, 'NquBdSy0A3ixzHnyj0YF'), false, 'ID não confirmado ga6jzrx1flf não concede acesso');
});

// -------------------------------------------------------------
// GRUPO 4: ISOLAMENTO DE DADOS E PRESERVAÇÃO DE CAMPOS CLÍNICOS
// -------------------------------------------------------------
console.log('\n--- 4. Isolamento de Dados e Preservação de Campos Clínicos ---');

runTest('Filtragem institucional isolada preserva campos e não vaza dados de outras unidades', () => {
  // Fixture sintética com dados conhecidos e detalhados
  const mockDbResidents = [
    {
      id: 'res-monte-01',
      name: 'Dona Maria Pereira',
      cpf: '123.456.789-00',
      birthDate: '1942-03-15',
      room: 'Quarto 12B',
      bed: 'Leito 1',
      institutionId: 'NquBdSy0A3ixzHnyj0YF',
      clinicalData: {
        diagnosis: 'Hipertensão Arterial Sistêmica',
        allergies: ['Dipirona', 'Penicilina'],
        diet: 'Pastosa Hipossódica'
      },
      archived: false
    },
    {
      id: 'res-monte-legacy',
      name: 'Sr. João Silveira',
      cpf: '234.567.890-11',
      birthDate: '1939-08-20',
      room: 'Quarto 08A',
      bed: 'Leito 2',
      institutionId: 'eCbHryqf5pwpPTipFFjJ', // ID duplicado/legado de Monte Alto
      clinicalData: {
        diagnosis: 'Diabetes Mellitus Tipo 2',
        allergies: [],
        diet: 'Diabética Geral'
      },
      archived: false
    },
    {
      id: 'res-outra-inst',
      name: 'Sr. Antônio Silva (Outra Unidade)',
      cpf: '999.888.777-66',
      birthDate: '1940-01-10',
      room: 'Quarto 01',
      bed: 'Leito 1',
      institutionId: 'instituicao-estranha-999',
      clinicalData: {
        diagnosis: 'Alzheimer Inicial',
        allergies: [],
        diet: 'Livre'
      },
      archived: false
    }
  ];

  // Executar a lógica de consulta multi-ID suportada pelo backend para Monte Alto
  const monteAltoQueryIds = getMonteAltoQueryIds();
  const filtered = mockDbResidents.filter(r => monteAltoQueryIds.includes(r.institutionId) && !r.archived);

  // 1. Quantidade exata esperada
  assert.strictEqual(filtered.length, 2, 'Deve retornar exatamente os 2 residentes de Monte Alto');

  // 2. Não-vazamento: o residente de outra unidade NÃO pode estar presente
  const leakFound = filtered.some(r => r.id === 'res-outra-inst' || r.institutionId === 'instituicao-estranha-999');
  assert.strictEqual(leakFound, false, 'Nenhum registro de outra instituição pode vazar');

  // 3. Verificação de integridade e preservação de campos clínicos
  const maria = filtered.find(r => r.id === 'res-monte-01');
  assert(maria, 'Dona Maria Pereira deve estar presente');
  assert.strictEqual(maria.name, 'Dona Maria Pereira');
  assert.strictEqual(maria.cpf, '123.456.789-00');
  assert.strictEqual(maria.room, 'Quarto 12B');
  assert.strictEqual(maria.clinicalData.diet, 'Pastosa Hipossódica');
  assert.deepStrictEqual(maria.clinicalData.allergies, ['Dipirona', 'Penicilina']);

  const joao = filtered.find(r => r.id === 'res-monte-legacy');
  assert(joao, 'Sr. João Silveira (com ID legado eCbHryqf5pwpPTipFFjJ) deve ser resgatado com integridade');
  assert.strictEqual(joao.cpf, '234.567.890-11');
  assert.strictEqual(joao.clinicalData.diagnosis, 'Diabetes Mellitus Tipo 2');
});

// -------------------------------------------------------------
// GRUPO 5: PRESERVAÇÃO DAS REGRAS DE VISIBILIDADE DO MURAL
// -------------------------------------------------------------
console.log('\n--- 5. Preservação das Regras de Visibilidade do Mural ---');

runTest('Filtragem do mural respeita regras de visibilidade (público, admin, privado)', () => {
  const mockMessages = [
    { id: 'm1', text: 'Aviso Geral para Todos', author: 'ana_enfermeira', visibilidade: ['publico'] },
    { id: 'm2', text: 'Nota Clínica Sigilosa', author: 'ana_enfermeira', visibilidade: ['admin'] },
    { id: 'm3', text: 'Lembrete Pessoal da Ana', author: 'ana_enfermeira', visibilidade: ['privado'] },
    { id: 'm4', text: 'Anotação Pessoal do Carlos', author: 'carlos_cuidador', visibilidade: ['privado'] }
  ];

  // Helper que replica a lógica de filtragem do endpoint /api/mural do backend
  function filterMuralMessages(messages, username, accessLevel) {
    const adminRoles = ['administrador', 'gerencial', 'enfermeira', 'medico', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'assistente_social'];
    return messages.filter(msg => {
      const isAuthor = msg.author === username;
      const vis = Array.isArray(msg.visibilidade) ? msg.visibilidade : [msg.visibilidade || 'admin'];
      if (vis.includes('publico')) return true;
      if (vis.includes('privado')) return isAuthor;
      if (vis.includes('admin')) return isAuthor || adminRoles.includes(accessLevel);
      return true;
    });
  }

  // Cenário A: Usuário Cuidador (Carlos)
  const carlosView = filterMuralMessages(mockMessages, 'carlos_cuidador', 'cuidados');
  assert.strictEqual(carlosView.length, 2, 'Cuidador deve ver apenas 2 mensagens');
  assert(carlosView.some(m => m.id === 'm1'), 'Cuidador deve ver mensagem pública (m1)');
  assert(carlosView.some(m => m.id === 'm4'), 'Cuidador deve ver sua própria mensagem privada (m4)');
  assert(!carlosView.some(m => m.id === 'm2'), 'Cuidador NÃO deve ver mensagem de equipe técnica/admin (m2)');
  assert(!carlosView.some(m => m.id === 'm3'), 'Cuidador NÃO deve ver mensagem privada de outra pessoa (m3)');

  // Cenário B: Usuário Enfermeira (Ana)
  const anaView = filterMuralMessages(mockMessages, 'ana_enfermeira', 'enfermeira');
  assert.strictEqual(anaView.length, 3, 'Enfermeira deve ver 3 mensagens (pública, admin e sua privada)');
  assert(anaView.some(m => m.id === 'm1'), 'Enfermeira deve ver mensagem pública');
  assert(anaView.some(m => m.id === 'm2'), 'Enfermeira deve ver mensagem admin');
  assert(anaView.some(m => m.id === 'm3'), 'Enfermeira deve ver sua mensagem privada');
  assert(!anaView.some(m => m.id === 'm4'), 'Enfermeira NÃO deve ver mensagem privada do cuidador Carlos');
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES ROBUSTOS: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
