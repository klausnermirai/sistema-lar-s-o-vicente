import type { Firestore } from 'firebase-admin/firestore';
import { ConferenciaCountsCache, MembroSSVP, StandaloneConferencia } from '../types.ts';
import {
  MembroRepository,
  ListMembrosOptions,
} from './membro_service.ts';
import { syncMemberUserAccess } from './membro_auth_helper.ts';

/**
 * Recalcula de forma atômica a contagem de membros ativos da Conferência e atualiza o `countsCache`.
 */
export async function recalculateConferenciaMemberCounts(
  db: Firestore,
  conferenciaId: string
): Promise<ConferenciaCountsCache | null> {
  if (!conferenciaId || typeof conferenciaId !== 'string') return null;

  try {
    const snapshot = await db
      .collection('membros_ssvp')
      .where('conferenciaId', '==', conferenciaId)
      .where('status', '==', 'ativo')
      .get();

    let confrades = 0;
    let consocias = 0;
    let aspirantes = 0;
    let auxiliares = 0;

    snapshot.forEach((doc: any) => {
      const data = doc.data() as MembroSSVP;
      const type = (data.type || '').toLowerCase();
      if (type === 'confrade') {
        confrades++;
      } else if (type === 'consocia' || type === 'consócia') {
        consocias++;
      } else if (type === 'aspirante') {
        aspirantes++;
      } else if (type === 'auxiliar') {
        auxiliares++;
      } else {
        if (data.gender === 'feminino') {
          consocias++;
        } else {
          confrades++;
        }
      }
    });

    const totalMembros = confrades + consocias + aspirantes + auxiliares;
    const now = new Date().toISOString();

    const countsCache: ConferenciaCountsCache = {
      confrades,
      consocias,
      aspirantes,
      totalMembros,
      lastReconciledAt: now,
    };

    await db.collection('conferencias').doc(conferenciaId).set(
      {
        countsCache,
        updatedAt: now,
      },
      { merge: true }
    );

    return countsCache;
  } catch (err) {
    console.error(`Erro ao recalcular contagem de membros da conferência ${conferenciaId}:`, err);
    return null;
  }
}

export class FirestoreMembroRepository implements MembroRepository {
  constructor(private readonly db: Firestore) {}

  async getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null> {
    try {
      const docSnap = await this.db.collection('conferencias').doc(conferenciaId).get();
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

  async getById(id: string): Promise<MembroSSVP | null> {
    try {
      const docSnap = await this.db.collection('membros_ssvp').doc(id).get();
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

  async listByConferencia(conferenciaId: string, options?: ListMembrosOptions): Promise<MembroSSVP[]> {
    try {
      let query: any = this.db.collection('membros_ssvp').where('conferenciaId', '==', conferenciaId);

      if (options?.status && options.status !== 'todos') {
        query = query.where('status', '==', options.status);
      }

      if (options?.type && options.type !== 'todos') {
        query = query.where('type', '==', options.type);
      }

      const snapshot = await query.get();
      const items: MembroSSVP[] = [];

      snapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          items.push({
            ...data,
            id: doc.id,
          } as MembroSSVP);
        }
      });

      // Ordena alfabeticamente por nome completo
      items.sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR', { sensitivity: 'base' }));

      return items;
    } catch (err: any) {
      console.error('Erro ao listar membros no Firestore:', err);
      throw err;
    }
  }

  async create(membro: Omit<MembroSSVP, 'id'>): Promise<MembroSSVP> {
    const docRef = this.db.collection('membros_ssvp').doc();
    const payload = {
      ...membro,
      id: docRef.id,
    };
    await docRef.set(payload);

    // Sincroniza / cria usuário na coleção `users` automaticamente
    try {
      await syncMemberUserAccess(this.db, payload as MembroSSVP, membro.createdBy);
    } catch (err: any) {
      console.error('Erro ao sincronizar credencial de acesso do novo membro:', err);
      try {
        await docRef.set(
          {
            hasAccess: false,
            accessStatus: 'Erro na criação do acesso',
            accessErrorReason: err?.message || 'Falha técnica ao gerar usuário',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    }

    // Busca o documento atualizado (com userId, username e accessStatus gerados)
    const finalSnap = await docRef.get();
    const finalData = (finalSnap.exists ? { ...finalSnap.data(), id: finalSnap.id } : payload) as MembroSSVP;

    // Recalcula contadores da conferência imediatamente
    if (membro.conferenciaId) {
      await recalculateConferenciaMemberCounts(this.db, membro.conferenciaId);
    }

    return finalData;
  }

  async update(id: string, updates: Partial<MembroSSVP>): Promise<MembroSSVP> {
    const docRef = this.db.collection('membros_ssvp').doc(id);
    const oldSnap = await docRef.get();
    const oldData = oldSnap.exists ? oldSnap.data() : null;
    const oldConfId = oldData?.conferenciaId;

    await docRef.set(updates, { merge: true });
    const updatedSnap = await docRef.get();
    let updatedData = {
      ...updatedSnap.data(),
      id: updatedSnap.id,
    } as MembroSSVP;

    // Sincroniza o usuário correspondente se houver alteração de nome, data de nascimento, status, etc.
    try {
      await syncMemberUserAccess(this.db, updatedData, updates.updatedBy);
      const reSnap = await docRef.get();
      if (reSnap.exists) {
        updatedData = { ...reSnap.data(), id: reSnap.id } as MembroSSVP;
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar credencial de acesso na atualização do membro:', err);
      try {
        await docRef.set(
          {
            hasAccess: false,
            accessStatus: 'Erro na criação do acesso',
            accessErrorReason: err?.message || 'Falha técnica ao atualizar usuário',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        const errSnap = await docRef.get();
        if (errSnap.exists) {
          updatedData = { ...errSnap.data(), id: errSnap.id } as MembroSSVP;
        }
      } catch {}
    }

    // Recalcula contadores da nova conferência imediatamente
    if (updatedData.conferenciaId) {
      await recalculateConferenciaMemberCounts(this.db, updatedData.conferenciaId);
    }

    // Se mudou de conferência, atualiza os contadores da conferência anterior também
    if (oldConfId && oldConfId !== updatedData.conferenciaId) {
      await recalculateConferenciaMemberCounts(this.db, oldConfId);
    }

    return updatedData;
  }

  async inactivate(id: string, userId: string): Promise<MembroSSVP> {
    const docRef = this.db.collection('membros_ssvp').doc(id);
    const now = new Date().toISOString();
    const updates = {
      status: 'inativo',
      updatedAt: now,
      updatedBy: userId,
    };
    await docRef.set(updates, { merge: true });
    const updatedSnap = await docRef.get();
    let updatedData = {
      ...updatedSnap.data(),
      id: updatedSnap.id,
    } as MembroSSVP;

    // Inativa também o acesso do usuário na coleção `users`
    try {
      await syncMemberUserAccess(this.db, updatedData, userId);
      const reSnap = await docRef.get();
      if (reSnap.exists) {
        updatedData = { ...reSnap.data(), id: reSnap.id } as MembroSSVP;
      }
    } catch (err) {
      console.error('Erro ao sincronizar inativação do usuário do membro:', err);
    }

    // Recalcula contadores da conferência imediatamente
    if (updatedData.conferenciaId) {
      await recalculateConferenciaMemberCounts(this.db, updatedData.conferenciaId);
    }

    return updatedData;
  }
}
