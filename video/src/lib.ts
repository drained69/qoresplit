import { Easing, interpolate } from 'remotion';

export const C = {
  paper: '#fbf9f4', paper2: '#f3efe5', card: '#ffffff', ink: '#13271c', ink2: '#2b4033', muted: '#5d6b62',
  line: '#e7e1d3', line2: '#d9d2c1', green: '#2f7a3e', greenSoft: '#eaf4e2', lime: '#a6e36e', limeInk: '#2f5d14',
  warn: '#8a5a12', warnBg: '#fbf1dc', bad: '#9b2f25', badBg: '#fdecea', forest: '#10241a',
};
export const SANS = '"Geist Variable", Geist, sans-serif';
export const MONO = '"Geist Mono Variable", "Geist Mono", "DejaVu Sans Mono", monospace';

const smooth = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.16, 1, 0.3, 1);

/** 0 → 1 between frames a and b, eased. */
export const ramp = (f: number, a: number, b: number, kind: 'smooth' | 'out' | 'linear' = 'out') =>
  interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: kind === 'smooth' ? smooth : kind === 'out' ? out : Easing.linear,
  });

/** Visible between `from` and `to`, fading `fade` frames at each end. */
export const window01 = (f: number, from: number, to: number, fade = 10) =>
  Math.min(ramp(f, from, from + fade), 1 - ramp(f, to - fade, to));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Keyframed values with smooth easing: [[frame, value], ...]. */
export function keys(f: number, frames: Array<[number, number]>) {
  if (f <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [f1, v1] = frames[i];
    const [f0, v0] = frames[i - 1];
    if (f <= f1) return lerp(v0, v1, ramp(f, f0, f1, 'smooth'));
  }
  return frames[frames.length - 1][1];
}

/** A number counting up from `from` to `to` over [a, b]. */
export const count = (f: number, a: number, b: number, from: number, to: number) => lerp(from, to, ramp(f, a, b, 'out'));

export const qor = (value: number, digits = 1) => {
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') + ' QOR';
};

/** A pop-in: scale from 0.6 with overshoot, plus fade. */
export const pop = (f: number, at: number, dur = 14) => {
  const t = ramp(f, at, at + dur, 'linear');
  const back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  return { opacity: Math.min(1, t * 3), scale: f < at ? 0.6 : 0.6 + 0.4 * back };
};
