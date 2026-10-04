/**
 * Serviço de Regras de Negócio e Gestão de Membros SSVP da Conferência.
 * 
 * Operações:
 * - listMembrosConferencia
 * - createMembroConferencia
 * - updateMembroConferencia
 * - inactivateMembroConferencia
 */

import { MembroSSVP, StandaloneConferencia } from '../types.ts';
import { validateMembroInput } from './membro_validator.ts';

export interface ServiceAuthContext {
  allowed?: boolean;
  validatedCentralId?: string;
  userId?: string;
}

export interface ListMembrosOptions {
  status?: 'ativo' | 'inativo' | 'todos';
  type?: 'confrade' | 'consocia' | 'auxiliar' | 'aspirante' | 'todos';
}

export interface MembroRepository {
  getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null>;
  getById(id: string): Promise<MembroSSVP | null>;
  listByConferencia(conferenciaId: string, options?: ListMembrosOptions): Promise<MembroSSVP[]>;
  create(membro: Omit<MembroSSVP, 'id'>): Promise<MembroSSVP>;
  update(id: string, updates: Partial<MembroSSVP>): Promise<MembroSSVP>;
  inactivate(id: string, userId: string): Promise<MembroSSVP>;
}

export interface ServiceResult<T> {
  success: boolean;
  code:
    | 'SUCCESS'
    | 'UNAUTHORIZED'
    | 'MISSING_CONFERENCIA_ID'
    | 'MISSING_ID'
    | 'CONFERENCIA_NOT_FOUND'
    | 'CENTRAL_MISMATCH'
    | 'MEMBRO_NOT_FOUND'
    | 'ALREADY_INACTIVE'
    | 'VALIDATION_ERROR'
    | 'INVALID_DATA'
    | 'ACCESS_ACTION_FAILED'
    | 'STORAGE_ERROR';
  error?: string;
  data?: T;
}

export async function listMembrosConferencia(
  conferenciaId: string,
  authContext: ServiceAuthContext,
  repo: MembroRepository,
  options?: ListMembrosOptions
): Promise<ServiceResult<MembroSSVP[]>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Não autorizado a listar membros desta conferência.',
    };
  }

  if (!conferenciaId || typeof conferenciaId !== 'string' || conferenciaId.trim() === '') {
    return {
      success: false,
      code: 'MISSING_CONFERENCIA_ID',
      error: 'ID da Conferência é obrigatório.',
    };
  }

  try {
    const conferencia = await repo.getConferenciaById(conferenciaId);
    if (!conferencia) {
      return {
        success: false,
        code: 'CONFERENCIA_NOT_FOUND',
        error: 'Conferência não encontrada.',
      };
    }

    if (conferencia.centralId !== authContext.validatedCentralId) {
      return {
        success: false,
        code: 'CENTRAL_MISMATCH',
        error: 'A Conferência pertence a outro Conselho Central.',
      };
    }

    const items = await repo.listByConferencia(conferenciaId, options);
    return {
      success: true,
      code: 'SUCCESS',
      data: items,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err.message || 'Erro ao carregar membros da conferência.',
    };
  }
}

export async function createMembroConferencia(
  conferenciaId: string,
  data: any,
  authContext: ServiceAuthContext,
  repo: MembroRepository
): Promise<ServiceResult<MembroSSVP>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Não autorizado a cadastrar membro nesta conferência.',
    };
  }

  if (!conferenciaId || typeof conferenciaId !== 'string' || conferenciaId.trim() === '') {
    return {
      success: false,
      code: 'MISSING_CONFERENCIA_ID',
      error: 'ID da Conferência é obrigatório.',
    };
  }

  // Validação dos dados do formulário (novo membro: obrigatoriedade de nascimento válido)
  const validation = validateMembroInput(data, { isNewMember: true });
  if (!validation.valid || !validation.cleanData) {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      error: validation.errors.join(' '),
    };
  }

  try {
    const conferencia = await repo.getConferenciaById(conferenciaId);
    if (!conferencia) {
      return {
        success: false,
        code: 'CONFERENCIA_NOT_FOUND',
        error: 'Conferência de destino não encontrada.',
      };
    }

    if (conferencia.centralId !== authContext.validatedCentralId) {
      return {
        success: false,
        code: 'CENTRAL_MISMATCH',
        error: 'A Conferência pertence a outro Conselho Central.',
      };
    }

    const now = new Date().toISOString();
    const userId = authContext.userId || 'system';

    const newMembro: Omit<MembroSSVP, 'id'> = {
      conferenciaId: conferencia.id,
      particularId: conferencia.particularId,
      centralId: conferencia.centralId,
      fullName: validation.cleanData.fullName,
      normalizedName: validation.cleanData.normalizedName,
      type: validation.cleanData.type,
      gender: validation.cleanData.gender,
      birthDate: validation.cleanData.birthDate,
      cpf: validation.cleanData.cpf,
      profession: validation.cleanData.profession,
      addressStreet: validation.cleanData.addressStreet,
      addressNumber: validation.cleanData.addressNumber,
      addressComplement: validation.cleanData.addressComplement,
      addressNeighborhood: validation.cleanData.addressNeighborhood,
      addressCity: validation.cleanData.addressCity,
      addressState: validation.cleanData.addressState,
      addressZip: validation.cleanData.addressZip,
      fullAddress: validation.cleanData.fullAddress,
      phone: validation.cleanData.phone,
      normalizedPhone: validation.cleanData.normalizedPhone,
      phoneResidential: validation.cleanData.phoneResidential,
      phoneCommercial: validation.cleanData.phoneCommercial,
      email: validation.cleanData.email,
      admissionDate: validation.cleanData.admissionDate,
      acclamationDate: validation.cleanData.acclamationDate,
      proclamationDate: validation.cleanData.proclamationDate,
      status: 'ativo',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const created = await repo.create(newMembro);
    return {
      success: true,
      code: 'SUCCESS',
      data: created,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err.message || 'Erro ao persistir cadastro do membro.',
    };
  }
}

export async function updateMembroConferencia(
  id: string,
  conferenciaId: string,
  data: any,
  authContext: ServiceAuthContext,
  repo: MembroRepository
): Promise<ServiceResult<MembroSSVP>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Não autorizado a atualizar dados do membro.',
    };
  }

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return {
      success: false,
      code: 'MISSING_ID',
      error: 'ID do membro é obrigatório.',
    };
  }

  const validation = validateMembroInput(data);
  if (!validation.valid || !validation.cleanData) {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      error: validation.errors.join(' '),
    };
  }

  try {
    const existing = await repo.getById(id);
    if (!existing) {
      return {
        success: false,
        code: 'MEMBRO_NOT_FOUND',
        error: 'Membro não encontrado.',
      };
    }

    if (existing.conferenciaId !== conferenciaId) {
      return {
        success: false,
        code: 'CONFERENCIA_NOT_FOUND',
        error: 'Membro não pertence a esta conferência.',
      };
    }

    if (existing.centralId !== authContext.validatedCentralId) {
      return {
        success: false,
        code: 'CENTRAL_MISMATCH',
        error: 'Membro pertence a outro Conselho Central.',
      };
    }

    const now = new Date().toISOString();
    const userId = authContext.userId || 'system';

    const updates: Partial<MembroSSVP> = {
      fullName: validation.cleanData.fullName,
      normalizedName: validation.cleanData.normalizedName,
      type: validation.cleanData.type,
      gender: validation.cleanData.gender,
      birthDate: validation.cleanData.birthDate,
      cpf: validation.cleanData.cpf,
      profession: validation.cleanData.profession,
      addressStreet: validation.cleanData.addressStreet,
      addressNumber: validation.cleanData.addressNumber,
      addressComplement: validation.cleanData.addressComplement,
      addressNeighborhood: validation.cleanData.addressNeighborhood,
      addressCity: validation.cleanData.addressCity,
      addressState: validation.cleanData.addressState,
      addressZip: validation.cleanData.addressZip,
      fullAddress: validation.cleanData.fullAddress,
      phone: validation.cleanData.phone,
      normalizedPhone: validation.cleanData.normalizedPhone,
      phoneResidential: validation.cleanData.phoneResidential,
      phoneCommercial: validation.cleanData.phoneCommercial,
      email: validation.cleanData.email,
      admissionDate: validation.cleanData.admissionDate,
      acclamationDate: validation.cleanData.acclamationDate,
      proclamationDate: validation.cleanData.proclamationDate,
      updatedAt: now,
      updatedBy: userId,
    };

    const updated = await repo.update(id, updates);
    return {
      success: true,
      code: 'SUCCESS',
      data: updated,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err.message || 'Erro ao atualizar cadastro do membro.',
    };
  }
}

export async function inactivateMembroConferencia(
  id: string,
  conferenciaId: string,
  authContext: ServiceAuthContext,
  repo: MembroRepository
): Promise<ServiceResult<MembroSSVP>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Não autorizado a inativar este membro.',
    };
  }

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return {
      success: false,
      code: 'MISSING_ID',
      error: 'ID do membro é obrigatório.',
    };
  }

  try {
    const existing = await repo.getById(id);
    if (!existing) {
      return {
        success: false,
        code: 'MEMBRO_NOT_FOUND',
        error: 'Membro não encontrado.',
      };
    }

    if (existing.conferenciaId !== conferenciaId) {
      return {
        success: false,
        code: 'CONFERENCIA_NOT_FOUND',
        error: 'Membro não pertence a esta conferência.',
      };
    }

    if (existing.centralId !== authContext.validatedCentralId) {
      return {
        success: false,
        code: 'CENTRAL_MISMATCH',
        error: 'Membro pertence a outro Conselho Central.',
      };
    }

    if (existing.status === 'inativo') {
      return {
        success: false,
        code: 'ALREADY_INACTIVE',
        error: 'O membro já se encontra inativo.',
      };
    }

    const userId = authContext.userId || 'system';
    const inactivated = await repo.inactivate(id, userId);

    return {
      success: true,
      code: 'SUCCESS',
      data: inactivated,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err.message || 'Erro ao inativar cadastro do membro.',
    };
  }
}

/**
 * 6. Gestão Administrativa de Acesso do Membro (Gerar, Redefinir Senha, Bloquear, Desbloquear)
 */
export async function accessActionMembroConferencia(
  id: string,
  conferenciaId: string,
  action: 'generate' | 'reset-password' | 'block' | 'unblock',
  authContext: ServiceAuthContext,
  db: any
): Promise<ServiceResult<MembroSSVP>> {
  if (!authContext.allowed || !authContext.validatedCentralId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Não autorizado a gerenciar acessos de membros.',
    };
  }

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return {
      success: false,
      code: 'MISSING_ID',
      error: 'ID do membro é obrigatório.',
    };
  }

  const allowedActions = ['generate', 'reset-password', 'block', 'unblock'];
  if (!allowedActions.includes(action)) {
    return {
      success: false,
      code: 'INVALID_DATA',
      error: 'Ação de acesso inválida.',
    };
  }

  try {
    const docRef = db.collection('membros_ssvp').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        success: false,
        code: 'MEMBRO_NOT_FOUND',
        error: 'Membro não encontrado.',
      };
    }

    const membro = { ...snap.data(), id: snap.id } as MembroSSVP;

    if (membro.conferenciaId !== conferenciaId) {
      return {
        success: false,
        code: 'CONFERENCIA_NOT_FOUND',
        error: 'Membro não pertence a esta conferência.',
      };
    }

    if (membro.centralId !== authContext.validatedCentralId) {
      return {
        success: false,
        code: 'CENTRAL_MISMATCH',
        error: 'Membro pertence a outro Conselho Central.',
      };
    }

    const { handleMemberAccessAction } = await import('./membro_auth_helper');
    const result = await handleMemberAccessAction(db, id, action, authContext.userId);

    if (!result.success) {
      return {
        success: false,
        code: 'ACCESS_ACTION_FAILED',
        error: result.message,
      };
    }

    return {
      success: true,
      code: 'SUCCESS',
      data: result.membro || membro,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err.message || 'Erro ao processar ação de acesso do membro.',
    };
  }
}

export interface PerfilMembroResponse {
  membro: MembroSSVP;
  conferenciaNome: string;
  particularNome: string;
  username?: string;
}

/**
 * 7. Obter Perfil Completo do Membro Autenticado
 */
export async function getPerfilMembroAutenticado(
  authContext: ServiceAuthContext,
  db: any
): Promise<ServiceResult<PerfilMembroResponse>> {
  if (!authContext.allowed || !authContext.validatedCentralId || !authContext.userId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Não autenticado ou sessão inválida.',
    };
  }

  try {
    const userDoc = await db.collection('users').doc(authContext.userId).get();
    if (!userDoc.exists) {
      return {
        success: false,
        code: 'UNAUTHORIZED',
        error: 'Usuário não localizado.',
      };
    }

    const userData = userDoc.data() || {};
    let membroId = userData.membroId;

    let membroDoc: any = null;

    if (membroId) {
      const snap = await db.collection('membros_ssvp').doc(membroId).get();
      if (snap.exists) {
        membroDoc = { ...snap.data(), id: snap.id };
      }
    }

    // Se não encontrou por membroId, busca pelo vínculo de userId
    if (!membroDoc) {
      const querySnap = await db.collection('membros_ssvp')
        .where('userId', '==', authContext.userId)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        const doc = querySnap.docs[0];
        membroDoc = { ...doc.data(), id: doc.id };
      }
    }

    if (!membroDoc) {
      return {
        success: false,
        code: 'MEMBRO_NOT_FOUND',
        error: 'Ficha de membro vinculada não foi encontrada.',
      };
    }

    // Validação de Conselho Central
    if (membroDoc.centralId && membroDoc.centralId !== authContext.validatedCentralId) {
      return {
        success: false,
        code: 'CENTRAL_MISMATCH',
        error: 'Membro pertence a outro Conselho Central.',
      };
    }

    // Buscar nomes amigáveis de Conferência e CP
    let conferenciaNome = 'Não informada';
    let particularNome = 'Não informado';

    if (membroDoc.conferenciaId) {
      const confDoc = await db.collection('conferencias').doc(membroDoc.conferenciaId).get();
      if (confDoc.exists) {
        const confData = confDoc.data();
        conferenciaNome = confData.name || confData.nome || 'Conferência';
        
        const partId = confData.particularId || membroDoc.particularId;
        if (partId) {
          const partDoc = await db.collection('conselhos_particulares').doc(partId).get();
          if (partDoc.exists) {
            const partData = partDoc.data();
            particularNome = partData.name || partData.nome || 'Conselho Particular';
          }
        }
      }
    } else if (membroDoc.particularId) {
      const partDoc = await db.collection('conselhos_particulares').doc(membroDoc.particularId).get();
      if (partDoc.exists) {
        const partData = partDoc.data();
        particularNome = partData.name || partData.nome || 'Conselho Particular';
      }
    }

    return {
      success: true,
      code: 'SUCCESS',
      data: {
        membro: membroDoc as MembroSSVP,
        conferenciaNome,
        particularNome,
        username: userData.username || membroDoc.username || '',
      },
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err.message || 'Erro ao carregar perfil do membro.',
    };
  }
}

/**
 * 8. Atualizar Dados Pessoais do Próprio Membro Autenticado
 */
export async function updatePerfilMembroAutenticado(
  data: any,
  authContext: ServiceAuthContext,
  db: any
): Promise<ServiceResult<MembroSSVP>> {
  if (!authContext.allowed || !authContext.validatedCentralId || !authContext.userId) {
    return {
      success: false,
      code: 'UNAUTHORIZED',
      error: 'Não autenticado ou sessão inválida.',
    };
  }

  try {
    const userDoc = await db.collection('users').doc(authContext.userId).get();
    if (!userDoc.exists) {
      return {
        success: false,
        code: 'UNAUTHORIZED',
        error: 'Usuário não localizado.',
      };
    }

    const userData = userDoc.data() || {};
    let membroId = userData.membroId;
    let membroDocRef: any = null;
    let existingData: any = null;

    if (membroId) {
      const docRef = db.collection('membros_ssvp').doc(membroId);
      const snap = await docRef.get();
      if (snap.exists) {
        membroDocRef = docRef;
        existingData = { ...snap.data(), id: snap.id };
      }
    }

    if (!membroDocRef) {
      const querySnap = await db.collection('membros_ssvp')
        .where('userId', '==', authContext.userId)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        const doc = querySnap.docs[0];
        membroDocRef = doc.ref;
        existingData = { ...doc.data(), id: doc.id };
      }
    }

    if (!membroDocRef || !existingData) {
      return {
        success: false,
        code: 'MEMBRO_NOT_FOUND',
        error: 'Ficha de membro vinculada não foi encontrada para atualização.',
      };
    }

    if (existingData.centralId && existingData.centralId !== authContext.validatedCentralId) {
      return {
        success: false,
        code: 'CENTRAL_MISMATCH',
        error: 'Membro pertence a outro Conselho Central.',
      };
    }

    // Filtrar e sanitizar apenas os campos pessoais permitidos
    const validation = validateMembroInput({
      ...existingData,
      phone: data.phone !== undefined ? data.phone : existingData.phone,
      phoneResidential: data.phoneResidential !== undefined ? data.phoneResidential : existingData.phoneResidential,
      phoneCommercial: data.phoneCommercial !== undefined ? data.phoneCommercial : existingData.phoneCommercial,
      email: data.email !== undefined ? data.email : existingData.email,
      birthDate: data.birthDate !== undefined ? data.birthDate : existingData.birthDate,
      profession: data.profession !== undefined ? data.profession : existingData.profession,
      addressStreet: data.addressStreet !== undefined ? data.addressStreet : existingData.addressStreet,
      addressNumber: data.addressNumber !== undefined ? data.addressNumber : existingData.addressNumber,
      addressComplement: data.addressComplement !== undefined ? data.addressComplement : existingData.addressComplement,
      addressNeighborhood: data.addressNeighborhood !== undefined ? data.addressNeighborhood : existingData.addressNeighborhood,
      addressCity: data.addressCity !== undefined ? data.addressCity : existingData.addressCity,
      addressState: data.addressState !== undefined ? data.addressState : existingData.addressState,
      addressZip: data.addressZip !== undefined ? data.addressZip : existingData.addressZip,
      admissionDate: data.admissionDate !== undefined ? data.admissionDate : existingData.admissionDate,
      acclamationDate: data.acclamationDate !== undefined ? data.acclamationDate : existingData.acclamationDate,
      proclamationDate: data.proclamationDate !== undefined ? data.proclamationDate : existingData.proclamationDate,
    });

    if (!validation.valid || !validation.cleanData) {
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        error: validation.errors.join(' ') || 'Dados pessoais inválidos.',
      };
    }

    const now = new Date().toISOString();

    // Montar objeto de atualização estritamente restrito
    const updates: Partial<MembroSSVP> = {
      phone: validation.cleanData.phone,
      normalizedPhone: validation.cleanData.normalizedPhone,
      phoneResidential: validation.cleanData.phoneResidential,
      phoneCommercial: validation.cleanData.phoneCommercial,
      email: validation.cleanData.email,
      birthDate: validation.cleanData.birthDate,
      profession: validation.cleanData.profession,
      addressStreet: validation.cleanData.addressStreet,
      addressNumber: validation.cleanData.addressNumber,
      addressComplement: validation.cleanData.addressComplement,
      addressNeighborhood: validation.cleanData.addressNeighborhood,
      addressCity: validation.cleanData.addressCity,
      addressState: validation.cleanData.addressState,
      addressZip: validation.cleanData.addressZip,
      fullAddress: validation.cleanData.fullAddress,
      admissionDate: validation.cleanData.admissionDate,
      acclamationDate: validation.cleanData.acclamationDate,
      proclamationDate: validation.cleanData.proclamationDate,
      updatedAt: now,
      updatedBy: authContext.userId,
    };

    await membroDocRef.set(updates, { merge: true });

    // Sincronizar telefone/email no documento de User se aplicável
    try {
      const userUpdates: any = { updatedAt: now };
      if (updates.email) userUpdates.email = updates.email;
      if (updates.phone) userUpdates.phone = updates.phone;
      await db.collection('users').doc(authContext.userId).set(userUpdates, { merge: true });
    } catch (syncUserErr) {
      console.warn('Aviso: Não foi possível sincronizar user com dados do membro:', syncUserErr);
    }

    const updatedSnap = await membroDocRef.get();
    const finalMembro = { ...updatedSnap.data(), id: membroDocRef.id } as MembroSSVP;

    return {
      success: true,
      code: 'SUCCESS',
      data: finalMembro,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: err.message || 'Erro ao atualizar dados do próprio membro.',
    };
  }
}

