// Cosmos' lib/explore/dismissGlobalSearchOverlays.js: search is a route of the main stack (Routes.SEARCH, fading in
// over the tabs), reached through the tabs' parent. Cosmos preloads it when the app is idle so that it opens at once.
// The overlays it dismisses: the colour picker (the filters are the Explore search's, not here).
import { CommonActions, StackActions } from '@react-navigation/native';
import { navigationRef } from '../navigation/navigationRef';
import { Routes } from '../navigation/routes';
import { useSearchStore } from '../stores/useSearchStore';
import { useTabBarStore } from '../stores/useTabBarStore';

const mainStack = () => useTabBarStore.getState().tabNavProps?.navigation.getParent() ?? null;

export const isGlobalSearchOverlayActive = () => {
  const state = mainStack()?.getState();
  return !!state && state.routes[state.index]?.name === Routes.SEARCH;
};

export function preloadGlobalSearch() {
  const run = () => {
    const main = mainStack();
    if (!navigationRef.isReady() || !main) return;
    // a stack's state lists the preloaded routes beside the others (StackRouter's preloadedRoutes)
    const state = main.getState() as ReturnType<typeof main.getState> & { preloadedRoutes?: { name: string }[] };
    if (state.routes.some((r) => r.name === Routes.SEARCH) || state.preloadedRoutes?.some((r) => r.name === Routes.SEARCH)) return;
    main.dispatch(CommonActions.preload(Routes.SEARCH));
  };
  requestIdleCallback(run);
}

export function openGlobalSearch() {
  const main = mainStack();
  if (!navigationRef.isReady() || !main) return;
  if (!isGlobalSearchOverlayActive()) main.dispatch(StackActions.push(Routes.SEARCH));
}

export function closeGlobalSearch() {
  const main = mainStack();
  if (main && isGlobalSearchOverlayActive()) main.dispatch(StackActions.pop());
}

// true when it closed something (the tab press then does nothing else)
export function dismissGlobalSearchOverlays(): boolean {
  if (!isGlobalSearchOverlayActive() || !useSearchStore.getState().picker.visible) return false;
  useSearchStore.getState().closeColorPicker();
  return true;
}
