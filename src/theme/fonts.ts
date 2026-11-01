// Cosmos Oracle (Book 300 / Regular 400 / Medium 500 / Bold 700), loaded from the computer's own server
// (cosmos-lite serves public/fonts/): the font is commercial and is not part of this app or its repository.
// Without the server, or before it answers, the theme keeps the system font at the same weights.
import * as Font from 'expo-font';
import { UnistylesRuntime } from 'react-native-unistyles';
import { ORACLE, typography, type Weight } from './tokens';
import { absoluteUrl } from '../lib/server';

const FILES: Record<Weight, string> = {
  book: 'CosmosOracle-Book.otf',
  regular: 'CosmosOracle-Regular.otf',
  medium: 'CosmosOracle-Medium.otf',
  bold: 'CosmosOracle-Bold.otf',
};

let loaded = false;

export async function loadOracle(): Promise<boolean> {
  if (loaded) return true;
  try {
    await Font.loadAsync(
      Object.fromEntries((Object.keys(FILES) as Weight[]).map((w) => [ORACLE[w], { uri: absoluteUrl(`/public/fonts/${FILES[w]}`) }])),
    );
  } catch {
    return false;
  }
  loaded = true;
  const oracle = typography(true);
  UnistylesRuntime.updateTheme('light', (t) => ({ ...t, typography: oracle }));
  UnistylesRuntime.updateTheme('dark', (t) => ({ ...t, typography: oracle }));
  return true;
}
