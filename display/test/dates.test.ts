// Runs with TZ=America/Toronto (see package.json).
import { describe, expect, it } from 'vitest';
import { parseLocalDate, toDateKey } from '../src/dates';

describe('local dates', () => {
  it('runs in a Canadian time zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Toronto');
  });

  it('round-trips a date without shifting it', () => {
    expect(toDateKey(parseLocalDate('2026-03-14'))).toBe('2026-03-14');
  });

  it('differs from the naive parse it replaced', () => {
    expect(toDateKey(new Date('2026-03-14'))).toBe('2026-03-13');
  });

  it('keeps the first of the month on the first', () => {
    expect(toDateKey(parseLocalDate('2026-11-01'))).toBe('2026-11-01');
  });
});
