// Cosmos' useFollowingFeed (module 3451) on the computer's Following (GET /api/home/following, cosmos-lite lib/home.js):
// pages of FOLLOWING_FEED_INITIAL_PAGE_SIZE (8), then FOLLOWING_FEED_PAGE_SIZE (12), by cursor. Each item is one
// stretch of saving: who (collaborator), into which collection, when, how many, and the first tiles. Last time's first
// page shows at once when every item in it has tiles (isValidFollowingFeedCache), and the first answer replaces it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { get, qs } from '../lib/api';
import type { Element } from '../lib/elements';
import { readFeedCache, saveFeedCache, type FeedPage } from '../lib/feedCache';

export const FOLLOWING_FEED_INITIAL_PAGE_SIZE = 8;
export const FOLLOWING_FEED_PAGE_SIZE = 12;

export type FollowingItem = {
  id?: string;
  collaborator?: { id: string; username: string; fullName?: string; avatarUrl?: string | null } | null;
  cluster?: { id: string; name: string; isPublicElementsCluster?: boolean } | null;
  source?: { id: string; platform: string; target: string } | null; // the user's own synced source (local)
  startedAt?: string;
  finishedAt?: string;
  elementCount: number;
  items: Element[];
};

type State = { items: FollowingItem[]; loading: boolean; refreshing: boolean; done: boolean; error: string | null };

const itemKey = (s: FollowingItem) => s.id ?? `${s.collaborator?.id}:${s.cluster?.id}:${s.startedAt}`;

export function useFollowingFeed(userId: string | null, active: boolean) {
  const [state, setState] = useState<State>({ items: [], loading: false, refreshing: false, done: false, error: null });
  const token = useRef(0);
  const cursor = useRef<string | null>(null);
  const busy = useRef(false);
  const started = useRef(false);

  const load = useCallback(async (reset: boolean, refreshing = false) => {
    if (!userId || (busy.current && !reset)) return;
    const my = reset ? ++token.current : token.current;
    busy.current = true;
    let cached: FeedPage<FollowingItem> | null = null;
    if (reset) {
      cursor.current = null;
      cached = !refreshing ? readFeedCache<FollowingItem>('following', userId) : null;
      if (cached && !cached.items.every((s) => Array.isArray(s.items) && s.items.length)) cached = null;
      setState({ items: cached?.items ?? [], loading: true, refreshing, done: false, error: null });
    } else setState((s) => ({ ...s, loading: true }));
    try {
      const page = await get<FeedPage<FollowingItem>>(`/api/home/following?${qs({
        pageSize: cursor.current ? FOLLOWING_FEED_PAGE_SIZE : FOLLOWING_FEED_INITIAL_PAGE_SIZE, cursor: cursor.current,
      })}`);
      if (my !== token.current) return;
      cursor.current = page.meta.nextPageCursor ?? null;
      setState((s) => {
        const before = reset ? [] : s.items;
        const have = new Set(before.map(itemKey));
        return { items: [...before, ...page.items.filter((i) => !have.has(itemKey(i)))], loading: false, refreshing: false, done: !cursor.current, error: null };
      });
      if (reset) saveFeedCache('following', userId, page);
    } catch (e) {
      if (my === token.current) setState((s) => ({ ...s, loading: false, refreshing: false, done: true, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (my === token.current) busy.current = false;
    }
  }, [userId]);

  // asked for the first time when the tab is first shown
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    void load(true);
  }, [active, load]);

  return {
    ...state,
    loadMore: () => { if (!state.done && !busy.current) void load(false); },
    refresh: () => load(true, true),
  };
}
