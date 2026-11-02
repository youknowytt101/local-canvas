// Cosmos' MoreMenu on a collection (useMoreMenuModel / MoreMenuGroups; read for the web page, cosmos-lite HANDOFF 6.123),
// opened from the collection's header. The element menu's grouped look (sheetElevated groups, label left, icon right,
// hairlines between rows, spacing.sm between groups). Its groups, by getClusterAccess:
//   - everyone: 复制链接 (common.copyLink, toast 链接已复制) / 分享收藏 (cluster.shareCluster: the system's share)
//   - a collaborator: 离开收藏 (alert colour; asked first; POST /leave, toast 已离开收藏夹, back)
//   - the owner: 固定收藏 · 取消固定收藏 (the top level only: /api/profile/pin | unpin, toast 已固定到个人资料 /
//     已从个人资料取消固定) / 编辑收藏 (the create sheet in its edit mode) / 邀请协作者 (the invite link sheet) / on a sub-collection 从“父”中移除 (asked first; PATCH parentId null, toast 已移出“父”)
//   - someone else's: 举报 (alert colour; one question, then the report)
//   - then the owner's 删除收藏 (alert colour; asked first, the elements stay; DELETE, back)
// The questions use the web page's words, asked with the system's alert as Cosmos does. Not here yet: 查看画布 (step 7);
// 整理 is on the bar (OrganizeClusterScreen).
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import * as Clipboard from 'expo-clipboard';
import { Fragment, type ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api } from '../../lib/api';
import { serverUrl } from '../../lib/server';
import { showToast } from '../../stores/useToastStore';
import type { ClusterDetail } from '../clusters/UserClusterHeader';
import { ShareIcon } from '../icons';
import { useCollaboratorsStore } from './CollaboratorsSheet';
import { useCreateClusterStore } from './CreateClusterSheet';
import { reportTarget } from './ReportSheet';
import { FlagIcon } from './UserMenuSheet';

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
    ]);
    if (c.role === 'Collaborator') {
      groups.push([{
        label: '离开收藏', icon: <LeaveIcon color={alert} />, danger: true,
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
        label: '编辑收藏', icon: <PencilIcon color={color} />,
        onPress: async () => { await close(); useCreateClusterStore.getState().edit(c, () => handlers?.onChanged()); },
      });
      owner.push({
        label: '邀请协作者', icon: <AddUserIcon color={color} />,
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
    <TrueSheet name={CLUSTER_MENU_SHEET} detents={['auto']} cornerRadius={24} grabber backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useClusterMenuStore.setState({ cluster: null, parent: null, handlers: null })}>
      <View style={[styles.menu, { paddingBottom: insets.bottom + theme.spacing.sm, paddingTop: theme.spacing.xl }]}>
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

// lucide's icons (Cosmos' LinkIcon / SignOutIcon / PencilIcon / AddUserIcon / GridIcon / TrashIcon), 24 with a 1.75
// line; PinIcon is Cosmos' filled pin
const iconLine = (color: string) => ({ stroke: color, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }) as const;
const Icon = ({ color, d }: { color: string; d: string[] }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24">{d.map((p) => <Path key={p} {...iconLine(color)} d={p} />)}</Svg>
);
const LinkIcon = ({ color }: { color: string }) => <Icon color={color} d={['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']} />;
const LeaveIcon = ({ color }: { color: string }) => <Icon color={color} d={['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9']} />;
const PencilIcon = ({ color }: { color: string }) => <Icon color={color} d={['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']} />;
const AddUserIcon = ({ color }: { color: string }) => <Icon color={color} d={['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M19 8v6M22 11h-6']} />;
const GridIcon = ({ color }: { color: string }) => <Icon color={color} d={['M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z']} />;
const TrashIcon = ({ color }: { color: string }) => <Icon color={color} d={['M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6']} />;
function PinIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path fill={color} d="M6.31 13.98C6.31 12.43 7.55 10.80 9.60 10.05L9.85 6.69C8.78 6.08 7.90 5.39 7.52 4.90C7.33 4.65 7.24 4.40 7.24 4.18C7.24 3.74 7.58 3.41 8.10 3.41H15.90C16.42 3.41 16.76 3.74 16.76 4.18C16.76 4.40 16.67 4.65 16.48 4.90C16.09 5.39 15.22 6.08 14.15 6.69L14.39 10.05C16.45 10.80 17.68 12.43 17.68 13.98C17.68 14.60 17.27 15.01 16.61 15.01H12.64V18.43C12.64 19.55 12.18 20.48 12 20.48C11.82 20.48 11.35 19.55 11.35 18.43V15.01H7.39C6.73 15.01 6.31 14.60 6.31 13.98Z" />
    </Svg>
  );
}

const styles = StyleSheet.create((theme) => ({
  menu: { gap: theme.spacing.sm, backgroundColor: theme.colors.sheetBackground, paddingHorizontal: theme.spacing.sm },
  group: { backgroundColor: theme.colors.sheetElevated, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.md },
  label: { ...theme.typography.large, color: theme.colors.primary },
  separator: { height: RNStyleSheet.hairlineWidth, backgroundColor: theme.colors.surfaceBorder },
}));
