// Cosmos' useBarState (module 3257): a screen's bar. While the screen is focused (and `enabled`), its entry is on the
// bar's stack (pushed, or replaced where it is when it changes); when it loses focus the entry goes, unless
// shouldRetainBlurredBarEntry keeps it (the screen now focused is in retainOnBlurForScreens, or is the same kind of
// screen as this one), in which case it stays under the new top one. Unmounted, the entry goes. `state` should keep its
// identity between renders (useMemo): a new one replaces the entry.
import { useIsFocused } from '@react-navigation/native';
import { useId, useLayoutEffect, useRef } from 'react';
import { shouldRetainBlurredBarEntry, useBarStore, type BarActiveState } from '../stores/useBarStore';

export function useBarState(state: BarActiveState, enabled = true, options?: { retainOnBlurForScreens?: ReadonlySet<string> }) {
  const id = useId();
  const isFocused = useIsFocused();
  const activeScreen = useBarStore((s) => s.activeScreen);
  const hasEntry = useRef(false);
  const lastFocusedScreen = useRef<string | null>(null);
  const retainOnBlurForScreens = options?.retainOnBlurForScreens;

  useLayoutEffect(() => {
    const bar = useBarStore.getState();
    if (isFocused && enabled) {
      lastFocusedScreen.current = activeScreen;
      if (!(hasEntry.current && bar.replace(id, state))) bar.push(id, state);
      hasEntry.current = true;
      return;
    }
    const retain = enabled && !isFocused && shouldRetainBlurredBarEntry({
      activeScreen, hasEntry: hasEntry.current, lastFocusedScreen: lastFocusedScreen.current, retainOnBlurForScreens,
    });
    if (retain) {
      if (hasEntry.current && !bar.replace(id, state)) hasEntry.current = false;
      return;
    }
    if (hasEntry.current) {
      bar.pop(id);
      hasEntry.current = false;
    }
  }, [activeScreen, enabled, id, isFocused, retainOnBlurForScreens, state]);

  useLayoutEffect(() => () => {
    useBarStore.getState().pop(id);
    hasEntry.current = false;
    lastFocusedScreen.current = null;
  }, [id]);
}
