const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacements = [
  {
    find: "app.post('/api/global-visits', async (req, res) => {",
    replace: "app.post('/api/global-visits', requireRole(['visitante', 'enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'administrador', 'medico']), async (req, res) => {"
  },
  {
    find: "const docRef = await db.collection('global_visits').add(data);\n      res.json({ ...data, id: docRef.id });",
    replace: "const docRef = await db.collection('global_visits').add(data);\n      await logAudit('create', 'global_visits', docRef.id, req, data.institutionId, `Nova visita registrada`);\n      res.json({ ...data, id: docRef.id });"
  },
  {
    find: "app.post('/api/support/messages', async (req, res) => {",
    replace: "app.post('/api/support/messages', requireRole(['administrador', 'gerencial', 'enfermeira']), async (req, res) => {"
  },
  {
    find: "const docRef = await db.collection('support_messages').add(data);\n      res.json({ ...data, id: docRef.id });",
    replace: "const docRef = await db.collection('support_messages').add(data);\n      await logAudit('create', 'support_messages', docRef.id, req, data.institutionId, `Nova solicitação de suporte`);\n      res.json({ ...data, id: docRef.id });"
  },
  {
    find: "const docRef = await db.collection('agenda_events').add(data);\n      res.json({ ...data, id: docRef.id });",
    replace: "const docRef = await db.collection('agenda_events').add(data);\n      await logAudit('create', 'agenda_events', docRef.id, req, data.institutionId, `Novo evento na agenda`);\n      res.json({ ...data, id: docRef.id });"
  },
  {
    find: "app.post('/api/agenda', async (req, res) => {",
    replace: "app.post('/api/agenda', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req, res) => {"
  },
  {
    find: "const docRef = await db.collection('group_activities').add(data);\n      res.json({ ...data, id: docRef.id });",
    replace: "const docRef = await db.collection('group_activities').add(data);\n      await logAudit('create', 'group_activities', docRef.id, req, data.institutionId, `Nova atividade em grupo registrada`);\n      res.json({ ...data, id: docRef.id });"
  },
  {
    find: "app.post('/api/groupActivities', async (req, res) => {",
    replace: "app.post('/api/groupActivities', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req, res) => {"
  },
  {
    find: "app.post('/api/inventory/bulk', async (req, res) => {",
    replace: "app.post('/api/inventory/bulk', requireRole(['enfermeira', 'gerencial', 'administrador']), async (req, res) => {"
  }
];

let modified = false;
for (const r of replacements) {
  if (code.includes(r.find)) {
    code = code.replace(r.find, r.replace);
    modified = true;
  } else {
    console.warn(`Could not find snippet: ${r.find.substring(0, 50)}...`);
  }
}

if (modified) {
  fs.writeFileSync('server.ts', code, 'utf8');
  console.log('Replacements applied successfully');
}
