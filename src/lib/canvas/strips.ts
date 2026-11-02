// The strips of frames the canvas loops on its videos (cosmos-lite's derive.js makeStrip): a few loaded at a time, the
// ones last asked for kept. A strip is one texture and no decoder, so a whole screen of videos can move at once.
import { Skia, type SkImage } from '@shopify/react-native-skia';
import { absoluteUrl } from '../server';

const LOADING_AT_ONCE = 3;
const DISPOSE_DELAY_MS = 2000; // a frame being drawn may still hold it

export class StripCache {
  private images = new Map<string, SkImage>(); // the last asked for at the end
  private failed = new Set<string>();
  private loading = new Set<string>();
  private wanted: string[] = [];

  constructor(private readonly limit: number, private readonly onChange: () => void) {}

  get(url: string) {
    return this.images.get(url) ?? null;
  }

  ask(urls: string[]) {
    this.wanted = urls;
    for (const url of urls) {
      const image = this.images.get(url);
      if (!image) continue;
      this.images.delete(url);
      this.images.set(url, image);
    }
    while (this.images.size > Math.max(this.limit, urls.length)) {
      const [oldest, image] = this.images.entries().next().value as [string, SkImage];
      this.images.delete(oldest);
      setTimeout(() => image.dispose(), DISPOSE_DELAY_MS);
    }
    this.pump();
  }

  private pump() {
    for (const url of this.wanted) {
      if (this.loading.size >= LOADING_AT_ONCE) return;
      if (this.images.has(url) || this.loading.has(url) || this.failed.has(url)) continue;
      this.loading.add(url);
      Skia.Data.fromURI(absoluteUrl(url))
        .then((data) => {
          const image = Skia.Image.MakeImageFromEncoded(data);
          if (image) {
            this.images.set(url, image);
            this.onChange();
          } else this.failed.add(url);
        })
        .catch(() => { this.failed.add(url); })
        .finally(() => {
          this.loading.delete(url);
          this.pump();
        });
    }
  }

  dispose() {
    const all = [...this.images.values()];
    this.images.clear();
    this.wanted = [];
    setTimeout(() => all.forEach((image) => image.dispose()), DISPOSE_DELAY_MS);
  }
}
