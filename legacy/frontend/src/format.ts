import type { Role, TemperatureRange } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function fmtKg(n: number | null | undefined): string {
  return `${Number(n ?? 0).toLocaleString('de-CH', { maximumFractionDigits: 1 })} kg`;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString('de-CH');
}

export const TEMPERATURES: { value: TemperatureRange; label: string }[] = [
  { value: 'AMBIENT', label: 'Ambient (+18°)' },
  { value: 'CHILLED', label: 'Gekühlt (+2° bis +5°)' },
  { value: 'FROZEN', label: 'Tiefkühl (−18°)' },
];
export const TEMP_LABEL: Record<TemperatureRange, string> = Object.fromEntries(
  TEMPERATURES.map((t) => [t.value, t.label]),
) as Record<TemperatureRange, string>;

export const ROLE_LABEL: Record<Role, string> = {
  DONOR: 'Spender',
  FOODBANK: 'Abgabestelle',
  DISPATCHER: 'Disponent',
};
