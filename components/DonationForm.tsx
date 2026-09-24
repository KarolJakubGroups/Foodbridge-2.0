'use client';

import { useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { addPallets, createDonation } from '@/lib/actions';
import type { Category, DonationInput, OpenDonation, TemperatureRange } from '@/lib/types';
import { CATEGORIES_OPTIONS, TEMPERATURES, categoryLabel, fmtDate, fmtDateTime, fmtKg, tempLabel } from '@/lib/format';
import { FRESHNESS_DAYS, normalizeProductName, weightKg } from '@/lib/domain';
import { Alert, Field, btnDark, btnGhost, btnPrimary, inputCls } from '@/components/ui';

const EMPTY = {
  productName: '', category: '' as Category | '', temperatureRange: 'AMBIENT' as TemperatureRange, bestBeforeDate: '', pickupAddress: '',
  numberOfPallets: '1', weightPerPallet: '', overlapStart: '', overlapEnd: '',
};

const pad = (n: number) => String(n).padStart(2, '0');
/** datetime-local value in the browser's local time. */
function localDateTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Default pickup window: tomorrow 08:00–17:00 (editable). */
function defaultWindow() {
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(8, 0, 0, 0);
  const end = new Date(start); end.setHours(17, 0, 0, 0);
  return { overlapStart: localDateTime(start), overlapEnd: localDateTime(end) };
}
const MHD_QUICK = [{ label: '+3 Tage', days: 3 }, { label: '+7 Tage', days: 7 }, { label: '+14 Tage', days: 14 }, { label: '+30 Tage', days: 30 }];

/** How long an offer stays visible to institutions (registration + 4 days). */
function visibleUntil(createdAt: Date) {
  return new Date(new Date(createdAt).getTime() + FRESHNESS_DAYS * 86_400_000);
}

function Summary({ d }: { d: OpenDonation }) {
  return (
    <div className="text-xs space-y-0.5">
      <div className="font-bold text-sm">{d.productName}</div>
      <div className="text-slate-600">{categoryLabel(d.category)} · {tempLabel(d.temperatureRange)} · MHD {fmtDate(d.bestBeforeDate)}</div>
      <div className="font-mono">Bestand: {d.numberOfPallets} Pal à {d.weightPerPallet} kg = {fmtKg(weightKg(d))}</div>
      <div className="font-mono text-slate-600">Abholung {fmtDateTime(d.overlapStart)} – {fmtDateTime(d.overlapEnd)}</div>
      <div className="font-mono text-slate-500">Sichtbar bis {fmtDateTime(visibleUntil(d.createdAt))}</div>
    </div>
  );
}

export function DonationForm({ defaultAddress, openDonations }: { defaultAddress: string; openDonations: OpenDonation[] }) {
  // Rendered client-side only (see DonationFormLoader), so browser-local defaults are safe here.
  const [form, setForm] = useState(() => ({ ...EMPTY, pickupAddress: defaultAddress, ...defaultWindow() }));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<OpenDonation | null>(null);
  const [confirmMatch, setConfirmMatch] = useState<OpenDonation | null>(null);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const setMhd = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    setForm((f) => ({ ...f, bestBeforeDate: localDate(d) }));
  };
  const reset = () => setForm({ ...EMPTY, pickupAddress: defaultAddress, ...defaultWindow() });
  const scrollUp = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /** An own open offer for the same product, if any. */
  const match = useMemo(() => {
    const key = normalizeProductName(form.productName);
    if (!key) return null;
    return openDonations.find((d) => normalizeProductName(d.productName) === key) ?? null;
  }, [form.productName, openDonations]);
  const suggestion = mergeTarget || !match || dismissed.includes(match.id) ? null : match;

  const palletsToAdd = Number(form.numberOfPallets);
  /** The entered weight differs from the existing offer: merging would use the existing one. */
  const weightDiffers = (target: OpenDonation) =>
    Boolean(form.weightPerPallet) && Number(form.weightPerPallet) !== target.weightPerPallet;

  const doMerge = (target: OpenDonation, pallets: number) => {
    setError(null); setSuccess(null);
    startTransition(async () => {
      const result = await addPallets(target.id, pallets);
      if (result.ok) {
        const d = result.data!;
        setMergeTarget(null);
        reset();
        setSuccess(`${pallets} Palette(n) zu „${d.productName}“ hinzugefügt. Neuer Bestand: ${d.numberOfPallets} Paletten (${fmtKg(d.totalWeightKg)}).`);
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
      numberOfPallets: palletsToAdd,
      weightPerPallet: Number(form.weightPerPallet),
      overlapStart: new Date(form.overlapStart).toISOString(),
      overlapEnd: new Date(form.overlapEnd).toISOString(),
    };
    startTransition(async () => {
      const result = await createDonation(input);
      if (result.ok) {
        reset();
        setSuccess('Angebot freigegeben. Es ist jetzt für Abgabestellen sichtbar.');
      } else {
        setError(result.error);
      }
      scrollUp();
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (mergeTarget) return doMerge(mergeTarget, palletsToAdd);
    if (!form.category) return setError('Bitte eine Warengruppe wählen.');
    if (form.overlapEnd <= form.overlapStart) return setError('Das Abholzeitfenster-Ende muss nach dem Beginn liegen.');
    // Same product already open: ask before creating a second offer.
    if (suggestion) return setConfirmMatch(suggestion);
    createNew();
  };

  // ------------------------------------------------- add to an existing offer
  if (mergeTarget) {
    const total = mergeTarget.numberOfPallets + (palletsToAdd || 0);
    return (
      <div ref={topRef} className="scroll-mt-20">
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        <form onSubmit={submit} className="space-y-3">
          <div className="border border-emerald-300 bg-emerald-50 rounded-md p-3">
            <p className="text-[11px] font-bold text-emerald-900 mb-1.5 uppercase tracking-wide">Bestehendes Angebot ergänzen</p>
            <Summary d={mergeTarget} />
          </div>
          <Field label="Zusätzliche Paletten *">
            <input type="number" inputMode="numeric" min={1} max={66} step={1} className={inputCls}
              value={form.numberOfPallets} onChange={set('numberOfPallets')} required autoFocus />
          </Field>
          <p className="text-[11px] text-slate-500">
            Die Paletten werden mit {mergeTarget.weightPerPallet} kg und dem bestehenden Abholfenster übernommen.
            Für ein anderes Gewicht oder Zeitfenster bitte ein separates Angebot erfassen.
          </p>
          {palletsToAdd > 0 && (
            <p className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
              Neuer Bestand: {total} Paletten · {fmtKg(total * mergeTarget.weightPerPallet)}
            </p>
          )}
          <button className={`${btnPrimary} w-full`} disabled={pending}>
            {pending ? 'Wird gespeichert…' : 'Paletten hinzufügen'}
          </button>
          <button type="button" className={`${btnGhost} w-full`} disabled={pending}
            onClick={() => { setMergeTarget(null); setDismissed((d) => [...d, mergeTarget.id]); }}>
            Stattdessen neues Angebot erfassen
          </button>
        </form>
      </div>
    );
  }

  // ------------------------------------------------------ register a new offer
  return (
    <div ref={topRef} className="scroll-mt-20">
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert kind="ok" onClose={() => setSuccess(null)}>{success}</Alert>}
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Field label="Produkt *">
            <input className={inputCls} value={form.productName} onChange={set('productName')} required maxLength={120}
              placeholder="z. B. Äpfel Gala" autoComplete="off" enterKeyHint="next" />
          </Field>
        </div>

        {suggestion && (
          <div className="sm:col-span-2 border border-amber-300 bg-amber-50 rounded-md p-3">
            <p className="text-xs text-amber-900 font-bold mb-1.5">
              Sie haben „{suggestion.productName}“ bereits offen.
            </p>
            <Summary d={suggestion} />
            <div className="flex flex-wrap gap-2 mt-2.5">
              <button type="button" className={btnDark} onClick={() => setMergeTarget(suggestion)}>Paletten hinzufügen</button>
              <button type="button" className={btnGhost} onClick={() => setDismissed((d) => [...d, suggestion.id])}>Separat erfassen</button>
            </div>
          </div>
        )}

        <Field label="Warengruppe *">
          <select className={inputCls} value={form.category} onChange={set('category')} required>
            <option value="" disabled>Bitte wählen…</option>
            {CATEGORIES_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Temperatur *">
          <select className={inputCls} value={form.temperatureRange} onChange={set('temperatureRange')} required>
            {TEMPERATURES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="MHD (Mindesthaltbarkeit) *">
            <input type="date" className={inputCls} value={form.bestBeforeDate} onChange={set('bestBeforeDate')} required />
          </Field>
          <div className="flex flex-wrap gap-2 mt-2">
            {MHD_QUICK.map((q) => (
              <button key={q.days} type="button" onClick={() => setMhd(q.days)}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100">
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Anzahl Paletten *">
          <input type="number" inputMode="numeric" min={1} max={66} step={1} className={inputCls} value={form.numberOfPallets} onChange={set('numberOfPallets')} required />
        </Field>
        <Field label="Gewicht pro Palette (kg) *">
          <input type="number" inputMode="decimal" min={0.1} max={1500} step={0.1} className={inputCls} value={form.weightPerPallet} onChange={set('weightPerPallet')} required placeholder="z. B. 250" />
        </Field>
        <Field label="Abholzeitfenster Beginn *">
          <input type="datetime-local" className={inputCls} value={form.overlapStart} onChange={set('overlapStart')} required />
        </Field>
        <Field label="Abholzeitfenster Ende *">
          <input type="datetime-local" className={inputCls} value={form.overlapEnd} onChange={set('overlapEnd')} required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Abholadresse *">
            <input className={inputCls} value={form.pickupAddress} onChange={set('pickupAddress')} required maxLength={200} />
          </Field>
        </div>
        <div className="sm:col-span-2 pt-1">
          <button className={`${btnPrimary} w-full`} disabled={pending}>{pending ? 'Wird gespeichert…' : 'Angebot freigeben'}</button>
        </div>
      </form>

      {confirmMatch && (
        <div className="fixed inset-0 z-30 bg-slate-900/60 flex items-end md:items-center justify-center p-0 md:p-6"
          role="dialog" aria-modal="true" aria-labelledby="dup-title">
          <div className="bg-white w-full md:max-w-md rounded-t-xl md:rounded-md shadow-xl p-4 md:p-5 space-y-3">
            <h2 id="dup-title" className="text-sm font-bold text-slate-900">Angebot bereits vorhanden</h2>
            <p className="text-xs text-slate-600">
              Sie haben „{confirmMatch.productName}“ schon offen. Sollen die {palletsToAdd} neuen Palette(n) dazugerechnet werden?
            </p>
            <div className="border border-slate-200 rounded-md p-3 bg-slate-50"><Summary d={confirmMatch} /></div>
            {weightDiffers(confirmMatch) && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Sie haben {form.weightPerPallet} kg pro Palette erfasst, das bestehende Angebot führt {confirmMatch.weightPerPallet} kg.
                Beim Hinzufügen gilt das bestehende Gewicht. Bei abweichendem Gewicht bitte separat erfassen.
              </p>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button type="button" className={btnPrimary} disabled={pending}
                onClick={() => { const t = confirmMatch; setConfirmMatch(null); doMerge(t, palletsToAdd); }}>
                Zum bestehenden Angebot hinzufügen
              </button>
              <button type="button" className={btnGhost} disabled={pending}
                onClick={() => { setDismissed((d) => [...d, confirmMatch.id]); setConfirmMatch(null); createNew(); }}>
                Als separates Angebot erfassen
              </button>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => setConfirmMatch(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
