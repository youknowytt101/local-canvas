// Cosmos' DynamicBarSearchAction (module 2068): the round action beside the pill. On the tabs it is the search glass
// (28) and opens search (openGlobalSearch); in search it is the close cross (24) and closes it. The two icons
// cross-fade with the bar's content, from BAR_ACCESSORY_MIN_SCALE.
import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { closeGlobalSearch, openGlobalSearch } from '../../lib/globalSearch';
import { useBarStore } from '../../stores/useBarStore';
import { CloseIcon, SearchIcon } from '../icons';
import { BAR_CONTENT_INDEX } from './constants';
import { useAccessoryContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

export function DynamicBarSearchAction({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const searching = useBarStore((s) => s.activeState.type === 'global-search');
  const searchIcon = useAccessoryContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.default);
  const closeIcon = useAccessoryContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['global-search']);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={searching ? '关闭' : '搜索'}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (searching) closeGlobalSearch();
        else openGlobalSearch();
      }}
      style={styles.button}
    >
      <Animated.View style={[styles.icon, searchIcon]}><SearchIcon color={theme.colors.primary} size={28} /></Animated.View>
      <Animated.View style={[styles.icon, closeIcon]}><CloseIcon color={theme.colors.primary} size={24} /></Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  icon: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
