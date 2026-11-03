// Cosmos' DynamicBarSearchAction (module 2068): the round action beside the pill, two layers that come and go with the
// bar's content (useActionButtonAnimation, position 'right': from BAR_ACCESSORY_TRANSLATE_X to the left of their
// place, BAR_ACCESSORY_MIN_SCALE and transparent), each its own CustomPressable (0.97 and a light haptic going down):
//  - on the tabs: the search glass (28, secondary), 搜索 (common.search), opens search (openGlobalSearch)
//  - in search: the close cross (24, primary), 取消 (common.cancel), closes it (the search bar's onClose)
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { closeGlobalSearch, openGlobalSearch } from '../../lib/globalSearch';
import { CustomPressable } from '../CustomPressable';
import { CloseIcon, SearchIcon } from '../icons';
import { BAR_CONTENT_INDEX } from './constants';
import { useActionButtonAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

export function DynamicBarSearchAction({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const searchLayer = useActionButtonAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.default, 'right');
  const closeLayer = useActionButtonAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['global-search'], 'right');
  return (
    <>
      <Animated.View style={[styles.actionLayer, searchLayer]}>
        <CustomPressable onPress={openGlobalSearch} accessibilityLabel="搜索" style={styles.pressable}>
          <SearchIcon color={theme.colors.secondary} size={28} />
        </CustomPressable>
      </Animated.View>
      <Animated.View style={[styles.actionLayer, closeLayer]}>
        <CustomPressable onPress={closeGlobalSearch} accessibilityLabel="取消" style={styles.pressable}>
          <CloseIcon color={theme.colors.primary} size={24} />
        </CustomPressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  actionLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pressable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
});
