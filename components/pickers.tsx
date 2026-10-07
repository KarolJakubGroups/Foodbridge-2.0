'use client';

import {
  useEffect, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from '@/components/icons';

// Looks like `inputCls`, but is a button that opens our own panel instead of the browser's.
const TRIGGER = 'w-full flex items-center gap-2.5 rounded-xl border border-transparent bg-sand px-4 text-base text-left text-ink transition-colors '
  + 'hover:bg-[#efede8] focus:outline-none focus-visible:bg-white focus-visible:border-brand-700 focus-visible:ring-4 focus-visible:ring-brand-700/15 '
  + 'aria-expanded:bg-white aria-expanded:border-brand-700 aria-expanded:ring-4 aria-expanded:ring-brand-700/15 disabled:opacity-60 disabled:cursor-not-allowed';
const PANEL = 'fixed z-50 bg-white rounded-2xl border border-line-soft shadow-lift';

// ---------------------------------------------------------------- popover
/**
 * Floating panel under (or, without room, above) its trigger. Rendered into
 * <body> so dialogs with their own scrolling never clip it.
 */
function Popover({ anchor, onClose, width, children, ...rest }: {
  anchor: RefObject<HTMLElement | null>; onClose: () => void; width?: number; children: ReactNode;
  id?: string; role?: string; 'aria-label'?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const height = panel.current?.offsetHeight ?? 0;
      const below = window.innerHeight - a.bottom;
      const w = Math.min(Math.max(a.width, width ?? 0), window.innerWidth - 16);
      const up = below < height + 16 && a.top > below;
      setPos({ top: up ? a.top - 8 : a.bottom + 8, left: Math.min(Math.max(8, a.left), window.innerWidth - w - 8), width: w, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor, width]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [anchor, onClose]);

  return createPortal(
    <div ref={panel} {...rest} className={PANEL}
      style={pos
        ? { top: pos.top, left: pos.left, width: pos.width, transform: pos.up ? 'translateY(-100%)' : undefined }
        : { top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}>
      {children}
    </div>,
    document.body,
  );
}

// ----------------------------------------------------------------- select
export interface SelectOption<T extends string = string> { value: T; label: string }

/** Dropdown in the app's style: same look as text inputs, list with a check on the chosen entry. */
export function Select<T extends string>({
  value, onChange, options, placeholder = 'Bitte wählen…', icon, chevron = true, size = 'md', className = '', disabled, id, minWidth, ...aria
}: {
  value: T | ''; onChange: (value: T) => void; options: SelectOption<T>[]; placeholder?: string; icon?: ReactNode; chevron?: boolean;
  size?: 'sm' | 'md'; className?: string; disabled?: boolean; id?: string; minWidth?: number; 'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();
  const selected = options.findIndex((o) => o.value === value);

  const show = () => { setActive(Math.max(0, selected)); setOpen(true); };
  const close = () => setOpen(false);
  const pick = (i: number) => {
    if (options[i]) onChange(options[i].value);
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  const onKeyDown = (e: KeyboardEvent) => {
    const move = (i: number) => { e.preventDefault(); setActive(Math.min(options.length - 1, Math.max(0, i))); };
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'ArrowDown') move(active + 1);
    else if (e.key === 'ArrowUp') move(active - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close();
    else if (e.key.length === 1) {
      // Type to jump: "t" finds "Tiefgekühlt".
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) move(hit);
    }
  };

  return (
    <>
      <button ref={trigger} type="button" id={id} disabled={disabled} role="combobox" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined} {...aria}
        className={`${TRIGGER} ${size === 'sm' ? 'h-11' : 'h-12'} ${className}`}
        onClick={() => (open ? close() : show())} onKeyDown={onKeyDown}>
        {icon && <span className="shrink-0 text-subtle">{icon}</span>}
        <span className={`flex-1 min-w-0 truncate ${selected < 0 ? 'text-subtle' : ''}`}>{options[selected]?.label ?? placeholder}</span>
        {chevron && <ChevronDownIcon className={`size-5 shrink-0 text-subtle transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <Popover anchor={trigger} onClose={close} width={minWidth}>
          <ul id={listId} role="listbox" aria-label={aria['aria-label']} className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
            {options.map((o, i) => {
              const chosen = i === selected;
              return (
                <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={chosen}
                  onPointerMove={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}
                  className={`flex items-center gap-3 min-h-11 px-3.5 py-2 rounded-xl text-base cursor-pointer select-none
                    ${i === active ? 'bg-sand' : ''} ${chosen ? 'font-semibold text-brand-700' : 'text-ink'}`}>
                  <span className="flex-1">{o.label}</span>
                  {chosen && <CheckIcon className="size-4 shrink-0" />}
                </li>
              );
            })}
          </ul>
        </Popover>
      )}
    </>
  );
}

// ------------------------------------------------------------------ dates
// Dates are 'YYYY-MM-DD' strings in the browser's local time, like <input type="date">.
const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number) => { const d = fromIso(s); d.setDate(d.getDate() + n); return toIso(d); };
function addMonths(s: string, n: number) {
  const d = fromIso(s);
  const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toIso(d);
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const monthFmt = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'short' });
/** Compact enough for half-width fields: "Mi., 07.10." (year only when it is not this year). */
function shortDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${weekdayFmt.format(fromIso(iso))}, ${d}.${m}.${Number(y) === new Date().getFullYear() ? '' : y}`;
}

function Calendar({ value, min, onPick }: { value: string; min?: string; onPick: (iso: string) => void }) {
  const today = toIso(new Date());
  const [focus, setFocus] = useState(() => value || (min && min > today ? min : today));
  const grid = useRef<HTMLDivElement>(null);

  // Keep keyboard focus on the highlighted day, also after switching months.
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focus}"]`)?.focus();
  }, [focus]);

  const first = fromIso(`${focus.slice(0, 7)}-01`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, i) => toIso(new Date(first.getFullYear(), first.getMonth(), i + 1)));
  const blocked = (iso: string) => Boolean(min && iso < min);
  const go = (iso: string) => setFocus(min && iso < min ? min : iso);
  const canGoBack = !min || addMonths(focus, -1).slice(0, 7) >= min.slice(0, 7);

  const onKeyDown = (e: KeyboardEvent) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, -1), PageDown: () => addMonths(focus, 1),
      Home: () => addDays(focus, -((fromIso(focus).getDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((fromIso(focus).getDay() + 6) % 7)),
    };
    if (step[e.key]) { e.preventDefault(); go(step[e.key]()); }
  };

  return (
    <div className="p-4 select-none">
      <div className="flex items-center justify-between gap-2 pb-3">
        <button type="button" className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-sand disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={() => go(addMonths(focus, -1))} disabled={!canGoBack} aria-label="Vorheriger Monat">
          <ChevronLeftIcon />
        </button>
        <span className="text-base font-bold text-ink" aria-live="polite">{monthFmt.format(first)}</span>
        <button type="button" className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-sand"
          onClick={() => go(addMonths(focus, 1))} aria-label="Nächster Monat">
          <ChevronRightIcon />
        </button>
      </div>
      <div ref={grid} role="grid" className="grid grid-cols-7 gap-y-1 justify-items-center" onKeyDown={onKeyDown}>
        {WEEKDAYS.map((w) => <span key={w} role="columnheader" className="pb-1 text-[13px] font-semibold text-subtle">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
        {days.map((iso) => {
          const chosen = iso === value;
          const isToday = iso === today;
          return (
            <button key={iso} type="button" role="gridcell" data-iso={iso} tabIndex={iso === focus ? 0 : -1}
              disabled={blocked(iso)} aria-selected={chosen} aria-label={dayFmt.format(fromIso(iso))} aria-current={isToday ? 'date' : undefined}
              onClick={() => onPick(iso)}
              className={`size-10 rounded-full text-[15px] tabular-nums transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/25
                disabled:text-control disabled:cursor-not-allowed
                ${chosen ? 'bg-brand-700 text-white font-semibold'
                  : isToday ? 'font-bold text-brand-700 bg-brand-50 hover:bg-brand-100'
                    : 'text-ink hover:bg-sand'}`}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      {!blocked(today) && (
        <div className="pt-3 mt-2 border-t border-line-soft flex justify-end">
          <button type="button" className="h-9 px-3 rounded-full text-[15px] font-semibold text-brand-700 hover:bg-brand-50" onClick={() => onPick(today)}>
            Heute
          </button>
        </div>
      )}
    </div>
  );
}

/** Date field with our own calendar. `value` and `min` are 'YYYY-MM-DD'. */
export function DatePicker({ value, onChange, min, placeholder = 'Datum wählen', id, className = '', ...aria }: {
  value: string; onChange: (iso: string) => void; min?: string; placeholder?: string; id?: string; className?: string; 'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };

  return (
    <>
      <button ref={trigger} type="button" id={id} aria-haspopup="dialog" aria-expanded={open} {...aria}
        className={`${TRIGGER} h-12 ${className}`} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}>
        <CalendarIcon className="size-5 shrink-0 text-subtle" />
        <span className={`flex-1 min-w-0 truncate ${value ? '' : 'text-subtle'}`}>{value ? shortDate(value) : placeholder}</span>
      </button>
      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} width={328} role="dialog" aria-label={aria['aria-label'] ?? 'Datum wählen'}>
          <div onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } }}>
            <Calendar value={value} min={min} onPick={(iso) => { onChange(iso); close(); }} />
          </div>
        </Popover>
      )}
    </>
  );
}

/** Times every half hour; a value off that grid (e.g. from a copied offer) stays selectable. */
function timeOptions(current: string): SelectOption[] {
  const times = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);
  if (current && !times.includes(current)) times.push(current);
  return times.sort().map((t) => ({ value: t, label: t }));
}

/** Date and time side by side. `value` is 'YYYY-MM-DDTHH:mm', like <input type="datetime-local">. */
export function DateTimePicker({ value, onChange, min, label }: {
  value: string; onChange: (value: string) => void; min?: string; label: string;
}) {
  const [date = '', time = ''] = value.split('T');
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] gap-2">
      <DatePicker value={date} min={min} aria-label={`${label}: Datum`} onChange={(d) => onChange(`${d}T${time || '08:00'}`)} />
      <Select value={time} options={timeOptions(time)} minWidth={160} aria-label={`${label}: Uhrzeit`} placeholder="Zeit"
        icon={<ClockIcon className="size-5" />} chevron={false} onChange={(t) => onChange(`${date || toIso(new Date())}T${t}`)} />
    </div>
  );
}
