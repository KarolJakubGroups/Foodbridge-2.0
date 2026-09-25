'use client';

import { useMemo, useState, useTransition } from 'react';
import { claimDonation } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import type { DonationWithDonor } from '@/lib/types';
import { categoryLabel, fmtBestBefore, fmtKg, fmtPallets, fmtWindow, tempShort } from '@/lib/format';
import { claimDeadline, claimDeadlineReason, remainingPallets } from '@/lib/domain';
import { Alert, EmptyState, PalletBar, Pill, TempPill, btn, chipCls, inputCls } from '@/components/ui';
import { CalendarIcon, ClockIcon, MapPinIcon, MinusIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { ClaimCountdown } from '@/components/ClaimCountdown';
import { useNow } from '@/components/useNow';

type Sort = 'deadline' | 'bestBefore' | 'newest' | 'weight';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'deadline', label: 'Reservierung endet bald' },
  { value: 'bestBefore', label: 'Kürzeste Haltbarkeit zuerst' },
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'weight', label: 'Grösste Menge zuerst' },
];

/** "Zürich" from "Limmatstrasse 152, 8005 Zürich". */
function town(address: string): string {
  const last = address.split(',').pop()?.trim() ?? '';
  return last.replace(/^\d{4}\s*/, '') || address;
}

/** Available weight of what is still free. */
const freeKg = (d: DonationWithDonor) => remainingPallets(d) * d.weightPerPallet;

const stepBtn = 'inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-control bg-white text-ink hover:bg-sand disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/25';
const stepInput = 'h-12 w-16 shrink-0 rounded-xl border border-control bg-white text-center text-lg font-bold tabular-nums text-ink focus:outline-none focus:border-brand-700 focus:ring-4 focus:ring-brand-700/15';

function PalletStepper({ value, max, onChange, disabled }: { value: number; max: number; onChange: (n: number) => void; disabled: boolean }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(1, n)));
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Anzahl Paletten">
      <button type="button" className={stepBtn} disabled={disabled || value <= 1} onClick={() => set(value - 1)} aria-label="Eine Palette weniger">
        <MinusIcon className="size-5" />
      </button>
      <input type="number" inputMode="numeric" min={1} max={max} value={value} disabled={disabled}
        onChange={(e) => set(Number(e.target.value) || 1)}
        className={stepInput} aria-label="Paletten" />
      <button type="button" className={stepBtn} disabled={disabled || value >= max} onClick={() => set(value + 1)} aria-label="Eine Palette mehr">
        <PlusIcon className="size-5" />
      </button>
      <span className="text-[15px] text-muted whitespace-nowrap">von {max}</span>
    </div>
  );
}

export function AvailableDonations({ donations, now: nowIso }: { donations: DonationWithDonor[]; now: string }) {
  const nowMs = useNow(Date.parse(nowIso));
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [storage, setStorage] = useState('');
  const [sort, setSort] = useState<Sort>('deadline');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [pallets, setPallets] = useState(1);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of donations) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [donations]);
  const storages = useMemo(() => [...new Set(donations.map((d) => tempShort(d.temperatureRange)))].sort(), [donations]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = donations.filter((d) => (!category || d.category === category)
      && (!storage || tempShort(d.temperatureRange) === storage)
      && (!q || d.productName.toLowerCase().includes(q) || d.donor.organizationName.toLowerCase().includes(q)
        || categoryLabel(d.category).toLowerCase().includes(q)));
    const by: Record<Sort, (a: DonationWithDonor, b: DonationWithDonor) => number> = {
      deadline: (a, b) => claimDeadline(a).getTime() - claimDeadline(b).getTime(),
      bestBefore: (a, b) => a.bestBeforeDate.localeCompare(b.bestBeforeDate),
      newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      weight: (a, b) => freeKg(b) - freeKg(a),
    };
    return [...list].sort(by[sort]);
  }, [donations, query, category, storage, sort]);

  const startConfirm = (d: DonationWithDonor) => {
    setMessage(null);
    setPallets(remainingPallets(d)); // most institutions take everything; they can lower it
    setConfirmId(d.id);
  };

  const claim = (d: DonationWithDonor, count: number) => {
    setMessage(null);
    startTransition(async () => {
      const result = await callAction(() => claimDonation(d.id, count));
      setConfirmId(null);
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const left = result.data!.remainingPallets;
      setMessage({
        kind: 'ok',
        text: `${fmtPallets(count)} «${d.productName}» für Sie reserviert. `
          + (left > 0 ? `${fmtPallets(left)} ${left === 1 ? 'bleibt' : 'bleiben'} für andere Abgabestellen verfügbar.` : 'Das Angebot ist damit vollständig reserviert.'),
      });
    });
  };

  return (
    <div className="@container flex flex-col gap-5 min-w-0">
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-[minmax(0,1fr)_200px_260px] gap-3">
          <label className="relative @xl:col-span-2 @4xl:col-span-1">
            <span className="sr-only">Produkt oder Spender suchen</span>
            <SearchIcon className="size-5 absolute left-4 top-3.5 text-subtle" />
            <input type="search" className={`${inputCls} pl-12`} placeholder="Produkt oder Spender suchen" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Lagerung</span>
            <select className={inputCls} value={storage} onChange={(e) => setStorage(e.target.value)}>
              <option value="">Lagerung: alle</option>
              {storages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Sortierung</span>
            <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2" aria-label="Nach Warengruppe filtern">
            <button type="button" aria-pressed={!category} className={`${chipCls(!category)} h-10`} onClick={() => setCategory('')}>
              Alle · {donations.length}
            </button>
            {categories.map(([c, n]) => (
              <button key={c} type="button" aria-pressed={category === c} className={`${chipCls(category === c)} h-10`} onClick={() => setCategory(category === c ? '' : c)}>
                {categoryLabel(c)} · {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {message && <Alert kind={message.kind} onClose={() => setMessage(null)}>{message.text}</Alert>}

      {rows.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl">
          <EmptyState icon={<SearchIcon className="size-6" />}
            title={donations.length === 0 ? 'Gerade keine Angebote' : 'Keine passenden Angebote'}>
            {donations.length === 0
              ? 'Sobald Spender neue Lebensmittel melden, erscheinen sie hier.'
              : 'Ändern Sie die Suche oder die Filter.'}
          </EmptyState>
        </div>
      ) : (
        <ul className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4 md:gap-5">
          {rows.map((d) => {
            const bestBefore = fmtBestBefore(d.bestBeforeDate, now);
            const confirming = confirmId === d.id;
            const left = remainingPallets(d);
            const deadline = claimDeadline(d);
            const closed = deadline.getTime() <= nowMs;
            return (
              <li key={d.id} className={`bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col gap-3 ${closed ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap gap-2">
                  <TempPill value={d.temperatureRange} />
                  <Pill>{categoryLabel(d.category)}</Pill>
                </div>
                <h3 className="text-xl font-bold text-ink">{d.productName}</h3>
                <span className="flex items-center gap-1.5 text-[15px] text-muted">
                  <MapPinIcon className="size-4 shrink-0" />{d.donor.organizationName} · {town(d.pickupAddress)}
                </span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-display text-3xl font-bold text-ink tabular-nums">{fmtKg(freeKg(d))}</span>
                    <span className="text-[15px] text-muted">
                      {d.claimedPallets > 0 ? `${left} von ${fmtPallets(d.numberOfPallets)} frei` : fmtPallets(d.numberOfPallets)}
                    </span>
                  </div>
                  {d.claimedPallets > 0 && <PalletBar claimed={d.claimedPallets} total={d.numberOfPallets} />}
                </div>
                <div className="flex flex-col gap-1.5 text-[15px] text-ink-2">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="size-4 shrink-0 text-subtle" />Abholung {fmtWindow(d.overlapStart, d.overlapEnd, now)}
                  </span>
                  <span className={`flex items-center gap-2 ${bestBefore.urgent ? 'font-semibold text-[#9a4a0a]' : ''}`}>
                    <ClockIcon className="size-4 shrink-0 text-subtle" />{bestBefore.text}
                  </span>
                </div>
                <ClaimCountdown deadline={deadline} reason={claimDeadlineReason(d)} now={nowMs} />
                <div className="mt-auto pt-1">
                  {confirming && !closed ? (
                    <div className="flex flex-col gap-3">
                      {left > 1 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[15px] font-semibold text-ink">Wie viele Paletten brauchen Sie?</span>
                          <PalletStepper value={Math.min(pallets, left)} max={left} onChange={setPallets} disabled={pending} />
                        </div>
                      )}
                      <p className="text-[15px] text-ink-2">
                        {fmtPallets(Math.min(pallets, left))} ({fmtKg(Math.min(pallets, left) * d.weightPerPallet)}) verbindlich reservieren?
                      </p>
                      <div className="flex gap-2">
                        <button type="button" className={`${btn('primary')} flex-1`} disabled={pending} onClick={() => claim(d, Math.min(pallets, left))}>
                          {pending ? 'Wird reserviert…' : 'Ja, reservieren'}
                        </button>
                        <button type="button" className={btn('ghost')} disabled={pending} onClick={() => setConfirmId(null)}>Abbrechen</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={`${btn('primary')} w-full`} disabled={pending || closed} onClick={() => startConfirm(d)}>
                      {closed ? 'Nicht mehr reservierbar' : 'Reservieren'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
