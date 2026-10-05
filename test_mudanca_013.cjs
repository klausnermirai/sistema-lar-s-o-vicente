const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const check = (ok, name) => {
  if (ok) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

const root = __dirname;
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const visitor = fs.readFileSync(path.join(root, 'components', 'VisitorPortal.tsx'), 'utf8');

check(server.includes("db.collection('global_visits').doc(visitId)"), 'visita global usa id fixo');
check(server.includes("existingVisit.exists ? 'update' : 'create'"), 'retry da visita é idempotente');
check(visitor.includes("const visitId = `visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;"), 'frontend gera id da operação');
check(visitor.includes("id: visitId,") && visitor.includes("existingIndex = currentVisitRecords.findIndex"), 'ficha do residente reutiliza e deduplica o mesmo id');

check(server.includes("muralMessageId: muralRef.id"), 'atendimento institucional guarda vínculo do mural');
check(server.includes("sourceType: 'social_work'"), 'mensagem do mural guarda origem');
check(server.includes("sourceRecordId: recordId"), 'mensagem do mural guarda recordId');
check(server.includes("updatedMuralPayload"), 'edição prepara atualização do mural');
check(server.includes("messages.filter((msg: any) => msg.id !== current.muralMessageId)"), 'exclusão remove mensagem do cache');
check(server.includes("else if (current.muralMessageId)"), 'legados sem muralMessageId não forçam sincronização');

check(visitor.includes("timeZone: 'America/Sao_Paulo'"), 'data local usa fuso de São Paulo');
check(visitor.includes("new Intl.DateTimeFormat('sv-SE'"), 'data local permanece YYYY-MM-DD');
check(visitor.includes("date: now.toISOString(),"), 'timestamp global continua em ISO');

console.log('\nMudança 013:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);
