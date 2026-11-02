// A grid's tile grows into the viewer and the viewer shrinks back into it: a container transform (Material's container
// transform, iOS 18's zoom transition; the person's choice, HANDOFF 6.170 / 6.176 — Cosmos pushes its viewer, 6.63).
// What the system zoom does is done here on both platforms, owned rather than patched into UIKit:
//   - the viewer is pushed without an animation and grows itself (components/elements/ViewerTransition) out of the
//     tile just pressed, its media lined up with the tile, over the page it was opened from; it shrinks back into the
//     tile of the element on screen and is only popped once it is there
//   - that page stays in sight around it. Android: it is pushed as a transparent modal, and the page under it is still
//     drawn (a screen pushed after it still goes on top there). iOS: a screen pushed after a modal would go under it,
//     so it is pushed as a card and draws a snapshot of the page instead (Skia's makeImageFromView, the system's own
//     view snapshot; on Android that one redraws every view in software, 300 - 600 ms on the emulator)
//   - the tile it grows from or goes back into is out of sight meanwhile (the system zoom hides its source the same
//     way): in the snapshot it is covered, on Android the tile itself is hidden (useTransitionHidesTile)
//   - without a tile just pressed and on screen (or without a snapshot on iOS) the viewer is pushed as before
// A grid's tiles register here (mountTile) and say when they are pressed (notePressedTile); the viewer's media boxes
// register too (mountViewerMedia), so that the viewer can measure the one on screen.
import { makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import type { RefObject } from 'react';
import { Dimensions, Platform, type View } from 'react-native';
import { create } from 'zustand';
import type { Element } from './elements';

export type Rect = { x: number; y: number; w: number; h: number };
type Tile = { key: number; elementId: string; view: View | null; image: string | null; blurred: boolean };
export type TransitionTile = { key: number; elementId: string; rect: Rect };
export type ViewerTransition = {
  from: TransitionTile; // the tile it grew from, in the window
  image: string | null; // that tile's picture, already loaded
  blurred: boolean;
  tiles: TransitionTile[]; // every tile on the page, where it is
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

// the tile a viewer grows out of or goes back into, out of sight while it does (Android: the page under it is live)
const useHiddenTile = create<{ key: number | null }>(() => ({ key: null }));
export const hideTransitionTile = (key: number | null) => useHiddenTile.setState({ key });
export const useTransitionHidesTile = (key: number) => useHiddenTile((s) => s.key === key);

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
  const all = [...tiles.values()];
  const [rects, backdrop] = await Promise.all([Promise.all(all.map((t) => measureInWindow(t.view))), snapshot()]);
  const measured = all.flatMap((t, i) => (rects[i] ? [{ key: t.key, elementId: t.elementId, rect: rects[i]! }] : []));
  const from = measured.find((t) => t.key === tile.key);
  if (!from || !onScreen(from.rect) || (!TRANSITION_OVER_LIVE_PAGE && !backdrop)) {
    backdrop?.dispose();
    return false;
  }
  transitions.set(viewerId, { from, image: tile.image, blurred: tile.blurred, backdrop, tiles: measured });
  return true;
}

export const viewerTransitionFor = (viewerId: string) => transitions.get(viewerId) ?? null;

// the viewer has gone: its snapshot is let go (a frame may still be drawing it)
export function forgetViewerTransition(viewerId: string) {
  const t = transitions.get(viewerId);
  transitions.delete(viewerId);
  if (t?.backdrop) setTimeout(() => t.backdrop?.dispose(), 500);
}
