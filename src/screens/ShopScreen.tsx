// Cosmos' ShopScreen (BottomTabNavigator's third tab): no header of its own, the tabs are its top row — 女装 / 男装 /
// 家居 / 特卖 (shop.category*) and 品牌 (shop.brands) — over a pager. Laid out as the web page lays it out (HANDOFF 6.61 /
// 6.121, the person's choice: Cosmos' layout, placeholder content; the tab row as Explore's, left-aligned and without an
// underline, 6.72 / 6.73).
//   - a department (ShopCategoryPage): FeaturedBrandsHero (cards 180 high, 32 in from the sides, at most 420 wide, 16
//     apart, the ones beside the middle one at .92 and .4, the page dots 18 under them, 6 high; 24 over the block, 12
//     under), 最近浏览 (compact cards), a ShopBrandFeatureCard and that brand's ShopShelf twice, then 浏览商品 with
//     BrandFilterRail pinned under the tabs and the products two by two (290 high, 12 apart). 特卖's prices are the sale
//     price with the original struck through, and its 促销中 is set
//   - 品牌 (ShopBrandsPage): 搜索品牌 over the A–Z index (a letter, secondary; its brands, primary) and the letters at
//     the side; a search that finds nothing: 这里还没有“…” (shop.brandNotOnCosmos, "here" for Cosmos), a line under it
//     and 申请添加品牌 (secondary, large, fitted to its words)
// A brand anywhere opens its page (BrandProfile), a product its page (ShopProduct). Near Cosmos (as on the web page):
// 新品 / 热卖 under a brand's cover and how many cards each block has are made up; the shelf header spacing (28 over,
// 16 in, 12 under) is Cosmos' usual one; 申请添加品牌 only says it cannot be sent (Cosmos mails its partnerships address).
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, TextInput, useWindowDimensions, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  interpolate, interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../components/Button';
import { SearchIcon } from '../components/icons';
import { BrandFilterRail } from '../components/shop/BrandFilter';
import { ProductCard, PressScale, useShopNavigation } from '../components/shop/ShopParts';
import { BRAND_LETTERS, PLACEHOLDER_BRAND_INDEX, SHOP_PLACEHOLDER_BRANDS, SHOP_TABS, useShopFilterStore } from '../lib/shop';
import { Routes } from '../navigation/routes';
import { showToast } from '../stores/useToastStore';
import { useTabReselect } from '../hooks/useTabReselect';

const HORIZONTAL_PADDING = 16;
const PAGE_BOTTOM_PADDING = 120; // SHOP_PAGE_BOTTOM_PADDING
// FeaturedBrandsHero (getHeroInitialOffset)
const HERO_HEIGHT = 180;
const HERO_SIDE = 32;
const HERO_MAX_WIDTH = 420;
const HERO_GAP = 16;
const BROWSE_PRODUCT_HEIGHT = 290;

export function ShopScreen() {
  const insets = useSafeAreaInsets();
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const lists = useRef<({ scrollTo: (o: { y: number; animated: boolean }) => void } | null)[]>([]);

  // the shop tab pressed again: the page on screen scrolls up (Cosmos refreshes it when it is already at the top; the
  // placeholder shop has nothing to reload, so there it does nothing)
  useTabReselect({
    tab: Routes.SHOP,
    isActive: () => true,
    isAtTop: () => false,
    refresh: () => undefined,
    scrollToTop: () => lists.current[page]?.scrollTo({ y: 0, animated: true }),
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.tabRow, { paddingTop: insets.top }]}>
        {SHOP_TABS.map((t, i) => <ShopTabLabel key={t.key} label={t.label} index={i} pagerX={pagerX} onPress={() => pager.current?.setPage(i)} />)}
      </View>
      <PagerView
        ref={pager}
        style={styles.pager}
        initialPage={0}
        onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => {
          const i = e.nativeEvent.position;
          setPage(i);
          useShopFilterStore.setState({ saleTab: SHOP_TABS[i].key === 'sale' });
        }}
      >
        {SHOP_TABS.map((t, i) => (
          <View key={t.key} style={styles.page}>
            {t.key === 'brands'
              ? <ShopBrandsPage />
              : <ShopCategoryPage sale={t.key === 'sale'} scrollRef={(r) => { lists.current[i] = r; }} />}
          </View>
        ))}
      </PagerView>
    </View>
  );
}

function ShopTabLabel({ label, index, pagerX, onPress }: { label: string; index: number; pagerX: SharedValue<number>; onPress: () => void }) {
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

function ShopCategoryPage({ sale, scrollRef }: { sale: boolean; scrollRef: (r: ScrollView | null) => void }) {
  const { width } = useWindowDimensions();
  const { openBrand } = useShopNavigation();
  const shelfCard = width * 0.43;
  const shelf = (title: string, compact: boolean, brand?: string) => (
    <View>
      {brand ? (
        <Pressable onPress={() => openBrand(brand)} accessibilityRole="button">
          <Text style={styles.sectionHead}>{title}<Text style={styles.chevron}> ›</Text></Text>
        </Pressable>
      ) : <Text style={styles.sectionHead}>{title}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRail}>
        {Array.from({ length: 6 }, (_, i) => <ProductCard key={i} i={i} sale={sale} compact={compact} width={shelfCard} />)}
      </ScrollView>
    </View>
  );
  const rows = Array.from({ length: 4 }, (_, r) => (
    <View key={`row-${r}`} style={styles.browseRow}>
      {[0, 1].map((c) => <ProductCard key={c} i={r * 2 + c} sale={sale} mediaFlex style={styles.browseCard} />)}
    </View>
  ));
  // the rail is the 8th child (index 7): it stays under the tabs once it gets there
  return (
    <ScrollView ref={scrollRef} stickyHeaderIndices={[7]} contentContainerStyle={{ paddingBottom: PAGE_BOTTOM_PADDING }} showsVerticalScrollIndicator={false}>
      <FeaturedBrandsHero />
      {shelf('最近浏览', true)}
      <BrandFeature name={SHOP_PLACEHOLDER_BRANDS[0]} />
      {shelf(SHOP_PLACEHOLDER_BRANDS[0], false, SHOP_PLACEHOLDER_BRANDS[0])}
      <BrandFeature name={SHOP_PLACEHOLDER_BRANDS[1]} />
      {shelf(SHOP_PLACEHOLDER_BRANDS[1], false, SHOP_PLACEHOLDER_BRANDS[1])}
      <Text style={styles.sectionHead}>浏览商品</Text>
      <View style={styles.railWrap}><BrandFilterRail ctx="shop" /></View>
      {rows}
    </ScrollView>
  );
}

// FeaturedBrandsHero: FeaturedBrandCards (a CustomPressable: a light haptic as it goes down) snapping to the middle;
// the ones beside it shrink and fade with their distance from it (getFeaturedBrandsHeroCardStyle)
function FeaturedBrandsHero() {
  const { width } = useWindowDimensions();
  const { openBrand } = useShopNavigation();
  const cardWidth = Math.min(HERO_MAX_WIDTH, width - 2 * HERO_SIDE);
  const step = cardWidth + HERO_GAP;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { x.set(e.contentOffset.x); });
  const brands = SHOP_PLACEHOLDER_BRANDS.slice(0, 4);
  return (
    <View style={styles.hero}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: (width - cardWidth) / 2, gap: HERO_GAP }}
      >
        {brands.map((name, i) => (
          <HeroCard key={name} name={name} index={i} step={step} x={x} width={cardWidth}
            onPress={() => openBrand(name)} />
        ))}
      </Animated.ScrollView>
      <View style={styles.dots}>
        {brands.map((name, i) => <HeroDot key={name} index={i} step={step} x={x} />)}
      </View>
    </View>
  );
}

function HeroCard({ name, index, step, x, width, onPress }: { name: string; index: number; step: number; x: SharedValue<number>; width: number; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.abs(x.get() / step - index));
    return { transform: [{ scale: 1 - t * 0.08 }], opacity: 1 - t * 0.6 };
  });
  return (
    <Animated.View style={[{ width }, style]}>
      <PressScale onPress={onPress} onPressIn={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} style={styles.heroCard} label={name}>
        <View style={[styles.cover, styles.dim15]} />
        <Text style={styles.coverName}>{name}</Text>
      </PressScale>
    </Animated.View>
  );
}

// CarouselPageIndicator: 6 dots, the current one 18 wide in primary
function HeroDot({ index, step, x }: { index: number; step: number; x: SharedValue<number> }) {
  const { theme } = useUnistyles();
  const on = theme.colors.primary;
  const off = theme.colors.disabled;
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.abs(x.get() / step - index));
    return { width: interpolate(t, [0, 1], [18, 6]), backgroundColor: interpolateColor(t, [0, 1], [on, off]) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

// ShopBrandFeatureCard: the brand's cover (2.07 : 1, its name on it) and a row of tiles under it, 4 apart
function BrandFeature({ name }: { name: string }) {
  const { openBrand } = useShopNavigation();
  return (
    <View style={styles.feature}>
      <PressScale onPress={() => openBrand(name)} style={styles.brandCover} label={name}>
        <View style={[styles.cover, styles.dim20]} />
        <Text style={styles.coverName}>{name}</Text>
      </PressScale>
      <View style={styles.tiles}>
        {['新品', '热卖'].map((t) => (
          <PressScale key={t} style={styles.tile} label={t}>
            <View style={[styles.cover, styles.dim10]} />
            <Text style={styles.tileText}>{t}</Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
}

function ShopBrandsPage() {
  const { theme } = useUnistyles();
  const { openBrand } = useShopNavigation();
  const list = useRef<SectionList<string>>(null);
  const [q, setQ] = useState('');
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const names = PLACEHOLDER_BRAND_INDEX.filter((n) => !needle || n.toLowerCase().includes(needle));
    return BRAND_LETTERS.map((l) => ({ title: l, data: names.filter((n) => n[0] === l) })).filter((s) => s.data.length);
  }, [q]);
  return (
    <View style={styles.page}>
      <View style={styles.brandSearch}>
        <SearchIcon color={theme.colors.tertiary} size={20} />
        <TextInput value={q} onChangeText={setQ} placeholder="搜索品牌" placeholderTextColor={theme.colors.tertiary} style={styles.brandInput}
          autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      </View>
      <SectionList
        ref={list}
        sections={sections}
        keyExtractor={(n) => n}
        contentContainerStyle={styles.brandList}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => <Text style={styles.brandLetter}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openBrand(item)} accessibilityRole="button">
            {({ pressed }) => <Text style={[styles.brandRow, pressed && styles.brandRowPressed]}>{item}</Text>}
          </Pressable>
        )}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>这里还没有“{q.trim()}”</Text>
            <Text style={styles.emptyHint}>我们会不断添加新品牌。申请添加此品牌，我们会进行评估。</Text>
            <Button text="申请添加品牌" variant="secondary" size="large" fitContent style={styles.request}
              onPress={() => showToast({ text: '占位：这里还不能申请添加品牌' })} />
          </View>
        )}
      />
      {sections.length ? (
        <View style={styles.scrubber}>
          {BRAND_LETTERS.map((l) => {
            const at = sections.findIndex((s) => s.title === l);
            return (
              <Pressable key={l} hitSlop={{ left: 8, right: 4 }} disabled={at < 0}
                onPress={() => list.current?.scrollToLocation({ sectionIndex: at, itemIndex: 0, viewPosition: 0, viewOffset: 28 })}>
                <Text style={[styles.scrubberLetter, at < 0 && styles.scrubberOff]}>{l}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  tabRow: { flexDirection: 'row', paddingHorizontal: HORIZONTAL_PADDING - 8, backgroundColor: theme.colors.background, zIndex: 1 },
  tab: { paddingTop: 10, paddingBottom: 9, paddingHorizontal: 12 },
  tabText: { ...theme.typography.largePlus },
  pager: { flex: 1 },
  page: { flex: 1 },
  sectionHead: { ...theme.typography.largePlus, color: theme.colors.primary, paddingTop: 28, paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 12 },
  chevron: { color: theme.colors.tertiary },
  shelfRail: { gap: 12, paddingHorizontal: HORIZONTAL_PADDING },
  railWrap: { backgroundColor: theme.colors.background, marginBottom: 12 },
  browseRow: { flexDirection: 'row', gap: 12, paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 12 },
  browseCard: { flex: 1, height: BROWSE_PRODUCT_HEIGHT },
  hero: { paddingTop: 24, paddingBottom: 12 },
  heroCard: {
    height: HERO_HEIGHT, borderRadius: theme.borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.lightElevation, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  cover: { ...StyleSheet.absoluteFillObject },
  dim20: { backgroundColor: '#00000033' },
  dim15: { backgroundColor: '#00000026' },
  dim10: { backgroundColor: '#0000001A' },
  coverName: { ...theme.typography.headingMedium, fontSize: 20, color: '#FFFFFF' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18, height: 6 },
  dot: { height: 6, borderRadius: 3 },
  feature: { paddingTop: 28, paddingHorizontal: HORIZONTAL_PADDING },
  brandCover: {
    aspectRatio: 2.07, borderRadius: theme.borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.lightElevation, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  tiles: { flexDirection: 'row', gap: 4, marginTop: 4 },
  tile: { flex: 1, aspectRatio: 1, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.lightElevation, overflow: 'hidden' },
  tileText: { position: 'absolute', left: 16, right: 16, bottom: 16, ...theme.typography.largePlus, color: '#FFFFFF' },
  brandSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginHorizontal: HORIZONTAL_PADDING, marginBottom: 8,
    height: 44, paddingHorizontal: 14, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.elevated,
  },
  brandInput: { flex: 1, minWidth: 0, ...theme.typography.large, color: theme.colors.primary, paddingVertical: 0 },
  brandList: { paddingLeft: HORIZONTAL_PADDING, paddingRight: 40, paddingBottom: PAGE_BOTTOM_PADDING },
  brandLetter: { ...theme.typography.regular, color: theme.colors.secondary, paddingTop: 20, paddingBottom: 8 },
  brandRow: { ...theme.typography.large, fontSize: 18, lineHeight: 24, paddingVertical: 8, color: theme.colors.primary },
  brandRowPressed: { opacity: 0.55 },
  scrubber: { position: 'absolute', right: 4, top: 72 },
  scrubberLetter: { fontSize: 11, lineHeight: 16, paddingHorizontal: 6, color: theme.colors.primary },
  scrubberOff: { color: theme.colors.tertiary },
  empty: { alignItems: 'center', paddingTop: theme.spacing.xxxxl, paddingRight: 24, gap: theme.spacing.xxs },
  emptyTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  emptyHint: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center' },
  request: { marginTop: 20 },
}));
