// Cosmos' ClusterElementGrid / ClusterSimilarElementsGrid (modules 3264 / 3271): a collection's elements, or the ones
// like them, as the two-column masonry grid (DEFAULT_GRID_GAP 12, imageScale FEED_IMAGE_SCALE 1.5), more asked for one
// screen before the end. Pressing a tile opens the viewer on this list with its userInteractionSource (CollectionOwn,
// ClusterRecommendations), paging on with it; a long press opens the save sheet (ElementTile).
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useRef, type ReactElement } from 'react';
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { usePagedList } from '../../hooks/usePagedList';
import { FEED_IMAGE_SCALE, type Element } from '../../lib/elements';
import { noteGridMoved } from '../../lib/gridVideos';
import { openElementViewer } from '../../lib/openElementViewer';
import { ElementTile } from '../elements/ElementTile';
import { DEFAULT_GRID_GAP } from '../home/ForYouFeed';

const NUM_COLUMNS = 2;

type Props = {
  list: ReturnType<typeof usePagedList<Element>>;
  listRef?: React.RefObject<FlashListRef<Element> | null>;
  source: string;
  removeFrom?: string | null; // the collection one may take its elements out of
  header?: ReactElement | null;
  empty?: { title: string; hint: string } | null; // none: nothing when there are none
  topInset: number;
  bottomInset: number;
};

export function ClusterElementGrid({ list, listRef, source, removeFrom, header, empty, topInset, bottomInset }: Props) {
  const { theme } = useUnistyles();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const tileWidth = (width - (NUM_COLUMNS + 1) * DEFAULT_GRID_GAP) / NUM_COLUMNS;
  const listNow = useRef(list);
  listNow.current = list;
  const onPress = useCallback((el: Element) => {
    const l = listNow.current;
    openElementViewer(navigation, {
      elements: l.items, initialIndex: Math.max(0, l.items.findIndex((e) => e.id === el.id)), hasMore: !l.done,
      loadMore: () => listNow.current.loadMore(), userInteractionSource: source,
      ...(removeFrom ? { remove: { kind: 'cluster' as const, clusterId: removeFrom }, onRemoved: (id: string) => listNow.current.removeId(id) } : {}),
    });
  }, [navigation, source, removeFrom]);
  const renderItem = useCallback(({ item }: { item: Element }) => (
    <View style={styles.cell}>
      <ElementTile element={item} width={tileWidth} imageScale={FEED_IMAGE_SCALE} onPress={onPress} />
    </View>
  ), [tileWidth, onPress]);
  const none = list.items.length === 0;
  return (
    <FlashList
      ref={listRef}
      data={list.items}
      masonry
      numColumns={NUM_COLUMNS}
      keyExtractor={(e: Element) => e.id}
      renderItem={renderItem}
      onEndReached={list.loadMore}
      onEndReachedThreshold={1}
      onScroll={noteGridMoved}
      scrollEventThrottle={100}
      drawDistance={height}
      style={styles.list}
      contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: bottomInset }}
      ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : null}
      ListEmptyComponent={
        list.loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.tertiary} /></View>
          : list.done && empty ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{empty.title}</Text>
              <Text style={styles.emptyHint}>{empty.hint}</Text>
            </View>
          ) : null
      }
      ListFooterComponent={!none && list.loading ? <View style={styles.footer}><ActivityIndicator color={theme.colors.tertiary} /></View> : null}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  header: { marginHorizontal: -DEFAULT_GRID_GAP / 2 },
  cell: { paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  loading: { paddingTop: theme.spacing.xxxxl, alignItems: 'center' },
  emptyState: { alignItems: 'center', gap: theme.spacing.xxs, paddingTop: theme.spacing.xxxxl },
  emptyTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  emptyHint: { ...theme.typography.regular, color: theme.colors.tertiary },
  footer: { paddingVertical: theme.spacing.lg, alignItems: 'center' },
}));
