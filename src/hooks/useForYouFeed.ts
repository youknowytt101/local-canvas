// Cosmos' useForYouFeed (module 2758) on the computer's For You (GET /api/home/foryou, cosmos-lite lib/home.js):
//   - pages of FOR_YOU_FEED_INITIAL_PAGE_SIZE (24), then FOR_YOU_FEED_PAGE_SIZE (40); the first of a visit says fresh=1;
//     every request carries v=<the seen position> (stampViewportAckOnCursor). The server keeps the cursor
//   - opening it shows last time's first page from the cache at once (initialData), then asks for the page after it
//     (fetchOnMountWithInitialData, refreshFromNextPage): anything in it replaces the list (onDataReplaced); until it
//     has answered nothing more is asked and impressions wait (hasResolvedFirstPage). Each visit keeps its first page
//     in the cache, once
//   - an element appears once in the list (the server never repeats one within a visit; a repeat is dropped here too)
import { useCallback, useEffect, useRef, useState } from 'react';
import { get, qs } from '../lib/api';
import type { Element } from '../lib/elements';
import { readFeedCache, saveFeedCache, viewedPosition, type FeedPage } from '../lib/feedCache';

export const FOR_YOU_FEED_INITIAL_PAGE_SIZE = 24;
export const FOR_YOU_FEED_PAGE_SIZE = 40;

type State = { items: Element[]; loading: boolean; refreshing: boolean; done: boolean; error: string | null; firstResolved: boolean; generation: number };

export function useForYouFeed(userId: string | null) {
  const [state, setState] = useState<State>({ items: [], loading: false, refreshing: false, done: false, error: null, firstResolved: false, generation: 0 });
  const token = useRef(0);
  const busy = useRef(false);
  const savedThisVisit = useRef(false);
  const items = useRef<Element[]>([]);
  const doneNow = useRef(false);
  const running = useRef<Promise<unknown> | null>(null);

  const fetchPage = (pageSize: number, fresh: boolean) =>
    get<FeedPage<Element>>(`/api/home/foryou?${qs({ pageSize, fresh: fresh ? 1 : null, v: viewedPosition.get() })}`);

  const keep = (page: FeedPage<Element>) => {
    if (!userId || savedThisVisit.current || !page.items.length) return;
    savedThisVisit.current = true;
    saveFeedCache('for-you', userId, page);
  };

  // a new list (the first page, or the cached one replaced): generation tells the screen the list was replaced
  const replace = (next: Element[], done: boolean, extra: Partial<State> = {}) => {
    items.current = next;
    doneNow.current = done;
    setState((s) => ({ ...s, items: next, done, loading: false, refreshing: false, error: null, generation: s.generation + 1, ...extra }));
  };

  const start = useCallback(async ({ refreshing = false } = {}) => {
    if (!userId) return;
    const my = ++token.current;
    busy.current = true;
    const cached = !refreshing && !items.current.length ? readFeedCache<Element>('for-you', userId) : null;
    if (cached) {
      replace(cached.items, false, { loading: true, firstResolved: false });
      try {
        const next = await fetchPage(FOR_YOU_FEED_PAGE_SIZE, false);
        if (my !== token.current) return;
        if (next.items.length) replace(next.items, !next.meta.nextPageCursor, { firstResolved: true });
        else setState((s) => ({ ...s, loading: false, firstResolved: true }));
        keep(next.items.length ? next : cached);
      } catch {
        if (my === token.current) setState((s) => ({ ...s, loading: false, firstResolved: true }));
      } finally {
        if (my === token.current) busy.current = false;
      }
      return;
    }
    setState((s) => ({ ...s, loading: true, refreshing, error: null }));
    try {
      const page = await fetchPage(FOR_YOU_FEED_INITIAL_PAGE_SIZE, true);
      if (my !== token.current) return;
      replace(page.items, !page.meta.nextPageCursor, { firstResolved: true });
      keep(page);
    } catch (e) {
      if (my === token.current) setState((s) => ({ ...s, loading: false, refreshing: false, error: e instanceof Error ? e.message : String(e), firstResolved: true }));
    } finally {
      if (my === token.current) busy.current = false;
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNext = async () => {
    const my = token.current;
    busy.current = true;
    setState((s) => ({ ...s, loading: true }));
    try {
      const page = await fetchPage(FOR_YOU_FEED_PAGE_SIZE, false);
      if (my !== token.current) return;
      const have = new Set(items.current.map((e) => e.id));
      const added = page.items.filter((e) => !have.has(e.id));
      const next = [...items.current, ...added];
      items.current = next;
      doneNow.current = !page.meta.nextPageCursor;
      setState((s) => ({ ...s, items: next, loading: false, done: doneNow.current }));
    } catch (e) {
      if (my === token.current) setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (my === token.current) busy.current = false;
    }
  };
  const begin = (opts?: { refreshing?: boolean }) => {
    const p = start(opts);
    running.current = p;
    return p;
  };

  // the next page, once whatever load is under way has ended (the first page, or the cached one being replaced: until
  // it has answered nothing more is asked); resolves with the whole list and whether it is done, for a viewer paging on
  const loadMore = useCallback(async () => {
    const before = items.current.length;
    if (busy.current) await running.current;
    if (!doneNow.current && items.current.length === before && items.current.length && !busy.current) {
      const p = fetchNext();
      running.current = p;
      await p;
    }
    return { items: items.current, done: doneNow.current };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    items.current = [];
    savedThisVisit.current = false;
    void begin();
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, loadMore, refresh: () => begin({ refreshing: true }), retry: () => begin() };
}
