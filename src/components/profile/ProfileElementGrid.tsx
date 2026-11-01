// Cosmos' ProfileElementGrid (module 3305): the profile's elements as the two-column masonry grid (DEFAULT_GRID_GAP
// 12), under the profile's header (a spacer as high as the header). Pressing a tile opens the viewer on this list
// (userInteractionSource ProfileOwn), which pages on with it; a long press opens the save sheet (ElementTile).
// No elements: ProfileElementEmptyState's words (您的品味，尽显 / 保存元素以塑造您的个人资料。); its layout and its
// 探索宇宙 button are near / not done.
// It stays tall enough for the header to fold away however few elements there are (useProfileTabScrollSync's
// minimum content height).
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { DEFAULT_GRID_GAP } from '../home/ForYouFeed';
import { ElementTile } from '../elements/ElementTile';
import type { Element } from '../../lib/elements';
import { openElementViewer } from '../../lib/openElementViewer';
import type { usePagedList } from '../../hooks/usePagedList';
import type { ProfileListProps } from './profileLists';

export const PROFILE_IMAGE_SCALE = 1.2;
const NUM_COLUMNS = 2;

type Props = ProfileListProps & {
  list: ReturnType<typeof usePagedList<Element>>;
  listRef: React.RefObject<FlashListRef<Element> | null>;
};

export function ProfileElementGrid({ list, listRef, headerHeight, headerScrollMax, viewport, bottomInset, onScroll, refreshing, onRefresh }: Props) {
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const tileWidth = (width - (NUM_COLUMNS + 1) * DEFAULT_GRID_GAP) / NUM_COLUMNS;
  const [contentHeight, setContentHeight] = useState(0);

  const listNow = useRef(list);
  listNow.current = list;
  const onPress = useCallback((el: Element) => {
    const l = listNow.current;
    openElementViewer(navigation, {
      elements: l.items, initialIndex: Math.max(0, l.items.findIndex((e) => e.id === el.id)), hasMore: !l.done,
      loadMore: () => listNow.current.loadMore(), userInteractionSource: 'ProfileOwn',
    });
  }, [navigation]);
  const renderItem = useCallback(({ item }: { item: Element }) => (
    <View style={styles.cell}>
      <ElementTile element={item} width={tileWidth} imageScale={PROFILE_IMAGE_SCALE} onPress={onPress} />
    </View>
  ), [tileWidth, onPress]);

  // the room the header needs to fold away when the grid is shorter than the screen
  const filler = Math.max(0, viewport + headerScrollMax - contentHeight);
  const empty = list.items.length === 0;
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
      onScroll={onScroll}
      scrollEventThrottle={16}
      onContentSizeChange={(_, h) => setContentHeight(h - filler)}
      style={styles.list}
      contentContainerStyle={{ paddingTop: headerHeight + DEFAULT_GRID_GAP, paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: bottomInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerHeight} tintColor={theme.colors.tertiary} />}
      ListEmptyComponent={
        list.loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.tertiary} /></View>
          : list.done ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>您的品味，尽显</Text>
              <Text style={styles.emptyHint}>保存元素以塑造您的个人资料。</Text>
            </View>
          ) : null
      }
      ListFooterComponent={
        <>
          {!empty && list.loading ? <View style={styles.footer}><ActivityIndicator color={theme.colors.tertiary} /></View> : null}
          <View style={{ height: filler }} />
        </>
      }
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  cell: { paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  loading: { paddingTop: theme.spacing.xxxxl, alignItems: 'center' },
  emptyState: { alignItems: 'center', gap: theme.spacing.xxs, paddingTop: theme.spacing.xxxxl },
  emptyTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  emptyHint: { ...theme.typography.regular, color: theme.colors.tertiary },
  footer: { paddingVertical: theme.spacing.lg, alignItems: 'center' },
}));
