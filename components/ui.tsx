import type { ReactNode } from 'react';
import type { DonationState, TransportStatus, UserStatus } from '@/lib/domain';
import { APPLICATION_LABEL, STATE_LABEL, TRANSPORT_LABEL, tempKind, tempLabel, tempShort, type TempKind } from '@/lib/format';
import { AlertIcon, CheckIcon, SnowflakeIcon, SunIcon, ThermometerIcon, XIcon } from '@/components/icons';
import { foodImage, monogram, monogramColor } from '@/lib/images';

// ------------------------------------------------------------------ tones
export type Tone = 'brand' | 'green' | 'violet' | 'blue' | 'orange' | 'red' | 'gray' | 'sand' | 'cold' | 'frozen';

/** Soft background + dark text of the same hue; every pair passes 4.5:1. */
export const TONE: Record<Tone, string> = {
  green: 'bg-[#e6f4ec] text-[#1e6b45]',
  brand: 'bg-brand-50 text-brand-800',
  violet: 'bg-[#efeafb] text-[#5b21b6]',
  blue: 'bg-[#e8eefc] text-[#1e40af]',
  orange: 'bg-[#fdf1e3] text-[#9a4a0a]',
  red: 'bg-[#fdecea] text-[#9b1c14]',
  gray: 'bg-[#eef0f3] text-[#344054]',
  sand: 'bg-[#f3f0ea] text-muted',
  cold: 'bg-[#e0f2f7] text-[#0e5566]',
  frozen: 'bg-[#dde8fd] text-[#1e3a8a]',
};

export function Pill({ tone = 'sand', children, className = '', wrap = false }: { tone?: Tone; children: ReactNode; className?: string; wrap?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${wrap ? '' : 'whitespace-nowrap'} rounded-full px-2.5 py-1 text-[13px] font-semibold ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export const STATE_TONE: Record<DonationState, Tone> = {
  OPEN: 'green', PARTIAL: 'green', RESERVED: 'brand', SCHEDULED: 'blue', COLLECTED: 'gray', EXPIRED: 'red', WITHDRAWN: 'sand',
};
export const TRANSPORT_TONE: Record<TransportStatus, Tone> = { PENDING: 'brand', DISPATCHED: 'orange', COMPLETED: 'gray' };
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

const TEMP_STYLE: Record<TempKind, { tone: Tone; Icon: typeof SnowflakeIcon }> = {
  frozen: { tone: 'frozen', Icon: SnowflakeIcon },
  chilled: { tone: 'cold', Icon: ThermometerIcon },
  ambient: { tone: 'orange', Icon: SunIcon },
  custom: { tone: 'sand', Icon: ThermometerIcon },
};

/**
 * Storage chip with an icon so the cold chain is visible at a glance:
 * snowflake for frozen, blue thermometer for chilled, sun for room temperature.
 * A donor's own (possibly long) description may wrap.
 */
export function TempPill({ value, full = false }: { value: string; full?: boolean }) {
  const { tone, Icon } = TEMP_STYLE[tempKind(value)];
  return (
    <Pill tone={tone} wrap>
      <Icon className="size-4 shrink-0" />
      <span>{full ? tempLabel(value) : tempShort(value)}</span>
    </Pill>
  );
}

/** Four-step progress of an offer: offen → reserviert → Abholung geplant → abgeholt. */
const STEP: Partial<Record<DonationState, number>> = { OPEN: 1, PARTIAL: 1, RESERVED: 2, SCHEDULED: 3, COLLECTED: 4 };
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

const BTN_BASE = 'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/25 active:scale-[0.98]';
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white shadow-[0_6px_16px_rgba(74,38,149,0.22)] hover:bg-brand-800 active:bg-brand-900',
  dark: 'bg-ink text-white hover:bg-ink-2',
  ghost: 'border border-control bg-white text-ink hover:bg-sand',
  danger: 'bg-[#b42318] text-white hover:bg-[#9b1c14]',
  dangerGhost: 'border border-[#eeb4ad] bg-white text-[#b42318] hover:bg-[#fdecea]',
  quiet: 'text-brand-700 hover:bg-brand-50',
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 rounded-full text-[15px]',
  md: 'h-12 px-6 rounded-full text-base',
  lg: 'h-14 px-8 rounded-full text-lg',
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
        <h1 className="font-display text-[30px] md:text-[36px] font-bold tracking-[-0.02em] text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-base md:text-lg text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 shrink-0 no-print">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xl font-bold tracking-[-0.01em] text-ink">{children}</h2>
      {aside && <span className="text-base text-muted">{aside}</span>}
    </div>
  );
}

export function Card({
  title, subtitle, actions, children, className = '', flush = false,
}: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`bg-white rounded-3xl shadow-card ${className}`}>
      {(title || actions) && (
        <header className={`flex flex-wrap items-start justify-between gap-3 px-5 md:px-7 pt-5 md:pt-6 ${flush ? 'pb-4' : ''}`}>
          <div className="min-w-0">
            {title && <h2 className="text-xl font-bold tracking-[-0.01em] text-ink">{title}</h2>}
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
      {icon && <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">{icon}</span>}
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <p className="max-w-md text-[15px] text-muted">{children}</p>}
    </div>
  );
}

/** A number with a label, e.g. on impact cards. */
export function Stat({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-sand px-4 py-3.5 ${className}`}>
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
  'w-full h-12 rounded-xl border border-transparent bg-sand px-4 text-base text-ink placeholder:text-subtle focus:outline-none focus:bg-white focus:border-brand-700 focus:ring-4 focus:ring-brand-700/15 disabled:opacity-60';

/** A selectable chip (radio or toggle). */
export function chipCls(active: boolean): string {
  return `inline-flex items-center gap-2 h-11 px-4 rounded-full text-[15px] font-semibold transition-colors ${active
    ? 'border border-brand-700 bg-brand-700 text-white'
    : 'border border-control bg-white text-ink-2 hover:bg-sand'}`;
}

export function Alert({ kind = 'error', children, onClose }: {
  kind?: 'error' | 'ok'; children: ReactNode; onClose?: () => void;
}) {
  const ok = kind === 'ok';
  return (
    <div role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-[15px] ${ok ? TONE.green : TONE.red}`}>
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

/** How much of an offer is reserved, as a bar: "3 von 5 Paletten reserviert". */
export function PalletBar({ claimed, total, className = '' }: { claimed: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((claimed / total) * 100) : 0;
  return (
    <div className={`h-2 w-full rounded-full bg-line overflow-hidden ${className}`} role="img" aria-label={`${claimed} von ${total} Paletten reserviert`}>
      <div className="h-full rounded-full bg-brand-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Round badge with an organisation's initials in its own stable colour. */
export function Monogram({ name, size = 'md', ring = false }: { name: string; size?: 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const cls = size === 'sm' ? 'size-8 text-[11px]' : size === 'lg' ? 'size-12 text-[15px]' : 'size-10 text-[13px]';
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${cls} ${ring ? 'ring-[3px] ring-white' : ''}`}
      style={{ background: monogramColor(name) }}>
      {monogram(name)}
    </span>
  );
}

/** White pill laid over a photo. */
export function PhotoPill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[13px] font-semibold text-ink shadow-sm ${className}`}>
      {children}
    </span>
  );
}

/** Product photo for an offer; `className` sets its size. */
export function FoodPhoto({ item, className = '', alt }: { item: Parameters<typeof foodImage>[0]; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={foodImage(item)} alt={alt ?? ''} className={`object-cover bg-sand ${className}`} loading="lazy" />;
}
