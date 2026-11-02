// The viewer's video players (expo-video), kept outside React so that nothing waits for a render. Cosmos mounts a player
// when a page becomes active (VideoElement's useVideoPlayer) and its setup only runs on the player's first event; here the
// page's whole render stands in front of both (500 - 800 ms measured, HANDOFF 6.165), and on a page's selection the slide
// still has half a second to go, so:
//   - a finger going down on a tile gets its player ready (prewarmViewerVideo), letting go starts it (openElementViewer)
//   - the pages next to the one on screen are prepared and drawn, paused on their first frame (the two-player
//     pre-rendering of short video apps; Instagram Reels' adjacent preload), and the one a swipe is bringing in starts as
//     soon as the finger lets go (peekViewerVideo), silent until its page is selected: it is moving as it comes in. Not
//     while the finger is on it: that made the pager misread 13 swipes in 20 and spring back (HANDOFF 6.169)
//   - on Android a player gets its video only once its page's view has its Surface (lib/videoSurface): a finger going
//     down still makes the player, the video comes with the page
//   - a page's first frame is remembered here (its VideoView says so, markViewerVideoReady), for the step below
//   - nothing competes with the video on screen: only once it has its first frame (or FIRST_FRAME_WAIT_MS has gone) do
//     the players no longer wanted let go and the pages next to it get prepared; HELD_MAX bounds what a fast run of
//     swipes can pile up; a memory warning or going to the background lets go of everything but the video on screen;
//     a warm phone prepares no neighbours (lib/videoBudget) (these after Douyin's player, HANDOFF 6.166-6.167)
// A player keeps what it is told (sound, looping, playing) through its item's loading, so nothing is applied again.
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Element } from './elements';
import { absoluteUrl } from './server';
import { videoBudget } from './videoBudget';
import { afterSurface, SOURCE_AFTER_SURFACE } from './videoSurface';

// a page starts as soon as a quarter of a second has arrived (AVPlayer waits until it reckons the whole clip will play
// through; media3 for 2.5 s), and holds a few seconds ahead, not the whole file
const BUFFER = { preferredForwardBufferDuration: 4, waitsToMinimizeStalling: false, minBufferForPlayback: 0.25 };
const RELEASE_DELAY = 300; // the views still showing it go first
const PREWARM_MS = 1500;
const FIRST_FRAME_WAIT_MS = 1500;
const HELD_MAX = 4;

export type ViewerVideoEntry = {
  id: string;
  urls: string[];
  at: number;
  player: VideoPlayer;
  ready: boolean;
  playing: boolean;
  peeking: boolean;
  onReady: Set<() => void>;
  sub: { remove: () => void } | null;
  sourced: boolean; // has its video (on Android only once its page's view has its Surface, lib/videoSurface)
};

const entries = new Map<string, ViewerVideoEntry>();
const listeners = new Set<() => void>();
let active: string | null = null;
let muted = true; // useElementViewerVideoStore: from silent, the same for every page once changed

export const viewerRevealed = new Set<string>(); // 查看 pressed in the viewer: shown as it is until the app is closed
const veiled = (el: Element) => el.nsfw?.treatment === 'blur' && !viewerRevealed.has(el.id);
const changed = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function apply(entry: ViewerVideoEntry) {
  const p = entry.player;
  p.muted = muted || entry.peeking;
  if (entry.playing) p.play();
  else p.pause();
}

function attach(entry: ViewerVideoEntry) {
  const p = createVideoPlayer(SOURCE_AFTER_SURFACE ? null : { uri: entry.urls[entry.at] });
  entry.sourced = !SOURCE_AFTER_SURFACE;
  p.loop = true;
  p.bufferOptions = BUFFER;
  entry.player = p;
  entry.ready = false;
  apply(entry);
  // the original not there (or not playable): its preview
  entry.sub = p.addListener('statusChange', ({ status }) => {
    if (status !== 'error' || entry.player !== p || entry.at + 1 >= entry.urls.length) return;
    entry.sub?.remove();
    entry.at += 1;
    attach(entry);
    changed();
    setTimeout(() => p.release(), RELEASE_DELAY);
  });
}

function prepare(el: Element): ViewerVideoEntry | null {
  const have = entries.get(el.id);
  if (have) return have;
  const urls = el.mediaKind === 'video' && !veiled(el) ? [el.mediaUrl, el.previewUrl].filter((u): u is string => !!u).map((u) => absoluteUrl(u)) : [];
  if (!urls.length) return null;
  watchApp();
  // the oldest that is not playing makes way
  for (const other of [...entries.values()]) {
    if (entries.size < HELD_MAX) break;
    if (!other.playing && other.id !== active) drop(other);
  }
  const entry = { id: el.id, urls, at: 0, ready: false, playing: false, peeking: false, onReady: new Set(), sub: null, sourced: false } as unknown as ViewerVideoEntry;
  attach(entry);
  entries.set(el.id, entry);
  return entry;
}

function drop(entry: ViewerVideoEntry) {
  entries.delete(entry.id);
  entry.sub?.remove();
  entry.player.pause();
  const { player } = entry;
  setTimeout(() => player.release(), RELEASE_DELAY);
}

function rewind(entry: ViewerVideoEntry) {
  entry.playing = false;
  entry.peeking = false;
  entry.player.pause();
  entry.player.currentTime = 0;
}

// a page's VideoView is laid out: on Android its player gets its video once the view has its Surface
export function viewerVideoLaidOut(entry: ViewerVideoEntry) {
  if (entry.sourced) return;
  entry.sourced = true;
  const p = entry.player;
  afterSurface(() => { if (entry.player === p && entries.get(entry.id) === entry) void p.replaceAsync({ uri: entry.urls[entry.at] }); });
}

// a page's VideoView has drawn its first frame
export function markViewerVideoReady(entry: ViewerVideoEntry) {
  if (entry.ready) return;
  entry.ready = true;
  entry.onReady.forEach((f) => f());
}

// the element on screen plays, the one before it goes back to its start and waits. A page sliding out plays on, silent,
// until the slide ends (settleViewerVideos)
export function playViewerVideo(el: Element | null | undefined, sliding = false) {
  if (el && active === el.id && entries.get(el.id)?.playing) return;
  for (const entry of entries.values()) {
    if (entry.id === el?.id || !entry.playing) continue;
    if (sliding || entry.peeking) {
      entry.peeking = true;
      if (!muted) entry.player.muted = true;
    } else rewind(entry);
  }
  const entry = el ? prepare(el) : null;
  active = entry?.id ?? null;
  if (entry) {
    entry.playing = true;
    entry.peeking = false;
    apply(entry);
  }
  changed();
}

// a slide is bringing this page in: it starts now if it is prepared. Only what cannot wait: a prepared player already
// loops and has the sound it should, and setting those is synchronous with the main thread
export function peekViewerVideo(el: Element | null | undefined) {
  const entry = el ? entries.get(el.id) : null;
  if (!entry || entry.playing) return;
  entry.playing = true;
  entry.peeking = true;
  if (!muted) entry.player.muted = true;
  entry.player.play();
}

// the swipe has ended: a page it did not stop on goes back and waits
export function settleViewerVideos() {
  for (const entry of entries.values()) {
    if (entry.peeking && entry.id !== active) rewind(entry);
  }
}

// a finger is down on this tile: its player gets going, and lets go of its decoder if nothing comes of it
let prewarmed: string | null = null;
let prewarmTimer: ReturnType<typeof setTimeout> | undefined;
const coldAgain = (id: string | null) => {
  const entry = id ? entries.get(id) : null;
  if (entry && !entry.playing && id !== active) drop(entry);
};
export function prewarmViewerVideo(el: Element) {
  clearTimeout(prewarmTimer);
  if (prewarmed !== el.id) coldAgain(prewarmed);
  prewarmed = el.id;
  prepare(el);
  prewarmTimer = setTimeout(() => { coldAgain(prewarmed); prewarmed = null; }, PREWARM_MS);
}

// the pages next to the one on screen are ready before they are swiped to, and any others let go of their decoders,
// once the one on screen has started
let wanted: (Element | null | undefined)[] = [];
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let holdWaitingOn: { entry: ViewerVideoEntry; run: () => void } | null = null;

function cancelHold() {
  clearTimeout(holdTimer);
  holdWaitingOn?.entry.onReady.delete(holdWaitingOn.run);
  holdWaitingOn = null;
}

function applyHold() {
  cancelHold();
  const neighbours = videoBudget().neighbours ? wanted : [];
  const keep = new Set(neighbours.flatMap((el) => (el ? [el.id] : [])));
  if (active) keep.add(active);
  for (const entry of [...entries.values()]) if (!keep.has(entry.id)) drop(entry);
  neighbours.forEach((el) => { if (el) prepare(el); });
  changed();
}

export function holdViewerVideos(els: (Element | null | undefined)[]) {
  wanted = els;
  cancelHold();
  const entry = active ? entries.get(active) : null;
  if (!entry || entry.ready) {
    applyHold();
    return;
  }
  holdWaitingOn = { entry, run: applyHold };
  entry.onReady.add(applyHold);
  holdTimer = setTimeout(applyHold, FIRST_FRAME_WAIT_MS);
}

// the viewer showing this element left the screen. Another viewer's element playing by now is left alone (a similar
// one opened on top starts before this one has gone).
export function leaveViewerVideo(elementId: string | null | undefined) {
  if (active !== elementId) return;
  active = null;
  wanted = [];
  cancelHold();
  for (const entry of [...entries.values()]) drop(entry);
  changed();
}

// short of memory or out of sight: only the video on screen stays. Coming back, it plays on and its neighbours return.
function letGoOfTheRest() {
  cancelHold();
  for (const entry of [...entries.values()]) if (entry.id !== active) drop(entry);
  changed();
}
let watching = false;
function watchApp() {
  if (watching) return;
  watching = true;
  AppState.addEventListener('memoryWarning', letGoOfTheRest);
  AppState.addEventListener('change', (state) => {
    if (state === 'background') letGoOfTheRest();
    else if (state === 'active' && active) {
      const entry = entries.get(active);
      if (entry) apply(entry);
      holdViewerVideos(wanted);
    }
  });
}

export const isViewerMuted = () => muted;
export function setViewerMuted(next: boolean) {
  muted = next;
  for (const entry of entries.values()) entry.player.muted = next || entry.peeking;
}

export function useViewerVideo(id: string) {
  const player = useSyncExternalStore(subscribe, () => entries.get(id)?.player ?? null);
  return player ? entries.get(id) ?? null : null;
}
export const useIsActiveViewerVideo = (id: string) => useSyncExternalStore(subscribe, () => active === id);
