import { describe, expect, it, vi } from 'vitest';
import { scheduleReloads, watchToday, type EventSource } from '../src/watchToday';

describe('watchToday', () => {
  it("listens to today's events only, in the venue's time zone", () => {
    const listen = vi.fn<EventSource['listen']>(() => () => {});

    watchToday({ listen }, 'display-1', 'America/Toronto', () => {}, new Date('2026-03-14T18:00:00Z'));

    const [displayId, start, end] = listen.mock.calls[0]!;
    expect(displayId).toBe('display-1');
    expect(start.toISOString()).toBe('2026-03-14T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-15T04:00:00.000Z');
  });
});

describe('scheduleReloads', () => {
  it('reloads at 00:10 and 04:00 local time, every day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T03:00:00Z')); // 23:00 in Toronto
    const reload = vi.fn();

    const stop = scheduleReloads('America/Toronto', reload);
    vi.advanceTimersByTime(70 * 60_000); // to 00:10
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime((3 * 60 + 50) * 60_000); // to 04:00
    expect(reload).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(24 * 3_600_000);
    expect(reload).toHaveBeenCalledTimes(4);

    stop();
    vi.useRealTimers();
  });
});
