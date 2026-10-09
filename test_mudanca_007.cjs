const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('SUÍTE DE TESTES: MUDANÇA 007 (LOGIN LIMPO, HOME & RETORNO DO MURAL)');
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

// 1. Login Limpo em LoginScreen.tsx e App.tsx
console.log('--- 1. Login Limpo e Prevenção de Credenciais Residuais ---');

const loginScreenContent = fs.readFileSync('components/LoginScreen.tsx', 'utf8');
const appContent = fs.readFileSync('App.tsx', 'utf8');
const layoutContent = fs.readFileSync('components/Layout.tsx', 'utf8');
const muralContent = fs.readFileSync('components/MuralModule.tsx', 'utf8');

runTest('LoginScreen inicia explicitamente com username, password e showPassword vazios no mount', () => {
  assert.strictEqual(loginScreenContent.includes("setUsername('');"), true);
  assert.strictEqual(loginScreenContent.includes("setPassword('');"), true);
  assert.strictEqual(loginScreenContent.includes("setShowPassword(false);"), true);
});

runTest('Formulário de login possui autoComplete="off"', () => {
  assert.strictEqual(loginScreenContent.includes('autoComplete="off"'), true);
});

runTest('Input de senha utiliza autoComplete="new-password" para mitigar autofill forçado do browser', () => {
  assert.strictEqual(loginScreenContent.includes('autoComplete="new-password"'), true);
});

runTest('Redefinição de senha limpa campos em vez de injetar credenciais residuais', () => {
  // Não deve conter a injeção antiga: if (resetUserEmail) setUsername(resetUserEmail); setPassword(newPassword);
  assert.strictEqual(loginScreenContent.includes('if (resetUserEmail) setUsername(resetUserEmail);'), false);
  assert.strictEqual(loginScreenContent.includes('setPassword(newPassword);'), false);
});

runTest('App.tsx incrementa loginKey e reseta activeRoute para HOME no logout', () => {
  assert.strictEqual(appContent.includes("setActiveRoute(AppRoute.HOME);"), true);
  assert.strictEqual(appContent.includes("setLoginKey(key => key + 1);"), true);
  assert.strictEqual(appContent.includes("<LoginScreen key={loginKey}"), true);
});

runTest('App.tsx incrementa loginKey e reseta activeRoute no subscribeAuthExpired', () => {
  const authExpiredBlock = appContent.slice(appContent.indexOf('subscribeAuthExpired'));
  assert.strictEqual(authExpiredBlock.includes('setLoginKey(key => key + 1);'), true);
  assert.strictEqual(authExpiredBlock.includes('setActiveRoute(AppRoute.HOME);'), true);
});

// 2. Entrada na Página Inicial (HOME) após Login
console.log('\n--- 2. Abertura Universal na Página Inicial (AppRoute.HOME) ---');

runTest('Estado inicial de activeRoute inicia em HOME para todos os perfis, exceto visitante', () => {
  // No App.tsx:
  // if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;
  // return AppRoute.HOME;
  assert.strictEqual(appContent.includes("if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;"), true);
  // Não deve conter mais: if (session?.accessLevel === 'medico') return AppRoute.CONSULTAS_MEDICAS;
  assert.strictEqual(appContent.includes("if (session?.accessLevel === 'medico') return AppRoute.CONSULTAS_MEDICAS;"), false);
});

runTest('handleLoginSuccess direciona para HOME por padrão (e VISITANTES apenas para visitante)', () => {
  assert.strictEqual(appContent.includes("setActiveRoute(newSession.accessLevel === 'visitante' ? AppRoute.VISITANTES : AppRoute.HOME);"), true);
});

runTest('Efeito forçador de médico para CONSULTAS_MEDICAS foi removido de App.tsx', () => {
  assert.strictEqual(appContent.includes("if (session?.accessLevel === 'medico' && activeRoute !== AppRoute.CONSULTAS_MEDICAS)"), false);
});

runTest('Efeito de settings para contexto Vicentino não expulsa mais o usuário da HOME', () => {
  // Condição atualizada: if (activeRoute !== AppRoute.HOME && !vicentinoRoutes.includes(activeRoute))
  assert.strictEqual(appContent.includes("if (activeRoute !== AppRoute.HOME && !vicentinoRoutes.includes(activeRoute))"), true);
});

runTest('Layout.tsx inclui Página Inicial no menu do perfil médico', () => {
  const medicoSection = layoutContent.slice(layoutContent.indexOf('else if (isMedico)'));
  assert.strictEqual(medicoSection.includes("{ id: AppRoute.HOME, label: 'Página Inicial', icon: Home }"), true);
});

// 3. Retorno do Filtro de Data no Mural
console.log('\n--- 3. Retorno e Usabilidade do Filtro de Data no Mural ---');

runTest('MuralModule renderiza o botão destacado "Voltar ao mural atual" quando filterDate está preenchido', () => {
  assert.strictEqual(muralContent.includes('Voltar ao mural atual'), true);
  assert.strictEqual(muralContent.includes("onClick={() => setFilterDate('')}"), true);
});

runTest('MuralModule renderiza o botão "Voltar ao mural atual" também no estado vazio', () => {
  const emptyStateBlock = muralContent.slice(muralContent.indexOf('Nenhuma mensagem encontrada'));
  assert.strictEqual(emptyStateBlock.includes('Voltar ao mural atual'), true);
});

runTest('Ação de retorno dispara unicamente setFilterDate(\'\') sem chamada manual duplicada a loadMuralMessages', () => {
  // O botão apenas altera filterDate para vazio
  assert.strictEqual(muralContent.includes("onClick={() => setFilterDate('')}"), true);
  // O useEffect de filterDate se encarrega de recarregar com uma única requisição
  assert.strictEqual(muralContent.includes("}, [institutionId, username, filterDate]);"), true);
});

// 4. Integridade da Mudança 005 e 006
console.log('\n--- 4. Preservação da Mudança 005 e Mudança 006 ---');

runTest('Mudança 005 (Mural Cache e normalização) permanece íntegra em server.ts', () => {
  const serverContent = fs.readFileSync('server.ts', 'utf8');
  assert.strictEqual(serverContent.includes('muralRawCache'), true);
  assert.strictEqual(serverContent.includes('loadInstitutionMuralRaw'), true);
  assert.strictEqual(serverContent.includes('normalizeMuralTimestamp'), true);
  assert.strictEqual(serverContent.includes('updateMuralCacheIfLoaded'), true);
});

runTest('Mudança 006 (Serviço Social e Registros Sigilosos) permanece íntegra em server.ts', () => {
  const serverContent = fs.readFileSync('server.ts', 'utf8');
  assert.strictEqual(serverContent.includes('/api/social-work/records'), true);
  assert.strictEqual(serverContent.includes('social_confidential_records'), true);
  assert.strictEqual(serverContent.includes('/api/social-work/confidential/:residentId/:recordId/unlock'), true);
  assert.strictEqual(serverContent.includes('verifyReauthToken'), true);
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES MUDANÇA 007: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) process.exit(1);
