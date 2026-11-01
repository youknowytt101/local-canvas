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

export function ShareIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M8 6.75L12 2.75L16 6.75M12 3.5V14M8 9.75C7.54 9.75 7.3 9.75 7.11 9.78C5.76 9.95 4.7 11.01 4.53 12.36C4.5 12.55 4.5 12.79 4.5 13.25L4.5 15.45C4.5 17.13 4.5 17.97 4.83 18.61C5.11 19.18 5.57 19.64 6.14 19.92C6.78 20.25 7.62 20.25 9.3 20.25H14.7C16.38 20.25 17.22 20.25 17.86 19.92C18.43 19.64 18.89 19.18 19.17 18.61C19.5 17.97 19.5 17.13 19.5 15.45V13.25C19.5 12.79 19.5 12.55 19.47 12.36C19.3 11.01 18.24 9.95 16.89 9.78C16.7 9.75 16.46 9.75 16 9.75" />
    </Svg>
  );
}

export function MoreIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[5, 12, 19].map((cx) => <Circle key={cx} cx={cx} cy={12} r={2} fill={color} />)}
    </Svg>
  );
}

export function CheckIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M6.35 13L10.36 16.85C12.48 13.3 14.88 10 17.6 6.85" />
    </Svg>
  );
}

export function ChevronUpIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M4.25 14.75L12 7L19.75 14.75" />
    </Svg>
  );
}

export function ChevronLeftIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M14.75 19.75L7 12L14.75 4.25" />
    </Svg>
  );
}

// lucide's arrow-up-right (Cosmos' SourceLabel)
export function ArrowUpRight({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M7 7h10v10M7 17 17 7" />
    </Svg>
  );
}

export function BellIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color, strokeWidth)} d="M15.25 17.25C15.25 19.18 13.79 20.75 12 20.75C10.21 20.75 8.75 19.18 8.75 17.25" />
      <Path {...line(color, strokeWidth)} d="M6 9.25V9.98C6 11.29 5.55 12.56 4.74 13.58L4 14.5V17H20V14.5L19.26 13.58C18.45 12.56 18 11.29 18 9.98V9.25C18 5.94 15.31 3.25 12 3.25C8.69 3.25 6 5.94 6 9.25Z" />
    </Svg>
  );
}

// the home header's logo: six dots in place of Cosmos' wordmark (the user's choice, cosmos-lite HANDOFF 6.59)
export function SixDotsIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[[8.5, 5.5], [15.5, 5.5], [8.5, 12], [15.5, 12], [8.5, 18.5], [15.5, 18.5]].map(([cx, cy]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.9} fill={color} />
      ))}
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
