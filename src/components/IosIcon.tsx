// One of Cosmos iOS 2.64's icons, as it is drawn there (iosIconData, converted from the app's vector PDFs and SVGs): the
// line's weight is part of the drawing, so it scales with the size; black in the drawing takes `color`, other colours stay.
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Path } from 'react-native-svg';
import { IOS_ICONS, type IosIconClip, type IosIconName, type IosIconPath } from './iosIconData';

function shape(p: IosIconPath, color: string, key: number) {
  return (
    <Path
      key={key}
      d={p.d}
      fill={p.f ?? color}
      fillRule={p.r ? 'evenodd' : undefined}
      clipRule={p.r ? 'evenodd' : undefined}
      stroke={p.w == null ? undefined : p.s ?? color}
      strokeWidth={p.w}
      strokeLinecap={p.c}
      strokeLinejoin={p.j}
      clipPath={p.k ? `url(#${p.k})` : undefined}
    />
  );
}

const clip = (c: IosIconClip, color: string) => (
  <ClipPath key={c.id} id={c.id}>{c.p.map((p, i) => shape(p, color, i))}</ClipPath>
);

export function IosIcon({ name, color, size = 24, style }: { name: IosIconName; color: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const icon = IOS_ICONS[name];
  return (
    <Svg width={size} height={size * (icon.h / icon.w)} viewBox={`0 0 ${icon.w} ${icon.h}`} style={style}>
      {icon.clips ? <Defs>{icon.clips.map((c) => clip(c, color))}</Defs> : null}
      {icon.p.map((p, i) => shape(p, color, i))}
    </Svg>
  );
}
