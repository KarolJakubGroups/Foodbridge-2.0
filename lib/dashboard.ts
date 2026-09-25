import { computeImpact, type ImpactReport } from '@/lib/impact';
import { claimDeadline, donationState, remainingPallets, type DonationState } from '@/lib/domain';

/** Minimal shape the donor dashboard needs; kept structural so it can be unit-tested without a database. */
export interface DashboardClaim {
  pallets: number;
  status: string;
  claimedAt: Date;
  foodbank: { organizationName: string };
  transportOrder: { id: number; pickupStart: Date; pickupEnd: Date; status: string } | null;
}

export interface DashboardDonation {
  id: number;
  productName: string;
  category: string;
  status: string;
  numberOfPallets: number;
  claimedPallets: number;
  weightPerPallet: number;
  bestBeforeDate: string;
  createdAt: Date;
  overlapEnd: Date;
  claims: DashboardClaim[];
}

export interface NextPickup {
  orderId: number;
  pickupStart: Date;
  pickupEnd: Date;
  status: string;
  items: { productName: string; pallets: number; weightKg: number }[];
  totalPallets: number;
  totalWeightKg: number;
}

export interface DonorDashboard {
  counts: Record<DonationState, number>;
  nextPickup: NextPickup | null;
  /** Offers still open whose claim deadline is within a day. */
  expiringSoon: DashboardDonation[];
  /** Registered goods whose best-before date is near and that are not collected yet. */
  bestBeforeSoon: DashboardDonation[];
  /** Offers with pallets left after the claim deadline. */
  expired: DashboardDonation[];
  impact: { thisMonth: ImpactReport; lastMonth: ImpactReport; total: ImpactReport; deltaPercent: number | null };
  topCategories: { category: string; totalWeightKg: number }[];
  recipients: string[];
}

const DAY = 86_400_000;
/** Warn this long before an offer can no longer be reserved / before the best-before date. */
export const EXPIRY_WARNING_MS = DAY;
export const BEST_BEFORE_WARNING_DAYS = 2;

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function buildDonorDashboard(donations: DashboardDonation[], now = new Date()): DonorDashboard {
  const counts: Record<DonationState, number> = { OPEN: 0, PARTIAL: 0, EXPIRED: 0, RESERVED: 0, SCHEDULED: 0, COLLECTED: 0, WITHDRAWN: 0 };
  const expiringSoon: DashboardDonation[] = [];
  const bestBeforeSoon: DashboardDonation[] = [];
  const expired: DashboardDonation[] = [];
  const bestBeforeLimit = isoDate(new Date(now.getTime() + BEST_BEFORE_WARNING_DAYS * DAY));

  for (const d of donations) {
    const state = donationState(d, now);
    counts[state] += 1;
    const open = state === 'OPEN' || state === 'PARTIAL';
    if (open && claimDeadline(d).getTime() - now.getTime() <= EXPIRY_WARNING_MS) expiringSoon.push(d);
    if (state === 'EXPIRED') expired.push(d);
    if ((open || state === 'RESERVED' || state === 'SCHEDULED') && d.bestBeforeDate <= bestBeforeLimit) bestBeforeSoon.push(d);
  }

  // Earliest pickup still ahead: reservations in an order that is not delivered yet.
  const openOrders = new Map<number, NextPickup>();
  for (const d of donations) {
    for (const c of d.claims) {
      const o = c.transportOrder;
      if (!o || o.status === 'COMPLETED') continue;
      const entry = openOrders.get(o.id) ?? {
        orderId: o.id, pickupStart: o.pickupStart, pickupEnd: o.pickupEnd, status: o.status, items: [], totalPallets: 0, totalWeightKg: 0,
      };
      const weightKg = c.pallets * d.weightPerPallet;
      entry.items.push({ productName: d.productName, pallets: c.pallets, weightKg });
      entry.totalPallets += c.pallets;
      entry.totalWeightKg += weightKg;
      openOrders.set(o.id, entry);
    }
  }
  const nextPickup = [...openOrders.values()].sort((a, b) => a.pickupStart.getTime() - b.pickupStart.getTime())[0] ?? null;

  // Impact: reserved pallets only, attributed to the month they were reserved in.
  const rescued = donations.flatMap((d) => d.claims.map((c) => ({
    numberOfPallets: c.pallets, weightPerPallet: d.weightPerPallet, category: d.category, claimedAt: c.claimedAt,
  })));
  const thisKey = monthKey(now);
  const impact = {
    thisMonth: computeImpact(rescued.filter((r) => monthKey(r.claimedAt) === thisKey)),
    lastMonth: computeImpact(rescued.filter((r) => monthKey(r.claimedAt) === thisKey - 1)),
    total: computeImpact(rescued),
    deltaPercent: null as number | null,
  };
  if (impact.lastMonth.totalWeightKg > 0) {
    impact.deltaPercent = Math.round(((impact.thisMonth.totalWeightKg - impact.lastMonth.totalWeightKg) / impact.lastMonth.totalWeightKg) * 100);
  }

  const byCategory = new Map<string, number>();
  for (const r of rescued) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.numberOfPallets * r.weightPerPallet);
  const topCategories = [...byCategory.entries()]
    .map(([category, totalWeightKg]) => ({ category, totalWeightKg }))
    .sort((a, b) => b.totalWeightKg - a.totalWeightKg)
    .slice(0, 3);

  const recipients = [...new Set(donations.flatMap((d) => d.claims.map((c) => c.foodbank.organizationName)))].sort();

  return { counts, nextPickup, expiringSoon, bestBeforeSoon, expired, impact, topCategories, recipients };
}

/** Pallets of an offer nobody reserved (for the "withdraw the rest" prompt). */
export const unreservedPallets = remainingPallets;
