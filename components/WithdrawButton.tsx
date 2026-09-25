'use client';

import { useState, useTransition } from 'react';
import { withdrawDonation } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import { fmtPallets } from '@/lib/format';
import { Alert, btn } from '@/components/ui';

/**
 * Pulls back what nobody has reserved. Without reservations the whole offer is
 * withdrawn; with `remainder` only those pallets go, reserved ones stay promised.
 * Asks once before doing it.
 */
export function WithdrawButton({ donationId, productName, remainder }: { donationId: number; productName: string; remainder?: number }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = remainder ? `Rest zurückziehen (${fmtPallets(remainder)})` : 'Zurückziehen';

  const withdraw = () => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => withdrawDonation(donationId));
      if (!result.ok) setError(result.error);
      setConfirming(false);
    });
  };

  if (error) return <Alert onClose={() => setError(null)}>{error}</Alert>;
  if (!confirming) {
    return (
      <button type="button" className={btn('dangerGhost', 'sm')} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2" role="group"
      aria-label={remainder ? `${fmtPallets(remainder)} von «${productName}» zurückziehen?` : `«${productName}» zurückziehen?`}>
      <button type="button" disabled={pending} onClick={withdraw} className={btn('danger', 'sm')}>
        {pending ? 'Wird zurückgezogen…' : 'Ja, zurückziehen'}
      </button>
      <button type="button" disabled={pending} className={btn('ghost', 'sm')} onClick={() => setConfirming(false)}>
        Abbrechen
      </button>
    </span>
  );
}
