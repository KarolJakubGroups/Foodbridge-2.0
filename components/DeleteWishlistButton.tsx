'use client';

import { useTransition } from 'react';
import { deleteWishlist } from '@/lib/actions';
import { btn } from '@/components/ui';
import { CheckIcon } from '@/components/icons';

/** Removes an own entry once the need is covered. */
export function DeleteWishlistButton({ id, productName }: { id: number; productName: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className={btn('ghost', 'sm')} disabled={pending} aria-label={`«${productName}» als erledigt entfernen`}
      onClick={() => startTransition(() => deleteWishlist(id).then(() => undefined))}>
      <CheckIcon className="size-4" />{pending ? 'Wird entfernt…' : 'Erledigt'}
    </button>
  );
}
