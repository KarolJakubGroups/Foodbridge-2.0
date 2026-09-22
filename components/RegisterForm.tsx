'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { register } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';
import { MIN_PASSWORD_LENGTH } from '@/lib/domain';
import { Alert, Field, btnPrimary, inputCls } from '@/components/ui';

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(register, null);
  return (
    <>
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <form action={formAction} className="space-y-3">
        <Field label="Unternehmen / Filiale *">
          <input name="organizationName" className={inputCls} required maxLength={120} placeholder="z. B. Migros Filiale Oerlikon" autoComplete="organization" />
        </Field>
        <Field label="Abholadresse *">
          <input name="address" className={inputCls} required maxLength={200} placeholder="Strasse Nr., PLZ Ort" autoComplete="street-address" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Kontaktperson *">
            <input name="contactName" className={inputCls} required maxLength={80} autoComplete="name" />
          </Field>
          <Field label="Telefon">
            <input name="phone" type="tel" className={inputCls} maxLength={40} autoComplete="tel" inputMode="tel" />
          </Field>
        </div>
        <Field label="E-Mail *">
          <input name="email" type="email" className={inputCls} required autoComplete="email" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={`Passwort * (min. ${MIN_PASSWORD_LENGTH} Zeichen)`}>
            <input name="password" type="password" className={inputCls} required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
          </Field>
          <Field label="Passwort wiederholen *">
            <input name="passwordConfirm" type="password" className={inputCls} required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
          </Field>
        </div>
        <button className={`${btnPrimary} w-full`} disabled={pending}>{pending ? 'Wird gesendet…' : 'Registrierung beantragen'}</button>
      </form>
      <p className="mt-4 text-xs text-slate-500">
        Nach der Registrierung prüft die Schweizer Tafel Ihren Antrag. Sobald er freigegeben ist, können Sie Spenden erfassen.
      </p>
      <p className="mt-2 text-xs">
        Bereits registriert? <Link href="/login" className="font-bold underline">Anmelden</Link>
      </p>
    </>
  );
}
