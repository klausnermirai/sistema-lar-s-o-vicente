const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

let passed = 0, failed = 0;
const check = (ok, name) => {
  if (ok) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath
  }).outputText;
  const mod = new Module(filePath, module);
  mod.filename = filePath;
  mod.paths = Module._nodeModulePaths(path.dirname(filePath));
  mod._compile(output, filePath);
  return mod.exports;
}

const root = __dirname;
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const loginScreen = fs.readFileSync(path.join(root, 'components', 'LoginScreen.tsx'), 'utf8');
const canonical = loadTsModule(path.join(root, 'lib', 'canonical_units.ts'));

function between(source, start, end) {
  const from = source.indexOf(start);
  if (from < 0) return '';
  const to = source.indexOf(end, from);
  return source.slice(from, to < 0 ? source.length : to);
}

check(canonical.normalizeUserAccessLevel('auxiliar_administrativo') === 'auxiliar_administrativo', 'auxiliar_administrativo não vira administrador');
check(canonical.normalizeUserAccessLevel('Auxiliar Administrativo') === 'auxiliar_administrativo', 'variação com espaços continua auxiliar');
check(canonical.normalizeUserAccessLevel('administrador') === 'administrador', 'administrador continua administrador');
check(canonical.normalizeUserAccessLevel('admin') === 'administrador', 'alias admin continua administrador');
check(canonical.normalizeUserAccessLevel('Administrador Geral') === 'administrador', 'Administrador Geral legado continua administrador');
check(canonical.normalizeUserAccessLevel('Administradora') === 'administrador', 'Administradora legado continua administrador');
check(canonical.normalizeUserAccessLevel('Administrador Local') === 'administrador', 'Administrador Local legado continua administrador');
check(canonical.normalizeUserAccessLevel('TI / Gestão') === 'administrador', 'TI / Gestão continua administrador');
check(canonical.normalizeUserAccessLevel('Auxiliar Adm') === 'auxiliar_administrativo', 'Auxiliar Adm continua auxiliar e não administrador');
check(server.includes('const normalizeAccessLevel = normalizeUserAccessLevel;'), 'server usa normalizador canônico');

check(server.includes('if (isInactiveUserRecord(rawUser))'), 'requireAuth bloqueia usuário inativo');
check(server.includes('if (isInactiveUserRecord(u))'), 'login bloqueia usuário inativo');
check(server.includes('user.archived === true || user.active === false'), 'archived e active=false são tratados');
check(server.includes("'inativo', 'inactive', 'desativado', 'disabled', 'arquivado'"), 'status de inatividade conhecidos são tratados');

check(server.includes('const sanitizeUserForResponse = (user: any) =>'), 'sanitizador de usuário existe');
check(server.includes('delete safeUser.password;') &&
      server.includes('delete safeUser.resetToken;') &&
      server.includes('delete safeUser.resetTokenExpiresAt;'),
  'sanitizador remove credenciais e tokens temporários');
check(server.includes('.map((item: any) => sanitizeUserForResponse(item))'), 'GET /api/users sanitiza listagens');
check(server.includes('return res.json(sanitizeUserForResponse({ ...existingData, ...data, id }));'), 'edição de usuário sanitiza resposta');
check(server.includes('return res.json(sanitizeUserForResponse({ ...data, id: docRef.id }));'), 'criação de usuário sanitiza resposta');

check(server.includes("const GLOBAL_CONTROLLER_IDENTITY = 'kwarizaya@gmail.com';"), 'identidade global está centralizada');
check(server.includes('if (!isGlobalController && hasGlobalControllerIdentity(requestedIdentity))'), 'admin local não pode assumir identidade global');
check(server.includes('const isSuperAdmin = hasGlobalControllerIdentity(userData);'), 'login usa identidade do documento autenticado');

check(server.includes("process.env.ALLOW_INITIAL_SETUP !== 'true'"), 'setup exige flag explícita');
check(server.includes("db.collection('institutions').limit(1).get()") && server.includes("db.collection('users').limit(1).get()"), 'setup exige banco vazio');
check(server.includes('if (hasGlobalControllerIdentity(safeAdmin))'), 'setup rejeita identidade global');
check(server.includes('const responseUser = sanitizeUserForResponse'), 'setup não devolve senha');


// Mudança 011.1 — revisão pós-publicação
const publicRoutesBlock = between(server, 'const staticPublicRoutes = [', '];');
check(!publicRoutesBlock.includes('/check-user-conselho'), 'check-user-conselho não é rota pública');

const maintenanceRoute = between(server, "app.get('/api/check-user-conselho'", '// Solicitação de redefinição de senha.');
check(maintenanceRoute.includes('hasGlobalControllerIdentity(req.user)'), 'check-user-conselho exige controlador global');
check(!between(server, 'async function startServer()', 'const app = express();').includes('checkAndSyncConselhoUser()'),
  'startServer não altera mais automaticamente vínculos do controlador');

const forgotRoute = between(server, "app.post('/api/forgot-password'", '// Verificar validade do token de redefinição de senha');
check(!forgotRoute.includes('resetToken') && !forgotRoute.includes('resetLink'),
  'forgot-password não gera nem expõe token/link de redefinição');
check(forgotRoute.includes('solicite ao administrador'), 'forgot-password orienta para redefinição administrativa');
check(!loginScreen.includes('generatedResetLink') && !loginScreen.includes('Redefinir Senha Agora'),
  'frontend não exibe mais atalho público de redefinição');
check(loginScreen.includes('Solicitar Redefinição'), 'frontend mantém solicitação simples de redefinição');

console.log('\nMudança 011:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);
