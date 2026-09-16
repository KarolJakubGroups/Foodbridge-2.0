import type { Role, TemperatureRange } from './types';

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

export const TEMPERATURES: { value: TemperatureRange; label: string }[] = [
  { value: 'AMBIENT', label: 'Ambient (+18°)' },
  { value: 'CHILLED', label: 'Gekühlt (+2° bis +5°)' },
  { value: 'FROZEN', label: 'Tiefkühl (−18°)' },
];
export function tempLabel(value: string): string {
  return TEMP_LABEL[value as TemperatureRange] ?? value;
}

export const TEMP_LABEL: Record<TemperatureRange, string> = {
  AMBIENT: 'Ambient (+18°)',
  CHILLED: 'Gekühlt (+2° bis +5°)',
  FROZEN: 'Tiefkühl (−18°)',
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
