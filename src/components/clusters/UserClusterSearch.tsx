// Cosmos' search inside a collection (components/explore/UserClusterSearchOverlay.js, module 3281, with SearchBar 2179 /
// SearchPill 2257 and SearchOverlay 2642):
//   - the header's search button turns the header into the search field: the elevated round pill holding the
//     collection's badge (SearchPill: 32 high, at most 127 wide, the background, 1 px surfaceBorder, round, xs / sm in, a
//     20 round cover 7 from the name in regular) 7 in from its left, then the field (sm in, focused), and 取消
//     (regularPlus) sliding in on its right (150 ms, ease-in-out)
//   - under the header a SearchOverlay over the collection (the background, zIndex 100; the back button cancels): its
//     elements matching the words (useClusterSearchElements: asked for 400 ms after the last key; the masonry grid,
//     CollectionOwn or CollectionOther, no words: nothing), while the first page comes two columns of skeletons
//     (180 / 140 / 220 / 160 and 150 / 210 / 170 / 200 high, rounded element, spacing.sm apart and around)
//   - 取消 empties it, puts the keyboard away and closes it
// Approximate: the skeletons are still (Cosmos' Skeleton shimmers, not read); the badge's cover is the collection's
// first cover (getClusterCoverUrl not read); no "nothing found" (Cosmos shows none either).
import { useEffect, useState } from 'react';
import { BackHandler, Keyboard, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { usePagedList } from '../../hooks/usePagedList';
import { absoluteUrl } from '../../lib/server';
import type { Element } from '../../lib/elements';
import { ClusterElementGrid } from './ClusterElementGrid';
import type { ClusterDetail } from './UserClusterHeader';

const SEARCH_DEBOUNCE = 400;
const CANCEL_DURATION = 150;
const SKELETON_LEFT = [180, 140, 220, 160];
const SKELETON_RIGHT = [150, 210, 170, 200];

export function useClusterSearch() {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), SEARCH_DEBOUNCE);
    return () => clearTimeout(t);
  }, [query]);
  const cancel = () => { setSearching(false); setQuery(''); setTerm(''); Keyboard.dismiss(); };
  return { searching, query, term, debouncing: query.trim() !== term, open: () => setSearching(true), setQuery, cancel };
}

type Search = ReturnType<typeof useClusterSearch>;

// SearchBar with the collection's badge and 取消
export function ClusterSearchBar({ cluster, search }: { cluster: ClusterDetail; search: Search }) {
  const { theme } = useUnistyles();
  const shown = useSharedValue(0);
  const [cancelWidth, setCancelWidth] = useState(0);
  useEffect(() => { shown.set(withTiming(1, { duration: CANCEL_DURATION, easing: Easing.inOut(Easing.ease) })); }, [shown]);
  const cancelSlot = useAnimatedStyle(() => ({ width: shown.get() * (cancelWidth + theme.spacing.md) }));
  const cancelContent = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: (1 - shown.get()) * cancelWidth }] }));
  const cover = cluster.covers?.[0];
  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            {cover ? <Image source={{ uri: absoluteUrl(cover) }} style={styles.badgeCover} contentFit="cover" /> : <View style={[styles.badgeCover, styles.badgeBlank]} />}
            <Text style={styles.badgeName} numberOfLines={1} ellipsizeMode="tail">{cluster.name}</Text>
          </View>
        </View>
        <TextInput
          style={styles.input}
          value={search.query}
          onChangeText={search.setQuery}
          autoFocus
          placeholder="搜索"
          placeholderTextColor={theme.colors.tertiary}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <Animated.View style={[styles.cancelSlot, cancelSlot]}>
        <Animated.View style={[styles.cancelContent, cancelContent]}>
          <Pressable onPress={search.cancel} hitSlop={8} accessibilityRole="button" onLayout={(e) => setCancelWidth(e.nativeEvent.layout.width)}>
            <Text style={styles.cancel} numberOfLines={1}>取消</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// the SearchOverlay's contents
export function ClusterSearchOverlay({ clusterId, mine, search, top, bottomInset }: {
  clusterId: string; mine: boolean; search: Search; top: number; bottomInset: number;
}) {
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const list = usePagedList<Element>(search.term ? `/api/elements?cluster=${encodeURIComponent(clusterId)}&q=${encodeURIComponent(search.term)}` : null, 40);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { search.cancel(); return true; });
    return () => sub.remove();
  }, [search]);
  const skeletonWidth = (width - 2 * theme.spacing.sm - theme.spacing.sm) / 2;
  const loadingFirst = !!search.query.trim() && (search.debouncing || (list.loading && list.items.length === 0));
  return (
    <View style={[styles.overlay, { top }]}>
      {loadingFirst ? (
        <View style={[styles.skeletonGrid, { padding: theme.spacing.sm, gap: theme.spacing.sm }]}>
          {[SKELETON_LEFT, SKELETON_RIGHT].map((heights, c) => (
            <View key={c} style={[styles.skeletonColumn, { gap: theme.spacing.sm }]}>
              {heights.map((h, i) => <View key={i} style={[styles.skeleton, { width: skeletonWidth, height: h }]} />)}
            </View>
          ))}
        </View>
      ) : search.term ? (
        <ClusterElementGrid list={list} source={mine ? 'CollectionOwn' : 'CollectionOther'} removeFrom={mine ? clusterId : null} topInset={0} bottomInset={bottomInset} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center' },
  pill: { flex: 1, height: '100%', minWidth: 0, flexDirection: 'row', backgroundColor: theme.colors.elevated, borderRadius: theme.borderRadius.full, overflow: 'hidden' },
  badgeContainer: {
    backgroundColor: theme.colors.elevated, paddingLeft: 7, borderTopLeftRadius: theme.borderRadius.full, borderBottomLeftRadius: theme.borderRadius.full,
    alignSelf: 'stretch', justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 7, height: 32, maxWidth: 127, backgroundColor: theme.colors.background,
    paddingLeft: theme.spacing.xs, paddingRight: theme.spacing.sm, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.surfaceBorder, zIndex: 10,
  },
  badgeCover: { width: 20, height: 20, borderRadius: 10 },
  badgeBlank: { backgroundColor: theme.colors.elevated },
  badgeName: { ...theme.typography.regular, color: theme.colors.primary, flexShrink: 1 },
  input: { ...theme.typography.regularPlus, flex: 1, minWidth: 0, paddingVertical: 0, paddingLeft: theme.spacing.sm, color: theme.colors.primary },
  cancelSlot: { overflow: 'visible', alignSelf: 'stretch', justifyContent: 'center', flexShrink: 0 },
  cancelContent: { position: 'absolute', top: 0, right: 0, bottom: 0, justifyContent: 'center' },
  cancel: { ...theme.typography.regularPlus, color: theme.colors.primary },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: theme.colors.background },
  skeletonGrid: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  skeletonColumn: { flex: 1 },
  skeleton: { borderRadius: theme.borderRadius.element, backgroundColor: theme.colors.elevated },
}));
