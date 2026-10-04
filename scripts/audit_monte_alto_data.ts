import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };
import fs from "fs";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

// Named db
const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
let db: any;
try {
  db = getFirestore(admin.app(), dbId);
} catch (e) {
  db = getFirestore();
}

async function auditAllMonteAltoData() {
  console.log("==========================================================================");
  console.log(`=== AUDITORIA COMPLETA DE DADOS: FIRESTORE DB [${dbId}] ===`);
  console.log("==========================================================================");

  // 1. Inspeciona db_fallback.json primeiro (dados locais)
  console.log("\n--- 1. ANÁLISE DO BANCO LOCAL / FALLBACK (db_fallback.json) ---");
  try {
    const rawFallback = fs.readFileSync("./db_fallback.json", "utf-8");
    const jsonFallback = JSON.parse(rawFallback);
    for (const [colName, colData] of Object.entries(jsonFallback)) {
      if (typeof colData === 'object' && colData !== null) {
        const items = Object.values(colData as any);
        const monteAltoItems = items.filter((item: any) => {
          const str = JSON.stringify(item).toLowerCase();
          return str.includes("monte alto") || str.includes("ga6jzrx1flf") || str.includes("52.853.397") || str.includes("52853397");
        });
        console.log(` -> Coleção local [${colName}]: Total de itens = ${items.length} | Relacionados a Monte Alto = ${monteAltoItems.length}`);
        if (monteAltoItems.length > 0 && items.length <= 10) {
          monteAltoItems.forEach((it: any) => {
            console.log(`    * [ID: ${it.id || it.name || 'sem_id'}] -> instId: ${it.institutionId || it.cnpj || 'n/a'}`);
          });
        }
      }
    }
  } catch (err: any) {
    console.error("Erro ao ler db_fallback.json:", err.message);
  }

  // 2. Inspeciona Firestore Remoto se acessível
  console.log("\n--- 2. ANÁLISE DO FIRESTORE EM NUVEM (Google Cloud Firestore) ---");
  const targetCollections = [
    "institutions",
    "users",
    "employees",
    "residents",
    "candidates",
    "muralMessages",
    "agenda",
    "settings",
    "stock_items",
    "stock_transactions",
    "evolutions",
    "prontuarios",
    "familias",
    "visitas",
    "membros_ssvp",
    "conferencias",
    "conselhos_particulares"
  ];

  for (const col of targetCollections) {
    try {
      const snap = await db.collection(col).get();
      const allDocs: any[] = [];
      snap.forEach((d: any) => allDocs.push({ id: d.id, ...d.data() }));

      const monteDocs = allDocs.filter(d => {
        const str = JSON.stringify(d).toLowerCase();
        return str.includes("monte alto") || str.includes("ga6jzrx1flf") || str.includes("52.853.397") || str.includes("52853397");
      });

      console.log(` -> Coleção Nuvem [${col}]: Total de docs = ${snap.size} | Docs de Monte Alto = ${monteDocs.length}`);
      if (monteDocs.length > 0) {
        monteDocs.slice(0, 5).forEach(d => {
          console.log(`    * Doc ID: [${d.id}] | Nome/Texto: [${d.name || d.fullName || d.text || d.title || 'n/a'}] | InstID: [${d.institutionId || d.cnpj || 'n/a'}]`);
        });
      }
    } catch (e: any) {
      console.log(` -> Coleção Nuvem [${col}]: Erro na consulta (${e.message})`);
    }
  }

  // 3. Verifica resolução de ID em server.ts para dados de Monte Alto
  console.log("\n--- 3. VERIFICAÇÃO DE RESOLUÇÃO DE DADOS EM server.ts ---");
  const monteAltoKeys = ["52.853.397/0001-68", "ga6jzrx1flf", "52853397000168"];
  console.log("Chaves analisadas:", monteAltoKeys);
}

auditAllMonteAltoData().catch(console.error);
