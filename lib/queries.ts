import 'server-only';
import { prisma } from '@/lib/db';
import { computeImpact, type ImpactReport } from '@/lib/impact';
import { RESCUED_STATUSES, freshnessCutoff, type Role } from '@/lib/domain';
import type { ClaimWithDonation, DonationWithDonor, TransportOrderWithDetails, WishlistWithFoodbank } from '@/lib/types';

const userSummary = { select: { id: true, username: true, organizationName: true, address: true } } as const;

export function fetchMyDonations(donorId: string): Promise<DonationWithDonor[]> {
  return prisma.donation.findMany({ where: { donorId }, include: { donor: userSummary }, orderBy: { createdAt: 'desc' } });
}

/** AVAILABLE donations that still satisfy the 4-day freshness rule. */
export function fetchAvailableDonations(): Promise<DonationWithDonor[]> {
  return prisma.donation.findMany({
    where: { status: 'AVAILABLE', createdAt: { gt: freshnessCutoff() } },
    include: { donor: userSummary },
    orderBy: { createdAt: 'desc' },
  });
}

export function fetchMyClaims(foodbankId: string): Promise<ClaimWithDonation[]> {
  return prisma.claim.findMany({
    where: { foodbankId },
    include: { donation: { include: { donor: userSummary } } },
    orderBy: { claimedAt: 'desc' },
  });
}

/** Which transport orders a viewer may see: dispatcher all, donor their own pickups, foodbank orders carrying their reservations. */
export type OrderScope = { all: true } | { donorId: string } | { foodbankId: string };

export function fetchTransportOrders(scope: OrderScope = { all: true }): Promise<TransportOrderWithDetails[]> {
  const where = 'donorId' in scope
    ? { donorId: scope.donorId }
    : 'foodbankId' in scope
      ? { donations: { some: { claim: { foodbankId: scope.foodbankId } } } }
      : {};
  return prisma.transportOrder.findMany({
    where,
    include: { donor: userSummary, donations: { orderBy: { overlapEnd: 'asc' } } },
    orderBy: { pickupTime: 'asc' },
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

export function countUnbundledClaimed(): Promise<number> {
  return prisma.donation.count({ where: { status: 'CLAIMED', transportOrderId: null } });
}

export function fetchWishlists(): Promise<WishlistWithFoodbank[]> {
  return prisma.wishlist.findMany({ include: { foodbank: userSummary }, orderBy: { createdAt: 'desc' } });
}

const weightSelect = { select: { numberOfPallets: true, weightPerPallet: true } } as const;

export async function fetchGlobalImpact(): Promise<ImpactReport> {
  const rows = await prisma.donation.findMany({ where: { status: { in: RESCUED_STATUSES } }, ...weightSelect });
  return computeImpact(rows);
}

export async function fetchImpactFor(profileId: string, role: Role): Promise<ImpactReport> {
  if (role === 'DONOR') {
    const rows = await prisma.donation.findMany({ where: { donorId: profileId, status: { in: RESCUED_STATUSES } }, ...weightSelect });
    return computeImpact(rows);
  }
  if (role === 'FOODBANK') {
    const claims = await prisma.claim.findMany({ where: { foodbankId: profileId }, select: { donation: weightSelect } });
    return computeImpact(claims.map((c) => c.donation));
  }
  return fetchGlobalImpact();
}
