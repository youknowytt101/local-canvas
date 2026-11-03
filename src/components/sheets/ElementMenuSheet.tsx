// Cosmos' ElementMenuSheet (module 2108's 更多): groups of rows on sheetElevated (borderRadius.md, spacing.md in), each
// row its label on the left and its icon on the right (spacing.md high padding), hairline separators between rows; the
// groups spacing.sm apart, spacing.sm round them (SheetMenuSeparator's styles). Texts from Cosmos' Chinese pack.
//   - 复制链接 (useCopyElementShareLink): the element's address on the computer, toast 链接已复制, an ElementLinkCopied event
//   - 分享通过 (useOpenElementShare): the system's share with that address (Cosmos opens its own share screen)
//   - 不感兴趣 (useDislikeElement): POST /api/elements/dislike, toast 收到反馈
//   - 查看画布 (canvas.viewCanvas, GridIcon) closing the first group: the canvas seeded with this element
//     (createCanvasEntryHandoff + pushInfiniteCanvasOntoActiveStack, source 'element')
// Not yet: 保存到相机胶卷 (needs a media-library module in the native build), 添加来源 / 编辑来源,
// 删除 (All Elements is not here yet).
//   - 举报 (profile.report, Flag): the report sheet (ReportSheet), before 移除
//   - 移除 (useElementViewerRemoveAction), last and in the alert colour, for something one has (isConnectedByUser) opened
//     from one's profile or a collection one may change: asked first (profile / cluster.removeElementsDescription,
//     the web page's words), then taken out of it (POST /api/elements/connections disconnect), toast
//     已从个人资料移除 / 已从收藏夹移除, and the viewer goes back. Near Cosmos: the question is the system's alert.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import * as Clipboard from 'expo-clipboard';
import { Fragment, type ReactNode } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { recordElementEvent } from '../../hooks/useTrackElementView';
import { api, get } from '../../lib/api';
import type { Element } from '../../lib/elements';
import type { RemoveTarget } from '../../stores/useElementViewerStore';
import { useReportStore } from './ReportSheet';
import { serverUrl } from '../../lib/server';
import { showToast } from '../../stores/useToastStore';
import { EyeOffIcon, FlagIcon, GridIcon, LinkIcon, ShareIcon, TrashIcon } from '../icons';
import { SheetGrabber } from './SheetGrabber';
import { pushInfiniteCanvas } from '../../lib/openInfiniteCanvas';

export const ELEMENT_MENU_SHEET = 'element-menu';

type RemoveAction = { target: RemoveTarget; onDone: () => void };
type MenuState = { element: Element | null; source: string; remove: RemoveAction | null; open: (element: Element, source: string, remove?: RemoveAction | null) => void };
export const useElementMenuStore = create<MenuState>((set) => ({
  element: null,
  source: 'Unspecified',
  remove: null,
  open: (element, source, remove) => {
    set({ element, source, remove: remove ?? null });
    void TrueSheet.present(ELEMENT_MENU_SHEET).catch(() => undefined);
  },
}));

const elementLink = (el: Element) => `${serverUrl()}/e/${el.id}`;

type Item = { label: string; icon: ReactNode; onPress: () => void | Promise<void>; danger?: boolean };

export function ElementMenuSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const element = useElementMenuStore((s) => s.element);
  const source = useElementMenuStore((s) => s.source);
  const remove = useElementMenuStore((s) => s.remove);
  const close = () => TrueSheet.dismiss(ELEMENT_MENU_SHEET).catch(() => undefined);
  const color = theme.colors.primary;

  const groups: Item[][] = element ? [
    [
      {
        label: '复制链接', icon: <LinkIcon color={color} />,
        onPress: async () => {
          await Clipboard.setStringAsync(elementLink(element));
          recordElementEvent(element.id, { eventType: 'ElementLinkCopied', userInteractionSource: source, slateId: element.slateId ?? null });
          await close();
          showToast({ text: '链接已复制' });
        },
      },
      { label: '分享通过', icon: <ShareIcon color={color} />, onPress: async () => { await close(); void Share.share({ message: elementLink(element) }); } },
      { label: '查看画布', icon: <GridIcon color={color} />, onPress: async () => { await close(); pushInfiniteCanvas({ source: 'element', element }); } },
    ],
    [
      {
        label: '不感兴趣', icon: <EyeOffIcon color={color} />,
        onPress: async () => {
          await api('POST', '/api/elements/dislike', { elementIds: [element.id], userInteractionSource: source }).catch(() => undefined);
          await close();
          showToast({ text: '收到反馈' });
        },
      },
    ],
    [{ label: '举报', icon: <FlagIcon color={color} />, onPress: async () => { await close(); useReportStore.getState().open(element.id); } }],
    ...(remove && element.isConnectedByUser ? [[{
      label: '移除', icon: <TrashIcon color={theme.colors.alert} />, danger: true,
      onPress: async () => {
        await close();
        const fromProfile = remove.target.kind === 'profile';
        Alert.alert('', fromProfile ? '这将从您的个人资料移除 1 个元素。' : '这将从该收藏夹移除 1 个元素。', [
          { text: '取消', style: 'cancel' },
          {
            text: '移除', style: 'destructive',
            onPress: () => void (async () => {
              try {
                const clusterId = remove.target.kind === 'cluster' ? remove.target.clusterId : (await get<{ id: string }>('/api/profile/cluster')).id;
                await api('POST', '/api/elements/connections', { elementIds: [element.id], disconnect: [clusterId] });
                remove.onDone();
                showToast({ text: fromProfile ? '已从个人资料移除' : '已从收藏夹移除' });
              } catch (e) {
                showToast({ text: e instanceof Error ? e.message : '无法移除' });
              }
            })(),
          },
        ]);
      },
    }]] : []),
  ] : [];

  return (
    <TrueSheet name={ELEMENT_MENU_SHEET} detents={['auto']} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useElementMenuStore.setState({ element: null })}>
      <SheetGrabber />
      <View style={[styles.menu, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
        {groups.map((group, g) => (
          <View key={g} style={styles.group}>
            {group.map((item, i) => (
              <Fragment key={item.label}>
                {i > 0 ? <View style={styles.separator} /> : null}
                <Pressable style={styles.item} onPress={() => void item.onPress()} accessibilityRole="button">
                  <Text style={[styles.label, item.danger && { color: theme.colors.alert }]}>{item.label}</Text>
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
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.surfaceBorder },
}));
