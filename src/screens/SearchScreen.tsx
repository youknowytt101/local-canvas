// Cosmos' SearchScreen (SearchRoot): while it is focused the bar is the search field (activeState 'global-search').
// The landing, typeahead and results come in step 5.
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { TabRootPlaceholder } from '../components/TabRootPlaceholder';
import { useBarStore } from '../stores/useBarStore';

export function SearchScreen() {
  useFocusEffect(useCallback(() => {
    useBarStore.getState().setActiveState({ type: 'global-search' });
    return () => useBarStore.getState().setActiveState({ type: 'default' });
  }, []));
  return <TabRootPlaceholder title="搜索" note="搜索页在第 5 步做。" />;
}
