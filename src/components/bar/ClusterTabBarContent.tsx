// Cosmos' UserClusterActionTabBarContent (with ClusterTabAction), OrganizeClusterActionTabBarContent and
// ClusterSeeSimilarTabBarContent, a collection's bars:
//   - one's own or one worked on (the last 'cluster' state): TAB_BAR_CLUSTER_USER_WIDTH (280) × TAB_BAR_HEIGHT_TALL (60),
//     spacing.md in, four actions sharing it — 整理 (OrganizeIcon, off until it can be organized), 添加 (PlusIcon),
//     相似 (MagicSearchIcon; the similar page then has its own scroll-to-top bar), 分享 (ShareIcon)
//   - organizing it (the last 'organize' state): TAB_BAR_CLUSTER_ORGANIZE_WIDTH (250, a sub-collection's
//     TAB_BAR_CLUSTER_ORGANIZE_COMPACT_WIDTH 280) × 60, spacing.md in, 移动 (MoveIcon) / 移除 (TrashIcon) / 完成 (CheckIcon);
//     移动 and 移除 off while nothing is chosen
//   - anyone else's: 156 × 54, 看相似 (regularPlus, one line) and ChevronDownIcon (18) 6 apart, spacing.lg in, a
//     CustomPressable with haptics
// ClusterTabAction: a CustomPressable sharing the row (flex 1), its icon (24, primary; switched off, primary at 0x50
// alpha) over its label (captionPlus, tertiary, one line, not scaled with the font size), 4 apart; switched off the
// action is at 0.5 and its label at 0.5 more.
// The words are the web page's (整理 / 相似 / 看相似; 2.33's pack says 组织 / Similar / 查看相似).
import type { ComponentType } from 'react';
import { Text } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useBarStore } from '../../stores/useBarStore';
import { CustomPressable } from '../CustomPressable';
import { CheckIcon, ChevronDownIcon, MagicSearchIcon, MoveIcon, OrganizeIcon, PlusIcon, ShareIcon, TrashIcon } from '../icons';
import { BAR_CONTENT_INDEX } from './constants';
import { useContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };
type Icon = ComponentType<{ color: string; size?: number }>;

export function ClusterTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const bar = useBarStore((s) => s.lastClusterState);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.cluster);
  return (
    <Animated.View style={[styles.container, animated]}>
      <ClusterTabAction icon={OrganizeIcon} label="整理" disabled={!bar?.canOrganizeCluster} onPress={bar?.onOrganize} />
      <ClusterTabAction icon={PlusIcon} label="添加" onPress={bar?.onAdd} />
      <ClusterTabAction icon={MagicSearchIcon} label="相似" onPress={bar?.onSimilarPress} />
      <ClusterTabAction icon={ShareIcon} label="分享" onPress={bar?.onShare} />
    </Animated.View>
  );
}

function ClusterTabAction({ icon: IconComponent, label, disabled = false, onPress }: { icon: Icon; label: string; disabled?: boolean; onPress?: () => void }) {
  const { theme } = useUnistyles();
  const color = theme.colors.primary + (disabled ? '50' : '');
  return (
    <CustomPressable style={styles.clusterTabActionContent(disabled)} onPress={onPress} disabled={disabled}>
      <IconComponent color={color} size={24} />
      <Text style={styles.clusterActionLabel(disabled)} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>{label}</Text>
    </CustomPressable>
  );
}

export function OrganizeClusterTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const bar = useBarStore((s) => s.lastOrganizeState);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.organize);
  const none = !bar?.selectedCount;
  return (
    <Animated.View style={[styles.container, animated]}>
      <ClusterTabAction icon={MoveIcon} label="移动" disabled={none} onPress={bar?.onMove} />
      <ClusterTabAction icon={TrashIcon} label="移除" disabled={none} onPress={bar?.onRemove} />
      <ClusterTabAction icon={CheckIcon} label="完成" onPress={bar?.onDone} />
    </Animated.View>
  );
}

export function ClusterSeeSimilarTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  // getClusterSeeSimilarState
  const onPress = useBarStore((s) => (s.activeState.type === 'cluster-see-similar' ? s.activeState.onPress : undefined));
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['cluster-see-similar']);
  return (
    <Animated.View style={[styles.fill, animated]}>
      <CustomPressable onPress={onPress} style={styles.seeSimilar}>
        <Text style={styles.seeSimilarText} numberOfLines={1} allowFontScaling={false}>看相似</Text>
        <ChevronDownIcon color={theme.colors.primary} size={18} />
      </CustomPressable>
    </Animated.View>
  );
}

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create((theme) => ({
  fill,
  container: { ...fill, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md },
  clusterTabActionContent: (disabled: boolean) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: disabled ? 0.5 : 1 }),
  clusterActionLabel: (disabled: boolean) => ({
    ...theme.typography.captionPlus, color: theme.colors.tertiary, flexWrap: 'nowrap', textAlign: 'center', opacity: disabled ? 0.5 : 1,
  }),
  seeSimilar: { ...fill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: theme.spacing.lg, borderRadius: 99 },
  seeSimilarText: { ...theme.typography.regularPlus, color: theme.colors.primary },
}));
