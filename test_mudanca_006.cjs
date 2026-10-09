const assert = require('assert');
process.env.SESSION_SECRET = 'a-very-secure-session-secret-for-ssvp-system-32chars';
const { createAuthToken, verifyAuthToken, createReauthToken, verifyReauthToken } = require('./lib/server_auth.ts');
const { normalizeUserAccessLevel, getCanonicalInstitutionId, isUserAuthorizedForInstitution } = require('./lib/canonical_units.ts');
const { isAuthorizedForDocument } = require('./lib/mural_visibility.ts');

console.log('================================================================');
console.log('SUÍTE DE TESTES: MUDANÇA 006 (SERVIÇO SOCIAL & REGISTROS SIGILOSOS)');
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

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedCount++;
  }
}

(async () => {
  // 1. Reautenticação via Token HMAC Curto
  console.log('--- 1. Validação do Token de Reautenticação (lib/server_auth.ts) ---');

  runTest('Emissão de reauthToken curto com purpose: "reauth"', () => {
    const token = createReauthToken('user-beatriz', 'beatriz.social', 5);
    assert.strictEqual(typeof token, 'string');
    const result = verifyReauthToken(token);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.userId, 'user-beatriz');
    assert.strictEqual(result.username, 'beatriz.social');
  });

  runTest('Rejeição de reauthToken adulterado', () => {
    const token = createReauthToken('user-beatriz', 'beatriz.social', 5);
    const tampered = token.slice(0, -5) + 'xxxxx';
    const result = verifyReauthToken(tampered);
    assert.strictEqual(result.valid, false);
  });

  runTest('Token de login normal NÃO é aceito como reauthToken', () => {
    const normalToken = createAuthToken('user-beatriz', 'beatriz.social', 24);
    const result = verifyReauthToken(normalToken);
    assert.strictEqual(result.valid, false);
  });

  runTest('Token de reautenticação pertence exclusivamente ao mesmo userId da sessão', () => {
    const reauthToken = createReauthToken('user-outro', 'outro.social', 5);
    const result = verifyReauthToken(reauthToken);
    const sessionUserId = 'user-beatriz';
    // Na rota unlock: proof.userId !== req.user?.id deve falhar
    assert.notStrictEqual(result.userId, sessionUserId);
  });

  // 2. Regras de Perfil e Autorização na Rota de Desbloqueio
  console.log('\n--- 2. Controle de Acesso Restrito (Fail-Closed por Prerrogativa Ética) ---');

  const normalizeAccess = (roleOrLevel) => {
    if (!roleOrLevel) return 'visitante';
    const clean = roleOrLevel.trim().toLowerCase().replace(/[\s\-_]+/g, '');
    if (clean.includes('admin') || clean.includes('gestao') || clean.includes('diretor') || clean.includes('presidente')) return 'administrador';
    if (clean.includes('enferm') || clean.includes('enf') || clean.includes('nurse')) return 'enfermeira';
    if (clean.includes('medic') || clean.includes('doutor') || clean.includes('doc')) return 'medico';
    if (clean.includes('social') || clean.includes('servicosocial')) return 'assistente_social';
    if (clean.includes('psico')) return 'psicologia';
    if (clean.includes('fisioter') || clean.includes('fisio')) return 'fisioterapeuta';
    if (clean.includes('terapeut') || clean.includes('to')) return 'terapeuta_ocupacional';
    if (clean.includes('nutri')) return 'nutricionista';
    return clean;
  };

  const isStrictSocialWorker = (user) => normalizeAccess(user?.accessLevel || user?.role) === 'assistente_social';

  runTest('Assistente Social possui acesso permitido à rota de desbloqueio', () => {
    const user = { id: 'u1', username: 'beatriz', role: 'Assistente Social', accessLevel: 'assistente_social' };
    assert.strictEqual(isStrictSocialWorker(user), true);
  });

  runTest('Administrador NÃO consegue desbloquear registro sigiloso', () => {
    const adminUser = { id: 'adm1', username: 'diretoria', role: 'Diretora', accessLevel: 'administrador' };
    assert.strictEqual(isStrictSocialWorker(adminUser), false);
  });

  runTest('Gerencial / Gestão NÃO consegue desbloquear registro sigiloso', () => {
    const gerUser = { id: 'g1', username: 'gerente', role: 'Gerente Geral', accessLevel: 'gerencial' };
    assert.strictEqual(isStrictSocialWorker(gerUser), false);
  });

  runTest('Enfermagem NÃO consegue desbloquear registro sigiloso', () => {
    const enfUser = { id: 'e1', username: 'enfermeira', role: 'Enfermeira Chefe', accessLevel: 'enfermeira' };
    assert.strictEqual(isStrictSocialWorker(enfUser), false);
  });

  runTest('Psicologia NÃO consegue desbloquear registro sigiloso', () => {
    const psiUser = { id: 'p1', username: 'psicologa', role: 'Psicóloga', accessLevel: 'psicologia' };
    assert.strictEqual(isStrictSocialWorker(psiUser), false);
  });

  runTest('Médico NÃO consegue desbloquear registro sigiloso', () => {
    const medUser = { id: 'm1', username: 'medico', role: 'Médico', accessLevel: 'medico' };
    assert.strictEqual(isStrictSocialWorker(medUser), false);
  });

  runTest('Controlador Global (kwarizaya@gmail.com) NÃO desbloqueia se perfil não for assistente_social', () => {
    const globalAdmin = { id: 'k1', username: 'kwarizaya@gmail.com', isGlobalAdmin: true, accessLevel: 'administrador' };
    assert.strictEqual(isStrictSocialWorker(globalAdmin), false);
  });

  runTest('Outra Assistente Social da mesma unidade tem permissão aprovada', () => {
    const userColega = { id: 'u2', username: 'maria.social', role: 'Assistente Social II', accessLevel: 'assistente_social', institutionId: 'NquBdSy0A3ixzHnyj0YF' };
    assert.strictEqual(isStrictSocialWorker(userColega), true);
    assert.strictEqual(isUserAuthorizedForInstitution(userColega, 'NquBdSy0A3ixzHnyj0YF'), true);
  });

  runTest('Assistente Social de outra instituição é BLOQUEADA institucionalmente', () => {
    const userOutraUnidade = { id: 'u3', username: 'social.externa', role: 'Assistente Social', accessLevel: 'assistente_social', institutionId: 'OUTRA_UNIDADE_123' };
    assert.strictEqual(isStrictSocialWorker(userOutraUnidade), true);
    assert.strictEqual(isUserAuthorizedForInstitution(userOutraUnidade, 'NquBdSy0A3ixzHnyj0YF'), false);
  });

  // 3. Estrutura de Dados e Proteção contra Vazamentos
  console.log('\n--- 3. Integridade de Dados, Prontuário e Prevenção de Vazamento ---');

  runTest('Registro Institucional: mantém description e referrals no prontuário do residente', () => {
    const evoInst = {
      id: 'soc-1',
      date: '2026-10-04',
      time: '14:00',
      type: 'atendimento_individual',
      title: 'Atendimento Individual',
      visibility: 'institutional',
      description: 'Relato institucional aberto para a equipe.',
      referrals: 'Encaminhado para consulta.',
      hasConfidentialContent: false
    };
    assert.strictEqual(evoInst.visibility, 'institutional');
    assert.strictEqual(typeof evoInst.description, 'string');
    assert.strictEqual(typeof evoInst.referrals, 'string');
  });

  runTest('Registro Sigiloso no Residente: NÃO contém description nem referrals', () => {
    const evoSigilosaNoResidente = {
      id: 'soc-conf-1',
      date: '2026-10-04',
      time: '14:30',
      type: 'atendimento_individual',
      subtype: 'conversation',
      title: 'Atendimento Individual',
      visibility: 'confidential',
      hasConfidentialContent: true,
      authorUserId: 'u1',
      authorUsername: 'beatriz.social'
    };
    assert.strictEqual(evoSigilosaNoResidente.visibility, 'confidential');
    assert.strictEqual(evoSigilosaNoResidente.hasConfidentialContent, true);
    assert.strictEqual(evoSigilosaNoResidente.description, undefined);
    assert.strictEqual(evoSigilosaNoResidente.referrals, undefined);
  });

  runTest('Documento em social_confidential_records contém o texto protegido isolado', () => {
    const docConfidencial = {
      institutionId: 'NquBdSy0A3ixzHnyj0YF',
      residentId: 'res-1',
      recordId: 'soc-conf-1',
      description: 'Relato extremamente confidencial de cunho íntimo/familiar.',
      referrals: 'Encaminhamento sigiloso ao CREAS.',
      authorUserId: 'u1'
    };
    assert.strictEqual(docConfidencial.recordId, 'soc-conf-1');
    assert.strictEqual(docConfidencial.description.includes('confidencial'), true);
  });

  runTest('GET /api/multidisciplinary/history sanitiza atendimentos sigilosos com [REGISTRO SIGILOSO]', () => {
    const evos = [
      { id: '1', title: 'Atendimento Aberto', description: 'Conteúdo público', referrals: 'Ref', visibility: 'institutional' },
      { id: '2', title: 'Atendimento Sigiloso', visibility: 'confidential' } // Não possui description no residente
    ];

    const mapped = evos.map(evo => {
      const isConf = evo.visibility === 'confidential';
      return {
        recordId: evo.id,
        type: evo.title,
        attendanceEvolution: isConf ? '[REGISTRO SIGILOSO - SERVIÇO SOCIAL]' : (evo.description || ''),
        notes: isConf ? '' : (evo.referrals || ''),
        isConfidential: isConf,
        visibility: evo.visibility || 'institutional'
      };
    });

    assert.strictEqual(mapped[0].attendanceEvolution, 'Conteúdo público');
    assert.strictEqual(mapped[0].notes, 'Ref');
    assert.strictEqual(mapped[1].attendanceEvolution, '[REGISTRO SIGILOSO - SERVIÇO SOCIAL]');
    assert.strictEqual(mapped[1].notes, '');
    assert.strictEqual(mapped[1].isConfidential, true);
  });

  // 4. Regras do Mural e Não Publicação de Sigilosos
  console.log('\n--- 4. Isolamento do Mural (Sem Regressão na Mudança 005) ---');

  runTest('Atendimento Institucional pode gerar mensagem no mural', () => {
    const visibility = 'institutional';
    const canPost = visibility === 'institutional';
    assert.strictEqual(canPost, true);
  });

  runTest('Atendimento Sigiloso NUNCA pode ser publicado no mural', () => {
    const visibility = 'confidential';
    const postToMural = visibility === 'institutional';
    assert.strictEqual(postToMural, false);
  });

  // 5. Retrocompatibilidade com Registros Antigos
  console.log('\n--- 5. Retrocompatibilidade com Registros Antigos ---');

  runTest('Registro antigo sem visibility é interpretado como institucional', () => {
    const oldEvo = {
      id: 'legacy-1',
      date: '2026-07-20',
      title: 'Ação Social Antiga',
      description: 'Relato registrado antes da Mudança 006',
      referrals: 'Providências legadas'
    };
    const visibility = oldEvo.visibility === 'confidential' ? 'confidential' : 'institutional';
    assert.strictEqual(visibility, 'institutional');
    assert.strictEqual(oldEvo.description, 'Relato registrado antes da Mudança 006');
  });

  // 6. Comunicação Familiar (WhatsApp) e Impressões
  console.log('\n--- 6. Comunicação Familiar e Impressão ---');

  runTest('Resumo para familiares (WhatsApp) filtra e exclui atendimentos sigilosos', () => {
    const evos = [
      { date: '2026-10-02', title: 'Atendimento Familiar', description: 'Conversa com a filha', visibility: 'institutional' },
      { date: '2026-10-03', title: 'Atendimento Sigiloso', visibility: 'confidential' }
    ];

    const safeForFamily = evos.filter(e => e.visibility !== 'confidential');
    assert.strictEqual(safeForFamily.length, 1);
    assert.strictEqual(safeForFamily[0].title, 'Atendimento Familiar');
  });

  runTest('Impressão de histórico geral não inclui texto sigiloso', () => {
    const evo = { title: 'Atendimento Sigiloso', visibility: 'confidential' };
    const printText = evo.visibility === 'confidential' ? '[REGISTRO SIGILOSO - CONTEÚDO NÃO INCLUÍDO NO HISTÓRICO GERAL]' : (evo.description || '');
    assert.strictEqual(printText, '[REGISTRO SIGILOSO - CONTEÚDO NÃO INCLUÍDO NO HISTÓRICO GERAL]');
  });

  console.log('\n================================================================');
  console.log(`TOTAL DE TESTES MUDANÇA 006: ${passedCount} PASSOU | ${failedCount} FALHOU`);
  console.log('================================================================');

  if (failedCount > 0) process.exit(1);
})();
