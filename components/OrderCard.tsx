'use client';

import { useState, useTransition } from 'react';
import { setOrderStatus } from '@/lib/actions';
import type { TransportOrderWithDetails } from '@/lib/types';
import { categoryLabel, fmtDateTime, fmtKg, tempLabel } from '@/lib/format';
import { weightKg } from '@/lib/domain';
import { Alert, Badge, TableShell, btnDark, btnPrimary, tdCls, trCls } from '@/components/ui';

export function OrderCard({ order, readOnly = false }: { order: TransportOrderWithDetails; readOnly?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const totalKg = order.donations.reduce((s, d) => s + weightKg(d), 0);
  const totalPallets = order.donations.reduce((s, d) => s + d.numberOfPallets, 0);

  const transition = (status: 'DISPATCHED' | 'COMPLETED') => {
    setError(null);
    startTransition(async () => {
      const result = await setOrderStatus(order.id, status);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="border border-slate-200 rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] text-slate-500">AUFTRAG #{order.id}</span>
          <Badge status={order.status} />
          <span className="text-xs font-bold">Abholstandort Spender: {order.donor.username}</span>
          <span className="text-[11px] text-slate-500 hidden md:inline">{order.donor.address}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px]">Termin: <b>{fmtDateTime(order.pickupTime)}</b></span>
          <span className="font-mono text-[11px] text-slate-600">{fmtKg(totalKg)} / {totalPallets} Pal</span>
          {!readOnly && order.status === 'PENDING' && (
            <button type="button" disabled={pending} className={btnDark} onClick={() => transition('DISPATCHED')}>
              Disponieren
            </button>
          )}
          {!readOnly && order.status === 'DISPATCHED' && (
            <button type="button" disabled={pending} className={btnPrimary.replace('px-4 py-2', 'px-3 py-1')} onClick={() => transition('COMPLETED')}>
              Abschliessen
            </button>
          )}
        </div>
      </div>
      {error && <div className="px-4 pt-3"><Alert onClose={() => setError(null)}>{error}</Alert></div>}
      <TableShell isEmpty={order.donations.length === 0}
        headers={[{ label: 'Artikel' }, { label: 'Warengruppe' }, { label: 'Temp.' }, { label: 'Menge' }, { label: 'Individuelles Zeitfenster (Start – Ende)' }, { label: 'Positionsstatus' }]}>
        {order.donations.map((d) => (
          <tr key={d.id} className={trCls}>
            <td className={tdCls}><b>{d.productName}</b></td>
            <td className={tdCls}>{categoryLabel(d.category)}</td>
            <td className={`${tdCls} text-slate-600`}>{tempLabel(d.temperatureRange)}</td>
            <td className={`${tdCls} font-mono`}>{weightKg(d)} kg ({d.numberOfPallets} Pal)</td>
            <td className={`${tdCls} font-mono`}>{fmtDateTime(d.overlapStart)} – {fmtDateTime(d.overlapEnd)}</td>
            <td className={`${tdCls} font-mono text-[10px] text-slate-600`}>{d.status}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
