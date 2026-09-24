import type { Claim, Donation, TransportOrder, User, Wishlist } from '@/lib/generated/prisma/client';
import type { Category, Role, TemperatureRange, UserStatus } from '@/lib/domain';

export type { Category, Role, TemperatureRange, DonationStatus, TransportStatus, UserStatus } from '@/lib/domain';
export type { Claim, Donation, TransportOrder, Wishlist };

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
/** Own donation plus the facts a donor needs: planned pickup and receiving institution. */
export type DonorDonation = DonationWithDonor & {
  transportOrder: { id: number; pickupTime: Date; status: string } | null;
  claim: { foodbank: { organizationName: string } } | null;
};
export type ClaimWithDonation = Claim & { donation: DonationWithDonor };
export type TransportOrderWithDetails = TransportOrder & { donor: UserSummary; donations: Donation[] };
export type WishlistWithFoodbank = Wishlist & { foodbank: UserSummary };

/** Payload of the donor form: the 7 mandatory fields of the spec plus the product category. */
export interface DonationInput {
  productName: string;
  category: Category;
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

/** An own, still-open offer a donor could add pallets to instead of registering a duplicate. */
export type OpenDonation = Pick<Donation, 'id' | 'productName' | 'category' | 'temperatureRange'
  | 'numberOfPallets' | 'weightPerPallet' | 'bestBeforeDate' | 'overlapStart' | 'overlapEnd' | 'createdAt'>;

/** One donation as shown in the bundling preview. */
export type PlannedDonation = Pick<Donation, 'id' | 'productName' | 'category' | 'temperatureRange' | 'numberOfPallets' | 'weightPerPallet' | 'overlapStart' | 'overlapEnd'>;
export interface PlannedOrder {
  key: string;
  pickupTime: Date;
  donations: PlannedDonation[];
}
export interface PlannedGroup {
  donor: UserSummary;
  orders: PlannedOrder[];
}
/** A bundle the dispatcher confirms: donations of one donor that share a pickup. */
export interface BundleRequest {
  donorId: string;
  donationIds: number[];
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
