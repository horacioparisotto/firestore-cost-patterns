// Time helpers for screens that run 24/7 in a venue's own time zone,
// whatever time zone the device or the server happens to be in.

/** Calendar date ("2026-03-14") of an instant, as seen in a time zone. */
export function localDateKey(instant: Date, tz: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** The instant a wall-clock time happens in a time zone. */
export function zonedTime(dateKey: string, time: string, tz: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Correct by the zone's offset, then once more in case that crossed a DST change.
  let instant = asUtc - offsetMs(new Date(asUtc), tz);
  instant = asUtc - offsetMs(new Date(instant), tz);
  return new Date(instant);
}

/** [start, end) of "today" in the venue's time zone. Handles 23- and 25-hour days. */
export function dayRange(now: Date, tz: string): { start: Date; end: Date } {
  const today = localDateKey(now, tz);
  return {
    start: zonedTime(today, '00:00', tz),
    end: zonedTime(nextDateKey(today), '00:00', tz),
  };
}

/** Milliseconds until the next of the given local wall-clock times. */
export function msUntilNext(times: string[], tz: string, now: Date): number {
  const today = localDateKey(now, tz);
  const candidates = [today, nextDateKey(today)].flatMap((day) =>
    times.map((t) => zonedTime(day, t, tz).getTime()),
  );
  const next = Math.min(...candidates.filter((t) => t > now.getTime()));
  return next - now.getTime();
}

function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function offsetMs(instant: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}
