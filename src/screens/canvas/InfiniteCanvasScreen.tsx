// Cosmos' InfiniteCanvasScreen (screens/elements/InfiniteCanvasScreen.js) with useInfiniteCanvasEntryDataset,
// buildForYouCanvasDataset and useSimilarCanvasDataset:
//   - pushed on the stack it was opened from with animation 'fade' and freezeOnBlur (every tab's navigator); the bar is
//     hidden on it (DynamicBar's list). On leaving (beforeRemove) the datasets go
//   - a View on the background colour: InfiniteCanvas, CanvasSeedHistoryBar, while the first elements load a large
//     loader in the middle (no touches), and a ScreenHeader over the top (insets.top, transparent) with HeaderButtons
//     left: back, and share when the canvas has an address (a collection's or a profile's); 40 round secondary
//     (elevated) buttons with 20 icons
//   - what it shows (params.source): 'for-you' (none given, the home logo): the For You feed's own elements
//     (key 'for-you:root'), loading more of that feed; 'cluster': the collection's elements a page of CANVAS_PAGE_SIZE at
//     a time; 'user': the profile's; 'element' (an element's 查看画布): that element, seeded straight away
//   - the similar canvas over it: tapping a card (onFocusElement: Medium haptic, the seed history, focusCanvasSeed)
//     asks for its first CANVAS_PAGE_SIZE similar elements afresh, leaves the seed out, keeps CANVAS_PAGE_SIZE − 1 and
//     puts the seed at the tapped slot's index (or the end), the focus slot being the tapped one; a seed from the history
//     (focusCanvasElement) goes to slot 0, uses the page cached for it, and the camera goes to it once loaded
//     (externalFocusRequest). Every new seed makes older answers count for nothing; further pages go by cursor, leaving
//     out what is there (mergeCanvasPageElements) and stopping on a cursor that comes back the same
//     (resolveNextCanvasPageCursor). The For You list stays as it was meanwhile (freezeForYouElements)
//   - a long press is the save sheet (useElementMoveLongPress); opening a card opens the viewer on the dataset's
//     elements, with the 'fade' animation, the source Canvas
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CanvasSeedHistoryBar, type SeedHistoryItem } from '../../components/canvas/CanvasSeedHistoryBar';
import { InfiniteCanvas, type FocusRequest } from '../../components/canvas/InfiniteCanvas';
import { ChevronLeftIcon, ShareIcon } from '../../components/icons';
import { get, qs } from '../../lib/api';
import { CANVAS as C } from '../../lib/canvas/constants';
import { toCanvasElements, type CanvasDataset } from '../../lib/canvas/layout';
import type { Element } from '../../lib/elements';
import type { FeedPage } from '../../lib/feedCache';
import { serverUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { useElementViewerStore } from '../../stores/useElementViewerStore';
import { useForYouCanvasStore } from '../../stores/useForYouCanvasStore';
import { useMoveSheetStore } from '../../stores/useMoveSheetStore';

export type InfiniteCanvasParams = {
  source?: 'for-you' | 'cluster' | 'user' | 'element';
  clusterId?: string;
  clusterName?: string;
  userId?: string;
  userName?: string;
  element?: Element;
};

type Entry = { key: string; elements: Element[]; cursor: string | null; loading: boolean };
// pending: a new seed is loading (isLoadingSimilarCanvas); dataset is the similar canvas on screen meanwhile, if any
type Similar = { seed: Element; requestId: number; pending: boolean; dataset: CanvasDataset | null; cursor: string | null; loadingMore: boolean };

const HEADER_HEIGHT = 64;
const BUTTON = 40;
const ICON = 20;

export function InfiniteCanvasScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const params = (useRoute<RouteProp<{ c: InfiniteCanvasParams }, 'c'>>().params ?? {}) as InfiniteCanvasParams;
  const source = params.source ?? 'for-you';

  // ---------- the entry dataset ----------
  const forYou = useForYouCanvasStore();
  const [entry, setEntry] = useState<Entry>(() => {
    if (source === 'element' && params.element) return { key: `element:${params.element.id}`, elements: [params.element], cursor: null, loading: false };
    return { key: source === 'cluster' ? `cluster:${params.clusterId}` : `user:${params.userId}`, elements: [], cursor: null, loading: source !== 'for-you' };
  });
  const entryPath = source === 'cluster' ? `/api/elements?${qs({ cluster: params.clusterId })}` : source === 'user' ? `/api/elements?${qs({ user: params.userId })}` : null;
  const loadEntry = useCallback(async (cursor: string | null) => {
    if (!entryPath) return;
    setEntry((e) => ({ ...e, loading: true }));
    try {
      const page = await get<FeedPage<Element>>(`${entryPath}&${qs({ pageSize: C.PAGE_SIZE, cursor })}`);
      setEntry((e) => {
        const have = new Set(e.elements.map((x) => x.id));
        const next = page.meta.nextPageCursor ?? null;
        return { ...e, elements: [...e.elements, ...page.items.filter((x) => !have.has(x.id))], cursor: next !== cursor ? next : null, loading: false };
      });
    } catch {
      setEntry((e) => ({ ...e, loading: false, cursor: null }));
    }
  }, [entryPath]);
  useEffect(() => { if (entryPath) void loadEntry(null); }, [entryPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- the similar dataset ----------
  const [similar, setSimilar] = useState<Similar | null>(null);
  const similarRef = useRef(similar);
  similarRef.current = similar;
  const requestId = useRef(0);
  const firstPages = useRef(new Map<string, FeedPage<Element>>()); // the first page of each seed, for the history
  const [history, setHistory] = useState<SeedHistoryItem[]>([]);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const loadSeed = useCallback(async (seed: Element, { sourceIndex, insertIndex, useCache, focusAfterLoad }: { sourceIndex: number; insertIndex: number; useCache: boolean; focusAfterLoad: boolean }) => {
    const id = ++requestId.current;
    setSimilar((s) => ({ seed, requestId: id, pending: true, dataset: s?.dataset ?? null, cursor: s?.cursor ?? null, loadingMore: false }));
    try {
      let first = useCache ? firstPages.current.get(seed.id) : undefined;
      if (!first) first = await get<FeedPage<Element>>(`/api/similar?${qs({ ids: seed.id, pageSize: C.PAGE_SIZE, fill: C.PAGE_SIZE })}`);
      firstPages.current.set(seed.id, first);
      if (requestId.current !== id) return;
      const items = toCanvasElements(first.items).filter((x) => x.id !== seed.id).slice(0, C.PAGE_SIZE - 1);
      const at = Math.min(insertIndex, items.length);
      items.splice(at, 0, seed);
      setSimilar({
        seed, requestId: id, pending: false, cursor: first.meta.nextPageCursor ?? null, loadingMore: false,
        dataset: { key: `similar:${seed.id}:${id}`, elements: items, focusElementIndex: at, focusSourceIndex: sourceIndex, prefetch: false },
      });
      if (focusAfterLoad) setFocusRequest({ id, elementId: seed.id, sourceIndex });
    } catch {
      // could not be loaded: back to what was there (the seed goes, as Cosmos clears it)
      if (requestId.current === id) {
        setSimilar((s) => (s && s.requestId === id ? (s.dataset ? { ...s, seed: s.dataset.elements[s.dataset.focusElementIndex ?? 0] ?? s.seed, pending: false } : null) : s));
      }
    }
  }, []);

  const loadMoreSimilar = useCallback(async () => {
    const s = similarRef.current;
    if (!s?.dataset || s.pending || !s.cursor || s.loadingMore) return;
    const cursor = s.cursor;
    setSimilar({ ...s, loadingMore: true });
    try {
      const page = await get<FeedPage<Element>>(`/api/similar?${qs({ ids: s.seed.id, cursor, pageSize: C.PAGE_SIZE, fill: C.PAGE_SIZE })}`);
      setSimilar((cur) => {
        if (!cur || cur.requestId !== s.requestId || !cur.dataset) return cur;
        const have = new Set(cur.dataset.elements.map((x) => x.id));
        const next = page.meta.nextPageCursor ?? null;
        const added = toCanvasElements(page.items).filter((x) => !have.has(x.id));
        return { ...cur, loadingMore: false, cursor: next !== cursor ? next : null, dataset: { ...cur.dataset, elements: [...cur.dataset.elements, ...added] } };
      });
    } catch {
      setSimilar((cur) => (cur && cur.requestId === s.requestId ? { ...cur, loadingMore: false, cursor: null } : cur));
    }
  }, []);

  const pushHistory = (element: Element, sourceIndex: number) => {
    setHistory((h) => [{ element, elementId: element.id, sourceIndex }, ...h.filter((x) => x.elementId !== element.id)].slice(0, C.SEED_HISTORY_LIMIT));
  };

  // an element's 查看画布: seeded with it at once, like a seed from the history
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || source !== 'element' || !params.element) return;
    seeded.current = true;
    pushHistory(params.element, 0);
    void loadSeed(params.element, { sourceIndex: 0, insertIndex: 0, useCache: true, focusAfterLoad: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- what is shown ----------
  const frozenForYou = useRef<Element[] | null>(null);
  if (similar && !frozenForYou.current) frozenForYou.current = forYou.items; // freezeForYouElements
  const forYouElements = similar ? frozenForYou.current ?? forYou.items : forYou.items;
  const entryDataset = useMemo<CanvasDataset | null>(() => {
    const elements = source === 'for-you' ? forYouElements : entry.elements;
    if (!elements.length) return null;
    return { key: source === 'for-you' ? 'for-you:root' : entry.key, elements: toCanvasElements(elements), focusElementIndex: null, focusSourceIndex: null, prefetch: true };
  }, [source, forYouElements, entry.elements, entry.key]);
  const dataset = similar?.dataset ?? entryDataset;
  const refining = !!similar?.pending;
  const entryHasMore = source === 'for-you' ? forYou.hasMore : !!entry.cursor;
  const entryLoading = source === 'for-you' ? forYou.loading : entry.loading;
  const hasMore = similar ? !!similar.cursor : entryHasMore;
  const loadingMore = similar ? similar.loadingMore : entryLoading;
  const onLoadMore = useCallback(() => {
    if (similarRef.current) { void loadMoreSimilar(); return; }
    if (source === 'for-you') { if (!similarRef.current) void useForYouCanvasStore.getState().loadMore(); return; }
    if (entry.cursor && !entry.loading) void loadEntry(entry.cursor);
  }, [entry.cursor, entry.loading, loadEntry, loadMoreSimilar, source]);
  const initialLoading = !dataset && (source === 'for-you' ? forYou.loading || !forYou.items.length : entry.loading);

  // beforeRemove: the datasets go (resetEntryDataset, resetSimilarCanvas)
  useEffect(() => navigation.addListener('beforeRemove', () => { requestId.current++; }), [navigation]);

  // ---------- what a card does ----------
  const onFocusElement = useCallback(({ element, sourceIndex }: { element: Element; elementIndex: number; sourceIndex: number }) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pushHistory(element, sourceIndex);
    void loadSeed(element, { sourceIndex, insertIndex: sourceIndex, useCache: false, focusAfterLoad: false });
  }, [loadSeed]);
  const onHistoryPress = useCallback((item: SeedHistoryItem) => {
    if (item.elementId === similarRef.current?.seed.id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void loadSeed(item.element, { sourceIndex: 0, insertIndex: 0, useCache: true, focusAfterLoad: true });
  }, [loadSeed]);
  const onOpenElement = useCallback((element: Element) => {
    const d = dataset;
    if (!d) return;
    const initialIndex = Math.max(0, d.elements.findIndex((e) => String(e.id) === String(element.id)));
    const viewerId = useElementViewerStore.getState().openViewer({
      elements: d.elements, initialIndex, hasMore: false, userInteractionSource: 'Canvas',
    });
    navigation.dispatch({ type: 'PUSH', payload: { name: Routes.ELEMENTS_VIEWER, params: { viewerId, initialIndex, openAnimation: 'fade' } } });
  }, [dataset, navigation]);
  const onLongPressElement = useCallback((element: Element) => { useMoveSheetStore.getState().open(element); }, []);

  const shareUrl = source === 'cluster' && params.clusterId ? `${serverUrl()}/collections/${encodeURIComponent(params.clusterId)}`
    : source === 'user' && params.userId ? `${serverUrl()}/profile/${encodeURIComponent(params.userId)}` : null;
  const shareTitle = source === 'cluster' ? params.clusterName : params.userName;

  return (
    <View style={styles.screen}>
      <InfiniteCanvas
        dataset={dataset}
        seedId={similar?.seed.id ?? null}
        refining={refining}
        focusRequest={focusRequest}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        onFocusElement={onFocusElement}
        onOpenElement={onOpenElement}
        onLongPressElement={onLongPressElement}
      />
      {similar ? <CanvasSeedHistoryBar items={history} onItemPress={onHistoryPress} /> : null}
      {initialLoading ? (
        <View style={styles.loaderOverlay} pointerEvents="none"><ActivityIndicator size="large" color={theme.colors.tertiary} /></View>
      ) : null}
      <View style={[styles.header, { top: insets.top }]} pointerEvents="box-none">
        <Pressable style={styles.button} onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="返回">
          <ChevronLeftIcon color={theme.colors.primary} size={ICON} />
        </Pressable>
        {shareUrl ? (
          <Pressable style={styles.button} onPress={() => void Share.share({ message: shareUrl, title: shareTitle })} hitSlop={8} accessibilityRole="button" accessibilityLabel="分享">
            <ShareIcon color={theme.colors.primary} size={ICON} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute', left: 0, right: 0, height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, gap: theme.spacing.xs, backgroundColor: 'transparent',
  },
  button: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
}));
