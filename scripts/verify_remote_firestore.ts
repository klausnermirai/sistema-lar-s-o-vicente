import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

async function verifyRemoteFirestore() {
  console.log("================================================================================");
  console.log(" VERIFICAÇÃO DE ACESSO AO FIRESTORE REMOTO");
  console.log("================================================================================");
  console.log(`Target ProjectId:  ${firebaseConfig.projectId}`);
  console.log(`Target DatabaseId: ${firebaseConfig.firestoreDatabaseId}`);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
  }

  const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

  try {
    console.log(`\nConsultando coleção 'conselhos_particulares' no banco ${firebaseConfig.firestoreDatabaseId}...`);
    const snap = await db.collection("conselhos_particulares").get();
    console.log(`✓ Conexão bem-sucedida! Documentos encontrados: ${snap.docs.length}`);
    return { ok: true, count: snap.docs.length };
  } catch (err: any) {
    console.error(`✗ Erro na conexão com o Firestore remoto: [Code: ${err.code}] ${err.message}`);
    if (err.details) console.error(`Detalhes: ${err.details}`);
    return { ok: false, error: err };
  }
}

verifyRemoteFirestore().then((res) => {
  if (!res.ok) process.exit(1);
  process.exit(0);
});
