// The viewer opening out of the tile it was opened from and going back into it (lib/viewerTransition), over the page
// it was opened from: the picture moves, everything else fades where it is (Photos'; the person's choice, HANDOFF
// 6.177 — a container growing out of the tile with the page's background in it read as a grey box over the grid).
// Drawn bottom to top:
//   - the page it was opened from (Android: that page itself, under this transparent modal; iOS: its snapshot), the
//     tile the picture flies out of or into out of sight there (the system zoom hides its source the same way)
//   - a black scrim, Material's 32 %, over all of it alike, which comes first (by SCRIM_IN of the way)
//   - the viewer's page where it will be, coming in after it (from PAGE_FROM of the way): its own background is what
//     everything behind turns into
//   - the picture: opening, the tile's, from the tile's rect and corners to where the page has its media, giving way to
//     the media once that has shown its own and the page is in; going back, the media's own (kept ready, out of sight),
//     from there into the tile of the element on screen, the media out of sight under it
// The page's heavy content is only mounted once it is OPEN_SETTLED of the way (mounting it on the way held the UI
// thread up and the motion jumped).
// Motion is springs without a bounce (the system's for its zoom; interruptible, and taking a drag's speed along):
//   - opening, OPEN; going back (the back button, Android's back) into the tile of the element on screen, CLOSE, the
//     page only popped once it is there; without that element's tile in sight (or a picture) the page only fades
//   - dragged down from the top of the page (or right from the left edge), the picture follows the finger and shrinks
//     about it while the page fades and the scrim lifts; let go fast enough or far enough, it flies into the tile with
//     the finger's speed, else it springs back (Photos, the App Store; WWDC 2018 "Designing Fluid Interfaces")
import { Canvas, Image as SkiaImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet as RNStyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import {
  hiddenTileKey, hiddenViewerMedia, isViewerMediaShown, measureInWindow, viewerMediaView, watchViewerMedia, type Rect,
  type TransitionTile, type ViewerTransition,
} from '../../lib/viewerTransition';

const SCRIM = 0.32; // MaterialContainerTransform's scrim, #52000000
const SCRIM_IN = 0.35; // the scrim is all there this much of the way in, ...
const PAGE_FROM = 0.2; // ... and the page starts coming in here
const PAGE_IN = 0.98; // the page this far in: its media takes over from the picture
const TILE_RADIUS = 3; // the tile's borderRadius.element (the viewer's media has square corners)
const TILE_BLUR = 30; // ElementTile's and ElementViewerMedia's blurRadius for a picture under the veil
const MEDIA_BLUR = 42;
const OPEN = { duration: 450, dampingRatio: 1 };
const CLOSE = { duration: 400, dampingRatio: 1 };
const BACK = { duration: 350, dampingRatio: 1 };
const EDGE = 24; // a drag starting this near the left edge goes back sideways
const DRAG_START = 10;
const DISMISS_VELOCITY = 500;
const DISMISS_DISTANCE = 120;
const FLY_FADE_MS = 150;
const OPEN_SETTLED = 0.9;
const FLY_WAIT_MS = 4000; // the page's media not shown by then (failed): the tile's picture goes anyway

// the picture's rect and corners, and how far the viewer is in (0: the tile alone, 1: open)
type Geo = { x: number; y: number; w: number; h: number; r: number; v: number };
type Drag = { on: boolean; fx: number; fy: number; dx: number; dy: number; edge: boolean };
// w × h: the size of the element's media on the page, which the picture is drawn at and scaled from (moved and scaled
// rather than laid out again every frame: a new size had the picture decoded again, ten times on the way)
// uris: the media's sources in the order it tries them (ElementViewerMedia goes on to the next if one does not load)
export type FlyImage = { uris: string[]; blurred: boolean; w: number; h: number };
type FlySource = { uri: string; placeholder: string | null; blur: number; w: number; h: number };

function at(r: Rect, corner: number, v: number): Geo {
  'worklet';
  return { x: r.x, y: r.y, w: r.w, h: r.h, r: corner, v };
}
function mix(a: Geo, b: Geo, p: number): Geo {
  'worklet';
  const m = (x: number, y: number) => x + (y - x) * p;
  return { x: m(a.x, b.x), y: m(a.y, b.y), w: m(a.w, b.w), h: m(a.h, b.h), r: m(a.r, b.r), v: m(a.v, b.v) };
}
// dragged: the picture (the media at m) follows the finger and shrinks about where the finger went down (to 0.6 at half
// a screen), the viewer going out with it; upwards it only gives a little
function dragged(d: Drag, m: Rect, w: number, h: number): Geo {
  'worklet';
  const prog = d.edge ? Math.min(1, Math.max(0, d.dx) / w) : Math.min(1, Math.max(0, d.dy) / (h / 2));
  const s = 1 - 0.4 * prog;
  const dy = d.dy >= 0 ? d.dy : d.dy / 3;
  return {
    x: d.fx + (m.x - d.fx) * s + d.dx, y: d.fy + (m.y - d.fy) * s + dy, w: m.w * s, h: m.h * s,
    r: TILE_RADIUS * Math.min(1, prog * 4), v: 1 - Math.min(1, prog * 1.5),
  };
}

export type ViewerTransitionHandle = {
  // goes back into the tile of this element (or fades), then done()
  close: (elementId: string | null, done: () => void) => void;
};

type Props = {
  transition: ViewerTransition;
  initialElementId: string;
  initialMedia: Rect; // where the page will have the media of the element it opens on (worked out from its layout)
  currentId: string | null; // the element on screen, as rendered: its picture is kept ready to fly back
  currentElementId: () => string | null; // ...as it is now
  flyImage: (elementId: string) => FlyImage | null; // the picture the page's media shows of this element
  atTop: SharedValue<boolean>; // the page's list is scrolled to its top
  scrollGesture: GestureType; // the list's own scrolling, which waits until a drag back has been ruled out
  onDragging: (on: boolean) => void;
  onDismissed: () => void; // dragged back into its tile: the screen goes
  onOpenSettled: () => void; // nearly open: the page's heavy content may come
  children: ReactNode;
};

export const ViewerTransitionFrame = forwardRef<ViewerTransitionHandle, Props>(function ViewerTransitionFrame(
  {
    transition, initialElementId, initialMedia, currentId, currentElementId, flyImage, atTop, scrollGesture, onDragging,
    onDismissed, onOpenSettled, children,
  }, ref,
) {
  const { width: W, height: H } = useWindowDimensions();
  const T = transition.from.rect;
  const live = !transition.backdrop; // the page under it is drawn (Android)
  const p = useSharedValue(0);
  const fromGeo = useSharedValue<Geo>(at(T, TILE_RADIUS, 0));
  const toGeo = useSharedValue<Geo>(at(initialMedia, 0, 1));
  const opening = useSharedValue(true); // out of the tile: where it goes follows the media's place as it is found
  const media = useSharedValue<Rect>(initialMedia);
  const mediaShown = useSharedValue(isViewerMediaShown(initialElementId));
  const drag = useSharedValue<Drag>({ on: false, fx: 0, fy: 0, dx: 0, dy: 0, edge: false });
  const dragMedia = useSharedValue<Rect>(initialMedia); // where the media on screen is, as a drag starts
  const dragMediaId = useSharedValue('');
  const start = useSharedValue({ x: 0, y: 0 });
  const enabled = useSharedValue(false); // open and not going: it can be dragged
  // the snapshot's tile covered (iOS), while the picture flies out of it or into it
  const hole = useSharedValue<Rect | null>(null);
  const fly = useSharedValue(transition.from.image ? 1 : 0); // the picture in sight
  const flyReady = useSharedValue(false); // ...and it has shown what it has now
  const pageRef = useRef<View>(null);
  const closing = useRef(false);
  const openHid = useRef(false);
  const cb = useRef({ onDragging, onDismissed, currentElementId, onOpenSettled });
  cb.current = { onDragging, onDismissed, currentElementId, onOpenSettled };

  // the tile of this element on the page under it: the one it opened from, else one in sight there
  const tileOf = (elementId: string | null) => {
    if (!elementId) return null;
    if (transition.from.elementId === elementId) return transition.from;
    return transition.tiles.find((t) => t.elementId === elementId) ?? null;
  };
  // the tile the picture flies out of or into, out of sight
  const hideTile = (tile: TransitionTile | null) => {
    hole.value = tile?.rect ?? null;
    if (live) hiddenTileKey.value = tile?.key ?? -1;
  };
  useEffect(() => () => {
    if (live) hiddenTileKey.value = -1;
    hiddenViewerMedia.value = '';
  }, [live]);

  // the picture flown: opening, the tile's; once that has given way, the one the media shows of the element on screen
  // (over the tile's while it loads), out of sight until it flies back
  const [mediaPicture, setMediaPicture] = useState(false);
  const currentTile = tileOf(currentId);
  const [failed, setFailed] = useState<{ id: string | null; n: number }>({ id: null, n: 0 }); // sources that did not load
  const tried = failed.id === currentId ? failed.n : 0;
  const flySource = useMemo((): FlySource | null => {
    if (!mediaPicture && currentId === initialElementId) {
      const { image, blurred } = transition.from;
      return image ? { uri: image, placeholder: null, blur: blurred ? TILE_BLUR : 0, w: initialMedia.w, h: initialMedia.h } : null;
    }
    const picture = currentId && currentTile ? flyImage(currentId) : null;
    const uri = picture?.uris[Math.min(tried, picture.uris.length - 1)];
    return picture && uri ? { uri, placeholder: currentTile!.image, blur: picture.blurred ? MEDIA_BLUR : 0, w: picture.w, h: picture.h } : null;
  }, [mediaPicture, currentId, currentTile, tried, initialElementId, initialMedia, transition.from, flyImage]);
  const onFlyError = () => { if (mediaPicture || currentId !== initialElementId) setFailed({ id: currentId, n: tried + 1 }); };
  const flyUri = flySource?.uri ?? null;
  const flyBase = useSharedValue({ w: initialMedia.w, h: initialMedia.h });
  useLayoutEffect(() => { flyReady.value = false; }, [flyUri]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (flySource) flyBase.value = { w: flySource.w, h: flySource.h }; }, [flySource?.w, flySource?.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const onFlyDisplay = () => {
    flyReady.value = true;
    // opening: the tile goes once its picture is drawn over it (hidden before, it left a hole)
    if (!openHid.current && !closing.current && !mediaPicture) {
      openHid.current = true;
      hideTile(transition.from);
    }
  };

  // where the picture is and how far in the viewer is. Read straight from the shared values here: an animated style or
  // derived value only follows the shared values its own body reads (a helper's reads were missed, and nothing moved)
  const geo = useDerivedValue<Geo>(() => {
    const d = drag.value;
    if (d.on) return dragged(d, dragMedia.value, W, H);
    if (opening.value) return mix(at(T, TILE_RADIUS, 0), at(media.value, 0, 1), p.value);
    return mix(fromGeo.value, toGeo.value, p.value);
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
  // the tile's picture gives way once the page's media has shown its own and the page is in
  useAnimatedReaction(() => opening.value && mediaShown.value && geo.value.v >= PAGE_IN, (now, was) => {
    if (now && !was) fly.value = withTiming(0, { duration: FLY_FADE_MS }, (fin) => { if (fin) scheduleOnRN(setMediaPicture, true); });
  });
  useEffect(() => {
    p.value = withSpring(1, OPEN, (done) => { if (done) scheduleOnRN(opened); });
    const flyTimer = setTimeout(() => { mediaShown.value = true; }, FLY_WAIT_MS);
    const stop = watchViewerMedia((id) => {
      if (id !== initialElementId) return;
      if (isViewerMediaShown(id)) { clearTimeout(flyTimer); mediaShown.value = true; }
      // where the page has the media (the page stays where it is, so this is where it is in the window too)
      const view = viewerMediaView(id);
      if (!view || !pageRef.current || !opening.value) return;
      view.measureLayout(pageRef.current, (x, y, w, h) => { if (w > 0 && h > 0 && opening.value) media.value = { x, y, w, h }; });
    });
    return () => { clearTimeout(flyTimer); stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- going ----------
  // from wherever the picture is now (opening, dragged, springing back, or at rest over the media m of the element
  // elementId) into the tile with the page going out, or with the page only fading
  const flyTo = (tile: TransitionTile | null, elementId: string | null, m: Rect, vy: number, done: () => void) => {
    enabled.value = false;
    const target = tile?.rect ?? null;
    const key = tile?.key ?? -1;
    // there: the tile shows again under the picture, and the screen goes a frame later, so no frame lacks both
    const land = () => requestAnimationFrame(done);
    scheduleOnUI(() => {
      'worklet';
      const g = geo.value;
      const from = p.value === 1 && !drag.value.on ? at(m, 0, 1) : g;
      const flies = target !== null && flyReady.value; // its picture is drawn, ready over the media
      fly.value = flies ? 1 : 0;
      hiddenViewerMedia.value = flies ? elementId ?? '' : '';
      hole.value = flies ? target : null;
      if (live) hiddenTileKey.value = flies ? key : -1;
      const to = flies && target ? at(target, TILE_RADIUS, 0) : { ...from, v: 0 };
      drag.value = { ...drag.value, on: false };
      opening.value = false;
      fromGeo.value = from;
      toGeo.value = to;
      p.value = 0;
      const dist = to.y - from.y;
      const velocity = Math.abs(dist) > 24 ? Math.min(12, Math.max(0, vy / dist)) : 0;
      p.value = withSpring(1, { ...CLOSE, velocity }, (fin) => {
        if (!fin) return;
        if (live) hiddenTileKey.value = -1;
        scheduleOnRN(land);
      });
    });
  };

  useImperativeHandle(ref, () => ({
    close: (elementId, done) => {
      if (closing.current) return;
      closing.current = true;
      // the page is at rest: in the window is where the page has it
      void measureInWindow(elementId ? viewerMediaView(elementId) : null).then((m) => {
        flyTo(tileOf(elementId), elementId, m ?? media.value, 0, done);
      });
    },
  }));

  // ---------- dragging back ----------
  const measureForDrag = () => {
    const id = cb.current.currentElementId();
    dragMediaId.value = id ?? '';
    void measureInWindow(id ? viewerMediaView(id) : null).then((m) => { if (m) dragMedia.value = m; });
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
    flyTo(tileOf(id), id, dragMedia.value, vy, () => cb.current.onDismissed());
  };
  const springBack = () => {
    'worklet';
    const from = geo.value;
    drag.value = { ...drag.value, on: false };
    opening.value = false;
    fromGeo.value = from;
    toGeo.value = at(dragMedia.value, 0, 1);
    p.value = 0;
    // back over the media: the media shows again and the picture goes on the same frame
    p.value = withSpring(1, BACK, (fin) => {
      if (!fin) return;
      fly.value = 0;
      hiddenViewerMedia.value = '';
    });
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
      // the picture takes over from the media where it is (without one drawn, the page only fades)
      if (flyReady.value) {
        fly.value = 1;
        hiddenViewerMedia.value = dragMediaId.value;
      }
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
  const scrimStyle = useAnimatedStyle(() => ({ opacity: SCRIM * Math.min(1, geo.value.v / SCRIM_IN) }));
  const pageStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (geo.value.v - PAGE_FROM) / (1 - PAGE_FROM))) }));
  const holeStyle = useAnimatedStyle(() => {
    const r = hole.value;
    return r ? { left: r.x, top: r.y, width: r.w, height: r.h } : { left: 0, top: 0, width: 0, height: 0 };
  });
  const flyStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const b = flyBase.value;
    const sx = g.w / b.w;
    const sy = g.h / b.h;
    return {
      opacity: fly.value, borderRadius: g.r / Math.max(0.05, sx),
      transform: [{ translateX: g.x }, { translateY: g.y }, { scaleX: sx }, { scaleY: sy }],
    };
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
      <GestureDetector gesture={gesture}>
        {/* faded as one (Android otherwise fades each view on its own: the header's background over the page's) */}
        <Animated.View style={[RNStyleSheet.absoluteFill, pageStyle]} needsOffscreenAlphaCompositing>
          <View ref={pageRef} style={RNStyleSheet.absoluteFill} collapsable={false}>{children}</View>
        </Animated.View>
      </GestureDetector>
      {flySource ? (
        <Animated.View style={[styles.fly, { width: flySource.w, height: flySource.h }, flyStyle]} pointerEvents="none">
          <Image
            source={{ uri: flySource.uri }}
            placeholder={flySource.placeholder ? { uri: flySource.placeholder } : undefined}
            placeholderContentFit="cover"
            contentFit="cover"
            transition={0}
            blurRadius={flySource.blur}
            style={RNStyleSheet.absoluteFill}
            onDisplay={onFlyDisplay}
            onError={onFlyError}
          />
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1 },
  opaque: { backgroundColor: theme.colors.background },
  hole: { position: 'absolute', borderRadius: TILE_RADIUS, backgroundColor: theme.colors.background },
  scrim: { backgroundColor: '#000000' },
  fly: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', transformOrigin: 'left top' },
}));
