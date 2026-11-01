// The bar's constants (Cosmos module 1747), in its export order; the ones for contents this app does not have yet
// (organize, profile elements, messages, the element viewer's save) come with those screens.
export const TAB_BAR_DEFAULT_WIDTH = 210; // tablets only (TAB_BAR_TABLET_BREAKPOINT): phones span the screen
export const TAB_BAR_DEFAULT_TAB_STACK_PADDING = 9;
export const TAB_BAR_DEFAULT_ICON_SIZE = 28;
export const TAB_BAR_HOME_HEIGHT = 62;
export const TAB_BAR_SEARCH_ACTION_SIZE = 62;
export const GLOBAL_SEARCH_BAR_HEIGHT = 56;
export const GLOBAL_SEARCH_ACTION_SIZE = 56;
export const GLOBAL_SEARCH_ACTION_GAP = 8;
export const GLOBAL_SEARCH_HORIZONTAL_INSET = 20;
export const GLOBAL_SEARCH_KEYBOARD_HORIZONTAL_INSET = 12;
export const TAB_BAR_TABLET_BREAKPOINT = 768;
export const TAB_BAR_ACTION_GAP = 10;
export const TAB_BAR_SIZE_SPRING_CONFIG = { damping: 30, stiffness: 340, overshootClamping: true };
export const GLOBAL_SEARCH_MORPH_SPRING_CONFIG = { duration: 325, dampingRatio: 0.835 };
export const GLOBAL_SEARCH_MORPH_EXIT_SPRING_CONFIG = { duration: 325, dampingRatio: 0.92 };
export const BAR_PILL_RADIUS = 99;
export const BAR_SHADOW = '0 6px 44px 0 rgba(0, 0, 0, 0.15), 0 4px 8px 0 rgba(0, 0, 0, 0.03)';
export const BAR_HIDE_DURATION = 100;
export const BAR_SHOW_DURATION = 160;
export const BAR_CONTENT_SHOW_DURATION = 275;
export const BAR_CONTENT_MIN_SCALE = 0.92;
export const BAR_ACCESSORY_MIN_SCALE = 0.9;
export const BAR_ACCESSORY_TRANSLATE_X = 50;
export const BAR_ENTER_TRANSLATE_Y = 10;
export const BAR_BOTTOM_OFFSET = 16;
export const BAR_GRADIENT_HEIGHT = 150;

// DynamicBar's screens without a bar (isBarHidden: the focused screen is one of these). The names are Cosmos'; most of
// these screens come in later steps.
export const BAR_HIDDEN_SCREENS = new Set([
  'SettingsRoot', 'EditProfile', 'AccountDetails', 'UpdatePassword', 'BlockedAccounts', 'ContentFiltering', 'Language',
  'PremiumPaywall', 'CropProfilePicture', 'InfiniteCanvas', 'Login',
]);

// BAR_CONTENT_INDEX: the cross-fade interpolates between these numbers (only the two contents built so far)
export const BAR_CONTENT_INDEX = { default: 0, 'global-search': 1 } as const;
export type BarContent = keyof typeof BAR_CONTENT_INDEX;

// dynamicBarLayoutTs1 (module 2206, worklet source): the pill beside a round action of `actionSize`, `actionGap` apart,
// `horizontalInset` from the screen's sides
export function getEdgeToEdgeBarWidth(windowWidth: number, horizontalInset: number, actionGap: number, actionSize: number) {
  'worklet';
  return Math.max(actionSize, windowWidth - 2 * horizontalInset - actionGap - actionSize);
}
// dynamicBarLayoutTs2
export function getGlobalSearchBarWidth(windowWidth: number, horizontalInset: number) {
  'worklet';
  return getEdgeToEdgeBarWidth(windowWidth, horizontalInset, GLOBAL_SEARCH_ACTION_GAP, GLOBAL_SEARCH_ACTION_SIZE);
}
// dynamicBarLayoutTs3: while searching, the bar rides on the keyboard
export function getGlobalSearchKeyboardShift(searchModeProgress: number, keyboardProgress: number, keyboardHeight: number, safeAreaBottom: number) {
  'worklet';
  const attachment = searchModeProgress * keyboardProgress;
  return { attachment, lift: attachment * Math.min(0, keyboardHeight + safeAreaBottom) };
}
