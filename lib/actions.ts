'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { after } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';
import { requireProfile } from '@/lib/auth';
import * as services from '@/lib/services';
import { DomainError, type Role, type TransportStatus } from '@/lib/domain';
import { MESSAGES, isDatabaseUnavailable } from '@/lib/errors';
import { coordinatesFor } from '@/lib/geo';
import { ROLE_HOME } from '@/lib/format';
import type { Profile } from '@/lib/types';
import type {
  ActionResult, BundleRequest, BundlingResult, DonationInput, PlannedGroup, RegistrationInput,
} from '@/lib/types';

const APP_PATHS = ['/donor', '/foodbank', '/dispatcher', '/dispatcher/map', '/network'];

/** Looks up an address for the dispatcher map after the response is sent; failures only mean a later lookup. */
function prepareMapLocation(address: string) {
  after(() => coordinatesFor([address], { maxLookups: 1 }).then(() => undefined, () => undefined));
}

/** Turns any failure into a message the user can act on. Next.js redirects pass through. */
function toFailure(error: unknown): { ok: false; error: string } {
  unstable_rethrow(error);
  if (error instanceof DomainError) return { ok: false, error: error.message };
  if (isDatabaseUnavailable(error)) {
    console.error('[db unavailable]', error);
    return { ok: false, error: MESSAGES.database };
  }
  console.error(error);
  return { ok: false, error: MESSAGES.unexpected };
}

/**
 * Signs the user in (an expired session redirects to /login), runs the service call
 * and converts business, database and unexpected errors into a result.
 */
async function run<T>(fn: (profile: Profile) => Promise<T>, paths: string[] = APP_PATHS): Promise<ActionResult<T>> {
  try {
    const profile = await requireProfile();
    const data = await fn(profile);
    for (const p of paths) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    return toFailure(e);
  }
}

// ------------------------------------------------------------------ auth
export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { ok: false, error: 'Bitte E-Mail-Adresse und Passwort eingeben.' };

  let role: Role;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    // Same message for an unknown address and a wrong password: do not reveal which accounts exist.
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) return { ok: false, error: MESSAGES.login };
    await createSession(user.id);
    role = user.role as Role;
  } catch (e) {
    return toFailure(e);
  }
  redirect(ROLE_HOME[role]);
}

/** Public self-registration for businesses; logs the new (pending) donor in. */
export async function register(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input: RegistrationInput = {
    organizationName: String(formData.get('organizationName') ?? ''),
    address: String(formData.get('address') ?? ''),
    contactName: String(formData.get('contactName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
  };
  try {
    const user = await services.registerDonor(input);
    await createSession(user.id);
    prepareMapLocation(user.address);
  } catch (e) {
    return toFailure(e);
  }
  redirect('/donor');
}

export async function reviewDonor(donorId: string, decision: 'APPROVED' | 'REJECTED'): Promise<ActionResult> {
  return run(async (p) => { await services.reviewDonor(p, donorId, decision); }, ['/applications']);
}

export async function logout(): Promise<void> {
  try {
    await destroySession();
  } catch (e) {
    unstable_rethrow(e);
    // Even if the database is down, the cookie is gone after destroySession's delete; go to login regardless.
    console.error(e);
  }
  redirect('/login');
}

// ------------------------------------------------------------- donations
export async function createDonation(input: DonationInput): Promise<ActionResult> {
  return run(async (p) => {
    const d = await services.createDonation(p, input);
    prepareMapLocation(d.pickupAddress);
  });
}

/** Adds pallets (one weight each) to an existing open offer of the same donor. */
export async function addPallets(donationId: number, palletWeights: number[]):
  Promise<ActionResult<{ productName: string; numberOfPallets: number; totalWeightKg: number }>> {
  return run((p) => services.addPalletsToDonation(p, donationId, palletWeights));
}

/** Pulls back the unreserved pallets of an own offer. */
export async function withdrawDonation(donationId: number):
  Promise<ActionResult<{ productName: string; withdrawnPallets: number; keptPallets: number }>> {
  return run((p) => services.withdrawDonation(p, donationId));
}

// ---------------------------------------------------------------- claims
/** Reserves a number of pallets (the next free ones) or specific pallets by number. */
export async function claimDonation(donationId: number, selection: number | number[]):
  Promise<ActionResult<{ productName: string; remainingPallets: number; weightKg: number }>> {
  return run(async (p) => {
    const r = await services.claimDonation(p, donationId, selection);
    return { productName: r.productName, remainingPallets: r.remainingPallets, weightKg: r.weightKg };
  });
}

// ------------------------------------------------------------- logistics
/** Computes the bundling proposal for the preview dialog. Writes nothing. */
export async function previewBundling(): Promise<ActionResult<PlannedGroup[]>> {
  return run((p) => services.planBundling(p), []);
}

/** Persists the bundles the dispatcher confirmed (possibly edited) and hands them to Galliker. */
export async function applyBundling(bundles: BundleRequest[]): Promise<ActionResult<BundlingResult>> {
  return run((p) => services.createTransportOrders(p, bundles));
}

export async function resendToGalliker(orderId: number): Promise<ActionResult<{ reference: string }>> {
  return run((p) => services.resendToGalliker(p, orderId));
}

export async function setOrderStatus(orderId: number, status: TransportStatus): Promise<ActionResult> {
  return run(async (p) => { await services.setOrderStatus(p, orderId, status); });
}
