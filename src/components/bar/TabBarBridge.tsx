// Cosmos' TabBarBridge (module 3494): the bottom tab navigator's `tabBar`. It draws nothing; it hands the tabs' state,
// descriptors and navigation to useTabBarStore, and DynamicBar (outside the navigator) draws them.
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useLayoutEffect } from 'react';
import { useTabBarStore } from '../../stores/useTabBarStore';

export function TabBarBridge({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  useLayoutEffect(() => {
    useTabBarStore.getState().setTabNavProps({ state, descriptors, navigation, insets });
  }, [state, descriptors, navigation, insets]);
  useLayoutEffect(() => () => useTabBarStore.getState().setTabNavProps(null), []);
  return null;
}
