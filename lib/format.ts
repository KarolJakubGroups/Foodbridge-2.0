import type { Category, DonationState, Role, TemperatureRange } from './domain';

const ZURICH = 'Europe/Zurich';

const dateTimeFmt = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZURICH, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const dateFmt = new Intl.DateTimeFormat('de-CH', { timeZone: ZURICH, day: '2-digit', month: '2-digit', year: 'numeric' });

/** Formats an ISO timestamp in Swiss local time, identical on server and client. */
export function fmtDateTime(iso: Date | string | null | undefined): string {
  if (!iso) return '–';
  return dateTimeFmt.format(new Date(iso)).replace(', ', ', ');
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

export function fmtNumber(n: number | string | null | undefined, maxFractionDigits = 1): string {
  return Number(n ?? 0).toLocaleString('de-CH', { maximumFractionDigits: maxFractionDigits });
}

export function fmtKg(n: number | string | null | undefined): string {
  return `${fmtNumber(n)} kg`;
}

export const TEMP_LABEL: Record<TemperatureRange, string> = {
  AMBIENT: 'Raumtemperatur (+15 bis +25 °C)',
  COOL: 'Kühl (+8 bis +12 °C)',
  CHILLED: 'Gekühlt (+2 bis +5 °C)',
  SUPERCHILLED: 'Stark gekühlt (0 bis +2 °C)',
  FROZEN: 'Tiefgekühlt (−18 °C)',
};
export const TEMPERATURES = (Object.entries(TEMP_LABEL) as [TemperatureRange, string][]).map(([value, label]) => ({ value, label }));

/** Full label of a preset, or the donor's own description as entered. */
export function tempLabel(value: string): string {
  return TEMP_LABEL[value as TemperatureRange] ?? value;
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
