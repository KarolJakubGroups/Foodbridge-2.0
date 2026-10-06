/**
 * Photos for offers. Donors do not upload pictures yet, so each offer gets a
 * fitting default photo from its product name, storage and category.
 * Sources and licences: public/images/food/CREDITS.md
 */
const BASE = '/images/food';

const BY_NAME: [RegExp, string][] = [
  [/brot|bread|zopf|gipfeli|brötchen|weggli|backwar|kuchen/i, 'bread'],
  [/äpfel|apfel|apple/i, 'apples'],
  [/birne/i, 'pears'],
  [/orange|mandarin|clementin|zitrus|zitrone/i, 'oranges'],
  [/milch|joghurt|jogurt|käse|rahm|butter|quark|drink/i, 'milk'],
  [/tiefkühl|erbsen|tk-|frozen/i, 'frozen'],
];

const BY_CATEGORY: Record<string, string> = {
  BAKERY: 'bread', DAIRY_EGGS: 'milk', FRUIT_VEG: 'apples', READY_MEALS: 'frozen',
};

export function foodImage(item: { productName: string; category?: string | null; temperatureRange?: string | null }): string {
  const byName = BY_NAME.find(([re]) => re.test(item.productName));
  if (byName) return `${BASE}/${byName[1]}.webp`;
  if (item.temperatureRange === 'FROZEN') return `${BASE}/frozen.webp`;
  const byCat = item.category ? BY_CATEGORY[item.category] : undefined;
  return `${BASE}/${byCat ?? 'warehouse'}.webp`;
}

export const WAREHOUSE_IMAGE = `${BASE}/warehouse.webp`;

/** Initials of an organisation for its round badge: "Migros Genossenschaft Zürich" → "MZ". */
export function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? words[words.length - 1][0] : (words[0]?.[1] ?? '');
  return (first + last).toUpperCase();
}

const MONO_COLORS = ['#4a2695', '#c2410c', '#0f766e', '#1d4ed8', '#9d174d', '#4d7c0f'];
/** A stable colour per organisation, so the same donor always looks the same. */
export function monogramColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MONO_COLORS[h % MONO_COLORS.length];
}
