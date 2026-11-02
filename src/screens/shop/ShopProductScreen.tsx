// A placeholder product's page (the web page's, HANDOFF 6.121). Cosmos opens a product in the element viewer
// (ShopCategoryPage's onProductPress → openElementViewer), where it has its picture and then ShoppingElementFooter:
// a row 16 apart, 16 in and 16 under the picture — the name (headingMedium, two lines) over the brand (large,
// secondary), these two opening ProductDetailsSheet (细节); and ShopButton small 4 lower with the price in it
// (priceInCta) that opens the shop. Placeholder products are not elements (no saving, no similar list, no shop link),
// so this is the viewer's picture and footer alone, with a back button; the price and 选购 only say there is no link.
// ProductDetailsSheet: 20 in, 16 under; the brand row (32 high, 16 under; the wordmark, or the name in headingMedium)
// opens the brand (in this page's place); the name (headingLarge on 28, 4 under); the price (headingMedium,
// secondary) with the original struck through (tertiary), 12 apart and 12 under; the description (regular on 18,
// secondary); then ShopButton regular with 选购, 16 over it, 20 in.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { StackActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ChevronLeftIcon } from '../../components/icons';
import { SheetGrabber } from '../../components/sheets/SheetGrabber';
import { ShopButton } from '../../components/shop/ShopParts';
import { placeholderProduct } from '../../lib/shop';
import { Routes } from '../../navigation/routes';
import { showToast } from '../../stores/useToastStore';

const DETAILS_SHEET = 'shop-product-details';
const noShopLink = () => showToast({ text: '占位商品，没有商店链接' });

export function ShopProductScreen() {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { i, sale } = useRoute<RouteProp<{ p: { i: number; sale: boolean } }, 'p'>>().params;
  const p = placeholderProduct(i, sale);
  const openBrand = () => {
    void TrueSheet.dismiss(DETAILS_SHEET).catch(() => undefined);
    navigation.dispatch(StackActions.replace(Routes.BRAND_PROFILE, { name: p.brand }));
  };
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回">
          <ChevronLeftIcon color={theme.colors.primary} size={24} />
        </Pressable>
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + 64 }]}>
        <View style={styles.media}><View style={styles.shade} /></View>
        <View style={styles.footer}>
          <Pressable style={styles.footerText} onPress={() => void TrueSheet.present(DETAILS_SHEET).catch(() => undefined)} accessibilityRole="button" accessibilityLabel="细节">
            <Text style={styles.footerTitle} numberOfLines={2}>{p.name}</Text>
            <Text style={styles.footerBrand} numberOfLines={1}>{p.brand}</Text>
          </Pressable>
          <ShopButton label={p.price} size="small" onPress={noShopLink} style={styles.footerButton} />
        </View>
      </View>
      <TrueSheet name={DETAILS_SHEET} detents={['auto']} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}>
        <SheetGrabber />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.details}>
            <Pressable style={styles.brandRow} onPress={openBrand} accessibilityRole="button">
              <Text style={styles.brandName}>{p.brand}</Text>
            </Pressable>
            <Text style={styles.detailsTitle}>{p.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{p.price}</Text>
              {p.originalPrice ? <Text style={styles.original}>{p.originalPrice}</Text> : null}
            </View>
            <Text style={styles.description}>商品描述占位文字，介绍材质、尺寸和细节。</Text>
          </View>
          <ShopButton label="选购" size="regular" onPress={noShopLink} style={styles.buy} />
        </View>
      </TrueSheet>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  top: { flexDirection: 'row', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  media: {
    aspectRatio: 0.8, borderRadius: theme.borderRadius.element, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder,
    backgroundColor: '#FFFFFF', overflow: 'hidden',
  },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000005' },
  footer: { flexDirection: 'row', gap: 16, paddingTop: 16 },
  footerText: { flex: 1, minWidth: 0, gap: 2 },
  footerTitle: { ...theme.typography.headingMedium, lineHeight: 24, color: theme.colors.primary },
  footerBrand: { ...theme.typography.large, lineHeight: 20, color: theme.colors.secondary },
  footerButton: { marginTop: 4 },
  sheet: {},
  details: { alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 16 },
  brandRow: { height: 32, marginBottom: 16, justifyContent: 'center' },
  brandName: { ...theme.typography.headingMedium, color: theme.colors.primary },
  detailsTitle: { ...theme.typography.headingLarge, lineHeight: 28, marginBottom: 4, color: theme.colors.primary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  price: { ...theme.typography.headingMedium, color: theme.colors.secondary },
  original: { ...theme.typography.headingMedium, color: theme.colors.tertiary, textDecorationLine: 'line-through' },
  description: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.secondary },
  buy: { marginTop: 16, marginHorizontal: 20 },
}));
