// Signed in, as the web page does it (cosmos-lite public/auth.js, HANDOFF 6.95 / 6.112) and as Cosmos keeps it
// (module 607: SecureStore cosmos_access_token / cosmos_refresh_token): an access token with every request, renewed
// with the refresh token (RefreshAccessToken). A phone never signs in without a password (the server only lets the
// computer itself do that, 6.138), so there is no DeviceSignIn here. Unlike the page, a server that does not answer
// does not cost the tokens: the computer is often just switched off.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { absoluteUrl } from './server';
import { storage } from './storage';

const KEYS = { access: 'cosmos_access_token', refresh: 'cosmos_refresh_token' };
const UNTIL = 'cosmos_access_token_expires_at';
const RENEW_BEFORE_MS = 5 * 60_000;

type Pair = { accessToken: string; refreshToken: string; accessTokenExpiresAt: string; user?: unknown };

let memory = {
  access: SecureStore.getItem(KEYS.access),
  refresh: SecureStore.getItem(KEYS.refresh),
  until: storage.getString(UNTIL) ?? null,
};

function keep(pair: Pair) {
  memory = { access: pair.accessToken, refresh: pair.refreshToken, until: pair.accessTokenExpiresAt };
  SecureStore.setItem(KEYS.access, pair.accessToken);
  SecureStore.setItem(KEYS.refresh, pair.refreshToken);
  storage.set(UNTIL, pair.accessTokenExpiresAt);
}
function forget() {
  memory = { access: null, refresh: null, until: null };
  void SecureStore.deleteItemAsync(KEYS.access);
  void SecureStore.deleteItemAsync(KEYS.refresh);
  storage.remove(UNTIL);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly offset?: number) {
    super(message);
  }
}

// ---------- GraphQL (6.112): one field of one operation, the arguments as JSON variables ----------
export function gqlDocument(kind: 'query' | 'mutation', operation: string, field: string, args: Record<string, unknown> = {}) {
  const names = Object.keys(args).filter((k) => args[k] !== undefined);
  for (const k of names) if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(k)) throw new Error(`参数名 ${k} 不能用在 GraphQL 里`);
  const vars = names.length ? `(${names.map((k) => `$${k}: JSON`).join(', ')})` : '';
  const pass = names.length ? `(${names.map((k) => `${k}: $${k}`).join(', ')})` : '';
  return JSON.stringify({ query: `${kind} ${operation}${vars} { ${field}${pass} }`, variables: Object.fromEntries(names.map((k) => [k, args[k]])), operationName: operation });
}

// Cosmos' x-client-name / x-client-version (module 1398); the server does not need them, it may log them
const CLIENT_HEADERS = { 'x-client-name': Platform.OS, 'x-client-version': '1.0.0' };

export async function gql<T = any>(kind: 'query' | 'mutation', operation: string, field: string, args: Record<string, unknown> = {},
  { signedIn = true, base }: { signedIn?: boolean; base?: string } = {}): Promise<T> {
  const url = absoluteUrl('/graphql', base);
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json', ...CLIENT_HEADERS }, body: gqlDocument(kind, operation, field, args) };
  const res = signedIn ? await authFetch(url, init) : await fetch(url, init);
  let out: any = null;
  try { out = await res.json(); } catch { /* not JSON: not this server */ }
  const err = out?.errors?.[0];
  if (err || !res.ok) throw new ApiError(err?.message || out?.error || `请求失败（${res.status}）`, err?.extensions?.status || res.status, err?.extensions?.offset);
  return out.data[field] as T;
}

// RefreshAccessToken: the new pair; null when the server turned it down; throws when there is no answer
async function refresh(token: string): Promise<Pair | null> {
  try {
    return await gql<Pair>('mutation', 'RefreshAccessToken', 'refreshAccessToken', { input: { refreshToken: token } }, { signedIn: false });
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) return null;
    throw e;
  }
}

let renewing: Promise<void> | null = null;
function renew() {
  renewing ||= (async () => {
    try {
      if (!memory.refresh) return;
      const pair = await refresh(memory.refresh);
      if (pair) keep(pair); else forget();
    } catch {
      // the server is away: the requests themselves say so, and the tokens stay
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}
const fresh = () => !!memory.access && !!memory.until && Date.parse(memory.until) - Date.now() > RENEW_BEFORE_MS;

export const hasSession = () => !!memory.refresh;
export const accessTokenNow = () => (memory.access && memory.until && Date.parse(memory.until) > Date.now() ? memory.access : null);
export function authHeaders(headers: Record<string, string> = {}) {
  const t = accessTokenNow();
  return t ? { ...headers, Authorization: `Bearer ${t}` } : headers;
}
export async function accessToken() {
  if (!fresh()) await renew();
  return memory.access;
}

// fetch with the user's token; a 401 renews it once and asks again
export async function authFetch(url: string, opts: RequestInit = {}) {
  await accessToken();
  const go = () => fetch(url, { ...opts, headers: authHeaders((opts.headers as Record<string, string>) || {}) });
  let res = await go();
  if (res.status === 401 && memory.refresh) {
    await renew();
    res = await go();
  }
  return res;
}

// Cosmos' Login { identifier, password } (LoginScreen): the user, the pair kept; the error's message when refused
export async function signInWithPassword(identifier: string, password: string) {
  let data: Pair | null = null;
  try {
    data = await gql<Pair>('mutation', 'Login', 'login', { input: { identifier, password } }, { signedIn: false });
  } catch (e) {
    throw new Error(e instanceof ApiError && e.status < 500 ? e.message : '当前无法登录，请重试。'); // auth.unableToSignIn
  }
  if (!data?.accessToken) throw new Error('当前无法登录，请重试。');
  keep(data);
  return data.user;
}

export async function signOut() {
  const token = memory.refresh;
  forget();
  if (token) await gql('mutation', 'Logout', 'logout', { input: { refreshToken: token } }, { signedIn: false }).catch(() => null);
}
