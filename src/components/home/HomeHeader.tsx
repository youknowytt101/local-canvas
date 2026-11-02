// Cosmos' HomeHeader (module 3464): floats over the pages (absolute, z 2), moved and faded by useHomeChrome. A row
// HEADER_CONTENT_HEIGHT (64) high on the background colour, HEADER_HORIZONTAL_PADDING (16) in: the logo button
// (HEADER_CONTROL_SIZE 40) on the left, the tabs in the middle (TopTabBar compact: 为你 / 正在关注, coloured by the
// pager's position), ActivityIconButton (the bell) on the right. Under the status bar a scrim (insets.top + 44 high,
// background at 0.25 → 0.1 → 0) fades in as the header goes.
// The user's choices kept: six dots instead of Cosmos' wordmark (6.59), no underline under the tabs (6.72).
// The logo opens the canvas (InfiniteCanvas, For You) and the bell the activity page (step 8; until then it does nothing).
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BellIcon, SixDotsIcon } from '../icons';

export const HEADER_CONTENT_HEIGHT = 64;
const HEADER_CONTROL_SIZE = 40;
const HEADER_HORIZONTAL_PADDING = 16;

const TABS = ['为你', '正在关注'];

type Props = {
  pagerX: SharedValue<number>;
  onTabPress: (index: number) => void;
  headerStyle: object;
  scrimStyle: object;
  onHeight: (height: number) => void;
  onLogoPress?: () => void;
  onActivityPress?: () => void;
};

const alpha = (hex: string, a: number) => `${hex.slice(0, 7)}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

export function HomeHeader({ pagerX, onTabPress, headerStyle, scrimStyle, onHeight, onLogoPress, onActivityPress }: Props) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  return (
    <>
      <Animated.View style={[styles.topScrim, { height: insets.top + 44 }, scrimStyle]} pointerEvents="none">
        <LinearGradient
          colors={[alpha(theme.colors.background, 0.25), alpha(theme.colors.background, 0.1), alpha(theme.colors.background, 0)]}
          locations={[0, 0.5, 1]}
          style={styles.scrimFill}
        />
      </Animated.View>
      <Animated.View style={[styles.floatingHeader, headerStyle]} onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
        <View style={[styles.headerContent, { paddingTop: insets.top }]}>
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Pressable style={styles.logoButton} onPress={onLogoPress} accessibilityRole="button" accessibilityLabel="打开画布">
                <SixDotsIcon color={theme.colors.primary} />
              </Pressable>
            </View>
            <View style={styles.tabContainer}>
              {TABS.map((label, i) => <HeaderTab key={label} label={label} index={i} pagerX={pagerX} onPress={() => onTabPress(i)} />)}
            </View>
            <View style={styles.iconContainerEnd}>
              <Pressable style={styles.logoButton} onPress={onActivityPress} accessibilityRole="button" accessibilityLabel="活动">
                <BellIcon color={theme.colors.primary} />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

function HeaderTab({ label, index, pagerX, onPress }: { label: string; index: number; pagerX: SharedValue<number>; onPress: () => void }) {
  const { theme } = useUnistyles();
  const primary = theme.colors.primary;
  const tertiary = theme.colors.tertiary;
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(pagerX.get(), [index - 1, index, index + 1], [tertiary, primary, tertiary]),
  }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" style={styles.tab}>
      <Animated.Text style={[styles.tabText, color]} numberOfLines={1}>{label}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  scrimFill: { flex: 1 },
  headerContent: { backgroundColor: theme.colors.background },
  row: { height: HEADER_CONTENT_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: HEADER_HORIZONTAL_PADDING },
  iconContainer: { width: HEADER_CONTROL_SIZE, flexShrink: 0, alignItems: 'flex-start' },
  tabContainer: { flex: 1, minWidth: 0, overflow: 'hidden', flexDirection: 'row', justifyContent: 'center' },
  logoButton: { width: HEADER_CONTROL_SIZE, height: HEADER_CONTROL_SIZE, alignItems: 'center', justifyContent: 'center' },
  iconContainerEnd: { width: HEADER_CONTROL_SIZE, flexShrink: 0, alignItems: 'flex-end' },
  tab: { paddingTop: 10, paddingBottom: 9, paddingHorizontal: 12 },
  tabText: { ...theme.typography.largePlus },
}));
