from datetime import date, time

from booking import Ask, Booking, Venue, to_booking

VENUE = Venue(rink_names=("Rink 1", "Rink 2"))


def reply(**overrides):
    base = {"rink": "Rink 1", "date": "2026-03-14", "start": "18:00", "end": "19:00"}
    return {**base, **overrides}


def test_valid_reply_becomes_a_booking():
    assert to_booking(reply(), VENUE) == Booking("Rink 1", date(2026, 3, 14), time(18), time(19))


def test_screen_slug_is_not_a_rink():
    result = to_booking(reply(rink="rink-1-display"), VENUE)

    assert isinstance(result, Ask)
    assert "Rink 1, Rink 2" in result.question


def test_missing_or_bad_date_asks_for_the_day():
    assert to_booking(reply(date=None), VENUE) == Ask("Which day is it for?")
    assert to_booking(reply(date="next friday"), VENUE) == Ask("Which day is it for?")


def test_end_before_start_asks_for_times():
    assert isinstance(to_booking(reply(start="19:00", end="18:00"), VENUE), Ask)


def test_wrong_types_never_raise():
    assert isinstance(to_booking({"rink": 7, "date": 20260314, "start": [], "end": {}}, VENUE), Ask)
