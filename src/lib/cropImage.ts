// Cosmos' cropImageFromContext (lib/cropImageFromContext.js): the picture is written out once (a JPEG at full quality, so
// what is measured is what is cut), then cut where CropZoom says, scaled by how that file's size differs from the size
// CropZoom was given, resized to outputSize × outputSize and saved at 0.9.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { CropContextResult } from 'react-native-zoom-toolkit';

type Size = { width: number; height: number };

export async function cropImage(imageUri: string, result: CropContextResult, outputSize: number, resolution: Size): Promise<string> {
  const flat = await (await ImageManipulator.manipulate(imageUri).renderAsync()).saveAsync({ compress: 1, format: SaveFormat.JPEG });
  const scaleX = flat.width / (resolution.width || 1);
  const scaleY = flat.height / (resolution.height || 1);
  const context = ImageManipulator.manipulate(flat.uri);
  if (result.context.rotationAngle !== 0) context.rotate(result.context.rotationAngle);
  if (result.context.flipHorizontal) context.flip('horizontal');
  if (result.context.flipVertical) context.flip('vertical');
  if (result.resize) context.resize({ width: Math.max(1, Math.round(result.resize.width)), height: Math.max(1, Math.round(result.resize.height)) });
  const cut = context.crop({
    originX: Math.max(0, Math.round(result.crop.originX * scaleX)),
    originY: Math.max(0, Math.round(result.crop.originY * scaleY)),
    width: Math.max(1, Math.round(result.crop.width * scaleX)),
    height: Math.max(1, Math.round(result.crop.height * scaleY)),
  }).resize({ width: outputSize, height: outputSize });
  const saved = await (await cut.renderAsync()).saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  return saved.uri;
}
