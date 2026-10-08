/** Domain constants and rules shared by services, actions and UI. */
export const ROLES = ['DONOR', 'FOODBANK', 'DISPATCHER'] as const;
/** Verification state of an account. Self-registered donors start PENDING. */
export const USER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
/** Preset storage temperatures. Donors may also describe their own, which is stored as entered. */
export const TEMPERATURE_RANGES = ['AMBIENT', 'COOL', 'CHILLED', 'SUPERCHILLED', 'FROZEN'] as const;
export const MAX_TEMPERATURE_LENGTH = 60;
export const MAX_PACKAGING_UNIT_LENGTH = 80;
/** Product categories (Warengruppen) a donation is classified into. */
export const CATEGORIES = ['MEAT_FISH', 'DAIRY_EGGS', 'FRUIT_VEG', 'BAKERY', 'DRY_GOODS', 'BEVERAGES', 'READY_MEALS', 'OTHER'] as const;
/** AVAILABLE: pallets left to reserve. CLAIMED: every pallet is reserved. WITHDRAWN: pulled back by the donor. */
export const DONATION_STATUSES = ['AVAILABLE', 'CLAIMED', 'WITHDRAWN'] as const;
/** Logistics state of one reservation: waiting for a truck, in a transport order, delivered. */
export const CLAIM_STATUSES = ['RESERVED', 'BUNDLED', 'COMPLETED'] as const;
/** What a donor is shown. Derived from the stored status, the reservations and the claim deadline. */
export const DONATION_STATES = ['OPEN', 'PARTIAL', 'EXPIRED', 'RESERVED', 'SCHEDULED', 'COLLECTED', 'WITHDRAWN'] as const;
export const TRANSPORT_STATUSES = ['PENDING', 'DISPATCHED', 'COMPLETED'] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type TemperatureRange = (typeof TEMPERATURE_RANGES)[number];
export type Category = (typeof CATEGORIES)[number];
export type DonationStatus = (typeof DONATION_STATUSES)[number];
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export type DonationState = (typeof DONATION_STATES)[number];
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

/** Schweizer Tafel freshness rule: donations older than this are neither shown nor claimable. */
export const FRESHNESS_DAYS = 4;

export function freshnessCutoff(now = new Date()): Date {
  return new Date(now.getTime() - FRESHNESS_DAYS * 86_400_000);
}

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PALLETS = 66;
export const MAX_WEIGHT_PER_PALLET = 1500;

/** Business-rule violation surfaced to the user as a message, never as a stack trace. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** When an offer stops being visible to institutions under the 4-day rule. */
export function visibleUntil(createdAt: Date): Date {
  return new Date(new Date(createdAt).getTime() + FRESHNESS_DAYS * 86_400_000);
}

/**
 * Last moment an institution can reserve pallets of an offer: the 4-day
 * freshness limit or the end of the pickup window, whichever comes first.
 * Nobody can collect goods after their pickup window has closed.
 */
export function claimDeadline(d: { createdAt: Date; overlapEnd: Date }): Date {
  const visible = visibleUntil(d.createdAt);
  const windowEnd = new Date(d.overlapEnd);
  return windowEnd < visible ? windowEnd : visible;
}

/** Why the deadline is what it is, for the countdown hint. */
export function claimDeadlineReason(d: { createdAt: Date; overlapEnd: Date }): 'WINDOW' | 'FRESHNESS' {
  return new Date(d.overlapEnd) < visibleUntil(d.createdAt) ? 'WINDOW' : 'FRESHNESS';
}

export function remainingPallets(d: { numberOfPallets: number; claimedPallets: number }): number {
  return Math.max(0, d.numberOfPallets - d.claimedPallets);
}

/** Pallets can still be reserved right now. */
export function isClaimable(d: { status: string; numberOfPallets: number; claimedPallets: number; createdAt: Date; overlapEnd: Date }, now = new Date()): boolean {
  return d.status === 'AVAILABLE' && remainingPallets(d) > 0 && claimDeadline(d) > now;
}

interface StateInput {
  status: string;
  createdAt: Date;
  overlapEnd: Date;
  numberOfPallets: number;
  claimedPallets: number;
  claims: { status: string }[];
}

/**
 * Business state of an offer for the donor.
 *   OPEN       nothing reserved yet, still on offer
 *   PARTIAL    some pallets reserved, the rest still on offer
 *   RESERVED   every pallet reserved, waiting for a transport
 *   SCHEDULED  every reservation is in a transport order
 *   COLLECTED  every reservation delivered
 *   EXPIRED    pallets left over after the claim deadline; the donor should withdraw them
 *   WITHDRAWN  pulled back by the donor
 */
export function donationState(d: StateInput, now = new Date()): DonationState {
  if (d.status === 'WITHDRAWN') return 'WITHDRAWN';
  const claimable = isClaimable(d, now);
  if (d.claimedPallets === 0) return claimable ? 'OPEN' : 'EXPIRED';
  const allDelivered = d.claims.length > 0 && d.claims.every((c) => c.status === 'COMPLETED');
  if (allDelivered && !claimable) return 'COLLECTED';
  if (claimable) return 'PARTIAL';
  if (remainingPallets(d) > 0) return 'EXPIRED';
  if (d.claims.every((c) => c.status !== 'RESERVED')) return 'SCHEDULED';
  return 'RESERVED';
}

/** A preset code or the donor's own temperature description, trimmed; null when empty or too long. */
export function normalizeTemperature(value: string | null | undefined): string | null {
  const t = (value ?? '').trim().replace(/\s+/g, ' ');
  return t && t.length <= MAX_TEMPERATURE_LENGTH ? t : null;
}

/** Key for grouping pickups at the same place and for the geocoding cache. */
export function normalizeAddress(address: string): string {
  return (address ?? '').trim().toLowerCase().replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ');
}

/** Key used to recognise that a donor is registering the same product twice. */
export function normalizeProductName(name: string): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Total weight of an offer: the sum of its pallets. */
export function totalWeightKg(d: { palletWeights: readonly number[] }): number {
  return d.palletWeights.reduce((sum, w) => sum + w, 0);
}

/** Weight of some pallets of an offer, by their 1-based numbers. */
export function weightOfPallets(palletWeights: readonly number[], numbers: readonly number[]): number {
  return numbers.reduce((sum, n) => sum + (palletWeights[n - 1] ?? 0), 0);
}

/** Pallet numbers (1-based) nobody has reserved yet, in order. */
export function freePalletNumbers(d: { palletWeights: readonly number[]; claims: readonly { palletNumbers: readonly number[] }[] }): number[] {
  const taken = new Set(d.claims.flatMap((c) => c.palletNumbers));
  return d.palletWeights.map((_, i) => i + 1).filter((n) => !taken.has(n));
}

/** The weight every pallet shares, or null when they differ. */
export function uniformWeight(weights: readonly number[]): number | null {
  return weights.length > 0 && weights.every((w) => w === weights[0]) ? weights[0] : null;
}

/** Problem with a list of pallet weights as entered, or null when valid. */
export function palletWeightsProblem(weights: readonly number[]): string | null {
  if (weights.length < 1 || weights.length > MAX_PALLETS) return `Ein Angebot umfasst 1 bis ${MAX_PALLETS} Paletten.`;
  const bad = weights.findIndex((w) => !(typeof w === 'number' && w > 0 && w <= MAX_WEIGHT_PER_PALLET));
  if (bad >= 0) return `Gewicht von Palette ${bad + 1} fehlt oder ist ungültig (höchstens ${MAX_WEIGHT_PER_PALLET} kg).`;
  return null;
}
