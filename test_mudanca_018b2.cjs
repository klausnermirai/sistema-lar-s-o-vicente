const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('server.ts', 'utf8');
const start = source.indexOf("app.post('/api/candidates'");
const end = source.indexOf("app.post('/api/candidates/bulk'", start);

assert(start >= 0 && end > start, 'Endpoint POST /api/candidates não localizado.');
const endpoint = source.slice(start, end);

assert(endpoint.includes("const existingDoc = await db.collection('candidates').doc(payload.id).get();"),
  'Deve consultar a existência real do candidato quando houver ID.');

assert(endpoint.includes("if (existingDoc.exists)"),
  'ID existente deve seguir explicitamente o fluxo de edição.');

assert(!endpoint.includes("if (!existingDoc.exists) {\n          return res.status(404)"),
  'ID novo não pode mais retornar 404 apenas por ainda não existir.');

assert(endpoint.includes("await db.collection('candidates').doc(id).set(createData);"),
  'ID fornecido e inexistente deve criar o documento usando o mesmo ID.');

assert(endpoint.includes("action: 'create'") && endpoint.includes("action: 'update'"),
  'Auditoria deve distinguir criação e edição.');

assert(endpoint.includes("isAuthorizedForDocument(user, existingData)"),
  'Autorização de edição deve ser preservada.');

assert(endpoint.includes("existingCanonical !== targetCanonical"),
  'Bloqueio de transferência de instituição deve ser preservado.');

assert(endpoint.includes("const docRef = await db.collection('candidates').add(payload);"),
  'Criação sem ID deve continuar suportada via add().');

assert(endpoint.includes("isUserAuthorizedForInstitution(user, targetInstId)"),
  'Validação de acesso ao tenant deve ser preservada.');

console.log('Mudança 018B.2: validação estrutural aprovada.');
