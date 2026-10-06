'use client';

import { useMemo, useState, useTransition } from 'react';
import { resendToGalliker, setOrderStatus } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import type { TransportOrderWithDetails } from '@/lib/types';
import { fmtCount, fmtDateOfInstant, fmtDayTime, fmtKg, fmtPallets, fmtWindow, tempKind } from '@/lib/format';
import { Alert, Pill, TempPill, TransportBadge, btn } from '@/components/ui';
import { AlertIcon, CheckIcon, MapPinIcon, RefreshIcon, SendIcon, SnowflakeIcon, ThermometerIcon, TruckIcon } from '@/components/icons';

function totals(order: TransportOrderWithDetails) {
  return {
    kg: order.claims.reduce((s, c) => s + c.weightKg, 0),
    pallets: order.claims.reduce((s, c) => s + c.pallets, 0),
  };
}

/** The strictest storage in the load: decides whether a refrigerated truck is needed. */
function coldChain(order: TransportOrderWithDetails): 'frozen' | 'chilled' | null {
  const kinds = order.claims.map((c) => tempKind(c.donation.temperatureRange));
  if (kinds.includes('frozen')) return 'frozen';
  if (kinds.includes('chilled')) return 'chilled';
  return null;
}

/** Deliveries grouped by institution. */
function destinations(order: TransportOrderWithDetails) {
  const byId = new Map<string, { name: string; address: string; pallets: number }>();
  for (const c of order.claims) {
    const d = byId.get(c.foodbank.id) ?? { name: c.foodbank.organizationName, address: c.foodbank.address, pallets: 0 };
    d.pallets += c.pallets;
    byId.set(c.foodbank.id, d);
  }
  return [...byId.values()];
}

/** A delivered order in one line. */
export function OrderSummary({ order }: { order: TransportOrderWithDetails }) {
  const { kg } = totals(order);
  return (
    <article className="bg-white border border-line rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[17px] font-semibold text-ink truncate">{order.donor.organizationName}</div>
        <div className="text-sm text-muted">Auftrag {order.id} · {fmtDateOfInstant(order.pickupEnd)}</div>
      </div>
      <span className="text-base font-semibold text-ink tabular-nums whitespace-nowrap">{fmtKg(kg)}</span>
    </article>
  );
}

function GallikerStatus({ order, readOnly, now }: { order: TransportOrderWithDetails; readOnly: boolean; now: Date }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const last = order.transmissions[0];
  const resend = () => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => resendToGalliker(order.id));
      if (!result.ok) setError(result.error);
    });
  };

  if (order.gallikerStatus === 'NOT_SENT' && readOnly) return null;
  return (
    <div className="rounded-xl border border-line-soft px-3.5 py-3 flex flex-col gap-2">
      {order.gallikerStatus === 'SENT' && (
        <p className="flex items-start gap-2 text-[15px] text-ink-2">
          <SendIcon className="size-4 mt-1 shrink-0 text-brand-700" />
          <span>
            An Galliker übermittelt · <b className="tabular-nums">{order.gallikerReference}</b>
            {order.gallikerSentAt && <span className="text-muted"> · {fmtDayTime(order.gallikerSentAt, now)}</span>}
            {last?.mode === 'SANDBOX' && <span className="text-muted"> (Testverbindung)</span>}
          </span>
        </p>
      )}
      {order.gallikerStatus === 'FAILED' && (
        <p className="flex items-start gap-2 text-[15px] text-[#9b1c14]">
          <SendIcon className="size-4 mt-1 shrink-0" />
          <span>Übermittlung an Galliker fehlgeschlagen{order.gallikerError ? `: ${order.gallikerError}` : '.'}</span>
        </p>
      )}
      {order.gallikerStatus === 'NOT_SENT' && <p className="text-[15px] text-muted">Noch nicht an Galliker übermittelt.</p>}
      {!readOnly && order.gallikerStatus !== 'SENT' && order.status !== 'COMPLETED' && (
        <button type="button" className={`${btn('ghost', 'sm')} self-start`} disabled={pending} onClick={resend}>
          <RefreshIcon className="size-4" />{pending ? 'Wird gesendet…' : order.gallikerStatus === 'FAILED' ? 'Erneut an Galliker senden' : 'An Galliker senden'}
        </button>
      )}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {last && !readOnly && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Gesendete Daten ansehen</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-sand p-3 text-xs leading-relaxed">{JSON.stringify(last.payload, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export function OrderCard({ order, now: nowIso, readOnly = false }: { order: TransportOrderWithDetails; now: string; readOnly?: boolean }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { kg, pallets } = totals(order);
  const cold = coldChain(order);
  const stops = destinations(order);
  const pickupAddress = order.claims[0]?.donation.pickupAddress ?? order.donor.address;
  const overdue = order.status !== 'COMPLETED' && new Date(order.pickupEnd) < now;

  const transition = (status: 'DISPATCHED' | 'COMPLETED') => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => setOrderStatus(order.id, status));
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <article className="bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-subtle">Auftrag {order.id} · {fmtCount(order.claims.length, 'Position', 'Positionen')}</span>
        {readOnly && <TransportBadge status={order.status} />}
      </div>
      <div className="space-y-1">
        <h3 className="text-[19px] font-bold text-ink">{order.donor.organizationName}</h3>
        <p className="flex items-start gap-1.5 text-[15px] text-muted"><MapPinIcon className="size-4 mt-1 shrink-0" />{pickupAddress}</p>
        {!readOnly && (order.donor.contactName || order.donor.phone) && (
          <p className="text-sm text-muted">Kontakt: {[order.donor.contactName, order.donor.phone].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-sand px-3.5 py-3">
          <div className="text-sm text-muted">{order.status === 'COMPLETED' ? 'Abgeholt im Zeitfenster' : 'Abholfenster'}</div>
          <div className="text-[17px] font-bold text-ink">{fmtWindow(order.pickupStart, order.pickupEnd, now)}</div>
        </div>
        <div className="rounded-xl bg-sand px-3.5 py-3">
          <div className="text-sm text-muted">Ladung</div>
          <div className="text-[17px] font-bold text-ink tabular-nums">{fmtKg(kg)}</div>
          <div className="text-sm text-muted">{fmtPallets(pallets)}</div>
        </div>
      </div>
      {overdue && (
        <Pill tone="red" className="self-start" wrap>
          <AlertIcon className="size-4" />{order.status === 'DISPATCHED' ? 'Abholfenster vorbei, noch nicht als geliefert markiert' : 'Abholfenster verpasst: neuen Termin mit dem Spender vereinbaren'}
        </Pill>
      )}
      {cold && (
        <Pill tone={cold === 'frozen' ? 'frozen' : 'cold'} className="self-start" wrap>
          {cold === 'frozen' ? <SnowflakeIcon className="size-4" /> : <ThermometerIcon className="size-4" />}
          {cold === 'frozen' ? 'Tiefkühlfahrzeug nötig' : 'Kühlfahrzeug nötig'}
        </Pill>
      )}
      <ul className="flex flex-col gap-2.5">
        {order.claims.map((c) => (
          <li key={c.id} className="text-[15px] leading-snug flex flex-col gap-1">
            <span>
              <span className="font-semibold text-ink">{c.donation.productName}</span>
              <span className="text-muted"> · {fmtPallets(c.pallets)} · {fmtKg(c.weightKg)}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-subtle">
              <TempPill value={c.donation.temperatureRange} />
              <span>→ {c.foodbank.organizationName}</span>
            </span>
          </li>
        ))}
      </ul>
      {!readOnly && stops.length > 0 && (
        <div className="rounded-xl bg-sand px-3.5 py-3 text-[15px]">
          <div className="text-sm text-muted mb-1">{stops.length === 1 ? 'Lieferadresse' : `${stops.length} Lieferadressen`}</div>
          <ul className="space-y-1">
            {stops.map((s) => (
              <li key={s.address}><b className="text-ink">{s.name}</b> <span className="text-muted">· {s.address} · {fmtPallets(s.pallets)}</span></li>
            ))}
          </ul>
        </div>
      )}
      <GallikerStatus order={order} readOnly={readOnly} now={now} />
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
