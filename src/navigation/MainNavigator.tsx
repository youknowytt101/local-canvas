// Cosmos' MainNavigator (module 2002): a native stack without headers whose first screen is the tabs (MainTabs); search
// fades in over them (Routes.SEARCH, animation 'fade'), settings is pushed over them. Cosmos' modal screens (crop,
// invite, edit collection, …), Explore over the tabs and the sheet hosts come with their steps.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigator } from './BottomTabNavigator';
import { Routes } from './routes';
import { SearchNavigator, SettingsNavigator } from './stacks';

const Stack = createNativeStackNavigator();

export function MainNavigator() {
  return (
    <Stack.Navigator initialRouteName={Routes.MAIN_TABS} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.MAIN_TABS} component={BottomTabNavigator} />
      <Stack.Screen name={Routes.SEARCH} component={SearchNavigator} options={{ animation: 'fade' }} />
      <Stack.Screen name={Routes.SETTINGS} component={SettingsNavigator} />
    </Stack.Navigator>
  );
}
