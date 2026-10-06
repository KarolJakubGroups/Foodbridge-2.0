'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DB_UNAVAILABLE_DIGEST } from '@/lib/errors';
import { btn } from '@/components/ui';
import { AlertIcon, DatabaseIcon, RefreshIcon, WifiOffIcon } from '@/components/icons';

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => { window.removeEventListener('online', onChange); window.removeEventListener('offline', onChange); };
}

/** Browser connectivity; assumed online while rendering on the server. */
function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

type Kind = 'database' | 'offline' | 'unexpected';

const COPY: Record<Kind, { title: string; text: string }> = {
  database: {
    title: 'Datenbank nicht erreichbar',
    text: 'Die Daten können gerade nicht geladen werden. Das liegt nicht an Ihnen und es ist nichts verloren gegangen. Bitte versuchen Sie es in einer Minute erneut. Bleibt das Problem, melden Sie sich bei der Schweizer Tafel.',
  },
  offline: {
    title: 'Keine Internetverbindung',
    text: 'Bitte prüfen Sie WLAN oder mobile Daten. Sobald Sie wieder online sind, können Sie es erneut versuchen.',
  },
  unexpected: {
    title: 'Etwas ist schiefgelaufen',
    text: 'Die Seite konnte nicht angezeigt werden. Bitte versuchen Sie es erneut. Bleibt das Problem, nennen Sie der Schweizer Tafel den Fehlercode unten.',
  },
};

const ICON = { database: DatabaseIcon, offline: WifiOffIcon, unexpected: AlertIcon };

export function ErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const online = useOnline();
  useEffect(() => { console.error(error); }, [error]);

  const kind: Kind = error.digest === DB_UNAVAILABLE_DIGEST ? 'database' : !online ? 'offline' : 'unexpected';
  const Icon = ICON[kind];
  const { title, text } = COPY[kind];

  return (
    <div className="max-w-xl mx-auto py-10 md:py-16 px-1" role="alert">
      <div className="bg-white rounded-3xl shadow-card p-6 md:p-8 flex flex-col gap-5">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-[#fdecea] text-[#9b1c14]"><Icon className="size-7" /></span>
        <div className="space-y-2">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-ink">{title}</h1>
          <p className="text-base leading-relaxed text-ink-2">{text}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={() => retry()} className={btn('primary')} disabled={kind === 'offline' && !online}>
            <RefreshIcon className="size-5" />Erneut versuchen
          </button>
          {/* A full page load on purpose: the app shell itself may be what failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={btn('ghost')}>Zur Startseite</a>
        </div>
        {kind === 'unexpected' && error.digest && (
          <p className="text-sm text-muted">Fehlercode: <span className="font-mono">{error.digest}</span></p>
        )}
      </div>
    </div>
  );
}
