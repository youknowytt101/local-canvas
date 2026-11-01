// Which tiles were on screen, as Cosmos counts them (module 1391 flushPendingImpressions, module 2646
// useListImpressionTracking; the same rules as cosmos-lite's public/impressions.js, HANDOFF 6.94):
//   - a tile is on screen when at least 1 % of it is (viewabilityConfig itemVisiblePercentThreshold: 1) and its picture
//     has loaded (startWhen 'media-ready'; a tile with no picture is ready at once)
//   - from then an exposure runs; it counts as an impression once it has lasted QUALIFY_MS: when it ends, or at the
//     check every FLUSH_MS while it runs. One that ends sooner is forgotten
//   - an impression is { clientName, targetType, targetId, userInteractionSource, slateId }; one already waiting to be
//     sent is not added again, and no exposure starts for it
//   - waiting ones go out FLUSH_MS after the first, or at once when BATCH_MAX are waiting, over the hub as
//     RecordImpressionsBatch; while the hub is not connected as the GraphQL mutation RecordImpressions (local). One that
//     fails is tried again later (RETRY_MS)
//   - when the app goes to the background every exposure ends and what is waiting goes out
//   - a list may count a tile once per stretch on screen (countOncePerVisibilityStint), and may be switched off
//     (For You until its first page has come from the server)
import { AppState, Platform } from 'react-native';
import { gql } from './auth';
import { hubConnected, invoke, startHub } from './hub';

const QUALIFY_MS = 1000;
const FLUSH_MS = 2000;
const BATCH_MAX = 50;
const RETRY_MS = [2000, 5000, 10000, 30000];
const PENDING_MAX = 1000;
const CLIENT = Platform.OS; // Cosmos' normalizeImpression: the client's name

export type Impression = { targetType: 'Element' | 'Cluster' | 'User'; targetId: string; userInteractionSource: string; slateId?: string | null };
type Normalized = { clientName: string; targetType: string; targetId: string; userInteractionSource: string; slateId: string | null };

const pending = new Map<string, Normalized>();
const active = new Map<number, { impression: Normalized; startedAtMs: number }>();
let seq = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let exposureTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let sending = false;

const keyOf = (i: Normalized) => JSON.stringify([i.targetType, i.targetId, i.userInteractionSource, i.slateId]);
function normalize(i: Impression): Normalized | null {
  const id = String(i.targetId ?? '').trim();
  if (!i.targetType || !id) return null;
  const slate = typeof i.slateId === 'string' ? i.slateId.trim() : '';
  return { clientName: CLIENT, targetType: i.targetType, targetId: id, userInteractionSource: i.userInteractionSource || 'Unspecified', slateId: slate || null };
}

function scheduleFlush(ms = FLUSH_MS) {
  if (flushTimer || !pending.size) return;
  flushTimer = setTimeout(() => { flushTimer = null; void flushImpressions(); }, ms);
}
function queue(i: Normalized) {
  const key = keyOf(i);
  if (pending.has(key)) return;
  pending.set(key, i);
  if (pending.size > PENDING_MAX) pending.delete(pending.keys().next().value!);
  if (pending.size >= BATCH_MAX && !sending) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    void flushImpressions();
  } else scheduleFlush();
}
function promote(now: number) {
  for (const [token, e] of active) {
    if (now - e.startedAtMs < QUALIFY_MS) continue;
    active.delete(token);
    queue(e.impression);
  }
}
function scheduleExposureCheck() {
  if (exposureTimer || !active.size) return;
  const check = () => {
    exposureTimer = null;
    promote(Date.now());
    void flushImpressions();
    if (active.size) exposureTimer = setTimeout(check, FLUSH_MS);
  };
  exposureTimer = setTimeout(check, FLUSH_MS);
}

function startExposure(impression: Impression): number | null {
  const i = normalize(impression);
  if (!i || pending.has(keyOf(i))) return null;
  const token = ++seq;
  active.set(token, { impression: i, startedAtMs: Date.now() });
  scheduleExposureCheck();
  return token;
}
function endExposure(token: number) {
  const e = active.get(token);
  if (!e) return;
  active.delete(token);
  if (Date.now() - e.startedAtMs >= QUALIFY_MS) queue(e.impression);
}
function endAllExposures() {
  if (exposureTimer) clearTimeout(exposureTimer);
  exposureTimer = null;
  for (const token of [...active.keys()]) endExposure(token);
  for (const list of lists) list.forgetStretches();
}

// a list stopped scrolling: what has lasted long enough goes now (handleImpressionScrollEnd)
export function impressionsScrollEnded() {
  if (exposureTimer) clearTimeout(exposureTimer);
  exposureTimer = null;
  promote(Date.now());
  void flushImpressions();
  scheduleExposureCheck();
}

export async function flushImpressions() {
  if (!pending.size || sending) return;
  const items = [...pending.values()];
  pending.clear();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  sending = true;
  try {
    for (let i = 0; i < items.length; i += 200) {
      const batch = items.slice(i, i + 200);
      if (hubConnected()) await invoke('RecordImpressionsBatch', batch);
      else await gql('mutation', 'RecordImpressions', 'recordImpressions', { input: { items: batch } });
    }
    failures = 0;
  } catch {
    void startHub();
    for (const i of items) if (!pending.has(keyOf(i))) pending.set(keyOf(i), i);
    scheduleFlush(RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]);
    failures++;
  } finally {
    sending = false;
  }
  if (pending.size >= BATCH_MAX) void flushImpressions();
}

AppState.addEventListener('change', (s) => {
  if (s === 'active') {
    for (const list of lists) list.restart();
    return;
  }
  endAllExposures();
  void flushImpressions();
});

const lists = new Set<ListImpressions<any>>(); // eslint-disable-line @typescript-eslint/no-explicit-any

// The tiles of one list, by key. The list says which keys are on screen (setVisible, from FlashList's
// onViewableItemsChanged) and when a tile's picture is ready (markMediaReady).
export class ListImpressions<T> {
  private visible = new Map<string, T>();
  private ready = new Set<string>();
  private running = new Map<string, number[]>();
  private counted = new Set<string>(); // countOnce: counted in this stretch on screen

  constructor(private build: (item: T) => Impression | Impression[] | null, private countOnce = false, private enabled = true) {
    lists.add(this);
  }

  setVisible(items: [string, T][]) {
    const now = new Map(items);
    for (const key of [...this.visible.keys()]) {
      if (now.has(key)) continue;
      this.visible.delete(key);
      this.counted.delete(key);
      this.end(key);
    }
    for (const [key, item] of now) {
      if (this.visible.has(key)) continue;
      this.visible.set(key, item);
      this.start(key);
    }
  }

  markMediaReady(key: string) {
    if (this.ready.has(key)) return;
    this.ready.add(key);
    if (this.visible.has(key)) this.start(key);
  }

  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) for (const key of this.visible.keys()) this.start(key);
    else {
      for (const key of [...this.running.keys()]) this.end(key);
      this.counted.clear();
    }
  }

  // the list starts again (new data): forget every tile
  reset() {
    for (const key of [...this.running.keys()]) this.end(key);
    this.visible.clear();
    this.ready.clear();
    this.counted.clear();
  }

  dispose() {
    this.reset();
    lists.delete(this);
  }

  forgetStretches() {
    this.running.clear();
    this.counted.clear();
  }

  restart() {
    for (const key of this.visible.keys()) this.start(key);
  }

  private start(key: string) {
    if (!this.enabled || this.running.has(key) || !this.ready.has(key)) return;
    if (this.countOnce && this.counted.has(key)) return;
    const built = this.build(this.visible.get(key)!);
    const tokens = built == null ? [] : (Array.isArray(built) ? built : [built]).map(startExposure).filter((t): t is number => t != null);
    this.running.set(key, tokens);
    if (this.countOnce) this.counted.add(key);
  }

  private end(key: string) {
    const tokens = this.running.get(key);
    if (!tokens) return;
    this.running.delete(key);
    for (const t of tokens) endExposure(t);
  }
}
