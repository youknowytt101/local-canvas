// The intro's other three pages, with Cosmos' numbers:
//   - ImageStack: three pictures one over another, 16 apart, sized from 0.52 of the window's height ((h − 32) / 2.15 for the
//     biggest, 0.75 and 0.4 of it for the others, aspect 0.8, all × 1.2)
//   - ImageGrid: four pictures two to a row (20 in and apart, aspect 3 : 4), a title and a count under each (its words are
//     English in the app too, not in the pack)
//   - SlideCarousel: the first of its slides, 314 high, and its caption of words and pills (white on the olive page)
// Near Cosmos: the caption's words are 大号 Hop 手袋 / 抹茶色。设计者： / 葆蝶家 (the pack's are a machine's: 大号啤酒花袋).
import { Image } from 'expo-image';
import { Text, useWindowDimensions, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { colorPalette } from '../../theme/tokens';
import { introAsset } from './introConstants';

const STACK_ASPECT = 0.8;
const STACK_MIDDLE = 0.75;
const STACK_SMALL = 0.4;
const STACK_SCALE = 1.2;
export function ImageStack() {
  const available = useWindowDimensions().height * 0.52;
  const unit = (available - 32) / 2.15;
  const size = (ratio: number) => ({ width: unit * ratio * STACK_ASPECT * STACK_SCALE, height: unit * ratio * STACK_SCALE });
  return (
    <View style={styles.stack}>
      <Image source={{ uri: introAsset('stack-image-1.png') }} contentFit="cover" style={size(STACK_MIDDLE)} />
      <Image source={{ uri: introAsset('stack-image-2.png') }} contentFit="cover" style={size(STACK_SMALL)} />
      <Image source={{ uri: introAsset('stack-image-3.png') }} contentFit="cover" style={size(1)} />
    </View>
  );
}

const GRID_GAP = 20;
const GRID_INSET = 20;
const GRID_TILES = [
  { title: 'Warm textures', subtitle: '124 Elements', file: 'grid-image-1.png' },
  { title: 'Floral studies', subtitle: '302 Elements', file: 'grid-image-2.png' },
  { title: 'Fashion week', subtitle: '1.2k Elements', file: 'grid-image-3.png' },
  { title: 'Studio design', subtitle: '64 Elements', file: 'grid-image-4.png' },
];
export function ImageGrid() {
  const width = (useWindowDimensions().width - GRID_INSET * 2 - GRID_GAP) / 2;
  const height = width * (4 / 3);
  return (
    <View style={styles.gridScreen}>
      <View style={styles.grid}>
        {GRID_TILES.map((t) => (
          <View key={t.title} style={{ width }}>
            <Image source={{ uri: introAsset(t.file) }} contentFit="cover" style={{ width, height }} />
            <View style={styles.gridText}>
              <Text style={styles.gridTitle}>{t.title}</Text>
              <Text style={styles.gridSubtitle}>{t.subtitle}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const SLIDE_HEIGHT = 314;
const SLIDE_ASPECT = 0.7197452229299363;
const SLIDE_CAPTION: { text: string; pill?: boolean }[] = [
  { text: '大号 Hop 手袋', pill: true },
  { text: '抹茶色。设计者：' },
  { text: '葆蝶家', pill: true },
];
export function SlideCarousel() {
  return (
    <View style={styles.stage}>
      <View style={styles.slide}>
        <Image source={{ uri: introAsset('slide-image-1.png') }} contentFit="cover" style={{ width: SLIDE_HEIGHT * SLIDE_ASPECT, height: SLIDE_HEIGHT }} />
        <View style={styles.captionContainer}>
          <View style={styles.captionRow}>
            {SLIDE_CAPTION.map((s) => (
              <View key={s.text} style={[styles.segment, s.pill && styles.pillSegment]}>
                <Text style={s.pill ? styles.pillText : styles.regularText}>{s.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  stack: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  gridScreen: { flex: 1, justifyContent: 'center', paddingHorizontal: GRID_INSET },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  gridText: { alignItems: 'center', height: 40, marginTop: 12 },
  gridTitle: { ...theme.typography.regularPlus, color: theme.colors.primary },
  gridSubtitle: { ...theme.typography.caption, color: theme.colors.tertiary },
  stage: { flex: 1, justifyContent: 'center' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  captionContainer: { alignItems: 'center', paddingHorizontal: 20, marginTop: 16 },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  segment: { marginHorizontal: 2, marginVertical: 2 },
  pillSegment: { borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 0, backgroundColor: colorPalette.white10 },
  regularText: { ...theme.typography.regular, overflow: 'hidden', lineHeight: 26, color: colorPalette.white80 },
  pillText: { ...theme.typography.regular, lineHeight: 26, color: colorPalette.white85 },
}));
