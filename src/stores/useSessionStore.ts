// Where the app is (Cosmos: useAuthStore, module 1638, plus RootNavigator's signed-in / onboarded switch): no server
// yet, signed out, or in. `offline`: signed in, but the computer did not answer.
import { create } from 'zustand';
import { get } from '../lib/api';
import { ApiError, hasSession, signOut } from '../lib/auth';
import { serverUrl, setServerUrl } from '../lib/server';

export type Me = { id: string; username: string; fullName?: string; hasCompletedOnboarding?: boolean };
type Phase = 'boot' | 'server' | 'login' | 'main';

type SessionState = {
  phase: Phase;
  me: Me | null;
  offline: boolean;
  start: () => Promise<void>;
  signedIn: () => Promise<void>;
  signOut: () => Promise<void>;
  changeServer: () => void;
};

export const useSessionStore = create<SessionState>((set, getState) => ({
  phase: 'boot',
  me: null,
  offline: false,
  async start() {
    if (!serverUrl()) return set({ phase: 'server', me: null });
    if (!hasSession()) return set({ phase: 'login', me: null });
    try {
      const me = await get<Me>('/api/me');
      set({ phase: 'main', me, offline: false });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) set({ phase: 'login', me: null });
      else set({ phase: 'main', offline: true });
    }
  },
  async signedIn() {
    await getState().start();
  },
  async signOut() {
    await signOut();
    set({ phase: 'login', me: null });
  },
  changeServer() {
    setServerUrl(null);
    set({ phase: 'server', me: null });
  },
}));
