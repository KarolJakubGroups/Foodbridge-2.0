'use client';

import { useTransition } from 'react';
import { deleteWishlist } from '@/lib/actions';
import { btnGhost } from '@/components/ui';

export function DeleteWishlistButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className={btnGhost} disabled={pending} onClick={() => startTransition(() => deleteWishlist(id).then(() => undefined))}>
      Erledigt
    </button>
  );
}
