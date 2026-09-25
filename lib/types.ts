import type { Claim, Donation, GallikerTransmission, TransportOrder, User, Wishlist } from '@/lib/generated/prisma/client';
import type { Category, Role, TemperatureRange, UserStatus } from '@/lib/domain';

export type { Category, ClaimStatus, Role, TemperatureRange, DonationStatus, TransportStatus, UserStatus } from '@/lib/domain';
export type { Claim, Donation, GallikerTransmission, TransportOrder, Wishlist };

export type UserSummary = Pick<User, 'id' | 'username' | 'organizationName' | 'address'>;
export type Profile = UserSummary & { email: string; role: Role; status: UserStatus };

/** A donor account as shown in the foodbank's applications tab. */
export type Application = Pick<User, 'id' | 'username' | 'email' | 'organizationName' | 'address' | 'contactName' | 'phone' | 'createdAt' | 'reviewedAt'> & { status: UserStatus };

export interface RegistrationInput {
  organizationName: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export type DonationWithDonor = Donation & { donor: UserSummary };

/** Pickup window of a transport order as the other roles see it. */
export type OrderWindow = { id: number; pickupStart: Date; pickupEnd: Date; status: string };

/** One reservation on an own donation: who took how many pallets, and where the transport stands. */
export type DonorClaim = Pick<Claim, 'id' | 'pallets' | 'status' | 'claimedAt'> & {
  foodbank: { organizationName: string };
  transportOrder: OrderWindow | null;
};
/** Own donation plus its reservations, pickups and receiving institutions. */
export type DonorDonation = DonationWithDonor & { claims: DonorClaim[] };

export type ClaimWithDonation = Claim & { donation: DonationWithDonor; transportOrder: OrderWindow | null };

/** A reservation inside a transport order: the goods and where they go. */
export type OrderLine = Claim & {
  donation: Donation;
  foodbank: UserSummary;
};
export type TransportOrderWithDetails = TransportOrder & {
  donor: UserSummary & { contactName: string | null; phone: string | null };
  claims: OrderLine[];
  /** Latest message sent to Galliker, if any. */
  transmissions: GallikerTransmission[];
};
export type WishlistWithFoodbank = Wishlist & { foodbank: UserSummary };

/** Payload of the donor form: the 7 mandatory fields of the spec plus the product category. */
export interface DonationInput {
  productName: string;
  category: Category;
  /** A TemperatureRange preset or the donor's own description. */
  temperatureRange: TemperatureRange | (string & {});
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

/** Values copied into the donor form when an old offer is registered again. */
export type DonationPrefill = Pick<Donation, 'productName' | 'category' | 'temperatureRange' | 'numberOfPallets' | 'weightPerPallet'>;

/** An own, still-open offer a donor could add pallets to instead of registering a duplicate. */
export type OpenDonation = Pick<Donation, 'id' | 'productName' | 'category' | 'temperatureRange'
  | 'numberOfPallets' | 'weightPerPallet' | 'bestBeforeDate' | 'overlapStart' | 'overlapEnd' | 'createdAt'>;

/** One reservation as shown in the bundling preview. `id` is the claim id. */
export interface PlannedClaim {
  id: number;
  productName: string;
  category: string;
  temperatureRange: string;
  pallets: number;
  weightPerPallet: number;
  overlapStart: Date;
  overlapEnd: Date;
  foodbankName: string;
}
export interface PlannedOrder {
  key: string;
  pickupStart: Date;
  pickupEnd: Date;
  claims: PlannedClaim[];
}
/** All waiting reservations at one pickup location. */
export interface PlannedGroup {
  key: string;
  donor: UserSummary;
  pickupAddress: string;
  orders: PlannedOrder[];
}
/** A bundle the dispatcher confirms: reservations at one pickup location that share a trip. */
export interface BundleRequest {
  donorId: string;
  claimIds: number[];
}
export interface BundlingResult {
  orders: number;
  positions: number;
  /** Orders handed over to Galliker / orders whose hand-over failed (can be resent). */
  sent: number;
  failed: number;
}

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/** Demo accounts created by `npm run seed`. */
export const DEMO_ACCOUNTS: { username: string; email: string; role: Role; organizationName: string; address: string }[] = [
  { username: 'migros', email: 'migros@demo.foodbridge.ch', role: 'DONOR', organizationName: 'Migros Genossenschaft Zürich', address: 'Limmatstrasse 152, 8005 Zürich' },
  { username: 'coop', email: 'coop@demo.foodbridge.ch', role: 'DONOR', organizationName: 'Coop Verteilzentrale Dietikon', address: 'Riedstrasse 10, 8953 Dietikon' },
  { username: 'foodbank_zrh', email: 'foodbank_zrh@demo.foodbridge.ch', role: 'FOODBANK', organizationName: 'Schweizer Tafel Abgabestelle Zürich', address: 'Hohlstrasse 400, 8048 Zürich' },
  { username: 'foodbank_win', email: 'foodbank_win@demo.foodbridge.ch', role: 'FOODBANK', organizationName: 'Schweizer Tafel Abgabestelle Winterthur', address: 'Zürcherstrasse 45, 8400 Winterthur' },
  { username: 'dispatcher_gt', email: 'dispatcher_gt@demo.foodbridge.ch', role: 'DISPATCHER', organizationName: 'Galliker Transport AG', address: 'Kantonsstrasse 2, 6246 Altishofen' },
];
export const DEMO_PASSWORD = 'password';
