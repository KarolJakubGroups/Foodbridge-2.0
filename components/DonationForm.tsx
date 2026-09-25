'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { addPallets, createDonation } from '@/lib/actions';
import type { Category, DonationInput, DonationPrefill, OpenDonation } from '@/lib/types';
import {
  CATEGORIES_OPTIONS, TEMPERATURES, categoryLabel, fmtBestBefore, fmtDate, fmtDayTime, fmtKg, fmtPallets, fmtTime, isTemperaturePreset,
} from '@/lib/format';
import { FRESHNESS_DAYS, MAX_PALLETS, MAX_TEMPERATURE_LENGTH, MAX_WEIGHT_PER_PALLET, normalizeProductName } from '@/lib/domain';
import { Alert, Field, Pill, TempPill, btn, chipCls, inputCls, linkCls } from '@/components/ui';
import { CheckIcon, InfoIcon, MapPinIcon, MinusIcon, PlusIcon } from '@/components/icons';

const FORM_ID = 'donation-form';
const OTHER_TEMPERATURE = '__other__';

const pad = (n: number) => String(n).padStart(2, '0');
/** datetime-local value in the browser's local time. */
function localDateTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function inDays(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return localDate(d);
}
/** Default pickup window: tomorrow 08:00–17:00 (editable). */
function defaultWindow() {
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(8, 0, 0, 0);
  const end = new Date(start); end.setHours(17, 0, 0, 0);
  return { overlapStart: localDateTime(start), overlapEnd: localDateTime(end) };
}
const BEST_BEFORE_QUICK = [
  { label: 'in 3 Tagen', days: 3 }, { label: 'in 1 Woche', days: 7 }, { label: 'in 2 Wochen', days: 14 }, { label: 'in 1 Monat', days: 30 },
];

/** How long an offer stays visible to institutions (registration + 4 days). */
function visibleUntil(createdAt: Date) {
  return new Date(new Date(createdAt).getTime() + FRESHNESS_DAYS * 86_400_000);
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line-soft first:border-t-0 px-5 md:px-8 py-7 md:py-8 flex flex-col gap-6 min-w-0">
      <legend className="contents">
        <span className="flex items-center gap-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white font-bold">{n}</span>
          <span className="text-xl md:text-[22px] font-bold text-ink">{title}</span>
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

/** One line summary of an existing open offer. */
function Existing({ d }: { d: OpenDonation }) {
  const now = new Date();
  return (
    <span>
      {fmtPallets(d.numberOfPallets)} à {fmtKg(d.weightPerPallet)}, haltbar bis {fmtDate(d.bestBeforeDate)},
      Abholung ab {fmtDayTime(d.overlapStart, now)} Uhr, sichtbar bis {fmtDayTime(visibleUntil(d.createdAt), now)} Uhr.
    </span>
  );
}

export function DonationForm({ defaultAddress, organizationName, openDonations, prefill }: {
  defaultAddress: string; organizationName: string; openDonations: OpenDonation[]; prefill?: DonationPrefill;
}) {
  const initial = () => ({
    productName: prefill?.productName ?? '',
    category: (prefill?.category ?? '') as Category | '',
    temperatureRange: prefill?.temperatureRange ?? '',
    bestBeforeDate: '',
    pickupAddress: defaultAddress,
    numberOfPallets: String(prefill?.numberOfPallets ?? 1),
    weightPerPallet: prefill ? String(prefill.weightPerPallet) : '',
    ...defaultWindow(),
  });
  // Rendered client-side only (see DonationFormLoader), so browser-local defaults are safe here.
  const [form, setForm] = useState(initial);
  const [customTemperature, setCustomTemperature] = useState(() => Boolean(prefill && !isTemperaturePreset(prefill.temperatureRange)));
  const [editAddress, setEditAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<OpenDonation | null>(null);
  const [confirmMatch, setConfirmMatch] = useState<OpenDonation | null>(null);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  type Key = keyof ReturnType<typeof initial>;
  const setValue = (key: Key, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const set = (key: Key) => (e: { target: { value: string } }) => setValue(key, e.target.value);
  const reset = () => {
    setForm({ ...initial(), productName: '', category: '', temperatureRange: '', numberOfPallets: '1', weightPerPallet: '' });
    setCustomTemperature(false); setEditAddress(false); setDone(null); setError(null);
  };
  const scrollUp = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /** An own open offer for the same product, if any. */
  const match = useMemo(() => {
    const key = normalizeProductName(form.productName);
    if (!key) return null;
    return openDonations.find((d) => normalizeProductName(d.productName) === key) ?? null;
  }, [form.productName, openDonations]);
  const suggestion = mergeTarget || !match || dismissed.includes(match.id) ? null : match;

  const pallets = Number(form.numberOfPallets) || 0;
  const perPallet = Number(form.weightPerPallet) || 0;
  const stepPallets = (delta: number) => setValue('numberOfPallets', String(Math.min(MAX_PALLETS, Math.max(1, pallets + delta))));
  /** The entered weight differs from the existing offer: merging would use the existing one. */
  const weightDiffers = (target: OpenDonation) => perPallet > 0 && perPallet !== target.weightPerPallet;

  const doMerge = (target: OpenDonation, count: number) => {
    setError(null);
    startTransition(async () => {
      const result = await addPallets(target.id, count);
      if (result.ok) {
        const d = result.data!;
        setMergeTarget(null);
        setDone(`${fmtPallets(count)} zu «${d.productName}» hinzugefügt. Das Angebot umfasst jetzt ${fmtPallets(d.numberOfPallets)} (${fmtKg(d.totalWeightKg)}).`);
      } else {
        setError(result.error);
      }
      scrollUp();
    });
  };

  const createNew = () => {
    const input: DonationInput = {
      productName: form.productName,
      category: form.category as Category,
      temperatureRange: form.temperatureRange,
      bestBeforeDate: form.bestBeforeDate,
      pickupAddress: form.pickupAddress,
      numberOfPallets: pallets,
      weightPerPallet: perPallet,
      overlapStart: new Date(form.overlapStart).toISOString(),
      overlapEnd: new Date(form.overlapEnd).toISOString(),
    };
    startTransition(async () => {
      const result = await createDonation(input);
      if (result.ok) setDone(`«${form.productName.trim()}» ist veröffentlicht. Abgabestellen sehen das Angebot jetzt.`);
      else setError(result.error);
      scrollUp();
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mergeTarget) return doMerge(mergeTarget, pallets);
    if (!form.category) { scrollUp(); return setError('Bitte wählen Sie eine Warengruppe.'); }
    if (!form.temperatureRange.trim()) { scrollUp(); return setError('Bitte geben Sie an, wie die Ware gelagert werden muss.'); }
    if (form.overlapEnd <= form.overlapStart) { scrollUp(); return setError('Das Ende der Abholzeit muss nach dem Beginn liegen.'); }
    // Same product already open: ask before creating a second offer.
    if (suggestion) return setConfirmMatch(suggestion);
    createNew();
  };

  // ---------------------------------------------------------------- done
  if (done) {
    return (
      <div ref={topRef} className="scroll-mt-24 bg-white border border-line rounded-2xl px-6 py-12 md:py-16 flex flex-col items-center text-center gap-4 max-w-2xl">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"><CheckIcon className="size-7" /></span>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-ink">Vielen Dank!</h2>
        <p className="text-lg text-ink-2 max-w-md" role="status">{done}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href="/donor" className={btn('primary')}>Zur Übersicht</Link>
          <button type="button" className={btn('ghost')} onClick={reset}>Weiteres Angebot melden</button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------- add to an existing offer
  if (mergeTarget) {
    const total = mergeTarget.numberOfPallets + pallets;
    return (
      <div ref={topRef} className="scroll-mt-24 max-w-2xl space-y-4">
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        <form onSubmit={submit} className="bg-white border border-line rounded-2xl p-5 md:p-8 flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-xl md:text-[22px] font-bold text-ink">Paletten zu «{mergeTarget.productName}» hinzufügen</h2>
            <p className="text-base text-muted"><Existing d={mergeTarget} /></p>
          </div>
          <Field label="Wie viele Paletten kommen dazu?"
            hint={`Sie werden mit ${fmtKg(mergeTarget.weightPerPallet)} pro Palette und der bestehenden Abholzeit übernommen.`}>
            <input type="number" inputMode="numeric" min={1} max={MAX_PALLETS} step={1} className={`${inputCls} max-w-40`}
              value={form.numberOfPallets} onChange={set('numberOfPallets')} required autoFocus />
          </Field>
          {pallets > 0 && (
            <p className="rounded-xl bg-sand px-4 py-3 text-base text-ink-2">
              Danach: <b className="text-ink">{fmtPallets(total)} · {fmtKg(total * mergeTarget.weightPerPallet)}</b>
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button className={btn('primary')} disabled={pending}>{pending ? 'Wird gespeichert…' : 'Paletten hinzufügen'}</button>
            <button type="button" className={btn('ghost')} disabled={pending}
              onClick={() => { setMergeTarget(null); setDismissed((d) => [...d, mergeTarget.id]); }}>
              Doch als neues Angebot melden
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ------------------------------------------------------ register a new offer
  const bestBefore = form.bestBeforeDate ? fmtBestBefore(form.bestBeforeDate, new Date()) : null;
  const start = form.overlapStart ? new Date(form.overlapStart) : null;
  const end = form.overlapEnd ? new Date(form.overlapEnd) : null;
  const sameDay = start && end && start.toDateString() === end.toDateString();

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-5">
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 lg:gap-8 items-start">
        <form id={FORM_ID} onSubmit={submit} className="@container bg-white border border-line rounded-2xl flex flex-col min-w-0">
          <Step n={1} title="Was möchten Sie spenden?">
            <Field label="Produkt">
              <input className={inputCls} value={form.productName} onChange={set('productName')} required maxLength={120}
                placeholder="z. B. Äpfel Gala" autoComplete="off" enterKeyHint="next" />
            </Field>

            {suggestion && (
              <div className="rounded-xl bg-[#fdf1e3] px-4 md:px-5 py-4 flex gap-3.5">
                <InfoIcon className="size-6 shrink-0 text-[#b45309]" />
                <div className="flex flex-col gap-3 min-w-0">
                  <p className="text-base leading-relaxed text-[#3f2a0c]">
                    <b>Sie haben «{suggestion.productName}» bereits offen:</b> <Existing d={suggestion} /> Sollen die neuen Paletten dort dazukommen?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btn('dark', 'sm')} onClick={() => setMergeTarget(suggestion)}>Zum bestehenden Angebot hinzufügen</button>
                    <button type="button" className={`${btn('ghost', 'sm')} bg-transparent border-[#d6b98f]`} onClick={() => setDismissed((d) => [...d, suggestion.id])}>
                      Als neues Angebot melden
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Warengruppe">
              <span className="text-base font-semibold text-ink">Warengruppe</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES_OPTIONS.map((c) => (
                  <label key={c.value} className={`${chipCls(form.category === c.value)} cursor-pointer has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-700/25`}>
                    <input type="radio" name="category" value={c.value} checked={form.category === c.value}
                      onChange={set('category')} className="sr-only" />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
              <Field label="Wie muss es gelagert werden?">
                <select className={inputCls} required
                  value={customTemperature ? OTHER_TEMPERATURE : form.temperatureRange}
                  onChange={(e) => {
                    const other = e.target.value === OTHER_TEMPERATURE;
                    setCustomTemperature(other);
                    setValue('temperatureRange', other ? '' : e.target.value);
                  }}>
                  <option value="" disabled>Bitte wählen…</option>
                  {TEMPERATURES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  <option value={OTHER_TEMPERATURE}>Andere Temperatur eingeben…</option>
                </select>
              </Field>
              {customTemperature && (
                <Field label="Ihre Temperaturangabe" hint="Zum Beispiel «+12 bis +15 °C» oder «trocken, unter +20 °C».">
                  <input className={inputCls} value={form.temperatureRange} onChange={set('temperatureRange')} required autoFocus
                    maxLength={MAX_TEMPERATURE_LENGTH} placeholder="z. B. +12 bis +15 °C" />
                </Field>
              )}
            </div>
          </Step>

          <Step n={2} title="Wie viel ist es?">
            <div className="flex flex-wrap items-end gap-4 md:gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="pallets" className="text-base font-semibold text-ink">Anzahl Paletten</label>
                <div className="flex items-center h-12 rounded-xl border border-control overflow-hidden bg-white">
                  <button type="button" aria-label="Eine Palette weniger" onClick={() => stepPallets(-1)} disabled={pallets <= 1}
                    className="flex size-12 items-center justify-center bg-sand text-ink hover:bg-line-soft disabled:opacity-40">
                    <MinusIcon className="size-5" />
                  </button>
                  <input id="pallets" type="number" inputMode="numeric" min={1} max={MAX_PALLETS} step={1} required
                    value={form.numberOfPallets} onChange={set('numberOfPallets')}
                    className="w-16 h-full text-center text-lg font-bold text-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" aria-label="Eine Palette mehr" onClick={() => stepPallets(1)} disabled={pallets >= MAX_PALLETS}
                    className="flex size-12 items-center justify-center bg-sand text-ink hover:bg-line-soft disabled:opacity-40">
                    <PlusIcon className="size-5" />
                  </button>
                </div>
              </div>
              <Field label="Gewicht pro Palette" className="w-44">
                <span className="relative">
                  <input type="number" inputMode="decimal" min={0.1} max={MAX_WEIGHT_PER_PALLET} step={0.1} required
                    className={`${inputCls} pr-12`} value={form.weightPerPallet} onChange={set('weightPerPallet')} placeholder="z. B. 250" />
                  <span className="pointer-events-none absolute right-4 top-3 text-base text-muted">kg</span>
                </span>
              </Field>
              <div className="h-12 flex items-center rounded-xl bg-sand px-5 text-[17px] text-ink-2" aria-live="polite">
                Total&nbsp;<b className="text-ink">{fmtKg(pallets * perPallet)}</b>
              </div>
            </div>
          </Step>

          <Step n={3} title="Haltbarkeit und Abholung">
            <div className="flex flex-col gap-3">
              <label htmlFor="best-before" className="text-base font-semibold text-ink">Mindestens haltbar bis</label>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-full @md:w-56">
                  <input id="best-before" type="date" className={inputCls} value={form.bestBeforeDate} onChange={set('bestBeforeDate')}
                    min={inDays(0)} required />
                </span>
                <span className="text-[15px] text-muted px-1">oder schnell wählen:</span>
                {BEST_BEFORE_QUICK.map((q) => (
                  <button key={q.days} type="button" onClick={() => setValue('bestBeforeDate', inDays(q.days))}
                    className={`${chipCls(form.bestBeforeDate === inDays(q.days))} h-10`}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
              <Field label="Abholung möglich ab">
                <input type="datetime-local" className={inputCls} value={form.overlapStart} onChange={set('overlapStart')} required />
              </Field>
              <Field label="bis">
                <input type="datetime-local" className={inputCls} value={form.overlapEnd} onChange={set('overlapEnd')} required />
              </Field>
            </div>

            {editAddress ? (
              <Field label="Abholadresse">
                <input className={inputCls} value={form.pickupAddress} onChange={set('pickupAddress')} required maxLength={200} autoFocus />
              </Field>
            ) : (
              <div className="flex items-center gap-3.5 rounded-xl bg-sand px-4 md:px-5 py-4">
                <MapPinIcon className="size-6 shrink-0 text-muted" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm text-muted">Abholadresse</span>
                  <span className="text-base font-semibold text-ink">{form.pickupAddress || '–'}</span>
                </div>
                <button type="button" className={`${linkCls} px-2 py-2`} onClick={() => setEditAddress(true)}>Ändern</button>
              </div>
            )}
          </Step>
        </form>

        <aside className="lg:sticky lg:top-28 flex flex-col gap-4">
          <span className="text-base font-semibold text-muted">So sehen Abgabestellen Ihr Angebot</span>
          <div className="bg-white border border-line rounded-2xl p-6 flex flex-col gap-3.5" aria-live="polite">
            <div className="flex flex-wrap gap-2">
              {form.category ? <Pill>{categoryLabel(form.category)}</Pill> : <Pill>Warengruppe</Pill>}
              {form.temperatureRange.trim() ? <TempPill value={form.temperatureRange.trim()} /> : <Pill>Lagerung</Pill>}
            </div>
            <span className={`text-[21px] font-bold ${form.productName.trim() ? 'text-ink' : 'text-subtle'}`}>
              {form.productName.trim() || 'Produktname'}
            </span>
            <span className="text-[15px] text-muted">{organizationName}</span>
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[32px] font-bold text-ink tabular-nums">{fmtKg(pallets * perPallet)}</span>
              <span className="text-base text-muted">{fmtPallets(pallets)}</span>
            </div>
            <div className="flex flex-col gap-1.5 text-[15px] text-ink-2">
              {start && end && (
                <span>Abholung {fmtDayTime(start, new Date())}–{sameDay ? fmtTime(end) : fmtDayTime(end, new Date())} Uhr</span>
              )}
              {bestBefore && <span className={bestBefore.urgent ? 'font-semibold text-[#9a4a0a]' : ''}>{bestBefore.text}</span>}
            </div>
          </div>
          <button form={FORM_ID} className={`${btn('primary', 'lg')} w-full`} disabled={pending}>
            {pending ? 'Wird veröffentlicht…' : 'Angebot veröffentlichen'}
          </button>
          <p className="text-[15px] text-muted text-center">Sie können das Angebot jederzeit zurückziehen, solange es niemand reserviert hat.</p>
        </aside>
      </div>

      {confirmMatch && (
        <div className="fixed inset-0 z-30 bg-ink/50 flex items-end md:items-center justify-center p-0 md:p-6"
          role="dialog" aria-modal="true" aria-labelledby="dup-title">
          <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-xl p-6 md:p-7 flex flex-col gap-4">
            <h2 id="dup-title" className="text-xl font-bold text-ink">«{confirmMatch.productName}» ist schon offen</h2>
            <p className="text-base text-ink-2 leading-relaxed">
              Sollen die {fmtPallets(pallets)} zum bestehenden Angebot dazukommen? Aktuell: <Existing d={confirmMatch} />
            </p>
            {weightDiffers(confirmMatch) && (
              <p className="rounded-xl bg-[#fdf1e3] text-[#3f2a0c] px-4 py-3 text-[15px]">
                Sie haben {fmtKg(perPallet)} pro Palette angegeben, das bestehende Angebot hat {fmtKg(confirmMatch.weightPerPallet)}.
                Beim Hinzufügen gilt das bestehende Gewicht. Bei anderem Gewicht bitte als neues Angebot melden.
              </p>
            )}
            <div className="flex flex-col gap-2.5 pt-1">
              <button type="button" className={btn('primary')} disabled={pending}
                onClick={() => { const t = confirmMatch; setConfirmMatch(null); doMerge(t, pallets); }}>
                Zum bestehenden Angebot hinzufügen
              </button>
              <button type="button" className={btn('ghost')} disabled={pending}
                onClick={() => { setDismissed((d) => [...d, confirmMatch.id]); setConfirmMatch(null); createNew(); }}>
                Als neues Angebot melden
              </button>
              <button type="button" className={btn('quiet')} disabled={pending} onClick={() => setConfirmMatch(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
