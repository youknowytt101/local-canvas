// Cosmos' OrganizeClusterElementsScreen (module 3259), a collection's 整理 (its owner or someone working on it):
//   - a header row size.lg (40) high, spacing.md in, spacing.sm over and under: 取消 (largePlus, tertiary: back) on the
//     left, 选择 (largePlus, primary) in the middle, 选择全部 / 取消全选 (primary) on the right
//   - its elements as the two-column masonry grid (MasonryGrid, DEFAULT_GRID_GAP); pressing one chooses it
//     (SelectableImageCard: the media in a borderRadius.element corner with a hairline surfaceBorder outline; chosen, a 2
//     wide primary outline in the same corner and CheckIcon 16 (primary) spacing.xs from the top right)
//   - while nothing is chosen, a long press picks a tile up (useMasonryGridReorder): a copy of it (opacity 0.96, z 20)
//     follows the finger, the tile itself is hidden; let go over another tile and it takes that one's place
//     (useReorderClusterElement: ReorderClusterElement { elementId, insertAfterElementId })
//   - the bar (OrganizeClusterActionTabBarContent): 移动 (the save sheet in move mode) / 移除 (asked first with the
//     system's alert as Cosmos does: 这将从该收藏夹移除 N 个元素。, then toast 已从收藏夹移除) / 完成 (back)
// Near Cosmos: the other tiles do not shuffle while one is dragged (reorderShuffleLayoutAnimation), they move when it is
// let go; the grid does not scroll by itself near the edges while dragging; the question's words are the web page's.
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet as RNStyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HEIGHT_DEFAULT } from '../../components/bar/constants';
import { DEFAULT_GRID_GAP } from '../../components/home/ForYouFeed';
import { CheckIcon } from '../../components/icons';
import { useBarState } from '../../hooks/useBarState';
import { usePagedList } from '../../hooks/usePagedList';
import { api } from '../../lib/api';
import { markClusterChanged } from '../../lib/clusterChanges';
import { FEED_IMAGE_SCALE, tileImageUrl, tileRatio, type Element } from '../../lib/elements';
import type { BarActiveState } from '../../stores/useBarStore';
import { useMoveSheetStore } from '../../stores/useMoveSheetStore';
import { showToast } from '../../stores/useToastStore';

const NUM_COLUMNS = 2;
const LONG_PRESS_MS = 300;

export type OrganizeClusterParams = { clusterId: string; isFromSubCluster?: boolean };
type Drag = { id: string; url: string | null; width: number; height: number; x: number; y: number; listLeft: number; listTop: number };

export function OrganizeClusterScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { clusterId, isFromSubCluster = false } = useRoute<RouteProp<{ o: OrganizeClusterParams }, 'o'>>().params;
  const enc = encodeURIComponent(clusterId);
  const list = usePagedList<Element>(`/api/elements?cluster=${enc}`, 40);
  const [order, setOrder] = useState<Element[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const listRef = useRef<FlashListRef<Element>>(null);
  const scrollY = useRef(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const tileWidth = (width - (NUM_COLUMNS + 1) * DEFAULT_GRID_GAP) / NUM_COLUMNS;

  useEffect(() => { if (!drag) setOrder(list.items); }, [list.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const orderRef = useRef(order);
  orderRef.current = order;

  const toggle = useCallback((id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const allChosen = order.length > 0 && selected.size === order.length;

  // ---------- picking a tile up and putting it down ----------
  const startDrag = useCallback((el: Element, windowX: number, windowY: number) => {
    const index = orderRef.current.findIndex((e) => e.id === el.id);
    const layout = index >= 0 ? listRef.current?.getLayout(index) : undefined;
    if (!layout) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    tx.set(0);
    ty.set(0);
    setDrag({
      id: el.id, url: tileImageUrl(el, tileWidth, FEED_IMAGE_SCALE), width: layout.width, height: layout.height, x: windowX, y: windowY,
      listLeft: windowX - layout.x, listTop: windowY - layout.y + scrollY.current,
    });
  }, [tileWidth, tx, ty]);
  const endDrag = useCallback(async (d: Drag, dx: number, dy: number) => {
    setDrag(null);
    const items = orderRef.current;
    const from = items.findIndex((e) => e.id === d.id);
    const cx = d.x - d.listLeft + d.width / 2 + dx;
    const cy = d.y - d.listTop + scrollY.current + d.height / 2 + dy;
    let to = -1;
    for (let i = 0; i < items.length; i++) {
      const l = listRef.current?.getLayout(i);
      if (l && cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height) { to = i; break; }
    }
    if (from < 0 || to < 0 || to === from) return;
    const next = items.filter((e) => e.id !== d.id);
    next.splice(to, 0, items[from]); // past it when moving down, before it when moving up
    const after = to > 0 ? next[to - 1].id : null;
    setOrder(next);
    try {
      await api('POST', `/api/clusters/${enc}/reorder`, { elementId: d.id, after });
      markClusterChanged(clusterId);
    } catch (e) {
      setOrder(items);
      showToast({ text: e instanceof Error && e.message ? e.message : '没能移动' });
    }
  }, [enc, clusterId]);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const previewStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }, { translateY: ty.get() }] }));

  // ---------- the bar ----------
  const removeChosen = useCallback(() => {
    const ids = [...selected];
    if (!ids.length) return;
    Alert.alert('', `这将从该收藏夹移除 ${ids.length} 个元素。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除', style: 'destructive',
        onPress: () => void (async () => {
          try {
            await api('POST', '/api/elements/connections', { elementIds: ids, disconnect: [clusterId] });
            for (const id of ids) list.removeId(id);
            setSelected(new Set());
            markClusterChanged(clusterId);
            showToast({ text: '已从收藏夹移除' });
          } catch (e) {
            showToast({ text: e instanceof Error && e.message ? e.message : '删除元素失败' });
          }
        })(),
      },
    ]);
  }, [selected, clusterId, list]);
  const moveChosen = useCallback(() => {
    const ids = [...selected];
    const first = order.find((e) => selected.has(e.id));
    if (!first) return;
    useMoveSheetStore.getState().openMove(first, {
      elementIds: ids, fromClusterId: clusterId,
      onMoved: () => { for (const id of ids) list.removeId(id); setSelected(new Set()); markClusterChanged(clusterId); },
    });
  }, [selected, order, clusterId, list]);
  const barState = useMemo<BarActiveState>(() => ({
    type: 'organize', isFromSubCluster, selectedCount: selected.size, onMove: moveChosen, onRemove: removeChosen, onDone: () => navigation.goBack(),
  }), [isFromSubCluster, selected.size, moveChosen, removeChosen, navigation]);
  useBarState(barState);

  const renderItem = useCallback(({ item }: { item: Element }) => (
    <OrganizeTile
      element={item} width={tileWidth} chosen={selected.has(item.id)} hidden={drag?.id === item.id} reorderable={selected.size === 0}
      onPress={toggle} onDragStart={startDrag}
      onDragMove={(dx, dy) => { tx.set(dx); ty.set(dy); }}
      onDragEnd={(dx, dy) => { const d = dragRef.current; if (d) void endDrag(d, dx, dy); }}
    />
  ), [tileWidth, selected, drag?.id, toggle, startDrag, endDrag, tx, ty]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.back}>取消</Text>
        </Pressable>
        <Text style={styles.title}>选择</Text>
        <Pressable
          style={[styles.headerButton, styles.selectAll]}
          onPress={() => setSelected(allChosen ? new Set() : new Set(order.map((e) => e.id)))}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.selectAllText}>{allChosen ? '取消全选' : '选择全部'}</Text>
        </Pressable>
      </View>
      <FlashList
        ref={listRef}
        data={order}
        masonry
        numColumns={NUM_COLUMNS}
        keyExtractor={(e: Element) => e.id}
        renderItem={renderItem}
        extraData={[selected, drag?.id]}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        scrollEnabled={!drag}
        contentContainerStyle={{ paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HEIGHT_DEFAULT + DEFAULT_GRID_GAP }}
        ListEmptyComponent={list.loading ? <View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.tertiary} /></View> : null}
        ListFooterComponent={order.length && list.loading ? <View style={styles.footer}><ActivityIndicator color={theme.colors.tertiary} /></View> : null}
      />
      {drag ? (
        <Animated.View pointerEvents="none" style={[styles.dragPreview, { left: drag.x, top: drag.y, width: drag.width, height: drag.height }, previewStyle]}>
          <View style={styles.dragPreviewContent}>
            {drag.url ? <Image source={{ uri: drag.url }} style={styles.image} contentFit="cover" /> : <View style={[styles.image, styles.blank]} />}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

type TileProps = {
  element: Element; width: number; chosen: boolean; hidden: boolean; reorderable: boolean;
  onPress: (id: string) => void; onDragStart: (el: Element, x: number, y: number) => void;
  onDragMove: (dx: number, dy: number) => void; onDragEnd: (dx: number, dy: number) => void;
};

// SelectableImageCard in the organize grid
const OrganizeTile = memo(function OrganizeTile({ element, width, chosen, hidden, reorderable, onPress, onDragStart, onDragMove, onDragEnd }: TileProps) {
  const { theme } = useUnistyles();
  const url = tileImageUrl(element, width, FEED_IMAGE_SCALE);
  const ratio = element.type === 'note' ? 1 : tileRatio(element.width, element.height);
  const pan = Gesture.Pan()
    .enabled(reorderable)
    .runOnJS(true)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart((e) => onDragStart(element, e.absoluteX - e.x, e.absoluteY - e.y))
    .onUpdate((e) => onDragMove(e.translationX, e.translationY))
    .onEnd((e) => onDragEnd(e.translationX, e.translationY));
  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.cell, hidden && styles.hidden]}>
        <Pressable onPress={() => onPress(element.id)} accessibilityRole="checkbox" accessibilityState={{ checked: chosen }}>
          <View style={[styles.tile, { aspectRatio: ratio, backgroundColor: element.color ?? undefined }]}>
            {url ? (
              <Image source={{ uri: url }} placeholder={element.blurHash ? { blurhash: element.blurHash } : undefined} contentFit="cover"
                blurRadius={element.nsfw?.treatment === 'blur' ? 30 : 0} recyclingKey={element.id} style={styles.image} />
            ) : (
              <Text style={styles.note} numberOfLines={6}>{element.text ?? element.title ?? ''}</Text>
            )}
          </View>
          {chosen ? <View style={styles.selectionBorder} /> : null}
          {chosen ? <View style={styles.selectionIcon}><CheckIcon color={theme.colors.primary} size={16} /></View> : null}
        </Pressable>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', height: theme.size.lg, paddingHorizontal: theme.spacing.md, marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  headerButton: { flex: 1, height: '100%', justifyContent: 'center' },
  back: { ...theme.typography.largePlus, color: theme.colors.tertiary },
  title: { ...theme.typography.largePlus, color: theme.colors.primary },
  selectAll: { alignItems: 'flex-end' },
  selectAllText: { ...theme.typography.largePlus, color: theme.colors.primary },
  cell: { paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  hidden: { opacity: 0 },
  tile: {
    width: '100%', borderRadius: theme.borderRadius.element, overflow: 'hidden', backgroundColor: theme.colors.elevated,
    borderWidth: RNStyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder,
  },
  image: { width: '100%', height: '100%' },
  blank: { backgroundColor: theme.colors.elevated },
  note: { ...theme.typography.regular, color: theme.colors.primary, padding: theme.spacing.sm },
  selectionBorder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.element },
  selectionIcon: { position: 'absolute', top: theme.spacing.xs, right: theme.spacing.xs },
  dragPreview: { position: 'absolute', zIndex: 20, opacity: 0.96 },
  dragPreviewContent: { flex: 1, padding: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  loading: { paddingTop: theme.spacing.xxxxl, alignItems: 'center' },
  footer: { paddingVertical: theme.spacing.xl, alignItems: 'center' },
}));
