import { Card } from '@/components/ui';
import { RegisterForm } from '@/components/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="flex-1">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-baseline gap-2">
          <span className="font-black tracking-wide text-sm">SCHWEIZER TAFEL</span>
          <span className="text-slate-400 text-xs">|</span>
          <span className="text-xs font-bold">FoodBridge 2.0 B2B Portal</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto mt-6 md:mt-12 px-3 md:px-4 pb-8">
        <Card title="Als Spender registrieren" subtitle="Für Detailhändler, Produzenten und Gastronomie, die überschüssige Lebensmittel abgeben möchten.">
          <RegisterForm />
        </Card>
      </main>
    </div>
  );
}
