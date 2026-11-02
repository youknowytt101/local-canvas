// Which video tiles of a grid play: the web page's watchVideo / syncPlayback, kept by the person's choice (HANDOFF 6.169;
// Cosmos' grids only draw covers, MasonryGrid's allowVideoPlayback false). Nothing runs on a clock: the tiles of the
// screen in front register, and the places of all of them are read once things have come to rest, SETTLE_MS after the
// last of what moves them (a list's scroll, a pager's page, a tile coming or going, the app coming back, the budget):
//   - while a list scrolls, what plays plays on and nothing starts or lets go (the web page pauses them; the person
//     wants them to keep moving, HANDOFF 6.170)
//   - at rest, the ones most in the middle with VISIBLE_FRACTION of them on screen play, within each lane's budget (a
//     preview, or the original of a video without one; lib/videoBudget, fewer as the phone warms up); the rest let go
//     of their players. Half on screen is what counts as seen (the usual viewability rule for video)
//   - the previews of the tiles mounted near the screen (the list draws ahead) are fetched ahead, nearest first, so a
//     tile scrolled to has its file (lib/previewFiles)
// Out of sight (the app in the background) nothing is kept.
import { createContext } from 'react';
import { AppState, Dimensions } from 'react-native';
import { prefetchPreviews } from './previewFiles';
import { videoBudget, watchVideoBudget } from './videoBudget';

export type GridVideoState = 'off' | 'playing';

// false over a grid that is drawn but not shown (the page of two laid one over the other that has faded out): its tiles
// play nothing, though they are where the screen is
export const GridVideosShown = createContext(true);

type Rect = { x: number; y: number; w: number; h: number };
type Tile = {
  lane: 'preview' | 'original'; preview: string | null; set: (s: GridVideoState) => void; state: GridVideoState;
  measure: (done: (x: number, y: number, w: number, h: number) => void) => void;
};

const SETTLE_MS = 150;
const VISIBLE_FRACTION = 0.5;
const AHEAD_SCREENS = 1; // fetched ahead: the tiles within a screen above or below

const tiles = new Set<Tile>();
let lastMove = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let round = 0;
let unwatch: (() => void) | null = null;
let appSub: { remove: () => void } | null = null;

function set(tile: Tile, state: GridVideoState) {
  if (tile.state === state) return;
  tile.state = state;
  tile.set(state);
}

function decide(rects: Map<Tile, Rect>) {
  if (AppState.currentState !== 'active') {
    tiles.forEach((t) => set(t, 'off'));
    return;
  }
  const { width, height } = Dimensions.get('window');
  const budget = videoBudget();
  const dist = ({ x, y, w, h }: Rect) => (x + w / 2 - width / 2) ** 2 + (y + h / 2 - height / 2) ** 2;
  const shown = ({ x, y, w, h }: Rect) => (w > 0 && h > 0 ? (Math.max(0, Math.min(x + w, width) - Math.max(x, 0)) * Math.max(0, Math.min(y + h, height) - Math.max(y, 0))) / (w * h) : 0);
  const near = [...rects].filter(([, r]) => r.x + r.w > 0 && r.x < width).sort((a, b) => dist(a[1]) - dist(b[1]));
  const chosen = new Set<Tile>();
  for (const lane of ['preview', 'original'] as const) {
    near.filter(([t, r]) => t.lane === lane && shown(r) >= VISIBLE_FRACTION)
      .slice(0, lane === 'preview' ? budget.previews : budget.originals)
      .forEach(([t]) => chosen.add(t));
  }
  // the ones that stop go first, so that their decoders are free for the new ones (which start a few at a time, in
  // this order: lib/previewStarts)
  tiles.forEach((t) => { if (!chosen.has(t)) set(t, 'off'); });
  chosen.forEach((t) => set(t, 'playing'));
  prefetchPreviews(near.filter(([t, r]) => t.preview && !chosen.has(t) && r.y + r.h > -height * AHEAD_SCREENS && r.y < height * (1 + AHEAD_SCREENS)).map(([t]) => t.preview!));
}

// read every tile's place, then decide; a newer round makes an older one count for nothing
function measureAll() {
  const mine = ++round;
  const list = [...tiles];
  const rects = new Map<Tile, Rect>();
  let left = list.length;
  if (!left) return;
  list.forEach((tile) => tile.measure((x, y, w, h) => {
    if (mine !== round) return;
    if (tiles.has(tile)) rects.set(tile, { x, y, w, h });
    if (--left === 0) decide(rects);
  }));
}

function settle() {
  const wait = lastMove + SETTLE_MS - Date.now();
  if (wait > 0) {
    settleTimer = setTimeout(settle, wait);
    return;
  }
  settleTimer = undefined;
  measureAll();
}

// something that moves the tiles of the screen in front has happened (a list's onScroll, a pager's page): they are
// looked at once it has stopped. Cheap enough for every scroll event: one timer at a time
export function noteGridMoved() {
  if (!tiles.size) return;
  lastMove = Date.now();
  settleTimer ??= setTimeout(settle, SETTLE_MS);
}

// a video tile of the screen in front; the function returned takes it away again
export function watchGridVideo(lane: Tile['lane'], preview: string | null, measure: Tile['measure'], setState: Tile['set']) {
  const tile: Tile = { lane, preview, measure, set: setState, state: 'off' };
  tiles.add(tile);
  unwatch ??= watchVideoBudget(noteGridMoved);
  appSub ??= AppState.addEventListener('change', noteGridMoved);
  noteGridMoved();
  return () => {
    tiles.delete(tile);
    noteGridMoved(); // one that played makes room for another
    if (tiles.size) return;
    clearTimeout(settleTimer);
    settleTimer = undefined;
    round += 1;
    unwatch?.();
    unwatch = null;
    appSub?.remove();
    appSub = null;
  };
}
