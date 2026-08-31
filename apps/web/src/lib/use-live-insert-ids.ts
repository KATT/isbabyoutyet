import { useRef } from "react";

/**
 * Tracks which item ids appeared as live prepends after the first snapshot.
 * First render (including an empty list) is the baseline so initial load does
 * not animate; later ids whose sortKey is newer than that baseline are live
 * inserts. Older ids that show up afterwards (pagination) are ignored.
 */
export function useLiveInsertIds(items: readonly { id: string; sortKey: number }[]) {
  const seededRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>());
  const liveInsertIdsRef = useRef(new Set<string>());
  const maxSortKeyRef = useRef<number | null>(null);

  if (!seededRef.current) {
    seededRef.current = true;
    for (const item of items) {
      seenIdsRef.current.add(item.id);
      if (maxSortKeyRef.current === null || item.sortKey > maxSortKeyRef.current) {
        maxSortKeyRef.current = item.sortKey;
      }
    }
    return liveInsertIdsRef.current;
  }

  const previousMaxSortKey = maxSortKeyRef.current;
  for (const item of items) {
    if (seenIdsRef.current.has(item.id)) continue;
    seenIdsRef.current.add(item.id);
    if (previousMaxSortKey === null || item.sortKey > previousMaxSortKey) {
      liveInsertIdsRef.current.add(item.id);
    }
  }
  for (const item of items) {
    if (maxSortKeyRef.current === null || item.sortKey > maxSortKeyRef.current) {
      maxSortKeyRef.current = item.sortKey;
    }
  }
  return liveInsertIdsRef.current;
}
