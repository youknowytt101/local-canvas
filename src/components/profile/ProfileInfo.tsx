// Cosmos' ProfileInfo (2.33, styles from the bytecode; cosmos-lite HANDOFF 6.133), spacing.md in from the sides:
//   - nameAndAvatar: the 80 avatar (a .5 surfaceBorder line) and beside it, spacing.md apart, the name (headingLarge 26)
//     over @username (large on 20, tertiary), 1 apart
//   - bioAndWebsite, spacing.md down: the bio (large, primary) and the website (regular, tertiary)
//   - followInfo, spacing.md down: the first followers' avatars (23, a ring of the page's colour, 8 over each other) and
//     "N 粉丝 · N 正在关注" (regular; the counts primary, the words tertiary)
//   - actionButtonsContainer, spacing.md down: 创建 (primary) and 编辑主页 (outline) sharing the row, then a round outline
//     button per social link (getSocialLinks: instagram, x, tiktok, spotify, the website), spacing.xs apart
// On someone else's the row starts with 关注 (primary) / 正在关注 (outline) instead (common.follow / following).
// The words 创建 / 编辑主页 are the user's (6.135; 2.33's pack has 添加 / 编辑个人资料).
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { get } from '../../lib/api';
import { absoluteUrl } from '../../lib/server';
import { Button } from '../Button';
import { GlobalIcon, SocialIcon, type SocialPlatform } from './socialIcons';

export type ProfileUser = {
  id: string; username: string; fullName?: string; bio?: string; websiteUrl?: string; avatarUrl?: string | null;
  socialLinks?: Partial<Record<SocialPlatform, string>>;
  statistics?: { numberOfElements: number; numberOfClusters: number; numberOfFollowers: number; numberOfFollowing: number };
  verifiedProfile?: { name?: string; coverImage?: { url: string } | null } | null;
};

const SOCIAL_URL: Record<SocialPlatform, (v: string) => string> = {
  instagram: (v) => `https://instagram.com/${v.replace(/^@/, '')}`,
  x: (v) => `https://x.com/${v.replace(/^@/, '')}`,
  tiktok: (v) => `https://www.tiktok.com/@${v.replace(/^@/, '')}`,
  spotify: (v) => v,
};
const linkOf = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const hostOf = (url: string) => /^https?:\/\/([^/?#]+)/i.exec(url)?.[1]?.replace(/^www\./, '') ?? url;

export function Avatar({ user, size }: { user: Pick<ProfileUser, 'username' | 'fullName' | 'avatarUrl'>; size: number }) {
  const { theme } = useUnistyles();
  const letter = [...(user.fullName || user.username || '?')][0].toUpperCase();
  return user.avatarUrl ? (
    <Image source={{ uri: absoluteUrl(user.avatarUrl) }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.surfaceInverted, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...theme.typography.buttonMedium, fontSize: size * 0.38, lineHeight: size * 0.5, color: theme.colors.inverted }}>{letter}</Text>
    </View>
  );
}

type Props = {
  user: ProfileUser; isMe?: boolean; isFollowed?: boolean; onFollow?: () => void;
  onCreate?: () => void; onEdit?: () => void; onFollowers?: () => void; onFollowing?: () => void;
};

// the profile's social buttons, in Cosmos' order, and the website: [platform or 网站, where it goes]
export const profileSocialLinks = (user: Pick<ProfileUser, 'socialLinks' | 'websiteUrl'>): [string, string][] => {
  const site = user.websiteUrl ? linkOf(user.websiteUrl) : null;
  return [
    ...(['instagram', 'x', 'tiktok', 'spotify'] as SocialPlatform[]).filter((k) => user.socialLinks?.[k]).map((k): [string, string] => [k, SOCIAL_URL[k](user.socialLinks![k]!)]),
    ...(site ? [['网站', site] as [string, string]] : []),
  ];
};

export function ProfileInfo({ user, isMe = true, isFollowed, onFollow, onCreate, onEdit, onFollowers, onFollowing }: Props) {
  const { theme } = useUnistyles();
  const st = user.statistics;
  const [faces, setFaces] = useState<ProfileUser[]>([]);
  useEffect(() => {
    if (!st?.numberOfFollowers) { setFaces([]); return; }
    get<{ items: ProfileUser[] }>(`/api/users/${encodeURIComponent(user.id)}/followers`).then((r) => setFaces(r.items.slice(0, 3)), () => undefined);
  }, [user.id, st?.numberOfFollowers]);
  const site = user.websiteUrl ? linkOf(user.websiteUrl) : null;
  const socials: [string, string, React.ReactNode][] = profileSocialLinks(user).map(([k, href]) => [
    k, href, k === '网站' ? <GlobalIcon key="site" color={theme.colors.primary} /> : <SocialIcon key={k} platform={k as SocialPlatform} color={theme.colors.primary} />,
  ]);
  return (
    <View style={styles.container}>
      <View style={styles.identity}>
        <View style={styles.avatar}><Avatar user={user} size={80} /></View>
        <View style={styles.names}>
          <Text style={styles.name} numberOfLines={2}>{user.fullName || user.username}</Text>
          <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
        </View>
      </View>
      {user.bio || site ? (
        <View style={styles.bio}>
          {user.bio ? <Text style={styles.bioText}>{user.bio}</Text> : null}
          {site ? <Text style={styles.website} onPress={() => void Linking.openURL(site)}>{hostOf(site)}</Text> : null}
        </View>
      ) : null}
      {st ? (
        <View style={styles.follow}>
          {faces.length ? (
            <View style={styles.faces}>
              {faces.map((f, i) => <View key={f.id} style={[styles.face, i > 0 && { marginLeft: -8 }]}><Avatar user={f} size={23} /></View>)}
            </View>
          ) : null}
          <Text style={styles.followText}>
            <Text style={styles.count} onPress={onFollowers}>{st.numberOfFollowers}</Text>
            <Text onPress={onFollowers}> 粉丝</Text>
            {' · '}
            <Text style={styles.count} onPress={onFollowing}>{st.numberOfFollowing}</Text>
            <Text onPress={onFollowing}> 正在关注</Text>
          </Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        {isMe ? (
          <>
            <Button text="创建" size="regular" onPress={onCreate} style={styles.actionButton} />
            <Button text="编辑主页" variant="outline" size="regular" onPress={onEdit} style={styles.actionButton} />
          </>
        ) : (
          <Button text={isFollowed ? '正在关注' : '关注'} variant={isFollowed ? 'outline' : 'primary'} size="regular" onPress={onFollow} style={styles.actionButton} />
        )}
        {socials.map(([label, href, icon]) => (
          <Pressable key={label} style={styles.social} onPress={() => void Linking.openURL(href)} accessibilityRole="link" accessibilityLabel={label}>{icon}</Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { paddingHorizontal: theme.spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.md },
  avatar: { borderRadius: 40, borderWidth: 0.5, borderColor: theme.colors.surfaceBorder },
  names: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...theme.typography.headingLarge, color: theme.colors.primary },
  username: { ...theme.typography.large, lineHeight: 20, color: theme.colors.tertiary },
  bio: { marginTop: theme.spacing.md, gap: 2 },
  bioText: { ...theme.typography.large, color: theme.colors.primary },
  website: { ...theme.typography.regular, color: theme.colors.tertiary },
  follow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.md },
  faces: { flexDirection: 'row', marginRight: theme.spacing.xs },
  face: { borderRadius: 13, borderWidth: 1.5, borderColor: theme.colors.background },
  followText: { ...theme.typography.regular, color: theme.colors.tertiary },
  count: { color: theme.colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.md },
  actionButton: { flex: 1 },
  social: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
}));
