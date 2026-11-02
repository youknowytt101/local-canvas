// Cosmos' BrandProfileScreen (screens/profile/, reached from the shop's stack: ShopNavigator → BRAND_PROFILE, the
// default push), with the web page's placeholder content (HANDOFF 6.62):
//   - HeroHeader: the screen's height × 0.65 less 80 (at least 360), 4 in from the edges (HERO_CARD_INSET), 32 round
//     (HERO_BORDER_RADIUS), a 250 shade from the top (0.7 → 0) and one from 100 down to the bottom (0 → 0.9);
//     VerifiedProfileHeroContent 20 from its edges, md apart: the name (the wordmark's fallback: white 26, −0.5), 已认证,
//     the bio with its "…. 查看更多" (99 alpha), 关注 (flex 1) and two social buttons (#FFFFFF29)
//   - VerifiedProfileStickyTopBar over it: back, the name, more; its background and the name fade in over the bar's
//     height before the rail reaches it (useProfileHeaderAnimations' stickyTopBarCollapseProgress), white while the
//     hero is under it
//   - BrandFilterRail pinned under the bar (a hairline once pinned), starting afresh for each brand; BrandProductGrid:
//     product tiles in two masonry columns, 12 apart, 16 in
// Near Cosmos: the web page's card-to-hero morph (the person's choice there, 6.65) is not done here; the push is the
// native stack's default, which is what Cosmos has.
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ChevronLeftIcon, MoreIcon } from '../../components/icons';
import { BrandFilterRail, BROWSE_RAIL_HEIGHT } from '../../components/shop/BrandFilter';
import { ProductCard } from '../../components/shop/ShopParts';
import { PLACEHOLDER_RATIOS, useShopFilterStore } from '../../lib/shop';

const BAR_CONTENT = 64;
const HERO_INSET = 4;

export function BrandProfileScreen() {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const { name } = useRoute<RouteProp<{ b: { name: string } }, 'b'>>().params;
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const bar = insets.top + BAR_CONTENT;
  const heroH = Math.max(360, screenH * 0.65 - 80);
  useEffect(() => { useShopFilterStore.getState().resetBrand(); }, [name]);

  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.set(e.contentOffset.y); });
  // where the rail reaches the bar: the hero (and its 4 + 4) and the rail's 8 over it
  const revealStart = heroH + 2 * HERO_INSET + 8 - bar;
  const from = revealStart - bar; // the bar's background and the name fade in over the bar's height up to revealStart
  const white = '#FFFFFF';
  const primary = theme.colors.primary;
  const barBg = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, (y.get() - from) / bar)) }));
  const title = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (y.get() - from) / bar));
    return { opacity: p, color: p < 0.5 ? white : primary };
  });
  // the buttons are white while the hero is under the bar (over-hero), primary once the bar's background is in
  const [onHero, setOnHero] = useState(true);
  useAnimatedReaction(() => y.get() - from < bar / 2, (over, prev) => { if (over !== prev) scheduleOnRN(setOnHero, over); });
  const hairline = useAnimatedStyle(() => ({ opacity: y.get() >= revealStart ? 1 : 0 }));
  // the rail pins under the bar by moving down with the scroll once it reaches it (a ScrollView's stickyHeaderIndices
  // would take onScroll over with its own Animated.event, and the bar would never hear of the scroll)
  const pin = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(0, y.get() - revealStart) }] }));

  const cols: number[][] = [[], []];
  PLACEHOLDER_RATIOS.forEach((_, i) => cols[i % 2].push(i));

  return (
    <View style={styles.screen}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { height: heroH }]}>
          <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']} style={styles.shadeTop} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']} style={styles.shadeBottom} />
          <View style={styles.heroContent}>
            <Text style={styles.wordmark} numberOfLines={1}>{name}</Text>
            <Text style={styles.verified}>✓ 已认证</Text>
            <Text style={styles.bio}>品牌简介占位文字，介绍这个品牌在做什么<Text style={styles.more}>.... 查看更多</Text></Text>
            <View style={styles.actions}>
              <Pressable style={styles.follow} accessibilityRole="button"><Text style={styles.followText}>关注</Text></Pressable>
              <View style={styles.social}><Text style={styles.socialText}>◎</Text></View>
              <View style={styles.social}><Text style={styles.socialText}>↗</Text></View>
            </View>
          </View>
        </View>
        <Animated.View style={[styles.railBox, pin]}>
          <BrandFilterRail ctx="brand" />
          <Animated.View style={[styles.hairline, hairline]} />
        </Animated.View>
        <View style={styles.grid}>
          {cols.map((col, c) => (
            <View key={c} style={styles.col}>
              {col.map((i) => <ProductCard key={i} i={i} mediaRatio={PLACEHOLDER_RATIOS[i]} />)}
            </View>
          ))}
        </View>
      </Animated.ScrollView>
      <View style={[styles.bar, { height: bar, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.barBg, barBg]} pointerEvents="none" />
        <Pressable style={styles.barButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回">
          <ChevronLeftIcon color={onHero ? white : primary} size={24} />
        </Pressable>
        <Animated.Text style={[styles.barTitle, title]} numberOfLines={1}>{name}</Animated.Text>
        <View style={styles.barButton}><MoreIcon color={onHero ? white : primary} size={24} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 120 },
  hero: { margin: HERO_INSET, borderRadius: 32, overflow: 'hidden', backgroundColor: theme.colors.lightElevation },
  shadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 250 },
  shadeBottom: { position: 'absolute', top: 100, left: 0, right: 0, bottom: 0 },
  heroContent: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: theme.spacing.md },
  wordmark: { ...theme.typography.headingLarge, fontSize: 26, lineHeight: 44, letterSpacing: -0.5, color: '#FFFFFF' },
  verified: { ...theme.typography.regular, color: '#FFFFFF', marginTop: -12 },
  bio: { ...theme.typography.regular, lineHeight: 18, color: '#FFFFFF', marginTop: 4 },
  more: { color: '#FFFFFF99' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  follow: { flex: 1, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  followText: { ...theme.typography.regularPlus, color: '#0D0D0D' },
  social: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF29', alignItems: 'center', justifyContent: 'center' },
  socialText: { color: '#FFFFFF', fontSize: 16 },
  railBox: { backgroundColor: theme.colors.background, height: BROWSE_RAIL_HEIGHT, marginTop: 8, marginBottom: 12, zIndex: 1 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.surfaceBorder },
  grid: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  col: { flex: 1, minWidth: 0, gap: 12 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  barBg: { backgroundColor: theme.colors.background },
  barButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, minWidth: 0, ...theme.typography.largePlus },
}));
