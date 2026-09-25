import { describe, expect, it } from 'vitest';
import { buildDonorDashboard, type DashboardClaim, type DashboardDonation } from './dashboard';
import { claimDeadline, claimDeadlineReason, donationState, isClaimable } from './domain';

const NOW = new Date('2026-09-24T10:00:00.000Z');
const HOUR = 3_600_000; const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const later = (ms: number) => new Date(NOW.getTime() + ms);
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString().slice(0, 10);

const claim = (over: Partial<DashboardClaim> = {}): DashboardClaim => ({
  pallets: 1, status: 'RESERVED', claimedAt: NOW, foodbank: { organizationName: 'Tafel Zürich' }, transportOrder: null, ...over,
});

let seq = 0;
/** An offer; claimedPallets follows the claims unless given. */
const donation = (over: Partial<DashboardDonation> = {}): DashboardDonation => {
  const claims = over.claims ?? [];
  const numberOfPallets = over.numberOfPallets ?? 1;
  const claimedPallets = over.claimedPallets ?? claims.reduce((s, c) => s + c.pallets, 0);
  return {
    id: ++seq, productName: `P${seq}`, category: 'FRUIT_VEG',
    status: claimedPallets >= numberOfPallets ? 'CLAIMED' : 'AVAILABLE',
    weightPerPallet: 100, bestBeforeDate: inDays(10), createdAt: NOW, overlapEnd: later(2 * DAY),
    ...over, numberOfPallets, claimedPallets, claims,
  };
};

describe('claim deadline', () => {
  it('is the 4-day limit when the pickup window lasts longer', () => {
    const d = { createdAt: ago(1 * DAY), overlapEnd: later(10 * DAY) };
    expect(claimDeadline(d)).toEqual(later(3 * DAY));
    expect(claimDeadlineReason(d)).toBe('FRESHNESS');
  });

  it('is the end of the pickup window when that comes first', () => {
    const d = { createdAt: NOW, overlapEnd: later(5 * HOUR) };
    expect(claimDeadline(d)).toEqual(later(5 * HOUR));
    expect(claimDeadlineReason(d)).toBe('WINDOW');
  });

  it('makes an offer unclaimable once the window has passed, even if it is fresh', () => {
    const base = { status: 'AVAILABLE', numberOfPallets: 2, claimedPallets: 0, createdAt: ago(HOUR) };
    expect(isClaimable({ ...base, overlapEnd: later(HOUR) }, NOW)).toBe(true);
    expect(isClaimable({ ...base, overlapEnd: ago(1) }, NOW)).toBe(false);
    expect(isClaimable({ ...base, claimedPallets: 2, overlapEnd: later(HOUR) }, NOW)).toBe(false);
  });
});

describe('donationState', () => {
  const state = (over: Partial<DashboardDonation>) => donationState(donation(over), NOW);

  it('is open, partial or fully reserved depending on the pallets taken', () => {
    expect(state({ numberOfPallets: 3 })).toBe('OPEN');
    expect(state({ numberOfPallets: 3, claims: [claim({ pallets: 1 })] })).toBe('PARTIAL');
    expect(state({ numberOfPallets: 3, claims: [claim({ pallets: 1 }), claim({ pallets: 2 })] })).toBe('RESERVED');
  });

  it('follows the transports once everything is reserved', () => {
    const order = { id: 1, pickupStart: NOW, pickupEnd: later(HOUR), status: 'PENDING' };
    expect(state({ numberOfPallets: 2, claims: [claim({ pallets: 2, status: 'BUNDLED', transportOrder: order })] })).toBe('SCHEDULED');
    expect(state({ numberOfPallets: 2, claims: [claim({ pallets: 1, status: 'BUNDLED' }), claim({ pallets: 1 })] })).toBe('RESERVED');
    expect(state({ numberOfPallets: 2, claims: [claim({ pallets: 2, status: 'COMPLETED' })] })).toBe('COLLECTED');
  });

  it('expires pallets left after the deadline, whether or not some were reserved', () => {
    expect(state({ createdAt: ago(5 * DAY) })).toBe('EXPIRED');
    expect(state({ overlapEnd: ago(HOUR) })).toBe('EXPIRED');
    expect(state({ numberOfPallets: 3, overlapEnd: ago(HOUR), claims: [claim({ pallets: 1 })] })).toBe('EXPIRED');
  });

  it('counts leftover pallets as settled once every reservation is delivered', () => {
    expect(state({ numberOfPallets: 3, overlapEnd: ago(HOUR), claims: [claim({ pallets: 1, status: 'COMPLETED' })] })).toBe('COLLECTED');
  });

  it('keeps withdrawn offers withdrawn', () => {
    expect(state({ status: 'WITHDRAWN' })).toBe('WITHDRAWN');
  });
});

describe('buildDonorDashboard', () => {
  it('counts every state and lists offers with pallets left after the deadline', () => {
    const board = buildDonorDashboard([
      donation(),
      donation({ numberOfPallets: 2, claims: [claim()] }),
      donation({ productName: 'Alt', createdAt: ago(5 * DAY) }),
      donation({ claims: [claim()] }),
      donation({ status: 'WITHDRAWN' }),
    ], NOW);
    expect(board.counts).toMatchObject({ OPEN: 1, PARTIAL: 1, EXPIRED: 1, RESERVED: 1, WITHDRAWN: 1 });
    expect(board.expired.map((d) => d.productName)).toEqual(['Alt']);
  });

  it('warns when the claim deadline is within a day, whichever rule sets it', () => {
    const board = buildDonorDashboard([
      donation({ productName: '4 Tage fast um', createdAt: ago(3.5 * DAY), overlapEnd: later(5 * DAY) }),
      donation({ productName: 'Fenster schliesst', overlapEnd: later(3 * HOUR) }),
      donation({ productName: 'Viel Zeit', overlapEnd: later(3 * DAY) }),
    ], NOW);
    expect(board.expiringSoon.map((d) => d.productName).sort()).toEqual(['4 Tage fast um', 'Fenster schliesst']);
  });

  it('warns about a near best-before date only while the goods are still here', () => {
    const board = buildDonorDashboard([
      donation({ productName: 'Knapp', bestBeforeDate: inDays(1) }),
      donation({ productName: 'Lange haltbar', bestBeforeDate: inDays(9) }),
      donation({ productName: 'Schon weg', bestBeforeDate: inDays(1), claims: [claim({ status: 'COMPLETED' })] }),
    ], NOW);
    expect(board.bestBeforeSoon.map((d) => d.productName)).toEqual(['Knapp']);
  });

  it('shows the earliest pickup still ahead with only the reserved pallets', () => {
    const soon = { id: 1, pickupStart: later(DAY), pickupEnd: later(DAY + 5 * HOUR), status: 'PENDING' };
    const laterOrder = { id: 2, pickupStart: later(3 * DAY), pickupEnd: later(3 * DAY + HOUR), status: 'PENDING' };
    const done = { id: 3, pickupStart: ago(DAY), pickupEnd: ago(DAY - HOUR), status: 'COMPLETED' };
    const board = buildDonorDashboard([
      donation({ productName: 'Milch', numberOfPallets: 5, weightPerPallet: 50, claims: [claim({ pallets: 2, status: 'BUNDLED', transportOrder: soon })] }),
      donation({ productName: 'Brot', weightPerPallet: 30, claims: [claim({ status: 'BUNDLED', transportOrder: soon })] }),
      donation({ claims: [claim({ status: 'BUNDLED', transportOrder: laterOrder })] }),
      donation({ claims: [claim({ status: 'COMPLETED', transportOrder: done })] }),
    ], NOW);

    expect(board.nextPickup).toMatchObject({ orderId: 1, pickupStart: soon.pickupStart, pickupEnd: soon.pickupEnd, totalPallets: 3, totalWeightKg: 130 });
    expect(board.nextPickup?.items).toEqual([
      { productName: 'Milch', pallets: 2, weightKg: 100 },
      { productName: 'Brot', pallets: 1, weightKg: 30 },
    ]);
  });

  it('has no next pickup when everything is delivered', () => {
    const done = { id: 9, pickupStart: ago(DAY), pickupEnd: ago(DAY), status: 'COMPLETED' };
    expect(buildDonorDashboard([donation({ claims: [claim({ status: 'COMPLETED', transportOrder: done })] })], NOW).nextPickup).toBeNull();
  });

  it('counts impact from reserved pallets only, by the month they were reserved', () => {
    const board = buildDonorDashboard([
      // 5 pallets offered, 2 reserved this month: only 200 kg count
      donation({ numberOfPallets: 5, claims: [claim({ pallets: 2, claimedAt: new Date('2026-09-10T08:00:00.000Z') })] }),
      donation({ claims: [claim({ pallets: 1, status: 'COMPLETED', claimedAt: new Date('2026-08-10T08:00:00.000Z') })] }),
      donation({ numberOfPallets: 7 }), // nobody reserved: rescues nothing
    ], NOW);

    expect(board.impact.thisMonth.totalWeightKg).toBe(200);
    expect(board.impact.lastMonth.totalWeightKg).toBe(100);
    expect(board.impact.total.totalWeightKg).toBe(300);
    expect(board.impact.deltaPercent).toBe(100);
  });

  it('leaves the trend empty without a previous month', () => {
    expect(buildDonorDashboard([donation({ claims: [claim()] })], NOW).impact.deltaPercent).toBeNull();
  });

  it('ranks categories by reserved weight and lists every recipient once', () => {
    const board = buildDonorDashboard([
      donation({ category: 'BAKERY', numberOfPallets: 5, weightPerPallet: 500, claims: [claim({ pallets: 1 })] }),
      donation({ category: 'FRUIT_VEG', claims: [claim()] }),
      donation({ category: 'BAKERY', numberOfPallets: 2, claims: [claim({ foodbank: { organizationName: 'Tafel Bern' } }), claim()] }),
    ], NOW);
    expect(board.topCategories).toEqual([
      { category: 'BAKERY', totalWeightKg: 700 },
      { category: 'FRUIT_VEG', totalWeightKg: 100 },
    ]);
    expect(board.recipients).toEqual(['Tafel Bern', 'Tafel Zürich']);
  });
});
