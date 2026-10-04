import type { Firestore, Transaction } from 'firebase-admin/firestore';
import {
  ConselhoCentralPublicTokenConfig,
  SolicitacaoCadastroMembro,
  StandaloneConferencia,
  StandaloneConselhoParticular,
} from '../types.ts';
import {
  PublicRegistrationRepository,
  PublicRegistrationTransaction,
  ListSubmissionsOptions,
} from './public_member_registration_service.ts';
import { sanitizeForFirestore } from './firestore_sanitizer.ts';
import { recalculateConferenciaMemberCounts } from './firestore_membro_repository.ts';
import { syncMemberUserAccess } from './membro_auth_helper.ts';

export class FirestorePublicRegistrationRepository implements PublicRegistrationRepository {
  constructor(private readonly db: Firestore) {}

  async getCentralTokenConfig(token: string): Promise<ConselhoCentralPublicTokenConfig | null> {
    try {
      const snap = await this.db
        .collection('conselho_central_public_tokens')
        .where('token', '==', token)
        .limit(1)
        .get();

      if (snap.empty) {
        return null;
      }

      const doc = snap.docs[0];
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
      } as ConselhoCentralPublicTokenConfig;
    } catch (err) {
      console.error('Erro ao buscar token público no Firestore:', err);
      return null;
    }
  }

  async getCentralTokenConfigByCentralId(centralId: string): Promise<ConselhoCentralPublicTokenConfig | null> {
    try {
      const docSnap = await this.db.collection('conselho_central_public_tokens').doc(centralId).get();
      if (!docSnap.exists) {
        return null;
      }
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
      } as ConselhoCentralPublicTokenConfig;
    } catch (err) {
      console.error('Erro ao buscar config de token por centralId no Firestore:', err);
      return null;
    }
  }

  async saveCentralTokenConfig(config: ConselhoCentralPublicTokenConfig): Promise<void> {
    const sanitized = sanitizeForFirestore(config);
    await this.db.collection('conselho_central_public_tokens').doc(config.centralId).set(sanitized, { merge: true });
  }

  async getInstitution(centralId: string): Promise<{ id: string; name: string } | null> {
    try {
      const docSnap = await this.db.collection('institutions').doc(centralId).get();
      if (!docSnap.exists) {
        return null;
      }
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data?.name || 'Conselho Central SSVP',
      };
    } catch {
      return null;
    }
  }

  async listActiveParticulares(centralId: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const snap = await this.db
        .collection('conselhos_particulares')
        .where('centralId', '==', centralId)
        .where('status', '==', 'ativo')
        .get();

      const list: Array<{ id: string; name: string }> = [];
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          list.push({
            id: doc.id,
            name: data.name,
          });
        }
      });

      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
      return list;
    } catch (err) {
      console.error('Erro ao listar Conselhos Particulares ativos:', err);
      return [];
    }
  }

  async listActiveConferencias(centralId: string): Promise<Array<{ id: string; particularId: string; name: string }>> {
    try {
      const snap = await this.db
        .collection('conferencias')
        .where('centralId', '==', centralId)
        .where('status', '==', 'ativo')
        .get();

      const list: Array<{ id: string; particularId: string; name: string }> = [];
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          list.push({
            id: doc.id,
            particularId: data.particularId,
            name: data.name,
          });
        }
      });

      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
      return list;
    } catch (err) {
      console.error('Erro ao listar Conferências ativas:', err);
      return [];
    }
  }

  async getParticularById(particularId: string): Promise<StandaloneConselhoParticular | null> {
    try {
      const docSnap = await this.db.collection('conselhos_particulares').doc(particularId).get();
      if (!docSnap.exists) {
        return null;
      }
      return {
        ...docSnap.data(),
        id: docSnap.id,
      } as StandaloneConselhoParticular;
    } catch {
      return null;
    }
  }

  async getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null> {
    try {
      const docSnap = await this.db.collection('conferencias').doc(conferenciaId).get();
      if (!docSnap.exists) {
        return null;
      }
      return {
        ...docSnap.data(),
        id: docSnap.id,
      } as StandaloneConferencia;
    } catch {
      return null;
    }
  }

  async findRecentPendingSubmission(
    conferenciaId: string,
    normalizedName: string,
    normalizedPhone: string
  ): Promise<SolicitacaoCadastroMembro | null> {
    try {
      const snap = await this.db
        .collection('solicitacoes_cadastro_membros')
        .where('conferenciaId', '==', conferenciaId)
        .where('status', 'in', ['aguardando_aprovacao', 'aguardando_revisao_duplicidade'])
        .get();

      if (snap.empty) {
        return null;
      }

      for (const doc of snap.docs) {
        const data = doc.data() as SolicitacaoCadastroMembro;
        const nameMatch = data.normalizedName && data.normalizedName === normalizedName;
        const phoneMatch = normalizedPhone && data.normalizedPhone && data.normalizedPhone === normalizedPhone;

        if (nameMatch || phoneMatch) {
          return {
            ...data,
            id: doc.id,
          };
        }
      }

      return null;
    } catch (err) {
      console.error('Erro ao verificar duplicidade de submissão no Firestore:', err);
      return null;
    }
  }

  async createSubmission(
    submission: Omit<SolicitacaoCadastroMembro, 'id'> & { id?: string }
  ): Promise<SolicitacaoCadastroMembro> {
    const docRef = submission.id
      ? this.db.collection('solicitacoes_cadastro_membros').doc(submission.id)
      : this.db.collection('solicitacoes_cadastro_membros').doc();

    const record: SolicitacaoCadastroMembro = {
      ...submission,
      id: docRef.id,
    };

    const sanitized = sanitizeForFirestore(record);
    await docRef.set(sanitized);
    return record;
  }

  async getSubmissionById(id: string): Promise<SolicitacaoCadastroMembro | null> {
    try {
      const docSnap = await this.db.collection('solicitacoes_cadastro_membros').doc(id).get();
      if (!docSnap.exists) {
        return null;
      }
      return {
        ...docSnap.data(),
        id: docSnap.id,
      } as SolicitacaoCadastroMembro;
    } catch (err) {
      console.error('Erro ao buscar solicitação por ID no Firestore:', err);
      return null;
    }
  }

  async listSubmissions(centralId: string, options?: ListSubmissionsOptions): Promise<SolicitacaoCadastroMembro[]> {
    try {
      let query: any = this.db.collection('solicitacoes_cadastro_membros').where('centralId', '==', centralId);

      if (options?.status && options.status !== 'todos') {
        query = query.where('status', '==', options.status);
      }

      if (options?.particularId) {
        query = query.where('particularId', '==', options.particularId);
      }

      if (options?.conferenciaId) {
        query = query.where('conferenciaId', '==', options.conferenciaId);
      }

      const snap = await query.get();
      const list: SolicitacaoCadastroMembro[] = [];

      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          list.push({
            ...data,
            id: doc.id,
          } as SolicitacaoCadastroMembro);
        }
      });

      list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      return list;
    } catch (err) {
      console.error('Erro ao listar solicitações no Firestore:', err);
      return [];
    }
  }

  async updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>): Promise<SolicitacaoCadastroMembro> {
    const docRef = this.db.collection('solicitacoes_cadastro_membros').doc(id);
    const sanitized = sanitizeForFirestore(updates);
    await docRef.set(sanitized, { merge: true });

    const updatedSnap = await docRef.get();
    return {
      ...updatedSnap.data(),
      id: updatedSnap.id,
    } as SolicitacaoCadastroMembro;
  }

  async findExistingMembers(
    centralId: string,
    normalizedName: string,
    normalizedPhone?: string,
    email?: string
  ): Promise<
    Array<{ id: string; fullName: string; conferenciaId: string; conferenciaName?: string; phone: string; email?: string }>
  > {
    try {
      const snap = await this.db.collection('membros_ssvp').where('centralId', '==', centralId).get();

      if (snap.empty) {
        return [];
      }

      const matches: Array<{
        id: string;
        fullName: string;
        conferenciaId: string;
        conferenciaName?: string;
        phone: string;
        email?: string;
      }> = [];

      const cleanNormName = normalizedName.trim().toUpperCase();
      const cleanNormPhone = normalizedPhone ? normalizedPhone.replace(/\D/g, '').trim() : '';
      const cleanEmail = email ? email.trim().toLowerCase() : '';

      snap.forEach((doc: any) => {
        const data = doc.data();
        if (!data || data.status === 'inativo') return;

        const mNormName = (data.normalizedName || data.fullName || data.name || '').trim().toUpperCase();
        const mNormPhone = (data.normalizedPhone || (data.phone ? data.phone.replace(/\D/g, '') : '')).trim();
        const mEmail = (data.email || '').trim().toLowerCase();

        let isMatch = false;

        if (cleanNormName && mNormName && (cleanNormName === mNormName || mNormName.includes(cleanNormName))) {
          isMatch = true;
        }

        if (cleanNormPhone && mNormPhone && cleanNormPhone === mNormPhone) {
          isMatch = true;
        }

        if (cleanEmail && mEmail && cleanEmail === mEmail) {
          isMatch = true;
        }

        if (isMatch) {
          matches.push({
            id: doc.id,
            fullName: data.fullName || data.name || '',
            conferenciaId: data.conferenciaId || '',
            conferenciaName: data.conferenciaName,
            phone: data.phone || '',
            email: data.email,
          });
        }
      });

      return matches;
    } catch (err) {
      console.error('Erro ao buscar membros existentes para checagem de duplicidade:', err);
      return [];
    }
  }

  async createMembroRecord(membro: any): Promise<{ id: string }> {
    const docRef = this.db.collection('membros_ssvp').doc();
    const payload = {
      ...membro,
      id: docRef.id,
    };
    const sanitizedPayload = sanitizeForFirestore(payload);
    await docRef.set(sanitizedPayload);

    // Sincroniza / cria usuário na coleção `users` automaticamente
    try {
      await syncMemberUserAccess(this.db, payload, membro.createdBy);
    } catch (err) {
      console.error('Erro ao sincronizar credencial de acesso na aprovação do membro:', err);
    }

    return { id: docRef.id };
  }

  async listActiveMembersByConferencia(conferenciaId: string): Promise<Array<any>> {
    try {
      const snap = await this.db
        .collection('membros_ssvp')
        .where('conferenciaId', '==', conferenciaId)
        .where('status', '==', 'ativo')
        .get();

      const list: any[] = [];
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          list.push({
            ...data,
            id: doc.id,
          });
        }
      });
      return list;
    } catch (err) {
      console.error('Erro ao listar membros ativos da conferência:', err);
      return [];
    }
  }

  async listPendingSubmissionsByConferencia(conferenciaId: string): Promise<Array<SolicitacaoCadastroMembro>> {
    try {
      const snap = await this.db
        .collection('solicitacoes_cadastro_membros')
        .where('conferenciaId', '==', conferenciaId)
        .where('status', 'in', ['aguardando_aprovacao', 'aguardando_revisao_duplicidade'])
        .get();

      const list: SolicitacaoCadastroMembro[] = [];
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          list.push({
            ...data,
            id: doc.id,
          });
        }
      });
      return list;
    } catch (err) {
      console.error('Erro ao listar solicitações pendentes da conferência:', err);
      return [];
    }
  }

  async getMembroById(membroId: string): Promise<any | null> {
    try {
      const docSnap = await this.db.collection('membros_ssvp').doc(membroId).get();
      if (!docSnap.exists) {
        return null;
      }
      return {
        ...docSnap.data(),
        id: docSnap.id,
      };
    } catch (err) {
      console.error('Erro ao buscar membro por ID:', err);
      return null;
    }
  }

  async findPendingUpdateForTarget(
    targetType: 'membro' | 'submission',
    targetId: string
  ): Promise<SolicitacaoCadastroMembro | null> {
    try {
      const field = targetType === 'membro' ? 'targetMembroId' : 'targetSubmissionId';
      const snap = await this.db
        .collection('solicitacoes_cadastro_membros')
        .where(field, '==', targetId)
        .where('status', 'in', ['aguardando_aprovacao', 'parcialmente_processado', 'aguardando_revisao_duplicidade'])
        .limit(1)
        .get();

      if (snap.empty) {
        return null;
      }

      const doc = snap.docs[0];
      return {
        ...doc.data(),
        id: doc.id,
      } as SolicitacaoCadastroMembro;
    } catch (err) {
      console.error('Erro ao verificar atualização pendente para o alvo:', err);
      return null;
    }
  }

  async updateMembroRecord(membroId: string, updates: any): Promise<void> {
    const docRef = this.db.collection('membros_ssvp').doc(membroId);
    const sanitizedUpdates = sanitizeForFirestore(updates);
    await docRef.set(sanitizedUpdates, { merge: true });
  }

  async saveAuditLog(audit: any): Promise<void> {
    try {
      const docRef = this.db.collection('audit_logs').doc();
      const sanitized = sanitizeForFirestore({
        ...audit,
        id: docRef.id,
        timestamp: audit.timestamp || new Date().toISOString(),
      });
      await docRef.set(sanitized);
    } catch (err) {
      console.error('Erro ao registrar log de auditoria no Firestore:', err);
    }
  }

  async getRequestIdRecord(requestId: string): Promise<any | null> {
    try {
      const docSnap = await this.db.collection('public_registration_idempotency').doc(requestId).get();
      if (!docSnap.exists) return null;
      return docSnap.data()?.result || null;
    } catch {
      return null;
    }
  }

  async saveRequestIdRecord(requestId: string, result: any): Promise<void> {
    try {
      const docRef = this.db.collection('public_registration_idempotency').doc(requestId);
      const sanitized = sanitizeForFirestore({
        requestId,
        result,
        createdAt: new Date().toISOString(),
      });
      await docRef.set(sanitized, { merge: true });
    } catch (err) {
      console.error('Erro ao gravar idempotency record:', err);
    }
  }

  async getDedupKeyRecord(keyHash: string): Promise<{ membroId: string; type: string; createdAt: string } | null> {
    try {
      const docSnap = await this.db.collection('member_dedup_keys').doc(keyHash).get();
      if (!docSnap.exists) return null;
      const data = docSnap.data();
      return {
        membroId: data?.membroId,
        type: data?.type,
        createdAt: data?.createdAt,
      };
    } catch {
      return null;
    }
  }

  async saveDedupKeyRecord(
    keyHash: string,
    data: { membroId: string; type: string; createdAt: string }
  ): Promise<void> {
    try {
      const docRef = this.db.collection('member_dedup_keys').doc(keyHash);
      const sanitized = sanitizeForFirestore(data);
      await docRef.set(sanitized, { merge: true });
    } catch (err) {
      console.error('Erro ao gravar dedup key record:', err);
    }
  }

  async executeTransaction<T>(updateFunction: (txn: PublicRegistrationTransaction) => Promise<T>): Promise<T> {
    const self = this;
    const membersToSyncAfterTxn: Array<{ id: string; payload: any }> = [];

    const result = await this.db.runTransaction(async (firestoreTxn: Transaction) => {
      const txnWrapper: PublicRegistrationTransaction = {
        async getCentralTokenConfig(token: string) {
          return await self.getCentralTokenConfig(token);
        },
        async getRequestId(requestId: string) {
          const docRef = self.db.collection('public_registration_idempotency').doc(requestId);
          const docSnap = (await firestoreTxn.get(docRef as any)) as any;
          if (!docSnap.exists) return null;
          return docSnap.data()?.result || null;
        },
        async saveRequestId(requestId: string, result: any) {
          const docRef = self.db.collection('public_registration_idempotency').doc(requestId);
          firestoreTxn.set(docRef, sanitizeForFirestore({ requestId, result, createdAt: new Date().toISOString() }));
        },
        async getDedupKey(keyHash: string) {
          const docRef = self.db.collection('member_dedup_keys').doc(keyHash);
          const docSnap = (await firestoreTxn.get(docRef as any)) as any;
          if (!docSnap.exists) return null;
          const data = docSnap.data();
          return { membroId: data?.membroId, type: data?.type, createdAt: data?.createdAt };
        },
        async setDedupKey(keyHash: string, data: { membroId: string; type: string; createdAt: string }) {
          const docRef = self.db.collection('member_dedup_keys').doc(keyHash);
          firestoreTxn.set(docRef, sanitizeForFirestore(data));
        },
        async getParticularById(particularId: string) {
          const docRef = self.db.collection('conselhos_particulares').doc(particularId);
          const docSnap = (await firestoreTxn.get(docRef as any)) as any;
          if (!docSnap.exists) return null;
          return { ...docSnap.data(), id: docSnap.id } as StandaloneConselhoParticular;
        },
        async getConferenciaById(conferenciaId: string) {
          const docRef = self.db.collection('conferencias').doc(conferenciaId);
          const docSnap = (await firestoreTxn.get(docRef as any)) as any;
          if (!docSnap.exists) return null;
          return { ...docSnap.data(), id: docSnap.id } as StandaloneConferencia;
        },
        async getMembroById(membroId: string) {
          const docRef = self.db.collection('membros_ssvp').doc(membroId);
          const docSnap = (await firestoreTxn.get(docRef as any)) as any;
          if (!docSnap.exists) return null;
          return { ...docSnap.data(), id: docSnap.id };
        },
        async createMembroRecord(membro: any) {
          const docRef = self.db.collection('membros_ssvp').doc();
          const payload = { ...membro, id: docRef.id };
          firestoreTxn.set(docRef, sanitizeForFirestore(payload));
          membersToSyncAfterTxn.push({ id: docRef.id, payload });
          return { id: docRef.id };
        },
        async updateMembroRecord(membroId: string, updates: any) {
          const docRef = self.db.collection('membros_ssvp').doc(membroId);
          firestoreTxn.set(docRef, sanitizeForFirestore(updates), { merge: true });
        },
        async getSubmissionById(id: string) {
          const docRef = self.db.collection('solicitacoes_cadastro_membros').doc(id);
          const docSnap = (await firestoreTxn.get(docRef as any)) as any;
          if (!docSnap.exists) return null;
          return { ...docSnap.data(), id: docSnap.id } as SolicitacaoCadastroMembro;
        },
        async createSubmission(submission: any) {
          const docRef = submission.id
            ? self.db.collection('solicitacoes_cadastro_membros').doc(submission.id)
            : self.db.collection('solicitacoes_cadastro_membros').doc();
          const payload = { ...submission, id: docRef.id };
          firestoreTxn.set(docRef, sanitizeForFirestore(payload));
          return payload;
        },
        async updateSubmission(id: string, updates: Partial<SolicitacaoCadastroMembro>) {
          const docRef = self.db.collection('solicitacoes_cadastro_membros').doc(id);
          firestoreTxn.set(docRef, sanitizeForFirestore(updates), { merge: true });
          return { id, ...updates } as SolicitacaoCadastroMembro;
        },
        async saveAuditLog(audit: any) {
          const docRef = self.db.collection('audit_logs').doc();
          firestoreTxn.set(
            docRef,
            sanitizeForFirestore({ ...audit, id: docRef.id, timestamp: audit.timestamp || new Date().toISOString() })
          );
        },
      };

      return await updateFunction(txnWrapper);
    });

    // Pós-transação: sincronizar credenciais de usuário na coleção `users` para membros criados
    if (membersToSyncAfterTxn.length > 0) {
      for (const m of membersToSyncAfterTxn) {
        try {
          await syncMemberUserAccess(self.db, m.payload, m.payload.createdBy || 'system');
        } catch (syncErr) {
          console.error(`Erro ao sincronizar acesso do usuário pós-transação para membro ${m.id}:`, syncErr);
        }
      }
    }

    return result;
  }
}
