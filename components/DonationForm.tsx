'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createDonation } from '@/lib/actions';
import type { Category, DonationInput, TemperatureRange } from '@/lib/types';
import { CATEGORIES_OPTIONS, TEMPERATURES } from '@/lib/format';
import { Alert, Field, btnPrimary, inputCls } from '@/components/ui';

const EMPTY = {
  productName: '', category: '' as Category | '', temperatureRange: 'AMBIENT' as TemperatureRange, bestBeforeDate: '', pickupAddress: '',
  numberOfPallets: '', weightPerPallet: '', overlapStart: '', overlapEnd: '',
};

export function DonationForm({ defaultAddress }: { defaultAddress: string }) {
  const [form, setForm] = useState({ ...EMPTY, pickupAddress: defaultAddress });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!form.category) {
      setError('Bitte eine Warengruppe wählen.');
      return;
    }
    if (form.overlapEnd <= form.overlapStart) {
      setError('Das Abholzeitfenster-Ende muss nach dem Beginn liegen.');
      return;
    }
    // datetime-local values are in the browser's timezone; convert to instants here.
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
        setForm({ ...EMPTY, pickupAddress: defaultAddress });
        setSuccess('Angebot freigegeben. Es ist jetzt für Abgabestellen sichtbar.');
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert kind="ok" onClose={() => setSuccess(null)}>{success}</Alert>}
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Produkt *">
          <input className={inputCls} value={form.productName} onChange={set('productName')} required maxLength={120} />
        </Field>
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
        <Field label="MHD (Mindesthaltbarkeit) *">
          <input type="date" className={inputCls} value={form.bestBeforeDate} onChange={set('bestBeforeDate')} required />
        </Field>
        <Field label="Abholadresse *">
          <input className={inputCls} value={form.pickupAddress} onChange={set('pickupAddress')} required maxLength={200} />
        </Field>
        <Field label="Anzahl Paletten *">
          <input type="number" min={1} max={66} step={1} className={inputCls} value={form.numberOfPallets} onChange={set('numberOfPallets')} required />
        </Field>
        <Field label="Gewicht / Palette (kg) *">
          <input type="number" min={0.1} max={1500} step={0.1} className={inputCls} value={form.weightPerPallet} onChange={set('weightPerPallet')} required />
        </Field>
        <div className="col-span-2">
          <Field label="Abholzeitfenster Beginn *">
            <input type="datetime-local" className={inputCls} value={form.overlapStart} onChange={set('overlapStart')} required />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Abholzeitfenster Ende *">
            <input type="datetime-local" className={inputCls} value={form.overlapEnd} onChange={set('overlapEnd')} required />
          </Field>
        </div>
        <div className="col-span-2">
          <button className={`${btnPrimary} w-full`} disabled={pending}>{pending ? 'Wird gespeichert…' : 'Angebot freigeben'}</button>
        </div>
      </form>
    </>
  );
}
