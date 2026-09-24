import { describe, expect, it } from 'vitest';
import { buildDonorDashboard, type DashboardDonation } from './dashboard';
import { donationState } from './domain';

const NOW = new Date('2026-09-24T10:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10);

let seq = 0;
const donation = (over: Partial<DashboardDonation> = {}): DashboardDonation => ({
  id: ++seq, productName: `P${seq}`, category: 'FRUIT_VEG', status: 'AVAILABLE',
  numberOfPallets: 1, weightPerPallet: 100, bestBeforeDate: inDays(10), createdAt: NOW,
  transportOrder: null, claim: null, ...over,
});

describe('donationState', () => {
  it('marks an unreserved offer older than 4 days as expired', () => {
    expect(donationState({ status: 'AVAILABLE', createdAt: daysAgo(1) }, NOW)).toBe('OPEN');
    expect(donationState({ status: 'AVAILABLE', createdAt: daysAgo(5) }, NOW)).toBe('EXPIRED');
  });

  it('maps the stored statuses to donor-facing states', () => {
    expect(donationState({ status: 'CLAIMED', createdAt: daysAgo(9) }, NOW)).toBe('RESERVED');
    expect(donationState({ status: 'BUNDLED', createdAt: daysAgo(9) }, NOW)).toBe('SCHEDULED');
    expect(donationState({ status: 'COMPLETED', createdAt: daysAgo(9) }, NOW)).toBe('COLLECTED');
    expect(donationState({ status: 'WITHDRAWN', createdAt: NOW }, NOW)).toBe('WITHDRAWN');
  });
});

describe('buildDonorDashboard', () => {
  it('counts every state and lists expired offers', () => {
    const board = buildDonorDashboard([
      donation({ createdAt: daysAgo(1) }),
      donation({ createdAt: daysAgo(5), productName: 'Alt' }),
      donation({ status: 'CLAIMED' }),
      donation({ status: 'BUNDLED' }),
      donation({ status: 'COMPLETED' }),
      donation({ status: 'WITHDRAWN' }),
    ], NOW);

    expect(board.counts).toEqual({ OPEN: 1, EXPIRED: 1, RESERVED: 1, SCHEDULED: 1, COLLECTED: 1, WITHDRAWN: 1 });
    expect(board.expired.map((d) => d.productName)).toEqual(['Alt']);
  });

  it('warns about offers whose visibility ends within a day', () => {
    const board = buildDonorDashboard([
      donation({ createdAt: daysAgo(3.5), productName: 'Bald weg' }),
      donation({ createdAt: daysAgo(1), productName: 'Frisch' }),
    ], NOW);
    expect(board.expiringSoon.map((d) => d.productName)).toEqual(['Bald weg']);
  });

  it('warns about a near best-before date only while the goods are still here', () => {
    const board = buildDonorDashboard([
      donation({ bestBeforeDate: inDays(1), productName: 'Knapp' }),
      donation({ bestBeforeDate: inDays(9), productName: 'Lange haltbar' }),
      donation({ bestBeforeDate: inDays(1), productName: 'Schon weg', status: 'COMPLETED' }),
    ], NOW);
    expect(board.bestBeforeSoon.map((d) => d.productName)).toEqual(['Knapp']);
  });

  it('picks the earliest pickup that is still ahead and sums its load', () => {
    const later = { id: 2, pickupTime: new Date('2026-09-28T10:00:00.000Z'), status: 'PENDING' };
    const soon = { id: 1, pickupTime: new Date('2026-09-25T10:00:00.000Z'), status: 'DISPATCHED' };
    const done = { id: 3, pickupTime: new Date('2026-09-24T10:00:00.000Z'), status: 'COMPLETED' };
    const board = buildDonorDashboard([
      donation({ status: 'BUNDLED', transportOrder: later }),
      donation({ status: 'BUNDLED', transportOrder: soon, numberOfPallets: 2, weightPerPallet: 50 }),
      donation({ status: 'BUNDLED', transportOrder: soon, numberOfPallets: 1, weightPerPallet: 30 }),
      donation({ status: 'COMPLETED', transportOrder: done }),
    ], NOW);

    expect(board.nextPickup?.orderId).toBe(1);
    expect(board.nextPickup?.totalPallets).toBe(3);
    expect(board.nextPickup?.totalWeightKg).toBe(130);
    expect(board.nextPickup?.donations).toHaveLength(2);
  });

  it('has no next pickup when everything is collected', () => {
    const board = buildDonorDashboard([
      donation({ status: 'COMPLETED', transportOrder: { id: 9, pickupTime: NOW, status: 'COMPLETED' } }),
    ], NOW);
    expect(board.nextPickup).toBeNull();
  });

  it('splits impact by month and ignores unreserved goods', () => {
    const board = buildDonorDashboard([
      donation({ status: 'CLAIMED', createdAt: new Date('2026-09-10T08:00:00.000Z'), numberOfPallets: 2, weightPerPallet: 100 }),
      donation({ status: 'COMPLETED', createdAt: new Date('2026-08-10T08:00:00.000Z'), numberOfPallets: 1, weightPerPallet: 100 }),
      donation({ status: 'AVAILABLE', numberOfPallets: 5, weightPerPallet: 100 }),
    ], NOW);

    expect(board.impact.thisMonth.totalWeightKg).toBe(200);
    expect(board.impact.lastMonth.totalWeightKg).toBe(100);
    expect(board.impact.total.totalWeightKg).toBe(300);
    expect(board.impact.deltaPercent).toBe(100);
  });

  it('leaves the trend empty without a previous month', () => {
    const board = buildDonorDashboard([donation({ status: 'CLAIMED' })], NOW);
    expect(board.impact.deltaPercent).toBeNull();
  });

  it('ranks categories by rescued weight and lists recipients once', () => {
    const tafel = { foodbank: { organizationName: 'Tafel Zürich' } };
    const board = buildDonorDashboard([
      donation({ status: 'CLAIMED', category: 'BAKERY', numberOfPallets: 1, weightPerPallet: 500, claim: tafel }),
      donation({ status: 'CLAIMED', category: 'FRUIT_VEG', numberOfPallets: 1, weightPerPallet: 100, claim: tafel }),
      donation({ status: 'CLAIMED', category: 'BAKERY', numberOfPallets: 1, weightPerPallet: 100, claim: { foodbank: { organizationName: 'Tafel Bern' } } }),
    ], NOW);

    expect(board.topCategories).toEqual([
      { category: 'BAKERY', totalWeightKg: 600 },
      { category: 'FRUIT_VEG', totalWeightKg: 100 },
    ]);
    expect(board.recipients).toEqual(['Tafel Bern', 'Tafel Zürich']);
  });
});
