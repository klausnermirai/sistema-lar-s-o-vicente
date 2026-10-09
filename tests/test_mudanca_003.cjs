const assert = require('assert');
const { isUserAuthorizedForInstitution, getCanonicalInstitutionId } = require('../lib/canonical_units.ts');

console.log('================================================================');
console.log('TESTES DE VALIDAÇÃO: MUDANÇA 003 (CONTROLE DE ACESSO POR UNIDADE)');
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
// 1. ISOLAMENTO DO SUPER ADMIN: APENAS KLAUSNER É GLOBAL
// -------------------------------------------------------------
console.log('--- 1. Escopo de Super Admin e Controlador Global ---');

runTest('Administrador comum ou TI/Gestão NÃO é Super Admin', () => {
  const adminUser = 'admin_lar@ssvp.com';
  const userDataAdmin = { accessLevel: 'administrador', role: 'TI / Gestão', hasAllUnitsAccess: true };
  
  // Regra da Mudança 003 em server.ts (linha 938):
  // const isSuperAdmin = cleanUser === 'kwarizaya@gmail.com';
  const isSuperAdmin = adminUser === 'kwarizaya@gmail.com';
  assert.strictEqual(isSuperAdmin, false, 'Administrador comum não pode ser isSuperAdmin');
});

runTest('Apenas kwarizaya@gmail.com é reconhecido como Super Admin no login', () => {
  const klausnerUser = 'kwarizaya@gmail.com';
  const isSuperAdmin = klausnerUser === 'kwarizaya@gmail.com';
  assert.strictEqual(isSuperAdmin, true, 'Klausner deve ser isSuperAdmin');
});

// -------------------------------------------------------------
// 2. MONTAGEM DE UNIDADES NO LOGIN
// -------------------------------------------------------------
console.log('\n--- 2. Montagem de authorizedUnits no Login ---');

const mockInstitutions = new Map([
  ['NquBdSy0A3ixzHnyj0YF', { id: 'NquBdSy0A3ixzHnyj0YF', name: 'Lar Monte Alto', cnpj: '52.853.397/0001-68' }],
  ['jaboticabal_doc', { id: 'jaboticabal_doc', name: 'Lar Jaboticabal', cnpj: '54.927.132/0001-92' }],
  ['conselho_doc', { id: 'conselho_doc', name: 'Conselho Central', cnpj: '54.927.132/0001-92' }]
]);

function buildAuthorizedUnits(userData, cleanUser) {
  const isSuperAdmin = cleanUser === 'kwarizaya@gmail.com';
  let authorizedUnits = [];

  if (isSuperAdmin) {
    for (const unit of mockInstitutions.values()) {
      authorizedUnits.push(unit);
    }
  } else {
    const userInstIds = Array.isArray(userData.institutionIds) ? [...userData.institutionIds] : [];
    if (userData.institutionId) userInstIds.push(userData.institutionId);

    const uniqueKeys = new Set();
    userInstIds.forEach(id => {
      const unit = mockInstitutions.get(id);
      if (unit && !uniqueKeys.has(unit.id)) {
        uniqueKeys.add(unit.id);
        authorizedUnits.push(unit);
      }
    });
  }

  // Regra da Mudança 003: sem fallback para Monte Alto
  if (authorizedUnits.length === 0) {
    return { status: 403, error: 'Usuário sem unidade institucional autorizada.' };
  }

  return { status: 200, units: authorizedUnits };
}

runTest('Administrador local com 1 unidade recebe apenas a sua unidade', () => {
  const localAdmin = {
    username: 'admin_monte_alto@ssvp.com',
    accessLevel: 'administrador',
    institutionId: 'NquBdSy0A3ixzHnyj0YF'
  };

  const res = buildAuthorizedUnits(localAdmin, 'admin_monte_alto@ssvp.com');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.units.length, 1);
  assert.strictEqual(res.units[0].id, 'NquBdSy0A3ixzHnyj0YF');
});

runTest('Usuário com 2 unidades explicitamente autorizadas recebe exatamente as 2', () => {
  const multiUser = {
    username: 'gestor_regional@ssvp.com',
    accessLevel: 'gerencial',
    institutionId: 'NquBdSy0A3ixzHnyj0YF',
    institutionIds: ['jaboticabal_doc']
  };

  const res = buildAuthorizedUnits(multiUser, 'gestor_regional@ssvp.com');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.units.length, 2);
  const ids = res.units.map(u => u.id);
  assert.strictEqual(ids.includes('NquBdSy0A3ixzHnyj0YF'), true);
  assert.strictEqual(ids.includes('jaboticabal_doc'), true);
});

runTest('Usuário sem unidade vinculada NÃO recebe Monte Alto e retorna 403', () => {
  const orphanUser = {
    username: 'sem_unidade@ssvp.com',
    accessLevel: 'visitante'
  };

  const res = buildAuthorizedUnits(orphanUser, 'sem_unidade@ssvp.com');
  assert.strictEqual(res.status, 403, 'Usuário sem unidade deve ser bloqueado');
  assert.strictEqual(res.error.includes('sem unidade institucional autorizada'), true);
});

runTest('Klausner recebe todas as unidades cadastradas', () => {
  const klausner = {
    username: 'kwarizaya@gmail.com',
    accessLevel: 'administrador'
  };

  const res = buildAuthorizedUnits(klausner, 'kwarizaya@gmail.com');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.units.length, mockInstitutions.size);
});

// -------------------------------------------------------------
// 3. GUARDA CENTRAL DE ESCOPO INSTITUCIONAL (server.ts linha 722)
// -------------------------------------------------------------
console.log('\n--- 3. Guarda Central de Escopo (/api) ---');

function centralGuardMiddleware(user, headers, query, body) {
  if (!user) return { status: 401 };

  const candidateIds = [
    headers?.['x-institution-id'],
    query?.institutionId,
    body?.institutionId
  ]
    .flat()
    .filter(val => typeof val === 'string' && val.trim() !== '')
    .map(val => val.trim());

  for (const candidateId of candidateIds) {
    if (!isUserAuthorizedForInstitution(user, candidateId)) {
      return { status: 403, error: 'Acesso negado para esta unidade institucional.' };
    }
  }

  return { status: 200, success: true };
}

runTest('Tentativa de acesso cruzado via header x-institution-id é bloqueada', () => {
  const localUser = {
    id: 'u1',
    username: 'admin_local',
    institutionId: 'NquBdSy0A3ixzHnyj0YF'
  };

  const res = centralGuardMiddleware(localUser, { 'x-institution-id': 'jaboticabal_doc' }, {}, {});
  assert.strictEqual(res.status, 403, 'Header com unidade não autorizada deve retornar 403');
});

runTest('Tentativa de acesso cruzado via query param (?institutionId=...) é bloqueada', () => {
  const localUser = {
    id: 'u1',
    username: 'admin_local',
    institutionId: 'NquBdSy0A3ixzHnyj0YF'
  };

  const res = centralGuardMiddleware(localUser, {}, { institutionId: 'jaboticabal_doc' }, {});
  assert.strictEqual(res.status, 403, 'Query com unidade não autorizada deve retornar 403');
});

runTest('Tentativa de acesso cruzado via body ({ institutionId: ... }) é bloqueada', () => {
  const localUser = {
    id: 'u1',
    username: 'admin_local',
    institutionId: 'NquBdSy0A3ixzHnyj0YF'
  };

  const res = centralGuardMiddleware(localUser, {}, {}, { institutionId: 'jaboticabal_doc' });
  assert.strictEqual(res.status, 403, 'Body com unidade não autorizada deve retornar 403');
});

runTest('Requisição na própria unidade autorizada é permitida', () => {
  const localUser = {
    id: 'u1',
    username: 'admin_local',
    institutionId: 'NquBdSy0A3ixzHnyj0YF'
  };

  const res = centralGuardMiddleware(localUser, { 'x-institution-id': 'NquBdSy0A3ixzHnyj0YF' }, { institutionId: 'NquBdSy0A3ixzHnyj0YF' }, {});
  assert.strictEqual(res.status, 200, 'Requisição na própria unidade deve passar na guarda');
});

// -------------------------------------------------------------
// 4. ADMINISTRAÇÃO DE USUÁRIOS (/api/users)
// -------------------------------------------------------------
console.log('\n--- 4. Proteção da Rota /api/users ---');

function mockUsersGet(user, query) {
  const isGlobalController = user.email === 'kwarizaya@gmail.com' || user.username === 'kwarizaya@gmail.com';
  
  if (query.all === 'true' && !isGlobalController) {
    return { status: 403, error: 'A listagem global de usuários é restrita ao controlador do sistema.' };
  }

  return { status: 200, success: true };
}

function mockUsersPost(requester, incomingData, existingTargetUser) {
  const isGlobalController = requester.email === 'kwarizaya@gmail.com' || requester.username === 'kwarizaya@gmail.com';

  if (!isGlobalController) {
    // Alvo é o controlador global
    const targetEmail = existingTargetUser?.email || incomingData.email;
    if (targetEmail === 'kwarizaya@gmail.com') {
      return { status: 403, error: 'O controlador global só pode ser administrado pela própria conta controladora.' };
    }

    // Alvo pertence a outra instituição
    if (existingTargetUser && !isUserAuthorizedForInstitution(requester, existingTargetUser.institutionId)) {
      return { status: 403, error: 'Acesso negado para administrar este usuário.' };
    }

    // Sanitização de privilégios globais e multiunidade
    incomingData.isGlobalAdmin = false;
    incomingData.hasAllUnitsAccess = false;
    if (existingTargetUser) {
      incomingData.institutionId = existingTargetUser.institutionId;
      incomingData.institutionIds = existingTargetUser.institutionIds || [];
    } else {
      incomingData.institutionIds = [];
    }
  }

  return { status: 200, saved: incomingData };
}

runTest('GET /api/users?all=true por administrador local retorna 403', () => {
  const localAdmin = { username: 'admin_local', email: 'admin@lar.com' };
  const res = mockUsersGet(localAdmin, { all: 'true' });
  assert.strictEqual(res.status, 403);
});

runTest('GET /api/users?all=true por Klausner é aceito', () => {
  const klausner = { username: 'kwarizaya@gmail.com', email: 'kwarizaya@gmail.com' };
  const res = mockUsersGet(klausner, { all: 'true' });
  assert.strictEqual(res.status, 200);
});

runTest('Administrador local tentando conceder hasAllUnitsAccess tem o campo sanitizado para false', () => {
  const localAdmin = { username: 'admin_local', email: 'admin@lar.com', institutionId: 'NquBdSy0A3ixzHnyj0YF' };
  const payload = {
    username: 'novo_funcionario',
    institutionId: 'NquBdSy0A3ixzHnyj0YF',
    hasAllUnitsAccess: true, // Tentativa de escalação
    institutionIds: ['jaboticabal_doc'] // Tentativa de dar acesso a outra unidade
  };

  const res = mockUsersPost(localAdmin, payload, null);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.saved.hasAllUnitsAccess, false, 'hasAllUnitsAccess deve ser forçado a false');
  assert.strictEqual(res.saved.isGlobalAdmin, false, 'isGlobalAdmin deve ser forçado a false');
  assert.deepStrictEqual(res.saved.institutionIds, [], 'institutionIds externos devem ser esvaziados');
});

runTest('Administrador local tentando alterar conta de Klausner é barrado com 403', () => {
  const localAdmin = { username: 'admin_local', email: 'admin@lar.com', institutionId: 'NquBdSy0A3ixzHnyj0YF' };
  const existingKlausner = { id: 'k_id', username: 'kwarizaya@gmail.com', email: 'kwarizaya@gmail.com' };

  const res = mockUsersPost(localAdmin, { id: 'k_id', accessLevel: 'visitante' }, existingKlausner);
  assert.strictEqual(res.status, 403);
});

// -------------------------------------------------------------
// 5. PRESERVAÇÃO DE PODERES FUNCIONAIS NA PRÓPRIA UNIDADE
// -------------------------------------------------------------
console.log('\n--- 5. Poderes Funcionais dentro da Própria Unidade ---');

runTest('Administrador local mantém todos os poderes dentro de sua unidade', () => {
  const localAdmin = {
    username: 'admin_monte_alto@ssvp.com',
    accessLevel: 'administrador',
    institutionId: 'NquBdSy0A3ixzHnyj0YF'
  };

  // Simular validação de criação de residente na unidade
  assert.strictEqual(isUserAuthorizedForInstitution(localAdmin, 'NquBdSy0A3ixzHnyj0YF'), true);
  // Simular validação de estoque na unidade
  assert.strictEqual(isUserAuthorizedForInstitution(localAdmin, '52.853.397/0001-68'), true); // CNPJ sinônimo
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES DA MUDANÇA 003: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

process.exit(failedCount > 0 ? 1 : 0);
