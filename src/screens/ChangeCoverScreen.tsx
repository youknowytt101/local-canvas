// Cosmos' ChangeCoverScreen (routes.ChangeCover, over the tabs): 返回 (a word), 更换封面 and 上传 (hitSlop 15, at least 48 wide,
// faded while it asks) over the collection's elements three to a row, 12 apart; an element's picture, or one picked from the
// phone (permission asked, no editing, full quality), goes to the crop page with the cover's mode; the crop page saves it.
// Near Cosmos: a tile shows its picture alone; an element with no picture (a link, a note) is left out, as Cosmos' tap does nothing there.
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { usePagedList } from '../hooks/usePagedList';
import { originalImageUrl, tileImageUrl, tileRatio, type Element } from '../lib/elements';
import { Routes } from '../navigation/routes';
import { showToast } from '../stores/useToastStore';

const NUM_COLUMNS = 3;
const GAP = 12;
const PAGE_SIZE = 40;
const CROP_COVER_TITLE = '裁剪封面';

export type ChangeCoverParams = { clusterId: string };

export function ChangeCoverScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { clusterId } = useRoute<RouteProp<{ c: ChangeCoverParams }, 'c'>>().params;
  const list = usePagedList<Element>(`/api/elements?cluster=${encodeURIComponent(clusterId)}`, PAGE_SIZE);
  const [picking, setPicking] = useState(false);
  const tiles = useMemo(() => list.items.filter((e) => !!originalImageUrl(e)), [list.items]);
  const tileWidth = (width - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

  const crop = (imageUri: string) => navigation.navigate(Routes.CROP_PROFILE_PICTURE, { mode: 'cluster-cover', imageUri, title: CROP_COVER_TITLE, clusterId });

  const upload = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要许可', '需要访问相机胶卷的权限！'); // errors.permissionRequired, errors.cameraRollPermission
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      const uri = r.canceled ? null : r.assets[0]?.uri;
      if (uri) crop(uri);
    } catch {
      showToast({ text: '无法选择图像。 请再试一次。' }); // errors.pickImageFailed
    } finally {
      setPicking(false);
    }
  };

  const renderItem = ({ item }: { item: Element }) => {
    const uri = tileImageUrl(item, tileWidth, 2);
    return (
      <View style={styles.cell}>
        <Pressable
          style={[styles.tile, { width: tileWidth, height: tileWidth / tileRatio(item.width, item.height) }]}
          onPress={() => { const full = originalImageUrl(item); if (full) crop(full); }}
          accessibilityRole="button"
        >
          {uri ? <Image source={{ uri }} style={styles.image} contentFit="cover" blurRadius={item.nsfw?.treatment === 'blur' ? 30 : undefined} /> : null}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.side} onPress={() => navigation.goBack()} accessibilityRole="button">返回</Text>
        <Text style={styles.title} numberOfLines={1}>更换封面</Text>
        <Pressable style={[styles.headerButton, picking && styles.headerButtonOff]} hitSlop={15} disabled={picking} onPress={() => void upload()} accessibilityRole="button">
          <Text style={styles.upload}>上传</Text>
        </Pressable>
      </View>
      {list.loading && !tiles.length ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.tertiary} /></View>
      ) : (
        <FlashList
          data={tiles}
          masonry
          numColumns={NUM_COLUMNS}
          keyExtractor={(e: Element) => e.id}
          renderItem={renderItem}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={list.refreshing}
          onRefresh={() => void list.refresh()}
          contentContainerStyle={{ paddingHorizontal: GAP / 2, paddingBottom: insets.bottom + GAP }}
          ListFooterComponent={list.loading ? <View style={styles.footer}><ActivityIndicator size="small" color={theme.colors.tertiary} /></View> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl },
  side: { ...theme.typography.regularPlus, color: theme.colors.tertiary, minWidth: 48 },
  title: { ...theme.typography.regularPlus, color: theme.colors.primary },
  headerButton: { minWidth: 48, alignItems: 'flex-end' },
  headerButtonOff: { opacity: 0.5 },
  upload: { ...theme.typography.regularPlus, color: theme.colors.primary },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { paddingVertical: theme.spacing.lg, alignItems: 'center' },
  cell: { paddingHorizontal: GAP / 2, paddingBottom: GAP },
  tile: { borderRadius: theme.borderRadius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.elevated },
  image: { width: '100%', height: '100%' },
}));
