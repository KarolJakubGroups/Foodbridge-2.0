'use client';

import { useMemo, useState } from 'react';
import type { DonorDonation } from '@/lib/types';
import { STATE_LABEL, categoryLabel, fmtBestBefore, fmtDayTime, fmtKg, fmtPallets, fmtWindow, tempShort } from '@/lib/format';
import { claimDeadline, donationState, remainingPallets, type DonationState } from '@/lib/domain';
import { EmptyState, FoodPhoto, PalletBar, StateBadge, StateProgress, inputCls } from '@/components/ui';
import { PackageIcon, SearchIcon } from '@/components/icons';
import { WithdrawButton } from '@/components/WithdrawButton';

const TABS: { key: string; label: string; states: DonationState[] }[] = [
  { key: 'active', label: 'Aktiv', states: ['OPEN', 'PARTIAL', 'EXPIRED', 'RESERVED', 'SCHEDULED'] },
  { key: 'done', label: 'Abgeschlossen', states: ['COLLECTED'] },
  { key: 'withdrawn', label: 'Zurückgezogen', states: ['WITHDRAWN'] },
];
const DAY = 86_400_000;

/** Earliest pickup still ahead among the reservations of an offer. */
function nextOrder(d: DonorDonation) {
  return d.claims
    .map((c) => c.transportOrder)
    .filter((o): o is NonNullable<typeof o> => o !== null && o.status !== 'COMPLETED')
    .sort((a, b) => new Date(a.pickupStart).getTime() - new Date(b.pickupStart).getTime())[0] ?? null;
}

function recipients(d: DonorDonation): string {
  const names = [...new Set(d.claims.map((c) => c.foodbank.organizationName))];
  return names.length <= 2 ? names.join(' und ') : `${names.slice(0, 2).join(', ')} und ${names.length - 2} weitere`;
}

/** The one thing a donor wants to know per offer: what happens next. */
function NextStep({ d, state, now }: { d: DonorDonation; state: DonationState; now: Date }) {
  let label: string; let value: string; let warn = false;
  const order = nextOrder(d);
  switch (state) {
    case 'SCHEDULED':
      label = order?.status === 'DISPATCHED' ? 'Lastwagen unterwegs' : 'Abholung';
      value = order ? fmtWindow(order.pickupStart, order.pickupEnd, now) : 'wird geplant';
      break;
    case 'RESERVED':
      label = 'Reserviert von'; value = recipients(d) || 'einer Abgabestelle';
      break;
    case 'PARTIAL':
    case 'OPEN': {
      const until = claimDeadline(d);
      label = order ? 'Erste Abholung' : state === 'PARTIAL' ? `Reserviert von ${recipients(d)}` : 'Wartet auf Abnehmer';
      value = order ? fmtWindow(order.pickupStart, order.pickupEnd, now) : `Reservierbar bis ${fmtDayTime(until, now)}`;
      warn = !order && until.getTime() - now.getTime() <= DAY;
      break;
    }
    case 'EXPIRED': {
      const left = remainingPallets(d);
      label = d.claimedPallets > 0 ? `${fmtPallets(left)} nicht reserviert` : 'Niemand hat reserviert';
      value = order ? `Abholung ${fmtWindow(order.pickupStart, order.pickupEnd, now)}` : d.claimedPallets > 0 ? 'Bitte Rest zurückziehen' : 'Bitte zurückziehen';
      warn = true;
      break;
    }
    case 'COLLECTED':
      label = 'Abgeholt'; value = recipients(d) || '–';
      break;
    default:
      label = 'Zurückgezogen'; value = '–';
  }
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm text-subtle">{label}</span>
      <span className={`text-base font-semibold ${warn ? 'text-[#9a4a0a]' : 'text-ink'}`}>{value}</span>
    </div>
  );
}

export function DonationList({ donations, now: nowIso }: { donations: DonorDonation[]; now: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [tab, setTab] = useState(TABS[0].key);
  const [query, setQuery] = useState('');

  const withState = useMemo(() => donations.map((d) => ({ d, state: donationState(d, now) })), [donations, now]);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, withState.filter((r) => t.states.includes(r.state)).length]));
  const rows = useMemo(() => {
    const states = TABS.find((t) => t.key === tab)!.states;
    const q = query.trim().toLowerCase();
    return withState.filter(({ d, state }) => states.includes(state) && (!q || d.productName.toLowerCase().includes(q)
      || STATE_LABEL[state].toLowerCase().includes(q) || categoryLabel(d.category).toLowerCase().includes(q)));
  }, [withState, tab, query]);

  return (
    <div className="@container">
      <div className="px-5 md:px-7 pb-5 flex flex-col gap-4 @3xl:flex-row @3xl:items-center @3xl:justify-between no-print">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Angebote filtern">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={tab === t.key
                ? 'h-10 px-4 rounded-full bg-ink text-white text-[15px] font-semibold'
                : 'h-10 px-4 rounded-full border border-control bg-white text-[15px] text-ink-2 hover:bg-sand'}>
              {t.label} · {counts[t.key]}
            </button>
          ))}
        </div>
        <label className="relative @3xl:w-64 shrink-0">
          <span className="sr-only">Produkt suchen</span>
          <SearchIcon className="size-5 absolute left-3.5 top-3.5 text-subtle" />
          <input type="search" className={`${inputCls} h-11 pl-11`} placeholder="Produkt suchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="border-t border-line-soft">
          <EmptyState icon={<PackageIcon className="size-6" />}
            title={query ? 'Nichts gefunden' : tab === 'active' ? 'Keine laufenden Angebote' : 'Noch nichts hier'}>
            {query ? 'Versuchen Sie einen anderen Suchbegriff.' : tab === 'active' ? 'Melden Sie Ihren nächsten Überschuss mit «Überschuss melden».' : null}
          </EmptyState>
        </div>
      ) : (
        <ul>
          <li aria-hidden className="hidden @3xl:grid grid-cols-[minmax(0,1fr)_180px_200px_auto] gap-5 px-7 py-2.5 border-t border-line-soft text-[13px] font-semibold uppercase tracking-wide text-subtle">
            <span>Produkt</span><span>Stand</span><span>Nächster Schritt</span><span className="w-32" />
          </li>
          {rows.map(({ d, state }) => {
            const bestBefore = fmtBestBefore(d.bestBeforeDate, now);
            const showBestBefore = !['COLLECTED', 'WITHDRAWN'].includes(state);
            const left = remainingPallets(d);
            const canWithdraw = d.status === 'AVAILABLE' && left > 0;
            return (
              <li key={d.id} className="grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-[minmax(0,1fr)_180px_200px_auto] gap-x-5 gap-y-3 px-5 md:px-7 py-5 border-t border-line-soft items-center">
                <div className="flex gap-4 min-w-0 @md:col-span-2 @3xl:col-span-1">
                  <FoodPhoto item={d} className="size-16 rounded-2xl shrink-0" />
                  <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[17px] font-semibold text-ink">{d.productName}</span>
                  <span className="text-[15px] text-muted">
                    {categoryLabel(d.category)} · {tempShort(d.temperatureRange)} · {fmtPallets(d.numberOfPallets)} · {fmtKg(d.numberOfPallets * d.weightPerPallet)}
                  </span>
                  {d.claimedPallets > 0 && state !== 'WITHDRAWN' && (
                    <div className="flex flex-col gap-1 max-w-xs">
                      <span className="text-sm font-semibold text-ink-2">
                        {d.claimedPallets === d.numberOfPallets ? 'Alle Paletten reserviert' : `${d.claimedPallets} von ${fmtPallets(d.numberOfPallets)} reserviert`}
                      </span>
                      <PalletBar claimed={d.claimedPallets} total={d.numberOfPallets} />
                    </div>
                  )}
                  {showBestBefore && (
                    <span className={`text-sm ${bestBefore.urgent ? 'font-semibold text-[#9a4a0a]' : 'text-subtle'}`}>{bestBefore.text}</span>
                  )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-start">
                  <StateBadge state={state} />
                  <div className="w-full max-w-48"><StateProgress state={state} /></div>
                </div>
                <NextStep d={d} state={state} now={now} />
                <div className="@3xl:w-32 flex @3xl:justify-end no-print">
                  {canWithdraw && <WithdrawButton donationId={d.id} productName={d.productName} remainder={d.claimedPallets > 0 ? left : undefined} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
