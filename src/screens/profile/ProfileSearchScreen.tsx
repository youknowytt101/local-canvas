// Cosmos' profile search (ProfileSearchScreen / ProfileSearchHeader + ProfileSearchOverlay; Routes.PROFILE_SEARCH),
// one's own profile or someone else's, opened from the profile header's search:
//   - the header: the way back and the search field (common.search), focused
//   - nothing typed: 探索 {name} 的品味 · 搜索他们的收藏和元素 (profile.searchContextualEmptyTitle / Hint)
//   - typed (300 ms after the last key): two tabs, 收藏 / 元素 (common.clusters / elements):
//     - 收藏 (useProfileSearchClusters, SearchUserClusters): their collections whose name has it (one's own with the
//       private ones); none: 没有找到合集 (profile.clusterSearchEmpty)
//     - 元素 (useProfileSearchElements, SearchProfileElementTiles): their profile's elements matching it, the masonry
//       grid; none: 没有找到结果 · 尝试其他关键字或调整您的过滤器。
// The filters (ProfileSearchFilterSheet) are off in 2.33 (config.profileSearchFiltersEnabled false), so none here.
// Near Cosmos: Cosmos turns the header's search button into the field over the profile; this is its own page, pushed.
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../../components/bar/constants';
import { ClusterElementGrid } from '../../components/clusters/ClusterElementGrid';
import { CollectionCard, type Collection } from '../../components/clusters/CollectionCard';
import { DEFAULT_GRID_GAP } from '../../components/home/ForYouFeed';
import { ChevronLeftIcon, SearchIcon } from '../../components/icons';
import { ProfileTabBar } from '../../components/profile/ProfileTabBar';
import { usePagedList } from '../../hooks/usePagedList';
import { get } from '../../lib/api';
import type { Element } from '../../lib/elements';
import { Routes } from '../../navigation/routes';
import { useSessionStore } from '../../stores/useSessionStore';

const TYPING_DELAY = 300;

export type ProfileSearchParams = { userId: string; name: string };

export function ProfileSearchScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { userId, name } = useRoute<RouteProp<{ s: ProfileSearchParams }, 's'>>().params;
  const meId = useSessionStore((s) => s.me?.id ?? null);
  const isMe = userId === meId;
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [clusters, setClusters] = useState<Collection[] | null>(null);
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), TYPING_DELAY);
    return () => clearTimeout(t);
  }, [text]);
  // their collections, once: one's own with the private ones (and the sub-collections), someone else's public ones
  useEffect(() => {
    const read = isMe ? get<Collection[]>('/api/clusters') : get<{ items: Collection[] }>(`/api/users/${encodeURIComponent(userId)}/clusters`).then((r) => r.items);
    read.then(setClusters, () => setClusters([]));
  }, [isMe, userId]);
  const elements = usePagedList<Element>(term ? `/api/elements?user=${encodeURIComponent(userId)}&q=${encodeURIComponent(term)}` : null, 40);
  const found = term && clusters ? clusters.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())) : [];

  const cardWidth = (width - 3 * DEFAULT_GRID_GAP) / 2;
  const bottomInset = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + DEFAULT_GRID_GAP;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={4}>
          <ChevronLeftIcon color={theme.colors.primary} />
        </Pressable>
        <View style={styles.field}>
          <SearchIcon color={theme.colors.tertiary} size={16} />
          <TextInput
            style={styles.input} value={text} onChangeText={setText} autoFocus placeholder="搜索" placeholderTextColor={theme.colors.tertiary}
            returnKeyType="search" autoCorrect={false} onSubmitEditing={() => setTerm(text.trim())}
          />
        </View>
      </View>
      {!term ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>探索 {name} 的品味</Text>
          <Text style={styles.emptyHint}>搜索他们的收藏和元素</Text>
        </View>
      ) : (
        <>
          <ProfileTabBar pagerX={pagerX} onPress={(i) => pager.current?.setPage(i)} tabs={[{ label: '收藏' }, { label: '元素' }]} />
          <PagerView ref={pager} style={styles.pager} initialPage={0} onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}>
            <View key="clusters" style={styles.page}>
              <FlatList
                data={found}
                numColumns={2}
                keyExtractor={(c) => c.id}
                columnWrapperStyle={styles.columns}
                contentContainerStyle={[styles.grid, { paddingBottom: bottomInset }]}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <CollectionCard collection={item} width={cardWidth}
                    onPress={() => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: item.id } } })} />
                )}
                ListEmptyComponent={clusters ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>没有找到合集</Text></View> : null}
              />
            </View>
            <View key="elements" style={styles.page}>
              <ClusterElementGrid list={elements} source={isMe ? 'ProfileOwn' : 'ProfileOther'} topInset={DEFAULT_GRID_GAP} bottomInset={bottomInset}
                empty={{ title: '没有找到结果', hint: '尝试其他关键字或调整您的过滤器。' }} />
            </View>
          </PagerView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, height: 64, paddingHorizontal: theme.spacing.md },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  field: {
    flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.elevated,
  },
  input: { ...theme.typography.large, flex: 1, minWidth: 0, padding: 0, color: theme.colors.primary },
  pager: { flex: 1 },
  page: { flex: 1 },
  grid: { paddingHorizontal: DEFAULT_GRID_GAP, paddingTop: DEFAULT_GRID_GAP },
  columns: { gap: DEFAULT_GRID_GAP, marginBottom: theme.spacing.lg },
  emptyState: { alignItems: 'center', gap: theme.spacing.xxs, paddingTop: theme.spacing.xxxxl, paddingHorizontal: theme.spacing.md },
  emptyTitle: { ...theme.typography.largePlus, color: theme.colors.primary, textAlign: 'center' },
  emptyHint: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center' },
}));
