import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

const CANONICAL_MONTE_ALTO_ID = "52.853.397/0001-68";
const MONTE_ALTO_ALIASES = [
  "52.853.397/0001-68",
  "52853397000168",
  "ga6jzrx1flf",
  "52.384.815/0001-80",
  "52384815000180"
];

function isMonteAltoIdentifier(val: any): boolean {
  if (!val) return false;
  const str = String(val).toLowerCase();
  const clean = str.replace(/\D/g, "");
  return (
    str.includes("monte alto") ||
    str.includes("montealto") ||
    str.includes("ga6jzrx1flf") ||
    clean === "52853397000168" ||
    clean === "52384815000180"
  );
}

export async function executeMonteAltoUnificationMigration() {
  console.log("==========================================================================");
  console.log("=== EXECUTANDO MIGRAÇÃO & UNIFICAÇÃO TOTAL DOS DADOS DE MONTE ALTO ===");
  console.log("==========================================================================");

  let migratedCollectionsCount = 0;
  let totalDocsUpdated = 0;

  // 1. Unificar db_fallback.json
  const fallbackPath = "./db_fallback.json";
  if (fs.existsSync(fallbackPath)) {
    try {
      const raw = fs.readFileSync(fallbackPath, "utf-8");
      const data = JSON.parse(raw);
      let fallbackUpdatedCount = 0;

      for (const [colName, colVal] of Object.entries(data)) {
        if (Array.isArray(colVal)) {
          colVal.forEach((item: any) => {
            if (item && typeof item === "object") {
              let changed = false;
              if (item.institutionId && isMonteAltoIdentifier(item.institutionId) && item.institutionId !== CANONICAL_MONTE_ALTO_ID) {
                item.legacyInstitutionId = item.institutionId;
                item.institutionId = CANONICAL_MONTE_ALTO_ID;
                changed = true;
              }
              if (item.unitId && isMonteAltoIdentifier(item.unitId) && item.unitId !== CANONICAL_MONTE_ALTO_ID) {
                item.unitId = CANONICAL_MONTE_ALTO_ID;
                changed = true;
              }
              if (item.institutionIds && Array.isArray(item.institutionIds)) {
                if (item.institutionIds.some(isMonteAltoIdentifier) && !item.institutionIds.includes(CANONICAL_MONTE_ALTO_ID)) {
                  item.institutionIds.push(CANONICAL_MONTE_ALTO_ID);
                  changed = true;
                }
              }
              if (changed) fallbackUpdatedCount++;
            }
          });
        } else if (colVal && typeof colVal === "object") {
          for (const [docId, item] of Object.entries(colVal as Record<string, any>)) {
            if (item && typeof item === "object") {
              let changed = false;
              if (item.institutionId && isMonteAltoIdentifier(item.institutionId) && item.institutionId !== CANONICAL_MONTE_ALTO_ID) {
                item.legacyInstitutionId = item.institutionId;
                item.institutionId = CANONICAL_MONTE_ALTO_ID;
                changed = true;
              }
              if (item.unitId && isMonteAltoIdentifier(item.unitId) && item.unitId !== CANONICAL_MONTE_ALTO_ID) {
                item.unitId = CANONICAL_MONTE_ALTO_ID;
                changed = true;
              }
              if (item.institutionIds && Array.isArray(item.institutionIds)) {
                if (item.institutionIds.some(isMonteAltoIdentifier) && !item.institutionIds.includes(CANONICAL_MONTE_ALTO_ID)) {
                  item.institutionIds.push(CANONICAL_MONTE_ALTO_ID);
                  changed = true;
                }
              }
              if (changed) fallbackUpdatedCount++;
            }
          }
        }
      }

      // Garantir documento da instituição canônica em 'institutions'
      if (data.institutions) {
        data.institutions[CANONICAL_MONTE_ALTO_ID] = {
          id: CANONICAL_MONTE_ALTO_ID,
          name: "Lar São Vicente de Paulo de Monte Alto",
          cnpj: CANONICAL_MONTE_ALTO_ID,
          entityType: "obra_unida",
          type: "obra_unida",
          city: "Monte Alto",
          state: "SP",
          aliases: MONTE_ALTO_ALIASES
        };
        // Se existir doc antigo 'ga6jzrx1flf', sincroniza seu conteúdo para não haver divergência
        if (data.institutions["ga6jzrx1flf"]) {
          data.institutions["ga6jzrx1flf"] = {
            ...data.institutions["ga6jzrx1flf"],
            ...data.institutions[CANONICAL_MONTE_ALTO_ID],
            id: "ga6jzrx1flf",
            canonicalId: CANONICAL_MONTE_ALTO_ID
          };
        }
      }

      fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), "utf-8");
      console.log(`[FALLBACK MIGRAÇÃO] Concluída com sucesso! ${fallbackUpdatedCount} documentos atualizados para a unidade canônica.`);
      totalDocsUpdated += fallbackUpdatedCount;
    } catch (e: any) {
      console.error("[FALLBACK MIGRAÇÃO] Erro:", e.message);
    }
  }

  // 2. Unificar Firestore caso conectado
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
  }

  const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId || "(default)");

  const collectionsToMigrate = [
    "users",
    "residents",
    "candidates",
    "employees",
    "shifts",
    "sosProtocols",
    "procedure_logs",
    "meals",
    "jobCandidates",
    "amendment_categories",
    "amendment_grants",
    "global_visits",
    "registered_visitors",
    "support_messages",
    "agenda_events",
    "medication_stock_movements",
    "medication_administration_logs",
    "medication_inventory",
    "companions",
    "benefactors",
    "donation_categories",
    "finance_donations",
    "carnes",
    "muralMessages",
    "audit_logs",
    "evolutions",
    "prescriptions"
  ];

  for (const colName of collectionsToMigrate) {
    try {
      const snap = await db.collection(colName).get();
      if (snap.empty) continue;

      const batch = db.batch();
      let countInCol = 0;

      snap.docs.forEach(doc => {
        const data = doc.data();
        let needsUpdate = false;
        const updateData: any = {};

        if (data.institutionId && isMonteAltoIdentifier(data.institutionId) && data.institutionId !== CANONICAL_MONTE_ALTO_ID) {
          updateData.legacyInstitutionId = data.institutionId;
          updateData.institutionId = CANONICAL_MONTE_ALTO_ID;
          needsUpdate = true;
        }

        if (data.unitId && isMonteAltoIdentifier(data.unitId) && data.unitId !== CANONICAL_MONTE_ALTO_ID) {
          updateData.unitId = CANONICAL_MONTE_ALTO_ID;
          needsUpdate = true;
        }

        if (data.institutionIds && Array.isArray(data.institutionIds)) {
          if (data.institutionIds.some(isMonteAltoIdentifier) && !data.institutionIds.includes(CANONICAL_MONTE_ALTO_ID)) {
            updateData.institutionIds = [...data.institutionIds, CANONICAL_MONTE_ALTO_ID];
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          batch.set(doc.ref, updateData, { merge: true });
          countInCol++;
        }
      });

      if (countInCol > 0) {
        await batch.commit();
        console.log(`[FIRESTORE MIGRAÇÃO] Coleção [${colName}]: ${countInCol} documentos unificados com sucesso.`);
        totalDocsUpdated += countInCol;
        migratedCollectionsCount++;
      }
    } catch (e: any) {
      // Se não tiver permissão direta de admin sem service account, não trava o fallback
      console.log(`[FIRESTORE MIGRAÇÃO] Coleção [${colName}] pulada/inacessível: ${e.message}`);
    }
  }

  console.log(`=== MIGRAÇÃO CONCLUÍDA! Total de registros unificados: ${totalDocsUpdated} ===`);
  return { totalDocsUpdated };
}

// Executar se chamado diretamente
if (process.argv[1]?.includes("migrate_monte_alto")) {
  executeMonteAltoUnificationMigration().catch(console.error);
}
