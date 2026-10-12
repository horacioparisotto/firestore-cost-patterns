// new Date('2026-03-14') is midnight UTC: in Toronto that's still the evening
// of March 13, so every date-only string parsed that way lands a day early.
// One small parser, used everywhere, removed the off-by-one for good.

export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d); // local midnight
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
