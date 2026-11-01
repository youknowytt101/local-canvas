// Cosmos' ProfileScreen: ProfileInfo and the 个人主页 / 收藏集 tabs come in step 4. Until then: who is signed in, and
// the way to settings (Cosmos has it in the profile's header).
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { TabRootPlaceholder } from '../../components/TabRootPlaceholder';
import { Routes } from '../../navigation/routes';
import { useSessionStore } from '../../stores/useSessionStore';

export function ProfileScreen() {
  const navigation = useNavigation();
  const me = useSessionStore((s) => s.me);
  const offline = useSessionStore((s) => s.offline);
  return (
    <TabRootPlaceholder tab={Routes.PROFILE} title={me?.fullName || `@${me?.username ?? ''}`} note="个人主页在第 4 步做。">
      <Text style={styles.line}>{offline ? '连不上电脑上的服务' : `已登录：@${me?.username ?? ''}`}</Text>
      <Button text="设置" variant="secondary" size="large" fullWidth onPress={() => navigation.navigate(Routes.SETTINGS as never)} style={styles.button} />
    </TabRootPlaceholder>
  );
}

const styles = StyleSheet.create((theme) => ({
  line: { ...theme.typography.large, color: theme.colors.secondary, marginTop: theme.spacing.md },
  button: { marginTop: theme.spacing.lg },
}));
