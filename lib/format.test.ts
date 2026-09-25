import { describe, expect, it } from 'vitest';
import { normalizeTemperature } from './domain';
import { fmtBestBefore, fmtCount, fmtDay, fmtTimeLeft, fmtWindow, initials, isCold, tempKind, tempLabel, tempShort } from './format';

describe('storage temperature', () => {
  it('keeps presets and trims own descriptions', () => {
    expect(normalizeTemperature('CHILLED')).toBe('CHILLED');
    expect(normalizeTemperature('  +12 bis   +15 °C ')).toBe('+12 bis +15 °C');
    expect(normalizeTemperature('   ')).toBeNull();
    expect(normalizeTemperature('x'.repeat(61))).toBeNull();
  });

  it('labels presets and shows own descriptions as entered', () => {
    expect(tempLabel('FROZEN')).toBe('Tiefgekühlt (−18 °C)');
    expect(tempShort('COOL')).toBe('Kühl');
    expect(tempShort('+12 bis +15 °C')).toBe('+12 bis +15 °C');
    expect(isCold('SUPERCHILLED')).toBe(true);
    expect(isCold('AMBIENT')).toBe(false);
    expect(isCold('+12 bis +15 °C')).toBe(false);
  });
});

describe('plain-language formatting', () => {
  // 25.09.2026 10:00 in Zurich (UTC+2)
  const now = new Date('2026-09-25T08:00:00Z');

  it('uses singular and plural', () => {
    expect(fmtCount(1, 'Palette', 'Paletten')).toBe('1 Palette');
    expect(fmtCount(3, 'Palette', 'Paletten')).toBe('3 Paletten');
  });

  it('names today and tomorrow in Swiss local time', () => {
    expect(fmtDay(new Date('2026-09-25T20:00:00Z'), now)).toBe('Heute');
    expect(fmtDay(new Date('2026-09-25T22:30:00Z'), now)).toBe('Morgen'); // 00:30 on the 26th in Zurich
    expect(fmtDay(new Date('2026-09-28T10:00:00Z'), now)).toBe('Mo 28.09.');
  });

  it('flags a best-before date within two days', () => {
    expect(fmtBestBefore('2026-09-25', now)).toEqual({ text: 'Nur noch heute haltbar', urgent: true });
    expect(fmtBestBefore('2026-09-27', now)).toEqual({ text: 'Nur noch 2 Tage haltbar', urgent: true });
    expect(fmtBestBefore('2026-10-04', now).urgent).toBe(false);
    expect(fmtBestBefore('2026-09-24', now).urgent).toBe(true);
  });

  it('builds avatar initials from an organisation name', () => {
    expect(initials('Frischmarkt Oerlikon')).toBe('FO');
    expect(initials('Coop')).toBe('CO');
  });
});

describe('fmtWindow', () => {
  const now = new Date('2026-09-25T08:00:00.000Z');
  it('shows one day once and both times', () => {
    expect(fmtWindow('2026-09-26T05:00:00.000Z', '2026-09-26T10:00:00.000Z', now)).toBe('Morgen, 07:00–12:00');
  });
  it('names both days when the window spans midnight', () => {
    expect(fmtWindow('2026-09-26T05:00:00.000Z', '2026-09-27T07:00:00.000Z', now)).toBe('Morgen, 07:00 – So 27.09., 09:00');
  });
});

describe('fmtTimeLeft', () => {
  const MIN = 60_000; const H = 60 * MIN; const D = 24 * H;
  it('uses the two largest units', () => {
    expect(fmtTimeLeft(3 * D + 4 * H + 5 * MIN)).toBe('3 Tage 4 Std');
    expect(fmtTimeLeft(D)).toBe('1 Tag');
    expect(fmtTimeLeft(5 * H + 20 * MIN)).toBe('5 Std 20 Min');
    expect(fmtTimeLeft(2 * H)).toBe('2 Std');
    expect(fmtTimeLeft(12 * MIN + 30_000)).toBe('12 Min');
    expect(fmtTimeLeft(30_000)).toBe('weniger als 1 Min');
  });
  it('is null once the deadline has passed', () => {
    expect(fmtTimeLeft(0)).toBeNull();
    expect(fmtTimeLeft(-1)).toBeNull();
  });
});

describe('tempKind', () => {
  it('maps presets to the three icon families and keeps own text separate', () => {
    expect(tempKind('FROZEN')).toBe('frozen');
    expect(['CHILLED', 'SUPERCHILLED', 'COOL'].map(tempKind)).toEqual(['chilled', 'chilled', 'chilled']);
    expect(tempKind('AMBIENT')).toBe('ambient');
    expect(tempKind('+8 bis +12 °C')).toBe('custom');
  });
});
