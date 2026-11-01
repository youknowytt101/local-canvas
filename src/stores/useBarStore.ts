// Cosmos' useBarStore (module 1745): what the bar shows (`activeState`), whether a screen keeps it away
// (`tabBarSuppressed`) and the focused screen (`activeScreen`, the deepest focused route, set by RootNavigator on every
// navigation change). DynamicBar's getBarTargets reads them.
import { create } from 'zustand';
import type { BarContent } from '../components/bar/constants';

type BarState = {
  activeState: { type: BarContent };
  tabBarSuppressed: boolean;
  activeScreen: string | null;
  setActiveState: (activeState: { type: BarContent }) => void;
  setTabBarSuppressed: (tabBarSuppressed: boolean) => void;
  setActiveScreen: (activeScreen: string | null) => void;
};

export const useBarStore = create<BarState>((set) => ({
  activeState: { type: 'default' },
  tabBarSuppressed: false,
  activeScreen: null,
  setActiveState: (activeState) => set({ activeState }),
  setTabBarSuppressed: (tabBarSuppressed) => set({ tabBarSuppressed }),
  setActiveScreen: (activeScreen) => set({ activeScreen }),
}));
