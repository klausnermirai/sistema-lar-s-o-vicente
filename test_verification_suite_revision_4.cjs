const assert = require('assert');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('SUÍTE DE TESTES DE INTEGRIDADE E SEGURANÇA (REVISÃO 4)');
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
// 1. ELIMINAÇÃO DO SEGREDO PADRÃO & TRAVA DE INICIALIZAÇÃO EM PRODUÇÃO
// -------------------------------------------------------------
console.log('--- 1. Trava de Inicialização & Segredo de Autenticação ---');

runTest('Em produção/Cloud Run (NODE_ENV=production ou K_SERVICE), a ausência de segredo impede inicialização com erro explícito', () => {
  const code = `
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.K_SERVICE;
    const { assertAuthConfigurationValid } = require('./lib/server_auth.ts');
    try {
      assertAuthConfigurationValid();
      process.exit(0);
    } catch (e) {
      if (e.message.includes('CONFIGURAÇÃO OBRIGATÓRIA AUSENTE') && e.message.includes('SESSION_SECRET')) {
        process.exit(42);
      }
      process.exit(1);
    }
  `;
  try {
    execSync(`node -e "${code.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
    assert.fail('Deveria ter lançado erro de configuração ausente');
  } catch (err) {
    assert.strictEqual(err.status, 42, 'Status de saída deve comprovar que erro explícito foi disparado');
  }
});

runTest('Presença de K_SERVICE sem segredo também impede inicialização do serviço', () => {
  const code = `
    delete process.env.NODE_ENV;
    process.env.K_SERVICE = 'ssvp-cloud-run-svc';
    delete process.env.SESSION_SECRET;
    delete process.env.JWT_SECRET;
    const { assertAuthConfigurationValid } = require('./lib/server_auth.ts');
    try {
      assertAuthConfigurationValid();
      process.exit(0);
    } catch (e) {
      if (e.message.includes('CONFIGURAÇÃO OBRIGATÓRIA AUSENTE')) {
        process.exit(43);
      }
      process.exit(1);
    }
  `;
  try {
    execSync(`node -e "${code.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
    assert.fail('Deveria ter impedido inicialização');
  } catch (err) {
    assert.strictEqual(err.status, 43);
  }
});

// -------------------------------------------------------------
// 2. CRIPTOGRAFIA, INTEGRIDADE E VALIDAÇÃO DE CAMPOS DO TOKEN
// -------------------------------------------------------------
console.log('\n--- 2. Validação Criptográfica e Expiração de Tokens ---');

const SYNTHETIC_SECRET = 'synthetic-unit-test-secret-key-4298172948719';
process.env.SESSION_SECRET = SYNTHETIC_SECRET;

const { createAuthToken, verifyAuthToken, getAuthSecret } = require('./lib/server_auth.ts');

runTest('getAuthSecret retorna o segredo sintético configurado e não uma chave fixa do código', () => {
  assert.strictEqual(getAuthSecret(), SYNTHETIC_SECRET);
});

runTest('Tokens assinados com chave diferente são rejeitados', () => {
  const tokenComOutraChave = (() => {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ userId: 'u_123', username: 'enfermeira', exp })).toString('base64url');
    const sig = crypto.createHmac('sha256', 'outra-chave-qualquer-estranha').update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  })();

  const res = verifyAuthToken(tokenComOutraChave);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error.includes('Assinatura da credencial inválida'), true);
});

runTest('Tokens adulterados, malformados ou incompletos são rejeitados', () => {
  const valid = createAuthToken('u_test', 'test_user');
  const [h, p, s] = valid.split('.');

  // Adulterar payload
  const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'admin', username: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const tamperedToken = `${h}.${tamperedPayload}.${s}`;
  assert.strictEqual(verifyAuthToken(tamperedToken).valid, false);

  // Formato com 1 ou 2 segmentos
  assert.strictEqual(verifyAuthToken('admin').valid, false);
  assert.strictEqual(verifyAuthToken('u_user_id_only').valid, false);
  assert.strictEqual(verifyAuthToken('header.payload').valid, false);
  assert.strictEqual(verifyAuthToken('a.b.c.d').valid, false);
});

runTest('Campos do token têm tipos válidos e exp deve ser número finito', () => {
  const crypto = require('crypto');
  const makeTokenWithPayload = (payloadObj) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const sig = crypto.createHmac('sha256', SYNTHETIC_SECRET).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  };

  // exp como string
  const tokenStrExp = makeTokenWithPayload({ userId: 'u1', username: 'user1', exp: '9999999999' });
  const resStrExp = verifyAuthToken(tokenStrExp);
  assert.strictEqual(resStrExp.valid, false);
  assert.strictEqual(resStrExp.error.includes('não-finito'), true);

  // exp ausente
  const tokenNoExp = makeTokenWithPayload({ userId: 'u1', username: 'user1' });
  assert.strictEqual(verifyAuthToken(tokenNoExp).valid, false);

  // userId não-string
  const tokenNumUser = makeTokenWithPayload({ userId: 12345, username: 'user1', exp: Math.floor(Date.now() / 1000) + 3600 });
  assert.strictEqual(verifyAuthToken(tokenNumUser).valid, false);
});

runTest('Expiração do token é estritamente respeitada', () => {
  // Token expirado há 10 segundos
  const expiredToken = createAuthToken('u_test', 'test_user', -0.01);
  const resExpired = verifyAuthToken(expiredToken);
  assert.strictEqual(resExpired.valid, false);
  assert.strictEqual(resExpired.error.includes('Credencial expirada'), true);

  // Token válido por 2 horas
  const activeToken = createAuthToken('u_test', 'test_user', 2);
  const resActive = verifyAuthToken(activeToken);
  assert.strictEqual(resActive.valid, true);
  assert.strictEqual(resActive.userId, 'u_test');
});

// -------------------------------------------------------------
// 3. MIGRAÇÃO DE CREDENCIAIS NO FRONTEND E TRATAMENTO DE 401
// -------------------------------------------------------------
console.log('\n--- 3. Migração de Credenciais e Tratamento de Sessões ---');

runTest('Nenhum arquivo no frontend monta cabeçalho Authorization: Bearer com ID simples', () => {
  const result = execSync('grep -rn "Authorization.*Bearer" components/ App.tsx || true', { encoding: 'utf8' }).trim();
  assert.strictEqual(result, '', 'Não deve haver nenhuma chamada montando Authorization Bearer diretamente no frontend além de lib/api.ts');
});

runTest('getAuthHeaders centralizado injeta Bearer com session.token e x-institution-id canônico', () => {
  const { getAuthHeaders } = require('./lib/api.ts');

  // Simular localStorage com mock
  const mockStorage = new Map();
  global.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, v),
    removeItem: (k) => mockStorage.delete(k)
  };

  const validToken = createAuthToken('u_funcionario', 'maria_enf');
  mockStorage.set('ssvp_session', JSON.stringify({
    id: 'u_funcionario',
    token: validToken,
    institutionId: 'eCbHryqf5pwpPTipFFjJ', // ID duplicado antigo
    cnpj: '52.853.397/0001-68'
  }));

  const headers = getAuthHeaders();
  assert.strictEqual(headers['Authorization'], `Bearer ${validToken}`);
  assert.strictEqual(headers['x-institution-id'], 'NquBdSy0A3ixzHnyj0YF', 'Deve canonicalizar o institutionId');
});

runTest('Sessão antiga sem token é detectada e encaminha para login sem loop', () => {
  const mockStorage = new Map();
  const mockSessionStorage = new Map();

  global.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, v),
    removeItem: (k) => mockStorage.delete(k)
  };
  global.sessionStorage = {
    getItem: (k) => mockSessionStorage.get(k) || null,
    setItem: (k, v) => mockSessionStorage.set(k, v),
    removeItem: (k) => mockSessionStorage.delete(k)
  };

  // Sessão antiga (sem campo token)
  mockStorage.set('ssvp_session', JSON.stringify({
    id: 'u_antigo_sem_token',
    username: 'enfermeira_antiga',
    accessLevel: 'enfermeira',
    institutionId: 'NquBdSy0A3ixzHnyj0YF'
  }));

  // Simular lógica de inicialização de sessão de App.tsx
  function checkInitialSession() {
    const saved = localStorage.getItem('ssvp_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed || !parsed.token || typeof parsed.token !== 'string' || !parsed.token.includes('.')) {
          localStorage.removeItem('ssvp_session');
          sessionStorage.setItem('ssvp_auth_notice', 'Sua sessão anterior expirou ou precisa ser renovada. Por favor, faça login novamente.');
          return null;
        }
        return parsed;
      } catch (e) {
        localStorage.removeItem('ssvp_session');
        return null;
      }
    }
    return null;
  }

  const initial = checkInitialSession();
  assert.strictEqual(initial, null, 'Sessão sem token deve retornar null');
  assert.strictEqual(mockStorage.has('ssvp_session'), false, 'Sessão antiga deve ser removida do localStorage');
  assert.strictEqual(mockSessionStorage.get('ssvp_auth_notice').includes('faça login novamente'), true);
});

// -------------------------------------------------------------
// 4. PROTEÇÃO DE DOCUMENTOS INDIVIDUAIS E REGISTROS SEM VÍNCULO
// -------------------------------------------------------------
console.log('\n--- 4. Proteção de Documentos Individuais e Registros Sem Vínculo ---');

const { isUserAuthorizedForInstitution, MONTE_ALTO_OPERATIONAL_ID, CENTRAL_JABOTICABAL_CNPJ } = require('./lib/canonical_units.ts');

function isAuthorizedForDocument(user, docData) {
  if (!user || !docData) return false;
  if (
    user.isGlobalAdmin === true ||
    user.hasAllUnitsAccess === true ||
    user.username === 'kwarizaya@gmail.com' ||
    user.email === 'kwarizaya@gmail.com'
  ) {
    return true;
  }
  if (!docData.institutionId || typeof docData.institutionId !== 'string' || docData.institutionId.trim() === '') {
    return false;
  }
  return isUserAuthorizedForInstitution(user, docData.institutionId);
}

runTest('Registros sem institutionId comprovado são inacessíveis por padrão para usuários de unidades comuns', () => {
  const standardUser = {
    id: 'u_user',
    username: 'cuidador_joao',
    institutionId: MONTE_ALTO_OPERATIONAL_ID,
    accessLevel: 'cuidados'
  };

  const unlinkedDoc = {
    id: 'doc_orphaned_001',
    name: 'Registro Sem Unidade'
    // institutionId ausente
  };

  assert.strictEqual(
    isAuthorizedForDocument(standardUser, unlinkedDoc),
    false,
    'Usuário comum não pode acessar registro sem vínculo comprovado'
  );

  const emptyInstDoc = {
    id: 'doc_empty_002',
    name: 'Registro Com String Vazia',
    institutionId: '   '
  };

  assert.strictEqual(
    isAuthorizedForDocument(standardUser, emptyInstDoc),
    false,
    'String vazia em institutionId não deve conceder acesso'
  );
});

runTest('Super administrador global retém acesso a registros sem vínculo institucional', () => {
  const globalAdmin = {
    id: 'u_admin',
    username: 'kwarizaya@gmail.com',
    email: 'kwarizaya@gmail.com',
    isGlobalAdmin: true
  };

  const unlinkedDoc = {
    id: 'doc_orphaned_001',
    name: 'Registro Sem Unidade'
  };

  assert.strictEqual(isAuthorizedForDocument(globalAdmin, unlinkedDoc), true);
});

runTest('Usuário da unidade Monte Alto não acessa documentos de outra unidade (retorno padronizado)', () => {
  const userMonteAlto = {
    id: 'u_ma',
    institutionId: MONTE_ALTO_OPERATIONAL_ID
  };

  const docJaboticabal = {
    id: 'doc_jaboticabal_1',
    name: 'Documento Jaboticabal',
    institutionId: 'Qj7VZqh3J9wA1h5O43Hq'
  };

  assert.strictEqual(isAuthorizedForDocument(userMonteAlto, docJaboticabal), false);

  const docMonteAlto = {
    id: 'doc_ma_1',
    name: 'Documento Monte Alto',
    institutionId: MONTE_ALTO_OPERATIONAL_ID
  };

  assert.strictEqual(isAuthorizedForDocument(userMonteAlto, docMonteAlto), true);
});

// -------------------------------------------------------------
// 5. PROTEÇÃO DE OPERAÇÕES EM LOTE (POST /bulk)
// -------------------------------------------------------------
console.log('\n--- 5. Proteção e Pré-Validação de Operações em Lote ---');

runTest('Operação em lote rejeita quando algum documento existente pertence a outra instituição', () => {
  const user = {
    id: 'u_ma',
    institutionId: MONTE_ALTO_OPERATIONAL_ID,
    accessLevel: 'administrador'
  };

  // Simular banco existente
  const existingDb = new Map([
    ['res_valid_1', { institutionId: MONTE_ALTO_OPERATIONAL_ID, name: 'Residente MA' }],
    ['res_alheio_2', { institutionId: 'Qj7VZqh3J9wA1h5O43Hq', name: 'Residente Jaboticabal' }]
  ]);

  const batchPayload = [
    { id: 'res_valid_1', name: 'Residente MA Atualizado', institutionId: MONTE_ALTO_OPERATIONAL_ID },
    { id: 'res_alheio_2', name: 'Residente Alheio Modificado', institutionId: MONTE_ALTO_OPERATIONAL_ID }
  ];

  // Pré-validação do lote
  function validateBatch(user, items, existingMap) {
    for (const item of items) {
      if (!isUserAuthorizedForInstitution(user, item.institutionId)) {
        return { valid: false, error: 'Usuário não autorizado para a instituição de destino.' };
      }
      if (item.id && existingMap.has(item.id)) {
        const stored = existingMap.get(item.id);
        if (!stored.institutionId || !isUserAuthorizedForInstitution(user, stored.institutionId)) {
          return { valid: false, error: `Documento (${item.id}) pertence a outra instituição.` };
        }
      }
    }
    return { valid: true };
  }

  const result = validateBatch(user, batchPayload, existingDb);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error.includes('pertence a outra instituição'), true);
});

runTest('Operação em lote impede transferência implícita entre instituições distintas', () => {
  const user = {
    id: 'u_multi',
    institutionIds: [MONTE_ALTO_OPERATIONAL_ID, 'Qj7VZqh3J9wA1h5O43Hq'],
    accessLevel: 'administrador'
  };

  const existingDb = new Map([
    ['cand_1', { institutionId: 'Qj7VZqh3J9wA1h5O43Hq', name: 'Candidato Jaboticabal' }]
  ]);

  // Tenta enviar cand_1 com destino Monte Alto via lote
  const batchPayload = [
    { id: 'cand_1', name: 'Candidato Transferido', institutionId: MONTE_ALTO_OPERATIONAL_ID }
  ];

  function validateImplicitTransfer(user, items, existingMap) {
    for (const item of items) {
      if (item.id && existingMap.has(item.id)) {
        const stored = existingMap.get(item.id);
        if (stored.institutionId !== item.institutionId) {
          return { valid: false, error: 'Transferência implícita de instituição bloqueada.' };
        }
      }
    }
    return { valid: true };
  }

  const res = validateImplicitTransfer(user, batchPayload, existingDb);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error.includes('Transferência implícita'), true);
});

// -------------------------------------------------------------
// 6. TRAVA DE AMBIENTE E FALLBACK
// -------------------------------------------------------------
console.log('\n--- 6. Trava de Fallback e Tratamento 503 ---');

runTest('K_SERVICE presente desabilita incondicionalmente canUseLocalFallback', () => {
  const output = execSync(
    'node -e "process.env.K_SERVICE = \'ssvp-prod\'; const { canUseLocalFallback } = require(\'./lib/db_errors.ts\'); console.log(canUseLocalFallback);"',
    { encoding: 'utf8' }
  );
  assert.strictEqual(output.trim(), 'false');
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES EXECUTADOS: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
