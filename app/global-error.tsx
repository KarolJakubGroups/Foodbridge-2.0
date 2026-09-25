'use client';

import './globals.css';
import { ErrorView } from '@/components/ErrorView';

/** Last resort when the root layout fails; must render its own document. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="de">
      <body className="min-h-full bg-canvas text-ink">
        <title>Fehler · FoodBridge</title>
        <main className="px-4"><ErrorView error={error} retry={retry} /></main>
      </body>
    </html>
  );
}
