// Cosmos' SearchResults (module 3500) after a search is submitted: three tabs (TopTabBar, swipeable:
// SwipeableTabViewComponent) — 元素 / 收藏 / 用户 (common.elements / clusters / profiles; with the shop's flags on, Cosmos
// has 元素 / 商品 / 收藏, off by default and here) — over their pages:
//   - 元素 (SearchElementsTab): everyone's elements matching it, the masonry grid, userInteractionSource Search; none:
//     没有找到结果 · 尝试别的东西 (explore.searchElementsEmptyTitle / searchEmptyHint)
//   - 收藏 (SearchClustersTab, ClusterGrid): everyone's collections it finds, two columns; none: 没有找到合集
//   - 用户 (SearchProfilesTab): UserActivity rows (avatar, name, @username, no follow button); none: 未找到个人资料
// The collection and people tabs are asked for when first shown. Opening a collection or a person remembers it.
// With a colour searched there are no tabs: only the elements of that colour (and of the words, if any) — SearchResults'
// searchColor branch, ElementsScene alone.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { usePagedList } from '../../hooks/usePagedList';
import { get } from '../../lib/api';
import type { Element } from '../../lib/elements';
import { noteGridMoved } from '../../lib/gridVideos';
import { ClusterElementGrid } from '../clusters/ClusterElementGrid';
import { CollectionCard, type Collection } from '../clusters/CollectionCard';
import { DEFAULT_GRID_GAP } from '../home/ForYouFeed';
import { Avatar } from '../profile/ProfileInfo';
import { ProfileTabBar } from '../profile/ProfileTabBar';
import type { Person } from './SearchTypeahead';

type Props = {
  term: string; origin: 'search_box' | 'caption'; color?: string | null; topInset: number; bottomInset: number;
  onCluster: (c: Collection) => void; onUser: (p: Person) => void;
};

export function SearchResults({ color, ...rest }: Props) {
  if (color) return <ColorResults color={color} term={rest.term} origin={rest.origin} topInset={rest.topInset} bottomInset={rest.bottomInset} />;
  return <TermResults {...rest} />;
}

function ColorResults({ color, term, origin, topInset, bottomInset }: { color: string; term: string; origin: string; topInset: number; bottomInset: number }) {
  const elements = usePagedList<Element>(`/api/elements?q=${encodeURIComponent(term)}&origin=${origin}&color=${color}`, 40);
  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <ClusterElementGrid list={elements} source="Search" topInset={DEFAULT_GRID_GAP} bottomInset={bottomInset} empty={{ title: '没有找到结果', hint: '尝试别的东西' }} />
    </View>
  );
}

function TermResults({ term, origin, topInset, bottomInset, onCluster, onUser }: Omit<Props, 'color'>) {
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const q = encodeURIComponent(term);
  const elements = usePagedList<Element>(`/api/elements?q=${q}&origin=${origin}`, 40);
  const [clusters, setClusters] = useState<Collection[] | null>(null);
  const [users, setUsers] = useState<Person[] | null>(null);
  useEffect(() => { setClusters(null); setUsers(null); pager.current?.setPageWithoutAnimation(0); pagerX.set(0); setPage(0); }, [term, pagerX]);
  useEffect(() => {
    if (page === 1 && clusters == null) get<{ items: Collection[] }>(`/api/search/clusters?q=${q}`).then((r) => setClusters(r.items), () => setClusters([]));
    if (page === 2 && users == null) get<{ items: Person[] }>(`/api/search/users?q=${q}`).then((r) => setUsers(r.items), () => setUsers([]));
  }, [page, q, clusters, users]);

  const cardWidth = (width - 3 * DEFAULT_GRID_GAP) / 2;
  const empty = (title: string) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>尝试别的东西</Text>
    </View>
  );
  const loading = <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} />;
  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <ProfileTabBar pagerX={pagerX} onPress={(i) => pager.current?.setPage(i)} tabs={[{ label: '元素' }, { label: '收藏' }, { label: '用户' }]} />
      <PagerView
        ref={pager}
        style={styles.pager}
        initialPage={0}
        onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => { setPage(e.nativeEvent.position); noteGridMoved(); }}
      >
        <View key="elements" style={styles.page}>
          <ClusterElementGrid list={elements} source="Search" topInset={DEFAULT_GRID_GAP} bottomInset={bottomInset} empty={{ title: '没有找到结果', hint: '尝试别的东西' }} />
        </View>
        <View key="clusters" style={styles.page}>
          <FlatList
            data={clusters ?? []}
            numColumns={2}
            keyExtractor={(c) => c.id}
            columnWrapperStyle={styles.columns}
            contentContainerStyle={[styles.grid, { paddingBottom: bottomInset }]}
            renderItem={({ item }) => <CollectionCard collection={item} width={cardWidth} onPress={() => onCluster(item)} />}
            ListEmptyComponent={clusters == null ? loading : empty('没有找到合集')}
          />
        </View>
        <View key="profiles" style={styles.page}>
          <FlatList
            data={users ?? []}
            keyExtractor={(p) => p.id}
            contentContainerStyle={[styles.people, { paddingBottom: bottomInset }]}
            renderItem={({ item: p }) => (
              <Pressable style={styles.person} onPress={() => onUser(p)} accessibilityRole="button">
                <Avatar user={p} size={40} />
                <View style={styles.text}>
                  <Text style={styles.title} numberOfLines={1}>{p.fullName || p.username}</Text>
                  <Text style={styles.meta} numberOfLines={1}>@{p.username}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={users == null ? loading : empty('未找到个人资料')}
          />
        </View>
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  pager: { flex: 1 },
  page: { flex: 1 },
  grid: { paddingHorizontal: DEFAULT_GRID_GAP, paddingTop: DEFAULT_GRID_GAP },
  columns: { gap: DEFAULT_GRID_GAP, marginBottom: theme.spacing.lg },
  people: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, gap: theme.spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  text: { flex: 1, minWidth: 0 },
  title: { ...theme.typography.large, color: theme.colors.primary },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary },
  loading: { marginTop: theme.spacing.xxxxl },
  emptyState: { alignItems: 'center', gap: theme.spacing.xxs, paddingTop: theme.spacing.xxxxl },
  emptyTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  emptyHint: { ...theme.typography.regular, color: theme.colors.tertiary },
}));
