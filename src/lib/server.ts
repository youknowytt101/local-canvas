// The computer this app talks to: cosmos-lite's server on the same Wi-Fi (its config.lan on, HANDOFF 6.138). Cosmos'
// own app has api.cosmos.so built in (module 1394); here the address is typed in once and kept.
import { storage } from './storage';

const KEY = 'server_url';
export const DEFAULT_PORT = 4870;

let current: string | null = storage.getString(KEY) ?? null;

export const serverUrl = () => current;

export function setServerUrl(url: string | null) {
  current = url;
  if (url) storage.set(KEY, url);
  else storage.remove(KEY);
}

// "192.168.1.5", "192.168.1.5:4870" or "http://192.168.1.5:4870/" -> "http://192.168.1.5:4870"; null if it is no address
export function normalizeServerUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  const m = /^(https?):\/\/([^/?#:\s]+)(?::(\d{1,5}))?\/?$/i.exec(s);
  if (!m) return null;
  const [, scheme, host, port] = m;
  return `${scheme.toLowerCase()}://${host}:${port || DEFAULT_PORT}`;
}

// the server's paths (/graphql, /img/…, /thumb/…, /media/…, /public/fonts/…) as full addresses
export function absoluteUrl(path: string, base: string | null = current): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) throw new Error('还没有填服务器地址');
  return base + (path.startsWith('/') ? path : `/${path}`);
}
