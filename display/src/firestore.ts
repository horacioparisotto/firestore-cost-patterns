// Firestore adapters for the ports used by the display. The domain code above
// never imports Firebase; tests run it against in-memory stores.
import {
  type Firestore,
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { NewEvent, ScheduleStore } from './importSchedule';
import type { EventSource, ScheduleEvent } from './watchToday';

export function firestoreEventSource(db: Firestore): EventSource {
  return {
    listen(displayId, start, end, onChange) {
      const q = query(
        collection(db, 'displays', displayId, 'events'),
        where('startsAt', '>=', Timestamp.fromDate(start)),
        where('startsAt', '<', Timestamp.fromDate(end)),
        orderBy('startsAt'),
      );
      return onSnapshot(q, (snap) =>
        onChange(
          snap.docs.map((d): ScheduleEvent => {
            const data = d.data();
            return {
              id: d.id,
              rinkId: data.rinkId,
              title: data.title,
              startsAt: data.startsAt.toDate(),
              endsAt: data.endsAt.toDate(),
            };
          }),
        ),
      );
    },
  };
}

export function firestoreScheduleStore(db: Firestore): ScheduleStore {
  const events = (rinkId: string) => collection(db, 'rinks', rinkId, 'events');
  return {
    async ownedBy(rinkId, date, source) {
      const snap = await getDocs(
        query(events(rinkId), where('date', '==', date), where('source', '==', source)),
      );
      return snap.docs.map((d) => d.id);
    },
    async swap(rinkId, deleteIds, insert: NewEvent[]) {
      // One batch per rink and day: well under Firestore's 500-write limit
      // for a single day's schedule, and atomic.
      const batch = writeBatch(db);
      deleteIds.forEach((id) => batch.delete(doc(events(rinkId), id)));
      insert.forEach((e) => batch.set(doc(events(rinkId)), e));
      await batch.commit();
    },
  };
}
