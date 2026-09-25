import { unstable_rethrow } from 'next/navigation';
import { MESSAGES, isNetworkError } from '@/lib/errors';
import type { ActionResult } from '@/lib/types';

/**
 * Calls a server action from the browser and never throws for connection problems:
 * offline or a dropped request becomes a result with a clear message instead of a
 * crash. Redirects (for example an expired session) are passed on to Next.js.
 */
export async function callAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: MESSAGES.network };
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: isNetworkError(error) ? MESSAGES.network : MESSAGES.unexpected };
  }
}
