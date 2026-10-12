# firestore-cost-patterns

[![CI](https://github.com/horacioparisotto/firestore-cost-patterns/actions/workflows/ci.yml/badge.svg)](https://github.com/horacioparisotto/firestore-cost-patterns/actions/workflows/ci.yml)

Patterns from **[HarrisTime.ca](https://harristime.ca/)**, a production arena-scheduling and digital-signage platform in Canada: 30+ screens across 17 facilities for 10 client organizations, including municipalities. I traced a runaway Firebase bill to queries loading the entire database history and cut it from **$2,353 to $6.49 a month (−99.7%)**, then rebuilt the platform as one multi-venue system.

> **Rewritten from scratch to protect client code.** This is not the production source: names, schemas and infrastructure are replaced. Firebase sits behind small interfaces with real Firestore adapters, and the tests run against in-memory stores, so everything here runs with no credentials.

Full case study: [horacioparisotto.com](https://www.horacioparisotto.com/)

```bash
(cd display && npm ci && npm test)                               # TypeScript: the screens
(cd functions && pip install -r requirements-dev.txt && pytest)  # Python: Cloud Functions
```

## Patterns

### 1. Pay only for what the screen shows · [`display/src/watchToday.ts`](display/src/watchToday.ts)

The bill came from screens repeatedly downloading the whole event history. Each display now holds one live listener scoped to **today in the venue's time zone**, and reloads itself just after midnight and again before dawn to roll over to the new day. A listener pays once for today's events and then only for what changes, where the old two-minute polling paid for everything again and again. The cost was fixed by the shape of the query, with no cache layer and no new infrastructure.

[`display/src/time.ts`](display/src/time.ts) computes the venue's day with `Intl`, so it's right whatever zone the device is in, including the 23- and 25-hour days when clocks change.

### 2. An import that only replaces its own rows · [`display/src/importSchedule.ts`](display/src/importSchedule.ts)

Several groups share the same rinks and each uploads its own schedule. The old importer deleted everything on a rink and date before writing, so each upload wiped out everyone else's. Now the whole file is validated before the first write (every problem reported at once, with line numbers), only the rows the uploading source owns are replaced, and each rink's day is swapped in one atomic batch. The CSV parser handles the team names with apostrophes, commas and quotes that used to break the old one.

### 3. The model proposes, the code decides · [`functions/booking.py`](functions/booking.py)

Venue staff book ice time in plain language through an assistant on Gemini with a strict JSON contract. Early on, the model sometimes returned a screen's URL slug instead of a real rink, so nothing it returns is saved until every field has been checked. An invalid answer becomes a clarifying question instead of a broken booking: the guarantee lives in code that can be tested, not in a prompt that can drift.

### 4. A hard cap on AI spend · [`functions/quota.py`](functions/quota.py)

Usage of the assistant is capped per venue per day. The quota is taken before the model is called, so a request over the limit costs nothing, and the check and the increment run in one transaction ([Firestore adapter](functions/firestore_quota.py)), so concurrent requests can't both slip under the limit. The test fires 20 requests at once and expects exactly 5 through.

### 5. Dates that stay on the right day · [`display/src/dates.ts`](display/src/dates.ts)

Parsing a plain date string treats it as midnight UTC, which is still the previous day in Canadian time zones. One small local-date parser, used everywhere, removed the off-by-one for good. The tests run with `TZ=America/Toronto`.

### 6. One scraper, sources as data · [`functions/scraper.py`](functions/scraper.py)

The legacy system had one scraper script per league. They became a single hourly scraper that reads its sources from the database, so adding a league is a new record, not a new deploy. One league page can feed many facilities. A failing source is reported and retried next hour instead of stopping the others, and an unmapped page section is flagged rather than guessed at.

## Layout

```
display/      TypeScript (the screens and the admin import)
  src/        domain code + firestore.ts adapters
  test/       Vitest
functions/    Python (Cloud Functions)
  tests/      pytest
```

---

Horacio Parisotto · Senior Full-Stack & AI Engineer · [Portfolio](https://www.horacioparisotto.com/) · [LinkedIn](https://www.linkedin.com/in/horacioparisotto/)
