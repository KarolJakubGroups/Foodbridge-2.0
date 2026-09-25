'use client';

import { useMemo, useState, useTransition } from 'react';
import { claimDonation } from '@/lib/actions';
import type { DonationWithDonor } from '@/lib/types';
import { categoryLabel, fmtBestBefore, fmtDateOfInstant, fmtDayTime, fmtKg, fmtPallets, fmtTime, tempShort } from '@/lib/format';
import { weightKg } from '@/lib/domain';
import { Alert, EmptyState, Pill, TempPill, btn, chipCls, inputCls } from '@/components/ui';
import { CalendarIcon, ClockIcon, MapPinIcon, SearchIcon } from '@/components/icons';

type Sort = 'bestBefore' | 'newest' | 'weight';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'bestBefore', label: 'Kürzeste Haltbarkeit zuerst' },
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'weight', label: 'Grösste Menge zuerst' },
];

/** "Zürich" from "Limmatstrasse 152, 8005 Zürich". */
function town(address: string): string {
  const last = address.split(',').pop()?.trim() ?? '';
  return last.replace(/^\d{4}\s*/, '') || address;
}

export function AvailableDonations({ donations, now: nowIso }: { donations: DonationWithDonor[]; now: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [storage, setStorage] = useState('');
  const [sort, setSort] = useState<Sort>('bestBefore');
  const [confirmId, setConfirmId] = useState<number | null>(null);
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
      bestBefore: (a, b) => a.bestBeforeDate.localeCompare(b.bestBeforeDate),
      newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      weight: (a, b) => weightKg(b) - weightKg(a),
    };
    return [...list].sort(by[sort]);
  }, [donations, query, category, storage, sort]);

  const claim = (d: DonationWithDonor) => {
    setMessage(null);
    startTransition(async () => {
      const result = await claimDonation(d.id);
      setConfirmId(null);
      setMessage(result.ok
        ? { kind: 'ok', text: `«${d.productName}» ist für Sie reserviert. Sie finden es unter «Meine Reservierungen».` }
        : { kind: 'error', text: result.error });
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
            const sameDay = fmtDateOfInstant(d.overlapStart) === fmtDateOfInstant(d.overlapEnd);
            const confirming = confirmId === d.id;
            return (
              <li key={d.id} className="bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Pill>{categoryLabel(d.category)}</Pill>
                  <TempPill value={d.temperatureRange} />
                </div>
                <h3 className="text-xl font-bold text-ink">{d.productName}</h3>
                <span className="flex items-center gap-1.5 text-[15px] text-muted">
                  <MapPinIcon className="size-4 shrink-0" />{d.donor.organizationName} · {town(d.pickupAddress)}
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="font-display text-3xl font-bold text-ink tabular-nums">{fmtKg(weightKg(d))}</span>
                  <span className="text-[15px] text-muted">{fmtPallets(d.numberOfPallets)}</span>
                </div>
                <div className="flex flex-col gap-1.5 text-[15px] text-ink-2">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="size-4 shrink-0 text-subtle" />
                    Abholung {fmtDayTime(d.overlapStart, now)}–{sameDay ? fmtTime(d.overlapEnd) : fmtDayTime(d.overlapEnd, now)}
                  </span>
                  <span className={`flex items-center gap-2 ${bestBefore.urgent ? 'font-semibold text-[#9a4a0a]' : ''}`}>
                    <ClockIcon className="size-4 shrink-0 text-subtle" />{bestBefore.text}
                  </span>
                </div>
                <div className="mt-auto pt-2">
                  {confirming ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[15px] text-ink-2">{fmtKg(weightKg(d))} verbindlich reservieren?</p>
                      <div className="flex gap-2">
                        <button type="button" className={`${btn('primary')} flex-1`} disabled={pending} onClick={() => claim(d)}>
                          {pending ? 'Wird reserviert…' : 'Ja, reservieren'}
                        </button>
                        <button type="button" className={btn('ghost')} disabled={pending} onClick={() => setConfirmId(null)}>Abbrechen</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={`${btn('primary')} w-full`} disabled={pending} onClick={() => { setMessage(null); setConfirmId(d.id); }}>
                      Reservieren
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
