'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyBundling, previewBundling } from '@/lib/actions';
import type { BundleRequest, PlannedDonation, PlannedGroup } from '@/lib/types';
import { categoryLabel, fmtCount, fmtDateOfInstant, fmtDayTime, fmtKg, fmtPallets, fmtTime, tempShort } from '@/lib/format';
import { weightKg, zurichNoonOf } from '@/lib/domain';
import { Alert, TONE, btn, inputCls } from '@/components/ui';

const NONE = '__none__';

/** Assignment of every donation to an order key (or NONE = leave out of this run). */
type Assignment = Record<number, string>;

interface DisplayOrder {
  key: string;
  donations: PlannedDonation[];
  pickupTime: Date;
  overlapWarning: boolean;
}

function buildOrders(group: PlannedGroup, assignment: Assignment, keys: string[]): DisplayOrder[] {
  const all = group.orders.flatMap((o) => o.donations);
  return keys
    .map((key) => {
      const donations = all.filter((d) => assignment[d.id] === key);
      if (donations.length === 0) return null;
      const maxStart = Math.max(...donations.map((d) => new Date(d.overlapStart).getTime()));
      const minEnd = Math.min(...donations.map((d) => new Date(d.overlapEnd).getTime()));
      return { key, donations, pickupTime: zurichNoonOf(new Date(minEnd)), overlapWarning: maxStart > minEnd };
    })
    .filter((o): o is DisplayOrder => o !== null);
}

export function BundleButton({ disabled = false }: { disabled?: boolean }) {
  const [groups, setGroups] = useState<PlannedGroup[] | null>(null);
  const [assignment, setAssignment] = useState<Assignment>({});
  const [keysByDonor, setKeysByDonor] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await previewBundling();
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const plan = result.data ?? [];
      if (plan.length === 0) return setMessage({ kind: 'ok', text: 'Gerade warten keine reservierten Spenden auf einen Transport.' });
      const a: Assignment = {};
      const k: Record<string, string[]> = {};
      for (const g of plan) {
        k[g.donor.id] = g.orders.map((o) => o.key);
        for (const o of g.orders) for (const d of o.donations) a[d.id] = o.key;
      }
      setGroups(plan); setAssignment(a); setKeysByDonor(k);
    });
  };

  const close = () => setGroups(null);

  const move = (donorId: string, donationId: number, target: string) => {
    if (target === '__new__') {
      const keys = keysByDonor[donorId];
      const next = `${donorId}-${keys.length + 1}`;
      setKeysByDonor({ ...keysByDonor, [donorId]: [...keys, next] });
      setAssignment({ ...assignment, [donationId]: next });
    } else {
      setAssignment({ ...assignment, [donationId]: target });
    }
  };

  const display = useMemo(() => (groups ?? []).map((g) => ({
    group: g,
    orders: buildOrders(g, assignment, keysByDonor[g.donor.id] ?? []),
    skipped: g.orders.flatMap((o) => o.donations).filter((d) => assignment[d.id] === NONE),
  })), [groups, assignment, keysByDonor]);

  const totals = display.reduce((t, d) => ({
    orders: t.orders + d.orders.length,
    positions: t.positions + d.orders.reduce((n, o) => n + o.donations.length, 0),
    skipped: t.skipped + d.skipped.length,
  }), { orders: 0, positions: 0, skipped: 0 });

  const confirm = () => {
    const bundles: BundleRequest[] = display.flatMap((d) =>
      d.orders.map((o) => ({ donorId: d.group.donor.id, donationIds: o.donations.map((x) => x.id) })));
    startTransition(async () => {
      const result = await applyBundling(bundles);
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const { orders, positions } = result.data!;
      setGroups(null);
      setMessage({ kind: 'ok', text: `${fmtCount(positions, 'Spende', 'Spenden')} in ${fmtCount(orders, 'Auftrag', 'Aufträgen')} zusammengefasst.` });
    });
  };

  const pickupWindow = (d: PlannedDonation) => {
    const now = new Date();
    return `${fmtDayTime(d.overlapStart, now)}–${fmtDateOfInstant(d.overlapStart) === fmtDateOfInstant(d.overlapEnd) ? fmtTime(d.overlapEnd) : fmtDayTime(d.overlapEnd, now)}`;
  };

  return (
    <div className="flex flex-col items-stretch md:items-end gap-3 shrink-0 md:max-w-sm">
      <button type="button" className={btn('primary', 'lg')} onClick={open} disabled={pending || disabled}>
        {pending && !groups ? 'Wird berechnet…' : 'Vorschlag erstellen'}
      </button>
      {message && <Alert kind={message.kind} onClose={() => setMessage(null)}>{message.text}</Alert>}

      {groups && (
        <div className="fixed inset-0 z-30 bg-ink/50 flex items-end md:items-center justify-center p-0 md:p-6" role="dialog" aria-modal="true" aria-labelledby="bundle-title">
          <div className="bg-white w-full md:max-w-4xl max-h-[92vh] md:max-h-[88vh] rounded-t-3xl md:rounded-2xl shadow-xl flex flex-col">
            <header className="px-5 md:px-7 pt-6 pb-4 border-b border-line-soft space-y-1.5">
              <h2 id="bundle-title" className="text-xl md:text-2xl font-bold text-ink">Vorschlag prüfen</h2>
              <p className="text-base text-muted leading-relaxed">
                Spenden mit passenden Abholzeiten sind pro Spender zu einer Fahrt zusammengefasst. Sie können jede Spende einer
                anderen Fahrt zuteilen oder vorerst zurückstellen. Gespeichert wird erst mit «Aufträge erstellen».
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-5 md:px-7 py-5 space-y-7">
              {display.map(({ group, orders, skipped }) => {
                const keys = keysByDonor[group.donor.id] ?? [];
                const labelFor = (key: string) => `Fahrt ${keys.indexOf(key) + 1}`;
                const rowSelect = (d: PlannedDonation) => (
                  <select className={`${inputCls} h-11 md:w-48`} value={assignment[d.id]} onChange={(e) => move(group.donor.id, d.id, e.target.value)}
                    aria-label={`Fahrt für ${d.productName}`}>
                    {keys.map((k) => <option key={k} value={k}>{labelFor(k)}</option>)}
                    <option value="__new__">Neue Fahrt…</option>
                    <option value={NONE}>Zurückstellen</option>
                  </select>
                );
                const row = (d: PlannedDonation) => (
                  <li key={d.id} className="px-4 py-3.5 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-base"><b className="text-ink">{d.productName}</b> <span className="text-muted">· {fmtKg(weightKg(d))} · {tempShort(d.temperatureRange)}</span></div>
                      <div className="text-sm text-subtle">{categoryLabel(d.category)} · abholbereit {pickupWindow(d)}</div>
                    </div>
                    {rowSelect(d)}
                  </li>
                );
                return (
                  <section key={group.donor.id} className="space-y-3">
                    <div>
                      <h3 className="text-lg font-bold text-ink">{group.donor.organizationName}</h3>
                      <p className="text-[15px] text-muted">{group.donor.address}</p>
                    </div>
                    {orders.map((o) => (
                      <div key={o.key} className={`rounded-2xl border ${o.overlapWarning ? 'border-[#e0a458]' : 'border-line'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-sand rounded-t-2xl border-b border-line-soft">
                          <span className="text-base font-bold text-ink">{labelFor(o.key)}</span>
                          <span className="text-[15px] text-ink-2">
                            Abholung <b>{fmtDayTime(o.pickupTime, new Date())} Uhr</b> · {fmtKg(o.donations.reduce((s, d) => s + weightKg(d), 0))} · {fmtPallets(o.donations.reduce((s, d) => s + d.numberOfPallets, 0))}
                          </span>
                        </div>
                        {o.overlapWarning && (
                          <p className={`px-4 py-2.5 text-[15px] ${TONE.orange}`}>
                            Die Abholzeiten dieser Spenden überschneiden sich nicht. Bitte den Termin mit dem Spender absprechen.
                          </p>
                        )}
                        <ul className="divide-y divide-line-soft">{o.donations.map(row)}</ul>
                      </div>
                    ))}
                    {skipped.length > 0 && (
                      <div className="rounded-2xl border border-dashed border-control">
                        <div className="px-4 py-3 text-base font-semibold text-muted border-b border-line-soft">Zurückgestellt (bleibt reserviert)</div>
                        <ul className="divide-y divide-line-soft">{skipped.map(row)}</ul>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <footer className="px-5 md:px-7 py-4 border-t border-line-soft flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <span className="text-[15px] text-muted">
                {fmtCount(totals.orders, 'Fahrt', 'Fahrten')} · {fmtCount(totals.positions, 'Spende', 'Spenden')}
                {totals.skipped > 0 ? ` · ${totals.skipped} zurückgestellt` : ''}
              </span>
              <div className="flex gap-2.5">
                <button type="button" className={btn('ghost')} onClick={close} disabled={pending}>Abbrechen</button>
                <button type="button" className={`${btn('primary')} flex-1 md:flex-none`} onClick={confirm} disabled={pending || totals.orders === 0}>
                  {pending ? 'Wird gespeichert…' : 'Aufträge erstellen'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
