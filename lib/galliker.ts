/**
 * Hand-over of transport orders to Galliker Logistics.
 *
 * Two modes, chosen with GALLIKER_MODE:
 *   sandbox (default)  Simulated Galliker: validates the message like the real
 *                      endpoint would and answers with a test reference. Needs no setup.
 *   http               POSTs the same JSON to GALLIKER_API_URL/transport-orders with
 *                      GALLIKER_API_KEY as bearer token and an idempotency key, so a
 *                      retried send never creates a second order at Galliker.
 *
 * This module is pure (no database). lib/services.ts records every attempt.
 */

export type GallikerMode = 'SANDBOX' | 'HTTP';

export interface GallikerConfig {
  mode: GallikerMode;
  /** Base URL, only for HTTP mode. */
  url?: string;
  apiKey?: string;
  timeoutMs: number;
}

export function gallikerConfig(env: Record<string, string | undefined> = process.env): GallikerConfig {
  const mode: GallikerMode = env.GALLIKER_MODE?.toLowerCase() === 'http' ? 'HTTP' : 'SANDBOX';
  return {
    mode,
    url: env.GALLIKER_API_URL?.replace(/\/+$/, ''),
    apiKey: env.GALLIKER_API_KEY,
    timeoutMs: Number(env.GALLIKER_TIMEOUT_MS) || 10_000,
  };
}

/** Version of the message format, so Galliker can evolve its parser. */
export const PAYLOAD_VERSION = '1.2';

export interface GallikerOrderPayload {
  version: string;
  /** Our order id; Galliker must treat repeated sends with the same id as the same order. */
  externalOrderId: string;
  createdAt: string;
  pickup: {
    company: string;
    address: string;
    contactName: string | null;
    phone: string | null;
    window: { start: string; end: string };
  };
  /** Strictest storage requirement of the load, e.g. to pick a refrigerated truck. */
  temperatureRequirement: 'FROZEN' | 'CHILLED' | 'AMBIENT' | 'MIXED';
  items: {
    reservationId: number;
    product: string;
    category: string;
    storage: string;
    /** How the goods are packed (since 1.2), null when the donor gave none. */
    packagingUnit: string | null;
    pallets: number;
    weightKg: number;
    /** Weight of each pallet in kg (since 1.1): pallets of one product may weigh differently. */
    palletWeightsKg: number[];
    bestBefore: string;
    deliverTo: { institution: string; address: string };
  }[];
  totals: { pallets: number; weightKg: number; stops: number };
}

interface OrderForPayload {
  id: number;
  createdAt: Date;
  pickupStart: Date;
  pickupEnd: Date;
  donor: { organizationName: string; address: string; contactName: string | null; phone: string | null };
  claims: {
    id: number;
    pallets: number;
    palletNumbers: number[];
    weightKg: number;
    donation: { productName: string; category: string; temperatureRange: string; packagingUnit: string | null; palletWeights: number[]; bestBeforeDate: string; pickupAddress: string };
    foodbank: { organizationName: string; address: string };
  }[];
}

const COLD = new Set(['COOL', 'CHILLED', 'SUPERCHILLED']);

function temperatureRequirement(storages: string[]): GallikerOrderPayload['temperatureRequirement'] {
  const hasFrozen = storages.includes('FROZEN');
  const hasCold = storages.some((s) => COLD.has(s));
  if (hasFrozen && (hasCold || storages.some((s) => s === 'AMBIENT'))) return 'MIXED';
  if (hasFrozen) return 'FROZEN';
  if (hasCold) return 'CHILLED';
  // Own descriptions ("+8 bis +12 °C") are not a known preset; flag them for a person to check.
  return storages.every((s) => s === 'AMBIENT') ? 'AMBIENT' : 'MIXED';
}

export function buildGallikerPayload(order: OrderForPayload): GallikerOrderPayload {
  const items = order.claims.map((c) => ({
    reservationId: c.id,
    product: c.donation.productName,
    category: c.donation.category,
    storage: c.donation.temperatureRange,
    packagingUnit: c.donation.packagingUnit,
    pallets: c.pallets,
    weightKg: Math.round(c.weightKg * 10) / 10,
    palletWeightsKg: c.palletNumbers.map((n) => c.donation.palletWeights[n - 1]),
    bestBefore: c.donation.bestBeforeDate,
    deliverTo: { institution: c.foodbank.organizationName, address: c.foodbank.address },
  }));
  return {
    version: PAYLOAD_VERSION,
    externalOrderId: `FB-${order.id}`,
    createdAt: order.createdAt.toISOString(),
    pickup: {
      company: order.donor.organizationName,
      // Every reservation of an order shares one pickup address (see planBundling).
      address: order.claims[0]?.donation.pickupAddress ?? order.donor.address,
      contactName: order.donor.contactName,
      phone: order.donor.phone,
      window: { start: order.pickupStart.toISOString(), end: order.pickupEnd.toISOString() },
    },
    temperatureRequirement: temperatureRequirement(items.map((i) => i.storage)),
    items,
    totals: {
      pallets: items.reduce((s, i) => s + i.pallets, 0),
      weightKg: Math.round(items.reduce((s, i) => s + i.weightKg, 0) * 10) / 10,
      stops: new Set(items.map((i) => i.deliverTo.address)).size,
    },
  };
}

export type GallikerResult =
  | { ok: true; reference: string; httpStatus?: number; response: unknown; endpoint?: string }
  | { ok: false; error: string; httpStatus?: number; response?: unknown; endpoint?: string };

/** The checks the sandbox applies, mirroring what a real endpoint would reject. */
export function validatePayload(p: GallikerOrderPayload): string | null {
  if (p.items.length === 0) return 'Auftrag ohne Positionen';
  if (!p.pickup.address.trim()) return 'Abholadresse fehlt';
  if (new Date(p.pickup.window.end) < new Date(p.pickup.window.start)) return 'Abholfenster endet vor dem Beginn';
  if (p.items.some((i) => i.pallets < 1)) return 'Position ohne Paletten';
  if (p.items.some((i) => !i.deliverTo.address.trim())) return 'Lieferadresse fehlt';
  return null;
}

function sandboxReference(externalOrderId: string): string {
  let h = 0;
  for (const ch of externalOrderId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `GLK-TEST-${externalOrderId.replace(/\D/g, '').padStart(5, '0')}-${(h % 46656).toString(36).toUpperCase().padStart(3, '0')}`;
}

export async function transmitToGalliker(
  payload: GallikerOrderPayload,
  config: GallikerConfig = gallikerConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<GallikerResult> {
  if (config.mode === 'SANDBOX') {
    const problem = validatePayload(payload);
    if (problem) return { ok: false, error: `Galliker (Test) lehnt ab: ${problem}`, httpStatus: 422, response: { accepted: false, reason: problem } };
    const reference = sandboxReference(payload.externalOrderId);
    return { ok: true, reference, httpStatus: 201, response: { accepted: true, reference, environment: 'sandbox' } };
  }

  if (!config.url) return { ok: false, error: 'GALLIKER_API_URL ist nicht gesetzt.' };
  const endpoint = `${config.url}/transport-orders`;
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': payload.externalOrderId,
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
    if (!res.ok) {
      return { ok: false, error: `Galliker antwortet mit Fehler ${res.status}.`, httpStatus: res.status, response: body, endpoint };
    }
    const reference = (body as { reference?: unknown } | null)?.reference;
    if (typeof reference !== 'string' || !reference) {
      return { ok: false, error: 'Galliker hat keine Auftragsnummer zurückgegeben.', httpStatus: res.status, response: body, endpoint };
    }
    return { ok: true, reference, httpStatus: res.status, response: body, endpoint };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return { ok: false, error: timedOut ? 'Galliker hat nicht rechtzeitig geantwortet.' : 'Galliker ist nicht erreichbar.', endpoint };
  }
}
