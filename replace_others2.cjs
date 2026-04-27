const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacements = [
  {
    find: "const docRef = await db.collection('global_visits').add({ ...data, institutionId: realId });\n      res.json({ ...data, id: docRef.id, institutionId: realId });",
    replace: "const docRef = await db.collection('global_visits').add({ ...data, institutionId: realId });\n      await logAudit('create', 'global_visits', docRef.id, req, realId, `Nova visita registrada`);\n      res.json({ ...data, id: docRef.id, institutionId: realId });"
  },
  {
    find: "const docRef = await db.collection('support_messages').add({ ...data, institutionId: realId });\n      res.json({ ...data, id: docRef.id, institutionId: realId });",
    replace: "const docRef = await db.collection('support_messages').add({ ...data, institutionId: realId });\n      await logAudit('create', 'support_messages', docRef.id, req, realId, `Nova solicitação de suporte`);\n      res.json({ ...data, id: docRef.id, institutionId: realId });"
  },
  {
    find: "const docRef = await db.collection('agenda_events').add({ ...data, institutionId: realId });\n      res.json({ ...data, id: docRef.id, institutionId: realId });",
    replace: "const docRef = await db.collection('agenda_events').add({ ...data, institutionId: realId });\n      await logAudit('create', 'agenda_events', docRef.id, req, realId, `Novo evento na agenda`);\n      res.json({ ...data, id: docRef.id, institutionId: realId });"
  },
  {
    find: "const docRef = await db.collection('group_activities').add({ ...data, institutionId: realId });\n      res.json({ ...data, id: docRef.id, institutionId: realId });",
    replace: "const docRef = await db.collection('group_activities').add({ ...data, institutionId: realId });\n      await logAudit('create', 'group_activities', docRef.id, req, realId, `Nova atividade em grupo`);\n      res.json({ ...data, id: docRef.id, institutionId: realId });"
  }
];

for (const r of replacements) {
  if (code.includes(r.find)) {
    code = code.replace(r.find, r.replace);
  } else {
    console.warn(`Could not find snippet: ${r.find.substring(0, 50)}...`);
  }
}

fs.writeFileSync('server.ts', code, 'utf8');
