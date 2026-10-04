import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };
import fs from 'fs';

async function checkAll() {
  console.log("Checando arquivos locais do fallback JSON...");
  const files = fs.readdirSync('.');
  const jsonDbFiles = files.filter(f => f.endsWith('.json') || f.includes('fallback') || f.includes('db'));
  console.log("Arquivos JSON na raiz:", jsonDbFiles);
  if (fs.existsSync('local_db.json')) {
    const content = JSON.parse(fs.readFileSync('local_db.json', 'utf8'));
    console.log("Coleções em local_db.json:", Object.keys(content));
    if (content.conselhos_particulares) {
      console.log("Conselhos Particulares em local_db.json:", content.conselhos_particulares);
    }
    if (content.institutions) {
      console.log("Instituições em local_db.json:", content.institutions);
    }
  }

  if (fs.existsSync('.local_db.json')) {
    const content = JSON.parse(fs.readFileSync('.local_db.json', 'utf8'));
    console.log("Coleções em .local_db.json:", Object.keys(content));
  }

  // Test (default) db
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
  }

  try {
    const defaultDb = getFirestore(admin.app(), "(default)");
    const snap = await defaultDb.collection("institutions").get();
    console.log("\n--- INSTITUIÇÕES NO (default) FIRESTORE ---", snap.docs.length);
    snap.docs.forEach(doc => {
      console.log(`ID: ${doc.id} | CNPJ: ${doc.data().cnpj} | Nome: ${doc.data().name}`);
    });
    const cpSnap = await defaultDb.collection("conselhos_particulares").get();
    console.log("\n--- CONSELHOS PARTICULARES NO (default) FIRESTORE ---", cpSnap.docs.length);
    cpSnap.docs.forEach(doc => {
      console.log(`ID: ${doc.id} | centralId: ${doc.data().centralId} | Nome: ${doc.data().name}`);
    });
  } catch (err: any) {
    console.log("Erro no (default) Firestore:", err.message);
  }
}

checkAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
