/**
 * Serviço Puro de Orquestração do Dry-Run de Migração da Hierarquia.
 * 
 * Regras Estritas:
 * - NENHUMA importação de Firebase, rotas, servidor ou banco direto.
 * - Injeção de dependências de leitura (LegacySettingsReader, ConselhoParticularReadRepository, ConferenciaReadRepository).
 * - NENHUM método ou operação de escrita (apenas leituras paginadas seguras).
 * - Exige ServiceAuthContext com allowed === true e validatedCentralId válido.
 * - Paginação segura respeitando tetos de 500 Conselhos e 2.500 Conferências.
 * - Aborta com HIERARCHY_LIMIT_EXCEEDED se os limites forem ultrapassados.
 * - Chama planHierarchyMigration e devolve exclusivamente o relatório higienizado via sanitizeHierarchyPlanForLogs.
 * - Define isBlocked = true se houver qualquer conflito bloqueante.
 * - migrationId determinístico: hierarchy-v1-{validatedCentralId}.
 * - Erros de leitura propagam STORAGE_ERROR sem expor detalhes internos e sem converter em lista vazia.
 */

import {
  ConselhoParticular,
  StandaloneConselhoParticular,
  StandaloneConferencia,
} from '../types.js';
import {
  planHierarchyMigration,
  sanitizeHierarchyPlanForLogs,
  HierarchyMigrationPlanResult,
} from './hierarchy_migration_planner.js';

export interface ServiceAuthContext {
  allowed?: boolean;
  validatedCentralId?: string;
  userId?: string;
}

export interface LegacySettingsReader {
  getLegacyConselhosParticulares(centralId: string): Promise<ConselhoParticular[] | null | undefined>;
}

export interface ConselhoParticularReadRepository {
  listByCentralId(
    centralId: string,
    options?: { status?: 'ativo' | 'inativo' | 'todos'; limit?: number; cursor?: string }
  ): Promise<{ items: StandaloneConselhoParticular[]; nextCursor?: string; hasMore: boolean }>;
}

export interface ConferenciaReadRepository {
  listByParticularId(
    expectedCentralId: string,
    particularId: string,
    options?: { status?: 'ativo' | 'inativo' | 'todos'; limit?: number; cursor?: string }
  ): Promise<{ items: StandaloneConferencia[]; nextCursor?: string; hasMore: boolean }>;
}

export interface HierarchyDryRunDependencies {
  legacySettingsReader: LegacySettingsReader;
  conselhoParticularRepository: ConselhoParticularReadRepository;
  conferenciaRepository: ConferenciaReadRepository;
}

export interface HierarchyDryRunData extends HierarchyMigrationPlanResult {
  isBlocked: boolean;
}

export interface HierarchyDryRunServiceResult {
  success: boolean;
  code: 'SUCCESS' | 'UNAUTHORIZED' | 'HIERARCHY_LIMIT_EXCEEDED' | 'STORAGE_ERROR';
  error?: string;
  isBlocked?: boolean;
  data?: HierarchyDryRunData;
}

export const MAX_SAFE_CONSELHOS_LIMIT = 500;
export const MAX_SAFE_CONFERENCIAS_LIMIT = 2500;
export const PAGE_SIZE_LIMIT = 100;

/**
 * Executa o dry-run da migração hierárquica em modo estritamente read-only.
 */
export async function runHierarchyMigrationDryRun(
  authContext: ServiceAuthContext,
  dependencies: HierarchyDryRunDependencies
): Promise<HierarchyDryRunServiceResult> {
  // 1. Validação estrita do Contexto Seguro de Autorização
  if (
    !authContext ||
    authContext.allowed !== true ||
    !authContext.validatedCentralId ||
    typeof authContext.validatedCentralId !== 'string' ||
    authContext.validatedCentralId.trim().length === 0
  ) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Contexto de autorização inválido ou ausente.',
    };
  }

  const cleanCentralId = authContext.validatedCentralId.trim();

  try {
    // 2. Leitura dos dados legados via dependência injetada
    const legacyData = await dependencies.legacySettingsReader.getLegacyConselhosParticulares(cleanCentralId);

    // 3. Leitura paginada de todos os Conselhos Particulares autônomos existentes
    const existingConselhos: StandaloneConselhoParticular[] = [];
    let cpCursor: string | undefined = undefined;

    while (true) {
      const cpPage = await dependencies.conselhoParticularRepository.listByCentralId(cleanCentralId, {
        status: 'todos',
        limit: PAGE_SIZE_LIMIT,
        cursor: cpCursor,
      });

      if (Array.isArray(cpPage?.items)) {
        existingConselhos.push(...cpPage.items);
      }

      if (existingConselhos.length > MAX_SAFE_CONSELHOS_LIMIT) {
        return {
          success: false,
          code: 'HIERARCHY_LIMIT_EXCEEDED',
          error: `O número de Conselhos Particulares cadastrados (${existingConselhos.length}) excedeu o limite máximo seguro de ${MAX_SAFE_CONSELHOS_LIMIT}.`,
        };
      }

      if (!cpPage?.hasMore || !cpPage?.nextCursor) {
        break;
      }
      cpCursor = cpPage.nextCursor;
    }

    // 4. Leitura paginada das Conferências autônomas para cada Conselho Particular
    const existingConferencias: StandaloneConferencia[] = [];

    for (const cp of existingConselhos) {
      if (!cp?.id) continue;
      const cleanCpId = cp.id.trim();
      let confCursor: string | undefined = undefined;

      while (true) {
        const confPage = await dependencies.conferenciaRepository.listByParticularId(
          cleanCentralId,
          cleanCpId,
          {
            status: 'todos',
            limit: PAGE_SIZE_LIMIT,
            cursor: confCursor,
          }
        );

        if (Array.isArray(confPage?.items)) {
          existingConferencias.push(...confPage.items);
        }

        if (existingConferencias.length > MAX_SAFE_CONFERENCIAS_LIMIT) {
          return {
            success: false,
            code: 'HIERARCHY_LIMIT_EXCEEDED',
            error: `O número de Conferências cadastradas (${existingConferencias.length}) excedeu o limite máximo seguro de ${MAX_SAFE_CONFERENCIAS_LIMIT}.`,
          };
        }

        if (!confPage?.hasMore || !confPage?.nextCursor) {
          break;
        }
        confCursor = confPage.nextCursor;
      }
    }

    // 5. Planejamento determinístico em memória
    const migrationId = `hierarchy-v1-${cleanCentralId}`;
    const rawPlan = planHierarchyMigration(
      legacyData,
      cleanCentralId,
      existingConselhos,
      existingConferencias,
      migrationId
    );

    // 6. Higienização para logs/resposta segura (LGPD)
    const sanitizedPlan = sanitizeHierarchyPlanForLogs(rawPlan);

    // 7. Determinar se a migração real está bloqueada por conflitos
    const hasConflicts =
      sanitizedPlan.totals.conflictConselhosCount > 0 ||
      sanitizedPlan.totals.conflictConferenciasCount > 0;

    return {
      success: true,
      code: 'SUCCESS',
      isBlocked: hasConflicts,
      data: {
        ...sanitizedPlan,
        isBlocked: hasConflicts,
      },
    };
  } catch (err: any) {
    // Nunca expor mensagens internas de driver e nunca converter erro em lista vazia
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: 'Erro de leitura ao consultar os dados para o planejamento da migração.',
    };
  }
}
