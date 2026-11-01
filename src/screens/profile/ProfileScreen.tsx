// Cosmos' ProfileScreen (module 3294), one's own (the Profile tab's root, ProfileOwn) or anyone else's (pushed as
// UserProfile with a userId, ProfileOther: GetUserProfile, UserClusters, UserPublicElements):
//   - a header row HEADER_CONTENT_HEIGHT (64) high under the status bar, 16 in: share on the left (showShare), search and
//     settings on the right, each a 40 round button with a 1 px surfaceBorder outline
//   - under it a pager (Pager) of two pages, 个人主页 (ProfileElementGrid, the profile's elements) and 收藏集
//     (ProfileClusterGrid), the words being the user's (6.136; 2.33 says 个人资料 / 收藏)
//   - over the pages the folding header: ProfileInfo and the tab bar. Each page's list keeps a spacer as high as the
//     header; the header moves up with the page on screen until only the tab bar is left (headerScrollMax), which stays
//     under the header row. Before the pager moves to the other page that page is scrolled to fold the header the
//     same way (useProfileTabScrollSync), so the header does not jump.
//   - the Profile tab pressed again scrolls the page on screen back to the top (useOwnProfileTabPress)
//   - coming back to it reads the profile again (counts, bio, …); the lists follow when their counts changed
//   - someone else's: the way back instead of search / settings, share on the right; ProfileInfo's 关注 / 正在关注;
//     his public collections (no create card) and the elements of his profile; the empty states
//     profile.emptyClustersTitle / Hint and emptyElementsTitle / Hint; nothing to take out
//   - the follower / following counts open ProfileConnectionsScreen
// Near Cosmos: dragging on the header scrolls the page under it without a fling of its own (Cosmos hands the gesture
// to the list); the search (step 5), 创建 (step 6) and 编辑主页 (step 8) are not wired yet; someone else's menu
// (UserProfileMenus: copy link, canvas, block, report) is not here yet.
import type { FlashListRef } from '@shopify/flash-list';
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, View, type FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../../components/bar/constants';
import type { Collection } from '../../components/clusters/CollectionCard';
import { DEFAULT_GRID_GAP } from '../../components/home/ForYouFeed';
import { HEADER_CONTENT_HEIGHT } from '../../components/home/HomeHeader';
import { ChevronLeftIcon, SearchIcon, SettingsIcon, ShareIcon } from '../../components/icons';
import { ProfileClusterGrid, type ProfileClusterGridItem } from '../../components/profile/ProfileClusterGrid';
import { ProfileElementGrid } from '../../components/profile/ProfileElementGrid';
import { ProfileInfo, type ProfileUser } from '../../components/profile/ProfileInfo';
import { useCreateClusterStore } from '../../components/sheets/CreateClusterSheet';
import { ProfileTabBar } from '../../components/profile/ProfileTabBar';
import { pinnedFirst } from '../../components/profile/profileLists';
import { usePagedList } from '../../hooks/usePagedList';
import { api, get } from '../../lib/api';
import { showToast } from '../../stores/useToastStore';
import type { Element } from '../../lib/elements';
import { serverUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { useSessionStore } from '../../stores/useSessionStore';
import { useTabDoubleTap } from '../../stores/useTabDoubleTapStore';

const HEADER_CONTROL_SIZE = 40;
const HEADER_HORIZONTAL_PADDING = 16;
const ELEMENTS_PAGE_SIZE = 40;

export type UserProfileParams = { userId?: string };

export function ProfileScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const me = useSessionStore((s) => s.me);
  const routeUserId = useRoute<RouteProp<{ p: UserProfileParams | undefined }, 'p'>>().params?.userId;
  const isRoot = !routeUserId;
  const isMe = isRoot || routeUserId === me?.id;
  const userId = routeUserId ?? me?.id ?? '';
  const enc = encodeURIComponent(userId);
  const [profile, setProfile] = useState<(ProfileUser & { isFollowed?: boolean }) | null>(isMe && me ? { ...me } : null);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const elements = usePagedList<Element>(isMe ? '/api/elements' : `/api/elements?user=${enc}`, ELEMENTS_PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);

  // ---------- reading it ----------
  const lastCounts = useRef<string | null>(null);
  const loadCollections = useCallback(async () => {
    if (!isMe) { setCollections((await get<{ items: Collection[] }>(`/api/users/${enc}/clusters`)).items); return; }
    const all = await get<Collection[]>('/api/clusters');
    setCollections(pinnedFirst(all.filter((c) => !c.parentId)));
  }, [isMe, enc]);
  const loadProfile = useCallback(async () => {
    const p = await get<ProfileUser & { isFollowed?: boolean }>(isMe ? '/api/me' : `/api/users/${enc}`);
    setProfile(p);
    return p;
  }, [isMe, enc]);

  // ProfileInfoActionButtons on someone else's: 关注 / 正在关注 (toast.followed / unfollowed)
  const toggleFollow = async () => {
    if (!profile) return;
    const on = !profile.isFollowed;
    setProfile({ ...profile, isFollowed: on });
    try {
      const r = await api<{ statistics: { numberOfFollowers: number; numberOfFollowing: number } }>(on ? 'POST' : 'DELETE', `/api/users/${enc}/follow`);
      setProfile((p) => (p ? { ...p, isFollowed: on, statistics: p.statistics && { ...p.statistics, numberOfFollowers: r.statistics.numberOfFollowers } } : p));
      showToast({ text: on ? '已关注' : '取消关注' });
    } catch (e) {
      setProfile((p) => (p ? { ...p, isFollowed: !on } : p));
      showToast({ text: e instanceof Error ? e.message : '关注用户失败' });
    }
  };
  const openConnections = (tab: 'followers' | 'following') =>
    navigation.dispatch({ type: 'PUSH', payload: { name: Routes.PROFILE_CONNECTIONS, params: { userId, tab, name: profile?.fullName || profile?.username } } });
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  useFocusEffect(useCallback(() => {
    void loadProfile().then((p) => {
      const counts = `${p.statistics?.numberOfElements}:${p.statistics?.numberOfClusters}`;
      if (lastCounts.current !== null && lastCounts.current !== counts) void elementsRef.current.refresh();
      lastCounts.current = counts;
    }, () => undefined);
    void loadCollections().catch(() => setCollections((c) => c ?? []));
  }, [loadProfile, loadCollections]));
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([loadProfile(), loadCollections(), elementsRef.current.refresh()]);
    setRefreshing(false);
  }, [loadProfile, loadCollections]);

  // ---------- the pager and the folding header ----------
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);
  const pageRef = useRef(0);
  const elementList = useRef<FlashListRef<Element>>(null);
  const clusterList = useRef<FlatList<ProfileClusterGridItem>>(null);
  const scrollY = [useSharedValue(0), useSharedValue(0)];
  const [headerHeight, setHeaderHeight] = useState(0);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [viewport, setViewport] = useState(0);
  const headerScrollMax = Math.max(0, headerHeight - tabBarHeight);
  const maxSv = useSharedValue(0);
  useEffect(() => { maxSv.set(headerScrollMax); }, [maxSv, headerScrollMax]);
  const activeSv = useSharedValue(0);

  const headerStyle = useAnimatedStyle(() => {
    const y = activeSv.get() === 0 ? scrollY[0].get() : scrollY[1].get();
    return { transform: [{ translateY: -Math.min(Math.max(y, 0), maxSv.get()) }] };
  });
  const [y0, y1] = scrollY;
  const onScroll = useMemo(() => [y0, y1].map((y) => (e: NativeSyntheticEvent<NativeScrollEvent>) => y.set(e.nativeEvent.contentOffset.y)), [y0, y1]);

  const scrollPageTo = (i: number, offset: number, animated = false) => {
    if (i === 0) elementList.current?.scrollToOffset({ offset, animated });
    else clusterList.current?.scrollToOffset({ offset, animated });
  };
  // useProfileTabScrollSync: the other page folds the header as far as this one does
  const syncOther = () => {
    const from = pageRef.current;
    const to = 1 - from;
    const folded = Math.min(Math.max(scrollY[from].get(), 0), headerScrollMax);
    const theirs = scrollY[to].get();
    if (folded < headerScrollMax ? theirs !== folded : theirs < headerScrollMax) {
      scrollPageTo(to, folded);
      scrollY[to].set(folded);
    }
  };
  const goTo = (i: number) => {
    if (i === pageRef.current) return;
    syncOther();
    pager.current?.setPage(i);
  };

  useTabDoubleTap(Routes.PROFILE, () => { if (isRoot) scrollPageTo(pageRef.current, 0, true); });

  // dragging on the header scrolls the page under it
  const dragStart = useRef(0);
  const headerPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-8, 8])
    .failOffsetX([-12, 12])
    .onStart(() => { dragStart.current = scrollY[pageRef.current].get(); })
    .onUpdate((e) => scrollPageTo(pageRef.current, Math.max(0, dragStart.current - e.translationY)));

  const share = () => {
    if (!profile) return;
    void Share.share({ message: `${serverUrl()}/profile/${encodeURIComponent(profile.id)}`, title: profile.fullName || profile.username });
  };

  const st = profile?.statistics;
  const bottomInset = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + DEFAULT_GRID_GAP;
  const listProps = { headerHeight, headerScrollMax, viewport, bottomInset, refreshing, onRefresh: () => void refresh() };
  const button = [styles.headerButton, { width: HEADER_CONTROL_SIZE, height: HEADER_CONTROL_SIZE }];
  return (
    <View style={styles.screen}>
      <View style={[styles.headerRow, { paddingTop: insets.top, height: insets.top + HEADER_CONTENT_HEIGHT }]}>
        {isRoot ? (
          <Pressable style={button} onPress={share} accessibilityRole="button" accessibilityLabel="分享">
            <ShareIcon color={theme.colors.primary} size={20} />
          </Pressable>
        ) : (
          <Pressable style={button} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回">
            <ChevronLeftIcon color={theme.colors.primary} size={20} />
          </Pressable>
        )}
        {isRoot ? (
          <View style={styles.headerEnd}>
            <Pressable style={button} accessibilityRole="button" accessibilityLabel="搜索">
              <SearchIcon color={theme.colors.primary} size={20} />
            </Pressable>
            <Pressable style={button} onPress={() => navigation.navigate(Routes.SETTINGS)} accessibilityRole="button" accessibilityLabel="设置">
              <SettingsIcon color={theme.colors.primary} size={20} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={button} onPress={share} accessibilityRole="button" accessibilityLabel="分享">
            <ShareIcon color={theme.colors.primary} size={20} />
          </Pressable>
        )}
      </View>
      <View style={styles.body} onLayout={(e) => setViewport(e.nativeEvent.layout.height)}>
        <PagerView
          ref={pager}
          style={styles.pager}
          initialPage={0}
          onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}
          onPageScrollStateChanged={(e) => { if (e.nativeEvent.pageScrollState === 'dragging') syncOther(); }}
          onPageSelected={(e) => { const i = e.nativeEvent.position; pageRef.current = i; activeSv.set(i); }}
        >
          <View key="elements" style={styles.page}>
            <ProfileElementGrid {...listProps} list={elements} listRef={elementList} onScroll={onScroll[0]} isMe={isMe} />
          </View>
          <View key="collections" style={styles.page}>
            <ProfileClusterGrid
              {...listProps}
              collections={collections}
              listRef={clusterList}
              onScroll={onScroll[1]}
              isMe={isMe}
              onOpen={(c) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: c.id } } })}
              onCreate={() => useCreateClusterStore.getState().open(() => { void loadCollections(); void loadProfile(); })}
            />
          </View>
        </PagerView>
        <GestureDetector gesture={headerPan}>
          <Animated.View style={[styles.foldingHeader, headerStyle]} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
            {profile ? (
              <ProfileInfo
                user={profile} isMe={isMe} isFollowed={profile.isFollowed} onFollow={toggleFollow}
                onFollowers={() => openConnections('followers')} onFollowing={() => openConnections('following')}
              />
            ) : <View style={styles.infoPlaceholder} />}
            <View style={styles.tabs} onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}>
              <ProfileTabBar
                pagerX={pagerX}
                onPress={goTo}
                tabs={[
                  { label: '个人主页', count: st?.numberOfElements ?? elements.count },
                  { label: '收藏集', count: collections?.length ?? st?.numberOfClusters },
                ]}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: HEADER_HORIZONTAL_PADDING,
    backgroundColor: theme.colors.background, zIndex: 2,
  },
  headerEnd: { flexDirection: 'row', gap: theme.spacing.xs },
  headerButton: { borderRadius: HEADER_CONTROL_SIZE / 2, borderWidth: 1, borderColor: theme.colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, overflow: 'hidden' },
  pager: { flex: 1 },
  page: { flex: 1 },
  foldingHeader: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: theme.colors.background },
  infoPlaceholder: { height: 200 },
  tabs: { marginTop: theme.spacing.lg },
}));
