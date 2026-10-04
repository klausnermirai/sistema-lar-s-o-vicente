import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "db_fallback.json");

if (!fs.existsSync(DB_FILE)) {
  console.log("db_fallback.json não encontrado!");
  process.exit(1);
}

const raw = fs.readFileSync(DB_FILE, "utf-8");
const data = JSON.parse(raw);

console.log("=== ANÁLISE COMPLETA DO DB_FALLBACK.JSON ===");
console.log("Coleções presentes no banco:", Object.keys(data));

// 1. Verificar usuários
console.log("\n--- 1. USUÁRIOS (users) ---");
const users = data.users || {};
Object.entries(users).forEach(([id, u]: [string, any]) => {
  console.log(`ID: ${id} | Nome: ${u.fullName || u.name || 'Sem nome'} | Username: ${u.username} | Email: ${u.email} | Nível: ${u.accessLevel} | InstId: ${u.institutionId} | AllowedUnits: ${JSON.stringify(u.allowedUnits?.map((un: any) => un.name || un.id) || u.institutionIds || [])}`);
});

// 2. Procurar menção a "Ailton" em todo o banco
console.log("\n--- 2. PESQUISA GLOBAL POR 'AILTON' ---");
let occurrences: Array<{ collection: string; id: string; field: string; value: any }> = [];

function searchObj(obj: any, collection: string, docId: string, currentPath: string = "") {
  if (!obj) return;
  if (typeof obj === "string") {
    if (obj.toLowerCase().includes("ailton")) {
      occurrences.push({ collection, id: docId, field: currentPath, value: obj });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => searchObj(item, collection, docId, `${currentPath}[${index}]`));
  } else if (typeof obj === "object") {
    Object.entries(obj).forEach(([k, v]) => searchObj(v, collection, docId, currentPath ? `${currentPath}.${k}` : k));
  }
}

Object.entries(data).forEach(([collection, docs]: [string, any]) => {
  if (typeof docs === "object" && docs !== null) {
    Object.entries(docs).forEach(([docId, docData]) => {
      searchObj(docData, collection, docId);
    });
  }
});

console.log(`Total de ocorrências de 'Ailton' encontradas: ${occurrences.length}`);
occurrences.forEach(o => {
  console.log(`[${o.collection}] Doc: ${o.id} -> Campo: ${o.field} = "${o.value}"`);
});

// 3. Inspecionar `registered_visitors`
console.log("\n--- 3. REGISTERED_VISITORS ---");
const regVisitors = data.registered_visitors || {};
console.log(`Total de registered_visitors: ${Object.keys(regVisitors).length}`);
Object.entries(regVisitors).forEach(([id, v]: [string, any]) => {
  console.log(`- ID: ${id}`);
  console.log(`  Nome: ${v.name}`);
  console.log(`  Instituição: ${v.institutionId}`);
  console.log(`  Tipo: ${v.type}`);
  console.log(`  Tem photoUrl: ${!!v.photoUrl} (len: ${v.photoUrl?.length || 0})`);
  console.log(`  Tem faceDescriptor: ${!!v.faceDescriptor} (len: ${v.faceDescriptor?.length || 0})`);
  console.log(`  Criado em: ${v.createdAt} | Atualizado: ${v.updatedAt}`);
});

// 4. Inspecionar `global_visits`
console.log("\n--- 4. GLOBAL_VISITS ---");
const globalVisits = data.global_visits || {};
console.log(`Total de global_visits: ${Object.keys(globalVisits).length}`);
Object.entries(globalVisits).forEach(([id, v]: [string, any]) => {
  console.log(`- ID: ${id} | Visitante: ${v.visitorName || v.name} | Data: ${v.date} ${v.timeIn || ''} | MatchedVia: ${v.matchedVia} | Confiança: ${v.facialConfidence} | Inst: ${v.institutionId} | Obs: ${v.comments}`);
});

// 5. Inspecionar audit_logs
console.log("\n--- 5. AUDIT_LOGS RECENTES ---");
const auditLogs = data.audit_logs || {};
console.log(`Total de audit_logs: ${Object.keys(auditLogs).length}`);
Object.entries(auditLogs).slice(-15).forEach(([id, log]: [string, any]) => {
  console.log(`- [${log.timestamp || log.createdAt}] Ação: ${log.action} | Recurso: ${log.resource} | Usuário: ${log.userName || log.userEmail || log.userId} | Inst: ${log.institutionId} | Detalhes: ${log.details}`);
});

// 6. Verificar biometrias em residentes e familiares
console.log("\n--- 6. RESIDENTES E FAMILIARES COM BIOMETRIA ---");
const residents = data.residents || {};
let totalRel = 0;
let relFaces = 0;
Object.entries(residents).forEach(([id, res]: [string, any]) => {
  if (Array.isArray(res.relatives)) {
    res.relatives.forEach((rel: any) => {
      totalRel++;
      if (rel.photoUrl || rel.faceDescriptor) {
        relFaces++;
        console.log(`  [Familiar] Residente: ${res.name} | Parente: ${rel.name} | Foto: ${!!rel.photoUrl} | Descritor: ${!!rel.faceDescriptor}`);
      }
    });
  }
});
console.log(`Total de familiares: ${totalRel} | Familiares com biometria: ${relFaces}`);
