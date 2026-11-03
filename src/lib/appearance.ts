// The phone's own preferences (Cosmos module 643, its keys), kept on the phone in MMKV:
//   - preferredAppearance (AppearanceSheet: 系统 / 浅色 / 深色, applyAppearance). 系统 follows the phone (Unistyles'
//     adaptiveThemes, as module 618 configures it); the other two pin the theme. initAppearanceStalenessGuard
//     (createStalenessNudgeController): after the phone switches light / dark while 系统 is chosen, every 250 ms, up to
//     4 more times, it looks whether the theme has caught up and then commits it again so every style is redrawn
//   - hapticsEnabled (HapticsSheet: 开 / 关, on unless turned off); triggerImpactFeedback (module 1300) gives a haptic
//     only when it is on
import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';
import { Appearance as PhoneAppearance } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { UnistylesRuntime } from 'react-native-unistyles';

export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCES: [Appearance, string][] = [['system', '系统'], ['light', '浅色'], ['dark', '深色']];

const store = createMMKV({ id: 'app-settings' });
const APPEARANCE_KEY = 'appearance';
const HAPTICS_KEY = 'hapticsEnabled';
const INTRO_KEY = 'hasSeenIntro';
const LANGUAGE_KEY = 'appLanguage';

export const getAppearance = (): Appearance => {
  const v = store.getString(APPEARANCE_KEY);
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
  store.set(APPEARANCE_KEY, a);
  applyAppearance(a);
}

// createStalenessNudgeController
const NUDGE_INTERVAL_MS = 250;
const NUDGE_RETRIES = 4;
let nudgeTimer: ReturnType<typeof setTimeout> | null = null;
let nudgesLeft = 0;

function onNudge() {
  nudgeTimer = null;
  if (getAppearance() !== 'system') return;
  const scheme = PhoneAppearance.getColorScheme();
  const colorScheme = scheme === 'light' || scheme === 'dark' ? scheme : null;
  if (colorScheme == null || UnistylesRuntime.themeName === colorScheme) {
    const name = UnistylesRuntime.themeName;
    if (name) UnistylesRuntime.updateTheme(name, (t) => ({ ...t }));
    return;
  }
  if (nudgesLeft <= 0) return;
  nudgesLeft -= 1;
  nudgeTimer = setTimeout(onNudge, NUDGE_INTERVAL_MS);
}

let guarded = false;
export function initAppearanceStalenessGuard() {
  if (guarded) return;
  guarded = true;
  PhoneAppearance.addChangeListener(() => {
    if (getAppearance() !== 'system') return;
    nudgesLeft = NUDGE_RETRIES;
    if (nudgeTimer != null) clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(onNudge, NUDGE_INTERVAL_MS);
  });
}

// the language chosen on LanguageScreen (Cosmos' getSupportedLanguageByCode, in its order): remembered and shown, nothing
// more; the app's words stay Chinese (the person's choice, HANDOFF 6.190)
export type SupportedLanguage = { code: string; nativeLabel: string; englishLabel: string };
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', nativeLabel: 'English', englishLabel: 'English' },
  { code: 'ja', nativeLabel: '日本語', englishLabel: 'Japanese' },
  { code: 'ko', nativeLabel: '한국어', englishLabel: 'Korean' },
  { code: 'es', nativeLabel: 'Español', englishLabel: 'Spanish' },
  { code: 'pt', nativeLabel: 'Português', englishLabel: 'Portuguese' },
  { code: 'fr', nativeLabel: 'Français', englishLabel: 'French' },
  { code: 'it', nativeLabel: 'Italiano', englishLabel: 'Italian' },
  { code: 'de', nativeLabel: 'Deutsch', englishLabel: 'German' },
  { code: 'nl', nativeLabel: 'Nederlands', englishLabel: 'Dutch' },
  { code: 'zh', nativeLabel: '中文', englishLabel: 'Chinese' },
  { code: 'vi', nativeLabel: 'Tiếng Việt', englishLabel: 'Vietnamese' },
];
const languageListeners = new Set<() => void>();
const getAppLanguage = () => store.getString(LANGUAGE_KEY) ?? 'zh';
export function setAppLanguage(code: string) {
  store.set(LANGUAGE_KEY, code);
  languageListeners.forEach((l) => l());
}
const subscribeLanguage = (l: () => void) => {
  languageListeners.add(l);
  return () => { languageListeners.delete(l); };
};
export const useAppLanguage = () => useSyncExternalStore(subscribeLanguage, getAppLanguage, getAppLanguage);

// haptics
const hapticsListeners = new Set<() => void>();
// hasSeenIntro: the intro (IntroScreen) is shown until one has signed in on this phone
export const getHasSeenIntro = () => store.getBoolean(INTRO_KEY) === true;
export const setHasSeenIntro = (seen: boolean) => store.set(INTRO_KEY, seen);

export const getIsHapticsEnabled = () => store.getBoolean(HAPTICS_KEY) !== false;
export function setIsHapticsEnabled(on: boolean) {
  store.set(HAPTICS_KEY, on);
  hapticsListeners.forEach((l) => l());
}
const subscribeHaptics = (l: () => void) => {
  hapticsListeners.add(l);
  return () => { hapticsListeners.delete(l); };
};
export const useIsHapticsEnabled = () => useSyncExternalStore(subscribeHaptics, getIsHapticsEnabled, getIsHapticsEnabled);

export function triggerSelectionFeedback() {
  if (getIsHapticsEnabled()) void Haptics.selectionAsync().catch(() => undefined);
}
export function triggerImpactFeedback(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (getIsHapticsEnabled()) Haptics.impactAsync(style).catch(() => undefined);
}
