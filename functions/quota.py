"""A hard cap on AI spend: assistant requests per venue per day.

The quota is taken before the model is called, not after, so a request over
the limit costs nothing and a runaway client can never turn into a runaway
bill. The check and the increment happen in one transaction, so two requests
arriving together can't both slip under the limit.
"""

from __future__ import annotations

from typing import Callable, Protocol, TypeVar

DAILY_LIMIT = 5

T = TypeVar("T")


class Transaction(Protocol):
    def get_count(self, key: str) -> int: ...
    def set_count(self, key: str, value: int) -> None: ...


class QuotaStore(Protocol):
    def run_transaction(self, fn: Callable[[Transaction], T]) -> T: ...


def take_quota(store: QuotaStore, venue_id: str, day: str, limit: int = DAILY_LIMIT) -> bool:
    """Take one request from today's quota. False means the venue is out."""
    key = f"{venue_id}_{day}"

    def take(tx: Transaction) -> bool:
        used = tx.get_count(key)
        if used >= limit:
            return False
        tx.set_count(key, used + 1)
        return True

    return store.run_transaction(take)
