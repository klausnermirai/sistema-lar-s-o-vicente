import crypto from 'node:crypto';
import type { Firestore, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { StandaloneConselhoParticular } from '../types.js';
import {
  ConselhoParticularRepository,
  ListConselhosParticularesOptions,
  ListConselhosParticularesRepositoryResult,
} from './conselho_particular_service.js';
import { sanitizeForFirestore } from './firestore_sanitizer.js';

export { sanitizeForFirestore };

/**
 * Gera o ID da trava determinística de unicidade de nome do Conselho Particular
 * utilizando o hash SHA-256 da chave canônica: cp|centralId|normalizedName
 */
function generateLockId(centralId: string, normalizedName: string): string {
  const canonicalKey = `cp|${centralId}|${normalizedName}`;
  return crypto.createHash('sha256').update(canonicalKey).digest('hex');
}

/**
 * Implementação do repositório de Conselho Particular para Firestore Admin.
 * Recebe a instância do banco via injeção de dependência no construtor.
 */
export class FirestoreConselhoParticularRepository implements ConselhoParticularRepository {
  constructor(private readonly db: Firestore) {}

  /**
   * Operação atômica que cria um Conselho Particular e sua trava determinística
   * de unicidade de nome na mesma transação.
   */
  async createAtomically(data: StandaloneConselhoParticular): Promise<{
    created: boolean;
    reason?: 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }> {
    const docRef = this.db.collection('conselhos_particulares').doc();
    const newId = docRef.id;
    const lockId = generateLockId(data.centralId, data.normalizedName);
    const lockRef = this.db.collection('hierarchy_unique_keys').doc(lockId);

    try {
      return await this.db.runTransaction(async (transaction) => {
        // 1. LEITURA: Verificar se a trava já existe
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists) {
          return { created: false, reason: 'DUPLICATE_NAME' as const };
        }

        const recordToSave: StandaloneConselhoParticular = {
          ...data,
          id: newId,
        };

        const sanitizedRecord = sanitizeForFirestore(recordToSave);

        // 2. GRAVAÇÕES: Gravar trava e documento principal
        transaction.set(lockRef, {
          entityType: 'conselho_particular',
          entityId: newId,
          centralId: data.centralId,
          normalizedName: data.normalizedName,
        });

        transaction.set(docRef, sanitizedRecord);

        return { created: true, record: recordToSave };
      });
    } catch (error: any) {
      console.error(JSON.stringify({
        tag: 'HIERARCHY_STORAGE_ERROR',
        repository: 'FirestoreConselhoParticularRepository',
        operation: 'createAtomically',
        collection: 'conselhos_particulares',
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
   * Busca um Conselho Particular pelo ID real do documento.
   */
  async getById(id: string): Promise<StandaloneConselhoParticular | null> {
    try {
      const docSnap = await this.db.collection('conselhos_particulares').doc(id).get();
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
   * Operação atômica que revalida escopo e unicidade de nome e atualiza o registro.
   */
  async updateAtomically(
    id: string,
    expectedCentralId: string,
    data: StandaloneConselhoParticular
  ): Promise<{
    updated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'DUPLICATE_NAME' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }> {
    const docRef = this.db.collection('conselhos_particulares').doc(id);

    try {
      return await this.db.runTransaction(async (transaction) => {
        // 1. LEITURA do documento atual
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists) {
          return { updated: false, reason: 'NOT_FOUND' as const };
        }

        const current = { ...(docSnap.data() as StandaloneConselhoParticular), id: docSnap.id };

        // Validação de escopo institucional
        if (current.centralId !== expectedCentralId) {
          return { updated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
        }

        const oldLockId = generateLockId(current.centralId, current.normalizedName);
        const newLockId = generateLockId(expectedCentralId, data.normalizedName);
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
              entityType: 'conselho_particular',
              entityId: id,
              centralId: expectedCentralId,
              normalizedName: data.normalizedName,
            });
          }
        }

        const updatedRecord: StandaloneConselhoParticular = {
          ...current,
          ...data,
          id: docSnap.id,
          centralId: current.centralId,
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
   * Operação atômica que inativa o Conselho Particular, verificando ausência de Conferências ativas.
   * Não exclui o documento e mantém a trava do nome para evitar recriação duplicada.
   */
  async inactivateAtomically(
    id: string,
    expectedCentralId: string,
    auditUserId: string
  ): Promise<{
    inactivated: boolean;
    reason?: 'NOT_FOUND' | 'INSTITUTION_SCOPE_MISMATCH' | 'ALREADY_INACTIVE' | 'ACTIVE_CHILDREN_EXIST' | 'STORAGE_ERROR';
    record?: StandaloneConselhoParticular;
  }> {
    const docRef = this.db.collection('conselhos_particulares').doc(id);

    try {
      return await this.db.runTransaction(async (transaction) => {
        // 1. LEITURA do registro
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists) {
          return { inactivated: false, reason: 'NOT_FOUND' as const };
        }

        const current = { ...(docSnap.data() as StandaloneConselhoParticular), id: docSnap.id };

        if (current.centralId !== expectedCentralId) {
          return { inactivated: false, reason: 'INSTITUTION_SCOPE_MISMATCH' as const };
        }

        if (current.status === 'inativo') {
          return { inactivated: false, reason: 'ALREADY_INACTIVE' as const };
        }

        // 2. LEITURA de conferências ativas vinculadas (limit(1))
        const activeConferenciasQuery = this.db
          .collection('conferencias')
          .where('particularId', '==', id)
          .where('status', '==', 'ativo')
          .limit(1);

        const activeConferenciasSnap = await transaction.get(activeConferenciasQuery);
        if (!activeConferenciasSnap.empty) {
          return { inactivated: false, reason: 'ACTIVE_CHILDREN_EXIST' as const };
        }

        // TODAS AS LEITURAS FORAM REALIZADAS. INÍCIO DAS GRAVAÇÕES.
        const now = new Date().toISOString();
        const inactivatedRecord: StandaloneConselhoParticular = {
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
   * Lista Conselhos Particulares pertencentes ao Conselho Central informado.
   * Filtra por centralId e status (se diferente de 'todos'), ordena por normalizedName (asc)
   * e aplica paginação via startAfter(cursor) e limit + 1.
   */
  async listByCentralId(
    centralId: string,
    options?: ListConselhosParticularesOptions
  ): Promise<ListConselhosParticularesRepositoryResult> {
    const status = options?.status || 'ativo';
    const limit = options?.limit ?? 50;
    const cursor = options?.cursor;

    let query: any = this.db.collection('conselhos_particulares').where('centralId', '==', centralId);

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

    const items: StandaloneConselhoParticular[] = resultDocs.map((doc: any) => ({
      ...(doc.data() as StandaloneConselhoParticular),
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

