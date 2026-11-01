// Cosmos' CreateClusterSheet (openCreateClusterSheet), its words from the Chinese pack as the web page has them (6.133):
// 新系列, the name field 藏品名称, 设为私有 · 只为您和您的合作者 with a switch, and 创建收藏 (primary, large, the
// sheet's width), enabled once there is a name. Made, it says so and tells whoever opened it.
// Near Cosmos: the layout (its sheet's exact spacing is not read); no 新子系列 (sub-collections come with the collection
// page) and no elements to put in it yet.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api } from '../../lib/api';
import { showToast } from '../../stores/useToastStore';
import { Button } from '../Button';
import type { Collection } from '../clusters/CollectionCard';

export const CREATE_CLUSTER_SHEET = 'create-cluster';
const MAX_CLUSTER_NAME_LENGTH = 100;

type CreateState = { onCreated: ((c: Collection) => void) | null; open: (onCreated?: (c: Collection) => void) => void };
export const useCreateClusterStore = create<CreateState>((set) => ({
  onCreated: null,
  open: (onCreated) => {
    set({ onCreated: onCreated ?? null });
    void TrueSheet.present(CREATE_CLUSTER_SHEET).catch(() => undefined);
  },
}));

export function CreateClusterSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const c = await api<Collection>('POST', '/api/clusters', { name: n, isPrivate });
      await TrueSheet.dismiss(CREATE_CLUSTER_SHEET).catch(() => undefined);
      useCreateClusterStore.getState().onCreated?.({ ...c, count: c.count ?? 0 });
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : '无法创建' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <TrueSheet
      name={CREATE_CLUSTER_SHEET}
      detents={['auto'] as never}
      cornerRadius={24}
      grabber
      backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => { setName(''); setPrivate(false); useCreateClusterStore.setState({ onCreated: null }); }}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Text style={styles.title}>新系列</Text>
        <TextInput
          value={name} onChangeText={setName} maxLength={MAX_CLUSTER_NAME_LENGTH} placeholder="藏品名称" autoFocus
          placeholderTextColor={theme.colors.tertiary} style={styles.input} returnKeyType="done" onSubmitEditing={submit}
        />
        <View style={styles.privateRow}>
          <View style={styles.privateText}>
            <Text style={styles.privateTitle}>设为私有</Text>
            <Text style={styles.privateHint}>只为您和您的合作者</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setPrivate} />
        </View>
        <Button text="创建收藏" size="large" fullWidth disabled={!name.trim()} loading={busy} onPress={submit} />
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
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  privateText: { flex: 1, gap: 2 },
  privateTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  privateHint: { ...theme.typography.regular, color: theme.colors.tertiary },
}));
