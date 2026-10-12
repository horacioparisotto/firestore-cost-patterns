import { describe, expect, it } from 'vitest';
import { dayRange, localDateKey, msUntilNext } from '../src/time';

const TORONTO = 'America/Toronto';
const HOUR = 3_600_000;

describe('dayRange', () => {
  it("covers the venue's calendar day, not the server's", () => {
    // 01:30 UTC on March 15 is still the evening of March 14 in Toronto.
    const { start, end } = dayRange(new Date('2026-03-15T01:30:00Z'), TORONTO);

    expect(start.toISOString()).toBe('2026-03-14T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-15T04:00:00.000Z');
  });

  it('handles the 23-hour day when clocks spring forward', () => {
    const { start, end } = dayRange(new Date('2026-03-08T15:00:00Z'), TORONTO);

    expect(end.getTime() - start.getTime()).toBe(23 * HOUR);
  });

  it('handles the 25-hour day when clocks fall back', () => {
    const { start, end } = dayRange(new Date('2026-11-01T15:00:00Z'), TORONTO);

    expect(end.getTime() - start.getTime()).toBe(25 * HOUR);
  });
});

describe('msUntilNext', () => {
  it('waits for the next reload today', () => {
    const now = new Date('2026-03-14T04:05:00Z'); // 00:05 in Toronto

    expect(msUntilNext(['00:10', '04:00'], TORONTO, now)).toBe(5 * 60_000);
  });

  it('rolls over to tomorrow after the last reload', () => {
    const now = new Date('2026-03-14T12:00:00Z'); // 08:00 in Toronto
    const next = new Date(now.getTime() + msUntilNext(['00:10', '04:00'], TORONTO, now));

    expect(localDateKey(next, TORONTO)).toBe('2026-03-15');
    expect(next.toISOString()).toBe('2026-03-15T04:10:00.000Z');
  });
});
