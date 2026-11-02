// The user's recent searches (Cosmos: globalSearchHistory(ownerId), kept on its server: GlobalSearchHistoryEntry =
// SearchTerm | VisitedCluster | VisitedUser; RememberGlobalSearchHistory… / Forget… / ForgetAll), on the computer's
// /api/search/history. The newest first, one of each.
import type { Collection } from '../components/clusters/CollectionCard';
import { api, get } from './api';

export type HistoryPerson = { id: string; username: string; fullName?: string; avatarUrl?: string | null };
export type HistoryEntry =
  | { kind: 'term'; searchTerm: string; at: string }
  | { kind: 'cluster'; clusterId: string; cluster: Collection; at: string }
  | { kind: 'user'; userId: string; user: HistoryPerson; at: string };

const bodyOf = (e: Pick<HistoryEntry, 'kind'> & { searchTerm?: string; clusterId?: string; userId?: string }) =>
  e.kind === 'cluster' ? { clusterId: e.clusterId } : e.kind === 'user' ? { userId: e.userId } : { searchTerm: e.searchTerm };

export const readSearchHistory = () => get<{ entries: HistoryEntry[] }>('/api/search/history').then((r) => r.entries);
export const rememberSearch = (e: { kind: HistoryEntry['kind']; searchTerm?: string; clusterId?: string; userId?: string }) =>
  api('POST', '/api/search/history/remember', bodyOf(e)).catch(() => undefined);
export const forgetSearch = (e: HistoryEntry) => api('POST', '/api/search/history/forget', bodyOf(e));
export const forgetAllSearches = () => api('POST', '/api/search/history/forget-all');
export const historyKey = (e: HistoryEntry) => (e.kind === 'cluster' ? `c:${e.clusterId}` : e.kind === 'user' ? `u:${e.userId}` : `t:${e.searchTerm}`);
