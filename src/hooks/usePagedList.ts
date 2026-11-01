// A list read page by page from one of the computer's paged routes (items + meta.nextPageCursor): the profile's
// elements, a collection's, … The first page when `path` changes, the next on loadMore (resolving with what it added,
// for a viewer paging on), all again on refresh.
import { useCallback, useEffect, useRef, useState } from 'react';
import { get, qs } from '../lib/api';
import type { FeedPage } from '../lib/feedCache';

export function usePagedList<T extends { id: string }>(path: string | null, pageSize: number, extra: Record<string, unknown> = {}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const cursor = useRef<string | null>(null);
  const token = useRef(0);
  const busy = useRef(false);
  const list = useRef<T[]>([]);
  const extraKey = JSON.stringify(extra);

  const load = useCallback(async (reset: boolean, isRefresh = false): Promise<T[]> => {
    if (!path || (busy.current && !reset) || (!reset && !cursor.current && list.current.length)) return [];
    const my = reset ? ++token.current : token.current;
    busy.current = true;
    if (reset) { cursor.current = null; if (!isRefresh) { list.current = []; setItems([]); } setDone(false); }
    setLoading(true);
    setRefreshing(isRefresh);
    try {
      const sep = path.includes('?') ? '&' : '?';
      const page = await get<FeedPage<T> & { meta: { count?: number } }>(`${path}${sep}${qs({ ...JSON.parse(extraKey), pageSize, cursor: cursor.current })}`);
      if (my !== token.current) return [];
      cursor.current = page.meta.nextPageCursor ?? null;
      const before = reset ? [] : list.current;
      const have = new Set(before.map((e) => e.id));
      const added = page.items.filter((e) => !have.has(e.id));
      list.current = [...before, ...added];
      setItems(list.current);
      setDone(!cursor.current);
      if (typeof page.meta.count === 'number') setCount(page.meta.count);
      return added;
    } catch {
      if (my === token.current) setDone(true);
      return [];
    } finally {
      if (my === token.current) { busy.current = false; setLoading(false); setRefreshing(false); }
    }
  }, [path, pageSize, extraKey]);

  useEffect(() => { void load(true); }, [load]);

  // one taken out (removed from the profile / the collection)
  const removeId = useCallback((id: string) => {
    list.current = list.current.filter((e) => e.id !== id);
    setItems(list.current);
    setCount((n) => (n == null ? n : Math.max(0, n - 1)));
  }, []);

  return { items, loading, refreshing, done, count, loadMore: () => load(false), refresh: () => load(true, true), removeId };
}
