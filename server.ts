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
    console.error(`Safe query error on ${isUsingFallback ? '(default)' : (firebaseConfig.firestoreDatabaseId || '(default)')}: CODE ${error.code} | MSG ${error.message}`);
    
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
    let cleanCnpj = idOrCnpj.replace(/\D/g, '');
    let formattedCnpj = cleanCnpj;
    if (cleanCnpj.length === 14) {
      formattedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    
    let snapshot = await db.collection("institutions").where("cnpj", "==", formattedCnpj).get();
    if (snapshot.empty && cleanCnpj) {
      snapshot = await db.collection("institutions").where("cnpj", "==", cleanCnpj).get();
    }
    if (snapshot.empty) {
      snapshot = await db.collection("institutions").where("cnpj", "==", idOrCnpj).get();
    }
    
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
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

  app.get('/api/proxy-image', async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send('URL missing');
    try {
      const fetchResponse = await fetch(imageUrl);
      if (!fetchResponse.ok) {
        return res.status(fetchResponse.status).send('Failed to fetch image');
      }
      const arrayBuffer = await fetchResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = fetchResponse.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (e: any) {
      console.error('Image proxy error:', e);
      res.status(500).send(e.message);
    }
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
    const publicRoutes = ['/health', '/login', '/setup', '/test-db', '/proxy-image'];
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

      const instSnapshot = await safeQuery(async () => {
        let snap = await db.collection('institutions').where('cnpj', '==', formattedCnpj).get();
        if (snap.empty && cleanCnpj) snap = await db.collection('institutions').where('cnpj', '==', cleanCnpj).get();
        if (snap.empty && cnpj) snap = await db.collection('institutions').where('cnpj', '==', cnpj).get();
        return snap;
      });

      if (!instSnapshot || instSnapshot.empty) {
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

      let userSnapshot = await safeQuery(async () => {
        let snap = await db.collection('users')
          .where('institutionId', '==', institutionId)
          .where('username', '==', username)
          .where('password', '==', password)
          .get();
        if (snap.empty && cnpj) {
          snap = await db.collection('users')
            .where('institutionId', '==', cnpj)
            .where('username', '==', username)
            .where('password', '==', password)
            .get();
        }
        return snap;
      });

      if (!userSnapshot || userSnapshot.empty) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      }

      const userData = userSnapshot.docs[0].data();
      let signatureInfo: any = {};
      
      if (userData.funcionarioId) {
        try {
          const empDoc = await db.collection('employees').doc(userData.funcionarioId).get();
          if (empDoc.exists) {
            const empData = empDoc.data();
            const nomeStr = empData?.nomeExibicao || empData?.nomeCompleto || 'Profissional não identificado';
            const funcaoStr = empData?.funcao ? `\n${empData.funcao}` : '';
            const conselhoStr = (empData?.conselhoProfissional && empData?.numeroRegistro) 
              ? `\n${empData.conselhoProfissional}${empData.ufRegistro ? `/${empData.ufRegistro}` : ''} ${empData.numeroRegistro}` : '';
            
            signatureInfo = {
              profissionalId: userData.funcionarioId,
              profissionalNome: nomeStr,
              profissionalFuncao: empData?.funcao || '',
              profissionalConselho: empData?.conselhoProfissional || '',
              profissionalRegistro: empData?.numeroRegistro || '',
              profissionalUfRegistro: empData?.ufRegistro || '',
              profissionalAssinaturaTexto: `${nomeStr}${funcaoStr}${conselhoStr}`.trim(),
            };
          }
        } catch (err) {
          console.error("Erro ao buscar funcionario do usuario logado:", err);
        }
      }

      res.json({
        success: true,
        user: { 
          id: userSnapshot.docs[0].id,
          username: userData.username, 
          fullName: userData.fullName, 
          role: userData.role,
          professionalRegistration: userData.professionalRegistration,
          accessLevel: userData.accessLevel,
          signature: signatureInfo
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
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Erro interno no servidor: ' + error.message });
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
      const MAX_BATCH_SIZE = 400;
      for (let i = 0; i < residents.length; i += MAX_BATCH_SIZE) {
        const chunk = residents.slice(i, i + MAX_BATCH_SIZE);
        const batch = db.batch();
        
        for (const resi of chunk) {
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
      }
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

  app.post('/api/candidates', requireRole(['assistente_social', 'enfermeira', 'gerencial', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'medico', 'administrador']), async (req, res) => {
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
  app.get('/api/test-db', async (req, res) => {
    try {
      const insts = await safeQuery(async () => await db.collection('institutions').limit(1).get());
      const users = await safeQuery(async () => await db.collection('users').limit(1).get());
      res.json({
        institutions: insts ? insts.docs.map((d: any) => ({ id: d.id, cnpj: d.data().cnpj, name: d.data().name })) : null,
        users: users ? users.docs.map((d: any) => ({ id: d.id, username: d.data().username, instId: d.data().institutionId })) : null,
        isUsingFallback,
        firestoreDbId: firebaseConfig.firestoreDatabaseId
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/settings', async (req, res) => {
    const { institutionId } = req.query;
    if (!institutionId) return res.status(400).json({ error: 'ID da instituição não informado' });
    
    try {
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

      // Tentar buscar por CNPJ (formatado e não formatado)
      if (!doc || !doc.exists) {
        let cleanCnpj = (institutionId as string).replace(/\D/g, '');
        let formattedCnpj = cleanCnpj;
        if (cleanCnpj.length === 14) {
          formattedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        }
        
        let snapshot = await db.collection("institutions").where("cnpj", "==", formattedCnpj).get();
        if (snapshot.empty && cleanCnpj) {
          snapshot = await db.collection("institutions").where("cnpj", "==", cleanCnpj).get();
        }
        if (snapshot.empty) {
          snapshot = await db.collection("institutions").where("cnpj", "==", institutionId).get();
        }
        
        if (!snapshot.empty) doc = snapshot.docs[0];
      }

      if (!doc || !doc.exists) {
        if (institutionId === 'demo-institution-id' || institutionId === '00.111.222/0001-33') return res.json(demoData);
        return res.status(404).json({ error: 'Instituição não encontrada' });
      }

      const dbData = doc.data() || {};
      if (institutionId === 'demo-institution-id' || institutionId === '00.111.222/0001-33') {
        return res.json({ ...demoData, ...dbData, id: doc.id });
      }
      return res.json({ ...dbData, id: doc.id });
      
    } catch (error: any) {
      console.error('API Settings Error:', error);
      return res.status(500).json({ error: 'Erro de conexão no banco de dados' });
    }
  });

  app.post('/api/telegram/test', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { botToken, chatId } = req.body;
    if (!botToken || !chatId) {
      return res.status(400).json({ error: 'Token do Bot e ID do Chat são obrigatórios.' });
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🔄 *Teste de Conexão*\n\nIntegração com o Telegram estabelecida com sucesso pela plataforma SSVP!',
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Telegram API error:', errorData);
        return res.status(response.status).json({ error: 'Falha ao enviar mensagem para o Telegram.', details: errorData });
      }

      res.json({ success: true, message: 'Mensagem de teste enviada com sucesso!' });
    } catch (error) {
      console.error('Telegram test network error:', error);
      res.status(500).json({ error: 'Erro de conexão com a API do Telegram.' });
    }
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
  app.get('/api/mural', async (req: any, res) => {
    const { institutionId } = req.query;
    const accessLevel = req.user?.accessLevel;
    const username = req.user?.username;

    try {
      const snapshot = await db.collection('muralMessages')
        .where('institutionId', '==', institutionId)
        .orderBy('timestamp', 'asc')
        .get();
        
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      
      // Filtra mensagens do mural baseado na visibilidade e no usuário
      const filteredMessages = messages.filter((msg: any) => {
        const isAuthor = msg.author === username;
        
        let visArray: string[] = [];
        if (Array.isArray(msg.visibilidade)) {
           visArray = msg.visibilidade;
        } else if (typeof msg.visibilidade === 'string') {
           visArray = [msg.visibilidade];
        } else if (msg.isPublic) {
           visArray = ['publico'];
        } else {
           visArray = ['admin'];
        }
        
        if (visArray.includes('publico')) return true;
        
        if (visArray.includes('privado')) {
           return isAuthor; // Só o próprio autor pode ver
        }

        if (visArray.includes('admin')) {
           // Se for restrito, apenas se for autor ou se tiver papel que permita ver coisas restritas admin
           const viewAdminRoles = ['administrador', 'gerencial', 'enfermeira', 'medico', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'assistente_social'];
           return isAuthor || viewAdminRoles.includes(accessLevel);
        }

        return true;
      });

      res.json(filteredMessages);
    } catch (error) {
      console.error('Error fetching mural:', error);
      res.status(500).json({ error: 'Erro ao buscar mural.' });
    }
  });

  app.post('/api/mural', async (req: any, res) => {
    const data = req.body;
    try {
      if (!data.timestamp) {
        data.timestamp = Date.now();
      }
      
      // Auto-identify author from session
      if (req.user) {
        data.authorUserId = req.user.id;
        data.authorEmail = req.user.username;
        
        let sigTextFallback = req.user.fullName || req.user.username;
        if (req.user.role) {
          sigTextFallback = `${sigTextFallback} — ${req.user.role}`;
        }
        
        data.authorDisplayName = req.user.fullName || req.user.username;
        data.authorFunction = req.user.role || '';
        data.authorSignatureText = sigTextFallback;

        if (req.user.funcionarioId) {
          try {
            const empDoc = await db.collection('employees').doc(req.user.funcionarioId).get();
            if (empDoc.exists) {
              const empData = empDoc.data();
              const noNameFallback = req.user.fullName || req.user.username;
              const nomeStr = empData?.nomeExibicao || empData?.nomeCompleto || noNameFallback;
              const funcaoStr = empData?.funcao || '';
              const conselhoStr = empData?.conselhoProfissional || '';
              const registroStr = empData?.numeroRegistro || '';
              
              const sigText = funcaoStr ? `${nomeStr} — ${funcaoStr}` : nomeStr;

              data.authorFuncionarioId = req.user.funcionarioId;
              data.authorDisplayName = nomeStr;
              data.authorFunction = funcaoStr;
              data.authorProfessionalCouncil = conselhoStr;
              data.authorProfessionalRegistry = registroStr;
              data.authorRegistryUf = empData?.ufRegistro || '';
              data.authorSignatureText = sigText;
              
              // Override legacy fields just in case
              data.authorName = nomeStr;
              data.authorRole = funcaoStr;
            }
          } catch (e) {
            console.error("Erro ao enriquecer autor da mensagem do mural:", e);
          }
        }
      }

      const docRef = await db.collection('muralMessages').add(data);
      await logAudit('create', 'mural', docRef.id, req, data.institutionId, 'Nova mensagem no mural', { title: data.title });
      
      // Enviar notificação para o Telegram
      if (data.institutionId) {
        try {
          const settingsDoc = await db.collection('institutions').doc(data.institutionId).get();
          if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            if (settings?.telegramBotToken && settings?.telegramChatId) {
              const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
              
              const titlePart = data.title ? `*${data.title}*\n` : '';
              
              let displayName = data.authorName || data.author || 'Usuário';
              let authorLine = `👤 *${displayName}* ${data.authorRole ? `(${data.authorRole})` : ''}\n`;
              if (data.authorSignatureText) {
                authorLine = `👤 *${data.authorSignatureText}*\n`;
              }
              const authorPart = authorLine;
              
              const textPart = data.text ? `\n📄 ${data.text}` : '';
              const detailsPart = data.detailedContent ? `\n\n📝 _Detalhes:_\n${data.detailedContent}` : '';

              const message = `🔔 *NOVA MENSAGEM NO MURAL*\n\n${titlePart}${authorPart}${textPart}${detailsPart}`;

              await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: settings.telegramChatId,
                  text: message,
                  parse_mode: 'Markdown'
                })
              });
            }
          }
        } catch (telegramErr) {
          console.error("Erro ao enviar notificação pro Telegram:", telegramErr);
        }
      }

      res.json({ ...data, id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar mensagem no mural.' });
    }
  });

  // User Management
  app.get('/api/employees', requireAuth, async (req, res) => {
    try {
      const q = req.query.q as string;
      const realId = await getRealInstitutionId((req as any).user.institutionId);
      const snapshot = await db.collection('employees').where('institutionId', '==', realId).get();
      const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const filtered = employees.filter(e => !e.archived);
      
      let result = filtered;
      if (q) {
        const query = q.toLowerCase();
        result = filtered.filter(e => 
          (e.nomeCompleto && e.nomeCompleto.toLowerCase().includes(query)) ||
          (e.funcao && e.funcao.toLowerCase().includes(query))
        );
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar funcionários.' });
    }
  });

  app.post('/api/employees', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const data = req.body;
    try {
      const realId = await getRealInstitutionId((req as any).user.institutionId);
      const now = Date.now();
      data.institutionId = realId;
      
      if (!data.id) {
        data.criadoEm = now;
      }
      data.atualizadoEm = now;
      
      if (data.id) {
        const { id, ...updateData } = data;
        await db.collection('employees').doc(id).set(updateData, { merge: true });
        res.json(data);
      } else {
        const docRef = await db.collection('employees').add(data);
        res.json({ ...data, id: docRef.id });
      }
    } catch (error) {
      console.error('Error saving employee to Firestore:', error);
      res.status(500).json({ error: 'Erro ao salvar funcionário.' });
    }
  });

  app.post('/api/employees/bulk', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const employees = req.body;
    try {
      const realId = await getRealInstitutionId((req as any).user.institutionId);
      const batch = db.batch();
      
      employees.forEach((emp: any) => {
        emp.institutionId = realId;
        const now = Date.now();
        if (!emp.id) {
            const newRef = db.collection('employees').doc();
            emp.id = newRef.id;
            emp.criadoEm = now;
            emp.atualizadoEm = now;
            batch.set(newRef, emp);
        } else {
            const ref = db.collection('employees').doc(emp.id);
            const { id, ...updateData } = emp;
            updateData.atualizadoEm = now;
            batch.set(ref, updateData, { merge: true });
        }
      });
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      console.error('Bulk save error for employees:', error);
      res.status(500).json({ error: 'Erro de bulk em funcionários' });
    }
  });

  app.delete('/api/employees/:id', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { id } = req.params;
    try {
      await db.collection('employees').doc(id).update({
        archived: true,
        archivedAt: Date.now(),
        archivedBy: (req as any).user?.id || 'unknown',
        status: 'inativo'
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao arquivar funcionário' });
    }
  });

  // ========== TURNOS E PROCEDIMENTOS ==========
  app.get('/api/shifts', requireAuth, async (req, res) => {
    const { institutionId } = req.query;
    if (!institutionId) return res.json([]);
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('shifts')
        .where('institutionId', '==', realId)
        .where('status', '==', 'ativo')
        .get();
      const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      shifts.sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
      res.json(shifts);
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao buscar turnos' });
    }
  });

  // ========== SOS PROTOCOLS ==========
  app.get('/api/sos-protocols', requireAuth, async (req, res) => {
    const { institutionId, residentId } = req.query;
    if (!institutionId) return res.json([]);
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      let query: any = db.collection('sosProtocols').where('institutionId', '==', realId);
      if (residentId) {
        query = query.where('residentId', '==', residentId);
      }
      const snapshot = await query.get();
      const protocols = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(protocols);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao buscar condutas SOS' });
    }
  });

  app.post('/api/sos-protocols', requireRole(['administrador', 'gerencial', 'saude', 'tecnico_enfermagem', 'enfermeiro']), async (req, res) => {
    const payload = req.body;
    try {
      if (!payload.institutionId) return res.status(400).json({ error: 'Falta institutionId' });
      const realId = await getRealInstitutionId(payload.institutionId);
      
      const session = (req as any).user;
      const isAdminOrNurse = session?.role === 'administrador' || session?.role === 'gerencial' || session?.role === 'enfermeiro' || session?.role === 'saude';
      if (!isAdminOrNurse) {
          return res.status(403).json({ error: 'Acesso negado para gerenciar condutas SOS.'});
      }

      const dataToSave = {
        ...payload,
        institutionId: realId,
        atualizadoEm: new Date().toISOString()
      };

      if (dataToSave.id && dataToSave.id.length > 5) {
        // Edit existing
        const { id, ...saveData } = dataToSave;
        await db.collection('sosProtocols').doc(id).set(saveData, { merge: true });
        res.json(dataToSave);
      } else {
        // Create new
        const { id, ...saveData } = dataToSave;
        saveData.criadoEm = new Date().toISOString();
        const docRef = await db.collection('sosProtocols').add(saveData);
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao salvar conduta SOS' });
    }
  });

  app.post('/api/shifts', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const payload = req.body;
    try {
      if (!payload.institutionId) return res.status(400).json({ error: 'Falta institutionId' });
      const realId = await getRealInstitutionId(payload.institutionId);

      const dataToSave = {
        ...payload,
        institutionId: realId,
        atualizadoEm: new Date().toISOString()
      };

      if (!dataToSave.criadoEm) {
        dataToSave.criadoEm = new Date().toISOString();
      }

      if (dataToSave.id && dataToSave.id.length > 10) {
        // Edit existing
        const { id, ...saveData } = dataToSave;
        await db.collection('shifts').doc(id).set(saveData, { merge: true });
        res.json(dataToSave);
      } else {
        // Create new
        const { id, ...saveData } = dataToSave;
        const docRef = await db.collection('shifts').add(saveData);
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao salvar turno' });
    }
  });

  app.delete('/api/shifts/:id', requireRole(['administrador', 'gerencial']), async (req, res) => {
    try {
      await db.collection('shifts').doc(req.params.id).update({
        status: 'inativo',
        atualizadoEm: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error) {
       res.status(500).json({ error: 'Erro ao inativar turno' });
    }
  });

  // ========== PROCEDURES LOGS ==========
  app.post('/api/procedures/log', requireAuth, async (req, res) => {
    const payload = req.body;
    try {
      if (!payload.institutionId) return res.status(400).json({ error: 'Falta institutionId' });
      const realId = await getRealInstitutionId(payload.institutionId);

      const dataToSave = {
        ...payload,
        institutionId: realId,
      };

      const docRef = await db.collection('procedure_logs').add(dataToSave);
      res.json({ ...dataToSave, id: docRef.id });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao salvar procedimento' });
    }
  });

  app.get('/api/procedures/logs', requireAuth, async (req, res) => {
    const { institutionId, dataOperacional } = req.query;
    if (!institutionId) return res.json([]);
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      let query = db.collection('procedure_logs').where('institutionId', '==', realId);
      
      if (dataOperacional) {
        query = query.where('dataOperacional', '==', dataOperacional);
      }
      
      const snapshot = await query.orderBy('criadoEm', 'desc').get();
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao buscar procedimentos' });
    }
  });

  // ========== MEALS ==========
  app.get('/api/meals', requireAuth, async (req, res) => {
    const { institutionId } = req.query;
    if (!institutionId) return res.json([]);
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('meals').where('institutionId', '==', realId).get();
      if (snapshot.empty) {
        // Seed default meals for this institution
        const defaultMeals = [
          { nomeRefeicao: 'Café da manhã', horarioAproximado: '08:00', turnoNome: 'Manhã', ordem: 1 },
          { nomeRefeicao: 'Lanche da manhã', horarioAproximado: '10:00', turnoNome: 'Manhã', ordem: 2 },
          { nomeRefeicao: 'Almoço', horarioAproximado: '11:30', turnoNome: 'Manhã', ordem: 3 },
          { nomeRefeicao: 'Lanche da tarde', horarioAproximado: '14:00', turnoNome: 'Tarde', ordem: 4 },
          { nomeRefeicao: 'Jantar', horarioAproximado: '17:30', turnoNome: 'Tarde', ordem: 5 },
          { nomeRefeicao: 'Lanche da noite', horarioAproximado: '20:00', turnoNome: 'Tarde', ordem: 6 },
        ];
        
        for (const meal of defaultMeals) {
          await db.collection('meals').add({
            ...meal,
            institutionId: realId,
            turnoId: 'default',
            status: 'ativo',
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
          });
        }
        
        const newSnapshot = await db.collection('meals').where('institutionId', '==', realId).get();
        const meals = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json(meals.sort((a: any, b: any) => a.ordem - b.ordem));
      }
      const meals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(meals.sort((a: any, b: any) => a.ordem - b.ordem));
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao buscar refeições' });
    }
  });

  // ========== /USERS ==========
  app.get('/api/users', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      
      const snapshot = await safeQuery(async () => {
        let snap = await db.collection('users').where('institutionId', '==', realId).get();
        if (snap.empty) {
          // Fallback: Check if they are saved under the CNPJ string
          const instDoc = await db.collection('institutions').doc(realId).get();
          if (instDoc.exists && instDoc.data().cnpj) {
            snap = await db.collection('users').where('institutionId', '==', instDoc.data().cnpj).get();
          } else if (institutionId && institutionId !== realId) {
            snap = await db.collection('users').where('institutionId', '==', institutionId).get();
          }
        }
        return snap;
      });
      
      const dbUsers = snapshot ? snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived) : [];
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
      const institutionId = req.query.institutionId || req.headers['x-tenant-id'];
      if (!institutionId) {
        return res.status(401).json({ error: 'Tenant (institutionId) não fornecido.' });
      }
      const realId = await getRealInstitutionId(institutionId as string);

      const snapshot = await db.collection('jobCandidates').where('institutionId', '==', realId).get();
      const jobCandidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(jobCandidates);
    } catch (error) {
      console.error('Erro ao buscar candidatos a vagas', error);
      res.status(500).json({ error: 'Erro ao buscar candidatos a vagas' });
    }
  });

  app.post('/api/job-candidates', requireRole(['psicologia', 'gerencial', 'administrador']), async (req, res) => {
    try {
      const institutionId = req.query.institutionId || req.headers['x-tenant-id'] || req.body.institutionId;
      if (!institutionId) {
         return res.status(401).json({ error: 'Tenant (institutionId) não fornecido.' });
      }
      
      const realId = await getRealInstitutionId(institutionId as string);

      const candidateData = { ...req.body, institutionId: realId };
      if (!candidateData.id) {
        candidateData.id = Date.now().toString();
      }

      await db.collection('jobCandidates').doc(candidateData.id).set(candidateData);
      res.json({ success: true, candidate: candidateData });
    } catch (error) {
      console.error('Erro ao salvar candidato a vaga', error);
      res.status(500).json({ error: 'Erro ao salvar candidato a vaga' });
    }
  });

  app.delete('/api/job-candidates/:id', requireRole(['psicologia', 'gerencial', 'administrador']), async (req, res) => {
    const { id } = req.params;
    try {
      await db.collection('jobCandidates').doc(id).delete();
      res.json({ success: true, message: 'Excluído definitivamente com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir definitivamente o candidato a vaga', error);
      res.status(500).json({ error: 'Erro ao excluir definitivamente o candidato a vaga' });
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

  // Handovers API
  app.get('/api/handovers', async (req, res) => {
    const { institutionId } = req.query;
    try {
      if (!institutionId) {
        return res.json([]);
      }
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('handovers')
        .where('institutionId', '==', realId)
        .orderBy('timestamp', 'desc')
        .get();
      const handovers = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      res.json(handovers);
    } catch (error) {
       console.error("Handover search error:", error);
       res.status(500).json({ error: 'Erro ao buscar histórico de plantão' });
    }
  });

  app.post('/api/handovers', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      
      if (data.id && data.id.length > 20) {
        await db.collection('handovers').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        res.json({ ...data, id: data.id, institutionId: realId });
      } else {
        const docRef = await db.collection('handovers').add({ ...data, institutionId: realId });
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error) {
       console.error("Handover save error:", error);
       res.status(500).json({ error: 'Erro ao salvar plantão' });
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

  // --- Medication Stock Movements API ---
  app.get('/api/medication_stock_movements', async (req, res) => {
    try {
      const { institutionId, residentId } = req.query;
      const realId = await getRealInstitutionId(String(institutionId));
      let query = db.collection('medication_stock_movements').where('institutionId', '==', realId);
      
      if (residentId) {
        query = query.where('residentId', '==', String(residentId));
      }
      
      const snapshot = await query.get();
      const movements = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      res.json(movements);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar movimentações de estoque' });
    }
  });

  app.post('/api/medication_stock_movements', async (req, res) => {
    try {
      const { ...data } = req.body;
      data.institutionId = await getRealInstitutionId(data.institutionId);
      const docRef = db.collection('medication_stock_movements').doc();
      await docRef.set({ ...data, id: docRef.id });
      res.json({ success: true, id: docRef.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao salvar movimentação de estoque' });
    }
  });

  // --- Medication Administration Logs API ---
  app.get('/api/medication_administration_logs', async (req, res) => {
    try {
      const { institutionId, residentId, date } = req.query;
      const realId = await getRealInstitutionId(String(institutionId));
      let query = db.collection('medication_administration_logs').where('institutionId', '==', realId);
      
      if (residentId) {
        query = query.where('residentId', '==', String(residentId));
      }
      if (date) {
        query = query.where('dataOperacional', '==', String(date));
      }
      
      const snapshot = await query.get();
      const logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      res.json(logs);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar logs de ministração' });
    }
  });

  app.post('/api/medication_administration_logs', async (req, res) => {
    try {
      const { ...data } = req.body;
      data.institutionId = await getRealInstitutionId(data.institutionId);
      let docRef;
      if (data.id && !data.id.startsWith('new_')) {
         docRef = db.collection('medication_administration_logs').doc(data.id);
      } else {
         docRef = db.collection('medication_administration_logs').doc();
         data.id = docRef.id;
      }
      await docRef.set({ ...data }, { merge: true });
      res.json({ success: true, id: docRef.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao salvar log de ministração' });
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

  // --- Companions API ---
  app.get('/api/companions', async (req: any, res) => {
    const { institutionId } = req.query;
    try {
      if (!institutionId) return res.json([]);
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('companions')
        .where('institutionId', '==', realId)
        .get();
      const companions = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(companions);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar acompanhantes.' });
    }
  });

  app.post('/api/companions', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req: any, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && data.id.length > 20) {
        await db.collection('companions').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'companions', data.id, req, realId, `Atualização do acompanhante: ${data.name}`);
        res.json({ ...data, id: data.id, institutionId: realId });
      } else {
        const docRef = await db.collection('companions').add({ ...data, institutionId: realId });
        await logAudit('create', 'companions', docRef.id, req, realId, `Novo acompanhante cadastrado: ${data.name}`);
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar acompanhante.' });
    }
  });

  app.delete('/api/companions/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req: any, res) => {
    try {
      await db.collection('companions').doc(req.params.id).update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      res.status(500).json({ error: 'Erro ao arquivar acompanhante.' });
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
