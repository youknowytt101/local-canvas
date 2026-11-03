// The platforms' marks for the profile's social buttons and the edit page, and the globe for the website: Cosmos iOS 2.64's.
import { IosIcon } from '../IosIcon';
import type { IosIconName } from '../iosIconData';

const MARKS = {
  instagram: '24x24-instagram',
  x: '24x24-twitter',
  tiktok: '24x24-tiktok',
  spotify: '24x24-spotify',
} as const satisfies Record<string, IosIconName>;
export type SocialPlatform = keyof typeof MARKS;

export function SocialIcon({ platform, color, size = 19 }: { platform: SocialPlatform; color: string; size?: number }) {
  return <IosIcon name={MARKS[platform]} color={color} size={size} />;
}

export function GlobalIcon({ color, size = 19 }: { color: string; size?: number }) {
  return <IosIcon name="24x24-globe" color={color} size={size} />;
}
