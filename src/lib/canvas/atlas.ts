// The canvas' pictures, as Cosmos keeps them (useInfiniteCanvasRenderState, useAtlasPages, getAtlasPageReusePlan,
// buildAtlasGenerationPages, packAtlasItems, atlasTextureTs3, yieldToJs's loadSkImage; the web page's board.js /
// board-gl.js, HANDOFF 6.35 / 6.113 / 6.130):
//   - what is asked for: the cards inside the screen (no padding), the focused one first, then by distance from the middle
//     of the screen, one per element, at most PRIORITY_ATLAS_ITEM_COUNT; the first REVEAL_REQUIRED_ITEM_COUNT hold the
//     reveal. A change while the canvas is in use waits IMAGE_REQUEST_DEBOUNCE_MS (each new change starts it again).
//   - each request is a generation (a newer one cancels it): the batches holding the focus-locked card are kept, the
//     other batches holding something wanted are kept, the useless ones too up to REUSABLE_PAGE_COUNT, the rest let go;
//     what is missing loads nearest first, 12 to a batch and 12 batches at a time, then 6 to a batch and 2 at a time,
//     then once more for what did not come; a batch loads ATLAS_IMAGE_CONCURRENCY pictures at a time and shows all at
//     once. A picture tries its first URL only, gives up after ATLAS_IMAGE_LOAD_TIMEOUT_MS (that URL is left alone for
//     IMAGE_FAILURE_SUPPRESS_MS), and stops being waited for when its generation is cancelled.
//   - a batch is drawn into textures: sprites ATLAS_SPRITE_WIDTH wide in the card's shape, the picture cover-cropped into
//     it and its corners clipped (borderRadius.element × sprite width / card width), packed in rows ATLAS_PADDING apart
//     into textures at most ATLAS_MAX_SIZE square.
import { ClipOp, Skia, type SkImage, type SkRect } from '@shopify/react-native-skia';
import { absoluteUrl } from '../server';
import { CANVAS as C } from './constants';

export type AtlasRequestItem = { key: string; urls: string[]; ratio: number };
export type AtlasTexture = { id: number; image: SkImage };
export type AtlasSprite = { texture: AtlasTexture; rect: SkRect };
type Batch = { id: number; sprites: Map<string, AtlasSprite>; textures: AtlasTexture[] };
type Request = { items: AtlasRequestItem[]; required: number; layoutSignature: string; signature: string };

const failures = new Map<string, number>(); // url -> retry after
const isSuppressed = (url: string) => (failures.get(url) ?? 0) > Date.now();
let serial = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function loadImage(url: string, isCancelled: () => boolean): Promise<SkImage | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (img: SkImage | null, timedOut = false) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (img) failures.delete(url);
      else if (timedOut) failures.set(url, Date.now() + C.IMAGE_FAILURE_SUPPRESS_MS);
      resolve(img);
    };
    const timer = setTimeout(() => finish(null, true), C.ATLAS_IMAGE_LOAD_TIMEOUT_MS);
    const poll = setInterval(() => { if (isCancelled()) finish(null); }, C.ATLAS_IMAGE_CANCEL_POLL_MS);
    Skia.Data.fromURI(absoluteUrl(url))
      .then((data) => finish(Skia.Image.MakeImageFromEncoded(data)))
      .catch(() => finish(null));
  });
}

async function loadItem(item: AtlasRequestItem, isCancelled: () => boolean) {
  for (const url of item.urls.filter((u) => !isSuppressed(u)).slice(0, C.ATLAS_IMAGE_CANDIDATE_LIMIT)) {
    if (isCancelled()) return null;
    const img = await loadImage(url, isCancelled);
    if (img) return img;
  }
  return null;
}

async function mapWithConcurrency<T, R>(list: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// packAtlasItems + atlasTextureTs3: rows of sprites into textures; a picture is cover-cropped into its sprite (getCoverRect)
function drawBatch(entries: { key: string; img: SkImage; ratio: number }[], radius: number): Batch {
  const W = C.ATLAS_SPRITE_WIDTH;
  const P = C.ATLAS_PADDING;
  const MAX = C.ATLAS_MAX_SIZE;
  type Placed = { key: string; img: SkImage; x: number; y: number; w: number; h: number };
  const pages: Placed[][] = [[]];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const e of entries) {
    const h = Math.min(MAX, Math.round(W / (e.ratio || 1)));
    if (x + W > MAX) { x = 0; y += rowH + P; rowH = 0; }
    if (y + h > MAX) { pages.push([]); x = 0; y = 0; rowH = 0; }
    pages[pages.length - 1].push({ key: e.key, img: e.img, x, y, w: W, h });
    x += W + P;
    rowH = Math.max(rowH, h);
  }
  const batch: Batch = { id: ++serial, sprites: new Map(), textures: [] };
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  for (const placed of pages) {
    if (!placed.length) continue;
    const width = Math.max(...placed.map((p) => p.x + p.w));
    const height = Math.max(...placed.map((p) => p.y + p.h));
    const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
    if (!surface) continue;
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    for (const p of placed) {
      const dst = Skia.XYWHRect(p.x, p.y, p.w, p.h);
      const iw = p.img.width();
      const ih = p.img.height();
      const scale = Math.max(p.w / iw, p.h / ih);
      const sw = p.w / scale;
      const sh = p.h / scale;
      const src = Skia.XYWHRect((iw - sw) / 2, (ih - sh) / 2, sw, sh);
      canvas.save();
      canvas.clipRRect(Skia.RRectXY(dst, radius, radius), ClipOp.Intersect, true);
      canvas.drawImageRect(p.img, src, dst, paint);
      canvas.restore();
    }
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    // drawn on the canvas' own thread: a copy that is not tied to this surface's GPU context
    const image = snapshot.makeNonTextureImage() ?? snapshot;
    const texture = { id: ++serial, image };
    batch.textures.push(texture);
    for (const p of placed) batch.sprites.set(p.key, { texture, rect: Skia.XYWHRect(p.x, p.y, p.w, p.h) });
  }
  return batch;
}

// one canvas' pictures; onChange is called whenever what is loaded changes
export class CanvasAtlas {
  private batches: Batch[] = []; // the newest first
  private retained: Batch[] = [];
  loaded = new Map<string, AtlasSprite>();
  private request: Request | null = null;
  private pendingRequest: Request | null = null;
  private complete: Request | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private drawChain: Promise<void> = Promise.resolve();
  private disposed = false;
  radius = 0;
  version = 0;

  constructor(private onChange: () => void) {}

  dispose() {
    this.disposed = true;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.batches = [];
    this.retained = [];
    this.loaded = new Map();
  }

  // a new dataset: what is loaded stays until something else is wanted
  reset() {
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.request = null;
    this.pendingRequest = null;
    this.complete = null;
  }

  // the reveal waits for the first REVEAL_REQUIRED_ITEM_COUNT pictures (or for the whole request to be over)
  isRevealReady() {
    const req = this.request;
    if (!req) return false;
    return this.complete === req || req.items.slice(0, req.required).every((i) => this.loaded.has(i.key));
  }

  // atlasReadyForReveal for a layout: the request in force is this layout's (none is waiting for its debounce) and its
  // first REVEAL_REQUIRED_ITEM_COUNT pictures are in
  isReadyFor(layoutSignature: string) {
    return !this.pendingRequest && this.request?.layoutSignature === layoutSignature && this.isRevealReady();
  }

  ask(items: AtlasRequestItem[], layoutSignature: string, lockKey: string | null) {
    const req: Request = {
      items,
      required: Math.min(C.REVEAL_REQUIRED_ITEM_COUNT, items.length),
      layoutSignature,
      signature: `${layoutSignature}:${items.map((i) => i.key).join('|')}`,
    };
    const prev = this.pendingRequest ?? this.request;
    if (prev && prev.signature === req.signature && prev.required === req.required) return;
    if (this.timer) clearTimeout(this.timer);
    this.pendingRequest = req;
    const now = () => { this.pendingRequest = null; void this.start(req, lockKey); };
    if (this.request?.items.length && this.request.layoutSignature === req.layoutSignature && req.items.length) {
      this.timer = setTimeout(now, C.IMAGE_REQUEST_DEBOUNCE_MS);
    } else now();
  }

  private sync() {
    const loaded = new Map<string, AtlasSprite>();
    for (const b of [...this.retained, ...this.batches]) for (const [k, s] of b.sprites) if (!loaded.has(k)) loaded.set(k, s);
    this.loaded = loaded;
    this.version++;
    if (!this.disposed) this.onChange();
  }

  private async start(req: Request, lockKey: string | null) {
    this.request = req;
    const generation = ++this.generation;
    const isCancelled = () => this.generation !== generation || this.disposed;
    const wanted = new Set(req.items.map((i) => i.key));
    const all = [...new Set([...this.batches, ...this.retained])];
    const retained = lockKey ? all.filter((b) => b.sprites.has(lockKey)) : [];
    // the batches kept for a lock that has gone are reused as any other (the locked card's picture stays put)
    const free = all.filter((b) => !retained.includes(b));
    const useful = free.filter((b) => [...b.sprites.keys()].some((k) => wanted.has(k)));
    const useless = free.filter((b) => !useful.includes(b));
    this.retained = retained;
    this.batches = [...useful, ...useless].slice(0, Math.max(C.REUSABLE_PAGE_COUNT, useful.length));
    this.sync();
    const missing = () => req.items.filter((i) => !this.loaded.has(i.key));
    const first = missing();
    if (first.length) {
      await Promise.all([
        this.build(first.slice(0, C.PRIORITY_ATLAS_ITEM_COUNT), C.PRIORITY_IMAGE_ATLAS_PAGE_ITEM_LIMIT, C.PRIORITY_ATLAS_IMAGE_PAGE_CONCURRENCY, isCancelled),
        this.build(first.slice(C.PRIORITY_ATLAS_ITEM_COUNT), C.BACKGROUND_IMAGE_ATLAS_PAGE_ITEM_LIMIT, C.BACKGROUND_ATLAS_IMAGE_PAGE_CONCURRENCY, isCancelled),
      ]);
      const again = isCancelled() ? [] : missing();
      if (again.length) await this.build(again, C.BACKGROUND_IMAGE_ATLAS_PAGE_ITEM_LIMIT, C.BACKGROUND_ATLAS_IMAGE_PAGE_CONCURRENCY, isCancelled);
    }
    if (!isCancelled()) {
      this.complete = req;
      this.onChange();
    }
  }

  private async build(items: AtlasRequestItem[], perBatch: number, concurrency: number, isCancelled: () => boolean) {
    if (!items.length) return;
    await mapWithConcurrency(chunk(items, perBatch), concurrency, async (batchItems) => {
      if (isCancelled()) return;
      const imgs = await mapWithConcurrency(batchItems, C.ATLAS_IMAGE_CONCURRENCY, (it) => loadItem(it, isCancelled));
      if (isCancelled()) return;
      const entries = batchItems.map((it, i) => (imgs[i] ? { key: it.key, img: imgs[i]!, ratio: it.ratio } : null)).filter((e): e is { key: string; img: SkImage; ratio: number } => !!e);
      if (!entries.length) return;
      // withSerializedAtlasDraw: one batch drawn at a time, each in a turn of its own (yieldToJs)
      const run = this.drawChain.then(async () => {
        if (isCancelled()) return;
        const batch = drawBatch(entries, this.radius);
        this.batches = [batch, ...this.batches];
        this.sync();
        await sleep(0);
      });
      this.drawChain = run.catch(() => undefined);
      await run;
    });
  }
}
