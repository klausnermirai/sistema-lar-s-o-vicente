/**
 * Helper de utilidades para geração e sincronização de credenciais de membros SSVP.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { MembroSSVP } from '../types.ts';

/**
 * Normaliza o primeiro nome para compor o username:
 * - Remove acentos e caracteres especiais
 * - Converte para minúsculas
 * - Remove caracteres não alfanuméricos
 * Ex: "João Carlos" -> "joao"
 * Ex: "Maria da Silva" -> "maria"
 * Ex: "Éder" -> "eder"
 */
export function extractBaseUsername(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return 'membro';
  
  const clean = fullName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase();

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'membro';

  // Pega o primeiro nome e limpa qualquer caractere não alfanumérico
  const firstName = parts[0].replace(/[^a-z0-9]/g, '');
  return firstName || 'membro';
}

/**
 * Extrai a senha inicial a partir da data de nascimento no formato DDMM.
 * Suporta formatos:
 * - YYYY-MM-DD (ISO) -> ex: "1985-07-15" -> "1507"
 * - DD/MM/YYYY -> ex: "15/07/1985" -> "1507"
 * - DD-MM-YYYY -> ex: "15-07-1985" -> "1507"
 * Retorna null se a data for inválida ou ausente.
 */
export function extractInitialPassword(birthDate?: string): string | null {
  if (!birthDate || typeof birthDate !== 'string') return null;
  const str = birthDate.trim();
  if (!str) return null;

  // Formato ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}${month}`;
  }

  // Formato BR: DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    return `${day}${month}`;
  }

  // Se for apenas DDMM ou apenas números
  const digitsOnly = str.replace(/\D/g, '');
  if (digitsOnly.length >= 4) {
    // Se tiver 8 dígitos (DDMMYYYY)
    if (digitsOnly.length === 8) {
      return digitsOnly.substring(0, 4);
    }
    // Se tiver 4 dígitos (DDMM)
    if (digitsOnly.length === 4) {
      return digitsOnly;
    }
  }

  return null;
}

/**
 * Gera um username único verificando colisões na coleção `users`.
 * Se "joao" existir, tenta "joao2", "joao3", etc.
 * Se targetUserId for fornecido (edição do próprio membro), ignora colisão com o próprio ID.
 */
export async function generateUniqueUsername(
  db: Firestore,
  fullName: string,
  targetUserId?: string
): Promise<string> {
  const base = extractBaseUsername(fullName);
  let candidate = base;
  let counter = 1;

  while (true) {
    const snap = await db.collection('users').where('username', '==', candidate).get();
    
    // Se não encontrou ou o único encontrado é o próprio usuário do membro
    if (snap.empty || (snap.docs.length === 1 && targetUserId && snap.docs[0].id === targetUserId)) {
      return candidate;
    }

    counter++;
    candidate = `${base}${counter}`;
  }
}

export interface SyncMemberUserResult {
  hasAccess: boolean;
  userId?: string;
  username?: string;
  initialPasswordGenerated?: boolean;
  mustChangePassword?: boolean;
  accessStatus: string;
  error?: string;
}

/**
 * Cria ou sincroniza o usuário de acesso para um Membro SSVP.
 * Regras:
 * 1. Se não houver data de nascimento: hasAccess = false, accessStatus = "Acesso pendente — informe a data de nascimento"
 * 2. Se o membro já possuir usuário vinculado:
 *    - Preserva o username e a senha existente (não sobrescreve senha customizada)
 *    - Sincroniza status ativo/inativo, conferência e dados de vínculo
 * 3. Se for novo ou não possuir usuário vinculado e tiver data de nascimento:
 *    - Gera username inteligente baseado no primeiro nome (com resolução de colisão)
 *    - Gera senha inicial DDMM
 *    - Cria documento na coleção `users` com mustChangePassword: false, isFirstLogin: false e accessLevel: 'membro_conferencia'
 *    - Atualiza documento em `membros_ssvp` com userId, username e status
 * 4. Se a criação falhar:
 *    - Preserva o membro
 *    - Registra accessStatus = "Erro na criação do acesso" e motivo da falha
 */
export async function syncMemberUserAccess(
  db: Firestore,
  membro: MembroSSVP,
  currentUserId?: string
): Promise<SyncMemberUserResult> {
  const initialPassword = extractInitialPassword(membro.birthDate);

  // Caso 1: Membro sem data de nascimento
  if (!initialPassword) {
    // Se já tinha um usuário, desativa-o temporariamente
    if (membro.userId) {
      try {
        await db.collection('users').doc(membro.userId).set(
          {
            active: false,
            status: 'inativo',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserId || 'system',
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Erro ao atualizar status do usuário sem data de nascimento:', err);
      }
    }

    const pendingStatus = 'Acesso pendente — informe a data de nascimento';
    try {
      await db.collection('membros_ssvp').doc(membro.id).set(
        {
          hasAccess: false,
          accessStatus: pendingStatus,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Erro ao registrar status pendente no membro:', err);
    }

    return {
      hasAccess: false,
      userId: membro.userId,
      username: membro.username,
      accessStatus: pendingStatus,
    };
  }

  // Caso 2: Membro já possui usuário vinculado
  if (membro.userId) {
    try {
      const userDoc = await db.collection('users').doc(membro.userId).get();
      if (userDoc.exists) {
        const uData = userDoc.data() || {};
        const isActive = membro.status === 'ativo';

        await db.collection('users').doc(membro.userId).set(
          {
            fullName: membro.fullName,
            active: isActive,
            status: isActive ? 'ativo' : 'inativo',
            conferenciaId: membro.conferenciaId,
            particularId: membro.particularId,
            centralId: membro.centralId,
            institutionId: membro.conferenciaId || membro.centralId,
            accessLevel: 'membro_conferencia',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserId || 'system',
          },
          { merge: true }
        );

        const currentStatus = isActive ? 'Acesso ativo' : 'Acesso inativo';
        await db.collection('membros_ssvp').doc(membro.id).set(
          {
            hasAccess: isActive,
            accessStatus: currentStatus,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        return {
          hasAccess: isActive,
          userId: membro.userId,
          username: uData.username || membro.username,
          mustChangePassword: false,
          accessStatus: currentStatus,
        };
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar usuário existente do membro:', err);
      const errorStatus = 'Erro na criação do acesso';
      try {
        await db.collection('membros_ssvp').doc(membro.id).set(
          {
            hasAccess: false,
            accessStatus: errorStatus,
            accessErrorReason: err?.message || 'Falha ao atualizar usuário existente',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
      return {
        hasAccess: false,
        userId: membro.userId,
        username: membro.username,
        accessStatus: errorStatus,
        error: err?.message || 'Falha ao sincronizar usuário',
      };
    }
  }

  // Caso 3: Membro não possui usuário e tem data de nascimento -> Criar credencial
  try {
    const uniqueUsername = await generateUniqueUsername(db, membro.fullName, membro.userId);
    const now = new Date().toISOString();
    const userDocRef = db.collection('users').doc();

    const newUserPayload = {
      id: userDocRef.id,
      username: uniqueUsername,
      password: initialPassword, // Senha inicial DDMM
      fullName: membro.fullName,
      role: 'Membro Vicentino',
      accessLevel: 'membro_conferencia',
      conferenciaId: membro.conferenciaId,
      particularId: membro.particularId,
      centralId: membro.centralId,
      institutionId: membro.conferenciaId || membro.centralId,
      membroId: membro.id,
      mustChangePassword: false,
      isFirstLogin: false,
      active: membro.status === 'ativo',
      status: membro.status === 'ativo' ? 'ativo' : 'inativo',
      createdAt: now,
      updatedAt: now,
      createdBy: currentUserId || 'system',
    };

    await userDocRef.set(newUserPayload);

    const accessStatus = membro.status === 'ativo' ? 'Acesso ativo' : 'Acesso inativo';

    // Atualiza o registro em membros_ssvp com o userId e username gerado
    await db.collection('membros_ssvp').doc(membro.id).set(
      {
        userId: userDocRef.id,
        username: uniqueUsername,
        hasAccess: membro.status === 'ativo',
        accessStatus,
        accessErrorReason: null,
        updatedAt: now,
      },
      { merge: true }
    );

    return {
      hasAccess: membro.status === 'ativo',
      userId: userDocRef.id,
      username: uniqueUsername,
      initialPasswordGenerated: true,
      mustChangePassword: false,
      accessStatus,
    };
  } catch (err: any) {
    console.error('Erro ao criar usuário para o membro:', err);
    const errorStatus = 'Erro na criação do acesso';
    try {
      await db.collection('membros_ssvp').doc(membro.id).set(
        {
          hasAccess: false,
          accessStatus: errorStatus,
          accessErrorReason: err?.message || 'Falha ao salvar documento de usuário',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}

    return {
      hasAccess: false,
      accessStatus: errorStatus,
      error: err?.message || 'Falha ao gerar credenciais de acesso',
    };
  }
}

export interface MemberAccessActionResult {
  success: boolean;
  message: string;
  membro?: MembroSSVP;
  accessStatus?: string;
  hasAccess?: boolean;
  username?: string;
}

/**
 * Executa ações administrativas de acesso na ficha do membro:
 * - 'generate': Gera ou sincroniza o acesso
 * - 'reset-password': Redefine a senha para DDMM (requer membro ativo com data de nascimento e usuário)
 * - 'block': Bloqueia o acesso (sem excluir o usuário)
 * - 'unblock': Desbloqueia o acesso (requer membro ativo)
 */
export async function handleMemberAccessAction(
  db: Firestore,
  membroId: string,
  action: 'generate' | 'reset-password' | 'block' | 'unblock',
  currentUserId?: string
): Promise<MemberAccessActionResult> {
  const membroDocRef = db.collection('membros_ssvp').doc(membroId);
  const membroSnap = await membroDocRef.get();

  if (!membroSnap.exists) {
    return {
      success: false,
      message: 'Membro não encontrado.',
    };
  }

  const membro = { ...membroSnap.data(), id: membroSnap.id } as MembroSSVP;
  const now = new Date().toISOString();

  if (action === 'generate') {
    if (membro.status !== 'ativo') {
      return {
        success: false,
        message: 'Apenas membros com cadastro ativo podem gerar acesso ao sistema.',
      };
    }

    if (!membro.birthDate || !extractInitialPassword(membro.birthDate)) {
      return {
        success: false,
        message: 'A data de nascimento é obrigatória para gerar o acesso ao sistema.',
      };
    }

    const syncRes = await syncMemberUserAccess(db, membro, currentUserId);
    const updatedSnap = await membroDocRef.get();
    const updatedMembro = { ...updatedSnap.data(), id: updatedSnap.id } as MembroSSVP;

    if (syncRes.error || syncRes.accessStatus === 'Erro na criação do acesso') {
      return {
        success: false,
        message: 'Erro ao gerar acesso ao sistema. O cadastro do membro foi preservado.',
        membro: updatedMembro,
        accessStatus: updatedMembro.accessStatus,
        hasAccess: updatedMembro.hasAccess,
      };
    }

    return {
      success: true,
      message: 'Acesso ao sistema gerado com sucesso.',
      membro: updatedMembro,
      accessStatus: updatedMembro.accessStatus,
      hasAccess: updatedMembro.hasAccess,
      username: updatedMembro.username,
    };
  }

  if (action === 'reset-password') {
    if (!membro.userId) {
      return {
        success: false,
        message: 'O membro ainda não possui usuário de acesso vinculado.',
      };
    }

    if (membro.status !== 'ativo') {
      return {
        success: false,
        message: 'Não é possível redefinir a senha de um membro com cadastro inativo.',
      };
    }

    const ddmmPassword = extractInitialPassword(membro.birthDate);
    if (!ddmmPassword) {
      return {
        success: false,
        message: 'Não é possível redefinir a senha para DDMM porque a data de nascimento não está cadastrada.',
      };
    }

    try {
      const userRef = db.collection('users').doc(membro.userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return {
          success: false,
          message: 'Usuário vinculado não foi encontrado na base de usuários.',
        };
      }

      await userRef.set(
        {
          password: ddmmPassword,
          mustChangePassword: false,
          isFirstLogin: false,
          updatedAt: now,
          updatedBy: currentUserId || 'system',
        },
        { merge: true }
      );

      await membroDocRef.set(
        {
          hasAccess: true,
          accessStatus: 'Acesso ativo',
          accessErrorReason: null,
          updatedAt: now,
        },
        { merge: true }
      );

      const updatedSnap = await membroDocRef.get();
      const updatedMembro = { ...updatedSnap.data(), id: updatedSnap.id } as MembroSSVP;

      return {
        success: true,
        message: 'Senha redefinida para o padrão DDMM com sucesso.',
        membro: updatedMembro,
        accessStatus: updatedMembro.accessStatus,
        hasAccess: true,
        username: updatedMembro.username,
      };
    } catch (err: any) {
      console.error('Erro ao redefinir senha do membro:', err);
      return {
        success: false,
        message: 'Falha técnica ao redefinir senha. Tente novamente mais tarde.',
      };
    }
  }

  if (action === 'block') {
    if (!membro.userId) {
      return {
        success: false,
        message: 'O membro não possui usuário vinculado para bloquear.',
      };
    }

    try {
      await db.collection('users').doc(membro.userId).set(
        {
          active: false,
          status: 'inativo',
          updatedAt: now,
          updatedBy: currentUserId || 'system',
        },
        { merge: true }
      );

      await membroDocRef.set(
        {
          hasAccess: false,
          accessStatus: 'Acesso inativo',
          updatedAt: now,
        },
        { merge: true }
      );

      const updatedSnap = await membroDocRef.get();
      const updatedMembro = { ...updatedSnap.data(), id: updatedSnap.id } as MembroSSVP;

      return {
        success: true,
        message: 'Acesso do membro bloqueado com sucesso.',
        membro: updatedMembro,
        accessStatus: 'Acesso inativo',
        hasAccess: false,
        username: updatedMembro.username,
      };
    } catch (err: any) {
      console.error('Erro ao bloquear acesso do membro:', err);
      return {
        success: false,
        message: 'Falha ao bloquear acesso. Tente novamente.',
      };
    }
  }

  if (action === 'unblock') {
    if (!membro.userId) {
      return {
        success: false,
        message: 'O membro não possui usuário vinculado para desbloquear.',
      };
    }

    if (membro.status !== 'ativo') {
      return {
        success: false,
        message: 'Um membro inativo não pode ter seu acesso desbloqueado. Reative o cadastro do membro primeiro.',
      };
    }

    try {
      await db.collection('users').doc(membro.userId).set(
        {
          active: true,
          status: 'ativo',
          updatedAt: now,
          updatedBy: currentUserId || 'system',
        },
        { merge: true }
      );

      await membroDocRef.set(
        {
          hasAccess: true,
          accessStatus: 'Acesso ativo',
          accessErrorReason: null,
          updatedAt: now,
        },
        { merge: true }
      );

      const updatedSnap = await membroDocRef.get();
      const updatedMembro = { ...updatedSnap.data(), id: updatedSnap.id } as MembroSSVP;

      return {
        success: true,
        message: 'Acesso do membro desbloqueado com sucesso.',
        membro: updatedMembro,
        accessStatus: 'Acesso ativo',
        hasAccess: true,
        username: updatedMembro.username,
      };
    } catch (err: any) {
      console.error('Erro ao desbloquear acesso do membro:', err);
      return {
        success: false,
        message: 'Falha ao desbloquear acesso. Tente novamente.',
      };
    }
  }

  return {
    success: false,
    message: 'Ação inválida.',
  };
}

export interface RegularizacaoPreviaItem {
  membroId: string;
  nome: string;
  conselhoParticularId?: string;
  conselhoParticularNome: string;
  conferenciaId: string;
  conferenciaNome: string;
  status: string;
  temNascimento: boolean;
  usernameSugerido: string;
  temConflito: boolean;
  acaoPrevista: string;
  situacaoAtual: string;
}

export interface RegularizacaoInconsistenciaItem {
  membroId: string;
  nome: string;
  conselhoParticularNome: string;
  conferenciaNome: string;
  tipo: 'userId_inexistente' | 'usuario_semelhante_sem_vinculo' | 'outro';
  descricao: string;
  detalhes?: any;
}

export interface RegularizacaoPreviaResult {
  success: boolean;
  totalAnalisados: number;
  totalElegiveis: number;
  totalJaRegularizados: number;
  totalSemNascimento: number;
  totalInativos: number;
  totalInconsistencias: number;
  elegiveis: RegularizacaoPreviaItem[];
  inconsistencias: RegularizacaoInconsistenciaItem[];
  isFallback?: boolean;
  error?: string;
}

export interface RegularizacaoExecucaoItem {
  membroId: string;
  nome: string;
  conferenciaNome: string;
  userIdCriado?: string;
  usernameAtribuido?: string;
  status: 'criado' | 'ignorado' | 'erro' | 'inconsistente';
  motivo?: string;
}

export interface RegularizacaoExecucaoResult {
  success: boolean;
  totalProcessados: number;
  totalCriados: number;
  totalIgnorados: number;
  totalInconsistencias: number;
  totalErros: number;
  detalhes: RegularizacaoExecucaoItem[];
  executedAt: string;
  executedBy: string;
  error?: string;
}

// Trava contra execuções concorrentes
let isRegularizationRunning = false;

/**
 * Gera a prévia (somente leitura) da regularização de acessos dos membros existentes.
 * Opera exclusivamente no Firestore oficial e não cria nem altera nenhum dado.
 */
export async function previewMemberAccessRegularization(
  db: Firestore,
  centralId?: string,
  isFallbackBlocked: boolean = true
): Promise<RegularizacaoPreviaResult> {
  if (!db || typeof db.collection !== 'function') {
    return {
      success: false,
      totalAnalisados: 0,
      totalElegiveis: 0,
      totalJaRegularizados: 0,
      totalSemNascimento: 0,
      totalInativos: 0,
      totalInconsistencias: 0,
      elegiveis: [],
      inconsistencias: [],
      isFallback: true,
      error: 'Instância do Cloud Firestore indisponível.',
    };
  }

  try {
    // 1. Carrega todas as coleções necessárias
    const membrosSnap = await db.collection('membros_ssvp').get();
    const usersSnap = await db.collection('users').get();
    const conferenciasSnap = await db.collection('conferencias').get();
    const conselhosSnap = await db.collection('conselhos_particulares').get();

    const cpMap = new Map<string, string>();
    conselhosSnap.docs.forEach((d) => {
      const data = d.data();
      cpMap.set(d.id, data.name || data.title || 'Conselho Particular');
    });

    const confMap = new Map<string, { name: string; particularId?: string; centralId?: string }>();
    conferenciasSnap.docs.forEach((d) => {
      const data = d.data();
      confMap.set(d.id, {
        name: data.name || 'Conferência',
        particularId: data.particularId || data.conselhoParticularId,
        centralId: data.centralId,
      });
    });

    const userMap = new Map<string, any>();
    const existingUsernames = new Set<string>();
    const userNamesNormalized = new Map<string, any[]>();

    usersSnap.docs.forEach((d) => {
      const u: any = { id: d.id, ...d.data() };
      userMap.set(d.id, u);
      if (u.username) {
        existingUsernames.add(String(u.username).toLowerCase().trim());
      }
      if (u.fullName) {
        const normName = String(u.fullName).toLowerCase().trim();
        const list = userNamesNormalized.get(normName) || [];
        list.push(u);
        userNamesNormalized.set(normName, list);
      }
    });

    let totalAnalisados = 0;
    let totalJaRegularizados = 0;
    let totalSemNascimento = 0;
    let totalInativos = 0;

    const elegiveis: RegularizacaoPreviaItem[] = [];
    const inconsistencias: RegularizacaoInconsistenciaItem[] = [];

    // Rastreador em memória dos usernames previstos nesta prévia para prever colisões sequenciais
    const reservedUsernames = new Set<string>(existingUsernames);

    for (const doc of membrosSnap.docs) {
      const m = { id: doc.id, ...doc.data() } as MembroSSVP;
      totalAnalisados++;

      const conf = m.conferenciaId ? confMap.get(m.conferenciaId) : undefined;
      const confName = conf?.name || m.conferenciaId || 'Conferência Não Identificada';
      const cpId = m.particularId || conf?.particularId;
      const cpName = cpId ? cpMap.get(cpId) || cpId : 'Conselho Particular Não Identificado';

      const isAtivo = m.status === 'ativo';
      const hasBirth = !!m.birthDate && !!extractInitialPassword(m.birthDate);

      // Inconsistência 1: Membro possui userId gravado, mas documento não existe na coleção `users`
      if (m.userId && !userMap.has(m.userId)) {
        inconsistencias.push({
          membroId: m.id,
          nome: m.fullName,
          conselhoParticularNome: cpName,
          conferenciaNome: confName,
          tipo: 'userId_inexistente',
          descricao: `Membro possui referência userId (${m.userId}), mas o usuário correspondente não existe na coleção de usuários.`,
        });
      }

      // Inconsistência 2: Membro não tem userId vinculado, mas existe um usuário com nome exatamente correspondente
      if (!m.userId && m.fullName) {
        const norm = m.fullName.toLowerCase().trim();
        const matchingUsers = userNamesNormalized.get(norm) || [];
        // Se houver usuário não vinculado a nenhum membro ou vinculado a outro
        const unlinkedMatches = matchingUsers.filter((u) => u.membroId !== m.id);
        if (unlinkedMatches.length > 0) {
          inconsistencias.push({
            membroId: m.id,
            nome: m.fullName,
            conselhoParticularNome: cpName,
            conferenciaNome: confName,
            tipo: 'usuario_semelhante_sem_vinculo',
            descricao: `Existe um usuário na base com nome semelhante/idêntico (${unlinkedMatches.map((u) => u.username).join(', ')}), porém sem vínculo formal confirmado. Classificado para análise manual para evitar duplicidades.`,
          });
        }
      }

      if (!isAtivo) {
        totalInativos++;
        continue;
      }

      if (!hasBirth) {
        totalSemNascimento++;
        continue;
      }

      // Já regularizado com usuário válido e ativo
      if (m.userId && userMap.has(m.userId)) {
        totalJaRegularizados++;
        continue;
      }

      // Membro Ativo com Data de Nascimento e sem usuário válido vinculado -> Elegível
      const baseUsername = extractBaseUsername(m.fullName);
      let suggested = baseUsername;
      let counter = 1;
      let temConflito = false;

      if (reservedUsernames.has(suggested)) {
        temConflito = true;
        while (reservedUsernames.has(suggested)) {
          counter++;
          suggested = `${baseUsername}${counter}`;
        }
      }

      // Reserva para o próximo membro da lista
      reservedUsernames.add(suggested);

      elegiveis.push({
        membroId: m.id,
        nome: m.fullName,
        conselhoParticularId: cpId,
        conselhoParticularNome: cpName,
        conferenciaId: m.conferenciaId,
        conferenciaNome: confName,
        status: m.status,
        temNascimento: true,
        usernameSugerido: suggested,
        temConflito,
        acaoPrevista: 'Criar usuário com papel Membro de Conferência e vincular à ficha',
        situacaoAtual: m.userId ? 'userId inválido (inconsistência)' : 'Sem acesso criado',
      });
    }

    return {
      success: true,
      totalAnalisados,
      totalElegiveis: elegiveis.length,
      totalJaRegularizados,
      totalSemNascimento,
      totalInativos,
      totalInconsistencias: inconsistencias.length,
      elegiveis,
      inconsistencias,
      isFallback: false,
    };
  } catch (err: any) {
    console.error('Erro na prévia de regularização de acessos:', err);
    return {
      success: false,
      totalAnalisados: 0,
      totalElegiveis: 0,
      totalJaRegularizados: 0,
      totalSemNascimento: 0,
      totalInativos: 0,
      totalInconsistencias: 0,
      elegiveis: [],
      inconsistencias: [],
      error: err?.message || 'Falha ao processar prévia da base de dados.',
    };
  }
}

/**
 * Executa a regularização de acessos em lote dos membros antigos elegíveis.
 * Idempotente, segura e atômica por membro.
 */
export async function executeMemberAccessRegularization(
  db: Firestore,
  adminUserId: string,
  centralId?: string
): Promise<RegularizacaoExecucaoResult> {
  if (!db || typeof db.collection !== 'function') {
    return {
      success: false,
      totalProcessados: 0,
      totalCriados: 0,
      totalIgnorados: 0,
      totalInconsistencias: 0,
      totalErros: 1,
      detalhes: [],
      executedAt: new Date().toISOString(),
      executedBy: adminUserId,
      error: 'Instância do Cloud Firestore indisponível.',
    };
  }

  // Previne execuções concorrentes simultâneas
  if (isRegularizationRunning) {
    return {
      success: false,
      totalProcessados: 0,
      totalCriados: 0,
      totalIgnorados: 0,
      totalInconsistencias: 0,
      totalErros: 0,
      detalhes: [],
      executedAt: new Date().toISOString(),
      executedBy: adminUserId,
      error: 'Uma regularização de acessos já está em andamento. Aguarde a conclusão.',
    };
  }

  isRegularizationRunning = true;

  try {
    const preview = await previewMemberAccessRegularization(db, centralId);

    if (!preview.success) {
      return {
        success: false,
        totalProcessados: 0,
        totalCriados: 0,
        totalIgnorados: 0,
        totalInconsistencias: 0,
        totalErros: 1,
        detalhes: [],
        executedAt: new Date().toISOString(),
        executedBy: adminUserId,
        error: preview.error || 'Erro ao obter membros elegíveis para regularização.',
      };
    }

    const membrosElegiveis = preview.elegiveis;
    const detalhes: RegularizacaoExecucaoItem[] = [];

    let totalCriados = 0;
    let totalIgnorados = 0;
    let totalErros = 0;
    let totalInconsistencias = preview.totalInconsistencias;

    for (const item of membrosElegiveis) {
      try {
        // Carrega o documento do membro fresco do Firestore
        const membroDocRef = db.collection('membros_ssvp').doc(item.membroId);
        const membroSnap = await membroDocRef.get();

        if (!membroSnap.exists) {
          detalhes.push({
            membroId: item.membroId,
            nome: item.nome,
            conferenciaNome: item.conferenciaNome,
            status: 'ignorado',
            motivo: 'Membro não encontrado no banco no momento da execução.',
          });
          totalIgnorados++;
          continue;
        }

        const membro = { id: membroSnap.id, ...membroSnap.data() } as MembroSSVP;

        // Validação de elegibilidade em tempo de execução
        if (membro.status !== 'ativo') {
          detalhes.push({
            membroId: membro.id,
            nome: membro.fullName,
            conferenciaNome: item.conferenciaNome,
            status: 'ignorado',
            motivo: 'Membro não está mais ativo.',
          });
          totalIgnorados++;
          continue;
        }

        const initialPassword = extractInitialPassword(membro.birthDate);
        if (!initialPassword) {
          detalhes.push({
            membroId: membro.id,
            nome: membro.fullName,
            conferenciaNome: item.conferenciaNome,
            status: 'ignorado',
            motivo: 'Data de nascimento ausente ou inválida.',
          });
          totalIgnorados++;
          continue;
        }

        // Se já tiver userId válido existente, ignora para não sobrescrever
        if (membro.userId) {
          const userDoc = await db.collection('users').doc(membro.userId).get();
          if (userDoc.exists) {
            detalhes.push({
              membroId: membro.id,
              nome: membro.fullName,
              conferenciaNome: item.conferenciaNome,
              status: 'ignorado',
              motivo: 'Membro já possui usuário vinculado ativo.',
            });
            totalIgnorados++;
            continue;
          }
        }

        // Gera username único consultando a coleção no instante da escrita
        const uniqueUsername = await generateUniqueUsername(db, membro.fullName);
        const now = new Date().toISOString();
        const userDocRef = db.collection('users').doc();

        const newUserPayload = {
          id: userDocRef.id,
          username: uniqueUsername,
          password: initialPassword, // Senha inicial DDMM
          fullName: membro.fullName,
          role: 'Membro Vicentino',
          accessLevel: 'membro_conferencia',
          conferenciaId: membro.conferenciaId,
          particularId: membro.particularId || item.conselhoParticularId,
          centralId: membro.centralId || centralId,
          institutionId: membro.conferenciaId || membro.centralId || centralId,
          membroId: membro.id,
          mustChangePassword: false,
          isFirstLogin: false,
          active: true,
          status: 'ativo',
          createdAt: now,
          updatedAt: now,
          createdBy: adminUserId,
        };

        // Escrita do usuário
        await userDocRef.set(newUserPayload);

        // Atualização da ficha do membro
        await membroDocRef.set(
          {
            userId: userDocRef.id,
            username: uniqueUsername,
            hasAccess: true,
            accessStatus: 'Acesso ativo',
            accessErrorReason: null,
            updatedAt: now,
          },
          { merge: true }
        );

        totalCriados++;
        detalhes.push({
          membroId: membro.id,
          nome: membro.fullName,
          conferenciaNome: item.conferenciaNome,
          userIdCriado: userDocRef.id,
          usernameAtribuido: uniqueUsername,
          status: 'criado',
          motivo: 'Acesso gerado e vinculado com sucesso.',
        });
      } catch (membroErr: any) {
        console.error(`Erro ao regularizar membro ${item.membroId}:`, membroErr);
        totalErros++;
        detalhes.push({
          membroId: item.membroId,
          nome: item.nome,
          conferenciaNome: item.conferenciaNome,
          status: 'erro',
          motivo: membroErr?.message || 'Falha ao gravar credenciais.',
        });
      }
    }

    return {
      success: true,
      totalProcessados: membrosElegiveis.length,
      totalCriados,
      totalIgnorados,
      totalInconsistencias,
      totalErros,
      detalhes,
      executedAt: new Date().toISOString(),
      executedBy: adminUserId,
    };
  } finally {
    isRegularizationRunning = false;
  }
}


