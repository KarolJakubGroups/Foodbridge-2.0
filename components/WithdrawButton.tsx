'use client';

import { useState, useTransition } from 'react';
import { withdrawDonation } from '@/lib/actions';
import { Alert, btn } from '@/components/ui';

/** Pulls back an own offer that no institution has reserved. Asks once before doing it. */
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
      <button type="button" className={btn('dangerGhost', 'sm')} onClick={() => setConfirming(true)}>
        Zurückziehen
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`«${productName}» zurückziehen?`}>
      <button type="button" disabled={pending} onClick={withdraw} className={btn('danger', 'sm')}>
        {pending ? 'Wird zurückgezogen…' : 'Ja, zurückziehen'}
      </button>
      <button type="button" disabled={pending} className={btn('ghost', 'sm')} onClick={() => setConfirming(false)}>
        Abbrechen
      </button>
    </span>
  );
}
