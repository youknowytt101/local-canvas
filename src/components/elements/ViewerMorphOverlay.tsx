// The picture flying between a tile and the viewer's media (lib/viewerMorph), drawn over every screen and under the bar
// (RootNavigator). It is the tile's own copy (already loaded), cover-cropped into a box that moves, sizes and rounds
// from the one to the other. Also where the viewer's media will be is worked out here, from the viewer's layout.
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet as RNStyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tileRatio, type Element } from '../../lib/elements';
import { morphFrom, morphProgress, morphShown, morphTo, setMorphPredictor, useViewerMorph } from '../../lib/viewerMorph';
import { ELEMENT_VIEWER_HEADER_CONTENT_HEIGHT } from '../../screens/elements/ElementsViewerScreen';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HEIGHT_DEFAULT } from '../bar/constants';
import { getMaxMediaHeight, MIN_TOP } from './ElementCarousel';
import { ELEMENT_VIEWER_HEADER_HEIGHT, ELEMENT_VIEWER_HEADER_MEDIA_GAP } from './ElementMetaRow';
import { getSnappedContainFittedSize } from './ElementViewerMedia';

const DESCRIPTION_GUESS = 16 + 24 * 2 + 4; // ElementDescription: spacing.md over its two rows

export function ViewerMorphOverlay() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    // ElementsViewerScreen → ElementCarousel → ElementViewerContainer: the column is centred in the carousel less the
    // bar's clearance, the meta row over the media, the description under it
    setMorphPredictor((el: Element) => {
      const headerHeight = insets.top + ELEMENT_VIEWER_HEADER_CONTENT_HEIGHT;
      const carouselHeight = height - headerHeight;
      const clearance = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HEIGHT_DEFAULT;
      const aspect = el.mediaKind === 'video' && !el.width ? 9 / 16 : tileRatio(el.width, el.height);
      const size = getSnappedContainFittedSize(width, getMaxMediaHeight(carouselHeight, clearance, carouselHeight / 2), aspect, 16);
      const above = ELEMENT_VIEWER_HEADER_HEIGHT + ELEMENT_VIEWER_HEADER_MEDIA_GAP;
      const content = above + size.height + (el.ai?.caption ? DESCRIPTION_GUESS : 0);
      const top = headerHeight + Math.max(MIN_TOP, (carouselHeight - clearance - content) / 2);
      return { x: (width - size.width) / 2, y: top + above, w: size.width, h: size.height };
    }, { width, height });
  }, [width, height, insets.top, insets.bottom]);

  const { phase, image, blurred } = useViewerMorph();
  const style = useAnimatedStyle(() => {
    const p = morphProgress.value;
    const f = morphFrom.value;
    const at = (a: number, b: number) => a + (b - a) * p;
    return {
      left: at(f.x, morphTo.x.value),
      top: at(f.y, morphTo.y.value),
      width: at(f.w, morphTo.w.value),
      height: at(f.h, morphTo.h.value),
      borderRadius: at(f.r, morphTo.r.value),
    };
  });
  if (phase === 'idle' || !image) return null;
  return (
    <Animated.View style={[styles.box, style]} pointerEvents="none">
      <Image source={{ uri: image }} contentFit="cover" transition={0} blurRadius={blurred ? 30 : 0} style={RNStyleSheet.absoluteFill} onDisplay={morphShown} />
    </Animated.View>
  );
}

const styles = RNStyleSheet.create({
  box: { position: 'absolute', overflow: 'hidden' },
});
