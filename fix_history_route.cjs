const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.get\('\/api\/multidisciplinary\/history', async \(req, res\) => \{[\s\S]*?res\.json\(events\.slice\(0, 20\)\);\s*\}\);\s*\n/;

const newHistoryHandler = `
  app.get('/api/multidisciplinary/history', requireAuth, async (req, res) => {
    const { institutionId, competence } = req.query;
    if (!institutionId || !competence) return res.status(400).json({ error: 'institutionId and competence are required' });
    
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      
      // We will reuse the same logic we use for GET /api/residents so demo logic is included!
      let query: any = db.collection('residents');
      query = query.where('institutionId', '==', realId);
      const snapshot = await query.get();
      const dbResidents = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      
      let allResidents = dbResidents;
      if (institutionId === 'demo-institution-id') {
        const demoResidents = [
          { id: 'demo-1', institutionId: 'demo-institution-id', name: 'Antônio Ferreira (Demo)', gender: 'masculino', birthDate: '1945-05-12', admissionDate: '2020-01-15', status: 'ativo', cpf: '111.222.333-44' },
          { id: 'demo-2', institutionId: 'demo-institution-id', name: 'Maria das Dores (Demo)', gender: 'feminino', birthDate: '1938-11-22', admissionDate: '2019-06-10', status: 'ativo', cpf: '555.666.777-88' }
        ];
        // If a db resident has same id as demo, the db one overrides it or is added. 
        // We will just process allResidents
        allResidents = [...demoResidents, ...dbResidents];
      }

      let events: any[] = [];
      allResidents.forEach((data: any) => {
        const residentName = data.name;
        const residentId = data.id;

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
          (f.attendances || []).forEach((a: any) => events.push({ ...a, type: 'Atendimento', residentName, residentId, category: 'fisioterapeuta', timestamp: a.dateTime }));
          if (f.initialAssessment) events.push({ ...f.initialAssessment, type: 'Avaliação Inicial', residentName, residentId, category: 'fisioterapeuta', timestamp: f.initialAssessment.date });
        } else if (competence === 'terapeuta_ocupacional' && data.occupationalTherapy) {
          const t = data.occupationalTherapy;
          (t.evolutions || []).forEach((e: any) => events.push({ ...e, type: 'Evolução', residentName, residentId, category: 'terapeuta_ocupacional', timestamp: e.date }));
          (t.attendances || []).forEach((a: any) => events.push({ ...a, type: 'Atendimento', residentName, residentId, category: 'terapeuta_ocupacional', timestamp: a.dateTime }));
          if (t.initialAssessment) events.push({ ...t.initialAssessment, type: 'Avaliação Inicial', residentName, residentId, category: 'terapeuta_ocupacional', timestamp: t.initialAssessment.date });
        }
      });
      
      // Sort by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Limit to 20
      res.json(events.slice(0, 20));
    } catch (error: any) {
      console.error('Error fetching multidisciplinary history:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico multidisciplinar', details: error.message });
    }
  });
`;

let hasReplaced = false;

server = server.replace(/app\.get\('\/api\/multidisciplinary\/history', async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: 'Erro ao buscar histórico multidisciplinar', details: error\.message \}\);\s*\}\s*\n*\s*\}\);/g, () => {
    hasReplaced = true;
    return newHistoryHandler;
});

// Fallback search if the previous did not match
if (!hasReplaced) {
    console.log("Fallback replacement...");
    server = server.replace(/app\.get\('\/api\/multidisciplinary\/history', async \(req, res\) => \{[\s\S]*?res\.json\(events\.slice\(0, 20\)\);\s*\}\);/, newHistoryHandler);
}

fs.writeFileSync('server.ts', server);
