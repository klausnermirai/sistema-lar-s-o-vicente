import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId || "(default)");

async function runDiagnosis() {
  console.log("=== INICIANDO DIAGNÓSTICO DO FIRESTORE PARA O USUÁRIO AILTON E BIOMETRIAS ===");
  console.log("Projeto:", firebaseConfig.projectId);
  console.log("Database ID:", firebaseConfig.firestoreDatabaseId);

  // 1. Inspecionar Coleção `users`
  console.log("\n--- 1. Usuários no Sistema (Buscando 'Ailton' ou cadastros em users) ---");
  const usersSnap = await db.collection("users").get();
  console.log(`Total de usuários encontrados: ${usersSnap.size}`);
  usersSnap.forEach((doc) => {
    const data = doc.data();
    const isAilton = (data.username && data.username.toLowerCase().includes("ailton")) ||
                     (data.fullName && data.fullName.toLowerCase().includes("ailton")) ||
                     (data.name && data.name.toLowerCase().includes("ailton")) ||
                     (data.email && data.email.toLowerCase().includes("ailton"));
    if (isAilton) {
      console.log(`\n>>> [AILTON ENCONTRADO EM USERS] Doc ID: ${doc.id}`);
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`- Usuário: ${doc.id} | username: ${data.username} | email: ${data.email} | fullName: ${data.fullName} | role: ${data.role || data.accessLevel} | instId: ${data.institutionId}`);
    }
  });

  // 2. Inspecionar Coleção `registered_visitors`
  console.log("\n--- 2. Coleção `registered_visitors` (Visitantes Cadastrados com/sem Biometria) ---");
  const regVisSnap = await db.collection("registered_visitors").get();
  console.log(`Total de documentos em registered_visitors: ${regVisSnap.size}`);
  regVisSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`- Doc ID: ${doc.id}`);
    console.log(`  Nome: ${d.name || d.visitorName}`);
    console.log(`  Instituição: ${d.institutionId}`);
    console.log(`  Tipo: ${d.type}`);
    console.log(`  Tem photoUrl: ${!!d.photoUrl} (tam: ${d.photoUrl?.length || 0})`);
    console.log(`  Tem faceDescriptor: ${!!d.faceDescriptor} (itens: ${d.faceDescriptor?.length || 0})`);
    console.log(`  Criado em: ${d.createdAt || 'N/A'} | Atualizado: ${d.updatedAt || 'N/A'}`);
    console.log(`  Arquivado: ${d.archived || false}`);
  });

  // 3. Inspecionar Coleção `global_visits`
  console.log("\n--- 3. Coleção `global_visits` (Histórico de Visitas e Entradas) ---");
  const visitsSnap = await db.collection("global_visits").orderBy("date", "desc").limit(30).get();
  console.log(`Total de visitas recentes consultadas: ${visitsSnap.size}`);
  visitsSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`- Visita ID: ${doc.id}`);
    console.log(`  Visitante: ${d.visitorName || d.name}`);
    console.log(`  Data: ${d.date} ${d.timeIn || ''}`);
    console.log(`  Instituição: ${d.institutionId}`);
    console.log(`  Tipo: ${d.type} | MatchedVia: ${d.matchedVia || 'manual'} | Confiança: ${d.facialConfidence || 'N/A'}`);
    console.log(`  Comentários: ${d.comments}`);
  });

  // 4. Inspecionar Coleção `audit_logs`
  console.log("\n--- 4. Coleção `audit_logs` (Últimas Ações e Operações) ---");
  try {
    const auditSnap = await db.collection("audit_logs").orderBy("timestamp", "desc").limit(50).get();
    console.log(`Total de logs de auditoria recentes: ${auditSnap.size}`);
    auditSnap.forEach((doc) => {
      const d = doc.data();
      console.log(`- [${d.timestamp || d.createdAt || 'N/A'}] Ação: ${d.action} | Recurso: ${d.resource || d.collection} | Usuário: ${d.userName || d.userEmail || d.userId} | Inst: ${d.institutionId} | Detalhe: ${d.details || d.description}`);
    });
  } catch (err: any) {
    console.log("Erro ao ler audit_logs:", err.message);
  }

  // 5. Inspecionar Parentes e Visitantes nos `residents`
  console.log("\n--- 5. Coleção `residents` (Verificando Parentes/Visitantes vinculados com biometria) ---");
  const residentsSnap = await db.collection("residents").get();
  console.log(`Total de residentes: ${residentsSnap.size}`);
  let totalRelativesFound = 0;
  let relativesWithFace = 0;
  residentsSnap.forEach((doc) => {
    const res = doc.data();
    if (Array.isArray(res.relatives)) {
      res.relatives.forEach((rel: any) => {
        totalRelativesFound++;
        if (rel.photoUrl || rel.faceDescriptor) {
          relativesWithFace++;
          console.log(`  [Familiar com biometria] Residente: ${res.name} | Parente: ${rel.name} (${rel.kinship}) | Foto: ${!!rel.photoUrl} | Descritor: ${!!rel.faceDescriptor} | Inst: ${res.institutionId}`);
        }
        if (rel.name && rel.name.toLowerCase().includes("ailton")) {
          console.log(`  [Ailton encontrado em parentes de ${res.name}]`, rel);
        }
      });
    }
  });
  console.log(`Total de parentes: ${totalRelativesFound}, com biometria facial: ${relativesWithFace}`);

  // 6. Inspecionar Coleção `membros`
  console.log("\n--- 6. Coleção `membros` (Membros de Conferências / Vicentinos) ---");
  const membrosSnap = await db.collection("membros").get();
  console.log(`Total de membros cadastrados: ${membrosSnap.size}`);
  membrosSnap.forEach((doc) => {
    const d = doc.data();
    if (d.name && d.name.toLowerCase().includes("ailton")) {
      console.log(`  [Ailton encontrado em membros] ID: ${doc.id}`, d);
    }
  });

  console.log("\n=== DIAGNÓSTICO CONCLUÍDO ===");
}

runDiagnosis().catch((err) => {
  console.error("Erro no script de diagnóstico:", err);
  process.exit(1);
});
