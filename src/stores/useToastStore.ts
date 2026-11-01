// Cosmos' useToastStore (what AppToast shows): one toast at a time, its text, an action ("查看") and how long it stays
import { create } from 'zustand';

export type Toast = { id: number; text: string; actionText?: string; onAction?: () => void; imageUrl?: string | null; imageBlurred?: boolean; duration: number };

type ToastState = {
  toast: Toast | null;
  show: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => void;
  hide: (id?: number) => void;
};

let seq = 0;
const DEFAULT_DURATION = 1600;

export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  show: (toast) => set({ toast: { duration: DEFAULT_DURATION, ...toast, id: ++seq } }),
  hide: (id) => { if (id == null || get().toast?.id === id) set({ toast: null }); },
}));

export const showToast = (toast: Parameters<ToastState['show']>[0]) => useToastStore.getState().show(toast);
