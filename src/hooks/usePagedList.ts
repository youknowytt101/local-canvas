// A list read page by page from one of the computer's paged routes (items + meta.nextPageCursor): the profile's
// elements, a collection's, … The first page when `path` changes, the next on loadMore, all again on refresh.
// loadMore resolves, once whatever load is under way has ended, with the whole list and whether it is done (a viewer
// paging on appends what it does not have; an empty answer while a load was running had stopped its paging).
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
  const doneNow = useRef(false);
  const running = useRef<Promise<unknown> | null>(null);
  const extraKey = JSON.stringify(extra);

  const load = useCallback(async (reset: boolean, isRefresh = false): Promise<T[]> => {
    if (!path || (busy.current && !reset) || (!reset && !cursor.current && list.current.length)) return [];
    const my = reset ? ++token.current : token.current;
    busy.current = true;
    if (reset) { cursor.current = null; if (!isRefresh) { list.current = []; setItems([]); } doneNow.current = false; setDone(false); }
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
      doneNow.current = !cursor.current;
      setDone(doneNow.current);
      if (typeof page.meta.count === 'number') setCount(page.meta.count);
      return added;
    } catch {
      if (my === token.current) { doneNow.current = true; setDone(true); }
      return [];
    } finally {
      if (my === token.current) { busy.current = false; setLoading(false); setRefreshing(false); }
    }
  }, [path, pageSize, extraKey]);

  const run = useCallback((reset: boolean, isRefresh = false) => {
    const p = load(reset, isRefresh);
    running.current = p;
    return p;
  }, [load]);
  useEffect(() => { void run(true); }, [run]);

  const loadMore = useCallback(async () => {
    const before = list.current.length;
    if (busy.current) await running.current;
    if (!doneNow.current && list.current.length === before) await run(false);
    return { items: list.current, done: doneNow.current };
  }, [run]);

  // one taken out (removed from the profile / the collection)
  const removeId = useCallback((id: string) => {
    list.current = list.current.filter((e) => e.id !== id);
    setItems(list.current);
    setCount((n) => (n == null ? n : Math.max(0, n - 1)));
  }, []);

  return { items, loading, refreshing, done, count, loadMore, refresh: () => run(true, true), removeId };
}
