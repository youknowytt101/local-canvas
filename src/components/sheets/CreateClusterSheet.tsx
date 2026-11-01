// Cosmos' CreateClusterSheet (openCreateClusterSheet), its words from the Chinese pack as the web page has them (6.133):
// 新系列, the name field 藏品名称 (MAX_CLUSTER_NAME_LENGTH 24), 设为私有 · 只为您和您的合作者 with a switch, and
// 创建收藏 (primary, large, the sheet's width), enabled once there is a name. Made, it tells whoever opened it.
// Opened by a collection's 添加 (its owner, at the top level) it is 新子系列 and makes it inside that one.
// The collection menu's 编辑收藏 opens it on that collection (Cosmos' EditClusterScreen: name, description, private;
// a sub-collection of a private one stays private): 编辑收藏, the description field, 保存.
// Near Cosmos: the layout (its sheet's exact spacing is not read); no elements to put in a new one yet; editing is this
// sheet rather than Cosmos' own screen, and has no cover (ChangeCoverScreen) yet.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api } from '../../lib/api';
import { showToast } from '../../stores/useToastStore';
import { Button } from '../Button';
import type { Collection } from '../clusters/CollectionCard';

export const CREATE_CLUSTER_SHEET = 'create-cluster';
const MAX_CLUSTER_NAME_LENGTH = 24;

type Parent = { id: string; name: string };
type Editing = Collection & { privacyLocked?: boolean };
type CreateState = {
  onCreated: ((c: Collection) => void) | null;
  parent: Parent | null; // 新子系列: made inside this one (openCreateSheet's subClusterParent)
  editing: Editing | null; // 编辑收藏
  open: (onCreated?: (c: Collection) => void, parent?: Parent | null) => void;
  edit: (cluster: Editing, onSaved: (c: Collection) => void) => void;
};
export const useCreateClusterStore = create<CreateState>((set) => ({
  onCreated: null,
  parent: null,
  editing: null,
  open: (onCreated, parent) => {
    set({ onCreated: onCreated ?? null, parent: parent ?? null, editing: null });
    void TrueSheet.present(CREATE_CLUSTER_SHEET).catch(() => undefined);
  },
  edit: (cluster, onSaved) => {
    set({ onCreated: onSaved, parent: null, editing: cluster });
    void TrueSheet.present(CREATE_CLUSTER_SHEET).catch(() => undefined);
  },
}));

export function CreateClusterSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const parent = useCreateClusterStore((s) => s.parent);
  const editing = useCreateClusterStore((s) => s.editing);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDescription(editing.description ?? '');
    setPrivate(!!editing.isPrivate);
  }, [editing]);

  const submit = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const c = editing
        ? await api<Collection>('PATCH', `/api/clusters/${encodeURIComponent(editing.id)}`, { name: n, description, isPrivate })
        : await api<Collection>('POST', '/api/clusters', { name: n, isPrivate, parentId: parent?.id ?? null });
      await TrueSheet.dismiss(CREATE_CLUSTER_SHEET).catch(() => undefined);
      useCreateClusterStore.getState().onCreated?.({ ...c, count: c.count ?? 0 });
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : editing ? '无法保存' : '无法创建' });
    } finally {
      setBusy(false);
    }
  };

  const locked = !!editing?.privacyLocked;
  return (
    <TrueSheet
      name={CREATE_CLUSTER_SHEET}
      detents={['auto'] as never}
      cornerRadius={24}
      grabber
      backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => {
        setName(''); setDescription(''); setPrivate(false);
        useCreateClusterStore.setState({ onCreated: null, parent: null, editing: null });
      }}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Text style={styles.title}>{editing ? '编辑收藏' : parent ? '新子系列' : '新系列'}</Text>
        <TextInput
          value={name} onChangeText={setName} maxLength={MAX_CLUSTER_NAME_LENGTH} placeholder="藏品名称" autoFocus={!editing}
          placeholderTextColor={theme.colors.tertiary} style={styles.input} returnKeyType="done" onSubmitEditing={submit}
        />
        {editing ? (
          <TextInput
            value={description} onChangeText={setDescription} maxLength={1000} placeholder="描述" multiline
            placeholderTextColor={theme.colors.tertiary} style={[styles.input, styles.description]}
          />
        ) : null}
        <View style={styles.privateRow}>
          <View style={styles.privateText}>
            <Text style={styles.privateTitle}>设为私有</Text>
            <Text style={styles.privateHint}>{locked ? '私密收藏集中无法设为公开' : '只为您和您的合作者'}</Text>
          </View>
          <Switch value={isPrivate || locked} onValueChange={setPrivate} disabled={locked} />
        </View>
        <Button text={editing ? '保存' : '创建收藏'} size="large" fullWidth disabled={!name.trim()} loading={busy} onPress={submit} />
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.headingMedium, color: theme.colors.primary, textAlign: 'center' },
  input: {
    ...theme.typography.large, color: theme.colors.primary, height: 52, paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.elevated,
  },
  description: { height: 96, paddingTop: theme.spacing.sm, textAlignVertical: 'top' },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  privateText: { flex: 1, gap: 2 },
  privateTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  privateHint: { ...theme.typography.regular, color: theme.colors.tertiary },
}));
