// Cosmos' openElementViewer (module 2227): put the list in the viewer store and push ElementsViewer onto the stack the
// press happened in (each tab's stack has it). Cosmos gives it no transition of its own (the native stack's default
// push); here the tile just pressed grows into it when it can (lib/viewerTransition, the person's choice, HANDOFF 6.176):
// the page is snapshotted first (a few tens of ms), then the viewer is pushed without an animation and grows itself.
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Routes } from '../navigation/routes';
import { useElementViewerStore, type ViewerList } from '../stores/useElementViewerStore';
import { prepareViewerTransition } from './viewerTransition';
import { playViewerVideo } from './viewerVideoPlayers';

let opening = false; // a second tap while the first is being snapshotted opens nothing

export function openElementViewer(navigation: NavigationProp<ParamListBase>, list: Omit<ViewerList, 'currentIndex'>) {
  if (opening) return;
  opening = true;
  const el = list.elements[list.initialIndex];
  const viewerId = useElementViewerStore.getState().openViewer(list);
  playViewerVideo(el); // it starts now, not when the viewer has rendered
  const push = (grow: boolean) => {
    opening = false;
    const params = { viewerId, initialIndex: list.initialIndex, ...(grow ? { openAnimation: 'zoom' as const } : {}) };
    navigation.dispatch({ type: 'PUSH', payload: { name: Routes.ELEMENTS_VIEWER, params } });
  };
  prepareViewerTransition(el, viewerId).then(push, () => push(false));
}
