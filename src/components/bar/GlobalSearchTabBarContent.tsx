// Cosmos' GlobalSearchTabBarContent (module 2178) with SearchInput: the pill, 56 high, becomes the search field — a
// tertiary 20 px lead icon 18 in from the left, the text in 16, 10 from the right (cosmos-lite's measurements), and
// a clear cross while there is text. What is typed goes to useSearchStore: typing shows the typeahead, the keyboard's
// search key submits it; pressing the field over the results goes back to typing (SearchScreen).
// The lead icon is a plus and the placeholder 搜索任何内容: the user's choice (cosmos-lite 6.124; Cosmos has the glass
// and 从搜索开始).
// On the right (SearchInput's rightAccessory, 20 × 20) the colour search button (colorSearchHit 24 × 24, hit slop 10):
// QuadDotsIcon 24, or a 20 dot of the colour searched; while there is text it gives way to the clear button (a 20
// tertiary circle with a 12 cross in the background colour) — fading out and shrinking to 0.8 as the clear button fades
// in (SearchInputTsx1–3). The clear button empties the field and the colour (SearchScreen's _temp3).
// Approximate: how long the cross-fade takes (clearButtonVisibility's timing was not read; 150 ms here).
import { useEffect, useRef } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useBarStore } from '../../stores/useBarStore';
import { useSearchStore } from '../../stores/useSearchStore';
import { CloseIcon, PlusIcon, QuadDotsIcon } from '../icons';
import { BAR_CONTENT_INDEX } from './constants';
import { useContentAnimation, type ContentTransition } from './useContentAnimation';

const CLEAR_FADE = 150;

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
  const color = useSearchStore((s) => s.color);
  const clearVisibility = useSharedValue(query ? 1 : 0);
  useEffect(() => { clearVisibility.set(withTiming(query ? 1 : 0, { duration: CLEAR_FADE })); }, [query, clearVisibility]);
  const clearStyle = useAnimatedStyle(() => ({ opacity: clearVisibility.get() }));
  const colorStyle = useAnimatedStyle(() => ({
    opacity: 1 - clearVisibility.get(),
    transform: [{ scale: interpolate(clearVisibility.get(), [0, 1], [1, 0.8]) }],
  }));
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
        <View style={styles.rightAccessory}>
          <Animated.View style={[styles.accessoryLayer, colorStyle]} pointerEvents={query ? 'none' : 'auto'}>
            <Pressable
              onPress={() => { input.current?.blur(); Keyboard.dismiss(); useSearchStore.getState().openColorPicker(); }}
              hitSlop={10}
              style={styles.colorSearchHit}
              accessibilityRole="button"
              accessibilityLabel="按颜色搜索"
            >
              {color ? <View style={[styles.colorSwatchDotInner, { backgroundColor: `#${color}` }]} /> : <QuadDotsIcon size={24} />}
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.accessoryLayer, clearStyle]} pointerEvents={query ? 'auto' : 'none'}>
            <Pressable onPress={() => useSearchStore.getState().clear()} hitSlop={10} style={styles.clearButton} accessibilityRole="button" accessibilityLabel="清除">
              <CloseIcon color={theme.colors.background} size={12} />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingLeft: 18, paddingRight: 10 },
  text: { ...theme.typography.large, flex: 1, minWidth: 0, padding: 0, color: theme.colors.primary },
  rightAccessory: { width: 20, height: 20, position: 'relative', marginRight: 2 },
  accessoryLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  colorSearchHit: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  colorSwatchDotInner: { width: 20, height: 20, borderRadius: 40 },
  clearButton: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.tertiary, borderRadius: theme.borderRadius.full },
}));
