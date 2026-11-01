// Cosmos' BottomTabNavigator (module 3167): React Navigation's bottom tabs with no header and no freezing of the tabs
// left behind; the tab bar is TabBarBridge (DynamicBar draws the tabs). Four tabs, each its own native stack:
// Home (HomeIcon), Explore (GlobeIcon), Shop (ShopIcon), Profile (TabBarProfileIcon). It starts on Home.
// Not here: Cosmos starts on Explore for users in an experiment arm (isInExploreLandingArm) and prefetches the shop's
// departments; neither exists on this server.
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabBarBridge } from '../components/bar/TabBarBridge';
import { GlobeIcon, HomeIcon, ShopIcon } from '../components/icons';
import { TabBarProfileIcon } from '../components/profile/TabBarProfileIcon';
import { Routes } from './routes';
import { ExploreNavigator, HomeNavigator, ProfileNavigator, ShopNavigator } from './stacks';

const Tab = createBottomTabNavigator();
// the navigator calls `tabBar` as a function, not as a component (Cosmos' renderTabBar)
const renderTabBar = (props: BottomTabBarProps) => <TabBarBridge {...props} />;

export function BottomTabNavigator() {
  return (
    <Tab.Navigator initialRouteName={Routes.HOME} tabBar={renderTabBar} screenOptions={{ headerShown: false, freezeOnBlur: false }}>
      <Tab.Screen name={Routes.HOME} component={HomeNavigator}
        options={{ tabBarAccessibilityLabel: '首页', tabBarIcon: ({ color, size, focused }) => <HomeIcon color={color} size={size} focused={focused} /> }} />
      <Tab.Screen name={Routes.EXPLORE} component={ExploreNavigator}
        options={{ tabBarAccessibilityLabel: '探索', tabBarIcon: ({ color, size }) => <GlobeIcon color={color} size={size} /> }} />
      <Tab.Screen name={Routes.SHOP} component={ShopNavigator}
        options={{ tabBarAccessibilityLabel: '商城', tabBarIcon: ({ color, size, focused }) => <ShopIcon color={color} size={size} focused={focused} /> }} />
      <Tab.Screen name={Routes.PROFILE} component={ProfileNavigator}
        options={{ tabBarAccessibilityLabel: '个人主页', tabBarIcon: ({ color, focused }) => <TabBarProfileIcon color={color} focused={focused} /> }} />
    </Tab.Navigator>
  );
}
