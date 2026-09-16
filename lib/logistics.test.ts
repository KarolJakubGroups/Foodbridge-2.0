import { describe, expect, it } from 'vitest';
import { partitionIntoBundles, planTransportOrders } from './logistics';

const day = (h: number) => `2026-08-10T${String(h).padStart(2, '0')}:00:00.000Z`;
const w = (name: string, start: number, end: number, donor = 'migros') => ({
  name, donorId: donor, overlapStart: day(start), overlapEnd: day(end),
});

describe('partitionIntoBundles', () => {
  it('bundles overlapping windows into one order (TF-04)', () => {
    const a = w('Apples', 8, 12);
    const b = w('Pears', 10, 14);
    const bundles = partitionIntoBundles([b, a]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].donations.map((d) => d.name)).toEqual(['Apples', 'Pears']);
    expect(bundles[0].bundleEnd).toBe(day(12));
  });

  it('keeps disjoint windows apart (TF-05)', () => {
    const bundles = partitionIntoBundles([w('Milk', 14, 16), w('Bread', 8, 10)]);
    expect(bundles.map((b) => b.donations.map((d) => d.name))).toEqual([['Bread'], ['Milk']]);
  });

  it('treats a start exactly on the reference end as overlap (<=)', () => {
    expect(partitionIntoBundles([w('A', 8, 10), w('B', 10, 12)])).toHaveLength(1);
  });

  it('splits chained overlaps that share no common instant', () => {
    // A 8-10, B 9-13, C 11-14: B overlaps both, A and C never overlap
    const bundles = partitionIntoBundles([w('C', 11, 14), w('B', 9, 13), w('A', 8, 10)]);
    expect(bundles.map((b) => b.donations.map((d) => d.name))).toEqual([['A', 'B'], ['C']]);
  });

  it('returns nothing for empty input', () => {
    expect(partitionIntoBundles([])).toEqual([]);
  });

  it('handles well over 100 donations far below the 200 ms budget (NFA-01)', () => {
    const many = Array.from({ length: 500 }, (_, i) => w(`D${i}`, i % 12, (i % 12) + 3));
    const start = performance.now();
    const bundles = partitionIntoBundles(many);
    expect(performance.now() - start).toBeLessThan(200);
    expect(bundles.length).toBeGreaterThan(0);
  });
});

describe('planTransportOrders', () => {
  it('never bundles across donors', () => {
    const plan = planTransportOrders([w('A', 8, 12, 'migros'), w('B', 9, 13, 'coop')]);
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.donorId).sort()).toEqual(['coop', 'migros']);
  });
});
