// Cosmos' UserClusterHeader (module 3278; read for the web page in cosmos-lite HANDOFF 6.123 / 6.125), centred,
// spacing.md from the top and the sides:
//   - the title: subtitle.xxl (24, Medium) with xxs under it; a sub-collection's is a breadcrumb in headingMedium (18):
//     the parent's name (tertiary, a link) " / " its own, each on one line
//   - "@owner · N 元素 · 私密" (regular, tertiary; @owner goes to the profile), xxs apart; the count as
//     formatClusterElementCount (1.2k / 1.2m from a thousand / a million)
//   - the avatars (getClusterHeaderAvatars: the owner and who works on it, the owner alone too), spacing.lg over and
//     under: 32 round, a 1.5 ring of the page's colour, 12 over each other
//   - the description (ClusterDescription): regular, primary, centred, two lines and then 更多, spacing.lg under it
//   - on someone else's: 关注 (primary) / 正在关注 (outline), spacing.xxxl under it
//   - the sub-collections
//   pressed, the people (CollaboratorsSheet); the owner's last circle is addAvatarColumn (elevated, AddUserIcon 20:
//   cluster.inviteCollaborators), the invite link
// Near Cosmos: the avatars are initials (no pictures here); the
// description opens without the spring and cross-fade, 更多 under the two lines (Cosmos ends the second line with it);
// the sub-collections are cards two to a row (Cosmos' SubCluster list is not read).
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { UserPlusIcon } from '../icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { api, get } from '../../lib/api';
import { showToast } from '../../stores/useToastStore';
import { Button } from '../Button';
import { Avatar } from '../profile/ProfileInfo';
import { CollectionCard, type Collection } from './CollectionCard';
import { DEFAULT_GRID_GAP } from '../home/ForYouFeed';

export type ClusterDetail = Collection & { collaboratorsCount?: number; isFollowed?: boolean; followersCount?: number; privacyLocked?: boolean };

export function formatClusterElementCount(n: number, isPrivate?: boolean) {
  const short = n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}m` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n);
  return `${short} 元素${isPrivate ? ' · 私密' : ''}`;
}

type Person = { userId: string; username: string };

type Props = {
  cluster: ClusterDetail;
  parent: { id: string; name: string } | null;
  subClusters: Collection[];
  width: number;
  onParentPress: () => void;
  onOwnerPress: () => void;
  onOpenSub: (c: Collection) => void;
  onChanged: (patch: Partial<ClusterDetail>) => void;
  onPeoplePress: () => void; // CollaboratorsSheet
  onInvite: () => void; // the add circle: the invite link
};

// The name, or the parent's " / " its own; a sub-collection has both from its route before it has loaded (Cosmos: r33 ?? subClusterName)
export function ClusterHeaderTitle({ name, parentName, onParentPress }: { name: string; parentName?: string | null; onParentPress?: () => void }) {
  return parentName ? (
    <View style={styles.breadcrumb}>
      <Text style={[styles.nested, styles.parentName]} numberOfLines={1} onPress={onParentPress} accessibilityRole="link">{parentName}</Text>
      <Text style={[styles.nested, styles.parentName]}> / </Text>
      <Text style={[styles.nested, styles.segment]} numberOfLines={1}>{name}</Text>
    </View>
  ) : (
    <Text style={styles.title}>{name}</Text>
  );
}

export function UserClusterHeader({ cluster: c, parent, subClusters, width, onParentPress, onOwnerPress, onOpenSub, onChanged, onPeoplePress, onInvite }: Props) {
  const { theme } = useUnistyles();
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const owner = c.ownerId ? [{ userId: c.ownerId, username: c.owner ?? c.ownerId }] : [];
    setPeople(owner);
    if (!c.collaboratorsCount) return;
    get<{ items: Person[] }>(`/api/clusters/${encodeURIComponent(c.id)}/collaborators`).then((r) => setPeople(r.items), () => undefined);
  }, [c.id, c.ownerId, c.owner, c.collaboratorsCount]);

  const follow = async () => {
    const on = !c.isFollowed;
    onChanged({ isFollowed: on });
    try {
      await api(on ? 'POST' : 'DELETE', `/api/clusters/${encodeURIComponent(c.id)}/follow`);
      if (on) showToast({ text: '已关注收藏夹' });
    } catch (e) {
      onChanged({ isFollowed: !on });
      showToast({ text: e instanceof Error ? e.message : '关注收藏夹失败' });
    }
  };

  const cardWidth = (width - 3 * DEFAULT_GRID_GAP) / 2;
  return (
    <View style={styles.container}>
      <ClusterHeaderTitle name={c.name} parentName={parent?.name} onParentPress={onParentPress} />
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle} onPress={onOwnerPress}>@{c.owner}</Text>
        <Text style={styles.subtitle}>· {formatClusterElementCount(c.count, c.isPrivate)}</Text>
      </View>
      {people.length ? (
        <Pressable style={styles.avatarRow} onPress={onPeoplePress} accessibilityRole="button" accessibilityLabel="协作者">
          {people.map((p, i) => (
            <View key={p.userId} style={[styles.avatarColumn, i > 0 && styles.overlap]}><Avatar user={{ username: p.username }} size={29} /></View>
          ))}
          {c.role === 'Owner' ? (
            <Pressable style={[styles.avatarColumn, styles.overlap, styles.addAvatarColumn]} onPress={onInvite} accessibilityRole="button" accessibilityLabel="邀请合作者">
              <UserPlusIcon color={theme.colors.primary} size={20} />
            </Pressable>
          ) : null}
        </Pressable>
      ) : <View style={styles.avatarSpacer} />}
      {c.description ? (
        <Pressable style={styles.description} onPress={() => setOpen((o) => !o)} disabled={!clipped && !open}>
          <Text
            style={styles.descriptionText}
            numberOfLines={open ? undefined : 2}
            onTextLayout={(e) => { if (!open) setClipped(e.nativeEvent.lines.length > 2 || clipped); }}
          >
            {c.description}
          </Text>
          {clipped && !open ? <Text style={styles.more}>更多</Text> : null}
        </Pressable>
      ) : null}
      {!c.role ? (
        <View style={styles.follow}>
          <Button text={c.isFollowed ? '正在关注' : '关注'} variant={c.isFollowed ? 'outline' : 'primary'} size="small" onPress={follow} />
        </View>
      ) : null}
      {subClusters.length ? (
        <View style={styles.subClusters}>
          {subClusters.map((s) => <CollectionCard key={s.id} collection={s} width={cardWidth} onPress={() => onOpenSub(s)} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { alignItems: 'center', paddingTop: theme.spacing.md, paddingHorizontal: theme.spacing.md },
  title: { ...theme.typography.subtitle.xxl, color: theme.colors.primary, textAlign: 'center', marginBottom: theme.spacing.xxs },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', marginBottom: theme.spacing.xxs },
  nested: { ...theme.typography.headingMedium, color: theme.colors.primary },
  parentName: { color: theme.colors.tertiary, flexShrink: 0, maxWidth: '45%' },
  segment: { flexShrink: 1 },
  subtitleRow: { flexDirection: 'row', gap: theme.spacing.xxs },
  subtitle: { ...theme.typography.regular, color: theme.colors.tertiary },
  avatarRow: { flexDirection: 'row', marginVertical: theme.spacing.lg },
  avatarSpacer: { height: theme.spacing.lg },
  avatarColumn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.background, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  overlap: { marginLeft: -theme.spacing.sm },
  addAvatarColumn: { backgroundColor: theme.colors.elevated },
  description: { alignItems: 'center', marginBottom: theme.spacing.lg },
  descriptionText: { ...theme.typography.regular, color: theme.colors.primary, textAlign: 'center' },
  more: { ...theme.typography.regular, color: theme.colors.tertiary },
  follow: { marginBottom: theme.spacing.xxxl },
  subClusters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: DEFAULT_GRID_GAP, alignSelf: 'stretch', marginHorizontal: DEFAULT_GRID_GAP - theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
}));

