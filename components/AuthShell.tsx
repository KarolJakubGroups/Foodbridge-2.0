import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

const PHOTOS = ['/images/food/bread.webp', '/images/food/oranges.webp', '/images/food/frozen.webp', '/images/food/apples.webp'];

/** Frame for the signed-out pages: a photo panel on large screens, the form card next to it. */
export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] min-h-dvh">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 opacity-90">
          {PHOTOS.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="size-full object-cover" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/20" />
        <div className="relative"><span className="inline-flex rounded-2xl bg-white px-3 py-2"><Logo /></span></div>
        <div className="relative max-w-md space-y-3">
          <p className="text-4xl font-bold leading-tight tracking-[-0.02em]">Überschuss wird zu vollen Einkaufstaschen.</p>
          <p className="text-lg text-white/85">Spender, Abgabestellen und Galliker auf einer Plattform – für die Stiftung Schweizer Tafel.</p>
        </div>
      </aside>
      <div className="flex flex-col">
        <header className="lg:hidden bg-white border-b border-line">
          <div className="h-16 px-4 flex items-center"><Logo /></div>
        </header>
        <main className={`w-full mx-auto my-auto px-4 py-8 md:py-16 ${wide ? 'max-w-xl' : 'max-w-md'}`}>
          <div className="bg-white rounded-3xl shadow-card p-6 md:p-8 flex flex-col gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
              {subtitle && <p className="text-base text-muted">{subtitle}</p>}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
