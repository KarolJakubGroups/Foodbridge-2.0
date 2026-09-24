import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { fetchMyDonations, fetchWishlists } from '@/lib/queries';
import { buildDonorDashboard } from '@/lib/dashboard';
import { CATEGORY_LABEL, STATE_LABEL, fmtDate, fmtDateOfInstant, fmtDateTime, fmtKg, fmtNumber } from '@/lib/format';
import { freshnessCutoff, visibleUntil, weightKg, type Category, type DonationState } from '@/lib/domain';
import { Card, Kpi } from '@/components/ui';
import { DonationFormLoader } from '@/components/DonationFormLoader';
import { DonationTable } from '@/components/DonationTable';
import { PrintButton } from '@/components/PrintButton';
import { WithdrawButton } from '@/components/WithdrawButton';

export const dynamic = 'force-dynamic';

/** "heute" / "morgen" / date, all in Swiss local time. */
function relativeDay(instant: Date, now: Date): string {
  const day = fmtDateOfInstant(instant);
  if (day === fmtDateOfInstant(now)) return 'heute';
  if (day === fmtDateOfInstant(new Date(now.getTime() + 86_400_000))) return 'morgen';
  return day;
}

function ActionCard({ tone, title, children }: { tone: 'go' | 'warn' | 'stop'; title: string; children: React.ReactNode }) {
  const styles = {
    go: 'border-sky-300 bg-sky-50 text-sky-950',
    warn: 'border-amber-300 bg-amber-50 text-amber-950',
    stop: 'border-red-300 bg-red-50 text-red-950',
  }[tone];
  return (
    <div className={`border rounded-md p-3 ${styles}`}>
      <h3 className="text-[11px] font-black uppercase tracking-wide mb-1.5">{title}</h3>
      <div className="text-xs space-y-1">{children}</div>
    </div>
  );
}

const FUNNEL: DonationState[] = ['OPEN', 'RESERVED', 'SCHEDULED', 'COLLECTED'];

export default async function DonorPage() {
  const profile = await requireRole('DONOR');
  const [donations, wishlists] = await Promise.all([fetchMyDonations(profile.id), fetchWishlists()]);
  const now = new Date();
  const board = buildDonorDashboard(donations, now);

  const cutoff = freshnessCutoff(now);
  const openDonations = donations
    .filter((d) => d.status === 'AVAILABLE' && d.createdAt > cutoff)
    .map((d) => ({
      id: d.id, productName: d.productName, category: d.category, temperatureRange: d.temperatureRange,
      numberOfPallets: d.numberOfPallets, weightPerPallet: d.weightPerPallet, bestBeforeDate: d.bestBeforeDate,
      overlapStart: d.overlapStart, overlapEnd: d.overlapEnd, createdAt: d.createdAt,
    }));

  const { nextPickup, expiringSoon, bestBeforeSoon, expired, impact, counts } = board;
  const hasActions = Boolean(nextPickup) || expiringSoon.length > 0 || bestBeforeSoon.length > 0 || expired.length > 0;
  const needs = wishlists.slice(0, 3);

  return (
    <div className="space-y-3 md:space-y-4">
      <Card title={profile.organizationName} subtitle={profile.address}
        actions={<span className="hidden md:inline"><PrintButton label="Compliance-Nachweis (PDF / Druck)" /></span>}>
        <p className="text-xs text-slate-500">
          {counts.OPEN + counts.RESERVED + counts.SCHEDULED} laufende Angebote · {fmtKg(impact.total.totalWeightKg)} insgesamt gerettet
        </p>
      </Card>

      {hasActions && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {nextPickup && (
            <ActionCard tone="go" title="Nächste Abholung">
              <p className="text-sm font-bold">{relativeDay(nextPickup.pickupTime, now)}, {fmtDateTime(nextPickup.pickupTime).split(', ')[1]} Uhr</p>
              <p className="font-mono">{nextPickup.totalPallets} Paletten · {fmtKg(nextPickup.totalWeightKg)}</p>
              <p>{nextPickup.donations.map((d) => d.productName).join(', ')}</p>
              <p className="text-[11px] opacity-80">Bitte rechtzeitig an der Rampe bereitstellen.</p>
            </ActionCard>
          )}
          {expiringSoon.length > 0 && (
            <ActionCard tone="warn" title="Läuft bald aus der Ansicht">
              {expiringSoon.map((d) => (
                <p key={d.id}><b>{d.productName}</b> · noch sichtbar bis {fmtDateTime(visibleUntil(d.createdAt))}</p>
              ))}
              <p className="text-[11px] opacity-80">Noch nicht reserviert. Nach 4 Tagen wird das Angebot ausgeblendet.</p>
            </ActionCard>
          )}
          {bestBeforeSoon.length > 0 && (
            <ActionCard tone="warn" title="MHD kritisch">
              {bestBeforeSoon.map((d) => (
                <p key={d.id}><b>{d.productName}</b> · MHD {fmtDate(d.bestBeforeDate)}</p>
              ))}
            </ActionCard>
          )}
          {expired.length > 0 && (
            <ActionCard tone="stop" title="Abgelaufen, nicht abgeholt">
              {expired.map((d) => (
                <p key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span><b>{d.productName}</b> · {fmtKg(weightKg(d))}</span>
                  <WithdrawButton donationId={d.id} productName={d.productName} />
                </p>
              ))}
              <p className="text-[11px] opacity-80">Keine Institution hat reserviert. Bitte zurückziehen oder neu erfassen.</p>
            </ActionCard>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {FUNNEL.map((state) => (
          <Kpi key={state} label={STATE_LABEL[state]} value={counts[state]} />
        ))}
      </div>

      {needs.length > 0 && (
        <Card>
          <p className="text-xs">
            <span className="font-bold">Aktuell gesucht:</span>{' '}
            {needs.map((w) => `${w.productName} (${fmtKg(w.quantityKg)})`).join(' · ')}{' '}
            <Link href="/wishlist" className="underline font-bold whitespace-nowrap">alle Bedarfe</Link>
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
        <Card className="lg:col-span-2 no-print" title="Neues Angebot registrieren" subtitle="Überschuss in unter einer Minute erfassen">
          <DonationFormLoader defaultAddress={profile.address} openDonations={openDonations} />
        </Card>
        <Card className="lg:col-span-3" title="Meine Angebote">
          <DonationTable donations={donations} />
        </Card>
      </div>

      <Card title="Wirkung" subtitle="Gerettete Lebensmittel Ihrer Filiale.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <Kpi label="Diesen Monat" value={fmtNumber(impact.thisMonth.totalWeightKg)} unit="kg" />
          <Kpi label="Letzter Monat" value={fmtNumber(impact.lastMonth.totalWeightKg)} unit="kg" />
          <Kpi label="Mahlzeiten gesamt" value={fmtNumber(impact.total.meals, 0)} unit="Portionen" />
          <Kpi label="CO₂ gesamt" value={fmtNumber(impact.total.co2SavedKg)} unit="kg CO₂e" />
        </div>
        {impact.deltaPercent !== null && (
          <p className="text-xs text-slate-600 mt-3">
            {impact.deltaPercent >= 0 ? `${impact.deltaPercent} % mehr` : `${Math.abs(impact.deltaPercent)} % weniger`} als im Vormonat.
          </p>
        )}
        {board.topCategories.length > 0 && (
          <p className="text-xs text-slate-600 mt-2">
            <span className="font-bold">Häufigste Warengruppen:</span>{' '}
            {board.topCategories.map((c) => `${CATEGORY_LABEL[c.category as Category] ?? c.category} (${fmtKg(c.totalWeightKg)})`).join(' · ')}
          </p>
        )}
        {board.recipients.length > 0 && (
          <p className="text-xs text-slate-600 mt-2">
            <span className="font-bold">Ihre Spenden gingen an:</span> {board.recipients.join(', ')}
          </p>
        )}
      </Card>
    </div>
  );
}
