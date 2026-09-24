import { computeImpact, type ImpactReport } from '@/lib/impact';
import { RESCUED_STATUSES, donationState, visibleUntil, weightKg, type DonationState } from '@/lib/domain';

/** Minimal shape the donor dashboard needs; kept structural so it can be unit-tested without a database. */
export interface DashboardDonation {
  id: number;
  productName: string;
  category: string;
  status: string;
  numberOfPallets: number;
  weightPerPallet: number;
  bestBeforeDate: string;
  createdAt: Date;
  transportOrder: { id: number; pickupTime: Date; status: string } | null;
  claim: { foodbank: { organizationName: string } } | null;
}

export interface NextPickup {
  orderId: number;
  pickupTime: Date;
  status: string;
  donations: DashboardDonation[];
  totalPallets: number;
  totalWeightKg: number;
}

export interface DonorDashboard {
  counts: Record<DonationState, number>;
  nextPickup: NextPickup | null;
  /** Unreserved offers whose visibility ends within a day. */
  expiringSoon: DashboardDonation[];
  /** Registered goods whose best-before date is near and that are not collected yet. */
  bestBeforeSoon: DashboardDonation[];
  expired: DashboardDonation[];
  impact: { thisMonth: ImpactReport; lastMonth: ImpactReport; total: ImpactReport; deltaPercent: number | null };
  topCategories: { category: string; totalWeightKg: number }[];
  recipients: string[];
}

const DAY = 86_400_000;
/** Warn this long before an offer stops being visible / before the best-before date. */
export const EXPIRY_WARNING_MS = DAY;
export const BEST_BEFORE_WARNING_DAYS = 2;

const isRescued = (d: DashboardDonation) => (RESCUED_STATUSES as readonly string[]).includes(d.status);
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function buildDonorDashboard(donations: DashboardDonation[], now = new Date()): DonorDashboard {
  const counts: Record<DonationState, number> = { OPEN: 0, EXPIRED: 0, RESERVED: 0, SCHEDULED: 0, COLLECTED: 0, WITHDRAWN: 0 };
  const expiringSoon: DashboardDonation[] = [];
  const bestBeforeSoon: DashboardDonation[] = [];
  const expired: DashboardDonation[] = [];
  const bestBeforeLimit = isoDate(new Date(now.getTime() + BEST_BEFORE_WARNING_DAYS * DAY));

  for (const d of donations) {
    const state = donationState(d, now);
    counts[state] += 1;
    if (state === 'OPEN' && visibleUntil(d.createdAt).getTime() - now.getTime() <= EXPIRY_WARNING_MS) expiringSoon.push(d);
    if (state === 'EXPIRED') expired.push(d);
    if (['OPEN', 'RESERVED', 'SCHEDULED'].includes(state) && d.bestBeforeDate <= bestBeforeLimit) bestBeforeSoon.push(d);
  }

  // Earliest pickup that is still ahead: donations bundled into an order that is not completed.
  const openOrders = new Map<number, DashboardDonation[]>();
  for (const d of donations) {
    const o = d.transportOrder;
    if (!o || o.status === 'COMPLETED') continue;
    openOrders.set(o.id, [...(openOrders.get(o.id) ?? []), d]);
  }
  let nextPickup: NextPickup | null = null;
  for (const [orderId, group] of openOrders) {
    const order = group[0].transportOrder!;
    if (nextPickup && nextPickup.pickupTime <= order.pickupTime) continue;
    nextPickup = {
      orderId, pickupTime: order.pickupTime, status: order.status, donations: group,
      totalPallets: group.reduce((s, d) => s + d.numberOfPallets, 0),
      totalWeightKg: group.reduce((s, d) => s + weightKg(d), 0),
    };
  }

  const rescued = donations.filter(isRescued);
  const thisKey = monthKey(now);
  const impact = {
    thisMonth: computeImpact(rescued.filter((d) => monthKey(d.createdAt) === thisKey)),
    lastMonth: computeImpact(rescued.filter((d) => monthKey(d.createdAt) === thisKey - 1)),
    total: computeImpact(rescued),
    deltaPercent: null as number | null,
  };
  if (impact.lastMonth.totalWeightKg > 0) {
    impact.deltaPercent = Math.round(((impact.thisMonth.totalWeightKg - impact.lastMonth.totalWeightKg) / impact.lastMonth.totalWeightKg) * 100);
  }

  const byCategory = new Map<string, number>();
  for (const d of rescued) byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + weightKg(d));
  const topCategories = [...byCategory.entries()]
    .map(([category, totalWeightKg]) => ({ category, totalWeightKg }))
    .sort((a, b) => b.totalWeightKg - a.totalWeightKg)
    .slice(0, 3);

  const recipients = [...new Set(donations.flatMap((d) => (d.claim ? [d.claim.foodbank.organizationName] : [])))].sort();

  return { counts, nextPickup, expiringSoon, bestBeforeSoon, expired, impact, topCategories, recipients };
}
