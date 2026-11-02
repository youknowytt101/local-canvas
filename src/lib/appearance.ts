// Cosmos' AppearanceSheet (settings.appearance): 系统 / 浅色 / 深色, kept on the phone (applyAppearance). 系统 follows the
// phone (Unistyles' adaptiveThemes, as module 618 configures it); the other two pin the theme.
import { createMMKV } from 'react-native-mmkv';
import { UnistylesRuntime } from 'react-native-unistyles';

export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCES: [Appearance, string][] = [['system', '系统'], ['light', '浅色'], ['dark', '深色']];

const store = createMMKV({ id: 'app-settings' });

export const getAppearance = (): Appearance => {
  const v = store.getString('appearance');
  return v === 'light' || v === 'dark' ? v : 'system';
};

export function applyAppearance(a: Appearance = getAppearance()) {
  if (a === 'system') UnistylesRuntime.setAdaptiveThemes(true);
  else {
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(a);
  }
}

export function setAppearance(a: Appearance) {
  store.set('appearance', a);
  applyAppearance(a);
}
