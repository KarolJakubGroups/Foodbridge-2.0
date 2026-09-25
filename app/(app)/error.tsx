'use client';

import { ErrorView } from '@/components/ErrorView';

/** Errors inside a page keep the header and navigation visible. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
