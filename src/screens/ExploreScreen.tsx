// Cosmos' ExploreScreen (module 3207 ExploreTabContent in a SwipeableTabView) as the person kept it on the web page
// (HANDOFF 6.56 / 6.72, chosen again for the app on 2026-11-02): the tabs are 精选 / 视频 / 图片 / 文字 (cosmos-lite has
// none of Cosmos' server categories), and there is no search header — the tab row is the page's top row, left-aligned,
// without an underline, its background reaching up under the status bar.
//   - each tab: everyone else's classified elements, most popular first (GET /api/elements?type=…&sort=popular&
//     scope=others), the two-column masonry grid (ClusterElementGrid), userInteractionSource Explore; a tab's list is
//     asked for the first time it is shown
//   - 精选 has ExploreTabContent's carousel of FeaturedCollectionCards over its grid (GET /api/explore/featured: the
//     collections an administrator picked, then other people's, then your own); with none that has a cover, the web
//     page's placeholder cards 合集 A–D. Near the web page: a placeholder card opens nothing here
//   - swiping or pressing a tab changes the page, the tabs' colour following the pager (TabTsx1); pressing the Explore
//     tab again scrolls the page on screen back to the top (useTabReselect)
import type { FlashListRef } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../components/bar/constants';
import { ClusterElementGrid } from '../components/clusters/ClusterElementGrid';
import type { Collection } from '../components/clusters/CollectionCard';
import { DEFAULT_GRID_GAP } from '../components/home/ForYouFeed';
import { usePagedList } from '../hooks/usePagedList';
import { get } from '../lib/api';
import type { Element } from '../lib/elements';
import { noteGridMoved } from '../lib/gridVideos';
import { absoluteUrl } from '../lib/server';
import { Routes } from '../navigation/routes';
import { useSessionStore } from '../stores/useSessionStore';
import { SCROLL_AT_TOP_THRESHOLD, useTabReselect } from '../hooks/useTabReselect';

const TABS = [
  { key: 'featured', label: '精选', type: 'all' },
  { key: 'videos', label: '视频', type: 'videos' },
  { key: 'images', label: '图片', type: 'images' },
  { key: 'notes', label: '文字', type: 'notes' },
] as const;
const PAGE_SIZE = 40;
const HORIZONTAL_PADDING = 16;
// FeaturedCollectionCardContent: three pictures 2 apart, 136 high, at most 252 wide
const FEATURED_HEIGHT = 136;
const FEATURED_MAX_WIDTH = 252;
const FEATURED_GAP = 12;

type Featured = { cluster: Collection; user?: { fullName?: string; username?: string } | null };

export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const lists = useRef<(FlashListRef<Element> | null)[]>([]);
  const refreshers = useRef<((() => void) | null)[]>([]);
  const bottomInset = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + DEFAULT_GRID_GAP;

  // the explore tab pressed again: the page on screen reloads at its top, else scrolls up
  useTabReselect({
    tab: Routes.EXPLORE,
    isActive: () => true,
    isAtTop: () => (lists.current[page]?.getAbsoluteLastScrollOffset() ?? 0) <= SCROLL_AT_TOP_THRESHOLD,
    refresh: () => refreshers.current[page]?.(),
    scrollToTop: () => lists.current[page]?.scrollToOffset({ offset: 0, animated: true }),
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.tabRow, { paddingTop: insets.top }]}>
        {TABS.map((t, i) => <ExploreTab key={t.key} label={t.label} index={i} pagerX={pagerX} onPress={() => pager.current?.setPage(i)} />)}
      </View>
      <PagerView
        ref={pager}
        style={styles.pager}
        initialPage={0}
        onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => {
          const i = e.nativeEvent.position;
          setPage(i);
          noteGridMoved();
          setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
        }}
      >
        {TABS.map((t, i) => (
          <View key={t.key} style={styles.page}>
            <ExploreTabContent type={t.type} shown={seen.has(i)} featured={t.key === 'featured'} bottomInset={bottomInset}
              listRef={(r) => { lists.current[i] = r; }} refreshRef={(r) => { refreshers.current[i] = r; }} />
          </View>
        ))}
      </PagerView>
    </View>
  );
}

// the web page's .page-tabs button: largePlus, tertiary going to primary as the pager reaches it
function ExploreTab({ label, index, pagerX, onPress }: { label: string; index: number; pagerX: SharedValue<number>; onPress: () => void }) {
  const { theme } = useUnistyles();
  const primary = theme.colors.primary;
  const tertiary = theme.colors.tertiary;
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(pagerX.get(), [index - 1, index, index + 1], [tertiary, primary, tertiary]),
  }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" style={styles.tab}>
      <Animated.Text style={[styles.tabText, color]} numberOfLines={1}>{label}</Animated.Text>
    </Pressable>
  );
}

function ExploreTabContent({ type, shown, featured, bottomInset, listRef, refreshRef }: {
  type: string; shown: boolean; featured: boolean; bottomInset: number; listRef: (r: FlashListRef<Element> | null) => void;
  refreshRef: (refresh: (() => void) | null) => void;
}) {
  const list = usePagedList<Element>(shown ? `/api/elements?type=${type}&sort=popular&scope=others` : null, PAGE_SIZE);
  const ref = useRef<FlashListRef<Element>>(null);
  useEffect(() => { listRef(ref.current); refreshRef(() => { void list.refresh(); }); });
  return (
    <ClusterElementGrid
      list={list}
      listRef={ref}
      source="Explore"
      header={featured ? <FeaturedCarousel /> : null}
      topInset={featured ? 0 : DEFAULT_GRID_GAP}
      bottomInset={bottomInset}
      empty={{ title: '没有内容', hint: featured ? '库里还没有内容。' : '这个分类暂时没有内容。' }}
    />
  );
}

// ExploreTabContent's carousel: FeaturedCollectionCards side by side, snapping card by card
function FeaturedCarousel() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const me = useSessionStore((s) => s.me?.id ?? null);
  const [items, setItems] = useState<Featured[] | null>(null);
  useEffect(() => {
    let live = true;
    get<{ items: Featured[] }>('/api/explore/featured').then((r) => { if (live) setItems(r.items); }, () => { if (live) setItems((x) => x ?? []); });
    return () => { live = false; };
  }, []);
  if (!items) return <View style={styles.carouselSpace} />;
  const cardWidth = Math.min(FEATURED_MAX_WIDTH, width - 2 * HORIZONTAL_PADDING - 48);
  const withCovers = items.filter((x) => x.cluster.covers?.length);
  const open = (c: Collection) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: c.id } } });
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + FEATURED_GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.carousel}
    >
      {withCovers.length
        ? withCovers.map(({ cluster: c, user }) => (
          <FeaturedCard key={c.id} width={cardWidth} covers={(c.covers ?? []).slice(0, 3).map((u) => absoluteUrl(u))} title={c.name}
            subtitle={`${c.count} 元素${c.ownerId !== me && user ? ` · ${user.fullName || user.username}` : ''}`} onPress={() => open(c)} />
        ))
        : ['A', 'B', 'C', 'D'].map((l) => <FeaturedCard key={l} width={cardWidth} covers={[]} title={`合集 ${l}`} subtitle="N 元素" />)}
    </ScrollView>
  );
}

// FeaturedCollectionCardContent in a PressScaleContainer: three pictures 2 apart in a rounded frame, the title and the
// count under it
function FeaturedCard({ width, covers, title, subtitle, onPress }: { width: number; covers: string[]; title: string; subtitle: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ width }, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.images}>
        {[0, 1, 2].map((i) => (covers[i]
          ? <Image key={i} source={{ uri: covers[i] }} contentFit="cover" style={styles.image} />
          : <View key={i} style={styles.image} />))}
      </View>
      <Text style={styles.featuredTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.featuredSub} numberOfLines={1}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  tabRow: { flexDirection: 'row', paddingHorizontal: HORIZONTAL_PADDING - 8, backgroundColor: theme.colors.background, zIndex: 1 },
  tab: { paddingTop: 10, paddingBottom: 9, paddingHorizontal: 12 },
  tabText: { ...theme.typography.largePlus },
  pager: { flex: 1 },
  page: { flex: 1 },
  carouselSpace: { height: 16 + FEATURED_HEIGHT + 8 + 16 + 2 + 18 + 20 },
  carousel: { gap: FEATURED_GAP, paddingTop: 16, paddingBottom: 20, paddingHorizontal: HORIZONTAL_PADDING },
  pressed: { transform: [{ scale: 0.98 }] },
  images: {
    flexDirection: 'row', gap: 2, height: FEATURED_HEIGHT, overflow: 'hidden', borderRadius: theme.borderRadius.md,
    boxShadow: theme.shadows.default, borderWidth: 0.5, borderColor: theme.colors.surfaceBorder,
  },
  image: { flex: 1, height: '100%', backgroundColor: theme.colors.elevated },
  featuredTitle: { ...theme.typography.regularPlus, lineHeight: 16, paddingTop: 8, paddingLeft: 4, marginBottom: 2, color: theme.colors.primary },
  featuredSub: { ...theme.typography.regular, lineHeight: 18, paddingLeft: 4, color: theme.colors.tertiary },
}));
