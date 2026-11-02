// Cosmos' ElementCarousel (module 2659): the viewer's list side by side in a native pager (PagerView, usePager's
// position + offset), one element a page; under it, in the same scroll, the similar grid. Each page is
// ElementViewerContainer: a column of topSpacer (grows and shrinks, at least spacing.sm) → the meta row, the media, the
// AI description → a spacer that grows, so the element sits in the middle of the screen between the header and the
// bar (bottomOverlayClearance). When the element with its description is taller than that, the carousel grows to it
// (Cosmos measures carouselHeight too) and the description is reached by scrolling. The column is centred in a box as
// high as the screen, not in the carousel: the carousel's height changes with the page on screen, and a page must not
// move when that happens (it bounced once its slide had ended). Only the pages near the one on
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
const MIN_TOP = 12; // topSpacer's minHeight (spacing.sm)

type Props = {
  elements: Element[];
  index: number;
  initialIndex: number;
  height: number;
  width: number;
  bottomOverlayClearance: number;
  onIndexChange: (index: number) => void;
  onIncoming: (index: number) => void; // the finger has let go and the slide is bringing this page in
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
  const incoming = useRef<number | null>(null);
  const pagerHeight = Math.max(height, active && contentHeights[active.id] ? contentHeights[active.id] + MIN_TOP + bottomOverlayClearance : 0);
  return (
    <PagerView ref={ref} style={{ height: pagerHeight, width }} initialPage={initialIndex} offscreenPageLimit={1}
      onPageSelected={(e) => { selected.current = e.nativeEvent.position; onIndexChange(e.nativeEvent.position); }}
      onPageScroll={(e) => {
        const { position, offset } = e.nativeEvent;
        const on = selected.current;
        incoming.current = position === on && offset > 0 ? on + 1 : position === on - 1 ? on - 1 : null;
      }}
      onPageScrollStateChanged={(e) => {
        const state = e.nativeEvent.pageScrollState;
        // not while the finger is on it: anything on the main thread then and the pager misreads the swipe and springs back
        if (state === 'settling' && incoming.current != null) onIncoming(incoming.current);
        if (state === 'idle') onSettled();
      }}
    >
      {elements.map((element, i) => (
        <View key={element.id} style={[styles.page, { paddingBottom: bottomOverlayClearance }]}>
          {Math.abs(i - index) <= DRAWN_AROUND ? (
            <View style={{ minHeight: height - bottomOverlayClearance }}>
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
            </View>
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
