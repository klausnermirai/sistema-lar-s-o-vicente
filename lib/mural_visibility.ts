import { isUserAuthorizedForInstitution, normalizeUserAccessLevel } from './canonical_units.ts';

/**
 * Validação segura de escopo para documentos individuais:
 * - Registros sem instituição comprovada são inacessíveis por padrão para usuários comuns
 *   (não assumir que pertencem à unidade do solicitante).
 * - Registros com instituição são checados estritamente contra as permissões do usuário.
 * - Super administradores globais retêm acesso.
 */
export function isAuthorizedForDocument(user: any, docData: any): boolean {
  if (!user || !docData) return false;

  if (
    user.isGlobalAdmin === true ||
    user.hasAllUnitsAccess === true ||
    user.username === 'kwarizaya@gmail.com' ||
    user.email === 'kwarizaya@gmail.com'
  ) {
    return true;
  }

  if (!docData.institutionId || typeof docData.institutionId !== 'string' || docData.institutionId.trim() === '') {
    return false;
  }

  return isUserAuthorizedForInstitution(user, docData.institutionId);
}

/**
 * Regra unificada de visibilidade de mensagens do mural (usada na listagem e na consulta individual):
 * - Sempre mantém a verificação institucional.
 * - Mensagem privada: somente o autor (author, authorUserId ou authorEmail).
 * - Mensagem restrita: preservar os perfis atualmente autorizados (viewAdminRoles).
 * - Mensagem pública: qualquer usuário autenticado com acesso à instituição.
 */
export function isUserAuthorizedToViewMuralMessage(user: any, msg: any): boolean {
  if (!user || !msg) return false;

  // 1. Sempre manter a verificação institucional
  if (!isAuthorizedForDocument(user, msg)) {
    return false;
  }

  const username = user.username;
  const accessLevel = normalizeUserAccessLevel(user.accessLevel || user.role);
  const isAuthor =
    (msg.author && msg.author === username) ||
    (msg.authorUserId && msg.authorUserId === user.id) ||
    (msg.authorEmail && msg.authorEmail === username);

  let visArray: string[] = [];
  if (Array.isArray(msg.visibilidade)) {
    visArray = msg.visibilidade;
  } else if (typeof msg.visibilidade === 'string') {
    visArray = [msg.visibilidade];
  } else if (msg.isPublic) {
    visArray = ['publico'];
  } else {
    visArray = ['admin'];
  }

  if (visArray.includes('publico')) {
    return true;
  }

  if (visArray.includes('privado')) {
    return Boolean(isAuthor);
  }

  if (visArray.includes('admin')) {
    const viewAdminRoles = [
      'administrador',
      'gerencial',
      'enfermeira',
      'medico',
      'psicologia',
      'terapeuta_ocupacional',
      'fisioterapeuta',
      'nutricionista',
      'assistente_social'
    ];
    return Boolean(isAuthor || viewAdminRoles.includes(accessLevel));
  }

  return true;
}
