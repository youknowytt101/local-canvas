// Cosmos' AllElementsScreen (AllElements, in SettingsNavigator; opened from SettingHeaderCard): everything the user saved
// (allElementsV2) in the two-column masonry grid, under the header's 查看画布 (GridIcon) and a list header with 所有元素
// and "N 保存" (settings.allElements / allElementsDescription). Pressing a tile opens the viewer on this list
// (userInteractionSource AllElements); a long press opens the save sheet (ElementTile).
// Near Cosmos: the viewer is pushed on the settings stack (Cosmos goes through its parent to the Explore tab's stack, and
// the way back would leave the settings); the list header's sizes are the web page's. Not here: AllElementsSearchOverlay
// (the header's search) and the web page's 删除 in the viewer's menu.
import { FlashList } from '@shopify/flash-list';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../../components/bar/constants';
import { ElementTile } from '../../components/elements/ElementTile';
import { DEFAULT_GRID_GAP } from '../../components/home/ForYouFeed';
import { PROFILE_IMAGE_SCALE } from '../../components/profile/ProfileElementGrid';
import { SettingsHeader } from '../../components/settings/SettingsParts';
import { GridIcon } from '../../components/icons';
import { usePagedList } from '../../hooks/usePagedList';
import type { Element } from '../../lib/elements';
import { noteGridMoved } from '../../lib/gridVideos';
import { openElementViewer } from '../../lib/openElementViewer';
import { pushInfiniteCanvas } from '../../lib/openInfiniteCanvas';

const NUM_COLUMNS = 2;
const PAGE_SIZE = 30; // CLUSTER_ELEMENT_PAGE_SIZE
const SCOPE = { scope: 'all' };

export function AllElementsScreen() {
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const list = usePagedList<Element>('/api/elements', PAGE_SIZE, SCOPE);
  const tileWidth = (width - (NUM_COLUMNS + 1) * DEFAULT_GRID_GAP) / NUM_COLUMNS;

  const listNow = useRef(list);
  listNow.current = list;
  const onPress = useCallback((el: Element) => {
    const l = listNow.current;
    openElementViewer(navigation, {
      elements: l.items, initialIndex: Math.max(0, l.items.findIndex((e) => e.id === el.id)), hasMore: !l.done,
      loadMore: () => listNow.current.loadMore(), userInteractionSource: 'AllElements',
    });
  }, [navigation]);
  const renderItem = useCallback(({ item }: { item: Element }) => (
    <View style={styles.cell}>
      <ElementTile element={item} width={tileWidth} imageScale={PROFILE_IMAGE_SCALE} onPress={onPress} />
    </View>
  ), [tileWidth, onPress]);

  return (
    <View style={styles.screen}>
      <SettingsHeader title="" right={(
        <Pressable style={styles.canvas} onPress={() => pushInfiniteCanvas({ source: 'all' })} accessibilityRole="button" accessibilityLabel="查看画布" hitSlop={4}>
          <GridIcon color={theme.colors.primary} />
        </Pressable>
      )} />
      <FlashList
        data={list.items}
        masonry
        numColumns={NUM_COLUMNS}
        keyExtractor={(e: Element) => e.id}
        renderItem={renderItem}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.6}
        onScroll={noteGridMoved}
        scrollEventThrottle={100}
        contentContainerStyle={{
          paddingHorizontal: DEFAULT_GRID_GAP / 2,
          paddingBottom: insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + DEFAULT_GRID_GAP,
        }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.refresh()} tintColor={theme.colors.tertiary} />}
        ListHeaderComponent={(
          <View style={styles.titleWrap}>
            <Text style={styles.title}>所有元素</Text>
            {list.count != null ? <Text style={styles.meta}>{list.count} 保存</Text> : null}
          </View>
        )}
        ListEmptyComponent={list.loading ? <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} /> : null}
        ListFooterComponent={list.loading && list.items.length ? <ActivityIndicator color={theme.colors.tertiary} style={styles.footer} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  canvas: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevated },
  cell: { paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  titleWrap: { alignItems: 'center', gap: theme.spacing.xxs, paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.lg },
  title: { ...theme.typography.headingLarge, color: theme.colors.primary },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary },
  loading: { marginTop: theme.spacing.xl },
  footer: { paddingVertical: theme.spacing.lg },
}));
