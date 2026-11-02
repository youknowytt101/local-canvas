// A grid's tile opens into the viewer and the viewer goes back into it: its picture flies between the tile and the
// viewer's media while everything behind darkens alike and the viewer's page fades in over it (Photos'; the person's
// choice, HANDOFF 6.170 / 6.176 / 6.177 — Cosmos pushes its viewer, 6.63). Owned on both platforms rather than patched
// into UIKit:
//   - the viewer is pushed without an animation and runs its own transition (components/elements/ViewerTransition) over
//     the page it was opened from; going back, the picture flies into the tile of the element on screen and the viewer
//     is only popped once it is there
//   - that page stays in sight behind it. Android: it is pushed as a transparent modal, and the page under it is still
//     drawn (a screen pushed after it still goes on top there). iOS: a screen pushed after a modal would go under it,
//     so it is pushed as a card and draws a snapshot of the page instead (Skia's makeImageFromView, the system's own
//     view snapshot; on Android that one redraws every view in software, 300 - 600 ms on the emulator)
//   - the tile the picture flies out of or into is out of sight meanwhile (the system zoom hides its source the same
//     way): in the snapshot it is covered, on Android the tile itself is hidden (hiddenTileKey), and so is the
//     viewer's media while its picture flies (hiddenViewerMedia)
//   - without a tile just pressed and on screen (or without a snapshot on iOS) the viewer is pushed as before
// A grid's tiles register here (mountTile) with the screen they are on and say when they are pressed (notePressedTile);
// only the tiles of the page the viewer is opened from and in sight there count (the pages under it and the other tabs
// keep theirs mounted, often of the same elements). The viewer's media boxes register too (mountViewerMedia), so that
// the viewer can measure the one on screen.
import { makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import type { RefObject } from 'react';
import { Dimensions, Platform, type View } from 'react-native';
import { makeMutable, useAnimatedStyle } from 'react-native-reanimated';
import type { Element } from './elements';

export type Rect = { x: number; y: number; w: number; h: number };
// screen: the key of the route it is drawn in; image: its picture, already loaded
type Tile = { key: number; elementId: string; screen: string | null; view: View | null; image: string | null; blurred: boolean };
export type TransitionTile = { key: number; elementId: string; rect: Rect; image: string | null; blurred: boolean };
export type ViewerTransition = {
  from: TransitionTile; // the tile it opened from, in the window
  tiles: TransitionTile[]; // the tiles in sight on that page, where they are
  backdrop: SkImage | null; // iOS: the page under it
};

// Android keeps the page under the viewer drawn (a transparent modal); iOS snapshots it
export const TRANSITION_OVER_LIVE_PAGE = Platform.OS === 'android';
const PRESS_FRESH_MS = 1500; // a press this old is not the one that opened the viewer
const SNAPSHOT_WAIT_MS = 300; // a snapshot slower than this: the viewer is pushed as before

const tiles = new Map<number, Tile>(); // the tiles mounted now
const viewerMedia = new Map<string, View>(); // the viewer's media boxes mounted now
const mediaShown = new Set<string>(); // ...that have shown their picture
const mediaListeners = new Set<(elementId: string) => void>();
let pressed: { tile: Tile; at: number } | null = null;
let root: RefObject<View | null> | null = null;
const transitions = new Map<string, ViewerTransition>();

export const mountTile = (tile: Tile) => { tiles.set(tile.key, tile); };
export const unmountTile = (key: number) => { tiles.delete(key); };
export const notePressedTile = (tile: Tile) => { pressed = { tile, at: Date.now() }; };
// the view holding every screen and nothing drawn over them (not the bar): what is snapshotted
export const setTransitionRoot = (ref: RefObject<View | null>) => { root = ref; };

// the tile a viewer's picture flies out of or into, out of sight meanwhile (Android: the page under it is live), and
// the viewer's media while its picture flies: shared values, so that they go on the frame the picture starts to move
// rather than on the next render of a page busy with the viewer
export const hiddenTileKey = makeMutable(-1);
export const hiddenViewerMedia = makeMutable('');
export const useTransitionTileStyle = (key: number) => useAnimatedStyle(() => ({ opacity: hiddenTileKey.value === key ? 0 : 1 }));
export const useViewerMediaStyle = (elementId: string) => useAnimatedStyle(() => ({ opacity: hiddenViewerMedia.value === elementId ? 0 : 1 }));

export function mountViewerMedia(elementId: string, view: View | null) {
  if (view) viewerMedia.set(elementId, view);
  else {
    viewerMedia.delete(elementId);
    mediaShown.delete(elementId);
  }
}
export const viewerMediaView = (elementId: string) => viewerMedia.get(elementId) ?? null;
// the viewer's media has laid out, or shown its picture: the transition lines up with it
export function noteViewerMedia(elementId: string, shown = false) {
  if (shown) mediaShown.add(elementId);
  mediaListeners.forEach((l) => l(elementId));
}
export const isViewerMediaShown = (elementId: string) => mediaShown.has(elementId);
export function watchViewerMedia(listener: (elementId: string) => void) {
  mediaListeners.add(listener);
  return () => { mediaListeners.delete(listener); };
}

export function measureInWindow(view: View | null | undefined): Promise<Rect | null> {
  return new Promise((done) => {
    if (!view) { done(null); return; }
    view.measureInWindow((x, y, w, h) => done(Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0 ? { x, y, w, h } : null));
  });
}

function onScreen(r: Rect) {
  const { width, height } = Dimensions.get('window');
  return r.w > 4 && r.h > 4 && r.y + r.h > 0 && r.y < height && r.x + r.w > 0 && r.x < width;
}

const timeout = <T>(ms: number) => new Promise<T | null>((done) => { setTimeout(() => done(null), ms); });

function snapshot(): Promise<SkImage | null> {
  if (TRANSITION_OVER_LIVE_PAGE || !root?.current) return Promise.resolve(null);
  const shot = makeImageFromView(root as RefObject<View>).catch(() => null);
  return Promise.race([shot, timeout<SkImage>(SNAPSHOT_WAIT_MS)]).then((image) => {
    if (!image) void shot.then((late) => late?.dispose()); // one that comes after all is let go
    return image;
  });
}

// the viewer about to open on this element: true once its transition is ready (the tile just pressed and the others
// measured, on iOS the page snapshotted), false to push it as before
export async function prepareViewerTransition(el: Element, viewerId: string): Promise<boolean> {
  const press = pressed;
  pressed = null;
  const tile = press && Date.now() - press.at < PRESS_FRESH_MS && press.tile.elementId === el.id && tiles.has(press.tile.key) ? press.tile : null;
  if (!tile) return false;
  const all = [...tiles.values()].filter((t) => t.screen === tile.screen);
  const [rects, backdrop] = await Promise.all([Promise.all(all.map((t) => measureInWindow(t.view))), snapshot()]);
  const measured = all.flatMap((t, i) => (rects[i] && onScreen(rects[i]!)
    ? [{ key: t.key, elementId: t.elementId, rect: rects[i]!, image: t.image, blurred: t.blurred }] : []));
  const from = measured.find((t) => t.key === tile.key);
  if (!from || (!TRANSITION_OVER_LIVE_PAGE && !backdrop)) {
    backdrop?.dispose();
    return false;
  }
  // as it was pressed (what it shows can have changed since it was mounted)
  transitions.set(viewerId, { from: { ...from, image: tile.image, blurred: tile.blurred }, backdrop, tiles: measured });
  return true;
}

export const viewerTransitionFor = (viewerId: string) => transitions.get(viewerId) ?? null;

// the viewer has gone: its snapshot is let go (a frame may still be drawing it)
export function forgetViewerTransition(viewerId: string) {
  const t = transitions.get(viewerId);
  transitions.delete(viewerId);
  if (t?.backdrop) setTimeout(() => t.backdrop?.dispose(), 500);
}
