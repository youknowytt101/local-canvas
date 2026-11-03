// Cosmos' AcceptInviteScreen (routes.AcceptInvite, over the tabs) with useAcceptInvite, from an activity row or the link
// localcanvas://accept-collaboration?inviteCode=…:
//   - the invite still good: the inviter's avatar, "{username} 邀请您加入 {collection}" (headingMedium) and 共同合作制作这个系列
//     (regular, tertiary), the cover (0.5 border, rounded), "{n} 个元素", 接受 (primary, large) and 拒绝 (regularPlus, tertiary)
//   - accepted: 已接受邀请 and the collection opens in the home tab; declined: back to the home tab
//   - no longer good: FullScreenEmptyState (此邀请不再有效 / 它可能已过期、被撤销或已被使用。 / a button home); already in it: the collection
// Near Cosmos: the layout's exact sizes (its styles are read, the arrangement by reading the tree); no follower count (the
// server's invite does not carry it); 回到首页 (the pack's 回家吧 is a machine's Go home).
import { CommonActions, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { ChevronLeftIcon } from '../../components/icons';
import { Avatar } from '../../components/profile/ProfileInfo';
import { api, get } from '../../lib/api';
import { buildUserClusterRouteParams } from '../../lib/clusters/buildSubClusterRouteParams';
import { absoluteUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { showToast } from '../../stores/useToastStore';

export type AcceptInviteParams = { inviteCode: string };
type Invite = {
  valid: boolean; alreadyCollaborator?: boolean; clusterId: string;
  inviter: { username: string };
  cluster: { id: string; name: string; covers?: string[]; numberOfElements?: number };
};

export function AcceptInviteScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { inviteCode } = useRoute<RouteProp<{ c: AcceptInviteParams }, 'c'>>().params;
  const code = encodeURIComponent(inviteCode);
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const goHome = (clusterId?: string) => navigation.dispatch(CommonActions.navigate({
    name: Routes.MAIN_TABS,
    params: { pop: true, screen: Routes.HOME, params: clusterId ? buildUserClusterRouteParams({ clusterId }) : undefined },
  }));

  useEffect(() => {
    let gone = false;
    get<Invite>(`/api/invites/${code}`).then((v) => {
      if (gone) return;
      if (v.alreadyCollaborator) goHome(v.clusterId);
      else setInvite(v.valid ? v : null);
    }, () => { if (!gone) setInvite(null); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const accept = async () => {
    setBusy(true);
    try {
      const done = await api<{ clusterId: string }>('POST', `/api/invites/${code}/accept`);
      showToast({ text: '已接受邀请' }); // toast.inviteAccepted
      goHome(done.clusterId);
    } catch {
      showToast({ text: '无法接受邀请' }); // toast.acceptInviteFailed
    } finally {
      setBusy(false);
    }
  };
  const decline = async () => {
    setBusy(true);
    try {
      await api('POST', `/api/invites/${code}/decline`);
      goHome();
    } catch {
      showToast({ text: '没能拒绝邀请' });
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={8}><ChevronLeftIcon color={theme.colors.primary} /></Pressable>
    </View>
  );
  if (invite === undefined) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={theme.colors.tertiary} /></View>;
  }
  if (invite === null) {
    return (
      <View style={styles.container}>
        {back}
        <View style={styles.emptyState}>
          <Text style={styles.title}>此邀请不再有效</Text>
          <Text style={styles.description}>它可能已过期、被撤销或已被使用。</Text>
          <Button text="回到首页" fitContent onPress={() => goHome()} />
        </View>
      </View>
    );
  }
  const cover = invite.cluster.covers?.[0];
  return (
    <View style={styles.container}>
      {back}
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatars}><Avatar user={invite.inviter} size={56} /></View>
          <Text style={styles.title}>{invite.inviter.username} 邀请您加入 {invite.cluster.name}</Text>
          <Text style={styles.description}>共同合作制作这个系列</Text>
        </View>
        <View style={styles.card}>
          {cover ? <Image source={{ uri: absoluteUrl(cover) }} style={styles.cover} contentFit="cover" /> : <View style={styles.cover} />}
          <View style={styles.cardText}>
            <Text style={styles.clusterName} numberOfLines={1}>{invite.cluster.name}</Text>
            <Text style={styles.description}>{invite.cluster.numberOfElements ?? 0} 个元素</Text>
          </View>
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <Button text="接受" fullWidth loading={busy} disabled={busy} onPress={() => void accept()} />
        <Text style={styles.decline} onPress={busy ? undefined : () => void decline()} accessibilityRole="button">拒绝</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  back: { alignSelf: 'flex-start' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  hero: { alignItems: 'center', marginBottom: theme.spacing.lg, gap: theme.spacing.xs },
  avatars: { flexDirection: 'row', marginBottom: theme.spacing.md },
  title: { ...theme.typography.headingMedium, color: theme.colors.primary, textAlign: 'center' },
  description: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center' },
  card: { width: '100%', maxWidth: 280, borderWidth: 0.5, borderColor: theme.colors.surfaceBorder, borderRadius: theme.borderRadius.lg, overflow: 'hidden', backgroundColor: theme.colors.elevated },
  cover: { width: '100%', aspectRatio: 1, backgroundColor: theme.colors.elevated },
  cardText: { alignItems: 'center', paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.md },
  clusterName: { ...theme.typography.headingMedium, color: theme.colors.primary },
  actions: { marginTop: 'auto', justifyContent: 'center', alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.md },
  decline: { ...theme.typography.regularPlus, color: theme.colors.tertiary, paddingVertical: theme.spacing.sm },
}));
