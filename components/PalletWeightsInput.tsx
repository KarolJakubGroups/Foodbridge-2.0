'use client';

import { MAX_PALLETS, MAX_WEIGHT_PER_PALLET, uniformWeight } from '@/lib/domain';
import { fmtKg } from '@/lib/format';
import { MinusIcon, PlusIcon } from '@/components/icons';

/**
 * Pallets as the donor enters them: by default one weight for all, or, once
 * "Paletten wiegen unterschiedlich" is on, a weight per pallet.
 */
export interface PalletWeightsState {
  count: string;
  /** Weight of every pallet while `individual` is off. */
  common: string;
  individual: boolean;
  /** Weight per pallet while `individual` is on; kept in step with `count`. */
  weights: string[];
}

export function initialPalletWeights(weights?: readonly number[]): PalletWeightsState {
  if (!weights || weights.length === 0) return { count: '1', common: '', individual: false, weights: [''] };
  const same = uniformWeight(weights);
  return {
    count: String(weights.length),
    common: String(same ?? weights[0]),
    individual: same === null,
    weights: weights.map(String),
  };
}

export function palletCount(s: PalletWeightsState): number {
  return Number(s.count) || 0;
}

/** The weights to send, one per pallet (0 where nothing valid was entered). */
export function palletWeightValues(s: PalletWeightsState): number[] {
  const n = Math.min(MAX_PALLETS, Math.max(0, Math.floor(palletCount(s))));
  return Array.from({ length: n }, (_, i) => Number(s.individual ? s.weights[i] : s.common) || 0);
}

/** Grows or shrinks the per-pallet list; new pallets start with the last weight entered. */
function resize(weights: string[], n: number, fill: string): string[] {
  if (weights.length >= n) return weights.slice(0, n);
  const last = weights.at(-1) || fill;
  return [...weights, ...Array.from({ length: n - weights.length }, () => last)];
}

const weightInput = (props: { id: string; value: string; onChange: (v: string) => void; label?: string; autoFocus?: boolean }) => (
  <span className="relative">
    <input id={props.id} type="number" inputMode="decimal" min={0.1} max={MAX_WEIGHT_PER_PALLET} step={0.1} required
      aria-label={props.label} autoFocus={props.autoFocus}
      className="w-full h-12 rounded-xl border border-control bg-white pl-4 pr-12 text-base text-ink placeholder:text-subtle focus:outline-none focus:border-brand-700 focus:ring-4 focus:ring-brand-700/15"
      value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder="z. B. 250" />
    <span className="pointer-events-none absolute right-4 top-3 text-base text-muted">kg</span>
  </span>
);

export function PalletWeightsInput({ value, onChange, countLabel = 'Anzahl Paletten', idPrefix = 'pallets' }: {
  value: PalletWeightsState;
  onChange: (next: PalletWeightsState) => void;
  countLabel?: string;
  idPrefix?: string;
}) {
  const count = palletCount(value);
  const total = palletWeightValues(value).reduce((s, w) => s + w, 0);

  const setCount = (raw: string) => {
    const n = Math.min(MAX_PALLETS, Math.max(0, Math.floor(Number(raw) || 0)));
    // A single pallet has one weight: leave the per-pallet list.
    if (value.individual && n === 1) return onChange({ ...value, count: raw, individual: false, common: value.weights[0] ?? value.common });
    onChange({ ...value, count: raw, weights: value.individual ? resize(value.weights, Math.max(1, n), value.common) : value.weights });
  };
  const step = (delta: number) => setCount(String(Math.min(MAX_PALLETS, Math.max(1, count + delta))));
  const setIndividual = (on: boolean) => onChange(on
    ? { ...value, individual: true, weights: Array.from({ length: Math.max(1, count) }, () => value.common) }
    : { ...value, individual: false, common: value.weights[0] ?? value.common });
  const setWeight = (i: number, w: string) => onChange({ ...value, weights: value.weights.map((x, j) => (j === i ? w : x)) });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4 md:gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-count`} className="text-base font-semibold text-ink">{countLabel}</label>
          <div className="flex items-center h-12 rounded-xl border border-control overflow-hidden bg-white">
            <button type="button" aria-label="Eine Palette weniger" onClick={() => step(-1)} disabled={count <= 1}
              className="flex size-12 items-center justify-center bg-sand text-ink hover:bg-line-soft disabled:opacity-40">
              <MinusIcon className="size-5" />
            </button>
            <input id={`${idPrefix}-count`} type="number" inputMode="numeric" min={1} max={MAX_PALLETS} step={1} required
              value={value.count} onChange={(e) => setCount(e.target.value)}
              className="w-16 h-full text-center text-lg font-bold text-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            <button type="button" aria-label="Eine Palette mehr" onClick={() => step(1)} disabled={count >= MAX_PALLETS}
              className="flex size-12 items-center justify-center bg-sand text-ink hover:bg-line-soft disabled:opacity-40">
              <PlusIcon className="size-5" />
            </button>
          </div>
        </div>
        {!value.individual && (
          <div className="flex flex-col gap-2 w-44">
            <label htmlFor={`${idPrefix}-common`} className="text-base font-semibold text-ink">
              {count > 1 ? 'Gewicht pro Palette' : 'Gewicht der Palette'}
            </label>
            {weightInput({ id: `${idPrefix}-common`, value: value.common, onChange: (w) => onChange({ ...value, common: w }) })}
          </div>
        )}
        <div className="h-12 flex items-center rounded-xl bg-sand px-5 text-[17px] text-ink-2" aria-live="polite">
          Total&nbsp;<b className="text-ink">{fmtKg(total)}</b>
        </div>
      </div>

      {count > 1 && (
        <label className="flex items-center gap-3 self-start cursor-pointer select-none">
          <input type="checkbox" checked={value.individual} onChange={(e) => setIndividual(e.target.checked)}
            className="size-6 rounded-md accent-brand-700" />
          <span className="text-base text-ink">Paletten wiegen unterschiedlich</span>
        </label>
      )}

      {value.individual && count > 1 && (
        <div className="grid grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4 gap-3" role="group" aria-label="Gewicht jeder Palette">
          {value.weights.slice(0, count).map((w, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-w${i}`} className="text-[15px] font-semibold text-ink-2">Palette {i + 1}</label>
              {weightInput({ id: `${idPrefix}-w${i}`, value: w, onChange: (v) => setWeight(i, v), autoFocus: i === 0 })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
