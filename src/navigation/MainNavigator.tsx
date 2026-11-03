// Cosmos' MainNavigator (module 2002): a native stack without headers whose first screen is the tabs (MainTabs); search
// fades in over them (Routes.SEARCH, animation 'fade'), settings is pushed over them. Cosmos' modal screens (crop,
// invite, edit collection, …) and Explore over the tabs come with their steps. After the stack, SheetHosts: the sheets
// any screen opens by name. Signed in, the uploads cut off last time go on (lib/uploads.ts).
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { SheetHosts } from '../components/sheets/SheetHosts';
import { setHasSeenIntro } from '../lib/appearance';
import { resumeUploads } from '../lib/uploads';
import { ChangeCoverScreen } from '../screens/ChangeCoverScreen';
import { AcceptInviteScreen } from '../screens/clusters/AcceptInviteScreen';
import { EditClusterScreen } from '../screens/clusters/EditClusterScreen';
import { SelectClusterElementsScreen } from '../screens/clusters/SelectClusterElementsScreen';
import { CropPictureScreen } from '../screens/CropPictureScreen';
import { BottomTabNavigator } from './BottomTabNavigator';
import { Routes } from './routes';
import { SearchNavigator, SettingsNavigator } from './stacks';

const Stack = createNativeStackNavigator();

export function MainNavigator() {
  useEffect(() => resumeUploads(), []);
  useEffect(() => { setHasSeenIntro(true); }, []);
  // Cosmos' handleDeepLink: the invite link, opened with the app or into it
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  useEffect(() => {
    const open = (url: string | null) => {
      const inviteCode = url?.match(/accept-collaboration\?(?:.*&)?inviteCode=([^&#]+)/)?.[1];
      if (inviteCode) navigation.navigate(Routes.MAIN, { screen: Routes.ACCEPT_INVITE, params: { inviteCode: decodeURIComponent(inviteCode) } });
    };
    void Linking.getInitialURL().then(open);
    const listening = Linking.addEventListener('url', (e) => open(e.url));
    return () => listening.remove();
  }, [navigation]);
  return (
    <>
    <Stack.Navigator initialRouteName={Routes.MAIN_TABS} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.MAIN_TABS} component={BottomTabNavigator} />
      <Stack.Screen name={Routes.SEARCH} component={SearchNavigator} options={{ animation: 'fade' }} />
      <Stack.Screen name={Routes.SETTINGS} component={SettingsNavigator} />
      <Stack.Screen name={Routes.CROP_PROFILE_PICTURE} component={CropPictureScreen} />
      <Stack.Screen name={Routes.EDIT_CLUSTER} component={EditClusterScreen} />
      <Stack.Screen name={Routes.CHANGE_COVER} component={ChangeCoverScreen} />
      <Stack.Screen name={Routes.SELECT_CLUSTER_ELEMENTS} component={SelectClusterElementsScreen} />
      <Stack.Screen name={Routes.ACCEPT_INVITE} component={AcceptInviteScreen} />
    </Stack.Navigator>
    <SheetHosts />
    </>
  );
}
