// The canvas world: where each card sits and which element a copy of it shows. Cosmos' buildCanvasLayout,
// buildCanvasLayoutPage, shouldPreserveLayoutSlots, getLayoutItemCount, getElementIndexForSource, getAtlasHeight,
// getVisibleCanvasInstances, getColumnStagger and createCanvasItemInstance (lib/elements/, read off the Hermes bundle;
// the web page's public/board.js, HANDOFF 6.33–6.35):
//   CANVAS_COLUMN_COUNT columns of one width: at scale 1, VISIBLE_COLUMN_COUNT cards and their gaps fill the screen. Only
//   the first CANVAS_PAGE_SIZE elements are laid out: slot i goes to column order[i % C], the order running from the
//   middle column outwards (4, 5, 3, 6, 2, …); a column stacks its slots WORLD_GAP apart. There are
//   max(n, C × 4, focusSourceIndex + 1) slots; slot i shows element i % n, except the focus slot, which shows the focus
//   element.
//   A new dataset at the same width (a new seed) keeps every slot where it was and as big as it was, and each column at
//   least as tall (shouldPreserveLayoutSlots), so nothing moves; the new elements are cropped into the old slots.
//   The layout repeats every cycleWidth sideways and every column on its own every cycleHeight downwards; a sideways
//   repeat rx is pushed down by cycleHeight × (rx mod 7) / 7 so the copies do not line up. The middle copy (ring 0) shows
//   the first page; ring k = max(|rx|, |ry|) shows page 1 + (k − 1) mod (pages − 1), so the later pages fill the copies
//   further out. A copy keeps the element it was first given while that element is still loaded (render slot cache).
//   A card's picture is drawn in its slot's shape (atlasHeight = ATLAS_SPRITE_WIDTH / the slot's width-to-height,
//   cover-cropped), so the atlas key is the element and that height.
import type { Element } from '../elements';
import { tileRatio } from '../elements';
import { CANVAS as C } from './constants';

export type CanvasDataset = {
  key: string;
  elements: Element[];
  focusElementIndex: number | null;
  focusSourceIndex: number | null;
  prefetch: boolean; // not a similar canvas: loads pages ahead (useInfiniteCanvasPagination)
};
export type LayoutItem = { key: string; sourceIndex: number; elementIndex: number; elementId: string; x: number; y: number; width: number; height: number; atlasHeight: number };
type Column = { index: number; x: number; width: number; cycleHeight: number; items: LayoutItem[] };
export type CanvasLayout = {
  signature: string;
  datasetKey: string;
  W: number;
  H: number;
  cols: number;
  cardWidth: number;
  stride: number;
  layoutElementCount: number;
  layoutElementIds: string[];
  renderElements: Element[];
  items: LayoutItem[];
  columns: Column[];
  cycleWidth: number;
  minX: number;
  maxX: number;
  initialWorldCenterX: number;
  initialWorldCenterY: number;
};
export type CanvasInstance = {
  key: string;
  item: LayoutItem;
  element: Element;
  elementIndex: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  ordinal: number;
};
export type Camera = { x: number; y: number; s: number };
export type SlotCache = Map<string, { elementId: string; index: number }>;

const STAGGER = 7; // getColumnStagger
const MAX_INSTANCES = 1200; // a guard at MIN_SCALE (not in the app)
const mod = (a: number, n: number) => ((a % n) + n) % n;

export const cardRatio = (el: Element) => {
  if (el.mediaKind === 'video') return tileRatio(el.width ?? el.posterWidth, el.height);
  return tileRatio(el.width, el.height);
};

// getElementIdsHash (FNV-1a)
function hashIds(ids: string[]) {
  let h = 2166136261;
  for (const id of ids) {
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    h = Math.imul(h ^ id.length, 16777619);
  }
  return (h >>> 0).toString(36);
}

function metrics(W: number, H: number) {
  const V = C.VISIBLE_COLUMN_COUNT;
  const cols = C.COLUMN_COUNT;
  const cardWidth = (W - V * C.WORLD_GAP) / V;
  const stride = cardWidth + C.WORLD_GAP;
  const mid = Math.floor(cols / 2);
  const order = [mid];
  for (let i = 1; i <= mid; i++) order.push(mid + i, mid - i);
  return { W, H, cols, cardWidth, stride, firstX: -mid * stride - cardWidth / 2, mid, order: order.filter((c) => c >= 0 && c < cols) };
}

// getAtlasHeight
export const atlasHeightFor = (ratio: number) => Math.max(1, Math.round(C.ATLAS_SPRITE_WIDTH / ratio));
export const atlasKey = (elementId: string, atlasHeight: number) => `${elementId}:${atlasHeight}`;

// buildCanvasLayout: the same layout with the newly loaded elements when only those changed (canReuseLayout:
// the same dataset, width, focus and first-page ids), else a new one, keeping the old slots when the width is the same
export function buildLayout(d: CanvasDataset, W: number, H: number, previous: CanvasLayout | null): CanvasLayout {
  const m = metrics(W, H);
  const layoutEls = d.elements.slice(0, C.PAGE_SIZE);
  const renderEls = d.elements.slice(0, C.MAX_RENDER_ELEMENTS);
  const ids = layoutEls.map((e) => String(e.id));
  const signature = `${d.key}:${Math.round(W)}:${ids.length}:${hashIds(ids)}:${d.focusElementIndex ?? ''}:${d.focusSourceIndex ?? ''}`;
  if (previous && previous.signature === signature) return { ...previous, renderElements: renderEls };
  const keep = previous && Math.round(previous.W) === Math.round(W) ? previous : null; // shouldPreserveLayoutSlots
  const prevItems = new Map((keep?.items ?? []).map((it) => [it.sourceIndex, it]));
  const prevColumns = new Map((keep?.columns ?? []).map((c) => [c.index, c]));
  const n = layoutEls.length;
  const count = n ? Math.max(n, m.cols * 4, d.focusSourceIndex != null ? d.focusSourceIndex + 1 : 0) : 0;
  const slots: number[][] = Array.from({ length: m.cols }, () => []);
  for (let i = 0; i < count; i++) slots[m.order[i % m.order.length] ?? 0].push(i);
  const items: LayoutItem[] = [];
  const columns: Column[] = [];
  slots.forEach((sourceIndices, index) => {
    const colX = m.firstX + index * m.stride;
    let y = 0;
    const colItems: LayoutItem[] = [];
    for (const sourceIndex of sourceIndices) {
      const fe = d.focusElementIndex;
      const elementIndex = sourceIndex === d.focusSourceIndex && fe != null && fe < n ? fe : sourceIndex % n;
      const el = layoutEls[elementIndex];
      const prev = prevItems.get(sourceIndex);
      const width = prev?.width ?? m.cardWidth;
      const height = prev?.height ?? width / (cardRatio(el) || 1);
      const itemY = prev?.y ?? y;
      const it = {
        key: `${el.id}:${sourceIndex}`, sourceIndex, elementIndex, elementId: el.id,
        x: prev?.x ?? colX, y: itemY, width, height, atlasHeight: atlasHeightFor(width / height),
      };
      colItems.push(it);
      items.push(it);
      y = Math.max(y, itemY + height + C.WORLD_GAP);
    }
    columns.push({ index, x: prevColumns.get(index)?.x ?? colX, width: m.cardWidth, cycleHeight: Math.max(prevColumns.get(index)?.cycleHeight ?? 0, y, 1), items: colItems });
  });
  for (const c of columns) c.items.sort((a, b) => a.y - b.y);
  const focusItem = d.focusSourceIndex != null ? items.find((it) => it.sourceIndex === d.focusSourceIndex) : null;
  const minX = m.firstX;
  const maxX = m.firstX + (m.cols - 1) * m.stride + m.cardWidth;
  const middle = columns.find((c) => c.index === m.mid);
  return {
    signature,
    datasetKey: d.key,
    W, H,
    cols: m.cols,
    cardWidth: m.cardWidth,
    stride: m.stride,
    layoutElementCount: n,
    layoutElementIds: ids,
    renderElements: renderEls,
    items,
    columns,
    cycleWidth: m.cols * m.stride,
    minX,
    maxX,
    initialWorldCenterX: focusItem ? focusItem.x + focusItem.width / 2 : (minX + maxX) / 2,
    // getInitialWorldCenterY: half way down the middle column
    initialWorldCenterY: focusItem ? focusItem.y + focusItem.height / 2 : (middle?.cycleHeight ?? 0) / 2,
  };
}

// createCanvasItemInstance: which loaded element a copy of a slot shows
export function createInstance(L: CanvasLayout, d: CanvasDataset, cache: SlotCache, item: LayoutItem, x: number, y: number, rx: number, ry: number): CanvasInstance | null {
  const els = L.renderElements;
  const total = els.length;
  if (!total) return null;
  const per = Math.max(L.layoutElementCount, 1);
  const ring = Math.max(Math.abs(rx), Math.abs(ry));
  const dir = Math.abs(rx) >= Math.abs(ry) ? (rx >= 0 ? 0 : 2) : (ry >= 0 ? 1 : 3);
  const ordinal = ring ? (ring - 1) * 4 + dir + 1 : 0;
  const fe = d.focusElementIndex;
  let index: number | null = null;
  if (item.sourceIndex === d.focusSourceIndex && fe != null && fe >= 0 && fe < total) index = fe;
  if (index == null) {
    const slotKey = `${item.sourceIndex}:${rx}:${ry}`;
    const kept = cache.get(slotKey);
    if (kept && els[kept.index]?.id === kept.elementId) index = kept.index;
    else {
      if (kept) cache.delete(slotKey);
      const pages = Math.max(Math.ceil(total / per), 1);
      let page = 0;
      if (pages > 1 && ordinal) page = 1 + mod(Math.floor((ordinal - 1) / 4), pages - 1);
      const base = page * per;
      const inPage = Math.max(0, Math.min(per, total - base));
      index = inPage ? base + mod(item.elementIndex, inPage) : mod(item.elementIndex, total);
      cache.set(slotKey, { elementId: els[index].id, index });
      if (cache.size > C.RENDER_SLOT_CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    }
  }
  const element = els[index];
  return { key: `${item.key}:${element.id}:${rx}:${ry}`, item, element, elementIndex: index, x, y, rx, ry, ordinal };
}

// getVisibleCanvasInstances: the copies of the slots near the screen (padded by VIEWPORT_PADDING_RATIO on each side)
export function visibleInstances(L: CanvasLayout, d: CanvasDataset, cache: SlotCache, cam: Camera, W: number, H: number): CanvasInstance[] {
  const out: CanvasInstance[] = [];
  if (!L.items.length) return out;
  const { x: px, y: py, s } = cam;
  const x0w = -px / s;
  const x1w = (W - px) / s;
  const y0w = -py / s;
  const y1w = (H - py) / s;
  const padX = (x1w - x0w) * C.VIEWPORT_PADDING_RATIO;
  const padY = (y1w - y0w) * C.VIEWPORT_PADDING_RATIO;
  const x0 = x0w - padX;
  const x1 = x1w + padX;
  const y0 = y0w - padY;
  const y1 = y1w + padY;
  for (let rx = Math.floor((x0 - L.maxX) / L.cycleWidth); rx <= Math.ceil((x1 - L.minX) / L.cycleWidth); rx++) {
    const offX = rx * L.cycleWidth;
    for (const col of L.columns) {
      if (col.x + offX + col.width < x0 || col.x + offX > x1) continue;
      const ch = col.cycleHeight;
      const stagger = (ch * mod(rx, STAGGER)) / STAGGER;
      const its = col.items;
      for (let ry = Math.floor((y0 - stagger) / ch); ry <= Math.ceil((y1 - stagger) / ch); ry++) {
        const base = ry * ch + stagger;
        let lo = 0;
        let hi = its.length;
        while (lo < hi) {
          const midI = (lo + hi) >> 1;
          if (base + its[midI].y + its[midI].height < y0) lo = midI + 1;
          else hi = midI;
        }
        for (let j = lo; j < its.length; j++) {
          const it = its[j];
          const y = base + it.y;
          if (y > y1) break;
          const inst = createInstance(L, d, cache, it, it.x + offX, y, rx, ry);
          if (!inst) continue;
          out.push(inst);
          if (out.length >= MAX_INSTANCES) return out;
        }
      }
    }
  }
  return out;
}

// the camera that puts the layout's start in the middle of the screen at INITIAL_SCALE (getInitialWorldCenterX/Y)
export const homeCamera = (L: CanvasLayout, W: number, H: number): Camera => ({
  x: W / 2 - L.initialWorldCenterX * C.INITIAL_SCALE, y: H / 2 - L.initialWorldCenterY * C.INITIAL_SCALE, s: C.INITIAL_SCALE,
});

// the picture a card is drawn from in the atlas (getElementLayoutInfo's imageUrls, the first that is there: the 400 px
// copy, then the bigger ones; a video's or a GIF's still). None for a note or a link without a picture.
export function canvasImageUrls(el: Element): string[] {
  const urls = el.mediaKind === 'video'
    ? [el.posterSmallUrl, el.posterThumbUrl, el.posterUrl]
    : el.mediaKind === 'image' ? [el.smallUrl, el.thumbUrl, el.mediaUrl] : [];
  return urls.filter((u): u is string => !!u);
}

// toCanvasElements: a link that has no picture (getLinkFallbackDomain) is not put on the canvas
export const toCanvasElements = (els: Element[]) => els.filter((el) => el.type !== 'link' || canvasImageUrls(el).length > 0);
