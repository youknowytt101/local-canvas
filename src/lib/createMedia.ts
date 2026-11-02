// Cosmos' useImageLibraryPicker + useCreateMediaFlow (the create sheet's 照片): the library opens for up to 20 photos
// and videos (allowsEditing false, quality 1, multiple); what the computer will not take is told first
// (CreateMediaValidationDialog: none will do → "N 文件无法上传 · 某些文件太大或不受支持。" 好的; some will not →
// "共 N 个文件中有 M 个不会上传 · 在继续之前，无效文件将从该选择中删除。" 审查 / 继续); then, on the profile, the save
// sheet asks where they go (presentMoveSheetForDraft, CreateSheet.mediaDestination), inside a collection they go there.
// The checks are the computer's (lib/upload.js): JPEG / PNG / GIF / WebP pictures up to 50 MB, MP4 videos.
// The create sheet stays up under the library and the dialog; only once the media will go does it close (continueWithMedia:
// safeDismissSheet(CREATE)), so 审查 / 好的 (closeValidationDialog) and a cancelled library leave the person on the sheet.
// Near Cosmos: the dialog is the system's Alert (Cosmos draws its own Dialog).
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useMoveSheetStore } from '../stores/useMoveSheetStore';
import { showToast } from '../stores/useToastStore';
import { queueUploads, type PickedMedia } from './uploads';

const SELECTION_LIMIT = 20;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const EXT_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4' };

function toMedia(a: ImagePicker.ImagePickerAsset): PickedMedia & { valid: boolean } {
  const name = a.fileName || a.uri.split('/').pop() || 'upload';
  const type = (a.mimeType || EXT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''] || '').toLowerCase();
  const kind = a.type === 'video' || type.startsWith('video/') ? 'video' : 'image';
  const size = a.fileSize ?? 0;
  const valid = kind === 'video' ? type === 'video/mp4' : IMAGE_TYPES.includes(type) && size > 0 && size <= MAX_IMAGE_BYTES;
  return { uri: a.uri, name, size, kind, mimeType: type || null, valid };
}

const ask = (title: string, message: string, buttons: { text: string; style?: 'cancel'; value: string }[]) =>
  new Promise<string>((resolve) => Alert.alert(title, message, buttons.map((b) => ({ text: b.text, style: b.style, onPress: () => resolve(b.value) })), { cancelable: false }));

export async function pickAndUploadMedia(target: { clusterId: string | null; isOnProfile: boolean }, dismissSheet: () => Promise<unknown>) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { Alert.alert('需要许可', '需要访问相机胶卷的权限！'); return; }
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], allowsEditing: false, quality: 1, allowsMultipleSelection: true, selectionLimit: SELECTION_LIMIT,
    });
  } catch {
    Alert.alert('错误', '无法选择图像。 请再试一次。');
    return;
  }
  if (result.canceled || !result.assets.length) return;
  const picked = result.assets.map(toMedia);
  const valid = picked.filter((m) => m.valid).map(({ valid: _, ...m }) => m);
  const invalid = picked.length - valid.length;
  if (!valid.length) {
    await ask(`${invalid} 文件无法上传`, '某些文件太大或不受支持。', [{ text: '好的', value: 'ok' }]);
    return;
  }
  if (invalid) {
    const answer = await ask(`${picked.length} 个文件中有 ${invalid} 个不会上传`, '在继续之前，无效文件将从该选择中删除。', [
      { text: '审查', style: 'cancel', value: 'review' }, { text: '继续', value: 'go' },
    ]);
    if (answer === 'review') return;
  }
  await dismissSheet();
  if (target.isOnProfile) {
    useMoveSheetStore.getState().openDestination({
      onChoose: (c) => { queueUploads(valid, c?.id ?? null); showToast({ text: `正在上传 ${valid.length} 个元素至${c ? c.name : '个人资料'}` }); },
    });
  } else {
    queueUploads(valid, target.clusterId);
    showToast({ text: `正在上传 ${valid.length} 个元素` });
  }
}
