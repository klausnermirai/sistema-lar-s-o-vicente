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

async function inspectDb() {
  console.log(`Conectando ao Firestore (${targetDbId})...`);
  
  // 1. Instituições
  const instSnap = await db.collection("institutions").get();
  console.log(`\n--- INSTITUIÇÕES (${instSnap.docs.length}) ---`);
  instSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | CNPJ: ${data.cnpj} | Nome: ${data.name} | Tipo: ${data.type}`);
  });

  // 2. Conselhos Particulares
  const cpSnap = await db.collection("conselhos_particulares").get();
  console.log(`\n--- CONSELHOS PARTICULARES (${cpSnap.docs.length}) ---`);
  cpSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | centralId: "${data.centralId}" | Nome: "${data.name}" | Status: ${data.status} | normalizedName: "${data.normalizedName}"`);
  });

  // 3. Conferências
  const confSnap = await db.collection("conferencias").get();
  console.log(`\n--- CONFERÊNCIAS (${confSnap.docs.length}) ---`);
  confSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | centralId: "${data.centralId}" | particularId: "${data.particularId}" | Nome: "${data.name}" | Status: ${data.status}`);
  });

  // 4. Usuários
  const usersSnap = await db.collection("users").get();
  console.log(`\n--- USUÁRIOS (${usersSnap.docs.length}) ---`);
  usersSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Username: ${data.username} | CNPJ: ${data.cnpj} | instId: ${data.institutionId} | hierarchy: ${JSON.stringify(data.hierarchy)}`);
  });
}

inspectDb().then(() => process.exit(0)).catch(err => {
  console.error("Erro na inspeção:", err);
  process.exit(1);
});
