import { Card } from '@/components/ui';
import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex-1">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-baseline gap-2">
          <span className="font-black tracking-wide text-sm">SCHWEIZER TAFEL</span>
          <span className="text-slate-400 text-xs">|</span>
          <span className="text-xs font-bold">FoodBridge 2.0 B2B Portal</span>
        </div>
      </header>
      <main className="max-w-md mx-auto mt-16 px-4">
        <Card title="Anmeldung FoodBridge 2.0" subtitle="B2B-Plattform zur Lebensmittelrettung der Stiftung Schweizer Tafel">
          <LoginForm />
          <p className="mt-4 pt-4 border-t border-slate-200 text-xs">
            Neu als Unternehmen? <Link href="/register" className="font-bold underline">Als Spender registrieren</Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
