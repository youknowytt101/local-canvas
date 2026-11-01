// Cosmos' element viewer store (module 2113 openViewer / setCurrentIndex, createElementViewerId): opening the viewer
// hands it the whole list it was opened from (its elements, where it starts, how to load more of it, its
// userInteractionSource), under an id the route carries. The viewer pages through that list and asks for more
// (useViewerPagination: when 5 or fewer are left and there are more).
import { create } from 'zustand';
import type { Element } from '../lib/elements';
import { onElementSaved } from './useMoveSheetStore';

export type ViewerList = {
  elements: Element[];
  initialIndex: number;
  currentIndex: number;
  hasMore: boolean;
  loadMore?: () => Promise<Element[] | null>; // the next elements, or null when there are none
  userInteractionSource: string;
};

type ViewerState = {
  viewers: Record<string, ViewerList>;
  openViewer: (list: Omit<ViewerList, 'currentIndex'>) => string;
  setCurrentIndex: (viewerId: string, index: number) => void;
  appendElements: (viewerId: string, elements: Element[], hasMore: boolean) => void;
  closeViewer: (viewerId: string) => void;
  patchElement: (elementId: string, patch: Partial<Element>) => void;
};

let seq = 0;

export const useElementViewerStore = create<ViewerState>((set) => ({
  viewers: {},
  openViewer: (list) => {
    const viewerId = `viewer-${Date.now().toString(36)}-${++seq}`;
    set((s) => ({ viewers: { ...s.viewers, [viewerId]: { ...list, currentIndex: list.initialIndex } } }));
    return viewerId;
  },
  setCurrentIndex: (viewerId, index) => set((s) => {
    const v = s.viewers[viewerId];
    return v ? { viewers: { ...s.viewers, [viewerId]: { ...v, currentIndex: index } } } : s;
  }),
  appendElements: (viewerId, elements, hasMore) => set((s) => {
    const v = s.viewers[viewerId];
    if (!v) return s;
    const have = new Set(v.elements.map((e) => e.id));
    return { viewers: { ...s.viewers, [viewerId]: { ...v, elements: [...v.elements, ...elements.filter((e) => !have.has(e.id))], hasMore } } };
  }),
  // an element changed (saved somewhere): every open viewer showing it
  patchElement: (elementId, patch) => set((s) => ({
    viewers: Object.fromEntries(Object.entries(s.viewers).map(([id, v]) => [id, v.elements.some((e) => e.id === elementId)
      ? { ...v, elements: v.elements.map((e) => (e.id === elementId ? { ...e, ...patch } : e)) } : v])),
  })),
  closeViewer: (viewerId) => set((s) => {
    const { [viewerId]: _gone, ...rest } = s.viewers;
    return { viewers: rest };
  }),
}));

// the save sheet saved or took out an element: the viewers showing it say so (已保存)
onElementSaved((id, patch) => useElementViewerStore.getState().patchElement(id, patch));
