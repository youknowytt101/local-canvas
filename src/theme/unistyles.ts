// Unistyles as Cosmos configures it (module 618): the light and dark theme, following the system (adaptiveThemes).
// Imported first in index.ts: StyleSheet.create must not run before this.
import { StyleSheet } from 'react-native-unistyles';
import { darkTheme, lightTheme } from './tokens';

const themes = { light: lightTheme, dark: darkTheme };
type AppThemes = typeof themes;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({ themes, settings: { adaptiveThemes: true } });
