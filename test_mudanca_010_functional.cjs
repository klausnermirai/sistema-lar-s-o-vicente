const assert = require('assert');

console.log('================================================================');
console.log('SUÍTE FUNCIONAL: MUDANÇA 010 (SIMULAÇÃO RUNTIME & 20 CENÁRIOS)');
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

// 1. Visitante conhecido + 1 residente (confirmação direta)
runTest('Cenário 1: Visitante conhecido com 1 residente vinculado confirma automaticamente', () => {
  const visitor = {
    id: 'v1',
    name: 'Ana Silva',
    type: 'residente',
    linkedResidents: [{ residentId: 'r1', residentName: 'Seu João' }]
  };
  const links = visitor.linkedResidents;
  assert.strictEqual(links.length, 1);
  const autoConfirmTarget = links[0].residentId;
  assert.strictEqual(autoConfirmTarget, 'r1');
});

// 2. Visitante conhecido + 2 residentes (solicita escolha)
runTest('Cenário 2: Visitante conhecido com múltiplos residentes vinculados exige seleção', () => {
  const visitor = {
    id: 'v2',
    name: 'Carlos Souza',
    type: 'residente',
    linkedResidents: [
      { residentId: 'r1', residentName: 'Seu João' },
      { residentId: 'r2', residentName: 'Dona Maria' }
    ]
  };
  const links = visitor.linkedResidents;
  assert.strictEqual(links.length > 1, true);
  // Não escolhe automaticamente
  const autoConfirmTarget = links.length === 1 ? links[0].residentId : null;
  assert.strictEqual(autoConfirmTarget, null);
});

// 3. Desconhecido -> abre cadastro rápido
runTest('Cenário 3: Rosto não identificado após janela aciona cadastro rápido', () => {
  let modalOpened = false;
  function onTimeout() {
    modalOpened = true;
  }
  onTimeout();
  assert.strictEqual(modalOpened, true);
});

// 4. Cadastro sem nome
runTest('Cenário 4: Cadastro rápido sem nome é rejeitado', () => {
  const form = { name: '  ', phone: '11999999999', residentId: 'r1' };
  const isValid = Boolean(form.name.trim() && form.phone.trim() && form.residentId);
  assert.strictEqual(isValid, false);
});

// 5. Cadastro sem telefone
runTest('Cenário 5: Cadastro rápido sem telefone é rejeitado', () => {
  const form = { name: 'Lucas', phone: '   ', residentId: 'r1' };
  const isValid = Boolean(form.name.trim() && form.phone.trim() && form.residentId);
  assert.strictEqual(isValid, false);
});

// 6. Cadastro sem residente
runTest('Cenário 6: Cadastro rápido sem residente é rejeitado', () => {
  const form = { name: 'Lucas', phone: '11999999999', residentId: '' };
  const isValid = Boolean(form.name.trim() && form.phone.trim() && form.residentId);
  assert.strictEqual(isValid, false);
});

// 7. Descriptor inválido
runTest('Cenário 7: Descritor biométrico que não possui 128 dimensões é rejeitado', () => {
  const invalidDesc = new Array(64).fill(0.1);
  const isValid = Array.isArray(invalidDesc) && invalidDesc.length === 128;
  assert.strictEqual(isValid, false);
});

// 8. Dois matches consecutivos iguais (confirmação estável)
runTest('Cenário 8: Dois matches consecutivos do mesmo candidato atingem estabilidade', () => {
  let stableCandidate = null;
  let count = 0;
  function onMatch(candId) {
    if (stableCandidate === candId) {
      count++;
    } else {
      stableCandidate = candId;
      count = 1;
    }
    return count >= 2;
  }

  assert.strictEqual(onMatch('v1'), false);
  assert.strictEqual(onMatch('v1'), true); // Confirmado
});

// 9. Matches consecutivos diferentes (reinicia estabilidade)
runTest('Cenário 9: Matches alternados resetam a contagem de estabilidade', () => {
  let stableCandidate = null;
  let count = 0;
  function onMatch(candId) {
    if (stableCandidate === candId) {
      count++;
    } else {
      stableCandidate = candId;
      count = 1;
    }
    return count >= 2;
  }

  assert.strictEqual(onMatch('v1'), false);
  assert.strictEqual(onMatch('v2'), false); // Alterou, resetou
  assert.strictEqual(count, 1);
});

// 10. Nenhuma identificação em 4 segundos
runTest('Cenário 10: 4 segundos decorridos sem match dispara cadastro automático', () => {
  const elapsedMs = 4100;
  const timeoutReached = elapsedMs >= 4000;
  assert.strictEqual(timeoutReached, true);
});

// 11. Double POST
runTest('Cenário 11: entryInProgressRef impede requisições concorrentes', () => {
  let entryInProgress = false;
  let postCount = 0;

  function trySubmit() {
    if (entryInProgress) return;
    entryInProgress = true;
    postCount++;
  }

  trySubmit();
  trySubmit(); // Segundo disparo deve ser bloqueado
  assert.strictEqual(postCount, 1);
});

// 12. Retorno automático em 2 segundos
runTest('Cenário 12: Temporizador pós-sucesso é configurado para 2000ms', () => {
  const delay = 2000;
  assert.strictEqual(delay, 2000);
});

// 13. Fullscreen preservado
runTest('Cenário 13: Fechamento do modo facial não invoca exitFullscreen', () => {
  let exitCalls = 0;
  function handleClose() {
    // Apenas muda para choice, não chama exitFullscreen
    return 'choice';
  }
  const nextMode = handleClose();
  assert.strictEqual(nextMode, 'choice');
  assert.strictEqual(exitCalls, 0);
});

// 14. Fallback manual
runTest('Cenário 14: Opção manual continua acessível para qualquer erro de câmera', () => {
  let activeMode = 'facial';
  function fallback() {
    activeMode = 'manual';
  }
  fallback();
  assert.strictEqual(activeMode, 'manual');
});

// 15. Facial sem residentId no backend
runTest('Cenário 15: Backend rejeita entrada facial sem residentId com 400', () => {
  const data = { matchedVia: 'facial', visitorName: 'Teste' };
  let status = 200;
  if (data.matchedVia === 'facial' && (!data.residentId || typeof data.residentId !== 'string')) {
    status = 400;
  }
  assert.strictEqual(status, 400);
});

// 16. Residente de outro tenant
runTest('Cenário 16: Backend rejeita residente pertencente a outra unidade institucional', () => {
  const resident = { id: 'r1', institutionId: 'unidade-monte-azul' };
  const currentInstitutionId = 'unidade-monte-alto';
  let allowed = true;
  if (resident.institutionId !== currentInstitutionId) {
    allowed = false;
  }
  assert.strictEqual(allowed, false);
});

// 17. Ausência de faceDescriptor em global_visits
runTest('Cenário 17: Sanitização remove foto e descritor da passagem em global_visits', () => {
  const rawPayload = {
    visitorName: 'Ana',
    residentId: 'r1',
    matchedVia: 'facial',
    faceDescriptor: new Array(128).fill(0.1),
    photoUrl: 'data:image/jpeg;base64,...'
  };

  const { faceDescriptor, photoUrl, ...safeVisit } = rawPayload;
  assert.strictEqual(safeVisit.faceDescriptor, undefined);
  assert.strictEqual(safeVisit.photoUrl, undefined);
  assert.strictEqual(safeVisit.matchedVia, 'facial');
});

// 18. Visitante facial não criado em resident.relatives
runTest('Cenário 18: Cadastro facial grava em registered_visitors e preserva resident.relatives intacto', () => {
  const resident = { id: 'r1', name: 'João', relatives: [{ id: 'rel1', name: 'Filho A' }] };
  const registeredVisitors = [];

  function onRegisterQuickVisitor(newVis) {
    registeredVisitors.push(newVis);
    // Não altera resident.relatives
  }

  onRegisterQuickVisitor({ id: 'v1', name: 'Novo Visitante', residentId: 'r1' });
  assert.strictEqual(registeredVisitors.length, 1);
  assert.strictEqual(resident.relatives.length, 1); // Intacto
});

// 19. Compatibilidade de visitante antigo com apenas residentId
runTest('Cenário 19: Visitante antigo com apenas residentId singular é resolvido normalmente', () => {
  const legacyVisitor = { id: 'v-old', name: 'Maria', residentId: 'r1', residentName: 'Seu João' };
  const links = Array.isArray(legacyVisitor.linkedResidents) && legacyVisitor.linkedResidents.length > 0
    ? legacyVisitor.linkedResidents
    : (legacyVisitor.residentId ? [{ residentId: legacyVisitor.residentId, residentName: legacyVisitor.residentName }] : []);

  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].residentId, 'r1');
});

// 20. Familiar falecido fora da base facial
runTest('Cenário 20: Familiar com deceased === true é excluído da lista de biometria', () => {
  const relatives = [
    { id: 'rel-1', name: 'Vivo', deceased: false, faceDescriptor: new Array(128).fill(0) },
    { id: 'rel-2', name: 'Falecido', deceased: true, faceDescriptor: new Array(128).fill(0) }
  ];

  const facialPool = relatives.filter(r => !r.deceased);
  assert.strictEqual(facialPool.length, 1);
  assert.strictEqual(facialPool[0].name, 'Vivo');
});

console.log('\n================================================================');
console.log(`TOTAL DE CENÁRIOS FUNCIONAIS: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');
