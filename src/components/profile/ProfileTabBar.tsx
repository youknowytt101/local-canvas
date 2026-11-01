// Cosmos' TopTabBar as the profile uses it (module 2675 with Tab, useProfileTabs): the tabs share the width (spread),
// a hairline surfaceBorder under the row, a 2 high primary line under the tab the pager is on, moving with the pager.
// A tab: spacing.md over and under, spacing.sm at the sides, the label (large) and its count (body.xxs in a 1 px
// surfaceBorder outline, borderRadius.xxl, spacing.xxs at the sides, 2 down) spacing.xxs apart; its colour goes from
// tertiary to primary as the pager reaches it (TabTsx1).
// Cosmos jumps when a tab is pressed (animateIndexChange false); here the pager slides (the user's choice, 6.134).
import { useState } from 'react';
import { Pressable, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type ProfileTab = { label: string; count?: number | null };

type Props = { tabs: ProfileTab[]; pagerX: SharedValue<number>; onPress: (index: number) => void };

export function ProfileTabBar({ tabs, pagerX, onPress }: Props) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);
  const tabWidth = width / tabs.length;
  const inset = theme.spacing.sm;
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: pagerX.get() * tabWidth + inset }] }));
  return (
    <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tabs.map((t, i) => (
        <Pressable key={t.label} style={styles.tab} onPress={() => onPress(i)} accessibilityRole="tab">
          <TabLabel tab={t} index={i} pagerX={pagerX} />
        </Pressable>
      ))}
      {width ? <Animated.View style={[styles.indicator, { width: tabWidth - 2 * inset }, indicator]} /> : null}
    </View>
  );
}

function TabLabel({ tab, index, pagerX }: { tab: ProfileTab; index: number; pagerX: SharedValue<number> }) {
  const { theme } = useUnistyles();
  const active = theme.colors.primary;
  const inactive = theme.colors.tertiary;
  const color = useAnimatedStyle(() => {
    const progress = 1 - Math.min(Math.abs(pagerX.get() - index), 1);
    return { color: interpolateColor(progress, [0, 1], [inactive, active]) };
  });
  return (
    <>
      <Animated.Text style={[styles.label, color]} numberOfLines={1}>{tab.label}</Animated.Text>
      {tab.count != null ? <Text style={styles.badge}>{tab.count}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', borderBottomWidth: RNStyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.background },
  tab: {
    flex: 1, flexDirection: 'row', gap: theme.spacing.xxs, justifyContent: 'center', alignItems: 'center',
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.sm,
  },
  label: { ...theme.typography.large, flexShrink: 1 },
  badge: {
    ...theme.typography.body.xxs, color: theme.colors.tertiary, borderWidth: 1, borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.xxl, paddingHorizontal: theme.spacing.xxs, marginTop: 2, overflow: 'hidden',
  },
  indicator: { position: 'absolute', left: 0, bottom: 0, height: 2, backgroundColor: theme.colors.primary },
}));
