// Cosmos' RootNavigator (module 1999): a NavigationContainer themed from the app's colours (the status bar follows the
// theme, not the phone) around a native stack without headers, holding the signed-out steps or Main, and DynamicBar
// drawn after the stack (over every screen). Here the signed-out steps are the server address and the sign-in, then
// the steps after signing up (Onboarding). Every navigation change records the focused screen (the deepest focused
// route) for the bar (useBarStore.activeScreen).
import { DarkTheme, DefaultTheme, NavigationContainer, type NavigationState, type PartialState, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { AppToast } from '../components/AppToast';
import { DynamicBar } from '../components/bar/DynamicBar';
import { getHasSeenIntro } from '../lib/appearance';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { IntroScreen } from '../screens/onboarding/IntroScreen';
import { ServerScreen } from '../screens/auth/ServerScreen';
import { setTransitionRoot } from '../lib/viewerTransition';
import { useBarStore } from '../stores/useBarStore';
import { useSessionStore } from '../stores/useSessionStore';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { navigationRef } from './navigationRef';
import { Routes } from './routes';

export type RootStackParamList = { Server: undefined; GetStarted: undefined; Login: undefined; Onboarding: undefined; Main: undefined };

const Stack = createNativeStackNavigator<RootStackParamList>();

type AnyState = NavigationState | PartialState<NavigationState> | undefined;
function focusedRouteName(state: AnyState): string | null {
  let s = state;
  let name: string | null = null;
  while (s?.routes?.length) {
    const route = s.routes[s.index ?? s.routes.length - 1];
    name = route.name;
    s = route.state as AnyState;
  }
  return name;
}

export function RootNavigator() {
  const phase = useSessionStore((s) => s.phase);
  const { theme, rt } = useUnistyles();
  const navTheme = useMemo<Theme>(() => {
    const base = rt.themeName === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: theme.colors.background, card: theme.colors.background, text: theme.colors.primary, border: theme.colors.surfaceBorder, primary: theme.colors.primary },
    };
  }, [theme, rt.themeName]);

  const recordFocused = () => useBarStore.getState().setActiveScreen(focusedRouteName(navigationRef.getRootState()));
  // every screen and nothing over them (not the bar): what a viewer growing out of a tile snapshots (lib/viewerTransition)
  const screens = useRef<View>(null);
  setTransitionRoot(screens);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={recordFocused} onStateChange={recordFocused}>
      <StatusBar style={rt.themeName === 'dark' ? 'light' : 'dark'} />
      <View ref={screens} style={{ flex: 1 }} collapsable={false}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {phase === 'server' ? <Stack.Screen name="Server" component={ServerScreen} /> : null}
          {phase === 'login' && !getHasSeenIntro() ? <Stack.Screen name={Routes.GET_STARTED} component={IntroScreen} /> : null}
          {phase === 'login' ? <Stack.Screen name="Login" component={LoginScreen} /> : null}
          {phase === 'onboarding' ? <Stack.Screen name={Routes.ONBOARDING} component={OnboardingNavigator} /> : null}
          {phase === 'main' ? <Stack.Screen name={Routes.MAIN} component={MainNavigator} /> : null}
        </Stack.Navigator>
      </View>
      {phase === 'main' ? <DynamicBar /> : null}
      <AppToast />
    </NavigationContainer>
  );
}
