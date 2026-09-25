import { AuthShell } from '@/components/AuthShell';
import { RegisterForm } from '@/components/RegisterForm';

export default function RegisterPage() {
  return (
    <AuthShell wide title="Als Spender registrieren"
      subtitle="Für Detailhandel, Produktion und Gastronomie, die überschüssige Lebensmittel weitergeben möchten.">
      <RegisterForm />
    </AuthShell>
  );
}
