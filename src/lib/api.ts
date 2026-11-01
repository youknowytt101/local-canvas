// The web page's api() (cosmos-lite public/app.js): code names a route by its old /api/ address, and that is turned into
// the GraphQL field the server calls it by (the list comes from the apiOperations query, asked once). Path parameters
// and the query string become the field's arguments, a body its `input`.
import { gql } from './auth';

type Operation = { field: string; operation: string; kind: 'query' | 'mutation'; method: string; path: string; params: string[]; re: RegExp };

let operationList: Promise<Operation[]> | null = null;
function apiOperations() {
  operationList ||= gql<Omit<Operation, 're'>[]>('query', 'ApiOperations', 'apiOperations').then((list) =>
    list.map((o) => ({ ...o, re: new RegExp(`^${o.path.replace(/:(\w+)/g, '([^/]+)')}$`) })));
  operationList.catch(() => { operationList = null; }); // the server was away: asked again next time
  return operationList;
}

const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '));

export async function api<T = any>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const [rawPath, query = ''] = url.split('?');
  const path = decode(rawPath);
  const op = (await apiOperations()).find((o) => o.method === method && o.re.test(path));
  if (!op) throw new Error(`没有这个接口：${method} ${path}`);
  const m = op.re.exec(path)!;
  const args: Record<string, unknown> = Object.fromEntries(op.params.map((k, i) => [k, m[i + 1]]));
  for (const pair of query.split('&').filter(Boolean)) {
    const i = pair.indexOf('=');
    args[decode(i < 0 ? pair : pair.slice(0, i))] = i < 0 ? '' : decode(pair.slice(i + 1));
  }
  if (body && op.kind === 'mutation') args.input = body;
  return gql<T>(op.kind, op.operation, op.field, args);
}

export const get = <T = any>(url: string) => api<T>('GET', url);
export const qs = (obj: Record<string, unknown>) =>
  Object.entries(obj).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
