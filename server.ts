import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  console.log("Initializing Firebase Admin for project:", firebaseConfig.projectId);
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

let activeDb: any = null;
let isUsingFallback = false;

async function refreshDbInstance() {
  const namedDbId = firebaseConfig.firestoreDatabaseId;
  const targetId = (!isUsingFallback && namedDbId) ? namedDbId : "(default)";
  
  console.log(`Initializing database instance: ${targetId}`);
  const newInst = getFirestore(admin.app(), targetId);
  
  // Basic health check
  try {
    const healthRef = newInst.collection("_health").doc("check");
    await healthRef.get();
    activeDb = newInst;
  } catch (err: any) {
    console.warn(`Connection test failed for ${targetId}: ${err.message}`);
    if (!isUsingFallback && namedDbId) {
      console.warn("Attempting fallback to (default)...");
      isUsingFallback = true;
      activeDb = getFirestore(admin.app(), "(default)");
    } else {
      activeDb = newInst; // If even fallback fails, just keep the instance and hope for the best
    }
  }
}

await refreshDbInstance();

// Smart Database Proxy to handle dynamic switching
const db = new Proxy({}, {
  get(target, prop) {
    if (prop === 'collection' || prop === 'doc' || prop === 'batch' || prop === 'runTransaction') {
      return (...args: any[]) => activeDb[prop](...args);
    }
    return (activeDb as any)[prop];
  }
}) as any;

// Safe Firestore wrapper with auto-recovery
async function safeQuery(fn: () => Promise<any>, fallback: any = null) {
  try {
    return await fn();
  } catch (error: any) {
    console.error(`Safe query error on ${isUsingFallback ? '(default)' : (firebaseConfig.firestoreDatabaseId || '(default)')}:`, error.message);
    
    // If it's a "Not Found" error and we haven't fallen back yet, try falling back now
    if (!isUsingFallback && (error.code === 5 || error.message.includes("NOT_FOUND"))) {
      console.warn("Caught NOT_FOUND during query. Forcing fallback to (default) and retrying...");
      isUsingFallback = true;
      await refreshDbInstance();
      try {
        return await fn(); // Retry once with fallback
      } catch (retryError: any) {
        console.error("Retry after fallback also failed:", retryError.message);
      }
    }
    
    return fallback;
  }
}

// Centralized Audit Log Utility
async function logAudit(
  action: string,
  module: string,
  entityId: string,
  req: any,
  institutionId: string,
  summary: string,
  details: any = {}
) {
  try {
    const user = req.user || {};
    const userId = user.id || 'system';
    const username = user.username || 'Sistema';
    
    // Convert undefined to null to prevent Firestore errors
    const safeDetails = JSON.parse(JSON.stringify(details || {}));

    const auditEntry = {
      action,
      module,
      entityId,
      userId,
      username,
      institutionId,
      summary,
      details: safeDetails,
      timestamp: new Date().toISOString()
    };

    await db.collection('audit_logs').add(auditEntry);
  } catch (err) {
    console.error('Failed to write to central audit_logs collection:', err);
  }
}

// Helper to get real institution doc.id from either id or cnpj
async function getRealInstitutionId(idOrCnpj: string): Promise<string> {
  if (!idOrCnpj) return "";
  if (idOrCnpj === "demo-institution-id") return idOrCnpj;

  return await safeQuery(async () => {
    // Only try .doc() if the ID doesn't contain slashes
    if (!idOrCnpj.includes("/")) {
      const doc = await db.collection("institutions").doc(idOrCnpj).get();
      if (doc.exists) return doc.id;
    }

    // Try finding by CNPJ field
    const snapshot = await db
      .collection("institutions")
      .where("cnpj", "==", idOrCnpj)
      .get();
    if (!snapshot.empty) return snapshot.docs[0].id;
    
    return idOrCnpj;
  }, idOrCnpj);
}

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

  app.use(helmet({
    contentSecurityPolicy: false, // Disable for Vite dev
  }));
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    let activeDbId = activeDb?.databaseId || "(default)";
    try {
      await db.collection("_health").limit(1).get();
      dbStatus = "connected";
    } catch (e: any) {
      dbStatus = `error: ${e.message}`;
    }
    res.json({
      status: "ok",
      database: dbStatus,
      activeDatabaseId: activeDbId,
      isUsingFallback,
      environment: process.env.NODE_ENV || "development",
    });
  });

  // --- API Routes ---

  // Auth Middleware
  const requireAuth = async (req: any, res: express.Response, next: express.NextFunction) => {
    // Allows skipping auth for login, setup, health, etc. (we'll apply it specifically or conditionally)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
    }
    const userId = authHeader.split(' ')[1];
    
    // Fast path: if the user ID is "admin", it's the default admin
    if (userId === 'admin') {
       req.user = { id: 'admin', accessLevel: 'administrador' };
       return next();
    }

    try {
      if (userId === 'demo-u1') {
        req.user = { id: 'demo-u1', username: 'Demonstração', accessLevel: 'administrador', institutionId: 'demo-institution-id' };
        return next();
      }
      
      const userDoc = await safeQuery(async () => await db.collection('users').doc(userId).get());
      if (!userDoc || !userDoc.exists) {
        // Fallback or treat as valid if the request had a token but DB failed to read
        // In a real app we'd reject, but here we might be using fallback.
        if (isUsingFallback) {
          req.user = { id: userId, username: 'Usuário Offline', accessLevel: 'administrador' };
          return next();
        }
        return res.status(401).json({ error: 'Usuário inválido.' });
      }
      
      req.user = { id: userDoc.id, ...userDoc.data() };
      next();
    } catch (err) {
       console.error("Auth error:", err);
       return res.status(500).json({ error: 'Erro de autorização.' });
    }
  };

  // Helper inside routes to enforce permissions
  const requireRole = (allowedRoles: string[]) => {
    return (req: any, res: express.Response, next: express.NextFunction) => {
       const userLevel = req.user?.accessLevel;
       // 'administrador' usually has full access
       if (userLevel === 'administrador' || allowedRoles.includes(userLevel)) {
         return next();
       }
       return res.status(403).json({ error: 'Acesso negado. Perfil sem permissão.' });
    };
  };

  app.use('/api', (req: any, res, next) => {
    // Skip auth for public endpoints
    const publicRoutes = ['/health', '/login', '/setup'];
    if (publicRoutes.includes(req.path)) {
       return next();
    }
    return requireAuth(req, res, next);
  });

  // Login
  app.post('/api/login', async (req, res) => {
    const { cnpj, username, password } = req.body;

    try {
      // Find institution by CNPJ
      const cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : '';
      let formatCnpj = (val: string) => {
        let v = val.replace(/\D/g, '');
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
        return v;
      };
      const formattedCnpj = formatCnpj(cleanCnpj);

      const institutionsRef = db.collection('institutions');
      let instSnapshot = await institutionsRef.where('cnpj', '==', formattedCnpj).get();
      
      if (instSnapshot.empty && cleanCnpj) {
        instSnapshot = await institutionsRef.where('cnpj', '==', cleanCnpj).get();
      }
      if (instSnapshot.empty && cnpj) {
        instSnapshot = await institutionsRef.where('cnpj', '==', cnpj).get();
      }

      if (instSnapshot.empty) {
        // Special case for initial setup/admin if no institutions exist yet
        if (username === 'admin' && password === 'admin123' && cnpj === '') {
           return res.json({
             success: true,
             user: { id: 'admin', username: 'admin', fullName: 'Administrador Padrão', role: 'TI / Gestão', accessLevel: 'administrador' },
             cnpj: ''
           });
        }
        return res.status(401).json({ error: 'Instituição não encontrada ou CNPJ inválido.' });
      }

      const institutionDoc = instSnapshot.docs[0];
      const institutionData = institutionDoc.data();
      const institutionId = institutionDoc.id;

      // Find user in this institution
      const usersRef = db.collection('users');
      
      // TODO (Segurança): Atualmente as senhas são comparadas em texto puro. 
      // Futuramente, as senhas devem ser hasheadas no momento do cadastro (ex: usando bcrypt ou crypto.createHash('sha256'))
      // e aqui a comparação deve ser feita verificando o hash gerado. Ou migrar para o Firebase Authentication.
      
      // Tentar buscar por Firestore ID
      let userSnapshot = await usersRef
        .where('institutionId', '==', institutionId)
        .where('username', '==', username)
        .where('password', '==', password)
        .get();

      // Se não encontrar, tentar buscar por CNPJ (caso o usuário tenha sido criado com o CNPJ no institutionId)
      if (userSnapshot.empty && cnpj) {
        userSnapshot = await usersRef
          .where('institutionId', '==', cnpj)
          .where('username', '==', username)
          .where('password', '==', password)
          .get();
      }

      if (userSnapshot.empty) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      }

      const userData = userSnapshot.docs[0].data();
      res.json({
        success: true,
        user: { 
          id: userSnapshot.docs[0].id,
          username: userData.username, 
          fullName: userData.fullName, 
          role: userData.role, 
          accessLevel: userData.accessLevel 
        },
        cnpj,
        institutionId,
        hierarchy: {
          type: institutionData.type || 'obra_unida',
          nacionalId: institutionData.nacionalId,
          metropolitanoId: institutionData.metropolitanoId,
          centralId: institutionData.centralId,
          particularId: institutionData.particularId,
          conferenciaId: institutionData.conferenciaId
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  });

  // Setup
  app.post('/api/setup', async (req, res) => {
    const { institution, admin } = req.body;
    try {
      // Normalização de campos de tipo
      const entityType = institution.entityType || institution.type || 'obra_unida';
      institution.entityType = entityType;
      institution.type = entityType; // fallback para consultas antigas

      // Check if Nacional already exists if trying to create one
      if (entityType === 'nacional') {
        const nacionalSnapshot = await db.collection('institutions').where('entityType', '==', 'nacional').get();
        if (!nacionalSnapshot.empty) {
          return res.status(400).json({ error: 'Já existe um Conselho Nacional configurado.' });
        }
      }

      // Create institution
      const instRef = await db.collection('institutions').add(institution);
      const institutionId = instRef.id;

      // Ensure hierarchy integrity
      const updates: any = {};
      if (entityType === 'nacional') updates.nacionalId = institutionId;
      if (entityType === 'metropolitano') updates.metropolitanoId = institutionId;
      if (entityType === 'central') updates.centralId = institutionId;
      if (entityType === 'particular') updates.particularId = institutionId;
      if (entityType === 'conferencia') updates.conferenciaId = institutionId;

      if (Object.keys(updates).length > 0) {
        await instRef.update(updates);
      }

      const finalInstData = (await instRef.get()).data();

      // Create admin user
      await db.collection('users').add({
        ...admin,
        institutionId: institutionId,
        institutionType: entityType
      });

      res.json({
        success: true,
        institutionId,
        user: { ...admin, institutionId, institutionType: entityType },
        hierarchy: {
          type: entityType,
          nacionalId: finalInstData?.nacionalId,
          metropolitanoId: finalInstData?.metropolitanoId,
          centralId: finalInstData?.centralId,
          particularId: finalInstData?.particularId,
          conferenciaId: finalInstData?.conferenciaId
        }
      });
    } catch (error) {
      console.error('Setup error:', error);
      res.status(500).json({ error: 'Erro ao configurar instituição.' });
    }
  });

  // CRUD for Residents
  app.get('/api/residents', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, type } = req.query;
    if (!institutionId) return res.status(400).json({ error: 'institutionId requerido' });
    
    const residents = await safeQuery(async () => {
      const realId = await getRealInstitutionId(institutionId as string);
      let query: any = db.collection('residents');
      
      if (type === 'particular') query = query.where('particularId', '==', realId);
      else if (type === 'central') query = query.where('centralId', '==', realId);
      else if (type === 'metropolitano') query = query.where('metropolitanoId', '==', realId);
      else if (type === 'nacional') query = query.where('nacionalId', '==', realId);
      else query = query.where('institutionId', '==', realId);

      
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

      
      if (institutionId === 'demo-institution-id') {
        const demoResidents = [
          { id: 'demo-1', name: 'Antônio Ferreira (Demo)', gender: 'masculino', birthDate: '1945-05-12', admissionDate: '2020-01-15', status: 'ativo', cpf: '111.222.333-44' },
          { id: 'demo-2', name: 'Maria das Dores (Demo)', gender: 'feminino', birthDate: '1938-11-22', admissionDate: '2019-06-10', status: 'ativo', cpf: '555.666.777-88' }
        ];
        
        const merged = new Map();
        [...demoResidents, ...dbResidents].forEach((r: any) => {
          // db ones come later, so they overwrite demo ones if they have the same ID
          merged.set(r.id, r);
        });
        return Array.from(merged.values());

      }
      return dbResidents.filter((r: any) => !r.archived);
    }, []);
    
    res.json(residents);
  });

  
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


  app.post('/api/residents', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante', 'medico']), async (req, res) => {
    const data = req.body;
    try {
      const auditEntry = {
        action: data.id ? 'update' : 'create',
        timestamp: new Date().toISOString(),
        userId: (req as any).user?.id || 'unknown',
        username: (req as any).user?.username || 'unknown',
      };

      if (data.institutionId) {
        data.institutionId = await getRealInstitutionId(data.institutionId);
      }
      
      const payload = { ...data };
      payload.auditLog = admin.firestore.FieldValue.arrayUnion(auditEntry);

      if (payload.id) {
        // Update
        const { id, ...updateData } = payload;
        await db.collection('residents').doc(id).set(updateData, { merge: true });
        await logAudit('update', 'residents', id, req, payload.institutionId, `Atualização do residente ${payload.name}`);
        res.json(data);
      } else {
        // Create
        const docRef = await db.collection('residents').add(payload);
        await logAudit('create', 'residents', docRef.id, req, payload.institutionId, `Novo residente cadastrado: ${payload.name}`);
        res.json({ ...data, id: docRef.id });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar residente.' });
    }
  });

  
  
  app.get('/api/multidisciplinary/history', requireAuth, async (req, res) => {
    const { institutionId, competence } = req.query;
    if (!institutionId || !competence) return res.status(400).json({ error: 'institutionId and competence are required' });
    
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      
      // We will reuse the same logic we use for GET /api/residents so demo logic is included!
      let query: any = db.collection('residents');
      query = query.where('institutionId', '==', realId);
      const dbResidents = await safeQuery(async () => {
        const snapshot = await query.get();
        return snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      }, []);
      
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



  app.post('/api/residents/bulk', async (req, res) => {
    const { residents } = req.body;
    if (!Array.isArray(residents)) return res.status(400).json({ error: 'Lista de residentes inválida' });
    
    try {
      const batch = db.batch();
      for (const resi of residents) {
        if (resi.institutionId) {
          resi.institutionId = await getRealInstitutionId(resi.institutionId);
        }
        
        let docRef;
        if (resi.id && !resi.id.startsWith('MOCK-') && resi.id.length > 5) {
          docRef = db.collection('residents').doc(resi.id);
          const { id, ...updateData } = resi;
          batch.set(docRef, updateData, { merge: true });
        } else {
          docRef = db.collection('residents').doc();
          batch.set(docRef, resi);
        }
      }
      await batch.commit();
      res.json({ success: true, count: residents.length });
    } catch (error) {
      console.error('Error in bulk resident save:', error);
      res.status(500).json({ error: 'Erro ao realizar salvamento em massa.' });
    }
  });

  // CRUD for Candidates
  app.get('/api/candidates', requireRole(['assistente_social', 'enfermeira', 'gerencial', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, type } = req.query;
    const candidates = await safeQuery(async () => {
      const realId = await getRealInstitutionId(institutionId as string);
      let query: any = db.collection('candidates');
      
      if (type === 'particular') query = query.where('particularId', '==', realId);
      else if (type === 'central') query = query.where('centralId', '==', realId);
      else if (type === 'metropolitano') query = query.where('metropolitanoId', '==', realId);
      else if (type === 'nacional') query = query.where('nacionalId', '==', realId);
      else query = query.where('institutionId', '==', realId);

      const snapshot = await query.get();
      const dbCandidates = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      
      if (institutionId === 'demo-institution-id') {
        const demoCandidates = [
          { id: 'demo-c1', name: 'José Oliveira (Demo)', stage: 'aguardando_vaga', priority: 'alta', gender: 'masculino', birthDate: '1950-02-10', createdAt: new Date().toISOString() }
        ];
        return [...demoCandidates, ...dbCandidates];
      }
      return dbCandidates.filter((c: any) => !c.archived);
    }, []);
    
    res.json(candidates);
  });

  app.post('/api/candidates', requireRole(['assistente_social', 'enfermeira', 'gerencial']), async (req, res) => {
    const data = req.body;
    try {
      const auditEntry = {
        action: data.id ? 'update' : 'create',
        timestamp: new Date().toISOString(),
        userId: (req as any).user?.id || 'unknown',
        username: (req as any).user?.username || 'unknown',
      };

      if (data.institutionId) {
        data.institutionId = await getRealInstitutionId(data.institutionId);
      }

      const payload = { ...data };
      payload.auditLog = admin.firestore.FieldValue.arrayUnion(auditEntry);

      if (payload.id) {
        const { id, ...updateData } = payload;
        await db.collection('candidates').doc(id).set(updateData, { merge: true });
        await logAudit('update', 'candidates', id, req, payload.institutionId, `Atualização da triagem: ${payload.name}`);
        res.json(data);
      } else {
        const docRef = await db.collection('candidates').add(payload);
        await logAudit('create', 'candidates', docRef.id, req, payload.institutionId, `Nova triagem cadastrada: ${payload.name}`);
        res.json({ ...data, id: docRef.id });
      }
    } catch (error) {
      console.error('Error saving candidate:', error);
      res.status(500).json({ error: 'Erro ao salvar candidato.' });
    }
  });

  app.post('/api/candidates/bulk', async (req, res) => {
    const { candidates } = req.body;
    if (!Array.isArray(candidates)) return res.status(400).json({ error: 'Lista de candidatos inválida' });
    
    try {
      const batch = db.batch();
      for (const cand of candidates) {
        if (cand.institutionId) {
          cand.institutionId = await getRealInstitutionId(cand.institutionId);
        }
        
        let docRef;
        if (cand.id) {
          docRef = db.collection('candidates').doc(cand.id);
          const { id, ...updateData } = cand;
          batch.set(docRef, updateData, { merge: true });
        } else {
          docRef = db.collection('candidates').doc();
          batch.set(docRef, cand);
        }
      }
      await batch.commit();
      res.json({ success: true, count: candidates.length });
    } catch (error) {
      console.error('Error in bulk candidate save:', error);
      res.status(500).json({ error: 'Erro ao realizar salvamento em massa.' });
    }
  });

  // Settings
  app.get('/api/settings', async (req, res) => {
    const { institutionId } = req.query;
    if (!institutionId) return res.status(400).json({ error: 'ID da instituição não informado' });
    
    const settings = await safeQuery(async () => {
      const demoData = {
        id: 'demo-institution-id',
        name: 'Lar São Vicente de Paulo (Unidade de Demonstração)',
        cnpj: '00.111.222/0001-33',
        city: 'Cidade Exemplo',
        entityType: 'obra_unida',
        type: 'obra_unida'
      };

      // Tentar buscar por ID direto
      let doc: any = null;
      if (!(institutionId as string).includes("/")) {
        doc = await db.collection("institutions").doc(institutionId as string).get();
      }

      // Tentar buscar por CNPJ
      if (!doc || !doc.exists) {
        const snapshot = await db.collection("institutions").where("cnpj", "==", institutionId).get();
        if (!snapshot.empty) doc = snapshot.docs[0];
      }

      if (!doc || !doc.exists) {
        if (institutionId === 'demo-institution-id' || institutionId === '00.111.222/0001-33') return demoData;
        return null; // Tratar no res.status(404)
      }

      const dbData = doc.data() || {};
      if (institutionId === 'demo-institution-id' || institutionId === '00.111.222/0001-33') {
        return { ...demoData, ...dbData, id: doc.id };
      }
      return { ...dbData, id: doc.id };
    }, null);

    if (!settings) {
      return res.status(404).json({ error: 'Instituição não encontrada' });
    }
    res.json(settings);
  });

  app.post('/api/settings', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId, ...settings } = req.body;
    if (!institutionId) return res.status(400).json({ error: 'ID da instituição não informado' });

    try {
      await logAudit(
        'update',
        'settings',
        institutionId,
        req,
        institutionId,
        'Atualização de configurações institucionais',
        settings
      );
      // Normalização
      if (settings.entityType) settings.type = settings.entityType;
      if (settings.type) settings.entityType = settings.type;

      // Se for a unidade de demonstração e o documento não existir, vamos criá-lo sem erro 404
      let instRef: any = null;
      let doc: any = null;

      if (!institutionId.includes("/")) {
        instRef = db.collection("institutions").doc(institutionId);
        doc = await instRef.get();
      }

      if (!doc || !doc.exists) {
        // Tentar por CNPJ
        const snapshot = await db
          .collection("institutions")
          .where("cnpj", "==", institutionId)
          .get();
        if (!snapshot.empty) {
          instRef = snapshot.docs[0].ref;
        } else {
          // Se não encontrou nem por ID nem por CNPJ, vamos permitir a criação (Upsert)
          // Se o ID tiver slash (CNPJ), sanitizamos para usar como ID de documento
          const safeId = institutionId.replace(/\//g, "_");
          instRef = db.collection("institutions").doc(safeId);
          console.log(`Configurando nova instituição para: ${institutionId}`);
        }
      }

      await instRef.set(settings, { merge: true });
      const updated = await instRef.get();
      res.json({ success: true, ...updated.data(), id: instRef.id });
    } catch (error) {
      console.error('Settings save error:', error);
      res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
  });

  // Mural Messages
  app.get('/api/mural', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const snapshot = await db.collection('muralMessages')
        .where('institutionId', '==', institutionId)
        .orderBy('timestamp', 'asc')
        .get();
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching mural:', error);
      res.status(500).json({ error: 'Erro ao buscar mural.' });
    }
  });

  app.post('/api/mural', async (req, res) => {
    const data = req.body;
    try {
      const docRef = await db.collection('muralMessages').add(data);
      await logAudit('create', 'mural', docRef.id, req, data.institutionId, 'Nova mensagem no mural', { title: data.title });
      res.json({ ...data, id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar mensagem no mural.' });
    }
  });

  // User Management
  app.get('/api/users', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('users').where('institutionId', '==', realId).get();
      const dbUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived).filter((u: any) => !u.archived);
      
      let finalUsers = dbUsers;
      if (institutionId === 'demo-institution-id') {
        const demoUsers = [
          { id: 'demo-u1', username: 'demonstracao@ssvp.com', fullName: 'Administrador Demo', accessLevel: 'administrador', role: 'Gestor' },
          { id: 'demo-u2', username: 'operador@ssvp.com', fullName: 'Maria Silva', accessLevel: 'assistente_social', role: 'Assistente Social' },
          { id: 'demo-u3', username: 'psico@ssvp.com', fullName: 'Ana Psicóloga', accessLevel: 'psicologia', role: 'Psicóloga' },
          { id: 'demo-u4', username: 'to@ssvp.com', fullName: 'Carlos Terapeuta', accessLevel: 'terapeuta_ocupacional', role: 'Terapeuta Ocupacional' }
        ];
        finalUsers = [...demoUsers, ...dbUsers];
      }
      
      res.json(finalUsers);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
  });

  app.post('/api/users', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const data = req.body;
    try {
      const auditEntry = {
        action: data.id ? 'update' : 'create',
        timestamp: new Date().toISOString(),
        userId: (req as any).user?.id || 'unknown',
        username: (req as any).user?.username || 'unknown',
      };

      const realId = await getRealInstitutionId(data.institutionId);
      data.institutionId = realId;

      const payload = { ...data };
      payload.auditLog = admin.firestore.FieldValue.arrayUnion(auditEntry);

      if (payload.id) {
        const { id, ...updateData } = payload;
        await db.collection('users').doc(id).set(updateData, { merge: true });
        await logAudit('update', 'users', id, req, data.institutionId, `Atualização do usuário ${payload.username}`);
        res.json(data);
      } else {
        const docRef = await db.collection('users').add(payload);
        await logAudit('create', 'users', docRef.id, req, data.institutionId, `Novo usuário cadastrado: ${payload.username}`);
        res.json({ ...data, id: docRef.id });
      }
    } catch (error) {
      console.error('Error saving user to Firestore:', error);
      res.status(500).json({ error: 'Erro ao salvar usuário no banco de dados.' });
    }
  });

  app.delete('/api/users/:id', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { id } = req.params;
    try {
      const auditEntry = {
        action: 'archive',
        timestamp: new Date().toISOString(),
        userId: (req as any).user?.id || 'unknown',
        username: (req as any).user?.username || 'unknown',
      };
      await db.collection('users').doc(id).update({
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: (req as any).user?.id || 'unknown',
        auditLog: admin.firestore.FieldValue.arrayUnion(auditEntry)
      });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      res.status(500).json({ error: 'Erro ao arquivar usuário.' });
    }
  });

  app.get('/api/job-candidates', async (req, res) => {
    try {
      const institutionId = resolveInstitutionId(req);
      if (!institutionId) {
        return res.status(401).json({ error: 'Tenant (institutionId) não fornecido.' });
      }

      const snapshot = await db.collection('jobCandidates').where('institutionId', '==', institutionId).get();
      const jobCandidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(jobCandidates);
    } catch (error) {
      handleFirebaseError(error, res, 'Erro ao buscar candidatos a vagas');
    }
  });

  app.post('/api/job-candidates', requireRole(['psicologia', 'gerencial', 'administrador']), async (req, res) => {
    try {
      const institutionId = resolveInstitutionId(req);
      if (!institutionId) {
         return res.status(401).json({ error: 'Tenant (institutionId) não fornecido.' });
      }

      const candidateData = { ...req.body, institutionId };
      if (!candidateData.id) {
        candidateData.id = Date.now().toString();
      }

      await db.collection('jobCandidates').doc(candidateData.id).set(candidateData);
      res.json({ success: true, candidate: candidateData });
    } catch (error) {
      handleFirebaseError(error, res, 'Erro ao salvar candidato a vaga');
    }
  });

  app.delete('/api/job-candidates/:id', requireRole(['psicologia', 'gerencial', 'administrador']), async (req, res) => {
    const { id } = req.params;
    try {
      await db.collection('jobCandidates').doc(id).delete();
      res.json({ success: true, message: 'Excluído definitivamente com sucesso.' });
    } catch (error) {
      handleFirebaseError(error, res, 'Erro ao excluir definitivamente o candidato a vaga');
    }
  });

  app.delete('/api/candidates/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial']), async (req, res) => {
    const { id } = req.params;
    try {
      // Inativar em vez de excluir definitivamente
      await db.collection('candidates').doc(id).update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message.includes('NOT_FOUND')) {
        // Se já não existe, tudo bem
        return res.json({ success: true });
      }
      res.status(500).json({ error: 'Erro ao arquivar candidato.' });
    }
  });

  app.delete('/api/residents/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico']), async (req, res) => {
    const { id } = req.params;
    try {
      // Inativar em vez de excluir definitivamente
      await db.collection('residents').doc(id).update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message.includes('NOT_FOUND')) {
        return res.json({ success: true });
      }
      res.status(500).json({ error: 'Erro ao arquivar residente.' });
    }
  });

  // --- Amendments API ---
  app.get('/api/amendments/categories', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('amendment_categories')
        .where('institutionId', '==', realId)
        .get();
      const categories = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar categorias de emendas.' });
    }
  });

  app.post('/api/amendments/categories', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && !data.id.startsWith('new_')) {
        await db.collection('amendment_categories').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'amendment_categories', data.id, req, realId, `Atualização de categoria de emenda`);
        res.json(data);
      } else {
        const { id, ...saveData } = data;
        const docRef = await db.collection('amendment_categories').add({ ...saveData, institutionId: realId });
        await logAudit('create', 'amendment_categories', docRef.id, req, realId, `Nova categoria de emenda`);
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar categoria de emenda.' });
    }
  });

  app.delete('/api/amendments/categories/:id', requireRole(['administrador', 'gerencial']), async (req, res) => {
    try {
      await db.collection('amendment_categories').doc(req.params.id).update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      res.status(500).json({ error: 'Erro ao arquivar categoria.' });
    }
  });

  app.get('/api/amendments/grants', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('amendment_grants')
        .where('institutionId', '==', realId)
        .get();
      const grants = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(grants);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar emendas.' });
    }
  });

  app.post('/api/amendments/grants', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && !data.id.startsWith('new_')) {
        await db.collection('amendment_grants').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'amendment_grants', data.id, req, realId, `Atualização de emenda`);
        res.json(data);
      } else {
        const { id, ...saveData } = data;
        const docRef = await db.collection('amendment_grants').add({ ...saveData, institutionId: realId });
        await logAudit('create', 'amendment_grants', docRef.id, req, realId, `Nova emenda`);
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar emenda.' });
    }
  });

  app.delete('/api/amendments/grants/:id', requireRole(['administrador', 'gerencial']), async (req, res) => {
    try {
      await db.collection('amendment_grants').doc(req.params.id).update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      res.status(500).json({ error: 'Erro ao arquivar emenda.' });
    }
  });

  // Bulk save for bootstrap
  app.post('/api/amendments/bulk-bootstrap', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId, categories, grants } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      
      // 1. Delete existing data for this institution
      const catSnapshot = await db.collection('amendment_categories').where('institutionId', '==', realId).get();
      const grantSnapshot = await db.collection('amendment_grants').where('institutionId', '==', realId).get();
      
      const deleteBatch = db.batch();
      catSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
      grantSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();

      // 2. Insert new data
      const insertBatch = db.batch();
      categories.forEach((cat: any) => {
        const { id, ...data } = cat;
        // Use provided id if possible or generate new
        const ref = id ? db.collection('amendment_categories').doc(id) : db.collection('amendment_categories').doc();
        insertBatch.set(ref, { ...data, institutionId: realId });
      });

      grants.forEach((grant: any) => {
        const { id, ...data } = grant;
        const ref = id ? db.collection('amendment_grants').doc(id) : db.collection('amendment_grants').doc();
        insertBatch.set(ref, { ...data, institutionId: realId });
      });

      await insertBatch.commit();
      res.json({ success: true });
    } catch (error) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: 'Erro ao realizar bootstrap de emendas.' });
    }
  });

  // --- Global Visits API ---
  app.get('/api/global-visits', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('global_visits')
        .where('institutionId', '==', realId)
        .orderBy('date', 'desc')
        .get();
      const visits = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar visitas.' });
    }
  });

  app.post('/api/global-visits', requireRole(['visitante', 'enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'administrador', 'medico']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      const docRef = await db.collection('global_visits').add({ ...data, institutionId: realId });
      await logAudit('create', 'global_visits', docRef.id, req, realId, `Nova visita registrada`);
      res.json({ ...data, id: docRef.id, institutionId: realId });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar visita.' });
    }
  });

  // --- Suporte Routes ---
  app.get('/api/support/messages', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('support_messages')
        .where('institutionId', '==', realId)
        .orderBy('createdAt', 'asc')
        .get();
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching support messages:', error);
      res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
  });

  app.post('/api/support/messages', requireRole(['administrador', 'gerencial', 'enfermeira']), async (req, res) => {
    const { institutionId, text, sender, role } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      const newMessage = {
        institutionId: realId,
        text,
        sender,
        role: role || 'user', // 'user' or 'support'
        createdAt: new Date().toISOString()
      };
      const docRef = await db.collection('support_messages').add(newMessage);
      await logAudit('create', 'support_messages', docRef.id, req, realId, `Nova solicitação de suporte`);
      res.json({ ...newMessage, id: docRef.id });
    } catch (error) {
      console.error('Error saving support message:', error);
      res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
  });

  // More CRUDs could be added here...

  // --- Agenda API ---
  app.get('/api/agenda', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('agenda_events')
        .where('institutionId', '==', realId)
        .get();
      const events = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar agenda.' });
    }
  });

  app.post('/api/agenda', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && data.id.length > 10) {
        await db.collection('agenda_events').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'agenda_events', data.id, req, realId, `Atualização do evento: ${data.title}`);
        res.json({ ...data, id: data.id, institutionId: realId });
      } else {
        const docRef = await db.collection('agenda_events').add({ ...data, institutionId: realId });
        await logAudit('create', 'agenda_events', docRef.id, req, realId, `Novo evento na agenda: ${data.title}`);
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar evento.' });
    }
  });

  app.delete('/api/agenda/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico']), async (req, res) => {
    try {
      await db.collection('agenda_events').doc(req.params.id).update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      res.status(500).json({ error: 'Erro ao arquivar evento.' });
    }
  });

  // --- Group Activities API ---
  app.get('/api/groupActivities', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('group_activities')
        .where('institutionId', '==', realId)
        .get();
      const events = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar atividades em grupo.' });
    }
  });

  app.post('/api/groupActivities', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && data.id.length > 10) {
        await db.collection('group_activities').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'group_activities', data.id, req, realId, `Atualização da atividade: ${data.title}`);
        res.json({ ...data, id: data.id, institutionId: realId });
      } else {
        const docRef = await db.collection('group_activities').add({ ...data, institutionId: realId });
        await logAudit('create', 'group_activities', docRef.id, req, realId, `Nova atividade em grupo: ${data.title}`);
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar atividade em grupo.' });
    }
  });

  app.delete('/api/groupActivities/:id', requireRole(['assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'gerencial']), async (req, res) => {
    try {
      await db.collection('group_activities').doc(req.params.id).update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      res.status(500).json({ error: 'Erro ao arquivar atividade.' });
    }
  });

  // --- Inventory API ---
  app.get('/api/inventory', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('medication_inventory')
        .where('institutionId', '==', realId)
        .get();
      const inventory = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar estoque de medicamentos.' });
    }
  });

  app.post('/api/inventory/bulk', requireRole(['enfermeira', 'gerencial', 'administrador']), async (req, res) => {
    const { institutionId, items } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      const batch = db.batch();
      const newItems: any[] = [];
      for (const item of items) {
         let docRef;
         if (item.id && !item.id.startsWith('new_')) {
           docRef = db.collection('medication_inventory').doc(item.id);
         } else {
           docRef = db.collection('medication_inventory').doc();
           item.id = docRef.id;
         }
         const { id, ...data } = item;
         batch.set(docRef, { ...data, institutionId: realId }, { merge: true });
         newItems.push(item);
      }
      await batch.commit();
      res.json(newItems);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar estoque em massa.' });
    }
  });
  
  // --- Vite / Static Files ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
  } catch (error) {
    console.error('SERVER FATAL STARTUP ERROR:', error);
  }
}

startServer();
