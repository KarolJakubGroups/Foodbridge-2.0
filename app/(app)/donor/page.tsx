import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireRole } from '@/lib/auth';
import { fetchMyDonations, fetchWishlists } from '@/lib/queries';
import { buildDonorDashboard } from '@/lib/dashboard';
import {
  CATEGORY_LABEL, fmtBestBefore, fmtCount, fmtDayTime, fmtKg, fmtLongDate, fmtMonth, fmtNumber, fmtPallets, greeting,
} from '@/lib/format';
import { visibleUntil, weightKg, type Category } from '@/lib/domain';
import { Card, PageHeader, Pill, SectionTitle, Stat, TONE, btn, linkCls, type Tone } from '@/components/ui';
import { AlertIcon, ClockIcon, PlusIcon, TruckIcon } from '@/components/icons';
import { DonationList } from '@/components/DonationList';
import { PrintButton } from '@/components/PrintButton';
import { WithdrawButton } from '@/components/WithdrawButton';

export const dynamic = 'force-dynamic';

function ActionCard({ tone, icon, label, title, children, footer }: {
  tone: Tone; icon: ReactNode; label: string; title: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <article className="bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}>{icon}</span>
        <span className={`text-[15px] font-semibold ${TONE[tone].split(' ')[1]}`}>{label}</span>
      </div>
      <div className="font-display text-2xl font-bold text-ink">{title}</div>
      <div className="text-base leading-relaxed text-ink-2 space-y-1">{children}</div>
      {footer && <div className="mt-auto pt-1 flex flex-wrap items-center gap-3">{footer}</div>}
    </article>
  );
}

export default async function DonorPage() {
  const profile = await requireRole('DONOR');
  const [donations, wishlists] = await Promise.all([fetchMyDonations(profile.id), fetchWishlists()]);
  const now = new Date();
  const { nextPickup, expiringSoon, bestBeforeSoon, expired, impact, counts, topCategories, recipients } = buildDonorDashboard(donations, now);

  const running = counts.OPEN + counts.RESERVED + counts.SCHEDULED;
  const hasActions = Boolean(nextPickup) || expiringSoon.length > 0 || bestBeforeSoon.length > 0 || expired.length > 0;
  const needs = wishlists.slice(0, 4);
  const firstExpiring = expiringSoon.reduce<Date | null>((min, d) => {
    const until = visibleUntil(d.createdAt);
    return !min || until < min ? until : min;
  }, null);

  return (
    <div className="space-y-8 md:space-y-10">
      <PageHeader
        title={`${greeting(now)}, ${profile.organizationName}`}
        subtitle={`${fmtLongDate(now)} · ${running === 0 ? 'Keine laufenden Angebote' : `${fmtCount(running, 'laufendes Angebot', 'laufende Angebote')}`}`}
        actions={<Link href="/donor/new" className={`${btn('primary', 'lg')} w-full md:w-auto`}><PlusIcon className="size-6" />Überschuss melden</Link>}
      />

      {hasActions && (
        <section className="space-y-4 no-print">
          <SectionTitle>Heute zu tun</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {nextPickup && (
              <ActionCard tone="blue" icon={<TruckIcon />} label="Nächste Abholung" title={`${fmtDayTime(nextPickup.pickupTime, now)} Uhr`}
                footer={<Link href="/network" className={linkCls}>Details ansehen</Link>}>
                <p>
                  Bitte {fmtPallets(nextPickup.totalPallets)} ({fmtKg(nextPickup.totalWeightKg)}) an der Rampe bereitstellen:{' '}
                  {nextPickup.donations.map((d) => d.productName).join(', ')}.
                </p>
              </ActionCard>
            )}
            {expiringSoon.length > 0 && (
              <ActionCard tone="orange" icon={<ClockIcon />} label="Bald nicht mehr sichtbar"
                title={expiringSoon.length === 1 ? expiringSoon[0].productName : `${expiringSoon.length} Angebote`}>
                <p>
                  Noch niemand hat reserviert. Institutionen sehen {expiringSoon.length === 1 ? 'es' : 'sie'} nur noch
                  bis {firstExpiring && fmtDayTime(firstExpiring, now)} Uhr.
                </p>
                {expiringSoon.length > 1 && <p className="text-muted">{expiringSoon.map((d) => d.productName).join(', ')}</p>}
              </ActionCard>
            )}
            {bestBeforeSoon.length > 0 && (
              <ActionCard tone="orange" icon={<AlertIcon />} label="Haltbarkeit läuft ab"
                title={bestBeforeSoon.length === 1 ? bestBeforeSoon[0].productName : `${bestBeforeSoon.length} Produkte`}>
                {bestBeforeSoon.map((d) => (
                  <p key={d.id}>{bestBeforeSoon.length > 1 && <b>{d.productName}: </b>}{fmtBestBefore(d.bestBeforeDate, now).text}</p>
                ))}
              </ActionCard>
            )}
            {expired.length > 0 && (
              <ActionCard tone="red" icon={<AlertIcon />} label="Nicht abgeholt"
                title={expired.length === 1 ? expired[0].productName : `${expired.length} Angebote`}
                footer={<Link href={`/donor/new?from=${expired[0].id}`} className={btn('ghost', 'sm')}>Neu erfassen</Link>}>
                <p>Nach 4 Tagen hat niemand reserviert. Bitte zurückziehen oder neu erfassen.</p>
                <ul className="pt-2 space-y-2">
                  {expired.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{expired.length > 1 ? <b>{d.productName}</b> : fmtPallets(d.numberOfPallets)} · {fmtKg(weightKg(d))}</span>
                      <WithdrawButton donationId={d.id} productName={d.productName} />
                    </li>
                  ))}
                </ul>
              </ActionCard>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-7 items-start">
        <Card title="Meine Angebote" flush>
          <DonationList donations={donations} now={now.toISOString()} />
        </Card>

        <aside className="space-y-6">
          <Card title={`Ihre Wirkung im ${fmtMonth(now)}`}>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="font-display text-5xl font-bold text-brand-700 tabular-nums">{fmtKg(impact.thisMonth.totalWeightKg)}</div>
                <div className="text-base text-ink-2">Lebensmittel gerettet</div>
                {impact.deltaPercent !== null && (
                  <Pill tone={impact.deltaPercent >= 0 ? 'green' : 'sand'} className="mt-1">
                    {impact.deltaPercent >= 0 ? '+' : '−'}{Math.abs(impact.deltaPercent)} % gegenüber Vormonat
                  </Pill>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Mahlzeiten" value={`≈ ${fmtNumber(impact.thisMonth.meals, 0)}`} />
                <Stat label="kg CO₂ eingespart" value={fmtNumber(impact.thisMonth.co2SavedKg, 0)} />
              </div>
              <p className="text-[15px] text-muted">Seit Beginn: {fmtKg(impact.total.totalWeightKg)} gerettet, ≈ {fmtNumber(impact.total.meals, 0)} Mahlzeiten.</p>
              {(recipients.length > 0 || topCategories.length > 0) && (
                <div className="space-y-3 border-t border-line-soft pt-4">
                  {recipients.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-muted">Ihre Spenden gingen an</div>
                      <ul className="text-base space-y-0.5">{recipients.slice(0, 5).map((r) => <li key={r}>{r}</li>)}</ul>
                    </div>
                  )}
                  {topCategories.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-muted">Am meisten gespendet</div>
                      <p className="text-base">{topCategories.map((c) => CATEGORY_LABEL[c.category as Category] ?? c.category).join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
              <PrintButton label="Spendennachweis drucken" />
            </div>
          </Card>

          {needs.length > 0 && (
            <Card title="Das wird gerade gesucht" subtitle="Haben Sie etwas davon übrig?" className="no-print">
              <ul className="divide-y divide-line-soft -my-2">
                {needs.map((w) => (
                  <li key={w.id} className="py-3 flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-ink truncate">{w.productName}</span>
                      <span className="block text-sm text-muted truncate">{w.foodbank.organizationName}</span>
                    </span>
                    <span className="text-[15px] text-muted tabular-nums whitespace-nowrap">{fmtKg(w.quantityKg)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/wishlist" className={`${linkCls} inline-block mt-4`}>Alle gesuchten Produkte</Link>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
