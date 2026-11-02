// Cosmos' ElementsViewerScreen (module 2653): ElementViewerHeader over one scroll — the ElementCarousel of the list it
// was opened from, then the elements similar to the one on screen as a masonry grid (MasonryGrid, imageScale 2,
// half a screen drawn ahead, impressions as SimilarElements). The bar is the element's (useElementViewerTabBarState):
// 保存 with 分享 / 更多, until the scroll passes ELEMENT_VIEWER_HIDE_TAB_BAR_RATIO (0.15) of the carousel's height, then
// the round scroll-to-top.
//   - useViewerPagination: when 5 or fewer elements are left after the one on screen and the list has more, it asks
//     for more once
//   - useViewerImagePrefetch: the pictures of the next and the previous ones (+1, −1, +2, −2)
//   - useTrackElementView: the element on screen is being viewed while the viewer is focused
//   - a similar one opens a viewer of the similar list on top (a "rabbit hole"); from the second one on, the header's
//     cross closes them all at once (isInRabbitHole: the screen under is a viewer too)
// 保存 opens the save sheet (MoveSheet), 更多 the element menu (ElementMenuSheet); the connections sheet comes later in step 4; 分享 opens the system's share with the element's address on the computer (Cosmos opens its
// ShareElementScreen).
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useFocusEffect, useIsFocused, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { forwardRef, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, useWindowDimensions, View, type ScrollViewProps, type ViewToken } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HEIGHT_DEFAULT } from '../../components/bar/constants';
import { ElementCarousel, getMaxMediaHeight, MIN_TOP } from '../../components/elements/ElementCarousel';
import { ELEMENT_VIEWER_HEADER_HEIGHT, ELEMENT_VIEWER_HEADER_MEDIA_GAP } from '../../components/elements/ElementMetaRow';
import { getSnappedContainFittedSize } from '../../components/elements/ElementViewerMedia';
import { ViewerTransitionFrame, type ViewerTransitionHandle } from '../../components/elements/ViewerTransition';
import { useElementMenuStore } from '../../components/sheets/ElementMenuSheet';
import { ElementTile } from '../../components/elements/ElementTile';
import { ViewerSourceContext } from '../../components/elements/viewerContext';
import { DEFAULT_GRID_GAP } from '../../components/home/ForYouFeed';
import { ChevronLeftIcon, CloseIcon } from '../../components/icons';
import { useSimilarElements } from '../../hooks/useSimilarElements';
import { useTrackElementView } from '../../hooks/useTrackElementView';
import { GRID_IMAGE_SCALE, tileRatio, viewerImageSources, type Element } from '../../lib/elements';
import { noteGridMoved } from '../../lib/gridVideos';
import { ListImpressions } from '../../lib/impressions';
import { openElementViewer } from '../../lib/openElementViewer';
import { serverUrl } from '../../lib/server';
import { forgetViewerTransition, viewerTransitionFor, type Rect } from '../../lib/viewerTransition';
import { holdViewerVideos, leaveViewerVideo, peekViewerVideo, playViewerVideo, settleViewerVideos, viewerRevealed } from '../../lib/viewerVideoPlayers';
import { Routes } from '../../navigation/routes';
import { useBarStore } from '../../stores/useBarStore';
import { useElementViewerStore } from '../../stores/useElementViewerStore';
import { useMoveSheetStore } from '../../stores/useMoveSheetStore';

const ELEMENT_VIEWER_HIDE_TAB_BAR_RATIO = 0.15;
export const ELEMENT_VIEWER_HEADER_CONTENT_HEIGHT = 64;
const PAGINATION_THRESHOLD = 5;
const PREFETCH_ORDER = [1, -1, 2, -2];
const VIEWABILITY = { itemVisiblePercentThreshold: 1 };
const VIDEO_NEIGHBOURS_DELAY = 300;
const DESCRIPTION_GUESS = 16 + 24 * 2 + 4; // ElementDescription: spacing.md over its two rows

type Params = { viewerId: string; initialIndex: number; openAnimation?: 'fade' | 'zoom' };

// where ElementCarousel → ElementViewerContainer will put this element's media on the page: the column centred in the
// carousel less the bar's clearance, the meta row over the media, the description under it (two rows guessed); the
// transition corrects it once the media has laid out
function predictMedia(el: Element, width: number, headerHeight: number, carouselHeight: number, clearance: number): Rect {
  const aspect = el.mediaKind === 'video' && !el.width ? 9 / 16 : tileRatio(el.width, el.height);
  const size = getSnappedContainFittedSize(width, getMaxMediaHeight(carouselHeight, clearance, carouselHeight / 2), aspect, 16);
  const above = ELEMENT_VIEWER_HEADER_HEIGHT + ELEMENT_VIEWER_HEADER_MEDIA_GAP;
  const content = above + size.height + (el.ai?.caption ? DESCRIPTION_GUESS : 0);
  const top = headerHeight + Math.max(MIN_TOP, (carouselHeight - clearance - content) / 2);
  return { x: (width - size.width) / 2, y: top + above, w: size.width, h: size.height };
}

export function ElementsViewerScreen() {
  const route = useRoute<RouteProp<{ ElementsViewer: Params }, 'ElementsViewer'>>();
  const { viewerId, initialIndex } = route.params;
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const viewer = useElementViewerStore((s) => s.viewers[viewerId]);
  const elements = viewer?.elements ?? [];
  const [index, setIndex] = useState(initialIndex);
  const element = elements[index] ?? null;
  const source = viewer?.userInteractionSource ?? 'Unspecified';
  const listRef = useRef<FlashListRef<Element>>(null);
  const pagerRef = useRef<PagerView>(null);

  const headerHeight = insets.top + ELEMENT_VIEWER_HEADER_CONTENT_HEIGHT;
  const carouselHeight = height - headerHeight;
  const bottomOverlayClearance = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HEIGHT_DEFAULT;
  const tileWidth = (width - 3 * DEFAULT_GRID_GAP) / 2;

  // the video on screen plays at once, ahead of the page's render (lib/viewerVideoPlayers); the one a swipe is bringing
  // in starts when the finger lets go; the ones next to it are prepared once the slide has ended (making a player holds
  // up the main thread)
  const elementsNow = useRef(elements);
  elementsNow.current = elements;
  const selectedNow = useRef(initialIndex);
  const prepareAround = useCallback(() => {
    const i = selectedNow.current;
    holdViewerVideos([elementsNow.current[i - 1], elementsNow.current[i + 1]]);
  }, []);
  const onIndexChange = useCallback((i: number) => {
    selectedNow.current = i;
    playViewerVideo(elementsNow.current[i], true);
    startTransition(() => setIndex(i));
  }, []);
  const onIncoming = useCallback((i: number) => peekViewerVideo(elementsNow.current[i]), []);
  const onSettled = useCallback(() => {
    settleViewerVideos();
    prepareAround();
  }, [prepareAround]);
  const elementId = element?.id ?? null;
  useEffect(() => {
    if (!focused) { leaveViewerVideo(elementId); return undefined; }
    playViewerVideo(elementsNow.current[selectedNow.current]);
    const t = setTimeout(prepareAround, VIDEO_NEIGHBOURS_DELAY);
    return () => clearTimeout(t);
  }, [focused, prepareAround, elementId]);
  const lastElementId = useRef(elementId);
  lastElementId.current = elementId;
  useEffect(() => () => leaveViewerVideo(lastElementId.current), []);

  useTrackElementView(element, focused, source);
  const similar = useSimilarElements(element?.id ?? null);

  // ---------- useViewerPagination ----------
  const loadingMore = useRef(false);
  useEffect(() => {
    useElementViewerStore.getState().setCurrentIndex(viewerId, index);
    if (!viewer?.hasMore || !viewer.loadMore || loadingMore.current || elements.length - 1 - index > PAGINATION_THRESHOLD) return;
    loadingMore.current = true;
    // what of the list it does not have yet; it stops only once the list is done
    viewer.loadMore().then((more) => {
      useElementViewerStore.getState().appendElements(viewerId, more.items, !more.done);
    }, () => undefined).finally(() => { loadingMore.current = false; });
  }, [index, elements.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- useViewerImagePrefetch ----------
  useEffect(() => {
    const urls = PREFETCH_ORDER.map((d) => elements[index + d]).filter((e): e is Element => !!e && e.type !== 'note')
      .map((e) => viewerImageSources(e, width)[0]).filter(Boolean);
    if (urls.length) void Image.prefetch(urls);
  }, [index, elements.length, width]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- the bar ----------
  const [mode, setMode] = useState<'actions' | 'scrollToTop'>('actions');
  const scrollToTop = useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), []);
  useFocusEffect(useCallback(() => {
    useBarStore.getState().setActiveState({ type: 'element' });
    return () => {
      const bar = useBarStore.getState();
      if (bar.elementViewerBarState?.viewerId !== viewerId) return;
      bar.setElementViewerBarState(null);
      // the screen under it (a collection) may have set its own bar already
      if (bar.activeState.type === 'element') bar.setActiveState({ type: 'default' });
    };
  }, [viewerId]));
  const saved = !!element?.isConnectedByUser;
  useEffect(() => {
    if (!focused || !element) return;
    useBarStore.getState().setElementViewerBarState({
      viewerId, mode, saved,
      onSave: () => useMoveSheetStore.getState().open(element),
      onShare: () => { void Share.share({ message: `${serverUrl()}/e/${element.id}` }); },
      onMore: () => useElementMenuStore.getState().open(element, source, viewer?.remove ? {
        target: viewer.remove,
        onDone: () => {
          viewer.onRemoved?.(element.id);
          useElementViewerStore.getState().dropElement(viewerId, element.id);
          navigation.goBack();
        },
      } : null),
      onScrollToTop: scrollToTop,
    });
  }, [focused, element?.id, mode, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- the similar grid ----------
  const impressions = useMemo(() => new ListImpressions<Element>(
    (el) => ({ targetType: 'Element', targetId: el.id, userInteractionSource: 'SimilarElements', slateId: el.slateId })), []);
  useEffect(() => () => impressions.dispose(), [impressions]);
  useEffect(() => { impressions.reset(); }, [impressions, element?.id]);
  useEffect(() => { impressions.setEnabled(focused); if (!focused) impressions.setVisible([]); }, [impressions, focused]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Element>[] }) => {
    impressions.setVisible(viewableItems.filter((v) => v.item).map((v) => [v.item!.id, v.item!]));
  }).current;
  const onMediaReady = useCallback((id: string) => impressions.markMediaReady(id), [impressions]);
  const similarItems = useRef(similar.items);
  similarItems.current = similar.items;
  const openSimilar = useCallback((el: Element) => {
    const list = similarItems.current;
    openElementViewer(navigation, { elements: list, initialIndex: Math.max(0, list.findIndex((e) => e.id === el.id)), hasMore: false, userInteractionSource: 'SimilarElements' });
  }, [navigation]);
  const renderItem = useCallback(({ item }: { item: Element }) => (
    <View style={styles.cell}>
      <ElementTile element={item} width={tileWidth} imageScale={GRID_IMAGE_SCALE} onMediaReady={onMediaReady} onPress={openSimilar} />
    </View>
  ), [tileWidth, onMediaReady, openSimilar]);

  // ---------- the header ----------
  const state = navigation.getState();
  const myIndex = state.routes.findIndex((r) => r.key === route.key);
  const isInRabbitHole = myIndex > 0 && state.routes[myIndex - 1]?.name === Routes.ELEMENTS_VIEWER;
  const closeAll = () => {
    let n = 0;
    for (let i = myIndex; i >= 0 && state.routes[i].name === Routes.ELEMENTS_VIEWER; i--) n++;
    navigation.dispatch({ type: 'POP', payload: { count: n } });
  };

  // ---------- opening out of the tile and going back into it (lib/viewerTransition) ----------
  // Its first render is only the header (the carousel and the grid come once it is nearly open: mounted on the way, they
  // held the UI thread up), so that it is pushed and opens at once; going back (one screen, while it is in front) the
  // picture of the element on screen first flies into its tile and the screen is popped once it is there. The list goes
  // when the screen does (not on a re-run of effects)
  const transition = useMemo(() => viewerTransitionFor(viewerId), [viewerId]);
  useEffect(() => () => forgetViewerTransition(viewerId), [viewerId]);
  const frame = useRef<ViewerTransitionHandle>(null);
  const [contentReady, setContentReady] = useState(!transition);
  const onOpenSettled = useCallback(() => setContentReady(true), []);
  useEffect(() => {
    if (contentReady) return undefined;
    const t = setTimeout(onOpenSettled, 1000); // in case the growth never reports
    return () => clearTimeout(t);
  }, [contentReady, onOpenSettled]);
  const initialMedia = useMemo(() => {
    const el = viewer?.elements[initialIndex];
    return el ? predictMedia(el, width, headerHeight, carouselHeight, bottomOverlayClearance) : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- where it opens, once
  const atTop = useSharedValue(true);
  const [dragging, setDragging] = useState(false);
  const allowRemove = useRef(false);
  const currentElementId = useCallback(() => elementsNow.current[selectedNow.current]?.id ?? null, []);
  // the pictures ElementViewerMedia tries for an element (its sources at the width it has) and its size, to fly back
  const flyImage = useCallback((id: string) => {
    const el = elementsNow.current.find((e) => e.id === id);
    if (!el || el.type === 'note') return null;
    const { w, h } = predictMedia(el, width, headerHeight, carouselHeight, bottomOverlayClearance);
    const uris = viewerImageSources(el, w);
    return uris.length ? { uris, blurred: el.nsfw?.treatment === 'blur' && !viewerRevealed.has(el.id), w, h } : null;
  }, [width, headerHeight, carouselHeight, bottomOverlayClearance]);
  const onDismissed = useCallback(() => { allowRemove.current = true; navigation.goBack(); }, [navigation]);
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    const { type, payload } = e.data.action as { type: string; payload?: { count?: number } };
    const one = type === 'GO_BACK' || (type === 'POP' && (payload?.count ?? 1) === 1);
    if (frame.current && !allowRemove.current && one && navigation.isFocused()) {
      e.preventDefault();
      frame.current.close(currentElementId(), () => { allowRemove.current = true; navigation.dispatch(e.data.action); });
      return;
    }
    useElementViewerStore.getState().closeViewer(viewerId);
  }), [navigation, viewerId, currentElementId]);
  // the list's scrolling waits for a drag back to be ruled out (ViewerTransitionFrame)
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const GestureScroll = useMemo(() => forwardRef<ScrollView, ScrollViewProps>(function GestureScroll(props, ref) {
    return <GestureDetector gesture={scrollGesture}><ScrollView ref={ref} {...props} /></GestureDetector>;
  }), [scrollGesture]);

  if (!viewer) return <View style={styles.screen} />;
  const page = (
    <View style={styles.screen}>
      {contentReady ? (
        <FlashList
          ref={listRef}
          data={similar.items}
          masonry
          numColumns={2}
          keyExtractor={(e: Element) => e.id}
          renderItem={renderItem}
          onEndReached={similar.loadMore}
          onEndReachedThreshold={1}
          drawDistance={height * 0.5}
          maintainVisibleContentPosition={{ disabled: true }} // the similar list is replaced on every page: the carousel stays where it is
          viewabilityConfig={VIEWABILITY}
          onViewableItemsChanged={onViewableItemsChanged}
          scrollEventThrottle={16}
          onScroll={(e) => {
            noteGridMoved();
            atTop.value = e.nativeEvent.contentOffset.y <= 1;
            const next = e.nativeEvent.contentOffset.y > carouselHeight * ELEMENT_VIEWER_HIDE_TAB_BAR_RATIO ? 'scrollToTop' : 'actions';
            if (next !== mode) setMode(next);
          }}
          {...(transition ? { renderScrollComponent: GestureScroll, bounces: false, overScrollMode: 'never' as const, scrollEnabled: !dragging } : {})}
          contentContainerStyle={{ paddingTop: headerHeight, paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: bottomOverlayClearance + DEFAULT_GRID_GAP }}
          ListHeaderComponent={
            <View style={styles.fullBleed}>
              <ElementCarousel
                ref={pagerRef}
                elements={elements}
                index={index}
                initialIndex={initialIndex}
                height={carouselHeight}
                width={width}
                bottomOverlayClearance={bottomOverlayClearance}
                onIndexChange={onIndexChange}
                onIncoming={onIncoming}
                onSettled={onSettled}
              />
            </View>
          }
          ListFooterComponent={similar.loading ? <View style={styles.footer}><ActivityIndicator color={theme.colors.tertiary} /></View> : null}
        />
      ) : null}
      <View style={[styles.header, { paddingTop: insets.top, height: headerHeight }]}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={4}>
            <ChevronLeftIcon color={theme.colors.primary} />
          </Pressable>
          <View style={styles.headerTitle} />
          {isInRabbitHole ? (
            <Pressable style={[styles.headerButton, styles.closeAll]} onPress={closeAll} accessibilityRole="button" accessibilityLabel="关闭" hitSlop={4}>
              <CloseIcon color={theme.colors.primary} size={16} />
            </Pressable>
          ) : <View style={styles.headerButton} />}
      </View>
    </View>
  );
  return (
    <ViewerSourceContext.Provider value={source}>
      {transition && initialMedia ? (
        <ViewerTransitionFrame ref={frame} transition={transition} initialElementId={viewer.elements[initialIndex]?.id ?? ''} initialMedia={initialMedia}
          currentId={elementId} currentElementId={currentElementId} flyImage={flyImage} atTop={atTop} scrollGesture={scrollGesture}
          onDragging={setDragging} onDismissed={onDismissed} onOpenSettled={onOpenSettled}>
          {page}
        </ViewerTransitionFrame>
      ) : page}
    </ViewerSourceContext.Provider>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  fullBleed: { marginHorizontal: -DEFAULT_GRID_GAP / 2, marginBottom: DEFAULT_GRID_GAP },
  cell: { paddingHorizontal: DEFAULT_GRID_GAP / 2, paddingBottom: DEFAULT_GRID_GAP },
  footer: { paddingVertical: theme.spacing.lg, alignItems: 'center' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, alignItems: 'center' },
  closeAll: { borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.elevated },
}));
