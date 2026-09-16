import type { ReactNode } from 'react';
import type { DonationStatus, ImpactReport, TransportStatus } from '../types';
import { fmtKg } from '../format';

const BADGE_STYLES: Record<DonationStatus | TransportStatus, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CLAIMED: 'bg-amber-100 text-amber-800 border-amber-200',
  BUNDLED: 'bg-sky-100 text-sky-800 border-sky-200',
  COMPLETED: 'bg-slate-200 text-slate-700 border-slate-300',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  DISPATCHED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export function Badge({ status }: { status: DonationStatus | TransportStatus }) {
  return (
    <span className={`font-mono inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${BADGE_STYLES[status]}`}>
      {status}
    </span>
  );
}

export function Card({
  title, subtitle, actions, children, className = '',
}: { title?: string; subtitle?: string; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-md shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            {title && <h2 className="text-sm font-bold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400';
export const btnPrimary =
  'bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded disabled:opacity-50';
export const btnDark =
  'bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50';
export const btnGhost =
  'border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50';

export function Alert({ kind = 'error', children, onClose }: { kind?: 'error' | 'ok'; children: ReactNode; onClose?: () => void }) {
  const cls = kind === 'error'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800';
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 border rounded px-3 py-2 text-xs mb-4 ${cls}`}>
      <span>{children}</span>
      {onClose && <button type="button" onClick={onClose} className="font-bold" aria-label="Schliessen">×</button>}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
}

export function Table<T>({ columns, rows, empty = 'Keine Einträge.', rowKey }: {
  columns: Column<T>[]; rows: T[]; empty?: string; rowKey: (row: T) => string | number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600 border-b border-slate-200">
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-bold ${c.className ?? ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">{empty}</td></tr>
          )}
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-slate-100 hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 align-top ${c.className ?? ''}`}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImpactChip({ impact }: { impact: ImpactReport | null }) {
  if (!impact) return null;
  return (
    <div className="font-mono text-[11px] bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700">
      CO₂-Einsparung: <b>{fmtKg(impact.co2SavedKg)}</b> | Mahlzeiten: <b>{impact.meals}</b> | Gerettet: <b>{fmtKg(impact.totalWeightKg)}</b>
    </div>
  );
}

export function Kpi({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md px-4 py-3">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="font-mono text-xl font-bold text-slate-900">
        {value} {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}
