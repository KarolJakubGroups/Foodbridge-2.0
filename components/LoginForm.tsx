'use client';

import { useActionState, useRef } from 'react';
import { login } from '@/lib/actions';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type ActionResult } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/format';
import { Alert, Field, btnPrimary, inputCls } from '@/components/ui';

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
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <form ref={formRef} action={formAction} className="space-y-3">
        <Field label="E-Mail">
          <input ref={emailRef} name="email" type="email" className={inputCls} required autoFocus autoComplete="username" />
        </Field>
        <Field label="Passwort">
          <input ref={passwordRef} name="password" type="password" className={inputCls} required autoComplete="current-password" />
        </Field>
        <button className={`${btnPrimary} w-full`} disabled={pending}>{pending ? 'Anmelden…' : 'Anmelden'}</button>
      </form>
      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="text-[11px] font-bold text-slate-600 mb-2">Schnellauswahl Demo-Accounts (Passwort: {DEMO_PASSWORD})</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.username} type="button" onClick={() => quickLogin(a.email)} disabled={pending}
              className="text-left border border-slate-300 rounded px-3 py-2 hover:bg-slate-50 disabled:opacity-50">
              <div className="font-mono text-xs font-bold">{a.username}</div>
              <div className="text-[10px] text-slate-500">{ROLE_LABEL[a.role]} · {a.organizationName}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
