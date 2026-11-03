// Which video tiles of a grid play: the web page's watchVideo / syncPlayback, kept by the person's choice (HANDOFF 6.169;
// Cosmos' grids only draw covers, MasonryGrid's allowVideoPlayback false), so that the videos on screen play together
// (HANDOFF 6.183). The tiles of the screen in front register, and their places are read every TICK_MS while something
// moves them (a list's scroll, a pager's page, a tile coming or going, the app coming back, the budget) and once more
// after it has stopped; nothing runs at rest:
//   - every video tile with VISIBLE_FRACTION of it on screen plays (the usual viewability rule for video), the ones most
//     in the middle first while there are more than the budget allows (a preview, or the original of a video without
//     one; lib/videoBudget, fewer as the phone warms up)
//   - the next ones are prepared before they come (the two-player pre-rendering of short video apps, on a grid): those
//     partly on screen or within a screen of it, the ones the scroll is moving towards first, made a player paused on
//     its first frame, so that coming on screen they only start playing. Making players is queued, one or two at a
//     time, the ones wanted on screen first (lib/previewStarts): a screen of them made at once dropped frames
//   - during a scroll only the players there are play and pause (one coming on screen prepared plays at once, one
//     leaving pauses); players are made and let go of once it stops: doing that mid-scroll made a quarter of the
//     scroll's frames late on the emulator (HANDOFF 6.183)
//   - at rest one off the screen stays prepared while it is within a screen of it and the budget has room; further away
//     it lets go of its player (scrolling back and forth does not make and drop them again)
//   - the previews of the tiles mounted near the screen (the list draws ahead) are fetched ahead, nearest first, so a
//     tile scrolled to has its file (lib/previewFiles)
// Out of sight (the app in the background) nothing is kept.
import { createContext } from 'react';
import { AppState, Dimensions } from 'react-native';
import { prefetchPreviews } from './previewFiles';
import { videoBudget, watchVideoBudget } from './videoBudget';

export type GridVideoState = 'off' | 'ready' | 'playing';

// false over a grid that is drawn but not shown (the page of two laid one over the other that has faded out): its tiles
// play nothing, though they are where the screen is
export const GridVideosShown = createContext(true);

type Rect = { x: number; y: number; w: number; h: number };
type Tile = {
  lane: 'preview' | 'original'; preview: string | null; set: (s: GridVideoState) => void; state: GridVideoState;
  measure: (done: (x: number, y: number, w: number, h: number) => void) => void;
};

const TICK_MS = 120;
const VISIBLE_FRACTION = 0.5;
const AHEAD_SCREENS = 1; // prepared and fetched ahead: the tiles within a screen above or below

const tiles = new Set<Tile>();
let lastMove = 0;
let tickTimer: ReturnType<typeof setTimeout> | undefined;
let round = 0;
let lastRects = new Map<Tile, Rect>();
let unwatch: (() => void) | null = null;
let appSub: { remove: () => void } | null = null;

function set(tile: Tile, state: GridVideoState) {
  if (tile.state === state) return;
  tile.state = state;
  tile.set(state);
}

function decide(rects: Map<Tile, Rect>, moving: boolean) {
  if (AppState.currentState !== 'active') {
    tiles.forEach((t) => set(t, 'off'));
    return;
  }
  const { width, height } = Dimensions.get('window');
  const budget = videoBudget();
  // which way the tiles have moved since the last look: the ones coming are prepared first
  let moved = 0;
  rects.forEach((r, t) => { const was = lastRects.get(t); if (was) moved += r.y - was.y; });
  lastRects = rects;
  const dist = ({ x, y, w, h }: Rect) => (x + w / 2 - width / 2) ** 2 + (y + h / 2 - height / 2) ** 2;
  const shown = ({ x, y, w, h }: Rect) => (w > 0 && h > 0 ? (Math.max(0, Math.min(x + w, width) - Math.max(x, 0)) * Math.max(0, Math.min(y + h, height) - Math.max(y, 0))) / (w * h) : 0);
  const away = ({ y, h }: Rect) => (y + h <= 0 ? -(y + h) : y >= height ? y - height : 0); // how far off the screen
  const coming = ({ y, h }: Rect) => (moved < 0 ? y >= height : moved > 0 ? y + h <= 0 : false);
  // a pager's other pages are beside the screen: theirs do not count
  const column = [...rects].filter(([, r]) => r.x + r.w > 0 && r.x < width).sort((a, b) => dist(a[1]) - dist(b[1]));
  const playing = new Set<Tile>();
  for (const lane of ['preview', 'original'] as const) {
    column.filter(([t, r]) => t.lane === lane && shown(r) >= VISIBLE_FRACTION)
      .slice(0, lane === 'preview' ? budget.previews : budget.originals)
      .forEach(([t]) => playing.add(t));
  }
  const near = column.filter(([t, r]) => t.lane === 'preview' && !playing.has(t) && away(r) <= height * AHEAD_SCREENS)
    .sort((a, b) => Number(coming(b[1])) - Number(coming(a[1])) || away(a[1]) - away(b[1]));
  const ready = new Set(near.slice(0, budget.ahead).map(([t]) => t));
  if (moving) {
    // while it moves only what costs nothing: the prepared ones play or pause (making and letting go of players held up
    // the main thread mid-scroll, a quarter of a scroll's frames late on the emulator)
    tiles.forEach((t) => {
      if (t.state === 'playing' && !playing.has(t)) set(t, 'ready');
      else if (t.state === 'ready' && playing.has(t)) set(t, 'playing');
    });
    return;
  }
  // the ones that let go first, so that their decoders are free for the new ones
  tiles.forEach((t) => { if (!playing.has(t) && !ready.has(t)) set(t, 'off'); });
  playing.forEach((t) => set(t, 'playing'));
  ready.forEach((t) => set(t, 'ready'));
  prefetchPreviews(near.filter(([t]) => !ready.has(t)).map(([t]) => t.preview!));
}

// read every tile's place, then decide; a newer round makes an older one count for nothing
function measureAll(moving: boolean) {
  const mine = ++round;
  const list = [...tiles];
  const rects = new Map<Tile, Rect>();
  let left = list.length;
  if (!left) return;
  list.forEach((tile) => tile.measure((x, y, w, h) => {
    if (mine !== round) return;
    if (tiles.has(tile)) rects.set(tile, { x, y, w, h });
    if (--left === 0) decide(rects, moving);
  }));
}

// a look every TICK_MS while things move, and one after they have stopped
function tick() {
  tickTimer = undefined;
  const moving = Date.now() - lastMove < TICK_MS;
  measureAll(moving);
  if (moving) tickTimer = setTimeout(tick, TICK_MS);
}

// something that moves the tiles of the screen in front has happened (a list's onScroll, a pager's page). Cheap enough
// for every scroll event: one timer at a time
export function noteGridMoved() {
  if (!tiles.size) return;
  lastMove = Date.now();
  tickTimer ??= setTimeout(tick, TICK_MS);
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
    lastRects.delete(tile);
    noteGridMoved(); // one that played makes room for another
    if (tiles.size) return;
    clearTimeout(tickTimer);
    tickTimer = undefined;
    round += 1;
    lastRects = new Map();
    unwatch?.();
    unwatch = null;
    appSub?.remove();
    appSub = null;
  };
}
