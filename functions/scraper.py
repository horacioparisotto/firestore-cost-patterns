"""One scraper, sources as data.

The legacy system had one scraper script per league. They became a single
scraper, triggered hourly, that reads its sources from the database, so adding
a league is a new record rather than a new deploy. One league page can cover
many facilities, so each page section is mapped to its venue.

A failing source is reported and retried on the next run instead of stopping
the others, and a page section nobody has mapped yet is flagged rather than
guessed at.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Iterable


@dataclass(frozen=True)
class Source:
    id: str
    url: str
    enabled: bool
    section_map: dict[str, str]  # page section title -> venue id


@dataclass(frozen=True)
class Section:
    title: str
    events: list[dict]


class FetchError(Exception):
    pass


@dataclass
class SyncReport:
    synced: dict[str, int] = field(default_factory=dict)  # venue id -> events
    failed: dict[str, str] = field(default_factory=dict)  # source id -> error
    unmapped: list[tuple[str, str]] = field(default_factory=list)  # (source, section)


def sync_all(
    sources: Iterable[Source],
    fetch: Callable[[str], str],
    parse_sections: Callable[[str], list[Section]],
    upsert_events: Callable[[str, list[dict], str], None],
) -> SyncReport:
    """Hourly. Every league source is a record, not a script."""
    report = SyncReport()
    for src in sources:
        if not src.enabled:
            continue
        try:
            page = fetch(src.url)
        except FetchError as err:
            report.failed[src.id] = str(err)  # the next hourly run retries
            continue
        for section in parse_sections(page):
            venue = src.section_map.get(section.title)
            if venue is None:
                report.unmapped.append((src.id, section.title))
                continue
            upsert_events(venue, section.events, src.id)
            report.synced[venue] = report.synced.get(venue, 0) + len(section.events)
    return report
