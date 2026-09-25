'use client';

import { btn } from '@/components/ui';
import { PrinterIcon } from '@/components/icons';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className={`${btn('ghost')} w-full no-print`} onClick={() => window.print()}>
      <PrinterIcon className="size-5" />{label}
    </button>
  );
}
