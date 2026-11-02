// Cosmos' BrandFilterRail and BrandFilterSheet (the shop's 浏览商品 and a brand's page use the same ones; values read
// for the web page, HANDOFF 6.121):
//   - the rail: 筛选 (40 round, 1 px surfaceBorder, sliders 20), then 排序 / 性别 / 价格 (a DropdownPill: 16 left, 12
//     right, a chevron 18 four from the words) and 有货 / 促销中 (a TogglePill, 16 a side); 40 high, 20 round, 8 apart,
//     12 from the sides, 8 from the rail's top, the rail 57 high. A pill is filled (elevated, no border) while its
//     filter is set. 性别 only on a brand's page (brandHasGenderFilter); on 特卖 促销中 is set and stays set
//   - the sheet: 筛选 (全部清除 once something is set) with 排序方式 (its value and ›), 性别 (›), 价格 (›), 促销中 (✓),
//     有货 (✓); its pages 排序方式 / 性别 / 价格范围 (重置) open from there with a back chevron. Header 24 left, 8
//     right, 16 over, 12 under, the back button 40 (10 to the left, 2 from the title), the title headingMedium, the clear
//     button regularPlus tertiary (8 / 12); rows 54 high, 24 left, 20 right, 12 apart, ticks and chevrons 18. 价格范围
//     is RangeSlider (24 in, 16 over) and 保存 (24 under it, 20 in). A pill opens its page straight away: choosing there
//     closes the sheet, choosing on a page opened from 筛选 goes back to it.
// Near Cosmos: 商品类型 (from the products' category tree) is not there; filters change nothing in placeholder lists.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';
import {
  filterLocks, freshShopFilter, priceRangeLabel, SHOP_GENDERS, SHOP_PRICE_BOUNDS, SHOP_PRICE_STEP, SHOP_SORTS,
  useShopFilterStore, type FilterContext, type PriceRange,
} from '../../lib/shop';
import { Button } from '../Button';
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SlidersIcon } from '../icons';
import { SheetGrabber } from '../sheets/SheetGrabber';

export const SHOP_FILTER_SHEET = 'shop-filter';
export const BROWSE_RAIL_HEIGHT = 57;

function openFilter(ctx: FilterContext, view: 'hub' | 'sort' | 'gender' | 'price') {
  useShopFilterStore.setState({ sheet: { ctx, view, direct: view !== 'hub' } });
  void TrueSheet.present(SHOP_FILTER_SHEET).catch(() => undefined);
}

export function BrandFilterRail({ ctx }: { ctx: FilterContext }) {
  const { theme } = useUnistyles();
  const f = useShopFilterStore((s) => s.filters[ctx]);
  const saleTab = useShopFilterStore((s) => s.saleTab);
  const set = useShopFilterStore((s) => s.set);
  const locks = filterLocks(ctx, saleTab);
  const dropdown = (label: string, active: boolean, view: 'sort' | 'gender' | 'price') => (
    <Pressable key={view} style={[styles.pill, styles.dropdown, active && styles.active]} onPress={() => openFilter(ctx, view)} accessibilityRole="button">
      <Text style={styles.pillText}>{label}</Text>
      <ChevronDownIcon color={theme.colors.primary} size={18} />
    </Pressable>
  );
  const toggle = (label: string, key: 'inStock' | 'onSale') => {
    const on = f[key] || (key === 'onSale' && locks.onSale);
    return (
      <Pressable key={key} style={[styles.pill, styles.toggle, on && styles.active]} accessibilityRole="switch" accessibilityState={{ checked: on }}
        onPress={() => { if (!(key === 'onSale' && locks.onSale)) set(ctx, { [key]: !f[key] }); }}>
        <Text style={styles.pillText}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
      <Pressable style={[styles.pill, styles.sliders]} onPress={() => openFilter(ctx, 'hub')} accessibilityRole="button" accessibilityLabel="筛选">
        <SlidersIcon color={theme.colors.primary} size={20} />
      </Pressable>
      {dropdown('排序', f.sort !== 'latest', 'sort')}
      {locks.gender ? dropdown('性别', !!f.gender, 'gender') : null}
      {dropdown(f.price ? priceRangeLabel(f.price) : '价格', !!f.price, 'price')}
      {toggle('有货', 'inStock')}
      {toggle('促销中', 'onSale')}
    </ScrollView>
  );
}

export function BrandFilterSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const sheet = useShopFilterStore((s) => s.sheet);
  const f = useShopFilterStore((s) => s.filters[sheet.ctx]);
  const saleTab = useShopFilterStore((s) => s.saleTab);
  const setFilter = useShopFilterStore((s) => s.set);
  const locks = filterLocks(sheet.ctx, saleTab);
  const [draft, setDraft] = useState<PriceRange | null>(null);
  useEffect(() => { if (sheet.view !== 'price') setDraft(null); }, [sheet.view]);

  const set = (patch: Parameters<typeof setFilter>[1]) => setFilter(sheet.ctx, patch);
  const go = (view: typeof sheet.view) => useShopFilterStore.setState({ sheet: { ...sheet, view } });
  const done = () => {
    if (sheet.direct) void TrueSheet.dismiss(SHOP_FILTER_SHEET).catch(() => undefined);
    else go('hub');
  };
  const header = (title: string, clear?: string | null, onClear?: () => void) => (
    <View style={styles.head}>
      {sheet.view !== 'hub' && !sheet.direct ? (
        <Pressable style={styles.back} onPress={() => go('hub')} accessibilityRole="button" accessibilityLabel="返回">
          <ChevronLeftIcon color={theme.colors.primary} size={24} />
        </Pressable>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {clear ? <Pressable onPress={onClear} style={styles.clear} accessibilityRole="button"><Text style={styles.clearText}>{clear}</Text></Pressable> : null}
    </View>
  );
  const row = (label: string, opts: { detail?: string | null; chevron?: boolean; on?: boolean; disabled?: boolean; onPress: () => void }) => (
    <Pressable key={label} style={[styles.row, opts.disabled && styles.rowDisabled]} disabled={opts.disabled} onPress={opts.onPress} accessibilityRole="button">
      <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.trailing}>
        {opts.detail ? <Text style={styles.detail} numberOfLines={1}>{opts.detail}</Text> : null}
        {opts.chevron ? <ChevronRightIcon color={theme.colors.primary} size={18} />
          : opts.on ? <CheckIcon color={theme.colors.primary} size={18} /> : <View style={styles.tickSpace} />}
      </View>
    </Pressable>
  );
  const pick = <V extends string>(options: readonly (readonly [V, string])[], current: V | null, key: 'sort' | 'gender') =>
    options.map(([v, label]) => row(label, { on: current === v, onPress: () => { set({ [key]: v }); done(); } }));

  let body;
  if (sheet.view === 'sort') body = <>{header('排序方式')}{pick(SHOP_SORTS, f.sort, 'sort')}</>;
  else if (sheet.view === 'gender') body = <>{header('性别')}{pick(SHOP_GENDERS, f.gender, 'gender')}</>;
  else if (sheet.view === 'price') {
    const d = draft ?? f.price ?? SHOP_PRICE_BOUNDS;
    body = (
      <>
        {header('价格范围', '重置', () => setDraft({ ...SHOP_PRICE_BOUNDS }))}
        <RangeSlider value={d} onChange={setDraft} />
        <Button text="保存" fullWidth style={styles.save} onPress={() => {
          set({ price: d.min <= SHOP_PRICE_BOUNDS.min && d.max >= SHOP_PRICE_BOUNDS.max ? null : { ...d } });
          setDraft(null);
          done();
        }} />
      </>
    );
  } else {
    const any = f.sort !== 'latest' || !!f.gender || !!f.price || (f.onSale && !locks.onSale) || f.inStock;
    body = (
      <>
        {header('筛选', any ? '全部清除' : null, () => set({ ...freshShopFilter(), onSale: false }))}
        {row('排序方式', { detail: SHOP_SORTS.find(([v]) => v === f.sort)?.[1], chevron: true, onPress: () => go('sort') })}
        {locks.gender ? row('性别', { detail: SHOP_GENDERS.find(([v]) => v === f.gender)?.[1], chevron: true, onPress: () => go('gender') }) : null}
        {row('价格', { detail: f.price ? priceRangeLabel(f.price) : null, chevron: true, onPress: () => go('price') })}
        {row('促销中', { on: f.onSale || locks.onSale, disabled: locks.onSale, onPress: () => set({ onSale: !f.onSale }) })}
        {row('有货', { on: f.inStock, onPress: () => set({ inStock: !f.inStock }) })}
      </>
    );
  }
  return (
    <TrueSheet name={SHOP_FILTER_SHEET} detents={['auto']} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}>
      {/* the sheet's content is on a native root of its own: the slider's pans need their own gesture root there */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SheetGrabber />
        <View style={{ paddingBottom: insets.bottom + 12 }}>{body}</View>
      </GestureHandlerRootView>
    </TrueSheet>
  );
}

// RangeSlider: two thumbs (28 round, sheet colour, a hairline, the default shadow) on a 4 high track (elevated), the span
// between them filled (primary); the two prices under the ends (regular, secondary)
function RangeSlider({ value, onChange }: { value: PriceRange; onChange: (v: PriceRange) => void }) {
  const [width, setWidth] = useState(0);
  const { min: lo, max: hi } = SHOP_PRICE_BOUNDS;
  const span = Math.max(width - THUMB, 1);
  const x = (v: number) => ((v - lo) / (hi - lo)) * span;
  const at = (px: number) => Math.round((lo + (Math.min(Math.max(px, 0), span) / span) * (hi - lo)) / SHOP_PRICE_STEP) * SHOP_PRICE_STEP;
  const move = (key: 'min' | 'max', px: number) => {
    const v = at(px);
    onChange(key === 'min' ? { ...value, min: Math.min(v, value.max - SHOP_PRICE_STEP) } : { ...value, max: Math.max(v, value.min + SHOP_PRICE_STEP) });
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  const thumb = (key: 'min' | 'max') => (
    <Thumb key={key} left={x(value[key])} label={key === 'min' ? '最低价格' : '最高价格'} onMove={(px) => moveRef.current(key, px)} />
  );
  return (
    <View style={styles.range}>
      <View style={styles.track} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.trackLine} />
        <View style={[styles.trackFill, { left: x(value.min) + THUMB / 2, width: x(value.max) - x(value.min) }]} />
        {width ? <>{thumb('min')}{thumb('max')}</> : null}
      </View>
      <View style={styles.rangeLabels}>
        <Text style={styles.rangeLabel}>¥{value.min}</Text>
        <Text style={styles.rangeLabel}>{value.max >= hi ? `¥${hi}+` : `¥${value.max}`}</Text>
      </View>
    </View>
  );
}
const THUMB = 28;

// one thumb: where it was when the finger went down, plus how far the finger has gone
function Thumb({ left, label, onMove }: { left: number; label: string; onMove: (px: number) => void }) {
  const leftRef = useRef(left);
  leftRef.current = left;
  const start = useRef(0);
  const cb = useRef(onMove);
  cb.current = onMove;
  const pan = useMemo(() => {
    const begin = () => { start.current = leftRef.current; };
    const update = (dx: number) => cb.current(start.current + dx);
    return Gesture.Pan().minDistance(0)
      .onBegin(() => { scheduleOnRN(begin); })
      .onUpdate((e) => { scheduleOnRN(update, e.translationX); });
  }, []);
  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.thumb, { left }]} hitSlop={10} accessibilityRole="adjustable" accessibilityLabel={label} />
    </GestureDetector>
  );
}

const styles = StyleSheet.create((theme) => ({
  gestureRoot: { flex: 0 },
  rail: { height: BROWSE_RAIL_HEIGHT, flexGrow: 0, backgroundColor: theme.colors.background },
  railContent: { gap: 8, paddingHorizontal: 12, paddingTop: 8, alignItems: 'flex-start' },
  pill: {
    height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.background,
  },
  sliders: { width: 40, justifyContent: 'center' },
  dropdown: { gap: 4, paddingLeft: 16, paddingRight: 12 },
  toggle: { paddingHorizontal: 16 },
  active: { backgroundColor: theme.colors.elevated, borderColor: 'transparent' },
  pillText: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 8, paddingTop: 16, paddingBottom: 12 },
  back: { width: 40, height: 40, marginLeft: -10, marginRight: 2, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...theme.typography.headingMedium, color: theme.colors.primary },
  clear: { paddingVertical: 8, paddingHorizontal: 12 },
  clearText: { ...theme.typography.regularPlus, color: theme.colors.tertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, paddingLeft: 24, paddingRight: 20 },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { flexShrink: 1, ...theme.typography.regularPlus, color: theme.colors.primary },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  detail: { ...theme.typography.regular, color: theme.colors.tertiary },
  tickSpace: { width: 18, height: 18 },
  range: { paddingHorizontal: 24, paddingTop: 16 },
  track: { height: THUMB, justifyContent: 'center' },
  trackLine: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: theme.colors.elevated },
  trackFill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: theme.colors.primary },
  thumb: {
    position: 'absolute', top: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: theme.colors.sheetBackground,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, boxShadow: theme.shadows.default,
  },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  rangeLabel: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.secondary },
  save: { marginTop: 24, marginHorizontal: 20, alignSelf: 'stretch', width: undefined },
}));
