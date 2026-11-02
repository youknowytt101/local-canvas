// The viewer growing out of the tile it was opened from and shrinking back into it (lib/viewerTransition), around the
// viewer's page. Drawn bottom to top:
//   - the page it was opened from (Android: that page itself, under this transparent modal; iOS: its snapshot), the
//     tile it is going back into out of sight there while it shrinks or is dragged (the system zoom hides its source
//     the same way; opening, the container holds the tile all the way), under Material's 32 % scrim as far as the
//     viewer covers the page
//   - the container: a box clipped to its shape (the tile's 3 corners at the tile, square at the full screen, rounder
//     while dragged), holding the whole page at its own size, scaled and moved so that its media lies on the tile
//     (iOS 18's zoom lines the destination up with its source the same way). Opening, it fades in over the tile in its
//     first OPEN_FADE of the way (MaterialContainerTransform's FADE_MODE_IN, [0, 0.25]), so the tile itself is what
//     is seen at first, and the tile's own picture lies over the page's media until that has shown its picture; the
//     page's heavy content is only mounted once it is OPEN_SETTLED of the way (mounting it on the way held the UI
//     thread up and the growth jumped)
// Motion is springs without a bounce (the system's for its zoom; interruptible, and taking a drag's speed along):
//   - opening, OPEN; going back (the back button, Android's back) into the tile of the element on screen, CLOSE, the
//     page only popped once it is there; without that element's tile on the page it shrinks a little and fades
//   - dragged down from the top of the page (or right from the left edge), the page follows the finger and shrinks
//     about it, its corners round and the scrim lifts; let go fast enough or far enough, it flies into the tile with the
//     finger's speed, else it springs back (Photos, the App Store; WWDC 2018 "Designing Fluid Interfaces")
import { Canvas, Image as SkiaImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet as RNStyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import {
  hideTransitionTile, isViewerMediaShown, measureInWindow, viewerMediaView, watchViewerMedia, type Rect, type TransitionTile,
  type ViewerTransition,
} from '../../lib/viewerTransition';

const SCRIM = 0.32; // MaterialContainerTransform's scrim, #52000000
const TILE_RADIUS = 3; // the tile's borderRadius.element
const DRAG_RADIUS = 24;
const OPEN = { duration: 450, dampingRatio: 1 };
const CLOSE = { duration: 400, dampingRatio: 1 };
const BACK = { duration: 350, dampingRatio: 1 };
const EDGE = 24; // a drag starting this near the left edge goes back sideways
const DRAG_START = 10;
const DISMISS_VELOCITY = 500;
const DISMISS_DISTANCE = 120;
const FLY_FADE_MS = 150;
const OPEN_FADE = 0.2;
const OPEN_SETTLED = 0.9;
const FLY_WAIT_MS = 4000; // the page's media not shown by then (failed): the tile's picture goes anyway

type Geo = { s: number; tx: number; ty: number; cx: number; cy: number; cw: number; ch: number; cr: number; dim: number; a: number };
type Drag = { on: boolean; fx: number; fy: number; dx: number; dy: number; edge: boolean };

// the page with its media (m, where the page has it) lying on the rect t
function onRect(t: Rect, m: Rect): Geo {
  'worklet';
  const s = t.w / m.w;
  return { s, tx: t.x - m.x * s, ty: t.y - m.y * s, cx: t.x, cy: t.y, cw: t.w, ch: t.h, cr: TILE_RADIUS, dim: 0, a: 1 };
}
function full(w: number, h: number): Geo {
  'worklet';
  return { s: 1, tx: 0, ty: 0, cx: 0, cy: 0, cw: w, ch: h, cr: 0, dim: 1, a: 1 };
}
function away(w: number, h: number): Geo {
  'worklet';
  const s = 0.85;
  const x = (w * (1 - s)) / 2;
  const y = (h * (1 - s)) / 2;
  return { s, tx: x, ty: y, cx: x, cy: y, cw: w * s, ch: h * s, cr: DRAG_RADIUS, dim: 0, a: 0 };
}
function mix(a: Geo, b: Geo, p: number): Geo {
  'worklet';
  const m = (x: number, y: number) => x + (y - x) * p;
  return { s: m(a.s, b.s), tx: m(a.tx, b.tx), ty: m(a.ty, b.ty), cx: m(a.cx, b.cx), cy: m(a.cy, b.cy), cw: m(a.cw, b.cw), ch: m(a.ch, b.ch), cr: m(a.cr, b.cr), dim: m(a.dim, b.dim), a: m(a.a, b.a) };
}
// dragged: it follows the finger and shrinks about where the finger went down (to 0.6 at half a screen); upwards it
// only gives a little
function dragged(d: Drag, w: number, h: number): Geo {
  'worklet';
  const prog = d.edge ? Math.min(1, Math.max(0, d.dx) / w) : Math.min(1, Math.max(0, d.dy) / (h / 2));
  const s = 1 - 0.4 * prog;
  const tx = d.fx * (1 - s) + d.dx;
  const ty = d.fy * (1 - s) + (d.dy >= 0 ? d.dy : d.dy / 3);
  return { s, tx, ty, cx: tx, cy: ty, cw: w * s, ch: h * s, cr: DRAG_RADIUS * Math.min(1, prog * 4), dim: 1 - Math.min(1, prog * 1.5), a: 1 };
}

export type ViewerTransitionHandle = {
  // goes back into the tile of this element (or fades), then done()
  close: (elementId: string | null, done: () => void) => void;
};

type Props = {
  transition: ViewerTransition;
  initialElementId: string;
  initialMedia: Rect; // where the page will have the media of the element it opens on (worked out from its layout)
  currentElementId: () => string | null;
  atTop: SharedValue<boolean>; // the page's list is scrolled to its top
  scrollGesture: GestureType; // the list's own scrolling, which waits until a drag back has been ruled out
  onDragging: (on: boolean) => void;
  onDismissed: () => void; // dragged back into its tile: the screen goes
  onOpenSettled: () => void; // nearly open: the page's heavy content may come
  children: ReactNode;
};

export const ViewerTransitionFrame = forwardRef<ViewerTransitionHandle, Props>(function ViewerTransitionFrame(
  { transition, initialElementId, initialMedia, currentElementId, atTop, scrollGesture, onDragging, onDismissed, onOpenSettled, children }, ref,
) {
  const { width: W, height: H } = useWindowDimensions();
  const T = transition.from.rect;
  const live = !transition.backdrop; // the page under it is drawn (Android)
  const p = useSharedValue(0);
  const fromGeo = useSharedValue<Geo>(onRect(T, initialMedia));
  const toGeo = useSharedValue<Geo>(full(W, H));
  const opening = useSharedValue(true); // the flight out of the tile: its start follows the media's place as it is found
  const media = useSharedValue<Rect>(initialMedia);
  const drag = useSharedValue<Drag>({ on: false, fx: 0, fy: 0, dx: 0, dy: 0, edge: false });
  const start = useSharedValue({ x: 0, y: 0 });
  const enabled = useSharedValue(false); // open and not going: it can be dragged
  // the snapshot's tile covered (iOS). Not while it opens: the container holds the tile all the way (the shape goes from
  // the tile to the screen), and hiding it a frame before the container was drawn left a hole
  const hole = useSharedValue<Rect | null>(null);
  const fly = useSharedValue(transition.image ? 1 : 0);
  const pageRef = useRef<View>(null);
  const closing = useRef(false);
  const dragMedia = useRef<Rect | null>(null);
  const cb = useRef({ onDragging, onDismissed, currentElementId, onOpenSettled });
  cb.current = { onDragging, onDismissed, currentElementId, onOpenSettled };
  // the tile it grows from or goes into out of sight
  const hideTile = (tile: TransitionTile | null) => {
    hole.value = tile?.rect ?? null;
    if (live) hideTransitionTile(tile?.key ?? null);
  };
  useEffect(() => () => { if (live) hideTransitionTile(null); }, [live]);

  // where everything is now. Read straight from the shared values here: an animated style or derived value only
  // follows the shared values its own body reads (a helper's reads were missed, and nothing moved)
  const geo = useDerivedValue<Geo>(() => {
    const d = drag.value;
    if (d.on) return dragged(d, W, H);
    return mix(opening.value ? onRect(T, media.value) : fromGeo.value, toGeo.value, p.value);
  });

  // ---------- opening ----------
  const opened = () => { if (!closing.current) enabled.value = true; };
  const settled = useRef(false);
  const openSettled = () => {
    if (settled.current) return;
    settled.current = true;
    cb.current.onOpenSettled();
  };
  useAnimatedReaction(() => opening.value && p.value >= OPEN_SETTLED, (now, was) => { if (now && !was) scheduleOnRN(openSettled); });
  useEffect(() => {
    p.value = withSpring(1, OPEN, (done) => { if (done) scheduleOnRN(opened); });
    // the tile's picture gives way once the page's media has shown its own
    let flyTimer: ReturnType<typeof setTimeout> | undefined;
    const fadeFly = () => { fly.value = withTiming(0, { duration: FLY_FADE_MS }); };
    if (isViewerMediaShown(initialElementId)) fadeFly();
    else flyTimer = setTimeout(fadeFly, FLY_WAIT_MS);
    const stop = watchViewerMedia((id) => {
      if (id !== initialElementId) return;
      if (isViewerMediaShown(id)) { clearTimeout(flyTimer); fadeFly(); }
      // where the page has the media, measured in the page (not moved by the flight)
      const view = viewerMediaView(id);
      if (!view || !pageRef.current || !opening.value) return;
      view.measureLayout(pageRef.current, (x, y, w, h) => { if (w > 0 && h > 0 && opening.value) media.value = { x, y, w, h }; });
    });
    return () => { clearTimeout(flyTimer); stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- going ----------
  // from wherever it is now (opening, dragged, springing back) into the target rect with the media m on it, or away
  const flyTo = (tile: TransitionTile | null, m: Rect, vy: number, done: () => void) => {
    const target = tile?.rect ?? null;
    enabled.value = false;
    hideTile(tile);
    fly.value = 0;
    // there: the tile shows again under it (covered), and the screen goes a frame later, so no frame lacks both
    const land = () => {
      if (live) hideTransitionTile(null);
      requestAnimationFrame(done);
    };
    scheduleOnUI(() => {
      'worklet';
      const from = geo.value;
      const to = target ? onRect(target, m) : away(W, H);
      drag.value = { ...drag.value, on: false };
      opening.value = false;
      fromGeo.value = from;
      toGeo.value = to;
      p.value = 0;
      const dist = to.ty - from.ty;
      const velocity = Math.abs(dist) > 24 ? Math.min(12, Math.max(0, vy / dist)) : 0;
      p.value = withSpring(1, { ...CLOSE, velocity }, (fin) => { if (fin) scheduleOnRN(land); });
    });
  };
  const tileOf = (elementId: string | null) => (elementId ? transition.tiles.find((t) => t.elementId === elementId) ?? null : null);

  useImperativeHandle(ref, () => ({
    close: (elementId, done) => {
      if (closing.current) return;
      closing.current = true;
      // the page is at rest: in the window is where the page has it
      void measureInWindow(elementId ? viewerMediaView(elementId) : null).then((m) => {
        flyTo(tileOf(elementId), m ?? media.value, 0, done);
      });
    },
  }));

  // ---------- dragging back ----------
  const measureForDrag = () => {
    const id = cb.current.currentElementId();
    dragMedia.current = null;
    void measureInWindow(id ? viewerMediaView(id) : null).then((m) => { dragMedia.current = m; });
  };
  const setDragging = (on: boolean) => {
    // the tile it would go back into is out of sight while it is dragged
    if (on) hideTile(tileOf(cb.current.currentElementId()));
    cb.current.onDragging(on);
  };
  const dismiss = (vy: number) => {
    if (closing.current) return;
    closing.current = true;
    const id = cb.current.currentElementId();
    flyTo(tileOf(id), dragMedia.current ?? media.value, vy, () => cb.current.onDismissed());
  };
  const springBack = () => {
    'worklet';
    const from = geo.value;
    drag.value = { ...drag.value, on: false };
    opening.value = false;
    fromGeo.value = from;
    toGeo.value = full(W, H);
    p.value = 0;
    p.value = withSpring(1, BACK);
    scheduleOnRN(setDragging, false);
  };
  // the list scrolls only once this has failed (a drag that is not one back fails within DRAG_START), so a drag down
  // from its top neither bounces nor scrolls it (iOS' require(toFail:))
  const gesture = useMemo(() => Gesture.Pan()
    .blocksExternalGesture(scrollGesture)
    .manualActivation(true)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      start.value = { x: t.absoluteX, y: t.absoluteY };
      if (enabled.value) scheduleOnRN(measureForDrag);
    })
    .onTouchesMove((e, state) => {
      const t = e.allTouches[0];
      if (!t || !enabled.value) { state.fail(); return; }
      const dx = t.absoluteX - start.value.x;
      const dy = t.absoluteY - start.value.y;
      if (start.value.x < EDGE && dx > DRAG_START && dx > Math.abs(dy)) { state.activate(); return; }
      if (atTop.value && dy > DRAG_START && dy > Math.abs(dx) * 1.2) { state.activate(); return; }
      if (Math.abs(dx) > DRAG_START || dy < -DRAG_START || dy > DRAG_START) state.fail();
    })
    .onStart(() => {
      drag.value = { on: true, fx: start.value.x, fy: start.value.y, dx: 0, dy: 0, edge: start.value.x < EDGE };
      scheduleOnRN(setDragging, true);
    })
    .onUpdate((e) => {
      drag.value = { ...drag.value, dx: e.translationX, dy: e.translationY };
    })
    .onEnd((e, success) => {
      const d = drag.value;
      if (!d.on) return;
      const go = success && (d.edge
        ? (e.velocityX > DISMISS_VELOCITY || d.dx > W * 0.3) && e.velocityX > -DISMISS_VELOCITY / 2
        : (e.velocityY > DISMISS_VELOCITY || d.dy > DISMISS_DISTANCE) && e.velocityY > -DISMISS_VELOCITY / 2);
      if (go) scheduleOnRN(dismiss, d.edge ? 0 : e.velocityY);
      else springBack();
    }), []); // eslint-disable-line react-hooks/exhaustive-deps -- shared values and functions that read through cb

  // ---------- drawing ----------
  const scrimStyle = useAnimatedStyle(() => ({ opacity: SCRIM * geo.value.dim }));
  const holeStyle = useAnimatedStyle(() => {
    const r = hole.value;
    return r ? { left: r.x, top: r.y, width: r.w, height: r.h } : { left: 0, top: 0, width: 0, height: 0 };
  });
  const clipStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const fadeIn = opening.value ? Math.min(1, p.value / OPEN_FADE) : 1;
    return { left: g.cx, top: g.cy, width: g.cw, height: g.ch, borderRadius: g.cr, opacity: g.a * fadeIn };
  });
  const pageStyle = useAnimatedStyle(() => {
    const g = geo.value;
    return { transform: [{ translateX: g.tx - g.cx }, { translateY: g.ty - g.cy }, { scale: g.s }] };
  });
  const flyStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const m = media.value;
    return { left: g.tx + m.x * g.s - g.cx, top: g.ty + m.y * g.s - g.cy, width: m.w * g.s, height: m.h * g.s, opacity: fly.value };
  });

  return (
    <View style={[styles.root, !live && styles.opaque]}>
      {transition.backdrop ? (
        <>
          <Canvas style={RNStyleSheet.absoluteFill} pointerEvents="none">
            <SkiaImage image={transition.backdrop} x={0} y={0} width={W} height={H} fit="fill" />
          </Canvas>
          <Animated.View style={[styles.hole, holeStyle]} pointerEvents="none" />
        </>
      ) : null}
      <Animated.View style={[RNStyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents="none" />
      <Animated.View style={[styles.clip, clipStyle]}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.page, { width: W, height: H }, pageStyle]}>
            <View ref={pageRef} style={RNStyleSheet.absoluteFill} collapsable={false}>{children}</View>
          </Animated.View>
        </GestureDetector>
        {transition.image ? (
          <Animated.View style={[styles.fly, flyStyle]} pointerEvents="none">
            <Image source={{ uri: transition.image }} contentFit="cover" transition={0} blurRadius={transition.blurred ? 30 : 0} style={RNStyleSheet.absoluteFill} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  opaque: { backgroundColor: theme.colors.background },
  hole: { position: 'absolute', borderRadius: TILE_RADIUS, backgroundColor: theme.colors.background },
  scrim: { backgroundColor: '#000000' },
  clip: { position: 'absolute', overflow: 'hidden', backgroundColor: theme.colors.background },
  page: { position: 'absolute', left: 0, top: 0, transformOrigin: 'left top' },
  fly: { position: 'absolute', overflow: 'hidden' },
}));
