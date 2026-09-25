import 'server-only';
import { prisma } from '@/lib/db';
import { normalizeAddress } from '@/lib/domain';

/**
 * Coordinates and driving routes for the dispatcher map.
 *
 * Geocoding uses Nominatim (OpenStreetMap), routing uses OSRM. Both public
 * servers are fine for a demo but have usage limits (Nominatim: 1 request per
 * second, a descriptive User-Agent). For production set GEOCODER_URL and
 * ROUTING_URL to your own or a commercial instance. Results are cached in the
 * database, so every address is looked up once and every order routed once.
 */

export interface LatLng { lat: number; lng: number }

const GEOCODER_URL = () => (process.env.GEOCODER_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
const ROUTING_URL = () => (process.env.ROUTING_URL ?? 'https://router.project-osrm.org').replace(/\/+$/, '');
const USER_AGENT = () => process.env.GEOCODER_USER_AGENT ?? 'FoodBridge/2.0 (Schweizer Tafel logistics demo)';
const TIMEOUT_MS = 8000;
/** A failed lookup is retried after this long, not on every page load. */
const RETRY_FAILED_AFTER_MS = 24 * 3_600_000;
/** Nominatim's usage policy: at most one request per second. */
const GEOCODER_SPACING_MS = 1100;

export type FetchLike = typeof fetch;

/** One Nominatim lookup, restricted to Switzerland. */
export async function geocodeAddress(address: string, fetchImpl: FetchLike = fetch): Promise<(LatLng & { displayName: string }) | null> {
  const url = `${GEOCODER_URL()}/search?format=jsonv2&limit=1&countrycodes=ch&q=${encodeURIComponent(address)}`;
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT(), 'Accept-Language': 'de' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const hit = hits[0];
  if (!hit) return null;
  const lat = Number(hit.lat); const lng = Number(hit.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, displayName: hit.display_name } : null;
}

let lastGeocodeAt = 0;
async function politePause() {
  const wait = lastGeocodeAt + GEOCODER_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();
}

/**
 * Coordinates for each address, from the cache or looked up and cached.
 * At most `maxLookups` new lookups per call keep a page load fast; the rest
 * are filled in on later loads. Addresses that cannot be found map to null.
 */
export async function coordinatesFor(addresses: string[], { maxLookups = 5, fetchImpl = fetch as FetchLike } = {}): Promise<Map<string, LatLng | null>> {
  const keys = [...new Set(addresses.map(normalizeAddress).filter(Boolean))];
  const cached = await prisma.geocodedAddress.findMany({ where: { query: { in: keys } } });
  const byKey = new Map(cached.map((c) => [c.query, c]));
  const result = new Map<string, LatLng | null>();

  let lookups = 0;
  for (const key of keys) {
    const hit = byKey.get(key);
    if (hit && (hit.latitude !== null || Date.now() - hit.lookedUpAt.getTime() < RETRY_FAILED_AFTER_MS)) {
      result.set(key, hit.latitude !== null && hit.longitude !== null ? { lat: hit.latitude, lng: hit.longitude } : null);
      continue;
    }
    if (lookups >= maxLookups) { result.set(key, null); continue; }
    lookups += 1;
    try {
      await politePause();
      const found = await geocodeAddress(key, fetchImpl);
      await prisma.geocodedAddress.upsert({
        where: { query: key },
        create: { query: key, latitude: found?.lat ?? null, longitude: found?.lng ?? null, displayName: found?.displayName ?? null },
        update: { latitude: found?.lat ?? null, longitude: found?.lng ?? null, displayName: found?.displayName ?? null, lookedUpAt: new Date() },
      });
      result.set(key, found ? { lat: found.lat, lng: found.lng } : null);
    } catch {
      // Service down or slow: show the rest of the map, try again on the next load.
      result.set(key, null);
    }
  }
  return result;
}

export function lookup(map: Map<string, LatLng | null>, address: string): LatLng | null {
  return map.get(normalizeAddress(address)) ?? null;
}

/** Straight-line distance in km, used to order delivery stops. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Pickup first, then always the nearest remaining delivery stop. */
export function orderStops(pickup: LatLng, stops: LatLng[]): LatLng[] {
  const rest = [...stops];
  const route = [pickup];
  let here = pickup;
  while (rest.length) {
    rest.sort((a, b) => distanceKm(here, a) - distanceKm(here, b));
    here = rest.shift()!;
    route.push(here);
  }
  return route;
}

export interface Route { coordinates: [number, number][]; distanceKm: number; durationMin: number }

/** Driving route through the points in order ([lng, lat] pairs for GeoJSON). */
export async function fetchRoute(points: LatLng[], fetchImpl: FetchLike = fetch): Promise<Route | null> {
  if (points.length < 2) return null;
  const path = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const res = await fetchImpl(`${ROUTING_URL()}/route/v1/driving/${path}?overview=full&geometries=geojson`, {
    headers: { 'User-Agent': USER_AGENT() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { code?: string; routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
  const r = body.code === 'Ok' ? body.routes?.[0] : undefined;
  if (!r) return null;
  return { coordinates: r.geometry.coordinates, distanceKm: Math.round(r.distance / 100) / 10, durationMin: Math.round(r.duration / 60) };
}

/** Route of an order, computed once and cached on the order. */
export async function routeForOrder(orderId: number, points: LatLng[], fetchImpl: FetchLike = fetch): Promise<Route | null> {
  const order = await prisma.transportOrder.findUnique({
    where: { id: orderId }, select: { routeGeometry: true, routeDistanceKm: true, routeDurationMin: true, routeComputedAt: true },
  });
  if (order?.routeGeometry && order.routeDistanceKm !== null && order.routeDurationMin !== null) {
    return { coordinates: order.routeGeometry as [number, number][], distanceKm: order.routeDistanceKm, durationMin: order.routeDurationMin };
  }
  // A failed attempt is retried after a while, not on every load.
  if (order?.routeComputedAt && Date.now() - order.routeComputedAt.getTime() < RETRY_FAILED_AFTER_MS / 24) return null;
  let route: Route | null = null;
  try { route = await fetchRoute(points, fetchImpl); } catch { route = null; }
  await prisma.transportOrder.update({
    where: { id: orderId },
    data: route
      ? { routeGeometry: route.coordinates, routeDistanceKm: route.distanceKm, routeDurationMin: route.durationMin, routeComputedAt: new Date() }
      : { routeComputedAt: new Date() },
  });
  return route;
}
