// Home's lists as they were last time (Cosmos module 1734: the MMKV store feed-data-cache, keys
// for-you-data-v4-<user> and following-data-v4-<user>), and how far For You was seen (module 1735: the store
// for-you-viewed-position, key elementId, plus the one last acknowledged).
import { createMMKV } from 'react-native-mmkv';

const cache = createMMKV({ id: 'feed-data-cache' });
const viewed = createMMKV({ id: 'for-you-viewed-position' });

export type FeedPage<T> = { items: T[]; meta: Record<string, unknown> & { nextPageCursor?: string | null } };
export type FeedKind = 'for-you' | 'following';

const key = (kind: FeedKind, userId: string) => `${kind}-data-v4-${userId}`;

export function readFeedCache<T>(kind: FeedKind, userId: string): FeedPage<T> | null {
  const raw = cache.getString(key(kind, userId));
  if (!raw) return null;
  try {
    const page = JSON.parse(raw) as FeedPage<T>;
    return Array.isArray(page?.items) && page.items.length && page.meta ? page : null;
  } catch {
    return null;
  }
}
export function saveFeedCache<T>(kind: FeedKind, userId: string, page: FeedPage<T>) {
  if (page.items.length) cache.set(key(kind, userId), JSON.stringify({ items: page.items, meta: page.meta }));
}

export const viewedPosition = {
  get: () => viewed.getString('elementId') ?? null,
  set: (id: string) => viewed.set('elementId', id),
  acked: () => viewed.getString('acknowledgedElementId') ?? null,
  setAcked: (id: string | null) => (id ? viewed.set('acknowledgedElementId', id) : viewed.remove('acknowledgedElementId')),
};
