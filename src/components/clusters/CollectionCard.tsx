// Cosmos' ProfileClusterCard / CollectionCard (cosmos-lite's .ccard): the covers as a square mosaic (one whole, two side
// by side, three with the first tall, four in a grid; no gaps) with a borderRadius.xl corner on elevated, spacing.xs
// under it the name (largePlus) and the count (regular, tertiary): "N 元素", " · N 个子收藏夹", a collaborator's
// " · <owner> 的"; one pinned to the profile has PinIcon 16 (tertiary) before the count, spacing.xxs from it.
// Pressed it scales as PressScaleContainer does on a long press only (0.975 in 70 ms, back with a 220 ms spring).
import * as Haptics from 'expo-haptics';
import { triggerImpactFeedback } from '../../lib/appearance';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { PinIcon } from '../icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { absoluteUrl } from '../../lib/server';

export type Collection = {
  id: string; name: string; count: number; covers?: string[]; isPrivate?: boolean; parentId?: string | null; subClusterIds?: string[];
  isPinnedToUserProfile?: boolean; pinnedAt?: string | null; role?: string; owner?: string; ownerId?: string; description?: string;
};

export function collectionMeta(c: Collection) {
  return `${c.count} 元素${c.subClusterIds?.length ? ` · ${c.subClusterIds.length} 个子收藏夹` : ''}${c.role === 'Collaborator' ? ` · ${c.owner} 的` : ''}`;
}

export function CollectionCard({ collection: c, width, onPress, onLongPress }: { collection: Collection; width: number; onPress?: () => void; onLongPress?: () => void }) {
  const { theme } = useUnistyles();
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const covers = (c.covers ?? []).slice(0, 4).map((u) => absoluteUrl(u));
  const half = width / 2;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        triggerImpactFeedback(Haptics.ImpactFeedbackStyle.Light);
        scale.set(withSequence(withTiming(0.975, { duration: 70 }), withSpring(1, { duration: 220, dampingRatio: 0.8 })));
        onLongPress?.();
      }}
      delayLongPress={280}
      accessibilityRole="button"
      accessibilityLabel={c.name}
    >
      <Animated.View style={[{ width }, pressed]}>
        <View style={[styles.cover, { width, height: width }]}>
          {covers.length === 1 ? <Image source={{ uri: covers[0] }} style={{ width, height: width }} contentFit="cover" /> : null}
          {covers.length === 2 ? covers.map((u) => <Image key={u} source={{ uri: u }} style={{ width: half, height: width }} contentFit="cover" />) : null}
          {covers.length === 3 ? (
            <>
              <Image source={{ uri: covers[0] }} style={{ width: half, height: width }} contentFit="cover" />
              <View>{covers.slice(1).map((u) => <Image key={u} source={{ uri: u }} style={{ width: half, height: half }} contentFit="cover" />)}</View>
            </>
          ) : null}
          {covers.length === 4 ? covers.map((u) => <Image key={u} source={{ uri: u }} style={{ width: half, height: half }} contentFit="cover" />) : null}
        </View>
        <Text style={styles.name} numberOfLines={1}>{c.isPrivate ? '🔒 ' : ''}{c.name}</Text>
        <View style={styles.metaRow}>
          {c.isPinnedToUserProfile ? <PinIcon color={theme.colors.tertiary} size={16} /> : null}
          <Text style={styles.meta} numberOfLines={1}>{collectionMeta(c)}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  cover: { borderRadius: theme.borderRadius.xl, overflow: 'hidden', backgroundColor: theme.colors.elevated, flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.xs },
  name: { ...theme.typography.largePlus, color: theme.colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs, marginTop: 2 },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary, flexShrink: 1 },
}));
