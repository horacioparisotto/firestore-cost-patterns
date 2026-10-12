import { parseAndValidate, type ScheduleRow } from './csv';

export interface NewEvent extends ScheduleRow {
  source: string;
}

/** Storage for a rink's events (Firestore in production: see firestore.ts). */
export interface ScheduleStore {
  /** Ids of the events one source owns on a rink and date. */
  ownedBy(rinkId: string, date: string, source: string): Promise<string[]>;
  /** Deletes and inserts in one atomic write: all of it lands, or none of it. */
  swap(rinkId: string, deleteIds: string[], insert: NewEvent[]): Promise<void>;
}

export interface ImportResult {
  days: number;
  replaced: number;
  inserted: number;
}

/**
 * Several groups share the same rinks and each uploads its own schedule.
 * The old importer deleted everything on a rink and date before writing,
 * so each upload wiped out everyone else's. This one only replaces the rows
 * its own source owns, and swaps each rink's day atomically.
 */
export async function importSchedule(
  store: ScheduleStore,
  csv: string,
  source: string,
): Promise<ImportResult> {
  // Throws before the first write if any row is invalid.
  const rows = parseAndValidate(csv);

  const result: ImportResult = { days: 0, replaced: 0, inserted: 0 };
  for (const day of groupByRinkAndDate(rows)) {
    const owned = await store.ownedBy(day.rinkId, day.date, source);
    await store.swap(
      day.rinkId,
      owned,
      day.rows.map((r) => ({ ...r, source })),
    );
    result.days++;
    result.replaced += owned.length;
    result.inserted += day.rows.length;
  }
  return result;
}

export function groupByRinkAndDate(rows: ScheduleRow[]) {
  const days = new Map<string, { rinkId: string; date: string; rows: ScheduleRow[] }>();
  for (const row of rows) {
    const key = `${row.rinkId}|${row.date}`;
    const day = days.get(key) ?? { rinkId: row.rinkId, date: row.date, rows: [] };
    day.rows.push(row);
    days.set(key, day);
  }
  return [...days.values()];
}
