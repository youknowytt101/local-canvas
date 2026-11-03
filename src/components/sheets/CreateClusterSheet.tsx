// Cosmos' CreateClusterSheet (openCreateClusterSheet), its words from the Chinese pack as the web page has them (6.133):
// 新系列, the name field 藏品名称 (MAX_CLUSTER_NAME_LENGTH 24), 设为私有 · 只为您和您的合作者 with a switch, and
// 创建收藏 (primary, large, the sheet's width), enabled once there is a name. Made, it tells whoever opened it.
// Opened by a collection's 添加 (its owner, at the top level) it is 新子系列 and makes it inside that one.
// Near Cosmos: the layout (its sheet's exact spacing is not read); no elements to put in a new one yet.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { CommonActions } from '@react-navigation/native';
import { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api } from '../../lib/api';
import { buildSubClusterRouteParams } from '../../lib/clusters/buildSubClusterRouteParams';
import { navigationRef } from '../../navigation/navigationRef';
import { Routes } from '../../navigation/routes';
import { showToast } from '../../stores/useToastStore';
import { Button } from '../Button';
import type { Collection } from '../clusters/CollectionCard';
import { SheetGrabber } from './SheetGrabber';

export const CREATE_CLUSTER_SHEET = 'create-cluster';
const MAX_CLUSTER_NAME_LENGTH = 24;

type Parent = { id: string; name: string };
type CreateState = {
  onCreated: ((c: Collection) => void) | null;
  parent: Parent | null; // 新子系列: made inside this one (openCreateSheet's subClusterParent)
  selectElements: boolean; // made from the profile: its elements are chosen next (SelectClusterElements)
  open: (onCreated?: (c: Collection) => void, parent?: Parent | null, selectElements?: boolean) => void;
};
export const useCreateClusterStore = create<CreateState>((set) => ({
  onCreated: null,
  parent: null,
  selectElements: false,
  open: (onCreated, parent, selectElements) => {
    set({ onCreated: onCreated ?? null, parent: parent ?? null, selectElements: !!selectElements });
    void TrueSheet.present(CREATE_CLUSTER_SHEET).catch(() => undefined);
  },
}));

export function CreateClusterSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const parent = useCreateClusterStore((s) => s.parent);
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const c = await api<Collection>('POST', '/api/clusters', { name: n, isPrivate, parentId: parent?.id ?? null });
      await TrueSheet.dismiss(CREATE_CLUSTER_SHEET).catch(() => undefined);
      useCreateClusterStore.getState().onCreated?.({ ...c, count: c.count ?? 0 });
      // Cosmos: a new sub-collection is opened in the profile's tab, under its parent's name
      if (!parent && useCreateClusterStore.getState().selectElements && navigationRef.isReady()) {
        navigationRef.dispatch(CommonActions.navigate({ name: Routes.MAIN, params: { screen: Routes.SELECT_CLUSTER_ELEMENTS, params: { clusterId: c.id, searchTerm: c.name } } }));
      }
      if (parent && navigationRef.isReady()) {
        navigationRef.dispatch(CommonActions.navigate({
          name: Routes.MAIN,
          params: { screen: Routes.MAIN_TABS, pop: true, params: { screen: Routes.PROFILE, params: buildSubClusterRouteParams({ clusterId: c.id, subClusterName: c.name, parentClusterName: parent.name }) } },
        }));
      }
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
      grabber={false}
      backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => {
        setName(''); setPrivate(false);
        useCreateClusterStore.setState({ onCreated: null, parent: null, selectElements: false });
      }}
    >
      <SheetGrabber />
      <View style={[styles.container, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Text style={styles.title}>{parent ? '新子系列' : '新系列'}</Text>
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
  container: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, gap: theme.spacing.md },
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
