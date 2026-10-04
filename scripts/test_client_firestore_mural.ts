import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkClientFirestore() {
  console.log("=== LENDO FIRESTORE VIA WEB SDK ===");
  try {
    const snap = await getDocs(collection(db, 'muralMessages'));
    console.log(`Total de documentos em muralMessages no Firestore Real: ${snap.size}`);
    snap.forEach(doc => {
      const d = doc.data();
      console.log(`- Doc ID: ${doc.id}`);
      console.log(`  institutionId: "${d.institutionId}"`);
      console.log(`  author: "${d.author}" | authorName: "${d.authorName}"`);
      console.log(`  timestamp: ${d.timestamp} (${new Date(d.timestamp?.toDate ? d.timestamp.toDate() : d.timestamp).toISOString()})`);
      console.log(`  text: "${d.text}"`);
      console.log(`  visibilidade:`, d.visibilidade);
      console.log(`  isPublic:`, d.isPublic);
      console.log("-----------------------------------------");
    });
  } catch (err: any) {
    console.error("Erro ao ler Firestore via Web SDK:", err);
  }
}

checkClientFirestore();
