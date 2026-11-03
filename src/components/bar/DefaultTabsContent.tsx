// Cosmos' DefaultTabsContent (module 2064): the four tabs, TAB_BAR_DEFAULT_TAB_STACK_PADDING in from the pill's sides,
// sharing the rest, each the pill's whole height; the icon (TAB_BAR_DEFAULT_ICON_SIZE) is primary on the focused tab and
// tertiary on the others. A tab is a CustomPressable (0.97 in 120 ms and a light haptic as it goes down) and acts as it
// goes down (onPressIn): search overlays are dismissed and tabPress is emitted, then
//  - search open over the tabs: go to the tab (if it is not the focused one) and close search (the main stack to its top);
//  - the focused tab: its double-tap token (useTabReselect: its lists refresh at the top, else scroll up; the tab's own
//    stack pops to its top on tabPress);
//  - another tab: go there.
// Its accessibility is Cosmos': the tab's tabBarAccessibilityLabel (none is set) and selected when focused.
import { StackActions } from '@react-navigation/native';
import type { ReactNode } from 'react';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { dismissGlobalSearchOverlays } from '../../lib/globalSearch';
import { isBottomTabRouteName } from '../../navigation/routes';
import { useTabBarStore } from '../../stores/useTabBarStore';
import { useTabDoubleTapStore } from '../../stores/useTabDoubleTapStore';
import { CustomPressable } from '../CustomPressable';
import { BAR_CONTENT_INDEX, TAB_BAR_DEFAULT_ICON_SIZE, TAB_BAR_DEFAULT_TAB_STACK_PADDING } from './constants';
import { useContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

export function DefaultTabsContent({ activeContentIndex, contentTransition }: Props) {
  const tabNavProps = useTabBarStore((s) => s.tabNavProps);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.default);
  if (!tabNavProps) return null;
  const { state, descriptors, navigation } = tabNavProps;
  return (
    <Animated.View style={[styles.container, animated]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const onPressIn = () => {
          const dismissed = dismissGlobalSearchOverlays();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          const parent = navigation.getParent();
          const parentIndex = parent?.getState().index ?? 0;
          if (parentIndex > 0 && !dismissed && !event.defaultPrevented) {
            if (!focused) navigation.navigate(route.name, route.params);
            parent?.dispatch(StackActions.popToTop());
            return;
          }
          if (focused && !dismissed && isBottomTabRouteName(route.name)) useTabDoubleTapStore.getState().trigger(route.name);
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Tab key={route.key} focused={focused} label={options.tabBarAccessibilityLabel} onPressIn={onPressIn} icon={options.tabBarIcon} />
        );
      })}
    </Animated.View>
  );
}

type TabProps = {
  focused: boolean;
  label?: string;
  onPressIn: () => void;
  icon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
};

function Tab({ focused, label, onPressIn, icon }: TabProps) {
  const { theme } = useUnistyles();
  const color = focused ? theme.colors.primary : theme.colors.tertiary;
  return (
    <CustomPressable accessibilityState={focused ? { selected: true } : {}} accessibilityLabel={label} onPressIn={onPressIn} style={styles.tab}>
      {icon?.({ focused, color, size: TAB_BAR_DEFAULT_ICON_SIZE })}
    </CustomPressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, marginHorizontal: TAB_BAR_DEFAULT_TAB_STACK_PADDING, flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
});

