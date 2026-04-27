const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "app.post('/api/amendments/categories', async (req, res) => {",
  "app.post('/api/amendments/categories', requireRole(['administrador', 'gerencial']), async (req, res) => {"
);

code = code.replace(
  "await db.collection('amendment_categories').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });",
  "await db.collection('amendment_categories').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });\n        await logAudit('update', 'amendment_categories', data.id, req, realId, `Atualização de categoria de emenda`);"
);

code = code.replace(
  "const docRef = await db.collection('amendment_categories').add({ ...saveData, institutionId: realId });",
  "const docRef = await db.collection('amendment_categories').add({ ...saveData, institutionId: realId });\n        await logAudit('create', 'amendment_categories', docRef.id, req, realId, `Nova categoria de emenda`);"
);

code = code.replace(
  "app.post('/api/amendments/grants', async (req, res) => {",
  "app.post('/api/amendments/grants', requireRole(['administrador', 'gerencial']), async (req, res) => {"
);

code = code.replace(
  "await db.collection('amendment_grants').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });",
  "await db.collection('amendment_grants').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });\n        await logAudit('update', 'amendment_grants', data.id, req, realId, `Atualização de emenda`);"
);

code = code.replace(
  "const docRef = await db.collection('amendment_grants').add({ ...saveData, institutionId: realId });",
  "const docRef = await db.collection('amendment_grants').add({ ...saveData, institutionId: realId });\n        await logAudit('create', 'amendment_grants', docRef.id, req, realId, `Nova emenda`);"
);

code = code.replace(
  "app.post('/api/amendments/bulk-bootstrap', async (req, res) => {",
  "app.post('/api/amendments/bulk-bootstrap', requireRole(['administrador', 'gerencial']), async (req, res) => {"
);

fs.writeFileSync('server.ts', code, 'utf8');
