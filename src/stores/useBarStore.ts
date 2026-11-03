// Cosmos' useBarStore (module 1745) with what its useTabBarStore (module 1746) holds besides the tabs:
//  - a stack of bar states, one entry per screen (id) that wants its own bar; the bar shows the top one (`activeState`,
//    the default tabs when the stack is empty). push(id, state) puts an entry on top (taking out an older one of that
//    id), replace(id, state) changes an entry where it is (false when there is none), pop(id) takes it out.
//    lastClusterState / lastOrganizeState are the last collection / organize states pushed or replaced, which their
//    contents keep drawing while they fade out.
//  - whether a screen keeps the bar away (`tabBarSuppressed`) and the focused screen (`activeScreen`, the deepest
//    focused route, set by RootNavigator on every navigation change)
//  - the element viewer's own (elementViewerBarState: its viewer, actions or scroll-to-top, and here, since the
//    content does not fetch the element itself, whether it is saved and what each button does)
// Screens hand their entry over through useBarState (hooks/useBarState.ts); the viewer through its own push / pop.
import { create } from 'zustand';

export type ClusterBarState = {
  type: 'cluster';
  clusterId: string;
  canOrganizeCluster: boolean;
  onOrganize: () => void;
  onAdd: () => void;
  onSimilarPress: () => void;
  onShare: () => void;
};
export type OrganizeBarState = {
  type: 'organize';
  isFromSubCluster: boolean;
  selectedCount: number;
  onMove: () => void;
  onRemove: () => void;
  onDone: () => void;
};
export type BarActiveState =
  | { type: 'default' }
  | { type: 'global-search' }
  | { type: 'element' }
  | { type: 'scroll-to-top'; onPress: () => void }
  | { type: 'cluster-see-similar'; onPress: () => void }
  | ClusterBarState
  | OrganizeBarState;

export type ElementViewerBarState = {
  viewerId: string;
  mode: 'actions' | 'scrollToTop';
  scrollToTopHandler: () => void;
  elementId: string;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onMore: () => void;
};

type Entry = { id: string; state: BarActiveState };

type BarState = {
  stack: Entry[];
  activeState: BarActiveState;
  lastClusterState: ClusterBarState | null;
  lastOrganizeState: OrganizeBarState | null;
  push: (id: string, state: BarActiveState) => void;
  replace: (id: string, state: BarActiveState) => boolean;
  pop: (id: string) => void;
  popByType: (type: BarActiveState['type']) => void;
  reset: () => void;
  tabBarSuppressed: boolean;
  activeScreen: string | null;
  elementViewerBarState: ElementViewerBarState | null;
  setTabBarSuppressed: (tabBarSuppressed: boolean) => void;
  setActiveScreen: (activeScreen: string | null) => void;
  setElementViewerBarState: (state: ElementViewerBarState | null) => void;
};

const DEFAULT_STATE: BarActiveState = { type: 'default' };
const top = (stack: Entry[]) => stack[stack.length - 1]?.state ?? DEFAULT_STATE;

export const useBarStore = create<BarState>((set, get) => {
  // updateStackState
  const update = (stack: Entry[], state: BarActiveState | null) => {
    const s = get();
    set({
      stack,
      activeState: top(stack),
      lastClusterState: state?.type === 'cluster' ? state : s.lastClusterState,
      lastOrganizeState: state?.type === 'organize' ? state : s.lastOrganizeState,
    });
  };
  return {
    stack: [],
    activeState: DEFAULT_STATE,
    lastClusterState: null,
    lastOrganizeState: null,
    push: (id, state) => update([...get().stack.filter((e) => e.id !== id), { id, state }], state),
    replace: (id, state) => {
      let found = false;
      const stack = get().stack.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return { id, state };
      });
      if (found) update(stack, state);
      return found;
    },
    pop: (id) => update(get().stack.filter((e) => e.id !== id), null),
    popByType: (type) => update(get().stack.filter((e) => e.state.type !== type), null),
    reset: () => set({ stack: [], activeState: DEFAULT_STATE }),
    tabBarSuppressed: false,
    activeScreen: null,
    elementViewerBarState: null,
    setTabBarSuppressed: (tabBarSuppressed) => set({ tabBarSuppressed }),
    setActiveScreen: (activeScreen) => set({ activeScreen }),
    setElementViewerBarState: (elementViewerBarState) => set({ elementViewerBarState }),
  };
});

// shouldRetainBlurredBarEntry: a screen that has lost focus keeps its entry (under the new top one) while the focused
// screen is one it is kept under, or one of its own kind (a collection opened from a collection)
export function shouldRetainBlurredBarEntry({ activeScreen, hasEntry, lastFocusedScreen, retainOnBlurForScreens }: {
  activeScreen: string | null; hasEntry: boolean; lastFocusedScreen: string | null; retainOnBlurForScreens?: ReadonlySet<string>;
}) {
  if (!hasEntry || retainOnBlurForScreens == null) return false;
  if (lastFocusedScreen != null && activeScreen === lastFocusedScreen) return true;
  return activeScreen != null && retainOnBlurForScreens.has(activeScreen);
}
