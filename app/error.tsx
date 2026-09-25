'use client';

import { Logo } from '@/components/Logo';
import { ErrorView } from '@/components/ErrorView';

/** Errors in the signed-in shell itself (for example the session lookup when the database is down). */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-line">
        <div className="max-w-[1440px] mx-auto h-16 lg:h-[72px] px-4 md:px-8 xl:px-16 flex items-center"><Logo /></div>
      </header>
      <main className="w-full px-4"><ErrorView error={error} retry={retry} /></main>
    </div>
  );
}
