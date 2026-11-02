// Photos and videos picked on the phone go to the computer in pieces (the web page's uploads, HANDOFF 6.87: POST
// /api/uploads opens a session, PUT /api/uploads/:id?offset= sends 8 MB at a time, POST …/complete makes the element).
// Each one is kept in MMKV until it is done, so one cut off — the network gone, the app closed — goes on from the
// computer's offset when the app is back (startup, coming to the front). A 4xx from the computer (a type it does not
// take, too big) drops it and says why; anything else pauses it.
// Cosmos makes its uploads elements at once (createPendingUploadPayload / reattachExistingMediaUploads) that show as
// tiles while they go up; here the tiles are not drawn: the bar of progress is the toast (near). A video's cover is made
// on the computer after the upload is done, so the lists read themselves once more when it is there.
import { File } from 'expo-file-system';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { api } from './api';
import type { Element } from './elements';
import { authFetch } from './auth';
import { absoluteUrl } from './server';
import { store } from './storage';
import { showToast } from '../stores/useToastStore';

const CHUNK = 8 * 1024 * 1024;
const KEY = 'uploads';

export type PickedMedia = { uri: string; name: string; size: number; kind: 'image' | 'video'; mimeType?: string | null };
export type Upload = PickedMedia & {
  key: string; clusterId: string | null; uploadId: string | null; offset: number;
  status: 'waiting' | 'sending' | 'paused' | 'done' | 'failed'; error?: string; at: number;
};

type UploadState = { uploads: Upload[]; patch: (key: string, p: Partial<Upload>) => void; remove: (key: string) => void };

const persist = (uploads: Upload[]) => store.set(KEY, uploads.filter((u) => u.status !== 'done' && u.status !== 'failed'));

export const useUploadStore = create<UploadState>((set) => ({
  uploads: store.get<Upload[]>(KEY, []).map((u) => ({ ...u, status: u.status === 'sending' ? 'paused' : u.status })),
  patch: (key, p) => set((s) => {
    const uploads = s.uploads.map((u) => (u.key === key ? { ...u, ...p } : u));
    persist(uploads);
    return { uploads };
  }),
  remove: (key) => set((s) => {
    const uploads = s.uploads.filter((u) => u.key !== key);
    persist(uploads);
    return { uploads };
  }),
}));

const listeners = new Set<(clusterId: string | null) => void>();
// a list showing where uploads land reads itself again when one is done
export const onUploadDone = (fn: (clusterId: string | null) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

class Rejected extends Error {}

async function sendOne(u: Upload) {
  const { patch } = useUploadStore.getState();
  patch(u.key, { status: 'sending', error: undefined });
  let uploadId = u.uploadId;
  let offset = u.offset;
  if (uploadId) {
    // where the computer has got to (it may have more, or the session may be gone)
    try {
      const s = await api<{ offset: number }>('GET', `/api/uploads/${encodeURIComponent(uploadId)}`);
      offset = s.offset;
    } catch (e) {
      if ((e as { status?: number }).status === 404) { uploadId = null; offset = 0; } else throw e;
    }
  }
  if (!uploadId) {
    const s = await api<{ id: string; offset?: number }>('POST', '/api/uploads', { name: u.name, size: u.size, clusterId: u.clusterId ?? undefined });
    uploadId = s.id;
    offset = s.offset ?? 0;
  }
  patch(u.key, { uploadId, offset });
  const file = new File(u.uri);
  if (!file.exists) throw new Rejected('文件已不在手机上，请重新选择');
  while (offset < u.size) {
    const handle = file.open();
    let bytes: Uint8Array;
    try {
      handle.offset = offset;
      bytes = handle.readBytes(Math.min(CHUNK, u.size - offset));
    } finally {
      handle.close();
    }
    const res = await authFetch(absoluteUrl(`/api/uploads/${encodeURIComponent(uploadId)}?offset=${offset}`), {
      method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes as unknown as BodyInit,
    });
    const body = await res.json().catch(() => ({})) as { offset?: number; error?: string; message?: string };
    if (res.status === 409 && typeof body.offset === 'number') { offset = body.offset; continue; } // the computer has another offset
    if (res.status >= 400 && res.status < 500) throw new Rejected(body.error || body.message || '无法上传');
    if (!res.ok) throw new Error(body.error || '无法上传');
    offset = typeof body.offset === 'number' ? body.offset : offset + bytes.length;
    patch(u.key, { offset });
  }
  const done = await api<{ element?: Element }>('POST', `/api/uploads/${encodeURIComponent(uploadId)}/complete`);
  return done.element ?? null;
}

// the computer makes a video's cover a little after the upload: ask for it every 1.5 s for half a minute
async function whenCovered(el: Element, clusterId: string | null) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const now = await api<Element>('GET', `/api/elements/${encodeURIComponent(el.id)}`).catch(() => null);
    if (now?.posterUrl) { for (const fn of listeners) fn(clusterId); return; }
  }
}

let running = false;
// send the waiting and paused ones, one at a time
export async function runUploads() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = useUploadStore.getState().uploads.find((u) => u.status === 'waiting' || u.status === 'paused');
      if (!next) break;
      try {
        const el = await sendOne(next);
        useUploadStore.getState().patch(next.key, { status: 'done' });
        useUploadStore.getState().remove(next.key);
        for (const fn of listeners) fn(next.clusterId);
        if (el && el.mediaKind === 'video' && !el.posterUrl) void whenCovered(el, next.clusterId);
        if (!useUploadStore.getState().uploads.some((u) => u.status === 'waiting' || u.status === 'sending' || u.status === 'paused')) showToast({ text: '上传完成' });
      } catch (e) {
        if (e instanceof Rejected || (e as { status?: number }).status === 400 || (e as { status?: number }).status === 413) {
          useUploadStore.getState().remove(next.key);
          showToast({ text: `${next.name}：${e instanceof Error ? e.message : '无法上传'}` });
        } else {
          useUploadStore.getState().patch(next.key, { status: 'paused', error: e instanceof Error ? e.message : String(e) });
          showToast({ text: '上传已暂停，回到 App 时会继续' });
          break; // the computer is away: wait for the next chance
        }
      }
    }
  } finally {
    running = false;
  }
}

export function queueUploads(media: PickedMedia[], clusterId: string | null) {
  const at = Date.now();
  const added: Upload[] = media.map((m, i) => ({ ...m, key: `${at}-${i}`, clusterId, uploadId: null, offset: 0, status: 'waiting', at }));
  useUploadStore.setState((s) => {
    const uploads = [...s.uploads, ...added];
    persist(uploads);
    return { uploads };
  });
  void runUploads();
}

// what was cut off goes on at startup and whenever the app comes back to the front
export function resumeUploads() {
  void runUploads();
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void runUploads(); });
  return () => sub.remove();
}
