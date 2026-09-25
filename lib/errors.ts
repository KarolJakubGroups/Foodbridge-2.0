/**
 * Infrastructure failures, kept apart from business-rule violations (DomainError)
 * so users get a message that tells them what to do.
 */

/** Digest the error pages recognise. Next.js keeps a digest that is already set. */
export const DB_UNAVAILABLE_DIGEST = 'FOODBRIDGE_DB_UNAVAILABLE';

export const MESSAGES = {
  database: 'Die Datenbank ist gerade nicht erreichbar. Es wurde nichts gespeichert. Bitte versuchen Sie es in einer Minute erneut.',
  network: 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
  unexpected: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
  login: 'E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie Ihre Eingabe.',
} as const;

export class DatabaseUnavailableError extends Error {
  readonly digest = DB_UNAVAILABLE_DIGEST;
  constructor(cause?: unknown) {
    super('Database unavailable', { cause });
    this.name = 'DatabaseUnavailableError';
  }
}

/** Driver-adapter error kinds that mean "cannot talk to the database", not "bad query". */
const UNREACHABLE_KINDS = new Set([
  'DatabaseNotReachable', 'DatabaseDoesNotExist', 'AuthenticationFailed', 'ConnectionClosed', 'SocketTimeout',
  'TlsConnectionError', 'TooManyConnections', 'DatabaseAccessDenied',
]);
const NETWORK_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH']);

/**
 * True for connection-level failures: Prisma P1xxx codes (server unreachable,
 * authentication, timeouts), pool timeouts (P2024), initialisation errors and
 * raw socket errors. Query errors such as constraint violations return false.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (error instanceof DatabaseUnavailableError) return true;
  const e = error as { name?: string; code?: unknown; message?: unknown; meta?: { driverAdapterError?: { cause?: { kind?: string } } }; cause?: unknown };
  if (e.name === 'PrismaClientInitializationError' || e.name === 'PrismaClientRustPanicError') return true;
  if (typeof e.code === 'string' && (/^P1\d{3}$/.test(e.code) || e.code === 'P2024')) return true;
  if (typeof e.code === 'string' && NETWORK_CODES.has(e.code)) return true;
  const kind = e.meta?.driverAdapterError?.cause?.kind;
  if (kind && UNREACHABLE_KINDS.has(kind)) return true;
  if (typeof e.message === 'string' && /Connection terminated|timeout exceeded when trying to connect|Can't reach database server/i.test(e.message)) return true;
  return e.cause !== undefined && e.cause !== error ? isDatabaseUnavailable(e.cause) : false;
}

/** A failed fetch in the browser: offline, DNS, dropped connection. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'TypeError' && /fetch|network|load failed|connection/i.test(error.message);
}
