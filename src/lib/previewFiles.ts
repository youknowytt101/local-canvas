// The silent previews the grids and the canvas loop (cosmos-lite's derive.js makePreview: a video's first 8 s, 480 px
// wide, no sound, a few hundred KB) are fetched once into the cache directory and played from there. Streamed, every
// loop fetched the clip again (a screen of them kept the Wi-Fi radio busy for as long as they played) and a first frame
// waited on the computer; from a file a loop costs nothing, and a decoder is only taken once there is something for it
// to decode (lib/previewStarts gives turns to previews whose file is here).
//   - AT_ONCE fetched at a time; one a tile is about to play goes before those fetched ahead, and a new list to fetch
//     ahead replaces the entries of the last one still waiting
//   - the least recently played go once the folder passes LIMIT_BYTES (the system may clear the cache directory too)
import { Directory, File, Paths } from 'expo-file-system';

const LIMIT_BYTES = 200 * 1024 * 1024;
const AT_ONCE = 2;

type Kept = { file: File; size: number; used: number };
type Job = { url: string; name: string; resolve: (uri: string) => void; reject: (e: unknown) => void };

let dir: Directory | null = null;
let indexed = false;
const kept = new Map<string, Kept>(); // by file name
let total = 0;
const loading = new Map<string, Promise<string>>(); // by file name
const urgent: Job[] = [];
let ahead: string[] = []; // nearest the middle first
let running = 0;

// cyrb53: a file name for a url
function nameOf(url: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}.mp4`;
}

function folder() {
  if (!dir) {
    dir = new Directory(Paths.cache, 'previews');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function keep(name: string, file: File, used: number) {
  const size = file.size ?? 0;
  kept.set(name, { file, size, used });
  total += size;
}

// what is in the folder from before (once, when the first fetch is done: only trimming needs it)
function index() {
  if (indexed) return;
  indexed = true;
  try {
    for (const entry of folder().list()) {
      if (!(entry instanceof File)) continue;
      if (!entry.name.endsWith('.mp4')) { entry.delete(); continue; } // a fetch the app was closed in
      if (!kept.has(entry.name)) keep(entry.name, entry, entry.modificationTime ?? 0);
    }
  } catch { /* nothing to trim from */ }
}

function trim() {
  index();
  if (total <= LIMIT_BYTES) return;
  for (const [name, k] of [...kept].sort((a, b) => a[1].used - b[1].used)) {
    if (total <= LIMIT_BYTES * 0.8) break;
    try { k.file.delete(); } catch { /* gone already */ }
    kept.delete(name);
    total -= k.size;
  }
}

// the file of this preview, if it is here
export function previewFile(url: string): string | null {
  const name = nameOf(url);
  const k = kept.get(name);
  if (k) {
    if (k.file.exists) { k.used = Date.now(); return k.file.uri; }
    kept.delete(name); // the system cleared it
    total -= k.size;
    return null;
  }
  if (indexed) return null;
  try {
    const file = new File(folder(), name);
    if (!file.exists) return null;
    keep(name, file, Date.now());
    return file.uri;
  } catch {
    return null;
  }
}

// a preview's file would not play: it goes, and is fetched again next time
export function dropPreviewFile(url: string) {
  const name = nameOf(url);
  const k = kept.get(name);
  kept.delete(name);
  if (k) total -= k.size;
  try { new File(folder(), name).delete(); } catch { /* not there */ }
}

async function run(job: Job) {
  running += 1;
  const part = new File(folder(), `${job.name}.part`);
  try {
    await File.downloadFileAsync(job.url, part, { idempotent: true });
    if ((part.size ?? 0) <= 0) throw new Error('empty');
    const file = new File(folder(), job.name);
    if (file.exists) file.delete();
    part.moveSync(file);
    const done = new File(folder(), job.name);
    keep(job.name, done, Date.now());
    job.resolve(done.uri);
    trim();
  } catch (e) {
    try { if (part.exists) part.delete(); } catch { /* not there */ }
    job.reject(e);
  } finally {
    loading.delete(job.name);
    running -= 1;
    pump();
  }
}

function pump() {
  while (running < AT_ONCE) {
    let job = urgent.shift();
    while (!job && ahead.length) {
      const url = ahead.shift()!;
      const name = nameOf(url);
      if (loading.has(name) || previewFile(url)) continue;
      let resolve!: Job['resolve'];
      let reject!: Job['reject'];
      const promise = new Promise<string>((a, b) => { resolve = a; reject = b; });
      promise.catch(() => undefined); // no one waits on a fetch ahead
      loading.set(name, promise);
      job = { url, name, resolve, reject };
    }
    if (!job) return;
    void run(job);
  }
}

// the file of this preview, fetched first if it is not here
export function fetchPreview(url: string): Promise<string> {
  const have = previewFile(url);
  if (have) return Promise.resolve(have);
  const name = nameOf(url);
  const was = loading.get(name);
  if (was) return was;
  const promise = new Promise<string>((resolve, reject) => { urgent.push({ url, name, resolve, reject }); });
  loading.set(name, promise);
  ahead = ahead.filter((u) => u !== url);
  pump();
  return promise;
}

// fetch these ahead, in this order, once nothing more urgent is waiting
export function prefetchPreviews(urls: string[]) {
  ahead = urls;
  pump();
}
