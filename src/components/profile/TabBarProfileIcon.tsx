// Cosmos' TabBarProfileIcon (module 3182): the user's picture (Avatar extraSmall, 24) in a ring 2 wide and 2 away from
// it, fully round, in the tab's colour when focused and clear otherwise; with no picture, UserRound 16 (tertiary,
// 2.3 wide) on pillElevated.
import { Image } from 'expo-image';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { absoluteUrl } from '../../lib/server';
import { useSessionStore } from '../../stores/useSessionStore';
import { UserRound } from '../icons';

export function TabBarProfileIcon({ color, focused }: { color: string; focused: boolean }) {
  const { theme } = useUnistyles();
  const avatarUrl = useSessionStore((s) => s.me?.avatarUrl ?? null);
  return (
    <View style={[styles.ring, { borderColor: focused ? color : 'transparent' }]}>
      {avatarUrl ? (
        <Image source={{ uri: absoluteUrl(avatarUrl) }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.empty]}>
          <UserRound color={theme.colors.tertiary} size={16} strokeWidth={2.3} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  ring: { padding: 2, borderWidth: 2, borderRadius: theme.borderRadius.full },
  avatar: { width: 24, height: 24, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.elevated, overflow: 'hidden' },
  empty: { backgroundColor: theme.colors.pillElevated, alignItems: 'center', justifyContent: 'center' },
}));
