import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireRole } from '@/lib/auth';
import { fetchMyDonations } from '@/lib/queries';
import { buildDonorDashboard } from '@/lib/dashboard';
import {
  CATEGORY_LABEL, fmtBestBefore, fmtCount, fmtDayTime, fmtKg, fmtLongDate, fmtMonth, fmtNumber, fmtPallets, fmtWindow, greeting,
} from '@/lib/format';
import { claimDeadline, freePalletNumbers, remainingPallets, weightOfPallets, type Category } from '@/lib/domain';
import { Card, FoodPhoto, PageHeader, PhotoPill, Pill, SectionTitle, Stat, TONE, btn, linkCls, type Tone } from '@/components/ui';
import { WAREHOUSE_IMAGE } from '@/lib/images';
import { AlertIcon, ClockIcon, PlusIcon, TruckIcon } from '@/components/icons';
import { DonationList } from '@/components/DonationList';
import { PrintButton } from '@/components/PrintButton';
import { WithdrawButton } from '@/components/WithdrawButton';

export const dynamic = 'force-dynamic';

function ActionCard({ tone, icon, label, title, children, footer }: {
  tone: Tone; icon: ReactNode; label: string; title: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <article className="bg-white rounded-3xl shadow-card p-5 md:p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${TONE[tone]}`}>{icon}</span>
        <span className={`text-[15px] font-semibold ${TONE[tone].split(' ')[1]}`}>{label}</span>
      </div>
      <div className="text-xl font-bold tracking-[-0.01em] text-ink">{title}</div>
      <div className="text-base leading-relaxed text-ink-2 space-y-1">{children}</div>
      {footer && <div className="mt-auto pt-1 flex flex-wrap items-center gap-3">{footer}</div>}
    </article>
  );
}

export default async function DonorPage() {
  const profile = await requireRole('DONOR');
  const donations = await fetchMyDonations(profile.id);
  const now = new Date();
  const { nextPickup, expiringSoon, bestBeforeSoon, expired, impact, counts, topCategories, recipients } = buildDonorDashboard(donations, now);

  const running = counts.OPEN + counts.PARTIAL + counts.RESERVED + counts.SCHEDULED;
  const hasActions = Boolean(nextPickup) || expiringSoon.length > 0 || bestBeforeSoon.length > 0 || expired.length > 0;
  const firstExpiring = expiringSoon.reduce<Date | null>((min, d) => {
    const until = claimDeadline(d);
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
              <article className="bg-white rounded-3xl shadow-card overflow-hidden flex flex-col">
                <div className="relative h-36 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={WAREHOUSE_IMAGE} alt="" className="absolute inset-0 size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <PhotoPill className="absolute top-3 left-3"><TruckIcon className="size-4 text-brand-700" />Nächste Abholung</PhotoPill>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <div className="text-2xl font-bold tracking-[-0.02em]">{fmtWindow(nextPickup.pickupStart, nextPickup.pickupEnd, now)}</div>
                    <div className="text-sm text-white/85">Galliker · {fmtPallets(nextPickup.totalPallets)} · {fmtKg(nextPickup.totalWeightKg)}</div>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  {nextPickup.pickupEnd < now && (
                    <p className="text-[15px] text-[#9a4a0a]">Das Abholfenster ist vorbei, die Abholung steht aber noch aus. Die Disposition meldet sich für einen neuen Termin.</p>
                  )}
                  <ul className="flex flex-col gap-2.5">
                    {nextPickup.items.map((i) => (
                      <li key={`${i.productName}-${i.pallets}`} className="flex items-center gap-3">
                        <FoodPhoto item={{ productName: i.productName }} className="size-10 rounded-xl shrink-0" />
                        <span className="flex-1 text-[15px] font-medium text-ink">{i.productName}</span>
                        <span className="text-sm text-muted">{fmtPallets(i.pallets)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/network" className={`${linkCls} mt-auto pt-1`}>Details ansehen</Link>
                </div>
              </article>
            )}
            {expiringSoon.length > 0 && (
              <ActionCard tone="orange" icon={<ClockIcon />} label="Bald nicht mehr sichtbar"
                title={expiringSoon.length === 1 ? expiringSoon[0].productName : `${expiringSoon.length} Angebote`}>
                <p>
                  Noch nicht alles reserviert. Institutionen können nur noch
                  bis {firstExpiring && fmtDayTime(firstExpiring, now)} Uhr reservieren.
                </p>
                {expiringSoon.length > 1 && <p className="text-muted">{expiringSoon.map((d) => d.productName).join(', ')}</p>}
              </ActionCard>
            )}
            {bestBeforeSoon.length > 0 && (
              <ActionCard tone="orange" icon={<AlertIcon />} label="Haltbarkeit läuft ab"
                title={bestBeforeSoon.length === 1 ? bestBeforeSoon[0].productName : `${bestBeforeSoon.length} Produkte`}>
                {bestBeforeSoon.map((d) => (
                  <p key={d.id}>{bestBeforeSoon.length > 1 && <b>{d.productName}: </b>}{d.bestBeforeDate && fmtBestBefore(d.bestBeforeDate, now).text}</p>
                ))}
              </ActionCard>
            )}
            {expired.length > 0 && (
              <ActionCard tone="red" icon={<AlertIcon />} label="Nicht abgeholt"
                title={expired.length === 1 ? expired[0].productName : `${expired.length} Angebote`}
                footer={<Link href={`/donor/new?from=${expired[0].id}`} className={btn('ghost', 'sm')}>Neu erfassen</Link>}>
                <p>Die Reservierungsfrist ist vorbei. Bitte die übrigen Paletten zurückziehen oder neu erfassen. Bereits reservierte Paletten bleiben reserviert.</p>
                <ul className="pt-2 space-y-2">
                  {expired.map((d) => {
                    const left = remainingPallets(d);
                    return (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{expired.length > 1 && <b>{d.productName}: </b>}{fmtPallets(left)} übrig · {fmtKg(weightOfPallets(d.palletWeights, freePalletNumbers(d)))}</span>
                        <WithdrawButton donationId={d.id} productName={d.productName} remainder={d.claimedPallets > 0 ? left : undefined} />
                      </li>
                    );
                  })}
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
                <div className="text-5xl font-bold tracking-[-0.03em] text-brand-700 tabular-nums">{fmtKg(impact.thisMonth.totalWeightKg)}</div>
                <div className="text-base text-ink-2">Lebensmittel gerettet</div>
                {impact.deltaPercent !== null && (
                  <Pill tone={impact.deltaPercent >= 0 ? 'green' : 'sand'} className="mt-1">
                    {impact.deltaPercent >= 0 ? '+' : '−'}{Math.abs(impact.deltaPercent)} % gegenüber Vormonat
                  </Pill>
                )}
              </div>
              <Stat label="Einkaufstaschen à 5 kg" value={`≈ ${fmtNumber(impact.thisMonth.bags, 0)}`} />
              <p className="text-[15px] text-muted">Seit Beginn: {fmtKg(impact.total.totalWeightKg)} gerettet, ≈ {fmtNumber(impact.total.bags, 0)} Einkaufstaschen.</p>
              {(recipients.length > 0 || topCategories.length > 0) && (
                <div className="space-y-3 border-t border-line-soft pt-4">
                  {recipients.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-sm font-semibold text-muted">Ihre Spenden gingen an</div>
                      <ul className="space-y-3">
                        {recipients.slice(0, 5).map((r) => (
                          <li key={r.organizationName} className="space-y-0.5">
                            <div className="text-base font-semibold text-ink">{r.organizationName}</div>
                            {r.description && <p className="text-[15px] leading-snug text-ink-2">{r.description}</p>}
                            {r.contactName && (
                              <p className="text-sm text-muted">
                                Kontakt: {r.contactName}{r.phone && <> · <a href={`tel:${r.phone}`} className={`${linkCls} no-print`}>{r.phone}</a></>}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
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
        </aside>
      </div>
    </div>
  );
}
