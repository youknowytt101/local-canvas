// Cosmos' ProfileConnectionsScreen (module 3289): someone's followers, whom they follow and the collections they follow.
//   - ScreenHeader with the way back and the person's name
//   - three tabs (TopTabBar, swipeable: SwipeableTabViewComponent): 粉丝 (profile.followers), 正在关注 (profile.following),
//     收藏 (profile.clusters), opening on the one pressed on the profile
//   - a person (FollowingTab → ConnectionListItem): the 40 avatar, the name and @username (regular, tertiary) and, for
//     anyone but oneself, 关注 / 正在关注 (toast 已关注 / 取消关注); pressing opens their profile (one's own: the tab)
//   - a collection (ClusterList → ClusterListItem): its 40 cover (elevated, borderRadius.sm), the name and
//     "N 元素 · @owner"; pressing opens it
//   - rows spacing.sm apart, spacing.md in from the sides
// From /api/users/:id/followers | following | followed-clusters (each a whole list). Near Cosmos: the counts are
// badges as on the profile's tabs; no search field over the lists; no 关注 on the collection rows.
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../../components/bar/constants';
import { Button } from '../../components/Button';
import type { Collection } from '../../components/clusters/CollectionCard';
import { HEADER_CONTENT_HEIGHT } from '../../components/home/HomeHeader';
import { ChevronLeftIcon } from '../../components/icons';
import { Avatar } from '../../components/profile/ProfileInfo';
import { ProfileTabBar } from '../../components/profile/ProfileTabBar';
import { api, get } from '../../lib/api';
import { absoluteUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { showToast } from '../../stores/useToastStore';

type Tab = 'followers' | 'following' | 'clusters';
export type ProfileConnectionsParams = { userId: string; tab?: Tab; name?: string };
type Person = { id: string; username: string; fullName?: string; avatarUrl?: string | null; isSelf?: boolean; isFollowed?: boolean };

const TABS: Tab[] = ['followers', 'following', 'clusters'];

export function ProfileConnectionsScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { userId, tab = 'followers', name } = useRoute<RouteProp<{ p: ProfileConnectionsParams }, 'p'>>().params;
  const enc = encodeURIComponent(userId);
  const start = TABS.indexOf(tab);
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(start);
  const [followers, setFollowers] = useState<Person[] | null>(null);
  const [following, setFollowing] = useState<Person[] | null>(null);
  const [clusters, setClusters] = useState<Collection[] | null>(null);

  useEffect(() => {
    get<{ items: Person[] }>(`/api/users/${enc}/followers`).then((r) => setFollowers(r.items), () => setFollowers([]));
    get<{ items: Person[] }>(`/api/users/${enc}/following`).then((r) => setFollowing(r.items), () => setFollowing([]));
    get<{ items: Collection[] }>(`/api/users/${enc}/followed-clusters`).then((r) => setClusters(r.items), () => setClusters([]));
  }, [enc]);

  const setFollowed = (id: string, on: boolean) => {
    const patch = (list: Person[] | null) => list?.map((p) => (p.id === id ? { ...p, isFollowed: on } : p)) ?? null;
    setFollowers(patch);
    setFollowing(patch);
  };
  const toggleFollow = useCallback(async (p: Person) => {
    const on = !p.isFollowed;
    setFollowed(p.id, on);
    try {
      await api(on ? 'POST' : 'DELETE', `/api/users/${encodeURIComponent(p.id)}/follow`);
      showToast({ text: on ? '已关注' : '取消关注' });
    } catch (e) {
      setFollowed(p.id, !on);
      showToast({ text: e instanceof Error ? e.message : '关注用户失败' });
    }
  }, []);
  const openPerson = (p: Person) => {
    if (p.isSelf) navigation.navigate(Routes.PROFILE);
    else navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_PROFILE, params: { userId: p.id } } });
  };
  const openCluster = (c: Collection) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: c.id } } });

  const bottom = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + theme.spacing.md;
  const people = (list: Person[] | null, empty: string) => (
    <FlatList
      data={list ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom }]}
      renderItem={({ item: p }) => (
        <Row
          image={<Avatar user={p} size={40} />}
          title={p.fullName || p.username}
          meta={`@${p.username}`}
          onPress={() => openPerson(p)}
          action={p.isSelf ? null : (
            <Button text={p.isFollowed ? '正在关注' : '关注'} variant={p.isFollowed ? 'outline' : 'primary'} size="small" onPress={() => void toggleFollow(p)} />
          )}
        />
      )}
      ListEmptyComponent={list == null ? <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} /> : <Text style={styles.empty}>{empty}</Text>}
    />
  );
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_CONTENT_HEIGHT }]}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={4}>
          <ChevronLeftIcon color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{name ?? ''}</Text>
        <View style={styles.back} />
      </View>
      <ProfileTabBar
        pagerX={pagerX}
        onPress={(i) => pager.current?.setPage(i)}
        tabs={[
          { label: '粉丝', count: followers?.length },
          { label: '正在关注', count: following?.length },
          { label: '收藏', count: clusters?.length },
        ]}
      />
      <PagerView ref={pager} style={styles.pager} initialPage={start} onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}>
        <View key="followers" style={styles.page}>{people(followers, '还没有粉丝')}</View>
        <View key="following" style={styles.page}>{people(following, '还没有关注任何人')}</View>
        <View key="clusters" style={styles.page}>
          <FlatList
            data={clusters ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={[styles.list, { paddingBottom: bottom }]}
            renderItem={({ item: c }) => (
              <Row
                image={c.covers?.[0] ? <Image source={{ uri: absoluteUrl(c.covers[0]) }} style={styles.cover} contentFit="cover" /> : <View style={styles.cover} />}
                title={c.name}
                meta={`${c.count} 元素 · @${c.owner}`}
                onPress={() => openCluster(c)}
              />
            )}
            ListEmptyComponent={clusters == null ? <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} /> : <Text style={styles.empty}>还没有关注收藏</Text>}
          />
        </View>
      </PagerView>
    </View>
  );
}

function Row({ image, title, meta, onPress, action }: { image: React.ReactNode; title: string; meta: string; onPress: () => void; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onPress} accessibilityRole="button">
        {image}
        <View style={styles.text}>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
        </View>
      </Pressable>
      {action}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...theme.typography.headingMedium, color: theme.colors.primary, flex: 1, textAlign: 'center' },
  pager: { flex: 1 },
  page: { flex: 1 },
  list: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  cover: { width: theme.size.lg, height: theme.size.lg, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.elevated, overflow: 'hidden' },
  text: { flex: 1, minWidth: 0 },
  rowTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary },
  loading: { marginTop: theme.spacing.xl },
  empty: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center', marginTop: theme.spacing.xl },
}));
