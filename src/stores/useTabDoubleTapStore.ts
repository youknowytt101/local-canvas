// Cosmos' useTabDoubleTapStore (module 2067): pressing the tab you are on bumps its token; that tab's root screen
// watches its token and scrolls back to the top.
import { useEffect, useRef } from 'react';
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

// for a tab's root screen: runs `onDoubleTap` on each new token (not on the one it mounted with)
export function useTabDoubleTap(tab: BottomTabRouteName, onDoubleTap: () => void) {
  const token = useTabDoubleTapStore((s) => s.tokens[tab]);
  const seen = useRef(token);
  const handler = useRef(onDoubleTap);
  handler.current = onDoubleTap;
  useEffect(() => {
    if (token === seen.current) return;
    seen.current = token;
    handler.current();
  }, [token]);
}
