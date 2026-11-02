// Cosmos' lib/hexToHsv.js and lib/settings/hsvToColorString.js: hex (six digits, no '#') <-> HSV with each of h, s, v
// in 0…1, the way the colour picker keeps them in shared values.

export type Hsv = { h: number; s: number; v: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function normalizeHex(hex: string | null | undefined): string | null {
  const digits = String(hex ?? '').replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(digits) ? digits : null;
}

export function hexToHsv(hex: string): Hsv | null {
  const digits = normalizeHex(hex);
  if (!digits) return null;
  const r = parseInt(digits.slice(0, 2), 16) / 255;
  const g = parseInt(digits.slice(2, 4), 16) / 255;
  const b = parseInt(digits.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  'worklet';
  const hh = (((h % 1) + 1) % 1) * 6;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  const [r, g, b] = i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
  return [Math.round(Math.min(1, Math.max(0, r)) * 255), Math.round(Math.min(1, Math.max(0, g)) * 255), Math.round(Math.min(1, Math.max(0, b)) * 255)];
}

// the picker's live colour (hsvToColorString: a CSS colour for a style)
export function hsvToColorString(h: number, s: number, v: number): string {
  'worklet';
  const [r, g, b] = hsvToRgb(h, s, v);
  return `rgb(${r}, ${g}, ${b})`;
}

export function hsvToHex(h: number, s: number, v: number): string {
  return hsvToRgb(h, clamp01(s), clamp01(v)).map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}
