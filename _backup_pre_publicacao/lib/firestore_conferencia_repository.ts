import crypto from 'node:crypto';
import type { Firestore, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { MembroSSVP, StandaloneConferencia, StandaloneConselhoParticular } from '../types.js';
import {
  ConferenciaRepository,
  ListConferenciasOptions,
  ListConferenciasRepositoryResult,
} from './conferencia_service.js';
import { sanitizeForFirestore } from './firestore_conselho_particular_repository.js';

/**
 * Gera o ID determinístico da trava de unicidade de nome da Conferência
 * utilizando o hash SHA-256 da chave canônica: conf|centralId|particularId|normalizedName
 */
function generateLockId(centralId: string, particularId: string, normalizedName: string): string {
  const canonicalKey = `conf|${centralId}|${particularId}|${normalizedName}`;
  return crypto.createHash('sha256').update(canonicalKey).digest('hex');
}

/**
 * Implementação do repositório de Conferências para Firestore Admin.
 * Recebe a instância do banco via injeção de dependência no construtor.
 */
export class FirestoreConferenciaRepository implements ConferenciaRepository {
  constructor(private readonly db: Firestore) {}

  /**
   * Busca um Conselho Particular pelo ID real do documento.
   */
  async getParticularById(particularId: string): Promise<StandaloneConselhoParticular | null> {
    try {
      const docSnap = await this.db.collection('conselhos_particulares').doc(particularId).get();
      if (!docSnap.exists) {
        return null;
      }
      const data = docSnap.data();
      if (!data) {
        return null;
      }
      return {
        ...data,
        id: docSnap.id,
      } as StandaloneConselhoParticular;
    } catch {
      return null;
    }
  }

  /**
   * Busca uma Conferência pelo ID real do documento.
   */
  async getById(id: string): Promise<StandaloneConferencia | null> {
    try {
      const docSnap = await this.db.collection('conferencias').doc(id).get();
      if (!docSnap.exists) {
        return null;
      }
      const data = docSnap.data();
      if (!data) {
        return null;
      }
      return {
        ...data,
        id: docSnap.id,
      } as StandaloneConferencia;
    } catch {
      return null;
    }
  }

  /**
   * Busca um Membro pelo ID real do documento para validação de vínculo.
   */
  async getMembroById(membroId: string): Promise<MembroSSVP | null> {
    try {
      const docSnap = await this.db.collection('membros_ssvp').doc(membroId).get();
      if (!docSnap.exists) {
        return null;
      }
      const data = docSnap.data();
      if (!data) {
        return null;
      }
      return {
        ...data,
        id: docSnap.id,
      } as MembroSSVP;
    } catch {
      return null;
    }
  }

  /**
   * Operação atômica que cria uma Conferência e sua trava determinística
   * de unicidade de nome dentro do Conselho Particular, revalidando o pai dentro da transação.
   */
  async createAtomically(
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ): Promise<{
    created: boolean;
    reason?: 'PARENT_NOT_FOUND' | 'PARENT_INACTIVE' | 'PARENT_CENTRAL_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }> {
    const parentRef = this.db.collection('conselhos_particulares').doc(expectedParticularId);
    const docRef = this.db.collection('conferencias').doc();
    const newId = docRef.id;
    const lockId = generateLockId(expectedCentralId, expectedParticularId, data.normalizedName);
    const lockRef = this.db.collection('hierarchy_unique_keys').doc(lockId);

    try {
      return await this.db.runTransaction(async (transaction) => {
        // 1. LEITURA do Conselho Particular pai dentro da transação
        const parentDoc = await transaction.get(parentRef);
        if (!parentDoc.exists) {
          return { created: false, reason: 'PARENT_NOT_FOUND' as const };
        }

        const parentData = parentDoc.data() as StandaloneConselhoParticular;
        if (parentData.centralId !== expectedCentralId) {
          return { created: false, reason: 'PARENT_CENTRAL_MISMATCH' as const };
        }

        if (parentData.status !== 'ativo') {
          return { created: false, reason: 'PARENT_INACTIVE' as const };
        }

        // 2. LEITURA da trava de unicidade de nome
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists) {
          return { created: false, reason: 'DUPLICATE_NAME' as const };
        }

        // TODAS AS LEITURAS FORAM REALIZADAS. INÍCIO DAS GRAVAÇÕES.
        const recordToSave: StandaloneConferencia = {
          ...data,
          id: newId,
          centralId: expectedCentralId,
          particularId: expectedParticularId,
        };

        const sanitizedRecord = sanitizeForFirestore(recordToSave);

        transaction.set(lockRef, {
          entityType: 'conferencia',
          entityId: newId,
          centralId: expectedCentralId,
          particularId: expectedParticularId,
          normalizedName: data.normalizedName,
        });

        transaction.set(docRef, sanitizedRecord);

        return { created: true, record: recordToSave };
      });
    } catch (error: any) {
      console.error(JSON.stringify({
        tag: 'HIERARCHY_STORAGE_ERROR',
        repository: 'FirestoreConferenciaRepository',
        operation: 'createAtomically',
        collection: 'conferencias',
        errorName: error?.name || 'Error',
        errorCode: error?.code ?? null,
        errorMessage: error?.message || String(error),
        errorDetails: error?.details ?? null,
        timestamp: new Date().toISOString(),
      }));
      return { created: false, reason: 'STORAGE_ERROR' as const };
    }
  }

  /**
   * Operação atômica que revalida escopo, status do Conselho Particular pai e unicidade de nome
   * e atualiza o registro preservando campos imutáveis.
   */
  async updateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    data: StandaloneConferencia
  ): Promise<{
    updated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'PARENT_INACTIVE' | 'PARENT_CENTRAL_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }> {
    const docRef = this.db.collection('conferencias').doc(id);
    const parentRef = this.db.collection('conselhos_particulares').doc(expectedParticularId);

    try {
      return await this.db.runTransaction(async (transaction) => {
        // 1. LEITURA do documento da Conferência atual
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists) {
          return { updated: false, reason: 'NOT_FOUND' as const };
        }

        const current = { ...(docSnap.data() as StandaloneConferencia), id: docSnap.id };

        // Validação de escopo institucional da Conferência
        if (current.centralId !== expectedCentralId || current.particularId !== expectedParticularId) {
          return { updated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
        }

        // 2. LEITURA do Conselho Particular pai
        const parentDoc = await transaction.get(parentRef);
        if (!parentDoc.exists || parentDoc.data()?.status !== 'ativo') {
          return { updated: false, reason: 'PARENT_INACTIVE' as const };
        }

        const parentData = parentDoc.data() as StandaloneConselhoParticular;
        if (parentData.centralId !== expectedCentralId) {
          return { updated: false, reason: 'PARENT_CENTRAL_MISMATCH' as const };
        }

        const oldLockId = generateLockId(current.centralId, current.particularId, current.normalizedName);
        const newLockId = generateLockId(expectedCentralId, expectedParticularId, data.normalizedName);
        const isNameChanged = oldLockId !== newLockId;

        let oldLockDocSnap: DocumentSnapshot | null = null;
        let newLockDocSnap: DocumentSnapshot | null = null;
        let oldLockRef: DocumentReference | null = null;
        let newLockRef: DocumentReference | null = null;

        // LEITURAS adicionais se o nome mudou
        if (isNameChanged) {
          newLockRef = this.db.collection('hierarchy_unique_keys').doc(newLockId);
          oldLockRef = this.db.collection('hierarchy_unique_keys').doc(oldLockId);

          newLockDocSnap = await transaction.get(newLockRef);
          oldLockDocSnap = await transaction.get(oldLockRef);

          // Se a nova trava existir para outro entityId, retornar DUPLICATE_NAME
          if (newLockDocSnap.exists) {
            const newLockData = newLockDocSnap.data();
            if (newLockData?.entityId !== id) {
              return { updated: false, reason: 'DUPLICATE_NAME' as const };
            }
          }

          // Se a trava antiga pertencer a outro registro, não remover e retornar STORAGE_ERROR
          if (oldLockDocSnap.exists) {
            const oldLockData = oldLockDocSnap.data();
            if (oldLockData?.entityId !== id) {
              return { updated: false, reason: 'STORAGE_ERROR' as const };
            }
          }
        }

        // TODAS AS LEITURAS FORAM REALIZADAS. INÍCIO DAS GRAVAÇÕES.

        if (isNameChanged) {
          // Remover a trava antiga somente se pertencer ao mesmo entityId
          if (oldLockDocSnap?.exists && oldLockRef) {
            const oldLockData = oldLockDocSnap.data();
            if (oldLockData?.entityId === id) {
              transaction.delete(oldLockRef);
            }
          }

          // Gravar a nova trava
          if (newLockRef) {
            transaction.set(newLockRef, {
              entityType: 'conferencia',
              entityId: id,
              centralId: expectedCentralId,
              particularId: expectedParticularId,
              normalizedName: data.normalizedName,
            });
          }
        }

        // Preservação estrita dos campos imutáveis: id, centralId, particularId, createdAt e createdBy
        const updatedRecord: StandaloneConferencia = {
          ...current,
          ...data,
          id: docSnap.id,
          centralId: current.centralId,
          particularId: current.particularId,
          createdAt: current.createdAt,
          createdBy: current.createdBy,
        };

        const sanitizedUpdatedRecord = sanitizeForFirestore(updatedRecord);

        transaction.set(docRef, sanitizedUpdatedRecord);

        return { updated: true, record: updatedRecord };
      });
    } catch {
      return { updated: false, reason: 'STORAGE_ERROR' as const };
    }
  }

  /**
   * Operação atômica que inativa a Conferência mantendo persistência física e preservando a trava de nome.
   * 
   * NOTA DE INTEGRAÇÃO FUTURA:
   * A verificação ACTIVE_MEMBERS_EXIST (verificando se existem confrades/consócias ativos vinculados
   * a esta conferência) deverá ser conectada aqui assim que o repositório/coleção real de membros for provisionado.
   */
  async inactivateAtomically(
    id: string,
    expectedCentralId: string,
    expectedParticularId: string,
    auditUserId: string
  ): Promise<{
    inactivated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'ALREADY_INACTIVE' | 'ACTIVE_MEMBERS_EXIST' | 'STORAGE_ERROR';
    record?: StandaloneConferencia;
  }> {
    const docRef = this.db.collection('conferencias').doc(id);

    try {
      return await this.db.runTransaction(async (transaction) => {
        // 1. LEITURA do registro
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists) {
          return { inactivated: false, reason: 'NOT_FOUND' as const };
        }

        const current = { ...(docSnap.data() as StandaloneConferencia), id: docSnap.id };

        if (current.centralId !== expectedCentralId || current.particularId !== expectedParticularId) {
          return { inactivated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
        }

        if (current.status === 'inativo') {
          return { inactivated: false, reason: 'ALREADY_INACTIVE' as const };
        }

        // NOTA: A coleção de membros ainda não existe nesta etapa.
        // A checagem de ACTIVE_MEMBERS_EXIST será conectada na etapa de membros.

        // TODAS AS LEITURAS FORAM REALIZADAS. INÍCIO DAS GRAVAÇÕES.
        const now = new Date().toISOString();
        const inactivatedRecord: StandaloneConferencia = {
          ...current,
          status: 'inativo',
          updatedAt: now,
          updatedBy: auditUserId,
        };

        const sanitizedInactivatedRecord = sanitizeForFirestore(inactivatedRecord);

        transaction.set(docRef, sanitizedInactivatedRecord);

        return { inactivated: true, record: inactivatedRecord };
      });
    } catch {
      return { inactivated: false, reason: 'STORAGE_ERROR' as const };
    }
  }

  /**
   * Lista Conferências pertencentes ao particularId e centralId informados.
   * Filtra simultaneamente por centralId e particularId, aplica filtro de status (se diferente de 'todos'),
   * ordena por normalizedName (asc) e pagina por cursor (startAfter) e limit + 1.
   */
  async listByParticularId(
    expectedCentralId: string,
    particularId: string,
    options?: ListConferenciasOptions
  ): Promise<ListConferenciasRepositoryResult> {
    const status = options?.status || 'ativo';
    const limit = options?.limit ?? 50;
    const cursor = options?.cursor;

    let query: any = this.db
      .collection('conferencias')
      .where('centralId', '==', expectedCentralId)
      .where('particularId', '==', particularId);

    if (status !== 'todos') {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('normalizedName', 'asc');

    if (cursor) {
      query = query.startAfter(cursor);
    }

    query = query.limit(limit + 1);

    const snapshot = await query.get();
    const docs = snapshot.docs || [];

    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    const items: StandaloneConferencia[] = resultDocs.map((doc: any) => ({
      ...(doc.data() as StandaloneConferencia),
      id: doc.id,
    }));

    const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
    const nextCursor = hasMore && lastItem ? lastItem.normalizedName : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}

