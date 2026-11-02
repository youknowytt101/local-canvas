// The tabs' own stacks (Cosmos' HomeNavigator 3389, ExploreNavigator 3188, ShopNavigator 3471, ProfileNavigator 3254)
// and search's and settings' (SearchNavigator 3495, SettingsNavigator 2638): native stacks without headers, each
// starting at its root screen, with the element viewer on each (pushed with the stack's default animation). Cosmos also
// puts the canvas (fading), collections and profiles on each of them; collections (UserCluster, OrganizeCluster), profiles (UserProfile) and
// their followers (ProfileConnections) are here, the others
// are added in their steps.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OrganizeClusterScreen } from '../screens/clusters/OrganizeClusterScreen';
import { UserClusterScreen } from '../screens/clusters/UserClusterScreen';
import { ElementsViewerScreen } from '../screens/elements/ElementsViewerScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileConnectionsScreen } from '../screens/profile/ProfileConnectionsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { Routes } from './routes';

const screenOptions = { headerShown: false } as const;

const HomeStack = createNativeStackNavigator();
export function HomeNavigator() {
  return (
    <HomeStack.Navigator initialRouteName={Routes.HOME_ROOT} screenOptions={screenOptions}>
      <HomeStack.Screen name={Routes.HOME_ROOT} component={HomeScreen} />
      <HomeStack.Screen name={Routes.ELEMENTS_VIEWER} component={ElementsViewerScreen} />
      <HomeStack.Screen name={Routes.USER_CLUSTER} component={UserClusterScreen} />
      <HomeStack.Screen name={Routes.ORGANIZE_CLUSTER} component={OrganizeClusterScreen} />
      <HomeStack.Screen name={Routes.USER_PROFILE} component={ProfileScreen} />
      <HomeStack.Screen name={Routes.PROFILE_CONNECTIONS} component={ProfileConnectionsScreen} />
    </HomeStack.Navigator>
  );
}

const ExploreStack = createNativeStackNavigator();
export function ExploreNavigator() {
  return (
    <ExploreStack.Navigator initialRouteName={Routes.EXPLORE_ROOT} screenOptions={screenOptions}>
      <ExploreStack.Screen name={Routes.EXPLORE_ROOT} component={ExploreScreen} />
      <ExploreStack.Screen name={Routes.ELEMENTS_VIEWER} component={ElementsViewerScreen} />
      <ExploreStack.Screen name={Routes.USER_CLUSTER} component={UserClusterScreen} />
      <ExploreStack.Screen name={Routes.ORGANIZE_CLUSTER} component={OrganizeClusterScreen} />
      <ExploreStack.Screen name={Routes.USER_PROFILE} component={ProfileScreen} />
      <ExploreStack.Screen name={Routes.PROFILE_CONNECTIONS} component={ProfileConnectionsScreen} />
    </ExploreStack.Navigator>
  );
}

const ShopStack = createNativeStackNavigator();
export function ShopNavigator() {
  return (
    <ShopStack.Navigator initialRouteName={Routes.SHOP_ROOT} screenOptions={screenOptions}>
      <ShopStack.Screen name={Routes.SHOP_ROOT} component={ShopScreen} />
      <ShopStack.Screen name={Routes.ELEMENTS_VIEWER} component={ElementsViewerScreen} />
      <ShopStack.Screen name={Routes.USER_CLUSTER} component={UserClusterScreen} />
      <ShopStack.Screen name={Routes.ORGANIZE_CLUSTER} component={OrganizeClusterScreen} />
      <ShopStack.Screen name={Routes.USER_PROFILE} component={ProfileScreen} />
      <ShopStack.Screen name={Routes.PROFILE_CONNECTIONS} component={ProfileConnectionsScreen} />
    </ShopStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator();
export function ProfileNavigator() {
  return (
    <ProfileStack.Navigator initialRouteName={Routes.PROFILE_ROOT} screenOptions={screenOptions}>
      <ProfileStack.Screen name={Routes.PROFILE_ROOT} component={ProfileScreen} />
      <ProfileStack.Screen name={Routes.ELEMENTS_VIEWER} component={ElementsViewerScreen} />
      <ProfileStack.Screen name={Routes.USER_CLUSTER} component={UserClusterScreen} />
      <ProfileStack.Screen name={Routes.ORGANIZE_CLUSTER} component={OrganizeClusterScreen} />
      <ProfileStack.Screen name={Routes.USER_PROFILE} component={ProfileScreen} />
      <ProfileStack.Screen name={Routes.PROFILE_CONNECTIONS} component={ProfileConnectionsScreen} />
    </ProfileStack.Navigator>
  );
}

const SearchStack = createNativeStackNavigator();
export function SearchNavigator() {
  return (
    <SearchStack.Navigator initialRouteName={Routes.SEARCH_ROOT} screenOptions={screenOptions}>
      <SearchStack.Screen name={Routes.SEARCH_ROOT} component={SearchScreen} />
      <SearchStack.Screen name={Routes.ELEMENTS_VIEWER} component={ElementsViewerScreen} />
      <SearchStack.Screen name={Routes.USER_CLUSTER} component={UserClusterScreen} />
      <SearchStack.Screen name={Routes.ORGANIZE_CLUSTER} component={OrganizeClusterScreen} />
      <SearchStack.Screen name={Routes.USER_PROFILE} component={ProfileScreen} />
      <SearchStack.Screen name={Routes.PROFILE_CONNECTIONS} component={ProfileConnectionsScreen} />
    </SearchStack.Navigator>
  );
}

const SettingsStack = createNativeStackNavigator();
export function SettingsNavigator() {
  return (
    <SettingsStack.Navigator initialRouteName={Routes.SETTINGS_ROOT} screenOptions={screenOptions}>
      <SettingsStack.Screen name={Routes.SETTINGS_ROOT} component={SettingsScreen} />
    </SettingsStack.Navigator>
  );
}
