import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { serverUrl } from './src/lib/server';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useSessionStore } from './src/stores/useSessionStore';
import { loadOracle } from './src/theme/fonts';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const phase = useSessionStore((s) => s.phase);
  const start = useSessionStore((s) => s.start);

  useEffect(() => {
    // the font comes from the computer: it is not waited for, the system font stands in until it is there
    if (serverUrl()) void loadOracle();
    void start();
  }, [start]);

  useEffect(() => {
    if (phase !== 'boot') void SplashScreen.hideAsync();
  }, [phase]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          {phase === 'boot' ? null : <RootNavigator />}
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
