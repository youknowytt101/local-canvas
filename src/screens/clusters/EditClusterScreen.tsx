// Cosmos' EditClusterScreen (routes.EditCluster, over the tabs) with useEditCluster and EditClusterForm:
//   - the header: 取消 (regularPlus, tertiary), 编辑收藏, a 60 wide space
//   - the cover, 180 square (borderRadius.lg, a hairline, elevated), 更换封面 under it (captionPlus); a press opens ChangeCover
//   - 藏品名称 (MAX_CLUSTER_NAME_LENGTH 24) and 描述, each in an elevated section with its label (captionPlus, tertiary) over
//     the field (regularPlus); 设为私有 with its line (caption, tertiary) and switch, locked while the parent is private
//   - 完成 (the width, at the foot of the page), off while the name is empty; only what changed is sent; read again on coming
//     back from the cover. Done, a toast and back; nothing changed, just back.
// Near Cosmos: the toast's words are 收藏已更新 / 更新收藏失败 (the pack's say 集群, a machine's word for a cluster).
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Switch, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import type { Collection } from '../../components/clusters/CollectionCard';
import { CustomPressable } from '../../components/CustomPressable';
import { api, get } from '../../lib/api';
import { absoluteUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { showToast } from '../../stores/useToastStore';

const MAX_CLUSTER_NAME_LENGTH = 24;
const LOCKED_PRIVACY_SWITCH_OPACITY = 0.5;

export type EditClusterParams = { clusterId: string };
type Detail = Collection & { description?: string | null };

export function EditClusterScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { clusterId } = useRoute<RouteProp<{ c: EditClusterParams }, 'c'>>().params;
  const [cluster, setCluster] = useState<Detail | null>(null);
  const [locked, setLocked] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    let gone = false;
    void (async () => {
      const c = await get<Detail>(`/api/clusters/${encodeURIComponent(clusterId)}`);
      const parent = c.parentId ? await get<Collection>(`/api/clusters/${encodeURIComponent(c.parentId)}`).catch(() => null) : null;
      if (gone) return;
      setCluster((had) => {
        if (!had) { // what is being typed stays when the page comes back from the cover
          setName(c.name);
          setDescription(c.description ?? '');
          setPrivate(!!c.isPrivate);
        }
        return c;
      });
      setLocked(!!parent?.isPrivate);
    })().catch(() => { if (!gone) showToast({ text: '打不开这个收藏夹' }); });
    return () => { gone = true; };
  }, [clusterId]));

  const done = async () => {
    if (!cluster || saving) return;
    const n = name.trim();
    const d = description.trim();
    const patch: { name?: string; description?: string; isPrivate?: boolean } = {};
    if (n !== cluster.name.trim()) patch.name = n;
    if (d !== (cluster.description ?? '').trim()) patch.description = d;
    if (isPrivate !== !!cluster.isPrivate) patch.isPrivate = isPrivate;
    if (!Object.keys(patch).length) { navigation.goBack(); return; }
    setSaving(true);
    try {
      await api('PATCH', `/api/clusters/${encodeURIComponent(cluster.id)}`, patch);
      showToast({ text: '收藏已更新' }); // toast.clusterUpdated
      navigation.goBack();
    } catch (e) {
      showToast({ text: e instanceof Error && e.message ? e.message : '更新收藏失败' }); // toast.updateClusterFailed
    } finally {
      setSaving(false);
    }
  };

  if (!cluster) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={theme.colors.tertiary} /></View>;
  }
  const cover = cluster.covers?.[0];
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.cancel} onPress={() => navigation.goBack()} accessibilityRole="button">取消</Text>
        <Text style={styles.headerTitle}>编辑收藏</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + theme.spacing.md }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CustomPressable style={styles.coverContainer} onPress={() => navigation.navigate(Routes.CHANGE_COVER, { clusterId: cluster.id })}>
          {cover ? <Image source={{ uri: absoluteUrl(cover) }} style={styles.cover} contentFit="cover" transition={150} /> : <View style={styles.cover} />}
          <Text style={styles.changeCover}>更换封面</Text>
        </CustomPressable>
        <View style={styles.section}>
          <Text style={styles.label}>藏品名称</Text>
          <TextInput
            value={name} onChangeText={setName} maxLength={MAX_CLUSTER_NAME_LENGTH} placeholder="输入集合名称"
            placeholderTextColor={theme.colors.tertiary} style={styles.input}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>描述</Text>
          <TextInput
            value={description} onChangeText={setDescription} placeholder="输入描述" multiline
            placeholderTextColor={theme.colors.tertiary} style={[styles.input, styles.descriptionInput]}
          />
        </View>
        <View style={styles.privateSection}>
          <View style={styles.privateLabels}>
            <Text style={styles.privateLabel}>设为私有</Text>
            <Text style={styles.privateDescription}>{locked ? '私密收藏集中无法设为公开' : '只为您和您的合作者'}</Text>
          </View>
          <Switch
            value={isPrivate || locked} onValueChange={setPrivate} disabled={locked}
            style={locked ? { opacity: LOCKED_PRIVACY_SWITCH_OPACITY } : undefined}
            trackColor={{ true: theme.colors.primary, false: theme.colors.tertiary }} thumbColor={theme.colors.background}
          />
        </View>
        <View style={styles.buttonContainer}>
          <Button text="完成" fullWidth loading={saving} disabled={saving || !name.trim()} onPress={() => void done()} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm, borderBottomColor: theme.colors.surfaceBorder,
  },
  cancel: { ...theme.typography.regularPlus, color: theme.colors.tertiary, minWidth: 60 },
  headerTitle: { ...theme.typography.regularPlus, color: theme.colors.primary },
  headerSpacer: { width: 60 },
  scrollContent: { flexGrow: 1, padding: theme.spacing.md },
  coverContainer: { alignItems: 'center', marginBottom: theme.spacing.xl },
  cover: {
    height: 180, aspectRatio: 1, borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.elevated,
  },
  changeCover: { ...theme.typography.captionPlus, color: theme.colors.primary },
  section: {
    marginBottom: theme.spacing.xl, backgroundColor: theme.colors.elevated, borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
  },
  label: { ...theme.typography.captionPlus, color: theme.colors.tertiary },
  input: { ...theme.typography.regularPlus, color: theme.colors.primary, padding: 0 },
  descriptionInput: { paddingBottom: theme.spacing.md, textAlignVertical: 'top' },
  privateSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xl },
  privateLabels: { flex: 1, marginRight: theme.spacing.md },
  privateLabel: { ...theme.typography.regularPlus, color: theme.colors.primary },
  privateDescription: { ...theme.typography.caption, color: theme.colors.tertiary },
  buttonContainer: { marginTop: 'auto' },
}));
