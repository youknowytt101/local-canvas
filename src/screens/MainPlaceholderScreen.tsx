// Step 0 only: proves the server, the sign-in and the theme work end to end. Step 1 puts the tabs here.
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '../components/Button';
import { serverUrl } from '../lib/server';
import { useSessionStore } from '../stores/useSessionStore';

export function MainPlaceholderScreen() {
  const { me, offline, start, signOut, changeServer } = useSessionStore();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>本地画布</Text>
        <Text style={styles.line}>{offline ? '连不上电脑上的服务' : `已登录：@${me?.username ?? ''}`}</Text>
        <Text style={styles.caption}>{serverUrl()}</Text>
      </View>
      <View style={styles.actions}>
        {offline ? <Button text="重试" onPress={start} fullWidth size="large" /> : null}
        <Button text="退出登录" onPress={signOut} variant="secondary" fullWidth size="large" />
        <Button text="改服务器地址" onPress={changeServer} variant="outline" fullWidth size="large" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.xl },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.xs },
  title: { ...theme.typography.headingLarge, color: theme.colors.primary },
  line: { ...theme.typography.large, color: theme.colors.secondary },
  caption: { ...theme.typography.caption, color: theme.colors.tertiary },
  actions: { gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
}));
