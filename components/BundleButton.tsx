'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyBundling, previewBundling } from '@/lib/actions';
import { callAction } from '@/lib/call-action';
import { bundleWindow, type PickupWindow } from '@/lib/logistics';
import type { BundleRequest, PlannedClaim, PlannedGroup } from '@/lib/types';
import { categoryLabel, fmtCount, fmtKg, fmtPallets, fmtWindow } from '@/lib/format';
import { Alert, TONE, TempPill, btn, inputCls } from '@/components/ui';

const NONE = '__none__';

/** Assignment of every reservation to an order key (or NONE = leave out of this run). */
type Assignment = Record<number, string>;

interface DisplayOrder {
  key: string;
  claims: PlannedClaim[];
  window: PickupWindow;
}

const kgOf = (c: PlannedClaim) => c.pallets * c.weightPerPallet;

function buildOrders(group: PlannedGroup, assignment: Assignment, keys: string[]): DisplayOrder[] {
  const all = group.orders.flatMap((o) => o.claims);
  return keys
    .map((key) => {
      const claims = all.filter((c) => assignment[c.id] === key);
      return claims.length === 0 ? null : { key, claims, window: bundleWindow(claims) };
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
      const result = await callAction(() => previewBundling());
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const plan = result.data ?? [];
      if (plan.length === 0) return setMessage({ kind: 'ok', text: 'Gerade warten keine Reservierungen auf einen Transport.' });
      const a: Assignment = {};
      const k: Record<string, string[]> = {};
      for (const g of plan) {
        k[g.key] = g.orders.map((o) => o.key);
        for (const o of g.orders) for (const c of o.claims) a[c.id] = o.key;
      }
      setGroups(plan); setAssignment(a); setKeysByDonor(k);
    });
  };

  const close = () => setGroups(null);

  const move = (groupKey: string, claimId: number, target: string) => {
    if (target === '__new__') {
      const keys = keysByDonor[groupKey];
      const next = `${groupKey}#new${keys.length + 1}`;
      setKeysByDonor({ ...keysByDonor, [groupKey]: [...keys, next] });
      setAssignment({ ...assignment, [claimId]: next });
    } else {
      setAssignment({ ...assignment, [claimId]: target });
    }
  };

  const display = useMemo(() => (groups ?? []).map((g) => ({
    group: g,
    orders: buildOrders(g, assignment, keysByDonor[g.key] ?? []),
    skipped: g.orders.flatMap((o) => o.claims).filter((c) => assignment[c.id] === NONE),
  })), [groups, assignment, keysByDonor]);

  const totals = display.reduce((t, d) => ({
    orders: t.orders + d.orders.length,
    positions: t.positions + d.orders.reduce((n, o) => n + o.claims.length, 0),
    skipped: t.skipped + d.skipped.length,
  }), { orders: 0, positions: 0, skipped: 0 });

  const confirm = () => {
    const bundles: BundleRequest[] = display.flatMap((d) =>
      d.orders.map((o) => ({ donorId: d.group.donor.id, claimIds: o.claims.map((c) => c.id) })));
    startTransition(async () => {
      const result = await callAction(() => applyBundling(bundles));
      if (!result.ok) return setMessage({ kind: 'error', text: result.error });
      const { orders, positions, sent, failed } = result.data!;
      setGroups(null);
      const handover = failed === 0
        ? (sent === 1 ? 'Der Auftrag wurde an Galliker übermittelt.' : `Alle ${sent} Aufträge wurden an Galliker übermittelt.`)
        : `${sent} an Galliker übermittelt, ${failed} fehlgeschlagen. Bitte beim Auftrag erneut senden.`;
      setMessage({
        kind: failed === 0 ? 'ok' : 'error',
        text: `${fmtCount(positions, 'Reservierung', 'Reservierungen')} in ${fmtCount(orders, 'Auftrag', 'Aufträgen')} zusammengefasst. ${handover}`,
      });
    });
  };

  const now = new Date();

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
                Reservierungen mit passenden Abholzeiten sind pro Abholadresse zu einer Fahrt zusammengefasst. Sie können jede
                Reservierung einer anderen Fahrt zuteilen oder vorerst zurückstellen. Mit «Aufträge erstellen» wird gespeichert
                und automatisch an Galliker übermittelt.
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-5 md:px-7 py-5 space-y-7">
              {display.map(({ group, orders, skipped }) => {
                const keys = keysByDonor[group.key] ?? [];
                const labelFor = (key: string) => `Fahrt ${keys.indexOf(key) + 1}`;
                const rowSelect = (c: PlannedClaim) => (
                  <select className={`${inputCls} h-11 md:w-48`} value={assignment[c.id]} onChange={(e) => move(group.key, c.id, e.target.value)}
                    aria-label={`Fahrt für ${c.productName}`}>
                    {keys.map((k) => <option key={k} value={k}>{labelFor(k)}</option>)}
                    <option value="__new__">Neue Fahrt…</option>
                    <option value={NONE}>Zurückstellen</option>
                  </select>
                );
                const row = (c: PlannedClaim) => (
                  <li key={c.id} className="px-4 py-3.5 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="text-base"><b className="text-ink">{c.productName}</b> <span className="text-muted">· {fmtPallets(c.pallets)} · {fmtKg(kgOf(c))}</span></div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-subtle">
                        <TempPill value={c.temperatureRange} />
                        <span>{categoryLabel(c.category)} · für {c.foodbankName}</span>
                      </div>
                      <div className="text-sm text-subtle">abholbereit {fmtWindow(c.overlapStart, c.overlapEnd, now)}</div>
                    </div>
                    {rowSelect(c)}
                  </li>
                );
                return (
                  <section key={group.key} className="space-y-3">
                    <div>
                      <h3 className="text-lg font-bold text-ink">{group.donor.organizationName}</h3>
                      <p className="text-[15px] text-muted">{group.pickupAddress}</p>
                    </div>
                    {orders.map((o) => (
                      <div key={o.key} className={`rounded-2xl border ${!o.window.overlaps ? 'border-[#e0a458]' : 'border-line'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-sand rounded-t-2xl border-b border-line-soft">
                          <span className="text-base font-bold text-ink">{labelFor(o.key)}</span>
                          <span className="text-[15px] text-ink-2">
                            Abholfenster <b>{fmtWindow(o.window.start, o.window.end, now)}</b> · {fmtKg(o.claims.reduce((s, c) => s + kgOf(c), 0))} · {fmtPallets(o.claims.reduce((s, c) => s + c.pallets, 0))}
                          </span>
                        </div>
                        {!o.window.overlaps && (
                          <p className={`px-4 py-2.5 text-[15px] ${TONE.orange}`}>
                            Die Abholfenster dieser Reservierungen überschneiden sich nicht. Bitte den Termin mit dem Spender absprechen.
                          </p>
                        )}
                        <ul className="divide-y divide-line-soft">{o.claims.map(row)}</ul>
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
                {fmtCount(totals.orders, 'Fahrt', 'Fahrten')} · {fmtCount(totals.positions, 'Reservierung', 'Reservierungen')}
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
