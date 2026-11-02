// Cosmos' CollaborativeClusterUsersSheet / InviteCollaboratorSheet (who works on a collection, from the avatars under
// its title) and CollaboratorInviteLinkSheet (邀请合作者, from the avatars' add circle or the menu's 邀请协作者).
//   - the people: the owner first, then who works on it (UserActivity rows: the 40 avatar, @username, and
//     "所有者 · N 元素" / "合作者 · N 元素": cluster.owner / collaborator, common.elements), spacing.sm apart; a row opens
//     that person's profile. The owner sees 移除 on the others' rows, asked first (cluster.removeCollaborator 删除协作者 ·
//     removeCollaboratorDescription "{{username}} 将无法访问该集合", ActionConfirmationSheet: here the system's alert),
//     then DELETE /api/clusters/:id/collaborators/:userId; and 邀请合作者 over the list
//   - the invite link: 邀请合作者 (headingMedium), 分享邀请链接以协作 (regular, tertiary), 复制邀请链接 (primary, large):
//     POST /api/clusters/:id/invite-link to the clipboard, toast 链接已复制
// Near Cosmos: no 关注 on the rows (the list does not say whom one follows); the invite sheet's picture and the search
// for people to invite (CreateClusterCollaboratorsSheet) are not here; the layout spacing is local.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api, get } from '../../lib/api';
import { serverUrl } from '../../lib/server';
import { showToast } from '../../stores/useToastStore';
import { Button } from '../Button';
import { Avatar } from '../profile/ProfileInfo';

export const COLLABORATORS_SHEET = 'collaborators';
export const INVITE_LINK_SHEET = 'collaborator-invite-link';

type Person = { userId: string; username: string; isOwner: boolean; numberOfElements: number };
type Handlers = { onOpenPerson: (userId: string) => void; onChanged: () => void };
type State = {
  clusterId: string | null; canManage: boolean; handlers: Handlers | null; inviteClusterId: string | null;
  open: (clusterId: string, canManage: boolean, handlers: Handlers) => void;
  openInvite: (clusterId: string) => void;
};
export const useCollaboratorsStore = create<State>((set) => ({
  clusterId: null,
  canManage: false,
  handlers: null,
  inviteClusterId: null,
  open: (clusterId, canManage, handlers) => {
    set({ clusterId, canManage, handlers });
    void TrueSheet.present(COLLABORATORS_SHEET).catch(() => undefined);
  },
  openInvite: (clusterId) => {
    set({ inviteClusterId: clusterId });
    void TrueSheet.present(INVITE_LINK_SHEET).catch(() => undefined);
  },
}));

export function CollaboratorsSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const clusterId = useCollaboratorsStore((s) => s.clusterId);
  const canManage = useCollaboratorsStore((s) => s.canManage);
  const handlers = useCollaboratorsStore((s) => s.handlers);
  const [people, setPeople] = useState<Person[] | null>(null);
  const path = clusterId ? `/api/clusters/${encodeURIComponent(clusterId)}` : '';

  const load = () => {
    if (!clusterId) return;
    get<{ items: Person[] }>(`${path}/collaborators`).then((r) => setPeople(r.items), () => setPeople([]));
  };
  useEffect(() => { setPeople(null); load(); }, [clusterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (p: Person) => Alert.alert('删除协作者', `${p.username} 将无法访问该集合`, [
    { text: '取消', style: 'cancel' },
    {
      text: '确认', style: 'destructive',
      onPress: () => void api('DELETE', `${path}/collaborators/${encodeURIComponent(p.userId)}`).then(() => {
        setPeople((list) => list?.filter((x) => x.userId !== p.userId) ?? null);
        handlers?.onChanged();
      }, (e) => showToast({ text: e instanceof Error && e.message ? e.message : '无法移除' })),
    },
  ]);

  return (
    <TrueSheet
      name={COLLABORATORS_SHEET}
      detents={['auto', 1] as never}
      cornerRadius={24}
      grabber
      backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useCollaboratorsStore.setState({ clusterId: null, handlers: null })}
    >
      <ScrollView nestedScrollEnabled contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        {canManage && clusterId ? (
          <Button text="邀请合作者" variant="outline" fullWidth onPress={() => useCollaboratorsStore.getState().openInvite(clusterId)} style={styles.invite} />
        ) : null}
        {people == null ? <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} /> : people.map((p) => (
          <View key={p.userId} style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => { void TrueSheet.dismiss(COLLABORATORS_SHEET); handlers?.onOpenPerson(p.userId); }} accessibilityRole="button">
              <Avatar user={{ username: p.username }} size={40} />
              <View style={styles.text}>
                <Text style={styles.title} numberOfLines={1}>@{p.username}</Text>
                <Text style={styles.meta} numberOfLines={1}>{p.isOwner ? '所有者' : '合作者'} · {p.numberOfElements} 元素</Text>
              </View>
            </Pressable>
            {canManage && !p.isOwner ? <Button text="移除" variant="outline" size="small" onPress={() => remove(p)} /> : null}
          </View>
        ))}
      </ScrollView>
    </TrueSheet>
  );
}

export function InviteLinkSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const clusterId = useCollaboratorsStore((s) => s.inviteClusterId);
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    if (!clusterId || busy) return;
    setBusy(true);
    try {
      const r = await api<{ link: string }>('POST', `/api/clusters/${encodeURIComponent(clusterId)}/invite-link`);
      await Clipboard.setStringAsync(r.link.startsWith('http') ? r.link : `${serverUrl()}${r.link}`);
      await TrueSheet.dismiss(INVITE_LINK_SHEET).catch(() => undefined);
      showToast({ text: '链接已复制' });
    } catch (e) {
      showToast({ text: e instanceof Error && e.message ? e.message : '复制链接失败' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <TrueSheet name={INVITE_LINK_SHEET} detents={['auto']} cornerRadius={24} grabber backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => useCollaboratorsStore.setState({ inviteClusterId: null })}>
      <View style={[styles.inviteContainer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Text style={styles.inviteTitle}>邀请合作者</Text>
        <Text style={styles.inviteText}>分享邀请链接以协作</Text>
        <Button text="复制邀请链接" size="large" fullWidth loading={busy} onPress={copy} style={styles.copy} />
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg },
  invite: { marginBottom: theme.spacing.md },
  loading: { marginTop: theme.spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  text: { flex: 1, minWidth: 0 },
  title: { ...theme.typography.largePlus, color: theme.colors.primary },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary },
  inviteContainer: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.xs },
  inviteTitle: { ...theme.typography.headingMedium, color: theme.colors.primary, textAlign: 'center' },
  inviteText: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center' },
  copy: { marginTop: theme.spacing.lg },
}));
