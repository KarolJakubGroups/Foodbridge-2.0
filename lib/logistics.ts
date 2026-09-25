/**
 * Galliker consolidation (interval scheduling / point stabbing).
 *
 * Reservations at one pickup location are sorted by the end of their pickup
 * window. The first opens a bundle whose reference end is its own window end.
 * Every following one that starts at or before that reference end shares a
 * common point in time with everything already in the bundle and joins it; the
 * first one that starts later opens a new bundle. Yields the minimum number of
 * pickups in O(n log n).
 */
export interface Window {
  overlapStart: Date | string;
  overlapEnd: Date | string;
}

export interface Bundle<T extends Window> {
  items: T[];
  /** The span every item of the bundle can be collected in. */
  window: PickupWindow;
}

export interface PickupWindow {
  start: Date;
  end: Date;
  /** False when a (manually assembled) bundle has no common window; it then collapses to the earliest end. */
  overlaps: boolean;
}

const ms = (t: Date | string) => new Date(t).getTime();

/** Latest start to earliest end of all items. */
export function bundleWindow(items: readonly Window[]): PickupWindow {
  if (items.length === 0) throw new Error('bundleWindow needs at least one item');
  const start = Math.max(...items.map((i) => ms(i.overlapStart)));
  const end = Math.min(...items.map((i) => ms(i.overlapEnd)));
  return { start: new Date(Math.min(start, end)), end: new Date(end), overlaps: start <= end };
}

export function partitionIntoBundles<T extends Window>(input: readonly T[]): Bundle<T>[] {
  if (input.length === 0) return [];

  const sorted = [...input].sort((a, b) => ms(a.overlapEnd) - ms(b.overlapEnd));
  const groups: T[][] = [];
  let current: T[] = [];
  let bundleCurrentEnd = 0;

  for (const item of sorted) {
    if (current.length === 0) {
      current.push(item);
      bundleCurrentEnd = ms(item.overlapEnd);
    } else if (ms(item.overlapStart) <= bundleCurrentEnd) {
      // starts at or before the reference end -> overlaps with the whole bundle
      current.push(item);
    } else {
      groups.push(current);
      current = [item];
      bundleCurrentEnd = ms(item.overlapEnd);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups.map((items) => ({ items, window: bundleWindow(items) }));
}

/**
 * Groups by pickup location (default: donor) and bundles each group independently.
 * One transport order is one truck stop, so different addresses never share an order.
 */
export function planTransportOrders<T extends Window & { donorId: string }>(
  items: readonly T[],
  locationKey: (item: T) => string = (item) => item.donorId,
): { key: string; bundle: Bundle<T> }[] {
  const byLocation = new Map<string, T[]>();
  for (const item of items) {
    const key = locationKey(item);
    byLocation.set(key, [...(byLocation.get(key) ?? []), item]);
  }
  const plan: { key: string; bundle: Bundle<T> }[] = [];
  for (const [key, list] of byLocation) {
    for (const bundle of partitionIntoBundles(list)) plan.push({ key, bundle });
  }
  return plan;
}
