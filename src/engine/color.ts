/** Linear RGB, each channel 0–1. Brightness is baked in: {0,0,0} is off. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const BLACK: Readonly<Rgb> = Object.freeze({ r: 0, g: 0, b: 0 });
export const WHITE: Readonly<Rgb> = Object.freeze({ r: 1, g: 1, b: 1 });

export const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });

export function hex(code: string): Rgb {
  const n = parseInt(code.replace("#", ""), 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

export const clamp01 = (x: number) =>
  x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0;

export function scale(c: Rgb, k: number): Rgb {
  return { r: c.r * k, g: c.g * k, b: c.b * k };
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Lighten-style blend: each channel takes the brighter of the two. */
export function screenMax(a: Rgb, b: Rgb): Rgb {
  return {
    r: Math.max(a.r, b.r),
    g: Math.max(a.g, b.g),
    b: Math.max(a.b, b.b),
  };
}

export function set(target: Rgb, c: Rgb): void {
  target.r = c.r;
  target.g = c.g;
  target.b = c.b;
}

/** h in turns (0–1, wraps), s and v 0–1. */
export function hsv(h: number, s: number, v: number): Rgb {
  const f = (n: number) => {
    const k = (n + (((h % 1) + 1) % 1) * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5), g: f(3), b: f(1) };
}

export function toHsv({ r, g, b }: Rgb): { h: number; s: number; v: number } {
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  const s = v === 0 ? 0 : d / v;
  let h = 0;
  if (d !== 0) {
    if (v === r) h = ((g - b) / d + 6) % 6;
    else if (v === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: h / 6, s, v };
}

/** The operator's colour knobs: rotate hue (turns) and scale saturation. */
export function adjust(c: Rgb, hueShift: number, saturation: number): Rgb {
  if (hueShift === 0 && saturation === 1) return { ...c };
  const { h, s, v } = toHsv(c);
  return hsv(h + hueShift, clamp01(s * saturation), v);
}
