import type { Claim, Donation, TransportOrder, User, Wishlist } from '@/lib/generated/prisma/client';
import type { Role, TemperatureRange } from '@/lib/domain';

export type { Role, TemperatureRange, DonationStatus, TransportStatus } from '@/lib/domain';
export type { Claim, Donation, TransportOrder, Wishlist };

export type UserSummary = Pick<User, 'id' | 'username' | 'organizationName' | 'address'>;
export type Profile = UserSummary & { email: string; role: Role };

export type DonationWithDonor = Donation & { donor: UserSummary };
export type ClaimWithDonation = Claim & { donation: DonationWithDonor };
export type TransportOrderWithDetails = TransportOrder & { donor: UserSummary; donations: Donation[] };
export type WishlistWithFoodbank = Wishlist & { foodbank: UserSummary };

/** Payload of the donor form: the 7 mandatory fields. */
export interface DonationInput {
  productName: string;
  temperatureRange: TemperatureRange;
  bestBeforeDate: string; // YYYY-MM-DD
  pickupAddress: string;
  numberOfPallets: number;
  weightPerPallet: number;
  overlapStart: string; // ISO instant
  overlapEnd: string; // ISO instant
}

export interface WishlistInput {
  productName: string;
  quantityKg: number;
  note: string;
}

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/** Demo accounts created by `npm run seed`. */
export const DEMO_ACCOUNTS: { username: string; email: string; role: Role; organizationName: string; address: string }[] = [
  { username: 'migros', email: 'migros@demo.foodbridge.ch', role: 'DONOR', organizationName: 'Migros Genossenschaft Zürich', address: 'Limmatstrasse 152, 8005 Zürich' },
  { username: 'coop', email: 'coop@demo.foodbridge.ch', role: 'DONOR', organizationName: 'Coop Verteilzentrale Dietikon', address: 'Riedstrasse 10, 8953 Dietikon' },
  { username: 'foodbank_zrh', email: 'foodbank_zrh@demo.foodbridge.ch', role: 'FOODBANK', organizationName: 'Schweizer Tafel Abgabestelle Zürich', address: 'Hohlstrasse 400, 8048 Zürich' },
  { username: 'dispatcher_gt', email: 'dispatcher_gt@demo.foodbridge.ch', role: 'DISPATCHER', organizationName: 'Galliker Transport AG', address: 'Kantonsstrasse 2, 6246 Altishofen' },
];
export const DEMO_PASSWORD = 'password';
