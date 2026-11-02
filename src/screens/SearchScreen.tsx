// Cosmos' SearchScreen (SearchRoot, module 3498): while it is focused the bar is the search field (activeState
// 'global-search', GlobalSearchTabBarContent) and the screen shows, by what is in the field (useSearchStore):
//   - nothing submitted and nothing typed: SearchLanding at the bottom, riding up with the keyboard
//     (getSearchLandingKeyboardShift), and the recent searches' button on the top left (IconButton secondary, regular
//     40, ClockIcon 24, shadows.default; safe area + spacing.sm down, spacing.md in), opening SearchHistoryDrawer
//   - typing: SearchTypeahead
//   - submitted: SearchResults (元素 / 收藏 / 用户)
// A search submitted from the field or a starter, a collection or a person opened from here are remembered (the
// recent searches). Opening search focuses the field unless it arrives with a search (a description's keyword).
// Not here yet: the colour search (HueGradient) and the filters (ExploreSearchFilterSheet), the pull to refresh on
// the landing.
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, GLOBAL_SEARCH_BAR_HEIGHT } from '../components/bar/constants';
import type { Collection } from '../components/clusters/CollectionCard';
import { ClockIcon } from '../components/icons';
import { SEARCH_HISTORY_DRAWER_WIDTH, SearchHistoryDrawer } from '../components/search/SearchHistoryDrawer';
import { SearchLanding, type Starter } from '../components/search/SearchLanding';
import { SearchResults } from '../components/search/SearchResults';
import { SearchTypeahead, type Person, type Typeahead } from '../components/search/SearchTypeahead';
import { get } from '../lib/api';
import { forgetAllSearches, forgetSearch, readSearchHistory, rememberSearch, type HistoryEntry } from '../lib/searchHistory';
import { Routes } from '../navigation/routes';
import { useBarStore } from '../stores/useBarStore';
import { useSearchStore } from '../stores/useSearchStore';
import { useSessionStore } from '../stores/useSessionStore';

const DRAWER_DURATION = 300;
const TYPEAHEAD_DELAY = 150;

export function SearchScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const meId = useSessionStore((s) => s.me?.id ?? null);
  const query = useSearchStore((s) => s.query);
  const focused = useSearchStore((s) => s.focused);
  const submitted = useSearchStore((s) => s.submitted);
  const [starters, setStarters] = useState<Starter[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [typeahead, setTypeahead] = useState<Typeahead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useSharedValue(0);

  // ---------- the bar and the field ----------
  useFocusEffect(useCallback(() => {
    useBarStore.getState().setActiveState({ type: 'global-search' });
    const s = useSearchStore.getState();
    if (!s.submitted) useSearchStore.setState({ focusToken: s.focusToken + 1 });
    return () => { if (useBarStore.getState().activeState.type === 'global-search') useBarStore.getState().setActiveState({ type: 'default' }); };
  }, []));
  useEffect(() => () => useSearchStore.getState().reset(), []); // closing search empties it

  // ---------- what it reads ----------
  const loadHistory = useCallback(() => readSearchHistory().then(setHistory, () => undefined), []);
  useEffect(() => {
    get<Starter[]>('/api/search/starters?count=12').then(setStarters, () => setStarters([]));
    void loadHistory();
  }, [loadHistory]);
  useEffect(() => {
    if (!submitted) return;
    void rememberSearch({ kind: 'term', searchTerm: submitted.term }).then(loadHistory);
  }, [submitted?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const typing = focused && !!query.trim() && !submitted;
  useEffect(() => {
    if (!typing) return;
    const q = encodeURIComponent(query.trim());
    let live = true;
    const t = setTimeout(() => {
      Promise.all([
        get<{ terms: Typeahead['terms']; clusters: Collection[] }>(`/api/search/suggest?q=${q}`),
        get<{ items: Person[] }>(`/api/search/users?q=${q}`).catch(() => ({ items: [] as Person[] })),
      ]).then(([s, u]) => { if (live) setTypeahead({ terms: s.terms, clusters: s.clusters, users: u.items.slice(0, 3) }); }, () => undefined);
    }, TYPEAHEAD_DELAY);
    return () => { live = false; clearTimeout(t); };
  }, [typing, query]);

  // ---------- going places ----------
  const openCluster = (c: Collection) => {
    void rememberSearch({ kind: 'cluster', clusterId: c.id }).then(loadHistory);
    navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_CLUSTER, params: { clusterId: c.id } } });
  };
  const openUser = (p: Person) => {
    void rememberSearch({ kind: 'user', userId: p.id }).then(loadHistory);
    if (p.id === meId) navigation.navigate(Routes.PROFILE);
    else navigation.dispatch({ type: 'PUSH', payload: { name: Routes.USER_PROFILE, params: { userId: p.id } } });
  };
  const setDrawer = (open: boolean) => {
    if (open) { Keyboard.dismiss(); void loadHistory(); }
    setDrawerOpen(open);
    drawer.set(withTiming(open ? 1 : 0, { duration: DRAWER_DURATION }));
  };
  const onHistoryItem = (e: HistoryEntry) => {
    setDrawer(false);
    if (e.kind === 'term') useSearchStore.getState().submit(e.searchTerm);
    else if (e.kind === 'cluster') openCluster(e.cluster);
    else openUser({ ...e.user, id: e.userId });
  };

  // the landing over the bar, and over the keyboard while it is up
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const barSpace = insets.bottom + BAR_BOTTOM_OFFSET + GLOBAL_SEARCH_BAR_HEIGHT + theme.spacing.lg;
  const landingStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.min(0, keyboardHeight.get() + insets.bottom) }] }));
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drawer.get() * SEARCH_HISTORY_DRAWER_WIDTH }] }));

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.page, pageStyle]}>
        {submitted ? (
          <SearchResults term={submitted.term} origin={submitted.origin} topInset={insets.top} bottomInset={barSpace} onCluster={openCluster} onUser={openUser} />
        ) : typing ? (
          <View style={[styles.fill, { paddingTop: insets.top }]}>
            <SearchTypeahead
              data={typeahead}
              bottomInset={barSpace}
              onTerm={(t) => useSearchStore.getState().submit(t)}
              onUser={openUser}
              onCluster={openCluster}
            />
          </View>
        ) : (
          <View style={styles.fill}>
            <Animated.View style={[styles.landing, { paddingBottom: barSpace }, landingStyle]}>
              <SearchLanding starters={starters} returning={history.length > 0} onStarterPress={(s) => useSearchStore.getState().submit(s.searchTerm)} />
            </Animated.View>
            <Pressable
              style={[styles.historyButton, { top: insets.top + theme.spacing.sm }]}
              onPress={() => setDrawer(true)}
              accessibilityRole="button"
              accessibilityLabel="最近搜索"
            >
              <ClockIcon color={theme.colors.primary} size={24} />
            </Pressable>
          </View>
        )}
      </Animated.View>
      <SearchHistoryDrawer
        progress={drawer}
        open={drawerOpen}
        items={history}
        onClose={() => setDrawer(false)}
        onItemPress={onHistoryItem}
        onRemove={(e) => { setHistory((h) => h.filter((x) => x !== e)); void forgetSearch(e).catch(() => undefined); }}
        onClear={() => { setHistory([]); void forgetAllSearches().catch(() => undefined); }}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background, overflow: 'hidden' },
  page: { flex: 1 },
  fill: { flex: 1 },
  landing: { flex: 1, justifyContent: 'flex-end' },
  historyButton: {
    position: 'absolute', left: theme.spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.elevated,
    alignItems: 'center', justifyContent: 'center', boxShadow: theme.shadows.default,
  },
}));
