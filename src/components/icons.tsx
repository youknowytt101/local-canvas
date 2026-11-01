// Cosmos' icons (24 × 24 view box, a 1.75 line, round caps and joins): the paths cosmos-lite took from the app.
// HomeIcon and ShopIcon fill in when `focused` (the fill is their colour, the line stays); UserRound is lucide's.
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color: string; size?: number; strokeWidth?: number };
type FocusIconProps = IconProps & { focused?: boolean };

const line = (color: string, strokeWidth = 1.75) =>
  ({ stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }) as const;

export function HomeIcon({ color, size = 24, strokeWidth, focused }: FocusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} fill={focused ? color : 'none'} d="M3 12.23V16.2C3 17.88 3 18.72 3.33 19.36C3.61 19.93 4.07 20.39 4.64 20.67C5.28 21 6.12 21 7.8 21H16.2C17.88 21 18.72 21 19.36 20.67C19.93 20.39 20.39 19.93 20.67 19.36C21 18.72 21 17.88 21 16.2V12.23C21 11.36 21 10.93 20.89 10.53C20.79 10.17 20.62 9.84 20.4 9.54C20.15 9.21 19.8 8.94 19.11 8.42L14.91 5.22C13.87 4.42 13.35 4.03 12.77 3.87C12.27 3.74 11.73 3.74 11.23 3.87C10.65 4.03 10.13 4.42 9.09 5.22L4.89 8.42C4.2 8.94 3.85 9.21 3.6 9.54C3.38 9.84 3.21 10.17 3.11 10.53C3 10.93 3 11.36 3 12.23Z" />
    </Svg>
  );
}

export function GlobeIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...line(color, strokeWidth)} cx="12" cy="12" r="9" />
      <Path {...line(color, strokeWidth)} d="M12 3a13 13 0 0 0 0 18 13 13 0 0 0 0-18M3 12h18" />
    </Svg>
  );
}

export function ShopIcon({ color, size = 24, strokeWidth, focused }: FocusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} fill={focused ? color : 'none'} d="M17.43 21.25H6.56C5.34 21.25 4.41 20.16 4.58 18.96L5.99 9.46C6.14 8.48 6.98 7.75 7.97 7.75H16.02C17.01 7.75 17.85 8.48 18 9.46L19.41 18.96C19.58 20.16 18.65 21.25 17.43 21.25Z" />
      <Path {...line(color, strokeWidth)} d="M15.2 7.75V6C15.2 4.21 13.75 2.75 11.95 2.75C10.16 2.75 8.7 4.21 8.7 6V7.75" />
    </Svg>
  );
}

export function SearchIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...line(color, strokeWidth)} cx="10.75" cy="10.75" r="7.5" />
      <Path {...line(color, strokeWidth)} d="M20.25 20.25L16 16" />
    </Svg>
  );
}

export function CloseIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" />
    </Svg>
  );
}

export function PlusIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M12 5V19M5 12H19" />
    </Svg>
  );
}

export function UserRound({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...line(color, strokeWidth)} cx="12" cy="8" r="5" />
      <Path {...line(color, strokeWidth)} d="M20 21a8 8 0 0 0-16 0" />
    </Svg>
  );
}
