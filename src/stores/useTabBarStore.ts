// Cosmos' useTabBarStore (module 1746): the bottom tabs' state, descriptors and navigation, handed over by TabBarBridge
// so that DynamicBar (drawn outside the navigator, above every screen) can draw and press the tabs.
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { create } from 'zustand';

type TabBarState = {
  tabNavProps: BottomTabBarProps | null;
  setTabNavProps: (props: BottomTabBarProps | null) => void;
};

export const useTabBarStore = create<TabBarState>((set) => ({
  tabNavProps: null,
  setTabNavProps: (tabNavProps) => set({ tabNavProps }),
}));
