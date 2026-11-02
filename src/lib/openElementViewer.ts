// Cosmos' openElementViewer (module 2227): put the list in the viewer store and push ElementsViewer onto the stack the
// press happened in (each tab's stack has it), with no transition of its own: the native stack's default push.
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Routes } from '../navigation/routes';
import { useElementViewerStore, type ViewerList } from '../stores/useElementViewerStore';
import { playViewerVideo } from './viewerVideoPlayers';

export function openElementViewer(navigation: NavigationProp<ParamListBase>, list: Omit<ViewerList, 'currentIndex'>) {
  const viewerId = useElementViewerStore.getState().openViewer(list);
  playViewerVideo(list.elements[list.initialIndex]); // it starts now, not when the viewer has rendered
  navigation.dispatch({ type: 'PUSH', payload: { name: Routes.ELEMENTS_VIEWER, params: { viewerId, initialIndex: list.initialIndex } } });
}
