// Cosmos' useSimilarElements (module 2713) as the viewer uses it: pages of SIMILAR_PAGE_SIZE (24) under the element on
// screen, the next one when the list nears its end, starting again when the element changes. The computer's
// /api/similar with fill=all: the ones past the similarity floor first, then the rest of the library by score, so the
// list goes on as Cosmos' does (cosmos-lite HANDOFF 6.91).
import { useCallback, useEffect, useRef, useState } from 'react';
import { get, qs } from '../lib/api';
import type { Element } from '../lib/elements';
import type { FeedPage } from '../lib/feedCache';

export const SIMILAR_PAGE_SIZE = 24;

export function useSimilarElements(elementId: string | null) {
  const [items, setItems] = useState<Element[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const cursor = useRef<string | null>(null);
  const token = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (!elementId || (busy.current && !reset)) return;
    const my = reset ? ++token.current : token.current;
    busy.current = true;
    if (reset) { cursor.current = null; setItems([]); setDone(false); }
    setLoading(true);
    try {
      const page = await get<FeedPage<Element>>(`/api/similar?${qs({ ids: elementId, cursor: cursor.current, pageSize: SIMILAR_PAGE_SIZE, fill: 'all' })}`);
      if (my !== token.current) return;
      cursor.current = page.meta.nextPageCursor ?? null;
      const slateId = typeof page.meta.slateId === 'string' ? page.meta.slateId : null;
      const next = page.items.filter((e) => e.id !== elementId).map((e) => (e.slateId || !slateId ? e : { ...e, slateId }));
      setItems((before) => {
        const have = new Set(before.map((e) => e.id));
        return [...before, ...next.filter((e) => !have.has(e.id))];
      });
      setDone(!cursor.current);
    } catch {
      if (my === token.current) setDone(true);
    } finally {
      if (my === token.current) { busy.current = false; setLoading(false); }
    }
  }, [elementId]);

  useEffect(() => { void load(true); }, [load]);

  return { items, loading, done, loadMore: () => { if (!done) void load(false); } };
}
