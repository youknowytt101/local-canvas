// Cosmos' LoginScreen: 欢迎回来 / 输入您的密码, 电子邮件或用户名 + 密码, 登入 (onboarding.login.*, common.password).
// An error replaces the subtitle in alert (resolveOnboardingSubtitle). Not here: 忘记密码？ (it sends an email, and this
// server sends none) and signing up (a phone may not, HANDOFF 6.138).
import { useState } from 'react';
import { OnboardingStep } from '../../components/onboarding/OnboardingStep';
import { AuthInput } from '../../components/AuthInput';
import { signInWithPassword } from '../../lib/auth';
import { useSessionStore } from '../../stores/useSessionStore';

export function LoginScreen() {
  const signedIn = useSessionStore((s) => s.signedIn);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!identifier.trim()) return setError('请输入邮箱或用户名');
    setBusy(true);
    try {
      await signInWithPassword(identifier.trim(), password);
      await signedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStep
      title="欢迎回来"
      subtitle={error ?? '输入您的密码'}
      subtitleColor={error ? 'alert' : 'default'}
      button={{ text: '登入', onPress: submit, disabled: !identifier.trim() || !password, loading: busy }}
    >
      <AuthInput
        placeholder="电子邮件或用户名"
        value={identifier}
        onChangeText={(t) => { setIdentifier(t); setError(null); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        textContentType="username"
      />
      <AuthInput
        placeholder="密码"
        value={password}
        onChangeText={(t) => { setPassword(t); setError(null); }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
    </OnboardingStep>
  );
}
