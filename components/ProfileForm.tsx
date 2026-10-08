'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { updateProfile } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import { MAX_DESCRIPTION_LENGTH } from '@/lib/domain';
import { Alert, Field, btn, inputCls } from '@/components/ui';

const optional = <span className="font-normal text-muted">(freiwillig)</span>;

export function ProfileForm({ initial, withDescription }: {
  initial: { contactName: string | null; phone: string | null; description: string | null };
  /** Institutions describe themselves for donors. */
  withDescription: boolean;
}) {
  const [form, setForm] = useState({
    contactName: initial.contactName ?? '', phone: initial.phone ?? '', description: initial.description ?? '',
  });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await callAction(() => updateProfile(form));
      setMessage(result.ok ? { kind: 'ok', text: 'Gespeichert.' } : { kind: 'error', text: result.error });
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {message && <Alert kind={message.kind} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Kontaktperson">
          <input className={inputCls} value={form.contactName} onChange={set('contactName')} required maxLength={80} autoComplete="name" />
        </Field>
        <Field label={<>Telefon {optional}</>}>
          <input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" inputMode="tel" />
        </Field>
      </div>
      {withDescription && (
        <Field label={<>Wer wir sind {optional}</>}
          hint={`Spender sehen diesen Text bei ihren Spenden. Zum Beispiel, wen Sie unterstützen und wo. ${form.description.length}/${MAX_DESCRIPTION_LENGTH}`}>
          <textarea className={`${inputCls} h-auto min-h-28 py-3 leading-relaxed`} value={form.description} onChange={set('description')}
            maxLength={MAX_DESCRIPTION_LENGTH} rows={4} placeholder="z. B. Wir verteilen Lebensmittel an armutsbetroffene Familien in der Stadt Zürich." />
        </Field>
      )}
      <button className={`${btn('primary')} self-start`} disabled={pending}>{pending ? 'Wird gespeichert…' : 'Speichern'}</button>
    </form>
  );
}
