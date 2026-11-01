// Cosmos' useBarStore (module 1745): what the bar shows (`activeState`), whether a screen keeps it away
// (`tabBarSuppressed`) and the focused screen (`activeScreen`, the deepest focused route, set by RootNavigator on every
// navigation change). DynamicBar's getBarTargets reads them. The element viewer also hands over its bar
// (elementViewerBarState: actions or the scroll-to-top, whether the element is saved, and what each button does), and a
// collection its own (clusterBarState).
import { create } from 'zustand';
import type { BarContent } from '../components/bar/constants';

export type ElementViewerBarState = {
  viewerId: string;
  mode: 'actions' | 'scrollToTop';
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onMore: () => void;
  onScrollToTop: () => void;
};

// a collection's bar (useClusterActionBarState): its own / one it works on gets the actions, anyone else's 看相似
export type ClusterBarState = {
  clusterId: string;
  canOrganize: boolean;
  similarOn: boolean;
  onOrganize: () => void;
  onAdd: () => void;
  onSimilar: () => void;
  onShare: () => void;
};

type BarState = {
  activeState: { type: BarContent };
  tabBarSuppressed: boolean;
  activeScreen: string | null;
  elementViewerBarState: ElementViewerBarState | null;
  clusterBarState: ClusterBarState | null;
  setActiveState: (activeState: { type: BarContent }) => void;
  setTabBarSuppressed: (tabBarSuppressed: boolean) => void;
  setActiveScreen: (activeScreen: string | null) => void;
  setElementViewerBarState: (state: ElementViewerBarState | null) => void;
  setClusterBarState: (state: ClusterBarState | null) => void;
};

export const useBarStore = create<BarState>((set) => ({
  activeState: { type: 'default' },
  tabBarSuppressed: false,
  activeScreen: null,
  elementViewerBarState: null,
  clusterBarState: null,
  setActiveState: (activeState) => set({ activeState }),
  setTabBarSuppressed: (tabBarSuppressed) => set({ tabBarSuppressed }),
  setActiveScreen: (activeScreen) => set({ activeScreen }),
  setElementViewerBarState: (elementViewerBarState) => set({ elementViewerBarState }),
  setClusterBarState: (clusterBarState) => set({ clusterBarState }),
}));
