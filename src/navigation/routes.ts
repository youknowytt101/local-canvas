// Cosmos' route names (module 610, Routes), the ones this app has so far. Later steps add theirs from the same table.
export const Routes = {
  MAIN: 'Main',
  MAIN_TABS: 'MainTabs',
  HOME: 'Home',
  HOME_ROOT: 'HomeRoot',
  EXPLORE: 'Explore',
  EXPLORE_ROOT: 'ExploreRoot',
  SHOP: 'Shop',
  SHOP_ROOT: 'ShopRoot',
  PROFILE: 'Profile',
  PROFILE_ROOT: 'ProfileRoot',
  SEARCH: 'Search',
  SEARCH_ROOT: 'SearchRoot',
  SETTINGS: 'Settings',
  SETTINGS_ROOT: 'SettingsRoot',
  EDIT_PROFILE: 'EditProfile',
  ACCOUNT_DETAILS: 'AccountDetails',
  UPDATE_PASSWORD: 'UpdatePassword',
  CONTENT_FILTERING: 'ContentFiltering',
  BLOCKED_ACCOUNTS: 'BlockedAccounts',
  ALL_ELEMENTS: 'AllElements',
  ELEMENTS_VIEWER: 'ElementsViewer',
  USER_CLUSTER: 'UserCluster',
  ORGANIZE_CLUSTER: 'OrganizeCluster',
  USER_PROFILE: 'UserProfile',
  PROFILE_CONNECTIONS: 'ProfileConnections',
  PROFILE_SEARCH: 'ProfileSearch',
  INFINITE_CANVAS: 'InfiniteCanvas',
  BRAND_PROFILE: 'BrandProfile',
  ACTIVITY: 'Activity',
  SHOP_PRODUCT: 'ShopProduct', // not a Cosmos route: Cosmos opens a product in the viewer, a placeholder product is not an element
} as const;

export type BottomTabRouteName = typeof Routes.HOME | typeof Routes.EXPLORE | typeof Routes.SHOP | typeof Routes.PROFILE;
export const BOTTOM_TAB_ROUTES: readonly BottomTabRouteName[] = [Routes.HOME, Routes.EXPLORE, Routes.SHOP, Routes.PROFILE];
// Cosmos' isBottomTabRouteName (module 1894)
export const isBottomTabRouteName = (name: string): name is BottomTabRouteName => (BOTTOM_TAB_ROUTES as readonly string[]).includes(name);
