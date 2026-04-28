const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const historyEndpoint = `
  app.get('/api/multidisciplinary/history', async (req, res) => {
    const { institutionId, competence } = req.query;
    if (!institutionId || !competence) return res.status(400).json({ error: 'institutionId and competence are required' });

    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('residents')
        .where('institutionId', '==', realId)
        .get();

      let events: any[] = [];
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const residentName = data.name;
        const residentId = doc.id;

        if (competence === 'psicologia' && data.psychology) {
          const p = data.psychology;
          (p.evolutions || []).forEach((e: any) => events.push({ ...e, type: 'Evolução', residentName, residentId, category: 'psicologia', timestamp: e.date }));
          (p.attendances || []).forEach((a: any) => events.push({ ...a, type: 'Atendimento', residentName, residentId, category: 'psicologia', timestamp: a.dateTime }));
          if (p.anamnese) events.push({ ...p.anamnese, type: 'Anamnese', residentName, residentId, category: 'psicologia', timestamp: p.anamnese.date });
        } else if (competence === 'nutricionista' && data.nutrition) {
          const n = data.nutrition;
          (n.evolutions || []).forEach((e: any) => events.push({ ...e, type: 'Evolução', residentName, residentId, category: 'nutricionista', timestamp: e.date }));
          (n.attendances || []).forEach((a: any) => events.push({ ...a, type: 'Atendimento', residentName, residentId, category: 'nutricionista', timestamp: a.dateTime }));
          if (n.initialAssessment) events.push({ ...n.initialAssessment, type: 'Avaliação Inicial', residentName, residentId, category: 'nutricionista', timestamp: n.initialAssessment.date });
        } else if (competence === 'fisioterapeuta' && data.physiotherapy) {
          const f = data.physiotherapy;
          (f.evolutions || []).forEach((e: any) => events.push({ ...e, type: 'Evolução', residentName, residentId, category: 'fisioterapeuta', timestamp: e.date }));
          (f.attendances || []).forEach((a: any) => events.push({ ...a, type: 'Atendimento', residentName, residentId, category: 'fisioterapeuta', timestamp: f.dateTime })); // physiotheraphy has singular attendance/evolutions sometimes in the code? Let's check
        } else if (competence === 'terapeuta_ocupacional' && data.occupationalTherapy) {
           const o = data.occupationalTherapy;
           (o.evolutions || []).forEach((e: any) => events.push({ ...e, type: 'Evolução', residentName, residentId, category: 'terapeuta_ocupacional', timestamp: e.date }));
           (o.attendances || []).forEach((a: any) => events.push({ ...a, type: 'Atendimento', residentName, residentId, category: 'terapeuta_ocupacional', timestamp: a.dateTime }));
        }
      });

      // Sort by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Limit to 20
      res.json(events.slice(0, 20));
    } catch (error) {
      console.error('Error fetching multidisciplinary history:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico multidisciplinar' });
    }
  });
`;

// Insert after the /api/residents routes
code = code.replace(
  "app.post('/api/residents/bulk'",
  historyEndpoint + "\n\n  app.post('/api/residents/bulk'"
);

fs.writeFileSync('server.ts', code);
