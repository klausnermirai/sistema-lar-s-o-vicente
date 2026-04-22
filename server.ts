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

  // Login
  app.post('/api/login', async (req, res) => {
    const { cnpj, username, password } = req.body;

    try {
      // Find institution by CNPJ
      const institutionsRef = db.collection('institutions');
      const instSnapshot = await institutionsRef.where('cnpj', '==', cnpj).get();

      if (instSnapshot.empty) {
        // Special case for initial setup/admin if no institutions exist yet
        if (username === 'admin' && password === 'admin123' && cnpj === '') {
           return res.json({
             success: true,
             user: { username: 'admin', fullName: 'Administrador Padrão', role: 'TI / Gestão', accessLevel: 'gerencial' },
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
  app.get('/api/residents', async (req, res) => {
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
      const dbResidents = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      
      if (institutionId === 'demo-institution-id') {
        const demoResidents = [
          { id: 'demo-1', name: 'Antônio Ferreira (Demo)', gender: 'masculino', birthDate: '1945-05-12', admissionDate: '2020-01-15', status: 'ativo', cpf: '111.222.333-44' },
          { id: 'demo-2', name: 'Maria das Dores (Demo)', gender: 'feminino', birthDate: '1938-11-22', admissionDate: '2019-06-10', status: 'ativo', cpf: '555.666.777-88' }
        ];
        return [...demoResidents, ...dbResidents];
      }
      return dbResidents;
    }, []);
    
    res.json(residents);
  });

  app.post('/api/residents', async (req, res) => {
    const data = req.body;
    try {
      if (data.institutionId) {
        data.institutionId = await getRealInstitutionId(data.institutionId);
      }
      if (data.id) {
        // Update
        const { id, ...updateData } = data;
        await db.collection('residents').doc(id).set(updateData, { merge: true });
        res.json(data);
      } else {
        // Create
        const docRef = await db.collection('residents').add(data);
        res.json({ ...data, id: docRef.id });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar residente.' });
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
  app.get('/api/candidates', async (req, res) => {
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
      const dbCandidates = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      
      if (institutionId === 'demo-institution-id') {
        const demoCandidates = [
          { id: 'demo-c1', name: 'José Oliveira (Demo)', stage: 'aguardando_vaga', priority: 'alta', gender: 'masculino', birthDate: '1950-02-10', createdAt: new Date().toISOString() }
        ];
        return [...demoCandidates, ...dbCandidates];
      }
      return dbCandidates;
    }, []);
    
    res.json(candidates);
  });

  app.post('/api/candidates', async (req, res) => {
    const data = req.body;
    try {
      if (data.institutionId) {
        data.institutionId = await getRealInstitutionId(data.institutionId);
      }
      if (data.id) {
        const { id, ...updateData } = data;
        await db.collection('candidates').doc(id).set(updateData, { merge: true });
        res.json(data);
      } else {
        const docRef = await db.collection('candidates').add(data);
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

  app.post('/api/settings', async (req, res) => {
    const { institutionId, ...settings } = req.body;
    if (!institutionId) return res.status(400).json({ error: 'ID da instituição não informado' });

    try {
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
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
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
      res.json({ ...data, id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar mensagem no mural.' });
    }
  });

  // User Management
  app.get('/api/users', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('users').where('institutionId', '==', realId).get();
      const dbUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      let finalUsers = dbUsers;
      if (institutionId === 'demo-institution-id') {
        const demoUsers = [
          { id: 'demo-u1', username: 'demonstracao@ssvp.com', fullName: 'Administrador Demo', accessLevel: 'administrador', role: 'Gestor' },
          { id: 'demo-u2', username: 'operador@ssvp.com', fullName: 'Maria Silva', accessLevel: 'operacional', role: 'Assistente Social' }
        ];
        finalUsers = [...demoUsers, ...dbUsers];
      }
      
      res.json(finalUsers);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
  });

  app.post('/api/users', async (req, res) => {
    const data = req.body;
    try {
      const realId = await getRealInstitutionId(data.institutionId);
      data.institutionId = realId;

      if (data.id) {
        const { id, ...updateData } = data;
        await db.collection('users').doc(id).set(updateData, { merge: true });
        res.json(data);
      } else {
        const docRef = await db.collection('users').add(data);
        res.json({ ...data, id: docRef.id });
      }
    } catch (error) {
      console.error('Error saving user to Firestore:', error);
      res.status(500).json({ error: 'Erro ao salvar usuário no banco de dados.' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.collection('users').doc(id).delete();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
  });

  app.delete('/api/candidates/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.collection('candidates').doc(id).delete();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir candidato.' });
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
      const categories = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar categorias de emendas.' });
    }
  });

  app.post('/api/amendments/categories', async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && !data.id.startsWith('new_')) {
        await db.collection('amendment_categories').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        res.json(data);
      } else {
        const { id, ...saveData } = data;
        const docRef = await db.collection('amendment_categories').add({ ...saveData, institutionId: realId });
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar categoria de emenda.' });
    }
  });

  app.delete('/api/amendments/categories/:id', async (req, res) => {
    try {
      await db.collection('amendment_categories').doc(req.params.id).delete();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir categoria.' });
    }
  });

  app.get('/api/amendments/grants', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('amendment_grants')
        .where('institutionId', '==', realId)
        .get();
      const grants = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      res.json(grants);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar emendas.' });
    }
  });

  app.post('/api/amendments/grants', async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && !data.id.startsWith('new_')) {
        await db.collection('amendment_grants').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        res.json(data);
      } else {
        const { id, ...saveData } = data;
        const docRef = await db.collection('amendment_grants').add({ ...saveData, institutionId: realId });
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar emenda.' });
    }
  });

  app.delete('/api/amendments/grants/:id', async (req, res) => {
    try {
      await db.collection('amendment_grants').doc(req.params.id).delete();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir emenda.' });
    }
  });

  // Bulk save for bootstrap
  app.post('/api/amendments/bulk-bootstrap', async (req, res) => {
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

  // --- Suporte Routes ---
  app.get('/api/support/messages', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('support_messages')
        .where('institutionId', '==', realId)
        .orderBy('createdAt', 'asc')
        .get();
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      res.json(messages);
    } catch (error) {
      console.error('Error fetching support messages:', error);
      res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
  });

  app.post('/api/support/messages', async (req, res) => {
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
      res.json({ ...newMessage, id: docRef.id });
    } catch (error) {
      console.error('Error saving support message:', error);
      res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
  });

  // More CRUDs could be added here...

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
