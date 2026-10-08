/**
 * Integration tests of the business rules against the isolated "foodbridge_test"
 * PostgreSQL schema (created by tests/setup-test-db.ts). Galliker runs in sandbox mode.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

// lib/services and lib/queries are server-only modules; neutralise the guard for tests.
vi.mock('server-only', () => ({}));

const hasDb = Boolean(process.env.TEST_DATABASE_URL);

import { prisma } from '@/lib/db';
import * as services from '@/lib/services';
import { fetchAvailableDonations, fetchGlobalImpact, fetchImpactFor, fetchTransportOrders, orderScopeFor } from '@/lib/queries';
import { DomainError, totalWeightKg } from '@/lib/domain';
import { createPrismaClient } from '@/lib/db';
import { DB_UNAVAILABLE_DIGEST, DatabaseUnavailableError } from '@/lib/errors';
import type { Profile } from '@/lib/types';
import type { Prisma } from '@/lib/generated/prisma/client';

const profile = (u: { id: string; username: string; role: string; status: string; organizationName: string; address: string }): Profile =>
  ({ id: u.id, username: u.username, email: `${u.username}@test.local`, role: u.role as Profile['role'], status: u.status as Profile['status'], organizationName: u.organizationName, address: u.address });

let migros: Profile;
let coop: Profile;
let foodbank: Profile;
let foodbank2: Profile;
let dispatcher: Profile;

const inDays = (n: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };
const bestBefore = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

/** An offer written directly; every pallet weighs `weightPerPallet` (10 kg) unless palletWeights are given. */
async function insertDonation(donor: Profile, { weightPerPallet = 10, ...overrides }: Partial<Prisma.DonationUncheckedCreateInput> & { weightPerPallet?: number } = {}) {
  const numberOfPallets = overrides.numberOfPallets ?? 1;
  const data: Prisma.DonationUncheckedCreateInput = {
      donorId: donor.id, productName: 'Testware', category: 'DRY_GOODS', temperatureRange: 'AMBIENT', bestBeforeDate: bestBefore,
      pickupAddress: 'Zürich', numberOfPallets, palletWeights: Array.from({ length: numberOfPallets }, () => weightPerPallet),
      overlapStart: inDays(20, 8), overlapEnd: inDays(20, 12),
      ...overrides,
  };
  return prisma.donation.create({ data });
}

beforeAll(async () => {
  if (!hasDb) return;
  // start from a clean slate in the test schema
  await prisma.claim.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.gallikerTransmission.deleteMany({});
  await prisma.transportOrder.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  const mk = (username: string, role: string, address = 'Zürich') => prisma.user.create({
    data: { username, email: `${username}@test.local`, passwordHash: 'x', role, status: 'APPROVED', organizationName: username.toUpperCase(), address },
  });
  migros = profile(await mk('migros', 'DONOR'));
  coop = profile(await mk('coop', 'DONOR'));
  foodbank = profile(await mk('foodbank_zrh', 'FOODBANK'));
  foodbank2 = profile(await mk('foodbank_win', 'FOODBANK', 'Winterthur'));
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
      pickupAddress: 'Zürich', palletWeights: [10], overlapStart: inDays(5, 8).toISOString(), overlapEnd: inDays(5, 12).toISOString(),
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
    palletWeights: [250.5, 250.5], overlapStart: inDays(5, 8).toISOString(), overlapEnd: inDays(5, 12).toISOString(),
  };

  it('stores a donation with all 7 fields as AVAILABLE and nothing reserved', async () => {
    const d = await services.createDonation(migros, valid);
    expect(d.status).toBe('AVAILABLE');
    expect(d.claimedPallets).toBe(0);
    expect(d.numberOfPallets).toBe(2);
    expect(totalWeightKg(d)).toBe(501);
  });

  it('stores a different weight for every pallet', async () => {
    const d = await services.createDonation(migros, { ...valid, palletWeights: [320, 180.5, 95] });
    expect([d.numberOfPallets, d.palletWeights, totalWeightKg(d)]).toEqual([3, [320, 180.5, 95], 595.5]);
    await expect(services.createDonation(migros, { ...valid, palletWeights: [320, 0, 95] })).rejects.toThrow(/Palette 2/);
    await expect(services.createDonation(migros, { ...valid, palletWeights: [320, 1600] })).rejects.toThrow(/Palette 2/);
    await expect(services.createDonation(migros, { ...valid, palletWeights: [] })).rejects.toThrow(/1 bis 66 Paletten/);
  });

  it('rejects missing mandatory fields (TF-02) and windows that are already over', async () => {
    await expect(services.createDonation(migros, { ...valid, palletWeights: [0], pickupAddress: '' })).rejects.toThrow(/Gewicht der Paletten/);
    await expect(services.createDonation(migros, { ...valid, overlapEnd: valid.overlapStart })).rejects.toThrow(/Ende/);
    await expect(services.createDonation(migros, { ...valid, overlapStart: inDays(-2, 8).toISOString(), overlapEnd: inDays(-1, 8).toISOString() }))
      .rejects.toThrow(/Vergangenheit/);
  });

  it('rejects an unknown category', async () => {
    await expect(services.createDonation(migros, { ...valid, category: 'CANDY' as never })).rejects.toThrow(/Warengruppe/);
  });

  it('stores a temperature the donor typed in, and still requires one', async () => {
    const d = await services.createDonation(migros, { ...valid, temperatureRange: '  +12 bis  +15 °C ' });
    expect(d.temperatureRange).toBe('+12 bis +15 °C');
    await expect(services.createDonation(migros, { ...valid, temperatureRange: '   ' })).rejects.toThrow(/Temperatur/);
  });

  it('rejects non-donors', async () => {
    await expect(services.createDonation(foodbank, valid)).rejects.toBeInstanceOf(DomainError);
  });
});

describe.skipIf(!hasDb)('partial reservations', () => {
  it('lets institutions take part of an offer; the rest stays available until it is fully reserved', async () => {
    const d = await insertDonation(coop, { productName: 'Milch', numberOfPallets: 5, weightPerPallet: 50 });

    const first = await services.claimDonation(foodbank, d.id, 2);
    expect(first).toMatchObject({ productName: 'Milch', remainingPallets: 3, weightKg: 100 });
    let row = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } });
    expect([row.claimedPallets, row.status]).toEqual([2, 'AVAILABLE']);
    const listed = (await fetchAvailableDonations()).find((x) => x.id === d.id);
    expect(listed && listed.numberOfPallets - listed.claimedPallets).toBe(3);

    await expect(services.claimDonation(foodbank2, d.id, 4)).rejects.toThrow(/nur noch 3 Paletten/);
    await services.claimDonation(foodbank2, d.id, 3);
    row = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } });
    expect([row.claimedPallets, row.status]).toEqual([5, 'CLAIMED']);
    expect((await fetchAvailableDonations()).some((x) => x.id === d.id)).toBe(false);
    await expect(services.claimDonation(foodbank, d.id, 1)).rejects.toThrow(/vollständig reserviert/);

    const claims = await prisma.claim.findMany({ where: { donationId: d.id }, orderBy: { id: 'asc' } });
    expect(claims.map((c) => [c.foodbankId, c.pallets, c.status])).toEqual([[foodbank.id, 2, 'RESERVED'], [foodbank2.id, 3, 'RESERVED']]);
  });

  it('never over-reserves when institutions race for the last pallets', async () => {
    const d = await insertDonation(coop, { productName: 'Rennen', numberOfPallets: 3 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => services.claimDonation(i % 2 ? foodbank : foodbank2, d.id, 1)),
    );
    const won = attempts.filter((a) => a.status === 'fulfilled').length;
    expect(won).toBe(3);
    for (const a of attempts) {
      if (a.status === 'rejected') expect(String(a.reason)).toMatch(/vollständig reserviert|anderen Stelle|nur noch/);
    }
    const row = await prisma.donation.findUniqueOrThrow({ where: { id: d.id }, include: { claims: true } });
    expect(row.claimedPallets).toBe(3);
    expect(row.claims.reduce((s, c) => s + c.pallets, 0)).toBe(3);
    expect(row.status).toBe('CLAIMED');
  });

  it('is guarded by the database: reserved can never exceed offered', async () => {
    const d = await insertDonation(coop, { numberOfPallets: 2 });
    await expect(prisma.donation.update({ where: { id: d.id }, data: { claimedPallets: 3 } })).rejects.toThrow();
    await expect(prisma.claim.create({ data: { donationId: d.id, foodbankId: foodbank.id, pallets: 0, palletNumbers: [], weightKg: 0 } })).rejects.toThrow();
    // one weight per pallet, and a claim names exactly its pallets
    await expect(prisma.donation.update({ where: { id: d.id }, data: { palletWeights: [10] } })).rejects.toThrow();
    await expect(prisma.claim.create({ data: { donationId: d.id, foodbankId: foodbank.id, pallets: 2, palletNumbers: [1], weightKg: 10 } })).rejects.toThrow();
  });

  it('lets institutions pick pallets of different weights, or take the next free ones by count', async () => {
    const d = await insertDonation(coop, { productName: 'Gemischt', numberOfPallets: 4, palletWeights: [300, 120, 80, 250] });

    const picked = await services.claimDonation(foodbank, d.id, [3, 2]);
    expect(picked).toMatchObject({ remainingPallets: 2, weightKg: 200 });
    expect(picked.claim.palletNumbers).toEqual([2, 3]);
    await expect(services.claimDonation(foodbank2, d.id, [2, 4])).rejects.toThrow(/Palette 2 ist nicht mehr frei/);
    await expect(services.claimDonation(foodbank2, d.id, [1.5])).rejects.toThrow(/mindestens eine Palette/);

    const byCount = await services.claimDonation(foodbank2, d.id, 1);
    expect([byCount.claim.palletNumbers, byCount.weightKg]).toEqual([[1], 300]);
    const [listed] = (await fetchAvailableDonations()).filter((x) => x.id === d.id);
    expect(listed.claims.flatMap((c) => c.palletNumbers).sort()).toEqual([1, 2, 3]);
  });

  it('refuses zero or fractional pallets and non-institutions', async () => {
    const d = await insertDonation(coop, { numberOfPallets: 2 });
    await expect(services.claimDonation(foodbank, d.id, 0)).rejects.toThrow(/mindestens eine Palette/);
    await expect(services.claimDonation(foodbank, d.id, 1.5)).rejects.toThrow(/mindestens eine Palette/);
    await expect(services.claimDonation(migros, d.id, 1)).rejects.toThrow(/Nur Abgabestellen/);
  });
});

describe.skipIf(!hasDb)('claim deadline: 4-day rule and pickup window (FA-03)', () => {
  it('hides offers older than 4 days and refuses to reserve them (TF-03)', async () => {
    const stale = await insertDonation(coop, { createdAt: new Date(Date.now() - 5 * 86_400_000) });
    const fresh = await insertDonation(coop, { createdAt: new Date(Date.now() - 3 * 86_400_000) });
    const ids = (await fetchAvailableDonations()).map((d) => d.id);
    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(stale.id);
    await expect(services.claimDonation(foodbank, stale.id, 1)).rejects.toThrow(/älter als 4 Tage/);
  });

  it('hides offers whose pickup window has passed and refuses to reserve them', async () => {
    const past = new Date(Date.now() - 3_600_000);
    const d = await insertDonation(coop, { productName: 'Zu spät', overlapStart: new Date(Date.now() - 5 * 3_600_000), overlapEnd: past });
    expect((await fetchAvailableDonations()).some((x) => x.id === d.id)).toBe(false);
    await expect(services.claimDonation(foodbank, d.id, 1)).rejects.toThrow(/Abholfenster ist bereits vorbei/);
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })).claimedPallets).toBe(0);
  });
});

describe.skipIf(!hasDb)('adding pallets to an existing offer', () => {
  it('increases the pallet count and leaves the freshness window untouched', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const d = await insertDonation(migros, { productName: 'Milch UHT 1l', numberOfPallets: 2, weightPerPallet: 50, createdAt: threeDaysAgo });

    const result = await services.addPalletsToDonation(migros, d.id, [50, 70, 30]);
    expect(result).toEqual({ productName: 'Milch UHT 1l', numberOfPallets: 5, totalWeightKg: 250 });

    const after = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.numberOfPallets).toBe(5);
    expect(after.palletWeights).toEqual([50, 50, 50, 70, 30]);
    // registration date must not be reset, otherwise old goods would look fresh again
    expect(after.createdAt.getTime()).toBe(threeDaysAgo.getTime());
    expect(after.status).toBe('AVAILABLE');
  });

  it('works on a partly reserved offer and refuses fully reserved, foreign or invalid ones', async () => {
    const partly = await insertDonation(migros, { productName: 'Teilweise', numberOfPallets: 3 });
    await services.claimDonation(foodbank, partly.id, 1);
    await expect(services.addPalletsToDonation(migros, partly.id, [10, 10])).resolves.toMatchObject({ numberOfPallets: 5 });

    const mine = await insertDonation(migros, { productName: 'Brot' });
    const foreign = await insertDonation(coop, { productName: 'Brot' });
    const full = await insertDonation(migros, { productName: 'Salat' });
    await services.claimDonation(foodbank, full.id, 1);

    await expect(services.addPalletsToDonation(migros, foreign.id, [10])).rejects.toThrow(/nicht gefunden/);
    await expect(services.addPalletsToDonation(migros, full.id, [10])).rejects.toThrow(/nicht mehr offen/);
    await expect(services.addPalletsToDonation(migros, mine.id, [])).rejects.toThrow(/zusätzlicher Paletten/);
    await expect(services.addPalletsToDonation(migros, mine.id, Array.from({ length: 66 }, () => 10))).rejects.toThrow(/höchstens/);
    await expect(services.addPalletsToDonation(foodbank, mine.id, [10])).rejects.toThrow(/Nur Spender/);
    await expect(services.addPalletsToDonation({ ...migros, status: 'PENDING' }, mine.id, [10])).rejects.toThrow(/noch nicht freigegeben/);
  });
});

describe.skipIf(!hasDb)('withdrawing an offer', () => {
  it('withdraws an offer nobody reserved', async () => {
    const d = await insertDonation(migros, { productName: 'Zurückzuziehen', numberOfPallets: 2 });
    expect(await services.withdrawDonation(migros, d.id)).toEqual({ productName: 'Zurückzuziehen', withdrawnPallets: 2, keptPallets: 0 });
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('WITHDRAWN');
    expect((await fetchAvailableDonations()).some((x) => x.id === d.id)).toBe(false);
    await expect(services.claimDonation(foodbank, d.id, 1)).rejects.toThrow(/zurückgezogen/);
  });

  it('withdraws only the unreserved rest; reserved pallets stay promised', async () => {
    const d = await insertDonation(migros, { productName: 'Rest', numberOfPallets: 5 });
    await services.claimDonation(foodbank, d.id, 2);
    expect(await services.withdrawDonation(migros, d.id)).toEqual({ productName: 'Rest', withdrawnPallets: 3, keptPallets: 2 });
    const row = await prisma.donation.findUniqueOrThrow({ where: { id: d.id }, include: { claims: true } });
    expect([row.numberOfPallets, row.claimedPallets, row.status, row.claims.length]).toEqual([2, 2, 'CLAIMED', 1]);
    await expect(services.withdrawDonation(migros, d.id)).rejects.toThrow(/bereits reserviert/);
  });

  it('keeps exactly the reserved pallets with their weights, numbered again', async () => {
    const d = await insertDonation(migros, { productName: 'Lücken', numberOfPallets: 4, palletWeights: [100, 200, 300, 400] });
    const a = (await services.claimDonation(foodbank, d.id, [4])).claim;
    const b = (await services.claimDonation(foodbank2, d.id, [2])).claim;
    await services.withdrawDonation(migros, d.id);
    const row = await prisma.donation.findUniqueOrThrow({ where: { id: d.id } });
    expect([row.numberOfPallets, row.palletWeights]).toEqual([2, [200, 400]]);
    const claims = await prisma.claim.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { id: 'asc' } });
    expect(claims.map((c) => [c.palletNumbers, c.weightKg])).toEqual([[[2], 400], [[1], 200]]);
  });

  it('refuses foreign offers and other roles', async () => {
    const mine = await insertDonation(migros, { productName: 'Meins' });
    const foreign = await insertDonation(coop, { productName: 'Fremd' });
    await expect(services.withdrawDonation(migros, foreign.id)).rejects.toThrow(/nicht gefunden/);
    await expect(services.withdrawDonation(foodbank, mine.id)).rejects.toThrow(/Nur Spender/);
  });
});

/** Takes every waiting reservation out of the way so bundling tests see only their own. */
async function parkWaitingClaims() {
  await prisma.claim.updateMany({ where: { status: 'RESERVED', transportOrderId: null }, data: { status: 'COMPLETED' } });
}

describe.skipIf(!hasDb)('Galliker bundling (FA-02)', () => {
  it('bundles overlapping reservations per pickup address with the shared window, and hands them to Galliker (TF-04/TF-05)', async () => {
    await parkWaitingClaims();
    const a = await insertDonation(migros, { productName: 'Apples', numberOfPallets: 2, overlapStart: inDays(30, 8), overlapEnd: inDays(30, 12) });
    const b = await insertDonation(migros, { productName: 'Pears', overlapStart: inDays(30, 10), overlapEnd: inDays(30, 14) });
    const c = await insertDonation(migros, { productName: 'Milk', overlapStart: inDays(30, 15), overlapEnd: inDays(30, 17) });
    const elsewhere = await insertDonation(migros, { productName: 'Other branch', pickupAddress: 'Seestrasse 1, 8002 Zürich', overlapStart: inDays(30, 8), overlapEnd: inDays(30, 12) });
    const x = await insertDonation(coop, { productName: 'Bananas', overlapStart: inDays(30, 9), overlapEnd: inDays(30, 11) });
    // Apples go to two institutions: two reservations of the same offer on one truck.
    const ca1 = (await services.claimDonation(foodbank, a.id, 1)).claim;
    const ca2 = (await services.claimDonation(foodbank2, a.id, 1)).claim;
    const cb = (await services.claimDonation(foodbank, b.id, 1)).claim;
    const cc = (await services.claimDonation(foodbank, c.id, 1)).claim;
    const ce = (await services.claimDonation(foodbank, elsewhere.id, 1)).claim;
    const cx = (await services.claimDonation(foodbank2, x.id, 1)).claim;

    const plan = await services.planBundling(dispatcher);
    expect((await prisma.claim.findUniqueOrThrow({ where: { id: ca1.id } })).status).toBe('RESERVED'); // preview writes nothing
    const main = plan.find((g) => g.donor.id === migros.id && g.pickupAddress === 'Zürich')!;
    expect(main.orders.map((o) => o.claims.map((cl) => cl.id).sort((p, q) => p - q)))
      .toEqual([[ca1.id, ca2.id, cb.id].sort((p, q) => p - q), [cc.id]]);
    expect(plan.filter((g) => g.donor.id === migros.id)).toHaveLength(2); // other address = other group

    const result = await services.runBundling(dispatcher);
    expect(result).toEqual({ orders: 4, positions: 6, sent: 4, failed: 0 });

    const claims = await prisma.claim.findMany({ where: { id: { in: [ca1.id, ca2.id, cb.id, cc.id, ce.id, cx.id] } } });
    const byId = Object.fromEntries(claims.map((cl) => [cl.id, cl]));
    expect(new Set([ca1, ca2, cb].map((cl) => byId[cl.id].transportOrderId)).size).toBe(1);
    expect(byId[cc.id].transportOrderId).not.toBe(byId[ca1.id].transportOrderId);
    expect(byId[ce.id].transportOrderId).not.toBe(byId[ca1.id].transportOrderId);
    expect(claims.every((cl) => cl.status === 'BUNDLED')).toBe(true);

    const order = await prisma.transportOrder.findUniqueOrThrow({ where: { id: byId[ca1.id].transportOrderId! }, include: { transmissions: true } });
    // Window: latest start (Pears 10:00) to earliest end (Apples 12:00).
    expect(order.pickupStart).toEqual(inDays(30, 10));
    expect(order.pickupEnd).toEqual(inDays(30, 12));
    expect(order.gallikerStatus).toBe('SENT');
    expect(order.gallikerReference).toMatch(/^GLK-TEST-/);
    expect(order.transmissions).toHaveLength(1);
    const payload = order.transmissions[0].payload as { items: { deliverTo: { institution: string } }[]; totals: { stops: number } };
    expect(payload.items).toHaveLength(3);
    expect(payload.totals.stops).toBe(2);

    expect(await services.runBundling(dispatcher)).toEqual({ orders: 0, positions: 0, sent: 0, failed: 0 });
    await expect(services.runBundling(foodbank)).rejects.toThrow(/Nur Disponenten/);
  });

  it('records a failed hand-over without losing the order, and resends it', async () => {
    await parkWaitingClaims();
    const d = await insertDonation(coop, { productName: 'Resend', overlapStart: inDays(40, 8), overlapEnd: inDays(40, 12) });
    const { claim } = await services.claimDonation(foodbank, d.id, 1);
    await services.createTransportOrders(dispatcher, [{ donorId: coop.id, claimIds: [claim.id] }]);
    const orderId = (await prisma.claim.findUniqueOrThrow({ where: { id: claim.id } })).transportOrderId!;

    // Simulate an outage at Galliker: HTTP mode without a configured endpoint.
    const failed = await services.sendOrderToGalliker(orderId, { mode: 'HTTP', timeoutMs: 1000 });
    expect(failed.ok).toBe(false);
    let order = await prisma.transportOrder.findUniqueOrThrow({ where: { id: orderId }, include: { transmissions: true } });
    expect(order.gallikerStatus).toBe('FAILED');
    expect(order.gallikerError).toMatch(/GALLIKER_API_URL/);
    expect(order.transmissions.map((t) => t.status).sort()).toEqual(['FAILED', 'SENT']);

    await expect(services.resendToGalliker(foodbank, orderId)).rejects.toThrow(/Nur Disponenten/);
    await expect(services.resendToGalliker(dispatcher, orderId)).resolves.toMatchObject({ reference: expect.stringMatching(/^GLK-TEST-/) });
    order = await prisma.transportOrder.findUniqueOrThrow({ where: { id: orderId }, include: { transmissions: true } });
    expect([order.gallikerStatus, order.gallikerError]).toEqual(['SENT', null]);
    expect(order.transmissions).toHaveLength(3);
    await expect(services.resendToGalliker(dispatcher, orderId)).rejects.toThrow(/bereits bei Galliker/);
  });

  it('enforces the PENDING → DISPATCHED → COMPLETED lifecycle and completes its reservations', async () => {
    await parkWaitingClaims();
    const d = await insertDonation(coop, { productName: 'Salat', numberOfPallets: 3, overlapStart: inDays(41, 8), overlapEnd: inDays(41, 10) });
    await services.claimDonation(foodbank, d.id, 1);
    await services.runBundling(dispatcher);
    const bundled = await prisma.claim.findFirstOrThrow({ where: { donationId: d.id } });

    await expect(services.setOrderStatus(dispatcher, bundled.transportOrderId!, 'COMPLETED')).rejects.toThrow(/Ungültiger Statuswechsel/);
    await services.setOrderStatus(dispatcher, bundled.transportOrderId!, 'DISPATCHED');
    await services.setOrderStatus(dispatcher, bundled.transportOrderId!, 'COMPLETED');
    expect((await prisma.claim.findUniqueOrThrow({ where: { id: bundled.id } })).status).toBe('COMPLETED');
    // The two unreserved pallets are untouched and still on offer.
    expect((await prisma.donation.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('AVAILABLE');
    await expect(services.setOrderStatus(foodbank, bundled.transportOrderId!, 'DISPATCHED')).rejects.toThrow(/Nur Disponenten/);
  });
});

describe.skipIf(!hasDb)('manual bundling from the preview dialog', () => {
  it('persists an edited plan (split, skip)', async () => {
    await parkWaitingClaims();
    const a = await insertDonation(migros, { productName: 'A', overlapStart: inDays(50, 8), overlapEnd: inDays(50, 12) });
    const b = await insertDonation(migros, { productName: 'B', overlapStart: inDays(50, 9), overlapEnd: inDays(50, 13) });
    const c = await insertDonation(migros, { productName: 'C', overlapStart: inDays(50, 10), overlapEnd: inDays(50, 14) });
    const [ca, cb, cc] = await Promise.all([a, b, c].map(async (d) => (await services.claimDonation(foodbank, d.id, 1)).claim));

    const result = await services.createTransportOrders(dispatcher, [
      { donorId: migros.id, claimIds: [ca.id] },
      { donorId: migros.id, claimIds: [cc.id] },
    ]);
    expect(result).toMatchObject({ orders: 2, positions: 2, sent: 2 });
    const rows = Object.fromEntries((await prisma.claim.findMany({ where: { id: { in: [ca.id, cb.id, cc.id] } } })).map((r) => [r.id, r]));
    expect(rows[ca.id].transportOrderId).not.toBe(rows[cc.id].transportOrderId);
    expect([rows[cb.id].status, rows[cb.id].transportOrderId]).toEqual(['RESERVED', null]);
  });

  it('rejects invalid manual bundles', async () => {
    const x = await insertDonation(migros, { productName: 'X', overlapStart: inDays(60, 8), overlapEnd: inDays(60, 12) });
    const y = await insertDonation(coop, { productName: 'Y', overlapStart: inDays(60, 8), overlapEnd: inDays(60, 12) });
    const z = await insertDonation(migros, { productName: 'Z', pickupAddress: 'Seestrasse 1, 8002 Zürich', overlapStart: inDays(60, 8), overlapEnd: inDays(60, 12) });
    const [cx, cy, cz] = await Promise.all([x, y, z].map(async (d) => (await services.claimDonation(foodbank, d.id, 1)).claim));

    await expect(services.createTransportOrders(dispatcher, [{ donorId: migros.id, claimIds: [] }])).rejects.toThrow(/mindestens eine/);
    await expect(services.createTransportOrders(dispatcher, [{ donorId: migros.id, claimIds: [cx.id] }, { donorId: migros.id, claimIds: [cx.id] }])).rejects.toThrow(/nur in einem/);
    await expect(services.createTransportOrders(dispatcher, [{ donorId: migros.id, claimIds: [cx.id, cy.id] }])).rejects.toThrow(/anderen Spender/);
    await expect(services.createTransportOrders(dispatcher, [{ donorId: migros.id, claimIds: [cx.id, cz.id] }])).rejects.toThrow(/eine Abholadresse/);
    await expect(services.createTransportOrders(foodbank, [{ donorId: migros.id, claimIds: [cx.id] }])).rejects.toThrow(/Nur Disponenten/);
    expect((await prisma.claim.findUniqueOrThrow({ where: { id: cx.id } })).status).toBe('RESERVED');
  });
});

describe.skipIf(!hasDb)('network view scoping', () => {
  it('donors see their own orders, institutions only their own goods on a shared truck', async () => {
    await parkWaitingClaims();
    const m = await insertDonation(migros, { productName: 'M-only', numberOfPallets: 2, overlapStart: inDays(70, 8), overlapEnd: inDays(70, 12) });
    const c = await insertDonation(coop, { productName: 'C-only', overlapStart: inDays(70, 8), overlapEnd: inDays(70, 12) });
    const mine = (await services.claimDonation(foodbank, m.id, 1)).claim;
    const theirs = (await services.claimDonation(foodbank2, m.id, 1)).claim;
    await services.claimDonation(foodbank, c.id, 1);
    await services.runBundling(dispatcher);

    const migrosOrders = await fetchTransportOrders(orderScopeFor(migros));
    expect(migrosOrders.every((o) => o.donorId === migros.id)).toBe(true);
    expect(migrosOrders.flatMap((o) => o.claims).some((cl) => cl.donation.productName === 'C-only')).toBe(false);

    const foodbankOrders = await fetchTransportOrders(orderScopeFor(foodbank));
    const shared = foodbankOrders.find((o) => o.claims.some((cl) => cl.id === mine.id))!;
    expect(shared.claims.some((cl) => cl.id === theirs.id)).toBe(false);

    const all = await fetchTransportOrders(orderScopeFor(dispatcher));
    expect(all.find((o) => o.id === shared.id)!.claims.map((cl) => cl.id).sort()).toEqual([mine.id, theirs.id].sort());
  });
});

describe.skipIf(!hasDb)('impact (FA-04)', () => {
  it('counts reserved pallets only, for everyone', async () => {
    await prisma.gallikerTransmission.deleteMany({});
    await prisma.claim.deleteMany({});
    await prisma.transportOrder.deleteMany({});
    await prisma.donation.deleteMany({});
    const d = await insertDonation(migros, { numberOfPallets: 10, weightPerPallet: 100 });
    await insertDonation(migros, { numberOfPallets: 4, weightPerPallet: 100 }); // nobody reserved it
    await services.claimDonation(foodbank, d.id, 2);
    await services.claimDonation(foodbank2, d.id, 1);

    expect(await fetchGlobalImpact()).toEqual({ totalWeightKg: 300, bags: 60, donationCount: 2 });
    expect((await fetchImpactFor(migros.id, 'DONOR')).totalWeightKg).toBe(300);
    expect((await fetchImpactFor(foodbank.id, 'FOODBANK')).totalWeightKg).toBe(200);
    expect((await fetchImpactFor(foodbank2.id, 'FOODBANK')).totalWeightKg).toBe(100);
    expect((await fetchImpactFor(coop.id, 'DONOR')).totalWeightKg).toBe(0);
  });
});

describe('database outages', () => {
  it('are reported as DatabaseUnavailableError with the digest the error pages recognise', async () => {
    const unreachable = createPrismaClient('postgresql://user:pw@127.0.0.1:1/none');
    const error = await unreachable.user.count().then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect((error as DatabaseUnavailableError).digest).toBe(DB_UNAVAILABLE_DIGEST);
    await unreachable.$disconnect();
  });
});
