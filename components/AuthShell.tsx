import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

/** Frame for the signed-out pages: logo, one centred card. */
export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-line">
        <div className="max-w-[1440px] mx-auto h-16 lg:h-[72px] px-4 md:px-8 xl:px-16 flex items-center"><Logo /></div>
      </header>
      <main className={`w-full mx-auto px-4 py-8 md:py-16 ${wide ? 'max-w-xl' : 'max-w-md'}`}>
        <div className="bg-white border border-line rounded-2xl p-6 md:p-8 flex flex-col gap-6">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
            {subtitle && <p className="text-base text-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
