'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createWishlist } from '@/lib/actions';
import { Alert, Field, btn, inputCls } from '@/components/ui';

export function WishlistForm() {
  const [form, setForm] = useState({ productName: '', quantityKg: '', note: '' });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createWishlist({ productName: form.productName, quantityKg: Number(form.quantityKg), note: form.note });
      if (result.ok) {
        setMessage({ kind: 'ok', text: `«${form.productName.trim()}» ist jetzt für Spender sichtbar.` });
        setForm({ productName: '', quantityKg: '', note: '' });
      } else {
        setMessage({ kind: 'error', text: result.error });
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {message && <Alert kind={message.kind} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Field label="Was fehlt Ihnen?">
        <input className={inputCls} value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
          required maxLength={120} placeholder="z. B. Frisches Gemüse" />
      </Field>
      <Field label="Wie viel ungefähr?">
        <span className="relative">
          <input type="number" inputMode="numeric" min={1} step={1} className={`${inputCls} pr-12`} value={form.quantityKg}
            onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} required placeholder="z. B. 300" />
          <span className="pointer-events-none absolute right-4 top-3 text-base text-muted">kg</span>
        </span>
      </Field>
      <Field label={<>Hinweis <span className="font-normal text-muted">(freiwillig)</span></>}>
        <input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300}
          placeholder="z. B. am liebsten bis Freitag" />
      </Field>
      <button className={`${btn('primary')} w-full`} disabled={pending}>{pending ? 'Wird gespeichert…' : 'Bedarf melden'}</button>
    </form>
  );
}
