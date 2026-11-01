// Cosmos' RootNavigator (module 1999): a NavigationContainer themed from the app's colours around a native stack
// without headers, holding the signed-out steps or Main. Here the signed-out steps are the server address and the
// sign-in; Main is step 0's placeholder until the tabs come (step 1).
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { useUnistyles } from 'react-native-unistyles';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ServerScreen } from '../screens/auth/ServerScreen';
import { MainPlaceholderScreen } from '../screens/MainPlaceholderScreen';
import { useSessionStore } from '../stores/useSessionStore';

export type RootStackParamList = { Server: undefined; Login: undefined; Main: undefined };

const Stack = createNativeStackNavigator<RootStackParamList>();

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

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {phase === 'server' ? <Stack.Screen name="Server" component={ServerScreen} /> : null}
        {phase === 'login' ? <Stack.Screen name="Login" component={LoginScreen} /> : null}
        {phase === 'main' ? <Stack.Screen name="Main" component={MainPlaceholderScreen} /> : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
