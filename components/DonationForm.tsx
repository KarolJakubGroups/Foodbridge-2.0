'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { addPallets, createDonation } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import type { Category, DonationInput, PalletMaterial, DonationPrefill, OpenDonation } from '@/lib/types';
import {
  CATEGORIES_OPTIONS, PALLET_MATERIAL_OPTIONS, TEMPERATURES, palletMaterialLabel, categoryLabel, fmtBestBefore, fmtDate, fmtDayTime, fmtKg, fmtPalletLoad, fmtPallets, fmtTime, isTemperaturePreset,
} from '@/lib/format';
import { FRESHNESS_DAYS, MAX_PACKAGING_UNIT_LENGTH, MAX_TEMPERATURE_LENGTH, normalizeProductName, palletWeightsProblem, totalWeightKg } from '@/lib/domain';
import { Alert, Field, FoodPhoto, PhotoPill, TempPill, btn, chipCls, inputCls, linkCls } from '@/components/ui';
import { CheckIcon, InfoIcon, MapPinIcon } from '@/components/icons';
import { DatePicker, DateTimePicker, Select } from '@/components/pickers';
import {
  PalletWeightsInput, initialPalletWeights, palletWeightValues, type PalletWeightsState,
} from '@/components/PalletWeightsInput';

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
      {fmtPalletLoad(d.palletWeights)}, haltbar bis {fmtDate(d.bestBeforeDate)},
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
    packagingUnit: prefill?.packagingUnit ?? '',
    // Most donations come on Euro pallets; preselected to save a tap.
    palletMaterial: (prefill?.palletMaterial ?? 'EURO') as PalletMaterial,
    bestBeforeDate: '',
    pickupAddress: defaultAddress,
    ...defaultWindow(),
  });
  // Rendered client-side only (see DonationFormLoader), so browser-local defaults are safe here.
  const [form, setForm] = useState(initial);
  const [palletState, setPalletState] = useState<PalletWeightsState>(() => initialPalletWeights(prefill?.palletWeights));
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
    setForm({ ...initial(), productName: '', category: '', temperatureRange: '', packagingUnit: '' });
    setPalletState(initialPalletWeights());
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

  const palletWeights = palletWeightValues(palletState);
  const pallets = palletWeights.length;
  const totalKg = totalWeightKg({ palletWeights });
  /** Checked before sending, so the donor sees which pallet lacks a weight. */
  const weightProblem = () => {
    const problem = palletWeightsProblem(palletWeights);
    if (problem) { setError(problem); scrollUp(); }
    return problem !== null;
  };

  const doMerge = (target: OpenDonation, weights: number[]) => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => addPallets(target.id, weights));
      if (result.ok) {
        const d = result.data!;
        setMergeTarget(null);
        setDone(`${fmtPallets(weights.length)} zu «${d.productName}» hinzugefügt. Das Angebot umfasst jetzt ${fmtPallets(d.numberOfPallets)} (${fmtKg(d.totalWeightKg)}).`);
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
      packagingUnit: form.packagingUnit,
      palletMaterial: form.palletMaterial,
      bestBeforeDate: form.bestBeforeDate,
      pickupAddress: form.pickupAddress,
      palletWeights,
      overlapStart: new Date(form.overlapStart).toISOString(),
      overlapEnd: new Date(form.overlapEnd).toISOString(),
    };
    startTransition(async () => {
      const result = await callAction(() => createDonation(input));
      if (result.ok) setDone(`«${form.productName.trim()}» ist veröffentlicht. Abgabestellen sehen das Angebot jetzt.`);
      else setError(result.error);
      scrollUp();
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (weightProblem()) return;
    if (mergeTarget) return doMerge(mergeTarget, palletWeights);
    if (!form.category) { scrollUp(); return setError('Bitte wählen Sie eine Warengruppe.'); }
    if (!form.temperatureRange.trim()) { scrollUp(); return setError('Bitte geben Sie an, wie die Ware gelagert werden muss.'); }
    if (!form.bestBeforeDate) { scrollUp(); return setError('Bitte geben Sie an, bis wann die Ware mindestens haltbar ist.'); }
    if (form.overlapEnd <= form.overlapStart) { scrollUp(); return setError('Das Ende der Abholzeit muss nach dem Beginn liegen.'); }
    // Same product already open: ask before creating a second offer.
    if (suggestion) return setConfirmMatch(suggestion);
    createNew();
  };

  // ---------------------------------------------------------------- done
  if (done) {
    return (
      <div ref={topRef} className="scroll-mt-24 bg-white rounded-3xl shadow-card px-6 py-12 md:py-16 flex flex-col items-center text-center gap-4 max-w-2xl">
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
    const totalAfterKg = totalWeightKg(mergeTarget) + totalKg;
    return (
      <div ref={topRef} className="scroll-mt-24 max-w-2xl space-y-4">
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        <form onSubmit={submit} className="bg-white rounded-3xl shadow-card p-5 md:p-8 flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-xl md:text-[22px] font-bold text-ink">Paletten zu «{mergeTarget.productName}» hinzufügen</h2>
            <p className="text-base text-muted"><Existing d={mergeTarget} /></p>
          </div>
          <div className="@container flex flex-col gap-2">
            <PalletWeightsInput value={palletState} onChange={setPalletState} countLabel="Wie viele Paletten kommen dazu?" idPrefix="merge" />
            <span className="text-sm text-muted">Die neuen Paletten übernehmen die bestehende Abholzeit.</span>
          </div>
          {pallets > 0 && (
            <p className="rounded-xl bg-sand px-4 py-3 text-base text-ink-2">
              Danach: <b className="text-ink">{fmtPallets(total)} · {fmtKg(totalAfterKg)}</b>
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
        <form id={FORM_ID} onSubmit={submit} className="@container bg-white rounded-3xl shadow-card flex flex-col min-w-0">
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
                <Select
                  value={customTemperature ? OTHER_TEMPERATURE : form.temperatureRange}
                  options={[...TEMPERATURES, { value: OTHER_TEMPERATURE, label: 'Andere Temperatur eingeben…' }]}
                  onChange={(v) => {
                    const other = v === OTHER_TEMPERATURE;
                    setCustomTemperature(other);
                    setValue('temperatureRange', other ? '' : v);
                  }} />
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
            <PalletWeightsInput value={palletState} onChange={setPalletState} />
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Palettenart">
              <span className="text-base font-semibold text-ink">Palettenart</span>
              <div className="flex flex-wrap gap-2">
                {PALLET_MATERIAL_OPTIONS.map((m) => (
                  <label key={m.value} className={`${chipCls(form.palletMaterial === m.value)} cursor-pointer has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-700/25`}>
                    <input type="radio" name="palletMaterial" value={m.value} checked={form.palletMaterial === m.value}
                      onChange={set('palletMaterial')} className="sr-only" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Verpackungseinheit (optional)" hint="Wie die Ware verpackt ist, z. B. «Karton à 12 × 1 l» oder «Kiste à 10 kg».">
              <input className={inputCls} value={form.packagingUnit} onChange={set('packagingUnit')} maxLength={MAX_PACKAGING_UNIT_LENGTH}
                placeholder="z. B. Karton à 12 × 1 l" autoComplete="off" />
            </Field>
          </Step>

          <Step n={3} title="Haltbarkeit und Abholung">
            <div className="flex flex-col gap-3">
              <label htmlFor="best-before" className="text-base font-semibold text-ink">Mindestens haltbar bis</label>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-full @md:w-56">
                  <DatePicker id="best-before" value={form.bestBeforeDate} onChange={(v) => setValue('bestBeforeDate', v)} min={inDays(0)} />
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
                <DateTimePicker label="Abholung ab" value={form.overlapStart} onChange={(v) => setValue('overlapStart', v)} min={inDays(0)} />
              </Field>
              <Field label="bis">
                <DateTimePicker label="Abholung bis" value={form.overlapEnd} onChange={(v) => setValue('overlapEnd', v)} min={inDays(0)} />
              </Field>
            </div>

            {editAddress ? (
              <Field label="Abholadresse">
                <input className={inputCls} value={form.pickupAddress} onChange={set('pickupAddress')} required maxLength={200} autoFocus />
              </Field>
            ) : (
              <div className="flex items-center gap-3.5 rounded-2xl bg-sand px-4 md:px-5 py-4">
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
          <div className="bg-white rounded-3xl shadow-card overflow-hidden flex flex-col" aria-live="polite">
            <div className="relative h-40">
              <FoodPhoto item={{ productName: form.productName, category: form.category, temperatureRange: form.temperatureRange }} className="absolute inset-0 size-full" />
              <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-1.5">
                {form.temperatureRange.trim() ? <TempPill value={form.temperatureRange.trim()} /> : <PhotoPill>Lagerung</PhotoPill>}
                <PhotoPill>{form.category ? categoryLabel(form.category) : 'Warengruppe'}</PhotoPill>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-3.5">
            <span className={`text-[21px] font-bold ${form.productName.trim() ? 'text-ink' : 'text-subtle'}`}>
              {form.productName.trim() || 'Produktname'}
            </span>
            <span className="text-[15px] text-muted">{organizationName}</span>
            <span className="text-[15px] text-ink-2">
              {[palletMaterialLabel(form.palletMaterial), form.packagingUnit.trim()].filter(Boolean).join(' · ')}
            </span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[32px] font-bold tracking-[-0.02em] text-brand-700 tabular-nums">{fmtKg(totalKg)}</span>
              <span className="text-base text-muted">{fmtPallets(pallets)}</span>
            </div>
            <div className="flex flex-col gap-1.5 text-[15px] text-ink-2">
              {start && end && (
                <span>Abholung {fmtDayTime(start, new Date())}–{sameDay ? fmtTime(end) : fmtDayTime(end, new Date())} Uhr</span>
              )}
              {bestBefore && <span className={bestBefore.urgent ? 'font-semibold text-[#9a4a0a]' : ''}>{bestBefore.text}</span>}
            </div>
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
            <div className="flex flex-col gap-2.5 pt-1">
              <button type="button" className={btn('primary')} disabled={pending}
                onClick={() => { const t = confirmMatch; setConfirmMatch(null); doMerge(t, palletWeights); }}>
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
