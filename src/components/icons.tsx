// Cosmos iOS 2.64's icons (the person's choice, instead of the Android app's): each is its drawings at the sizes iOS has
// (18, 24, 28), and the one nearest the size asked is used, so a small icon keeps its heavier line. Three iOS does not have:
// UserRound (lucide's; iOS' icon-avatar is a photo), PauseIcon, and QuadDotsIcon (the colour search's dots, Cosmos' Android
// drawing; iOS' 24x24-grid is another icon, GridIcon).
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { IosIcon } from './IosIcon';
import type { IosIconName } from './iosIconData';

export type IconProps = { color: string; size?: number; style?: StyleProp<ViewStyle> };
type FocusIconProps = IconProps & { focused?: boolean };

const nearest = (size: number, names: IosIconName[]) =>
  names.reduce((a, b) => (Math.abs(parseInt(b, 10) - size) < Math.abs(parseInt(a, 10) - size) ? b : a));

const icon = (...names: IosIconName[]) =>
  function Icon({ color, size = 24, style }: IconProps) {
    return <IosIcon name={nearest(size, names)} color={color} size={size} style={style} />;
  };

const focusIcon = (idle: IosIconName[], focused: IosIconName[]) =>
  function Icon({ color, size = 24, focused: on }: FocusIconProps) {
    return <IosIcon name={nearest(size, on ? focused : idle)} color={color} size={size} />;
  };

export const HomeIcon = focusIcon(['24x24-home-inactive', '28x28-home-inactive'], ['24x24-home-active', '28x28-home-active']);
export const GlobeIcon = icon('24x24-globe', '28x28-globe');
export const ShopIcon = focusIcon(['18x18-shop', '24x24-shop'], ['18x18-shop-filled', '24x24-shop-filled']);
export const SearchIcon = icon('18x18-search', '24x24-search', '28x28-search');
export const CloseIcon = icon('18x18-close', '24x24-close');
export const PlusIcon = icon('18x18-plus', '24x24-plus');
export const ShareIcon = icon('24x24-share');
export const MoreIcon = icon('24x24-overflow');
export const CheckIcon = icon('18x18-checkmark', '24x24-checkmark');
export const ChevronUpIcon = icon('18x18-chevron-up', '24x24-chevron-up');
export const ChevronDownIcon = icon('18x18-chevron-down', '24x24-chevron-down');
export const ChevronLeftIcon = icon('18x18-chevron-left', '24x24-chevron-left');
export const ChevronRightIcon = icon('18x18-chevron-right', '24x24-chevron-right');
export const ArrowUpRight = icon('18x18-external-link', '24x24-link-arrow');
export const SettingsIcon = icon('24x24-settings');
export const GearIcon = SettingsIcon;
export const BellIcon = icon('24x24-bell');
export const SixDotsIcon = icon('24x24-cosmos');
export const OrganizeIcon = icon('24x24-organize');
export const MagicSearchIcon = icon('24x24-search-similar');
export const MoveIcon = icon('24x24-move');
export const TrashIcon = icon('24x24-trash');
export const ClockIcon = icon('24x24-clock');
export const CameraRollIcon = icon('24x24-camera-roll');
export const LinkIcon = icon('24x24-link');
export const ALargeIcon = icon('24x24-text');
export const SlidersIcon = icon('24x24-sliders');
export const FilterIcon = SlidersIcon;
export const EyeOffIcon = icon('24x24-eye-off');
export const VoiceIcon = icon('24x24-wave');
export const BlockedUserIcon = icon('24x24-block');
export const SignOutIcon = icon('24x24-sign-out');
export const SystemAppearanceIcon = icon('18x18-system');
export const LightAppearanceIcon = icon('18x18-light');
export const DarkAppearanceIcon = icon('18x18-dark');
export const PinIcon = icon('18x18-pin-filled');
export const EditIcon = icon('24x24-edit');
export const UserPlusIcon = icon('18x18-user-plus', '24x24-user-plus');
export const GridIcon = icon('24x24-grid');
export const FlagIcon = icon('24x24-flag');
export const PlayIcon = icon('24x24-play');
export const MuteIcon = icon('24x24-mute');
export const UnmuteIcon = icon('24x24-unmute');
export const Heading1Icon = icon('h1');
export const Heading2Icon = icon('h2');
export const BoldIcon = icon('bold');
export const ItalicIcon = icon('italic');
export const UnderlineIcon = icon('underline');
export const ListIcon = icon('unordered-list');

// iOS' 18x18-verified-profile-badge (its outline and tick; the PDF's shine is left out) with Cosmos' gradient
export function VerifiedProfileIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Defs>
        <LinearGradient id="verified" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD824" />
          <Stop offset="1" stopColor="#DCAA00" />
        </LinearGradient>
      </Defs>
      <Path d="M8.999 1.593C10.389 1.593 11.603 2.411 12.153 3.605C12.243 3.598 12.334 3.594 12.426 3.594C14.323 3.594 15.893 5.119 15.893 7.041C15.893 7.771 15.667 8.444 15.282 8.997C15.667 9.551 15.893 10.223 15.893 10.953C15.893 12.876 14.322 14.401 12.426 14.401C12.335 14.401 12.244 14.397 12.155 14.39C11.605 15.586 10.39 16.405 8.999 16.405C7.612 16.405 6.401 15.591 5.849 14.401L5.573 14.401C3.675 14.401 2.106 12.875 2.106 10.954C2.106 10.225 2.332 9.552 2.717 8.998C2.332 8.445 2.106 7.772 2.106 7.042C2.106 5.12 3.675 3.594 5.573 3.594C5.665 3.594 5.756 3.598 5.845 3.605C6.396 2.411 7.61 1.593 8.999 1.593Z" fill="url(#verified)" />
      <Path d="M5.639 9.664L7.954 11.88C9.175 9.836 10.554 7.935 12.119 6.12" fill="none" stroke="#FFFFFF" strokeWidth={1.312} strokeLinejoin="round" />
    </Svg>
  );
}

export function UserRound({ color, size = 24 }: IconProps) {
  const line = { stroke: color, strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...line} cx="12" cy="8" r="5" />
      <Path {...line} d="M20 21a8 8 0 0 0-16 0" />
    </Svg>
  );
}

export function PauseIcon({ color, size = 24 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M7 4h3v16H7zM14 4h3v16h-3z" fill={color} /></Svg>;
}

// Cosmos' QuadDotsIcon (components/QuadDotsIcon.js): eight dots round a ring, each its own colour unless one is given
// (the search field's colour search button; tertiary when search is disabled)
const QUAD_DOTS: [number, number, string][] = [
  [7.06999, 16.8488, '#1896FD'], [16.9313, 16.9557, '#D572D0'], [7.06999, 7.151, '#72B481'], [16.9313, 7.04407, '#A65C23'],
  [19.1501, 11.7023, '#AE043C'], [12.0007, 4.8385, '#F5AD19'], [4.84929, 11.7023, '#54CFD1'], [11.9997, 19.1613, '#6D50FE'],
];
export function QuadDotsIcon({ color, size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {QUAD_DOTS.map(([cx, cy, fill]) => <Ellipse key={`${cx},${cy}`} cx={cx} cy={cy} rx={1.84929} ry={1.8385} fill={color ?? fill} />)}
    </Svg>
  );
}
