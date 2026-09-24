'use client';

import dynamic from 'next/dynamic';
import type { OpenDonation } from '@/lib/types';

// The form prefills dates in the browser's time zone, so it renders client-side only.
const DonationForm = dynamic(() => import('./DonationForm').then((m) => m.DonationForm), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-md bg-slate-100" aria-busy="true" />,
});

export function DonationFormLoader({ defaultAddress, openDonations }: { defaultAddress: string; openDonations: OpenDonation[] }) {
  return <DonationForm defaultAddress={defaultAddress} openDonations={openDonations} />;
}
