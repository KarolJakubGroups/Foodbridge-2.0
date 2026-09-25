'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { DonationForm as DonationFormType } from './DonationForm';

// The form prefills dates in the browser's time zone, so it renders client-side only.
const DonationForm = dynamic(() => import('./DonationForm').then((m) => m.DonationForm), {
  ssr: false,
  loading: () => <div className="h-[640px] animate-pulse rounded-2xl bg-white border border-line" aria-busy="true" />,
});

export function DonationFormLoader(props: ComponentProps<typeof DonationFormType>) {
  return <DonationForm {...props} />;
}
