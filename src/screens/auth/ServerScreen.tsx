// Which computer to talk to (local: Cosmos' app has its server built in). Laid out like the sign-in step; the address is
// checked by asking the server what sign-ins it allows (AuthOptions) before it is kept.
import { useState } from 'react';
import { OnboardingStep } from '../../components/onboarding/OnboardingStep';
import { AuthInput } from '../../components/AuthInput';
import { gql } from '../../lib/auth';
import { normalizeServerUrl, setServerUrl } from '../../lib/server';
import { useSessionStore } from '../../stores/useSessionStore';
import { loadOracle } from '../../theme/fonts';

async function probe(base: string) {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000));
  return Promise.race([gql<{ passwordSignIn: boolean }>('query', 'AuthOptions', 'authOptions', {}, { signedIn: false, base }), timeout]);
}

export function ServerScreen() {
  const start = useSessionStore((s) => s.start);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const base = normalizeServerUrl(address);
    if (!base) return setError('地址不对，例如 192.168.1.5:4870');
    setBusy(true);
    try {
      await probe(base);
      setServerUrl(base);
      void loadOracle();
      await start();
    } catch {
      setError('连不上。电脑上的服务开着吗？手机和电脑在同一个 Wi-Fi 吗？');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStep
      title="连接电脑"
      subtitle={error ?? '填电脑启动服务时显示的“同一网络的设备”地址'}
      subtitleColor={error ? 'alert' : 'default'}
      button={{ text: '继续', onPress: connect, disabled: !address.trim(), loading: busy }}
    >
      <AuthInput
        placeholder="例如 192.168.1.5:4870"
        value={address}
        onChangeText={(t) => { setAddress(t); setError(null); }}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={connect}
      />
    </OnboardingStep>
  );
}
