import threading
import time
from concurrent.futures import ThreadPoolExecutor

from quota import DAILY_LIMIT, take_quota


class MemoryQuotaStore:
    """Serializable in-memory store with the same contract as the Firestore adapter."""

    def __init__(self):
        self.counts: dict[str, int] = {}
        self._lock = threading.Lock()

    def run_transaction(self, fn):
        with self._lock:
            return fn(self)

    def get_count(self, key):
        value = self.counts.get(key, 0)
        time.sleep(0.005)  # a network read: without a transaction, others write meanwhile
        return value

    def set_count(self, key, value):
        self.counts[key] = value


def test_allows_up_to_the_daily_limit():
    store = MemoryQuotaStore()

    results = [take_quota(store, "venue-1", "2026-03-14") for _ in range(DAILY_LIMIT + 2)]

    assert results == [True] * DAILY_LIMIT + [False, False]


def test_each_venue_and_day_has_its_own_quota():
    store = MemoryQuotaStore()
    for _ in range(DAILY_LIMIT):
        take_quota(store, "venue-1", "2026-03-14")

    assert take_quota(store, "venue-2", "2026-03-14")
    assert take_quota(store, "venue-1", "2026-03-15")


def test_concurrent_requests_cannot_exceed_the_limit():
    store = MemoryQuotaStore()

    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(lambda _: take_quota(store, "venue-1", "2026-03-14"), range(20)))

    assert results.count(True) == DAILY_LIMIT
    assert store.counts["venue-1_2026-03-14"] == DAILY_LIMIT
