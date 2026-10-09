import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import admin from "firebase-admin";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const __dirname = process.cwd();

// Carrega variáveis locais de .env se o arquivo existir no ambiente
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      (process as any).loadEnvFile(envPath);
    }
  } catch {
    // Ignora se não puder carregar .env
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  console.log("Initializing Firebase Admin for project:", firebaseConfig.projectId);
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

import crypto from 'crypto';
import { getNormalizedProductKey } from './lib/utils.ts';
import { LocalDbFallback } from "./lib/local_db_fallback.ts";
import {
  canUseLocalFallback,
  DatabaseUnavailableError,
  isDbUnavailableError as baseIsDbUnavailableError,
  sendDatabaseError as baseSendDatabaseError,
  handleApiError
} from "./lib/db_errors.ts";
import {
  createConselhoParticular,
  updateConselhoParticular,
  inactivateConselhoParticular,
  listConselhosParticulares,
  type ServiceAuthContext,
} from './lib/conselho_particular_service.ts';
import {
  createConferencia,
  updateConferencia,
  inactivateConferencia,
  listConferencias,
} from './lib/conferencia_service.ts';
import { buildInstitutionKnowledgeContext, askAiAssistant } from './server/ai_assistant.ts';
import {
  createMembroConferencia,
  updateMembroConferencia,
  inactivateMembroConferencia,
  listMembrosConferencia,
} from './lib/membro_service.ts';
import {
  FirestoreFamiliaRepository,
  listFamiliasService,
  createFamiliaService,
  updateFamiliaService,
  archiveFamiliaService,
  unarchiveFamiliaService,
  createVisitaService,
} from './lib/familia_service.ts';
import {
  generateOrRotateCentralPublicToken,
  revokeCentralPublicToken,
  getCentralPublicTokenConfig,
  getPublicHierarchyStructure,
  submitPublicMemberRegistration,
  listPublicConferenciaMembers,
  getPublicMemberMaskedDetails,
  submitPublicMemberUpdateRequest,
  listCentralMemberSubmissions,
  checkSubmissionDuplicates,
  approveMemberSubmission,
  confirmAndSendMemberSubmission,
  rejectMemberSubmission,
  runLegacySubmissionsDryRun,
  reconcileAndSyncPendingSubmissions,
} from './lib/public_member_registration_service.ts';
import { FirestoreConselhoParticularRepository } from './lib/firestore_conselho_particular_repository.ts';
import { FirestoreConferenciaRepository } from './lib/firestore_conferencia_repository.ts';
import { FirestoreMembroRepository, recalculateConferenciaMemberCounts } from './lib/firestore_membro_repository.ts';
import { FirestorePublicRegistrationRepository } from './lib/firestore_public_registration_repository.ts';
import { executeStructure2026Import, EXPECTED_CNPJ, EXPECTED_PROJECT_ID, EXPECTED_DATABASE_ID } from './lib/import_structure_2026_service.ts';

export { canUseLocalFallback, DatabaseUnavailableError, handleApiError };

export function isDbUnavailableError(error: any): boolean {
  return baseIsDbUnavailableError(error, isUsingFallback, activeDb);
}

export function sendDatabaseError(res: express.Response, error: any, fallbackMessage = 'Erro interno no servidor', defaultStatusCode = 500) {
  if (isDbUnavailableError(error)) {
    console.error('Database unavailable error:', error?.message || error);
    return res.status(503).json({
      error: 'DATABASE_TEMPORARILY_UNAVAILABLE',
      message: 'O banco de dados está temporariamente indisponível. Tente novamente em alguns minutos.'
    });
  }

  const status = error.status || error.statusCode || defaultStatusCode;
  const msg = error.clientMessage || fallbackMessage;

  console.error('API Error:', error);
  return res.status(status).json({ error: msg });
}

let activeDb: any = null;
let isUsingFallback = false;

async function refreshDbInstance() {
  const namedDbId = firebaseConfig.firestoreDatabaseId;
  const targetId = namedDbId || "(default)";
  
  console.log(`Initializing database instance: ${targetId} (canUseLocalFallback: ${canUseLocalFallback})`);
  
  try {
    const newInst = getFirestore(admin.app(), targetId);
    const healthRef = newInst.collection("_health").doc("check");
    await healthRef.get();
    activeDb = newInst;
    isUsingFallback = false;
    console.log(`Successfully connected to Firestore database: ${targetId}`);
  } catch (err: any) {
    console.warn(`Connection test failed for Firestore ${targetId}: ${err.message}`);
    
    if (namedDbId && namedDbId !== "(default)") {
      console.warn("Attempting connection to (default) Firestore database...");
      try {
        const defaultInst = getFirestore(admin.app(), "(default)");
        const healthRef = defaultInst.collection("_health").doc("check");
        await healthRef.get();
        activeDb = defaultInst;
        isUsingFallback = false;
        console.log("Successfully connected to Firestore (default) database.");
        return;
      } catch (defaultErr: any) {
        console.warn(`Firestore (default) connection also failed: ${defaultErr.message}`);
      }
    }
    
    if (canUseLocalFallback) {
      console.warn("Activating local JSON database fallback for allowed development environment...");
      isUsingFallback = true;
      activeDb = new LocalDbFallback();
    } else {
      console.error("LocalDbFallback is DISABLED. Firestore connection unavailable.");
      isUsingFallback = false;
      activeDb = null;
    }
  }
}

// Smart Database Proxy to handle dynamic switching and enforce environment safety
const db = new Proxy({}, {
  get(target, prop) {
    if (!canUseLocalFallback && isUsingFallback) {
      throw new DatabaseUnavailableError("O banco de dados está temporariamente indisponível.");
    }
    if (!activeDb) {
      throw new DatabaseUnavailableError("O banco de dados está temporariamente indisponível.");
    }
    if (prop === 'collection' || prop === 'doc' || prop === 'batch' || prop === 'runTransaction') {
      return (...args: any[]) => {
        if (!canUseLocalFallback && isUsingFallback) {
          throw new DatabaseUnavailableError("O banco de dados está temporariamente indisponível.");
        }
        if (!activeDb) {
          throw new DatabaseUnavailableError("O banco de dados está temporariamente indisponível.");
        }
        return activeDb[prop](...args);
      };
    }
    return (activeDb as any)[prop];
  }
}) as any;

// Safe Firestore wrapper
async function safeQuery<T>(fn: () => Promise<T>, fallback: any = null): Promise<T> {
  if (!canUseLocalFallback && (isUsingFallback || !activeDb)) {
    throw new DatabaseUnavailableError("O banco de dados está temporariamente indisponível.");
  }
  try {
    return await fn();
  } catch (error: any) {
    console.error(`Database query error: CODE ${error?.code} | MSG ${error?.message}`);
    
    if (isDbUnavailableError(error)) {
      throw new DatabaseUnavailableError(error.message);
    }
    
    if (canUseLocalFallback && fallback !== null) {
      return fallback;
    }
    
    throw error;
  }
}

// --- High-Efficiency In-Memory Cache for Firestore Read Operations ---
interface CacheEntry {
  data: any;
  timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

function getFromCache<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (entry && (Date.now() - entry.timestamp < DEFAULT_CACHE_TTL_MS)) {
    return entry.data as T;
  }
  return null;
}

function setToCache(key: string, data: any): void {
  queryCache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(prefix?: string): void {
  if (!prefix) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.includes(prefix)) {
      queryCache.delete(key);
    }
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

import {
  MONTE_ALTO_OPERATIONAL_ID,
  MONTE_ALTO_CNPJ,
  MONTE_ALTO_CNPJ_CLEAN,
  MONTE_ALTO_DUPLICATE_IDS,
  CENTRAL_JABOTICABAL_CNPJ,
  DEMO_INSTITUTION_ID,
  isMonteAltoUnit,
  isKnownDuplicateMonteAltoId,
  getCanonicalInstitutionId,
  getMonteAltoQueryIds,
  normalizeUserAccessLevel,
  isUserAuthorizedForInstitution,
} from './lib/canonical_units.ts';
import { assertAuthConfigurationValid, createAuthToken, verifyAuthToken, createReauthToken, verifyReauthToken } from './lib/server_auth.ts';
import { isAuthorizedForDocument, isUserAuthorizedToViewMuralMessage } from './lib/mural_visibility.ts';

// Helper to get real institution doc.id from either id or cnpj
async function getRealInstitutionId(idOrCnpj: string): Promise<string> {
  if (!idOrCnpj) return "";
  const trimmed = idOrCnpj.trim();
  if (trimmed === DEMO_INSTITUTION_ID) return DEMO_INSTITUTION_ID;
  if (isMonteAltoUnit(trimmed)) return MONTE_ALTO_OPERATIONAL_ID;

  return await safeQuery(async () => {
    // Only try .doc() if the ID doesn't contain slashes
    if (!trimmed.includes("/")) {
      const doc = await db.collection("institutions").doc(trimmed).get();
      if (doc.exists) return doc.id;

      // Suporte a Unidades Vicentinas (Conferências e Conselhos Particulares cadastrados)
      const confDoc = await db.collection("conferencias").doc(trimmed).get();
      if (confDoc.exists) return confDoc.id;

      const cpDoc = await db.collection("conselhos_particulares").doc(trimmed).get();
      if (cpDoc.exists) return cpDoc.id;
    }

    // Try finding by CNPJ field
    let cleanCnpj = trimmed.replace(/\D/g, '');
    let formattedCnpj = cleanCnpj;
    if (cleanCnpj.length === 14) {
      formattedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    
    let snapshot = await db.collection("institutions").where("cnpj", "==", formattedCnpj).get();
    if (snapshot.empty && cleanCnpj) {
      snapshot = await db.collection("institutions").where("cnpj", "==", cleanCnpj).get();
    }
    if (snapshot.empty) {
      snapshot = await db.collection("institutions").where("cnpj", "==", trimmed).get();
    }
    
    if (!snapshot.empty) return snapshot.docs[0].id;
    
    return trimmed;
  }, trimmed);
}

// Resolução estrita: retorna estritamente "" caso o documento institucional não exista no banco
async function isVisitorPortalInstitution(idOrCnpj: string): Promise<boolean> {
  if (!idOrCnpj) return false;
  const realId = await getRealInstitutionId(idOrCnpj);
  if (!realId) return false;
  if (isMonteAltoUnit(realId)) return true;

  return await safeQuery(async () => {
    const doc = await db.collection('institutions').doc(realId).get();
    if (doc.exists) {
      const data: any = doc.data() || {};
      const rawType = String(data.entityType || data.type || data.institutionType || 'obra_unida').trim().toLowerCase();
      const normalizedType = rawType.replace(/[\s-]+/g, '_');
      if (['obra_unida', 'obraunida', 'lar', 'ilpi'].includes(normalizedType)) {
        return true;
      }
    }

    const centralDoc = await db.collection('institutions').doc(CENTRAL_JABOTICABAL_CNPJ).get();
    const obras = centralDoc.exists && Array.isArray(centralDoc.data()?.obrasUnidas)
      ? centralDoc.data()!.obrasUnidas
      : [];

    const targetCanonical = getCanonicalInstitutionId(realId);
    return obras.some((obra: any) => {
      const obraId = String(obra?.id || '').trim();
      const obraCnpj = String(obra?.cnpj || '').trim();
      return (obraId && getCanonicalInstitutionId(obraId) === targetCanonical) ||
        (obraCnpj && getCanonicalInstitutionId(obraCnpj) === targetCanonical) ||
        obraId === idOrCnpj ||
        obraCnpj === idOrCnpj;
    });
  }, false);
}

async function resolveExistingInstitutionDocId(idOrCnpj: string): Promise<string> {
  if (!idOrCnpj) return "";
  const trimmed = idOrCnpj.trim();
  if (isMonteAltoUnit(trimmed)) return MONTE_ALTO_OPERATIONAL_ID;
  if (trimmed === CENTRAL_JABOTICABAL_CNPJ) return CENTRAL_JABOTICABAL_CNPJ;
  if (trimmed === DEMO_INSTITUTION_ID) return DEMO_INSTITUTION_ID;
  
  return await safeQuery(async () => {
    if (!trimmed.includes("/")) {
      const doc = await db.collection("institutions").doc(trimmed).get();
      if (doc.exists) return doc.id;

      const confDoc = await db.collection("conferencias").doc(trimmed).get();
      if (confDoc.exists) return confDoc.id;

      const cpDoc = await db.collection("conselhos_particulares").doc(trimmed).get();
      if (cpDoc.exists) return cpDoc.id;
    }

    let cleanCnpj = trimmed.replace(/\D/g, '');
    let formattedCnpj = cleanCnpj;
    if (cleanCnpj.length === 14) {
      formattedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    
    let snapshot = await db.collection("institutions").where("cnpj", "==", formattedCnpj).get();
    if (snapshot.empty && cleanCnpj) {
      snapshot = await db.collection("institutions").where("cnpj", "==", cleanCnpj).get();
    }
    if (snapshot.empty) {
      snapshot = await db.collection("institutions").where("cnpj", "==", trimmed).get();
    }
    
    if (!snapshot.empty) return snapshot.docs[0].id;
    
    return "";
  }, "");
}

async function checkAndSyncConselhoUser() {
  const targetCnpj = "54.927.132/0001-92";
  const cleanCnpj = "54927132000192";
  const monteAltoCnpj = "52.853.397/0001-68";
  const monteAltoClean = "52853397000168";
  const targetEmail = "kwarizaya@gmail.com";

  try {
    console.log(`[CONSELHO CHECK] Garantindo instituições e acessos para ${targetEmail}...`);
    
    // 1. Garantir existência da instituição Conselho Central
    let instSnapshot = await safeQuery(async () => {
      let snap = await db.collection("institutions").where("cnpj", "==", targetCnpj).get();
      if (snap.empty) {
        snap = await db.collection("institutions").where("cnpj", "==", cleanCnpj).get();
      }
      return snap;
    });

    let conselhoDocId = targetCnpj;
    if (!instSnapshot || instSnapshot.empty) {
      console.log(`[CONSELHO CHECK] Criando instituição Conselho Central (CNPJ ${targetCnpj})...`);
      const newInstRef = await safeQuery(async () => {
        return await db.collection("institutions").add({
          name: "Conselho Central SSVP",
          cnpj: targetCnpj,
          type: "conselho_central",
          entityType: "conselho_central",
          city: "Conselho Central",
          createdAt: new Date().toISOString()
        });
      });
      if (newInstRef && newInstRef.id) conselhoDocId = newInstRef.id;
    } else {
      conselhoDocId = instSnapshot.docs[0].id;
    }

    // 2. Garantir existência da instituição Lar Monte Alto
    let monteSnapshot = await safeQuery(async () => {
      let snap = await db.collection("institutions").where("cnpj", "==", monteAltoCnpj).get();
      if (snap.empty) {
        snap = await db.collection("institutions").where("cnpj", "==", monteAltoClean).get();
      }
      return snap;
    });

    let monteDocId = monteAltoCnpj;
    if (!monteSnapshot || monteSnapshot.empty) {
      console.log(`[CONSELHO CHECK] Criando instituição Lar de Monte Alto (CNPJ ${monteAltoCnpj})...`);
      const newMonteRef = await safeQuery(async () => {
        return await db.collection("institutions").add({
          name: "Lar São Vicente de Paulo de Monte Alto",
          cnpj: monteAltoCnpj,
          type: "obra_unida",
          entityType: "obra_unida",
          city: "Monte Alto",
          createdAt: new Date().toISOString()
        });
      });
      if (newMonteRef && newMonteRef.id) monteDocId = newMonteRef.id;
    } else {
      monteDocId = monteSnapshot.docs[0].id;
    }

    // 3. Buscar ou atualizar usuário kwarizaya@gmail.com
    let userSnapshot = await safeQuery(async () => {
      let snap = await db.collection("users").where("email", "==", targetEmail).get();
      if (snap.empty) {
        snap = await db.collection("users").where("username", "==", targetEmail).get();
      }
      return snap;
    });

    const defaultInstIds = Array.from(new Set([
      targetCnpj, cleanCnpj, conselhoDocId,
      monteAltoCnpj, monteAltoClean, monteDocId,
      'demo-institution-id'
    ]));

    if (userSnapshot && !userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;

      const currentInstIds = Array.isArray(userData.institutionIds) ? userData.institutionIds : [];
      const updatedInstIds = Array.from(new Set([...currentInstIds, ...defaultInstIds]));

      await safeQuery(async () => {
        await db.collection("users").doc(userId).set({
          institutionIds: updatedInstIds,
          accessLevel: "administrador",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      console.log(`[CONSELHO CHECK] Usuário ${targetEmail} atualizado com múltiplos acessos (${updatedInstIds.join(', ')}).`);
      return {
        status: "EXISTS_LINKED",
        email: targetEmail,
        cnpj: targetCnpj,
        message: "Usuário atualizado e vinculado ao Conselho Central e Lar de Monte Alto."
      };
    } else {
      console.log(`[CONSELHO CHECK] Usuário ${targetEmail} não encontrado no BD principal. Criando cadastro com acesso duplo...`);
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

      const newUser = {
        username: targetEmail,
        email: targetEmail,
        fullName: "Gestor SSVP / Monte Alto",
        role: "TI / Gestão",
        accessLevel: "administrador",
        institutionId: conselhoDocId,
        institutionIds: defaultInstIds,
        password: "",
        resetToken,
        resetTokenExpiresAt,
        createdAt: new Date().toISOString()
      };

      await safeQuery(async () => {
        await db.collection("users").add(newUser);
      });

      return {
        status: "CREATED_AND_LINKED",
        email: targetEmail,
        cnpj: targetCnpj,
        resetToken,
        message: "Novo usuário criado com suporte a ambos os CNPJs."
      };
    }
  } catch (error: any) {
    console.error("[CONSELHO CHECK] Erro na verificação do Conselho Central:", error);
    return {
      status: "ERROR",
      error: error?.message || String(error)
    };
  }
}

async function startServer() {
  try {
    assertAuthConfigurationValid();
    await refreshDbInstance();
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

  const GLOBAL_CONTROLLER_IDENTITY = 'kwarizaya@gmail.com';

  const isInactiveUserRecord = (user: any): boolean => {
    if (!user) return true;
    if (user.archived === true || user.active === false) return true;
    const status = String(user.status || '').trim().toLowerCase();
    return ['inativo', 'inactive', 'desativado', 'disabled', 'arquivado'].includes(status);
  };

  const hasGlobalControllerIdentity = (user: any): boolean => {
    if (!user) return false;
    const email = String(user.email || '').trim().toLowerCase();
    const username = String(user.username || '').trim().toLowerCase();
    return email === GLOBAL_CONTROLLER_IDENTITY || username === GLOBAL_CONTROLLER_IDENTITY;
  };

  const sanitizeUserForResponse = (user: any) => {
    if (!user || typeof user !== 'object') return user;
    const safeUser = { ...user };
    delete safeUser.password;
    delete safeUser.resetToken;
    delete safeUser.resetTokenExpiresAt;
    delete safeUser.auditLog;
    return safeUser;
  };

  // Auth Middleware com validação criptográfica de credencial
  const requireAuth = async (req: any, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Token ausente.' });
    }
    const token = authHeader.split(' ')[1];
    
    // Validação estrita da credencial (rejeita IDs simples, tokens adulterados e expirados)
    const authResult = verifyAuthToken(token);
    if (!authResult.valid || !authResult.userId) {
      return res.status(401).json({ error: authResult.error || 'Credencial inválida ou expirada. Faça login novamente.' });
    }

    try {
      const userDoc = await safeQuery(async () => await db.collection('users').doc(authResult.userId!).get());
      if (!userDoc || !userDoc.exists) {
        return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
      }
      
      const rawUser: any = { id: userDoc.id, ...userDoc.data() };
      if (isInactiveUserRecord(rawUser)) {
        return res.status(401).json({ error: 'Usuário desativado ou inativo. Acesso revogado.' });
      }

      const isGlobalController = hasGlobalControllerIdentity(rawUser);

      // Regra multi-tenant: somente o controlador global pode possuir alcance irrestrito.
      // Perfis funcionais (administrador/gerencial/etc.) não ampliam o escopo institucional.
      req.user = {
        ...rawUser,
        isGlobalAdmin: isGlobalController,
        hasAllUnitsAccess: isGlobalController
      };
      next();
    } catch (err) {
      if (isDbUnavailableError(err)) {
        return res.status(503).json({
          error: 'DATABASE_TEMPORARILY_UNAVAILABLE',
          message: 'O banco de dados está temporariamente indisponível. Tente novamente em alguns minutos.'
        });
      }
      console.error("Auth error:", err);
      return sendDatabaseError(res, err, 'Erro de autorização.');
    }
  };

  // Usa o normalizador canônico compartilhado para evitar divergência entre backend e helpers.
  const normalizeAccessLevel = normalizeUserAccessLevel;

  // Helper inside routes to enforce permissions
  const requireRole = (allowedRoles: string[]) => {
    return (req: any, res: express.Response, next: express.NextFunction) => {
       const userLevel = normalizeAccessLevel(req.user?.accessLevel || req.user?.role);
       const normalizedAllowed = allowedRoles.map(r => normalizeAccessLevel(r));
       
       // 'administrador' usually has full access
       if (userLevel === 'administrador' || normalizedAllowed.includes(userLevel) || allowedRoles.includes(userLevel)) {
         return next();
       }
       return res.status(403).json({ error: 'Acesso negado. Perfil sem permissão.' });
    };
  };

  // Bloqueio pontual da conta de Portaria em APIs fora do Portal.
  // Preserva os demais perfis e evita ampliar a matriz de permissões nesta mudança.
  const rejectVisitor = (req: any, res: express.Response, next: express.NextFunction) => {
    const userLevel = normalizeAccessLevel(req.user?.accessLevel || req.user?.role);
    if (userLevel === 'visitante') {
      return res.status(403).json({ error: 'A conta de Portaria não possui acesso a este recurso.' });
    }
    return next();
  };

  app.use('/api', (req: any, res, next) => {
    // Rotas públicas estáticas exatas (qualquer método aplicável aos endpoints de login/setup/etc)
    const staticPublicRoutes = [
      '/health', 
      '/login', 
      '/setup', 
      '/test-db', 
      '/proxy-image', 
      '/forgot-password', 
      '/verify-reset-token', 
      '/reset-password'
    ];
    if (staticPublicRoutes.includes(req.path)) {
      return next();
    }

    // Exceções públicas restritas por método e correspondência completa de caminho
    // 1. GET /api/public/central/:token/structure
    if (req.method === 'GET' && /^\/public\/central\/[^/]+\/structure$/.test(req.path)) {
      return next();
    }

    // 2. POST /api/public/central/:token/submit
    if (req.method === 'POST' && /^\/public\/central\/[^/]+\/submit$/.test(req.path)) {
      return next();
    }

    // 3. GET /api/public/central/:token/conferencias/:conferenciaId/membros
    if (req.method === 'GET' && /^\/public\/central\/[^/]+\/conferencias\/[^/]+\/membros$/.test(req.path)) {
      return next();
    }

    // 4. GET /api/public/central/:token/membros/:idOpaco/masked
    if (req.method === 'GET' && /^\/public\/central\/[^/]+\/membros\/[^/]+\/masked$/.test(req.path)) {
      return next();
    }

    // 5. POST /api/public/central/:token/membros/:idOpaco/update-request
    if (req.method === 'POST' && /^\/public\/central\/[^/]+\/membros\/[^/]+\/update-request$/.test(req.path)) {
      return next();
    }

    return requireAuth(req, res, next);
  });

  // Guarda central de escopo institucional.
  // Qualquer institutionId enviado pelo cliente precisa pertencer ao escopo do usuário autenticado.
  app.use('/api', (req: any, res, next) => {
    if (!req.user) return next();

    const candidateIds = [
      req.headers['x-institution-id'],
      req.query?.institutionId,
      req.body?.institutionId
    ]
      .flat()
      .filter((value: any) => typeof value === 'string' && value.trim() !== '')
      .map((value: string) => value.trim());

    const userLevel = normalizeAccessLevel(req.user?.accessLevel || req.user?.role);

    for (const candidateId of candidateIds) {
      if (userLevel === 'visitante') {
        const primaryInstitutionId = req.user?.institutionId;
        if (!primaryInstitutionId) {
          return res.status(403).json({ error: 'Conta de portaria sem unidade institucional válida.' });
        }
        if (getCanonicalInstitutionId(primaryInstitutionId) !== getCanonicalInstitutionId(candidateId)) {
          return res.status(403).json({ error: 'A conta de portaria está restrita à sua Obra Unida vinculada.' });
        }
        continue;
      }

      if (!isUserAuthorizedForInstitution(req.user, candidateId)) {
        return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
      }
    }

    return next();
  });

  // Login
  app.post('/api/login', async (req, res) => {
    const { cnpj, username, password, institutionId: explicitInstId } = req.body;

    try {
      const cleanUser = username ? username.trim().toLowerCase() : '';
      const rawUser = username ? username.trim() : '';
      const cleanPass = password ? password.trim() : '';

      if (!cleanUser || !cleanPass) {
        return res.status(400).json({ error: 'Informe usuário e senha para acessar.' });
      }

      // Realiza busca ampla de usuário no banco de dados por e-mail ou username
      let userSnapshot = await safeQuery(async () => {
        let snap = await db.collection('users').where('email', '==', cleanUser).get();
        if (snap.empty) {
          snap = await db.collection('users').where('username', '==', cleanUser).get();
        }
        if (snap.empty && rawUser) {
          snap = await db.collection('users').where('username', '==', rawUser).get();
        }
        return snap;
      });

      // Se for o admin mestre inicial e o banco ainda estiver vazio (estritamente bloqueado em produção ou Cloud Run)
      if ((!userSnapshot || userSnapshot.empty) && cleanUser === 'admin' && cleanPass === 'admin123') {
        if (!canUseLocalFallback) {
          return res.status(401).json({ error: 'Acesso mestre de demonstração desabilitado neste ambiente.' });
        }
        const token = createAuthToken('admin', 'admin');
        return res.json({
          success: true,
          token,
          user: { id: 'admin', username: 'admin', fullName: 'Administrador Padrão', role: 'TI / Gestão', accessLevel: 'administrador' },
          cnpj: '52.853.397/0001-68',
          institutionId: MONTE_ALTO_OPERATIONAL_ID,
          hierarchy: { type: 'obra_unida' }
        });
      }

      if (!userSnapshot || userSnapshot.empty) {
        // Tenta localizar se existe um membro cadastrado (ex: autocadastro ou cadastro anterior) cujo usuário ainda não foi sincronizado
        try {
          const { syncMemberUserAccess } = await import('./lib/membro_auth_helper');
          let membroSnap = await db.collection('membros_ssvp').where('username', '==', cleanUser).get();
          if (membroSnap.empty && cleanUser.includes('@')) {
            membroSnap = await db.collection('membros_ssvp').where('email', '==', cleanUser).get();
          }
          if (membroSnap.empty) {
            // Busca por normalizedName ou fullName se o usuário digitou o nome
            const normalizedClean = cleanUser.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            membroSnap = await db.collection('membros_ssvp').where('normalizedName', '==', normalizedClean).get();
          }

          if (!membroSnap.empty) {
            const membroDoc = membroSnap.docs[0];
            const membroData = { id: membroDoc.id, ...membroDoc.data() };
            const syncResult = await syncMemberUserAccess(db, membroData as any, 'login_auto_sync');
            if (syncResult.userId) {
              const createdUserDoc = await db.collection('users').doc(syncResult.userId).get();
              if (createdUserDoc.exists) {
                userSnapshot = {
                  empty: false,
                  docs: [createdUserDoc],
                } as any;
              }
            }
          }
        } catch (membroSyncErr) {
          console.error('Erro na sincronização sob demanda do membro no login:', membroSyncErr);
        }
      }

      if (!userSnapshot || userSnapshot.empty) {
        return res.status(401).json({ error: 'Usuário não encontrado. Verifique seu e-mail de acesso.' });
      }

      // Procura usuário ativo cuja senha coincida. Contas arquivadas/inativas não podem autenticar.
      let validUserDoc: any = null;
      let userData: any = null;
      let matchedInactiveAccount = false;

      for (const doc of userSnapshot.docs) {
        const u = doc.data();
        if (u.password === password || u.password === cleanPass) {
          if (isInactiveUserRecord(u)) {
            matchedInactiveAccount = true;
            continue;
          }
          validUserDoc = doc;
          userData = u;
          break;
        }
      }

      if (!validUserDoc || !userData) {
        if (matchedInactiveAccount) {
          return res.status(401).json({ error: 'Usuário desativado ou inativo. Acesso revogado.' });
        }
        return res.status(401).json({ error: 'Senha incorreta. Tente novamente ou use "Esqueci minha senha".' });
      }

      // Reautenticação pontual: reaproveita exatamente a validação de login,
      // mas emite uma credencial curta e específica, sem criar uma nova sessão.
      if (req.body?.reauthOnly === true) {
        return res.json({
          success: true,
          reauthToken: createReauthToken(validUserDoc.id, userData.username || userData.email || cleanUser)
        });
      }

      // Garante que as instituições padrão existam no banco para seleção com IDs canônicos
      const standardUnits = [
        {
          id: MONTE_ALTO_OPERATIONAL_ID,
          name: 'Lar São Vicente de Paulo de Monte Alto',
          cnpj: MONTE_ALTO_CNPJ,
          type: 'obra_unida',
          entityType: 'obra_unida',
          city: 'Monte Alto',
          state: 'SP'
        },
        {
          id: CENTRAL_JABOTICABAL_CNPJ,
          name: 'Conselho Central de Jaboticabal',
          cnpj: CENTRAL_JABOTICABAL_CNPJ,
          type: 'conselho_central',
          entityType: 'conselho_central',
          city: 'Jaboticabal',
          state: 'SP'
        }
      ];

      // Localiza todas as instituições, conselhos particulares e conferências cadastradas
      const [allInstSnap, allCpSnap, allConfSnap] = await Promise.all([
        safeQuery(async () => await db.collection('institutions').get()),
        safeQuery(async () => await db.collection('conselhos_particulares').get()),
        safeQuery(async () => await db.collection('conferencias').get())
      ]);

      const institutionsMap = new Map<string, any>();
      // Adiciona as padrões com prioridade canônica
      standardUnits.forEach(u => {
        institutionsMap.set(u.cnpj, u);
        institutionsMap.set(u.id, u);
      });

      // Mapeia IDs duplicados de Monte Alto para o objeto canônico
      MONTE_ALTO_DUPLICATE_IDS.forEach(dupId => {
        institutionsMap.set(dupId, standardUnits[0]);
      });

      if (allInstSnap && !allInstSnap.empty) {
        allInstSnap.forEach(doc => {
          const d = doc.data();
          const docId = doc.id;
          const instCnpj = d.cnpj || docId;
          const isMonte = isMonteAltoUnit(docId) || isMonteAltoUnit(instCnpj);
          const finalId = isMonte ? MONTE_ALTO_OPERATIONAL_ID : docId;
          const instObj = { id: finalId, ...d, type: d.entityType || d.type || 'obra_unida' };
          
          institutionsMap.set(docId, instObj);
          if (instCnpj) {
            // Se for Monte Alto, nunca sobrescreve o objeto canônico operacional
            if (!isMonte || !institutionsMap.has(instCnpj) || docId === MONTE_ALTO_OPERATIONAL_ID) {
              institutionsMap.set(instCnpj, instObj);
            }
          }
        });
      }

      if (allCpSnap && !allCpSnap.empty) {
        allCpSnap.forEach(doc => {
          const d = doc.data();
          if (d.status !== 'arquivado') {
            const cpObj = {
              id: doc.id,
              name: d.name || 'Conselho Particular',
              type: 'conselho_particular',
              entityType: 'conselho_particular',
              city: d.city || '',
              state: d.state || 'SP',
              centralId: '54.927.132/0001-92',
              particularId: doc.id
            };
            institutionsMap.set(doc.id, cpObj);
          }
        });
      }

      if (allConfSnap && !allConfSnap.empty) {
        allConfSnap.forEach(doc => {
          const d = doc.data();
          if (d.status !== 'arquivado' && d.status !== 'inativa') {
            const confObj = {
              id: doc.id,
              name: d.name || 'Conferência Vicentina',
              type: 'conferencia',
              entityType: 'conferencia',
              city: d.city || '',
              state: d.state || 'SP',
              particularId: d.particularId || '',
              centralId: '54.927.132/0001-92',
              conferenciaId: doc.id
            };
            institutionsMap.set(doc.id, confObj);
          }
        });
      }

      // Resolve o Conselho Central pelo documento real já carregado no snapshot.
      // Nunca usa CNPJ formatado diretamente em collection.doc(...), pois "/" é separador de caminho no Firestore.
      const centralCnpjDigits = CENTRAL_JABOTICABAL_CNPJ.replace(/\D/g, '');
      const centralSettingsDoc = allInstSnap?.docs?.find((doc: any) => {
        const data: any = doc.data() || {};
        const docId = String(doc.id || '');
        const cnpj = String(data.cnpj || '');
        return (
          docId === CENTRAL_JABOTICABAL_CNPJ ||
          cnpj === CENTRAL_JABOTICABAL_CNPJ ||
          docId.replace(/\D/g, '') === centralCnpjDigits ||
          cnpj.replace(/\D/g, '') === centralCnpjDigits
        );
      });

      if (centralSettingsDoc) {
        const centralSettings: any = centralSettingsDoc.data() || {};
        if (Array.isArray(centralSettings.obrasUnidas)) {
          centralSettings.obrasUnidas.forEach((obra: any) => {
            const obraId = obra.id || obra.cnpj;
            if (!obraId) return;
            const obraObj = {
              id: obraId,
              name: obra.name || 'Obra Unida',
              cnpj: obra.cnpj || '',
              type: 'obra_unida',
              entityType: 'obra_unida',
              city: obra.city || '',
              state: obra.state || 'SP',
              centralId: centralSettingsDoc.id,
              parentName: 'Conselho Central de Jaboticabal'
            };
            institutionsMap.set(obraId, obraObj);
            if (obra.cnpj) institutionsMap.set(obra.cnpj, obraObj);
          });
        }
      }

      // Identifica a quais instituições este usuário tem permissão
      const isSuperAdmin = hasGlobalControllerIdentity(userData);

      let authorizedUnits: any[] = [];

      if (isSuperAdmin) {
        // Super admin / Gestão tem multiacesso automático a todas as unidades cadastradas
        const uniqueKeys = new Set<string>();
        for (const unit of Array.from(institutionsMap.values())) {
          const canonicalId = getCanonicalInstitutionId(unit.id || unit.cnpj);
          const isMonte = isMonteAltoUnit(canonicalId);
          const key = isMonte ? `obra_unida:${MONTE_ALTO_CNPJ}` : (unit.cnpj || unit.id);
          if (!uniqueKeys.has(key)) {
            uniqueKeys.add(key);
            authorizedUnits.push({
              id: isMonte ? MONTE_ALTO_OPERATIONAL_ID : canonicalId,
              name: unit.name || unit.razaoSocial || (unit.type === 'conselho_central' ? 'Conselho Central de Jaboticabal' : 'Lar São Vicente de Paulo'),
              cnpj: isMonte ? MONTE_ALTO_CNPJ : (unit.cnpj || unit.id),
              type: unit.entityType || unit.type || 'obra_unida',
              city: unit.city || (isMonte ? 'Monte Alto' : (unit.cnpj === '54.927.132/0001-92' ? 'Jaboticabal' : '')),
              state: unit.state || 'SP',
              particularId: unit.particularId,
              conferenciaId: unit.conferenciaId,
              centralId: unit.centralId || '54.927.132/0001-92',
              parentName: unit.parentName
            });
          }
        }
      } else {
        // Usuário com escopo específico
        const isMemberUser = userData.accessLevel === 'membro_conferencia' || userData.accessLevel === 'membro' || !!userData.membroId;
        
        if (isMemberUser && userData.conferenciaId) {
          const confObj = institutionsMap.get(userData.conferenciaId);
          const cpId = userData.particularId || confObj?.particularId;
          const cpObj = cpId ? institutionsMap.get(cpId) : undefined;
          
          if (confObj) {
            authorizedUnits.push({
              id: confObj.id,
              name: confObj.name || 'Conferência Vicentina',
              cnpj: confObj.cnpj || '54.927.132/0001-92',
              type: 'conferencia',
              city: confObj.city || cpObj?.city || '',
              state: confObj.state || cpObj?.state || 'SP',
              particularId: cpId,
              conferenciaId: confObj.id,
              centralId: confObj.centralId || '54.927.132/0001-92',
              parentName: cpObj?.name || 'Conselho Particular'
            });
          }
        }

        if (authorizedUnits.length === 0) {
          const userInstIds = Array.isArray(userData.institutionIds) ? [...userData.institutionIds] : [];
          if (Array.isArray(userData.allowedUnits)) {
            userData.allowedUnits.forEach((u: any) => {
              if (u && (u.id || u.cnpj)) userInstIds.push(u.id || u.cnpj);
            });
          }
          if (userData.institutionId) userInstIds.push(userData.institutionId);
          if (userData.conferenciaId) userInstIds.push(userData.conferenciaId);

          const uniqueKeys = new Set<string>();
          userInstIds.forEach((id: string) => {
            const unit = institutionsMap.get(id);
            if (unit) {
              const key = unit.cnpj || unit.id;
              if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                authorizedUnits.push({
                  id: unit.id || unit.cnpj,
                  name: unit.name || unit.razaoSocial || 'Unidade SSVP',
                  cnpj: unit.cnpj || unit.id,
                  type: unit.entityType || unit.type || 'obra_unida',
                  city: unit.city || '',
                  state: unit.state || 'SP',
                  particularId: unit.particularId,
                  conferenciaId: unit.conferenciaId,
                  centralId: unit.centralId || '54.927.132/0001-92',
                  parentName: unit.parentName
                });
              }
            }
          });
        }

        // Se nenhuma foi encontrada na busca mas havia um institutionId
        if (authorizedUnits.length === 0 && userData.institutionId) {
          const matched = standardUnits.find(u => u.cnpj === userData.institutionId || u.id === userData.institutionId);
          if (matched) authorizedUnits.push(matched);
        }
      }

      const loginAccessLevel = normalizeAccessLevel(userData.accessLevel || userData.role);
      if (loginAccessLevel === 'visitante') {
        const primaryVisitorUnit = userData.institutionId
          ? getCanonicalInstitutionId(userData.institutionId)
          : '';

        authorizedUnits = authorizedUnits.filter((unit: any) => {
          const unitCanonical = getCanonicalInstitutionId(unit.id || unit.cnpj);
          const unitType = String(unit.entityType || unit.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
          return !!primaryVisitorUnit &&
            unitCanonical === primaryVisitorUnit &&
            ['obra_unida', 'obraunida', 'lar', 'ilpi'].includes(unitType);
        });

        if (authorizedUnits.length > 1) {
          authorizedUnits = [authorizedUnits[0]];
        }
      }

      // Sem vínculo institucional explícito, não concede acesso por fallback.
      // O usuário deve permanecer bloqueado até que o controlador global defina sua unidade.
      if (authorizedUnits.length === 0) {
        return res.status(403).json({
          error: 'Usuário sem unidade institucional autorizada. Solicite ao controlador do sistema a configuração do acesso.'
        });
      }

      // Se foi fornecido um CNPJ ou explicitInstId, tenta selecionar diretamente
      let targetUnit = null;
      const explicitSearch = explicitInstId || cnpj;

      if (explicitSearch) {
        const cleanExplicit = explicitSearch.replace(/\D/g, '');
        targetUnit = authorizedUnits.find(u => 
          u.id === explicitSearch || 
          u.cnpj === explicitSearch || 
          (typeof u.cnpj === 'string' && u.cnpj.replace(/\D/g, '') === cleanExplicit)
        );

        if (!targetUnit) {
          return res.status(403).json({ error: 'Acesso negado para a unidade selecionada.' });
        }
      }

      // SE É MULTIACESSO (mais de 1 unidade) e não foi fornecida a unidade escolhida:
      if (authorizedUnits.length > 1 && !targetUnit) {
        return res.json({
          success: true,
          requireUnitSelection: true,
          user: {
            id: validUserDoc.id,
            username: userData.username,
            fullName: userData.fullName,
            role: userData.role,
            accessLevel: userData.accessLevel,
            mustChangePassword: userData.mustChangePassword ?? false,
            isFirstLogin: userData.isFirstLogin ?? false,
            membroId: userData.membroId
          },
          availableUnits: authorizedUnits
        });
      }

      // Se é acesso único ou a unidade foi selecionada:
      const selectedUnit = targetUnit || authorizedUnits[0];

      // Busca dados completos da instituição selecionada para montar a hierarquia
      let fullInstData = institutionsMap.get(selectedUnit.id) || institutionsMap.get(selectedUnit.cnpj) || selectedUnit;

      // Monta dados de assinatura profissional se houver
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

      const resolvedConfId = fullInstData.conferenciaId || selectedUnit.conferenciaId || userData.conferenciaId || ((fullInstData.entityType === 'conferencia' || selectedUnit.type === 'conferencia') ? (selectedUnit.id || fullInstData.id) : undefined);
      const resolvedPartId = fullInstData.particularId || selectedUnit.particularId || userData.particularId;
      const confDataObj = resolvedConfId ? institutionsMap.get(resolvedConfId) : undefined;
      const cpDataObj = resolvedPartId ? institutionsMap.get(resolvedPartId) : undefined;
      const resolvedConfNome = confDataObj?.name || selectedUnit.name;
      const resolvedPartNome = cpDataObj?.name || selectedUnit.parentName;

      let boardRoleInfo: any = null;
      if (userData.membroId) {
        try {
          const { verifyMemberBoardRole } = await import('./lib/diretoria_helper');
          const boardRes = await verifyMemberBoardRole(db, userData.membroId, resolvedConfId);
          if (boardRes.isDirector) {
            boardRoleInfo = boardRes;
          }
        } catch (bErr) {
          console.error('Erro ao verificar diretoria no login:', bErr);
        }
      }

      const token = createAuthToken(validUserDoc.id, userData.username);

      res.json({
        success: true,
        token,
        user: { 
          id: validUserDoc.id,
          username: userData.username, 
          fullName: userData.fullName, 
          role: userData.role,
          professionalRegistration: userData.professionalRegistration,
          accessLevel: userData.accessLevel,
          mustChangePassword: userData.mustChangePassword ?? false,
          isFirstLogin: userData.isFirstLogin ?? false,
          membroId: userData.membroId,
          conferenciaId: resolvedConfId,
          particularId: resolvedPartId,
          conferenciaNome: resolvedConfNome,
          particularNome: resolvedPartNome,
          centralId: fullInstData.centralId || selectedUnit.centralId || userData.centralId || '54.927.132/0001-92',
          signature: signatureInfo,
          boardRoleInfo
        },
        boardRoleInfo,
        cnpj: selectedUnit.cnpj,
        institutionId: selectedUnit.id || selectedUnit.cnpj,
        availableUnits: authorizedUnits,
        hierarchy: {
          type: fullInstData.entityType || fullInstData.type || selectedUnit.type || (selectedUnit.cnpj === '54.927.132/0001-92' ? 'conselho_central' : 'obra_unida'),
          nacionalId: fullInstData.nacionalId,
          metropolitanoId: fullInstData.metropolitanoId,
          centralId: fullInstData.centralId || selectedUnit.centralId || userData.centralId || '54.927.132/0001-92',
          particularId: resolvedPartId,
          conferenciaId: resolvedConfId,
          conferenciaNome: resolvedConfNome,
          particularNome: resolvedPartNome
        }
      });
    } catch (error: any) {
      return handleApiError(res, error, 'Erro no login.');
    }
  });

  // Rota legada de manutenção: exige autenticação e somente o controlador global pode executá-la.
  app.get('/api/check-user-conselho', async (req: any, res) => {
    if (!hasGlobalControllerIdentity(req.user)) {
      return res.status(403).json({ error: 'Acesso restrito ao controlador global.' });
    }
    try {
      const result = await checkAndSyncConselhoUser();
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Erro ao verificar usuário do Conselho Central' });
    }
  });

  // Solicitação de redefinição de senha.
  // Enquanto não houver canal seguro de entrega do token, a rota não gera nem expõe credenciais temporárias.
  app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Informe o e-mail cadastrado.' });
    }

    return res.json({
      success: true,
      message: 'Se o e-mail informado estiver cadastrado, solicite ao administrador a redefinição da senha.'
    });
  });

  // Verificar validade do token de redefinição de senha
  app.get('/api/verify-reset-token', async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, error: 'Token não informado.' });
    }

    try {
      const userSnapshot = await safeQuery(async () => {
        return await db.collection('users').where('resetToken', '==', token).get();
      });

      if (!userSnapshot || userSnapshot.empty) {
        return res.status(400).json({ valid: false, error: 'Token de redefinição inválido ou não encontrado.' });
      }

      const userData = userSnapshot.docs[0].data();
      if (!userData.resetTokenExpiresAt || userData.resetTokenExpiresAt < Date.now()) {
        return res.status(400).json({ valid: false, error: 'O link temporário de redefinição expirou. Solicite um novo link.' });
      }

      return res.json({
        valid: true,
        email: userData.email || userData.username,
        fullName: userData.fullName || 'Usuário'
      });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao validar token de redefinição.');
    }
  });

  // Redefinir a senha do usuário com a nova senha informada
  app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve possuir no mínimo 6 caracteres.' });
    }

    try {
      const userSnapshot = await safeQuery(async () => {
        return await db.collection('users').where('resetToken', '==', token).get();
      });

      if (!userSnapshot || userSnapshot.empty) {
        return res.status(400).json({ error: 'Token de redefinição inválido ou não encontrado.' });
      }

      const userDoc = userSnapshot.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      if (!userData.resetTokenExpiresAt || userData.resetTokenExpiresAt < Date.now()) {
        return res.status(400).json({ error: 'O link temporário de redefinição expirou. Solicite um novo link.' });
      }

      // Atualiza a senha e descarta o token de redefinição. A senha antiga nunca é mantida/exibida em texto claro.
      await safeQuery(async () => {
        await db.collection('users').doc(userId).set({
          password: newPassword,
          resetToken: null,
          resetTokenExpiresAt: null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      return res.json({
        success: true,
        message: 'Sua senha foi redefinida com sucesso! Você já pode realizar o login com a nova senha.'
      });
    } catch (error: any) {
      return handleApiError(res, error, 'Erro ao redefinir a senha.');
    }
  });

  // Setup inicial: desabilitado por padrão e permitido somente em banco realmente vazio.
  app.post('/api/setup', async (req, res) => {
    try {
      if (process.env.ALLOW_INITIAL_SETUP !== 'true') {
        return res.status(403).json({ error: 'Setup inicial desabilitado neste ambiente.' });
      }

      const [instSnapshot, userSnapshot] = await Promise.all([
        safeQuery(async () => await db.collection('institutions').limit(1).get()),
        safeQuery(async () => await db.collection('users').limit(1).get())
      ]);

      if ((instSnapshot && !instSnapshot.empty) || (userSnapshot && !userSnapshot.empty)) {
        return res.status(403).json({ error: 'Setup desabilitado. O sistema já se encontra provisionado.' });
      }

      const institutionInput = req.body?.institution;
      const adminInput = req.body?.admin;
      if (!institutionInput || !adminInput) {
        return res.status(400).json({ error: 'Dados iniciais de instituição e administrador são obrigatórios.' });
      }

      const entityType = String(institutionInput.entityType || institutionInput.type || 'obra_unida').trim();
      const safeInstitution = {
        name: String(institutionInput.name || '').trim(),
        cnpj: String(institutionInput.cnpj || '').trim(),
        city: String(institutionInput.city || '').trim(),
        state: String(institutionInput.state || '').trim(),
        entityType,
        type: entityType
      };

      const safeAdmin = {
        username: String(adminInput.username || '').trim().toLowerCase(),
        email: String(adminInput.email || adminInput.username || '').trim().toLowerCase(),
        password: String(adminInput.password || ''),
        fullName: String(adminInput.fullName || '').trim(),
        accessLevel: 'administrador',
        role: 'Administrador',
        isGlobalAdmin: false,
        hasAllUnitsAccess: false,
        archived: false,
        status: 'ativo'
      };

      if (!safeInstitution.name || !safeAdmin.username || !safeAdmin.password || !safeAdmin.fullName) {
        return res.status(400).json({ error: 'Nome da instituição, usuário, senha e nome do administrador são obrigatórios.' });
      }

      if (hasGlobalControllerIdentity(safeAdmin)) {
        return res.status(403).json({ error: 'A identidade do controlador global não pode ser criada pelo setup inicial.' });
      }

      // Check if Nacional already exists if trying to create one
      if (entityType === 'nacional') {
        const nacionalSnapshot = await db.collection('institutions').where('entityType', '==', 'nacional').get();
        if (!nacionalSnapshot.empty) {
          return res.status(400).json({ error: 'Já existe um Conselho Nacional configurado.' });
        }
      }

      const instRef = await db.collection('institutions').add(safeInstitution);
      const institutionId = instRef.id;

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
      const userRef = await db.collection('users').add({
        ...safeAdmin,
        institutionId,
        institutionType: entityType
      });

      const token = createAuthToken(userRef.id, safeAdmin.username);
      const responseUser = sanitizeUserForResponse({
        ...safeAdmin,
        id: userRef.id,
        institutionId,
        institutionType: entityType
      });

      return res.json({
        success: true,
        token,
        institutionId,
        user: responseUser,
        hierarchy: {
          type: entityType,
          nacionalId: finalInstData?.nacionalId,
          metropolitanoId: finalInstData?.metropolitanoId,
          centralId: finalInstData?.centralId,
          particularId: finalInstData?.particularId,
          conferenciaId: finalInstData?.conferenciaId
        }
      });
    } catch (error: any) {
      console.error('Setup error:', error);
      return sendDatabaseError(res, error, 'Erro ao configurar instituição.');
    }
  });

  // CRUD for Residents
  app.get('/api/residents', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante', 'medico', 'administrador', 'auxiliar_administrativo']), async (req, res) => {
    const { institutionId, type } = req.query;
    if (!institutionId) return res.status(400).json({ error: 'institutionId requerido' });
    
    if ((req as any).user && !isUserAuthorizedForInstitution((req as any).user, institutionId as string)) {
      return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
    }

    const requesterLevel = normalizeAccessLevel((req as any).user?.accessLevel || (req as any).user?.role);
    const isVisitorPortalUser = requesterLevel === 'visitante';
    const cacheKey = `residents:${institutionId}:${type || 'default'}:${isVisitorPortalUser ? 'visitor' : 'standard'}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const residents = await safeQuery(async () => {
      const realId = await getRealInstitutionId(institutionId as string);
      let query: any = db.collection('residents');
      
      if (type === 'particular') query = query.where('particularId', '==', realId);
      else if (type === 'central') query = query.where('centralId', '==', realId);
      else if (type === 'metropolitano') query = query.where('metropolitanoId', '==', realId);
      else if (type === 'nacional') query = query.where('nacionalId', '==', realId);
      else if (isMonteAltoUnit(realId)) query = query.where('institutionId', 'in', getMonteAltoQueryIds());
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

        if (isVisitorPortalUser) {
          return {
            id: doc.id,
            name: data.name || '',
            status: data.status || 'ativo',
            relatives: Array.isArray(data.relatives)
              ? data.relatives.filter((relative: any) => !relative?.deceased)
              : [],
            visitRecords: Array.isArray(data.visitRecords) ? data.visitRecords : []
          };
        }

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
    
    if (residents && Array.isArray(residents)) {
      setToCache(cacheKey, residents);
    }
    res.json(residents);
  });

  
  app.get('/api/residents/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante', 'medico', 'administrador', 'auxiliar_administrativo']), async (req: any, res) => {
    try {
      const doc = await db.collection('residents').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      const resident: any = { ...doc.data(), id: doc.id };
      const requesterLevel = normalizeAccessLevel(req.user?.accessLevel || req.user?.role);

      if (requesterLevel === 'visitante') {
        const primaryInstitutionId = req.user?.institutionId;
        if (
          !primaryInstitutionId ||
          getCanonicalInstitutionId(primaryInstitutionId) !== getCanonicalInstitutionId(resident.institutionId)
        ) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }

        return res.json({
          id: resident.id,
          name: resident.name || '',
          status: resident.status || 'ativo',
          relatives: Array.isArray(resident.relatives)
            ? resident.relatives.filter((relative: any) => !relative?.deceased)
            : [],
          visitRecords: Array.isArray(resident.visitRecords) ? resident.visitRecords : []
        });
      }

      if (!isAuthorizedForDocument(req.user, resident)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      res.json(resident);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar residente' );
    }
  });

  app.get('/api/candidates/:id', requireRole(['assistente_social', 'enfermeira', 'gerencial', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'administrador']), async (req: any, res) => {
    try {
      const doc = await db.collection('candidates').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      const candidate = { ...doc.data(), id: doc.id };
      if (!isAuthorizedForDocument(req.user, candidate)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      res.json(candidate);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar candidato' );
    }
  });


  app.post('/api/residents', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante', 'medico', 'auxiliar_administrativo', 'administrador']), async (req: any, res) => {
    const data = req.body;
    try {
      const user = req.user;
      let targetInstId = data.institutionId ? await getRealInstitutionId(data.institutionId) : '';
      if (!targetInstId && user?.institutionId) {
        targetInstId = await getRealInstitutionId(user.institutionId);
      }
      if (!targetInstId || !isUserAuthorizedForInstitution(user, targetInstId)) {
        return res.status(403).json({ error: 'Acesso negado para a instituição informada.' });
      }

      data.institutionId = targetInstId;
      const requesterLevel = normalizeAccessLevel(user?.accessLevel || user?.role);
      if (requesterLevel === 'visitante' && !data.id) {
        return res.status(403).json({ error: 'A conta de Portaria não pode criar residentes.' });
      }

      const auditEntry = {
        action: data.id ? 'update' : 'create',
        timestamp: new Date().toISOString(),
        userId: user?.id || 'unknown',
        username: user?.username || 'unknown',
      };
      
      const payload = { ...data };
      payload.auditLog = admin.firestore.FieldValue.arrayUnion(auditEntry);

      if (payload.id) {
        // Validação do registro existente no banco antes de atualizar
        const existingDoc = await db.collection('residents').doc(payload.id).get();
        if (!existingDoc.exists) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        const existingData = existingDoc.data();
        if (!isAuthorizedForDocument(user, existingData)) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }

        // Impedir mudança de instituição sem transferência formal
        if (existingData.institutionId) {
          const existingCanonical = getCanonicalInstitutionId(existingData.institutionId);
          const targetCanonical = getCanonicalInstitutionId(targetInstId);
          if (existingCanonical !== targetCanonical) {
            return res.status(400).json({ error: 'Transferência de instituição não permitida nesta operação.' });
          }
        }

        if (requesterLevel === 'visitante') {
          const existingRelatives = Array.isArray(existingData.relatives) ? existingData.relatives : [];
          const incomingRelatives = Array.isArray(data.relatives) ? data.relatives : [];

          const incomingById = new Map<string, any>();
          incomingRelatives.forEach((relative: any) => {
            if (relative?.id) incomingById.set(String(relative.id), relative);
          });

          const mergedRelatives = existingRelatives.map((existingRelative: any) => {
            const incoming = existingRelative?.id ? incomingById.get(String(existingRelative.id)) : undefined;
            if (!incoming) return existingRelative;

            return {
              ...existingRelative,
              name: incoming.name ?? existingRelative.name,
              kinship: incoming.kinship ?? existingRelative.kinship,
              phone: incoming.phone ?? existingRelative.phone,
              document: incoming.document ?? existingRelative.document,
              photoUrl: incoming.photoUrl ?? existingRelative.photoUrl,
              faceDescriptor: incoming.faceDescriptor ?? existingRelative.faceDescriptor
            };
          });

          const existingRelativeIds = new Set(existingRelatives.map((relative: any) => String(relative?.id || '')).filter(Boolean));
          incomingRelatives.forEach((incoming: any) => {
            if (!incoming?.id || existingRelativeIds.has(String(incoming.id))) return;
            mergedRelatives.push({
              id: String(incoming.id),
              name: incoming.name || '',
              kinship: incoming.kinship || 'Familiar',
              phone: incoming.phone || '',
              document: incoming.document || '',
              photoUrl: incoming.photoUrl,
              faceDescriptor: incoming.faceDescriptor,
              observation: 'Cadastrado pela Portaria',
              isResponsible: false,
              deceased: false
            });
          });

          const existingVisitRecords = Array.isArray(existingData.visitRecords) ? existingData.visitRecords : [];
          const existingVisitIds = new Set(existingVisitRecords.map((visit: any) => String(visit?.id || '')).filter(Boolean));
          const incomingVisitRecords = Array.isArray(data.visitRecords) ? data.visitRecords : [];
          const newVisitRecords = incomingVisitRecords.filter((visit: any) => visit?.id && !existingVisitIds.has(String(visit.id)));
          const mergedVisitRecords = [...existingVisitRecords, ...newVisitRecords];

          const safePortariaUpdate = {
            institutionId: existingData.institutionId || targetInstId,
            relatives: mergedRelatives,
            visitRecords: mergedVisitRecords,
            auditLog: admin.firestore.FieldValue.arrayUnion(auditEntry)
          };

          await db.collection('residents').doc(payload.id).set(safePortariaUpdate, { merge: true });
          await logAudit('update', 'residents', payload.id, req, safePortariaUpdate.institutionId, `Atualização operacional de portaria do residente ${existingData.name || ''}`);
          invalidateCache('residents');
          return res.json({
            id: payload.id,
            name: existingData.name || '',
            status: existingData.status || 'ativo',
            relatives: mergedRelatives.filter((relative: any) => !relative?.deceased),
            visitRecords: mergedVisitRecords
          });
        }

        const { id, ...updateData } = payload;
        await db.collection('residents').doc(id).set(updateData, { merge: true });
        await logAudit('update', 'residents', id, req, payload.institutionId, `Atualização do residente ${payload.name}`);
        invalidateCache('residents');
        res.json(data);
      } else {
        const docRef = await db.collection('residents').add(payload);
        await logAudit('create', 'residents', docRef.id, req, payload.institutionId, `Novo residente cadastrado: ${payload.name}`);
        invalidateCache('residents');
        res.json({ ...data, id: docRef.id });
      }
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar residente.' );
    }
  });

  app.post('/api/residents/bulk', requireRole(['administrador', 'gerencial', 'assistente_social', 'enfermeira', 'auxiliar_administrativo']), async (req: any, res) => {
    const { residents } = req.body;
    if (!Array.isArray(residents) || residents.length === 0) {
      return res.status(400).json({ error: 'Lista de residentes inválida ou vazia.' });
    }
    
    const user = req.user;

    try {
      // 1. Pré-validação rigorosa de todos os itens do lote antes de qualquer gravação
      const preparedResidents: any[] = [];
      const existingIds: string[] = [];

      for (let i = 0; i < residents.length; i++) {
        const resi = { ...residents[i] };
        let targetInstId = resi.institutionId ? await getRealInstitutionId(resi.institutionId) : '';
        if (!targetInstId && user?.institutionId) {
          targetInstId = await getRealInstitutionId(user.institutionId);
        }

        if (!targetInstId || typeof targetInstId !== 'string' || targetInstId.trim() === '') {
          return res.status(400).json({
            error: `Operação em lote rejeitada: item na posição ${i} não possui instituição de destino válida.`
          });
        }

        if (!isUserAuthorizedForInstitution(user, targetInstId)) {
          return res.status(403).json({
            error: `Operação em lote rejeitada: usuário não autorizado para a instituição de destino (${targetInstId}).`
          });
        }

        resi.institutionId = targetInstId;
        preparedResidents.push(resi);

        if (resi.id && !resi.id.startsWith('MOCK-') && resi.id.length > 5) {
          existingIds.push(resi.id);
        }
      }

      // 2. Validação dos documentos existentes no banco
      if (existingIds.length > 0) {
        const existingDocsSnapshots = await Promise.all(
          existingIds.map(id => db.collection('residents').doc(id).get())
        );
        const existingMap = new Map<string, any>();
        existingDocsSnapshots.forEach(snap => {
          if (snap.exists) {
            existingMap.set(snap.id, snap.data());
          }
        });

        for (const resi of preparedResidents) {
          if (resi.id && existingMap.has(resi.id)) {
            const stored = existingMap.get(resi.id);

            // Rejeitar registros existentes sem vínculo comprovado
            if (!stored.institutionId || typeof stored.institutionId !== 'string' || stored.institutionId.trim() === '') {
              return res.status(403).json({
                error: `Operação em lote rejeitada: documento (${resi.id}) não possui vínculo institucional comprovado.`
              });
            }

            // Impedir alteração de documentos de outra instituição
            if (!isUserAuthorizedForInstitution(user, stored.institutionId)) {
              return res.status(403).json({
                error: `Operação em lote rejeitada: documento (${resi.id}) pertence a outra instituição.`
              });
            }

            // Impedir transferência implícita entre instituições distintas
            const storedCanonical = getCanonicalInstitutionId(stored.institutionId);
            const targetCanonical = getCanonicalInstitutionId(resi.institutionId);
            if (storedCanonical !== targetCanonical) {
              return res.status(400).json({
                error: `Operação em lote rejeitada: documento (${resi.id}) não pode sofrer transferência entre instituições distintas via gravação em massa.`
              });
            }
          }
        }
      }

      // 3. Gravação em lotes (máximo de 400 por batch Firestore)
      // LIMITAÇÕES DE ATOMICIDADE:
      // - A pré-validação reduz falhas de autorização antes das gravações.
      // - Commits separados não garantem atomicidade do conjunto.
      // - Uma falha posterior pode deixar grupos anteriores já gravados.
      const MAX_BATCH_SIZE = 400;
      for (let i = 0; i < preparedResidents.length; i += MAX_BATCH_SIZE) {
        const chunk = preparedResidents.slice(i, i + MAX_BATCH_SIZE);
        const batch = db.batch();
        
        for (const resi of chunk) {
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
      invalidateCache('residents');
      res.json({ success: true, count: preparedResidents.length });
    } catch (error: any) {
      console.error('Error in bulk resident save:', error);
      return sendDatabaseError(res, error, 'Erro ao realizar salvamento em massa de residentes.' );
    }
  });

  // CRUD for Candidates
  app.get('/api/candidates', requireRole(['assistente_social', 'enfermeira', 'gerencial', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, type } = req.query;
    if (!institutionId) return res.status(400).json({ error: 'institutionId requerido' });

    if ((req as any).user && !isUserAuthorizedForInstitution((req as any).user, institutionId as string)) {
      return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
    }

    const cacheKey = `candidates:${institutionId}:${type || 'default'}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const candidates = await safeQuery(async () => {
      const realId = await getRealInstitutionId(institutionId as string);
      let query: any = db.collection('candidates');
      
      if (type === 'particular') query = query.where('particularId', '==', realId);
      else if (type === 'central') query = query.where('centralId', '==', realId);
      else if (type === 'metropolitano') query = query.where('metropolitanoId', '==', realId);
      else if (type === 'nacional') query = query.where('nacionalId', '==', realId);
      else if (isMonteAltoUnit(realId)) query = query.where('institutionId', 'in', getMonteAltoQueryIds());
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
    
    if (candidates && Array.isArray(candidates)) {
      setToCache(cacheKey, candidates);
    }
    res.json(candidates);
  });

  app.post('/api/candidates', requireRole(['assistente_social', 'enfermeira', 'gerencial', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'medico', 'administrador']), async (req: any, res) => {
    const data = req.body;
    try {
      const user = req.user;
      let targetInstId = data.institutionId ? await getRealInstitutionId(data.institutionId) : '';
      if (!targetInstId && user?.institutionId) {
        targetInstId = await getRealInstitutionId(user.institutionId);
      }
      if (!targetInstId || !isUserAuthorizedForInstitution(user, targetInstId)) {
        return res.status(403).json({ error: 'Acesso negado para a instituição informada.' });
      }

      data.institutionId = targetInstId;
      const auditEntry = {
        action: data.id ? 'update' : 'create',
        timestamp: new Date().toISOString(),
        userId: user?.id || 'unknown',
        username: user?.username || 'unknown',
      };

      const payload = { ...data };
      payload.auditLog = admin.firestore.FieldValue.arrayUnion(auditEntry);

      if (payload.id) {
        // Validação do documento existente no banco
        const existingDoc = await db.collection('candidates').doc(payload.id).get();
        if (!existingDoc.exists) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        const existingData = existingDoc.data();
        if (!isAuthorizedForDocument(user, existingData)) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }

        // Impedir mudança de instituição sem transferência formal
        if (existingData.institutionId) {
          const existingCanonical = getCanonicalInstitutionId(existingData.institutionId);
          const targetCanonical = getCanonicalInstitutionId(targetInstId);
          if (existingCanonical !== targetCanonical) {
            return res.status(400).json({ error: 'Transferência de instituição não permitida nesta operação.' });
          }
        }

        const { id, ...updateData } = payload;
        await db.collection('candidates').doc(id).set(updateData, { merge: true });
        await logAudit('update', 'candidates', id, req, payload.institutionId, `Atualização da triagem: ${payload.name}`);
        invalidateCache('candidates');
        res.json(data);
      } else {
        const docRef = await db.collection('candidates').add(payload);
        await logAudit('create', 'candidates', docRef.id, req, payload.institutionId, `Nova triagem cadastrada: ${payload.name}`);
        invalidateCache('candidates');
        res.json({ ...data, id: docRef.id });
      }
    } catch (error: any) {
      console.error('Error saving candidate:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar candidato.' );
    }
  });

  app.post('/api/candidates/bulk', requireRole(['administrador', 'gerencial', 'assistente_social', 'enfermeira', 'auxiliar_administrativo']), async (req: any, res) => {
    const { candidates } = req.body;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'Lista de candidatos inválida ou vazia.' });
    }
    
    const user = req.user;

    try {
      // 1. Pré-validação rigorosa de todos os itens do lote antes de qualquer gravação
      const preparedCandidates: any[] = [];
      const existingIds: string[] = [];

      for (let i = 0; i < candidates.length; i++) {
        const cand = { ...candidates[i] };
        let targetInstId = cand.institutionId ? await getRealInstitutionId(cand.institutionId) : '';
        if (!targetInstId && user?.institutionId) {
          targetInstId = await getRealInstitutionId(user.institutionId);
        }

        if (!targetInstId || typeof targetInstId !== 'string' || targetInstId.trim() === '') {
          return res.status(400).json({
            error: `Operação em lote rejeitada: item na posição ${i} não possui instituição de destino válida.`
          });
        }

        if (!isUserAuthorizedForInstitution(user, targetInstId)) {
          return res.status(403).json({
            error: `Operação em lote rejeitada: usuário não autorizado para a instituição de destino (${targetInstId}).`
          });
        }

        cand.institutionId = targetInstId;
        preparedCandidates.push(cand);

        if (cand.id && !cand.id.startsWith('MOCK-') && cand.id.length > 5) {
          existingIds.push(cand.id);
        }
      }

      // 2. Validação dos documentos existentes no banco
      if (existingIds.length > 0) {
        const existingDocsSnapshots = await Promise.all(
          existingIds.map(id => db.collection('candidates').doc(id).get())
        );
        const existingMap = new Map<string, any>();
        existingDocsSnapshots.forEach(snap => {
          if (snap.exists) {
            existingMap.set(snap.id, snap.data());
          }
        });

        for (const cand of preparedCandidates) {
          if (cand.id && existingMap.has(cand.id)) {
            const stored = existingMap.get(cand.id);

            // Rejeitar registros existentes sem vínculo comprovado
            if (!stored.institutionId || typeof stored.institutionId !== 'string' || stored.institutionId.trim() === '') {
              return res.status(403).json({
                error: `Operação em lote rejeitada: documento (${cand.id}) não possui vínculo institucional comprovado.`
              });
            }

            // Impedir alteração de documentos de outra instituição
            if (!isUserAuthorizedForInstitution(user, stored.institutionId)) {
              return res.status(403).json({
                error: `Operação em lote rejeitada: documento (${cand.id}) pertence a outra instituição.`
              });
            }

            // Impedir transferência implícita entre instituições distintas
            const storedCanonical = getCanonicalInstitutionId(stored.institutionId);
            const targetCanonical = getCanonicalInstitutionId(cand.institutionId);
            if (storedCanonical !== targetCanonical) {
              return res.status(400).json({
                error: `Operação em lote rejeitada: documento (${cand.id}) não pode sofrer transferência entre instituições distintas via gravação em massa.`
              });
            }
          }
        }
      }

      // 3. Gravação em lotes (limite de 400 por batch)
      // LIMITAÇÕES DE ATOMICIDADE:
      // - A pré-validação reduz falhas de autorização antes das gravações.
      // - Commits separados não garantem atomicidade do conjunto.
      // - Uma falha posterior pode deixar grupos anteriores já gravados.
      const MAX_BATCH_SIZE = 400;
      for (let i = 0; i < preparedCandidates.length; i += MAX_BATCH_SIZE) {
        const chunk = preparedCandidates.slice(i, i + MAX_BATCH_SIZE);
        const batch = db.batch();
        for (const cand of chunk) {
          let docRef;
          if (cand.id && !cand.id.startsWith('MOCK-') && cand.id.length > 5) {
            docRef = db.collection('candidates').doc(cand.id);
            const { id, ...updateData } = cand;
            batch.set(docRef, updateData, { merge: true });
          } else {
            docRef = db.collection('candidates').doc();
            batch.set(docRef, cand);
          }
        }
        await batch.commit();
      }
      invalidateCache('candidates');
      res.json({ success: true, count: preparedCandidates.length });
    } catch (error: any) {
      console.error('Error in bulk candidate save:', error);
      return sendDatabaseError(res, error, 'Erro ao realizar salvamento em massa de candidatos.' );
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
      return sendDatabaseError(res, e, e.message );
    }
  });

  app.get('/api/settings', async (req, res) => {
    const { institutionId } = req.query;
    if (!institutionId) return res.status(400).json({ error: 'ID da instituição não informado' });
    
    // Validação de escopo de autorização se o usuário estiver autenticado
    if ((req as any).user && !isUserAuthorizedForInstitution((req as any).user, institutionId as string)) {
      return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
    }

    try {
      const demoData = {
        id: 'demo-institution-id',
        name: 'Lar São Vicente de Paulo (Unidade de Demonstração)',
        cnpj: '00.111.222/0001-33',
        city: 'Cidade Exemplo',
        entityType: 'obra_unida',
        type: 'obra_unida'
      };

      const isMonte = isMonteAltoUnit(institutionId as string);

      // Tentar buscar por ID direto em institutions
      let doc: any = null;

      // Se for Monte Alto, priorizar consulta direta ao documento operacional principal NquBdSy0A3ixzHnyj0YF
      if (isMonte) {
        doc = await db.collection("institutions").doc(MONTE_ALTO_OPERATIONAL_ID).get();
      }

      if ((!doc || !doc.exists) && !(institutionId as string).includes("/")) {
        doc = await db.collection("institutions").doc(institutionId as string).get();
      }

      // Tentar buscar por CNPJ (formatado e não formatado) em institutions
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
        
        if (!snapshot.empty) {
          // Se for Monte Alto, priorizar NquBdSy0A3ixzHnyj0YF se estiver no snapshot
          const foundMonte = isMonte ? snapshot.docs.find((d: any) => d.id === MONTE_ALTO_OPERATIONAL_ID) : null;
          doc = foundMonte || snapshot.docs[0];
        }
      }

      // Suporte a Unidades Vicentinas: Se não achou em institutions, busca em conferencias
      if (!doc || !doc.exists) {
        const confDoc = await db.collection("conferencias").doc(institutionId as string).get();
        if (confDoc.exists) {
          const confData = confDoc.data() || {};
          return res.json({
            id: confDoc.id,
            name: confData.name || 'Conferência Vicentina',
            entityType: 'conferencia',
            type: 'conferencia',
            city: confData.city || '',
            state: confData.state || 'SP',
            particularId: confData.particularId || '',
            centralId: confData.centralId || '54.927.132/0001-92',
            ...confData
          });
        }
      }

      // Suporte a Unidades Vicentinas: Se não achou, busca em conselhos_particulares
      if (!doc || !doc.exists) {
        const cpDoc = await db.collection("conselhos_particulares").doc(institutionId as string).get();
        if (cpDoc.exists) {
          const cpData = cpDoc.data() || {};
          return res.json({
            id: cpDoc.id,
            name: cpData.name || 'Conselho Particular',
            entityType: 'particular',
            type: 'particular',
            city: cpData.city || '',
            state: cpData.state || 'SP',
            centralId: cpData.centralId || '54.927.132/0001-92',
            ...cpData
          });
        }
      }

      if (!doc || !doc.exists) {
        if (isMonte) {
          return res.json({
            id: MONTE_ALTO_OPERATIONAL_ID,
            name: 'Lar São Vicente de Paulo de Monte Alto',
            cnpj: MONTE_ALTO_CNPJ,
            type: 'obra_unida',
            entityType: 'obra_unida',
            city: 'Monte Alto',
            state: 'SP'
          });
        }
        if (institutionId === 'demo-institution-id' || institutionId === '00.111.222/0001-33') return res.json(demoData);
        return res.status(404).json({ error: 'Instituição não encontrada' });
      }

      const dbData = doc.data() || {};
      const finalId = isMonte ? MONTE_ALTO_OPERATIONAL_ID : doc.id;
      if (institutionId === 'demo-institution-id' || institutionId === '00.111.222/0001-33') {
        return res.json({ ...demoData, ...dbData, id: finalId });
      }
      return res.json({ ...dbData, id: finalId });
      
    } catch (error: any) {
      console.error('API Settings Error:', error);
      return sendDatabaseError(res, error, 'Erro de conexão no banco de dados');
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
    } catch (error: any) {
      console.error('Telegram test network error:', error);
      return sendDatabaseError(res, error, 'Erro de conexão com a API do Telegram.' );
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

      // Verifica se é uma Conferência cadastrada
      const confRef = db.collection("conferencias").doc(institutionId);
      const confDoc = await confRef.get();
      if (confDoc.exists) {
        await confRef.set(settings, { merge: true });
        const updated = await confRef.get();
        return res.json({ success: true, ...updated.data(), id: confRef.id, entityType: 'conferencia', type: 'conferencia' });
      }

      // Verifica se é um Conselho Particular cadastrado
      const cpRef = db.collection("conselhos_particulares").doc(institutionId);
      const cpDoc = await cpRef.get();
      if (cpDoc.exists) {
        await cpRef.set(settings, { merge: true });
        const updated = await cpRef.get();
        return res.json({ success: true, ...updated.data(), id: cpRef.id, entityType: 'particular', type: 'particular' });
      }

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
    } catch (error: any) {
      console.error('Settings save error:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar configurações.' );
    }
  });

  // Helper para identificar erros de cota e responder rápido com HTTP 503
  function isQuotaError(error: any): boolean {
    if (!error) return false;
    const code = error.code || error.status;
    const errStr = String(error.message || error.details || error);
    return code === 8 || code === 'RESOURCE_EXHAUSTED' || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota exceeded');
  }

  // Cache temporário em memória para deduplicação de mensagens no mural
  const recentMuralPosts = new Map<string, { timestamp: number; result: any }>();

  // Cache institucional bruto do mural. Mantém o histórico normalizado por unidade
  // para evitar releituras completas frequentes do Firestore.
  interface MuralRawCacheEntry {
    messages: any[];
    loadedAt: number;
  }

  const muralRawCache = new Map<string, MuralRawCacheEntry>();
  const MURAL_RAW_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

  function normalizeMuralTimestamp(value: any): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed)) {
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : 0;
      }
      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value.toMillis === 'function') {
      const millis = value.toMillis();
      return Number.isFinite(millis) ? millis : 0;
    }
    if (value && typeof value.toDate === 'function') {
      const millis = value.toDate().getTime();
      return Number.isFinite(millis) ? millis : 0;
    }
    if (value && typeof value.seconds === 'number') {
      const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
      return (value.seconds * 1000) + Math.floor(nanos / 1_000_000);
    }
    if (value && typeof value._seconds === 'number') {
      const nanos = typeof value._nanoseconds === 'number' ? value._nanoseconds : 0;
      return (value._seconds * 1000) + Math.floor(nanos / 1_000_000);
    }
    return 0;
  }

  function getMuralCacheKey(institutionId: string): string {
    return getCanonicalInstitutionId(institutionId) || institutionId;
  }

  function getBrazilDateString(timestampMs: number): string {
    if (!timestampMs || !Number.isFinite(timestampMs)) return '';
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(timestampMs));
  }

  function normalizeMuralMessage(raw: any, id?: string): any {
    return {
      ...raw,
      ...(id ? { id } : {}),
      timestamp: normalizeMuralTimestamp(raw?.timestamp)
    };
  }

  function sortMuralDesc(messages: any[]): any[] {
    return messages.sort((a: any, b: any) => {
      const tsDiff = (b.timestamp || 0) - (a.timestamp || 0);
      if (tsDiff !== 0) return tsDiff;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  async function loadInstitutionMuralRaw(institutionId: string): Promise<any[]> {
    const cacheKey = getMuralCacheKey(institutionId);
    const cached = muralRawCache.get(cacheKey);
    if (cached && (Date.now() - cached.loadedAt) < MURAL_RAW_CACHE_TTL_MS) {
      return cached.messages;
    }

    const canonicalId = getCanonicalInstitutionId(institutionId);
    const ids = isMonteAltoUnit(canonicalId)
      ? Array.from(new Set(getMonteAltoQueryIds()))
      : Array.from(new Set([institutionId, canonicalId].filter(Boolean)));

    let query: any = db.collection('muralMessages');
    if (ids.length === 1) {
      query = query.where('institutionId', '==', ids[0]);
    } else {
      query = query.where('institutionId', 'in', ids);
    }

    const snapshot = await query.get();
    const normalized = sortMuralDesc(
      snapshot.docs
        .map((doc: any) => normalizeMuralMessage(doc.data(), doc.id))
        .filter((item: any) => !item.archived)
    );

    muralRawCache.set(cacheKey, {
      messages: normalized,
      loadedAt: Date.now()
    });

    return normalized;
  }

  function updateMuralCacheIfLoaded(institutionId: string, updater: (messages: any[]) => any[]): void {
    const cacheKey = getMuralCacheKey(institutionId);
    const cached = muralRawCache.get(cacheKey);
    if (!cached) return;

    cached.messages = sortMuralDesc(updater([...cached.messages]));
    muralRawCache.set(cacheKey, cached);
  }

  async function enrichMuralAuthors(messages: any[]): Promise<any[]> {
    const missingAuthorUserIds = new Set<string>();
    messages.forEach((msg: any) => {
      if (!msg.authorDisplayName && !msg.authorName && msg.authorUserId) {
        missingAuthorUserIds.add(msg.authorUserId);
      }
    });

    if (missingAuthorUserIds.size === 0) return messages;

    const authorMap = new Map<string, any>();
    const idsArray = Array.from(missingAuthorUserIds).slice(0, 30);
    try {
      const usersSnap = await db.collection('users').where(FieldPath.documentId(), 'in', idsArray).get();
      usersSnap.docs.forEach((doc: any) => authorMap.set(doc.id, doc.data()));
    } catch (err) {
      console.warn("Aviso ao buscar autores em lote:", err);
      return messages;
    }

    return messages.map((msg: any) => {
      if (!msg.authorDisplayName && !msg.authorName && msg.authorUserId) {
        const uData = authorMap.get(msg.authorUserId);
        if (uData) {
          return {
            ...msg,
            authorDisplayName: uData.fullName || uData.username,
            authorFunction: uData.role || '',
            authorName: uData.fullName || uData.username,
            authorRole: uData.role || ''
          };
        }
      }
      return msg;
    });
  }

  // Mural Messages
  app.get('/api/mural', requireAuth, async (req: any, res) => {
    const { institutionId, date } = req.query;

    if (!institutionId || typeof institutionId !== 'string') {
      return res.status(400).json({ error: 'institutionId é obrigatório' });
    }

    if (!isUserAuthorizedForInstitution(req.user, institutionId)) {
      return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
    }

    if (date && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      return res.status(400).json({ error: 'Data inválida. Use o formato YYYY-MM-DD.' });
    }

    try {
      const rawMessages = await loadInstitutionMuralRaw(institutionId);

      let visibleMessages = rawMessages
        .filter((msg: any) => isUserAuthorizedToViewMuralMessage(req.user, msg));

      if (typeof date === 'string' && date) {
        visibleMessages = visibleMessages.filter((msg: any) =>
          getBrazilDateString(msg.timestamp) === date
        );
      } else {
        visibleMessages = visibleMessages.slice(0, 50);
      }

      visibleMessages = await enrichMuralAuthors(visibleMessages);

      // O chat exibe do mais antigo para o mais recente.
      return res.json([...visibleMessages].reverse());
    } catch (error) {
      if (isQuotaError(error)) {
        return res.status(503).json({ error: 'Cota de requisições do banco de dados excedida (RESOURCE_EXHAUSTED). Tente novamente mais tarde.', code: 'RESOURCE_EXHAUSTED' });
      }
      console.error('Error fetching mural:', error);
      return sendDatabaseError(res, error);
    }
  });

  app.post('/api/mural', requireAuth, async (req: any, res) => {
    const data = { ...req.body };
    try {
      const user = req.user;
      let targetInstId = data.institutionId ? await getRealInstitutionId(data.institutionId) : '';
      if (!targetInstId && user?.institutionId) {
        targetInstId = await getRealInstitutionId(user.institutionId);
      }
      if (!targetInstId || !isUserAuthorizedForInstitution(user, targetInstId)) {
        return res.status(403).json({ error: 'Acesso negado para postar no mural desta instituição.' });
      }
      data.institutionId = targetInstId;

      const normalizedTimestamp = normalizeMuralTimestamp(data.timestamp);
      data.timestamp = normalizedTimestamp || Date.now();

      // Prevenção contra envio duplicado no servidor (deduplicação por hash de texto + usuário em janela de 5s)
      const authorId = user?.username || data.author || 'anon';
      const dedupeKey = `${data.institutionId}_${authorId}_${(data.text || '').trim()}`;
      const now = Date.now();
      const existing = recentMuralPosts.get(dedupeKey);

      if (existing && (now - existing.timestamp < 5000)) {
        return res.json(existing.result);
      }

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
        data.authorName = data.authorDisplayName;
        data.authorRole = data.authorFunction;

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
              data.authorName = nomeStr;
              data.authorRole = funcaoStr;
            }
          } catch (e) {
            console.error("Erro ao enriquecer autor da mensagem do mural:", e);
          }
        }
      }

      const docRef = await db.collection('muralMessages').add(data);
      const resultObj = normalizeMuralMessage({ ...data }, docRef.id);

      recentMuralPosts.set(dedupeKey, { timestamp: now, result: resultObj });
      if (recentMuralPosts.size > 100) {
        for (const [k, v] of recentMuralPosts.entries()) {
          if (now - v.timestamp > 10000) recentMuralPosts.delete(k);
        }
      }

      updateMuralCacheIfLoaded(data.institutionId, (messages) => [
        resultObj,
        ...messages.filter((msg: any) => msg.id !== resultObj.id)
      ]);

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

              const textPart = data.text ? `\n📄 ${data.text}` : '';
              const detailsPart = data.detailedContent ? `\n\n📝 _Detalhes:_\n${data.detailedContent}` : '';
              const message = `🔔 *NOVA MENSAGEM NO MURAL*\n\n${titlePart}${authorLine}${textPart}${detailsPart}`;

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

      return res.json(resultObj);
    } catch (error) {
      if (isQuotaError(error)) {
        return res.status(503).json({ error: 'Cota de requisições do banco de dados excedida (RESOURCE_EXHAUSTED). Tente novamente mais tarde.', code: 'RESOURCE_EXHAUSTED' });
      }
      return sendDatabaseError(res, error);
    }
  });

  app.get('/api/mural/:id', requireAuth, async (req: any, res) => {
    try {
      const doc = await db.collection('muralMessages').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      const message = normalizeMuralMessage(doc.data(), doc.id);
      if (!isUserAuthorizedToViewMuralMessage(req.user, message)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      return res.json(message);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar mensagem do mural');
    }
  });

  app.put('/api/mural/:id', requireAuth, async (req: any, res) => {
    try {
      const docRef = db.collection('muralMessages').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const current: any = doc.data();
      if (!isAuthorizedForDocument(req.user, current)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const currentAuthor = String(current.authorEmail || current.author || '').trim().toLowerCase();
      const requester = String(req.user?.username || req.user?.email || '').trim().toLowerCase();
      if (!currentAuthor || currentAuthor !== requester) {
        return res.status(403).json({ error: 'Apenas o autor pode editar esta mensagem.' });
      }

      const text = String(req.body?.text || '').trim();
      if (!text) {
        return res.status(400).json({ error: 'Texto da mensagem é obrigatório.' });
      }

      await docRef.update({ text, updatedAt: new Date().toISOString() });

      updateMuralCacheIfLoaded(current.institutionId, (messages) =>
        messages.map((msg: any) =>
          msg.id === req.params.id ? { ...msg, text, updatedAt: new Date().toISOString() } : msg
        )
      );

      return res.json({ success: true, id: req.params.id, text });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao editar mensagem do mural');
    }
  });

  app.post('/api/mural/:id/like', requireAuth, async (req: any, res) => {
    try {
      const docRef = db.collection('muralMessages').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const current: any = doc.data();
      const normalizedCurrent = normalizeMuralMessage(current, doc.id);
      if (!isUserAuthorizedToViewMuralMessage(req.user, normalizedCurrent)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const username = String(req.user?.username || '').trim();
      if (!username) {
        return res.status(400).json({ error: 'Usuário inválido.' });
      }

      const likes = Array.isArray(current.likes) ? current.likes.filter(Boolean) : [];
      const newLikes = likes.includes(username)
        ? likes.filter((u: string) => u !== username)
        : [...likes, username];

      await docRef.update({ likes: newLikes });

      updateMuralCacheIfLoaded(current.institutionId, (messages) =>
        messages.map((msg: any) =>
          msg.id === req.params.id ? { ...msg, likes: newLikes } : msg
        )
      );

      return res.json({ success: true, id: req.params.id, likes: newLikes });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao curtir mensagem do mural');
    }
  });

  app.delete('/api/mural/:id', requireAuth, async (req: any, res) => {
    try {
      const docRef = db.collection('muralMessages').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const current: any = doc.data();
      if (!isAuthorizedForDocument(req.user, current)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const currentAuthor = String(current.authorEmail || current.author || '').trim().toLowerCase();
      const requester = String(req.user?.username || req.user?.email || '').trim().toLowerCase();
      if (!currentAuthor || currentAuthor !== requester) {
        return res.status(403).json({ error: 'Apenas o autor pode apagar esta mensagem.' });
      }

      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });

      updateMuralCacheIfLoaded(current.institutionId, (messages) =>
        messages.filter((msg: any) => msg.id !== req.params.id)
      );

      return res.json({ success: true });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao arquivar mensagem do mural');
    }
  });

  // User Management
  app.get('/api/employees', requireAuth, rejectVisitor, async (req, res) => {
    try {
      const q = req.query.q as string;
      const realId = await getRealInstitutionId((req as any).user.institutionId);
      const cacheKey = `employees:${realId}:${q || 'all'}`;
      const cached = getFromCache(cacheKey);
      if (cached) return res.json(cached);

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
      if (result) {
        setToCache(cacheKey, result);
      }
      res.json(result);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar funcionários.' );
    }
  });

  app.post('/api/employees', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req, res) => {
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
        const existingDoc = await db.collection('employees').doc(data.id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument((req as any).user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        const { id, ...updateData } = data;
        await db.collection('employees').doc(id).set(updateData, { merge: true });
        invalidateCache('employees');
        res.json(data);
      } else {
        const docRef = await db.collection('employees').add(data);
        invalidateCache('employees');
        res.json({ ...data, id: docRef.id });
      }
    } catch (error: any) {
      console.error('Error saving employee to Firestore:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar funcionário.' );
    }
  });

  app.post('/api/employees/bulk', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req, res) => {
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
      invalidateCache('employees');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Bulk save error for employees:', error);
      return sendDatabaseError(res, error, 'Erro de bulk em funcionários' );
    }
  });

  app.get('/api/employees/:id', requireAuth, rejectVisitor, async (req: any, res) => {
    try {
      const doc = await db.collection('employees').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      const emp = { ...doc.data(), id: doc.id };
      if (!isAuthorizedForDocument(req.user, emp)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      res.json(emp);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar funcionário');
    }
  });

  app.delete('/api/employees/:id', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const doc = await db.collection('employees').doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await db.collection('employees').doc(id).update({
        archived: true,
        archivedAt: Date.now(),
        archivedBy: req.user?.id || 'unknown',
        status: 'inativo'
      });
      invalidateCache('employees');
      res.json({ success: true });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao arquivar funcionário' );
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
      return sendDatabaseError(res, e, 'Erro ao buscar turnos');
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
      return sendDatabaseError(res, e, 'Erro ao buscar condutas SOS' );
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
      return sendDatabaseError(res, e, 'Erro ao salvar conduta SOS' );
    }
  });

  app.post('/api/shifts', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req, res) => {
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
      return sendDatabaseError(res, e, 'Erro ao salvar turno' );
    }
  });

  app.get('/api/shifts/:id', requireAuth, async (req: any, res) => {
    try {
      const doc = await db.collection('shifts').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      const shift = { ...doc.data(), id: doc.id };
      if (!isAuthorizedForDocument(req.user, shift)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      res.json(shift);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar turno');
    }
  });

  app.delete('/api/shifts/:id', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req: any, res) => {
    try {
      const doc = await db.collection('shifts').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await db.collection('shifts').doc(req.params.id).update({
        status: 'inativo',
        atualizadoEm: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error: any) {
       return sendDatabaseError(res, error, 'Erro ao inativar turno' );
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
      return sendDatabaseError(res, e, 'Erro ao salvar procedimento' );
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
      return sendDatabaseError(res, e, 'Erro ao buscar procedimentos' );
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
      return sendDatabaseError(res, e, 'Erro ao buscar refeições' );
    }
  });

  // ========== /SYSTEM-UNITS ==========
  app.get('/api/system-units', async (req, res) => {
    try {
      const units: any[] = [];
      const uniqueKeys = new Set<string>();

      const addUnit = (unit: any) => {
        const canonicalId = getCanonicalInstitutionId(unit.id || unit.cnpj);
        const isMonte = isMonteAltoUnit(canonicalId);
        const key = isMonte ? `obra_unida:${MONTE_ALTO_CNPJ}` : `${unit.type || 'unit'}-${unit.id || unit.cnpj || unit.name}`;
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          units.push({
            ...unit,
            id: isMonte ? MONTE_ALTO_OPERATIONAL_ID : (unit.id || canonicalId),
            cnpj: isMonte ? MONTE_ALTO_CNPJ : unit.cnpj
          });
        }
      };

      // 1. Conselho Central Padrão
      addUnit({
        id: CENTRAL_JABOTICABAL_CNPJ,
        name: 'Conselho Central de Jaboticabal',
        type: 'conselho_central',
        cnpj: CENTRAL_JABOTICABAL_CNPJ,
        city: 'Jaboticabal',
        state: 'SP'
      });

      // 2. Obras Unidas Padrão
      addUnit({
        id: MONTE_ALTO_OPERATIONAL_ID,
        name: 'Lar São Vicente de Paulo de Monte Alto',
        type: 'obra_unida',
        cnpj: MONTE_ALTO_CNPJ,
        city: 'Monte Alto',
        state: 'SP'
      });

      // 3. Instituições salvas no Firestore
      const instSnap = await safeQuery(async () => await db.collection('institutions').get());
      if (instSnap && !instSnap.empty) {
        instSnap.forEach((doc: any) => {
          const d = doc.data();
          addUnit({
            id: doc.id,
            name: d.name || d.razaoSocial || 'Instituição SSVP',
            type: d.entityType || d.type || 'obra_unida',
            cnpj: d.cnpj || '',
            city: d.city || '',
            state: d.state || 'SP'
          });
        });
      }

      // 4. Conselhos Particulares cadastrados
      const cpSnap = await safeQuery(async () => await db.collection('conselhos_particulares').get());
      const cpMap = new Map<string, string>();
      if (cpSnap && !cpSnap.empty) {
        cpSnap.forEach((doc: any) => {
          const d = doc.data();
          cpMap.set(doc.id, d.name || 'Conselho Particular');
          if (d.status !== 'arquivado') {
            addUnit({
              id: doc.id,
              name: d.name || 'Conselho Particular',
              type: 'conselho_particular',
              city: d.city || '',
              state: d.state || 'SP',
              parentName: 'Conselho Central de Jaboticabal'
            });
          }
        });
      }

      // 5. Conferências Vicentinas cadastradas
      const confSnap = await safeQuery(async () => await db.collection('conferencias').get());
      if (confSnap && !confSnap.empty) {
        confSnap.forEach((doc: any) => {
          const d = doc.data();
          if (d.status !== 'arquivado' && d.status !== 'inativa') {
            const parentCpName = (d.particularId && cpMap.get(d.particularId)) || d.particularName || 'Conselho Particular';
            addUnit({
              id: doc.id,
              name: d.name || 'Conferência Vicentina',
              type: 'conferencia',
              city: d.city || '',
              state: d.state || 'SP',
              particularId: d.particularId || '',
              parentName: parentCpName
            });
          }
        });
      }

      // 6. Obras Unidas salvas nas settings do Conselho Central
      const ccSettingsDoc = await safeQuery(async () => await db.collection('institutions').doc('54.927.132/0001-92').get());
      if (ccSettingsDoc && ccSettingsDoc.exists) {
        const ccData = ccSettingsDoc.data();
        if (Array.isArray(ccData?.obrasUnidas)) {
          ccData.obrasUnidas.forEach((obra: any) => {
            addUnit({
              id: obra.id || `obra-${obra.name}`,
              name: obra.name || 'Obra Unida',
              type: 'obra_unida',
              cnpj: obra.cnpj || '',
              city: obra.city || '',
              state: obra.state || 'SP',
              parentName: 'Conselho Central de Jaboticabal'
            });
          });
        }
      }

      const requester: any = (req as any).user;
      const requesterEmail = String(requester?.email || requester?.username || '').trim().toLowerCase();
      const isGlobalController = requesterEmail === 'kwarizaya@gmail.com';

      if (isGlobalController) {
        return res.json(units);
      }

      const scopedUnits = units.filter((unit: any) =>
        isUserAuthorizedForInstitution(requester, unit.id || unit.cnpj)
      );
      return res.json(scopedUnits);
    } catch (error: any) {
      console.error('Erro ao buscar unidades do sistema:', error);
      return sendDatabaseError(res, error, 'Erro ao carregar unidades do sistema');
    }
  });

  // ========== /USERS ==========
  app.get('/api/users', requireRole(['administrador', 'gerencial']), async (req: any, res) => {
    const { institutionId, all } = req.query;
    try {
      const isGlobalController = hasGlobalControllerIdentity(req.user);

      if (all === 'true' && !isGlobalController) {
        return res.status(403).json({ error: 'A listagem global de usuários é restrita ao controlador do sistema.' });
      }

      if (isGlobalController && all === 'true') {
        const snapshot = await safeQuery(async () => await db.collection('users').get());
        const dbUsers = snapshot
          ? snapshot.docs
              .map((doc: any) => ({ ...doc.data(), id: doc.id }))
              .filter((item: any) => !item.archived)
              .map((item: any) => sanitizeUserForResponse(item))
          : [];
        return res.json(dbUsers);
      }

      if (!institutionId || typeof institutionId !== 'string') {
        return res.status(400).json({ error: 'institutionId é obrigatório.' });
      }

      const realId = await getRealInstitutionId(institutionId);
      if (!isUserAuthorizedForInstitution(req.user, realId)) {
        return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
      }

      // Para manter compatibilidade com institutionId, institutionIds e allowedUnits legados,
      // filtra em memória somente os usuários vinculados à unidade solicitada.
      const snapshot = await safeQuery(async () => await db.collection('users').get());
      let finalUsers = snapshot
        ? snapshot.docs
            .map((doc: any) => ({ ...doc.data(), id: doc.id }))
            .filter((item: any) => !item.archived)
            .filter((item: any) => {
              const itemEmail = String(item.email || item.username || '').trim().toLowerCase();
              const scopedItem = {
                ...item,
                isGlobalAdmin: itemEmail === 'kwarizaya@gmail.com',
                hasAllUnitsAccess: itemEmail === 'kwarizaya@gmail.com'
              };
              return isUserAuthorizedForInstitution(scopedItem, realId);
            })
        : [];

      if (institutionId === 'demo-institution-id') {
        const demoUsers = [
          { id: 'demo-u1', username: 'demonstracao@ssvp.com', fullName: 'Administrador Demo', accessLevel: 'administrador', role: 'Gestor' },
          { id: 'demo-u2', username: 'operador@ssvp.com', fullName: 'Maria Silva', accessLevel: 'assistente_social', role: 'Assistente Social' },
          { id: 'demo-u3', username: 'psico@ssvp.com', fullName: 'Ana Psicóloga', accessLevel: 'psicologia', role: 'Psicóloga' },
          { id: 'demo-u4', username: 'to@ssvp.com', fullName: 'Carlos Terapeuta', accessLevel: 'terapeuta_ocupacional', role: 'Terapeuta Ocupacional' }
        ];
        finalUsers = [...demoUsers, ...finalUsers];
      }

      return res.json(finalUsers.map((item: any) => sanitizeUserForResponse(item)));
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar usuários.');
    }
  });

  app.post('/api/users', requireRole(['administrador', 'gerencial']), async (req: any, res) => {
    const data = { ...req.body };
    try {
      const isGlobalController = hasGlobalControllerIdentity(req.user);

      const auditEntry = {
        action: data.id ? 'update' : 'create',
        timestamp: new Date().toISOString(),
        userId: req.user?.id || 'unknown',
        username: req.user?.username || 'unknown',
      };

      let existingData: any = null;
      if (data.id) {
        const existingDoc = await db.collection('users').doc(data.id).get();
        if (!existingDoc.exists) {
          return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        existingData = existingDoc.data();

        if (!isGlobalController && hasGlobalControllerIdentity(existingData)) {
          return res.status(403).json({ error: 'O controlador global só pode ser administrado pela própria conta controladora.' });
        }

        const targetPrimary = existingData?.institutionId;
        if (!isGlobalController && (!targetPrimary || !isUserAuthorizedForInstitution(req.user, targetPrimary))) {
          return res.status(403).json({ error: 'Acesso negado para administrar este usuário.' });
        }
      }

      const requestedIdentity = {
        email: data.email ?? existingData?.email,
        username: data.username ?? existingData?.username
      };
      if (!isGlobalController && hasGlobalControllerIdentity(requestedIdentity)) {
        return res.status(403).json({ error: 'Não é permitido criar ou alterar usuários com a identidade do controlador global.' });
      }

      if (isGlobalController) {
        const requestedPrimary = data.institutionId || existingData?.institutionId;
        if (requestedPrimary) {
          data.institutionId = await getRealInstitutionId(requestedPrimary);
        }

        const targetIsController = hasGlobalControllerIdentity({
          email: data.email ?? existingData?.email,
          username: data.username ?? existingData?.username
        });

        // Apenas Klausner pode ser global. Demais usuários podem receber multiacesso explícito.
        data.isGlobalAdmin = targetIsController;
        data.hasAllUnitsAccess = targetIsController;

        if (!targetIsController) {
          data.institutionIds = Array.isArray(data.institutionIds) ? data.institutionIds : [];
          data.authorizedUnits = Array.isArray(data.authorizedUnits) ? data.authorizedUnits : [];
          data.allowedUnits = Array.isArray(data.allowedUnits) ? data.allowedUnits : [];
        }
      } else {
        if (data.id) {
          // Administradores locais podem editar o perfil funcional, mas não o escopo institucional.
          data.institutionId = existingData?.institutionId;
          data.institutionIds = Array.isArray(existingData?.institutionIds) ? existingData.institutionIds : [];
          data.authorizedUnits = Array.isArray(existingData?.authorizedUnits) ? existingData.authorizedUnits : [];
          data.allowedUnits = Array.isArray(existingData?.allowedUnits) ? existingData.allowedUnits : [];
        } else {
          const requestedPrimary = data.institutionId || req.user?.institutionId;
          if (!requestedPrimary) {
            return res.status(400).json({ error: 'Unidade principal obrigatória para o novo usuário.' });
          }

          const realId = await getRealInstitutionId(requestedPrimary);
          if (!isUserAuthorizedForInstitution(req.user, realId)) {
            return res.status(403).json({ error: 'Acesso negado para cadastrar usuário nesta unidade.' });
          }

          data.institutionId = realId;
          data.institutionIds = [];
          data.authorizedUnits = [];
          data.allowedUnits = [];
        }

        data.isGlobalAdmin = false;
        data.hasAllUnitsAccess = false;
      }

      if (!data.institutionId) {
        return res.status(400).json({ error: 'institutionId é obrigatório.' });
      }

      const targetAccessLevel = normalizeAccessLevel(data.accessLevel || existingData?.accessLevel || data.role || existingData?.role);
      if (targetAccessLevel === 'visitante') {
        const primaryInstitutionId = await getRealInstitutionId(data.institutionId);
        if (!primaryInstitutionId || !(await isVisitorPortalInstitution(primaryInstitutionId))) {
          return res.status(400).json({ error: 'Contas de Portaria só podem ser vinculadas a uma Obra Unida / Lar / ILPI.' });
        }

        data.institutionId = primaryInstitutionId;
        data.isGlobalAdmin = false;
        data.hasAllUnitsAccess = false;
        data.institutionIds = [];
        data.authorizedUnits = [];
        data.allowedUnits = [];
        delete data.conferenciaId;
        delete data.particularId;
        delete data.centralId;
      }

      const payload = { ...data };
      payload.auditLog = admin.firestore.FieldValue.arrayUnion(auditEntry);

      if (payload.id) {
        const { id, ...updateData } = payload;
        await db.collection('users').doc(id).set(updateData, { merge: true });
        await logAudit('update', 'users', id, req, data.institutionId, `Atualização do usuário ${payload.username}`);
        return res.json(sanitizeUserForResponse({ ...existingData, ...data, id }));
      }

      const docRef = await db.collection('users').add(payload);
      await logAudit('create', 'users', docRef.id, req, data.institutionId, `Novo usuário cadastrado: ${payload.username}`);
      return res.json(sanitizeUserForResponse({ ...data, id: docRef.id }));
    } catch (error: any) {
      console.error('Error saving user to Firestore:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar usuário no banco de dados.');
    }
  });

  app.delete('/api/users/:id', requireRole(['administrador', 'gerencial']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const requesterEmail = String(req.user?.email || req.user?.username || '').trim().toLowerCase();
      const isGlobalController = requesterEmail === 'kwarizaya@gmail.com';

      const userRef = db.collection('users').doc(id);
      const targetDoc = await userRef.get();
      if (!targetDoc.exists) return res.json({ success: true });

      const targetData: any = targetDoc.data();
      const targetEmail = String(targetData?.email || targetData?.username || '').trim().toLowerCase();

      if (!isGlobalController) {
        if (targetEmail === 'kwarizaya@gmail.com') {
          return res.status(403).json({ error: 'O controlador global não pode ser desativado por administradores locais.' });
        }
        if (!targetData?.institutionId || !isUserAuthorizedForInstitution(req.user, targetData.institutionId)) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
      }

      const auditEntry = {
        action: 'archive',
        timestamp: new Date().toISOString(),
        userId: req.user?.id || 'unknown',
        username: req.user?.username || 'unknown',
      };

      await userRef.update({
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: req.user?.id || 'unknown',
        auditLog: admin.firestore.FieldValue.arrayUnion(auditEntry)
      });
      return res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      return sendDatabaseError(res, error);
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
    } catch (error: any) {
      console.error('Erro ao buscar candidatos a vagas', error);
      return sendDatabaseError(res, error, 'Erro ao buscar candidatos a vagas' );
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
    } catch (error: any) {
      console.error('Erro ao salvar candidato a vaga', error);
      return sendDatabaseError(res, error, 'Erro ao salvar candidato a vaga' );
    }
  });

  app.delete('/api/job-candidates/:id', requireRole(['psicologia', 'gerencial', 'administrador']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const doc = await db.collection('jobCandidates').doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await db.collection('jobCandidates').doc(id).delete();
      res.json({ success: true, message: 'Excluído definitivamente com sucesso.' });
    } catch (error: any) {
      console.error('Erro ao excluir definitivamente o candidato a vaga', error);
      return sendDatabaseError(res, error, 'Erro ao excluir definitivamente o candidato a vaga' );
    }
  });

  app.delete('/api/candidates/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'administrador']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const doc = await db.collection('candidates').doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      // Inativar em vez de excluir definitivamente
      await db.collection('candidates').doc(id).update({ archived: true, archivedAt: new Date().toISOString() });
      invalidateCache('candidates');
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) {
        // Se já não existe, tudo bem
        return res.json({ success: true });
      }
      return sendDatabaseError(res, error);
    }
  });

  app.delete('/api/residents/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req: any, res) => {
    const { id } = req.params;
    try {
      const doc = await db.collection('residents').doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      // Inativar em vez de excluir definitivamente
      await db.collection('residents').doc(id).update({ archived: true, archivedAt: new Date().toISOString() });
      invalidateCache('residents');
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) {
        return res.json({ success: true });
      }
      return sendDatabaseError(res, error);
    }
  });

  // --- Amendments API ---
  app.get('/api/amendments/categories', rejectVisitor, async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('amendment_categories')
        .where('institutionId', '==', realId)
        .get();
      const categories = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(categories);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar categorias de emendas.' );
    }
  });

  app.post('/api/amendments/categories', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && !data.id.startsWith('new_')) {
        const existingDoc = await db.collection('amendment_categories').doc(data.id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument((req as any).user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        await db.collection('amendment_categories').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'amendment_categories', data.id, req, realId, `Atualização de categoria de emenda`);
        res.json(data);
      } else {
        const { id, ...saveData } = data;
        const docRef = await db.collection('amendment_categories').add({ ...saveData, institutionId: realId });
        await logAudit('create', 'amendment_categories', docRef.id, req, realId, `Nova categoria de emenda`);
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar categoria de emenda.' );
    }
  });

  app.delete('/api/amendments/categories/:id', requireRole(['administrador', 'gerencial']), async (req, res) => {
    try {
      const docRef = db.collection('amendment_categories').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || !isAuthorizedForDocument((req as any).user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      return sendDatabaseError(res, error, );
    }
  });

  app.get('/api/amendments/grants', rejectVisitor, async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('amendment_grants')
        .where('institutionId', '==', realId)
        .get();
      const grants = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(grants);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar emendas.' );
    }
  });

  app.post('/api/amendments/grants', requireRole(['administrador', 'gerencial']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && !data.id.startsWith('new_')) {
        const existingDoc = await db.collection('amendment_grants').doc(data.id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument((req as any).user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        await db.collection('amendment_grants').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'amendment_grants', data.id, req, realId, `Atualização de emenda`);
        res.json(data);
      } else {
        const { id, ...saveData } = data;
        const docRef = await db.collection('amendment_grants').add({ ...saveData, institutionId: realId });
        await logAudit('create', 'amendment_grants', docRef.id, req, realId, `Nova emenda`);
        res.json({ ...saveData, id: docRef.id });
      }
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar emenda.' );
    }
  });

  app.delete('/api/amendments/grants/:id', requireRole(['administrador', 'gerencial']), async (req, res) => {
    try {
      const docRef = db.collection('amendment_grants').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || !isAuthorizedForDocument((req as any).user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      return sendDatabaseError(res, error, );
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
    } catch (error: any) {
      console.error('Bootstrap error:', error);
      return sendDatabaseError(res, error, 'Erro ao realizar bootstrap de emendas.' );
    }
  });

  // --- Portal de Visitantes API ---
  const resolvePortalResident = async (residentId: string, institutionId: string) => {
    if (!residentId || !institutionId) return null;
    const residentDoc = await db.collection('residents').doc(residentId).get();
    if (!residentDoc.exists) return null;

    const residentData: any = residentDoc.data() || {};
    if (residentData.archived === true) return null;

    const residentInstitutionId = getCanonicalInstitutionId(residentData.institutionId);
    const targetInstitutionId = getCanonicalInstitutionId(institutionId);
    if (!residentInstitutionId || residentInstitutionId !== targetInstitutionId) return null;

    return {
      id: residentDoc.id,
      name: residentData.name || '',
      institutionId: residentData.institutionId
    };
  };

  app.get('/api/global-visits', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo']), async (req: any, res) => {
    const { institutionId } = req.query;
    if (!institutionId || typeof institutionId !== 'string') {
      return res.status(400).json({ error: 'institutionId é obrigatório.' });
    }

    try {
      const realId = await getRealInstitutionId(institutionId);
      if (!(await isVisitorPortalInstitution(realId))) {
        return res.status(400).json({ error: 'Portal de Visitantes disponível somente para Obra Unida / Lar / ILPI.' });
      }

      const snapshot = await db.collection('global_visits')
        .where('institutionId', '==', realId)
        .get();

      const visits = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter((item: any) => !item.archived)
        .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));

      res.json(visits);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar visitas.' );
    }
  });

  app.post('/api/global-visits', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo']), async (req: any, res) => {
    const { institutionId, ...data } = req.body || {};
    if (!institutionId || typeof institutionId !== 'string') {
      return res.status(400).json({ error: 'institutionId é obrigatório.' });
    }

    try {
      const realId = await getRealInstitutionId(institutionId);
      if (!(await isVisitorPortalInstitution(realId))) {
        return res.status(400).json({ error: 'Portal de Visitantes disponível somente para Obra Unida / Lar / ILPI.' });
      }

      let validatedResident: { id: string; name: string; institutionId: string } | null = null;
      if (data.matchedVia === 'facial') {
        if (!data.residentId || typeof data.residentId !== 'string') {
          return res.status(400).json({ error: 'Entrada por reconhecimento facial exige residente vinculado obrigatoriamente.' });
        }

        validatedResident = await resolvePortalResident(data.residentId, realId);
        if (!validatedResident) {
          return res.status(400).json({ error: 'Residente inválido ou não pertencente à unidade da Portaria.' });
        }
      } else if (data.residentId && typeof data.residentId === 'string') {
        validatedResident = await resolvePortalResident(data.residentId, realId);
        if (!validatedResident) {
          return res.status(400).json({ error: 'Residente inválido ou não pertencente à unidade da Portaria.' });
        }
      }

      // Minimização LGPD: a passagem não duplica foto nem vetor biométrico permanente.
      const {
        faceDescriptor: _discardedFaceDescriptor,
        photoUrl: _discardedPhotoUrl,
        ...visitData
      } = data;

      const visitId = typeof data.id === 'string' && data.id.trim() && !data.id.includes('/')
        ? data.id.trim()
        : db.collection('global_visits').doc().id;

      const safeVisitData = {
        ...visitData,
        id: visitId,
        ...(validatedResident
          ? {
              type: 'residente',
              residentId: validatedResident.id,
              residentName: validatedResident.name
            }
          : {}),
        institutionId: realId,
        createdAt: data.createdAt || new Date().toISOString()
      };

      const docRef = db.collection('global_visits').doc(visitId);
      const existingVisit = await docRef.get();
      await docRef.set(safeVisitData, { merge: true });
      await logAudit(existingVisit.exists ? 'update' : 'create', 'global_visits', docRef.id, req, realId,
        existingVisit.exists ? 'Reenvio idempotente de visita' : 'Nova visita registrada');
      res.json({ ...safeVisitData, id: docRef.id });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar visita.' );
    }
  });

  app.get('/api/registered-visitors', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo']), async (req: any, res) => {
    const { institutionId } = req.query;
    if (!institutionId || typeof institutionId !== 'string') {
      return res.status(400).json({ error: 'institutionId é obrigatório.' });
    }

    try {
      const realId = await getRealInstitutionId(institutionId);
      if (!(await isVisitorPortalInstitution(realId))) {
        return res.status(400).json({ error: 'Portal de Visitantes disponível somente para Obra Unida / Lar / ILPI.' });
      }

      const snapshot = await db.collection('registered_visitors')
        .where('institutionId', '==', realId)
        .get();
      const visitors = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter((item: any) => !item.archived);
      res.json(visitors);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar visitantes cadastrados.');
    }
  });

  app.post('/api/registered-visitors', requireRole(['visitante', 'gerencial', 'auxiliar_administrativo']), async (req: any, res) => {
    const { institutionId, id, ...data } = req.body || {};
    if (!institutionId || typeof institutionId !== 'string') {
      return res.status(400).json({ error: 'institutionId é obrigatório.' });
    }

    try {
      const realId = await getRealInstitutionId(institutionId);
      if (!(await isVisitorPortalInstitution(realId))) {
        return res.status(400).json({ error: 'Portal de Visitantes disponível somente para Obra Unida / Lar / ILPI.' });
      }

      const safeId = typeof id === 'string' && id.trim() && !id.includes('/') ? id.trim() : '';
      const docRef = safeId
        ? db.collection('registered_visitors').doc(safeId)
        : db.collection('registered_visitors').doc();

      const existing = await docRef.get();
      const existingData: any = existing.exists ? (existing.data() || {}) : {};
      if (existing.exists) {
        if (getCanonicalInstitutionId(existingData.institutionId) !== getCanonicalInstitutionId(realId)) {
          return res.status(403).json({ error: 'Visitante cadastrado pertence a outra instituição.' });
        }
      }

      const rawLinks = Array.isArray(data.linkedResidents)
        ? data.linkedResidents
        : (data.residentId
            ? [{ residentId: data.residentId, residentName: data.residentName || '' }]
            : (Array.isArray(existingData.linkedResidents) && existingData.linkedResidents.length > 0
                ? existingData.linkedResidents
                : (existingData.residentId
                    ? [{ residentId: existingData.residentId, residentName: existingData.residentName || '' }]
                    : [])));

      const normalizedLinks: { residentId: string; residentName: string }[] = [];
      const seenResidentIds = new Set<string>();
      for (const link of rawLinks) {
        const residentId = typeof link?.residentId === 'string' ? link.residentId.trim() : '';
        if (!residentId || seenResidentIds.has(residentId)) continue;

        const resident = await resolvePortalResident(residentId, realId);
        if (!resident) {
          return res.status(400).json({ error: 'Um dos residentes vinculados é inválido ou pertence a outra unidade.' });
        }

        seenResidentIds.add(residentId);
        normalizedLinks.push({ residentId: resident.id, residentName: resident.name });
      }

      const effectiveFaceDescriptor = data.faceDescriptor ?? existingData.faceDescriptor;
      const hasBiometry = Array.isArray(effectiveFaceDescriptor) && effectiveFaceDescriptor.length > 0;
      if (hasBiometry) {
        if (effectiveFaceDescriptor.length !== 128) {
          return res.status(400).json({ error: 'Descritor facial inválido.' });
        }
        const effectiveType = data.type || existingData.type;
        if (effectiveType !== 'residente' || normalizedLinks.length === 0) {
          return res.status(400).json({ error: 'Cadastro com reconhecimento facial exige vínculo com pelo menos um residente.' });
        }
      }

      const primaryLink = normalizedLinks[0];
      const payload = {
        ...data,
        institutionId: realId,
        linkedResidents: normalizedLinks,
        ...(primaryLink
          ? {
              residentId: primaryLink.residentId,
              residentName: primaryLink.residentName,
              type: 'residente'
            }
          : {}),
        updatedAt: new Date().toISOString(),
        ...(existing.exists ? {} : { createdAt: new Date().toISOString() })
      };

      await docRef.set(payload, { merge: true });
      await logAudit(
        existing.exists ? 'update' : 'create',
        'registered_visitors',
        docRef.id,
        req,
        realId,
        `${existing.exists ? 'Atualização' : 'Cadastro'} de visitante: ${data.name || ''}`
      );
      res.json({ ...payload, id: docRef.id });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar visitante cadastrado.');
    }
  });

  app.post('/api/clear-biometrics', requireRole(['gerencial']), async (req: any, res) => {
    const { institutionId, clearFaces = true } = req.body || {};
    if (!institutionId || typeof institutionId !== 'string') {
      return res.status(400).json({ error: 'institutionId é obrigatório.' });
    }

    try {
      const realId = await getRealInstitutionId(institutionId);
      if (!(await isVisitorPortalInstitution(realId))) {
        return res.status(400).json({ error: 'Portal de Visitantes disponível somente para Obra Unida / Lar / ILPI.' });
      }

      if (!clearFaces) {
        return res.json({ success: true, updated: 0 });
      }

      const [registeredSnap, visitsSnap] = await Promise.all([
        db.collection('registered_visitors').where('institutionId', '==', realId).get(),
        db.collection('global_visits').where('institutionId', '==', realId).get()
      ]);

      const refs = [...registeredSnap.docs, ...visitsSnap.docs];
      let updated = 0;
      for (let index = 0; index < refs.length; index += 400) {
        const batch = db.batch();
        refs.slice(index, index + 400).forEach((doc: any) => {
          batch.set(doc.ref, {
            photoUrl: admin.firestore.FieldValue.delete(),
            faceDescriptor: admin.firestore.FieldValue.delete()
          }, { merge: true });
          updated += 1;
        });
        await batch.commit();
      }

      await logAudit('update', 'visitor_biometrics', realId, req, realId, 'Limpeza administrativa de biometrias da portaria', { updated });
      res.json({ success: true, updated });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao limpar biometrias.');
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
    } catch (error: any) {
      console.error('Error fetching support messages:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar mensagens.' );
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
    } catch (error: any) {
      console.error('Error saving support message:', error);
      return sendDatabaseError(res, error, 'Erro ao enviar mensagem.' );
    }
  });

  // More CRUDs could be added here...

  // --- Agenda API ---
  app.get('/api/agenda', async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const cacheKey = `agenda:${realId}`;
      const cached = getFromCache(cacheKey);
      if (cached) return res.json(cached);

      const snapshot = await db.collection('agenda_events')
        .where('institutionId', '==', realId)
        .get();
      const events = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      if (events) {
        setToCache(cacheKey, events);
      }
      res.json(events);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar agenda.' );
    }
  });

  app.post('/api/agenda', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && data.id.length > 10) {
        await db.collection('agenda_events').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'agenda_events', data.id, req, realId, `Atualização do evento: ${data.title}`);
        invalidateCache('agenda');
        res.json({ ...data, id: data.id, institutionId: realId });
      } else {
        const docRef = await db.collection('agenda_events').add({ ...data, institutionId: realId });
        await logAudit('create', 'agenda_events', docRef.id, req, realId, `Novo evento na agenda: ${data.title}`);
        invalidateCache('agenda');
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar evento.' );
    }
  });

  app.delete('/api/agenda/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico']), async (req: any, res) => {
    try {
      const docRef = db.collection('agenda_events').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: 'Evento não encontrado.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      invalidateCache('agenda');
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      return sendDatabaseError(res, error, );
    }
  });

  // Serviço Social — atendimentos institucionais e registros sigilosos
  const isStrictSocialWorker = (user: any): boolean =>
    normalizeAccessLevel(user?.accessLevel || user?.role) === 'assistente_social';

  const getSocialWorkRecordIndex = (evolutions: any[], recordId: string): number =>
    evolutions.findIndex((item: any) => item?.id === recordId);

  const sanitizeSocialText = (value: any): string => String(value || '').trim();

  const buildSocialMuralPayload = (residentName: string, record: any, institutionId: string, user: any) => ({
    institutionId,
    author: user?.username || 'Assistência Social',
    authorName: user?.fullName || user?.username || 'Assistência Social',
    authorRole: user?.role || 'Serviço Social',
    authorUserId: user?.id,
    authorEmail: user?.username,
    text:
      `🤝 Atendimento do Serviço Social - ${residentName}\n` +
      `Tipo: ${record.type === 'contato_familia' ? 'Atendimento Familiar' : 'Atendimento Individual'}\n` +
      `Data: ${record.date}${record.time ? ` às ${record.time}` : ''}\n` +
      (record.targetPersonOrEntity ? `Envolvido: ${record.targetPersonOrEntity}\n` : '') +
      `Resumo: ${String(record.description || '')}`,
    visibilidade: ['publico'],
    isPublic: true,
    timestamp: Date.now()
  });

  app.post('/api/social-work/records', requireAuth, async (req: any, res) => {
    if (!isStrictSocialWorker(req.user)) {
      return res.status(403).json({ error: 'Acesso restrito ao Serviço Social.' });
    }

    const data = req.body || {};
    const residentId = String(data.residentId || '').trim();
    if (!residentId) return res.status(400).json({ error: 'residentId é obrigatório.' });

    try {
      const residentRef = db.collection('residents').doc(residentId);
      const residentDoc = await residentRef.get();
      if (!residentDoc.exists) return res.status(404).json({ error: 'Residente não encontrado.' });

      const resident: any = residentDoc.data();
      if (!isAuthorizedForDocument(req.user, resident)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const institutionId = await getRealInstitutionId(resident.institutionId || data.institutionId || '');
      if (!institutionId || !isUserAuthorizedForInstitution(req.user, institutionId)) {
        return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
      }

      const visibility = data.visibility === 'confidential' ? 'confidential' : 'institutional';
      const type = data.type === 'contato_familia' ? 'contato_familia' : 'atendimento_individual';
      const description = sanitizeSocialText(data.description);
      if (!description) return res.status(400).json({ error: 'Descrição do atendimento é obrigatória.' });

      const recordId = db.collection('social_confidential_records').doc().id;
      const now = Date.now();
      const professionalName = req.user?.fullName || req.user?.username || 'Assistente Social';
      const professionalRole = req.user?.role || 'Serviço Social';
      const muralRef = visibility === 'institutional' ? db.collection('muralMessages').doc() : null;

      const metadata: any = {
        id: recordId,
        date: sanitizeSocialText(data.date) || new Date().toISOString().slice(0, 10),
        time: sanitizeSocialText(data.time),
        type,
        subtype: type === 'atendimento_individual' && ['conversation', 'specific_demand'].includes(data.subtype)
          ? data.subtype
          : undefined,
        title: sanitizeSocialText(data.title) || (type === 'contato_familia' ? 'Atendimento Familiar' : 'Atendimento Individual'),
        targetPersonOrEntity: sanitizeSocialText(data.targetPersonOrEntity),
        contactPhone: sanitizeSocialText(data.contactPhone),
        professionalName,
        professionalRole,
        cress: req.user?.professionalRegistration || '',
        professionalSignature: professionalName,
        postToMural: visibility === 'institutional',
        visibility,
        hasConfidentialContent: visibility === 'confidential',
        authorUserId: req.user?.id,
        authorUsername: req.user?.username,
        timestamp: now,
        ...(muralRef ? { muralMessageId: muralRef.id } : {})
      };

      if (visibility === 'institutional') {
        metadata.description = description;
        metadata.referrals = sanitizeSocialText(data.referrals);
      }

      const evolutions = Array.isArray(resident.socialWork?.evolutions)
        ? [...resident.socialWork.evolutions]
        : [];
      const updatedEvolutions = [metadata, ...evolutions];
      const updatedSocialWork = { ...(resident.socialWork || {}), evolutions: updatedEvolutions };

      const batch = db.batch();
      batch.set(residentRef, { socialWork: updatedSocialWork }, { merge: true });

      let muralPayload: any = null;

      if (visibility === 'confidential') {
        batch.set(db.collection('social_confidential_records').doc(recordId), {
          institutionId,
          residentId,
          recordId,
          description,
          referrals: sanitizeSocialText(data.referrals),
          authorUserId: req.user?.id,
          authorUsername: req.user?.username,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else if (muralRef) {
        muralPayload = {
          ...buildSocialMuralPayload(
            resident.name || 'Residente',
            { ...metadata, description },
            institutionId,
            req.user
          ),
          sourceType: 'social_work',
          sourceRecordId: recordId,
          residentId
        };
        batch.set(muralRef, muralPayload);
      }

      await batch.commit();
      invalidateCache('residents');

      if (muralRef && muralPayload) {
        updateMuralCacheIfLoaded(institutionId, (messages) => [
          normalizeMuralMessage(muralPayload, muralRef.id),
          ...messages.filter((msg: any) => msg.id !== muralRef.id)
        ]);
      }

      await logAudit('create', 'social_work', recordId, req, institutionId,
        `Novo atendimento do Serviço Social para ${resident.name || 'residente'}`,
        { residentId, visibility, type });

      return res.json({ success: true, record: metadata, socialWork: updatedSocialWork });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao registrar atendimento do Serviço Social.');
    }
  });

  app.put('/api/social-work/records/:recordId', requireAuth, async (req: any, res) => {
    if (!isStrictSocialWorker(req.user)) {
      return res.status(403).json({ error: 'Acesso restrito ao Serviço Social.' });
    }

    const data = req.body || {};
    const residentId = String(data.residentId || '').trim();
    if (!residentId) return res.status(400).json({ error: 'residentId é obrigatório.' });

    try {
      const residentRef = db.collection('residents').doc(residentId);
      const residentDoc = await residentRef.get();
      if (!residentDoc.exists) return res.status(404).json({ error: 'Residente não encontrado.' });

      const resident: any = residentDoc.data();
      if (!isAuthorizedForDocument(req.user, resident)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const evolutions = Array.isArray(resident.socialWork?.evolutions)
        ? [...resident.socialWork.evolutions]
        : [];
      const index = getSocialWorkRecordIndex(evolutions, req.params.recordId);
      if (index < 0) return res.status(404).json({ error: 'Atendimento não encontrado.' });

      const current = evolutions[index] || {};
      if (current.authorUserId && current.authorUserId !== req.user?.id) {
        return res.status(403).json({ error: 'Apenas a profissional autora pode editar este registro.' });
      }

      const institutionId = await getRealInstitutionId(resident.institutionId || '');
      if (!institutionId || !isUserAuthorizedForInstitution(req.user, institutionId)) {
        return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
      }

      const currentVisibility = current.visibility === 'confidential' ? 'confidential' : 'institutional';
      const requestedVisibility = data.visibility === 'confidential' ? 'confidential' : 'institutional';

      if (currentVisibility === 'institutional' && requestedVisibility === 'confidential') {
        return res.status(400).json({ error: 'A conversão de registro institucional para sigiloso não é permitida.' });
      }

      const isConvertingFromConfidential = currentVisibility === 'confidential' && requestedVisibility === 'institutional';
      if (isConvertingFromConfidential) {
        const proof = verifyReauthToken(String(data.reauthToken || ''));
        if (!proof.valid || proof.userId !== req.user?.id) {
          return res.status(401).json({ error: 'Confirmação de identidade inválida ou expirada para conversão de sigilo.' });
        }
      }

      const description = sanitizeSocialText(data.description);
      if (!description) return res.status(400).json({ error: 'Descrição do atendimento é obrigatória.' });

      const type = ['atendimento_individual', 'contato_familia'].includes(data.type)
        ? data.type
        : (current.type || 'atendimento_individual');

      let targetMuralId = current.muralMessageId;
      let muralRef: any = null;
      if (isConvertingFromConfidential && !targetMuralId) {
        muralRef = db.collection('muralMessages').doc();
        targetMuralId = muralRef.id;
      } else if (targetMuralId) {
        muralRef = db.collection('muralMessages').doc(targetMuralId);
      }

      const updatedMetadata: any = {
        ...current,
        date: sanitizeSocialText(data.date) || current.date,
        time: sanitizeSocialText(data.time),
        type,
        subtype: type === 'atendimento_individual' && ['conversation', 'specific_demand'].includes(data.subtype)
          ? data.subtype
          : undefined,
        title: sanitizeSocialText(data.title) || (type === 'contato_familia' ? 'Atendimento Familiar' : 'Atendimento Individual'),
        targetPersonOrEntity: sanitizeSocialText(data.targetPersonOrEntity),
        contactPhone: sanitizeSocialText(data.contactPhone),
        visibility: requestedVisibility,
        postToMural: requestedVisibility === 'institutional',
        hasConfidentialContent: requestedVisibility === 'confidential',
        ...(targetMuralId ? { muralMessageId: targetMuralId } : {})
      };

      if (requestedVisibility === 'institutional') {
        updatedMetadata.description = description;
        updatedMetadata.referrals = sanitizeSocialText(data.referrals);
      } else {
        delete updatedMetadata.description;
        delete updatedMetadata.referrals;
      }

      evolutions[index] = updatedMetadata;
      const updatedSocialWork = { ...(resident.socialWork || {}), evolutions };
      const batch = db.batch();
      batch.set(residentRef, { socialWork: updatedSocialWork }, { merge: true });

      let updatedMuralPayload: any = null;
      if (isConvertingFromConfidential) {
        // Remover conteúdo da coleção de sigilosos
        batch.delete(db.collection('social_confidential_records').doc(req.params.recordId));

        // Publicar no mural institucional
        updatedMuralPayload = {
          ...buildSocialMuralPayload(
            resident.name || 'Residente',
            { ...updatedMetadata, description },
            institutionId,
            req.user
          ),
          sourceType: 'social_work',
          sourceRecordId: req.params.recordId,
          residentId,
          updatedAt: new Date().toISOString()
        };
        batch.set(muralRef, updatedMuralPayload, { merge: true });
      } else if (currentVisibility === 'confidential') {
        batch.set(db.collection('social_confidential_records').doc(req.params.recordId), {
          institutionId,
          residentId,
          recordId: req.params.recordId,
          description,
          referrals: sanitizeSocialText(data.referrals),
          authorUserId: current.authorUserId || req.user?.id,
          authorUsername: current.authorUsername || req.user?.username,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else if (targetMuralId && muralRef) {
        updatedMuralPayload = {
          ...buildSocialMuralPayload(
            resident.name || 'Residente',
            { ...updatedMetadata, description },
            institutionId,
            req.user
          ),
          sourceType: 'social_work',
          sourceRecordId: req.params.recordId,
          residentId,
          updatedAt: new Date().toISOString()
        };
        batch.set(muralRef, updatedMuralPayload, { merge: true });
      }

      await batch.commit();
      invalidateCache('residents');

      if (updatedMuralPayload && targetMuralId) {
        updateMuralCacheIfLoaded(institutionId, (messages) => {
          const exists = messages.some((msg: any) => msg.id === targetMuralId);
          if (exists) {
            return messages.map((msg: any) =>
              msg.id === targetMuralId
                ? normalizeMuralMessage({ ...msg, ...updatedMuralPayload }, targetMuralId)
                : msg
            );
          }
          return [normalizeMuralMessage(updatedMuralPayload, targetMuralId), ...messages];
        });
      }

      await logAudit(
        isConvertingFromConfidential ? 'convert_confidential_to_institutional' : 'update',
        'social_work',
        req.params.recordId,
        req,
        institutionId,
        isConvertingFromConfidential
          ? `Atendimento do Serviço Social desclassificado de sigiloso para institucional para ${resident.name || 'residente'}`
          : `Atendimento do Serviço Social atualizado para ${resident.name || 'residente'}`,
        { residentId, visibility: requestedVisibility, type }
      );

      return res.json({ success: true, record: updatedMetadata, socialWork: updatedSocialWork });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao atualizar atendimento do Serviço Social.');
    }
  });

  app.delete('/api/social-work/records/:recordId', requireAuth, async (req: any, res) => {
    if (!isStrictSocialWorker(req.user)) {
      return res.status(403).json({ error: 'Acesso restrito ao Serviço Social.' });
    }

    const residentId = String(req.query.residentId || '').trim();
    if (!residentId) return res.status(400).json({ error: 'residentId é obrigatório.' });

    try {
      const residentRef = db.collection('residents').doc(residentId);
      const residentDoc = await residentRef.get();
      if (!residentDoc.exists) return res.status(404).json({ error: 'Residente não encontrado.' });

      const resident: any = residentDoc.data();
      if (!isAuthorizedForDocument(req.user, resident)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const evolutions = Array.isArray(resident.socialWork?.evolutions)
        ? [...resident.socialWork.evolutions]
        : [];
      const index = getSocialWorkRecordIndex(evolutions, req.params.recordId);
      if (index < 0) return res.status(404).json({ error: 'Atendimento não encontrado.' });

      const current = evolutions[index] || {};
      if (current.authorUserId && current.authorUserId !== req.user?.id) {
        return res.status(403).json({ error: 'Apenas a profissional autora pode excluir este registro.' });
      }

      const institutionId = await getRealInstitutionId(resident.institutionId || '');
      const updatedEvolutions = evolutions.filter((item: any) => item?.id !== req.params.recordId);
      const updatedSocialWork = { ...(resident.socialWork || {}), evolutions: updatedEvolutions };

      const batch = db.batch();
      batch.set(residentRef, { socialWork: updatedSocialWork }, { merge: true });
      batch.delete(db.collection('social_confidential_records').doc(req.params.recordId));
      if (current.muralMessageId) {
        batch.set(
          db.collection('muralMessages').doc(current.muralMessageId),
          { archived: true, archivedAt: new Date().toISOString() },
          { merge: true }
        );
      }
      await batch.commit();

      invalidateCache('residents');

      if (current.muralMessageId) {
        updateMuralCacheIfLoaded(institutionId, (messages) =>
          messages.filter((msg: any) => msg.id !== current.muralMessageId)
        );
      }

      await logAudit('delete', 'social_work', req.params.recordId, req, institutionId,
        `Atendimento do Serviço Social excluído de ${resident.name || 'residente'}`,
        { residentId, visibility: current.visibility || 'institutional' });

      return res.json({ success: true, socialWork: updatedSocialWork });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao excluir atendimento do Serviço Social.');
    }
  });

  app.post('/api/social-work/confidential/:residentId/:recordId/unlock', requireAuth, async (req: any, res) => {
    if (!isStrictSocialWorker(req.user)) {
      return res.status(403).json({ error: 'Acesso negado: registro restrito ao Serviço Social.' });
    }

    try {
      const proof = verifyReauthToken(String(req.body?.reauthToken || ''));
      if (!proof.valid || proof.userId !== req.user?.id) {
        return res.status(401).json({ error: 'Confirmação de identidade inválida ou expirada.' });
      }

      const residentDoc = await db.collection('residents').doc(req.params.residentId).get();
      if (!residentDoc.exists) return res.status(404).json({ error: 'Residente não encontrado.' });

      const resident: any = residentDoc.data();
      if (!isAuthorizedForDocument(req.user, resident)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      const institutionId = await getRealInstitutionId(resident.institutionId || '');
      if (!institutionId || !isUserAuthorizedForInstitution(req.user, institutionId)) {
        return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
      }

      const evolutions = Array.isArray(resident.socialWork?.evolutions) ? resident.socialWork.evolutions : [];
      const metadata = evolutions.find((item: any) => item?.id === req.params.recordId);
      if (!metadata || metadata.visibility !== 'confidential') {
        return res.status(404).json({ error: 'Registro sigiloso não encontrado.' });
      }

      const confidentialDoc = await db.collection('social_confidential_records').doc(req.params.recordId).get();
      if (!confidentialDoc.exists) return res.status(404).json({ error: 'Conteúdo sigiloso não encontrado.' });

      const confidential: any = confidentialDoc.data();
      if (
        confidential.residentId !== req.params.residentId ||
        getCanonicalInstitutionId(confidential.institutionId) !== getCanonicalInstitutionId(institutionId)
      ) {
        return res.status(404).json({ error: 'Conteúdo sigiloso não encontrado.' });
      }

      await logAudit('unlock', 'social_work_confidential', req.params.recordId, req, institutionId,
        'Registro sigiloso do Serviço Social desbloqueado.',
        { residentId: req.params.residentId });

      return res.json({
        description: confidential.description || '',
        referrals: confidential.referrals || ''
      });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao desbloquear registro sigiloso.');
    }
  });

  // Multidisciplinary History API
  app.get('/api/multidisciplinary/history', requireAuth, rejectVisitor, async (req: any, res) => {
    const { institutionId, competence, residentId, dateFrom, dateTo, type, visibility, limit } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      if (!realId || !isUserAuthorizedForInstitution(req.user, realId)) {
        return res.status(403).json({ error: 'Acesso negado para esta unidade institucional.' });
      }

      const snapshot = await db.collection('residents').where('institutionId', '==', realId).get();
      let events: any[] = [];

      snapshot.docs.forEach((doc: any) => {
        if (residentId && String(residentId) !== doc.id) return;

        const r = doc.data();
        const residentName = r.name || 'Sem Nome';

        if (competence === 'psicologia' && r.psychology) {
          if (Array.isArray(r.psychology.attendances)) {
            r.psychology.attendances.forEach((att: any) => {
              events.push({
                residentName,
                residentId: doc.id,
                type: 'Atendimento',
                timestamp: att.dateTime || att.date || new Date().toISOString(),
                attendanceEvolution: att.descricaoAtendimento || att.attendanceEvolution || '',
                notes: att.privateNotes || att.muralNotes || '',
                signature: att.signature || '',
                interventionType: att.interventionType || ''
              });
            });
          }
          if (Array.isArray(r.psychology.evolutions)) {
            r.psychology.evolutions.forEach((evo: any) => {
              events.push({
                residentName,
                residentId: doc.id,
                type: 'Evolução',
                timestamp: evo.date || new Date().toISOString(),
                attendanceEvolution: evo.notes || '',
                signature: evo.signature || ''
              });
            });
          }
        } else if (competence === 'nutricionista' && r.nutrition) {
          if (Array.isArray(r.nutrition.attendances)) {
            r.nutrition.attendances.forEach((att: any) => {
              events.push({
                residentName,
                residentId: doc.id,
                type: 'Atendimento',
                timestamp: att.date || new Date().toISOString(),
                attendanceEvolution: att.notes || '',
                signature: att.signature || ''
              });
            });
          }
        } else if (competence === 'assistente_social' && r.socialWork) {
          if (Array.isArray(r.socialWork.evolutions)) {
            r.socialWork.evolutions.forEach((evo: any) => {
              const recordVisibility = evo.visibility === 'confidential' ? 'confidential' : 'institutional';
              const isConfidential = recordVisibility === 'confidential';

              events.push({
                residentName,
                residentId: doc.id,
                recordId: evo.id,
                type: evo.title || 'Ação Social',
                timestamp: evo.date
                  ? (evo.time ? `${evo.date}T${evo.time}:00` : `${evo.date}T12:00:00`)
                  : new Date().toISOString(),
                attendanceEvolution: isConfidential
                  ? '[REGISTRO SIGILOSO - SERVIÇO SOCIAL]'
                  : (evo.description || ''),
                notes: isConfidential ? '' : (evo.referrals || ''),
                signature: evo.professionalName || 'Assistente Social',
                interventionType: evo.type || 'atendimento_individual',
                subtype: evo.subtype || '',
                visibility: recordVisibility,
                isConfidential,
                targetPersonOrEntity: evo.targetPersonOrEntity || ''
              });
            });
          }
        } else if (competence === 'terapeuta_ocupacional' && r.occupationalTherapy) {
          if (Array.isArray(r.occupationalTherapy.attendances)) {
            r.occupationalTherapy.attendances.forEach((att: any) => {
              events.push({
                residentName,
                residentId: doc.id,
                type: 'Atendimento',
                timestamp: att.dateTime || new Date().toISOString(),
                attendanceEvolution: att.attendanceEvolution || '',
                signature: att.signature || ''
              });
            });
          }
        } else if (competence === 'fisioterapeuta' && r.physiotherapy) {
          if (Array.isArray(r.physiotherapy.attendances)) {
            r.physiotherapy.attendances.forEach((att: any) => {
              events.push({
                residentName,
                residentId: doc.id,
                type: 'Atendimento',
                timestamp: att.dateTime || new Date().toISOString(),
                attendanceEvolution: att.attendanceEvolution || '',
                signature: att.signature || ''
              });
            });
          }
        }
      });

      if (competence === 'assistente_social') {
        if (type && type !== 'todos') {
          events = events.filter(item => item.interventionType === type);
        }
        if (visibility && visibility !== 'todos') {
          events = events.filter(item => item.visibility === visibility);
        }
        if (dateFrom) {
          const from = new Date(`${String(dateFrom)}T00:00:00`).getTime();
          if (Number.isFinite(from)) events = events.filter(item => new Date(item.timestamp).getTime() >= from);
        }
        if (dateTo) {
          const to = new Date(`${String(dateTo)}T23:59:59.999`).getTime();
          if (Number.isFinite(to)) events = events.filter(item => new Date(item.timestamp).getTime() <= to);
        }
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const requestedLimit = Number(limit);
      if (Number.isFinite(requestedLimit) && requestedLimit > 0) {
        return res.json(events.slice(0, Math.min(requestedLimit, 200)));
      }

      if (competence === 'assistente_social') {
        return res.json(residentId ? events : events.slice(0, 10));
      }

      return res.json(events.slice(0, 30));
    } catch (error: any) {
      console.error('Error fetching multidisciplinary history:', error);
      return res.json([]);
    }
  });

  // --- Group Activities API ---
  app.get('/api/groupActivities', rejectVisitor, async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('group_activities')
        .where('institutionId', '==', realId)
        .get();
      const events = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(events);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar atividades em grupo.' );
    }
  });

  app.post('/api/groupActivities', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id) {
        const existingDoc = await db.collection('group_activities').doc(data.id).get();

        if (existingDoc.exists) {
          if (!isAuthorizedForDocument((req as any).user, existingDoc.data())) {
            return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
          }
          await db.collection('group_activities').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
          await logAudit('update', 'group_activities', data.id, req, realId, `Atualização da atividade: ${data.title}`);
          return res.json({ ...data, id: data.id, institutionId: realId });
        }

        await db.collection('group_activities').doc(data.id).set({ ...data, institutionId: realId });
        await logAudit('create', 'group_activities', data.id, req, realId, `Nova atividade em grupo: ${data.title}`);
        return res.json({ ...data, id: data.id, institutionId: realId });
      }

      const docRef = await db.collection('group_activities').add({ ...data, institutionId: realId });
      await logAudit('create', 'group_activities', docRef.id, req, realId, `Nova atividade em grupo: ${data.title}`);
      return res.json({ ...data, id: docRef.id, institutionId: realId });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar atividade em grupo.' );
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
    } catch (error: any) {
       console.error("Handover search error:", error);
       return sendDatabaseError(res, error, 'Erro ao buscar histórico de plantão' );
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
    } catch (error: any) {
       console.error("Handover save error:", error);
       return sendDatabaseError(res, error, 'Erro ao salvar plantão' );
    }
  });

  app.delete('/api/groupActivities/:id', requireRole(['assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'gerencial']), async (req, res) => {
    try {
      const docRef = db.collection('group_activities').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || !isAuthorizedForDocument((req as any).user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      return sendDatabaseError(res, error, );
    }
  });

  // --- Medication Stock Movements API ---
  app.get('/api/medication_stock_movements', rejectVisitor, async (req, res) => {
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
    } catch (error: any) {
      console.error(error);
      return sendDatabaseError(res, error, 'Erro ao buscar movimentações de estoque' );
    }
  });

  app.post('/api/medication_stock_movements', rejectVisitor, async (req, res) => {
    try {
      const { ...data } = req.body;
      data.institutionId = await getRealInstitutionId(data.institutionId);
      const docRef = db.collection('medication_stock_movements').doc();
      await docRef.set({ ...data, id: docRef.id });
      res.json({ success: true, id: docRef.id });
    } catch (error: any) {
      console.error(error);
      return sendDatabaseError(res, error, 'Erro ao salvar movimentação de estoque' );
    }
  });

  // --- Medication Administration Logs API ---
  app.get('/api/medication_administration_logs', rejectVisitor, async (req, res) => {
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
    } catch (error: any) {
      console.error(error);
      return sendDatabaseError(res, error, 'Erro ao buscar logs de ministração' );
    }
  });

  app.post('/api/medication_administration_logs', rejectVisitor, async (req, res) => {
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
    } catch (error: any) {
      console.error(error);
      return sendDatabaseError(res, error, 'Erro ao salvar log de ministração' );
    }
  });

  // --- Inventory API ---
  app.get('/api/inventory', rejectVisitor, async (req, res) => {
    const { institutionId } = req.query;
    try {
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('medication_inventory')
        .where('institutionId', '==', realId)
        .get();
      const inventory = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(inventory);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar estoque de medicamentos.' );
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
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar estoque em massa.' );
    }
  });

  // --- Companions API ---
  app.get('/api/companions', rejectVisitor, async (req: any, res) => {
    const { institutionId } = req.query;
    try {
      if (!institutionId) return res.json([]);
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('companions')
        .where('institutionId', '==', realId)
        .get();
      const companions = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);
      res.json(companions);
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao buscar acompanhantes.' );
    }
  });

  app.post('/api/companions', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req: any, res) => {
    const { institutionId, ...data } = req.body;
    try {
      const realId = await getRealInstitutionId(institutionId);
      if (data.id && data.id.length > 20) {
        const existingDoc = await db.collection('companions').doc(data.id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument(req.user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        await db.collection('companions').doc(data.id).set({ ...data, institutionId: realId }, { merge: true });
        await logAudit('update', 'companions', data.id, req, realId, `Atualização do acompanhante: ${data.name}`);
        res.json({ ...data, id: data.id, institutionId: realId });
      } else {
        const docRef = await db.collection('companions').add({ ...data, institutionId: realId });
        await logAudit('create', 'companions', docRef.id, req, realId, `Novo acompanhante cadastrado: ${data.name}`);
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar acompanhante.' );
    }
  });

  app.delete('/api/companions/:id', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'medico', 'administrador']), async (req: any, res) => {
    try {
      const docRef = db.collection('companions').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || !isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Arquivado com sucesso.' });
    } catch (error: any) {
      if (error.code === 5 || error.message?.includes('NOT_FOUND')) return res.json({ success: true });
      return sendDatabaseError(res, error, );
    }
  });

  // --- DOANTES E BENFEITORES FINANCEIROS API ---
  app.get('/api/benefactors', rejectVisitor, async (req: any, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.query.institutionId as string;
      if (!institutionId) return res.json([]);
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('benefactors')
        .where('institutionId', '==', realId)
        .get();
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.archived);
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching benefactors:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar benfeitores.' );
    }
  });

  app.post('/api/benefactors', rejectVisitor, async (req: any, res) => {
    const { id, ...data } = req.body;
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.body.institutionId;
      const realId = await getRealInstitutionId(institutionId);
      if (id && id.length > 10) {
        const existingDoc = await db.collection('benefactors').doc(id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument(req.user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        await db.collection('benefactors').doc(id).set({ ...data, institutionId: realId }, { merge: true });
        res.json({ ...data, id, institutionId: realId });
      } else {
        const docRef = await db.collection('benefactors').add({ ...data, institutionId: realId, archived: false, createdAt: new Date().toISOString() });
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error: any) {
      console.error('Error saving benefactor:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar benfeitor.' );
    }
  });

  app.delete('/api/benefactors/:id', rejectVisitor, async (req: any, res) => {
    try {
      const docRef = db.collection('benefactors').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || !isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao inativar benfeitor.' );
    }
  });

  // --- CATEGORIAS DE DOAÇÃO API ---
  app.get('/api/donation-categories', rejectVisitor, async (req: any, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.query.institutionId as string;
      if (!institutionId) return res.json([]);
      const realId = await getRealInstitutionId(institutionId as string);
      const snapshot = await db.collection('donation_categories')
        .where('institutionId', '==', realId)
        .get();
      let items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.archived);
      
      // If none exist, bootstrap the default ones
      if (items.length === 0) {
        const defaults = [
          { name: 'Doação espontânea pessoa física', description: 'Doações voluntárias avulsas de pessoas físicas' },
          { name: 'Doação espontânea pessoa jurídica', description: 'Doações voluntárias de empresas e parcerias PJ' },
          { name: 'Carnês de mensalidade', description: 'Contribuições mensais recorrentes via carnê' },
          { name: 'Telemarketing', description: 'Doações captadas pela equipe de telemarketing' },
          { name: 'Outras Campanhas', description: 'Outros tipos de campanhas eventuais' }
        ];
        const batch = db.batch();
        const created: any[] = [];
        for (const cat of defaults) {
          const ref = db.collection('donation_categories').doc();
          const docData = { ...cat, institutionId: realId, archived: false };
          batch.set(ref, docData);
          created.push({ id: ref.id, ...docData });
        }
        await batch.commit();
        items = created;
      }
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching donation categories:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar categorias.' );
    }
  });

  app.post('/api/donation-categories', rejectVisitor, async (req: any, res) => {
    const { id, ...data } = req.body;
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.body.institutionId;
      const realId = await getRealInstitutionId(institutionId);
      if (id && id.length > 10) {
        const existingDoc = await db.collection('donation_categories').doc(id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument(req.user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        await db.collection('donation_categories').doc(id).set({ ...data, institutionId: realId }, { merge: true });
        res.json({ ...data, id, institutionId: realId });
      } else {
        const docRef = await db.collection('donation_categories').add({ ...data, institutionId: realId, archived: false });
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao salvar categoria.' );
    }
  });

  app.delete('/api/donation-categories/:id', rejectVisitor, async (req: any, res) => {
    try {
      const docRef = db.collection('donation_categories').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || !isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao excluir categoria de doação.' );
    }
  });

  // --- DOAÇÕES FINANCEIRAS API ---
  app.get('/api/donations', rejectVisitor, async (req: any, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.query.institutionId as string;
      if (!institutionId) return res.json([]);
      const realId = await getRealInstitutionId(institutionId as string);
      let queryRef: any = db.collection('finance_donations').where('institutionId', '==', realId);
      
      const { startDate, endDate } = req.query;
      if (startDate) {
        queryRef = queryRef.where('date', '>=', startDate);
      }
      if (endDate) {
        queryRef = queryRef.where('date', '<=', endDate);
      }

      const snapshot = await queryRef.get();
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.archived);
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching donations:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar doações.' );
    }
  });

  app.post('/api/donations', rejectVisitor, async (req: any, res) => {
    const { id, ...data } = req.body;
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.body.institutionId;
      const realId = await getRealInstitutionId(institutionId);
      if (id && id.length > 10) {
        const existingDoc = await db.collection('finance_donations').doc(id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument(req.user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        await db.collection('finance_donations').doc(id).set({ ...data, institutionId: realId }, { merge: true });
        res.json({ ...data, id, institutionId: realId });
      } else {
        const docRef = await db.collection('finance_donations').add({ ...data, institutionId: realId, archived: false, createdAt: new Date().toISOString() });
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error: any) {
      console.error('Error saving finance donation:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar doação financeira.' );
    }
  });

  app.delete('/api/donations/:id', rejectVisitor, async (req: any, res) => {
    try {
      const docRef = db.collection('finance_donations').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: 'Doação não encontrada.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, archivedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao inativar doação.' );
    }
  });

  // --- CARNÊS DE BENFEITORES API ---
  app.get('/api/carnes', rejectVisitor, async (req: any, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.query.institutionId as string;
      if (!institutionId) return res.json([]);
      const realId = await getRealInstitutionId(institutionId as string);
      let queryRef: any = db.collection('carnes').where('institutionId', '==', realId);
      
      const { ano } = req.query;
      if (ano) {
        queryRef = queryRef.where('ano', '==', Number(ano));
      }

      const snapshot = await queryRef.get();
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.archived);
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching carnes:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar carnês.');
    }
  });

  app.post('/api/carnes', rejectVisitor, async (req: any, res) => {
    const { id, ...data } = req.body;
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.body.institutionId;
      const realId = await getRealInstitutionId(institutionId);

      // Helper to generate default 12 parcelas if not provided
      if (!data.parcelas || !Array.isArray(data.parcelas) || data.parcelas.length === 0) {
        const ano = Number(data.ano) || new Date().getFullYear();
        const valorParcela = Number(data.valorParcela) || 0;
        const meses = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        data.parcelas = meses.map((mes, index) => {
          const num = index + 1;
          const mesStr = num < 10 ? `0${num}` : `${num}`;
          return {
            numero: num,
            mesReferencia: `${mes}/${ano}`,
            vencimento: `${ano}-${mesStr}-10`,
            valor: valorParcela,
            pago: false
          };
        });
      }

      if (id && id.length > 10) {
        const existingDoc = await db.collection('carnes').doc(id).get();
        if (!existingDoc.exists || !isAuthorizedForDocument(req.user, existingDoc.data())) {
          return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
        }
        await db.collection('carnes').doc(id).set({ ...data, institutionId: realId }, { merge: true });
        res.json({ ...data, id, institutionId: realId });
      } else {
        const docRef = await db.collection('carnes').add({
          ...data,
          institutionId: realId,
          status: data.status || 'ativo',
          archived: false,
          createdAt: new Date().toISOString()
        });
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error: any) {
      console.error('Error saving carne:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar carnê.');
    }
  });

  app.post('/api/carnes/:id/pay-parcelas', rejectVisitor, async (req: any, res) => {
    const { id } = req.params;
    const { numeros, dataPagamento, formaPagamento, categoryId, categoryName, notes, userResponsible } = req.body;
    
    if (!Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({ error: 'Nenhuma parcela selecionada para baixa.' });
    }

    try {
      const docRef = db.collection('carnes').doc(id);
      const responsible = userResponsible || (req.user && req.user.nome) || 'Operador do Sistema';
      const paymentDate = dataPagamento || new Date().toISOString().split('T')[0];
      const method = formaPagamento || 'PIX';

      let updatedCarneData: any = null;
      const createdDonations: any[] = [];

      await db.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists) {
          throw new Error('CARNE_NOT_FOUND');
        }

        const carneData = docSnap.data();
        if (!isAuthorizedForDocument(req.user, carneData)) {
          throw new Error('CARNE_FORBIDDEN');
        }
        const realId = carneData.institutionId;
        let parcelas = carneData.parcelas || [];

        // Verify if any selected parcela is already paid
        const alreadyPaid = parcelas.filter((p: any) => numeros.includes(p.numero) && p.pago);
        if (alreadyPaid.length > 0) {
          const numerosJaPagos = alreadyPaid.map((p: any) => p.numero).join(', ');
          throw new Error(`ALREADY_PAID:${numerosJaPagos}`);
        }

        for (let i = 0; i < parcelas.length; i++) {
          const p = parcelas[i];
          if (numeros.includes(p.numero) && !p.pago) {
            const donationRef = db.collection('finance_donations').doc();
            const donationData = {
              carneId: id,
              benefactorId: carneData.benefactorId || '',
              benefactorName: carneData.benefactorName || 'Benfeitor',
              parcelaNumero: p.numero,
              mesReferencia: p.mesReferencia || `Mês ${p.numero}`,
              categoryId: categoryId || carneData.categoryId || '',
              categoryName: categoryName || carneData.categoryName || 'Carnês de mensalidade',
              value: Number(p.valor) || Number(carneData.valorParcela) || 0,
              date: paymentDate,
              paymentMethod: method,
              campaign: 'Carnês de Mensalidade',
              userResponsible: responsible,
              notes: notes ? `${notes} (Folha ${p.numero}/12)` : `Baixa de Carnê - Folha ${p.numero}/12 (${p.mesReferencia})`,
              institutionId: realId,
              archived: false,
              createdAt: new Date().toISOString()
            };

            transaction.set(donationRef, donationData);
            createdDonations.push({ id: donationRef.id, ...donationData });

            parcelas[i] = {
              ...p,
              pago: true,
              dataPagamento: paymentDate,
              formaPagamento: method,
              donationId: donationRef.id,
              userResponsible: responsible,
              observacao: notes || p.observacao || ''
            };
          }
        }

        const allPaid = parcelas.every((p: any) => p.pago);
        const newStatus = allPaid ? 'quitado' : carneData.status || 'ativo';

        transaction.update(docRef, {
          parcelas,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          lastPaidAt: new Date().toISOString(),
          lastPaidBy: responsible
        });

        updatedCarneData = {
          id,
          ...carneData,
          parcelas,
          status: newStatus,
          createdDonations
        };
      });

      res.json(updatedCarneData);
    } catch (error: any) {
      if (error.message === 'CARNE_NOT_FOUND') {
        return res.status(404).json({ error: 'Carnê não encontrado.' });
      }
      if (error.message === 'CARNE_FORBIDDEN') {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      if (error.message && error.message.startsWith('ALREADY_PAID:')) {
        const nums = error.message.split('ALREADY_PAID:')[1];
        return res.status(400).json({ error: `A(s) folha(s) ${nums} já constam como paga(s).` });
      }
      console.error('Error paying carne parcelas:', error);
      return sendDatabaseError(res, error, 'Erro ao dar baixa nas parcelas do carnê.');
    }
  });

  app.delete('/api/carnes/:id', rejectVisitor, async (req: any, res) => {
    try {
      const docRef = db.collection('carnes').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists || !isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({ archived: true, status: 'cancelado', archivedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao cancelar carnê.');
    }
  });

  app.post('/api/carnes/:id/log-whatsapp', rejectVisitor, async (req: any, res) => {
    const { id } = req.params;
    const { messageType, parcelaNumero, textPreview, phone, userResponsible } = req.body;
    try {
      const docRef = db.collection('carnes').doc(id);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: 'Carnê não encontrado.' });
      }

      const carneData = docSnap.data();
      if (!isAuthorizedForDocument(req.user, carneData)) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      const responsible = userResponsible || (req.user && req.user.nome) || 'Operador do Sistema';
      const logEntry = {
        id: db.collection('carnes').doc().id,
        date: new Date().toISOString(),
        messageType,
        parcelaNumero: parcelaNumero || null,
        textPreview: textPreview || '',
        phone: phone || '',
        userResponsible: responsible,
        status: 'preparada_aberta'
      };

      const whatsappLogs = carneData.whatsappLogs || [];
      whatsappLogs.unshift(logEntry);

      await docRef.update({
        whatsappLogs,
        lastWhatsAppAt: logEntry.date,
        lastWhatsAppBy: responsible,
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true, logEntry, whatsappLogs });
    } catch (error: any) {
      console.error('Error logging whatsapp communication:', error);
      return sendDatabaseError(res, error, 'Erro ao registrar comunicação via WhatsApp.');
    }
  });

  // --- CONTROLE DA CAIXINHA (FUNDO FIXO / DINHEIRO) API ---
  app.get('/api/caixinha', async (req: any, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.query.institutionId as string;
      if (!institutionId) return res.json([]);
      const realId = await getRealInstitutionId(institutionId as string);
      let queryRef: any = db.collection('caixinha_movements').where('institutionId', '==', realId);

      const { startDate, endDate } = req.query;
      if (startDate) {
        queryRef = queryRef.where('date', '>=', startDate);
      }
      if (endDate) {
        queryRef = queryRef.where('date', '<=', endDate);
      }

      const snapshot = await queryRef.get();
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.archived);
      items.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching caixinha movements:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar movimentações da caixinha.');
    }
  });

  app.post('/api/caixinha', async (req: any, res) => {
    const { id, ...data } = req.body;
    try {
      const institutionId = req.headers['x-institution-id'] as string || req.body.institutionId;
      const realId = await getRealInstitutionId(institutionId);
      if (id && id.length > 10) {
        await db.collection('caixinha_movements').doc(id).set({ ...data, institutionId: realId, updatedAt: new Date().toISOString() }, { merge: true });
        res.json({ ...data, id, institutionId: realId });
      } else {
        const docRef = await db.collection('caixinha_movements').add({
          ...data,
          institutionId: realId,
          archived: false,
          createdAt: new Date().toISOString()
        });
        res.json({ ...data, id: docRef.id, institutionId: realId });
      }
    } catch (error: any) {
      console.error('Error saving caixinha movement:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar movimentação da caixinha.');
    }
  });

  app.delete('/api/caixinha/:id', async (req: any, res) => {
    try {
      const docRef = db.collection('caixinha_movements').doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ error: 'Movimentação não encontrada.' });
      if (!isAuthorizedForDocument(req.user, doc.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }
      await docRef.update({
        archived: true,
        archivedAt: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error: any) {
      return sendDatabaseError(res, error, 'Erro ao excluir movimentação da caixinha.');
    }
  });


  // --- CUSTOM PRODUCT STOCK & MOVEMENT MODULE ---
  app.get('/api/stock-products', requireRole(['administrador', 'gerencial', 'enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const cacheKey = `stock-products:${institutionId}`;
      const cached = getFromCache(cacheKey);
      if (cached) return res.json(cached);

      const snapshot = await db.collection('product_stock')
        .where('institutionId', '==', institutionId)
        .get();
      
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      if (items) {
        setToCache(cacheKey, items);
      }
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching stock products:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar produtos em estoque.' );
    }
  });

  app.post('/api/stock-products', requireRole(['administrador', 'gerencial', 'nutricionista', 'enfermeira', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const item = req.body;
      const itemId = item.id || Date.now().toString();
      
      const normKey = getNormalizedProductKey(item.name || '', item.category || 'ALIMENTAÇÃO', item.unit || '');
      const lockDocId = crypto.createHash('sha256').update(`${institutionId}||${normKey}`).digest('hex');

      const productRef = db.collection('product_stock').doc(itemId);
      const lockRef = db.collection('stock_product_keys').doc(lockDocId);

      const txnResult = await db.runTransaction(async (transaction) => {
        // --- 1. ALL READS FIRST ---
        const lockSnap = await transaction.get(lockRef);
        const existingProductSnap = item.id ? await transaction.get(productRef) : null;

        let otherProdSnap: any = null;
        if (lockSnap.exists) {
          const lockData = lockSnap.data();
          if (lockData && lockData.productId !== itemId) {
            otherProdSnap = await transaction.get(db.collection('product_stock').doc(lockData.productId));
          }
        }

        let legacyMatchDoc: any = null;
        if (!lockSnap.exists) {
          const querySnap = await transaction.get(db.collection('product_stock'));
          for (const doc of querySnap.docs) {
            if (doc.id === itemId) continue;
            const d = doc.data();
            if (d.institutionId && d.institutionId !== institutionId) continue;
            const k = getNormalizedProductKey(d.name || '', d.category || '', d.unit || '');
            if (k === normKey) {
              legacyMatchDoc = { id: doc.id, name: d.name || '', category: d.category || '', unit: d.unit || '' };
              break;
            }
          }
        }

        let oldLockRef: any = null;
        if (existingProductSnap && existingProductSnap.exists) {
          const oldData = existingProductSnap.data();
          if (oldData) {
            const oldKey = getNormalizedProductKey(oldData.name || '', oldData.category || '', oldData.unit || '');
            if (oldKey !== normKey) {
              const oldLockDocId = crypto.createHash('sha256').update(`${institutionId}||${oldKey}`).digest('hex');
              oldLockRef = db.collection('stock_product_keys').doc(oldLockDocId);
            }
          }
        }

        // --- 2. CHECK CONFLICTS & WRITE LOCK IF LEGACY ---
        if (lockSnap.exists) {
          const lockData = lockSnap.data();
          if (lockData && lockData.productId !== itemId) {
            const otherData = otherProdSnap && otherProdSnap.exists ? otherProdSnap.data() : null;
            return {
              conflict: true,
              existingProductId: lockData.productId,
              existingProduct: {
                id: lockData.productId,
                name: otherData?.name || '',
                category: otherData?.category || '',
                unit: otherData?.unit || ''
              }
            };
          }
        }

        if (legacyMatchDoc) {
          // Write lock pointing to the legacy existing product
          transaction.set(lockRef, {
            institutionId,
            normalizedKey: normKey,
            productId: legacyMatchDoc.id,
            createdAt: new Date().toISOString()
          });

          return {
            conflict: true,
            existingProductId: legacyMatchDoc.id,
            existingProduct: {
              id: legacyMatchDoc.id,
              name: legacyMatchDoc.name || '',
              category: legacyMatchDoc.category || '',
              unit: legacyMatchDoc.unit || ''
            }
          };
        }

        // --- 3. WRITE PHASE ---
        if (oldLockRef) {
          transaction.delete(oldLockRef);
        }

        const data: any = {
          name: item.name || '',
          unit: item.unit || '',
          category: (item.category || 'ALIMENTAÇÃO').toUpperCase(),
          currentStock: Number(item.currentStock) || 0,
          minStock: Number(item.minStock) || 0,
          status: item.status || 'Disponível',
          estimatedCost: item.estimatedCost !== undefined ? Number(item.estimatedCost) || null : null,
          institutionId,
          updatedAt: new Date().toISOString()
        };

        if (data.currentStock === 0) {
          data.status = 'Comprar';
        } else if (data.currentStock < data.minStock) {
          data.status = 'Alerta';
        } else {
          data.status = 'Disponível';
        }

        transaction.set(productRef, data, { merge: true });

        transaction.set(lockRef, {
          institutionId,
          normalizedKey: normKey,
          productId: itemId,
          createdAt: new Date().toISOString()
        });

        return {
          success: true,
          item: { id: itemId, ...data }
        };
      });

      if (txnResult.conflict) {
        return res.status(409).json({
          code: 'PRODUCT_DUPLICATE',
          existingProductId: txnResult.existingProductId,
          existingProduct: txnResult.existingProduct,
          error: 'Já existe um produto idêntico cadastrado nesta instituição.'
        });
      }

      invalidateCache('stock');
      res.json({ success: true, item: txnResult.item });
    } catch (error: any) {
      console.error('Error saving stock product:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar produto em estoque.' );
    }
  });

  app.delete('/api/stock-products/:id', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const productId = req.params.id;
      const productRef = db.collection('product_stock').doc(productId);
      const existingProduct = await productRef.get();
      if (!existingProduct.exists || !isAuthorizedForDocument((req as any).user, existingProduct.data())) {
        return res.status(404).json({ error: 'Registro não encontrado ou acesso não autorizado.' });
      }

      await db.runTransaction(async (transaction) => {
        const prodSnap = await transaction.get(productRef);
        if (!prodSnap.exists) return;

        const prodData = prodSnap.data();
        if (prodData && prodData.institutionId) {
          const normKey = getNormalizedProductKey(prodData.name || '', prodData.category || '', prodData.unit || '');
          const lockDocId = crypto.createHash('sha256').update(`${prodData.institutionId}||${normKey}`).digest('hex');
          const lockRef = db.collection('stock_product_keys').doc(lockDocId);
          transaction.delete(lockRef);
        }
        transaction.delete(productRef);
      });

      invalidateCache('stock');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting stock product:', error);
      return sendDatabaseError(res, error, 'Erro ao excluir produto do estoque.' );
    }
  });

  app.post('/api/stock-products/bulk-bootstrap', requireRole(['administrador', 'gerencial', 'nutricionista', 'enfermeira', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato de itens inválido.' });
      
      const batchSize = 100;
      let batch = db.batch();
      let count = 0;
      
      for (const item of items) {
        const id = item.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ref = db.collection('product_stock').doc(id);
        
        const currentStock = Number(item.currentStock) || 0;
        const minStock = Number(item.minStock) || 0;
        let status = item.status || 'Disponível';
        if (currentStock === 0) {
          status = 'Comprar';
        } else if (currentStock < minStock) {
          status = 'Alerta';
        } else {
          status = 'Disponível';
        }

        const data = {
          name: item.name || '',
          unit: item.unit || '',
          category: (item.category || 'ALIMENTAÇÃO').toUpperCase(),
          currentStock,
          minStock,
          status,
          institutionId,
          updatedAt: new Date().toISOString()
        };
        
        const normKey = getNormalizedProductKey(data.name, data.category, data.unit);
        const lockDocId = crypto.createHash('sha256').update(`${institutionId}||${normKey}`).digest('hex');
        const lockRef = db.collection('stock_product_keys').doc(lockDocId);

        batch.set(ref, data, { merge: true });
        batch.set(lockRef, {
          institutionId,
          normalizedKey: normKey,
          productId: id,
          createdAt: new Date().toISOString()
        }, { merge: true });
        count += 2;
        
        if (count % batchSize === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }
      
      if (count % batchSize !== 0) {
        await batch.commit();
      }
      
      res.json({ success: true, count });
    } catch (error: any) {
      console.error('Error bootstrapping stock products:', error);
      return sendDatabaseError(res, error, 'Erro ao carregar catálogo de produtos.' );
    }
  });

  app.get('/api/stock-movements', requireRole(['administrador', 'gerencial', 'enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      // Attempt ordered fetch; if index missing, retry without ordering and sort in memory
      try {
        const snapshot = await db.collection('stock_movements')
          .where('institutionId', '==', institutionId)
          .orderBy('date', 'desc')
          .limit(200)
          .get();
        const movements = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        return res.json(movements);
      } catch (idxError) {
        const snapshot = await db.collection('stock_movements')
          .where('institutionId', '==', institutionId)
          .get();
        const movements = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        movements.sort((a: any, b: any) => b.date.localeCompare(a.date));
        res.json(movements.slice(0, 200));
      }
    } catch (error: any) {
      console.error('Error fetching stock movements:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar movimentações de estoque.' );
    }
  });

  app.post('/api/stock-movements', requireRole(['administrador', 'gerencial', 'nutricionista', 'enfermeira', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const mv = req.body;
      const prodRef = db.collection('product_stock').doc(mv.productId);
      const prodDoc = await prodRef.get();
      
      if (!prodDoc.exists) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
      }
      
      const prodData = prodDoc.data();
      const change = Number(mv.quantity) || 0;
      let newStock = Number(prodData.currentStock) || 0;
      
      if (mv.type === 'entrada') {
        newStock += change;
      } else {
        newStock = Math.max(0, newStock - change);
      }
      
      let newStatus = 'Disponível';
      if (newStock === 0) {
        newStatus = 'Comprar';
      } else if (newStock < Number(prodData.minStock || 0)) {
        newStatus = 'Alerta';
      }
      
      await prodRef.update({
        currentStock: newStock,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      const movementDoc = {
        productId: mv.productId,
        productName: prodData.name,
        type: mv.type,
        quantity: change,
        date: mv.date || new Date().toISOString().split('T')[0],
        userName: mv.userName || 'Sistema',
        notes: mv.notes || '',
        reason: mv.reason || null,
        price: Number(mv.price) || null,
        invoiceNumber: mv.invoiceNumber || null,
        supplierId: mv.supplierId || null,
        supplierName: mv.supplierName || null,
        donorId: mv.donorId || null,
        donorName: mv.donorName || null,
        donorPhone: mv.donorPhone || null,
        institutionId,
        createdAt: new Date().toISOString()
      };
      
      const mvRef = await db.collection('stock_movements').add(movementDoc);

      // Conforme as compras forem sendo registradas, nesse cadastro fica visivel as categorias que correspondem a ele
      if (mv.type === 'entrada' && mv.reason === 'compra' && mv.supplierId) {
        try {
          const suppRef = db.collection('suppliers').doc(mv.supplierId);
          const suppDoc = await suppRef.get();
          if (suppDoc.exists) {
            const suppData = suppDoc.data();
            const currentCategories = suppData.categories || [];
            const prodCategory = prodData.category; // e.g. "ALIMENTAÇÃO", "HIGIENE"
            if (prodCategory && !currentCategories.includes(prodCategory)) {
              await suppRef.update({
                categories: [...currentCategories, prodCategory]
              });
            }
          }
        } catch (suppErr) {
          console.error('Erro ao atualizar categorias do fornecedor:', suppErr);
        }
      }
      
      res.json({ success: true, movement: { id: mvRef.id, ...movementDoc }, newStock, newStatus });
    } catch (error: any) {
      console.error('Error registering stock movement:', error);
      return sendDatabaseError(res, error, 'Erro ao registrar movimentação de estoque.' );
    }
  });

  // --- Suppliers Endpoints ---
  app.get('/api/suppliers', requireRole(['administrador', 'gerencial', 'enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const snapshot = await db.collection('suppliers')
        .where('institutionId', '==', institutionId)
        .get();
      const suppliers = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(suppliers);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar fornecedores.' );
    }
  });

  app.post('/api/suppliers', requireRole(['administrador', 'gerencial', 'nutricionista', 'enfermeira', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const sup = req.body;
      if (!sup.name) {
        return res.status(400).json({ error: 'Nome do fornecedor é obrigatório.' });
      }

      const supplierDoc = {
        name: sup.name,
        phone: sup.phone || '',
        representative: sup.representative || '',
        email: sup.email || '',
        categories: sup.categories || [],
        institutionId,
        updatedAt: new Date().toISOString()
      };

      if (sup.id) {
        const docRef = db.collection('suppliers').doc(sup.id);
        await docRef.set(supplierDoc, { merge: true });
        res.json({ success: true, supplier: { id: sup.id, ...supplierDoc } });
      } else {
        (supplierDoc as any).createdAt = new Date().toISOString();
        const docRef = await db.collection('suppliers').add(supplierDoc);
        res.json({ success: true, supplier: { id: docRef.id, ...supplierDoc } });
      }
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar fornecedor.' );
    }
  });

  app.delete('/api/suppliers/:id', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const { id } = req.params;
      const docRef = db.collection('suppliers').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Fornecedor não encontrado.' });
      }
      if (doc.data().institutionId !== institutionId) {
        return res.status(403).json({ error: 'Não autorizado.' });
      }
      
      await docRef.delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      return sendDatabaseError(res, error, 'Erro ao excluir fornecedor.' );
    }
  });

  // --- Donors Endpoints ---
  app.get('/api/donors', requireRole(['administrador', 'gerencial', 'enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const snapshot = await db.collection('donors')
        .where('institutionId', '==', institutionId)
        .get();
      const donors = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(donors);
    } catch (error: any) {
      console.error('Error fetching donors:', error);
      return sendDatabaseError(res, error, 'Erro ao buscar doadores.' );
    }
  });

  app.post('/api/donors', requireRole(['administrador', 'gerencial', 'nutricionista', 'enfermeira', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const donor = req.body;
      if (!donor.name) {
        return res.status(400).json({ error: 'Nome do doador é obrigatório.' });
      }

      const donorDoc = {
        name: donor.name,
        phone: donor.phone || '',
        institutionId,
        updatedAt: new Date().toISOString()
      };

      if (donor.id) {
        const docRef = db.collection('donors').doc(donor.id);
        await docRef.set(donorDoc, { merge: true });
        res.json({ success: true, donor: { id: donor.id, ...donorDoc } });
      } else {
        (donorDoc as any).createdAt = new Date().toISOString();
        const docRef = await db.collection('donors').add(donorDoc);
        res.json({ success: true, donor: { id: docRef.id, ...donorDoc } });
      }
    } catch (error: any) {
      console.error('Error saving donor:', error);
      return sendDatabaseError(res, error, 'Erro ao salvar doador.' );
    }
  });

  app.delete('/api/donors/:id', requireRole(['administrador', 'gerencial', 'auxiliar_administrativo']), async (req, res) => {
    try {
      const institutionId = req.headers['x-institution-id'] as string;
      if (!institutionId) return res.status(400).json({ error: 'x-institution-id is required' });
      
      const { id } = req.params;
      const docRef = db.collection('donors').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Doador não encontrado.' });
      }
      if (doc.data().institutionId !== institutionId) {
        return res.status(403).json({ error: 'Não autorizado.' });
      }
      
      await docRef.delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting donor:', error);
      return sendDatabaseError(res, error, 'Erro ao excluir doador.' );
    }
  });

  // --- Gestão da Hierarquia SSVP (Conselhos Particulares e Conferências) ---

  async function getServiceAuthContext(req: any): Promise<ServiceAuthContext> {
    if (!req.user) {
      return { allowed: false };
    }
    const user = req.user;
    const headerInstId = req.headers['x-institution-id'];
    const rawInstId = headerInstId || user.cnpj || user.institutionId || (Array.isArray(user.institutionIds) && user.institutionIds[0]);

    if (!rawInstId) {
      return { allowed: false };
    }

    let resolvedCentralId = '54.927.132/0001-92';
    const strId = String(rawInstId);

    // Se o identificador for uma conferência ou conselho particular, recupera o centralId da entidade
    if (strId !== '54.927.132/0001-92' && !strId.includes('/')) {
      const confDoc = await safeQuery(async () => await db.collection('conferencias').doc(strId).get());
      if (confDoc && confDoc.exists) {
        resolvedCentralId = confDoc.data()?.centralId || '54.927.132/0001-92';
      } else {
        const cpDoc = await safeQuery(async () => await db.collection('conselhos_particulares').doc(strId).get());
        if (cpDoc && cpDoc.exists) {
          resolvedCentralId = cpDoc.data()?.centralId || '54.927.132/0001-92';
        } else {
          const fallbackId = await getRealInstitutionId(strId);
          if (fallbackId) resolvedCentralId = fallbackId;
        }
      }
    } else {
      const resolved = await getRealInstitutionId(strId);
      if (resolved) resolvedCentralId = resolved;
    }

    const isUserAdmin =
      user.accessLevel === 'administrador' ||
      user.accessLevel === 'super_admin' ||
      user.role === 'admin' ||
      user.isAdmin === true;

    return {
      allowed: true,
      validatedCentralId: resolvedCentralId,
      userId: user.id || user.username || 'system',
      isAdmin: isUserAdmin,
      conferenciaId: user.conferenciaId,
      particularId: user.particularId,
      accessLevel: user.accessLevel,
      role: user.role,
      institutionId: String(rawInstId),
    };
  }

  // 1. Listar Conselhos Particulares
  app.get('/api/conselhos-particulares', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConselhoParticularRepository(db);
      const { status, limit, cursor } = req.query;

      const parsedLimit = limit !== undefined ? Number(limit) : undefined;
      const result = await listConselhosParticulares(authContext, repo, {
        status: status as any,
        limit: parsedLimit,
        cursor: cursor ? String(cursor) : undefined,
      });

      if (!result.success) {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : result.code === 'INVALID_OPTIONS' ? 400 : 500;
        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao listar Conselhos Particulares.');
    }
  });

  // 2. Criar Conselho Particular
  app.post('/api/conselhos-particulares', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConselhoParticularRepository(db);

      const result = await createConselhoParticular(req.body, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'DUPLICATE_NAME') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.status(201).json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao criar Conselho Particular.');
    }
  });

  // 3. Atualizar Conselho Particular
  app.put('/api/conselhos-particulares/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConselhoParticularRepository(db);

      const result = await updateConselhoParticular(id, req.body, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'DUPLICATE_NAME' || result.code === 'IMMUTABLE_FIELD_MODIFIED' || result.code === 'INSTITUTION_SCOPE_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao atualizar Conselho Particular.');
    }
  });

  // 4. Inativar Conselho Particular
  app.post('/api/conselhos-particulares/:id/inativar', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConselhoParticularRepository(db);

      const result = await inactivateConselhoParticular(id, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'ACTIVE_CHILDREN_EXIST' || result.code === 'ALREADY_INACTIVE') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao inativar Conselho Particular.');
    }
  });

  // 5. Listar Conferências subordinadas ao Conselho Particular
  app.get('/api/conselhos-particulares/:particularId/conferencias', async (req: any, res) => {
    try {
      const { particularId } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConferenciaRepository(db);
      const { status, limit, cursor } = req.query;

      const parsedLimit = limit !== undefined ? Number(limit) : undefined;
      const result = await listConferencias(particularId, authContext, repo, {
        status: status as any,
        limit: parsedLimit,
        cursor: cursor ? String(cursor) : undefined,
      });

      if (!result.success) {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : result.code === 'INVALID_OPTIONS' ? 400 : 500;
        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      if (result.success && result.data?.items) {
        const items = result.data.items;
        const now = Date.now();
        await Promise.all(items.map(async (conf: any) => {
          const lastReconciled = conf.countsCache?.lastReconciledAt ? Date.parse(conf.countsCache.lastReconciledAt) : 0;
          if (!conf.countsCache || (now - lastReconciled > 15000)) {
            try {
              const counts = await recalculateConferenciaMemberCounts(db, conf.id);
              if (counts) {
                conf.countsCache = counts;
              }
            } catch (err) {
              console.error(`Erro ao atualizar countsCache em tempo real para ${conf.id}:`, err);
            }
          }
        }));
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao listar Conferências.');
    }
  });

  // 6. Criar Conferência vinculada ao Conselho Particular
  app.post('/api/conselhos-particulares/:particularId/conferencias', async (req: any, res) => {
    try {
      const { particularId } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConferenciaRepository(db);

      const result = await createConferencia(particularId, req.body, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'DUPLICATE_NAME' || result.code === 'PARTICULAR_SCOPE_MISMATCH' || result.code === 'INSTITUTION_SCOPE_MISMATCH' || result.code === 'PARENT_NOT_FOUND' || result.code === 'PARENT_INACTIVE' || result.code === 'PARENT_CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.status(201).json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao criar Conferência.');
    }
  });

  // 7. Atualizar Conferência
  app.put('/api/conselhos-particulares/:particularId/conferencias/:id', async (req: any, res) => {
    try {
      const { particularId, id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConferenciaRepository(db);

      const result = await updateConferencia(id, particularId, req.body, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'DUPLICATE_NAME' || result.code === 'IMMUTABLE_FIELD_MODIFIED' || result.code === 'PARTICULAR_SCOPE_MISMATCH' || result.code === 'INSTITUTION_SCOPE_MISMATCH' || result.code === 'PARENT_NOT_FOUND' || result.code === 'PARENT_INACTIVE' || result.code === 'PARENT_CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao atualizar Conferência.');
    }
  });

  // 8. Inativar Conferência
  app.post('/api/conselhos-particulares/:particularId/conferencias/:id/inativar', async (req: any, res) => {
    try {
      const { particularId, id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreConferenciaRepository(db);

      const result = await inactivateConferencia(id, particularId, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'ALREADY_INACTIVE' || result.code === 'ACTIVE_MEMBERS_EXIST' || result.code === 'INSTITUTION_SCOPE_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao inativar Conferência.');
    }
  });

  // 8b. Obter Dados de uma Conferência por ID
  app.get('/api/conferencias/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestoreConferenciaRepository(db);
      const conf = await repo.getById(id);
      if (!conf) {
        return res.status(404).json({ error: 'Conferência não encontrada.', code: 'CONFERENCIA_NOT_FOUND' });
      }

      return res.json(conf);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao buscar Conferência.');
    }
  });

  // 9. Listar Membros da Conferência
  app.get('/api/conferencias/:conferenciaId/membros', async (req: any, res) => {
    try {
      const { conferenciaId } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreMembroRepository(db);
      const { status, type } = req.query;

      const result = await listMembrosConferencia(conferenciaId, authContext, repo, {
        status: status as any,
        type: type as any,
      });

      if (!result.success) {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : result.code === 'CONFERENCIA_NOT_FOUND' ? 404 : 400;
        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao listar membros da Conferência.');
    }
  });

  // 10. Cadastrar Membro na Conferência
  app.post('/api/conferencias/:conferenciaId/membros', async (req: any, res) => {
    try {
      const { conferenciaId } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreMembroRepository(db);

      const result = await createMembroConferencia(conferenciaId, req.body, authContext, repo);

      if (!result.success || !result.data) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      let finalData = result.data;
      try {
        const { syncMemberUserAccess } = await import('./lib/membro_auth_helper');
        const syncRes = await syncMemberUserAccess(db, result.data, authContext.userId);
        if (syncRes.userId) {
          finalData = {
            ...result.data,
            userId: syncRes.userId,
            username: syncRes.username,
            hasAccess: syncRes.hasAccess,
            accessStatus: syncRes.accessStatus,
          };
        }
      } catch (syncErr) {
        console.error('Erro na sincronização de acesso do novo membro:', syncErr);
      }

      return res.status(201).json(finalData);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao cadastrar membro.');
    }
  });

  // 11. Atualizar Membro da Conferência
  app.put('/api/conferencias/:conferenciaId/membros/:id', async (req: any, res) => {
    try {
      const { conferenciaId, id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreMembroRepository(db);

      const result = await updateMembroConferencia(id, conferenciaId, req.body, authContext, repo);

      if (!result.success || !result.data) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'MEMBRO_NOT_FOUND' || result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      let finalData = result.data;
      try {
        const { syncMemberUserAccess } = await import('./lib/membro_auth_helper');
        const syncRes = await syncMemberUserAccess(db, result.data, authContext.userId);
        if (syncRes.userId) {
          finalData = {
            ...result.data,
            userId: syncRes.userId,
            username: syncRes.username,
            hasAccess: syncRes.hasAccess,
            accessStatus: syncRes.accessStatus,
          };
        }
      } catch (syncErr) {
        console.error('Erro na sincronização de acesso do membro atualizado:', syncErr);
      }

      return res.json(finalData);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao atualizar dados do membro.');
    }
  });

  // 12. Inativar Membro da Conferência
  app.post('/api/conferencias/:conferenciaId/membros/:id/inativar', async (req: any, res) => {
    try {
      const { conferenciaId, id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreMembroRepository(db);

      const result = await inactivateMembroConferencia(id, conferenciaId, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'MEMBRO_NOT_FOUND' || result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'ALREADY_INACTIVE' || result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao inativar membro.');
    }
  });

  // 13. Gestão Administrativa de Acesso do Membro (Gerar, Redefinir Senha, Bloquear, Desbloquear)
  app.post('/api/conferencias/:conferenciaId/membros/:id/access-action', async (req: any, res) => {
    try {
      const { conferenciaId, id } = req.params;
      const { action } = req.body;
      const authContext = await getServiceAuthContext(req);

      const { accessActionMembroConferencia } = await import('./lib/membro_service');
      const result = await accessActionMembroConferencia(id, conferenciaId, action, authContext, db);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'MEMBRO_NOT_FOUND' || result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json({ success: true, data: result.data });
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao executar ação de acesso do membro.');
    }
  });

  // --- REGULARIZAÇÃO EM LOTE DOS MEMBROS ANTIGOS (CARGA INICIAL - FASE 3) ---

  // 1. Prévia da Regularização (Somente Leitura)
  app.post('/api/membros/regularizacao-acessos/previa', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Autenticação necessária.' });
      }

      const isAdmin =
        req.user.accessLevel === 'administrador' ||
        req.user.accessLevel === 'super_admin' ||
        req.user.role === 'admin' ||
        req.user.isAdmin === true;

      if (!isAdmin) {
        return res.status(403).json({
          error: 'Acesso restrito ao administrador do Conselho Central.',
          code: 'FORBIDDEN',
        });
      }

      if (isUsingFallback || !activeDb || activeDb.constructor?.name === 'LocalDbFallback') {
        return res.status(503).json({
          error: 'Operação interrompida: a regularização de acessos só pode ser executada conectada ao Cloud Firestore oficial, sem uso de fallbacks locais.',
          code: 'FALLBACK_BLOCKED',
        });
      }

      const authContext = await getServiceAuthContext(req);
      const { previewMemberAccessRegularization } = await import('./lib/membro_auth_helper');
      const result = await previewMemberAccessRegularization(db, authContext.validatedCentralId);

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Erro ao gerar prévia da regularização.' });
      }

      return res.json(result);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao obter prévia da regularização de acessos.');
    }
  });

  // 2. Execução da Regularização em Lote (Idempotente)
  app.post('/api/membros/regularizacao-acessos/executar', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Autenticação necessária.' });
      }

      const isAdmin =
        req.user.accessLevel === 'administrador' ||
        req.user.accessLevel === 'super_admin' ||
        req.user.role === 'admin' ||
        req.user.isAdmin === true;

      if (!isAdmin) {
        return res.status(403).json({
          error: 'Acesso restrito ao administrador do Conselho Central.',
          code: 'FORBIDDEN',
        });
      }

      if (isUsingFallback || !activeDb || activeDb.constructor?.name === 'LocalDbFallback') {
        return res.status(503).json({
          error: 'Operação interrompida: a regularização de acessos só pode ser executada conectada ao Cloud Firestore oficial, sem uso de fallbacks locais.',
          code: 'FALLBACK_BLOCKED',
        });
      }

      const authContext = await getServiceAuthContext(req);
      const { executeMemberAccessRegularization } = await import('./lib/membro_auth_helper');
      const result = await executeMemberAccessRegularization(
        db,
        authContext.userId || req.user.id || 'admin',
        authContext.validatedCentralId
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Erro ao executar regularização de acessos.' });
      }

      return res.json(result);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao executar regularização de acessos.');
    }
  });


  // =========================================================================
  // --- ROTAS DO MÓDULO DE FAMÍLIAS ASSISTIDAS E SINDICÂNCIA SSVP ---
  // =========================================================================

  // 1. Listar Famílias de uma Conferência (ou filtrado por CP)
  app.get('/api/conferencias/:conferenciaId/familias', async (req: any, res) => {
    try {
      const { conferenciaId } = req.params;
      const { status, search, particularId } = req.query;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreFamiliaRepository(db);

      const result = await listFamiliasService(
        conferenciaId,
        authContext,
        repo,
        {
          status: status as any,
          search: search as string,
          particularId: particularId as string,
        }
      );

      if (!result.success) {
        const statusCode = result.code === 'UNAUTHORIZED' ? 403 : result.code === 'CONFERENCIA_NOT_FOUND' ? 404 : 400;
        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao listar famílias assistidas.');
    }
  });

  // 2. Cadastrar Nova Família com Ficha de Sindicância (1ª Visita)
  app.post('/api/conferencias/:conferenciaId/familias', async (req: any, res) => {
    try {
      const { conferenciaId } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreFamiliaRepository(db);

      const result = await createFamiliaService(conferenciaId, req.body, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.status(201).json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao cadastrar ficha de família assistida.');
    }
  });

  // 3. Atualizar Ficha de Sindicância / Dados da Família
  app.put('/api/familias/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreFamiliaRepository(db);

      const result = await updateFamiliaService(id, req.body, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'FAMILIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao atualizar dados da família assistida.');
    }
  });

  // 4. Arquivar Família
  app.post('/api/familias/:id/arquivar', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { motivo, detalhes } = req.body || {};
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreFamiliaRepository(db);

      const result = await archiveFamiliaService(id, motivo, detalhes, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'FAMILIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao arquivar família assistida.');
    }
  });

  // 5. Desarquivar Família
  app.post('/api/familias/:id/desarquivar', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreFamiliaRepository(db);

      const result = await unarchiveFamiliaService(id, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'FAMILIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao desarquivar família assistida.');
    }
  });

  // 6. Listar Visitas de uma Família
  app.get('/api/familias/:id/visitas', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Não autorizado.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestoreFamiliaRepository(db);
      const familia = await repo.getFamiliaById(id);
      if (!familia) {
        return res.status(404).json({ error: 'Família não encontrada.', code: 'FAMILIA_NOT_FOUND' });
      }
      if (familia.centralId && familia.centralId !== authContext.validatedCentralId) {
        return res.status(409).json({ error: 'Acesso negado a família de outro conselho.', code: 'CENTRAL_MISMATCH' });
      }
      if (!authContext.isAdmin && authContext.conferenciaId && familia.conferenciaId !== authContext.conferenciaId) {
        return res.status(403).json({ error: 'Acesso negado a visitas de família de outra Conferência.', code: 'UNAUTHORIZED' });
      }

      const visitas = await repo.listVisitasByFamilia(id);
      return res.json(visitas);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao listar histórico de visitas.');
    }
  });

  // 7. Registrar Nova Visita (com seleção de visitadores, entrega de cesta e comentários)
  app.post('/api/familias/:id/visitas', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      const repo = new FirestoreFamiliaRepository(db);

      const result = await createVisitaService(id, req.body, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'FAMILIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.status(201).json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao registrar visita à família.');
    }
  });

  // 8. Controle Mensal de Cestas por Conferência
  app.get('/api/conferencias/:conferenciaId/controle-cestas', async (req: any, res) => {
    try {
      const { conferenciaId } = req.params;
      const mesAno = (req.query.mesAno as string) || new Date().toISOString().substring(0, 7);
      const authContext = await getServiceAuthContext(req);

      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Não autorizado.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestoreFamiliaRepository(db);
      const conf = await repo.getConferenciaById(conferenciaId);
      if (!conf) {
        return res.status(404).json({ error: 'Conferência não encontrada.', code: 'CONFERENCIA_NOT_FOUND' });
      }
      if (conf.centralId && conf.centralId !== authContext.validatedCentralId) {
        return res.status(409).json({ error: 'Conferência pertence a outro conselho central.', code: 'CENTRAL_MISMATCH' });
      }

      if (!authContext.isAdmin && authContext.conferenciaId && conferenciaId !== authContext.conferenciaId) {
        return res.status(403).json({ error: 'Acesso negado ao controle de cestas de outra Conferência.', code: 'UNAUTHORIZED' });
      }

      const stats = await repo.getControleCestasMensal(conferenciaId, mesAno);
      return res.json(stats);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao obter controle mensal de cestas.');
    }
  });

  // --- Perfil Pessoal do Vicentino Autenticado (Meu Perfil) ---

  // 8b. Obter Perfil do Próprio Membro Autenticado
  app.get('/api/me/perfil-membro', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.userId) {
        return res.status(401).json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' });
      }

      const { getPerfilMembroAutenticado } = await import('./lib/membro_service');
      const result = await getPerfilMembroAutenticado(authContext, db);

      if (!result.success || !result.data) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 401;
        else if (result.code === 'MEMBRO_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 403;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao obter perfil do membro.');
    }
  });

  // 8c. Atualizar Dados Pessoais do Próprio Membro Autenticado
  app.put('/api/me/perfil-membro', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.userId) {
        return res.status(401).json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' });
      }

      const { updatePerfilMembroAutenticado } = await import('./lib/membro_service');
      const result = await updatePerfilMembroAutenticado(req.body, authContext, db);

      if (!result.success || !result.data) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 401;
        else if (result.code === 'MEMBRO_NOT_FOUND') statusCode = 404;
        else if (result.code === 'CENTRAL_MISMATCH') statusCode = 403;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json({ success: true, data: result.data });
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao atualizar perfil do membro.');
    }
  });

  // 8d. Verificar dinamicamente se o membro autenticado possui cargo de diretoria ativo
  app.get('/api/me/diretoria-conferencia', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' });
      }
      const membroId = req.user.membroId;
      if (!membroId) {
        return res.json({ isDirector: false, roles: [] });
      }

      const confId = req.user.conferenciaId || (req.query.conferenciaId as string);
      const { verifyMemberBoardRole } = await import('./lib/diretoria_helper');
      const boardInfo = await verifyMemberBoardRole(db, membroId, confId);
      return res.json(boardInfo);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao verificar cargo na diretoria.');
    }
  });

  // 8e. Obter dados estruturais iniciais da Conferência (Acesso restrito à Diretoria ativa)
  app.get('/api/conferencias/:conferenciaId/gestao-inicial', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' });
      }
      const { conferenciaId } = req.params;
      const cleanConfId = typeof conferenciaId === 'string' ? conferenciaId.trim() : '';
      if (!cleanConfId) {
        return res.status(400).json({ error: 'ID da Conferência é obrigatório.', code: 'MISSING_ID' });
      }

      const isAdmin =
        req.user.accessLevel === 'administrador' ||
        req.user.accessLevel === 'super_admin' ||
        req.user.role === 'TI / Gestão' ||
        req.user.role === 'admin' ||
        req.user.isAdmin === true;

      // Se não for administrador global, valida estritamente se o membro possui vínculo ativo de diretoria nesta conferência
      if (!isAdmin) {
        const membroId = req.user.membroId;
        if (!membroId) {
          return res.status(403).json({
            error: 'Acesso negado. Apenas membros com cargo ativo na diretoria desta Conferência podem acessar a gestão.',
            code: 'FORBIDDEN_NOT_BOARD_MEMBER'
          });
        }

        const { verifyMemberBoardRole } = await import('./lib/diretoria_helper');
        const boardInfo = await verifyMemberBoardRole(db, membroId, cleanConfId);

        if (!boardInfo.isDirector) {
          return res.status(403).json({
            error: 'Acesso negado. Apenas membros com cargo ativo na diretoria desta Conferência podem acessar a gestão.',
            code: 'FORBIDDEN_NOT_BOARD_MEMBER'
          });
        }
      }

      // Consulta os dados da conferência no banco de dados
      const confDoc = await safeQuery(async () => await db.collection('conferencias').doc(cleanConfId).get());
      if (!confDoc || !confDoc.exists) {
        return res.status(404).json({ error: 'Conferência não encontrada.', code: 'CONFERENCIA_NOT_FOUND' });
      }

      const confData = confDoc.data() || {};
      if (confData.status === 'inativa' || confData.archived === true) {
        return res.status(403).json({ error: 'Esta Conferência encontra-se inativa.', code: 'CONFERENCIA_INACTIVE' });
      }

      // Consulta nome do Conselho Particular pai para exibição informativa
      let particularNome = '';
      if (confData.particularId) {
        const cpDoc = await safeQuery(async () => await db.collection('conselhos_particulares').doc(confData.particularId).get());
        if (cpDoc && cpDoc.exists) {
          particularNome = cpDoc.data()?.name || '';
        }
      }

      // Retorna estritamente os dados estruturais da própria conferência (sem formulários de edição, financeiro ou estatísticas)
      return res.json({
        success: true,
        conferencia: {
          id: confDoc.id,
          name: confData.name || '',
          code: confData.code || '',
          status: confData.status || 'ativo',
          foundationDate: confData.foundationDate || '',
          aggregationDate: confData.aggregationDate || '',
          meetingDay: confData.meetingDay || '',
          meetingTime: confData.meetingTime || '',
          location: confData.location || '',
          addressStreet: confData.addressStreet || '',
          addressNumber: confData.addressNumber || '',
          addressComplement: confData.addressComplement || '',
          addressNeighborhood: confData.addressNeighborhood || '',
          addressCity: confData.addressCity || '',
          addressState: confData.addressState || 'SP',
          addressZip: confData.addressZip || '',
          fullAddress: confData.fullAddress || '',
          phone: confData.phone || '',
          email: confData.email || '',
          startDate: confData.startDate || '',
          endDate: confData.endDate || '',
          notes: confData.notes || '',
          particularId: confData.particularId || '',
          centralId: confData.centralId || '54.927.132/0001-92',
          diretoria: {
            presidente: confData.presidente || null,
            vicePresidente: confData.vicePresidente || null,
            secretario: confData.secretario || null,
            segundoSecretario: confData.segundoSecretario || null,
            tesoureiro: confData.tesoureiro || null,
            segundoTesoureiro: confData.segundoTesoureiro || null,
          }
        },
        particularNome,
        centralNome: 'Conselho Central de Jaboticabal'
      });
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao obter dados de gestão da Conferência.');
    }
  });

  // --- Endpoints para Formulário Público de Autocadastro de Membros ---

  // 13. Consultar Token Público do Conselho Central (Admin autenticado)
  app.get('/api/hierarchy/central/public-token', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await getCentralPublicTokenConfig(authContext.validatedCentralId, authContext, repo);

      if (!result.success) {
        return res.status(result.code === 'UNAUTHORIZED' ? 403 : 500).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao consultar token público.');
    }
  });

  // 14. Gerar / Regenerar Token Público do Conselho Central (Admin autenticado)
  app.post('/api/hierarchy/central/public-token/generate', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await generateOrRotateCentralPublicToken(authContext.validatedCentralId, authContext, repo);

      if (!result.success) {
        return res.status(result.code === 'UNAUTHORIZED' ? 403 : 500).json({ error: result.error, code: result.code });
      }

      return res.status(201).json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao gerar token público.');
    }
  });

  // 15. Revogar Token Público do Conselho Central (Admin autenticado)
  app.post('/api/hierarchy/central/public-token/revoke', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await revokeCentralPublicToken(authContext.validatedCentralId, authContext, repo);

      if (!result.success) {
        return res.status(result.code === 'UNAUTHORIZED' ? 403 : 500).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao revogar token público.');
    }
  });

  // 16. Consultar Estrutura Pública Hierárquica por Token (Público - sem login)
  app.get('/api/public/central/:token/structure', async (req: any, res) => {
    try {
      const { token } = req.params;
      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await getPublicHierarchyStructure(token, repo);

      if (!result.success) {
        const statusCode =
          result.code === 'TOKEN_NOT_FOUND' || result.code === 'TOKEN_REVOKED' ? 404 : 500;
        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao consultar estrutura do formulário.');
    }
  });

  // 17. Submeter Autocadastro de Membro (Público - sem login)
  app.post('/api/public/central/:token/submit', async (req: any, res) => {
    try {
      const { token } = req.params;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await submitPublicMemberRegistration(token, req.body, repo, {
        ip: String(clientIp),
        userAgent: String(userAgent),
      });

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'TOKEN_NOT_FOUND' || result.code === 'TOKEN_REVOKED') statusCode = 404;
        else if (result.code === 'PARTICULAR_NOT_FOUND' || result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (
          result.code === 'PARTICULAR_INACTIVE' ||
          result.code === 'CONFERENCIA_INACTIVE' ||
          result.code === 'HIERARCHY_MISMATCH'
        )
          statusCode = 409;
        else if (result.code === 'DUPLICATE_SUBMISSION_COOLDOWN' || result.code === 'RATE_LIMIT_EXCEEDED') statusCode = 429;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({
          error: result.error,
          code: result.code,
          errors: result.errors,
        });
      }

      // Se o membro foi criado automaticamente, recalcula os contadores da conferência
      if (result.data?.status === 'processado_automaticamente' && req.body?.conferenciaId) {
        try {
          await recalculateConferenciaMemberCounts(db, req.body.conferenciaId);
        } catch (recalcErr) {
          console.error('Erro ao recalcular contagem de membros após autocadastro público:', recalcErr);
        }
      }

      return res.status(201).json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao enviar cadastro de membro.');
    }
  });

  // 17b. Listagem pública de membros de uma Conferência para complementação de cadastro (Público - sem login)
  app.get('/api/public/central/:token/conferencias/:conferenciaId/membros', async (req: any, res) => {
    try {
      const { token, conferenciaId } = req.params;
      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await listPublicConferenciaMembers(token, conferenciaId, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'TOKEN_NOT_FOUND' || result.code === 'TOKEN_REVOKED' || result.code === 'CONFERENCIA_NOT_FOUND') {
          statusCode = 404;
        } else if (result.code === 'CONFERENCIA_INACTIVE') {
          statusCode = 409;
        } else if (result.code === 'STORAGE_ERROR') {
          statusCode = 500;
        }
        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao listar membros da conferência.');
    }
  });

  // 17c. Consulta pública dos detalhes mascarados do membro selecionado (Público - sem login)
  app.get('/api/public/central/:token/membros/:idOpaco/masked', async (req: any, res) => {
    try {
      const { token, idOpaco } = req.params;
      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await getPublicMemberMaskedDetails(token, idOpaco, repo);

      if (!result.success) {
        let statusCode = 400;
        if (
          result.code === 'TOKEN_NOT_FOUND' ||
          result.code === 'TOKEN_REVOKED' ||
          result.code === 'MEMBER_NOT_FOUND' ||
          result.code === 'SUBMISSION_NOT_FOUND'
        ) {
          statusCode = 404;
        } else if (result.code === 'INVALID_OPAQUE_TOKEN') {
          statusCode = 410; // Gone / Expirado
        } else if (result.code === 'STORAGE_ERROR') {
          statusCode = 500;
        }
        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao consultar detalhes do membro.');
    }
  });

  // 17d. Enviar solicitação de complementação / alteração cadastral de membro (Público - sem login)
  app.post('/api/public/central/:token/membros/:idOpaco/update-request', async (req: any, res) => {
    try {
      const { token, idOpaco } = req.params;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await submitPublicMemberUpdateRequest(token, idOpaco, req.body, repo, {
        ip: String(clientIp),
        userAgent: String(userAgent),
      });

      if (!result.success) {
        let statusCode = 400;
        if (
          result.code === 'TOKEN_NOT_FOUND' ||
          result.code === 'TOKEN_REVOKED' ||
          result.code === 'MEMBER_NOT_FOUND' ||
          result.code === 'SUBMISSION_NOT_FOUND' ||
          result.code === 'CONFERENCIA_NOT_FOUND'
        ) {
          statusCode = 404;
        } else if (result.code === 'INVALID_OPAQUE_TOKEN') {
          statusCode = 410;
        } else if (result.code === 'ALREADY_PENDING_UPDATE' || result.code === 'CONFERENCIA_INACTIVE') {
          statusCode = 409;
        } else if (result.code === 'RATE_LIMIT_EXCEEDED') {
          statusCode = 429;
        } else if (result.code === 'STORAGE_ERROR') {
          statusCode = 500;
        }

        return res.status(statusCode).json({
          error: result.error,
          code: result.code,
          errors: result.errors,
        });
      }

      return res.status(201).json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao enviar solicitação de atualização.');
    }
  });

  // 18. Listar Solicitações de Autocadastro (Admin / Conselho Central autenticado)
  app.get('/api/hierarchy/central/submissions', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const { status, particularId, conferenciaId } = req.query;
      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await listCentralMemberSubmissions(authContext.validatedCentralId, authContext, repo, {
        status: status as any,
        particularId: particularId ? String(particularId) : undefined,
        conferenciaId: conferenciaId ? String(conferenciaId) : undefined,
      });

      if (!result.success) {
        return res.status(result.code === 'UNAUTHORIZED' ? 403 : 500).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao listar solicitações de cadastro.');
    }
  });

  // 19. Checar Possíveis Duplicidades de Cadastro (Admin autenticado)
  app.post('/api/hierarchy/central/submissions/check-duplicates', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const { normalizedName, normalizedPhone, email } = req.body;
      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await checkSubmissionDuplicates(
        authContext.validatedCentralId,
        String(normalizedName || ''),
        String(normalizedPhone || ''),
        email ? String(email) : undefined,
        authContext,
        repo
      );

      if (!result.success) {
        return res.status(result.code === 'UNAUTHORIZED' ? 403 : 500).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao verificar duplicidades.');
    }
  });

  // 20. Aprovar Solicitação de Autocadastro de Membro (Admin autenticado)
  app.post('/api/hierarchy/central/submissions/:id/approve', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await approveMemberSubmission(
        id,
        authContext.validatedCentralId,
        authContext,
        repo,
        req.body?.correctedData || req.body
      );

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'SUBMISSION_NOT_FOUND' || result.code === 'PARTICULAR_NOT_FOUND' || result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'ALREADY_PROCESSED' || result.code === 'HIERARCHY_MISMATCH') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code, errors: result.errors });
      }

      // Recalcula contadores da conferência após aprovação bem-sucedida
      if (result.data?.submission?.conferenciaId) {
        try {
          await recalculateConferenciaMemberCounts(db, result.data.submission.conferenciaId);
        } catch (recalcErr) {
          console.error('Erro ao recalcular contagem de membros após aprovação:', recalcErr);
        }
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao aprovar solicitação de cadastro.');
    }
  });

  // 20b. Confirmar Cadastro e Enviar Diretamente para a Conferência (Forçar Criação/Atualização)
  app.post('/api/hierarchy/central/submissions/:id/confirm-send', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await confirmAndSendMemberSubmission(
        id,
        authContext.validatedCentralId,
        authContext,
        repo,
        req.body?.overrideData || req.body?.correctedData || req.body
      );

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'SUBMISSION_NOT_FOUND' || result.code === 'PARTICULAR_NOT_FOUND' || result.code === 'CONFERENCIA_NOT_FOUND') statusCode = 404;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      // Recalcula contadores da conferência após envio confirmado
      if (result.data?.conferenciaId) {
        try {
          await recalculateConferenciaMemberCounts(db, result.data.conferenciaId);
        } catch (recalcErr) {
          console.error('Erro ao recalcular contagem de membros após confirmação de envio:', recalcErr);
        }
      }

      return res.json({
        ...result.data,
        message: 'Cadastro confirmado e enviado para a Conferência com sucesso!',
      });
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao confirmar e enviar cadastro para a Conferência.');
    }
  });

  // 21. Recusar Solicitação de Autocadastro de Membro (Admin autenticado)
  app.post('/api/hierarchy/central/submissions/:id/reject', async (req: any, res) => {
    try {
      const { id } = req.params;
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const { reason } = req.body;
      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await rejectMemberSubmission(
        id,
        authContext.validatedCentralId,
        String(reason || ''),
        authContext,
        repo
      );

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'SUBMISSION_NOT_FOUND') statusCode = 404;
        else if (result.code === 'ALREADY_PROCESSED' || result.code === 'MISSING_REJECTION_REASON') statusCode = 409;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao recusar solicitação de cadastro.');
    }
  });

  // 21b. Executar Dry-Run Read-Only de Solicitações Pendentes (Admin autenticado)
  app.get('/api/hierarchy/central/submissions/dry-run', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await runLegacySubmissionsDryRun(authContext.validatedCentralId, authContext, repo);

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'CONFIG_ERROR') statusCode = 500;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      return res.json(result.data);
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao executar dry-run.');
    }
  });

  // 21c. Conciliação e Sincronização em Massa de Solicitações e Membros (Admin autenticado)
  app.post('/api/hierarchy/central/submissions/reconcile', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      if (!authContext.allowed || !authContext.validatedCentralId) {
        return res.status(403).json({ error: 'Operação não autorizada.', code: 'UNAUTHORIZED' });
      }

      const { conferenciaId } = req.body || {};
      const repo = new FirestorePublicRegistrationRepository(db);
      const result = await reconcileAndSyncPendingSubmissions(
        authContext.validatedCentralId,
        authContext,
        repo,
        { targetConferenciaId: conferenciaId ? String(conferenciaId) : undefined }
      );

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'UNAUTHORIZED') statusCode = 403;
        else if (result.code === 'CONFIG_ERROR') statusCode = 500;
        else if (result.code === 'STORAGE_ERROR') statusCode = 500;

        return res.status(statusCode).json({ error: result.error, code: result.code });
      }

      // Recalcula contadores de todas as conferências impactadas
      if (result.data?.conferenciasUpdated?.length) {
        for (const confId of result.data.conferenciasUpdated) {
          try {
            await recalculateConferenciaMemberCounts(db, confId);
          } catch (recalcErr) {
            console.error(`Erro ao recalcular contagem da conferência ${confId} após conciliação:`, recalcErr);
          }
        }
      }

      return res.json({
        ...result.data,
        message: `Conciliação concluída: ${result.data.syncedCount} membros criados/sincronizados, ${result.data.alreadyLinkedCount} já vinculados, ${result.data.conferenciasUpdated.length} conferências com contadores atualizados.`,
      });
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao conciliar solicitações de membros.');
    }
  });

  // 22. Importação Única e Idempotente da Estrutura 2026 (Exclusivo para Administrador do Conselho Central de Jaboticabal)
  app.post('/api/admin/importar-estrutura-2026', async (req: any, res) => {
    try {
      const authContext = await getServiceAuthContext(req);
      const user = req.user || {};
      const isAdmin = user.accessLevel === 'administrador' || user.role === 'admin' || user.isAdmin === true;

      // 1. Validação de perfil administrativo
      if (!isAdmin) {
        return res.status(403).json({
          error: 'Acesso negado. Apenas administradores podem executar esta operação.',
          code: 'FORBIDDEN_NOT_ADMIN',
        });
      }

      // 2. Resolução estrita do Conselho Central esperado (sem fallback silencioso)
      const expectedCentralDocId = await resolveExistingInstitutionDocId(EXPECTED_CNPJ);
      if (!expectedCentralDocId) {
        return res.status(500).json({
          error: `Conselho Central com CNPJ ${EXPECTED_CNPJ} não foi localizado no cadastro de instituições.`,
          code: 'CENTRAL_NOT_FOUND',
        });
      }

      // 3. Validação estrita do Conselho Central de Jaboticabal
      if (!authContext.allowed || authContext.validatedCentralId !== expectedCentralDocId) {
        return res.status(403).json({
          error: `Operação restrita ao Conselho Central de Jaboticabal (${EXPECTED_CNPJ}).`,
          code: 'FORBIDDEN_CENTRAL',
        });
      }

      // 4. Proibir e abortar imediatamente se estiver usando LocalDbFallback
      if (isUsingFallback || !db || (db as any)._isLocalFallback || typeof db.runTransaction !== 'function') {
        return res.status(500).json({
          error: 'Operação abortada: banco de dados remoto indisponível ou em modo fallback.',
          code: 'LOCAL_FALLBACK_PROHIBITED',
        });
      }

      // 5. Validação de projeto e banco ativo no Admin SDK
      const activeProjectId = firebaseConfig.projectId;
      const activeDatabaseId = firebaseConfig.firestoreDatabaseId;

      if (activeProjectId !== EXPECTED_PROJECT_ID || activeDatabaseId !== EXPECTED_DATABASE_ID) {
        return res.status(500).json({
          error: `Alvo do banco inválido. Esperado ${EXPECTED_PROJECT_ID}/${EXPECTED_DATABASE_ID}, ativo ${activeProjectId}/${activeDatabaseId}.`,
          code: 'INVALID_DATABASE_TARGET',
        });
      }

      // 6. Executar importação sem aceitar dados do cliente
      const result = await executeStructure2026Import(
        db,
        user.id || authContext.userId || 'admin-central',
        authContext.validatedCentralId,
        expectedCentralDocId,
        activeProjectId,
        activeDatabaseId
      );

      if (!result.success) {
        let statusCode = 400;
        if (result.code === 'MIGRATION_ALREADY_EXECUTED') statusCode = 409;
        else if (result.code === 'FORBIDDEN_CENTRAL' || result.code === 'FORBIDDEN_NOT_ADMIN') statusCode = 403;
        else if (result.code === 'LOCAL_FALLBACK_PROHIBITED' || result.code === 'INVALID_DATABASE_TARGET') statusCode = 500;
        else if (result.code === 'PARTIAL_IMPORT_ERROR') statusCode = 500;

        return res.status(statusCode).json({
          error: result.error,
          code: result.code,
          created: result.created,
          ignored: result.ignored,
          conflicts: result.conflicts,
          unimported: result.unimported,
          migrationCompletedAt: result.migrationCompletedAt,
        });
      }

      // Invalida o cache de consultas para refletir imediatamente os novos registros
      invalidateCache('conselhos_particulares');
      invalidateCache('conferencias');

      // Auditoria
      await logAudit(
        'IMPORT_STRUCTURE_2026',
        'HIERARCHY',
        expectedCentralDocId,
        req,
        expectedCentralDocId,
        'Importação única da estrutura 2026 executada com sucesso',
        {
          created: result.created,
          ignored: result.ignored,
          conflicts: result.conflicts,
          migrationCompletedAt: result.migrationCompletedAt,
        }
      );

      return res.json({
        success: true,
        message: 'Estrutura 2026 importada com sucesso no Firestore remoto.',
        projectId: result.projectId,
        databaseId: result.databaseId,
        created: result.created,
        ignored: result.ignored,
        conflicts: result.conflicts,
        unimported: result.unimported,
        migrationCompletedAt: result.migrationCompletedAt,
      });
    } catch (err: any) {
      return handleApiError(res, err, 'Erro ao executar importação da estrutura 2026.');
    }
  });

  // --- AI ASSISTANT (CONSULTIVO MULTI-MÓDULO POR INSTITUIÇÃO) ---
  app.get('/api/ai-assistant/status', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({
      active: hasKey,
      model: 'gemini-3.7-flash',
      message: hasKey 
        ? 'Assistente IA ativo e pronto para consultas.' 
        : 'Chave GEMINI_API_KEY não configurada no ambiente.'
    });
  });

  app.post('/api/ai-assistant/ask', async (req, res) => {
    try {
      const { question, history = [], institutionId } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Pergunta não informada.' });
      }

      const resolvedInstId = institutionId || (req as any).user?.institutionId || (req as any).user?.cnpj || (req.headers['x-institution-id'] as string) || '';

      if (!resolvedInstId) {
        return res.status(400).json({ error: 'Instituição não identificada na sessão.' });
      }

      // Verify and resolve institution
      let instDocData: any = null;

      try {
        const instDoc = await db.collection('institutions').doc(resolvedInstId).get();
        if (instDoc.exists) {
          instDocData = instDoc.data();
        } else {
          // Try search by CNPJ
          const cleanInst = resolvedInstId.replace(/[\.\-\/]/g, '');
          const snap = await db.collection('institutions').where('cnpj', '==', resolvedInstId).get();
          if (!snap.empty) {
            instDocData = snap.docs[0].data();
          } else {
            const snap2 = await db.collection('institutions').where('cnpj', '==', cleanInst).get();
            if (!snap2.empty) instDocData = snap2.docs[0].data();
          }
        }
      } catch (e) {
        console.warn('[AI Assistant] Could not fetch institution doc directly:', e);
      }

      const instName = instDocData?.name || instDocData?.fantasyName || instDocData?.razaoSocial || 'Instituição SSVP';

      // 1. Build knowledge snapshot of this institution's modules
      const knowledge = await buildInstitutionKnowledgeContext(db, resolvedInstId, instDocData);

      // 2. Call Gemini
      const answer = await askAiAssistant(question, history, knowledge, instName);

      return res.json({
        success: true,
        answer,
        institutionName: instName,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[AI Assistant Route Error]:', err);
      const isMissingKey = err?.message?.includes('GEMINI_API_KEY');
      return res.status(500).json({
        error: isMissingKey 
          ? 'A chave GEMINI_API_KEY não foi configurada no ambiente.' 
          : (err.message || 'Erro ao processar consulta com o Assistente IA.')
      });
    }
  });

  // Global Error Handler for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isDbUnavailableError(err)) {
      console.error('Database unavailable error caught in global handler:', err?.message || err);
      return res.status(503).json({
        error: 'DATABASE_TEMPORARILY_UNAVAILABLE',
        message: 'O banco de dados está temporariamente indisponível. Tente novamente em alguns minutos.'
      });
    }
    console.error('Uncaught API error:', err);
    res.status(err.status || 500).json({ error: 'Erro interno no servidor.' });
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
    process.exit(1);
  }
}

startServer();
