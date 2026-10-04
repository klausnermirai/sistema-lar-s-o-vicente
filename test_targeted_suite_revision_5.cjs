const assert = require('assert');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('SUÍTE DE TESTES DIRECIONADOS: REVISÃO 5 (AUTENTICAÇÃO & MURAL)');
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
// 1. EXIGÊNCIA DO SEGREDO (lib/server_auth.ts)
// -------------------------------------------------------------
console.log('--- 1. Exigência Estrita de Segredo (>= 32 caracteres) ---');

runTest('K_SERVICE iniciado com "ais-dev-" exige segredo, inclusive com NODE_ENV=development', () => {
  const code = `
    process.env.NODE_ENV = 'development';
    process.env.K_SERVICE = 'ais-dev-usmwutzdxmvwdvv4tjujiw';
    delete process.env.SESSION_SECRET;
    delete process.env.JWT_SECRET;
    const { assertAuthConfigurationValid } = require('./lib/server_auth.ts');
    try {
      assertAuthConfigurationValid();
      process.exit(0);
    } catch (e) {
      if (e.message.includes('CONFIGURAÇÃO OBRIGATÓRIA AUSENTE OU INVÁLIDA') && e.message.includes('32 caracteres')) {
        process.exit(51);
      }
      process.exit(1);
    }
  `;
  try {
    execSync(`node -e "${code.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
    assert.fail('Deveria ter lançado erro de segredo obrigatório ausente');
  } catch (err) {
    assert.strictEqual(err.status, 51, 'Deve abortar inicialização exigindo segredo no preview');
  }
});

runTest('K_SERVICE comum (Cloud Run produção) exige segredo', () => {
  const code = `
    delete process.env.NODE_ENV;
    process.env.K_SERVICE = 'ssvp-cloud-run-production-service';
    delete process.env.SESSION_SECRET;
    delete process.env.JWT_SECRET;
    const { assertAuthConfigurationValid } = require('./lib/server_auth.ts');
    try {
      assertAuthConfigurationValid();
      process.exit(0);
    } catch (e) {
      if (e.message.includes('CONFIGURAÇÃO OBRIGATÓRIA AUSENTE OU INVÁLIDA')) {
        process.exit(52);
      }
      process.exit(1);
    }
  `;
  try {
    execSync(`node -e "${code.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
    assert.fail('Deveria ter lançado erro');
  } catch (err) {
    assert.strictEqual(err.status, 52);
  }
});

runTest('Segredo curto (< 32 caracteres) é rejeitado com K_SERVICE ais-dev- e com K_SERVICE comum', () => {
  // Teste com ais-dev-
  const codeDev = `
    process.env.K_SERVICE = 'ais-dev-test';
    process.env.SESSION_SECRET = 'chave-curta-123';
    const { assertAuthConfigurationValid } = require('./lib/server_auth.ts');
    try {
      assertAuthConfigurationValid();
      process.exit(0);
    } catch (e) {
      if (e.message.includes('32 caracteres')) {
        process.exit(53);
      }
      process.exit(1);
    }
  `;
  try {
    execSync(`node -e "${codeDev.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
    assert.fail('Segredo curto em ais-dev- deveria ter sido rejeitado');
  } catch (err) {
    assert.strictEqual(err.status, 53);
  }

  // Teste com K_SERVICE comum
  const codeProd = `
    process.env.K_SERVICE = 'ssvp-prod';
    process.env.SESSION_SECRET = 'outra-chave-curta-456';
    const { assertAuthConfigurationValid } = require('./lib/server_auth.ts');
    try {
      assertAuthConfigurationValid();
      process.exit(0);
    } catch (e) {
      if (e.message.includes('32 caracteres')) {
        process.exit(54);
      }
      process.exit(1);
    }
  `;
  try {
    execSync(`node -e "${codeProd.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
    assert.fail('Segredo curto em produção deveria ter sido rejeitado');
  } catch (err) {
    assert.strictEqual(err.status, 54);
  }
});

runTest('Segredo válido com >= 32 caracteres é aceito com sucesso', () => {
  const codeValid = `
    process.env.K_SERVICE = 'ais-dev-test';
    process.env.SESSION_SECRET = 'segredo-sintetico-muito-seguro-com-mais-de-32-caracteres-para-teste';
    const { assertAuthConfigurationValid, getAuthSecret } = require('./lib/server_auth.ts');
    assertAuthConfigurationValid();
    const sec = getAuthSecret();
    if (sec === process.env.SESSION_SECRET) {
      process.exit(0);
    }
    process.exit(1);
  `;
  const result = execSync(`node -e "${codeValid.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
  // Sucesso
});

// -------------------------------------------------------------
// 2. EXPIRAÇÃO NO INSTANTE EXATO (now >= exp)
// -------------------------------------------------------------
console.log('\n--- 2. Expiração Estrita no Instante Exato (now >= exp) ---');

// Injetar segredo sintético seguro para os testes de token
const SYNTHETIC_SECRET = 'segredo-sintetico-homologacao-com-mais-de-32-caracteres-ok';
process.env.SESSION_SECRET = SYNTHETIC_SECRET;

const crypto = require('crypto');
const { verifyAuthToken, createAuthToken } = require('./lib/server_auth.ts');

function makeSyntheticToken(userId, username, exp) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId, username, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SYNTHETIC_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

runTest('Token é rejeitado no instante exato da expiração (now === exp)', () => {
  const now = Math.floor(Date.now() / 1000);
  const tokenAtExactExpiration = makeSyntheticToken('u_user_1', 'usuario1', now);

  const res = verifyAuthToken(tokenAtExactExpiration);
  assert.strictEqual(res.valid, false, 'No instante exato now === exp o token DEVE ser rejeitado');
  assert.strictEqual(res.error.includes('Credencial expirada'), true);
});

runTest('Token com expiração passada (now > exp) continua rejeitado', () => {
  const now = Math.floor(Date.now() / 1000);
  const expiredToken = makeSyntheticToken('u_user_1', 'usuario1', now - 10);

  const res = verifyAuthToken(expiredToken);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error.includes('Credencial expirada'), true);
});

runTest('Token com expiração futura (now < exp) é aceito', () => {
  const now = Math.floor(Date.now() / 1000);
  const validToken = makeSyntheticToken('u_user_1', 'usuario1', now + 60);

  const res = verifyAuthToken(validToken);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.userId, 'u_user_1');
});

// -------------------------------------------------------------
// 3. VISIBILIDADE DO MURAL (lib/mural_visibility.ts)
// -------------------------------------------------------------
console.log('\n--- 3. Regras de Visibilidade de Mensagens do Mural ---');

const { isUserAuthorizedToViewMuralMessage, isAuthorizedForDocument } = require('./lib/mural_visibility.ts');
const { MONTE_ALTO_OPERATIONAL_ID } = require('./lib/canonical_units.ts');

const INST_MONTE_ALTO = MONTE_ALTO_OPERATIONAL_ID;
const INST_OUTRA = 'unidade_estranha_xyz_999';

// Mensagem privada de autor_original
const privateMsg = {
  id: 'msg_privada_1',
  title: 'Anotação Pessoal',
  text: 'Conteúdo confidencial',
  author: 'autor_original',
  authorUserId: 'u_autor_1',
  institutionId: INST_MONTE_ALTO,
  visibilidade: ['privado']
};

runTest('A consulta individual do mural não entrega mensagem privada de outro autor da mesma instituição', () => {
  const outroUsuarioMesmaInst = {
    id: 'u_colega_2',
    username: 'colega_trabalho',
    institutionId: INST_MONTE_ALTO,
    accessLevel: 'administrador'
  };

  const authorized = isUserAuthorizedToViewMuralMessage(outroUsuarioMesmaInst, privateMsg);
  assert.strictEqual(authorized, false, 'Outro usuário da mesma unidade NÃO pode ver mensagem privada alheia');
});

runTest('O autor continua acessando sua mensagem privada', () => {
  // Acesso pelo username do autor
  const autorUsername = {
    id: 'u_autor_1',
    username: 'autor_original',
    institutionId: INST_MONTE_ALTO,
    accessLevel: 'enfermeira'
  };
  assert.strictEqual(isUserAuthorizedToViewMuralMessage(autorUsername, privateMsg), true, 'Autor deve acessar sua mensagem privada');

  // Acesso pelo authorUserId
  const autorUserIdMatch = {
    id: 'u_autor_1',
    username: 'autor_outro_email',
    institutionId: INST_MONTE_ALTO,
    accessLevel: 'enfermeira'
  };
  assert.strictEqual(isUserAuthorizedToViewMuralMessage(autorUserIdMatch, privateMsg), true);
});

runTest('Usuário de outra instituição continua bloqueado mesmo para mensagem pública', () => {
  const publicMsg = {
    id: 'msg_publica_1',
    title: 'Aviso Geral',
    institutionId: INST_MONTE_ALTO,
    visibilidade: ['publico']
  };

  const userOutraInst = {
    id: 'u_estranho',
    username: 'usuario_estranho',
    institutionId: INST_OUTRA,
    accessLevel: 'administrador'
  };

  const authorized = isUserAuthorizedToViewMuralMessage(userOutraInst, publicMsg);
  assert.strictEqual(authorized, false, 'Usuário de outra instituição deve ser bloqueado');
});

runTest('Usuário da mesma instituição acessa mensagem pública', () => {
  const publicMsg = {
    id: 'msg_publica_1',
    title: 'Aviso Geral',
    institutionId: INST_MONTE_ALTO,
    visibilidade: ['publico']
  };

  const userMesmaInst = {
    id: 'u_colega',
    username: 'colega_maria',
    institutionId: INST_MONTE_ALTO,
    accessLevel: 'visitante'
  };

  assert.strictEqual(isUserAuthorizedToViewMuralMessage(userMesmaInst, publicMsg), true);
});

runTest('Mensagem restrita a admin é acessível por perfil autorizado e bloqueada para visitante', () => {
  const adminMsg = {
    id: 'msg_admin_1',
    title: 'Alinhamento Equipe',
    institutionId: INST_MONTE_ALTO,
    visibilidade: ['admin'],
    author: 'diretoria'
  };

  const userEnfermeira = {
    id: 'u_enf',
    username: 'enfermeira_chefe',
    institutionId: INST_MONTE_ALTO,
    accessLevel: 'enfermeira'
  };
  assert.strictEqual(isUserAuthorizedToViewMuralMessage(userEnfermeira, adminMsg), true, 'Enfermeira deve ter acesso a mensagem restrita admin');

  const userVisitante = {
    id: 'u_vis',
    username: 'visitante_externo',
    institutionId: INST_MONTE_ALTO,
    accessLevel: 'visitante'
  };
  assert.strictEqual(isUserAuthorizedToViewMuralMessage(userVisitante, adminMsg), false, 'Visitante não deve ter acesso a mensagem admin');
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES DIRECIONADOS: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
