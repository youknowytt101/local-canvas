// Cosmos' GlobalSearchTabBarContent (module 2178) with SearchInput: the pill, 56 high, becomes the search field — a
// tertiary 20 px lead icon 18 in from the left, the text in 16, 10 from the right (cosmos-lite's measurements), and
// a clear cross while there is text. What is typed goes to useSearchStore: typing shows the typeahead, the keyboard's
// search key submits it; pressing the field over the results goes back to typing (SearchScreen).
// The lead icon is a plus and the placeholder 搜索任何内容: the user's choice (cosmos-lite 6.124; Cosmos has the glass
// and 从搜索开始).
import { useEffect, useRef } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useBarStore } from '../../stores/useBarStore';
import { useSearchStore } from '../../stores/useSearchStore';
import { CloseIcon, PlusIcon } from '../icons';
import { BAR_CONTENT_INDEX } from './constants';
import { useContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

export function GlobalSearchTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['global-search']);
  const query = useSearchStore((s) => s.query);
  const focusToken = useSearchStore((s) => s.focusToken);
  const searching = useBarStore((s) => s.activeState.type === 'global-search');
  const input = useRef<TextInput>(null);
  // a new request for focus (SearchScreen asks when it opens without a search), not one already answered
  const answered = useRef(focusToken);
  useEffect(() => {
    if (!searching || focusToken === answered.current) return;
    answered.current = focusToken;
    input.current?.focus();
  }, [focusToken, searching]);
  useEffect(() => { if (!searching) { input.current?.blur(); Keyboard.dismiss(); } }, [searching]);
  const submittedAt = useSearchStore((s) => s.submitted?.at);
  useEffect(() => { if (submittedAt) { input.current?.blur(); Keyboard.dismiss(); } }, [submittedAt]);
  return (
    <Animated.View style={[styles.container, animated]}>
      <View style={styles.input}>
        <PlusIcon color={theme.colors.tertiary} size={20} />
        <TextInput
          ref={input}
          style={styles.text}
          value={query}
          onChangeText={(t) => useSearchStore.getState().setQuery(t)}
          onFocus={() => { const s = useSearchStore.getState(); s.setFocused(true); if (s.submitted) s.edit(); }}
          onBlur={() => useSearchStore.getState().setFocused(false)}
          onSubmitEditing={() => useSearchStore.getState().submit(query)}
          placeholder="搜索任何内容"
          placeholderTextColor={theme.colors.tertiary}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="搜索"
        />
        {query ? (
          <Pressable
            onPress={() => { useSearchStore.getState().setQuery(''); if (useSearchStore.getState().submitted) useSearchStore.getState().edit(); else input.current?.focus(); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="清除"
          >
            <CloseIcon color={theme.colors.tertiary} size={18} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingLeft: 18, paddingRight: 10 },
  text: { ...theme.typography.large, flex: 1, minWidth: 0, padding: 0, color: theme.colors.primary },
}));
