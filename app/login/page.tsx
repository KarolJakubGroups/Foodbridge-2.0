import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from '@/components/LoginForm';
import { linkCls } from '@/components/ui';

export default function LoginPage() {
  return (
    <AuthShell title="Anmelden" subtitle="Lebensmittel retten mit der Schweizer Tafel.">
      <LoginForm />
      <p className="border-t border-line-soft pt-5 text-base text-ink-2">
        Neu als Unternehmen? <Link href="/register" className={linkCls}>Als Spender registrieren</Link>
      </p>
    </AuthShell>
  );
}
