/** Domain constants and rules shared by services, actions and UI. */
export const ROLES = ['DONOR', 'FOODBANK', 'DISPATCHER'] as const;
/** Verification state of an account. Self-registered donors start PENDING. */
export const USER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
/** Preset storage temperatures. Donors may also describe their own, which is stored as entered. */
export const TEMPERATURE_RANGES = ['AMBIENT', 'COOL', 'CHILLED', 'SUPERCHILLED', 'FROZEN'] as const;
export const MAX_TEMPERATURE_LENGTH = 60;
/** Product categories (Warengruppen) a donation is classified into. */
export const CATEGORIES = ['MEAT_FISH', 'DAIRY_EGGS', 'FRUIT_VEG', 'BAKERY', 'DRY_GOODS', 'BEVERAGES', 'READY_MEALS', 'OTHER'] as const;
export const DONATION_STATUSES = ['AVAILABLE', 'CLAIMED', 'BUNDLED', 'COMPLETED', 'WITHDRAWN'] as const;
/** What a donor is shown. Derived from the stored status plus the freshness window. */
export const DONATION_STATES = ['OPEN', 'EXPIRED', 'RESERVED', 'SCHEDULED', 'COLLECTED', 'WITHDRAWN'] as const;
export const TRANSPORT_STATUSES = ['PENDING', 'DISPATCHED', 'COMPLETED'] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type TemperatureRange = (typeof TEMPERATURE_RANGES)[number];
export type Category = (typeof CATEGORIES)[number];
export type DonationStatus = (typeof DONATION_STATUSES)[number];
export type DonationState = (typeof DONATION_STATES)[number];
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

/** Schweizer Tafel freshness rule: donations older than this are neither shown nor claimable. */
export const FRESHNESS_DAYS = 4;

export function freshnessCutoff(now = new Date()): Date {
  return new Date(now.getTime() - FRESHNESS_DAYS * 86_400_000);
}

/** Statuses in which a donation counts as rescued for the impact report. */
export const RESCUED_STATUSES: DonationStatus[] = ['CLAIMED', 'BUNDLED', 'COMPLETED'];

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

/** When an offer stops being visible to institutions. */
export function visibleUntil(createdAt: Date): Date {
  return new Date(createdAt.getTime() + FRESHNESS_DAYS * 86_400_000);
}

/** Business state of a donation: an unreserved offer past the 4-day window counts as expired. */
export function donationState(d: { status: string; createdAt: Date }, now = new Date()): DonationState {
  switch (d.status) {
    case 'AVAILABLE': return d.createdAt > freshnessCutoff(now) ? 'OPEN' : 'EXPIRED';
    case 'CLAIMED': return 'RESERVED';
    case 'BUNDLED': return 'SCHEDULED';
    case 'COMPLETED': return 'COLLECTED';
    case 'WITHDRAWN': return 'WITHDRAWN';
    default: return 'OPEN';
  }
}

/** A preset code or the donor's own temperature description, trimmed; null when empty or too long. */
export function normalizeTemperature(value: string | null | undefined): string | null {
  const t = (value ?? '').trim().replace(/\s+/g, ' ');
  return t && t.length <= MAX_TEMPERATURE_LENGTH ? t : null;
}

/** Key used to recognise that a donor is registering the same product twice. */
export function normalizeProductName(name: string): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function weightKg(d: { numberOfPallets: number; weightPerPallet: number }): number {
  return d.numberOfPallets * d.weightPerPallet;
}

const ZURICH = 'Europe/Zurich';
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: ZURICH, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

function zurichParts(instant: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(instant).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, min: Number(p.minute) };
}

/** The instant of 12:00 Europe/Zurich on the calendar day (in Zurich) of the given instant. */
export function zurichNoonOf(instant: Date): Date {
  const { y, m, d } = zurichParts(instant);
  // Start from 12:00 UTC of that day and correct by the Zurich offset (+1 or +2 hours).
  const guess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const g = zurichParts(guess);
  const localMinutes = (g.d - d) * 24 * 60 + g.h * 60 + g.min;
  return new Date(guess.getTime() - (localMinutes - 12 * 60) * 60_000);
}
