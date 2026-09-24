'use client';

import { useState, useTransition } from 'react';
import { withdrawDonation } from '@/lib/actions';
import { Alert, btnGhost } from '@/components/ui';

/** Pulls back an own offer that no institution has reserved. */
export function WithdrawButton({ donationId, productName }: { donationId: number; productName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const withdraw = () => {
    setError(null);
    startTransition(async () => {
      const result = await withdrawDonation(donationId);
      if (!result.ok) setError(result.error);
      setConfirming(false);
    });
  };

  if (error) return <Alert onClose={() => setError(null)}>{error}</Alert>;
  if (!confirming) {
    return (
      <button type="button" className={`${btnGhost} text-[11px] px-3 py-1.5 min-h-0`} onClick={() => setConfirming(true)}>
        Zurückziehen
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-slate-600">„{productName}“ zurückziehen?</span>
      <button type="button" disabled={pending} onClick={withdraw}
        className="bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold px-3 py-1.5 rounded disabled:opacity-50">
        {pending ? '…' : 'Ja, zurückziehen'}
      </button>
      <button type="button" disabled={pending} className={`${btnGhost} text-[11px] px-3 py-1.5 min-h-0`} onClick={() => setConfirming(false)}>
        Abbrechen
      </button>
    </span>
  );
}
