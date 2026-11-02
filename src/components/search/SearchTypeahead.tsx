// Cosmos' SearchTypeahead (module 3501), shown while typing: the header 建议 (search.suggestionsHeader, headingMedium,
// primary; spacing.md at the sides and over it, spacing.lg under it), then rows spacing.md apart (UserActivity: a 40
// picture, the title, the meta in regular tertiary):
//   - the suggested searches: an elevated 40 circle with the glass, the term; pressing searches for it
//   - people (SearchUsers): the avatar, the name, @username; pressing opens their profile (remembered)
//   - one's collections (GlobalSearchTypeaheadClusters, filters: { userId }): the cover (40, borderRadius.xs,
//     elevated while there is none), the name, "N 元素"; pressing opens it (remembered)
// While the first answer is coming: skeleton rows (an elevated 40 circle and a bar).
// From /api/search/suggest (terms and collections, the library's own keywords: Cosmos' SearchAutocomplete is its
// server's) and /api/search/users.
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { absoluteUrl } from '../../lib/server';
import type { Collection } from '../clusters/CollectionCard';
import { SearchIcon } from '../icons';
import { Avatar } from '../profile/ProfileInfo';

export type Person = { id: string; username: string; fullName?: string; avatarUrl?: string | null; isSelf?: boolean };
export type Typeahead = { terms: { term: string; count: number }[]; clusters: Collection[]; users: Person[] };

type Props = {
  data: Typeahead | null; bottomInset: number;
  onTerm: (term: string) => void; onUser: (p: Person) => void; onCluster: (c: Collection) => void;
};

export function SearchTypeahead({ data, bottomInset, onTerm, onUser, onCluster }: Props) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.container}>
      <Text style={styles.header}>建议</Text>
      <ScrollView style={styles.list} contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled">
        {!data ? [0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}><View style={styles.skeletonAvatar} /><View style={styles.skeletonBar} /></View>
        )) : (
          <>
            {data.terms.map((t) => (
              <Row key={`t:${t.term}`} onPress={() => onTerm(t.term)} title={t.term}
                image={<View style={styles.suggestionIcon}><SearchIcon color={theme.colors.tertiary} size={16} /></View>} />
            ))}
            {data.users.map((p) => (
              <Row key={`u:${p.id}`} onPress={() => onUser(p)} title={p.fullName || p.username} meta={`@${p.username}`} image={<Avatar user={p} size={40} />} />
            ))}
            {data.clusters.map((c) => (
              <Row key={`c:${c.id}`} onPress={() => onCluster(c)} title={c.name} meta={`${c.count} 元素`}
                image={c.covers?.[0] ? <Image source={{ uri: absoluteUrl(c.covers[0]) }} style={styles.clusterCover} contentFit="cover" />
                  : <View style={[styles.clusterCover, styles.clusterCoverPlaceholder]} />} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ image, title, meta, onPress }: { image: React.ReactNode; title: string; meta?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      {image}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

const SIZE = 40;
const styles = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  header: {
    ...theme.typography.headingMedium, color: theme.colors.primary, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: theme.spacing.md, gap: theme.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  text: { flex: 1, minWidth: 0 },
  title: { ...theme.typography.large, color: theme.colors.primary },
  meta: { ...theme.typography.regular, color: theme.colors.tertiary },
  suggestionIcon: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  clusterCover: { width: SIZE, height: SIZE, borderRadius: theme.borderRadius.xs },
  clusterCoverPlaceholder: { backgroundColor: theme.colors.elevated },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  skeletonAvatar: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: theme.colors.elevated },
  skeletonBar: { width: 140, height: 12, borderRadius: theme.borderRadius.xxs, backgroundColor: theme.colors.elevated },
}));
