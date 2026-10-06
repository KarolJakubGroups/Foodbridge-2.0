/** Impact tracking: rescued weight and the meals it makes. */
export const MEALS_PER_KG = 2; // Schweizer Tafel: roughly two meals per kilogram rescued

export interface ImpactReport {
  totalWeightKg: number;
  meals: number;
  /** Reservations counted. */
  donationCount: number;
}

/** Each row is one reservation with the weight of its pallets. */
export function computeImpact(rows: readonly { weightKg: number }[]): ImpactReport {
  const totalWeightKg = rows.reduce((sum, r) => sum + r.weightKg, 0);
  return {
    totalWeightKg,
    meals: Math.round(totalWeightKg * MEALS_PER_KG),
    donationCount: rows.length,
  };
}
