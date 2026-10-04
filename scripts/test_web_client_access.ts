import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

async function testWebClient() {
  console.log("Testando conexão via Firebase Client SDK (Web)...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  try {
    const colRef = collection(db, "conselhos_particulares");
    const snap = await getDocs(colRef);
    console.log(`✓ Sucesso via Web Client SDK! Documentos: ${snap.docs.length}`);
  } catch (err: any) {
    console.error(`✗ Erro via Web Client SDK: ${err.message}`);
  }
}

testWebClient().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
