// Which video tiles of a grid play: the web page's watchVideo / syncPlayback, kept by the person's choice (HANDOFF 6.169;
// Cosmos' grids only draw covers, MasonryGrid's allowVideoPlayback false). The tiles of the screen in front register; a
// little later and every little while their places are read:
//   - something moved (a scroll): the ones playing pause, and nothing new starts
//   - all still: the ones most in the middle with VISIBLE_FRACTION of them on screen play, within each lane's budget
//     (a preview, or the original of a video without one), a few new ones at a time so that a screen of them does not
//     hold everything up at once; the rest let go of their players
// Out of sight (the app in the background) nothing is kept.
import { AppState, Dimensions, Platform } from 'react-native';

export type GridVideoState = 'off' | 'paused' | 'playing';
type Rect = { x: number; y: number; w: number; h: number };
type Tile = { lane: 'preview' | 'original'; measure: (done: (x: number, y: number, w: number, h: number) => void) => void; set: (s: GridVideoState) => void; state: GridVideoState; rect: Rect | null; moved: boolean };

// the emulator's previews decode in software, past its 4 hardware decoders (react-native-video's patch)
export const IS_ANDROID_EMULATOR = Platform.OS === 'android' && /sdk_gphone|generic|emulator/i.test(String((Platform.constants as { Fingerprint?: string }).Fingerprint));
const BUDGET = Platform.OS === 'ios' ? { preview: 8, original: 1 } : IS_ANDROID_EMULATOR ? { preview: 6, original: 1 } : { preview: 4, original: 1 };
const TICK_MS = 150;
const STARTS_PER_TICK = 2;
const VISIBLE_FRACTION = 0.25;

const tiles = new Set<Tile>();
let timer: ReturnType<typeof setInterval> | undefined;

function set(tile: Tile, state: GridVideoState) {
  if (tile.state === state) return;
  tile.state = state;
  tile.set(state);
}

function decide() {
  const { width, height } = Dimensions.get('window');
  if (AppState.currentState !== 'active') {
    tiles.forEach((t) => set(t, 'off'));
    return;
  }
  const list = [...tiles];
  if (list.some((t) => t.moved)) {
    list.forEach((t) => { if (t.state === 'playing') set(t, 'paused'); });
    return;
  }
  const dist = ({ x, y, w, h }: Rect) => (x + w / 2 - width / 2) ** 2 + (y + h / 2 - height / 2) ** 2;
  const shown = ({ x, y, w, h }: Rect) => (w > 0 && h > 0 ? (Math.max(0, Math.min(x + w, width) - Math.max(x, 0)) * Math.max(0, Math.min(y + h, height) - Math.max(y, 0))) / (w * h) : 0);
  const chosen = new Set<Tile>();
  for (const lane of ['preview', 'original'] as const) {
    list.filter((t) => t.lane === lane && t.rect && shown(t.rect) >= VISIBLE_FRACTION)
      .sort((a, b) => dist(a.rect!) - dist(b.rect!))
      .slice(0, BUDGET[lane])
      .forEach((t) => chosen.add(t));
  }
  // the ones that stop go first, so that their decoders are free for the new ones
  list.forEach((t) => { if (!chosen.has(t)) set(t, 'off'); });
  let starts = 0;
  for (const t of chosen) {
    if (t.state === 'off' && starts++ >= STARTS_PER_TICK) continue;
    set(t, 'playing');
  }
}

function tick() {
  decide();
  for (const tile of tiles) {
    tile.measure((x, y, w, h) => {
      const was = tile.rect;
      tile.moved = !!was && (Math.abs(was.x - x) > 1 || Math.abs(was.y - y) > 1);
      tile.rect = { x, y, w, h };
    });
  }
}

// a video tile of the screen in front; the function returned takes it away again
export function watchGridVideo(lane: Tile['lane'], measure: Tile['measure'], setState: Tile['set']) {
  const tile: Tile = { lane, measure, set: setState, state: 'off', rect: null, moved: false };
  tiles.add(tile);
  timer ??= setInterval(tick, TICK_MS);
  return () => {
    tiles.delete(tile);
    if (!tiles.size && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
