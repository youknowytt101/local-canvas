// Cosmos' HomeScreen (module 3433): two pages side by side in a pager (Pager: react-native-pager-view) — 为你 (ForYouFeed)
// and 正在关注 (FollowingFeed) — under the floating HomeHeader (useHomeChrome). Swiping or pressing a tab changes the
// page; pressing the Home tab again refreshes the page on screen when it is at its top and otherwise scrolls it back up
// (useTabReselect, with the handlers each feed hands over).
import { pushInfiniteCanvas } from '../lib/openInfiniteCanvas';
import type { FlashListRef } from '@shopify/flash-list';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from '../components/bar/constants';
import { FollowingFeed } from '../components/home/FollowingFeed';
import { DEFAULT_GRID_GAP, ForYouFeed } from '../components/home/ForYouFeed';
import { HEADER_CONTENT_HEIGHT, HomeHeader } from '../components/home/HomeHeader';
import { useHomeChrome } from '../hooks/useHomeChrome';
import { useTabReselect } from '../hooks/useTabReselect';
import { get } from '../lib/api';
import type { FollowingItem } from '../hooks/useFollowingFeed';
import type { Element } from '../lib/elements';
import { noteGridMoved } from '../lib/gridVideos';
import { createNoopHomeFeedHandlers, type HomeFeedHandlers } from '../lib/homeFeedHandlers';
import { Routes } from '../navigation/routes';
import { useSessionStore } from '../stores/useSessionStore';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const userId = useSessionStore((s) => s.me?.id ?? null);
  const pager = useRef<PagerView>(null);
  const pagerX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const forYouList = useRef<FlashListRef<Element>>(null);
  const followingList = useRef<FlashListRef<FollowingItem>>(null);
  const forYouLook = useRef<((y: number) => void) | null>(null);
  const onForYouScroll = useCallback((y: number) => forYouLook.current?.(y), []);
  const chrome = useHomeChrome(onForYouScroll);
  const navigation = useNavigation();
  // the bell's dot (ActivityIndicator), asked for again whenever home comes back on screen
  const [unread, setUnread] = useState(false);
  useFocusEffect(useCallback(() => {
    let live = true;
    get<{ unread: number }>('/api/activity').then((r) => { if (live) setUnread(r.unread > 0); }, () => undefined);
    return () => { live = false; };
  }, []));

  const contentTopInset = insets.top + HEADER_CONTENT_HEIGHT;
  const bottomInset = insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + DEFAULT_GRID_GAP;

  // the home tab pressed again acts on the page on screen: refresh at its top, else scroll it up
  const forYouHandlers = useRef<HomeFeedHandlers>(createNoopHomeFeedHandlers());
  const followingHandlers = useRef<HomeFeedHandlers>(createNoopHomeFeedHandlers());
  const activeHandlers = () => (page === 1 ? followingHandlers : forYouHandlers).current;
  useTabReselect({
    tab: Routes.HOME,
    isActive: () => true,
    isAtTop: () => activeHandlers().isAtTop(),
    refresh: () => activeHandlers().refresh(),
    scrollToTop: () => activeHandlers().scrollToTop(),
  });

  return (
    <View style={styles.screen}>
      <PagerView
        ref={pager}
        style={styles.pager}
        initialPage={0}
        onPageScroll={(e) => pagerX.set(e.nativeEvent.position + e.nativeEvent.offset)}
        onPageSelected={(e) => { setPage(e.nativeEvent.position); chrome.onPageChange(e.nativeEvent.position); noteGridMoved(); }}
      >
        <View key="for-you" style={styles.page}>
          <ForYouFeed userId={userId} active={page === 0} contentTopInset={contentTopInset} bottomInset={bottomInset}
            scrollHandlers={chrome.forYouScroll} lookRef={forYouLook} listRef={forYouList} handlersRef={forYouHandlers} />
        </View>
        <View key="following" style={styles.page}>
          <FollowingFeed userId={userId} active={page === 1} contentTopInset={contentTopInset} bottomInset={bottomInset}
            scrollHandlers={chrome.followingScroll} listRef={followingList} handlersRef={followingHandlers} />
        </View>
      </PagerView>
      <HomeHeader
        pagerX={pagerX}
        onTabPress={(i) => pager.current?.setPage(i)}
        headerStyle={chrome.headerStyle}
        scrimStyle={chrome.scrimStyle}
        onHeight={(h) => chrome.headerHeight.set(h)}
        onLogoPress={() => pushInfiniteCanvas()}
        onActivityPress={() => { setUnread(false); navigation.dispatch({ type: 'PUSH', payload: { name: Routes.ACTIVITY } }); }}
        hasUnread={unread}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  pager: { flex: 1 },
  page: { flex: 1 },
}));
