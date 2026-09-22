'use client';

import { useMemo, useState, useTransition } from 'react';
import { applyBundling, previewBundling } from '@/lib/actions';
import type { BundleRequest, PlannedDonation, PlannedGroup } from '@/lib/types';
import { categoryLabel, fmtDateTime, fmtKg, tempLabel } from '@/lib/format';
import { weightKg, zurichNoonOf } from '@/lib/domain';
import { Alert, btnDark, btnGhost, btnPrimary, inputCls } from '@/components/ui';

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

export function BundleButton() {
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
      if (plan.length === 0) return setMessage({ kind: 'ok', text: 'Keine neuen reservierten Spenden zur Bündelung vorhanden.' });
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
      setMessage({ kind: 'ok', text: `${positions} Spende(n) zu ${orders} Transportauftrag/-aufträgen für Galliker zusammengefasst.` });
    });
  };

  return (
    <div className="w-full flex flex-col items-end gap-2">
      <button type="button" className={btnDark} onClick={open} disabled={pending}>
        {pending && !groups ? 'Berechne…' : 'Bündelung vorschlagen'}
      </button>
      {message && <div className="w-full"><Alert kind={message.kind} onClose={() => setMessage(null)}>{message.text}</Alert></div>}

      {groups && (
        <div className="fixed inset-0 z-30 bg-slate-900/60 flex items-end md:items-center justify-center p-0 md:p-6" role="dialog" aria-modal="true" aria-labelledby="bundle-title">
          <div className="bg-white w-full md:max-w-4xl max-h-[92vh] md:max-h-[85vh] rounded-t-xl md:rounded-md shadow-xl flex flex-col">
            <header className="px-4 md:px-5 py-3 border-b border-slate-200">
              <h2 id="bundle-title" className="text-sm font-bold text-slate-900">Vorschlag prüfen und Aufträge erstellen</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Spenden mit überlappenden Abholfenstern wurden pro Spender zusammengelegt. Sie können jede Spende in einen anderen
                Auftrag verschieben, einen neuen Auftrag eröffnen oder sie vorerst nicht bündeln. Es wird erst beim Bestätigen gespeichert.
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-5">
              {display.map(({ group, orders, skipped }) => {
                const keys = keysByDonor[group.donor.id] ?? [];
                const labelFor = (key: string) => `Auftrag ${keys.indexOf(key) + 1}`;
                const rowSelect = (d: PlannedDonation) => (
                  <select className={`${inputCls} md:w-44 py-1`} value={assignment[d.id]} onChange={(e) => move(group.donor.id, d.id, e.target.value)} aria-label="Auftrag zuweisen">
                    {keys.map((k) => <option key={k} value={k}>{labelFor(k)}</option>)}
                    <option value="__new__">Neuer Auftrag…</option>
                    <option value={NONE}>Nicht bündeln</option>
                  </select>
                );
                return (
                  <section key={group.donor.id} className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-900">
                      {group.donor.organizationName} <span className="font-normal text-slate-500">· {group.donor.address}</span>
                    </h3>
                    {orders.map((o) => (
                      <div key={o.key} className={`border rounded-md ${o.overlapWarning ? 'border-amber-400' : 'border-slate-200'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                          <span className="text-xs font-bold">{labelFor(o.key)}</span>
                          <span className="font-mono text-[11px]">
                            Termin <b>{fmtDateTime(o.pickupTime)}</b> · {fmtKg(o.donations.reduce((s, d) => s + weightKg(d), 0))} · {o.donations.reduce((s, d) => s + d.numberOfPallets, 0)} Pal
                          </span>
                        </div>
                        {o.overlapWarning && (
                          <p className="px-3 py-1.5 text-[11px] text-amber-800 bg-amber-50 border-b border-amber-200">
                            Die Abholfenster dieser Spenden überschneiden sich nicht. Bitte Termin mit der Filiale abstimmen.
                          </p>
                        )}
                        <ul className="divide-y divide-slate-100">
                          {o.donations.map((d) => (
                            <li key={d.id} className="px-3 py-2 flex flex-col md:flex-row md:items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs"><b>{d.productName}</b> <span className="text-slate-500">· {categoryLabel(d.category)} · {tempLabel(d.temperatureRange)}</span></div>
                                <div className="font-mono text-[11px] text-slate-500">{weightKg(d)} kg ({d.numberOfPallets} Pal) · {fmtDateTime(d.overlapStart)} – {fmtDateTime(d.overlapEnd)}</div>
                              </div>
                              {rowSelect(d)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {skipped.length > 0 && (
                      <div className="border border-dashed border-slate-300 rounded-md">
                        <div className="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200">Nicht in diesem Lauf (bleibt reserviert)</div>
                        <ul className="divide-y divide-slate-100">
                          {skipped.map((d) => (
                            <li key={d.id} className="px-3 py-2 flex flex-col md:flex-row md:items-center gap-2">
                              <div className="flex-1 text-xs"><b>{d.productName}</b> <span className="text-slate-500">· {weightKg(d)} kg · {fmtDateTime(d.overlapStart)} – {fmtDateTime(d.overlapEnd)}</span></div>
                              {rowSelect(d)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <footer className="px-4 md:px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-slate-600">
                {totals.orders} Auftrag/Aufträge · {totals.positions} Spende(n){totals.skipped > 0 ? ` · ${totals.skipped} zurückgestellt` : ''}
              </span>
              <div className="flex gap-2">
                <button type="button" className={btnGhost} onClick={close} disabled={pending}>Abbrechen</button>
                <button type="button" className={btnPrimary} onClick={confirm} disabled={pending || totals.orders === 0}>
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
