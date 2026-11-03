// Cosmos' VerifiedProfileScreen (with VerifiedProfileHeaderContainer, VerifiedProfileHeroContent, VerifiedProfileStickyTopBar,
// VerifiedProfileOverviewScene, OverviewHeader, FeaturedCollectionCard), what ProfileScreen shows for an account with a
// verified profile:
//   - the hero: the screen's height × 0.65 less 80 (at least 360), 4 in, 32 round, the cover under two shades (0.7 → 0 over
//     the top 250, 0 → 0.9 from 100 down); 20 in from its edges, md apart: the name (white 26, −0.5), the badge and 已认证, the
//     bio in two lines with .... 查看更多 (white, 60 %), 关注 / 正在关注 (flex 1) and the socials (#FFFFFF29)
//   - the bar over it: the way back (one's own: share), the name, search (one's own: and settings) and more; its background and the name fade in over the
//     bar's height before the tabs reach it, its buttons white while the hero is under it
//   - the tabs 概览 / 收藏 / 元素 fold up under the bar. 概览: 精选收藏 (the first three, a row of cards 172 high, 12 apart, the next
//     one showing at least 24; 显示全部 goes to 收藏) over 热门元素 (popular, 35 a page); 收藏 and 元素 are the profile's own lists
// Near Cosmos: "popular" is the local search's sort (Cosmos' server has its own list); the wordmark picture and the hold on
// the hero's picture until loaded are not here, as local accounts have no wordmark; StateScene's skeleton is a blank hero.
// The verified mark itself is local: an admin sets it (UserMenuSheet, the settings for oneself; POST /api/users/:id/verified-profile).
import type { FlashListRef } from '@shopify/flash-list';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking, Pressable, ScrollView, Share, Text, useWindowDimensions, View, type FlatList, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import Animated, { useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';
import { usePagedList } from '../../hooks/usePagedList';
import type { Element } from '../../lib/elements';
import { noteGridMoved } from '../../lib/gridVideos';
import { absoluteUrl, serverUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../bar/constants';
import { Button } from '../Button';
import type { Collection } from '../clusters/CollectionCard';
import { DEFAULT_GRID_GAP } from '../home/ForYouFeed';
import { ChevronLeftIcon, MoreIcon, SearchIcon, SettingsIcon, ShareIcon, VerifiedProfileIcon } from '../icons';
import { useUserMenuStore } from '../sheets/UserMenuSheet';
import { ProfileClusterGrid, type ProfileClusterGridItem } from './ProfileClusterGrid';
import { ProfileElementGrid } from './ProfileElementGrid';
import { profileSocialLinks, type ProfileUser } from './ProfileInfo';
import { ProfileTabBar } from './ProfileTabBar';
import { GlobalIcon, SocialIcon, type SocialPlatform } from './socialIcons';

const BAR_CONTENT = 64;
const HERO_INSET = 4;
const VERIFIED_PROFILE_ELEMENT_PAGE_SIZE = 35;
const FEATURED_CAROUSEL_HORIZONTAL_PADDING = 12;
const FEATURED_CAROUSEL_GAP = 12;
const FEATURED_CARD_MIN_VISIBLE_NEXT_CARD_WIDTH = 24;
const VERIFIED_PROFILE_COLLECTION_CARD_HEIGHT = 172;
const FEATURED_COUNT = 3;
const COLLECTION_GRADIENT_COLORS = ['rgba(0, 0, 0, 0.04)', 'rgba(0, 0, 0, 0.28)', 'rgba(0, 0, 0, 0.72)'] as const;
const COLLECTION_GRADIENT_LOCATIONS = [0, 0.48, 1] as const;

type Props = {
  profile: ProfileUser & { isFollowed?: boolean };
  isMe: boolean;
  isRoot: boolean;
  userId: string;
  elements: ReturnType<typeof usePagedList<Element>>;
  collections: Collection[] | null;
  refreshing: boolean;
  onRefresh: () => void;
  onFollow: () => void;
  onSearch: () => void;
  onCreateCollection: () => void;
};

function FeaturedCollectionCard({ item, width, onPress }: { item: Collection; width: number; onPress: () => void }) {
  const cover = item.covers?.[0];
  return (
    <Pressable style={[styles.card, { width, height: VERIFIED_PROFILE_COLLECTION_CARD_HEIGHT }]} onPress={onPress} accessibilityRole="button">
      {cover ? <Image source={{ uri: absoluteUrl(cover) }} style={styles.cardImage} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.cardPlaceholder} />}
      <LinearGradient colors={COLLECTION_GRADIENT_COLORS} locations={COLLECTION_GRADIENT_LOCATIONS} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.cardText} pointerEvents="none">
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardCount}>{item.count} 元素</Text>
      </View>
    </Pressable>
  );
}

function OverviewHeader({ collections, cardWidth, hasPopular, onOpen, onShowAll }: {
  collections: Collection[]; cardWidth: number; hasPopular: boolean; onOpen: (c: Collection) => void; onShowAll: () => void;
}) {
  return (
    <View>
      {collections.length ? (
        <View style={styles.featured}>
          <View style={styles.overviewRow}>
            <Text style={styles.overviewTitle}>精选收藏</Text>
            <Text style={styles.showAll} onPress={onShowAll} accessibilityRole="button">显示全部</Text>
          </View>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" disableIntervalMomentum snapToAlignment="start"
            snapToInterval={cardWidth + FEATURED_CAROUSEL_GAP}
            contentContainerStyle={styles.carousel}
          >
            {collections.map((c) => <FeaturedCollectionCard key={c.id} item={c} width={cardWidth} onPress={() => onOpen(c)} />)}
          </ScrollView>
        </View>
      ) : null}
      {hasPopular ? <View style={styles.overviewRow}><Text style={styles.overviewTitle}>热门元素</Text></View> : null}
    </View>
  );
}

export function VerifiedProfileView({ profile, isMe, isRoot, userId, elements, collections, refreshing, onRefresh, onFollow, onSearch, onCreateCollection }: Props) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { width, height: screenH } = useWindowDimensions();
  const bar = insets.top + BAR_CONTENT;
  const heroH = Math.max(360, screenH * 0.65 - 80);
  const popular = usePagedList<Element>(`/api/elements?user=${encodeURIComponent(userId)}&sort=popular`, VERIFIED_PROFILE_ELEMENT_PAGE_SIZE);

  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);
  const pageRef = useRef(0);
  const overviewList = useRef<FlashListRef<Element>>(null);
  const clusterList = useRef<FlatList<ProfileClusterGridItem>>(null);
  const elementList = useRef<FlashListRef<Element>>(null);
  const y0 = useSharedValue(0);
  const y1 = useSharedValue(0);
  const y2 = useSharedValue(0);
  const activeSv = useSharedValue(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [viewport, setViewport] = useState(0);
  const headerScrollMax = Math.max(0, headerHeight - tabBarHeight - bar);
  const maxSv = useSharedValue(0);
  useEffect(() => { maxSv.set(headerScrollMax); }, [maxSv, headerScrollMax]);

  const y = useDerivedValue(() => { const a = activeSv.get(); return a === 0 ? y0.get() : a === 1 ? y1.get() : y2.get(); });
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.min(Math.max(y.get(), 0), maxSv.get()) }] }));
  const onScroll = useMemo(() => [y0, y1, y2].map((sv) => (e: NativeSyntheticEvent<NativeScrollEvent>) => { sv.set(e.nativeEvent.contentOffset.y); noteGridMoved(); }), [y0, y1, y2]);

  const scrollPageTo = (i: number, offset: number, animated = false) => {
    if (i === 0) overviewList.current?.scrollToOffset({ offset, animated });
    else if (i === 1) clusterList.current?.scrollToOffset({ offset, animated });
    else elementList.current?.scrollToOffset({ offset, animated });
  };
  // useProfileTabScrollSync: the other pages fold the header as far as this one does
  const syncOthers = () => {
    const values = [y0, y1, y2];
    const folded = Math.min(Math.max(values[pageRef.current].get(), 0), headerScrollMax);
    values.forEach((sv, i) => {
      if (i === pageRef.current) return;
      const theirs = sv.get();
      if (folded < headerScrollMax ? theirs !== folded : theirs < headerScrollMax) { scrollPageTo(i, folded); sv.set(folded); }
    });
  };
  const goTo = (i: number) => {
    if (i === pageRef.current) return;
    syncOthers();
    pager.current?.setPage(i);
  };

  const dragStart = useRef(0);
  const headerPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-8, 8])
    .failOffsetX([-12, 12])
    .onStart(() => { dragStart.current = [y0, y1, y2][pageRef.current].get(); })
    .onUpdate((e) => scrollPageTo(pageRef.current, Math.max(0, dragStart.current - e.translationY)));

  // useProfileHeaderAnimations' stickyTopBarCollapseProgress: the bar's background and name, over the bar's height before the tabs reach it
  const revealStart = heroH + 2 * HERO_INSET - bar;
  const from = revealStart - bar;
  const white = '#FFFFFF';
  const primary = theme.colors.primary;
  const barBg = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, (y.get() - from) / bar)) }));
  const title = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (y.get() - from) / bar));
    return { opacity: p, color: p < 0.5 ? white : primary };
  });
  const [onHero, setOnHero] = useState(true);
  useAnimatedReaction(() => y.get() - from < bar / 2, (over, prev) => { if (over !== prev) scheduleOnRN(setOnHero, over); });
  const barColor = onHero ? white : primary;

  const name = profile.verifiedProfile?.name || profile.fullName || profile.username;
  const cover = profile.verifiedProfile?.coverImage?.url ?? profile.avatarUrl ?? null;
  const socials = profileSocialLinks(profile);
  const cardWidth = width - FEATURED_CAROUSEL_HORIZONTAL_PADDING - FEATURED_CAROUSEL_GAP - FEATURED_CARD_MIN_VISIBLE_NEXT_CARD_WIDTH;
  const openCollection = (c: Collection) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: c.id } } });
  const share = () => { void Share.share({ message: `${serverUrl()}/profile/${encodeURIComponent(profile.id)}`, title: name }); };
  const bottomInset = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + DEFAULT_GRID_GAP;
  const listProps = { headerHeight, headerScrollMax, viewport, bottomInset, refreshing, onRefresh, isMe };
  const featured = (collections ?? []).slice(0, FEATURED_COUNT);

  return (
    <View style={styles.screen} onLayout={(e) => setViewport(e.nativeEvent.layout.height)}>
      <PagerView
        ref={pager}
        style={styles.pager}
        initialPage={0}
        onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageScrollStateChanged={(e) => { if (e.nativeEvent.pageScrollState === 'dragging') syncOthers(); }}
        onPageSelected={(e) => { const i = e.nativeEvent.position; pageRef.current = i; activeSv.set(i); noteGridMoved(); }}
      >
        <View key="overview" style={styles.page}>
          <ProfileElementGrid
            {...listProps} list={popular} listRef={overviewList} onScroll={onScroll[0]} isMe={false}
            listHeader={<OverviewHeader collections={featured} cardWidth={cardWidth} hasPopular={popular.items.length > 0} onOpen={openCollection} onShowAll={() => goTo(1)} />}
          />
        </View>
        <View key="collections" style={styles.page}>
          <ProfileClusterGrid {...listProps} collections={collections} listRef={clusterList} onScroll={onScroll[1]} onOpen={openCollection} onCreate={onCreateCollection} />
        </View>
        <View key="elements" style={styles.page}>
          <ProfileElementGrid {...listProps} list={elements} listRef={elementList} onScroll={onScroll[2]} />
        </View>
      </PagerView>
      <GestureDetector gesture={headerPan}>
        <Animated.View style={[styles.foldingHeader, headerStyle]} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <View style={[styles.hero, { height: heroH }]}>
            {cover ? <Image source={{ uri: absoluteUrl(cover) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']} style={styles.shadeTop} pointerEvents="none" />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']} style={styles.shadeBottom} pointerEvents="none" />
            <View style={styles.heroContent}>
              <Text style={styles.wordmark} numberOfLines={1}>{name}</Text>
              <View style={styles.verifiedRow} pointerEvents="none">
                <VerifiedProfileIcon size={18} />
                <Text style={styles.verifiedText}>已认证</Text>
              </View>
              {profile.bio ? <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text> : null}
              <View style={styles.actions}>
                {isMe ? null : (
                  <Button
                    text={profile.isFollowed ? '正在关注' : '关注'} size="regular" variant={profile.isFollowed ? 'outline' : 'invertedPrimary'}
                    onPress={onFollow} style={profile.isFollowed ? [styles.followButton, styles.followingButton] : styles.followButton}
                  />
                )}
                {socials.map(([key, href]) => (
                  <Pressable key={key} style={styles.socialButton} onPress={() => void Linking.openURL(href)} accessibilityRole="link" accessibilityLabel={key}>
                    {key === '网站' ? <GlobalIcon color={white} /> : <SocialIcon platform={key as SocialPlatform} color={white} />}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.tabs} onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}>
            <ProfileTabBar pagerX={pagerX} onPress={goTo} tabs={[{ label: '概览' }, { label: '收藏', count: collections?.length }, { label: '元素', count: elements.count }]} />
          </View>
        </Animated.View>
      </GestureDetector>
      <View style={[styles.bar, { height: bar, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.barBg, barBg]} pointerEvents="none" />
        {isRoot ? (
          <Pressable style={styles.barButton} onPress={share} accessibilityRole="button" accessibilityLabel="分享">
            <ShareIcon color={barColor} size={24} />
          </Pressable>
        ) : (
          <Pressable style={styles.barButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回">
            <ChevronLeftIcon color={barColor} size={24} />
          </Pressable>
        )}
        <Animated.Text style={[styles.barTitle, title]} numberOfLines={1}>{name}</Animated.Text>
        <Pressable style={styles.barButton} onPress={onSearch} accessibilityRole="button" accessibilityLabel="搜索">
          <SearchIcon color={barColor} size={24} />
        </Pressable>
        {isRoot ? (
          <Pressable style={styles.barButton} onPress={() => navigation.navigate(Routes.SETTINGS)} accessibilityRole="button" accessibilityLabel="设置">
            <SettingsIcon color={barColor} size={24} />
          </Pressable>
        ) : null}
        <Pressable style={styles.barButton} onPress={() => useUserMenuStore.getState().open(userId, onRefresh)} accessibilityRole="button" accessibilityLabel="更多">
          <MoreIcon color={barColor} size={24} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  pager: { flex: 1 },
  page: { flex: 1 },
  foldingHeader: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: theme.colors.background },
  hero: { margin: HERO_INSET, borderRadius: 32, overflow: 'hidden', backgroundColor: theme.colors.lightElevation },
  shadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 250 },
  shadeBottom: { position: 'absolute', top: 100, left: 0, right: 0, bottom: 0 },
  heroContent: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: theme.spacing.md },
  wordmark: { ...theme.typography.headingLarge, fontSize: 26, lineHeight: 44, letterSpacing: -0.5, color: '#FFFFFF' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs, marginTop: -12 },
  verifiedText: { ...theme.typography.regular, color: '#FFFFFF' },
  bio: { ...theme.typography.regular, color: '#FFFFFF', textAlign: 'left', marginTop: -theme.spacing.xxs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  followButton: { flex: 1 },
  followingButton: { borderColor: '#FFFFFF', borderWidth: 1 },
  socialButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF29', alignItems: 'center', justifyContent: 'center' },
  tabs: { marginTop: theme.spacing.xs },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  barBg: { backgroundColor: theme.colors.background },
  barButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, minWidth: 0, ...theme.typography.largePlus },
  featured: { marginBottom: 32 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: FEATURED_CAROUSEL_HORIZONTAL_PADDING - DEFAULT_GRID_GAP / 2 },
  overviewTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  showAll: { ...theme.typography.regularPlus, color: theme.colors.tertiary },
  carousel: { gap: FEATURED_CAROUSEL_GAP, paddingHorizontal: FEATURED_CAROUSEL_HORIZONTAL_PADDING - DEFAULT_GRID_GAP / 2 },
  card: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#0000001A', borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.elevated },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, backgroundColor: theme.colors.elevated },
  cardText: { position: 'absolute', left: 12, bottom: 12 },
  cardName: { ...theme.typography.largePlus, color: '#FFFFFF' },
  cardCount: { ...theme.typography.caption, color: '#FFFFFF' },
}));
