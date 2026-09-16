'use client';

import { useMemo, useState } from 'react';
import type { DonationWithDonor } from '@/lib/types';
import { categoryLabel, fmtDate, fmtDateTime, tempLabel } from '@/lib/format';
import { weightKg } from '@/lib/domain';
import { Badge, TableShell, inputCls, tdCls, trCls } from '@/components/ui';

export function DonationTable({ donations }: { donations: DonationWithDonor[] }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return donations.filter((d) => !q || d.productName.toLowerCase().includes(q) || d.status.toLowerCase().includes(q)
      || categoryLabel(d.category).toLowerCase().includes(q));
  }, [donations, query]);

  return (
    <>
      <div className="flex justify-end mb-3 no-print">
        <input className={`${inputCls} w-56`} placeholder="Suchen nach Artikel/Status…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <TableShell
        isEmpty={rows.length === 0}
        empty="Noch keine Angebote erfasst."
        headers={[
          { label: 'Artikel' }, { label: 'Warengruppe' }, { label: 'Temp.' }, { label: 'Menge' }, { label: 'Verfügbares Abholfenster' },
          { label: 'MHD' }, { label: 'Status' }, { label: 'Erfasst am' },
        ]}
      >
        {rows.map((d) => (
          <tr key={d.id} className={trCls}>
            <td className={tdCls}><b>{d.productName}</b></td>
            <td className={tdCls}>{categoryLabel(d.category)}</td>
            <td className={`${tdCls} text-slate-600`}>{tempLabel(d.temperatureRange)}</td>
            <td className={`${tdCls} font-mono`}>{weightKg(d)} kg ({d.numberOfPallets} Pal)</td>
            <td className={`${tdCls} font-mono`}>{fmtDateTime(d.overlapStart)} – {fmtDateTime(d.overlapEnd)}</td>
            <td className={`${tdCls} font-mono`}>{fmtDate(d.bestBeforeDate)}</td>
            <td className={tdCls}><Badge status={d.status} /></td>
            <td className={`${tdCls} font-mono text-slate-500`}>{fmtDateTime(d.createdAt)}</td>
          </tr>
        ))}
      </TableShell>
    </>
  );
}
