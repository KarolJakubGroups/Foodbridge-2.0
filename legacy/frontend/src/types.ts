export type Role = 'DONOR' | 'FOODBANK' | 'DISPATCHER';
export type TemperatureRange = 'FROZEN' | 'CHILLED' | 'AMBIENT';
export type DonationStatus = 'AVAILABLE' | 'CLAIMED' | 'BUNDLED' | 'COMPLETED';
export type TransportStatus = 'PENDING' | 'DISPATCHED' | 'COMPLETED';

export interface UserView {
  id: number;
  username: string;
  role: Role;
  organizationName: string;
  address: string;
}

export interface Donation {
  id: number;
  donor: UserView;
  productName: string;
  temperatureRange: TemperatureRange;
  bestBeforeDate: string;
  pickupAddress: string;
  numberOfPallets: number;
  weightPerPallet: number;
  overlapStart: string;
  overlapEnd: string;
  createdAt: string;
  status: DonationStatus;
  transportOrderId: number | null;
  totalWeightKg: number;
}

export interface DonationRequest {
  productName: string;
  temperatureRange: TemperatureRange;
  bestBeforeDate: string;
  pickupAddress: string;
  numberOfPallets: number;
  weightPerPallet: number;
  overlapStart: string;
  overlapEnd: string;
}

export interface Claim {
  id: number;
  donation: Donation;
  foodbank: UserView;
  claimedAt: string;
}

export interface TransportOrder {
  id: number;
  donor: UserView;
  pickupTime: string;
  status: TransportStatus;
  driverName: string | null;
  createdAt: string;
  donations: Donation[];
  totalWeightKg: number;
  totalPallets: number;
}

export interface Wishlist {
  id: number;
  foodbank: UserView;
  productName: string;
  quantityKg: number;
  note: string | null;
  createdAt: string;
}

export interface ImpactReport {
  totalWeightKg: number;
  meals: number;
  co2SavedKg: number;
  donationCount: number;
}
