// What the profile's two pages share: the header they scroll under and how they report scrolling to it.
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export type ProfileListProps = {
  headerHeight: number; // the folding header over the list: its spacer
  headerScrollMax: number; // how far the header folds (all but the tab bar)
  viewport: number; // the height the pages have
  bottomInset: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshing: boolean;
  onRefresh: () => void;
  isMe: boolean; // one's own profile (ProfileOwn) or someone else's (ProfileOther)
};

// Cosmos' useUserClusters order: the pinned ones first (the one pinned last first among them), the rest as they come
export function pinnedFirst<T extends { isPinnedToUserProfile?: boolean; pinnedAt?: string | null }>(list: T[]): T[] {
  return list.map((c, index) => ({ c, index })).sort((a, b) => {
    const pa = !!a.c.isPinnedToUserProfile;
    const pb = !!b.c.isPinnedToUserProfile;
    if (pa !== pb) return pa ? -1 : 1;
    if (pa && a.c.pinnedAt !== b.c.pinnedAt) return String(b.c.pinnedAt).localeCompare(String(a.c.pinnedAt));
    return a.index - b.index;
  }).map((x) => x.c);
}
