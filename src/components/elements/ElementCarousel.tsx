// Cosmos' ElementCarousel (module 2659): the viewer's list side by side in a native pager (PagerView, usePager's
// position + offset), one element a page; under it, in the same scroll, the similar grid. Each page is
// ElementViewerContainer: a column of topSpacer (grows and shrinks, at least spacing.sm) → the meta row, the media, the
// AI description → a spacer that grows, so the element sits in the middle of the screen between the header and the
// bar (bottomOverlayClearance). When the element with its description is taller than that, the carousel grows to it
// (Cosmos measures carouselHeight too) and the description is reached by scrolling. Only the pages near the one on
// screen are drawn (two each side), the ones next to it attached to the window, so a video there has its surface and
// first frame before it is swiped to (offscreenPageLimit).
import { forwardRef, useRef, useState } from 'react';
import { View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { StyleSheet } from 'react-native-unistyles';
import type { Element } from '../../lib/elements';
import { ElementDescription } from './ElementDescription';
import { ELEMENT_VIEWER_HEADER_HEIGHT, ELEMENT_VIEWER_HEADER_MEDIA_GAP, ElementMetaRow } from './ElementMetaRow';
import { ElementViewerMedia } from './ElementViewerMedia';

const DRAWN_AROUND = 2;
const PEEK_OFFSET = 0.01;
const MIN_TOP = 12; // topSpacer's minHeight (spacing.sm)

type Props = {
  elements: Element[];
  index: number;
  initialIndex: number;
  height: number;
  width: number;
  bottomOverlayClearance: number;
  onIndexChange: (index: number) => void;
  onIncoming: (index: number) => void; // a swipe has started bringing this page in
  onSettled: () => void; // the swipe has ended
};

// getMaxMediaHeight (module 2440): the viewer's height less the bar's clearance and the meta row with its gap
export const getMaxMediaHeight = (viewerHeight: number, bottomOverlayClearance: number, fallbackMaxHeight: number) => {
  const h = viewerHeight - bottomOverlayClearance - (ELEMENT_VIEWER_HEADER_HEIGHT + ELEMENT_VIEWER_HEADER_MEDIA_GAP);
  return h > 0 ? h : fallbackMaxHeight;
};

export const ElementCarousel = forwardRef<PagerView, Props>(function ElementCarousel(
  { elements, index, initialIndex, height, width, bottomOverlayClearance, onIndexChange, onIncoming, onSettled }, ref,
) {
  const maxHeight = getMaxMediaHeight(height, bottomOverlayClearance, height / 2);
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const active = elements[index];
  const selected = useRef(initialIndex);
  const pagerHeight = Math.max(height, active && contentHeights[active.id] ? contentHeights[active.id] + MIN_TOP + bottomOverlayClearance : 0);
  return (
    <PagerView ref={ref} style={{ height: pagerHeight, width }} initialPage={initialIndex} offscreenPageLimit={1}
      onPageSelected={(e) => { selected.current = e.nativeEvent.position; onIndexChange(e.nativeEvent.position); }}
      onPageScroll={(e) => {
        const { position, offset } = e.nativeEvent;
        const on = selected.current;
        if (position === on && offset > PEEK_OFFSET) onIncoming(on + 1);
        else if (position === on - 1 && offset < 1 - PEEK_OFFSET) onIncoming(on - 1);
      }}
      onPageScrollStateChanged={(e) => { if (e.nativeEvent.pageScrollState === 'idle') onSettled(); }}
    >
      {elements.map((element, i) => (
        <View key={element.id} style={[styles.page, { paddingBottom: bottomOverlayClearance }]}>
          {Math.abs(i - index) <= DRAWN_AROUND ? (
            <>
              <View style={styles.topSpacer} />
              <View onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                if (contentHeights[element.id] !== h) setContentHeights((m) => ({ ...m, [element.id]: h }));
              }}>
                <ElementMetaRow element={element} />
                <ElementViewerMedia element={element} maxWidth={width} maxHeight={maxHeight} inset={16} />
                {element.ai?.caption ? <ElementDescription caption={element.ai.caption} /> : null}
              </View>
              <View style={styles.spacer} />
            </>
          ) : null}
        </View>
      ))}
    </PagerView>
  );
});

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, flexDirection: 'column' },
  topSpacer: { flexGrow: 1, flexShrink: 1, minHeight: theme.spacing.sm },
  spacer: { flexGrow: 1 },
}));
