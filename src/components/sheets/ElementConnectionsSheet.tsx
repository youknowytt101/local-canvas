// Cosmos' ElementConnectionsSheet (module 2108's neighbour, components/elements/ElementConnectionsSheet.js): who has an
// element, opened from the viewer's avatars. Two tabs (the profile's tab bar: shared width, the line under the chosen
// one moving), "N 个收藏夹" (common.clusterCount: the collections it is in, ClusterListItem) and "N 个用户"
// (common.profileCount: the people, ConnectionListItem), the collections first. A row: the 40 (size.lg) picture —
// a collection's cover on elevated with a borderRadius.sm corner, a person's round avatar — then the name and under it
// the meta (regular, tertiary), spacing.sm between rows. A collection opens it; one's own row opens the profile.
// From /api/elements/:id/connections (all of them at once: no paging).
// Near Cosmos: the tabs switch without the swipe (SwipeableTabViewComponent); no 关注 button on the rows (the people
// list does not say whom one follows) and no pull to refresh; a row opens that person's profile (one's own: the Profile
// tab).
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { get } from '../../lib/api';
import { absoluteUrl } from '../../lib/server';
import type { Collection } from '../clusters/CollectionCard';
import { Avatar } from '../profile/ProfileInfo';
import { ProfileTabBar } from '../profile/ProfileTabBar';

export const ELEMENT_CONNECTIONS_SHEET = 'element-connections';

type Person = { id: string; username: string; fullName?: string; avatarUrl?: string | null; isSelf?: boolean };
export type ElementConnections = { profiles: { totalCount: number; items: Person[] }; clusters: { totalCount: number; items: Collection[] } };
type Handlers = { onOpenCluster: (id: string) => void; onOpenProfile: (userId?: string) => void };

type State = { elementId: string | null; known: ElementConnections | null; handlers: Handlers | null; open: (elementId: string, known: ElementConnections | null, handlers: Handlers) => void };
export const useElementConnectionsStore = create<State>((set) => ({
  elementId: null,
  known: null,
  handlers: null,
  open: (elementId, known, handlers) => {
    set({ elementId, known, handlers });
    void TrueSheet.present(ELEMENT_CONNECTIONS_SHEET).catch(() => undefined);
  },
}));

const close = () => TrueSheet.dismiss(ELEMENT_CONNECTIONS_SHEET).catch(() => undefined);

export function ElementConnectionsSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const elementId = useElementConnectionsStore((s) => s.elementId);
  const known = useElementConnectionsStore((s) => s.known);
  const handlers = useElementConnectionsStore((s) => s.handlers);
  const [data, setData] = useState<ElementConnections | null>(known);
  const [tab, setTab] = useState(0);
  const pagerX = useSharedValue(0);
  useEffect(() => {
    setData(known);
    setTab(0);
    pagerX.set(0);
    if (!elementId) return;
    let live = true;
    // read again: it may have been saved somewhere since the row was drawn
    get<ElementConnections>(`/api/elements/${encodeURIComponent(elementId)}/connections`).then((c) => { if (live) setData(c); }, () => undefined);
    return () => { live = false; };
  }, [elementId, known, pagerX]);

  const choose = (i: number) => { setTab(i); pagerX.set(withTiming(i, { duration: 200 })); };
  const rows = !data ? null : tab === 0
    ? data.clusters.items.map((c) => (
      <Row
        key={c.id}
        image={c.covers?.[0] ? <Image source={{ uri: absoluteUrl(c.covers[0]) }} style={styles.cover} contentFit="cover" /> : <View style={styles.cover} />}
        title={`${c.isPrivate ? '🔒 ' : ''}${c.name}`}
        meta={`${c.count} 元素${c.role === 'Collaborator' ? ` · ${c.owner} 的` : ''}`}
        onPress={() => { void close(); handlers?.onOpenCluster(c.id); }}
      />
    ))
    : data.profiles.items.map((p) => (
      <Row
        key={p.id}
        image={<Avatar user={p} size={40} />}
        title={p.fullName || p.username}
        meta={`@${p.username}`}
        onPress={() => { void close(); handlers?.onOpenProfile(p.isSelf ? undefined : p.id); }}
      />
    ));
  return (
    <TrueSheet
      name={ELEMENT_CONNECTIONS_SHEET}
      detents={[0.6, 1] as never}
      cornerRadius={24}
      grabber
      backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useElementConnectionsStore.setState({ elementId: null, known: null, handlers: null })}
    >
      <View style={styles.tabs}>
        <ProfileTabBar
          pagerX={pagerX}
          onPress={choose}
          tabs={[{ label: `${data?.clusters.totalCount ?? 0} 个收藏夹` }, { label: `${data?.profiles.totalCount ?? 0} 个用户` }]}
        />
      </View>
      <ScrollView nestedScrollEnabled contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        {rows == null ? <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} />
          : rows.length ? rows : <Text style={styles.empty}>{tab === 0 ? '还没有放进收藏夹' : '还没有人收藏'}</Text>}
      </ScrollView>
    </TrueSheet>
  );
}

function Row({ image, title, meta, onPress }: { image: React.ReactNode; title: string; meta: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      {image}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  tabs: { paddingTop: theme.spacing.md },
  list: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  cover: { width: theme.size.lg, height: theme.size.lg, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.elevated, overflow: 'hidden' },
  text: { flex: 1, minWidth: 0 },
  title: { ...theme.typography.largePlus, color: theme.colors.primary },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary },
  loading: { marginTop: theme.spacing.xl },
  empty: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center', marginTop: theme.spacing.xl },
}));
