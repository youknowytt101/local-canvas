// Every page of a tab's stack, as the stack lays it out (screenLayout). Not in Cosmos (HANDOFF 6.183): a viewer opened
// from a tile is a transparent modal on Android, so that the page it opens from shows under its transition
// (lib/viewerTransition), and Android keeps every page under a run of them attached and drawing on every frame (ten deep,
// every frame of a scroll took 150 ms on the emulator). A page that cannot be seen is not drawn: its alpha is 0, which
// the render thread skips (HWUI's nothingToDraw). Two cases:
//   - two or more of those viewers over it: never seen, the one right over it being opaque; set in the render that
//     pushes or pops them
//   - right under the viewer in front while that is open and still (pageUnder): shown again on the frame it is dragged
//     or starts going back
// iOS pushes those viewers as cards, whose pages under are taken out of the window by the system: nothing to do there.
import { useNavigationState, type ParamListBase, type RouteProp } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { pageUnder, TRANSITION_OVER_LIVE_PAGE } from '../lib/viewerTransition';
import { Routes } from './routes';

const overLivePage = (r: { name: string; params?: object }) =>
  r.name === Routes.ELEMENTS_VIEWER && (r.params as { openAnimation?: string } | undefined)?.openAnimation === 'zoom';

function StackPage({ routeKey, children }: { routeKey: string; children: ReactElement }) {
  const covered = useNavigationState((s) => {
    const i = s.routes.findIndex((r) => r.key === routeKey);
    return i >= 0 && s.routes.length - 1 - i >= 2 && s.routes.slice(i + 1).every(overLivePage);
  });
  const under = useAnimatedStyle(() => ({ opacity: pageUnder.value === routeKey ? 0 : 1 }));
  return (
    <View style={[styles.fill, covered && styles.unseen]}>
      <Animated.View style={[styles.fill, under]}>{children}</Animated.View>
    </View>
  );
}

export const stackPageLayout = TRANSITION_OVER_LIVE_PAGE
  ? ({ route, children }: { route: RouteProp<ParamListBase>; children: ReactElement }) => <StackPage routeKey={route.key}>{children}</StackPage>
  : undefined;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  unseen: { opacity: 0 },
});
