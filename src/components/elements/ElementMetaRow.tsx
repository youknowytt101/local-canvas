// The row above the media (Cosmos' metaRow in ElementViewerContainer: ELEMENT_VIEWER_HEADER_HEIGHT 26 high, spacing.sm
// at its sides, ELEMENT_VIEWER_HEADER_MEDIA_GAP 8 above the media, its two ends apart). The row is there even when
// empty, so the media does not move from one element to the next.
//   - left, ConnectionsInfo (useElementConnectionsProfiles, pageSize 3): who has it — an AvatarStack of the first
//     three (24 rings in the background colour, each 6 over the one before, the later on top, a 20 avatar inside) and
//     "+N" (regular, secondary) 6 apart; rings while it loads; nobody: nothing. Its sheet comes in step 4
//   - right, SourceLabel: lucide ArrowUpRight 13 (tertiary, 2 down), 10 of slop, opening the element's site
//     (useVisitElementSite: an ElementSiteVisited event), when it has one (getLinkFallbackDomain)
// Local: a person without a picture shows the first letter of their name (cosmos-lite does the same).
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTrackElementViewSource } from './viewerContext';
import { recordElementEvent } from '../../hooks/useTrackElementView';
import { get } from '../../lib/api';
import { sourceHost, type Element } from '../../lib/elements';
import { absoluteUrl } from '../../lib/server';
import { ArrowUpRight } from '../icons';

export const ELEMENT_VIEWER_HEADER_HEIGHT = 26;
export const ELEMENT_VIEWER_HEADER_MEDIA_GAP = 8;

type Person = { id: string; username: string; fullName?: string; avatarUrl?: string | null; isSelf?: boolean };
type Connections = { profiles: { totalCount: number; items: Person[] } };

const known = new Map<string, Connections>(); // the viewer goes back and forth

export function ElementMetaRow({ element }: { element: Element }) {
  const { theme } = useUnistyles();
  const source = useTrackElementViewSource();
  const host = sourceHost(element);
  const [connections, setConnections] = useState<Connections | null>(known.get(element.id) ?? null);
  useEffect(() => {
    let live = true;
    get<Connections>(`/api/elements/${encodeURIComponent(element.id)}/connections`).then((c) => {
      known.set(element.id, c);
      if (live) setConnections(c);
    }, () => undefined);
    return () => { live = false; };
  }, [element.id]);

  const count = connections?.profiles.totalCount ?? 0;
  const shown = connections?.profiles.items.slice(0, 3) ?? [];
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {!connections ? (
          <View style={styles.stack}>{[0, 1].map((i) => <View key={i} style={[styles.ring, i > 0 && styles.overlap, { zIndex: i + 1 }]}><View style={styles.skeleton} /></View>)}</View>
        ) : count > 0 ? (
          <View style={styles.connections} accessibilityLabel={`${count} 人收藏了它`}>
            <View style={styles.stack}>
              {shown.map((p, i) => (
                <View key={p.id} style={[styles.ring, i > 0 && styles.overlap, { zIndex: i + 1 }]}>
                  {p.avatarUrl ? <Image source={{ uri: absoluteUrl(p.avatarUrl) }} style={styles.avatar} />
                    : <View style={[styles.avatar, styles.letter]}><Text style={styles.letterText}>{[...(p.username || '?')][0].toUpperCase()}</Text></View>}
                </View>
              ))}
            </View>
            {count > shown.length ? <Text style={styles.more}>+{count - shown.length}</Text> : null}
          </View>
        ) : null}
      </View>
      {host ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`访问原站：${host}`}
          hitSlop={10}
          style={styles.source}
          onPress={() => {
            recordElementEvent(element.id, { eventType: 'ElementSiteVisited', userInteractionSource: source, slateId: element.slateId ?? null, sourceUrl: element.sourceUrl });
            void Linking.openURL(element.sourceUrl!);
          }}
        >
          <ArrowUpRight color={theme.colors.tertiary} size={13} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    height: ELEMENT_VIEWER_HEADER_HEIGHT, paddingHorizontal: theme.spacing.sm, marginBottom: ELEMENT_VIEWER_HEADER_MEDIA_GAP,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  connections: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  ring: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  overlap: { marginLeft: -6 },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  skeleton: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.elevated },
  letter: { backgroundColor: theme.colors.surfaceInverted, alignItems: 'center', justifyContent: 'center' },
  letterText: { ...theme.typography.captionPlus, fontSize: 10, color: theme.colors.inverted },
  more: { ...theme.typography.regular, color: theme.colors.secondary },
  source: { marginLeft: theme.spacing.sm, paddingTop: 2 },
}));
