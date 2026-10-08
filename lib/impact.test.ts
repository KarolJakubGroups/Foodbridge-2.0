import { describe, expect, it } from 'vitest';
import { computeImpact } from './impact';

describe('computeImpact', () => {
  it('derives shopping bags (5 kg each) from the reserved weight (TF-06)', () => {
    const report = computeImpact([{ weightKg: 620 }, { weightKg: 380 }]);
    expect(report).toEqual({ totalWeightKg: 1000, bags: 200, donationCount: 2 });
  });

  it('is zero for no donations', () => {
    expect(computeImpact([])).toEqual({ totalWeightKg: 0, bags: 0, donationCount: 0 });
  });
});
