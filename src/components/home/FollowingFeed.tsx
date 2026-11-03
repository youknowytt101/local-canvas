// Cosmos' FollowingFeed (module 3434): a list of FeedItems — FeedItemHeader (the person's small avatar, then
// "<name> 将 N 元素保存至 <collection>", or 他们的个人主页 when it is their profile) over FeedItemCarousel (the tiles in
// a row, as wide as their shape at one height, FEED_IMAGE_SCALE, impressions as Following once per stretch on screen
// from when they are viewable). Pages of 8 then 12, pull to refresh, the same empty state as For You.
// Local: the computer also lists the user's own synced sources here (no person: the source's name stands in);
// the carousel's height and widths are close to Cosmos' getFeedItemCarouselHeight (200 high, 100–285 wide, shapes
// from 0.75) — its numbers are read, how they combine is not; the header's text for a profile says 个人主页 (the name
// the user chose for it, 6.136) where Cosmos' Chinese pack has 轮廓.
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, type ViewToken } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useFollowingFeed, type FollowingItem } from '../../hooks/useFollowingFeed';
import type { PageScrollHandlers } from '../../hooks/useHomeChrome';
import { SCROLL_AT_TOP_THRESHOLD } from '../../hooks/useTabReselect';
import { FEED_IMAGE_SCALE, tileImageUrl, tileRatio, type Element } from '../../lib/elements';
import { createNoopHomeFeedHandlers, type HomeFeedHandlers } from '../../lib/homeFeedHandlers';
import { ListImpressions } from '../../lib/impressions';
import { openElementViewer } from '../../lib/openElementViewer';
import { absoluteUrl } from '../../lib/server';
import { UserRound } from '../icons';
import { HomeFeedEmptyState } from './HomeFeedEmptyState';

const CAROUSEL_HEIGHT = 200;
const MIN_WIDTH = 100;
const MAX_WIDTH = 285;
const MIN_RATIO = 0.75;
const VIEWABILITY = { itemVisiblePercentThreshold: 1 };

type Props = {
  userId: string | null;
  active: boolean;
  contentTopInset: number;
  bottomInset: number;
  scrollHandlers: PageScrollHandlers;
  listRef: React.RefObject<FlashListRef<FollowingItem> | null>;
  handlersRef: React.MutableRefObject<HomeFeedHandlers>; // set here: what pressing the home tab again does to this page
};

const itemKey = (s: FollowingItem) => s.id ?? `${s.collaborator?.id}:${s.cluster?.id}:${s.startedAt}`;

export function FollowingFeed({ userId, active, contentTopInset, bottomInset, scrollHandlers, listRef, handlersRef }: Props) {
  const { theme } = useUnistyles();
  const focused = useIsFocused();
  const showing = active && focused;
  const feed = useFollowingFeed(userId, active);
  // the home tab pressed again: refresh at the top (as pulling down does), else scroll up
  const refreshRef = useRef(feed.refresh);
  refreshRef.current = feed.refresh;
  useEffect(() => {
    handlersRef.current = {
      refresh: () => { void refreshRef.current(); },
      scrollToTop: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
      isAtTop: () => (listRef.current?.getAbsoluteLastScrollOffset() ?? 0) <= SCROLL_AT_TOP_THRESHOLD,
    };
    return () => { handlersRef.current = createNoopHomeFeedHandlers(); };
  }, [handlersRef, listRef]);

  const impressions = useMemo(() => new ListImpressions<Element>(
    (el) => ({ targetType: 'Element', targetId: el.id, userInteractionSource: 'Following', slateId: el.slateId }), true), []);
  useEffect(() => () => impressions.dispose(), [impressions]);
  useEffect(() => { impressions.setEnabled(showing); if (!showing) impressions.setVisible([]); }, [impressions, showing]);
  // an item on screen: its tiles count (startWhen 'viewable': no waiting for the pictures)
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<FollowingItem>[] }) => {
    const tiles = viewableItems.flatMap((v) => (v.item ? v.item.items : []));
    for (const el of tiles) impressions.markMediaReady(el.id);
    impressions.setVisible(tiles.map((el) => [el.id, el]));
  }).current;

  const renderItem = useCallback(({ item }: { item: FollowingItem }) => <FeedItem item={item} />, []);
  return (
    <FlashList
      ref={listRef}
      data={feed.items}
      keyExtractor={itemKey}
      renderItem={renderItem}
      onEndReached={feed.loadMore}
      onEndReachedThreshold={1}
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={onViewableItemsChanged}
      {...scrollHandlers}
      scrollEventThrottle={16}
      style={styles.list}
      contentContainerStyle={{ paddingTop: contentTopInset, paddingBottom: bottomInset }}
      refreshControl={<RefreshControl refreshing={feed.refreshing} progressViewOffset={contentTopInset} tintColor={theme.colors.tertiary} onRefresh={() => void feed.refresh()} />}
      ListEmptyComponent={
        feed.loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.tertiary} /></View>
          : feed.error ? <HomeFeedEmptyState kind="error" onRetry={() => void feed.refresh()} />
            : feed.done ? <HomeFeedEmptyState kind="following" /> : null
      }
      ListFooterComponent={feed.items.length && feed.loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.tertiary} /></View> : null}
    />
  );
}

function FeedItem({ item }: { item: FollowingItem }) {
  const { theme } = useUnistyles();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const who = item.collaborator;
  const name = who ? who.fullName || who.username : item.source?.target || item.cluster?.name || '一个来源';
  const target = item.cluster?.isPublicElementsCluster ? '他们的 个人主页' : item.cluster?.name ?? '';
  return (
    <View style={styles.item}>
      <View style={styles.header}>
        {who ? (
          <View style={styles.avatar}>
            {who.avatarUrl ? <Image source={{ uri: absoluteUrl(who.avatarUrl) }} style={styles.avatarImage} /> : <UserRound color={theme.colors.tertiary} size={16} />}
          </View>
        ) : null}
        <Text style={styles.headerText} numberOfLines={1}>
          <Text style={styles.name}>{name}</Text>
          {who ? ` 将 ${item.elementCount} 元素保存至 ` : ` 新增 ${item.elementCount} 条 `}
          {who ? <Text style={styles.name}>{target}</Text> : null}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        {item.items.map((el) => {
          const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, CAROUSEL_HEIGHT * Math.max(MIN_RATIO, tileRatio(el.width, el.height))));
          const url = tileImageUrl(el, w, FEED_IMAGE_SCALE);
          return (
            <Pressable key={el.id} style={[styles.tile, { width: w, backgroundColor: el.color ?? theme.colors.elevated }]}
              onPress={() => openElementViewer(navigation, { elements: item.items, initialIndex: item.items.indexOf(el), hasMore: false, userInteractionSource: 'Following' })}>
              {url ? <Image source={{ uri: url }} placeholder={el.blurHash ? { blurhash: el.blurHash } : undefined} contentFit="cover"
                blurRadius={el.nsfw?.treatment === 'blur' ? 30 : 0} style={styles.tileImage} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  loading: { paddingVertical: theme.spacing.xxxxl, alignItems: 'center' },
  item: { paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md },
  avatar: { width: 24, height: 24, borderRadius: theme.borderRadius.full, overflow: 'hidden', backgroundColor: theme.colors.pillElevated, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 24, height: 24 },
  headerText: { ...theme.typography.regular, color: theme.colors.secondary, flex: 1 },
  name: { ...theme.typography.regularPlus, color: theme.colors.primary },
  carousel: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.xxs },
  tile: { height: CAROUSEL_HEIGHT, borderRadius: theme.borderRadius.element, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder },
  tileImage: { width: '100%', height: '100%' },
}));
