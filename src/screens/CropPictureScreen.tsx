// Cosmos' CropPictureScreen (routes.CropProfilePicture, over the tabs, with useCropPicture and useSaveCoppedImage): the
// settings header with the title (a cover's own, else the avatar's); CropZoom in a square of the window's width less 32,
// rounded borderRadius.xxl; 移动并缩放以裁剪 (caption, tertiary) under it; 保存 (primary, large, the width) at the bottom.
// Saved, the avatar goes back a page; a cover goes back past ChangeCover to whatever opened it (Cosmos pops ChangeCover).
// Near Cosmos: the titles are 裁剪头像 / 裁剪封面 (the pack's are machine words for a plant, 作物…); the picture is sent to
// the server's own routes instead of a signed URL; Cosmos' thin frame over the square has no style of its own to read.
import { StackActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CropZoom, useImageResolution, type CropZoomRefType } from 'react-native-zoom-toolkit';
import { Button } from '../components/Button';
import { SettingsHeader } from '../components/settings/SettingsParts';
import { authFetch } from '../lib/auth';
import { cropImage } from '../lib/cropImage';
import { absoluteUrl } from '../lib/server';
import { useSessionStore } from '../stores/useSessionStore';
import { showToast } from '../stores/useToastStore';

export type CropPictureParams =
  | { mode?: 'profile-avatar'; imageUri: string; title?: string }
  | { mode: 'cluster-cover'; imageUri: string; title?: string; clusterId: string };

export function CropPictureScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useRoute<RouteProp<{ c: CropPictureParams }, 'c'>>().params;
  const size = useWindowDimensions().width - 32;
  const cropRef = useRef<CropZoomRefType>(null);
  const [busy, setBusy] = useState(false);
  const { resolution } = useImageResolution({ uri: params.imageUri });

  const save = async () => {
    if (!cropRef.current || !resolution || busy) return;
    setBusy(true);
    try {
      const uri = await cropImage(params.imageUri, cropRef.current.crop(), Math.round(size), resolution);
      const bytes = await new File(uri).bytes();
      const url = params.mode === 'cluster-cover' ? `/api/clusters/${encodeURIComponent(params.clusterId)}/cover` : '/api/me/photo';
      const res = await authFetch(absoluteUrl(url), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: bytes as unknown as BodyInit });
      const data = await res.json().catch(() => ({})) as { error?: string; avatarUrl?: string | null };
      if (!res.ok) throw new Error(data.error || '裁剪图像失败。 请再试一次。');
      if (params.mode === 'cluster-cover') {
        navigation.dispatch(StackActions.pop(2));
      } else {
        useSessionStore.setState({ me: { ...useSessionStore.getState().me, ...data } as never });
        navigation.goBack();
      }
    } catch (e) {
      showToast({ text: e instanceof Error && e.message ? e.message : '裁剪图像失败。 请再试一次。' }); // errors.cropFailed
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <SettingsHeader title={params.title ?? '裁剪头像'} backgroundColor={theme.colors.elevated} />
      <View style={styles.body}>
        <View style={styles.cropContainer}>
          <View style={[styles.cropOverlay, { width: size, height: size }]}>
            {resolution ? (
              <CropZoom ref={cropRef} cropSize={{ width: size, height: size }} resolution={resolution}>
                <Image source={{ uri: params.imageUri }} style={styles.image} />
              </CropZoom>
            ) : <ActivityIndicator size="large" color={theme.colors.tertiary} />}
          </View>
          <Text style={styles.instruction}>移动并缩放以裁剪</Text>
        </View>
        <View style={{ paddingBottom: insets.bottom + theme.spacing.md }}>
          <Button text="保存" variant="primary" size="large" fullWidth loading={busy} disabled={!resolution} onPress={() => void save()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.elevated },
  body: { flex: 1, paddingHorizontal: theme.spacing.md },
  cropContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cropOverlay: {
    position: 'relative', justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.xxl,
  },
  image: { width: '100%', height: '100%' },
  instruction: { ...theme.typography.caption, color: theme.colors.tertiary, marginTop: theme.spacing.md, textAlign: 'center' },
}));
