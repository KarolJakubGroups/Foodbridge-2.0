import 'server-only';
import { after } from 'next/server';
import { prisma } from '@/lib/db';
import { coordinatesFor, lookup, orderStops, routeForOrder, type LatLng } from '@/lib/geo';
import { normalizeAddress } from '@/lib/domain';
import { tempKind } from '@/lib/format';

/** Everything the dispatcher map draws. Plain data so it can be passed to the client. */
export interface MapStop { name: string; address: string; pallets: number; point: LatLng | null }
export interface MapOrder {
  id: number;
  status: 'PENDING' | 'DISPATCHED';
  donor: string;
  pickup: { address: string; point: LatLng | null };
  stops: MapStop[];
  window: { start: string; end: string };
  pallets: number;
  weightKg: number;
  cold: 'frozen' | 'chilled' | null;
  route: [number, number][] | null;
  distanceKm: number | null;
  durationMin: number | null;
}
export interface MapWaiting { key: string; donor: string; address: string; point: LatLng | null; reservations: number; pallets: number; weightKg: number }
export interface MapData { orders: MapOrder[]; waiting: MapWaiting[]; unlocated: string[] }

/** New lookups done while the page renders; the rest continue after the response. */
const LOOKUPS_PER_REQUEST = 3;

export async function buildDispatchMap(): Promise<MapData> {
  const [orders, waitingClaims] = await Promise.all([
    prisma.transportOrder.findMany({
      where: { status: { in: ['PENDING', 'DISPATCHED'] } },
      include: {
        donor: { select: { organizationName: true } },
        claims: { include: { donation: { select: { pickupAddress: true, temperatureRange: true } }, foodbank: { select: { id: true, organizationName: true, address: true } } } },
      },
      orderBy: { pickupStart: 'asc' },
    }),
    prisma.claim.findMany({
      where: { status: 'RESERVED', transportOrderId: null },
      include: { donation: { select: { donorId: true, pickupAddress: true, donor: { select: { organizationName: true } } } } },
    }),
  ]);

  const addresses = [
    ...orders.flatMap((o) => [o.claims[0]?.donation.pickupAddress ?? '', ...o.claims.map((c) => c.foodbank.address)]),
    ...waitingClaims.map((c) => c.donation.pickupAddress),
  ].filter(Boolean);
  const points = await coordinatesFor(addresses, { maxLookups: LOOKUPS_PER_REQUEST });
  const missing = [...new Set(addresses.map(normalizeAddress))].filter((a) => !points.get(a));
  if (missing.length > 0) {
    // Keep looking up in the background so the next load is complete.
    after(() => coordinatesFor(missing, { maxLookups: 20 }).then(() => undefined, () => undefined));
  }

  const mapOrders: MapOrder[] = await Promise.all(orders.map(async (o) => {
    const pickupAddress = o.claims[0]?.donation.pickupAddress ?? '';
    const pickup = lookup(points, pickupAddress);
    const byFoodbank = new Map<string, MapStop>();
    for (const c of o.claims) {
      const s = byFoodbank.get(c.foodbank.id) ?? { name: c.foodbank.organizationName, address: c.foodbank.address, pallets: 0, point: lookup(points, c.foodbank.address) };
      s.pallets += c.pallets;
      byFoodbank.set(c.foodbank.id, s);
    }
    const stops = [...byFoodbank.values()];
    const located = stops.filter((s) => s.point).map((s) => s.point!);
    const route = pickup && located.length === stops.length && located.length > 0
      ? await routeForOrder(o.id, orderStops(pickup, located))
      : null;
    const kinds = o.claims.map((c) => tempKind(c.donation.temperatureRange));
    return {
      id: o.id,
      status: o.status as MapOrder['status'],
      donor: o.donor.organizationName,
      pickup: { address: pickupAddress, point: pickup },
      stops,
      window: { start: o.pickupStart.toISOString(), end: o.pickupEnd.toISOString() },
      pallets: o.claims.reduce((s, c) => s + c.pallets, 0),
      weightKg: o.claims.reduce((s, c) => s + c.weightKg, 0),
      cold: kinds.includes('frozen') ? 'frozen' : kinds.includes('chilled') ? 'chilled' : null,
      route: route?.coordinates ?? null,
      distanceKm: route?.distanceKm ?? null,
      durationMin: route?.durationMin ?? null,
    };
  }));

  const waitingByPlace = new Map<string, MapWaiting>();
  for (const c of waitingClaims) {
    const key = `${c.donation.donorId}|${normalizeAddress(c.donation.pickupAddress)}`;
    const w = waitingByPlace.get(key) ?? {
      key, donor: c.donation.donor.organizationName, address: c.donation.pickupAddress,
      point: lookup(points, c.donation.pickupAddress), reservations: 0, pallets: 0, weightKg: 0,
    };
    w.reservations += 1;
    w.pallets += c.pallets;
    w.weightKg += c.weightKg;
    waitingByPlace.set(key, w);
  }

  const unlocated = [...new Set([
    ...mapOrders.flatMap((o) => [...(o.pickup.point ? [] : [o.pickup.address]), ...o.stops.filter((s) => !s.point).map((s) => s.address)]),
    ...[...waitingByPlace.values()].filter((w) => !w.point).map((w) => w.address),
  ])];

  return { orders: mapOrders, waiting: [...waitingByPlace.values()], unlocated };
}
