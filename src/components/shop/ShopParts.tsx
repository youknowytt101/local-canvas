// The shop's small parts, laid out as Cosmos lays them out (values read for the web page, HANDOFF 6.61 / 6.121):
//   - PressScale: PressScaleContainer — 0.975 in 70 ms on press, back with a 220 ms spring (damping ratio 0.8)
//   - ProductCard: ShopProductCard — the picture at 0.8 (width / height) on white (white in the dark theme too) with a
//     2 % shade (colorPalette.black2), a hairline and borderRadius.element; ProductTileFooter under it (72 high, 50
//     compact; paddingTop 9, 2 apart): the name (regularPlus, primary), the brand (regular, secondary), the price
//     (secondary) with the original struck through (tertiary) 5 apart; compact: the name, then "brand · price".
//     A card with a name has the footer and no price badge (resolveProductTileChrome)
//   - ShopButton: primaryBlue, white words and ArrowUpRight 3 apart; small 36 high (18 round, at least 84 wide, 14 left
//     10 right, regularPlus, arrow 18), regular 48 (24 round, the width, buttonMedium, arrow 24)
import { useNavigation } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { placeholderProduct } from '../../lib/shop';
import { colorPalette } from '../../theme/tokens';
import { Routes } from '../../navigation/routes';
import { ArrowUpRight } from '../icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressScale({ onPress, onPressIn, style, children, label }: {
  onPress?: () => void; onPressIn?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; label?: string;
}) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.set(withTiming(0.975, { duration: 70 })); onPressIn?.(); }}
      onPressOut={() => { scale.set(withSpring(1, { duration: 220, dampingRatio: 0.8 })); }}
      style={[style, pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </AnimatedPressable>
  );
}

// opening the shop's pages: a brand's page, a product's
export function useShopNavigation() {
  const navigation = useNavigation();
  return {
    openBrand: (name: string) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.BRAND_PROFILE, params: { name } } }),
    openProduct: (i: number, sale: boolean) => navigation.dispatch({ type: 'PUSH', payload: { name: Routes.SHOP_PRODUCT, params: { i, sale } } }),
  };
}

type CardProps = { i: number; sale?: boolean; compact?: boolean; width?: number; mediaRatio?: number; mediaFlex?: boolean; style?: StyleProp<ViewStyle> };

export function ProductCard({ i, sale = false, compact = false, width, mediaRatio = 0.8, mediaFlex = false, style }: CardProps) {
  const { openProduct } = useShopNavigation();
  const p = placeholderProduct(i, sale);
  const price = (
    <>
      <Text style={styles.price}>{p.price}</Text>
      {p.originalPrice ? <Text style={styles.original}>{p.originalPrice}</Text> : null}
    </>
  );
  return (
    <PressScale onPress={() => openProduct(i, sale)} style={[width != null && { width }, style]} label={p.name}>
      <View style={[styles.media, mediaFlex ? styles.mediaFlex : { aspectRatio: mediaRatio }]}>
        <View style={styles.shade} />
      </View>
      <View style={compact ? styles.footerCompact : styles.footer}>
        <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
        {compact ? (
          <View style={styles.priceRow}>
            <Text style={[styles.brand, styles.shrink]} numberOfLines={1}>{p.brand}</Text>
            <Text style={styles.price}>·</Text>
            {price}
          </View>
        ) : (
          <>
            <Text style={styles.brand} numberOfLines={1}>{p.brand}</Text>
            <View style={styles.priceRow}>{price}</View>
          </>
        )}
      </View>
    </PressScale>
  );
}

export function ShopButton({ label, size, onPress, style }: { label: string; size: 'small' | 'regular'; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const { theme } = useUnistyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [size === 'small' ? styles.btnSmall : styles.btnRegular, pressed && styles.btnPressed, style]} accessibilityRole="button">
      <Text style={size === 'small' ? styles.btnSmallText : styles.btnRegularText} numberOfLines={1}>{label}</Text>
      <ArrowUpRight color={colorPalette.white} size={size === 'small' ? 18 : 24} />
    </Pressable>
  );
}

export const PRODUCT_FOOTER_HEIGHT = 72;

const styles = StyleSheet.create((theme) => ({
  media: {
    borderRadius: theme.borderRadius.element, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder,
    backgroundColor: colorPalette.white, overflow: 'hidden',
  },
  mediaFlex: { flex: 1 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000005' },
  footer: { height: PRODUCT_FOOTER_HEIGHT, paddingTop: 9, gap: 2, overflow: 'hidden' },
  footerCompact: { height: 50, paddingTop: 9, overflow: 'hidden' },
  name: { ...theme.typography.regularPlus, color: theme.colors.primary },
  brand: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.secondary },
  shrink: { flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  price: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.secondary },
  original: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.tertiary, textDecorationLine: 'line-through' },
  btnSmall: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 36, minWidth: 84, borderRadius: 18,
    paddingLeft: 14, paddingRight: 10, backgroundColor: theme.colors.primaryBlue,
  },
  btnRegular: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 48, borderRadius: 24,
    backgroundColor: theme.colors.primaryBlue,
  },
  btnPressed: { opacity: 0.85 },
  btnSmallText: { ...theme.typography.regularPlus, color: colorPalette.white },
  btnRegularText: { ...theme.typography.buttonMedium, color: colorPalette.white },
}));
