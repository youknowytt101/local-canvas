// Cosmos' pushInfiniteCanvasOntoActiveStack: the canvas is pushed onto the stack that is in front (every tab's stack
// and the search stack have it), with its own 'fade'. The container hands the action to the focused screen's navigator.
import { navigationRef } from '../navigation/navigationRef';
import { Routes } from '../navigation/routes';
import type { InfiniteCanvasParams } from '../screens/canvas/InfiniteCanvasScreen';

export function pushInfiniteCanvas(params: InfiniteCanvasParams = {}) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch({ type: 'PUSH', payload: { name: Routes.INFINITE_CANVAS, params } });
}
