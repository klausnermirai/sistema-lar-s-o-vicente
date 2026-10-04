import { maskSensitiveValue } from './hierarchy_utils.js';

export interface InternalUserMock {
  id: string;
  email?: string | null;
  fullName?: string;
  status?: 'ativo' | 'inativo' | string;
  authUid?: string | null;
}

export interface ExistingFirebaseAuthAccountMock {
  uid: string;
  email: string;
}

export type MigrationActionType =
  | 'CREATE_AUTH_ACCOUNT'
  | 'REVIEW_EXISTING_AUTH_LINK'
  | 'ALREADY_LINKED'
  | 'CONFLICT_AUTHUID_EMAIL'
  | 'CONFLICT_AUTHUID_NOT_FOUND'
  | 'BLOCK_DUPLICATE_AUTHUID'
  | 'IGNORE_INACTIVE'
  | 'REJECT_INVALID_EMAIL'
  | 'BLOCK_DUPLICATE_EMAIL';

export interface UserMigrationItemPlan {
  userId: string;
  email: string;
  maskedEmail: string;
  action: MigrationActionType;
  reason: string;
  targetAuthUid?: string;
  requiresManualReview?: boolean;
}

export interface MigrationPlanResult {
  migrationId: string;
  isDryRun: true;
  timestamp: string;
  totals: {
    totalUsersProcessed: number;
    createAccountCount: number;
    reviewExistingLinkCount: number;
    alreadyLinkedCount: number;
    conflictCount: number;
    ignoredInactiveCount: number;
    rejectedInvalidEmailCount: number;
    blockedDuplicateEmailCount: number;
    blockedDuplicateAuthUidCount: number;
  };
  details: UserMigrationItemPlan[];
}

/**
 * Valida sintaticamente se uma string é um e-mail com formato válido.
 */
function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleanEmail);
}

/**
 * Gera um plano puro e determinístico de migração em memória (modo dry-run por padrão).
 */
export function planUserMigration(
  internalUsers: InternalUserMock[],
  existingAuthAccounts: ExistingFirebaseAuthAccountMock[],
  migrationId: string
): MigrationPlanResult {
  const details: UserMigrationItemPlan[] = [];

  const totals = {
    totalUsersProcessed: internalUsers.length,
    createAccountCount: 0,
    reviewExistingLinkCount: 0,
    alreadyLinkedCount: 0,
    conflictCount: 0,
    ignoredInactiveCount: 0,
    rejectedInvalidEmailCount: 0,
    blockedDuplicateEmailCount: 0,
    blockedDuplicateAuthUidCount: 0,
  };

  // Mapear frequência de e-mails para identificar duplicidades entre usuários internos
  const emailCounts = new Map<string, number>();
  // Mapear frequência de authUid entre usuários internos
  const authUidCounts = new Map<string, number>();

  for (const user of internalUsers) {
    if (user.email && isValidEmail(user.email)) {
      const normalizedEmail = user.email.trim().toLowerCase();
      emailCounts.set(normalizedEmail, (emailCounts.get(normalizedEmail) || 0) + 1);
    }
    if (user.authUid && user.authUid.trim().length > 0) {
      const cleanUid = user.authUid.trim();
      authUidCounts.set(cleanUid, (authUidCounts.get(cleanUid) || 0) + 1);
    }
  }

  // Mapear contas do Firebase Auth existentes por e-mail e por UID
  const authAccountByEmail = new Map<string, ExistingFirebaseAuthAccountMock>();
  const authAccountByUid = new Map<string, ExistingFirebaseAuthAccountMock>();

  for (const acc of existingAuthAccounts) {
    if (acc.email && acc.uid) {
      const normEmail = acc.email.trim().toLowerCase();
      authAccountByEmail.set(normEmail, acc);
      authAccountByUid.set(acc.uid, acc);
    }
  }

  for (const user of internalUsers) {
    const userId = user.id;
    const rawEmail = user.email ? user.email.trim() : '';
    const normalizedEmail = rawEmail.toLowerCase();
    const maskedEmail = rawEmail ? maskSensitiveValue('email', rawEmail) : '';
    const isInactive = user.status === 'inativo';
    const hasValidEmail = isValidEmail(rawEmail);

    // 1. Rejeitar e-mail inválido
    if (!hasValidEmail) {
      totals.rejectedInvalidEmailCount++;
      details.push({
        userId,
        email: rawEmail,
        maskedEmail,
        action: 'REJECT_INVALID_EMAIL',
        reason: 'O e-mail do usuário está ausente ou em formato sintaticamente inválido.',
      });
      continue;
    }

    // 2. Ignorar usuário inativo
    if (isInactive) {
      totals.ignoredInactiveCount++;
      details.push({
        userId,
        email: rawEmail,
        maskedEmail,
        action: 'IGNORE_INACTIVE',
        reason: 'Usuário marcado como inativo. Nenhuma conta no Firebase Auth será criada ou vinculada.',
      });
      continue;
    }

    // 3. Bloquear e-mails duplicados entre usuários internos
    if ((emailCounts.get(normalizedEmail) || 0) > 1) {
      totals.blockedDuplicateEmailCount++;
      details.push({
        userId,
        email: rawEmail,
        maskedEmail,
        action: 'BLOCK_DUPLICATE_EMAIL',
        reason: 'O e-mail é compartilhado por múltiplos usuários no sistema interno. Requer correção prévia.',
      });
      continue;
    }

    // 4. Bloquear authUid duplicado entre usuários internos
    if (user.authUid && (authUidCounts.get(user.authUid.trim()) || 0) > 1) {
      totals.blockedDuplicateAuthUidCount++;
      details.push({
        userId,
        email: rawEmail,
        maskedEmail,
        action: 'BLOCK_DUPLICATE_AUTHUID',
        reason: `O authUid (${user.authUid.trim()}) está atribuído a múltiplos usuários no cadastro interno.`,
        targetAuthUid: user.authUid.trim(),
      });
      continue;
    }

    const authAccByEmailMatch = authAccountByEmail.get(normalizedEmail);

    // 5. Usuário já possui authUid preenchido no cadastro interno
    if (user.authUid && user.authUid.trim().length > 0) {
      const existingUid = user.authUid.trim();

      const authAccByUidMatch = authAccountByUid.get(existingUid);

      // 5a. authUid não foi encontrado na base do Firebase Auth
      if (!authAccByUidMatch) {
        totals.conflictCount++;
        details.push({
          userId,
          email: rawEmail,
          maskedEmail,
          action: 'CONFLICT_AUTHUID_NOT_FOUND',
          reason: `O authUid (${existingUid}) associado ao usuário não foi encontrado na base de contas do Firebase Auth.`,
          targetAuthUid: existingUid,
        });
        continue;
      }

      // 5b. Verificar se o e-mail da conta no Firebase Auth diverge do e-mail do usuário interno
      if (authAccByUidMatch.email.trim().toLowerCase() !== normalizedEmail) {
        totals.conflictCount++;
        details.push({
          userId,
          email: rawEmail,
          maskedEmail,
          action: 'CONFLICT_AUTHUID_EMAIL',
          reason: `Conflito de identidade: O authUid (${existingUid}) pertence no Firebase Auth ao e-mail ${maskSensitiveValue('email', authAccByUidMatch.email)}, divergindo do usuário.`,
          targetAuthUid: existingUid,
        });
        continue;
      }

      // 5c. Verificar se a busca por e-mail retornou um UID diferente
      if (authAccByEmailMatch && authAccByEmailMatch.uid !== existingUid) {
        totals.conflictCount++;
        details.push({
          userId,
          email: rawEmail,
          maskedEmail,
          action: 'CONFLICT_AUTHUID_EMAIL',
          reason: `Conflito de identidade: O authUid do usuário (${existingUid}) diverge do UID (${authAccByEmailMatch.uid}) associado a este e-mail no Firebase Auth.`,
          targetAuthUid: existingUid,
        });
        continue;
      }

      totals.alreadyLinkedCount++;
      details.push({
        userId,
        email: rawEmail,
        maskedEmail,
        action: 'ALREADY_LINKED',
        reason: 'Usuário já está vinculado corretamente ao authUid informado.',
        targetAuthUid: existingUid,
      });
      continue;
    }

    // 6. Usuário sem authUid, mas conta já existe no Firebase Auth por e-mail (Requer Revisão Manual Obligatória)
    if (authAccByEmailMatch) {
      totals.reviewExistingLinkCount++;
      details.push({
        userId,
        email: rawEmail,
        maskedEmail,
        action: 'REVIEW_EXISTING_AUTH_LINK',
        reason: 'Coincidência de e-mail encontrada no Firebase Auth. Requer revisão manual prévia antes de qualquer vínculo.',
        targetAuthUid: authAccByEmailMatch.uid,
        requiresManualReview: true,
      });
      continue;
    }

    // 7. Usuário sem authUid e sem conta no Firebase Auth -> Criar conta
    totals.createAccountCount++;
    details.push({
      userId,
      email: rawEmail,
      maskedEmail,
      action: 'CREATE_AUTH_ACCOUNT',
      reason: 'Nova conta a ser criada no Firebase Auth com emailVerified: false e vinculada ao usuário.',
    });
  }

  return {
    migrationId,
    isDryRun: true,
    timestamp: new Date().toISOString(),
    totals,
    details,
  };
}

/**
 * Higieniza o relatório do plano para gravação segura em `migrationLogs`,
 * removendo e-mails brutos e mantendo exclusivamente e-mails mascarados.
 */
export function sanitizePlanForMigrationLogs(plan: MigrationPlanResult) {
  return {
    ...plan,
    details: plan.details.map(({ email, ...rest }) => ({
      ...rest,
      email: rest.maskedEmail, // Substitui o e-mail bruto pelo mascarado
    })),
  };
}

