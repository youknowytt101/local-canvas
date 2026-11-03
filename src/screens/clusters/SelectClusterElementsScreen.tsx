// Cosmos' SelectClusterElementsScreen (routes.SelectClusterElements, over the tabs) with useSelectClusterElements: elements
// found by the collection's name (searchGlobalElements, public ones too, 40 a page), two to a row, any number chosen; over
// them the words "{name}的想法" (largePlus), or once some are chosen GroupedImagesHeader (up to three of them overlapping
// and a +N, 70 high); under them, over a fade, the button: 完成 when it was opened from the collection, else 创建收藏 with
// some chosen and 跳过并创建集合 without. Chosen ones are connected to the collection; from a new collection it then opens in
// the profile's tab, from the collection it goes back.
// SelectableImageCard: a 2 primary outline and a white-on-primary tick (16) at the top right when chosen, a picture only.
// Near Cosmos: 想法 reads "{name}的想法" (the pack's is "的想法 {name}", a machine's order); grey blocks, not its Skeleton
// masonry, while it loads.
import { CommonActions, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { DEFAULT_GRID_GAP } from '../../components/home/ForYouFeed';
import { CheckIcon } from '../../components/icons';
import { usePagedList } from '../../hooks/usePagedList';
import { api } from '../../lib/api';
import { buildUserClusterRouteParams } from '../../lib/clusters/buildSubClusterRouteParams';
import { FEED_IMAGE_SCALE, tileImageUrl, tileRatio, type Element } from '../../lib/elements';
import { Routes } from '../../navigation/routes';
import { showToast } from '../../stores/useToastStore';

const NUM_COLUMNS = 2;
const PAGE_SIZE = 40;
const SHOWN_IN_HEADER = 3;

export type SelectClusterElementsParams = { clusterId: string; searchTerm: string; completionLabel?: 'done' };

export function SelectClusterElementsScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { clusterId, searchTerm, completionLabel } = useRoute<RouteProp<{ c: SelectClusterElementsParams }, 'c'>>().params;
  const list = usePagedList<Element>(searchTerm ? `/api/elements?q=${encodeURIComponent(searchTerm)}&origin=search_box` : null, PAGE_SIZE);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [footer, setFooter] = useState(0);
  const tileWidth = (width - DEFAULT_GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
  const chosenUrls = useMemo(
    () => list.items.filter((e) => chosen.has(e.id)).map((e) => tileImageUrl(e, 40, 2)).filter((u): u is string => !!u),
    [chosen, list.items],
  );

  const toggle = (id: string) => setChosen((had) => {
    const next = new Set(had);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const finish = () => {
    if (completionLabel === 'done') { navigation.goBack(); return; }
    navigation.dispatch(CommonActions.navigate({ name: Routes.MAIN_TABS, params: { pop: true, screen: Routes.PROFILE, params: buildUserClusterRouteParams({ clusterId }) } }));
  };

  const submit = async () => {
    if (saving) return;
    if (!chosen.size) { finish(); return; }
    setSaving(true);
    try {
      await api('POST', '/api/elements/connections', { elementIds: [...chosen], connect: [clusterId], userInteractionSource: 'EditClustersConnections' });
      finish();
    } catch (e) {
      showToast({ text: e instanceof Error && e.message ? e.message : '无法保存' });
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Element }) => {
    const uri = tileImageUrl(item, tileWidth, FEED_IMAGE_SCALE);
    const on = chosen.has(item.id);
    return (
      <View style={styles.cell}>
        <Pressable
          style={[styles.card, { height: tileWidth / tileRatio(item.width, item.height) }]}
          onPress={() => toggle(item.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: on }}
        >
          {uri ? <Image source={{ uri }} style={styles.image} contentFit="cover" recyclingKey={item.id} blurRadius={item.nsfw?.treatment === 'blur' ? 30 : undefined} /> : null}
          {on ? <View style={styles.selectionBorder} pointerEvents="none" /> : null}
          {on ? <View style={styles.selectionIcon} pointerEvents="none"><CheckIcon color={theme.colors.inverted} size={16} /></View> : null}
        </Pressable>
      </View>
    );
  };

  const label = completionLabel === 'done' ? '完成' : chosen.size ? '创建收藏' : '跳过并创建集合';
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerContainer}>
        {chosen.size ? <GroupedImagesHeader urls={chosenUrls} /> : <Text style={styles.title} numberOfLines={1}>{searchTerm}的想法</Text>}
      </View>
      {list.loading && !list.items.length ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.tertiary} /></View>
      ) : (
        <FlashList
          data={list.items}
          masonry
          numColumns={NUM_COLUMNS}
          extraData={chosen}
          keyExtractor={(e: Element) => e.id}
          renderItem={renderItem}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          contentContainerStyle={{ paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: footer }}
        />
      )}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + theme.spacing.md }]} onLayout={(e) => setFooter(e.nativeEvent.layout.height)}>
        <LinearGradient colors={['transparent', theme.colors.background]} style={StyleSheet.absoluteFill} locations={[0, 0.5]} />
        <Button text={label} fullWidth loading={saving} disabled={saving} onPress={() => void submit()} />
      </View>
    </View>
  );
}

// Cosmos' GroupedImagesHeader: the first few of those chosen, overlapping, and how many more
function GroupedImagesHeader({ urls }: { urls: string[] }) {
  const shown = urls.slice(0, SHOWN_IN_HEADER);
  const more = Math.max(urls.length - shown.length, 0);
  return (
    <View style={styles.group}>
      <View style={styles.groupImages}>
        {shown.map((uri, i) => <Image key={uri} source={{ uri }} style={[styles.groupImage, i > 0 && styles.groupImageOver]} contentFit="cover" />)}
      </View>
      {more > 0 ? <View style={styles.more}><Text style={styles.moreText}>+{more}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerContainer: { height: 70, justifyContent: 'center', alignItems: 'center', zIndex: 100, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md },
  title: { ...theme.typography.largePlus, color: theme.colors.primary, backgroundColor: theme.colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cell: { paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  card: { width: '100%', overflow: 'hidden', borderRadius: theme.borderRadius.element, backgroundColor: theme.colors.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder },
  image: { width: '100%', height: '100%' },
  selectionBorder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.element },
  selectionIcon: {
    position: 'absolute', top: theme.spacing.xs, right: theme.spacing.xs, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary,
  },
  buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xl },
  group: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  groupImages: { flexDirection: 'row', alignItems: 'center' },
  groupImage: { width: 40, height: 40, borderRadius: theme.borderRadius.xs, borderWidth: 2, borderColor: theme.colors.background, backgroundColor: theme.colors.elevated },
  groupImageOver: { marginLeft: -16 },
  more: { paddingHorizontal: theme.spacing.xs, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder },
  moreText: { ...theme.typography.captionPlus, color: theme.colors.primary },
}));
