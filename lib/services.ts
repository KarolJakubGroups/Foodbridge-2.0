import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { planTransportOrders } from '@/lib/logistics';
import {
  CATEGORIES, DomainError, MAX_PALLETS, MAX_WEIGHT_PER_PALLET, MIN_PASSWORD_LENGTH, TEMPERATURE_RANGES,
  freshnessCutoff, zurichNoonOf, type TransportStatus,
} from '@/lib/domain';
import type { Application, DonationInput, Profile, RegistrationInput, WishlistInput } from '@/lib/types';

// ---------------------------------------------------------- registration
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(name: string): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return base.length >= 3 ? base : `spender_${base}`.slice(0, 24);
}

/** A business applies for a donor account. The account exists immediately but stays PENDING until a foodbank approves it. */
export async function registerDonor(input: RegistrationInput) {
  const organizationName = input.organizationName?.trim() ?? '';
  const address = input.address?.trim() ?? '';
  const contactName = input.contactName?.trim() ?? '';
  const phone = input.phone?.trim() ?? '';
  const email = input.email?.trim().toLowerCase() ?? '';

  if (organizationName.length < 2) throw new DomainError('Bitte den Namen des Unternehmens angeben.');
  if (address.length < 5) throw new DomainError('Bitte die vollständige Abholadresse angeben.');
  if (contactName.length < 2) throw new DomainError('Bitte eine Kontaktperson angeben.');
  if (!EMAIL_RE.test(email)) throw new DomainError('Bitte eine gültige E-Mail-Adresse angeben.');
  if ((input.password ?? '').length < MIN_PASSWORD_LENGTH) throw new DomainError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
  if (input.password !== input.passwordConfirm) throw new DomainError('Die Passwörter stimmen nicht überein.');

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new DomainError('Für diese E-Mail-Adresse existiert bereits ein Konto.');
  }
  const base = slugify(organizationName);
  let username = base;
  for (let i = 2; await prisma.user.findUnique({ where: { username }, select: { id: true } }); i++) {
    username = `${base}_${i}`;
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      username, email, passwordHash, role: 'DONOR', status: 'PENDING',
      organizationName: organizationName.slice(0, 120), address: address.slice(0, 200),
      contactName: contactName.slice(0, 80), phone: phone.slice(0, 40) || null,
    },
  });
}

/** Foodbank decides on a donor application. */
export async function reviewDonor(reviewer: Profile, donorId: string, decision: 'APPROVED' | 'REJECTED') {
  if (reviewer.role !== 'FOODBANK') throw new DomainError('Nur Abgabestellen können Anträge prüfen.');
  const { count } = await prisma.user.updateMany({
    where: { id: donorId, role: 'DONOR', status: { not: decision } },
    data: { status: decision, reviewedAt: new Date() },
  });
  if (count === 0) throw new DomainError('Antrag nicht gefunden oder bereits so entschieden.');
}

export function listApplications(): Promise<Application[]> {
  return prisma.user.findMany({
    where: { role: 'DONOR' },
    select: { id: true, username: true, email: true, organizationName: true, address: true, contactName: true, phone: true, status: true, createdAt: true, reviewedAt: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  }) as Promise<Application[]>;
}

// ------------------------------------------------------------- donations
export async function createDonation(donor: Profile, input: DonationInput) {
  if (donor.role !== 'DONOR') throw new DomainError('Nur Spender können Angebote erfassen.');
  if (donor.status !== 'APPROVED') throw new DomainError('Ihr Spenderkonto ist noch nicht freigegeben.');

  const missing: string[] = [];
  if (!input.productName?.trim()) missing.push('Produkt');
  if (!CATEGORIES.includes(input.category)) missing.push('Warengruppe');
  if (!TEMPERATURE_RANGES.includes(input.temperatureRange)) missing.push('Temperatur');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.bestBeforeDate ?? '')) missing.push('MHD');
  if (!input.pickupAddress?.trim()) missing.push('Abholadresse');
  if (!Number.isInteger(input.numberOfPallets) || input.numberOfPallets < 1 || input.numberOfPallets > MAX_PALLETS) missing.push('Anzahl Paletten');
  if (!(input.weightPerPallet > 0) || input.weightPerPallet > MAX_WEIGHT_PER_PALLET) missing.push('Gewicht pro Palette');
  const start = new Date(input.overlapStart ?? '');
  const end = new Date(input.overlapEnd ?? '');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) missing.push('Abholzeitfenster');
  if (missing.length) throw new DomainError(`Pflichtfelder fehlen oder sind ungültig: ${missing.join(', ')}.`);
  if (end <= start) throw new DomainError('Das Abholzeitfenster-Ende muss nach dem Beginn liegen.');
  if (input.bestBeforeDate < new Date().toISOString().slice(0, 10)) {
    throw new DomainError('Das Mindesthaltbarkeitsdatum darf nicht in der Vergangenheit liegen.');
  }

  return prisma.donation.create({
    data: {
      donorId: donor.id,
      productName: input.productName.trim().slice(0, 120),
      category: input.category,
      temperatureRange: input.temperatureRange,
      bestBeforeDate: input.bestBeforeDate,
      pickupAddress: input.pickupAddress.trim().slice(0, 200),
      numberOfPallets: input.numberOfPallets,
      weightPerPallet: input.weightPerPallet,
      overlapStart: start,
      overlapEnd: end,
    },
  });
}

// ---------------------------------------------------------------- claims
/**
 * Atomic claim: the conditional updateMany guarantees a single winner and
 * enforces the 4-day freshness rule on the write path.
 */
export async function claimDonation(foodbank: Profile, donationId: number) {
  if (foodbank.role !== 'FOODBANK') throw new DomainError('Nur Abgabestellen können Spenden reservieren.');
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.donation.updateMany({
      where: { id: donationId, status: 'AVAILABLE', createdAt: { gt: freshnessCutoff() } },
      data: { status: 'CLAIMED' },
    });
    if (count === 0) {
      const d = await tx.donation.findUnique({ where: { id: donationId }, select: { status: true } });
      if (!d) throw new DomainError('Spende nicht gefunden.');
      if (d.status === 'AVAILABLE') throw new DomainError('Die Spende ist älter als 4 Tage und kann nicht mehr reserviert werden.');
      throw new DomainError('Die Spende ist nicht mehr verfügbar.');
    }
    return tx.claim.create({ data: { donationId, foodbankId: foodbank.id } });
  });
}

// ------------------------------------------------------------- logistics
/** Runs the Galliker consolidation over all CLAIMED donations not yet in an order. */
export async function runBundling(dispatcher: Profile): Promise<{ orders: number; positions: number }> {
  if (dispatcher.role !== 'DISPATCHER') throw new DomainError('Nur Disponenten können bündeln.');

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.donation.findMany({
      where: { status: 'CLAIMED', transportOrderId: null },
      select: { id: true, donorId: true, overlapStart: true, overlapEnd: true },
    });
    const plan = planTransportOrders(claimed);
    let positions = 0;
    for (const { donorId, bundle } of plan) {
      const ids = bundle.donations.map((d) => d.id);
      const order = await tx.transportOrder.create({
        data: { donorId, pickupTime: zurichNoonOf(new Date(bundle.bundleEnd)) },
      });
      const { count } = await tx.donation.updateMany({
        where: { id: { in: ids }, donorId, status: 'CLAIMED', transportOrderId: null },
        data: { status: 'BUNDLED', transportOrderId: order.id },
      });
      if (count !== ids.length) throw new DomainError('Bündelung abgebrochen: Spenden wurden zwischenzeitlich verändert.');
      positions += count;
    }
    return { orders: plan.length, positions };
  });
}

const TRANSITIONS: Record<string, TransportStatus> = { PENDING: 'DISPATCHED', DISPATCHED: 'COMPLETED' };

export async function setOrderStatus(dispatcher: Profile, orderId: number, status: TransportStatus) {
  if (dispatcher.role !== 'DISPATCHER') throw new DomainError('Nur Disponenten können Aufträge ändern.');
  return prisma.$transaction(async (tx) => {
    const order = await tx.transportOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new DomainError('Transportauftrag nicht gefunden.');
    if (TRANSITIONS[order.status] !== status) {
      throw new DomainError(`Ungültiger Statuswechsel ${order.status} → ${status}.`);
    }
    const updated = await tx.transportOrder.update({ where: { id: orderId }, data: { status } });
    if (status === 'COMPLETED') {
      await tx.donation.updateMany({ where: { transportOrderId: orderId }, data: { status: 'COMPLETED' } });
    }
    return updated;
  });
}


// ------------------------------------------------------------- wishlists
export async function createWishlist(foodbank: Profile, input: WishlistInput) {
  if (foodbank.role !== 'FOODBANK') throw new DomainError('Nur Abgabestellen können Bedarf melden.');
  if (!input.productName?.trim()) throw new DomainError('Produkt ist erforderlich.');
  if (!(input.quantityKg > 0)) throw new DomainError('Menge muss grösser als 0 sein.');
  return prisma.wishlist.create({
    data: {
      foodbankId: foodbank.id,
      productName: input.productName.trim().slice(0, 120),
      quantityKg: input.quantityKg,
      note: input.note?.trim().slice(0, 300) || null,
    },
  });
}

export async function deleteWishlist(foodbank: Profile, id: number) {
  const { count } = await prisma.wishlist.deleteMany({ where: { id, foodbankId: foodbank.id } });
  if (count === 0) throw new DomainError('Eintrag nicht gefunden oder gehört einer anderen Institution.');
}
