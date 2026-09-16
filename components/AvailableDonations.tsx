'use client';

import { useMemo, useState, useTransition } from 'react';
import { claimDonation } from '@/lib/actions';
import type { DonationWithDonor } from '@/lib/types';
import { categoryLabel, fmtDate, fmtDateTime, tempLabel } from '@/lib/format';
import { weightKg } from '@/lib/domain';
import { Alert, TableShell, btnDark, inputCls, tdCls, trCls } from '@/components/ui';

export function AvailableDonations({ donations }: { donations: DonationWithDonor[] }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return donations.filter((d) => !q || d.productName.toLowerCase().includes(q) || d.donor.username.toLowerCase().includes(q)
      || categoryLabel(d.category).toLowerCase().includes(q));
  }, [donations, query]);

  const claim = (id: number) => {
    setError(null); setBusyId(id);
    startTransition(async () => {
      const result = await claimDonation(id);
      if (!result.ok) setError(result.error);
      setBusyId(null);
    });
  };

  return (
    <>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className="flex justify-end mb-3">
        <input className={`${inputCls} w-48`} placeholder="Filter Partner/Artikel/Warengruppe…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <TableShell
        isEmpty={rows.length === 0}
        empty="Aktuell keine frischen Angebote verfügbar."
        headers={[{ label: 'Spender' }, { label: 'Artikel' }, { label: 'Warengruppe' }, { label: 'Temp.' }, { label: 'Menge' }, { label: 'MHD' }, { label: 'Abholfenster Ende' }, { label: 'Aktion' }]}
      >
        {rows.map((d) => (
          <tr key={d.id} className={trCls}>
            <td className={tdCls}><b>{d.donor.username}</b></td>
            <td className={tdCls}>{d.productName}</td>
            <td className={tdCls}>{categoryLabel(d.category)}</td>
            <td className={`${tdCls} text-slate-600`}>{tempLabel(d.temperatureRange)}</td>
            <td className={`${tdCls} font-mono`}>{weightKg(d)} kg ({d.numberOfPallets} Pal)</td>
            <td className={`${tdCls} font-mono`}>{fmtDate(d.bestBeforeDate)}</td>
            <td className={`${tdCls} font-mono`}>{fmtDateTime(d.overlapEnd)}</td>
            <td className={tdCls}>
              <button type="button" className={btnDark} disabled={busyId === d.id} onClick={() => claim(d.id)}>Reservieren</button>
            </td>
          </tr>
        ))}
      </TableShell>
    </>
  );
}
