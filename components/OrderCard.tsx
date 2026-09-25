'use client';

import { useMemo, useState, useTransition } from 'react';
import { setOrderStatus } from '@/lib/actions';
import type { TransportOrderWithDetails } from '@/lib/types';
import { fmtCount, fmtDateOfInstant, fmtDayTime, fmtKg, fmtPallets, fmtTime, tempShort } from '@/lib/format';
import { weightKg } from '@/lib/domain';
import { Alert, TransportBadge, btn } from '@/components/ui';
import { CheckIcon, MapPinIcon, TruckIcon } from '@/components/icons';

function totals(order: TransportOrderWithDetails) {
  return {
    kg: order.donations.reduce((s, d) => s + weightKg(d), 0),
    pallets: order.donations.reduce((s, d) => s + d.numberOfPallets, 0),
  };
}

/** A delivered order in one line. */
export function OrderSummary({ order }: { order: TransportOrderWithDetails }) {
  const { kg } = totals(order);
  return (
    <article className="bg-white border border-line rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[17px] font-semibold text-ink truncate">{order.donor.organizationName}</div>
        <div className="text-sm text-muted">Auftrag {order.id} · {fmtDateOfInstant(order.pickupTime)}</div>
      </div>
      <span className="text-base font-semibold text-ink tabular-nums whitespace-nowrap">{fmtKg(kg)}</span>
    </article>
  );
}

export function OrderCard({ order, now: nowIso, readOnly = false }: { order: TransportOrderWithDetails; now: string; readOnly?: boolean }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { kg, pallets } = totals(order);

  const transition = (status: 'DISPATCHED' | 'COMPLETED') => {
    setError(null);
    startTransition(async () => {
      const result = await setOrderStatus(order.id, status);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <article className="bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-subtle">Auftrag {order.id} · {fmtCount(order.donations.length, 'Produkt', 'Produkte')}</span>
        {readOnly && <TransportBadge status={order.status} />}
      </div>
      <div className="space-y-1">
        <h3 className="text-[19px] font-bold text-ink">{order.donor.organizationName}</h3>
        <p className="flex items-start gap-1.5 text-[15px] text-muted"><MapPinIcon className="size-4 mt-1 shrink-0" />{order.donor.address}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-sand px-3.5 py-3">
          <div className="text-sm text-muted">{order.status === 'COMPLETED' ? 'Abgeholt' : 'Abholung'}</div>
          <div className="text-[17px] font-bold text-ink">{fmtDayTime(order.pickupTime, now)}</div>
        </div>
        <div className="rounded-xl bg-sand px-3.5 py-3">
          <div className="text-sm text-muted">Ladung</div>
          <div className="text-[17px] font-bold text-ink tabular-nums">{fmtKg(kg)}</div>
          <div className="text-sm text-muted">{fmtPallets(pallets)}</div>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {order.donations.map((d) => (
          <li key={d.id} className="text-[15px] leading-snug">
            <span className="font-semibold text-ink">{d.productName}</span>
            <span className="text-muted"> · {fmtKg(weightKg(d))} · {tempShort(d.temperatureRange)}</span>
            {!readOnly && (
              <span className="block text-sm text-subtle">
                Abholbereit {fmtDayTime(d.overlapStart, now)}–{fmtDateOfInstant(d.overlapStart) === fmtDateOfInstant(d.overlapEnd) ? fmtTime(d.overlapEnd) : fmtDayTime(d.overlapEnd, now)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {!readOnly && order.status === 'PENDING' && (
        <button type="button" disabled={pending} className={`${btn('dark')} w-full`} onClick={() => transition('DISPATCHED')}>
          <TruckIcon className="size-5" />{pending ? 'Wird gespeichert…' : 'Fahrt starten'}
        </button>
      )}
      {!readOnly && order.status === 'DISPATCHED' && (
        <button type="button" disabled={pending} className={`${btn('ghost')} w-full`} onClick={() => transition('COMPLETED')}>
          <CheckIcon className="size-5" />{pending ? 'Wird gespeichert…' : 'Als geliefert markieren'}
        </button>
      )}
    </article>
  );
}
