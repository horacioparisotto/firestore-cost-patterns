import { beforeEach, describe, expect, it } from 'vitest';
import { ImportError, parseAndValidate, parseCsv } from '../src/csv';
import { importSchedule, type NewEvent, type ScheduleStore } from '../src/importSchedule';

/** In-memory store with the same contract as the Firestore adapter. */
class MemoryStore implements ScheduleStore {
  events = new Map<string, NewEvent & { id: string }>();
  writes = 0;
  private nextId = 1;

  seed(event: NewEvent) {
    const id = `seed-${this.nextId++}`;
    this.events.set(id, { ...event, id });
  }

  async ownedBy(rinkId: string, date: string, source: string) {
    return [...this.events.values()]
      .filter((e) => e.rinkId === rinkId && e.date === date && e.source === source)
      .map((e) => e.id);
  }

  async swap(_rinkId: string, deleteIds: string[], insert: NewEvent[]) {
    this.writes++;
    deleteIds.forEach((id) => this.events.delete(id));
    insert.forEach((e) => {
      const id = `new-${this.nextId++}`;
      this.events.set(id, { ...e, id });
    });
  }

  on(rinkId: string, date: string) {
    return [...this.events.values()].filter((e) => e.rinkId === rinkId && e.date === date);
  }
}

const csv = (...rows: string[]) => ['rink,date,start,end,title', ...rows].join('\n');
const event = (source: string, title: string): NewEvent => ({
  rinkId: 'A',
  date: '2026-03-14',
  start: '18:00',
  end: '19:00',
  title,
  source,
});

describe('importSchedule', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it('keeps events uploaded by other groups', async () => {
    store.seed(event('league', 'Old league game'));
    store.seed(event('school', 'School skate'));

    await importSchedule(store, csv('A,2026-03-14,20:00,21:00,New league game'), 'league');

    const titles = store.on('A', '2026-03-14').map((e) => e.title).sort();
    expect(titles).toEqual(['New league game', 'School skate']);
  });

  it('writes nothing when any row is invalid', async () => {
    store.seed(event('league', 'Existing game'));

    await expect(
      importSchedule(store, csv('A,2026-03-14,20:00,21:00,Fine', 'A,14/03/2026,20:00,21:00,Bad date'), 'league'),
    ).rejects.toBeInstanceOf(ImportError);

    expect(store.writes).toBe(0);
    expect(store.on('A', '2026-03-14')).toHaveLength(1);
  });

  it('swaps each rink and day in one write', async () => {
    const result = await importSchedule(
      store,
      csv('A,2026-03-14,18:00,19:00,One', 'A,2026-03-14,19:00,20:00,Two', 'B,2026-03-14,18:00,19:00,Three'),
      'league',
    );

    expect(result).toEqual({ days: 2, replaced: 0, inserted: 3 });
    expect(store.writes).toBe(2);
  });
});

describe('parseAndValidate', () => {
  it('handles apostrophes, commas and quotes in team names', () => {
    const [row] = parseAndValidate(csv('A,2026-03-14,18:00,19:00,"O\'Brien Hawks vs. Smith, Jr. ""Blades"""'));

    expect(row?.title).toBe('O\'Brien Hawks vs. Smith, Jr. "Blades"');
  });

  it('reports every problem with its line number', () => {
    const bad = csv('A,2026-03-14,18:00,19:00,Fine', ',2026-03-14,18:00,19:00,No rink', 'A,2026-03-14,19:00,18:00,Backwards');

    expect(() => parseAndValidate(bad)).toThrowError(/line 3: missing rink[\s\S]*line 4: ends before it starts/);
  });

  it('accepts Windows line endings and a trailing newline', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});
