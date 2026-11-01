// Cosmos' SettingsScreen (SettingsRoot, no bar): its groups come in step 8. Until then: the server, retry, sign out,
// and a new server address (step 0's placeholder page moved here).
import { useNavigation } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { CloseIcon } from '../../components/icons';
import { serverUrl } from '../../lib/server';
import { useSessionStore } from '../../stores/useSessionStore';

export function SettingsScreen() {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const { offline, start, signOut, changeServer } = useSessionStore();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭" hitSlop={12} onPress={() => navigation.goBack()}>
          <CloseIcon color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.title}>设置</Text>
        <View style={styles.headerSide} />
      </View>
      <View style={styles.body}>
        <Text style={styles.caption}>{serverUrl()}</Text>
        {offline ? <Text style={styles.line}>连不上电脑上的服务</Text> : null}
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
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { width: 24 },
  title: { ...theme.typography.headingMedium, color: theme.colors.primary },
  body: { flex: 1, gap: theme.spacing.xs, paddingTop: theme.spacing.md },
  caption: { ...theme.typography.caption, color: theme.colors.tertiary },
  line: { ...theme.typography.large, color: theme.colors.secondary },
  actions: { gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
}));
