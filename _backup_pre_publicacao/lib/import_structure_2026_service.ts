import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreConselhoParticularRepository } from './firestore_conselho_particular_repository.js';
import { FirestoreConferenciaRepository } from './firestore_conferencia_repository.js';
import { createConselhoParticular, listConselhosParticulares, ServiceAuthContext } from './conselho_particular_service.js';
import { createConferencia, listConferencias } from './conferencia_service.js';
import { normalizeName } from './hierarchy_utils.js';
import { ESTRUTURA_2026_JABOTICABAL_DATA } from './structure_2026_data.js';

export const EXPECTED_CNPJ = '54.927.132/0001-92';
export const EXPECTED_PROJECT_ID = 'gen-lang-client-0385939707';
export const EXPECTED_DATABASE_ID = 'ai-studio-96d7e290-f55a-4798-a4ce-cf603c7fef85';
export const MIGRATION_DOC_PATH = '_migrations/estrutura_2026_jaboticabal';

export interface ImportStructure2026Result {
  success: boolean;
  code?: string;
  error?: string;
  projectId?: string;
  databaseId?: string;
  created: {
    cps: number;
    conferencias: number;
  };
  ignored: {
    cps: number;
    conferencias: number;
  };
  conflicts: {
    cps: number;
    conferencias: number;
  };
  unimported: Array<{ type: string; name: string; parent?: string; reason: string }>;
  migrationCompletedAt?: string;
}

/**
 * Executa a importação oficial única, estritamente controlada e idempotente
 * dos 6 Conselhos Particulares e 52 Conferências aprovadas para o Conselho Central de Jaboticabal.
 *
 * GARANTIAS DE SEGURANÇA E INTEGRIDADE:
 * 1. Não aceita dados externos do navegador.
 * 2. Valida projectId e databaseId estritamente contra as constantes oficiais.
 * 3. Aborta se for detectado fallback local.
 * 4. Valida se o marcador _migrations/estrutura_2026_jaboticabal já existe antes de iniciar.
 * 5. Utiliza as transações oficiais (createAtomically) que impedem qualquer sobrescrita.
 * 6. Somente grava o marcador de migração APÓS todos os registros serem processados com sucesso.
 * 7. Grava o identificador canônico expectedCentralDocId no campo centralId de todas as entidades.
 */
export async function executeStructure2026Import(
  db: Firestore,
  executorUserId: string,
  executorCentralId: string,
  expectedCentralDocId: string,
  activeProjectId: string,
  activeDatabaseId: string
): Promise<ImportStructure2026Result> {
  // 1. Validação estrita de escopo institucional do executor contra o identificador canônico
  if (!expectedCentralDocId || executorCentralId !== expectedCentralDocId) {
    return {
      success: false,
      code: 'FORBIDDEN_CENTRAL',
      error: `Operação restrita ao Conselho Central de Jaboticabal (ID canônico: ${expectedCentralDocId || 'não resolvido'}).`,
      created: { cps: 0, conferencias: 0 },
      ignored: { cps: 0, conferencias: 0 },
      conflicts: { cps: 0, conferencias: 0 },
      unimported: [],
    };
  }

  // 2. Validação estrita de projectId e databaseId do banco conectado
  if (activeProjectId !== EXPECTED_PROJECT_ID || activeDatabaseId !== EXPECTED_DATABASE_ID) {
    return {
      success: false,
      code: 'INVALID_DATABASE_TARGET',
      error: `Alvo do banco inválido. Esperado ${EXPECTED_PROJECT_ID} / ${EXPECTED_DATABASE_ID}, recebido ${activeProjectId} / ${activeDatabaseId}.`,
      created: { cps: 0, conferencias: 0 },
      ignored: { cps: 0, conferencias: 0 },
      conflicts: { cps: 0, conferencias: 0 },
      unimported: [],
    };
  }

  // 3. Validação anti-fallback local: verificar se o objeto Firestore é do Firebase Admin
  if ((db as any)._isLocalFallback || typeof db.runTransaction !== 'function') {
    return {
      success: false,
      code: 'LOCAL_FALLBACK_PROHIBITED',
      error: 'Uso de LocalDbFallback é estritamente proibido para esta operação.',
      created: { cps: 0, conferencias: 0 },
      ignored: { cps: 0, conferencias: 0 },
      conflicts: { cps: 0, conferencias: 0 },
      unimported: [],
    };
  }

  // 4. Verificação do Marcador Único de Migração
  const migrationRef = db.doc(MIGRATION_DOC_PATH);
  const migrationSnap = await migrationRef.get();
  if (migrationSnap.exists) {
    const data = migrationSnap.data() || {};
    return {
      success: false,
      code: 'MIGRATION_ALREADY_EXECUTED',
      error: `A migração da estrutura 2026 já foi executada em ${data.completedAt || 'data anterior'}.`,
      created: { cps: 0, conferencias: 0 },
      ignored: { cps: 0, conferencias: 0 },
      conflicts: { cps: 0, conferencias: 0 },
      unimported: [],
      migrationCompletedAt: data.completedAt,
    };
  }

  const authContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: expectedCentralDocId,
    userId: executorUserId,
  };

  const cpRepo = new FirestoreConselhoParticularRepository(db);
  const confRepo = new FirestoreConferenciaRepository(db);

  const stats = {
    cpsCreated: 0,
    cpsIgnored: 0,
    cpsConflict: 0,
    confCreated: 0,
    confIgnored: 0,
    confConflict: 0,
    unimported: [] as Array<{ type: string; name: string; parent?: string; reason: string }>,
  };

  // 6. Buscar CPs existentes para verificação idempotente sem duplicações
  const existingCpsResult = await listConselhosParticulares(authContext, cpRepo, { status: 'todos', limit: 100 });
  const existingCps = existingCpsResult.data?.items || [];
  const existingCpMap = new Map<string, any>();
  for (const cp of existingCps) {
    existingCpMap.set(cp.normalizedName, cp);
  }

  // 7. Processar cada Conselho Particular e suas Conferências
  for (const rawCp of ESTRUTURA_2026_JABOTICABAL_DATA) {
    const normCpName = normalizeName(rawCp.name);
    let targetCpRecord: any = null;

    if (existingCpMap.has(normCpName)) {
      targetCpRecord = existingCpMap.get(normCpName);
      stats.cpsIgnored++;
    } else {
      const cpPayload = {
        name: rawCp.name,
        city: rawCp.city,
        phone: rawCp.phone,
        email: rawCp.email,
        startDate: rawCp.startDate,
        endDate: rawCp.endDate,
        status: 'ativo' as const,
        presidente: {
          name: rawCp.presidenteName,
          phone: rawCp.presidentePhone,
        },
      };

      // Usa createConselhoParticular que executa db.runTransaction + createAtomically (sem sobrescrita)
      const resCp = await createConselhoParticular(cpPayload, authContext, cpRepo);
      if (resCp.success && resCp.data) {
        targetCpRecord = await cpRepo.getById(resCp.data.id);
        existingCpMap.set(normCpName, targetCpRecord);
        stats.cpsCreated++;
      } else {
        if (resCp.code === 'DUPLICATE_NAME') {
          stats.cpsConflict++;
        }
        stats.unimported.push({
          type: 'Conselho Particular',
          name: rawCp.name,
          reason: `${resCp.code}: ${resCp.error}`,
        });
        continue;
      }
    }

    if (!targetCpRecord || !targetCpRecord.id) {
      stats.unimported.push({
        type: 'Conselho Particular',
        name: rawCp.name,
        reason: 'TARGET_CP_ID_NOT_RESOLVED',
      });
      continue;
    }

    // Listar Conferências existentes sob este CP para verificação idempotente
    const existingConfResult = await listConferencias(targetCpRecord.id, authContext, confRepo, { status: 'todos', limit: 100 });
    const existingConfs = existingConfResult.data?.items || [];
    const existingConfMap = new Map<string, any>();
    for (const conf of existingConfs) {
      existingConfMap.set(conf.normalizedName, conf);
    }

    for (const rawConf of rawCp.conferencias) {
      const normConfName = normalizeName(rawConf.name);

      if (existingConfMap.has(normConfName)) {
        stats.confIgnored++;
      } else {
        const confPayload = {
          name: rawConf.name,
          status: 'ativo' as const,
        };

        // Usa createConferencia que executa db.runTransaction + createAtomically (sem sobrescrita)
        const resConf = await createConferencia(targetCpRecord.id, confPayload, authContext, confRepo);
        if (resConf.success && resConf.data) {
          const createdConf = await confRepo.getById(resConf.data.id);
          existingConfMap.set(normConfName, createdConf);
          stats.confCreated++;
        } else {
          if (resConf.code === 'DUPLICATE_NAME') {
            stats.confConflict++;
          }
          stats.unimported.push({
            type: 'Conferência',
            name: rawConf.name,
            parent: rawCp.name,
            reason: `${resConf.code}: ${resConf.error}`,
          });
        }
      }
    }
  }

  // 8. Somente gravar o marcador se todos os 6 CPs e 52 Conferências foram processados com sucesso
  // (nenhum registro na lista unimported)
  if (stats.unimported.length === 0) {
    const completedAt = new Date().toISOString();
    await migrationRef.create({
      id: 'estrutura_2026_jaboticabal',
      completedAt,
      executorUserId,
      executorCentralId: expectedCentralDocId,
      centralDocId: expectedCentralDocId,
      centralCnpj: EXPECTED_CNPJ,
      projectId: activeProjectId,
      databaseId: activeDatabaseId,
      stats: {
        cpsCreated: stats.cpsCreated,
        cpsIgnored: stats.cpsIgnored,
        cpsConflict: stats.cpsConflict,
        confCreated: stats.confCreated,
        confIgnored: stats.confIgnored,
        confConflict: stats.confConflict,
      },
    });

    return {
      success: true,
      projectId: activeProjectId,
      databaseId: activeDatabaseId,
      created: {
        cps: stats.cpsCreated,
        conferencias: stats.confCreated,
      },
      ignored: {
        cps: stats.cpsIgnored,
        conferencias: stats.confIgnored,
      },
      conflicts: {
        cps: stats.cpsConflict,
        conferencias: stats.confConflict,
      },
      unimported: [],
      migrationCompletedAt: completedAt,
    };
  }

  // Se houve alguma falha não importada, NÃO cria o marcador para permitir correção e recuperação idempotente
  return {
    success: false,
    code: 'PARTIAL_IMPORT_ERROR',
    error: `Importação incompleta: ${stats.unimported.length} registro(s) não puderam ser importados. O marcador de migração NÃO foi criado.`,
    projectId: activeProjectId,
    databaseId: activeDatabaseId,
    created: {
      cps: stats.cpsCreated,
      conferencias: stats.confCreated,
    },
    ignored: {
      cps: stats.cpsIgnored,
      conferencias: stats.confIgnored,
    },
    conflicts: {
      cps: stats.cpsConflict,
      conferencias: stats.confConflict,
    },
    unimported: stats.unimported,
  };
}
