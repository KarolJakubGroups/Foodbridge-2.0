import { weightKg } from '@/lib/domain';

/** Impact tracking: rescued weight, resulting meals and avoided CO2. */
export const MEALS_PER_KG = 2; // Schweizer Tafel: roughly two meals per kilogram rescued
export const CO2_PER_KG = 1.1; // kg CO2e avoided per kilogram of food not wasted

export interface ImpactReport {
  totalWeightKg: number;
  meals: number;
  co2SavedKg: number;
  donationCount: number;
}

export function computeImpact(donations: readonly { numberOfPallets: number; weightPerPallet: number }[]): ImpactReport {
  const totalWeightKg = donations.reduce((sum, d) => sum + weightKg(d), 0);
  return {
    totalWeightKg,
    meals: Math.round(totalWeightKg * MEALS_PER_KG),
    co2SavedKg: Math.round(totalWeightKg * CO2_PER_KG * 10) / 10,
    donationCount: donations.length,
  };
}
