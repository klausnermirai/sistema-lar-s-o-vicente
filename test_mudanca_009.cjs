const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('SUÍTE DE TESTES: MUDANÇA 009 (PORTAL DE VISITANTES MULTI-INSTITUIÇÃO)');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedCount++;
  }
}

const serverContent = fs.readFileSync('server.ts', 'utf8');
const appContent = fs.readFileSync('App.tsx', 'utf8');
const layoutContent = fs.readFileSync('components/Layout.tsx', 'utf8');
const userMgmtContent = fs.readFileSync('components/UserManagementView.tsx', 'utf8');
const visitorPortalContent = fs.readFileSync('components/VisitorPortal.tsx', 'utf8');

// 1. Proteção de Autenticação e Autorização por Papel (RBAC)
console.log('--- 1. Proteção e Middleware Central das Rotas do Portal ---');

runTest('GET /api/global-visits exige requireRole com visitante, gerencial e auxiliar_administrativo', () => {
  assert.strictEqual(
    serverContent.includes("app.get('/api/global-visits', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo'])"),
    true
  );
});

runTest('POST /api/global-visits exige requireRole restrito a visitante, gerencial e auxiliar_administrativo', () => {
  assert.strictEqual(
    serverContent.includes("app.post('/api/global-visits', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo'])"),
    true
  );
});

runTest('GET /api/registered-visitors existe e exige requireRole apropriado', () => {
  assert.strictEqual(
    serverContent.includes("app.get('/api/registered-visitors', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo'])"),
    true
  );
});

runTest('POST /api/registered-visitors existe e exige requireRole apropriado', () => {
  assert.strictEqual(
    serverContent.includes("app.post('/api/registered-visitors', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo'])"),
    true
  );
});

runTest('POST /api/clear-biometrics é estritamente restrito a gerencial e administrador (visitante e auxiliar recebem 403)', () => {
  // O middleware requireRole(['gerencial']) aceita 'gerencial' e também 'administrador'/'super_admin' via requireRole interno
  assert.strictEqual(
    serverContent.includes("app.post('/api/clear-biometrics', requireRole(['gerencial'])"),
    true
  );
  // Não pode conter 'visitante' ou 'auxiliar' na rota de limpeza de biometria
  const clearBioBlock = serverContent.slice(
    serverContent.indexOf("app.post('/api/clear-biometrics'"),
    serverContent.indexOf("app.post('/api/clear-biometrics'") + 300
  );
  assert.strictEqual(clearBioBlock.includes('visitante'), false);
  assert.strictEqual(clearBioBlock.includes('auxiliar'), false);
});

// 2. Restrição a Obras Unidas / Lares / ILPIs (Conselhos e Conferências Rejeitados)
console.log('\n--- 2. Restrição Exclusiva a Obras Unidas / Lares / ILPIs ---');

runTest('server.ts implementa helper isVisitorPortalInstitution para validar tipo de unidade operacional', () => {
  assert.strictEqual(serverContent.includes('async function isVisitorPortalInstitution'), true);
  assert.strictEqual(serverContent.includes("['obra_unida', 'obraunida', 'lar', 'ilpi'].includes(normalizedType)"), true);
});

runTest('Rotas do Portal rejeitam Conselhos e Conferências com erro 400', () => {
  assert.strictEqual(
    serverContent.includes("if (!(await isVisitorPortalInstitution(realId))) {\n        return res.status(400).json({ error: 'Portal de Visitantes disponível somente para Obra Unida / Lar / ILPI.' });"),
    true
  );
});

// 3. Isolamento Multi-tenant e Prevenção Cross-Tenant para Conta Visitante
console.log('\n--- 3. Isolamento Multi-tenant e Travamento da Conta Visitante ---');

runTest('Tenant guard central trava conta visitante à sua unidade institucional vinculada', () => {
  const tenantGuard = serverContent.slice(
    serverContent.indexOf("if (userLevel === 'visitante') {"),
    serverContent.indexOf("if (userLevel === 'visitante') {") + 500
  );
  assert.strictEqual(tenantGuard.includes('primaryInstitutionId'), true);
  assert.strictEqual(tenantGuard.includes('getCanonicalInstitutionId(primaryInstitutionId) !== getCanonicalInstitutionId(candidateId)'), true);
  assert.strictEqual(tenantGuard.includes('A conta de portaria está restrita à sua Obra Unida vinculada.'), true);
});

runTest('POST /api/registered-visitors impede que visitante existente de uma instituição seja atualizado para outra', () => {
  assert.strictEqual(
    serverContent.includes("if (getCanonicalInstitutionId(existingData.institutionId) !== getCanonicalInstitutionId(realId)) {\n          return res.status(403).json({ error: 'Visitante cadastrado pertence a outra instituição.' });"),
    true
  );
});

runTest('Login de conta visitante com unidades legadas ou multiacesso filtra estritamente para sua única Obra Unida', () => {
  const visitorLoginFilter = serverContent.slice(
    serverContent.indexOf("if (loginAccessLevel === 'visitante') {"),
    serverContent.indexOf("if (loginAccessLevel === 'visitante') {") + 1000
  );
  assert.strictEqual(visitorLoginFilter.includes('authorizedUnits = authorizedUnits.filter'), true);
  assert.strictEqual(visitorLoginFilter.includes('authorizedUnits = [authorizedUnits[0]];'), true);
});

// 4. Sanitização de Prontuário e Payload Mínimo para Visitante
console.log('\n--- 4. Sanitização de Prontuário e Proteção de Dados dos Residentes ---');

runTest('GET /api/residents retorna payload mínimo (id, name, status, relatives, visitRecords) para visitante', () => {
  assert.strictEqual(serverContent.includes("const isVisitorPortalUser = requesterLevel === 'visitante';"), true);
  assert.strictEqual(serverContent.includes("cacheKey = `residents:${institutionId}:${type || 'default'}:${isVisitorPortalUser ? 'visitor' : 'standard'}`;"), true);
  assert.strictEqual(serverContent.includes("if (isVisitorPortalUser) {\n          return {\n            id: doc.id,\n            name: data.name || '',\n            status: data.status || 'ativo',"), true);
});

runTest('GET /api/residents/:id também sanitiza dados e bloqueia dados clínicos/PIA para visitante', () => {
  const residentById = serverContent.slice(
    serverContent.indexOf("if (requesterLevel === 'visitante') {"),
    serverContent.indexOf("if (requesterLevel === 'visitante') {") + 800
  );
  assert.strictEqual(residentById.includes("relatives: Array.isArray(resident.relatives)"), true);
  assert.strictEqual(residentById.includes("!relative?.deceased"), true);
});

runTest('Familiares falecidos (deceased: true) são filtrados da resposta para a conta de Portaria', () => {
  assert.strictEqual(serverContent.includes(".filter((relative: any) => !relative?.deceased)"), true);
});

// 5. Restrição de Operações de Escrita em Residentes pela Portaria
console.log('\n--- 5. Restrições e Merge Seguro de Residentes pela Portaria ---');

runTest('Conta de Portaria é proibida de criar novos residentes (403)', () => {
  assert.strictEqual(
    serverContent.includes("if (requesterLevel === 'visitante' && !data.id) {\n        return res.status(403).json({ error: 'A conta de Portaria não pode criar residentes.' });"),
    true
  );
});

runTest('Atualização do residente por visitante executa merge seguro não destrutivo de familiares e visitas', () => {
  assert.strictEqual(serverContent.includes("safePortariaUpdate = {"), true);
  assert.strictEqual(serverContent.includes("mergedRelatives = existingRelatives.map"), true);
  assert.strictEqual(serverContent.includes("mergedVisitRecords = [...existingVisitRecords, ...newVisitRecords];"), true);
  assert.strictEqual(serverContent.includes("isResponsible: false,\n              deceased: false"), true);
});

// 6. Cadastro de Usuários (/api/users e UserManagementView)
console.log('\n--- 6. Criação e Gestão de Usuários da Portaria ---');

runTest('POST /api/users força restrições de tenant ao salvar usuário visitante', () => {
  const userSaveVisitor = serverContent.slice(
    serverContent.indexOf("if (targetAccessLevel === 'visitante') {"),
    serverContent.indexOf("if (targetAccessLevel === 'visitante') {") + 700
  );
  assert.strictEqual(userSaveVisitor.includes("data.isGlobalAdmin = false;"), true);
  assert.strictEqual(userSaveVisitor.includes("data.hasAllUnitsAccess = false;"), true);
  assert.strictEqual(userSaveVisitor.includes("data.institutionIds = [];"), true);
  assert.strictEqual(userSaveVisitor.includes("data.authorizedUnits = [];"), true);
  assert.strictEqual(userSaveVisitor.includes("data.allowedUnits = [];"), true);
  assert.strictEqual(userSaveVisitor.includes("Contas de Portaria só podem ser vinculadas a uma Obra Unida / Lar / ILPI."), true);
});

runTest('UserManagementView exibe rótulo "Portal de Visitantes / Portaria"', () => {
  assert.strictEqual(userMgmtContent.includes("label: 'Portal de Visitantes / Portaria'"), true);
  assert.strictEqual(userMgmtContent.includes("Acesso restrito ao Portal de Visitantes da única Obra Unida vinculada."), true);
});

runTest('UserManagementView bloqueia seleção de múltiplas unidades ou Conselhos para perfil visitante', () => {
  assert.strictEqual(userMgmtContent.includes("A conta de Portaria só pode ser vinculada a uma Obra Unida / Lar / ILPI."), true);
  assert.strictEqual(userMgmtContent.includes("O Portal de Visitantes deve estar vinculado a exatamente uma Obra Unida / Lar / ILPI."), true);
});

// 7. Navegação, Layout e Menu Administrativo
console.log('\n--- 7. Navegação no Frontend (Layout.tsx e App.tsx) ---');

runTest('App.tsx otimiza carregamento para visitante (não busca candidatos nem funcionários)', () => {
  assert.strictEqual(appContent.includes("const isVisitorSession = session.accessLevel === 'visitante';"), true);
  assert.strictEqual(appContent.includes("const candidatesPromise = isVisitorSession\n        ? Promise.resolve([])"), true);
  assert.strictEqual(appContent.includes("const employeesPromise = isVisitorSession\n        ? Promise.resolve([])"), true);
});

runTest('App.tsx bloqueia visitante em AppRoute.VISITANTES e passa accessLevel para VisitorPortal', () => {
  assert.strictEqual(appContent.includes("if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;"), true);
  assert.strictEqual(appContent.includes("<VisitorPortal"), true);
  assert.strictEqual(appContent.includes("accessLevel={session?.accessLevel}"), true);
});

runTest('Layout.tsx não exibe Configurações para perfil visitante', () => {
  const visitanteBlock = layoutContent.slice(
    layoutContent.indexOf("} else if (isVisitante) {"),
    layoutContent.indexOf("} else if (isVisitante) {") + 200
  );
  assert.strictEqual(visitanteBlock.includes("label: 'Portal de Visitantes'"), true);
  assert.strictEqual(visitanteBlock.includes("AppRoute.SETTINGS"), false);
});

runTest('Layout.tsx oculta o seletor "Trocar Unidade" para perfil visitante', () => {
  assert.strictEqual(layoutContent.includes("{!isVisitante && availableUnits && availableUnits.length > 1 && onSwitchUnit && ("), true);
});

runTest('Layout.tsx exibe "Portal de Visitantes" para administrador, gerencial e auxiliar apenas em Obra Unida', () => {
  assert.strictEqual(layoutContent.includes("const isOperationalVisitorUnit = ['obra_unida', 'obraunida', 'lar', 'ilpi'].includes(normalizedEntityType.replace(/[\\s-]+/g, '_'));"), true);
  assert.strictEqual(layoutContent.includes("canAccessVisitorPortal && !isVisitante && !atendimentoItems.some(item => item.id === AppRoute.VISITANTES)"), true);
});

// 8. Recursos Internos do VisitorPortal
console.log('\n--- 8. Capacidades Operacionais do VisitorPortal ---');

runTest('VisitorPortal oculta botão de zerar biometrias para a conta de portaria (permitido apenas para admin/gerencial)', () => {
  assert.strictEqual(visitorPortalContent.includes("const canManageBiometrics = ['administrador', 'gerencial'].includes(normalizedAccessLevel);"), true);
  assert.strictEqual(visitorPortalContent.includes("onResetBiometrics={canManageBiometrics ? handleClearAllBiometrics : undefined}"), true);
});

runTest('VisitorPortal filtra familiares falecidos ao construir lista de visitantes unificados', () => {
  assert.strictEqual(visitorPortalContent.includes("(res.relatives || []).filter(rel => !rel.deceased).forEach(rel => {"), true);
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES MUDANÇA 009: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
