const fs = require('node:fs');
const assert = require('node:assert/strict');

const server = fs.readFileSync('server.ts', 'utf8');

const start = server.indexOf("app.post('/api/groupActivities'");
const end = server.indexOf('// Handovers API', start);
assert.ok(start >= 0 && end > start, 'Endpoint POST /api/groupActivities deve existir');

const block = server.slice(start, end);

assert.ok(block.includes("const existingDoc = await db.collection('group_activities').doc(data.id).get()"),
  'Deve verificar existência real do documento pelo ID');

assert.ok(block.includes('if (existingDoc.exists)'),
  'Edição deve ocorrer apenas quando o documento realmente existir');

assert.ok(!block.includes('data.id.length > 10'),
  'Não deve decidir criação/edição pelo tamanho do ID');

assert.ok(
  block.includes("await db.collection('group_activities').doc(data.id).set({ ...data, institutionId: realId });"),
  'Novo registro com ID fornecido deve ser criado usando o mesmo ID'
);

assert.ok(
  block.includes("await logAudit('create', 'group_activities', data.id"),
  'Criação com ID fornecido deve ser auditada como create'
);

assert.ok(
  block.includes("const docRef = await db.collection('group_activities').add({ ...data, institutionId: realId });"),
  'Criação sem ID deve continuar suportada'
);

console.log('PASS: Mudança 018B.1 distingue criação de edição pela existência real do documento.');
