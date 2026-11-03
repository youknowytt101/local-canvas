// Cosmos' ActivityScreen (screens/activity/, module set read for the web page, HANDOFF 6.119), opened from the bell
// on the home header:
//   - ScreenHeader (showBack) with 活动; tabs (useActivityTabs, TopTabBar over a swipeable pager): 全部 and 关注, and 建议
//     once there are 5 activities (totalCount ≥ 5) — before that the suggestions are at the end of 全部
//     (showSuggestionsInList)
//   - 全部 (AllActivityTab, grouped): 今天 / 昨天 / 过去 7 天 / 过去 30 天 / 更早 (buildActivityListData); 关注
//     (FollowsActivityTab: onlyFollows, not grouped); 建议: people to follow (userFollowSuggestions) with why
//   - a row (ActivityListItem / transformActivityToActivityItem): who did it (40 avatar; two smaller ones when two or
//     more did: secondaryActor), what they did (activity.*), and at the right 回关 / 关注 (ActivityRowAction), the
//     collection's cover or the element's picture; pressing opens the person or the collection, the picture the
//     element, an invite asks to accept or decline. A dot on the unread ones; once shown everything is read
//     (MarkAllActivitiesAsRead)
// From GET /api/activity (cosmos-lite works the activities out of what it has, 6.119) and /api/users/suggestions/list.
// As Cosmos and not as the web page: a failed import is not shown. Near Cosmos (as on the web page): rows and groups follow the web page's sizes (Cosmos' are filled in at run time and
// were not read); a finished import or sync is a row with its time, there being no system push here. Not here: the web
// page's 导入与同步 button and its "N 个导入 / 同步正在进行" row (the app has no import page, 6.155).
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../components/bar/constants';
import { Button } from '../components/Button';
import { HEADER_CONTENT_HEIGHT } from '../components/home/HomeHeader';
import { ChevronLeftIcon } from '../components/icons';
import { Avatar } from '../components/profile/ProfileInfo';
import { ProfileTabBar } from '../components/profile/ProfileTabBar';
import { api, get } from '../lib/api';
import type { Element } from '../lib/elements';
import { openElementViewer } from '../lib/openElementViewer';
import { absoluteUrl } from '../lib/server';
import { Routes } from '../navigation/routes';
import { showToast } from '../stores/useToastStore';

type Person = { id: string; username: string; fullName?: string; avatarUrl?: string | null; isSelf?: boolean; isFollowed?: boolean };
type ClusterRef = { id: string; name: string; cover?: string | null };
type ElementTile = { id: string; imageUrl?: string | null; text?: string | null; color?: string | null; nsfw?: { treatment?: string } | null };
type Activity = {
  id: string; type: string; createdAt: string; isRead?: boolean;
  follower?: Person; lastFollower?: Person; lastConnectedUser?: Person; lastUserThatConnected?: Person; creator?: Person;
  collaborator?: Person; inviter?: Person; secondToLastFollower?: Person; secondToLastConnectedUser?: Person;
  numberOfClusters?: number; numberOfFollows?: number; numberOfConnectedElements?: number; numberOfConnections?: number;
  numberOfElements?: number; skipped?: number; cluster?: ClusterRef | null; elementTile?: ElementTile | null; inviteCode?: string;
  sync?: boolean; label?: string; source?: string; error?: string;
};
type Feed = { items: Activity[]; totalCount: number; unread: number };
type Suggestion = {
  suggestedUser: Person; reason?: string; mutualConnectionsCount?: number;
  exampleMutualUser?: Person | null; mostPopularClusterName?: string;
};

const GROUPS: [string, number][] = [['今天', 0], ['昨天', 1], ['过去 7 天', 7], ['过去 30 天', 30], ['更早', Infinity]];
const TABS_MIN = 5;

const personName = (p?: Person | null) => (p ? p.fullName || p.username : '');
const andOthers = (n?: number) => (n && n > 1 ? ` 和另外 ${n - 1} 人` : ''); // activity.andOthers
function groupOf(iso: string) {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(new Date(iso))) / 86400000);
  return GROUPS.findIndex(([, max]) => days <= max);
}
// activity.* as the web page words them
function activityText(a: Activity): [string, string | null] {
  const where = a.cluster ? `「${a.cluster.name}」` : '';
  switch (a.type) {
    case 'UserFollowedActivity': return [`${personName(a.follower)} ${a.follower?.isFollowed ? '回关了你' : '关注了你'}`, `@${a.follower?.username}`];
    case 'ClustersFollowedByUserActivity':
    case 'UserFollowedYourClustersAggregatableActivity': return [`${personName(a.follower)} 关注了你的 ${a.numberOfClusters} 个收藏夹`, `@${a.follower?.username}`];
    case 'ClusterFollowActivity':
    case 'UsersFollowedYourClusterAggregatableActivity': return [`${personName(a.lastFollower)}${andOthers(a.numberOfFollows)} 关注了${where}`, null];
    case 'ClusterCreateActivity':
    case 'ClusterFollowerClusterCreatedActivity':
    case 'UserFollowerClusterCreatedActivity': return [`${personName(a.creator)} 创建了${where}`, null];
    case 'ClusterCollaborateActivity':
    case 'UserConnectedElementToCollaborativeClusterAggregatableActivity': return [`${personName(a.collaborator)} 往${where}里加了 ${a.numberOfConnectedElements} 个元素`, null];
    case 'ElementConnectionActivity': return [`${personName(a.lastUserThatConnected)}${andOthers(a.numberOfConnections)} 存了你的元素`, null];
    case 'UserConnectedYourElementAggregatableActivity': return [`${personName(a.lastConnectedUser)}${andOthers(a.numberOfConnections)} 存了你的元素`, null];
    case 'UserConnectedElementThroughYouAggregatableActivity': return [`${personName(a.lastConnectedUser)}${andOthers(a.numberOfConnections)} 通过你存下了这个元素`, null];
    case 'CollaborationInviteActivity': return [`${a.inviter?.username} 邀请您加入${where}`, '点开接受或拒绝'];
    case 'UserAcceptedCollaborationInviteAtomicActivity': return [`${a.collaborator?.username} 已接受您的邀请`, where];
    default: break;
  }
  if (a.sync) return [`同步到 ${a.numberOfElements} 项新内容`, [a.label, where].filter(Boolean).join(' · ')];
  const head = a.type === 'ImportCompletedWithIssuesActivity'
    ? `导入完成，${a.skipped} 项没能导入`
    : a.numberOfElements ? `导入了 ${a.numberOfElements} 项内容` : '导入完成，没有找到内容';
  return [head, [a.source, a.label, where].filter(Boolean).join(' · ')];
}
const actorOf = (a: Activity) => a.follower || a.lastFollower || a.lastConnectedUser || a.lastUserThatConnected || a.creator
  || (a.type === 'UserAcceptedCollaborationInviteAtomicActivity' ? null : a.collaborator) || null;
const secondOf = (a: Activity) => a.secondToLastFollower || a.secondToLastConnectedUser || null;
const OPENS_PERSON = new Set(['UserFollowedActivity', 'ClustersFollowedByUserActivity', 'UserFollowedYourClustersAggregatableActivity',
  'ElementConnectionActivity', 'UserConnectedYourElementAggregatableActivity', 'UserConnectedElementThroughYouAggregatableActivity']);
const FOLLOWS_BACK = new Set(['UserFollowedActivity', 'ClustersFollowedByUserActivity', 'UserFollowedYourClustersAggregatableActivity']);

export function ActivityScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);
  const [all, setAll] = useState<Feed | null>(null);
  const [follows, setFollows] = useState<Activity[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [feed, only, sug] = await Promise.all([
      get<Feed>('/api/activity').catch(() => null),
      get<Feed>('/api/activity?onlyFollows=true').catch(() => null),
      get<{ items: Suggestion[] }>('/api/users/suggestions/list?count=8').catch(() => null),
    ]);
    // transformActivityToActivityItem has no ImportFailedAtomicActivity: the app does not show a failed import (the web page does)
    const shown = (items: Activity[]) => items.filter((a) => a.type !== 'ImportFailedAtomicActivity');
    setAll(feed ? { ...feed, items: shown(feed.items) } : { items: [], totalCount: 0, unread: 0 });
    setFollows(only ? shown(only.items) : []);
    setSuggestions(sug?.items ?? []);
    if (feed?.unread) void api('POST', '/api/activity/read').catch(() => undefined);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const many = (all?.totalCount ?? 0) >= TABS_MIN;
  const tabs = many ? [{ label: '全部' }, { label: '关注' }, { label: '建议' }] : [{ label: '全部' }, { label: '关注' }];

  const isFollowed = (p: Person) => followed[p.id] ?? !!p.isFollowed;
  const toggleFollow = async (p: Person) => {
    const on = !isFollowed(p);
    setFollowed((m) => ({ ...m, [p.id]: on }));
    try {
      await api(on ? 'POST' : 'DELETE', `/api/users/${encodeURIComponent(p.id)}/follow`);
    } catch (e) {
      setFollowed((m) => ({ ...m, [p.id]: !on }));
      showToast({ text: e instanceof Error ? e.message : '关注用户失败' });
    }
  };
  const openPerson = (p: Person) => {
    if (p.isSelf) navigation.navigate(Routes.PROFILE);
    else navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_PROFILE, params: { userId: p.id } } });
  };
  const openCluster = (id: string) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: id } } });
  const openElement = async (id: string) => {
    try {
      const el = await api<Element>('GET', `/api/elements/${encodeURIComponent(id)}`);
      openElementViewer(navigation, { elements: [el], initialIndex: 0, hasMore: false, userInteractionSource: 'Activity' });
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : '打不开这个元素' });
    }
  };
  const openInvite = (code: string) => navigation.navigate(Routes.ACCEPT_INVITE, { inviteCode: code });

  const row = (a: Activity) => {
    const [title, sub] = activityText(a);
    const actor = actorOf(a);
    const second = secondOf(a);
    const unread = a.isRead ? null : <View style={styles.unread} />;
    if (actor) {
      const action = FOLLOWS_BACK.has(a.type) && !actor.isSelf ? (
        <Button text={isFollowed(actor) ? '正在关注' : a.type === 'UserFollowedActivity' ? '回关' : '关注'} variant={isFollowed(actor) ? 'outline' : 'primary'}
          size="small" onPress={() => void toggleFollow(actor)} />
      ) : null;
      const preview = action ? null : a.elementTile ? <ElementPreview tile={a.elementTile} onPress={() => void openElement(a.elementTile!.id)} />
        : a.cluster ? <ClusterCover cluster={a.cluster} /> : null;
      const open = OPENS_PERSON.has(a.type) || !a.cluster ? () => openPerson(actor) : () => openCluster(a.cluster!.id);
      return (
        <Pressable key={a.id} style={styles.row} onPress={open} accessibilityRole="button">
          <View style={styles.actors}>
            {second ? (
              <>
                <View style={styles.actorBack}><Avatar user={second} size={30} /></View>
                <View style={styles.actorFront}><Avatar user={actor} size={30} /></View>
              </>
            ) : <Avatar user={actor} size={40} />}
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{title}</Text>
            {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
          </View>
          {action}
          {preview}
          {unread}
        </Pressable>
      );
    }
    const open = a.type === 'CollaborationInviteActivity' && a.inviteCode ? () => openInvite(a.inviteCode!) : a.cluster ? () => openCluster(a.cluster!.id) : undefined;
    const when = new Date(a.createdAt);
    return (
      <Pressable key={a.id} style={styles.row} onPress={open} disabled={!open} accessibilityRole={open ? 'button' : undefined}>
        <ClusterCover cluster={a.cluster ?? null} />
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <Text style={styles.time}>{`${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`}</Text>
        {unread}
      </Pressable>
    );
  };
  const section = (label: string | null, items: Activity[], key: string) => (
    <View key={key} style={styles.group}>
      {label ? <Text style={styles.groupLabel}>{label}</Text> : null}
      <View style={styles.list}>{items.map((a, i) => <View key={a.id} style={i ? styles.divider : null}>{row(a)}</View>)}</View>
    </View>
  );
  const suggestionList = (withLabel: boolean) => (suggestions?.length ? (
    <View style={styles.group}>
      {withLabel ? <Text style={styles.groupLabel}>建议</Text> : null}
      {suggestions.map((s) => {
        const p = s.suggestedUser;
        const ex = personName(s.exampleMutualUser);
        const why = s.reason === 'FOLLOWED_BY_SOMEONE_YOU_FOLLOW'
          ? ((s.mutualConnectionsCount ?? 0) > 1 ? `${ex} 及其他 ${(s.mutualConnectionsCount ?? 1) - 1} 人已关注` : `${ex} 已关注`)
          : s.reason === 'OWNER_OF_CLUSTER_YOU_FOLLOW' ? `${s.mostPopularClusterName} 的创建者` : '为您推荐';
        return (
          <View key={p.id} style={styles.suggestion}>
            <Pressable style={styles.suggestionMain} onPress={() => openPerson(p)} accessibilityRole="button">
              <Avatar user={p} size={40} />
              <View style={styles.text}>
                <Text style={styles.personName} numberOfLines={1}>{personName(p)}</Text>
                <Text style={styles.sub} numberOfLines={1}>{why}</Text>
              </View>
            </Pressable>
            <Button text={isFollowed(p) ? '正在关注' : '关注'} variant={isFollowed(p) ? 'outline' : 'primary'} size="small" onPress={() => void toggleFollow(p)} />
          </View>
        );
      })}
    </View>
  ) : null);

  const bottom = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + theme.spacing.md;
  const page = (content: React.ReactNode) => (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.colors.tertiary} />}>
      {content}
    </ScrollView>
  );
  const loading = <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} />;
  const groups = GROUPS.map(() => [] as Activity[]);
  for (const a of all?.items ?? []) groups[Math.max(0, groupOf(a.createdAt))].push(a);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_CONTENT_HEIGHT }]}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={4}>
          <ChevronLeftIcon color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>活动</Text>
        <View style={styles.back} />
      </View>
      <ProfileTabBar key={`tabs-${tabs.length}`} pagerX={pagerX} onPress={(i) => pager.current?.setPage(i)} tabs={tabs} />
      <PagerView key={`pager-${tabs.length}`} ref={pager} style={styles.pager} initialPage={0} onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}>
        <View key="all" style={styles.page}>
          {page(all == null ? loading : (
            <>
              {all.items.length ? groups.map((list, i) => (list.length ? section(GROUPS[i][0], list, `g${i}`) : null))
                : <Text style={styles.empty}>还没有活动。导入或同步完成、有人关注你或存了你的元素后会出现在这里。</Text>}
              {many ? null : suggestionList(true)}
            </>
          ))}
        </View>
        <View key="follows" style={styles.page}>
          {page(follows == null ? loading : follows.length ? section(null, follows, 'follows') : <Text style={styles.empty}>还没有人关注你或你的收藏夹。</Text>)}
        </View>
        {/* PagerView takes no null children: 建议 is put in only when it is a tab */}
        {[many ? (
          <View key="suggestions" style={styles.page}>
            {page(suggestions == null ? loading : suggestions.length ? suggestionList(false) : <Text style={styles.empty}>暂时没有建议。</Text>)}
          </View>
        ) : null].filter((v) => v != null)}
      </PagerView>
    </View>
  );
}

// buildElementPreview: the element's picture (blurred or left out as the content filtering says), a note's first words
function ElementPreview({ tile, onPress }: { tile: ElementTile; onPress: () => void }) {
  const treatment = tile.nsfw?.treatment;
  return (
    <Pressable style={[styles.cover, tile.color ? { backgroundColor: tile.color } : null, !tile.imageUrl && styles.textCover]} onPress={onPress}
      accessibilityRole="button" accessibilityLabel="打开元素">
      {tile.imageUrl
        ? (treatment !== 'hide' ? <Image source={{ uri: absoluteUrl(tile.imageUrl) }} style={styles.coverImage} contentFit="cover" blurRadius={treatment === 'blur' ? 10 : 0} /> : null)
        : <Text style={styles.textCoverText} numberOfLines={4}>{tile.text ?? ''}</Text>}
    </Pressable>
  );
}

function ClusterCover({ cluster }: { cluster: ClusterRef | null }) {
  return (
    <View style={styles.cover}>
      {cluster?.cover ? <Image source={{ uri: absoluteUrl(cluster.cover) }} style={styles.coverImage} contentFit="cover" /> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.typography.headingMedium, color: theme.colors.primary, flex: 1, textAlign: 'center' },
  pager: { flex: 1 },
  page: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, gap: theme.spacing.lg },
  loading: { marginTop: theme.spacing.xl },
  empty: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center', marginTop: theme.spacing.xl },
  group: {},
  groupLabel: { ...theme.typography.captionPlus, color: theme.colors.tertiary, marginBottom: theme.spacing.xs },
  list: { borderRadius: theme.borderRadius.md, overflow: 'hidden', backgroundColor: theme.colors.elevated },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.background },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, paddingLeft: 12, paddingRight: 16 },
  actors: { width: 40, height: 40 },
  actorBack: { position: 'absolute', top: 0, left: 0 },
  actorFront: { position: 'absolute', right: 0, bottom: 0, borderRadius: 17, borderWidth: 2, borderColor: theme.colors.elevated },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...theme.typography.regular, fontSize: 15, lineHeight: 20, color: theme.colors.primary },
  sub: { ...theme.typography.caption, fontSize: 13, lineHeight: 17, color: theme.colors.tertiary },
  time: { ...theme.typography.caption, color: theme.colors.tertiary },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.badge },
  cover: { width: 44, height: 44, borderRadius: 8, backgroundColor: theme.colors.disabled, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  textCover: { padding: 4, borderWidth: 1, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.background },
  textCoverText: { fontSize: 9, lineHeight: 11, color: theme.colors.secondary },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  suggestionMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  personName: { ...theme.typography.largePlus, color: theme.colors.primary },
}));
