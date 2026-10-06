import { describe, expect, it } from 'vitest';
import { computeImpact } from './impact';

describe('computeImpact', () => {
  it('derives meals from the reserved weight (TF-06)', () => {
    const report = computeImpact([{ weightKg: 620 }, { weightKg: 380 }]);
    expect(report).toEqual({ totalWeightKg: 1000, meals: 2000, donationCount: 2 });
  });

  it('is zero for no donations', () => {
    expect(computeImpact([])).toEqual({ totalWeightKg: 0, meals: 0, donationCount: 0 });
  });
});
