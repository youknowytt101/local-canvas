// Cosmos' MoveSheet (MoveSheet / MoveSheetList / ClusterRow / MoveSheetCreateRow / MoveSheetFooter, constants from
// lib/getMoveSheetDetents.js): the save sheet, from the viewer's 保存 or a long press on a tile.
//   - rows ROW_HEIGHT 60, ROW_LEADING_INSET 20 in, a THUMBNAIL_SIZE 40 picture, the title (primary) over the subtitle
//     (tertiary) spacing.sm after it, and a 32 round button (sheetElevated) in a 72 wide box at the end
//   - the first row is the user's profile (个人资料 · 展现您的品味 · 公开 / 彰显您的品味 · 私密), then their collections
//     (their own and those they work on; a sub-collection SUBCLUSTER_LEADING_INSET 64 in under its collection),
//     "N 元素" and 私人的 under each
//   - a row it is not in yet saves it there (connectClusterInstant / runProfileConnect), closes the sheet and says so for
//     3.5 s with 查看 (toast.savedToProfile / savedToCluster); a row it is in takes it out and the sheet stays
//   - more than 4 collections: a search field over the list (sheetElevated) and the sheet opens to 510 high
//     (getMoveSheetCollapsedHeight; 492 with exactly 5), else it fits its content (shouldUseCompactMoveSheet)
//   - at the bottom, 创建新集合 · 您组织元素的地方 (MoveSheetFooter)
//   - move mode (organizing a collection's 移动): the collection they are in is left out; a row moves the chosen
//     elements there and out of it (connect + disconnect in one request), closes the sheet and says 已移至X
//     (toast.movedToCluster)
//   - destination mode (presentMoveSheetForDraft, photos picked on the profile): no ticks; a row is where they go and the
//     sheet closes
// Near Cosmos: the new collection's name is typed in the sheet's last row (Cosmos opens its create sheet); the tree's
// connecting lines are not drawn; the saved row's button shows a tick on the inverted colour.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api, get } from '../../lib/api';
import { tileImageUrl, type Element } from '../../lib/elements';
import { absoluteUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { announceElementSaved, MOVE_SHEET, useMoveSheetStore } from '../../stores/useMoveSheetStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { showToast } from '../../stores/useToastStore';
import { CheckIcon, PlusIcon, UserRound } from '../icons';

const ROW_HEIGHT = 60;
const THUMBNAIL_SIZE = 40;
const ROW_LEADING_INSET = 20;
const ADD_BUTTON_BOX_WIDTH = 72;
const SUBCLUSTER_LEADING_INSET = 64;
const COMPACT_MAX = 4;
const MAX_CLUSTER_NAME_LENGTH = 24;

type Cluster = { id: string; name: string; count: number; covers?: string[]; isPrivate?: boolean; parentId?: string | null; role?: string };
type Profile = { id: string; numberOfElements: number; isPrivate: boolean };

export function MoveSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const element = useMoveSheetStore((s) => s.element);
  const move = useMoveSheetStore((s) => s.move);
  const destination = useMoveSheetStore((s) => s.destination);
  const me = useSessionStore((s) => s.me);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inClusters, setInClusters] = useState<Set<string>>(new Set());
  const [onProfile, setOnProfile] = useState(false);
  const [query, setQuery] = useState('');
  const [naming, setNaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (el: Element) => {
    setInClusters(new Set(((el as { clusters?: { id: string }[] }).clusters ?? []).map((c) => c.id)));
    setOnProfile(!!el.isUserPublicElement);
    const [list, prof, fresh] = await Promise.all([
      get<Cluster[] | { items: Cluster[] }>('/api/clusters'),
      get<Profile>('/api/profile/cluster'),
      get<Element & { clusters?: { id: string }[] }>(`/api/elements/${encodeURIComponent(el.id)}`),
    ]).catch(() => [null, null, null] as const);
    if (list) setClusters(Array.isArray(list) ? list : list.items);
    if (prof) setProfile(prof);
    if (fresh) {
      setInClusters(new Set((fresh.clusters ?? []).map((c) => c.id)));
      setOnProfile(!!fresh.isUserPublicElement);
    }
  };
  const loadLists = async () => {
    const [list, prof] = await Promise.all([get<Cluster[] | { items: Cluster[] }>('/api/clusters'), get<Profile>('/api/profile/cluster')]).catch(() => [null, null] as const);
    if (list) setClusters(Array.isArray(list) ? list : list.items);
    if (prof) setProfile(prof);
  };
  useEffect(() => {
    setQuery('');
    setNaming(null);
    if (element) void load(element);
    else if (destination) { setInClusters(new Set()); setOnProfile(false); void loadLists(); }
  }, [element?.id, destination]); // eslint-disable-line react-hooks/exhaustive-deps

  // ClusterSubtree: each collection, then its sub-collections under it
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tops = clusters.filter((c) => !c.parentId || !clusters.some((p) => p.id === c.parentId));
    const ordered = tops.flatMap((t) => [t, ...clusters.filter((c) => c.parentId === t.id)]);
    const shown = move ? ordered.filter((c) => c.id !== move.fromClusterId) : ordered;
    return q ? shown.filter((c) => c.name.toLowerCase().includes(q)) : shown;
  }, [clusters, query, move]);
  const compact = clusters.length <= COMPACT_MAX;
  const detents = compact ? (['auto'] as const) : ([Math.min(1, (clusters.length === 5 ? 492 : 510) / windowHeight), 1] as const);

  // c: a collection, or null for the profile
  const toggle = async (c: Cluster | null) => {
    if (destination) {
      await TrueSheet.dismiss(MOVE_SHEET).catch(() => undefined);
      destination.onChoose(c ? { id: c.id, name: c.name } : null);
      return;
    }
    if (!element || busy) return;
    if (move) {
      const to = c ? c.id : profile?.id;
      if (!to) return;
      setBusy(true);
      try {
        await api('POST', '/api/elements/connections', { elementIds: move.elementIds, connect: [to], disconnect: [move.fromClusterId], userInteractionSource: 'EditClustersConnections' });
        await TrueSheet.dismiss(MOVE_SHEET).catch(() => undefined);
        showToast({ text: `已移至${c ? c.name : '个人资料'}` });
        move.onMoved();
      } catch (e) {
        showToast({ text: e instanceof Error && e.message ? e.message : '无法移动' });
      } finally {
        setBusy(false);
      }
      return;
    }
    const had = c ? inClusters.has(c.id) : onProfile;
    const target = c ? c.id : profile?.id;
    if (!target) return;
    setBusy(true);
    try {
      await api('POST', '/api/elements/connections', { elementIds: [element.id], [had ? 'disconnect' : 'connect']: [target], userInteractionSource: 'EditClustersConnections' });
      const nextClusters = new Set(inClusters);
      if (c) { if (had) nextClusters.delete(c.id); else nextClusters.add(c.id); }
      const nextProfile = c ? onProfile : !had;
      setInClusters(nextClusters);
      setOnProfile(nextProfile);
      if (c) setClusters((list) => list.map((x) => (x.id === c.id ? { ...x, count: Math.max(0, x.count + (had ? -1 : 1)) } : x)));
      // saved by the user while it is on their profile or in any of their collections
      announceElementSaved(element.id, { isConnectedByUser: nextProfile || nextClusters.size > 0, isUserPublicElement: nextProfile });
      if (!had) {
        await TrueSheet.dismiss(MOVE_SHEET).catch(() => undefined);
        showToast({
          text: c ? `已保存到${c.name}` : '已保存至个人资料',
          actionText: '查看',
          imageUrl: tileImageUrl(element, 24, 2),
          imageBlurred: element.nsfw?.treatment === 'blur',
          duration: 3500,
          // navigateToSavedDestination: the profile's tab (its 元素 tab comes with the profile page), or the collection
          onAction: () => navigation.dispatch({ type: 'NAVIGATE', payload: { name: Routes.MAIN, params: { screen: Routes.MAIN_TABS, params: { screen: Routes.PROFILE } } } }),
        });
      }
    } catch (e) {
      showToast({ text: (e as { status?: number }).status === 403 && e instanceof Error ? e.message : '无法保存' });
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = naming?.trim();
    if (!name) return;
    try {
      const c = await api<Cluster>('POST', '/api/clusters', { name });
      setClusters((list) => [...list, { ...c, count: c.count ?? 0 }]);
      setNaming(null);
      await toggle({ ...c, count: c.count ?? 0 });
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : '无法创建' });
    }
  };

  const profileSubtitle = profile?.isPrivate ? '彰显您的品味 · 私密' : '展现您的品味 · 公开';
  return (
    <TrueSheet
      name={MOVE_SHEET}
      detents={detents as never}
      cornerRadius={24}
      grabber
      backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useMoveSheetStore.setState({ element: null, move: null, destination: null })}
      footer={
        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          {naming == null ? (
            <Row
              title="创建新集合" subtitle="您组织元素的地方" onPress={() => setNaming('')}
              thumbnail={<View style={[styles.thumbnail, styles.thumbRound]}><PlusIcon color={theme.colors.primary} size={20} /></View>}
              button={<View style={styles.addButton}><PlusIcon color={theme.colors.primary} size={18} /></View>}
            />
          ) : (
            <View style={styles.row}>
              <TextInput
                autoFocus value={naming} onChangeText={setNaming} maxLength={MAX_CLUSTER_NAME_LENGTH} placeholder="新收藏夹的名称"
                placeholderTextColor={theme.colors.tertiary} style={styles.nameInput} returnKeyType="done" onSubmitEditing={create}
              />
              <Pressable style={styles.addButtonBox} onPress={create} accessibilityRole="button" accessibilityLabel="创建">
                <View style={[styles.addButton, styles.addButtonOn]}><CheckIcon color={theme.colors.inverted} size={18} /></View>
              </Pressable>
            </View>
          )}
        </View>
      }
    >
      <View>
        {!compact ? (
          <View style={styles.searchContainer}>
            <TextInput value={query} onChangeText={setQuery} placeholder="搜索" placeholderTextColor={theme.colors.tertiary} style={styles.searchField} />
          </View>
        ) : null}
        <ScrollView nestedScrollEnabled contentContainerStyle={{ paddingTop: compact ? theme.spacing.md : 0, paddingBottom: ROW_HEIGHT + insets.bottom + 16 }}>
          {!query ? (
            <Row
              title="个人资料" subtitle={profileSubtitle} on={!move && !destination && onProfile} onPress={() => void toggle(null)}
              thumbnail={me?.avatarUrl ? <Image source={{ uri: absoluteUrl(me.avatarUrl) }} style={[styles.thumbnail, styles.thumbRound]} />
                : <View style={[styles.thumbnail, styles.thumbRound]}><UserRound color={theme.colors.tertiary} size={20} /></View>}
            />
          ) : null}
          {rows.map((c) => (
            <Row
              key={c.id} title={c.name} subtitle={`${c.count} 元素${c.isPrivate ? ' · 私人的' : ''}`} on={!move && !destination && inClusters.has(c.id)}
              indent={c.parentId ? SUBCLUSTER_LEADING_INSET : ROW_LEADING_INSET} onPress={() => void toggle(c)}
              thumbnail={c.covers?.[0] ? <Image source={{ uri: absoluteUrl(c.covers[0]) }} style={styles.thumbnail} /> : <View style={styles.thumbnail} />}
            />
          ))}
          {query && !rows.length ? <Text style={styles.empty}>没有找到合集</Text> : null}
        </ScrollView>
      </View>
    </TrueSheet>
  );
}

type RowProps = { title: string; subtitle: string; on?: boolean; indent?: number; thumbnail: React.ReactNode; button?: React.ReactNode; onPress: () => void };

function Row({ title, subtitle, on = false, indent = ROW_LEADING_INSET, thumbnail, button, onPress }: RowProps) {
  const { theme } = useUnistyles();
  return (
    <Pressable style={[styles.row, { paddingLeft: indent }]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {thumbnail}
      <View style={styles.textStack}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.addButtonBox}>
        {button ?? (
          <View style={[styles.addButton, on && styles.addButtonOn]}>
            {on ? <CheckIcon color={theme.colors.inverted} size={18} /> : <PlusIcon color={theme.colors.primary} size={18} />}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, paddingLeft: ROW_LEADING_INSET },
  thumbnail: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, borderRadius: theme.borderRadius.xs, backgroundColor: theme.colors.sheetElevated, overflow: 'hidden' },
  thumbRound: { borderRadius: theme.borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  textStack: { flex: 1, minWidth: 0, marginLeft: theme.spacing.sm },
  title: { ...theme.typography.regularPlus, color: theme.colors.primary },
  subtitle: { ...theme.typography.caption, color: theme.colors.tertiary, marginTop: 2 },
  addButtonBox: { width: ADD_BUTTON_BOX_WIDTH, alignItems: 'center', justifyContent: 'center' },
  addButton: { width: 32, height: 32, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.sheetElevated, alignItems: 'center', justifyContent: 'center' },
  addButtonOn: { backgroundColor: theme.colors.surfaceInverted },
  searchContainer: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.sm },
  searchField: { ...theme.typography.large, height: 44, borderRadius: theme.borderRadius.full, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.sheetElevated, color: theme.colors.primary },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.sheetBackground },
  nameInput: { ...theme.typography.large, flex: 1, height: 44, borderRadius: theme.borderRadius.full, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.sheetElevated, color: theme.colors.primary },
  empty: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center', paddingTop: theme.spacing.xxxl },
}));
