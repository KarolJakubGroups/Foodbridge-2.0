'use client';

import { useMemo, useState, useTransition } from 'react';
import { claimDonation } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import type { AvailableDonation } from '@/lib/types';
import { categoryLabel, fmtBestBefore, fmtKg, fmtPallets, fmtWindow, tempShort } from '@/lib/format';
import { claimDeadline, claimDeadlineReason, freePalletNumbers, remainingPallets, uniformWeight, weightOfPallets } from '@/lib/domain';
import { Select } from '@/components/pickers';
import { Alert, EmptyState, FoodPhoto, Monogram, PalletBar, PhotoPill, TempPill, btn, chipCls, inputCls } from '@/components/ui';
import { foodImage } from '@/lib/images';
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
const freeKg = (d: AvailableDonation) => weightOfPallets(d.palletWeights, freePalletNumbers(d));
/** Free pallets with their weights; `uniform` when they all weigh the same (then only the count matters). */
function freePallets(d: AvailableDonation) {
  const numbers = freePalletNumbers(d);
  const weights = numbers.map((n) => d.palletWeights[n - 1]);
  return { numbers, weights, uniform: uniformWeight(weights) !== null };
}

const stepBtn = 'inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-control bg-white text-ink hover:bg-sand disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/25';
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

export function AvailableDonations({ donations, now: nowIso }: { donations: AvailableDonation[]; now: string }) {
  const nowMs = useNow(Date.parse(nowIso));
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [storage, setStorage] = useState('');
  const [sort, setSort] = useState<Sort>('deadline');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [pallets, setPallets] = useState(1);
  /** Chosen pallet numbers when the free pallets weigh differently. */
  const [selected, setSelected] = useState<number[]>([]);
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
    const by: Record<Sort, (a: AvailableDonation, b: AvailableDonation) => number> = {
      deadline: (a, b) => claimDeadline(a).getTime() - claimDeadline(b).getTime(),
      bestBefore: (a, b) => a.bestBeforeDate.localeCompare(b.bestBeforeDate),
      newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      weight: (a, b) => freeKg(b) - freeKg(a),
    };
    return [...list].sort(by[sort]);
  }, [donations, query, category, storage, sort]);

  const startConfirm = (d: AvailableDonation) => {
    setMessage(null);
    // Most institutions take everything; they can lower it.
    setPallets(remainingPallets(d));
    setSelected(freePalletNumbers(d));
    setConfirmId(d.id);
  };
  const toggle = (n: number) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort((a, b) => a - b)));

  /** Same-weight pallets go by count (the server assigns the next free ones); otherwise the chosen pallets. */
  const claim = (d: AvailableDonation, numbers: number[], byCount: boolean) => {
    const count = numbers.length;
    setMessage(null);
    startTransition(async () => {
      const result = await callAction(() => claimDonation(d.id, byCount ? count : numbers));
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
          <Select aria-label="Lagerung" value={storage} onChange={setStorage}
            options={[{ value: '', label: 'Lagerung: alle' }, ...storages.map((s) => ({ value: s, label: s }))]} />
          <Select aria-label="Sortierung" value={sort} onChange={setSort} options={SORTS} />
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2" aria-label="Nach Warengruppe filtern">
            <button type="button" aria-pressed={!category} className={`${chipCls(!category)} h-10`} onClick={() => setCategory('')}>
              Alle · {donations.length}
            </button>
            {categories.map(([c, n]) => (
              <button key={c} type="button" aria-pressed={category === c} className={`${chipCls(category === c)} h-10 pl-1.5`} onClick={() => setCategory(category === c ? '' : c)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foodImage({ productName: '', category: c })} alt="" className="size-7 rounded-full object-cover" />
                {categoryLabel(c)} · {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {message && <Alert kind={message.kind} onClose={() => setMessage(null)}>{message.text}</Alert>}

      {rows.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-card">
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
            const free = freePallets(d);
            // Same weight: the first free pallets. Different weights: the ones ticked.
            const chosen = free.uniform ? free.numbers.slice(0, Math.min(pallets, left)) : selected.filter((n) => free.numbers.includes(n));
            const deadline = claimDeadline(d);
            const closed = deadline.getTime() <= nowMs;
            return (
              <li key={d.id} className={`bg-white rounded-3xl shadow-card overflow-hidden flex flex-col transition-shadow hover:shadow-lift ${closed ? 'opacity-70' : ''}`}>
                <div className="relative h-44 shrink-0">
                  <FoodPhoto item={d} alt={d.productName} className="absolute inset-0 size-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5">
                    <TempPill value={d.temperatureRange} />
                    <PhotoPill>{categoryLabel(d.category)}</PhotoPill>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2.5 text-white">
                    <Monogram name={d.donor.organizationName} size="sm" ring />
                    <span className="min-w-0 truncate text-[15px] font-semibold">{d.donor.organizationName}</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold tracking-[-0.01em] text-ink">{d.productName}</h3>
                    {d.packagingUnit && <span className="block text-sm text-ink-2">{d.packagingUnit}</span>}
                    <span className="flex items-center gap-1 text-sm text-muted"><MapPinIcon className="size-3.5 shrink-0" />{town(d.pickupAddress)}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold text-brand-700 tabular-nums">{fmtKg(freeKg(d))}</div>
                    <div className="text-[13px] text-muted whitespace-nowrap">
                      {d.claimedPallets > 0 ? `${left} von ${d.numberOfPallets} frei` : fmtPallets(d.numberOfPallets)}
                    </div>
                  </div>
                </div>
                {d.claimedPallets > 0 && <PalletBar claimed={d.claimedPallets} total={d.numberOfPallets} />}
                {!free.uniform && (
                  <span className="text-sm text-muted">
                    Je Palette {free.weights.slice(0, 6).map((w) => fmtKg(w)).join(' · ')}{free.weights.length > 6 ? ' · …' : ''}
                  </span>
                )}
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
                      {left > 1 && free.uniform && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[15px] font-semibold text-ink">Wie viele Paletten brauchen Sie?</span>
                          <PalletStepper value={Math.min(pallets, left)} max={left} onChange={setPallets} disabled={pending} />
                        </div>
                      )}
                      {left > 1 && !free.uniform && (
                        <div className="flex flex-col gap-2" role="group" aria-label="Paletten auswählen">
                          <span className="text-[15px] font-semibold text-ink">Welche Paletten brauchen Sie?</span>
                          <div className="flex flex-wrap gap-2">
                            {free.numbers.map((n, i) => (
                              <button key={n} type="button" aria-pressed={chosen.includes(n)} disabled={pending}
                                className={chipCls(chosen.includes(n))} onClick={() => toggle(n)}>
                                Palette {n} · {fmtKg(free.weights[i])}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[15px] text-ink-2">
                        {chosen.length === 0
                          ? 'Bitte mindestens eine Palette wählen.'
                          : `${fmtPallets(chosen.length)} (${fmtKg(weightOfPallets(d.palletWeights, chosen))}) verbindlich reservieren?`}
                      </p>
                      <div className="flex gap-2">
                        <button type="button" className={`${btn('primary')} flex-1`} disabled={pending || chosen.length === 0} onClick={() => claim(d, chosen, free.uniform)}>
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
