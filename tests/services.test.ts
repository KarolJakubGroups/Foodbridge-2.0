/**
 * Integration tests of the business rules against a throwaway SQLite database
 * (created by tests/setup-test-db.ts).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

// lib/services and lib/queries are server-only modules; neutralise the guard for tests.
vi.mock('server-only', () => ({}));

const hasDb = Boolean(process.env.TEST_DATABASE_URL);

import { prisma } from '@/lib/db';
import * as services from '@/lib/services';
import { fetchAvailableDonations, fetchGlobalImpact, fetchImpactFor, fetchTransportOrders, orderScopeFor } from '@/lib/queries';
import { DomainError, zurichNoonOf } from '@/lib/domain';
import type { Profile } from '@/lib/types';
import type { Prisma } from '@/lib/generated/prisma/client';

const profile = (u: { id: string; username: string; role: string; status: string; organizationName: string; address: string }): Profile =>
  ({ id: u.id, username: u.username, email: `${u.username}@test.local`, role: u.role as Profile['role'], status: u.status as Profile['status'], organizationName: u.organizationName, address: u.address });

let migros: Profile;
let coop: Profile;
let foodbank: Profile;
let dispatcher: Profile;

const inDays = (n: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };
const bestBefore = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

async function insertDonation(donor: Profile, overrides: Partial<Prisma.DonationUncheckedCreateInput> = {}) {
  const data: Prisma.DonationUncheckedCreateInput = {
      donorId: donor.id, productName: 'Testware', category: 'DRY_GOODS', temperatureRange: 'AMBIENT', bestBeforeDate: bestBefore,
      pickupAddress: 'Zürich', numberOfPallets: 1, weightPerPallet: 10, overlapStart: inDays(20, 8), overlapEnd: inDays(20, 12),
      ...overrides,
  };
  return prisma.donation.create({ data });
}

beforeAll(async () => {
  if (!hasDb) return;
  // start from a clean slate in the test schema
  await prisma.claim.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.transportOrder.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  const mk = (username: string, role: string) => prisma.user.create({
    data: { username, email: `${username}@test.local`, passwordHash: 'x', role, status: 'APPROVED', organizationName: username.toUpperCase(), address: 'Zürich' },
  });
  migros = profile(await mk('migros', 'DONOR'));
  coop = profile(await mk('coop', 'DONOR'));
  foodbank = profile(await mk('foodbank_zrh', 'FOODBANK'));
  dispatcher = profile(await mk('dispatcher_gt', 'DISPATCHER'));
});

describe.skipIf(!hasDb)('donor registration and verification', () => {
  const application = {
    organizationName: 'Denner Filiale Altstetten', address: 'Badenerstrasse 700, 8048 Zürich', contactName: 'A. Muster',
    phone: '044 123 45 67', email: 'Denner.Altstetten@example.ch', password: 'geheim123', passwordConfirm: 'geheim123',
  };

  it('creates a PENDING donor with a generated username and lowercased email', async () => {
    const user = await services.registerDonor(application);
    expect(user.role).toBe('DONOR');
    expect(user.status).toBe('PENDING');
    expect(user.email).toBe('denner.altstetten@example.ch');
    expect(user.username).toBe('denner_filiale_altstette');
    expect(user.passwordHash).not.toContain('geheim');
  });

  it('rejects duplicates, weak passwords and mismatches', async () => {
    await expect(services.registerDonor(application)).rejects.toThrow(/bereits ein Konto/);
    await expect(services.registerDonor({ ...application, email: 'x@example.ch', password: 'short', passwordConfirm: 'short' })).rejects.toThrow(/mindestens/);
    await expect(services.registerDonor({ ...application, email: 'y@example.ch', passwordConfirm: 'other123' })).rejects.toThrow(/stimmen nicht/);
    const second = await services.registerDonor({ ...application, email: 'z@example.ch' });
    expect(second.username).toBe('denner_filiale_altstette_2');
  });

  it('blocks donations until a foodbank approves, then allows them', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'denner.altstetten@example.ch' } });
    const pendingProfile = profile(user);
    const valid = {
      productName: 'Rüebli', category: 'FRUIT_VEG' as const, temperatureRange: 'CHILLED' as const, bestBeforeDate: bestBefore,
      pickupAddress: 'Zürich', numberOfPallets: 1, weightPerPallet: 10, overlapStart: inDays(5, 8).toISOString(), overlapEnd: inDays(5, 12).toISOString(),
    };
    await expect(services.createDonation(pendingProfile, valid)).rejects.toThrow(/noch nicht freigegeben/);

    await expect(services.reviewDonor(migros, user.id, 'APPROVED')).rejects.toThrow(/Nur Abgabestellen/);
    await services.reviewDonor(foodbank, user.id, 'APPROVED');
    const approved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewedAt).not.toBeNull();
    await expect(services.createDonation(profile(approved), valid)).resolves.toMatchObject({ status: 'AVAILABLE' });

    await expect(services.reviewDonor(foodbank, user.id, 'APPROVED')).rejects.toThrow(/bereits/);
    await services.reviewDonor(foodbank, user.id, 'REJECTED');
    expect((await services.listApplications()).find((a) => a.id === user.id)?.status).toBe('REJECTED');
  });
});

describe.skipIf(!hasDb)('donation capture (FA-01)', () => {
  const valid = {
    productName: 'Rüebli', category: 'FRUIT_VEG' as const, temperatureRange: 'CHILLED' as const, bestBeforeDate: bestBefore, pickupAddress: 'Limmatstrasse 152',
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

  it('rejects an unknown category', async () => {
    await expect(services.createDonation(migros, { ...valid, category: 'CANDY' as never })).rejects.toThrow(/Warengruppe/);
  });

  it('rejects non-donors', async () => {
    await expect(services.createDonation(foodbank, valid)).rejects.toBeInstanceOf(DomainError);
  });
});

describe.skipIf(!hasDb)('freshness rule (FA-03)', () => {
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

describe.skipIf(!hasDb)('Galliker bundling (FA-02)', () => {
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
    await services.setOrderStatus(dispatcher, orderId, 'COMPLETED');

    const order = await prisma.transportOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('COMPLETED');
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('COMPLETED');
    await expect(services.setOrderStatus(foodbank, orderId, 'DISPATCHED')).rejects.toThrow(/Nur Disponenten/);
  });
});

describe.skipIf(!hasDb)('manual bundling from the preview dialog', () => {
  it('previews without writing, and persists an edited plan (split, skip)', async () => {
    const a = await insertDonation(migros, { productName: 'A', overlapStart: inDays(50, 8), overlapEnd: inDays(50, 12) });
    const b = await insertDonation(migros, { productName: 'B', overlapStart: inDays(50, 9), overlapEnd: inDays(50, 13) });
    const c = await insertDonation(migros, { productName: 'C', overlapStart: inDays(50, 10), overlapEnd: inDays(50, 14) });
    for (const d of [a, b, c]) await services.claimDonation(foodbank, d.id);

    const plan = await services.planBundling(dispatcher);
    const group = plan.find((g) => g.donor.id === migros.id)!;
    const proposed = group.orders.find((o) => o.donations.some((d) => d.id === a.id))!;
    expect(proposed.donations.map((d) => d.id).sort()).toEqual([a.id, b.id, c.id].sort());
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('CLAIMED'); // nothing written

    // dispatcher splits C into its own order and leaves B out of this run
    const result = await services.createTransportOrders(dispatcher, [
      { donorId: migros.id, donationIds: [a.id] },
      { donorId: migros.id, donationIds: [c.id] },
    ]);
    expect(result).toEqual({ orders: 2, positions: 2 });
    const rows = await prisma.donation.findMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[a.id].status).toBe('BUNDLED');
    expect(byId[c.id].status).toBe('BUNDLED');
    expect(byId[a.id].transportOrderId).not.toBe(byId[c.id].transportOrderId);
    expect(byId[b.id].status).toBe('CLAIMED');
    expect(byId[b.id].transportOrderId).toBeNull();
  });

  it('rejects invalid manual bundles', async () => {
    const x = await insertDonation(migros, { productName: 'X', overlapStart: inDays(60, 8), overlapEnd: inDays(60, 12) });
    const y = await insertDonation(coop, { productName: 'Y', overlapStart: inDays(60, 8), overlapEnd: inDays(60, 12) });
    await services.claimDonation(foodbank, x.id);
    await services.claimDonation(foodbank, y.id);

    await expect(services.createTransportOrders(dispatcher, [{ donorId: migros.id, donationIds: [] }])).rejects.toThrow(/mindestens eine/);
    await expect(services.createTransportOrders(dispatcher, [{ donorId: migros.id, donationIds: [x.id] }, { donorId: migros.id, donationIds: [x.id] }])).rejects.toThrow(/nur in einem/);
    await expect(services.createTransportOrders(dispatcher, [{ donorId: migros.id, donationIds: [x.id, y.id] }])).rejects.toThrow(/anderen Spender/);
    await expect(services.createTransportOrders(foodbank, [{ donorId: migros.id, donationIds: [x.id] }])).rejects.toThrow(/Nur Disponenten/);
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: x.id } })).status).toBe('CLAIMED');
  });
});

describe.skipIf(!hasDb)('network view scoping', () => {
  it('donors only see their own orders and impact; dispatcher sees all', async () => {
    const m = await insertDonation(migros, { productName: 'M-only', overlapStart: inDays(70, 8), overlapEnd: inDays(70, 12), numberOfPallets: 1, weightPerPallet: 100 });
    const c = await insertDonation(coop, { productName: 'C-only', overlapStart: inDays(70, 8), overlapEnd: inDays(70, 12), numberOfPallets: 1, weightPerPallet: 200 });
    await services.claimDonation(foodbank, m.id);
    await services.claimDonation(foodbank, c.id);
    await services.createTransportOrders(dispatcher, [
      { donorId: migros.id, donationIds: [m.id] },
      { donorId: coop.id, donationIds: [c.id] },
    ]);

    const migrosOrders = await fetchTransportOrders(orderScopeFor(migros));
    expect(migrosOrders.every((o) => o.donorId === migros.id)).toBe(true);
    expect(migrosOrders.some((o) => o.donations.some((d) => d.id === m.id))).toBe(true);
    expect(migrosOrders.some((o) => o.donations.some((d) => d.id === c.id))).toBe(false);

    const foodbankOrders = await fetchTransportOrders(orderScopeFor(foodbank));
    expect(foodbankOrders.some((o) => o.donations.some((d) => d.id === c.id))).toBe(true);

    const all = await fetchTransportOrders(orderScopeFor(dispatcher));
    expect(all.length).toBeGreaterThanOrEqual(migrosOrders.length + 1);

    const migrosImpact = await fetchImpactFor(migros.id, 'DONOR');
    const coopImpact = await fetchImpactFor(coop.id, 'DONOR');
    const global = await fetchGlobalImpact();
    expect(global.totalWeightKg).toBeGreaterThanOrEqual(migrosImpact.totalWeightKg + coopImpact.totalWeightKg);
    expect(coopImpact.totalWeightKg).toBeGreaterThanOrEqual(200);
  });
});

describe.skipIf(!hasDb)('impact (FA-04)', () => {
  it('counts only rescued donations', async () => {
    await prisma.claim.deleteMany({});
    await prisma.donation.deleteMany({});
    await insertDonation(migros, { numberOfPallets: 2, weightPerPallet: 500, status: 'CLAIMED' });
    await insertDonation(migros, { numberOfPallets: 1, weightPerPallet: 100, status: 'AVAILABLE' });
    const impact = await fetchGlobalImpact();
    expect(impact).toEqual({ totalWeightKg: 1000, meals: 2000, co2SavedKg: 1100, donationCount: 1 });
  });
});

describe.skipIf(!hasDb)('wishlists', () => {
  it('are owned by the publishing foodbank', async () => {
    const w = await services.createWishlist(foodbank, { productName: 'Reis', quantityKg: 50, note: '' });
    await expect(services.createWishlist(migros, { productName: 'Nope', quantityKg: 1, note: '' })).rejects.toThrow(/Nur Abgabestellen/);
    await expect(services.deleteWishlist(migros, w.id)).rejects.toThrow(/anderen Institution/);
    await services.deleteWishlist(foodbank, w.id);
    expect(await prisma.wishlist.count()).toBe(0);
  });
});
