// Cosmos' IntroTopText: the page's line at the top (body.xl, line 20, two lines at most): it comes down 20 and in over 1200 ms
// (out cubic); going to another page the old line fades out in 180 ms, the new one in over 180 ms. White on the last page.
// Near Cosmos: the pack's words have a space where the English breaks its line; here that space is the break.
import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const TITLE_FADE_MS = 180;
const TITLES = ['发现、搜索、\n并保存接下来的内容', '寻找灵感\n符合你的口味', '然后构建你的世界\n与他人分享。', 'Cosmos 研究图像\n展现创作者和背景'];

export function IntroTopText({ activeStep, useSlideWhiteTheme, onLayout }: { activeStep: number; useSlideWhiteTheme: boolean; onLayout: (e: LayoutChangeEvent) => void }) {
  const { theme } = useUnistyles();
  const progress = useSharedValue(0);
  const titleOpacity = useSharedValue(1);
  const [shown, setShown] = useState(activeStep);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    progress.set(withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
  }, [progress]);

  useEffect(() => {
    if (shown === activeStep) return undefined;
    if (timer.current != null) { clearTimeout(timer.current); timer.current = null; }
    cancelAnimation(titleOpacity);
    titleOpacity.set(withTiming(0, { duration: TITLE_FADE_MS, easing: Easing.out(Easing.quad) }));
    timer.current = setTimeout(() => {
      setShown(activeStep);
      titleOpacity.set(withTiming(1, { duration: TITLE_FADE_MS, easing: Easing.in(Easing.quad) }));
      timer.current = null;
    }, TITLE_FADE_MS);
    return () => { if (timer.current != null) clearTimeout(timer.current); };
  }, [activeStep, shown, titleOpacity]);

  const containerStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: p, transform: [{ translateY: interpolate(p, [0, 1], [-20, 0]) }] };
  });
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.get() }));

  return (
    <Animated.View style={[styles.container, containerStyle]} onLayout={onLayout}>
      <View style={styles.titleWrapper}>
        <Animated.Text
          textBreakStrategy="balanced" lineBreakStrategyIOS="standard" numberOfLines={2}
          style={[styles.titleText, { color: useSlideWhiteTheme ? '#FFFFFF' : theme.colors.primary }, titleStyle]}
        >
          {TITLES[shown]}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: { alignItems: 'center', zIndex: 1, paddingHorizontal: theme.spacing.xxxl, paddingTop: rt.insets.top + rt.screen.height * 0.06 },
  titleWrapper: { minHeight: 40, alignItems: 'center' },
  titleText: { ...theme.typography.body.xl, lineHeight: 20, textAlign: 'center', color: theme.colors.primary },
}));
