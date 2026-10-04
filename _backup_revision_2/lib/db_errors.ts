import type express from 'express';

export const isProductionEnvironment =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.K_SERVICE) ||
  Boolean(process.env.GAE_SERVICE);

export const canUseLocalFallback =
  !isProductionEnvironment &&
  process.env.DISABLE_LOCAL_DB_FALLBACK !== 'true';

export class DatabaseUnavailableError extends Error {
  isDbUnavailable = true;
  constructor(message?: string) {
    super(message || "O banco de dados está temporariamente indisponível. Tente novamente em alguns minutos.");
    this.name = "DatabaseUnavailableError";
  }
}

export function isDbUnavailableError(error: any, isUsingFallback = false, activeDb: any = true): boolean {
  if (!error) return false;

  const code = error.code;
  const status = error.status || error.statusCode;
  const msg = String(error.message || error);

  // Business, Auth, Validation & Not Found errors MUST NOT be treated as DB unavailability
  if (
    code === 5 || code === '5' || code === 'NOT_FOUND' ||
    status === 400 || status === 401 || status === 403 || status === 404 || status === 409 ||
    msg.startsWith('NOT_FOUND')
  ) {
    return false;
  }

  if (error.isDbUnavailable || error instanceof DatabaseUnavailableError || error.name === "DatabaseUnavailableError") return true;

  if (!canUseLocalFallback && (isUsingFallback || !activeDb)) return true;

  if (
    code === 8 || code === '8' || code === 'RESOURCE_EXHAUSTED' ||
    code === 14 || code === '14' || code === 'UNAVAILABLE' ||
    code === 4 || code === '4' || code === 'DEADLINE_EXCEEDED'
  ) {
    return true;
  }

  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('DATABASE_TEMPORARILY_UNAVAILABLE') ||
    msg.includes('database does not exist') ||
    msg.includes('Database does not exist') ||
    msg.includes('database not found') ||
    msg.includes('Database not found') ||
    msg.includes('Project not found') ||
    msg.includes('project not found')
  ) {
    return true;
  }

  return false;
}

export function sendDatabaseError(res: express.Response, error: any, fallbackMessage = 'Erro interno no servidor', defaultStatusCode = 500) {
  if (isDbUnavailableError(error)) {
    console.error('Database unavailable error:', error?.message || error);
    return res.status(503).json({
      error: 'DATABASE_TEMPORARILY_UNAVAILABLE',
      message: 'O banco de dados está temporariamente indisponível. Tente novamente em alguns minutos.'
    });
  }

  const status = error.status || error.statusCode || defaultStatusCode;
  const msg = error.clientMessage || fallbackMessage;

  console.error('API Error:', error);
  return res.status(status).json({ error: msg });
}

export const handleApiError = sendDatabaseError;
