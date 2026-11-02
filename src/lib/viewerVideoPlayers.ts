// The viewer's video players, kept outside React so that nothing waits for a render. Cosmos mounts a player when a page
// becomes active (VideoElement's useVideoPlayer) and its setup only runs on the player's first event; here the page's
// whole render stands in front of both (500 - 800 ms measured, HANDOFF 6.165), so:
//   - pressing a tile (openElementViewer) or a page being selected (ElementsViewerScreen) starts the player at once
//   - the pages next to it are prepared, paused on their first frame, so they are there when swiped to
//   - what a player was told is applied again on its first events (VideoElement's applyPlayerState): on iOS the item
//     only arrives after the player is made
//   - a player's first frame is remembered here, so a view mounted late does not miss it
import { useSyncExternalStore } from 'react';
import { VideoPlayer } from 'react-native-video';
import type { Element } from './elements';
import { absoluteUrl } from './server';

// a page starts as soon as a quarter of a second has arrived (the library's default waits for a whole second); the
// others hold a few seconds, not the whole file
const BUFFER = { minBufferMs: 2000, maxBufferMs: 8000, bufferForPlaybackMs: 250, bufferForPlaybackAfterRebufferMs: 1000, preferredForwardBufferDurationMs: 4000 };
const RELEASE_DELAY = 300; // the views still showing it go first

export type ViewerVideoEntry = {
  id: string;
  urls: string[];
  at: number;
  player: VideoPlayer;
  ready: boolean;
  playing: boolean;
  onReady: Set<() => void>;
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
  p.loop = true;
  p.muted = muted;
  if (entry.playing) p.play();
  else p.pause();
}

function attach(entry: ViewerVideoEntry) {
  const p = new VideoPlayer({ uri: entry.urls[entry.at], bufferConfig: BUFFER });
  entry.player = p;
  entry.ready = false;
  apply(entry);
  p.addEventListener('onLoadStart', () => apply(entry));
  p.addEventListener('onStatusChange', () => apply(entry));
  p.addEventListener('onReadyToDisplay', () => {
    entry.ready = true;
    entry.onReady.forEach((f) => f());
  });
  // the original not there (or not playable): its preview
  p.addEventListener('onError', () => {
    if (entry.at + 1 >= entry.urls.length) return;
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
  const entry = { id: el.id, urls, at: 0, ready: false, playing: false, onReady: new Set() } as unknown as ViewerVideoEntry;
  attach(entry);
  entries.set(el.id, entry);
  return entry;
}

function drop(entry: ViewerVideoEntry) {
  entries.delete(entry.id);
  entry.player.pause();
  const { player } = entry;
  setTimeout(() => player.release(), RELEASE_DELAY);
}

// the element on screen plays, the one before it goes back to its start and waits
export function playViewerVideo(el: Element | null | undefined) {
  if (el && active === el.id && entries.get(el.id)?.playing) return;
  for (const entry of entries.values()) {
    if (entry.id === el?.id || !entry.playing) continue;
    entry.playing = false;
    entry.player.pause();
    entry.player.seekTo(0);
  }
  const entry = el ? prepare(el) : null;
  active = entry?.id ?? null;
  if (entry) {
    entry.playing = true;
    apply(entry);
  }
  changed();
}

// the pages next to the one on screen are ready before they are swiped to; any others let go of their decoders
export function holdViewerVideos(els: (Element | null | undefined)[]) {
  const keep = new Set(els.flatMap((el) => (el ? [el.id] : [])));
  if (active) keep.add(active);
  for (const entry of [...entries.values()]) if (!keep.has(entry.id)) drop(entry);
  els.forEach((el) => { if (el) prepare(el); });
  changed();
}

// the viewer showing this element left the screen. Another viewer's element playing by now is left alone (a similar
// one opened on top starts before this one has gone).
export function leaveViewerVideo(elementId: string | null | undefined) {
  if (active !== elementId) return;
  active = null;
  for (const entry of [...entries.values()]) drop(entry);
  changed();
}

export const isViewerMuted = () => muted;
export function setViewerMuted(next: boolean) {
  muted = next;
  for (const entry of entries.values()) entry.player.muted = next;
}

export function useViewerVideo(id: string) {
  const player = useSyncExternalStore(subscribe, () => entries.get(id)?.player ?? null);
  return player ? entries.get(id) ?? null : null;
}
export const useIsActiveViewerVideo = (id: string) => useSyncExternalStore(subscribe, () => active === id);
