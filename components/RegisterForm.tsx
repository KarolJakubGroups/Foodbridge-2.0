'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { register } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';
import { MIN_PASSWORD_LENGTH } from '@/lib/domain';
import { Alert, Field, btn, inputCls, linkCls } from '@/components/ui';

const optional = <span className="font-normal text-muted">(freiwillig)</span>;

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(register, null);
  return (
    <>
      <form action={formAction} className="flex flex-col gap-5">
        {state && !state.ok && <Alert>{state.error}</Alert>}
        <Field label="Unternehmen oder Filiale">
          <input name="organizationName" className={inputCls} required maxLength={120} placeholder="z. B. Bäckerei Muster, Filiale Oerlikon" autoComplete="organization" />
        </Field>
        <Field label="Abholadresse" hint="Hier holt der Lastwagen die Spenden ab.">
          <input name="address" className={inputCls} required maxLength={200} placeholder="Strasse Nr., PLZ Ort" autoComplete="street-address" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Kontaktperson">
            <input name="contactName" className={inputCls} required maxLength={80} autoComplete="name" />
          </Field>
          <Field label={<>Telefon {optional}</>}>
            <input name="phone" type="tel" className={inputCls} maxLength={40} autoComplete="tel" inputMode="tel" />
          </Field>
        </div>
        <Field label="E-Mail">
          <input name="email" type="email" className={inputCls} required autoComplete="email" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Passwort" hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}>
            <input name="password" type="password" className={inputCls} required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
          </Field>
          <Field label="Passwort wiederholen">
            <input name="passwordConfirm" type="password" className={inputCls} required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
          </Field>
        </div>
        <button className={`${btn('primary')} w-full`} disabled={pending}>{pending ? 'Wird gesendet…' : 'Registrierung beantragen'}</button>
      </form>
      <div className="border-t border-line-soft pt-5 space-y-2 text-base text-ink-2">
        <p className="text-muted">Die Schweizer Tafel prüft Ihren Antrag. Sobald er freigegeben ist, können Sie Spenden melden.</p>
        <p>Bereits registriert? <Link href="/login" className={linkCls}>Anmelden</Link></p>
      </div>
    </>
  );
}
