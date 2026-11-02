// Cosmos' InfiniteCanvas + InfiniteCanvasScene (components/elements/, read off the Hermes bundle; the gesture and frame
// code is the worklet source the bundle keeps, ported to the web page's board.js first, HANDOFF 6.33–6.36 / 6.130):
//   - drawn with Skia: the camera is one transform over the world; each atlas texture is one Atlas (sprites in the
//     cards' places, sampled linearly without mipmaps), a card whose picture is not in yet is its colour as a rounded
//     rect (PlaceholderRect, borderRadius.element); no border, nothing under the pictures
//   - the world (lib/canvas/layout.ts) is worked out again only when the camera crosses into another CULLING_BUCKET_SIZE
//     / CULLING_SCALE_BUCKET_SIZE bucket or comes to rest (useCanvasCulling's cullingRevision); the pictures
//     (lib/canvas/atlas.ts) follow what is in view
//   - drag pans; letting go glides at PAN_VELOCITY_FACTOR × the drag's velocity, slowing by PAN_DECAY_RATE a second
//     (canvasPanGestureTs2, useCanvasCameraFrame). A pinch zooms about where it started between MIN_SCALE and
//     MAX_SCALE and keeps going a little after release (createCanvasPinchGesture, canvasPinchFinalize); one that starts
//     at OPEN_VIEWER_ARM_SCALE or closer can go on to OPEN_VIEWER_SCALE while everything but the card under the fingers
//     fades towards OPEN_VIEWER_BACKGROUND_MIN_OPACITY, and letting go past OPEN_VIEWER_TRIGGER_SCALE opens that card,
//     else the camera returns (ZOOM_OPEN_RETURN_MS)
//   - a tap (not one that only stopped a glide: TAP_SUPPRESSION_*) on a card that is not the seed centres it (zooming
//     to 1, or 2 when already at 1 or more, TIMING_MS out-cubic) and makes it the seed (handleTapRequest →
//     onFocusElement); while that seed loads, every card but the tapped one is a placeholder and taps on others do
//     nothing (focus lock, isRefiningSimilar). A tap on the seed zooms to MAX_SCALE, and once there opens it
//   - holding still LONG_PRESS_MS is a long press (onLongPressElement); a pressed card gives a little (useCanvasPressFocus)
//   - from OPEN_PILL_SCALE (gone again under OPEN_PILL_HIDE_SCALE) the loaded cards nearest the middle carry 打开
//     (CanvasOpenPillOverlay)
//   - a new canvas comes in out of a blur once its nearest pictures are in (useInitialCanvasReveal)
//   - pages: a dataset that is not a similar canvas loads until WARM_RENDER_PAGE_COUNT pages are there and whenever the
//     outermost copy in view shows the last page; any loads the next once the middle of the screen has moved
//     PAGINATION_DISTANCE × scale from where the last was asked for (useInfiniteCanvasPagination)
// Kept as the person chose on the web page (HANDOFF 6.130): a note is its text (NoteElement) in its slot, over the
// canvas, not a coloured placeholder; every video on screen loops its strip of first frames over its cover, moving or
// not, without a decoder (StripCard, HANDOFF 6.165; Cosmos only draws the cover), and the ones nearest the middle also
// get a real player, muted and looping,
// as the web page's board-clip: nothing starts or lets go while the camera moves, and what plays pauses as the web
// page's does, out of sight so that its strip under it keeps moving (the person wants them moving; decoding them through
// a pan made it stutter, HANDOFF 6.170); at rest the ones nearest the middle play within VIDEO_PLAY_BUDGET
// (app.js syncPlayback).
import {
  Atlas, Blur, Canvas, FilterMode, Group, MipmapMode, Paint, RoundedRect, Skia, type SkImage, type SkRect, type SkRSXform,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue,
  withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';
import type { Element } from '../../lib/elements';
import { CanvasAtlas, type AtlasRequestItem } from '../../lib/canvas/atlas';
import { CANVAS as C } from '../../lib/canvas/constants';
import {
  atlasKey, buildLayout, canvasImageUrls, canvasVideoUrls, createInstance, homeCamera, visibleInstances,
  type Camera, type CanvasDataset, type CanvasInstance, type CanvasLayout, type SlotCache,
} from '../../lib/canvas/layout';
import { StripCache } from '../../lib/canvas/strips';
import { absoluteUrl } from '../../lib/server';
import { NoteElement } from '../elements/NoteElement';
import { PreviewVideo, SHOW_MS } from '../elements/PreviewVideo';

export type FocusRequest = { id: number; elementId: string; sourceIndex: number };
type Props = {
  dataset: CanvasDataset | null;
  seedId: string | null; // currentSeedElementId
  refining: boolean; // isRefiningSimilar
  focusRequest: FocusRequest | null; // externalFocusRequest
  hasMore: boolean;
  loadingMore: boolean;
  initialCamera?: Camera | null;
  onLoadMore: () => void;
  onFocusElement: (p: { element: Element; elementIndex: number; sourceIndex: number }) => void;
  onOpenElement: (element: Element) => void;
  onLongPressElement: (element: Element) => void;
  onCamera?: (camera: Camera) => void; // cacheCamera
  active?: boolean; // the screen is in front: nothing plays or loops under a viewer
};

const TIMING = { duration: C.TIMING_MS, easing: Easing.out(Easing.cubic) };
const ZOOM_RETURN = { duration: C.ZOOM_OPEN_RETURN_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const REVEAL = { duration: C.REVEAL_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) };
const PRESS_SPRING = { damping: 35, mass: 0.8, stiffness: 650 };
// InfiniteCanvasScene's Atlas sampling
const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };
// A refocus' steps last at least this long here (the computer answers at once; in Cosmos they last as long as its loads
// do): the empty cards until the camera has centred the card (TIMING_MS), the colours before the first pictures, and a
// batch of pictures to the next
const COLOUR_MIN_MS = 160;
const CLIP_FADE_IN_MS = SHOW_MS; // none: a video view fading in from 0 flashed black (PreviewVideo)
const CLIP_FADE_OUT_MS = 120;
const STAGE_MS = 80;

type Pinch = {
  startScale: number; startX: number; startY: number; fx: number; fy: number; start: number; armed: boolean;
  thresholdReached: boolean; lastScale: number; lastX: number; lastY: number; lastV: number; lastGestureScale: number; lastSample: number;
};

const hasPicture = (el: Element) => canvasImageUrls(el).length > 0;
const isNoteCard = (el: Element) => !hasPicture(el);

export function InfiniteCanvas(props: Props) {
  const active = props.active ?? true;
  const { dataset, seedId, refining, focusRequest, hasMore, loadingMore, initialCamera } = props;
  const { theme } = useUnistyles();
  const cb = useRef(props);
  cb.current = props;

  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  // ---------- camera (UI thread) ----------
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const camS = useSharedValue<number>(C.INITIAL_SCALE);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const zv = useSharedValue(0);
  const zfx = useSharedValue(0);
  const zfy = useSharedValue(0);
  const panning = useSharedValue(false);
  const pinching = useSharedValue(false);
  const panBlocked = useSharedValue(false);
  const animating = useSharedValue(0);
  const suppressed = useSharedValue(false);
  const busy = useSharedValue(false);
  const revision = useSharedValue(0);
  const zoomOpen = useSharedValue(0);
  const pinch = useSharedValue<Pinch | null>(null);
  const panStart = useSharedValue({ x: 0, y: 0 });
  const reveal = useSharedValue(1);
  const pressScale = useSharedValue(1);
  const pillVisible = useSharedValue(false);

  const readCamera = useCallback((): Camera => ({ x: camX.get(), y: camY.get(), s: camS.get() }), [camX, camY, camS]);

  const stopMotion = () => {
    'worklet';
    cancelAnimation(camX);
    cancelAnimation(camY);
    cancelAnimation(camS);
    animating.set(0);
    vx.set(0);
    vy.set(0);
    zv.set(0);
  };

  const animateTo = useCallback((to: Camera, config: typeof TIMING, fade = false) => {
    animating.set(1);
    vx.set(0);
    vy.set(0);
    zv.set(0);
    camX.set(withTiming(to.x, config));
    camY.set(withTiming(to.y, config));
    camS.set(withTiming(to.s, config, (done) => { if (done) animating.set(0); }));
    if (fade) zoomOpen.set(withTiming(0, config));
  }, [animating, camX, camY, camS, vx, vy, zv, zoomOpen]);

  // focusWorldPoint: a world point to the middle of the screen; without a scale, to 1 (below 1) or 2, never past MAX_SCALE
  const focusWorldPoint = useCallback((x: number, y: number, scale: number | null = null) => {
    const sz = sizeRef.current;
    if (!sz) return;
    const s = Math.min(scale ?? (camS.get() < 1 ? 1 : 2), C.MAX_SCALE);
    animateTo({ x: sz.W / 2 - x * s, y: sz.H / 2 - y * s, s }, TIMING);
  }, [animateTo, camS]);

  // useCanvasCameraFrame: the glide and the zoom's carry-on; a camera that comes to rest works the cards out again
  useFrameCallback((info) => {
    const dt = Math.min(info.timeSincePreviousFrame ?? 16.67, 64) / 1000;
    let moving = false;
    if (!panning.get() && (vx.get() !== 0 || vy.get() !== 0)) {
      if (Math.abs(vx.get()) < C.PAN_STOP_VELOCITY && Math.abs(vy.get()) < C.PAN_STOP_VELOCITY) {
        vx.set(0);
        vy.set(0);
      } else {
        const decay = Math.pow(C.PAN_DECAY_RATE, dt);
        const nx = Math.abs(vx.get()) < C.PAN_STOP_VELOCITY ? 0 : vx.get() * decay;
        const ny = Math.abs(vy.get()) < C.PAN_STOP_VELOCITY ? 0 : vy.get() * decay;
        vx.set(nx);
        vy.set(ny);
        camX.set(camX.get() + nx * dt);
        camY.set(camY.get() + ny * dt);
        moving = true;
      }
    }
    if (zv.get() !== 0) {
      if (Math.abs(zv.get()) < C.ZOOM_STOP_VELOCITY) zv.set(0);
      else {
        const s0 = camS.get();
        const wx = (zfx.get() - camX.get()) / s0;
        const wy = (zfy.get() - camY.get()) / s0;
        const nextV = zv.get() * Math.pow(C.ZOOM_DECAY_RATE, dt);
        const s = Math.min(C.MAX_SCALE, Math.max(C.MIN_SCALE, s0 * (1 + nextV * dt)));
        const atLimit = (s <= C.MIN_SCALE && nextV < 0) || (s >= C.MAX_SCALE && nextV > 0);
        zv.set(atLimit ? 0 : nextV);
        camS.set(s);
        camX.set(zfx.get() - wx * s);
        camY.set(zfy.get() - wy * s);
        moving = true;
      }
    }
    const now = moving || panning.get() || pinching.get() || animating.get() === 1;
    if (busy.get() && !now) revision.set(revision.get() + 1);
    busy.set(now);
  });

  // ---------- the world (JS) ----------
  const layoutRef = useRef<CanvasLayout | null>(null);
  const datasetRef = useRef<CanvasDataset | null>(null);
  const cacheRef = useRef<SlotCache>(new Map());
  const [instances, setInstances] = useState<CanvasInstance[]>([]);
  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  const [lockKey, setLockKey] = useState<string | null>(null); // the instance kept through a refocus
  const lockAtlasKey = useRef<string | null>(null);
  // A refocus as Cosmos draws it (InfiniteCanvas → useInfiniteCanvasRenderState → buildCanvasRenderState): while the
  // dataset the lock was taken on is still the one laid out (replaceSurroundingWithPlaceholders), everything but the
  // locked card is an empty card (createPlaceholderTile with placeholderColor, emptyCardBackground); once the similar
  // dataset is laid out, each card is its own colour (renderPlaceholderColor) until its picture is in, nearest the
  // middle first, PRIORITY_IMAGE_ATLAS_PAGE_ITEM_LIMIT at a time; no fade (fadeAtlasPages false). Pictures already loaded
  // here (most of a similar set was on the canvas before) still come in by those batches, one STAGE_MS apart, so the
  // grey → colour → picture steps show (HANDOFF 6.172)
  const lockDataset = useRef<string | null>(null); // the dataset the lock was taken on
  const shownDataset = useRef<string | null>(null); // the dataset of the cards culled last
  const rank = useRef(new Map<string, number>()); // the cards in view, nearest the middle first
  const [staged, setStaged] = useState<number | null>(null); // after a refocus: how many of them have their pictures
  const stageTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(stageTimer.current), []);
  const startStaging = useCallback(() => {
    clearInterval(stageTimer.current);
    clearTimeout(colourTimer.current);
    let n = 0;
    setStaged(0);
    const next = () => {
      n += C.PRIORITY_IMAGE_ATLAS_PAGE_ITEM_LIMIT;
      if (n < rank.current.size) { setStaged(n); return; }
      clearInterval(stageTimer.current);
      setStaged(null);
    };
    colourTimer.current = setTimeout(() => {
      next();
      stageTimer.current = setInterval(next, STAGE_MS);
    }, COLOUR_MIN_MS);
  }, []);
  const colourTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(colourTimer.current), []);
  const grayUntil = useRef(0); // a similar dataset arriving sooner is laid out then
  const [grayTick, setGrayTick] = useState(0);
  // the dataset laid out is still the one a refocus started on: the cards around it are empty
  const surroundHeld = () => lockKeyRef.current != null && datasetRef.current?.key === lockDataset.current;
  const releaseLock = () => {
    setLockKey(null);
    lockKeyRef.current = null;
    lockAtlasKey.current = null;
    lockDataset.current = null;
  };
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [zoomKey, setZoomKey] = useState<string | null>(null);
  const [pills, setPills] = useState<CanvasInstance[]>([]);
  const [clips, setClips] = useState<CanvasInstance[]>([]); // the videos that may play
  const [stripInsts, setStripInsts] = useState<CanvasInstance[]>([]); // the videos looping their strips
  const [stripVersion, setStripVersion] = useState(0);
  const strips = useMemo(() => new StripCache(C.STRIP_CACHE, () => setStripVersion((v) => v + 1)), []);
  useEffect(() => () => strips.dispose(), [strips]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const stripClock = useSharedValue(0);
  const stripFrames = useFrameCallback((info) => {
    const f = Math.floor((info.timeSinceFirstFrame * C.STRIP_FPS) / 1000);
    if (f !== stripClock.get()) stripClock.set(f);
  }, active);
  useEffect(() => { stripFrames.setActive(active); }, [active, stripFrames]);
  useEffect(() => { cull(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const clipsRef = useRef(clips);
  const clipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clipPending = useRef(''); // the keys of the ones waiting to start
  const showClips = useCallback((next: CanvasInstance[]) => { clipsRef.current = next; setClips(next); }, []);
  useEffect(() => () => clearTimeout(clipTimer.current), []);
  useEffect(() => {
    const sub = AppState.addEventListener('memoryWarning', () => {
      strips.trim();
      clearTimeout(clipTimer.current);
      clipPending.current = '';
      showClips([]); // the strips stay on screen; the players come back when the camera next rests
    });
    return () => sub.remove();
  }, [strips, showClips]);
  const [revealed, setRevealed] = useState(true);
  const revealWaiting = useRef(false);
  const [atlasVersion, setAtlasVersion] = useState(0);
  const paginationRef = useRef<{ key: string; x: number; y: number } | null>(null);
  const atlas = useMemo(() => new CanvasAtlas(() => setAtlasVersion((v) => v + 1)), []);
  useEffect(() => () => atlas.dispose(), [atlas]);
  atlas.radius = layoutRef.current ? theme.borderRadius.element * C.ATLAS_SPRITE_WIDTH / layoutRef.current.cardWidth : 0;

  const hit = useCallback((fx: number, fy: number) => {
    const cam = readCamera();
    const wx = (fx - cam.x) / cam.s;
    const wy = (fy - cam.y) / cam.s;
    const list = instancesRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (wx >= it.x && wx <= it.x + it.item.width && wy >= it.y && wy <= it.y + it.item.height) return it;
    }
    return null;
  }, [readCamera]);

  // the cards near the screen, the pictures they need, the 打开 pills, and whether to load more
  const cull = useCallback(() => {
    const L = layoutRef.current;
    const d = datasetRef.current;
    const sz = sizeRef.current;
    if (!L || !d || !sz) { setInstances([]); return; }
    const cam = readCamera();
    const list = visibleInstances(L, d, cacheRef.current, cam, sz.W, sz.H);
    setInstances(list);
    instancesRef.current = list;
    shownDataset.current = d.key;
    cb.current.onCamera?.(cam);
    // pictures: in view (no padding), the locked / zooming card first, then by distance from the middle
    const x0 = -cam.x / cam.s;
    const x1 = (sz.W - cam.x) / cam.s;
    const y0 = -cam.y / cam.s;
    const y1 = (sz.H - cam.y) / cam.s;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const dist = (i: CanvasInstance) => (i.x + i.item.width / 2 - cx) ** 2 + (i.y + i.item.height / 2 - cy) ** 2;
    const inView = list.filter((i) => i.x + i.item.width >= x0 && i.x <= x1 && i.y + i.item.height >= y0 && i.y <= y1).sort((a, b) => dist(a) - dist(b));
    rank.current = new Map(inView.map((i, n) => [i.key, n]));
    const focus = lockKeyRef.current ?? zoomKeyRef.current;
    const focused = focus ? list.find((i) => i.key === focus) : null;
    const seen = new Set<string>();
    const items: AtlasRequestItem[] = [];
    for (const inst of focused ? [focused, ...inView] : inView) {
      const urls = canvasImageUrls(inst.element);
      if (!urls.length) continue;
      const key = atlasKey(inst.element.id, inst.item.atlasHeight);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ key, urls, ratio: C.ATLAS_SPRITE_WIDTH / inst.item.atlasHeight });
      if (items.length >= C.PRIORITY_ATLAS_ITEM_COUNT) break;
    }
    atlas.ask(items, L.signature, lockAtlasKey.current);
    // CanvasOpenPillOverlay's items (getCanvasOpenPillItems): the loaded cards nearest the middle
    if (!surroundHeld() && cam.s >= C.OPEN_PILL_MOUNT_SCALE) {
      const near = list.filter((i) => !hasPicture(i.element) || atlas.loaded.has(atlasKey(i.element.id, i.item.atlasHeight)))
        .map((i) => ({ i, d: Math.hypot(i.x + i.item.width / 2 - (sz.W / 2 - cam.x) / cam.s, i.y + i.item.height / 2 - (sz.H / 2 - cam.y) / cam.s) }))
        .sort((a, b) => a.d - b.d).slice(0, C.OPEN_PILL_RENDER_LIMIT).map((p) => p.i);
      setPills(near);
    } else setPills([]);
    // the strips: every video in view, the nearest the middle first
    const looping = activeRef.current
      ? inView.filter((i) => i.element.videoStrip && hasPicture(i.element) && !(surroundHeld() && i.key !== lockKeyRef.current)).slice(0, C.STRIP_MAX)
      : [];
    strips.ask(looping.map((i) => i.element.videoStrip!.url));
    setStripInsts((was) => (was.length === looping.length && was.every((w, n) => w.key === looping[n].key) ? was : looping));
    // the videos that play (the web page's syncPlayback): none start while the camera moves; at rest the ones nearest
    // the middle with VIDEO_VISIBLE_FRACTION of them in view, up to each lane's budget, not the placeholders of a refocus.
    // The ones that stop go at once, the new ones come VIDEO_SETTLE_MS later, once the others have let go of their decoders
    if (!activeRef.current) {
      clearTimeout(clipTimer.current);
      clipPending.current = '';
      showClips([]); // covered by a viewer: its decoders are for the viewer
    } else if (busy.get()) {
      clearTimeout(clipTimer.current);
      clipPending.current = '';
      showClips(clipsRef.current.map((c) => list.find((i) => i.key === c.key)).filter((i): i is CanvasInstance => !!i));
    } else {
      const shown = (i: CanvasInstance) =>
        (Math.max(0, Math.min(i.x + i.item.width, x1) - Math.max(i.x, x0)) * Math.max(0, Math.min(i.y + i.item.height, y1) - Math.max(i.y, y0)))
        / (i.item.width * i.item.height);
      const lanes = { preview: [] as CanvasInstance[], original: [] as CanvasInstance[] };
      for (const inst of inView) {
        if (surroundHeld() && inst.key !== lockKeyRef.current) continue;
        // one without a cover is not played (the web page's bare card)
        if (!hasPicture(inst.element) || !canvasVideoUrls(inst.element).length || shown(inst) < C.VIDEO_VISIBLE_FRACTION) continue;
        const lane = inst.element.previewUrl ? 'preview' : 'original';
        if (lanes[lane].length < C.VIDEO_PLAY_BUDGET[lane]) lanes[lane].push(inst);
      }
      const next = [...lanes.preview, ...lanes.original];
      const kept = next.filter((n) => clipsRef.current.some((c) => c.key === n.key));
      const keys = next.map((i) => i.key).join();
      if (kept.length === next.length) {
        clearTimeout(clipTimer.current);
        clipPending.current = '';
        showClips(next);
      } else if (keys !== clipPending.current) { // the same ones already waiting keep their time
        clearTimeout(clipTimer.current);
        clipPending.current = keys;
        showClips(kept);
        const feed = () => {
          const have = clipsRef.current;
          const more = next.filter((n) => !have.some((c) => c.key === n.key)).slice(0, C.VIDEO_START_BATCH);
          if (!more.length) { clipPending.current = ''; return; }
          showClips([...have, ...more]);
          clipTimer.current = setTimeout(feed, C.VIDEO_START_GAP_MS);
        };
        clipTimer.current = setTimeout(feed, C.VIDEO_SETTLE_MS);
      }
    }
    // useInfiniteCanvasPagination
    const p = cb.current;
    if (!p.hasMore || p.loadingMore || L.renderElements.length >= C.MAX_RENDER_ELEMENTS) return;
    const center = { key: d.key, x: (sz.W / 2 - cam.x) / cam.s, y: (sz.H / 2 - cam.y) / cam.s };
    const pages = Math.max(Math.ceil(L.renderElements.length / Math.max(L.layoutElementCount, 1)), 1);
    const last = paginationRef.current;
    if (!last || last.key !== d.key) {
      paginationRef.current = center;
      if (d.prefetch && pages < C.WARM_RENDER_PAGE_COUNT) p.onLoadMore();
      return;
    }
    if (d.prefetch) {
      if (pages < C.WARM_RENDER_PAGE_COUNT) { p.onLoadMore(); return; }
      const outer = Math.max(0, ...list.map((i) => i.ordinal));
      const outerPage = pages > 1 && outer ? 1 + (Math.floor((outer - 1) / 4) % (pages - 1)) : 0;
      if (outerPage === pages - 1) { paginationRef.current = center; p.onLoadMore(); return; }
    }
    if (Math.hypot(center.x - last.x, center.y - last.y) >= C.PAGINATION_DISTANCE * Math.max(cam.s, 0.01)) {
      paginationRef.current = center;
      p.onLoadMore();
    }
  }, [atlas, readCamera]);

  const lockKeyRef = useRef(lockKey);
  lockKeyRef.current = lockKey;
  const zoomKeyRef = useRef(zoomKey);
  zoomKeyRef.current = zoomKey;
  const refiningRef = useRef(refining);
  refiningRef.current = refining;

  useAnimatedReaction(
    () => `${Math.round(camX.get() / C.CULLING_BUCKET_SIZE)}:${Math.round(camY.get() / C.CULLING_BUCKET_SIZE)}:${Math.round(camS.get() / C.CULLING_SCALE_BUCKET_SIZE)}:${revision.get()}`,
    (key, prev) => { if (key !== prev) scheduleOnRN(cull); },
  );
  // what plays is paused while the camera moves (and out of sight at once, ClipCard)
  const [moving, setMoving] = useState(false);
  useAnimatedReaction(() => busy.get(), (now, prev) => { if (now !== prev) scheduleOnRN(setMoving, now); });

  // the reveal starts once the nearest pictures are in
  const maybeReveal = useCallback(() => {
    if (!revealWaiting.current || !atlas.isRevealReady()) return;
    revealWaiting.current = false;
    reveal.set(0);
    reveal.set(withTiming(1, REVEAL, (done) => { if (done) scheduleOnRN(setRevealed, true); }));
  }, [atlas, reveal]);
  useEffect(() => { maybeReveal(); }, [atlasVersion, maybeReveal]);
  // the 打开 pills follow what has loaded
  useEffect(() => { if (camS.get() >= C.OPEN_PILL_MOUNT_SCALE) cull(); }, [atlasVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // a dataset (or the size) changed: the layout, kept where it can be (lib/canvas/layout.ts)
  useEffect(() => {
    if (!size) return;
    const wait = grayUntil.current - Date.now();
    if (lockKeyRef.current && dataset && dataset.key !== lockDataset.current && wait > 0) {
      const t = setTimeout(() => setGrayTick((n) => n + 1), wait);
      return () => clearTimeout(t);
    }
    if (!dataset || !dataset.elements.length) {
      layoutRef.current = null;
      datasetRef.current = dataset;
      setInstances([]);
      return;
    }
    const previous = layoutRef.current;
    const fresh = !previous;
    const L = buildLayout(dataset, size.W, size.H, previous);
    if (!previous || previous.signature !== L.signature) cacheRef.current.clear(); // prepareRenderSlotCache
    layoutRef.current = L;
    datasetRef.current = dataset;
    if (fresh) {
      const cam = initialCamera ?? homeCamera(L, size.W, size.H);
      camX.set(cam.x);
      camY.set(cam.y);
      camS.set(cam.s);
      atlas.reset();
      revealWaiting.current = true;
      setRevealed(false);
      reveal.set(0);
    }
    cull();
    // the similar dataset is laid out: the lock goes, the pictures come in
    if (lockKeyRef.current && dataset.key !== lockDataset.current) {
      releaseLock();
      startStaging();
    }
    return undefined;
  }, [dataset, size, grayTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // a refocus is over with nothing new (it failed): the lock goes
  useEffect(() => {
    if (!refining && lockKeyRef.current && datasetRef.current?.key === lockDataset.current) releaseLock();
  }, [refining]); // eslint-disable-line react-hooks/exhaustive-deps

  // externalFocusRequest: a seed from the history has loaded: the camera goes to its copy in the middle ring
  useEffect(() => {
    const L = layoutRef.current;
    const d = datasetRef.current;
    if (!focusRequest || !L || !d) return;
    const it = L.items.find((i) => i.sourceIndex === focusRequest.sourceIndex);
    const inst = it && createInstance(L, d, cacheRef.current, it, it.x, it.y, 0, 0);
    if (!inst || inst.element.id !== focusRequest.elementId) return;
    focusWorldPoint(inst.x + it.width / 2, inst.y + it.height / 2);
  }, [focusRequest?.id, dataset]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- taps, presses ----------
  const handleTap = useCallback((fx: number, fy: number) => {
    const inst = hit(fx, fy);
    if (!inst) return;
    const cx = inst.x + inst.item.width / 2;
    const cy = inst.y + inst.item.height / 2;
    if (inst.element.id !== cb.current.seedId) {
      if (refiningRef.current) return;
      setLockKey(inst.key); // startFocusLock
      lockKeyRef.current = inst.key;
      lockDataset.current = datasetRef.current?.key ?? null;
      grayUntil.current = Date.now() + C.TIMING_MS;
      lockAtlasKey.current = atlasKey(inst.element.id, inst.item.atlasHeight); // retainAtlasKey
      focusWorldPoint(cx, cy);
      cb.current.onFocusElement({ element: inst.element, elementIndex: inst.elementIndex, sourceIndex: inst.item.sourceIndex });
      return;
    }
    if (camS.get() >= C.MAX_SCALE - 0.01) cb.current.onOpenElement(inst.element);
    else focusWorldPoint(cx, cy, C.MAX_SCALE);
  }, [camS, focusWorldPoint, hit]);

  const handleLongPress = useCallback((fx: number, fy: number) => {
    const inst = hit(fx, fy);
    if (!inst) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cb.current.onLongPressElement(inst.element);
  }, [hit]);

  const pressIn = useCallback((fx: number, fy: number) => {
    const inst = hit(fx, fy);
    if (!inst) return;
    setPressedKey(inst.key);
    pressScale.set(withSpring(C.PRESS_SCALE, PRESS_SPRING));
  }, [hit, pressScale]);
  const pressOut = useCallback(() => { pressScale.set(withSpring(1, PRESS_SPRING)); }, [pressScale]);

  const setZoomKeyAt = useCallback((fx: number, fy: number) => { setZoomKey(hit(fx, fy)?.key ?? null); }, [hit]);
  const openZoomed = useCallback((fx: number, fy: number) => {
    const key = zoomKeyRef.current;
    const inst = (key && instancesRef.current.find((i) => i.key === key)) || hit(fx, fy);
    setZoomKey(null);
    if (inst) cb.current.onOpenElement(inst.element);
  }, [hit]);
  const clearZoomKey = useCallback(() => setZoomKey(null), []);

  // ---------- gestures ----------
  const gesture = useMemo(() => {
    // canvasPanGestureTs6: a touch while the canvas glides only stops it
    const touchDown = () => {
      'worklet';
      const glide = Math.abs(vx.get()) > C.TAP_SUPPRESSION_PAN_VELOCITY || Math.abs(vy.get()) > C.TAP_SUPPRESSION_PAN_VELOCITY
        || Math.abs(zv.get()) > C.TAP_SUPPRESSION_ZOOM_VELOCITY;
      suppressed.set(glide);
      stopMotion();
    };
    const pan = Gesture.Pan()
      .minDistance(C.TAP_MAX_DISTANCE)
      .onBegin(() => { if (!pinching.get()) panBlocked.set(false); })
      .onStart(() => {
        panning.set(true);
        panStart.set({ x: camX.get(), y: camY.get() });
      })
      .onUpdate((e) => {
        if (pinching.get() || panBlocked.get()) return;
        camX.set(panStart.get().x + e.translationX);
        camY.set(panStart.get().y + e.translationY);
      })
      .onEnd((e) => {
        if (pinching.get() || panBlocked.get()) return;
        // canvasPanGestureTs2: the glide starts at the gesture's velocity × PAN_VELOCITY_FACTOR
        vx.set(e.velocityX * C.PAN_VELOCITY_FACTOR);
        vy.set(e.velocityY * C.PAN_VELOCITY_FACTOR);
      })
      .onFinalize(() => { panning.set(false); });
    const longPress = Gesture.LongPress()
      .minDuration(C.LONG_PRESS_MS)
      .maxDistance(C.TAP_MAX_DISTANCE)
      .onStart((e) => { if (!suppressed.get() && !pinching.get()) scheduleOnRN(handleLongPress, e.x, e.y); });
    const tap = Gesture.Tap()
      .maxDistance(C.TAP_MAX_DISTANCE)
      .onBegin((e) => {
        touchDown();
        if (!suppressed.get()) scheduleOnRN(pressIn, e.x, e.y);
      })
      .onEnd((e, success) => { if (success && !suppressed.get() && !pinching.get()) scheduleOnRN(handleTap, e.x, e.y); })
      .onFinalize(() => { scheduleOnRN(pressOut); });
    const zoom = Gesture.Pinch()
      .onStart((e) => {
        stopMotion();
        pinching.set(true);
        panBlocked.set(true);
        const s = camS.get();
        const armed = s >= C.OPEN_VIEWER_ARM_SCALE;
        pinch.set({
          startScale: s, startX: camX.get(), startY: camY.get(), fx: e.focalX, fy: e.focalY, start: Date.now() / 1000, armed,
          thresholdReached: false, lastScale: s, lastX: camX.get(), lastY: camY.get(), lastV: 0, lastGestureScale: 1, lastSample: 0,
        });
        zfx.set(e.focalX);
        zfy.set(e.focalY);
        zoomOpen.set(0);
        if (armed) scheduleOnRN(setZoomKeyAt, e.focalX, e.focalY);
      })
      .onUpdate((e) => {
        const p = pinch.get();
        if (!p) return;
        const g = e.scale;
        const requested = p.startScale * g;
        const persistent = Math.min(C.MAX_SCALE, Math.max(C.MIN_SCALE, requested));
        const next = p.armed && g > 1 ? Math.min(C.OPEN_VIEWER_SCALE, Math.max(C.MIN_SCALE, requested)) : persistent;
        const wx = (p.fx - p.startX) / p.startScale;
        const wy = (p.fy - p.startY) / p.startScale;
        // the scale's velocity, smoothed (lastPinchVelocity)
        const t = Date.now() / 1000;
        let sampled = 0;
        if (p.lastSample > 0 && t - p.lastSample > 0.004 && p.lastGestureScale > 0) sampled = (g / p.lastGestureScale - 1) / (t - p.lastSample);
        else if (t - p.start > 0.004) sampled = (g - 1) / (t - p.start);
        sampled = Math.min(C.ZOOM_MAX_VELOCITY, Math.max(-C.ZOOM_MAX_VELOCITY, sampled));
        const lastV = p.lastV === 0 ? sampled : p.lastV * C.ZOOM_VELOCITY_SMOOTHING + sampled * (1 - C.ZOOM_VELOCITY_SMOOTHING);
        camS.set(next);
        camX.set(p.fx - wx * next);
        camY.set(p.fy - wy * next);
        const raw = p.armed ? Math.min(1, Math.max(0, (next - C.OPEN_VIEWER_ARM_SCALE) / (C.OPEN_VIEWER_SCALE - C.OPEN_VIEWER_ARM_SCALE))) : 0;
        zoomOpen.set(raw * raw * (3 - 2 * raw));
        pinch.set({
          ...p, lastV, lastGestureScale: g, lastSample: t, lastX: p.fx - wx * persistent, lastY: p.fy - wy * persistent, lastScale: persistent,
          thresholdReached: p.armed && g > 1 && requested >= C.OPEN_VIEWER_TRIGGER_SCALE,
        });
      })
      .onEnd(() => {
        const p = pinch.get();
        if (!p) return;
        const t = Date.now() / 1000;
        const sampledV = t - p.lastSample <= C.ZOOM_RELEASE_SAMPLE_MAX_AGE ? p.lastV : 0;
        // the release velocity's shape (resetInteractionState's dead zone and gains)
        const m = Math.abs(sampledV);
        let releaseV = 0;
        if (m > C.ZOOM_RELEASE_DEAD_ZONE) {
          const n = Math.min(1, Math.max(0, (m - C.ZOOM_RELEASE_DEAD_ZONE) / 4));
          const gain = C.ZOOM_RELEASE_BASE_GAIN + n * (C.ZOOM_RELEASE_FAST_GAIN - C.ZOOM_RELEASE_BASE_GAIN);
          const shaped = Math.min(C.ZOOM_MAX_VELOCITY, Math.max(0, (m - C.ZOOM_RELEASE_DEAD_ZONE) * gain));
          releaseV = sampledV < 0 ? -shaped : shaped;
        }
        const differs = Math.abs(camX.get() - p.lastX) > C.ZOOM_OPEN_RETURN_EPSILON || Math.abs(camY.get() - p.lastY) > C.ZOOM_OPEN_RETURN_EPSILON
          || Math.abs(camS.get() - p.lastScale) > 0.001 || zoomOpen.get() > 0.001;
        pinch.set(null);
        if (p.armed && p.thresholdReached) {
          // the open: the camera snaps back to where the pinch would have stopped, and the card opens
          camX.set(p.lastX);
          camY.set(p.lastY);
          camS.set(p.lastScale);
          zoomOpen.set(0);
          scheduleOnRN(openZoomed, p.fx, p.fy);
          return;
        }
        if (p.armed && differs) {
          animating.set(1);
          camX.set(withTiming(p.lastX, ZOOM_RETURN));
          camY.set(withTiming(p.lastY, ZOOM_RETURN));
          camS.set(withTiming(p.lastScale, ZOOM_RETURN, (done) => { if (done) animating.set(0); }));
          zoomOpen.set(withTiming(0, ZOOM_RETURN, (done) => { if (done) scheduleOnRN(clearZoomKey); }));
          return;
        }
        camX.set(p.lastX);
        camY.set(p.lastY);
        camS.set(p.lastScale);
        if (Math.abs(releaseV) > C.ZOOM_STOP_VELOCITY) {
          zfx.set(p.fx);
          zfy.set(p.fy);
          zv.set(releaseV);
        }
        zoomOpen.set(0);
        scheduleOnRN(clearZoomKey);
      })
      .onFinalize(() => { pinching.set(false); });
    return Gesture.Simultaneous(zoom, Gesture.Race(pan, longPress, tap));
  }, [handleLongPress, handleTap, pressIn, pressOut, setZoomKeyAt, openZoomed, clearZoomKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- drawing ----------
  const transform = useDerivedValue(() => [{ translateX: camX.get() }, { translateY: camY.get() }, { scale: camS.get() }]);
  const fade = useDerivedValue(() => 1 - zoomOpen.get() * (1 - C.OPEN_VIEWER_BACKGROUND_MIN_OPACITY));
  const revealOpacity = useDerivedValue(() => Math.min(reveal.get() * 3, 1));
  const revealBlur = useDerivedValue(() => C.REVEAL_BLUR * (1 - reveal.get()));
  const placeholderColor = theme.colors.emptyCardBackground;
  const r = theme.borderRadius.element;

  const special = zoomKey ?? pressedKey; // drawn over the rest: the card a pinch is opening, or the pressed one
  const scene = useMemo(() => {
    const byTexture = new Map<number, { image: SkImage; sprites: SkRect[]; transforms: SkRSXform[] }>();
    const rects: { key: string; x: number; y: number; w: number; h: number; color: string }[] = [];
    const notes: CanvasInstance[] = [];
    let top: { inst: CanvasInstance; sprite: { image: SkImage; rect: SkRect } | null; color: string } | null = null;
    const held = lockKey != null && shownDataset.current === lockDataset.current;
    const inTurn = (key: string) => staged == null || (rank.current.get(key) ?? 0) < staged;
    for (const inst of instances) {
      const el = inst.element;
      const placeholder = held && inst.key !== lockKey;
      const sprite = !placeholder && hasPicture(el) && inTurn(inst.key) ? atlas.loaded.get(atlasKey(el.id, inst.item.atlasHeight)) ?? null : null;
      const color = placeholder ? placeholderColor : el.color ?? placeholderColor;
      if (inst.key === special) {
        top = { inst, sprite: sprite ? { image: sprite.texture.image, rect: sprite.rect } : null, color };
        if (!placeholder && isNoteCard(el)) notes.push(inst);
        continue;
      }
      if (!placeholder && isNoteCard(el)) { notes.push(inst); continue; }
      if (!sprite) { rects.push({ key: inst.key, x: inst.x, y: inst.y, w: inst.item.width, h: inst.item.height, color }); continue; }
      let g = byTexture.get(sprite.texture.id);
      if (!g) { g = { image: sprite.texture.image, sprites: [], transforms: [] }; byTexture.set(sprite.texture.id, g); }
      g.sprites.push(sprite.rect);
      g.transforms.push(Skia.RSXform(inst.item.width / C.ATLAS_SPRITE_WIDTH, 0, inst.x, inst.y));
    }
    return { textures: [...byTexture.entries()], rects, notes, top };
  }, [instances, atlasVersion, lockKey, staged, special, placeholderColor]); // eslint-disable-line react-hooks/exhaustive-deps

  const topInst = scene.top?.inst ?? null;
  const topTransform = useDerivedValue(() => {
    if (!topInst) return [];
    const cx = topInst.x + topInst.item.width / 2;
    const cy = topInst.y + topInst.item.height / 2;
    return [{ translateX: cx }, { translateY: cy }, { scale: pressScale.get() }, { translateX: -cx }, { translateY: -cy }];
  }, [topInst]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.round(size.W) !== Math.round(width) || Math.round(size.H) !== Math.round(height)) setSize({ W: width, H: height });
  };

  // CanvasOpenPillOverlayTsx2: shown from OPEN_PILL_SCALE, hidden under OPEN_PILL_HIDE_SCALE or while a pinch opens
  useAnimatedReaction(() => ({ scale: camS.get(), progress: zoomOpen.get() }), ({ scale, progress }) => {
    const visible = pillVisible.get();
    if (progress > 0.001) { if (visible) pillVisible.set(false); return; }
    if (visible) { if (scale < C.OPEN_PILL_HIDE_SCALE) pillVisible.set(false); return; }
    if (scale >= C.OPEN_PILL_SCALE) pillVisible.set(true);
  });
  const pillOpacity = useDerivedValue<number>(() => withTiming(pillVisible.get() ? 1 : 0, { duration: C.OPEN_PILL_FADE_MS }));

  const world = (
    <>
      <Group opacity={fade}>
        {scene.rects.map((p) => <RoundedRect key={p.key} x={p.x} y={p.y} width={p.w} height={p.h} r={r} color={p.color} />)}
        {scene.textures.map(([id, g]) => (
          <Atlas key={id} image={g.image} sprites={g.sprites} transforms={g.transforms} sampling={SAMPLING} />
        ))}
        {stripInsts.map((inst) => {
          const image = strips.get(inst.element.videoStrip!.url);
          return image && inst.key !== scene.top?.inst.key && (staged == null || (rank.current.get(inst.key) ?? 0) < staged) ? <StripCard key={inst.key} inst={inst} image={image} clock={stripClock} radius={r} /> : null;
        })}
      </Group>
      {scene.top ? (
        <Group transform={topTransform}>
          {scene.top.sprite
            ? <Atlas image={scene.top.sprite.image} sprites={[scene.top.sprite.rect]} transforms={[Skia.RSXform(scene.top.inst.item.width / C.ATLAS_SPRITE_WIDTH, 0, scene.top.inst.x, scene.top.inst.y)]} sampling={SAMPLING} />
            : isNoteCard(scene.top.inst.element) ? null
              : <RoundedRect x={scene.top.inst.x} y={scene.top.inst.y} width={scene.top.inst.item.width} height={scene.top.inst.item.height} r={r} color={scene.top.color} />}
        </Group>
      ) : null}
    </>
  );

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill} collapsable={false}>
          <Canvas style={styles.fill}>
            <Group transform={transform} opacity={revealOpacity} layer={revealed ? undefined : <Paint><Blur blur={revealBlur} /></Paint>}>
              {world}
            </Group>
          </Canvas>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {clips.filter((inst) => staged == null || (rank.current.get(inst.key) ?? 0) < staged).map((inst) => (
              <ClipCard key={inst.key} inst={inst} camX={camX} camY={camY} camS={camS} reveal={revealOpacity} fade={fade}
                focus={inst.key === special} pressScale={pressScale} playing={active && !moving} busy={busy} />
            ))}
            {scene.notes.map((inst) => (
              <NoteCard key={inst.key} inst={inst} camX={camX} camY={camY} camS={camS} reveal={revealOpacity} fade={fade}
                focus={inst.key === special} pressScale={pressScale} />
            ))}
          </View>
        </View>
      </GestureDetector>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {pills.map((inst) => (
          <OpenPill key={inst.key} inst={inst} camX={camX} camY={camY} camS={camS} opacity={pillOpacity} visible={pillVisible}
            onOpen={() => cb.current.onOpenElement(inst.element)} />
        ))}
      </View>
    </View>
  );
}

type Cam = { camX: SharedValue<number>; camY: SharedValue<number>; camS: SharedValue<number> };

type CardProps = Cam & {
  inst: CanvasInstance; reveal: SharedValue<number>; fade: SharedValue<number>; focus: boolean; pressScale: SharedValue<number>;
};

// a card over the canvas in its slot: follows the camera, comes in with the reveal, fades with a pinch that opens
// another card, gives a little when pressed
function useCardStyle({ inst, camX, camY, camS, reveal, fade, focus, pressScale }: CardProps) {
  const { x, y } = inst;
  const { width, height } = inst.item;
  return useAnimatedStyle(() => {
    const s = camS.get();
    const press = focus ? pressScale.get() : 1;
    return {
      opacity: reveal.get() * (focus ? 1 : fade.get()),
      transform: [
        { translateX: camX.get() + x * s + (width * s * (1 - press)) / 2 },
        { translateY: camY.get() + y * s + (height * s * (1 - press)) / 2 },
        { scale: s * press },
      ],
    };
  });
}

// a note on the canvas: its text in its slot (the web page's DOM card, kept by the person's choice)
function NoteCard(props: CardProps) {
  const style = useCardStyle(props);
  const { inst } = props;
  return (
    <Animated.View style={[styles.note, { width: inst.item.width, height: inst.item.height }, style]}>
      <NoteElement text={inst.element.text ?? inst.element.title ?? ''} compact />
    </Animated.View>
  );
}

// a video's strip over its cover: its frames in turn, each cut to the card's shape, the cards out of step with each
// other so a screen of them does not tick together
function StripCard({ inst, image, clock, radius }: { inst: CanvasInstance; image: SkImage; clock: SharedValue<number>; radius: number }) {
  const { x, y } = inst;
  const { width, height } = inst.item;
  const { frames, cols, rows } = inst.element.videoStrip!;
  const fw = image.width() / cols;
  const fh = image.height() / rows;
  const scale = Math.max(width / fw, height / fh);
  const sw = width / scale;
  const sh = height / scale;
  const ox = (fw - sw) / 2;
  const oy = (fh - sh) / 2;
  const start = useMemo(() => [...inst.element.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % frames, [inst.element.id, frames]);
  const sprites = useDerivedValue(() => {
    const f = (clock.get() + start) % frames;
    return [Skia.XYWHRect((f % cols) * fw + ox, Math.floor(f / cols) * fh + oy, sw, sh)];
  });
  const transforms = useMemo(() => [Skia.RSXform(scale, 0, x, y)], [scale, x, y]);
  const clip = useMemo(() => Skia.RRectXY(Skia.XYWHRect(x, y, width, height), radius, radius), [x, y, width, height, radius]);
  return (
    <Group clip={clip}>
      <Atlas image={image} sprites={sprites} transforms={transforms} sampling={SAMPLING} />
    </Group>
  );
}

// a video on the canvas plays over its strip (the web page's board-clip, kept by the person's choice): muted and
// looping, its preview first and the original if that does not play; it stays see-through until its first frame is
// ready (VideoElementTsx1's videoReadyMap; the web page's .live), so the cover shows till then. Its VideoView is
// VideoElement's (a texture, no picture in picture, no controls). While the camera moves it is out of sight from the
// first frame of the move (busy, on the UI thread) until it plays again (playing, from JS), its strip showing instead.
// It fades out (CLIP_FADE_OUT_MS) and comes back at once: its strip, under it, shows another frame, and a cut from one
// to the other jumped (HANDOFF 6.172), but fading it back in flashed black (6.174)
function ClipCard({ playing, busy, ...props }: CardProps & { playing: boolean; busy: SharedValue<boolean> }) {
  const style = useCardStyle(props);
  const { inst } = props;
  const urls = useMemo(() => canvasVideoUrls(inst.element).map((u) => absoluteUrl(u)), [inst.element]);
  const paused = useSharedValue(!playing);
  useEffect(() => { paused.set(!playing); }, [playing, paused]);
  const shown = useAnimatedStyle(() => {
    const off = busy.get() || paused.get();
    return { opacity: withTiming(off ? 0 : 1, { duration: off ? CLIP_FADE_OUT_MS : CLIP_FADE_IN_MS }) };
  });
  return (
    <Animated.View style={[styles.clip, { width: inst.item.width, height: inst.item.height }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shown]}>
        <PreviewVideo urls={urls} playing={playing} />
      </Animated.View>
    </Animated.View>
  );
}

// CanvasOpenPillOverlay's pill (CanvasOpenPillOverlayTsx4): at the card's top right, OPEN_PILL_INSET in
function OpenPill({ inst, camX, camY, camS, opacity, visible, onOpen }: Cam & {
  inst: CanvasInstance; opacity: SharedValue<number>; visible: SharedValue<boolean>; onOpen: () => void;
}) {
  const { x, y } = inst;
  const { width } = inst.item;
  const style = useAnimatedStyle(() => {
    const s = camS.get();
    return {
      opacity: opacity.get(),
      transform: [
        { translateX: camX.get() + (x + width) * s - C.OPEN_PILL_WIDTH - C.OPEN_PILL_INSET },
        { translateY: camY.get() + y * s + C.OPEN_PILL_INSET },
      ],
    };
  });
  return (
    <Animated.View style={[styles.pillWrap, style]}>
      <Pressable style={styles.pill} hitSlop={8} onPress={() => { if (visible.get()) onOpen(); }} accessibilityRole="button" accessibilityLabel="打开">
        <Text style={styles.pillLabel}>打开</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  fill: { flex: 1 },
  note: {
    position: 'absolute', left: 0, top: 0, transformOrigin: 'left top', overflow: 'hidden', justifyContent: 'center',
    backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.element,
  },
  clip: { position: 'absolute', left: 0, top: 0, transformOrigin: 'left top', overflow: 'hidden', borderRadius: theme.borderRadius.element },
  pillWrap: { position: 'absolute', left: 0, top: 0, width: C.OPEN_PILL_WIDTH, height: C.OPEN_PILL_HEIGHT },
  pill: {
    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.sm,
  },
  pillLabel: { ...theme.typography.captionPlus, color: theme.colors.background },
}));
