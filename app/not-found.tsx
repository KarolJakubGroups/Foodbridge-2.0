import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { btn } from '@/components/ui';
import { MapPinIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Seite nicht gefunden · FoodBridge' };

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-line">
        <div className="max-w-[1440px] mx-auto h-16 lg:h-[72px] px-4 md:px-8 xl:px-16 flex items-center">
          <Link href="/" className="rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/25"><Logo /></Link>
        </div>
      </header>
      <main className="w-full max-w-xl mx-auto px-4 py-10 md:py-16">
        <div className="bg-white border border-line rounded-2xl p-6 md:p-8 flex flex-col gap-5">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-sand text-subtle"><MapPinIcon className="size-7" /></span>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted">Fehler 404</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-ink">Seite nicht gefunden</h1>
            <p className="text-base leading-relaxed text-ink-2">
              Diese Adresse gibt es nicht oder nicht mehr. Vielleicht ist der Link veraltet oder falsch abgetippt.
            </p>
          </div>
          <Link href="/" className={`${btn('primary')} self-start`}>Zur Startseite</Link>
        </div>
      </main>
    </div>
  );
}
