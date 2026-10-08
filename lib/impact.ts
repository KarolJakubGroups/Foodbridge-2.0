/** Impact tracking: rescued weight and the shopping bags it fills. */
export const KG_PER_BAG = 5; // Schweizer Tafel: one shopping bag handed out holds about 5 kg

export interface ImpactReport {
  totalWeightKg: number;
  /** Shopping bags (Einkaufstaschen) the rescued food fills. */
  bags: number;
  /** Reservations counted. */
  donationCount: number;
}

/** Each row is one reservation with the weight of its pallets. */
export function computeImpact(rows: readonly { weightKg: number }[]): ImpactReport {
  const totalWeightKg = rows.reduce((sum, r) => sum + r.weightKg, 0);
  return {
    totalWeightKg,
    bags: Math.round(totalWeightKg / KG_PER_BAG),
    donationCount: rows.length,
  };
}
