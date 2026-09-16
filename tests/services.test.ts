/**
 * Integration tests of the business rules against a throwaway SQLite database
 * (created by tests/setup-test-db.ts).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

// lib/services and lib/queries are server-only modules; neutralise the guard for tests.
vi.mock('server-only', () => ({}));

import { prisma } from '@/lib/db';
import * as services from '@/lib/services';
import { fetchAvailableDonations, fetchGlobalImpact } from '@/lib/queries';
import { DomainError, zurichNoonOf } from '@/lib/domain';
import type { Profile } from '@/lib/types';
import type { Prisma } from '@/lib/generated/prisma/client';

const profile = (u: { id: string; username: string; role: string; organizationName: string; address: string }): Profile =>
  ({ id: u.id, username: u.username, email: `${u.username}@test.local`, role: u.role as Profile['role'], organizationName: u.organizationName, address: u.address });

let migros: Profile;
let coop: Profile;
let foodbank: Profile;
let dispatcher: Profile;

const inDays = (n: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };
const bestBefore = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

async function insertDonation(donor: Profile, overrides: Partial<Prisma.DonationUncheckedCreateInput> = {}) {
  const data: Prisma.DonationUncheckedCreateInput = {
      donorId: donor.id, productName: 'Testware', temperatureRange: 'AMBIENT', bestBeforeDate: bestBefore,
      pickupAddress: 'Zürich', numberOfPallets: 1, weightPerPallet: 10, overlapStart: inDays(20, 8), overlapEnd: inDays(20, 12),
      ...overrides,
  };
  return prisma.donation.create({ data });
}

beforeAll(async () => {
  const mk = (username: string, role: string) => prisma.user.create({
    data: { username, email: `${username}@test.local`, passwordHash: 'x', role, organizationName: username.toUpperCase(), address: 'Zürich' },
  });
  migros = profile(await mk('migros', 'DONOR'));
  coop = profile(await mk('coop', 'DONOR'));
  foodbank = profile(await mk('foodbank_zrh', 'FOODBANK'));
  dispatcher = profile(await mk('dispatcher_gt', 'DISPATCHER'));
});

describe('donation capture (FA-01)', () => {
  const valid = {
    productName: 'Rüebli', temperatureRange: 'CHILLED' as const, bestBeforeDate: bestBefore, pickupAddress: 'Limmatstrasse 152',
    numberOfPallets: 2, weightPerPallet: 250.5, overlapStart: inDays(5, 8).toISOString(), overlapEnd: inDays(5, 12).toISOString(),
  };

  it('stores a donation with all 7 fields as AVAILABLE', async () => {
    const d = await services.createDonation(migros, valid);
    expect(d.status).toBe('AVAILABLE');
    expect(d.numberOfPallets * d.weightPerPallet).toBe(501);
  });

  it('rejects missing mandatory fields (TF-02)', async () => {
    await expect(services.createDonation(migros, { ...valid, weightPerPallet: 0, pickupAddress: '' }))
      .rejects.toThrow(/Gewicht pro Palette/);
    await expect(services.createDonation(migros, { ...valid, overlapEnd: valid.overlapStart })).rejects.toThrow(/Ende/);
  });

  it('rejects non-donors', async () => {
    await expect(services.createDonation(foodbank, valid)).rejects.toBeInstanceOf(DomainError);
  });
});

describe('freshness rule (FA-03)', () => {
  it('hides donations older than 4 days and refuses to claim them (TF-03)', async () => {
    const stale = await insertDonation(coop, { createdAt: new Date(Date.now() - 5 * 86_400_000) });
    const fresh = await insertDonation(coop, { createdAt: new Date(Date.now() - 3 * 86_400_000) });

    const ids = (await fetchAvailableDonations()).map((d) => d.id);
    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(stale.id);

    await expect(services.claimDonation(foodbank, stale.id)).rejects.toThrow(/älter als 4 Tage/);
    const claim = await services.claimDonation(foodbank, fresh.id);
    expect(claim.foodbankId).toBe(foodbank.id);
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe('CLAIMED');
  });

  it('lets only one claim win and blocks donors from claiming', async () => {
    const d = await insertDonation(coop);
    await services.claimDonation(foodbank, d.id);
    await expect(services.claimDonation(foodbank, d.id)).rejects.toThrow(/nicht mehr verfügbar/);
    const d2 = await insertDonation(coop);
    await expect(services.claimDonation(migros, d2.id)).rejects.toThrow(/Nur Abgabestellen/);
  });
});

describe('Galliker bundling (FA-02)', () => {
  it('bundles overlapping claimed donations per donor with a 12:00 Zurich pickup (TF-04/TF-05)', async () => {
    // clear anything claimed by earlier tests so counts are deterministic
    await prisma.donation.updateMany({ where: { status: 'CLAIMED' }, data: { status: 'COMPLETED' } });

    const a = await insertDonation(migros, { productName: 'Apples', overlapStart: inDays(30, 8), overlapEnd: inDays(30, 12) });
    const b = await insertDonation(migros, { productName: 'Pears', overlapStart: inDays(30, 10), overlapEnd: inDays(30, 14) });
    const c = await insertDonation(migros, { productName: 'Milk', overlapStart: inDays(30, 15), overlapEnd: inDays(30, 17) });
    const x = await insertDonation(coop, { productName: 'Bananas', overlapStart: inDays(30, 9), overlapEnd: inDays(30, 11) });
    for (const d of [a, b, c, x]) await services.claimDonation(foodbank, d.id);

    const result = await services.runBundling(dispatcher);
    expect(result).toEqual({ orders: 3, positions: 4 });

    const rows = await prisma.donation.findMany({ where: { id: { in: [a.id, b.id, c.id, x.id] } } });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[a.id].transportOrderId).toBe(byId[b.id].transportOrderId);
    expect(byId[c.id].transportOrderId).not.toBe(byId[a.id].transportOrderId);
    expect(byId[x.id].transportOrderId).not.toBe(byId[a.id].transportOrderId);
    expect(rows.every((r) => r.status === 'BUNDLED')).toBe(true);

    const order = await prisma.transportOrder.findUniqueOrThrow({ where: { id: byId[a.id].transportOrderId! } });
    expect(order.donorId).toBe(migros.id);
    expect(order.pickupTime.getTime()).toBe(zurichNoonOf(a.overlapEnd).getTime());
    const zurichClock = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hour12: false }).format(order.pickupTime);
    expect(zurichClock).toBe('12:00');

    // idempotent: nothing left to bundle
    expect(await services.runBundling(dispatcher)).toEqual({ orders: 0, positions: 0 });
    await expect(services.runBundling(foodbank)).rejects.toThrow(/Nur Disponenten/);
  });

  it('enforces the PENDING → DISPATCHED → COMPLETED lifecycle and completes donations', async () => {
    const d = await insertDonation(coop, { productName: 'Salat', overlapStart: inDays(40, 8), overlapEnd: inDays(40, 10) });
    await services.claimDonation(foodbank, d.id);
    await services.runBundling(dispatcher);
    const orderId = (await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })).transportOrderId!;

    await expect(services.setOrderStatus(dispatcher, orderId, 'COMPLETED')).rejects.toThrow(/Ungültiger Statuswechsel/);
    await services.setOrderStatus(dispatcher, orderId, 'DISPATCHED');
    await services.assignDriver(dispatcher, orderId, 'H. Galliker');
    await services.setOrderStatus(dispatcher, orderId, 'COMPLETED');

    const order = await prisma.transportOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('COMPLETED');
    expect(order.driverName).toBe('H. Galliker');
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('COMPLETED');
    await expect(services.assignDriver(dispatcher, orderId, 'Someone')).rejects.toThrow(/abgeschlossen/);
    await expect(services.setOrderStatus(foodbank, orderId, 'DISPATCHED')).rejects.toThrow(/Nur Disponenten/);
  });
});

describe('impact (FA-04)', () => {
  it('counts only rescued donations', async () => {
    await prisma.claim.deleteMany({});
    await prisma.donation.deleteMany({});
    await insertDonation(migros, { numberOfPallets: 2, weightPerPallet: 500, status: 'CLAIMED' });
    await insertDonation(migros, { numberOfPallets: 1, weightPerPallet: 100, status: 'AVAILABLE' });
    const impact = await fetchGlobalImpact();
    expect(impact).toEqual({ totalWeightKg: 1000, meals: 2000, co2SavedKg: 1100, donationCount: 1 });
  });
});

describe('wishlists', () => {
  it('are owned by the publishing foodbank', async () => {
    const w = await services.createWishlist(foodbank, { productName: 'Reis', quantityKg: 50, note: '' });
    await expect(services.createWishlist(migros, { productName: 'Nope', quantityKg: 1, note: '' })).rejects.toThrow(/Nur Abgabestellen/);
    await expect(services.deleteWishlist(migros, w.id)).rejects.toThrow(/anderen Institution/);
    await services.deleteWishlist(foodbank, w.id);
    expect(await prisma.wishlist.count()).toBe(0);
  });
});
