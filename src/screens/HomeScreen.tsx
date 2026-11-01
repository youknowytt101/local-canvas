// Cosmos' HomeScreen: the feed comes in step 2 (为你推荐 / 正在关注, the two-column grid, the header)
import { TabRootPlaceholder } from '../components/TabRootPlaceholder';
import { Routes } from '../navigation/routes';

export function HomeScreen() {
  return <TabRootPlaceholder tab={Routes.HOME} title="首页" note="推荐流在第 2 步做。" />;
}
