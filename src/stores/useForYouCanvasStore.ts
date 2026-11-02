// The For You list the canvas is made from. Cosmos' canvas opened from the home logo shows the live For You feed
// (buildForYouCanvasDataset: key 'for-you:root', getActiveForYouElements, hasMoreForYou / loadMoreForYou), the same
// elements and paging as the home grid; here the home grid's feed (ForYouFeed) hands them over through this store.
import { create } from 'zustand';
import type { Element } from '../lib/elements';

type ForYouCanvasState = {
  items: Element[];
  hasMore: boolean;
  loading: boolean;
  loadMore: () => Promise<Element[]>;
};

export const useForYouCanvasStore = create<ForYouCanvasState>(() => ({
  items: [],
  hasMore: false,
  loading: false,
  loadMore: async () => [],
}));
