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

// Cosmos' SettingsIcon (filled cog with a 2.6 ring in the middle, as cosmos-lite took it)
export function SettingsIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13.70 3.16L14.44 2.70C14.31 2.49 14.10 2.35 13.86 2.30L13.70 3.16ZM15.32 5.76L14.58 6.23C14.66 6.36 14.78 6.47 14.91 6.54L15.32 5.76ZM15.79 6.04L15.32 6.78C15.46 6.86 15.61 6.91 15.76 6.91L15.79 6.04ZM18.83 6.14L19.49 5.57C19.33 5.39 19.10 5.28 18.86 5.27L18.83 6.14ZM20.50 9.06L21.28 9.47C21.39 9.25 21.41 9.00 21.33 8.77L20.50 9.06ZM19.00 11.89L18.23 11.47C18.16 11.60 18.12 11.74 18.12 11.88L19.00 11.89ZM18.99 12.11L18.12 12.08C18.11 12.23 18.15 12.38 18.22 12.52L18.99 12.11ZM20.50 14.95L21.33 15.23C21.41 15.00 21.39 14.75 21.28 14.54L20.50 14.95ZM18.83 17.86L18.86 18.74C19.10 18.73 19.33 18.62 19.49 18.43L18.83 17.86ZM15.49 17.98L15.46 17.10C15.17 17.11 14.90 17.27 14.75 17.51L15.49 17.98ZM13.70 20.84L13.87 21.70C14.10 21.65 14.31 21.51 14.44 21.30L13.70 20.84ZM10.38 20.85L9.64 21.32C9.77 21.52 9.98 21.67 10.23 21.71L10.38 20.85ZM8.59 17.98L9.33 17.52C9.18 17.27 8.91 17.11 8.62 17.10L8.59 17.98ZM5.17 17.86L4.51 18.43C4.67 18.61 4.90 18.73 5.14 18.73L5.17 17.86ZM3.52 15.03L2.75 14.62C2.64 14.84 2.62 15.10 2.70 15.33L3.52 15.03ZM5.14 12.00L5.91 12.41C6.05 12.16 6.05 11.85 5.91 11.59L5.14 12.00ZM3.52 8.97L2.70 8.68C2.62 8.91 2.64 9.16 2.75 9.38L3.52 8.97ZM5.17 6.15L5.14 5.27C4.89 5.28 4.66 5.39 4.50 5.58L5.17 6.15ZM8.43 6.03L8.46 6.91C8.62 6.90 8.77 6.85 8.90 6.77L8.43 6.03ZM8.67 5.89L9.11 6.64C9.24 6.57 9.34 6.47 9.42 6.35L8.67 5.89ZM10.39 3.15L10.23 2.29C9.99 2.33 9.77 2.47 9.64 2.68L10.39 3.15ZM12 3V3.88C12.52 3.88 13.04 3.93 13.53 4.02L13.70 3.16L13.86 2.30C13.26 2.19 12.64 2.12 12 2.12V3ZM13.70 3.16L12.96 3.62L14.58 6.23L15.32 5.76L16.06 5.30L14.44 2.70L13.70 3.16ZM15.32 5.76L14.91 6.54C15.05 6.61 15.19 6.69 15.32 6.78L15.79 6.04L16.26 5.30C16.09 5.19 15.91 5.09 15.73 4.99L15.32 5.76ZM15.79 6.04L15.76 6.91L18.80 7.02L18.83 6.14L18.86 5.27L15.82 5.16L15.79 6.04ZM18.83 6.14L18.17 6.71C18.82 7.48 19.34 8.37 19.68 9.34L20.50 9.06L21.33 8.77C20.92 7.58 20.29 6.50 19.49 5.57L18.83 6.14ZM20.50 9.06L19.73 8.64L18.23 11.47L19.00 11.89L19.77 12.30L21.28 9.47L20.50 9.06ZM19.00 11.89L18.12 11.88C18.12 11.94 18.12 12.00 18.12 12.08L18.99 12.11L19.87 12.14C19.87 12.07 19.87 11.98 19.87 11.89L19.00 11.89ZM18.99 12.11L18.22 12.52L19.73 15.36L20.50 14.95L21.28 14.54L19.77 11.70L18.99 12.11ZM20.50 14.95L19.68 14.66C19.34 15.63 18.82 16.52 18.16 17.29L18.83 17.86L19.49 18.43C20.29 17.50 20.92 16.42 21.33 15.23L20.50 14.95ZM18.83 17.86L18.79 16.99L15.46 17.10L15.49 17.98L15.52 18.85L18.86 18.74L18.83 17.86ZM15.49 17.98L14.75 17.51L12.96 20.37L13.70 20.84L14.44 21.30L16.23 18.44L15.49 17.98ZM13.70 20.84L13.54 19.98C13.04 20.07 12.52 20.12 12 20.12V21V21.88C12.64 21.88 13.26 21.81 13.87 21.70L13.70 20.84ZM12 21V20.12C11.50 20.12 11.02 20.08 10.54 19.99L10.38 20.85L10.23 21.71C10.80 21.82 11.39 21.88 12 21.88V21ZM10.38 20.85L11.12 20.39L9.33 17.52L8.59 17.98L7.85 18.44L9.64 21.32L10.38 20.85ZM8.59 17.98L8.62 17.10L5.20 16.98L5.17 17.86L5.14 18.73L8.56 18.85L8.59 17.98ZM5.17 17.86L5.84 17.29C5.19 16.54 4.69 15.68 4.35 14.74L3.52 15.03L2.70 15.33C3.11 16.48 3.73 17.52 4.51 18.43L5.17 17.86ZM3.52 15.03L4.30 15.44L5.91 12.41L5.14 12.00L4.37 11.59L2.75 14.62L3.52 15.03ZM5.14 12.00L5.91 11.59L4.30 8.56L3.52 8.97L2.75 9.38L4.37 12.41L5.14 12.00ZM3.52 8.97L4.35 9.26C4.68 8.32 5.19 7.46 5.83 6.72L5.17 6.15L4.50 5.58C3.73 6.48 3.11 7.53 2.70 8.68L3.52 8.97ZM5.17 6.15L5.20 7.02L8.46 6.91L8.43 6.03L8.40 5.16L5.14 5.27L5.17 6.15ZM8.43 6.03L8.90 6.77C8.97 6.73 9.04 6.69 9.11 6.64L8.67 5.89L8.24 5.13C8.15 5.18 8.06 5.24 7.97 5.29L8.43 6.03ZM8.67 5.89L9.42 6.35L11.13 3.61L10.39 3.15L9.64 2.68L7.93 5.42L8.67 5.89ZM10.39 3.15L10.54 4.01C11.02 3.92 11.50 3.88 12 3.88V3V2.12C11.39 2.12 10.80 2.18 10.23 2.29L10.39 3.15Z" fill={color} />
      <Circle cx="12" cy="12" r="2.6" fill="none" stroke={color} strokeWidth={1.75} />
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
