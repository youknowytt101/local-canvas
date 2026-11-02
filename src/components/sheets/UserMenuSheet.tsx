// Cosmos' UserProfileMenus on someone else's profile (its header's 更多), the element menu's grouped look:
// 复制链接 (common.copyLink, toast 链接已复制) — 举报 (profile.report, alert colour: one question, then the report).
// Not here yet: 查看画布 (step 7), 屏蔽 (profile.block · 他们将不再看到您的个人资料或内容, and BlockedAccountScreen).
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { serverUrl } from '../../lib/server';
import { showToast } from '../../stores/useToastStore';
import { reportTarget } from './ReportSheet';

export const USER_MENU_SHEET = 'user-menu';

type State = { userId: string | null; open: (userId: string) => void };
export const useUserMenuStore = create<State>((set) => ({
  userId: null,
  open: (userId) => {
    set({ userId });
    void TrueSheet.present(USER_MENU_SHEET).catch(() => undefined);
  },
}));

const line = (color: string) => ({ stroke: color, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }) as const;
export function FlagIcon({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path {...line(color)} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
    </Svg>
  );
}
function LinkIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path {...line(color)} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path {...line(color)} d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  );
}

export function UserMenuSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const userId = useUserMenuStore((s) => s.userId);
  const close = () => TrueSheet.dismiss(USER_MENU_SHEET).catch(() => undefined);
  return (
    <TrueSheet name={USER_MENU_SHEET} detents={['auto']} cornerRadius={24} grabber backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useUserMenuStore.setState({ userId: null })}>
      <View style={[styles.menu, { paddingBottom: insets.bottom + theme.spacing.sm, paddingTop: theme.spacing.xl }]}>
        <View style={styles.group}>
          <Pressable
            style={styles.item}
            accessibilityRole="button"
            onPress={async () => {
              if (!userId) return;
              await Clipboard.setStringAsync(`${serverUrl()}/profile/${encodeURIComponent(userId)}`);
              await close();
              showToast({ text: '链接已复制' });
            }}
          >
            <Text style={styles.label}>复制链接</Text>
            <LinkIcon color={theme.colors.primary} />
          </Pressable>
        </View>
        <View style={styles.group}>
          <Pressable style={styles.item} accessibilityRole="button" onPress={async () => { if (!userId) return; await close(); reportTarget('user', userId); }}>
            <Text style={[styles.label, { color: theme.colors.alert }]}>举报</Text>
            <FlagIcon color={theme.colors.alert} />
          </Pressable>
        </View>
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  menu: { gap: theme.spacing.sm, backgroundColor: theme.colors.sheetBackground, paddingHorizontal: theme.spacing.sm },
  group: { backgroundColor: theme.colors.sheetElevated, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.md },
  label: { ...theme.typography.large, color: theme.colors.primary },
  separator: { height: RNStyleSheet.hairlineWidth, backgroundColor: theme.colors.surfaceBorder },
}));
