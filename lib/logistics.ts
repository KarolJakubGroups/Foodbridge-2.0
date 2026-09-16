/**
 * Galliker consolidation (interval scheduling / point stabbing).
 *
 * Donations of one donor are sorted by the end of their pickup window. The first
 * donation opens a bundle whose reference end is its own window end. Every
 * following donation that starts at or before that reference end shares a common
 * point in time with everything already in the bundle and joins it; the first one
 * that starts later opens a new bundle. Yields the minimum number of pickups in
 * O(n log n).
 */
export interface Window {
  overlapStart: Date | string;
  overlapEnd: Date | string;
}

export interface Bundle<T extends Window> {
  donations: T[];
  /** Smallest window end in the bundle: the instant every member is still open. */
  bundleEnd: Date | string;
}

const ms = (t: Date | string) => new Date(t).getTime();

export function partitionIntoBundles<T extends Window>(input: readonly T[]): Bundle<T>[] {
  if (input.length === 0) return [];

  const donations = [...input].sort((a, b) => ms(a.overlapEnd) - ms(b.overlapEnd));
  const bundles: Bundle<T>[] = [];
  let current: T[] = [];
  let bundleCurrentEnd = 0;

  for (const donation of donations) {
    if (current.length === 0) {
      current.push(donation);
      bundleCurrentEnd = ms(donation.overlapEnd);
    } else if (ms(donation.overlapStart) <= bundleCurrentEnd) {
      // starts at or before the reference end -> overlaps with the whole bundle
      current.push(donation);
    } else {
      bundles.push({ donations: current, bundleEnd: current[0].overlapEnd });
      current = [donation];
      bundleCurrentEnd = ms(donation.overlapEnd);
    }
  }
  if (current.length > 0) {
    bundles.push({ donations: current, bundleEnd: current[0].overlapEnd });
  }
  return bundles;
}

/** Groups by donor and bundles each donor's donations independently. */
export function planTransportOrders<T extends Window & { donorId: string }>(
  donations: readonly T[],
): { donorId: string; bundle: Bundle<T> }[] {
  const byDonor = new Map<string, T[]>();
  for (const d of donations) {
    const list = byDonor.get(d.donorId) ?? [];
    list.push(d);
    byDonor.set(d.donorId, list);
  }
  const plan: { donorId: string; bundle: Bundle<T> }[] = [];
  for (const [donorId, list] of byDonor) {
    for (const bundle of partitionIntoBundles(list)) {
      plan.push({ donorId, bundle });
    }
  }
  return plan;
}
