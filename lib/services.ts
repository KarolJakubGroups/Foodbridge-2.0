import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { bundleWindow, planTransportOrders } from '@/lib/logistics';
import { buildGallikerPayload, gallikerConfig, transmitToGalliker, type GallikerConfig, type GallikerResult } from '@/lib/galliker';
import {
  CATEGORIES, DomainError, MAX_DESCRIPTION_LENGTH, PALLET_MATERIALS, MAX_PACKAGING_UNIT_LENGTH, MAX_PALLETS, MIN_PASSWORD_LENGTH, freePalletNumbers, freshnessCutoff, isClaimable,
  normalizeAddress, normalizeTemperature, palletWeightsProblem, remainingPallets, totalWeightKg, weightOfPallets, type TransportStatus,
} from '@/lib/domain';
import type {
  Application, BundleRequest, BundlingResult, DonationInput, PlannedGroup, Profile, ProfileDetailsInput, RegistrationInput,
} from '@/lib/types';

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

// --------------------------------------------------------------- profile
export function getProfileDetails(profile: Profile) {
  return prisma.user.findUniqueOrThrow({ where: { id: profile.id }, select: { contactName: true, phone: true, description: true } });
}

/** An organization updates its contact person and, for institutions, the "Wer wir sind" text donors see. */
export async function updateProfileDetails(profile: Profile, input: ProfileDetailsInput) {
  const contactName = input.contactName?.trim() ?? '';
  const phone = input.phone?.trim() ?? '';
  const description = input.description?.trim() ?? '';
  if (contactName.length < 2) throw new DomainError('Bitte eine Kontaktperson angeben.');
  if (contactName.length > 80 || phone.length > 40) throw new DomainError('Kontaktperson oder Telefonnummer ist zu lang.');
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new DomainError(`Die Beschreibung darf höchstens ${MAX_DESCRIPTION_LENGTH} Zeichen haben.`);
  return prisma.user.update({
    where: { id: profile.id },
    data: { contactName, phone: phone || null, ...(profile.role === 'FOODBANK' ? { description: description || null } : {}) },
    select: { contactName: true, phone: true, description: true },
  });
}

// ------------------------------------------------------------- donations
export async function createDonation(donor: Profile, input: DonationInput) {
  if (donor.role !== 'DONOR') throw new DomainError('Nur Spender können Angebote erfassen.');
  if (donor.status !== 'APPROVED') throw new DomainError('Ihr Spenderkonto ist noch nicht freigegeben.');

  const temperatureRange = normalizeTemperature(input.temperatureRange);
  const missing: string[] = [];
  if (!input.productName?.trim()) missing.push('Produkt');
  if (!CATEGORIES.includes(input.category)) missing.push('Warengruppe');
  if (!PALLET_MATERIALS.includes(input.palletMaterial)) missing.push('Palettenart');
  if (!temperatureRange) missing.push('Temperatur');
  const bestBeforeDate = input.bestBeforeDate?.trim() || null;
  if (bestBeforeDate && !/^\d{4}-\d{2}-\d{2}$/.test(bestBeforeDate)) missing.push('MHD');
  if (!input.pickupAddress?.trim()) missing.push('Abholadresse');
  const weights = Array.isArray(input.palletWeights) ? input.palletWeights : [];
  const weightProblem = palletWeightsProblem(weights);
  if (weightProblem) missing.push('Gewicht der Paletten');
  const start = new Date(input.overlapStart ?? '');
  const end = new Date(input.overlapEnd ?? '');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) missing.push('Abholzeitfenster');
  if (missing.length === 1 && weightProblem) throw new DomainError(weightProblem);
  if (missing.length) throw new DomainError(`Pflichtfelder fehlen oder sind ungültig: ${missing.join(', ')}.`);
  if (end <= start) throw new DomainError('Das Abholzeitfenster-Ende muss nach dem Beginn liegen.');
  if (end <= new Date()) throw new DomainError('Das Abholzeitfenster liegt in der Vergangenheit. Bitte ein kommendes Zeitfenster wählen.');
  if (bestBeforeDate && bestBeforeDate < new Date().toISOString().slice(0, 10)) {
    throw new DomainError('Das Mindesthaltbarkeitsdatum darf nicht in der Vergangenheit liegen.');
  }

  return prisma.donation.create({
    data: {
      donorId: donor.id,
      productName: input.productName.trim().slice(0, 120),
      category: input.category,
      temperatureRange: temperatureRange!,
      packagingUnit: input.packagingUnit?.trim().slice(0, MAX_PACKAGING_UNIT_LENGTH) || null,
      palletMaterial: input.palletMaterial,
      bestBeforeDate,
      pickupAddress: input.pickupAddress.trim().slice(0, 200),
      numberOfPallets: weights.length,
      palletWeights: weights,
      overlapStart: start,
      overlapEnd: end,
    },
  });
}

/**
 * Adds pallets to an own offer that is still open, instead of creating a duplicate.
 * Each added pallet brings its own weight; they take the existing pickup window, and the
 * registration date stays unchanged, so the 4-day freshness window is never extended.
 */
export async function addPalletsToDonation(donor: Profile, donationId: number, addedWeights: number[]) {
  if (donor.role !== 'DONOR') throw new DomainError('Nur Spender können Angebote ergänzen.');
  if (donor.status !== 'APPROVED') throw new DomainError('Ihr Spenderkonto ist noch nicht freigegeben.');
  if (!Array.isArray(addedWeights) || addedWeights.length < 1) {
    throw new DomainError('Bitte die Anzahl zusätzlicher Paletten angeben.');
  }
  const weightProblem = palletWeightsProblem(addedWeights);
  if (weightProblem) throw new DomainError(weightProblem);

  const existing = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!existing || existing.donorId !== donor.id) throw new DomainError('Angebot nicht gefunden.');
  if (existing.status !== 'AVAILABLE' || !isClaimable(existing)) {
    throw new DomainError('Das Angebot ist nicht mehr offen und kann nicht ergänzt werden.');
  }
  const palletWeights = [...existing.palletWeights, ...addedWeights];
  if (palletWeights.length > MAX_PALLETS) throw new DomainError(`Ein Angebot umfasst höchstens ${MAX_PALLETS} Paletten.`);

  // Optimistic lock: only update if the pallet count is still the one we read.
  const { count } = await prisma.donation.updateMany({
    where: { id: donationId, donorId: donor.id, status: 'AVAILABLE', numberOfPallets: existing.numberOfPallets },
    data: { numberOfPallets: palletWeights.length, palletWeights },
  });
  if (count === 0) throw new DomainError('Das Angebot wurde zwischenzeitlich verändert. Bitte erneut versuchen.');
  return { productName: existing.productName, numberOfPallets: palletWeights.length, totalWeightKg: totalWeightKg({ palletWeights }) };
}

/**
 * A donor pulls back the pallets nobody has reserved (goods sold, spoiled or not
 * picked up in time). Reserved pallets stay promised to their institutions:
 * without reservations the offer is withdrawn, otherwise it shrinks to what is reserved.
 */
export async function withdrawDonation(donor: Profile, donationId: number) {
  if (donor.role !== 'DONOR') throw new DomainError('Nur Spender können Angebote zurückziehen.');
  const existing = await prisma.donation.findUnique({
    where: { id: donationId }, include: { claims: { select: { id: true, palletNumbers: true } } },
  });
  if (!existing || existing.donorId !== donor.id) throw new DomainError('Angebot nicht gefunden.');
  const unreserved = remainingPallets(existing);
  if (existing.status !== 'AVAILABLE' || unreserved === 0) {
    throw new DomainError('Alle Paletten sind bereits reserviert. Das Angebot kann nicht mehr zurückgezogen werden.');
  }
  const lock = { id: donationId, donorId: donor.id, status: 'AVAILABLE', claimedPallets: existing.claimedPallets, numberOfPallets: existing.numberOfPallets };
  if (existing.claimedPallets === 0) {
    const { count } = await prisma.donation.updateMany({ where: lock, data: { status: 'WITHDRAWN' } });
    if (count === 0) throw new DomainError('Gerade wurde etwas reserviert. Bitte die Seite neu laden und erneut versuchen.');
  } else {
    // The offer shrinks to its reserved pallets, numbered 1..n again; each claim follows its pallets.
    const kept = existing.claims.flatMap((c) => c.palletNumbers).sort((a, b) => a - b);
    const renumber = new Map(kept.map((n, i) => [n, i + 1]));
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.donation.updateMany({
        where: lock,
        data: { numberOfPallets: kept.length, palletWeights: kept.map((n) => existing.palletWeights[n - 1]), status: 'CLAIMED' },
      });
      if (count === 0) throw new DomainError('Gerade wurde etwas reserviert. Bitte die Seite neu laden und erneut versuchen.');
      for (const c of existing.claims) {
        await tx.claim.update({ where: { id: c.id }, data: { palletNumbers: c.palletNumbers.map((n) => renumber.get(n)!) } });
      }
    });
  }
  return { productName: existing.productName, withdrawnPallets: unreserved, keptPallets: existing.claimedPallets };
}

// ---------------------------------------------------------------- claims
const CLAIM_ATTEMPTS = 3;

/**
 * An institution reserves some or all remaining pallets of an offer: either a
 * count (the next free pallets are assigned when the reservation is written) or
 * specific pallets by number, for offers whose pallets weigh differently.
 *
 * Checked on the write path: the 4-day freshness rule, that the pickup window has
 * not closed, and that the chosen pallets are still free. The reservation is taken
 * with an optimistic lock (the update only applies if nobody reserved in between) and
 * the database refuses to ever reserve more than was offered. A lost race is retried.
 */
export async function claimDonation(foodbank: Profile, donationId: number, selection: number | number[]) {
  if (foodbank.role !== 'FOODBANK') throw new DomainError('Nur Abgabestellen können Spenden reservieren.');
  const requested = Array.isArray(selection) ? [...new Set(selection)].sort((a, b) => a - b) : null;
  const pallets = requested ? requested.length : selection as number;
  if (!Number.isInteger(pallets) || pallets < 1 || requested?.some((n) => !Number.isInteger(n))) {
    throw new DomainError('Bitte mindestens eine Palette wählen.');
  }

  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
    const d = await prisma.donation.findUnique({ where: { id: donationId }, include: { claims: { select: { palletNumbers: true } } } });
    if (!d) throw new DomainError('Spende nicht gefunden.');
    if (d.status === 'WITHDRAWN') throw new DomainError('Der Spender hat dieses Angebot zurückgezogen.');
    const now = new Date();
    if (d.createdAt <= freshnessCutoff(now)) throw new DomainError('Die Spende ist älter als 4 Tage und kann nicht mehr reserviert werden.');
    if (d.overlapEnd <= now) throw new DomainError('Das Abholfenster ist bereits vorbei. Die Spende kann nicht mehr abgeholt werden.');
    const left = remainingPallets(d);
    if (d.status !== 'AVAILABLE' || left === 0) throw new DomainError('Die Spende ist bereits vollständig reserviert.');
    if (pallets > left) {
      throw new DomainError(`Es ${left === 1 ? 'ist nur noch 1 Palette' : `sind nur noch ${left} Paletten`} verfügbar.`);
    }
    const free = freePalletNumbers(d);
    const taken = requested?.filter((n) => !free.includes(n)) ?? [];
    if (taken.length > 0) {
      throw new DomainError(`${taken.length === 1 ? `Palette ${taken[0]} ist` : `Paletten ${taken.join(', ')} sind`} nicht mehr frei. Bitte die Auswahl prüfen.`);
    }
    const numbers = requested ?? free.slice(0, pallets);
    const weightKg = weightOfPallets(d.palletWeights, numbers);

    const claimed = d.claimedPallets + pallets;
    const claim = await prisma.$transaction(async (tx) => {
      const { count } = await tx.donation.updateMany({
        where: { id: donationId, status: 'AVAILABLE', claimedPallets: d.claimedPallets, numberOfPallets: d.numberOfPallets },
        data: { claimedPallets: claimed, status: claimed === d.numberOfPallets ? 'CLAIMED' : 'AVAILABLE' },
      });
      if (count === 0) return null; // someone else reserved in between: read again
      return tx.claim.create({ data: { donationId, foodbankId: foodbank.id, pallets, palletNumbers: numbers, weightKg } });
    });
    if (claim) {
      return { claim, productName: d.productName, remainingPallets: d.numberOfPallets - claimed, weightKg };
    }
  }
  throw new DomainError('Das Angebot wurde gerade von einer anderen Stelle reserviert. Bitte erneut versuchen.');
}

// ------------------------------------------------------------- logistics
/** One truck stop: the same donor at the same address. */
const locationKey = (donorId: string, pickupAddress: string) => `${donorId}|${normalizeAddress(pickupAddress)}`;

/** Computes the Galliker consolidation proposal without writing anything. */
export async function planBundling(dispatcher: Profile): Promise<PlannedGroup[]> {
  if (dispatcher.role !== 'DISPATCHER') throw new DomainError('Nur Disponenten können bündeln.');
  const waiting = await prisma.claim.findMany({
    where: { status: 'RESERVED', transportOrderId: null },
    include: {
      donation: { include: { donor: { select: { id: true, username: true, organizationName: true, address: true } } } },
      foodbank: { select: { organizationName: true } },
    },
    orderBy: { claimedAt: 'asc' },
  });
  const items = waiting.map((c) => ({
    donorId: c.donation.donorId, pickupAddress: c.donation.pickupAddress, donor: c.donation.donor,
    overlapStart: c.donation.overlapStart, overlapEnd: c.donation.overlapEnd,
    planned: {
      id: c.id, productName: c.donation.productName, category: c.donation.category, temperatureRange: c.donation.temperatureRange,
      pallets: c.pallets, weightKg: c.weightKg, overlapStart: c.donation.overlapStart,
      overlapEnd: c.donation.overlapEnd, foodbankName: c.foodbank.organizationName,
    },
  }));

  const groups = new Map<string, PlannedGroup>();
  for (const { key, bundle } of planTransportOrders(items, (i) => locationKey(i.donorId, i.pickupAddress))) {
    const first = bundle.items[0];
    const group = groups.get(key) ?? { key, donor: first.donor, pickupAddress: first.pickupAddress, orders: [] };
    group.orders.push({
      key: `${key}#${group.orders.length + 1}`,
      pickupStart: bundle.window.start,
      pickupEnd: bundle.window.end,
      claims: bundle.items.map((i) => i.planned),
    });
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Persists confirmed bundles (from the preview dialog or the automatic plan) in one
 * transaction, then hands every new order to Galliker. A failed hand-over does not
 * undo the order; it is marked and the dispatcher can send it again.
 */
export async function createTransportOrders(dispatcher: Profile, bundles: BundleRequest[]): Promise<BundlingResult> {
  if (dispatcher.role !== 'DISPATCHER') throw new DomainError('Nur Disponenten können Aufträge erstellen.');
  const seen = new Set<number>();
  for (const b of bundles) {
    if (!b.donorId || !Array.isArray(b.claimIds) || b.claimIds.length === 0) {
      throw new DomainError('Jeder Auftrag braucht mindestens eine Reservierung.');
    }
    for (const id of b.claimIds) {
      if (!Number.isInteger(id) || seen.has(id)) throw new DomainError('Eine Reservierung kann nur in einem Auftrag liegen.');
      seen.add(id);
    }
  }
  if (bundles.length === 0) return { orders: 0, positions: 0, sent: 0, failed: 0 };

  const orderIds = await prisma.$transaction(async (tx) => {
    const ids: number[] = [];
    for (const { donorId, claimIds } of bundles) {
      const claims = await tx.claim.findMany({
        where: { id: { in: claimIds }, status: 'RESERVED', transportOrderId: null },
        select: { id: true, donation: { select: { donorId: true, pickupAddress: true, overlapStart: true, overlapEnd: true } } },
      });
      if (claims.length !== claimIds.length || claims.some((c) => c.donation.donorId !== donorId)) {
        throw new DomainError('Bündelung abgebrochen: mindestens eine Reservierung ist bereits in einem Auftrag oder gehört einem anderen Spender.');
      }
      if (new Set(claims.map((c) => normalizeAddress(c.donation.pickupAddress))).size > 1) {
        throw new DomainError('Ein Auftrag kann nur eine Abholadresse haben. Bitte die Reservierungen auf getrennte Fahrten verteilen.');
      }
      const window = bundleWindow(claims.map((c) => c.donation));
      const order = await tx.transportOrder.create({ data: { donorId, pickupStart: window.start, pickupEnd: window.end } });
      const { count } = await tx.claim.updateMany({
        where: { id: { in: claimIds }, status: 'RESERVED', transportOrderId: null },
        data: { status: 'BUNDLED', transportOrderId: order.id },
      });
      if (count !== claimIds.length) throw new DomainError('Bündelung abgebrochen: Reservierungen wurden zwischenzeitlich verändert.');
      ids.push(order.id);
    }
    return ids;
  });

  const handovers = await Promise.all(orderIds.map((id) => sendOrderToGalliker(id)));
  const sent = handovers.filter((h) => h.ok).length;
  return { orders: orderIds.length, positions: seen.size, sent, failed: orderIds.length - sent };
}

/** Runs the automatic consolidation end to end (plan + persist + hand-over). */
export async function runBundling(dispatcher: Profile): Promise<BundlingResult> {
  const groups = await planBundling(dispatcher);
  const bundles: BundleRequest[] = groups.flatMap((g) =>
    g.orders.map((o) => ({ donorId: g.donor.id, claimIds: o.claims.map((c) => c.id) })));
  return createTransportOrders(dispatcher, bundles);
}

/**
 * Sends one order to Galliker and records the attempt. Never throws for Galliker
 * problems; the result and the order's gallikerStatus say what happened.
 */
export async function sendOrderToGalliker(orderId: number, config: GallikerConfig = gallikerConfig()): Promise<GallikerResult> {
  const order = await prisma.transportOrder.findUnique({
    where: { id: orderId },
    include: {
      donor: { select: { organizationName: true, address: true, contactName: true, phone: true } },
      claims: {
        include: {
          donation: { select: { productName: true, category: true, temperatureRange: true, packagingUnit: true, palletMaterial: true, palletWeights: true, bestBeforeDate: true, pickupAddress: true } },
          foodbank: { select: { organizationName: true, address: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!order) throw new DomainError('Transportauftrag nicht gefunden.');

  const payload = buildGallikerPayload(order);
  const result = await transmitToGalliker(payload, config);
  const now = new Date();
  await prisma.$transaction([
    prisma.gallikerTransmission.create({
      data: {
        orderId, mode: config.mode, endpoint: result.endpoint ?? null, payload: payload as unknown as Prisma.InputJsonValue,
        status: result.ok ? 'SENT' : 'FAILED', httpStatus: result.httpStatus ?? null,
        response: result.response === undefined ? Prisma.JsonNull : (result.response as Prisma.InputJsonValue),
        error: result.ok ? null : result.error,
      },
    }),
    prisma.transportOrder.update({
      where: { id: orderId },
      data: result.ok
        ? { gallikerStatus: 'SENT', gallikerReference: result.reference, gallikerSentAt: now, gallikerError: null }
        : { gallikerStatus: 'FAILED', gallikerError: result.error },
    }),
  ]);
  return result;
}

/** The dispatcher retries a hand-over that failed. */
export async function resendToGalliker(dispatcher: Profile, orderId: number): Promise<{ reference: string }> {
  if (dispatcher.role !== 'DISPATCHER') throw new DomainError('Nur Disponenten können Aufträge an Galliker senden.');
  const order = await prisma.transportOrder.findUnique({ where: { id: orderId }, select: { gallikerStatus: true, status: true } });
  if (!order) throw new DomainError('Transportauftrag nicht gefunden.');
  if (order.gallikerStatus === 'SENT') throw new DomainError('Dieser Auftrag ist bereits bei Galliker.');
  if (order.status === 'COMPLETED') throw new DomainError('Dieser Auftrag ist bereits abgeschlossen.');
  const result = await sendOrderToGalliker(orderId);
  if (!result.ok) throw new DomainError(`Übermittlung fehlgeschlagen: ${result.error}`);
  return { reference: result.reference };
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
      await tx.claim.updateMany({ where: { transportOrderId: orderId }, data: { status: 'COMPLETED' } });
    }
    return updated;
  });
}
