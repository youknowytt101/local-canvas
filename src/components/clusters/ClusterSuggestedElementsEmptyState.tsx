// Cosmos' ClusterSuggestedElementsEmptyState: a collection of one's own with nothing in it: 建议要素 (headingMedium), 开始策划您的
// 收藏 (caption, tertiary), a row of four elements found by its name (104 high, 280 at most, 2 apart, rounded xl) and 查看
// (primary, large, at least 80 wide, fitting its word), which opens SelectClusterElements.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { get } from '../../lib/api';
import { tileImageUrl, type Element } from '../../lib/elements';
import { Button } from '../Button';

const PREVIEW_COUNT = 4;
const PREVIEW_TILE_WIDTH = 70;

export function ClusterSuggestedElementsEmptyState({ clusterName, onPress }: { clusterName: string; onPress: () => void }) {
  const [elements, setElements] = useState<Element[] | null>(null);
  useEffect(() => {
    let gone = false;
    get<{ items: Element[] }>(`/api/elements?q=${encodeURIComponent(clusterName)}&origin=search_box&pageSize=${PREVIEW_COUNT}`)
      .then((r) => { if (!gone) setElements(r.items.slice(0, PREVIEW_COUNT)); }, () => { if (!gone) setElements([]); });
    return () => { gone = true; };
  }, [clusterName]);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>建议要素</Text>
      <Text style={styles.hint}>开始策划您的收藏</Text>
      <View style={styles.preview}>
        {(elements ?? []).map((e) => {
          const uri = tileImageUrl(e, PREVIEW_TILE_WIDTH, 2);
          return uri ? <Image key={e.id} source={{ uri }} style={styles.previewImage} contentFit="cover" blurRadius={e.nsfw?.treatment === 'blur' ? 30 : undefined} /> : <View key={e.id} style={styles.previewImage} />;
        })}
      </View>
      <Button text="查看" variant="primary" size="large" fitContent style={styles.button} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: { width: '100%', alignItems: 'center', paddingTop: theme.spacing.xxxl, paddingHorizontal: theme.spacing.lg },
  title: { ...theme.typography.headingMedium, color: theme.colors.primary, textAlign: 'center', marginBottom: theme.spacing.xs },
  hint: { ...theme.typography.caption, color: theme.colors.tertiary, textAlign: 'center' },
  preview: {
    width: '100%', maxWidth: 280, marginTop: theme.spacing.xl, flexDirection: 'row', gap: 2, height: 104, overflow: 'hidden',
    borderRadius: theme.borderRadius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.elevated,
  },
  previewImage: { flex: 1, height: '100%', backgroundColor: theme.colors.elevated },
  button: { minWidth: 80, marginTop: theme.spacing.xl },
}));
