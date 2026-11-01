// What the app keeps on the phone (Cosmos: MMKV v4, createMMKV). JSON values, like the web page's `store`.
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'local-canvas' });

export const store = {
  get<T>(key: string, fallback: T): T {
    const v = storage.getString(key);
    if (v == null) return fallback;
    try { return JSON.parse(v) as T; } catch { return fallback; }
  },
  set(key: string, value: unknown) {
    if (value === undefined) storage.remove(key);
    else storage.set(key, JSON.stringify(value));
  },
};
