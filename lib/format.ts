import type { Category, DonationState, Role, TemperatureRange, TransportStatus, UserStatus } from './domain';

const ZURICH = 'Europe/Zurich';

const dateTimeFmt = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZURICH, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const dateFmt = new Intl.DateTimeFormat('de-CH', { timeZone: ZURICH, day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('de-CH', { timeZone: ZURICH, hour: '2-digit', minute: '2-digit', hour12: false });
const weekdayFmt = new Intl.DateTimeFormat('de-CH', { timeZone: ZURICH, weekday: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat('de-CH', { timeZone: ZURICH, day: '2-digit', month: '2-digit' });
const longDateFmt = new Intl.DateTimeFormat('de-CH', { timeZone: ZURICH, weekday: 'long', day: 'numeric', month: 'long' });
const monthFmt = new Intl.DateTimeFormat('de-CH', { timeZone: ZURICH, month: 'long' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: ZURICH, hour: '2-digit', hour12: false });

/** Formats an ISO timestamp in Swiss local time, identical on server and client. */
export function fmtDateTime(iso: Date | string | null | undefined): string {
  if (!iso) return '–';
  return dateTimeFmt.format(new Date(iso));
}

/** Formats a date-only value (YYYY-MM-DD) without timezone shifting. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDateOfInstant(iso: Date | string): string {
  return dateFmt.format(new Date(iso));
}

/** "12:00" in Swiss local time. */
export function fmtTime(iso: Date | string): string {
  return timeFmt.format(new Date(iso));
}

/** "Heute", "Morgen" or "Fr 26.09." in Swiss local time. */
export function fmtDay(iso: Date | string, now: Date): string {
  const day = fmtDateOfInstant(iso);
  if (day === fmtDateOfInstant(now)) return 'Heute';
  if (day === fmtDateOfInstant(new Date(now.getTime() + 86_400_000))) return 'Morgen';
  const instant = new Date(iso);
  return `${weekdayFmt.format(instant).replace('.', '')} ${dayMonthFmt.format(instant).replace(/\.?$/, '.')}`;
}

/** "Morgen, 12:00" / "Fr 26.09., 12:00". */
export function fmtDayTime(iso: Date | string, now: Date): string {
  return `${fmtDay(iso, now)}, ${fmtTime(iso)}`;
}

/** "Donnerstag, 25. September". */
export function fmtLongDate(now: Date): string {
  return longDateFmt.format(now);
}

export function fmtMonth(now: Date): string {
  return monthFmt.format(now);
}

export function greeting(now: Date): string {
  const hour = Number(hourFmt.format(now));
  return hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
}

export function fmtNumber(n: number | string | null | undefined, maxFractionDigits = 1): string {
  return Number(n ?? 0).toLocaleString('de-CH', { maximumFractionDigits: maxFractionDigits });
}

export function fmtKg(n: number | string | null | undefined): string {
  return `${fmtNumber(n)} kg`;
}

/** "1 Palette", "3 Paletten". */
export function fmtCount(n: number, singular: string, plural: string): string {
  return `${fmtNumber(n, 0)} ${n === 1 ? singular : plural}`;
}

export const fmtPallets = (n: number) => fmtCount(n, 'Palette', 'Paletten');

/** Whole days from today (Zurich) until a YYYY-MM-DD date; negative when past. */
export function daysUntil(isoDate: string, now: Date): number {
  const [d, m, y] = fmtDateOfInstant(now).split('.').map(Number);
  const today = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = isoDate.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - today) / 86_400_000);
}

/** "Haltbar bis 04.10." with a plain-language hint when it is close. */
export function fmtBestBefore(isoDate: string, now: Date): { text: string; urgent: boolean } {
  const days = daysUntil(isoDate, now);
  if (days < 0) return { text: `Haltbarkeit abgelaufen (${fmtDate(isoDate)})`, urgent: true };
  if (days === 0) return { text: 'Nur noch heute haltbar', urgent: true };
  if (days <= 2) return { text: `Nur noch ${fmtCount(days, 'Tag', 'Tage')} haltbar`, urgent: true };
  if (days <= 14) return { text: `Haltbar noch ${days} Tage (${fmtDate(isoDate).slice(0, 6)})`, urgent: false };
  return { text: `Haltbar bis ${fmtDate(isoDate)}`, urgent: false };
}

export const TEMP_LABEL: Record<TemperatureRange, string> = {
  AMBIENT: 'Raumtemperatur (+15 bis +25 °C)',
  COOL: 'Kühl (+8 bis +12 °C)',
  CHILLED: 'Gekühlt (+2 bis +5 °C)',
  SUPERCHILLED: 'Stark gekühlt (0 bis +2 °C)',
  FROZEN: 'Tiefgekühlt (−18 °C)',
};
const TEMP_SHORT: Record<TemperatureRange, string> = {
  AMBIENT: 'Raumtemperatur',
  COOL: 'Kühl',
  CHILLED: 'Gekühlt',
  SUPERCHILLED: 'Stark gekühlt',
  FROZEN: 'Tiefgekühlt',
};
export const TEMPERATURES = (Object.entries(TEMP_LABEL) as [TemperatureRange, string][]).map(([value, label]) => ({ value, label }));

export function isTemperaturePreset(value: string): value is TemperatureRange {
  return value in TEMP_LABEL;
}

/** Full label of a preset, or the donor's own description as entered. */
export function tempLabel(value: string): string {
  return isTemperaturePreset(value) ? TEMP_LABEL[value] : value;
}

/** Short label for chips and meta lines. */
export function tempShort(value: string): string {
  return isTemperaturePreset(value) ? TEMP_SHORT[value] : value;
}

/** Needs a cold chain: shown with a cool tint. Own descriptions are left neutral. */
export function isCold(value: string): boolean {
  return isTemperaturePreset(value) && value !== 'AMBIENT';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  MEAT_FISH: 'Fleisch & Fisch',
  DAIRY_EGGS: 'Milchprodukte & Eier',
  FRUIT_VEG: 'Obst & Gemüse',
  BAKERY: 'Backwaren',
  DRY_GOODS: 'Trockenware',
  BEVERAGES: 'Getränke',
  READY_MEALS: 'Fertiggerichte',
  OTHER: 'Sonstiges',
};
export const CATEGORIES_OPTIONS = (Object.entries(CATEGORY_LABEL) as [Category, string][]).map(([value, label]) => ({ value, label }));

export function categoryLabel(value: string): string {
  return CATEGORY_LABEL[value as Category] ?? value;
}

export const STATE_LABEL: Record<DonationState, string> = {
  OPEN: 'Offen',
  EXPIRED: 'Abgelaufen',
  RESERVED: 'Reserviert',
  SCHEDULED: 'Abholung geplant',
  COLLECTED: 'Abgeholt',
  WITHDRAWN: 'Zurückgezogen',
};

export const TRANSPORT_LABEL: Record<TransportStatus, string> = {
  PENDING: 'Zu disponieren',
  DISPATCHED: 'Unterwegs',
  COMPLETED: 'Geliefert',
};

export const APPLICATION_LABEL: Record<UserStatus, string> = {
  PENDING: 'Neu',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
};

export const ROLE_LABEL: Record<Role, string> = {
  DONOR: 'Spender',
  FOODBANK: 'Abgabestelle',
  DISPATCHER: 'Disponent',
};

export const ROLE_HOME: Record<Role, string> = {
  DONOR: '/donor',
  FOODBANK: '/foodbank',
  DISPATCHER: '/dispatcher',
};

/** Two-letter avatar initials of an organisation name. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase() || '?';
}
