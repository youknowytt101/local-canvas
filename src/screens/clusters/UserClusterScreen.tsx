// Cosmos' UserClusterScreen (module 3262): a collection.
//   - a header row HEADER_CONTENT_HEIGHT (64) high under the status bar with the way back
//   - ClusterBodyPager's two pages, one over the other: the collection (UserClusterHeader over ClusterElementGrid,
//     CollectionOwn) and its similar elements (ClusterSimilarElementsGrid, ClusterRecommendations, asked for the first
//     time 相似 is pressed). Going to the similar page the collection rises by PAGE_DISTANCE (64) and fades while the
//     similar page comes up the same way, PAGE_TRANSITION_DURATION_MS (280); 相似 again goes back
//   - the bar (useClusterActionBarState): one's own or one worked on gets 整理 / 添加 / 相似 / 分享, anyone else's 看相似
//     - 整理: off (organizing comes later); 添加: the owner's top-level collection opens 新子系列, made inside it,
//       otherwise 新系列 (Cosmos opens its create sheet, whose other items — import, upload — come in step 6)
//     - 分享: the system's share with the collection's address on the computer (Cosmos opens its share sheet)
//   - empty: one's own 建议要素 · 开始策划您的收藏 (Cosmos shows suggested elements under it), anyone else's
//     无元素 · 该集合为空; no similar ones: 没有相似元素 · 稍后再来查看。
// The values of ClusterBodyPager's constants are read in order (64, 280, 6, 96, 56, 1000, 16) and matched to their
// names by how they are used: near. Not here yet: pulling down at the top of the similar page to go back, the header's
// 更多 menu (edit, pin, delete, …), the collaborators sheet.
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../../components/bar/constants';
import { ClusterElementGrid } from '../../components/clusters/ClusterElementGrid';
import type { Collection } from '../../components/clusters/CollectionCard';
import { UserClusterHeader, type ClusterDetail } from '../../components/clusters/UserClusterHeader';
import { DEFAULT_GRID_GAP } from '../../components/home/ForYouFeed';
import { HEADER_CONTENT_HEIGHT } from '../../components/home/HomeHeader';
import { ChevronLeftIcon } from '../../components/icons';
import { useCreateClusterStore } from '../../components/sheets/CreateClusterSheet';
import { SIMILAR_PAGE_SIZE } from '../../hooks/useSimilarElements';
import { usePagedList } from '../../hooks/usePagedList';
import { get } from '../../lib/api';
import type { Element } from '../../lib/elements';
import { serverUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { useBarStore } from '../../stores/useBarStore';
import { useSessionStore } from '../../stores/useSessionStore';

const PAGE_DISTANCE = 64;
const PAGE_TRANSITION_DURATION_MS = 280;
const ELEMENTS_PAGE_SIZE = 40;

export type UserClusterParams = { clusterId: string };

export function UserClusterScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { clusterId } = useRoute<RouteProp<{ c: UserClusterParams }, 'c'>>().params;
  const meId = useSessionStore((s) => s.me?.id ?? null);
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [parent, setParent] = useState<{ id: string; name: string } | null>(null);
  const [subClusters, setSubClusters] = useState<Collection[]>([]);
  const [failed, setFailed] = useState(false);
  const elements = usePagedList<Element>(`/api/elements?cluster=${encodeURIComponent(clusterId)}`, ELEMENTS_PAGE_SIZE);
  const [similarOn, setSimilarOn] = useState(false);
  const [similarAsked, setSimilarAsked] = useState(false);
  const similar = usePagedList<Element>(similarAsked ? `/api/clusters/${encodeURIComponent(clusterId)}/similar` : null, SIMILAR_PAGE_SIZE);

  // ---------- reading it ----------
  const load = useCallback(async () => {
    try {
      const c = await get<ClusterDetail>(`/api/clusters/${encodeURIComponent(clusterId)}`);
      setCluster(c);
      setFailed(false);
      const [p, subs] = await Promise.all([
        c.parentId ? get<Collection>(`/api/clusters/${encodeURIComponent(c.parentId)}`).catch(() => null) : Promise.resolve(null),
        Promise.all((c.subClusterIds ?? []).map((id) => get<Collection>(`/api/clusters/${encodeURIComponent(id)}`).catch(() => null))),
      ]);
      setParent(p ? { id: p.id, name: p.name } : null);
      setSubClusters(subs.filter((s): s is Collection => !!s));
      return c;
    } catch {
      setFailed(true);
      return null;
    }
  }, [clusterId]);
  const seenCount = useRef<number | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  // coming back (from the viewer, a sub-collection): read it again, its elements too when their number changed
  useFocusEffect(useCallback(() => {
    void load().then((c) => {
      if (!c) return;
      if (seenCount.current != null && seenCount.current !== c.count) void elementsRef.current.refresh();
      seenCount.current = c.count;
    });
  }, [load]));

  // ---------- the two pages ----------
  const progress = useSharedValue(0);
  useEffect(() => { progress.set(withTiming(similarOn ? 1 : 0, { duration: PAGE_TRANSITION_DURATION_MS })); }, [similarOn, progress]);
  const collectionStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ translateY: -progress.get() * PAGE_DISTANCE }],
  }));
  const similarStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * PAGE_DISTANCE }],
  }));
  const toggleSimilar = useCallback(() => {
    setSimilarAsked(true);
    setSimilarOn((on) => !on);
  }, []);

  // ---------- the bar ----------
  const mine = !!cluster?.role;
  useFocusEffect(useCallback(() => {
    if (!cluster) return;
    const bar = useBarStore.getState();
    bar.setActiveState({ type: mine ? 'cluster' : 'cluster-see-similar' });
    bar.setClusterBarState({
      clusterId, canOrganize: false, similarOn,
      onOrganize: () => undefined,
      onAdd: () => {
        const sub = cluster.role === 'Owner' && !cluster.parentId;
        useCreateClusterStore.getState().open(() => { void load(); }, sub ? { id: cluster.id, name: cluster.name } : null);
      },
      onSimilar: toggleSimilar,
      onShare: () => { void Share.share({ message: `${serverUrl()}/collections/${cluster.id}`, title: cluster.name }); },
    });
    return () => {
      const b = useBarStore.getState();
      if (b.clusterBarState?.clusterId !== clusterId) return;
      b.setClusterBarState(null);
      // the screen pushed over it (the viewer) may have set its own bar already
      if (b.activeState.type === 'cluster' || b.activeState.type === 'cluster-see-similar') b.setActiveState({ type: 'default' });
    };
  }, [cluster, mine, similarOn, clusterId, load, toggleSimilar]));

  const openCluster = (id: string) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: id } } });
  const onParentPress = () => {
    if (!parent) return;
    const routes = navigation.getState()?.routes ?? [];
    const prev = routes[routes.length - 2] as { name: string; params?: UserClusterParams } | undefined;
    if (prev?.name === Routes.USER_CLUSTER && prev.params?.clusterId === parent.id) navigation.goBack();
    else openCluster(parent.id);
  };
  const onOwnerPress = () => { if (cluster?.ownerId === meId) navigation.navigate(Routes.PROFILE); };

  const topInset = insets.top + HEADER_CONTENT_HEIGHT;
  const bottomInset = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + DEFAULT_GRID_GAP;
  return (
    <View style={styles.screen}>
      {cluster ? (
        <>
          <Animated.View style={[styles.page, collectionStyle]} pointerEvents={similarOn ? 'none' : 'auto'}>
            <ClusterElementGrid
              list={elements}
              source="CollectionOwn"
              removeFrom={mine ? cluster.id : null}
              topInset={topInset}
              bottomInset={bottomInset}
              empty={mine ? { title: '建议要素', hint: '开始策划您的收藏' } : { title: '无元素', hint: '该集合为空' }}
              header={
                <UserClusterHeader
                  cluster={cluster} parent={parent} subClusters={subClusters} width={width}
                  onParentPress={onParentPress} onOwnerPress={onOwnerPress} onOpenSub={(s) => openCluster(s.id)}
                  onChanged={(patch) => setCluster((c) => (c ? { ...c, ...patch } : c))}
                />
              }
            />
          </Animated.View>
          {similarAsked ? (
            <Animated.View style={[styles.page, similarStyle]} pointerEvents={similarOn ? 'auto' : 'none'}>
              <ClusterElementGrid
                list={similar}
                source="ClusterRecommendations"
                topInset={topInset + DEFAULT_GRID_GAP}
                bottomInset={bottomInset}
                empty={{ title: '没有相似元素', hint: '稍后再来查看。' }}
              />
            </Animated.View>
          ) : null}
        </>
      ) : (
        <View style={[styles.center, { paddingTop: topInset }]}>
          {failed ? <Text style={styles.failed}>打不开这个收藏夹</Text> : <ActivityIndicator color={theme.colors.tertiary} />}
        </View>
      )}
      <View style={[styles.header, { paddingTop: insets.top, height: topInset }]}>
        <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={4}>
          <ChevronLeftIcon color={theme.colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: theme.spacing.md },
  failed: { ...theme.typography.regular, color: theme.colors.tertiary, marginTop: theme.spacing.xxxxl },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
}));
