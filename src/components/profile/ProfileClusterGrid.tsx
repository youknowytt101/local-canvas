// Cosmos' ProfileClusterGrid (module 3296): the profile's collections (the top-level ones, pinned first) as cards in two
// columns DEFAULT_GRID_GAP (12) apart and round the grid, under the profile's header. On one's own profile with at least
// one collection, once all have come, a last card makes a new one (getProfileClusterGridData's create-collection item,
// ProfileCreateCollectionCard: PlusIcon tertiary in the cover, 新系列 · 您组织元素的地方).
// None yet: ProfileCollectionEmptyState's words (创建您的第一个收藏 / 你整理元素的地方 / 创建收藏), its layout near.
// Like the element grid it stays tall enough for the header to fold away.
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../Button';
import { CollectionCard, type Collection } from '../clusters/CollectionCard';
import { DEFAULT_GRID_GAP } from '../home/ForYouFeed';
import { PlusIcon } from '../icons';
import type { ProfileListProps } from './profileLists';

const NUM_COLUMNS = 2;
const CREATE = { id: 'profile-create-collection', kind: 'create-collection' } as const;
export type ProfileClusterGridItem = Collection | typeof CREATE;
type Item = ProfileClusterGridItem;

type Props = ProfileListProps & {
  collections: Collection[] | null; // null: not come yet
  listRef: React.RefObject<FlatList<Item> | null>;
  onOpen: (c: Collection) => void;
  onLongPress?: (c: Collection) => void;
  onCreate: () => void;
};

export function ProfileClusterGrid({ collections, listRef, onOpen, onLongPress, onCreate, headerHeight, headerScrollMax, viewport, bottomInset, onScroll, refreshing, onRefresh }: Props) {
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const cardWidth = (width - (NUM_COLUMNS + 1) * DEFAULT_GRID_GAP) / NUM_COLUMNS;
  const data: Item[] = collections?.length ? [...collections, CREATE] : [];
  return (
    <FlatList
      ref={listRef}
      data={data}
      numColumns={NUM_COLUMNS}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => 'kind' in item ? (
        <CreateCollectionCard width={cardWidth} onPress={onCreate} />
      ) : (
        <CollectionCard collection={item} width={cardWidth} onPress={() => onOpen(item)} onLongPress={onLongPress && (() => onLongPress(item))} />
      )}
      columnWrapperStyle={styles.row}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={styles.list}
      contentContainerStyle={{ paddingTop: headerHeight + DEFAULT_GRID_GAP, paddingHorizontal: DEFAULT_GRID_GAP, paddingBottom: bottomInset, minHeight: viewport + headerScrollMax }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerHeight} tintColor={theme.colors.tertiary} />}
      ListEmptyComponent={
        collections == null ? <View style={styles.loading}><ActivityIndicator color={theme.colors.tertiary} /></View> : (
          <View style={styles.emptyState}>
            <Text style={styles.name}>创建您的第一个收藏</Text>
            <Text style={styles.meta}>你整理元素的地方</Text>
            <Button text="创建收藏" size="small" onPress={onCreate} style={styles.emptyAction} />
          </View>
        )
      }
    />
  );
}

function CreateCollectionCard({ width, onPress }: { width: number; onPress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable onPress={onPress} style={{ width }} accessibilityRole="button" accessibilityLabel="新系列">
      <View style={[styles.cover, { width, height: width }]}><PlusIcon color={theme.colors.tertiary} size={24} /></View>
      <Text style={styles.name} numberOfLines={1}>新系列</Text>
      <Text style={styles.meta} numberOfLines={1}>您组织元素的地方</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, backgroundColor: theme.colors.background },
  row: { gap: DEFAULT_GRID_GAP, marginBottom: theme.spacing.lg },
  loading: { paddingTop: theme.spacing.xxxxl, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: theme.spacing.xxxxl },
  emptyAction: { marginTop: theme.spacing.md },
  cover: { borderRadius: theme.borderRadius.xl, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xs },
  name: { ...theme.typography.largePlus, color: theme.colors.primary },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary, marginTop: 2 },
}));
