'use client';

import { useActionState, useRef } from 'react';
import { login } from '@/lib/actions';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type ActionResult } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/format';
import { Alert, Field, btn, inputCls } from '@/components/ui';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(login, null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const quickLogin = (email: string) => {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        {state && !state.ok && <Alert>{state.error}</Alert>}
        <Field label="E-Mail">
          <input ref={emailRef} name="email" type="email" className={inputCls} required autoFocus autoComplete="username" />
        </Field>
        <Field label="Passwort">
          <input ref={passwordRef} name="password" type="password" className={inputCls} required autoComplete="current-password" />
        </Field>
        <button className={`${btn('primary')} w-full`} disabled={pending}>{pending ? 'Wird angemeldet…' : 'Anmelden'}</button>
      </form>
      <details className="rounded-xl bg-sand px-4 py-3">
        <summary className="cursor-pointer text-[15px] font-semibold text-ink-2">Demo-Konten (Passwort: {DEMO_PASSWORD})</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.username} type="button" onClick={() => quickLogin(a.email)} disabled={pending}
              className="text-left rounded-lg border border-control bg-white px-3 py-2.5 hover:bg-canvas disabled:opacity-50">
              <div className="text-[15px] font-semibold text-ink">{ROLE_LABEL[a.role]}</div>
              <div className="text-sm text-muted truncate">{a.organizationName}</div>
            </button>
          ))}
        </div>
      </details>
    </>
  );
}
