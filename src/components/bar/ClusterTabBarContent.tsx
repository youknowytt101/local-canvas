// Cosmos' UserClusterActionTabBarContent (with ClusterTabAction) and ClusterSeeSimilarTabBarContent, a collection's bar:
//   - one's own or one worked on: TAB_BAR_CLUSTER_USER_WIDTH (280) × 60, four actions sharing it — 整理 (OrganizeIcon,
//     off until it can be organized), 添加 (PlusIcon), 相似 (MagicSearchIcon), 分享 (ShareIcon). An action: its icon (24,
//     primary) over its label (captionPlus, tertiary, one line), 4 apart, centred; switched off at 0.5
//   - organizing it (OrganizeClusterActionTabBarContent): 210 × 62, spacing.md in, 移动 (MoveIcon) / 移除 (TrashIcon) /
//     完成 (CheckIcon) as the same actions; 移动 and 移除 off while nothing is chosen
//   - anyone else's: 156 × 54, 看相似 (regularPlus) and ChevronDownIcon (18) 6 apart, a light haptic when pressed
// The words are the web page's (整理 / 相似 / 看相似; 2.33's pack says 组织 / Similar / 查看相似).
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useBarStore } from '../../stores/useBarStore';
import { CheckIcon, ChevronDownIcon, MagicSearchIcon, MoveIcon, OrganizeIcon, PlusIcon, ShareIcon, TrashIcon } from '../icons';
import { BAR_CONTENT_INDEX } from './constants';
import { useContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

export function ClusterTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const bar = useBarStore((s) => s.clusterBarState);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.cluster);
  const color = theme.colors.primary;
  return (
    <Animated.View style={[styles.layer, styles.row, animated]}>
      <Action label="整理" disabled={!bar?.canOrganize} onPress={bar?.onOrganize} icon={<OrganizeIcon color={color} size={24} />} />
      <Action label="添加" onPress={bar?.onAdd} icon={<PlusIcon color={color} size={24} />} />
      <Action label="相似" active={bar?.similarOn} onPress={bar?.onSimilar} icon={<MagicSearchIcon color={color} size={24} />} />
      <Action label="分享" onPress={bar?.onShare} icon={<ShareIcon color={color} size={24} />} />
    </Animated.View>
  );
}

function Action({ label, icon, onPress, disabled, active }: { label: string; icon: ReactNode; onPress?: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <Pressable
      style={[styles.action, disabled && styles.off]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
    >
      {icon}
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function OrganizeClusterTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const bar = useBarStore((s) => s.organizeBarState);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.organize);
  const color = theme.colors.primary;
  const none = !bar?.selectedCount;
  return (
    <Animated.View style={[styles.layer, styles.row, styles.organize, animated]}>
      <Action label="移动" disabled={none} onPress={bar?.onMove} icon={<MoveIcon color={color} size={24} />} />
      <Action label="移除" disabled={none} onPress={bar?.onRemove} icon={<TrashIcon color={color} size={24} />} />
      <Action label="完成" onPress={bar?.onDone} icon={<CheckIcon color={color} size={24} />} />
    </Animated.View>
  );
}

export function ClusterSeeSimilarTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const bar = useBarStore((s) => s.clusterBarState);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['cluster-see-similar']);
  return (
    <Animated.View style={[styles.layer, animated]}>
      <Pressable
        style={styles.seeSimilar}
        onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); bar?.onSimilar(); }}
        accessibilityRole="button"
        accessibilityLabel="看相似"
      >
        <Text style={styles.seeSimilarText}>看相似</Text>
        <View style={bar?.similarOn ? styles.flipped : undefined}><ChevronDownIcon color={theme.colors.primary} size={18} /></View>
      </Pressable>
    </Animated.View>
  );
}

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create((theme) => ({
  layer: { ...fill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  organize: { paddingHorizontal: theme.spacing.md },
  action: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 4 },
  off: { opacity: 0.5 },
  label: { ...theme.typography.captionPlus, color: theme.colors.tertiary, textAlign: 'center' },
  labelActive: { color: theme.colors.primary },
  seeSimilar: { ...fill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20 },
  seeSimilarText: { ...theme.typography.regularPlus, color: theme.colors.primary },
  flipped: { transform: [{ rotate: '180deg' }] },
}));
