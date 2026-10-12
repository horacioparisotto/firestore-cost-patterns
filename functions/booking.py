"""Turning an LLM's JSON into a booking: the model proposes, the code decides.

Venue staff book ice time in plain language through an assistant on Gemini
with a strict JSON contract. Early on, the model sometimes returned a screen's
URL slug instead of a real rink, so nothing it returns is saved until every
field has been checked here. An invalid answer becomes a clarifying question
instead of a broken booking.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time


@dataclass(frozen=True)
class Venue:
    rink_names: tuple[str, ...]


@dataclass(frozen=True)
class Booking:
    rink: str
    day: date
    start: time
    end: time


@dataclass(frozen=True)
class Ask:
    """A clarifying question to send back to the person instead of saving."""

    question: str


def to_booking(reply: dict, venue: Venue) -> Booking | Ask:
    """Validate the model's JSON before anything is saved."""
    rink = str(reply.get("rink") or "").strip()
    if rink not in venue.rink_names:
        names = ", ".join(venue.rink_names)
        return Ask(f"Which rink: {names}?")

    day = parse_date(reply.get("date"))
    if day is None:
        return Ask("Which day is it for?")

    start = parse_time(reply.get("start"))
    end = parse_time(reply.get("end"))
    if start is None or end is None or end <= start:
        return Ask("What time does it start and end?")

    return Booking(rink=rink, day=day, start=start, end=end)


def parse_date(value: object) -> date | None:
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def parse_time(value: object) -> time | None:
    try:
        return time.fromisoformat(str(value))
    except ValueError:
        return None
