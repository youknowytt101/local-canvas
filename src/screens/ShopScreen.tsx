// Cosmos' ShopScreen: the (placeholder) shop comes in step 8
import { TabRootPlaceholder } from '../components/TabRootPlaceholder';
import { Routes } from '../navigation/routes';

export function ShopScreen() {
  return <TabRootPlaceholder tab={Routes.SHOP} title="商城" note="商城布局在第 8 步做。" />;
}
