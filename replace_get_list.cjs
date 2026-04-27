const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const residentsGet = `
      const snapshot = await query.get();
      const dbResidents = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        if (data.nutrition) {
            delete data.nutrition.evolutions;
            delete data.nutrition.attendances;
        }
        if (data.psychology) {
            delete data.psychology.evolutions;
            delete data.psychology.attendances;
        }
        if (data.occupationalTherapy) {
            delete data.occupationalTherapy.evolutions;
            delete data.occupationalTherapy.attendances;
        }
        if (data.physiotherapy) {
            delete data.physiotherapy.evolutions;
            delete data.physiotherapy.attendances;
        }
        delete data.piaData;
        delete data.medicalRecord;
        delete data.auditLog;
        return { ...data, id: doc.id };
      }).filter((item: any) => !item.archived);
`;

code = code.replace(
  "const snapshot = await query.get();\n      const dbResidents = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);",
  residentsGet
);

const routes = `
  app.get('/api/residents/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante', 'medico', 'administrador']), async (req, res) => {
    try {
      const doc = await db.collection('residents').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Residente não encontrado' });
      res.json({ ...doc.data(), id: doc.id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar residente' });
    }
  });

  app.get('/api/candidates/:id', requireRole(['assistente_social', 'enfermeira', 'gerencial', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'administrador']), async (req, res) => {
    try {
      const doc = await db.collection('candidates').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Candidato não encontrado' });
      res.json({ ...doc.data(), id: doc.id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar candidato' });
    }
  });
`;

code = code.replace(
  "app.post('/api/residents', requireRole",
  routes + "\n\n  app.post('/api/residents', requireRole"
);

fs.writeFileSync('server.ts', code);
