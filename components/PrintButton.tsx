'use client';

import { btnDark } from '@/components/ui';

export function PrintButton({ label }: { label: string }) {
  return <button type="button" className={`${btnDark} no-print`} onClick={() => window.print()}>{label}</button>;
}
