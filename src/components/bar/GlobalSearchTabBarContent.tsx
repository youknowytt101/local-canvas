// Cosmos' GlobalSearchTabBarContent (module 2178) with SearchInput: the pill, 56 high, becomes the search field — a
// tertiary 20 px lead icon 18 in from the left, the text in 16, 10 from the right (cosmos-lite's measurements).
// Step 1 has the field only: what typing does (typeahead, results, colour, filters) comes with search in step 5.
import { TextInput, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { PlusIcon } from '../icons';
import { BAR_CONTENT_INDEX } from './constants';
import { useContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

export function GlobalSearchTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['global-search']);
  return (
    <Animated.View style={[styles.container, animated]}>
      <View style={styles.input}>
        <PlusIcon color={theme.colors.tertiary} size={20} />
        <TextInput
          style={styles.text}
          placeholder="搜索任何内容"
          placeholderTextColor={theme.colors.tertiary}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="搜索"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingLeft: 18, paddingRight: 10 },
  text: { ...theme.typography.large, flex: 1, minWidth: 0, padding: 0, color: theme.colors.primary },
}));
