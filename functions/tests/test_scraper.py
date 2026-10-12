from scraper import FetchError, Section, Source, sync_all

PAGES = {
    "https://league-a.example/schedule": [
        Section("North Arena", [{"game": 1}, {"game": 2}]),
        Section("South Arena", [{"game": 3}]),
        Section("New Arena", [{"game": 4}]),
    ],
}


def fetch(url):
    if url not in PAGES:
        raise FetchError(f"503 from {url}")
    return url


def run(sources):
    upserts = []
    report = sync_all(
        sources,
        fetch=fetch,
        parse_sections=lambda page: PAGES[page],
        upsert_events=lambda venue, events, source: upserts.append((venue, len(events), source)),
    )
    return report, upserts


LEAGUE_A = Source("league-a", "https://league-a.example/schedule", True, {"North Arena": "v-north", "South Arena": "v-south"})


def test_one_page_fans_out_to_many_venues():
    report, upserts = run([LEAGUE_A])

    assert upserts == [("v-north", 2, "league-a"), ("v-south", 1, "league-a")]
    assert report.synced == {"v-north": 2, "v-south": 1}


def test_unmapped_sections_are_flagged_not_guessed():
    report, upserts = run([LEAGUE_A])

    assert report.unmapped == [("league-a", "New Arena")]
    assert all(venue != "New Arena" for venue, _, _ in upserts)


def test_a_failing_source_does_not_stop_the_others():
    broken = Source("league-b", "https://league-b.example/down", True, {})

    report, upserts = run([broken, LEAGUE_A])

    assert "league-b" in report.failed
    assert len(upserts) == 2


def test_disabled_sources_are_skipped():
    report, upserts = run([Source("league-a", LEAGUE_A.url, False, LEAGUE_A.section_map)])

    assert upserts == [] and report.synced == {}
