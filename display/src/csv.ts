export interface ScheduleRow {
  rinkId: string;
  date: string; // YYYY-MM-DD, the venue's calendar date
  start: string; // HH:MM
  end: string; // HH:MM
  title: string;
}

export class ImportError extends Error {
  constructor(readonly problems: string[]) {
    super(`CSV has ${problems.length} problem(s):\n${problems.join('\n')}`);
  }
}

const HEADER = ['rink', 'date', 'start', 'end', 'title'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Parses and validates the whole file before anything is written, and reports
 * every problem at once with its line number, so staff fix the file in one go.
 * Quoted fields handle the team names that used to break the old parser:
 * apostrophes, commas and escaped quotes.
 */
export function parseAndValidate(csv: string): ScheduleRow[] {
  const [header, ...lines] = parseCsv(csv);
  if (!header || header.map((h) => h.trim().toLowerCase()).join() !== HEADER.join()) {
    throw new ImportError([`line 1: expected header "${HEADER.join(',')}"`]);
  }

  const rows: ScheduleRow[] = [];
  const problems: string[] = [];
  lines.forEach((cells, i) => {
    const line = i + 2;
    if (cells.length === 1 && cells[0]?.trim() === '') return; // blank line
    const [rinkId = '', date = '', start = '', end = '', title = ''] = cells.map((c) => c.trim());
    if (!rinkId) problems.push(`line ${line}: missing rink`);
    if (!DATE.test(date)) problems.push(`line ${line}: date "${date}" is not YYYY-MM-DD`);
    if (!TIME.test(start) || !TIME.test(end)) problems.push(`line ${line}: times must be HH:MM`);
    else if (end <= start) problems.push(`line ${line}: ends before it starts`);
    rows.push({ rinkId, date, start, end, title });
  });

  if (problems.length > 0) throw new ImportError(problems);
  return rows;
}

/** Minimal RFC 4180 parser: quoted fields, "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
