const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const check = (ok, name) => {
  if (ok) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

const root = __dirname;
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const login = fs.readFileSync(path.join(root, 'components', 'LoginScreen.tsx'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

check(/(^|\n)\.env(\r?\n|$)/.test(gitignore), '.env está ignorado');
check(server.includes('const rejectVisitor ='), 'bloqueio pontual da Portaria existe');
check(server.includes("app.get('/api/employees', requireAuth, rejectVisitor"), 'Portaria bloqueada em funcionários');
check(server.includes("app.get('/api/multidisciplinary/history', requireAuth, rejectVisitor"), 'Portaria bloqueada em histórico multidisciplinar');
check(server.includes("app.get('/api/inventory', rejectVisitor"), 'Portaria bloqueada em estoque de medicamentos');
check(server.includes("app.get('/api/medication_administration_logs', rejectVisitor") &&
      server.includes("app.post('/api/medication_administration_logs', rejectVisitor"),
  'Portaria bloqueada na administração de medicamentos');
check(server.includes("app.get('/api/global-visits', requireRole(['visitante'"), 'Portaria preservada em visitas');
check(server.includes("app.get('/api/registered-visitors', requireRole(['visitante'"), 'Portaria preservada em visitantes cadastrados');
check(server.includes("app.get('/api/residents', requireRole([") && server.includes("'visitante'"), 'Portaria preservada em residentes');

check(server.includes("const existingDoc = await db.collection('employees').doc(data.id).get();"), 'edição de funcionário valida documento real');
check(server.includes("const existingDoc = await db.collection('amendment_categories').doc(data.id).get();"), 'edição de categoria de emenda valida documento real');
check(server.includes("const existingDoc = await db.collection('amendment_grants').doc(data.id).get();"), 'edição de emenda valida documento real');
check(server.includes("const existingDoc = await db.collection('group_activities').doc(data.id).get();"), 'edição de atividade valida documento real');
check(server.includes("const existingDoc = await db.collection('benefactors').doc(id).get();"), 'edição de benfeitor valida documento real');
check(server.includes("const existingDoc = await db.collection('finance_donations').doc(id).get();"), 'edição de doação valida documento real');
check(server.includes("const existingProduct = await productRef.get();"), 'exclusão de estoque valida documento real');

check(login.includes('const handleCancelReset = () =>'), 'ação de retorno do reset existe');
check(login.includes("url.searchParams.delete('resetToken')") && login.includes("url.searchParams.delete('token')"), 'retorno limpa token da URL');
check(login.includes('Voltar ao login'), 'modal de reset possui retorno ao login');

console.log('\nMudança 012:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);
