import { dayRange, msUntilNext } from './time';

export interface ScheduleEvent {
  id: string;
  rinkId: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
}

export type Unsubscribe = () => void;

/** A live query over one display's events (Firestore in production: see firestore.ts). */
export interface EventSource {
  listen(
    displayId: string,
    start: Date,
    end: Date,
    onChange: (events: ScheduleEvent[]) => void,
  ): Unsubscribe;
}

/**
 * One live listener per screen, scoped to today in the venue's time zone.
 *
 * The runaway bill came from screens repeatedly downloading the whole event
 * history. A listener pays once for today's events and then only for what
 * changes; the old two-minute polling paid for everything again and again.
 */
export function watchToday(
  source: EventSource,
  displayId: string,
  tz: string,
  onChange: (events: ScheduleEvent[]) => void,
  now: Date = new Date(),
): Unsubscribe {
  const { start, end } = dayRange(now, tz);
  return source.listen(displayId, start, end, onChange);
}

/** Local wall-clock times at which every display reloads itself. */
export const RELOAD_TIMES = ['00:10', '04:00'];

/**
 * Screens run 24/7: reload just after midnight to roll over to the new day,
 * and again before dawn to clear any drift from a long-running page.
 */
export function scheduleReloads(
  tz: string,
  reload: () => void,
  now: () => Date = () => new Date(),
): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    timer = setTimeout(() => {
      reload();
      arm();
    }, msUntilNext(RELOAD_TIMES, tz, now()));
  };
  arm();
  return () => clearTimeout(timer);
}
