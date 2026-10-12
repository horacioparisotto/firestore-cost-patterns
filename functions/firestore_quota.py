"""Firestore adapter for quota.QuotaStore (production).

Not exercised by the test suite, which runs against an in-memory store with
the same contract; running it needs google-cloud-firestore and credentials.
"""

from __future__ import annotations

from typing import Callable, TypeVar

from google.cloud import firestore

T = TypeVar("T")


class FirestoreQuotaStore:
    def __init__(self, db: firestore.Client, collection: str = "assistant_quotas"):
        self._db = db
        self._collection = collection

    def run_transaction(self, fn: Callable[["_Tx"], T]) -> T:
        @firestore.transactional
        def run(tx: firestore.Transaction) -> T:
            return fn(_Tx(self._db, self._collection, tx))

        return run(self._db.transaction())


class _Tx:
    def __init__(self, db: firestore.Client, collection: str, tx: firestore.Transaction):
        self._db, self._collection, self._tx = db, collection, tx

    def get_count(self, key: str) -> int:
        snap = self._db.collection(self._collection).document(key).get(transaction=self._tx)
        return int(snap.get("used")) if snap.exists else 0

    def set_count(self, key: str, value: int) -> None:
        ref = self._db.collection(self._collection).document(key)
        self._tx.set(ref, {"used": value}, merge=True)
