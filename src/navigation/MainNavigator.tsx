// Cosmos' MainNavigator (module 2002): a native stack without headers whose first screen is the tabs (MainTabs); search
// fades in over them (Routes.SEARCH, animation 'fade'), settings is pushed over them. Cosmos' modal screens (crop,
// invite, edit collection, …) and Explore over the tabs come with their steps. After the stack, SheetHosts: the sheets
// any screen opens by name.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SheetHosts } from '../components/sheets/SheetHosts';
import { BottomTabNavigator } from './BottomTabNavigator';
import { Routes } from './routes';
import { SearchNavigator, SettingsNavigator } from './stacks';

const Stack = createNativeStackNavigator();

export function MainNavigator() {
  return (
    <>
    <Stack.Navigator initialRouteName={Routes.MAIN_TABS} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.MAIN_TABS} component={BottomTabNavigator} />
      <Stack.Screen name={Routes.SEARCH} component={SearchNavigator} options={{ animation: 'fade' }} />
      <Stack.Screen name={Routes.SETTINGS} component={SettingsNavigator} />
    </Stack.Navigator>
    <SheetHosts />
    </>
  );
}
