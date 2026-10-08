import 'server-only';
import { prisma } from '@/lib/db';
import { computeImpact, type ImpactReport } from '@/lib/impact';
import { freshnessCutoff, type Role } from '@/lib/domain';
import type { AvailableDonation, ClaimWithDonation, DonorDonation, TransportOrderWithDetails } from '@/lib/types';

const userSummary = { select: { id: true, username: true, organizationName: true, address: true } } as const;
const orderWindow = { select: { id: true, pickupStart: true, pickupEnd: true, status: true } } as const;

/** Own donations with their reservations, pickups and receiving institutions. */
export function fetchMyDonations(donorId: string): Promise<DonorDonation[]> {
  return prisma.donation.findMany({
    where: { donorId },
    include: {
      donor: userSummary,
      claims: {
        select: { id: true, pallets: true, palletNumbers: true, weightKg: true, status: true, claimedAt: true, foodbank: { select: { organizationName: true, description: true, contactName: true, phone: true } }, transportOrder: orderWindow },
        orderBy: { claimedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Offers an institution can still reserve from: pallets left, registered within
 * the last 4 days, and a pickup window that has not closed yet.
 */
export function fetchAvailableDonations(now = new Date()): Promise<AvailableDonation[]> {
  return prisma.donation.findMany({
    where: { status: 'AVAILABLE', createdAt: { gt: freshnessCutoff(now) }, overlapEnd: { gt: now } },
    include: { donor: userSummary, claims: { select: { palletNumbers: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export function fetchMyClaims(foodbankId: string): Promise<ClaimWithDonation[]> {
  return prisma.claim.findMany({
    where: { foodbankId },
    include: {
      donation: { include: { donor: { select: { ...userSummary.select, contactName: true, phone: true } } } },
      transportOrder: orderWindow,
    },
    orderBy: { claimedAt: 'desc' },
  });
}

/** Which transport orders a viewer may see: dispatcher all, donor their own pickups, foodbank orders carrying their reservations. */
export type OrderScope = { all: true } | { donorId: string } | { foodbankId: string };

export function fetchTransportOrders(scope: OrderScope = { all: true }): Promise<TransportOrderWithDetails[]> {
  const foodbankId = 'foodbankId' in scope ? scope.foodbankId : undefined;
  const where = 'donorId' in scope
    ? { donorId: scope.donorId }
    : foodbankId ? { claims: { some: { foodbankId } } } : {};
  return prisma.transportOrder.findMany({
    where,
    include: {
      donor: { select: { id: true, username: true, organizationName: true, address: true, contactName: true, phone: true } },
      // An institution sees only its own goods on a shared truck.
      claims: {
        where: foodbankId ? { foodbankId } : undefined,
        include: { donation: true, foodbank: userSummary },
        orderBy: { id: 'asc' },
      },
      transmissions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { pickupStart: 'asc' },
  });
}

export function orderScopeFor(profile: { id: string; role: Role }): OrderScope {
  if (profile.role === 'DONOR') return { donorId: profile.id };
  if (profile.role === 'FOODBANK') return { foodbankId: profile.id };
  return { all: true };
}

export function countPendingApplications(): Promise<number> {
  return prisma.user.count({ where: { role: 'DONOR', status: 'PENDING' } });
}

/** Reservations waiting for a transport order. */
export function countUnbundledClaims(): Promise<number> {
  return prisma.claim.count({ where: { status: 'RESERVED', transportOrderId: null } });
}

/** Impact counts reserved pallets only: an offer nobody takes rescues nothing. */
const claimWeights = { select: { weightKg: true } } as const;

export async function fetchGlobalImpact(): Promise<ImpactReport> {
  return computeImpact(await prisma.claim.findMany(claimWeights));
}

export async function fetchImpactFor(profileId: string, role: Role): Promise<ImpactReport> {
  if (role === 'DONOR') {
    return computeImpact(await prisma.claim.findMany({ where: { donation: { donorId: profileId } }, ...claimWeights }));
  }
  if (role === 'FOODBANK') {
    return computeImpact(await prisma.claim.findMany({ where: { foodbankId: profileId }, ...claimWeights }));
  }
  return fetchGlobalImpact();
}
