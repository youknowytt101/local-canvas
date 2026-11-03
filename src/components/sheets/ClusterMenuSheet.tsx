// Cosmos' MoreMenu on a collection (useMoreMenuModel / MoreMenuGroups; read for the web page, cosmos-lite HANDOFF 6.123),
// opened from the collection's header. The element menu's grouped look (sheetElevated groups, label left, icon right,
// hairlines between rows, spacing.sm between groups). Its groups, by getClusterAccess:
//   - everyone: 复制链接 (common.copyLink, toast 链接已复制) / 分享收藏 (cluster.shareCluster: the system's share)
//   - a collaborator: 离开收藏 (alert colour; asked first; POST /leave, toast 已离开收藏夹, back)
//   - the owner: 固定收藏 · 取消固定收藏 (the top level only: /api/profile/pin | unpin, toast 已固定到个人资料 /
//     已从个人资料取消固定) / 编辑收藏 (the create sheet in its edit mode) / 邀请协作者 (the invite link sheet) / on a sub-collection 从“父”中移除 (asked first; PATCH parentId null, toast 已移出“父”)
//   - someone else's: 举报 (alert colour; one question, then the report)
//   - then the owner's 删除收藏 (alert colour; asked first, the elements stay; DELETE, back)
//   - 查看画布 (canvas.viewCanvas, GridIcon) after 分享收藏: the collection's canvas (buildClusterCanvasUrl → InfiniteCanvas,
//     source 'cluster')
// The questions use the web page's words, asked with the system's alert as Cosmos does. 整理 is on the bar
// (OrganizeClusterScreen).
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { CommonActions } from '@react-navigation/native';
import { navigationRef } from '../../navigation/navigationRef';
import { Routes } from '../../navigation/routes';
import { pushInfiniteCanvas } from '../../lib/openInfiniteCanvas';
import * as Clipboard from 'expo-clipboard';
import { Fragment, type ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api } from '../../lib/api';
import { serverUrl } from '../../lib/server';
import { showToast } from '../../stores/useToastStore';
import type { ClusterDetail } from '../clusters/UserClusterHeader';
import { EditIcon, FlagIcon, GridIcon, LinkIcon, PinIcon, ShareIcon, SignOutIcon, TrashIcon, UserPlusIcon } from '../icons';
import { useCollaboratorsStore } from './CollaboratorsSheet';
import { reportTarget } from './ReportSheet';
import { SheetGrabber } from './SheetGrabber';

export const CLUSTER_MENU_SHEET = 'cluster-menu';

type Handlers = { onChanged: () => void; onGone: () => void };
type MenuState = {
  cluster: ClusterDetail | null; parent: { id: string; name: string } | null; handlers: Handlers | null;
  open: (cluster: ClusterDetail, parent: { id: string; name: string } | null, handlers: Handlers) => void;
};
export const useClusterMenuStore = create<MenuState>((set) => ({
  cluster: null,
  parent: null,
  handlers: null,
  open: (cluster, parent, handlers) => {
    set({ cluster, parent, handlers });
    void TrueSheet.present(CLUSTER_MENU_SHEET).catch(() => undefined);
  },
}));

type Item = { label: string; icon: ReactNode; onPress: () => void | Promise<void>; danger?: boolean };
const close = () => TrueSheet.dismiss(CLUSTER_MENU_SHEET).catch(() => undefined);
const ask = (text: string, ok: string, run: () => Promise<void>) =>
  Alert.alert('', text, [{ text: '取消', style: 'cancel' }, { text: ok, style: 'destructive', onPress: () => void run() }]);

export function ClusterMenuSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const c = useClusterMenuStore((s) => s.cluster);
  const parent = useClusterMenuStore((s) => s.parent);
  const handlers = useClusterMenuStore((s) => s.handlers);
  const color = theme.colors.primary;
  const alert = theme.colors.alert;
  const link = c ? `${serverUrl()}/collections/${encodeURIComponent(c.id)}` : '';
  const path = c ? `/api/clusters/${encodeURIComponent(c.id)}` : '';
  const fail = (e: unknown, text: string) => showToast({ text: e instanceof Error && e.message ? e.message : text });

  const groups: Item[][] = [];
  if (c) {
    groups.push([
      { label: '复制链接', icon: <LinkIcon color={color} />, onPress: async () => { await Clipboard.setStringAsync(link); await close(); showToast({ text: '链接已复制' }); } },
      { label: '分享收藏', icon: <ShareIcon color={color} />, onPress: async () => { await close(); void Share.share({ message: link, title: c.name }); } },
      { label: '查看画布', icon: <GridIcon color={color} />, onPress: async () => { await close(); pushInfiniteCanvas({ source: 'cluster', clusterId: c.id, clusterName: c.name }); } },
    ]);
    if (c.role === 'Collaborator') {
      groups.push([{
        label: '离开收藏', icon: <SignOutIcon color={alert} />, danger: true,
        onPress: async () => {
          await close();
          ask(`离开“${c.name}”？您将无法再就该收藏夹进行协作。`, '离开', async () => {
            try { await api('POST', `${path}/leave`); showToast({ text: '已离开收藏夹' }); handlers?.onGone(); } catch (e) { fail(e, '无法离开收藏夹'); }
          });
        },
      }]);
    }
    if (!c.role) {
      groups.push([{ label: '举报', icon: <FlagIcon color={alert} />, danger: true, onPress: async () => { await close(); reportTarget('cluster', c.id); } }]);
    }
    if (c.role === 'Owner') {
      const owner: Item[] = [];
      if (!parent) {
        const pinned = !!c.isPinnedToUserProfile;
        owner.push({
          label: pinned ? '取消固定收藏' : '固定收藏', icon: <PinIcon color={color} />,
          onPress: async () => {
            await close();
            try {
              await api('POST', pinned ? '/api/profile/unpin' : '/api/profile/pin', { clusterId: c.id });
              showToast({ text: pinned ? '已从个人资料取消固定' : '已固定到个人资料' });
              handlers?.onChanged();
            } catch (e) { fail(e, '无法更新固定的收藏'); }
          },
        });
      }
      owner.push({
        label: '编辑收藏', icon: <EditIcon color={color} />,
        onPress: async () => { await close(); navigationRef.dispatch(CommonActions.navigate({ name: Routes.MAIN, params: { screen: Routes.EDIT_CLUSTER, params: { clusterId: c.id } } })); },
      });
      owner.push({
        label: '邀请协作者', icon: <UserPlusIcon color={color} />,
        onPress: async () => { await close(); useCollaboratorsStore.getState().openInvite(c.id); },
      });
      if (parent) {
        owner.push({
          label: `从“${parent.name}”中移除`, icon: <GridIcon color={color} />,
          onPress: async () => {
            await close();
            ask(`从“${parent.name}”中移除“${c.name}”？它会变成一个单独的收藏夹。`, '移除', async () => {
              try { await api('PATCH', path, { parentId: null }); showToast({ text: `已移出“${parent.name}”` }); handlers?.onChanged(); } catch (e) { fail(e, '无法移除'); }
            });
          },
        });
      }
      groups.push(owner);
      groups.push([{
        label: '删除收藏', icon: <TrashIcon color={alert} />, danger: true,
        onPress: async () => {
          await close();
          const subs = c.subClusterIds?.length ?? 0;
          ask(`删除收藏“${c.name}”？里面的元素不会被删除${subs ? `，${subs} 个子收藏夹会移到上一层` : ''}。`, '删除', async () => {
            try { await api('DELETE', path); showToast({ text: '收藏已删除' }); handlers?.onGone(); } catch (e) { fail(e, '无法删除收藏'); }
          });
        },
      }]);
    }
  }

  return (
    <TrueSheet name={CLUSTER_MENU_SHEET} detents={['auto']} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useClusterMenuStore.setState({ cluster: null, parent: null, handlers: null })}>
      <SheetGrabber />
      <View style={[styles.menu, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
        {groups.map((group, g) => (
          <View key={g} style={styles.group}>
            {group.map((item, i) => (
              <Fragment key={item.label}>
                {i > 0 ? <View style={styles.separator} /> : null}
                <Pressable style={styles.item} onPress={() => void item.onPress()} accessibilityRole="button">
                  <Text style={[styles.label, item.danger && { color: alert }]}>{item.label}</Text>
                  {item.icon}
                </Pressable>
              </Fragment>
            ))}
          </View>
        ))}
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
