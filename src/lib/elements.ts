// An element as the server hands it out (cosmos-lite lib/search.js toView, the fields this app reads), and which
// picture a grid tile loads.
//
// Cosmos asks its image server for what a tile needs: withGridSizeParams(url, tile width, imageScale) =
// round(tile width × imageScale) pixels, never wider than the picture (getResizedElement, modules 2460 / 1728), with
// imageScale FEED_IMAGE_SCALE (1.5) on For You, in collections and in Following's carousels, and 2 where a grid sets
// none. The computer has copies made ahead (400 and 800 px, derive.js) and makes one for the width asked
// (/img/<file>?w=, up to SIZED_MAX); the tile takes the narrowest that is wide enough, else the widest (the web page's
// fittingCopy, the same rule). A GIF's tile shows its still at max(120, round(tile width × pixel ratio))
// (getAnimatedImageThumbnailUrl).
import { PixelRatio } from 'react-native';
import { absoluteUrl } from './server';

export type NsfwStatus = 'Explicit' | 'Suggestive' | 'Pending' | 'Unclassified';
export type Element = {
  id: string;
  type: string; // image, video, note, link, …
  title?: string;
  text?: string;
  mediaKind?: 'image' | 'video' | null;
  mediaUrl?: string | null;
  width?: number | null;
  height?: number | null;
  thumbUrl?: string | null;
  thumbWidth?: number | null;
  smallUrl?: string | null;
  smallWidth?: number | null;
  posterUrl?: string | null;
  posterWidth?: number | null;
  posterThumbUrl?: string | null;
  posterThumbWidth?: number | null;
  posterSmallUrl?: string | null;
  posterSmallWidth?: number | null;
  previewUrl?: string | null;
  videoStrip?: { url: string; frames: number; cols: number; rows: number; fps: number } | null; // the canvas' loop (derive.js makeStrip)
  mp4Url?: string | null;
  animated?: boolean;
  blurHash?: string | null;
  color?: string | null;
  embed?: { provider: string; shape?: string } | null;
  nsfw?: { status: NsfwStatus; treatment: 'show' | 'blur' | 'hide' } | null;
  slateId?: string | null;
  sourceUrl?: string | null;
  description?: string | null;
  ai?: { caption?: string | null } | null;
  isConnectedByUser?: boolean;
  isUserPublicElement?: boolean;
  numberOfConnectedUsers?: number;
};

export const FEED_IMAGE_SCALE = 1.5;
export const GRID_IMAGE_SCALE = 2;
const SIZED_MAX = 1600;

// a tile's width / height, clamped to [0.3, 3.33] (Cosmos' getCanvasAspectRatio, the web page's tileRatio)
export const tileRatio = (w?: number | null, h?: number | null) => (w && h ? Math.min(10 / 3, Math.max(0.3, w / h)) : 1);

type Copy = { url?: string | null; width?: number | null };

function fittingCopy(copies: Copy[], want: number): string | null {
  const have = copies.filter((c): c is { url: string; width: number } => !!c.url).map((c) => ({ url: c.url, width: c.width ?? Infinity }))
    .sort((a, b) => a.width - b.width);
  return (have.find((c) => c.width >= want) ?? have[have.length - 1])?.url ?? null;
}

// the copy the computer makes for the width (none for a picture no wider than it, or one not stored there)
function sizedCopy(url: string | null | undefined, fullWidth: number | null | undefined, want: number): Copy[] {
  const file = /^\/media\/([0-9a-f]{40}\.(?:png|jpg|gif|webp))$/.exec(url ?? '')?.[1];
  const width = Number.isFinite(want) ? Math.min(SIZED_MAX, Math.max(1, Math.round(want))) : null;
  return file && width && (fullWidth ?? 0) > width ? [{ url: `/img/${file}?w=${width}`, width }] : [];
}

const imageCopies = (el: Element, want: number): Copy[] => [
  { url: el.smallUrl, width: el.smallWidth },
  { url: el.thumbUrl, width: el.thumbWidth },
  ...(el.thumbUrl ? [] : [{ url: el.mediaUrl, width: el.width ?? Infinity }]),
  ...(el.animated ? [] : sizedCopy(el.mediaUrl, el.width, want)),
];
const posterCopies = (el: Element, want: number): Copy[] => [
  { url: el.posterSmallUrl, width: el.posterSmallWidth },
  { url: el.posterThumbUrl, width: el.posterThumbWidth },
  ...(el.posterThumbUrl ? [] : [{ url: el.posterUrl, width: el.width ?? Infinity }]),
  ...sizedCopy(el.posterUrl, el.posterWidth ?? el.width, want),
];

// the picture a tile of `tileWidth` shows: a video's cover, a GIF's still, else the image; null when there is none
export function tileImageUrl(el: Element, tileWidth: number, imageScale: number): string | null {
  let url: string | null;
  if (el.mediaKind === 'video') {
    const want = Math.round(tileWidth * imageScale);
    url = fittingCopy(posterCopies(el, want), want) ?? el.posterUrl ?? null;
  } else if (el.animated) {
    const want = Math.max(120, Math.round(tileWidth * PixelRatio.get()));
    url = fittingCopy([...imageCopies(el, want).filter((c) => c.url !== el.mediaUrl), ...sizedCopy(el.mediaUrl, el.width, want)], want) ?? el.mediaUrl ?? null;
  } else {
    const want = Math.round(tileWidth * imageScale);
    url = fittingCopy(imageCopies(el, want), want) ?? el.mediaUrl ?? null;
  }
  return url ? absoluteUrl(url) : null;
}

// the original, for when a copy does not load
export const originalImageUrl = (el: Element) => {
  const url = el.mediaKind === 'video' ? el.posterUrl : el.mediaUrl;
  return url ? absoluteUrl(url) : null;
};

export const NSFW_VEIL: Record<NsfwStatus, string> = { Explicit: '露骨内容', Suggestive: '暗示性内容', Pending: '正在分类…', Unclassified: '没能分类' };

// The viewer's picture, as wide as it is shown at the screen's pixel ratio (Cosmos' getViewerElementMediaImageUrl asks
// its image server for that): the copy that fits, then the others in case one does not load (a copy made for the width
// needs the original on the computer), the original last. A GIF shows itself whole.
export function viewerImageSources(el: Element, displayWidth: number): string[] {
  const want = Math.round(displayWidth * PixelRatio.get());
  const video = el.mediaKind === 'video';
  const copies = video ? posterCopies(el, want) : el.animated ? [] : imageCopies(el, want);
  const first = fittingCopy(copies, want);
  const rest = video ? [el.posterThumbUrl, el.posterSmallUrl, el.posterUrl] : [el.thumbUrl, el.smallUrl, el.mediaUrl];
  const urls = [el.animated && !video ? el.mediaUrl : first, ...rest].filter((u): u is string => !!u);
  return [...new Set(urls)].map((u) => absoluteUrl(u));
}

// the host a link or an import came from (Cosmos' getLinkFallbackDomain), for the viewer's 访问原站 arrow
export function sourceHost(el: Element): string | null {
  const url = el.sourceUrl;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return m ? m[1].replace(/^www\./, '') : null;
}
