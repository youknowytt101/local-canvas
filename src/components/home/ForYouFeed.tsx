// Cosmos' ForYouFeed (module 3455): For You as a two-column masonry grid (MasonryGrid, module 2325: FlashList 2
// `masonry`, DEFAULT_GRID_GAP 12 between the tiles and round the grid, imageScale FEED_IMAGE_SCALE 1.5, more asked for
// one screen before the end, a screen drawn ahead), under the floating home header (contentTopInset). No skeleton
// (Cosmos passes none here).
//   - impressions (useListImpressionTracking): userInteractionSource ForYou with the item's slateId, once per stretch on
//     screen, from when the tile's picture has loaded, and only once the server has answered the first request
//   - how far it was seen (useForYouViewportAck, module 3461): the bottom of the screen in the list's coordinates; from
//     the tile after the last one seen, every tile whose bottom is above it in the list's order; the first look after
//     the list starts is the baseline (not reported), later ones move the position (kept in MMKV, sent with every
//     request); leaving (another page, Following, the background) acknowledges it (AcknowledgeForYouViewed)
//   - pressing the tab again scrolls it back to the top and shows the header
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, AppState, RefreshControl, useWindowDimensions, View, type ViewToken } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { gql } from '../../lib/auth';
import { FEED_IMAGE_SCALE, type Element } from '../../lib/elements';
import { viewedPosition } from '../../lib/feedCache';
import { ListImpressions, impressionsScrollEnded } from '../../lib/impressions';
import { openElementViewer } from '../../lib/openElementViewer';
import { useForYouFeed } from '../../hooks/useForYouFeed';
import { useForYouCanvasStore } from '../../stores/useForYouCanvasStore';
import type { PageScrollHandlers } from '../../hooks/useHomeChrome';
import { ElementTile } from '../elements/ElementTile';
import { HomeFeedEmptyState } from './HomeFeedEmptyState';

export const DEFAULT_GRID_GAP = 12;
const NUM_COLUMNS = 2;
const VIEWABILITY = { itemVisiblePercentThreshold: 1 };

type Props = {
  userId: string | null;
  active: boolean; // its page is the one on screen
  contentTopInset: number;
  bottomInset: number;
  scrollHandlers: PageScrollHandlers;
  lookRef: React.MutableRefObject<((y: number) => void) | null>; // set here: the screen calls it on every scroll
  listRef: React.RefObject<FlashListRef<Element> | null>;
  onRefreshStart?: () => void;
};

export function ForYouFeed({ userId, active, contentTopInset, bottomInset, scrollHandlers, lookRef, listRef, onRefreshStart }: Props) {
  const { theme } = useUnistyles();
  const { width, height: windowHeight } = useWindowDimensions();
  const focused = useIsFocused();
  const feed = useForYouFeed(userId);
  // the canvas the home logo opens shows this same list (useForYouCanvasStore)
  useEffect(() => {
    useForYouCanvasStore.setState({ items: feed.items, hasMore: !feed.done && feed.firstResolved, loading: feed.loading, loadMore: feed.loadMore });
  }, [feed.items, feed.done, feed.firstResolved, feed.loading, feed.loadMore]);
  const tileWidth = (width - (NUM_COLUMNS + 1) * DEFAULT_GRID_GAP) / NUM_COLUMNS;
  const showing = active && focused;
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  // ---------- impressions ----------
  const impressions = useMemo(() => new ListImpressions<Element>(
    (el) => ({ targetType: 'Element', targetId: el.id, userInteractionSource: 'ForYou', slateId: el.slateId }), true, false), []);
  useEffect(() => () => impressions.dispose(), [impressions]);
  useEffect(() => { impressions.setEnabled(feed.firstResolved && showing); }, [impressions, feed.firstResolved, showing]);
  useEffect(() => { impressions.reset(); }, [impressions, feed.generation]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Element>[] }) => {
    impressions.setVisible(viewableItems.filter((v) => v.item).map((v) => [v.item!.id, v.item!]));
  }).current;
  const onMediaReady = useCallback((id: string) => impressions.markMediaReady(id), [impressions]);

  // ---------- how far it was seen ----------
  const seen = useRef({ index: -1, id: null as string | null, baseline: true, reported: false });
  const items = useRef(feed.items);
  items.current = feed.items;
  useEffect(() => { seen.current = { index: -1, id: null, baseline: true, reported: false }; }, [feed.generation]);
  const listHeight = useRef(windowHeight);
  const look = useCallback((scrollY: number) => {
    const list = listRef.current;
    if (!list || !showing) return;
    const viewportBottom = scrollY - contentTopInset + listHeight.current;
    const s = seen.current;
    let i = s.id ? items.current.findIndex((e) => e.id === s.id) : -1; // updateOrder
    const before = i;
    while (i + 1 < items.current.length) {
      const layout = list.getLayout(i + 1);
      if (!layout || !layout.height || layout.y + layout.height > viewportBottom) break;
      i++;
    }
    s.index = i;
    s.id = i >= 0 ? items.current[i].id : null;
    if (s.baseline) s.baseline = false;
    else if (i > before) s.reported = true;
    if (s.reported && s.id && s.id !== viewedPosition.get()) viewedPosition.set(s.id);
  }, [listRef, showing, contentTopInset]);
  lookRef.current = look;

  // leaving the grid acknowledges the position (useAcknowledgeForYouViewedOnDeparture)
  useEffect(() => {
    const ack = () => {
      const id = viewedPosition.get();
      if (!id || id === viewedPosition.acked()) return;
      viewedPosition.setAcked(id);
      gql('mutation', 'AcknowledgeForYouViewed', 'acknowledgeForYouViewed', { input: { elementId: id } })
        .catch(() => { if (viewedPosition.acked() === id) viewedPosition.setAcked(null); });
    };
    if (!showing) { ack(); return; }
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') ack(); });
    return () => sub.remove();
  }, [showing]);

  // the page left: its tiles are off screen
  useEffect(() => { if (!showing) impressions.setVisible([]); }, [impressions, showing]);

  // useOpenElementViewer: the viewer gets the whole list and pages on with it (more For You as it nears the end)
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const onPress = useCallback((el: Element) => {
    const f = feedRef.current;
    openElementViewer(navigation, {
      elements: f.items, initialIndex: Math.max(0, f.items.findIndex((e) => e.id === el.id)), hasMore: !f.done,
      loadMore: () => feedRef.current.loadMore(), userInteractionSource: 'ForYou',
    });
  }, [navigation]);
  const renderItem = useCallback(({ item }: { item: Element }) => (
    <View style={styles.cell}>
      <ElementTile element={item} width={tileWidth} imageScale={FEED_IMAGE_SCALE} onMediaReady={onMediaReady} onPress={onPress} />
    </View>
  ), [tileWidth, onMediaReady, onPress]);

  const empty = feed.items.length === 0;
  return (
    <FlashList
      ref={listRef}
      data={feed.items}
      masonry
      numColumns={NUM_COLUMNS}
      keyExtractor={(e: Element) => e.id}
      renderItem={renderItem}
      onEndReached={feed.loadMore}
      onEndReachedThreshold={1}
      drawDistance={windowHeight}
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={onViewableItemsChanged}
      {...scrollHandlers}
      scrollEventThrottle={16}
      onMomentumScrollEnd={(e) => { scrollHandlers.onMomentumScrollEnd(e); impressionsScrollEnded(); }}
      onLayout={(e) => { listHeight.current = e.nativeEvent.layout.height; }}
      style={styles.list}
      contentContainerStyle={{ paddingTop: contentTopInset + DEFAULT_GRID_GAP, paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: bottomInset }}
      refreshControl={
        <RefreshControl refreshing={feed.refreshing} progressViewOffset={contentTopInset} tintColor={theme.colors.tertiary}
          onRefresh={() => { onRefreshStart?.(); void feed.refresh(); }} />
      }
      ListEmptyComponent={
        feed.loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.tertiary} /></View>
          : feed.error ? <HomeFeedEmptyState kind="error" onRetry={feed.retry} />
            : feed.done && empty ? <HomeFeedEmptyState kind="for-you" /> : null
      }
      ListFooterComponent={!empty && feed.loading ? <View style={styles.footer}><ActivityIndicator color={theme.colors.tertiary} /></View> : null}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  cell: { paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  loading: { paddingTop: theme.spacing.xxxxl, alignItems: 'center' },
  footer: { paddingVertical: theme.spacing.lg, alignItems: 'center' },
}));

