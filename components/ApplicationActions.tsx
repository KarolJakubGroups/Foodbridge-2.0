'use client';

import { useState, useTransition } from 'react';
import { reviewDonor } from '@/lib/actions';
import { Alert, btnGhost, btnPrimary } from '@/components/ui';

export function ApplicationActions({ donorId, status }: { donorId: string; status: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decide = (decision: 'APPROVED' | 'REJECTED') => {
    setError(null);
    startTransition(async () => {
      const result = await reviewDonor(donorId, decision);
      if (!result.ok) setError(result.error);
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'APPROVED' && (
        <button type="button" disabled={pending} className={btnPrimary.replace('px-4 py-3 md:py-2', 'px-3 py-2 md:py-1.5')} onClick={() => decide('APPROVED')}>
          Freigeben
        </button>
      )}
      {status !== 'REJECTED' && (
        <button type="button" disabled={pending} className={btnGhost} onClick={() => decide('REJECTED')}>Ablehnen</button>
      )}
      {error && <div className="w-full"><Alert onClose={() => setError(null)}>{error}</Alert></div>}
    </div>
  );
}
