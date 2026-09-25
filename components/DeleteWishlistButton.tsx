'use client';

import { useState, useTransition } from 'react';
import { deleteWishlist } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import { Alert, btn } from '@/components/ui';
import { CheckIcon } from '@/components/icons';

/** Removes an own entry once the need is covered. */
export function DeleteWishlistButton({ id, productName }: { id: number; productName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => deleteWishlist(id));
      if (!result.ok) setError(result.error);
    });
  };
  if (error) return <Alert onClose={() => setError(null)}>{error}</Alert>;
  return (
    <button type="button" className={btn('ghost', 'sm')} disabled={pending} aria-label={`«${productName}» als erledigt entfernen`} onClick={remove}>
      <CheckIcon className="size-4" />{pending ? 'Wird entfernt…' : 'Erledigt'}
    </button>
  );
}
