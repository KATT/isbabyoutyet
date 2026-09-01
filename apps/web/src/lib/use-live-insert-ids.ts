import { useState } from "react";

type LiveInsertItem = {
  id: string;
  sortKey: number;
};

type LiveInsertSnapshot = {
  seenIds: ReadonlySet<string>;
  liveInsertIds: ReadonlySet<string>;
  maxSortKey: number | null;
};

function maxSortKeyOf(items: readonly LiveInsertItem[], fallback: number | null) {
  let maxSortKey = fallback;
  for (const item of items) {
    if (maxSortKey === null || item.sortKey > maxSortKey) {
      maxSortKey = item.sortKey;
    }
  }
  return maxSortKey;
}

function seedLiveInsertSnapshot(items: readonly LiveInsertItem[]): LiveInsertSnapshot {
  const seenIds = new Set<string>();
  for (const item of items) {
    seenIds.add(item.id);
  }
  return {
    seenIds,
    liveInsertIds: new Set(),
    maxSortKey: maxSortKeyOf(items, null),
  };
}

function advanceLiveInsertSnapshot(snapshot: LiveInsertSnapshot, items: readonly LiveInsertItem[]) {
  let seenIds: Set<string> | null = null;
  let liveInsertIds: Set<string> | null = null;

  for (const item of items) {
    if (snapshot.seenIds.has(item.id)) continue;
    if (seenIds !== null && seenIds.has(item.id)) continue;
    if (seenIds === null) {
      seenIds = new Set(snapshot.seenIds);
    }
    seenIds.add(item.id);
    if (snapshot.maxSortKey === null || item.sortKey > snapshot.maxSortKey) {
      if (liveInsertIds === null) {
        liveInsertIds = new Set(snapshot.liveInsertIds);
      }
      liveInsertIds.add(item.id);
    }
  }

  const maxSortKey = maxSortKeyOf(items, snapshot.maxSortKey);
  if (seenIds === null && liveInsertIds === null && maxSortKey === snapshot.maxSortKey) {
    return snapshot;
  }
  return {
    seenIds: seenIds ?? snapshot.seenIds,
    liveInsertIds: liveInsertIds ?? snapshot.liveInsertIds,
    maxSortKey,
  };
}

/**
 * Tracks which item ids appeared as live prepends after the first snapshot.
 * First render (including an empty list) is the baseline so initial load does
 * not animate; later ids whose sortKey is newer than that baseline are live
 * inserts. Older ids that show up afterwards (pagination) are ignored.
 *
 * Snapshot state is adjusted during render (React’s “adjusting state when
 * props change” pattern) so the hook never reads refs in render.
 */
export function useLiveInsertIds(items: readonly LiveInsertItem[]) {
  const [snapshot, setSnapshot] = useState(() => seedLiveInsertSnapshot(items));
  const nextSnapshot = advanceLiveInsertSnapshot(snapshot, items);
  if (nextSnapshot !== snapshot) {
    setSnapshot(nextSnapshot);
  }
  return nextSnapshot.liveInsertIds;
}
