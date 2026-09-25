'use client';

import { useState, useTransition } from 'react';
import { reviewDonor } from '@/lib/actions';
import { Alert, btn } from '@/components/ui';
import { CheckIcon } from '@/components/icons';

/** Approve or reject a donor. On decided rows (compact) only the opposite decision is offered, behind a confirmation. */
export function ApplicationActions({ donorId, status, organizationName, compact = false }: {
  donorId: string; status: string; organizationName: string; compact?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const decide = (decision: 'APPROVED' | 'REJECTED') => {
    setError(null);
    startTransition(async () => {
      const result = await reviewDonor(donorId, decision);
      if (!result.ok) setError(result.error);
      setConfirm(false);
    });
  };

  if (compact) {
    const next = status === 'APPROVED' ? 'REJECTED' : 'APPROVED';
    const label = next === 'APPROVED' ? 'Doch freigeben' : 'Freigabe entziehen';
    return (
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {confirm ? (
          <>
            <span className="text-[15px] text-ink-2">{label}?</span>
            <button type="button" disabled={pending} className={btn(next === 'APPROVED' ? 'primary' : 'danger', 'sm')} onClick={() => decide(next)}>Ja</button>
            <button type="button" disabled={pending} className={btn('ghost', 'sm')} onClick={() => setConfirm(false)}>Abbrechen</button>
          </>
        ) : (
          <button type="button" className={btn(next === 'APPROVED' ? 'quiet' : 'dangerGhost', 'sm')} onClick={() => setConfirm(true)}
            aria-label={`${label}: ${organizationName}`}>{label}</button>
        )}
        {error && <div className="w-full"><Alert onClose={() => setError(null)}>{error}</Alert></div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        <button type="button" disabled={pending} className={btn('primary')} onClick={() => decide('APPROVED')}>
          <CheckIcon className="size-5" />Freigeben
        </button>
        {confirm ? (
          <>
            <button type="button" disabled={pending} className={btn('danger')} onClick={() => decide('REJECTED')}>Ja, ablehnen</button>
            <button type="button" disabled={pending} className={btn('ghost')} onClick={() => setConfirm(false)}>Abbrechen</button>
          </>
        ) : (
          <button type="button" disabled={pending} className={btn('dangerGhost')} onClick={() => setConfirm(true)}>Ablehnen</button>
        )}
      </div>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
    </div>
  );
}
