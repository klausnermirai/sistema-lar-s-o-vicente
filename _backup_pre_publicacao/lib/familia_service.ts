/**
 * Serviço de Backend e Repositório para Famílias Assistidas e Visitas SSVP
 */

import {
  FamiliaAssistidaCompleta,
  FichaSindicanciaData,
  VisitaFamiliaSSVP,
  ControleCestasMensalStats,
  StandaloneConferencia,
} from '../types.ts';

export interface ServiceAuthContext {
  allowed?: boolean;
  validatedCentralId?: string;
  userId?: string;
  institutionId?: string;
  isAdmin?: boolean;
  conferenciaId?: string;
  particularId?: string;
  accessLevel?: string;
  role?: string;
}

export interface ListFamiliasOptions {
  status?: 'ativo' | 'arquivado' | 'todos';
  search?: string;
  particularId?: string;
}

export interface ServiceResult<T> {
  success: boolean;
  code:
    | 'SUCCESS'
    | 'UNAUTHORIZED'
    | 'MISSING_CONFERENCIA_ID'
    | 'MISSING_FAMILIA_ID'
    | 'CONFERENCIA_NOT_FOUND'
    | 'CENTRAL_MISMATCH'
    | 'FAMILIA_NOT_FOUND'
    | 'VISITA_NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'STORAGE_ERROR';
  error?: string;
  data?: T;
}

export interface FamiliaRepository {
  getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null>;
  getFamiliaById(id: string): Promise<FamiliaAssistidaCompleta | null>;
  listFamiliasByConferencia(conferenciaId: string, options?: ListFamiliasOptions): Promise<FamiliaAssistidaCompleta[]>;
  createFamilia(data: Omit<FamiliaAssistidaCompleta, 'id'>): Promise<FamiliaAssistidaCompleta>;
  updateFamilia(id: string, updates: Partial<FamiliaAssistidaCompleta>): Promise<FamiliaAssistidaCompleta>;
  
  // Visitas
  listVisitasByFamilia(familiaId: string): Promise<VisitaFamiliaSSVP[]>;
  createVisita(visita: Omit<VisitaFamiliaSSVP, 'id'>): Promise<VisitaFamiliaSSVP>;
  deleteVisita(familiaId: string, visitaId: string): Promise<boolean>;

  // Controle Mensal de Cestas
  getControleCestasMensal(conferenciaId: string, mesAno: string): Promise<ControleCestasMensalStats>;
}

export class FirestoreFamiliaRepository implements FamiliaRepository {
  private db: FirebaseFirestore.Firestore;

  constructor(db: FirebaseFirestore.Firestore) {
    this.db = db;
  }

  async getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null> {
    const snap = await this.db.collection('conferencias').doc(conferenciaId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as StandaloneConferencia;
  }

  async getFamiliaById(id: string): Promise<FamiliaAssistidaCompleta | null> {
    const snap = await this.db.collection('familias_assistidas').doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as FamiliaAssistidaCompleta;
  }

  async listFamiliasByConferencia(conferenciaId: string, options?: ListFamiliasOptions): Promise<FamiliaAssistidaCompleta[]> {
    let query: FirebaseFirestore.Query = this.db.collection('familias_assistidas');

    if (conferenciaId && conferenciaId !== 'all') {
      query = query.where('conferenciaId', '==', conferenciaId);
    }

    if (options?.particularId) {
      query = query.where('particularId', '==', options.particularId);
    }

    if (options?.status && options.status !== 'todos') {
      query = query.where('status', '==', options.status);
    }

    const snap = await query.get();
    let items: FamiliaAssistidaCompleta[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FamiliaAssistidaCompleta[];

    // Ordenar por data de criação / nome
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    // Filtro de busca textual caso enviado
    if (options?.search && options.search.trim() !== '') {
      const q = options.search.toLowerCase().trim();
      items = items.filter((f) =>
        (f.nomeAssistido || '').toLowerCase().includes(q) ||
        (f.cpfAssistido || '').includes(q) ||
        (f.enderecoResumido || '').toLowerCase().includes(q)
      );
    }

    return items;
  }

  async createFamilia(data: Omit<FamiliaAssistidaCompleta, 'id'>): Promise<FamiliaAssistidaCompleta> {
    const ref = this.db.collection('familias_assistidas').doc();
    const docData: FamiliaAssistidaCompleta = {
      id: ref.id,
      ...data,
    };
    await ref.set(docData);
    return docData;
  }

  async updateFamilia(id: string, updates: Partial<FamiliaAssistidaCompleta>): Promise<FamiliaAssistidaCompleta> {
    const ref = this.db.collection('familias_assistidas').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error('Familia não encontrada');
    }
    const current = snap.data() as FamiliaAssistidaCompleta;
    const merged: FamiliaAssistidaCompleta = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await ref.set(merged, { merge: true });
    return merged;
  }

  async listVisitasByFamilia(familiaId: string): Promise<VisitaFamiliaSSVP[]> {
    const snap = await this.db
      .collection('familias_assistidas')
      .doc(familiaId)
      .collection('visitas')
      .orderBy('dataVisita', 'desc')
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as VisitaFamiliaSSVP[];
  }

  async createVisita(visita: Omit<VisitaFamiliaSSVP, 'id'>): Promise<VisitaFamiliaSSVP> {
    const familiaRef = this.db.collection('familias_assistidas').doc(visita.familiaId);
    const visitaRef = familiaRef.collection('visitas').doc();

    const visitaDoc: VisitaFamiliaSSVP = {
      id: visitaRef.id,
      ...visita,
    };

    await visitaRef.set(visitaDoc);

    // Atualizar cache de estatísticas na família
    const nowMonth = visita.mesAnoCompetencia || visita.dataVisita.substring(0, 7);
    const updates: Partial<FamiliaAssistidaCompleta> = {
      dataUltimaVisita: visita.dataVisita,
      updatedAt: new Date().toISOString(),
    };

    // Incrementar contadores se foi entregue cesta
    const famSnap = await familiaRef.get();
    if (famSnap.exists) {
      const famData = famSnap.data() as FamiliaAssistidaCompleta;
      updates.totalVisitasRealizadas = (famData.totalVisitasRealizadas || 0) + 1;
      if (visita.entregueCesta) {
        updates.totalCestasRecebidas = (famData.totalCestasRecebidas || 0) + (visita.quantidadeCestas || 1);
        updates.ultimoMesAnoCesta = nowMonth;
        const currentMonth = new Date().toISOString().substring(0, 7);
        if (nowMonth === currentMonth) {
          updates.recebeuCestaMesAtual = true;
        }
      }
    }

    await familiaRef.set(updates, { merge: true });

    return visitaDoc;
  }

  async deleteVisita(familiaId: string, visitaId: string): Promise<boolean> {
    const ref = this.db.collection('familias_assistidas').doc(familiaId).collection('visitas').doc(visitaId);
    await ref.delete();
    return true;
  }

  async getControleCestasMensal(conferenciaId: string, mesAno: string): Promise<ControleCestasMensalStats> {
    const conf = await this.getConferenciaById(conferenciaId);
    const confName = conf?.name || 'Conferência';

    // Listar todas as famílias ativas da conferência
    const snap = await this.db
      .collection('familias_assistidas')
      .where('conferenciaId', '==', conferenciaId)
      .get();

    const familias = snap.docs.map((d) => d.data() as FamiliaAssistidaCompleta);
    const ativas = familias.filter((f) => f.status === 'ativo');
    const arquivadas = familias.filter((f) => f.status === 'arquivado');

    let totalCestas = 0;
    let familiasAtendidas = 0;

    // Buscar visitas deste mês
    for (const fam of ativas) {
      const visSnap = await this.db
        .collection('familias_assistidas')
        .doc(fam.id)
        .collection('visitas')
        .where('mesAnoCompetencia', '==', mesAno)
        .get();

      const visitasMes = visSnap.docs.map((d) => d.data() as VisitaFamiliaSSVP);
      const visitasComCesta = visitasMes.filter((v) => v.entregueCesta);

      if (visitasComCesta.length > 0) {
        familiasAtendidas += 1;
        totalCestas += visitasComCesta.reduce((sum, v) => sum + (v.quantidadeCestas || 1), 0);
      }
    }

    return {
      mesAno,
      conferenciaId,
      conferenciaNome: confName,
      totalFamiliasAtivas: ativas.length,
      totalFamiliasArquivadas: arquivadas.length,
      totalFamiliasAtendidasComCesta: familiasAtendidas,
      totalCestasEntregues: totalCestas,
      familiasSemCestaNoMes: Math.max(0, ativas.length - familiasAtendidas),
    };
  }
}

// ==========================================
// FUNÇÕES DE REGRAS DE NEGÓCIO DO SERVIÇO
// ==========================================

export async function listFamiliasService(
  conferenciaId: string,
  authContext: ServiceAuthContext,
  repo: FamiliaRepository,
  options?: ListFamiliasOptions
): Promise<ServiceResult<FamiliaAssistidaCompleta[]>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Não autorizado a visualizar famílias.' };
  }

  // Isolamento por Conferência: usuário não-admin com conferência vinculada só opera a sua própria
  if (!authContext.isAdmin && authContext.conferenciaId) {
    if (conferenciaId && conferenciaId !== 'all' && conferenciaId !== authContext.conferenciaId) {
      return { success: false, code: 'UNAUTHORIZED', error: 'Acesso negado a famílias de outra Conferência.' };
    }
    if (!conferenciaId || conferenciaId === 'all') {
      conferenciaId = authContext.conferenciaId;
    }
  }

  if (conferenciaId && conferenciaId !== 'all') {
    const conf = await repo.getConferenciaById(conferenciaId);
    if (!conf) {
      return { success: false, code: 'CONFERENCIA_NOT_FOUND', error: 'Conferência não encontrada.' };
    }
    if (conf.centralId && conf.centralId !== authContext.validatedCentralId) {
      return { success: false, code: 'CENTRAL_MISMATCH', error: 'A Conferência pertence a outro Conselho Central.' };
    }
  }

  try {
    const data = await repo.listFamiliasByConferencia(conferenciaId, options);
    return { success: true, code: 'SUCCESS', data };
  } catch (err: any) {
    return { success: false, code: 'STORAGE_ERROR', error: err.message };
  }
}

export async function createFamiliaService(
  conferenciaId: string,
  payload: { sindicancia: FichaSindicanciaData },
  authContext: ServiceAuthContext,
  repo: FamiliaRepository
): Promise<ServiceResult<FamiliaAssistidaCompleta>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Não autorizado a cadastrar família.' };
  }

  if (!conferenciaId) {
    return { success: false, code: 'MISSING_CONFERENCIA_ID', error: 'Conferência é obrigatória.' };
  }

  // Isolamento por Conferência: usuário não-admin com conferência vinculada só pode cadastrar para a sua própria
  if (!authContext.isAdmin && authContext.conferenciaId && authContext.conferenciaId !== conferenciaId) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Não é permitido cadastrar famílias para outra Conferência.' };
  }

  const conf = await repo.getConferenciaById(conferenciaId);
  if (!conf) {
    return { success: false, code: 'CONFERENCIA_NOT_FOUND', error: 'Conferência não encontrada.' };
  }

  if (conf.centralId && conf.centralId !== authContext.validatedCentralId) {
    return { success: false, code: 'CENTRAL_MISMATCH', error: 'A Conferência pertence a outro Conselho Central.' };
  }

  const { sindicancia } = payload || {};
  if (!sindicancia || !sindicancia.assistidoNome || sindicancia.assistidoNome.trim() === '') {
    return { success: false, code: 'VALIDATION_ERROR', error: 'Nome do Assistido é obrigatório na Ficha de Sindicância.' };
  }

  const now = new Date().toISOString();
  const currentMonth = now.substring(0, 7);

  const enderecoResumido = [
    sindicancia.endereco,
    sindicancia.numero,
    sindicancia.bairro,
    sindicancia.cidade ? `${sindicancia.cidade}/${sindicancia.estado || ''}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const novaFamilia: Omit<FamiliaAssistidaCompleta, 'id'> = {
    centralId: conf.centralId || authContext.validatedCentralId,
    particularId: conf.particularId || '',
    conferenciaId: conf.id,
    nomeAssistido: sindicancia.assistidoNome.trim(),
    cpfAssistido: sindicancia.assistidoCpf?.trim() || '',
    telefone: sindicancia.assistidoTelefone?.trim() || '',
    enderecoResumido: enderecoResumido || sindicancia.endereco || 'Endereço não informado',
    status: 'ativo',
    sindicancia: {
      ...sindicancia,
      membrosFamilia: Array.isArray(sindicancia.membrosFamilia) ? sindicancia.membrosFamilia : [],
    },
    totalVisitasRealizadas: 0,
    totalCestasRecebidas: 0,
    recebeuCestaMesAtual: false,
    createdAt: now,
    updatedAt: now,
    createdBy: authContext.userId,
  };

  try {
    const created = await repo.createFamilia(novaFamilia);
    return { success: true, code: 'SUCCESS', data: created };
  } catch (err: any) {
    return { success: false, code: 'STORAGE_ERROR', error: err.message };
  }
}

export async function updateFamiliaService(
  id: string,
  updates: Partial<FamiliaAssistidaCompleta>,
  authContext: ServiceAuthContext,
  repo: FamiliaRepository
): Promise<ServiceResult<FamiliaAssistidaCompleta>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Não autorizado a atualizar família.' };
  }

  const existing = await repo.getFamiliaById(id);
  if (!existing) {
    return { success: false, code: 'FAMILIA_NOT_FOUND', error: 'Família assistida não encontrada.' };
  }

  if (existing.centralId && existing.centralId !== authContext.validatedCentralId) {
    return { success: false, code: 'CENTRAL_MISMATCH', error: 'A Família pertence a outro Conselho Central.' };
  }

  // Isolamento por Conferência: usuário não-admin com conferência vinculada só pode alterar famílias de sua própria conferência
  if (!authContext.isAdmin && authContext.conferenciaId && existing.conferenciaId !== authContext.conferenciaId) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Acesso negado para alterar família de outra Conferência.' };
  }

  // Atualizar resumo caso a sindicância tenha sido editada
  if (updates.sindicancia?.assistidoNome) {
    updates.nomeAssistido = updates.sindicancia.assistidoNome.trim();
  }
  if (updates.sindicancia?.assistidoCpf !== undefined) {
    updates.cpfAssistido = updates.sindicancia.assistidoCpf;
  }
  if (updates.sindicancia?.assistidoTelefone !== undefined) {
    updates.telefone = updates.sindicancia.assistidoTelefone;
  }
  if (updates.sindicancia) {
    const s = updates.sindicancia;
    const enderecoResumido = [s.endereco, s.numero, s.bairro, s.cidade ? `${s.cidade}/${s.estado || ''}` : '']
      .filter(Boolean)
      .join(', ');
    if (enderecoResumido) {
      updates.enderecoResumido = enderecoResumido;
    }
  }

  try {
    const updated = await repo.updateFamilia(id, updates);
    return { success: true, code: 'SUCCESS', data: updated };
  } catch (err: any) {
    return { success: false, code: 'STORAGE_ERROR', error: err.message };
  }
}

export async function archiveFamiliaService(
  id: string,
  motivo: string,
  detalhes: string | undefined,
  authContext: ServiceAuthContext,
  repo: FamiliaRepository
): Promise<ServiceResult<FamiliaAssistidaCompleta>> {
  return updateFamiliaService(
    id,
    {
      status: 'arquivado',
      motivoArquivamento: motivo || 'outro',
      detalhesArquivamento: detalhes || '',
      dataArquivamento: new Date().toISOString(),
    },
    authContext,
    repo
  );
}

export async function unarchiveFamiliaService(
  id: string,
  authContext: ServiceAuthContext,
  repo: FamiliaRepository
): Promise<ServiceResult<FamiliaAssistidaCompleta>> {
  return updateFamiliaService(
    id,
    {
      status: 'ativo',
      motivoArquivamento: undefined,
      detalhesArquivamento: undefined,
      dataArquivamento: undefined,
    },
    authContext,
    repo
  );
}

export async function createVisitaService(
  familiaId: string,
  visitaData: {
    dataVisita: string;
    visitadoresIds: string[];
    visitadoresNomes: string[];
    entregueCesta: boolean;
    quantidadeCestas?: number;
    tipoAuxilioExtra?: string;
    comentarios: string;
    proximaVisitaAgendada?: string;
  },
  authContext: ServiceAuthContext,
  repo: FamiliaRepository
): Promise<ServiceResult<VisitaFamiliaSSVP>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Não autorizado a registrar visita.' };
  }

  const familia = await repo.getFamiliaById(familiaId);
  if (!familia) {
    return { success: false, code: 'FAMILIA_NOT_FOUND', error: 'Família não encontrada.' };
  }

  if (familia.centralId && familia.centralId !== authContext.validatedCentralId) {
    return { success: false, code: 'CENTRAL_MISMATCH', error: 'A Família pertence a outro Conselho Central.' };
  }

  // Isolamento por Conferência: usuário não-admin com conferência vinculada só pode registrar visitas em famílias de sua própria conferência
  if (!authContext.isAdmin && authContext.conferenciaId && familia.conferenciaId !== authContext.conferenciaId) {
    return { success: false, code: 'UNAUTHORIZED', error: 'Acesso negado para registrar visita a família de outra Conferência.' };
  }

  if (!visitaData.dataVisita) {
    return { success: false, code: 'VALIDATION_ERROR', error: 'A data da visita é obrigatória.' };
  }

  const mesAnoCompetencia = visitaData.dataVisita.substring(0, 7);
  const now = new Date().toISOString();

  const novaVisita: Omit<VisitaFamiliaSSVP, 'id'> = {
    familiaId,
    conferenciaId: familia.conferenciaId,
    centralId: familia.centralId,
    particularId: familia.particularId,
    dataVisita: visitaData.dataVisita,
    mesAnoCompetencia,
    visitadoresIds: visitaData.visitadoresIds || [],
    visitadoresNomes: visitaData.visitadoresNomes || [],
    entregueCesta: !!visitaData.entregueCesta,
    quantidadeCestas: visitaData.entregueCesta ? Number(visitaData.quantidadeCestas || 1) : 0,
    tipoAuxilioExtra: visitaData.tipoAuxilioExtra || '',
    comentarios: visitaData.comentarios || '',
    proximaVisitaAgendada: visitaData.proximaVisitaAgendada,
    createdAt: now,
    createdBy: authContext.userId,
  };

  try {
    const created = await repo.createVisita(novaVisita);
    return { success: true, code: 'SUCCESS', data: created };
  } catch (err: any) {
    return { success: false, code: 'STORAGE_ERROR', error: err.message };
  }
}
