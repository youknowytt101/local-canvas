// Cosmos' useTabDoubleTapStore (module 2067): pressing the tab you are on bumps its token; that tab's lists watch it
// through useTabReselect (hooks/useTabReselect.ts).
import { create } from 'zustand';
import { Routes, type BottomTabRouteName } from '../navigation/routes';

type TabDoubleTapState = {
  tokens: Record<BottomTabRouteName, number>;
  trigger: (tab: BottomTabRouteName) => void;
};

export const useTabDoubleTapStore = create<TabDoubleTapState>((set) => ({
  tokens: { [Routes.HOME]: 0, [Routes.EXPLORE]: 0, [Routes.SHOP]: 0, [Routes.PROFILE]: 0 },
  trigger: (tab) => set((s) => ({ tokens: { ...s.tokens, [tab]: s.tokens[tab] + 1 } })),
}));
