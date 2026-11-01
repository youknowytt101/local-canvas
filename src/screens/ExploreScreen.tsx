// Cosmos' ExploreScreen: categories and featured collections come in step 8
import { TabRootPlaceholder } from '../components/TabRootPlaceholder';
import { Routes } from '../navigation/routes';

export function ExploreScreen() {
  return <TabRootPlaceholder tab={Routes.EXPLORE} title="探索" note="分类和精选在第 8 步做。" />;
}
