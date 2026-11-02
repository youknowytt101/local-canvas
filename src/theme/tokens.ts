// Cosmos 2.33's theme (modules 763 / 765: colorPalette, lightTheme / darkTheme, typography, spacing, borderRadius,
// shadows, size), the same values as cosmos-lite's ui-research/theme.json.
export const colorPalette = {
  white: '#FFFFFF', offWhite: '#F7F5F3', surfaceLightElevation: '#FCFBFA', white80: '#FFFFFF80', white40: '#FFFFFF40',
  white10: '#F7F5F31F', white85: '#FFFFFFD9', white90: '#FFFFFFE6', white78: '#FFFFFFC7', black: '#000000',
  black2: '#00000005', black50: '#0000000D', black40: '#00000066', black80: '#00000080', black90: '#141414',
  black10: '#6E6A692E', black85: '#000000D9', black27: '#00000045', borderLight10: '#0000001A', borderDark10: '#FFFFFF1A',
  borderDark065: '#FFFFFF11', transparentLight0: '#FFFFFF00', transparentLight10: '#FF00FF1A', transparentDark0: '#24242400',
  transparentDark10: '#2424241A', transparentDark90: '#242424E6', transparentDarkBlur: '#1F1F1FC7', switchElevated: '#78787833',
  blue500: '#008BFF', blue600: '#2965F6', badgeDark: '#316AF4', primaryBlueLight: '#0700FF', primaryBlueDark: '#123CEB',
  criticalLight: '#BD3C1F', criticalDark: '#EF7759', red: '#C31515', green: '#009539', disabledLight: '#D0CDCD',
  disabledDark: '#434242', paperInvertedFilledDark: '#E8E8E8', gray50: '#F2F1F0', gray75: '#ECECEC', gray100: '#E5E5E5',
  gray200: '#212020', gray300: '#AEABAB', gray400: '#9A9796', gray500: '#918F8F', gray600: '#5C5C5C', gray650: '#383838',
  gray700: '#363636', gray750: '#343434', gray800: '#323131', gray850: '#1C1C1C', gray900: '#0D0D0D', grayWarm: '#6E6A69',
  pink: '#EE1D52', cyan: '#69C9D0',
} as const;

const lightColors = {
  primary: '#0D0D0D', secondary: '#6E6A69', tertiary: '#9A9796', disabled: '#D0CDCD', inverted: '#FFFFFF',
  background: '#FFFFFF', sheetBackground: '#FFFFFF', elevated: '#F2F1F0', lightElevation: '#FCFBFA', pillElevated: '#FFFFFF',
  sheetElevated: '#F2F1F0', sheetLightElevation: '#FCFBFA', switchElevated: '#78787833', transparent0: '#FFFFFF00',
  transparent10: '#FF00FF1A', transparent90: '#FFFFFFE6', transparentBlur: '#FFFFFFC7', blurBorder: '#0000001A',
  blurSurfaceBorder: '#F2F1F0', surfaceInverted: '#0D0D0D', surfaceBorder: '#0000001A', paperBackground: '#F7F5F3',
  paperElevated: '#FFFFFF', paperElevatedFilled: '#ECECEC', paperInvertedFilled: '#383838', scrim: '#00000066',
  playButtonOverlay: '#00000045', badge: '#2965F6', primaryBlue: '#0700FF', alert: '#BD3C1F',
  emptyCardBackground: '#F7F5F3', // paperBackground (module 763)
};
type Colors = typeof lightColors;

const darkColors: Colors = {
  primary: '#FFFFFF', secondary: '#AEABAB', tertiary: '#918F8F', disabled: '#434242', inverted: '#141414',
  background: '#141414', sheetBackground: '#212020', elevated: '#212020', lightElevation: '#212020', pillElevated: '#212020',
  sheetElevated: '#323131', sheetLightElevation: '#323131', switchElevated: '#78787833', transparent0: '#24242400',
  transparent10: '#2424241A', transparent90: '#242424E6', transparentBlur: '#1F1F1FC7', blurBorder: '#FFFFFF11',
  blurSurfaceBorder: '#323131', surfaceInverted: '#FFFFFF', surfaceBorder: '#FFFFFF1A', paperBackground: '#141414',
  paperElevated: '#1C1C1C', paperElevatedFilled: '#0D0D0D', paperInvertedFilled: '#E8E8E8', scrim: '#00000066',
  playButtonOverlay: '#00000045', badge: '#316AF4', primaryBlue: '#123CEB', alert: '#EF7759',
  emptyCardBackground: '#323131', // sheetElevated (module 763)
};

export const borderRadius = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, full: 9999, element: 3 } as const;
export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, xxxl: 32, xxxxl: 48 } as const;
export const size = { xs: 16, sm: 20, md: 34, lg: 40, xl: 56, xxl: 88 } as const;
export const shadows = {
  small: '0 1px 8px 0 rgba(0, 0, 0, 0.05)',
  default: '0 4px 22px rgba(0, 0, 0, 0.06)',
  strong: '0 4px 22px rgba(0, 0, 0, 0.12)',
} as const;
export const choicePill = { width: 212, minHeight: size.xl, paddingHorizontal: 44, spinnerCenterOffset: 28 } as const;
export const progressBar = { width: 80, height: 6 } as const;

// Cosmos sets fontFamily 'Cosmos Oracle' and a fontWeight. The font files are not shipped with this app (a commercial
// font, kept on the computer only): until theme/fonts.ts has loaded them from the server, the system font stands in
// at the same weight; once loaded, every weight is its own family (an alias per file, see fonts.ts).
// (plain object types, not React Native's TextStyle: spread into a Unistyles sheet, TextStyle breaks its inference)
export type Weight = 'book' | 'regular' | 'medium' | 'bold';
type FontWeight = '300' | '400' | '500' | '700';
export type Face = { fontFamily?: string; fontWeight?: FontWeight };
export type Size = { fontSize: number; lineHeight?: number; letterSpacing?: number };
export type Type = Face & Size;

export const WEIGHT: Record<Weight, FontWeight> = { book: '300', regular: '400', medium: '500', bold: '700' };
export const ORACLE: Record<Weight, string> = {
  book: 'CosmosOracle-Book', regular: 'CosmosOracle-Regular', medium: 'CosmosOracle-Medium', bold: 'CosmosOracle-Bold',
};
// a loaded file is one weight already: no fontWeight with it (Android would embolden it again)
export const face = (w: Weight, oracle: boolean): Face =>
  oracle ? { fontFamily: ORACLE[w] } : { fontWeight: WEIGHT[w] };

const scale = <K extends string>(sizes: Record<K, Size>, w: Weight, oracle: boolean): Record<K, Type> =>
  Object.fromEntries(Object.entries<Size>(sizes).map(([k, v]) => [k, { ...face(w, oracle), ...v }])) as Record<K, Type>;

const HEADING = { xs: { fontSize: 12 }, sm: { fontSize: 14 }, md: { fontSize: 16 }, lg: { fontSize: 18 }, xl: { fontSize: 20 }, xxl: { fontSize: 22, lineHeight: 22 } };
const SUBTITLE = { xxs: { fontSize: 10 }, xs: { fontSize: 12 }, sm: { fontSize: 14, lineHeight: 18 }, md: { fontSize: 16, lineHeight: 20 }, lg: { fontSize: 18 }, xl: { fontSize: 20 }, xxl: { fontSize: 28 } };
const BODY = { xxs: { fontSize: 10 }, xs: { fontSize: 12, lineHeight: 14 }, sm: { fontSize: 14 }, md: { fontSize: 16 }, lg: { fontSize: 18 }, xl: { fontSize: 20 }, xxl: { fontSize: 24 }, xxxl: { fontSize: 28 } };
const INPUT = { large: { fontSize: 32, lineHeight: 32, letterSpacing: -0.5 } };

export function typography(oracle: boolean) {
  const f = (w: Weight, s: Size): Type => ({ ...face(w, oracle), ...s });
  return {
    headingLarge: f('regular', { fontSize: 26 }),
    headingMedium: f('medium', { fontSize: 18 }),
    buttonLarge: f('medium', { fontSize: 16 }),
    buttonMedium: f('medium', { fontSize: 14, lineHeight: 18 }),
    buttonSmall: f('medium', { fontSize: 12 }),
    regularPlus: f('medium', { fontSize: 14, lineHeight: 18 }),
    regularInput: f('regular', { fontSize: 32, lineHeight: 32, letterSpacing: -0.5 }),
    regular: f('regular', { fontSize: 14 }),
    large: f('regular', { fontSize: 16 }),
    largePlus: f('medium', { fontSize: 16, lineHeight: 20 }),
    caption: f('regular', { fontSize: 12, lineHeight: 14 }),
    captionPlus: f('medium', { fontSize: 12 }),
    largeInputField: f('book', { fontSize: 32 }),
    regularInputField: f('book', { fontSize: 16 }),
    textElementHeading: f('medium', { fontSize: 24 }),
    textElementBody: f('book', { fontSize: 16 }),
    textElementFeedHeading: f('medium', { fontSize: 16 }),
    textElementFeedBody: f('book', { fontSize: 14 }),
    body: scale(BODY, 'regular', oracle),
    bodyBook: scale(BODY, 'book', oracle),
    heading: scale(HEADING, 'bold', oracle),
    input: scale(INPUT, 'regular', oracle),
    subtitle: scale(SUBTITLE, 'medium', oracle),
    subtitleBook: scale(SUBTITLE, 'book', oracle),
  };
}

const base = (oracle: boolean) => ({ borderRadius, spacing, size, shadows, choicePill, progressBar, typography: typography(oracle) });

export const lightTheme = { colors: lightColors, ...base(false) };
export const darkTheme = { colors: darkColors, ...base(false) };
export type AppTheme = typeof lightTheme;
