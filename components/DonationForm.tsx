'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { createDonation } from '@/lib/actions';
import type { Category, DonationInput, TemperatureRange } from '@/lib/types';
import { CATEGORIES_OPTIONS, TEMPERATURES } from '@/lib/format';
import { Alert, Field, btnPrimary, inputCls } from '@/components/ui';

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

export function DonationForm({ defaultAddress }: { defaultAddress: string }) {
  // Rendered client-side only (see DonationFormLoader), so browser-local defaults are safe here.
  const [form, setForm] = useState(() => ({ ...EMPTY, pickupAddress: defaultAddress, ...defaultWindow() }));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const setMhd = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    setForm((f) => ({ ...f, bestBeforeDate: localDate(d) }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!form.category) return setError('Bitte eine Warengruppe wählen.');
    if (form.overlapEnd <= form.overlapStart) return setError('Das Abholzeitfenster-Ende muss nach dem Beginn liegen.');

    const input: DonationInput = {
      productName: form.productName,
      category: form.category,
      temperatureRange: form.temperatureRange,
      bestBeforeDate: form.bestBeforeDate,
      pickupAddress: form.pickupAddress,
      numberOfPallets: Number(form.numberOfPallets),
      weightPerPallet: Number(form.weightPerPallet),
      overlapStart: new Date(form.overlapStart).toISOString(),
      overlapEnd: new Date(form.overlapEnd).toISOString(),
    };
    startTransition(async () => {
      const result = await createDonation(input);
      if (result.ok) {
        setForm({ ...EMPTY, pickupAddress: defaultAddress, ...defaultWindow() });
        setSuccess('Angebot freigegeben. Es ist jetzt für Abgabestellen sichtbar.');
      } else {
        setError(result.error);
      }
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

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
    </div>
  );
}
