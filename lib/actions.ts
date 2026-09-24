'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';
import { requireProfile } from '@/lib/auth';
import * as services from '@/lib/services';
import { DomainError, type Role, type TransportStatus } from '@/lib/domain';
import { ROLE_HOME } from '@/lib/format';
import type { ActionResult, BundleRequest, DonationInput, PlannedGroup, RegistrationInput, WishlistInput } from '@/lib/types';

const APP_PATHS = ['/donor', '/foodbank', '/dispatcher', '/network', '/wishlist'];
function revalidateApp() {
  for (const p of APP_PATHS) revalidatePath(p);
}

/** Runs a service call and converts business errors into a user-facing result. */
async function run<T>(fn: () => Promise<T>, paths: string[] = APP_PATHS): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: 'Unerwarteter Fehler. Bitte erneut versuchen.' };
  }
}

// ------------------------------------------------------------------ auth
export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { ok: false, error: 'E-Mail und Passwort sind erforderlich.' };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) return { ok: false, error: 'Ungültige Anmeldedaten.' };

  await createSession(user.id);
  redirect(ROLE_HOME[user.role as Role]);
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
  let userId: string;
  try {
    userId = (await services.registerDonor(input)).id;
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: 'Registrierung fehlgeschlagen. Bitte erneut versuchen.' };
  }
  await createSession(userId);
  redirect('/donor');
}

export async function reviewDonor(donorId: string, decision: 'APPROVED' | 'REJECTED'): Promise<ActionResult> {
  const profile = await requireProfile();
  return run(async () => { await services.reviewDonor(profile, donorId, decision); }, ['/applications']);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}

// ------------------------------------------------------------- donations
export async function createDonation(input: DonationInput): Promise<ActionResult> {
  const profile = await requireProfile();
  return run(async () => { await services.createDonation(profile, input); });
}

/** Adds pallets to an existing open offer of the same donor. */
export async function addPallets(donationId: number, additionalPallets: number):
  Promise<ActionResult<{ productName: string; numberOfPallets: number; totalWeightKg: number }>> {
  const profile = await requireProfile();
  return run(() => services.addPalletsToDonation(profile, donationId, additionalPallets));
}

/** Pulls back an own, unreserved offer. */
export async function withdrawDonation(donationId: number): Promise<ActionResult<{ productName: string }>> {
  const profile = await requireProfile();
  return run(() => services.withdrawDonation(profile, donationId));
}

// ---------------------------------------------------------------- claims
export async function claimDonation(donationId: number): Promise<ActionResult> {
  const profile = await requireProfile();
  return run(async () => { await services.claimDonation(profile, donationId); });
}

// ------------------------------------------------------------- logistics
/** Computes the bundling proposal for the preview dialog. Writes nothing. */
export async function previewBundling(): Promise<ActionResult<PlannedGroup[]>> {
  const profile = await requireProfile();
  return run(() => services.planBundling(profile), []);
}

/** Persists the bundles the dispatcher confirmed (possibly edited) in the dialog. */
export async function applyBundling(bundles: BundleRequest[]): Promise<ActionResult<{ orders: number; positions: number }>> {
  const profile = await requireProfile();
  return run(() => services.createTransportOrders(profile, bundles));
}

export async function setOrderStatus(orderId: number, status: TransportStatus): Promise<ActionResult> {
  const profile = await requireProfile();
  return run(async () => { await services.setOrderStatus(profile, orderId, status); });
}


// ------------------------------------------------------------- wishlists
export async function createWishlist(input: WishlistInput): Promise<ActionResult> {
  const profile = await requireProfile();
  return run(async () => { await services.createWishlist(profile, input); }, ['/wishlist']);
}

export async function deleteWishlist(id: number): Promise<ActionResult> {
  const profile = await requireProfile();
  return run(async () => { await services.deleteWishlist(profile, id); }, ['/wishlist']);
}

// keep revalidateApp referenced for callers that need a full refresh
export async function refreshAll(): Promise<void> {
  revalidateApp();
}
