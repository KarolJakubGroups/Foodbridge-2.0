import { describe, expect, it } from 'vitest';
import { bundleWindow, partitionIntoBundles, planTransportOrders } from './logistics';

const day = (h: number) => `2026-08-10T${String(h).padStart(2, '0')}:00:00.000Z`;
const w = (name: string, start: number, end: number, donor = 'migros', address = 'Limmatstrasse 152') => ({
  name, donorId: donor, address, overlapStart: day(start), overlapEnd: day(end),
});
const names = (bundles: { bundle?: { items: { name: string }[] }; items?: { name: string }[] }[]) =>
  bundles.map((b) => (b.items ?? b.bundle!.items).map((i) => i.name));

describe('partitionIntoBundles', () => {
  it('bundles overlapping windows into one order (TF-04)', () => {
    const bundles = partitionIntoBundles([w('Pears', 10, 14), w('Apples', 8, 12)]);
    expect(names(bundles)).toEqual([['Apples', 'Pears']]);
  });

  it('keeps disjoint windows apart (TF-05)', () => {
    expect(names(partitionIntoBundles([w('Milk', 14, 16), w('Bread', 8, 10)]))).toEqual([['Bread'], ['Milk']]);
  });

  it('treats a start exactly on the reference end as overlap (<=)', () => {
    expect(partitionIntoBundles([w('A', 8, 10), w('B', 10, 12)])).toHaveLength(1);
  });

  it('splits chained overlaps that share no common instant', () => {
    // A 8-10, B 9-13, C 11-14: B overlaps both, A and C never overlap
    expect(names(partitionIntoBundles([w('C', 11, 14), w('B', 9, 13), w('A', 8, 10)]))).toEqual([['A', 'B'], ['C']]);
  });

  it('returns nothing for empty input', () => {
    expect(partitionIntoBundles([])).toEqual([]);
  });

  it('handles well over 100 reservations far below the 200 ms budget (NFA-01)', () => {
    const many = Array.from({ length: 500 }, (_, i) => w(`D${i}`, i % 12, (i % 12) + 3));
    const start = performance.now();
    const bundles = partitionIntoBundles(many);
    expect(performance.now() - start).toBeLessThan(200);
    expect(bundles.length).toBeGreaterThan(0);
  });
});

describe('bundleWindow', () => {
  it('is the span every item can be collected in', () => {
    const win = bundleWindow([w('A', 8, 12), w('B', 10, 14)]);
    expect(win).toEqual({ start: new Date(day(10)), end: new Date(day(12)), overlaps: true });
  });

  it('collapses to the earliest end and flags it when nothing overlaps', () => {
    const win = bundleWindow([w('A', 8, 10), w('B', 14, 16)]);
    expect(win).toEqual({ start: new Date(day(10)), end: new Date(day(10)), overlaps: false });
  });

  it('every bundle from the algorithm has a real common window', () => {
    for (const b of partitionIntoBundles([w('A', 8, 12), w('B', 9, 13), w('C', 11, 16), w('D', 15, 18)])) {
      expect(b.window.overlaps).toBe(true);
      expect(b.window.start.getTime()).toBeLessThanOrEqual(b.window.end.getTime());
    }
  });
});

describe('planTransportOrders', () => {
  it('never bundles across donors', () => {
    const plan = planTransportOrders([w('A', 8, 12, 'migros'), w('B', 9, 13, 'coop')]);
    expect(plan.map((p) => p.key).sort()).toEqual(['coop', 'migros']);
  });

  it('never bundles two pickup addresses of the same donor', () => {
    const plan = planTransportOrders(
      [w('A', 8, 12, 'migros', 'Limmatstrasse 152'), w('B', 9, 13, 'migros', 'Seestrasse 1')],
      (i) => `${i.donorId}|${i.address}`,
    );
    expect(plan).toHaveLength(2);
  });
});
