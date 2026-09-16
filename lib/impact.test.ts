import { describe, expect, it } from 'vitest';
import { computeImpact } from './impact';

describe('computeImpact', () => {
  it('derives meals and CO2 from pallets × weight (TF-06)', () => {
    const report = computeImpact([{ numberOfPallets: 2, weightPerPallet: 500 }]);
    expect(report).toEqual({ totalWeightKg: 1000, meals: 2000, co2SavedKg: 1100, donationCount: 1 });
  });

  it('is zero for no donations', () => {
    expect(computeImpact([])).toEqual({ totalWeightKg: 0, meals: 0, co2SavedKg: 0, donationCount: 0 });
  });
});
