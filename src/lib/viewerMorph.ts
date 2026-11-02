// A grid's tile grows into the viewer's media and shrinks back into it: the web page's container transform (the
// person's choice there, HANDOFF 6.65 / 6.67, and asked for again here, 6.170; Cosmos pushes its viewer, 6.63). The
// thing tapped becomes the thing it opens: the tile's picture flies from its place to where the viewer's media will be
// (ViewerMorphOverlay, over every screen), the viewer fades in over the page, which stays where it is, and the tile and
// the viewer's media are out of sight while it flies. Back, while the same element is on screen and its tile still on
// the page, the other way round as the viewer fades out.
//   - 450 ms in, 400 ms out, on the stack's emphasized curve (fast_out_extra_slow_in); the viewer fades over 250 ms
//     (MORPH_IN_MS / MORPH_OUT_MS / MORPH_FADE_MS of the web page's app.js)
//   - where the media will be is worked out at once (the viewer's layout, its description counted as two rows), and
//     corrected as soon as the viewer has laid it out; the picture waits there for a viewer slow to render
//   - the picture shows, the tile hides and the flight starts before the viewer is pushed (its render holds the JS
//     thread up; the flight runs on the UI thread)
// Without a tile on screen (or with one already flying) the viewer is pushed as before.
// On iOS 18 and later the system's zoom transition does it instead (modules/zoom-transition, the person's choice after
// this one was "not right", HANDOFF 6.173): the whole screen grows out of the tile and can be dragged back down; this
// file only says which tile and which media (by testID, zoomTileId / zoomMediaId), and the flight here stays for Android
// and older iOS.
import type { View } from 'react-native';
import { zoomTransition } from '../../modules/zoom-transition';
import { Easing, makeMutable, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { create } from 'zustand';
import type { Element } from './elements';

export const MORPH_IN_MS = 450;
export const MORPH_OUT_MS = 400;
export const MORPH_FADE_MS = 250;
const PRESS_FRESH_MS = 1500; // a press this old is not the one that opened the viewer

export type Rect = { x: number; y: number; w: number; h: number };

// @android:interpolator/fast_out_extra_slow_in, "M 0,0 C 0.05,0 0.133333,0.06 0.166666,0.4 C 0.208333,0.82 0.25,1 1,1"
// (the web page's ease.fastOutExtraSlowIn): y for x on the segment holding x
export function emphasized(x: number) {
  'worklet';
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const s = x <= 0.166666 ? [0, 0, 0.05, 0, 0.133333, 0.06, 0.166666, 0.4] : [0.166666, 0.4, 0.208333, 0.82, 0.25, 1, 1, 1];
  let lo = 0;
  let hi = 1;
  let t = 0.5;
  for (let i = 0; i < 30; i++) {
    t = (lo + hi) / 2;
    const u = 1 - t;
    if (u * u * u * s[0] + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6] < x) lo = t;
    else hi = t;
  }
  const u = 1 - t;
  return u * u * u * s[1] + 3 * u * u * t * s[3] + 3 * u * t * t * s[5] + t * t * t * s[7];
}

type Tile = { key: number; elementId: string; view: View | null; image: string | null; blurred: boolean };
type Phase = 'idle' | 'opening' | 'closing';

// flying: the overlay's picture is on screen and moving; only then are the tile and the viewer's media out of sight (a
// picture shown a few frames late left the tile's place empty)
export const useViewerMorph = create<{ phase: Phase; flying: boolean; tileKey: number | null; elementId: string | null; image: string | null; blurred: boolean }>(
  () => ({ phase: 'idle', flying: false, tileKey: null, elementId: null, image: null, blurred: false }),
);
// what the overlay draws: from, to (each side moved on its own, so a late correction glides), the progress
export const morphFrom = makeMutable({ x: 0, y: 0, w: 0, h: 0, r: 0 });
export const morphTo = { x: makeMutable(0), y: makeMutable(0), w: makeMutable(0), h: makeMutable(0), r: makeMutable(0) };
export const morphProgress = makeMutable(0);

const tiles = new Map<number, Tile>(); // the tiles mounted now
const viewerMedia = new Map<string, View>(); // the viewer's media boxes mounted now
let pressed: { tile: Tile; at: number } | null = null;
let origin: Tile | null = null; // the tile the open viewer grew from
let startedAt = 0;
let waiting: number | null = null; // the flight's duration, until its picture is on screen
let landed = false; // the viewer has laid its media out
let faded = false; // the viewer's fade has ended (it was see-through until then): with both, the picture hands over
let arrived = false; // the flight is over
let waitTimer: ReturnType<typeof setTimeout> | undefined;
const SHOWN_WAIT_MS = 150; // the picture not shown by then: it flies anyway
const LAND_WAIT_MS = 2500; // the viewer not laid out and shown by then: the picture goes anyway
const LAST_GLIDE_MS = 120;
let landTimer: ReturnType<typeof setTimeout> | undefined;
let predict: ((el: Element) => Rect | null) | null = null;
let screen = { width: 0, height: 0 };

export function setMorphPredictor(fn: (el: Element) => Rect | null, size: { width: number; height: number }) {
  predict = fn;
  screen = size;
}

export const mountTile = (tile: Tile) => { tiles.set(tile.key, tile); };
export const unmountTile = (key: number) => { tiles.delete(key); };
export const notePressedTile = (tile: Tile) => { pressed = { tile, at: Date.now() }; };
export const zoomTileId = (key: number) => `zoom-tile-${key}`;
export const zoomMediaId = (elementId: string) => `zoom-media-${elementId}`;
// a tile of this element on the page, to zoom back into (the one it opened from first)
export function zoomTileFor(elementId: string): string | null {
  if (origin?.elementId === elementId && tiles.has(origin.key)) return zoomTileId(origin.key);
  for (const t of tiles.values()) if (t.elementId === elementId) return zoomTileId(t.key);
  return null;
}
export function mountViewerMedia(elementId: string, view: View | null) {
  if (view) viewerMedia.set(elementId, view);
  else viewerMedia.delete(elementId);
}

const onScreen = (r: Rect) => r.w > 4 && r.h > 4 && r.y + r.h > 0 && r.y < screen.height && r.x + r.w > 0 && r.x < screen.width;
const measure = (view: View | null | undefined, done: (r: Rect | null) => void) => {
  if (!view) { done(null); return; }
  view.measureInWindow((x, y, w, h) => done(Number.isFinite(x) && Number.isFinite(y) ? { x, y, w, h } : null));
};

function settle() {
  useViewerMorph.setState({ phase: 'idle', flying: false, tileKey: null, elementId: null, image: null });
}
// the flight is over: it hands over once the viewer's media is there (a viewer slow to render keeps the picture where
// its media will be until then)
function arrive() {
  arrived = true;
  if ((landed && faded) || useViewerMorph.getState().phase === 'closing') settle();
}

// the viewer's push has ended
export function morphViewerFaded() {
  if (useViewerMorph.getState().phase !== 'opening' || faded) return;
  faded = true;
  if (landed && arrived) settle();
}

let thenOpen: (() => void) | null = null;
function waitToFly(duration: number, then: (() => void) | null = null) {
  waiting = duration;
  thenOpen = then;
  clearTimeout(waitTimer);
  waitTimer = setTimeout(morphShown, SHOWN_WAIT_MS);
}

// the overlay's picture is on screen: it flies
export function morphShown() {
  if (waiting == null) return;
  const duration = waiting;
  waiting = null;
  clearTimeout(waitTimer);
  // the original hides a frame later: the picture said to be shown is composited by then (else one empty frame)
  requestAnimationFrame(() => { if (useViewerMorph.getState().phase !== 'idle') useViewerMorph.setState({ flying: true }); });
  startedAt = Date.now();
  arrived = false;
  morphProgress.value = withTiming(1, { duration, easing: emphasized }, () => {
    'worklet';
    scheduleOnRN(arrive); // cut short too: nothing stays out of sight
  });
  // the viewer comes a couple of frames later: its first render holds the JS thread up for a while (0.7 s on the
  // emulator), and the picture, the tile's hiding and the flight (on the UI thread) are under way before it
  const then = thenOpen;
  thenOpen = null;
  if (then) requestAnimationFrame(() => requestAnimationFrame(then));
}

// the viewer is opening on this element: grows its tile if the tile was just pressed and is on screen (iOS 18: the
// system zooms it, from what is armed here); open(how) is called either way, at once or once the tile has been measured
export function openWithMorph(el: Element, viewerId: string, open: (how: 'morph' | 'zoom' | null) => void) {
  const press = pressed;
  pressed = null;
  const tile = press && Date.now() - press.at < PRESS_FRESH_MS && press.tile.elementId === el.id && tiles.has(press.tile.key) ? press.tile : null;
  if (zoomTransition) {
    if (!tile) { open(null); return; }
    origin = tile;
    zoomTransition.arm(viewerId, zoomTileId(tile.key), zoomMediaId(el.id));
    open('zoom');
    return;
  }
  const to = tile?.image && predict ? predict(el) : null;
  if (!tile || !to || useViewerMorph.getState().phase !== 'idle') { open(null); return; }
  measure(tile.view, (from) => {
    if (!from || !onScreen(from)) { open(null); return; }
    origin = tile;
    morphFrom.value = { ...from, r: 3 }; // the tile's borderRadius.element; the viewer's media is square-cornered
    morphTo.x.value = to.x;
    morphTo.y.value = to.y;
    morphTo.w.value = to.w;
    morphTo.h.value = to.h;
    morphTo.r.value = 0;
    morphProgress.value = 0;
    useViewerMorph.setState({ phase: 'opening', flying: false, tileKey: tile.key, elementId: el.id, image: tile.image, blurred: tile.blurred });
    landed = false;
    faded = false;
    clearTimeout(landTimer);
    landTimer = setTimeout(() => { landed = true; faded = true; if (arrived) settle(); }, LAND_WAIT_MS);
    waitToFly(MORPH_IN_MS, () => open('morph'));
  });
}

// the viewer has laid its media out: the flight ends there
export function landMorph(elementId: string, view: View | null) {
  const s = useViewerMorph.getState();
  if (s.phase !== 'opening' || s.elementId !== elementId) return;
  measure(view, (r) => {
    if (!r || useViewerMorph.getState().phase !== 'opening') return;
    landed = true;
    if (arrived) { // it waited where the media was guessed to be (the description's height is a guess): the last bit
      const last = { duration: LAST_GLIDE_MS, easing: Easing.out(Easing.quad) };
      morphTo.y.value = withTiming(r.y, last);
      morphTo.w.value = withTiming(r.w, last);
      morphTo.h.value = withTiming(r.h, last);
      morphTo.x.value = withTiming(r.x, last);
      if (faded) setTimeout(settle, LAST_GLIDE_MS);
      return;
    }
    if (waiting != null) { // not flying yet: it simply flies there
      morphTo.x.value = r.x;
      morphTo.y.value = r.y;
      morphTo.w.value = r.w;
      morphTo.h.value = r.h;
      return;
    }
    const left = Math.max(16, MORPH_IN_MS - (Date.now() - startedAt));
    const glide = { duration: left, easing: Easing.out(Easing.quad) };
    morphTo.x.value = withTiming(r.x, glide);
    morphTo.y.value = withTiming(r.y, glide);
    morphTo.w.value = withTiming(r.w, glide);
    morphTo.h.value = withTiming(r.h, glide);
  });
}

// the viewer that grew from a tile is going: shrinks back into it while that element is on screen and the tile on the
// page (both measured), else it only fades
export function closeWithMorph(el: Element | null | undefined) {
  const tile = origin;
  origin = null;
  if (!el || !tile || tile.elementId !== el.id || !tiles.has(tile.key) || useViewerMorph.getState().phase !== 'idle') return;
  measure(viewerMedia.get(el.id), (from) => {
    if (!from || !onScreen(from)) return;
    measure(tile.view, (to) => {
      if (!to || !onScreen(to) || useViewerMorph.getState().phase !== 'idle') return;
      morphFrom.value = { ...from, r: 0 };
      morphTo.x.value = to.x;
      morphTo.y.value = to.y;
      morphTo.w.value = to.w;
      morphTo.h.value = to.h;
      morphTo.r.value = 3;
      morphProgress.value = 0;
      useViewerMorph.setState({ phase: 'closing', flying: false, tileKey: tile.key, elementId: el.id, image: tile.image, blurred: tile.blurred });
      waitToFly(MORPH_OUT_MS);
    });
  });
}

// a tile or a viewer's media out of sight while its picture flies
export const useMorphHidesTile = (key: number) => useViewerMorph((s) => s.flying && s.tileKey === key);
export const useMorphHidesViewerMedia = (elementId: string) => useViewerMorph((s) => s.flying && s.elementId === elementId);
