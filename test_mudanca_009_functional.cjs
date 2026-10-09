const assert = require('assert');

console.log('================================================================');
console.log('SUÍTE FUNCIONAL: MUDANÇA 009 (SIMULAÇÃO RUNTIME & TENANT GUARD)');
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

// 1. Simulação do Tenant Guard Central (server.ts)
console.log('--- 1. Simulação do Tenant Guard Central para Visitante ---');

function simulateTenantGuard(user, targetInstitutionId) {
  const normalizeAccessLevel = (lvl) => String(lvl || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const userLevel = normalizeAccessLevel(user?.accessLevel || user?.role);

  if (userLevel === 'visitante') {
    const primaryInstitutionId = user?.institutionId;
    if (!primaryInstitutionId) {
      return { status: 403, error: 'Conta de portaria sem unidade institucional válida.' };
    }
    // Comparação de ID
    if (primaryInstitutionId !== targetInstitutionId) {
      const cleanA = String(primaryInstitutionId).replace(/\D/g, '');
      const cleanB = String(targetInstitutionId).replace(/\D/g, '');
      if (!cleanA || !cleanB || cleanA !== cleanB) {
        return { status: 403, error: 'A conta de portaria está restrita à sua Obra Unida vinculada.' };
      }
    }
    return { status: 200, allowed: true };
  }

  return { status: 200, allowed: true };
}

runTest('Visitante da Unidade A tentando acessar Unidade B é bloqueado com 403', () => {
  const visitorA = { id: 'u1', accessLevel: 'visitante', institutionId: 'obra-unida-monte-alto' };
  const res = simulateTenantGuard(visitorA, 'obra-unida-taquaritinga');
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'A conta de portaria está restrita à sua Obra Unida vinculada.');
});

runTest('Visitante da Unidade A acessando a própria Unidade A é liberado', () => {
  const visitorA = { id: 'u1', accessLevel: 'visitante', institutionId: 'obra-unida-monte-alto' };
  const res = simulateTenantGuard(visitorA, 'obra-unida-monte-alto');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.allowed, true);
});

// 2. Simulação da Sanitização de Prontuário para Visitante (server.ts)
console.log('\n--- 2. Simulação de Sanitização de Payload do Residente ---');

function sanitizeResidentForVisitor(rawResident) {
  return {
    id: rawResident.id,
    name: rawResident.name || '',
    status: rawResident.status || 'ativo',
    relatives: Array.isArray(rawResident.relatives)
      ? rawResident.relatives.filter((relative) => !relative?.deceased)
      : [],
    visitRecords: Array.isArray(rawResident.visitRecords) ? rawResident.visitRecords : []
  };
}

runTest('Sanitização remove prontuário médico, pia, evoluções e mantém apenas parentes vivos e visitas', () => {
  const rawResident = {
    id: 'res-101',
    name: 'José de Souza',
    status: 'ativo',
    cpf: '111.222.333-44',
    medicalRecord: { diagnoses: ['Hipertensão'], cid: 'I10' },
    piaData: { generalObjectives: 'Socialização' },
    socialWork: { confidential: true },
    relatives: [
      { id: 'rel-1', name: 'Maria Souza', kinship: 'Filha', deceased: false },
      { id: 'rel-2', name: 'Carlos Souza', kinship: 'Filho', deceased: true } // Deve ser filtrado
    ],
    visitRecords: [
      { id: 'vis-1', visitorName: 'Maria Souza', date: '2026-10-04' }
    ]
  };

  const sanitized = sanitizeResidentForVisitor(rawResident);

  assert.strictEqual(sanitized.id, 'res-101');
  assert.strictEqual(sanitized.name, 'José de Souza');
  assert.strictEqual(sanitized.medicalRecord, undefined);
  assert.strictEqual(sanitized.piaData, undefined);
  assert.strictEqual(sanitized.socialWork, undefined);
  assert.strictEqual(sanitized.cpf, undefined);
  assert.strictEqual(sanitized.relatives.length, 1);
  assert.strictEqual(sanitized.relatives[0].name, 'Maria Souza');
  assert.strictEqual(sanitized.visitRecords.length, 1);
});

// 3. Simulação do Merge Seguro de Atualização de Residentes (server.ts)
console.log('\n--- 3. Simulação de Merge Seguro da Portaria ---');

function simulatePortariaResidentMerge(existingData, incomingData) {
  const existingRelatives = Array.isArray(existingData.relatives) ? existingData.relatives : [];
  const incomingRelatives = Array.isArray(incomingData.relatives) ? incomingData.relatives : [];

  const incomingById = new Map();
  incomingRelatives.forEach((relative) => {
    if (relative?.id) incomingById.set(String(relative.id), relative);
  });

  const mergedRelatives = existingRelatives.map((existingRelative) => {
    const incoming = existingRelative?.id ? incomingById.get(String(existingRelative.id)) : undefined;
    if (!incoming) return existingRelative;

    return {
      ...existingRelative,
      name: incoming.name ?? existingRelative.name,
      kinship: incoming.kinship ?? existingRelative.kinship,
      phone: incoming.phone ?? existingRelative.phone,
      document: incoming.document ?? existingRelative.document,
      photoUrl: incoming.photoUrl ?? existingRelative.photoUrl,
      faceDescriptor: incoming.faceDescriptor ?? existingRelative.faceDescriptor
      // Não sobrescreve isResponsible nem deceased
    };
  });

  const existingRelativeIds = new Set(existingRelatives.map((relative) => String(relative?.id || '')).filter(Boolean));
  incomingRelatives.forEach((incoming) => {
    if (!incoming?.id || existingRelativeIds.has(String(incoming.id))) return;
    mergedRelatives.push({
      id: String(incoming.id),
      name: incoming.name || '',
      kinship: incoming.kinship || 'Familiar',
      phone: incoming.phone || '',
      document: incoming.document || '',
      photoUrl: incoming.photoUrl,
      faceDescriptor: incoming.faceDescriptor,
      observation: 'Cadastrado pela Portaria',
      isResponsible: false,
      deceased: false
    });
  });

  const existingVisitRecords = Array.isArray(existingData.visitRecords) ? existingData.visitRecords : [];
  const existingVisitIds = new Set(existingVisitRecords.map((visit) => String(visit?.id || '')).filter(Boolean));
  const incomingVisitRecords = Array.isArray(incomingData.visitRecords) ? incomingData.visitRecords : [];
  const newVisitRecords = incomingVisitRecords.filter((visit) => visit?.id && !existingVisitIds.has(String(visit.id)));
  const mergedVisitRecords = [...existingVisitRecords, ...newVisitRecords];

  return {
    relatives: mergedRelatives,
    visitRecords: mergedVisitRecords
  };
}

runTest('Merge não apaga parentes preexistentes e mantém isResponsible inalterado', () => {
  const existingData = {
    relatives: [
      { id: 'rel-1', name: 'Ana Silva', phone: '1111', isResponsible: true, deceased: false }
    ],
    visitRecords: [
      { id: 'v-1', visitorName: 'Ana Silva', date: '2026-10-01' }
    ]
  };

  const incomingData = {
    relatives: [
      { id: 'rel-1', name: 'Ana Silva Santos', phone: '2222', isResponsible: false, photoUrl: 'foto.jpg' }, // tenta mudar isResponsible
      { id: 'rel-2', name: 'Beto Silva', phone: '3333', isResponsible: true } // novo parente
    ],
    visitRecords: [
      { id: 'v-2', visitorName: 'Beto Silva', date: '2026-10-04' }
    ]
  };

  const result = simulatePortariaResidentMerge(existingData, incomingData);

  assert.strictEqual(result.relatives.length, 2);
  assert.strictEqual(result.relatives[0].name, 'Ana Silva Santos');
  assert.strictEqual(result.relatives[0].isResponsible, true); // PRESERVADO
  assert.strictEqual(result.relatives[0].photoUrl, 'foto.jpg');
  assert.strictEqual(result.relatives[1].name, 'Beto Silva');
  assert.strictEqual(result.relatives[1].isResponsible, false); // FORÇADO false
  assert.strictEqual(result.relatives[1].deceased, false); // FORÇADO false
  assert.strictEqual(result.visitRecords.length, 2);
  assert.strictEqual(result.visitRecords[0].id, 'v-1');
  assert.strictEqual(result.visitRecords[1].id, 'v-2');
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES FUNCIONAIS: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');
