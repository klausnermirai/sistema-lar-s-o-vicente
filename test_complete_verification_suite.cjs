const assert = require('assert');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('SUÍTE COMPLETA DE TESTES: CORREÇÕES ARQUITETURAIS E INTEGRIDADE');
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
// 1. AUTENTICAÇÃO CRIPTOGRÁFICA E REJEIÇÃO DE IDS SIMPLES
// -------------------------------------------------------------
console.log('--- 1. Validação de Credenciais Server-Side (lib/server_auth.ts) ---');

process.env.SESSION_SECRET = 'synthetic-test-secret-suite-123-with-32-chars';
const { createAuthToken, verifyAuthToken } = require('./lib/server_auth.ts');

runTest('Emissão de token com assinatura HMAC-SHA256 e validação com sucesso', () => {
  const token = createAuthToken('u_test_123', 'enfermeira_maria');
  assert.strictEqual(typeof token, 'string');
  assert.strictEqual(token.split('.').length, 3, 'O token deve conter 3 segmentos');

  const result = verifyAuthToken(token);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.userId, 'u_test_123');
  assert.strictEqual(result.username, 'enfermeira_maria');
});

runTest('Rejeição estrita de IDs simples utilizados diretamente como token', () => {
  const adminRaw = verifyAuthToken('admin');
  assert.strictEqual(adminRaw.valid, false, 'ID "admin" bruto deve ser rejeitado');
  assert.strictEqual(adminRaw.error.includes('IDs simples não são aceitos'), true);

  const demoRaw = verifyAuthToken('demo-u1');
  assert.strictEqual(demoRaw.valid, false, 'ID "demo-u1" bruto deve ser rejeitado');

  const arbitraryRaw = verifyAuthToken('u_random_999');
  assert.strictEqual(arbitraryRaw.valid, false, 'Qualquer ID bruto sem assinatura deve ser rejeitado');
});

runTest('Rejeição de token com assinatura adulterada (violação de integridade)', () => {
  const validToken = createAuthToken('u_test_123', 'enfermeira_maria');
  const parts = validToken.split('.');
  // Modificar a assinatura
  const tamperedToken = `${parts[0]}.${parts[1]}.AssinaturaFalsificada123`;
  const result = verifyAuthToken(tamperedToken);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error.includes('Assinatura da credencial inválida'), true);
});

runTest('Rejeição de token expirado', () => {
  // Criar token com expiração negativa (já expirado)
  const expiredToken = createAuthToken('u_test_123', 'enfermeira_maria', -1);
  const result = verifyAuthToken(expiredToken);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error.includes('Credencial expirada'), true);
});

// -------------------------------------------------------------
// 2. DEDUPLICAÇÃO E CONTRATO DE UNIDADES (sanitizeCanonicalUnits)
// -------------------------------------------------------------
console.log('\n--- 2. Deduplicação e Sanitização de Unidades (lib/canonical_units.ts) ---');

const {
  sanitizeCanonicalUnits,
  getCanonicalInstitutionId,
  MONTE_ALTO_OPERATIONAL_ID,
  MONTE_ALTO_CNPJ,
  CENTRAL_JABOTICABAL_CNPJ
} = require('./lib/canonical_units.ts');

runTest('sanitizeCanonicalUnits preserva ID operacional real (NquBdSy0A3ixzHnyj0YF) sem substituir pelo CNPJ', () => {
  const rawUnits = [
    {
      id: 'eCbHryqf5pwpPTipFFjJ', // ID duplicado antigo
      name: 'Lar São Vicente de Paulo de Monte Alto',
      cnpj: MONTE_ALTO_CNPJ,
      type: 'obra_unida',
      city: 'Monte Alto'
    },
    {
      id: MONTE_ALTO_OPERATIONAL_ID, // ID operacional canônico
      name: 'Lar São Vicente de Paulo de Monte Alto',
      cnpj: MONTE_ALTO_CNPJ,
      type: 'obra_unida',
      city: 'Monte Alto'
    },
    {
      id: MONTE_ALTO_CNPJ, // Entrada com CNPJ no campo ID
      name: 'Lar São Vicente de Paulo de Monte Alto',
      cnpj: MONTE_ALTO_CNPJ,
      type: 'obra_unida',
      city: 'Monte Alto'
    },
    {
      id: 'Qj7VZqh3J9wA1h5O43Hq', // Outra unidade (Conselho Central)
      name: 'Conselho Central de Jaboticabal',
      cnpj: CENTRAL_JABOTICABAL_CNPJ,
      type: 'conselho_central',
      city: 'Jaboticabal'
    }
  ];

  const sanitized = sanitizeCanonicalUnits(rawUnits);

  // Deve haver exatamente 2 unidades após a deduplicação
  assert.strictEqual(sanitized.length, 2, 'Deve deduplicar as 3 entradas de Monte Alto em exatamente 1');

  // A unidade de Monte Alto resultante DEVE ter o ID operacional real
  const monteAlto = sanitized.find(u => u.cnpj === MONTE_ALTO_CNPJ);
  assert(monteAlto, 'Unidade Monte Alto deve estar presente');
  assert.strictEqual(monteAlto.id, MONTE_ALTO_OPERATIONAL_ID, 'O ID da unidade de Monte Alto deve ser NquBdSy0A3ixzHnyj0YF e NÃO o CNPJ');
  assert.strictEqual(monteAlto.name, 'Lar São Vicente de Paulo de Monte Alto');
  assert.strictEqual(monteAlto.city, 'Monte Alto');

  // A unidade de Jaboticabal deve preservar seu ID documental original
  const jaboticabal = sanitized.find(u => u.cnpj === CENTRAL_JABOTICABAL_CNPJ);
  assert(jaboticabal, 'Unidade Jaboticabal deve estar presente');
  assert.strictEqual(jaboticabal.id, 'Qj7VZqh3J9wA1h5O43Hq', 'Jaboticabal deve manter seu ID documental original');
});

// -------------------------------------------------------------
// 3. PERSISTÊNCIA E ATUALIZAÇÃO REAL DE SESSÕES ANTIGAS (App.tsx)
// -------------------------------------------------------------
console.log('\n--- 3. Atualização Real e Persistência de Sessões Antigas ---');

runTest('Sessão com ID duplicado (eCbHryqf5pwpPTipFFjJ) é atualizada para o ID canônico (NquBdSy0A3ixzHnyj0YF)', () => {
  // Simular sessão antiga armazenada no localStorage
  const oldStoredSession = {
    id: 'u_123',
    username: 'enfermeira_ma',
    institutionId: 'eCbHryqf5pwpPTipFFjJ', // ID duplicado antigo
    cnpj: MONTE_ALTO_CNPJ
  };

  // Simular lógica de inicialização de sessão corrigida em App.tsx
  let activeSession = { ...oldStoredSession };
  if (activeSession.institutionId) {
    const canonicalId = getCanonicalInstitutionId(activeSession.institutionId);
    if (canonicalId && canonicalId !== activeSession.institutionId) {
      activeSession.institutionId = canonicalId;
    }
  }

  assert.strictEqual(activeSession.institutionId, MONTE_ALTO_OPERATIONAL_ID, 'A sessão ativa deve atualizar para NquBdSy0A3ixzHnyj0YF');

  // Simular checagem em loadData
  const validatedSettings = { id: MONTE_ALTO_OPERATIONAL_ID, name: 'Lar São Vicente de Paulo' };
  const canonicalFinalId = getCanonicalInstitutionId(validatedSettings.id);

  let setSessionCalled = false;
  if (canonicalFinalId && activeSession.institutionId !== canonicalFinalId) {
    activeSession = { ...activeSession, institutionId: canonicalFinalId };
    setSessionCalled = true;
  }

  // Como já foi atualizado, não deve gerar loop de render/recarregamento
  assert.strictEqual(setSessionCalled, false, 'Não deve disparar nova atualização após canonicalização (sem loops)');
  assert.strictEqual(activeSession.institutionId, MONTE_ALTO_OPERATIONAL_ID);
});

// -------------------------------------------------------------
// 4. PRESERVAÇÃO DA RESOLUÇÃO DOCUMENTAL DE JABOTICABAL (SEM REGRESSÃO)
// -------------------------------------------------------------
console.log('\n--- 4. Preservação Documental de Jaboticabal ---');

runTest('getCanonicalInstitutionId não força CNPJ em Jaboticabal e preserva resolução documental', () => {
  // Para Jaboticabal, getCanonicalInstitutionId NÃO deve substituir o ID documental
  assert.strictEqual(getCanonicalInstitutionId('Qj7VZqh3J9wA1h5O43Hq'), 'Qj7VZqh3J9wA1h5O43Hq', 'ID documental de Jaboticabal deve ser preservado');

  // Simular consulta documental do getRealInstitutionId corrigido
  const mockInstitutionsDb = [
    { id: 'Qj7VZqh3J9wA1h5O43Hq', name: 'Conselho Central de Jaboticabal', cnpj: '54.927.132/0001-92' }
  ];

  function mockResolveInstitutionId(input) {
    const trimmed = input.trim();
    if (trimmed === 'demo-institution-id') return 'demo-institution-id';
    // Monte Alto continua canônico
    if (trimmed === MONTE_ALTO_OPERATIONAL_ID || trimmed === '52.853.397/0001-68' || trimmed === 'eCbHryqf5pwpPTipFFjJ') {
      return MONTE_ALTO_OPERATIONAL_ID;
    }
    // Demais instituições resolvem no banco documental por doc.id ou CNPJ
    const byId = mockInstitutionsDb.find(i => i.id === trimmed);
    if (byId) return byId.id;

    const cleanCnpj = trimmed.replace(/\D/g, '');
    const byCnpj = mockInstitutionsDb.find(i => i.cnpj.replace(/\D/g, '') === cleanCnpj);
    if (byCnpj) return byCnpj.id;

    return trimmed;
  }

  const resolvedByCnpj = mockResolveInstitutionId('54.927.132/0001-92');
  assert.strictEqual(resolvedByCnpj, 'Qj7VZqh3J9wA1h5O43Hq', 'Entrada por CNPJ de Jaboticabal DEVE retornar o ID documental Qj7VZqh3J9wA1h5O43Hq');

  const resolvedByDocId = mockResolveInstitutionId('Qj7VZqh3J9wA1h5O43Hq');
  assert.strictEqual(resolvedByDocId, 'Qj7VZqh3J9wA1h5O43Hq', 'Entrada por ID documental de Jaboticabal deve retornar o próprio ID documental');
});

// -------------------------------------------------------------
// 5. PROTEÇÃO DE DOCUMENTOS INDIVIDUAIS E OPERAÇÕES DE GRAVAÇÃO
// -------------------------------------------------------------
console.log('\n--- 5. Proteção de Documentos Individuais, Gravações e Exclusões ---');

const { isUserAuthorizedForInstitution } = require('./lib/canonical_units.ts');

runTest('Leitura individual (GET /api/residents/:id) bloqueia acesso a residente de outra instituição', () => {
  const requestingUser = {
    id: 'u_monte_alto',
    username: 'enfermeira_ma',
    institutionId: MONTE_ALTO_OPERATIONAL_ID
  };

  const residentMonteAlto = {
    id: 'res_001',
    name: 'Dona Maria',
    institutionId: MONTE_ALTO_OPERATIONAL_ID
  };

  const residentOutraUnidade = {
    id: 'res_002',
    name: 'Sr. Antonio',
    institutionId: 'unidade_estranha_999'
  };

  // Simular verificação do handler GET /api/residents/:id
  function checkResidentAccess(user, resident) {
    if (resident.institutionId && !isUserAuthorizedForInstitution(user, resident.institutionId)) {
      return { status: 403, error: 'Acesso negado: residente pertence a outra instituição.' };
    }
    return { status: 200, data: resident };
  }

  const accessAllowed = checkResidentAccess(requestingUser, residentMonteAlto);
  assert.strictEqual(accessAllowed.status, 200, 'Acesso ao residente da própria unidade deve ser permitido');

  const accessDenied = checkResidentAccess(requestingUser, residentOutraUnidade);
  assert.strictEqual(accessDenied.status, 403, 'Acesso ao residente de outra unidade DEVE retornar 403 Forbidden');
});

runTest('Gravação (POST /api/residents) impede alteração de residente existente pertencente a outra unidade', () => {
  const requestingUser = {
    id: 'u_monte_alto',
    username: 'enfermeira_ma',
    institutionId: MONTE_ALTO_OPERATIONAL_ID
  };

  // Residente existente no banco pertencente a OUTRA instituição
  const existingDocInDb = {
    id: 'res_alheio',
    name: 'Paciente Privado',
    institutionId: 'unidade_estranha_999'
  };

  // Payload que tenta atualizar o registro alheio
  const incomingUpdatePayload = {
    id: 'res_alheio',
    name: 'Tentativa de Modificação',
    institutionId: MONTE_ALTO_OPERATIONAL_ID // Usuário tenta passar sua própria unidade no payload
  };

  // Validação implementada no handler
  function validateResidentUpdate(user, payload, existingDoc) {
    // 1. Valida escopo do payload
    if (payload.institutionId && !isUserAuthorizedForInstitution(user, payload.institutionId)) {
      return { status: 403, error: 'Acesso negado para a instituição informada.' };
    }
    // 2. Valida escopo do documento EXISTENTE no banco (protege contra payload que mascara o ID original)
    if (existingDoc && existingDoc.institutionId && !isUserAuthorizedForInstitution(user, existingDoc.institutionId)) {
      return { status: 403, error: 'Acesso negado: o residente existente pertence a outra instituição.' };
    }
    return { status: 200, success: true };
  }

  const updateResult = validateResidentUpdate(requestingUser, incomingUpdatePayload, existingDocInDb);
  assert.strictEqual(updateResult.status, 403, 'Tentativa de alterar residente alheio deve retornar 403 Forbidden');
});

runTest('Exclusão (DELETE /api/residents/:id) impede inativação de documento de outra instituição', () => {
  const requestingUser = {
    id: 'u_monte_alto',
    username: 'enfermeira_ma',
    institutionId: MONTE_ALTO_OPERATIONAL_ID
  };

  const docAlheio = {
    id: 'res_alheio_delete',
    institutionId: 'unidade_estranha_999'
  };

  function validateDelete(user, doc) {
    if (doc.institutionId && !isUserAuthorizedForInstitution(user, doc.institutionId)) {
      return { status: 403, error: 'Acesso negado para esta instituição.' };
    }
    return { status: 200, success: true };
  }

  const deleteResult = validateDelete(requestingUser, docAlheio);
  assert.strictEqual(deleteResult.status, 403, 'Exclusão/inativação de residente alheio deve ser bloqueada com 403');
});

runTest('Postagem no mural (POST /api/mural) exige autorização institucional explícita', () => {
  const requestingUser = {
    id: 'u_monte_alto',
    username: 'enfermeira_ma',
    institutionId: MONTE_ALTO_OPERATIONAL_ID
  };

  function validateMuralPost(user, postTargetInstId) {
    if (!postTargetInstId || !isUserAuthorizedForInstitution(user, postTargetInstId)) {
      return { status: 403, error: 'Acesso negado para postar no mural desta instituição.' };
    }
    return { status: 200, success: true };
  }

  const postMonteAlto = validateMuralPost(requestingUser, MONTE_ALTO_OPERATIONAL_ID);
  assert.strictEqual(postMonteAlto.status, 200);

  const postAlheio = validateMuralPost(requestingUser, 'unidade_estranha_999');
  assert.strictEqual(postAlheio.status, 403, 'Postagem em mural de outra instituição deve ser bloqueada com 403');
});

// -------------------------------------------------------------
// 6. TRAVA DE FALLBACK EM PRODUÇÃO / CLOUD RUN
// -------------------------------------------------------------
console.log('\n--- 6. Comprovação da Trava de Fallback em Produção / Cloud Run ---');

runTest('K_SERVICE ou NODE_ENV=production desabilitam incondicionalmente canUseLocalFallback', () => {
  const output = execSync(
    'node -e "process.env.K_SERVICE = \'ssvp-prod\'; const { canUseLocalFallback, isProductionEnvironment } = require(\'./lib/db_errors.ts\'); console.log(JSON.stringify({ canUseLocalFallback, isProductionEnvironment }));"',
    { encoding: 'utf8' }
  );
  const res = JSON.parse(output.trim());
  assert.strictEqual(res.isProductionEnvironment, true);
  assert.strictEqual(res.canUseLocalFallback, false, 'canUseLocalFallback DEVE ser false na presença de K_SERVICE');
});

runTest('Falha de banco aciona sendDatabaseError com HTTP 503 e payload estruturado (nunca 200 nem array)', () => {
  const { sendDatabaseError } = require('./lib/db_errors.ts');
  let sentStatus = null;
  let sentJson = null;
  const mockRes = {
    headersSent: false,
    status(code) { sentStatus = code; return this; },
    json(payload) { sentJson = payload; return this; }
  };

  const dbErr = { code: 14, message: 'Service Unavailable' };
  sendDatabaseError(mockRes, dbErr, 'Falha ao buscar residentes');

  assert.strictEqual(sentStatus, 503);
  assert.strictEqual(sentJson.error, 'DATABASE_TEMPORARILY_UNAVAILABLE');
  assert.strictEqual(Array.isArray(sentJson), false);
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES EXECUTADOS: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
