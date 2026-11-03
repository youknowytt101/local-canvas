// Cosmos' UserProfileMenus on someone else's profile (its header's 更多), the element menu's grouped look:
// 复制链接 (common.copyLink, toast 链接已复制) / 查看画布 (canvas.viewCanvas: their canvas, source 'user') — 举报
// (profile.report, alert colour: one question, then the report). Not here yet: 分享通过 (profile.shareVia; the header has
// its own share), 屏蔽 (profile.block · 他们将不再看到您的个人资料或内容, and BlockedAccountScreen).
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { api, get } from '../../lib/api';
import { authFetch } from '../../lib/auth';
import { absoluteUrl } from '../../lib/server';
import { useSessionStore } from '../../stores/useSessionStore';
import { CameraRollIcon, FlagIcon, GridIcon, LinkIcon, VerifiedProfileIcon } from '../icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { serverUrl } from '../../lib/server';
import { showToast } from '../../stores/useToastStore';
import { reportTarget } from './ReportSheet';
import { SheetGrabber } from './SheetGrabber';
import { pushInfiniteCanvas } from '../../lib/openInfiniteCanvas';

export const USER_MENU_SHEET = 'user-menu';

type State = { userId: string | null; onChanged: (() => void) | null; open: (userId: string, onChanged?: () => void) => void };
export const useUserMenuStore = create<State>((set) => ({
  userId: null,
  onChanged: null,
  open: (userId, onChanged) => {
    set({ userId, onChanged: onChanged ?? null });
    void TrueSheet.present(USER_MENU_SHEET).catch(() => undefined);
  },
}));

// not Cosmos': where an admin sets the local verified mark and its cover (cosmos-lite's /api/users/:id/verified-profile)
function VerifiedAdminRows({ userId, close }: { userId: string; close: () => Promise<unknown> }) {
  const { theme } = useUnistyles();
  const isAdmin = useSessionStore((s) => s.me?.adminRole === 'ADMIN');
  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    void get<{ verifiedProfile?: unknown }>(`/api/users/${encodeURIComponent(userId)}`).then((u) => setVerified(!!u.verifiedProfile), () => undefined);
  }, [isAdmin, userId]);
  if (!isAdmin || verified === null) return null;
  const enc = encodeURIComponent(userId);
  const changed = () => useUserMenuStore.getState().onChanged?.();
  const toggle = async () => {
    try {
      await api(verified ? 'DELETE' : 'POST', `/api/users/${enc}/verified-profile`);
      await close();
      showToast({ text: verified ? '已取消认证' : '已设为认证账户' });
      changed();
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : '操作失败' });
    }
  };
  const changeCover = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    try {
      const res = await authFetch(absoluteUrl(`/api/users/${enc}/verified-profile/cover`), { method: 'POST', headers: { 'Content-Type': a.mimeType || 'image/jpeg' }, body: await new File(a.uri).bytes() as unknown as BodyInit });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || '无法更换封面');
      await close();
      showToast({ text: '封面已更换' });
      changed();
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : '无法更换封面' });
    }
  };
  return (
    <View style={styles.group}>
      <Pressable style={styles.item} accessibilityRole="button" onPress={() => void toggle()}>
        <Text style={styles.label}>{verified ? '取消认证' : '设为认证账户'}</Text>
        <VerifiedProfileIcon size={24} />
      </Pressable>
      {verified ? (
        <>
          <View style={styles.separator} />
          <Pressable style={styles.item} accessibilityRole="button" onPress={() => void changeCover()}>
            <Text style={styles.label}>更换认证封面</Text>
            <CameraRollIcon color={theme.colors.primary} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

export function UserMenuSheet() {
  const { theme } = useUnistyles();
  const meId = useSessionStore((s) => s.me?.id);
  const insets = useSafeAreaInsets();
  const userId = useUserMenuStore((s) => s.userId);
  const close = () => TrueSheet.dismiss(USER_MENU_SHEET).catch(() => undefined);
  return (
    <TrueSheet name={USER_MENU_SHEET} detents={['auto']} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useUserMenuStore.setState({ userId: null })}>
      <SheetGrabber />
      <View style={[styles.menu, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
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
          <View style={styles.separator} />
          <Pressable style={styles.item} accessibilityRole="button" onPress={async () => { if (!userId) return; await close(); pushInfiniteCanvas({ source: 'user', userId }); }}>
            <Text style={styles.label}>查看画布</Text>
            <GridIcon color={theme.colors.primary} />
          </Pressable>
        </View>
        {userId ? <VerifiedAdminRows userId={userId} close={close} /> : null}
        {userId !== meId ? (
          <View style={styles.group}>
            <Pressable style={styles.item} accessibilityRole="button" onPress={async () => { if (!userId) return; await close(); reportTarget('user', userId); }}>
              <Text style={[styles.label, { color: theme.colors.alert }]}>举报</Text>
              <FlagIcon color={theme.colors.alert} />
            </Pressable>
          </View>
        ) : null}
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
