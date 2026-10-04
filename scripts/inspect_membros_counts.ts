import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

const targetDbId = firebaseConfig.firestoreDatabaseId || "(default)";
const db = getFirestore(admin.app(), targetDbId);

async function inspectMembrosAndCounts() {
  console.log(`Conectando ao Firestore (${targetDbId})...`);

  // 1. Fetch all conferences
  const confSnap = await db.collection("conferencias").get();
  console.log(`\n--- CONFERÊNCIAS (${confSnap.docs.length}) ---`);
  const confMap = new Map();
  confSnap.docs.forEach(doc => {
    const data = doc.data();
    confMap.set(doc.id, data.name);
    console.log(`ID: ${doc.id} | Nome: "${data.name}" | Status: ${data.status}`);
    console.log(`  legacyCounts: ${JSON.stringify(data.legacyCounts)}`);
    console.log(`  countsCache: ${JSON.stringify(data.countsCache)}`);
  });

  // 2. Fetch all members
  const memSnap = await db.collection("membros_ssvp").get();
  console.log(`\n--- MEMBROS (${memSnap.docs.length}) ---`);
  memSnap.docs.forEach(doc => {
    const data = doc.data();
    const confName = confMap.get(data.conferenciaId) || "NÃO ENCONTRADA";
    console.log(`ID: ${doc.id} | Nome: "${data.fullName}" | ConferenciaID: "${data.conferenciaId}" (${confName}) | Status: "${data.status}" | Type: "${data.type}" | Gender: "${data.gender}"`);
  });
}

inspectMembrosAndCounts().then(() => process.exit(0)).catch(err => {
  console.error("Erro na inspeção:", err);
  process.exit(1);
});
