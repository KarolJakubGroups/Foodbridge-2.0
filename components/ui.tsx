import type { ReactNode } from 'react';
import type { DonationState, TransportStatus, UserStatus } from '@/lib/domain';
import { APPLICATION_LABEL, STATE_LABEL, TRANSPORT_LABEL, isCold, tempShort } from '@/lib/format';
import { AlertIcon, CheckIcon, XIcon } from '@/components/icons';

// ------------------------------------------------------------------ tones
export type Tone = 'green' | 'violet' | 'blue' | 'orange' | 'red' | 'gray' | 'sand' | 'cold';

/** Soft background + dark text of the same hue; every pair passes 4.5:1. */
export const TONE: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-800',
  violet: 'bg-[#efeafb] text-[#5b21b6]',
  blue: 'bg-[#e8eefc] text-[#1e40af]',
  orange: 'bg-[#fdf1e3] text-[#9a4a0a]',
  red: 'bg-[#fdecea] text-[#9b1c14]',
  gray: 'bg-[#eef0f3] text-[#344054]',
  sand: 'bg-[#f3f0ea] text-muted',
  cold: 'bg-[#e8f3f8] text-[#155e75]',
};

export function Pill({ tone = 'sand', children, className = '', wrap = false }: { tone?: Tone; children: ReactNode; className?: string; wrap?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${wrap ? '' : 'whitespace-nowrap'} rounded-lg px-2.5 py-1 text-sm font-semibold ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export const STATE_TONE: Record<DonationState, Tone> = {
  OPEN: 'green', RESERVED: 'violet', SCHEDULED: 'blue', COLLECTED: 'gray', EXPIRED: 'red', WITHDRAWN: 'sand',
};
export const TRANSPORT_TONE: Record<TransportStatus, Tone> = { PENDING: 'violet', DISPATCHED: 'orange', COMPLETED: 'gray' };
const APPLICATION_TONE: Record<UserStatus, Tone> = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' };

/** Business state of an offer in plain German. */
export function StateBadge({ state }: { state: DonationState }) {
  return <Pill tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Pill>;
}

export function TransportBadge({ status }: { status: string }) {
  const s = status as TransportStatus;
  return <Pill tone={TRANSPORT_TONE[s] ?? 'sand'}>{TRANSPORT_LABEL[s] ?? status}</Pill>;
}

export function ApplicationBadge({ status }: { status: string }) {
  const s = status as UserStatus;
  return <Pill tone={APPLICATION_TONE[s] ?? 'sand'}>{APPLICATION_LABEL[s] ?? status}</Pill>;
}

/** Storage chip; a donor's own (possibly long) description may wrap. */
export function TempPill({ value }: { value: string }) {
  return <Pill tone={isCold(value) ? 'cold' : 'sand'} wrap>{tempShort(value)}</Pill>;
}

/** Four-step progress of an offer: offen → reserviert → Abholung geplant → abgeholt. */
const STEP: Partial<Record<DonationState, number>> = { OPEN: 1, RESERVED: 2, SCHEDULED: 3, COLLECTED: 4 };
export function StateProgress({ state }: { state: DonationState }) {
  const step = STEP[state];
  if (!step) return null;
  return (
    <div className="flex gap-1" role="img" aria-label={`Schritt ${step} von 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-700' : 'bg-line'}`} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- buttons
/** `danger` confirms a destructive step; `dangerGhost` is the first click that leads to it. */
type ButtonVariant = 'primary' | 'dark' | 'ghost' | 'danger' | 'dangerGhost' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_BASE = 'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/25';
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900',
  dark: 'bg-ink text-white hover:bg-ink-2',
  ghost: 'border border-control bg-white text-ink hover:bg-sand',
  danger: 'bg-[#b42318] text-white hover:bg-[#9b1c14]',
  dangerGhost: 'border border-[#eeb4ad] bg-white text-[#b42318] hover:bg-[#fdecea]',
  quiet: 'text-brand-700 hover:bg-brand-50',
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-10 px-3.5 rounded-lg text-[15px]',
  md: 'h-12 px-5 rounded-xl text-base',
  lg: 'h-14 px-7 rounded-2xl text-lg',
};

/** Class string for a button or a link styled as one. */
export function btn(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${BTN_BASE} ${BTN_VARIANT[variant]} ${BTN_SIZE[size]}`;
}
export const linkCls = 'font-semibold text-brand-700 underline-offset-4 hover:underline hover:text-brand-800';

// ----------------------------------------------------------------- layout
export function PageHeader({ title, subtitle, actions, back }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 space-y-2">
        {back}
        <h1 className="font-display text-3xl md:text-[38px] font-bold tracking-tight text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-base md:text-lg text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 shrink-0 no-print">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xl font-bold text-ink">{children}</h2>
      {aside && <span className="text-base text-muted">{aside}</span>}
    </div>
  );
}

export function Card({
  title, subtitle, actions, children, className = '', flush = false,
}: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`bg-white border border-line rounded-2xl ${className}`}>
      {(title || actions) && (
        <header className={`flex flex-wrap items-start justify-between gap-3 px-5 md:px-7 pt-5 md:pt-6 ${flush ? 'pb-4' : ''}`}>
          <div className="min-w-0">
            {title && <h2 className="text-xl font-bold text-ink">{title}</h2>}
            {subtitle && <p className="text-[15px] text-muted mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {flush ? children : <div className="px-5 md:px-7 py-5 md:py-6">{children}</div>}
    </section>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 px-6 py-12">
      {icon && <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-sand text-subtle">{icon}</span>}
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <p className="max-w-md text-[15px] text-muted">{children}</p>}
    </div>
  );
}

/** A number with a label, e.g. on impact cards. */
export function Stat({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-sand px-4 py-3.5 ${className}`}>
      <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="text-sm text-muted mt-0.5">{label}</div>
    </div>
  );
}

// ------------------------------------------------------------------ forms
export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-base font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}

// Inputs are 16px+ (no iOS auto-zoom) and 48px tall for touch.
export const inputCls =
  'w-full h-12 rounded-xl border border-control bg-white px-4 text-base text-ink placeholder:text-subtle focus:outline-none focus:border-brand-700 focus:ring-4 focus:ring-brand-700/15 disabled:bg-sand';

/** A selectable chip (radio or toggle). */
export function chipCls(active: boolean): string {
  return `inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-[15px] transition-colors ${active
    ? 'border-2 border-brand-700 bg-brand-50 text-brand-800 font-bold'
    : 'border border-control bg-white text-ink-2 hover:bg-sand'}`;
}

export function Alert({ kind = 'error', children, onClose }: {
  kind?: 'error' | 'ok'; children: ReactNode; onClose?: () => void;
}) {
  const ok = kind === 'ok';
  return (
    <div role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-3 rounded-xl px-4 py-3 text-[15px] ${ok ? TONE.green : TONE.red}`}>
      <span className="mt-0.5 shrink-0">{ok ? <CheckIcon className="size-5" /> : <AlertIcon className="size-5" />}</span>
      <span className="flex-1">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="-m-1.5 p-1.5 rounded-lg hover:bg-black/5" aria-label="Meldung schliessen">
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
