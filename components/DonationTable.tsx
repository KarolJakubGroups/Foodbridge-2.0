'use client';

import { useMemo, useState } from 'react';
import type { DonorDonation } from '@/lib/types';
import { STATE_LABEL, categoryLabel, fmtDate, fmtDateTime, tempLabel } from '@/lib/format';
import { donationState, weightKg } from '@/lib/domain';
import { StateBadge, TableShell, inputCls, tdCls, trCls } from '@/components/ui';
import { WithdrawButton } from '@/components/WithdrawButton';

export function DonationTable({ donations }: { donations: DonorDonation[] }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return donations
      .map((d) => ({ d, state: donationState(d) }))
      .filter(({ d, state }) => !q || d.productName.toLowerCase().includes(q)
        || STATE_LABEL[state].toLowerCase().includes(q) || categoryLabel(d.category).toLowerCase().includes(q));
  }, [donations, query]);

  /** What a donor most wants to know per row: when is it picked up, or who took it. */
  const pickupNote = (d: DonorDonation) =>
    d.transportOrder ? `Abholung ${fmtDateTime(d.transportOrder.pickupTime)}`
      : d.claim ? `Reserviert von ${d.claim.foodbank.organizationName}` : null;

  return (
    <>
      <div className="flex justify-end mb-3 no-print">
        <input type="search" className={`${inputCls} md:w-56`} placeholder="Suchen nach Artikel/Status…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* Phone: one card per donation */}
      <ul className="md:hidden space-y-2">
        {rows.length === 0 && <li className="py-6 text-center text-sm text-slate-400">Noch keine Angebote erfasst.</li>}
        {rows.map(({ d, state }) => (
          <li key={d.id} className="border border-slate-200 rounded-md p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-sm">{d.productName}</span>
              <StateBadge state={state} />
            </div>
            <div className="text-xs text-slate-600">{categoryLabel(d.category)} · {tempLabel(d.temperatureRange)}</div>
            <div className="font-mono text-xs">{weightKg(d)} kg · {d.numberOfPallets} Pal · MHD {fmtDate(d.bestBeforeDate)}</div>
            {pickupNote(d) && <div className="text-xs font-bold text-slate-700">{pickupNote(d)}</div>}
            <div className="font-mono text-[11px] text-slate-500">Fenster {fmtDateTime(d.overlapStart)} – {fmtDateTime(d.overlapEnd)}</div>
            {d.status === 'AVAILABLE' && <WithdrawButton donationId={d.id} productName={d.productName} />}
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <TableShell
          isEmpty={rows.length === 0}
          empty="Noch keine Angebote erfasst."
          headers={[
            { label: 'Artikel' }, { label: 'Warengruppe' }, { label: 'Menge' }, { label: 'MHD' },
            { label: 'Status' }, { label: 'Abholung / Empfänger' }, { label: '' },
          ]}
        >
          {rows.map(({ d, state }) => (
            <tr key={d.id} className={trCls}>
              <td className={tdCls}><b>{d.productName}</b><div className="text-slate-500">{tempLabel(d.temperatureRange)}</div></td>
              <td className={tdCls}>{categoryLabel(d.category)}</td>
              <td className={`${tdCls} font-mono`}>{weightKg(d)} kg ({d.numberOfPallets} Pal)</td>
              <td className={`${tdCls} font-mono`}>{fmtDate(d.bestBeforeDate)}</td>
              <td className={tdCls}><StateBadge state={state} /></td>
              <td className={tdCls}>{pickupNote(d) ?? <span className="text-slate-400">–</span>}</td>
              <td className={tdCls}>{d.status === 'AVAILABLE' && <WithdrawButton donationId={d.id} productName={d.productName} />}</td>
            </tr>
          ))}
        </TableShell>
      </div>
    </>
  );
}
