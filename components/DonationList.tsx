'use client';

import { useMemo, useState } from 'react';
import type { DonorDonation } from '@/lib/types';
import { STATE_LABEL, categoryLabel, fmtBestBefore, fmtDayTime, fmtKg, fmtPallets, tempShort } from '@/lib/format';
import { donationState, visibleUntil, weightKg, type DonationState } from '@/lib/domain';
import { EmptyState, StateBadge, StateProgress, inputCls } from '@/components/ui';
import { PackageIcon, SearchIcon } from '@/components/icons';
import { WithdrawButton } from '@/components/WithdrawButton';

const TABS: { key: string; label: string; states: DonationState[] }[] = [
  { key: 'active', label: 'Aktiv', states: ['OPEN', 'EXPIRED', 'RESERVED', 'SCHEDULED'] },
  { key: 'done', label: 'Abgeschlossen', states: ['COLLECTED'] },
  { key: 'withdrawn', label: 'Zurückgezogen', states: ['WITHDRAWN'] },
];
const DAY = 86_400_000;

/** The one thing a donor wants to know per offer: what happens next. */
function NextStep({ d, state, now }: { d: DonorDonation; state: DonationState; now: Date }) {
  let label: string; let value: string; let warn = false;
  switch (state) {
    case 'SCHEDULED':
      label = d.transportOrder?.status === 'DISPATCHED' ? 'Lastwagen unterwegs' : 'Abholung';
      value = d.transportOrder ? `${fmtDayTime(d.transportOrder.pickupTime, now)} Uhr` : 'wird geplant';
      break;
    case 'RESERVED':
      label = 'Reserviert von'; value = d.claim?.foodbank.organizationName ?? 'einer Abgabestelle';
      break;
    case 'OPEN': {
      const until = visibleUntil(d.createdAt);
      label = 'Wartet auf Abnehmer'; value = `Sichtbar bis ${fmtDayTime(until, now)}`;
      warn = until.getTime() - now.getTime() <= DAY;
      break;
    }
    case 'EXPIRED':
      label = 'Niemand hat reserviert'; value = 'Bitte zurückziehen'; warn = true;
      break;
    case 'COLLECTED':
      label = 'Abgeholt'; value = d.claim?.foodbank.organizationName ?? (d.transportOrder ? fmtDayTime(d.transportOrder.pickupTime, now) : '–');
      break;
    default:
      label = 'Zurückgezogen'; value = '–';
  }
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm text-subtle">{label}</span>
      <span className={`text-base font-semibold truncate ${warn ? 'text-[#9a4a0a]' : 'text-ink'}`}>{value}</span>
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
          <li aria-hidden className="hidden @3xl:grid grid-cols-[minmax(0,1fr)_180px_200px_auto] gap-5 px-7 py-2.5 bg-sand border-t border-line-soft text-sm font-semibold text-subtle">
            <span>Produkt</span><span>Stand</span><span>Nächster Schritt</span><span className="w-32" />
          </li>
          {rows.map(({ d, state }) => {
            const bestBefore = fmtBestBefore(d.bestBeforeDate, now);
            const showBestBefore = !['COLLECTED', 'WITHDRAWN'].includes(state);
            return (
              <li key={d.id} className="grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-[minmax(0,1fr)_180px_200px_auto] gap-x-5 gap-y-3 px-5 md:px-7 py-5 border-t border-line-soft items-center">
                <div className="flex flex-col gap-1 min-w-0 @md:col-span-2 @3xl:col-span-1">
                  <span className="text-[17px] font-semibold text-ink">{d.productName}</span>
                  <span className="text-[15px] text-muted">
                    {categoryLabel(d.category)} · {tempShort(d.temperatureRange)} · {fmtPallets(d.numberOfPallets)} · {fmtKg(weightKg(d))}
                  </span>
                  {showBestBefore && (
                    <span className={`text-sm ${bestBefore.urgent ? 'font-semibold text-[#9a4a0a]' : 'text-subtle'}`}>{bestBefore.text}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-start">
                  <StateBadge state={state} />
                  <div className="w-full max-w-48"><StateProgress state={state} /></div>
                </div>
                <NextStep d={d} state={state} now={now} />
                <div className="@3xl:w-32 flex @3xl:justify-end no-print">
                  {d.status === 'AVAILABLE' && <WithdrawButton donationId={d.id} productName={d.productName} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
