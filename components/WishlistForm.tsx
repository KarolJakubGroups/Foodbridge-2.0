'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createWishlist } from '@/lib/actions';
import { Alert, Field, btnPrimary, inputCls } from '@/components/ui';

export function WishlistForm() {
  const [form, setForm] = useState({ productName: '', quantityKg: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createWishlist({ productName: form.productName, quantityKg: Number(form.quantityKg), note: form.note });
      if (result.ok) setForm({ productName: '', quantityKg: '', note: '' });
      else setError(result.error);
    });
  };

  return (
    <>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Produkt *"><input className={inputCls} value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} required maxLength={120} /></Field>
        <Field label="Menge (kg) *"><input type="number" min={1} step={1} className={inputCls} value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} required /></Field>
        <Field label="Hinweis"><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} /></Field>
        <button className={`${btnPrimary} w-full`} disabled={pending}>Bedarf melden</button>
      </form>
    </>
  );
}
