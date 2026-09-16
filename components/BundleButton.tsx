'use client';

import { useState, useTransition } from 'react';
import { runBundling } from '@/lib/actions';
import { Alert, btnDark } from '@/components/ui';

export function BundleButton() {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const bundle = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await runBundling();
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const { orders, positions } = result.data!;
      setMessage({
        kind: 'ok',
        text: orders === 0
          ? 'Keine neuen beanspruchten Spenden zur Bündelung vorhanden.'
          : `${positions} Spende(n) zu ${orders} Transportauftrag/-aufträgen für Galliker konsolidiert.`,
      });
    });
  };

  return (
    <div className="w-full flex flex-col items-end gap-2">
      <button type="button" className={btnDark} onClick={bundle} disabled={pending}>
        {pending ? 'Berechne…' : 'Schnittmengenberechnung starten (Bündelung)'}
      </button>
      {message && <div className="w-full"><Alert kind={message.kind} onClose={() => setMessage(null)}>{message.text}</Alert></div>}
    </div>
  );
}
