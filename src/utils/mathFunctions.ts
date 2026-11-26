/**
 * Unified Zero-Eval-Safe Mathematical, Easing, Waveform, Shaping, Noise & Physics Function Library
 * Shared across Stop Motion v3, Pixel Engine v3, EVO 3D, Three.js, and Hybrid Engines.
 */

export type UnifiedEasingName =
  | 'linear'
  | 'in'
  | 'out'
  | 'inOut'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInQuint'
  | 'easeOutQuint'
  | 'easeInOutQuint'
  | 'easeInSine'
  | 'easeOutSine'
  | 'easeInOutSine'
  | 'exponential'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  | 'easeInCirc'
  | 'easeOutCirc'
  | 'easeInOutCirc'
  | 'bounce'
  | 'easeInBounce'
  | 'easeOutBounce'
  | 'easeInOutBounce'
  | 'elastic'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic'
  | 'back'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeInOutBack';

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
}

export function applyUnifiedEasing(rawT: number, ease: string = 'linear'): number {
  const t = Math.min(Math.max(rawT, 0), 1);
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;
  const c4 = (2 * Math.PI) / 3;
  const c5 = (2 * Math.PI) / 4.5;

  switch (ease) {
    case 'easeInQuad':
      return t * t;
    case 'easeOutQuad':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOutQuad':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'in':
    case 'easeIn':
    case 'easeInCubic':
      return t * t * t;
    case 'out':
    case 'easeOut':
    case 'easeOutCubic':
      return 1 - Math.pow(1 - t, 3);
    case 'inOut':
    case 'easeInOut':
    case 'easeInOutCubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'easeInQuart':
      return t * t * t * t;
    case 'easeOutQuart':
      return 1 - Math.pow(1 - t, 4);
    case 'easeInOutQuart':
      return t < 0.5 ? 8 * Math.pow(t, 4) : 1 - Math.pow(-2 * t + 2, 4) / 2;
    case 'easeInQuint':
      return Math.pow(t, 5);
    case 'easeOutQuint':
      return 1 - Math.pow(1 - t, 5);
    case 'easeInOutQuint':
      return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2;
    case 'easeInSine':
      return 1 - Math.cos((t * Math.PI) / 2);
    case 'easeOutSine':
      return Math.sin((t * Math.PI) / 2);
    case 'easeInOutSine':
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case 'easeInExpo':
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 'exponential':
    case 'easeOutExpo':
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 'easeInOutExpo':
      if (t === 0 || t === 1) return t;
      return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    case 'easeInCirc':
      return 1 - Math.sqrt(Math.max(0, 1 - t * t));
    case 'easeOutCirc':
      return Math.sqrt(Math.max(0, 1 - Math.pow(t - 1, 2)));
    case 'easeInOutCirc':
      return t < 0.5
        ? (1 - Math.sqrt(Math.max(0, 1 - Math.pow(2 * t, 2)))) / 2
        : (Math.sqrt(Math.max(0, 1 - Math.pow(-2 * t + 2, 2))) + 1) / 2;
    case 'backIn':
    case 'easeInBack':
      return c3 * t * t * t - c1 * t * t;
    case 'back':
    case 'backOut':
    case 'easeOutBack':
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    case 'backInOut':
    case 'easeInOutBack':
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    case 'easeInElastic':
      if (t === 0 || t === 1) return t;
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    case 'elastic':
    case 'easeOutElastic':
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    case 'easeInOutElastic':
      if (t === 0 || t === 1) return t;
      return t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
    case 'easeInBounce':
      return 1 - bounceOut(1 - t);
    case 'bounce':
    case 'easeOutBounce':
      return bounceOut(t);
    case 'easeInOutBounce':
      return t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2;
    case 'linear':
    default:
      return t;
  }
}

function hash1D(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise1D(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1D(i) * (1 - u) + hash1D(i + 1) * u;
}

export const UNIFIED_MATH_FUNCS: Record<string, (...args: number[]) => number> = {
  // Trigonometry & Angles
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  sinh: (x) => Math.sinh(Math.max(-10, Math.min(10, x))),
  cosh: (x) => Math.cosh(Math.max(-10, Math.min(10, x))),
  tanh: (x) => Math.tanh(x),
  asin: (x) => Math.asin(Math.max(-1, Math.min(1, x))),
  acos: (x) => Math.acos(Math.max(-1, Math.min(1, x))),
  atan: (x) => Math.atan(x),
  atan2: (y, x) => Math.atan2(y, x),
  sec: (x) => {
    const c = Math.cos(x);
    return Math.abs(c) < 1e-6 ? 0 : 1 / c;
  },
  csc: (x) => {
    const s = Math.sin(x);
    return Math.abs(s) < 1e-6 ? 0 : 1 / s;
  },
  cot: (x) => {
    const s = Math.sin(x);
    return Math.abs(s) < 1e-6 ? 0 : Math.cos(x) / s;
  },
  sinc: (x) => (Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x),
  deg2rad: (d) => (d * Math.PI) / 180,
  deg: (d) => (d * Math.PI) / 180,
  rad2deg: (r) => (r * 180) / Math.PI,
  rad: (r) => (r * 180) / Math.PI,
  wrapangle: (a) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI,
  anglediff: (a, b) => {
    const d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return d < -Math.PI ? d + Math.PI * 2 : d;
  },

  // Arithmetic, Powers & Logs
  abs: (x) => Math.abs(x),
  sqrt: (x) => Math.sqrt(Math.max(0, x)),
  cbrt: (x) => Math.cbrt(x),
  pow: (a, b) => Math.pow(a, b),
  exp: (x) => Math.exp(Math.max(-30, Math.min(15, x))),
  exp2: (x) => Math.pow(2, Math.max(-30, Math.min(15, x))),
  log: (x) => Math.log(Math.max(1e-9, x)),
  log2: (x) => Math.log2(Math.max(1e-9, x)),
  log10: (x) => Math.log10(Math.max(1e-9, x)),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  sum: (...args) => args.reduce((acc, v) => acc + v, 0),
  avg: (...args) => (args.length ? args.reduce((acc, v) => acc + v, 0) / args.length : 0),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  trunc: (x) => Math.trunc(x),
  sign: (x) => Math.sign(x),
  mod: (a, b) => (b === 0 ? 0 : ((a % b) + b) % b),
  fract: (x) => x - Math.floor(x),
  hypot: (x, y) => Math.hypot(x, y),
  hyp: (x, y) => Math.hypot(x, y),

  // Shaping & Interpolation
  step: (edge, x) => (x < edge ? 0 : 1),
  linstep: (e0, e1, x) => Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1))),
  clamp: (v, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi),
  clamp01: (v) => Math.min(Math.max(v, 0), 1),
  saturate: (v) => Math.min(Math.max(v, 0), 1),
  lerp: (a, b, t) => a + (b - a) * t,
  mix: (a, b, t) => a + (b - a) * t,
  invlerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
  remap: (v, inMin, inMax, outMin, outMax) => {
    const u = inMax === inMin ? 0 : (v - inMin) / (inMax - inMin);
    return outMin + (outMax - outMin) * u;
  },
  smoothstep: (x, e0 = 0, e1 = 1) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0 || 1), 0), 1);
    return t * t * (3 - 2 * t);
  },
  smootherstep: (x, e0 = 0, e1 = 1) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0 || 1), 0), 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  },
  gain: (x, k = 2) => {
    const u = Math.max(0, Math.min(1, x));
    const a = 0.5 * Math.pow(2 * (u < 0.5 ? u : 1 - u), k);
    return u < 0.5 ? a : 1 - a;
  },
  bias: (x, b = 0.5) => {
    const u = Math.max(1e-6, Math.min(1, x));
    return Math.pow(u, Math.log(Math.max(1e-4, Math.min(0.9999, b))) / Math.log(0.5));
  },
  impulse: (k, x) => {
    const h = k * x;
    return h * Math.exp(1 - h);
  },
  expimpulse: (k, x) => {
    const h = k * Math.max(0, x);
    return h * Math.exp(1 - h);
  },
  parabola: (x, k = 1) => Math.pow(4 * x * (1 - x), k),
  cubicpulse: (c, w, x) => {
    const d = Math.abs(x - c);
    if (d > w) return 0;
    const u = d / (w || 1);
    return 1 - u * u * (3 - 2 * u);
  },
  sincpulse: (x, k = 4) => {
    const a = Math.PI * (k * x - 1);
    return Math.abs(a) < 1e-6 ? 1 : Math.sin(a) / a;
  },
  gaussian: (x, mu = 0, sigma = 1) => {
    const z = (x - mu) / (sigma || 1);
    return Math.exp(-0.5 * z * z);
  },
  bell: (x, sigma = 0.25) => {
    const z = (x - 0.5) / (sigma || 0.25);
    return Math.exp(-0.5 * z * z);
  },
  sigmoid: (x, k = 1) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, k * x)))),

  // All Easing Functions
  easein: (t) => applyUnifiedEasing(t, 'easeIn'),
  easeout: (t) => applyUnifiedEasing(t, 'easeOut'),
  easeinout: (t) => applyUnifiedEasing(t, 'easeInOut'),
  easeinquad: (t) => applyUnifiedEasing(t, 'easeInQuad'),
  easeoutquad: (t) => applyUnifiedEasing(t, 'easeOutQuad'),
  easeinoutquad: (t) => applyUnifiedEasing(t, 'easeInOutQuad'),
  easeincubic: (t) => applyUnifiedEasing(t, 'easeInCubic'),
  easeoutcubic: (t) => applyUnifiedEasing(t, 'easeOutCubic'),
  easeinoutcubic: (t) => applyUnifiedEasing(t, 'easeInOutCubic'),
  easeinquart: (t) => applyUnifiedEasing(t, 'easeInQuart'),
  easeoutquart: (t) => applyUnifiedEasing(t, 'easeOutQuart'),
  easeinoutquart: (t) => applyUnifiedEasing(t, 'easeInOutQuart'),
  easeinquint: (t) => applyUnifiedEasing(t, 'easeInQuint'),
  easeoutquint: (t) => applyUnifiedEasing(t, 'easeOutQuint'),
  easeinoutquint: (t) => applyUnifiedEasing(t, 'easeInOutQuint'),
  easeinsine: (t) => applyUnifiedEasing(t, 'easeInSine'),
  easeoutsine: (t) => applyUnifiedEasing(t, 'easeOutSine'),
  easeinoutsine: (t) => applyUnifiedEasing(t, 'easeInOutSine'),
  easeinexpo: (t) => applyUnifiedEasing(t, 'easeInExpo'),
  easeoutexpo: (t) => applyUnifiedEasing(t, 'easeOutExpo'),
  easeinoutexpo: (t) => applyUnifiedEasing(t, 'easeInOutExpo'),
  easeincirc: (t) => applyUnifiedEasing(t, 'easeInCirc'),
  easeoutcirc: (t) => applyUnifiedEasing(t, 'easeOutCirc'),
  easeinoutcirc: (t) => applyUnifiedEasing(t, 'easeInOutCirc'),
  backin: (t) => applyUnifiedEasing(t, 'backIn'),
  easeinback: (t) => applyUnifiedEasing(t, 'easeInBack'),
  backout: (t) => applyUnifiedEasing(t, 'backOut'),
  easeoutback: (t) => applyUnifiedEasing(t, 'easeOutBack'),
  backinout: (t) => applyUnifiedEasing(t, 'backInOut'),
  easeinoutback: (t) => applyUnifiedEasing(t, 'easeInOutBack'),
  easeinelastic: (t) => applyUnifiedEasing(t, 'easeInElastic'),
  easeoutelastic: (t) => applyUnifiedEasing(t, 'easeOutElastic'),
  easeinoutelastic: (t) => applyUnifiedEasing(t, 'easeInOutElastic'),
  easeinbounce: (t) => applyUnifiedEasing(t, 'easeInBounce'),
  easeoutbounce: (t) => applyUnifiedEasing(t, 'easeOutBounce'),
  easeinoutbounce: (t) => applyUnifiedEasing(t, 'easeInOutBounce'),

  // Waveforms & Oscillators
  pingpong: (t) => {
    const m = ((t % 1) + 1) % 1;
    return 1 - Math.abs(m * 2 - 1);
  },
  bounce: (t, count = 1) => Math.abs(Math.sin(t * Math.PI * count)),
  wave: (t, min = -1, max = 1, freq = 1) =>
    min + (max - min) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * freq)),
  sine01: (t, freq = 1, phase = 0) => 0.5 + 0.5 * Math.sin((t * freq + phase) * Math.PI * 2),
  cos01: (t, freq = 1, phase = 0) => 0.5 + 0.5 * Math.cos((t * freq + phase) * Math.PI * 2),
  saw: (t, freq = 1) => {
    const p = ((t * freq) % 1 + 1) % 1;
    return p * 2 - 1;
  },
  sawtooth: (t, freq = 1) => ((t * freq) % 1 + 1) % 1,
  tri: (t, freq = 1) => {
    const p = ((t * freq) % 1 + 1) % 1;
    return 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25));
  },
  triangle: (t, freq = 1) => 1 - Math.abs((((t * freq) % 1 + 1) % 1) * 2 - 1),
  square: (t, freq = 1, duty = 0.5) => ((((t * freq) % 1 + 1) % 1) < duty ? 1 : -1),
  pwm: (t, freq = 1, duty = 0.5) => ((((t * freq) % 1 + 1) % 1) < duty ? 1 : 0),
  pulsewave: (t, freq = 1, duty = 0.5) => ((((t * freq) % 1 + 1) % 1) < duty ? 1 : 0),
  blink: (t, freq = 2) => (Math.floor(t * freq * 2) % 2 === 0 ? 1 : 0),
  strobe: (t, freq = 6) => (Math.floor(t * freq) % 2 === 0 ? 1 : 0.15),

  // Noise, Hash & Random
  hash: (n) => hash1D(n),
  rand: (seed = 1) => hash1D(seed),
  randrange: (seed, lo = 0, hi = 1) => lo + (hi - lo) * hash1D(seed),
  noise: (x) => noise1D(x),
  perlin1d: (x) => noise1D(x) * 2 - 1,
  fbm: (x, octaves = 4) => {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    const oct = Math.max(1, Math.min(8, Math.round(octaves)));
    for (let o = 0; o < oct; o += 1) {
      val += amp * noise1D(x * freq);
      freq *= 2.02;
      amp *= 0.5;
    }
    return val;
  },
  turbulence: (x, octaves = 4) => {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    const oct = Math.max(1, Math.min(8, Math.round(octaves)));
    for (let o = 0; o < oct; o += 1) {
      val += amp * Math.abs(noise1D(x * freq) * 2 - 1);
      freq *= 2.04;
      amp *= 0.5;
    }
    return val;
  },
  ridges: (x, octaves = 4) => {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    const oct = Math.max(1, Math.min(8, Math.round(octaves)));
    for (let o = 0; o < oct; o += 1) {
      const n = 1 - Math.abs(noise1D(x * freq) * 2 - 1);
      val += amp * n * n;
      freq *= 2.05;
      amp *= 0.5;
    }
    return val;
  },
  voronoi1d: (x) => {
    const i = Math.floor(x);
    let minD = 9;
    for (let k = -1; k <= 1; k += 1) {
      const cellPt = i + k + hash1D(i + k);
      minD = Math.min(minD, Math.abs(cellPt - x));
    }
    return minD;
  },
  cellular: (x, y = 0) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let minD = 9;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const px = ix + dx + hash1D((ix + dx) * 19.3 + (iy + dy) * 7.1);
        const py = iy + dy + hash1D((ix + dx) * 31.7 + (iy + dy) * 53.9);
        minD = Math.min(minD, Math.hypot(px - x, py - y));
      }
    }
    return minD;
  },

  // Kinematics, Orbits, Physics & Collisions
  gravity: (t, g = 520, v0 = 0, y0 = 0) => y0 + v0 * t + 0.5 * g * t * t,
  projectilex: (t, vx = 100, x0 = 0) => x0 + vx * t,
  projectiley: (t, vy = -200, g = 520, y0 = 0) => y0 + vy * t + 0.5 * g * t * t,
  bouncepos: (t, height = 120, bounces = 3, decay = 0.68) => {
    const phase = Math.max(0, t) * Math.max(1, bounces);
    const idx = Math.floor(phase);
    const f = phase - idx;
    return Math.max(0, height * Math.pow(decay, idx) * 4 * f * (1 - f));
  },
  spring: (t, freq = 3, damp = 3.5) =>
    1 - Math.exp(-damp * Math.max(0, t)) * Math.cos(freq * Math.PI * 2 * Math.max(0, t)),
  dampedsine: (t, amp = 1, freq = 2, damp = 2) =>
    amp * Math.exp(-damp * Math.max(0, t)) * Math.sin(freq * Math.PI * 2 * Math.max(0, t)),
  pendulum: (t, amp = 30, freq = 1, damp = 0) =>
    amp * Math.exp(-damp * Math.max(0, t)) * Math.sin(freq * Math.PI * 2 * Math.max(0, t)),
  orbitx: (t, cx = 0, rx = 1, turns = 1, phase = 0) =>
    cx + Math.cos((t * turns + phase) * Math.PI * 2) * rx,
  orbity: (t, cy = 0, ry = 1, turns = 1, phase = 0) =>
    cy + Math.sin((t * turns + phase) * Math.PI * 2) * ry,
  lissajousx: (t, rx = 1, a = 3, delta = 0) => rx * Math.sin(a * t * Math.PI * 2 + delta),
  lissajousy: (t, ry = 1, b = 2) => ry * Math.sin(b * t * Math.PI * 2),
  aabbhit: (ax, ay, aw, ah, bx, by, bw, bh) =>
    Math.abs(ax - bx) <= (aw + bw) * 0.5 && Math.abs(ay - by) <= (ah + bh) * 0.5 ? 1 : 0,
  recthit: (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by ? 1 : 0,
  circlehit: (ax, ay, ar, bx, by, br) => (Math.hypot(ax - bx, ay - by) <= ar + br ? 1 : 0),
  box3dhit: (ax, ay, az, aw, ah, ad, bx, by, bz, bw, bh, bd) =>
    Math.abs(ax - bx) <= (aw + bw) * 0.5 &&
    Math.abs(ay - by) <= (ah + bh) * 0.5 &&
    Math.abs(az - bz) <= (ad + bd) * 0.5
      ? 1
      : 0,
  spherehit: (ax, ay, az, ar, bx, by, bz, br) =>
    Math.hypot(ax - bx, ay - by, az - bz) <= ar + br ? 1 : 0,
  dist2d: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  dist3d: (ax, ay, az, bx, by, bz) => Math.hypot(ax - bx, ay - by, az - bz),
  dot2d: (ax, ay, bx, by) => ax * bx + ay * by,
  cross2d: (ax, ay, bx, by) => ax * by - ay * bx,
  len2d: (x, y) => Math.hypot(x, y),
  manhattan: (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by),

  // Analytical 2D & 3D Inverse Kinematics (IK) + LookAt Solvers
  ik2d_theta1: (tx, ty, l1 = 1, l2 = 1, bend = 1) => {
    const a = Math.max(1e-4, Math.abs(l1));
    const b = Math.max(1e-4, Math.abs(l2));
    const minD = Math.abs(a - b) + 1e-4;
    const maxD = a + b - 1e-4;
    const rawD = Math.hypot(tx, ty);
    const d = Math.max(minD, Math.min(maxD, rawD || 1e-4));
    const baseAng = Math.atan2(ty, tx);
    const cosAlpha = Math.max(-1, Math.min(1, (d * d + a * a - b * b) / (2 * d * a)));
    const alpha = Math.acos(cosAlpha);
    return baseAng + (bend >= 0 ? -alpha : alpha);
  },
  ik2d_theta2: (tx, ty, l1 = 1, l2 = 1, bend = 1) => {
    const a = Math.max(1e-4, Math.abs(l1));
    const b = Math.max(1e-4, Math.abs(l2));
    const minD = Math.abs(a - b) + 1e-4;
    const maxD = a + b - 1e-4;
    const rawD = Math.hypot(tx, ty);
    const d = Math.max(minD, Math.min(maxD, rawD || 1e-4));
    const cosBeta = Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b)));
    const inner = Math.PI - Math.acos(cosBeta);
    return bend >= 0 ? inner : -inner;
  },
  ik2d_deg1: (tx, ty, l1 = 1, l2 = 1, bend = 1) =>
    (UNIFIED_MATH_FUNCS.ik2d_theta1(tx, ty, l1, l2, bend) * 180) / Math.PI,
  ik2d_deg2: (tx, ty, l1 = 1, l2 = 1, bend = 1) =>
    (UNIFIED_MATH_FUNCS.ik2d_theta2(tx, ty, l1, l2, bend) * 180) / Math.PI,
  ik2d_elbow_x: (tx, ty, l1 = 1, l2 = 1, bend = 1) =>
    Math.cos(UNIFIED_MATH_FUNCS.ik2d_theta1(tx, ty, l1, l2, bend)) * Math.max(1e-4, Math.abs(l1)),
  ik2d_elbow_y: (tx, ty, l1 = 1, l2 = 1, bend = 1) =>
    Math.sin(UNIFIED_MATH_FUNCS.ik2d_theta1(tx, ty, l1, l2, bend)) * Math.max(1e-4, Math.abs(l1)),
  ik3d_mid_x: (ax, ay, az, tx, ty, tz, l1 = 1, l2 = 1, px = 0, py = 1, pz = 0) => {
    const a = Math.max(1e-4, Math.abs(l1));
    const b = Math.max(1e-4, Math.abs(l2));
    const vx = tx - ax;
    const vy = ty - ay;
    const vz = tz - az;
    const rawD = Math.hypot(vx, vy, vz);
    const d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, rawD || 1e-4));
    const invD = rawD > 1e-6 ? 1 / rawD : 1;
    const dx = rawD > 1e-6 ? vx * invD : 1;
    const dy = rawD > 1e-6 ? vy * invD : 0;
    const dz = rawD > 1e-6 ? vz * invD : 0;
    const along = (d * d + a * a - b * b) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - along * along));
    const pDot = (px - ax) * dx + (py - ay) * dy + (pz - az) * dz;
    let ox = px - ax - pDot * dx;
    let oy = py - ay - pDot * dy;
    let oz = pz - az - pDot * dz;
    const oLen = Math.hypot(ox, oy, oz);
    if (oLen < 1e-5) {
      ox = Math.abs(dy) < 0.9 ? 0 : 1;
      oy = Math.abs(dy) < 0.9 ? 1 : 0;
      oz = 0;
      const d2 = ox * dx + oy * dy + oz * dz;
      ox -= d2 * dx;
      oy -= d2 * dy;
      oz -= d2 * dz;
    }
    const nLen = Math.hypot(ox, oy, oz) || 1;
    return ax + dx * along + (ox / nLen) * h;
  },
  ik3d_mid_y: (ax, ay, az, tx, ty, tz, l1 = 1, l2 = 1, px = 0, py = 1, pz = 0) => {
    const a = Math.max(1e-4, Math.abs(l1));
    const b = Math.max(1e-4, Math.abs(l2));
    const vx = tx - ax;
    const vy = ty - ay;
    const vz = tz - az;
    const rawD = Math.hypot(vx, vy, vz);
    const d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, rawD || 1e-4));
    const invD = rawD > 1e-6 ? 1 / rawD : 1;
    const dx = rawD > 1e-6 ? vx * invD : 1;
    const dy = rawD > 1e-6 ? vy * invD : 0;
    const dz = rawD > 1e-6 ? vz * invD : 0;
    const along = (d * d + a * a - b * b) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - along * along));
    const pDot = (px - ax) * dx + (py - ay) * dy + (pz - az) * dz;
    let ox = px - ax - pDot * dx;
    let oy = py - ay - pDot * dy;
    let oz = pz - az - pDot * dz;
    if (Math.hypot(ox, oy, oz) < 1e-5) {
      ox = Math.abs(dy) < 0.9 ? 0 : 1;
      oy = Math.abs(dy) < 0.9 ? 1 : 0;
      oz = 0;
      const d2 = ox * dx + oy * dy + oz * dz;
      ox -= d2 * dx;
      oy -= d2 * dy;
      oz -= d2 * dz;
    }
    const nLen = Math.hypot(ox, oy, oz) || 1;
    return ay + dy * along + (oy / nLen) * h;
  },
  ik3d_mid_z: (ax, ay, az, tx, ty, tz, l1 = 1, l2 = 1, px = 0, py = 1, pz = 0) => {
    const a = Math.max(1e-4, Math.abs(l1));
    const b = Math.max(1e-4, Math.abs(l2));
    const vx = tx - ax;
    const vy = ty - ay;
    const vz = tz - az;
    const rawD = Math.hypot(vx, vy, vz);
    const d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, rawD || 1e-4));
    const invD = rawD > 1e-6 ? 1 / rawD : 1;
    const dx = rawD > 1e-6 ? vx * invD : 1;
    const dy = rawD > 1e-6 ? vy * invD : 0;
    const dz = rawD > 1e-6 ? vz * invD : 0;
    const along = (d * d + a * a - b * b) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - along * along));
    const pDot = (px - ax) * dx + (py - ay) * dy + (pz - az) * dz;
    let ox = px - ax - pDot * dx;
    let oy = py - ay - pDot * dy;
    let oz = pz - az - pDot * dz;
    if (Math.hypot(ox, oy, oz) < 1e-5) {
      ox = Math.abs(dy) < 0.9 ? 0 : 1;
      oy = Math.abs(dy) < 0.9 ? 1 : 0;
      oz = 0;
      const d2 = ox * dx + oy * dy + oz * dz;
      ox -= d2 * dx;
      oy -= d2 * dy;
      oz -= d2 * dz;
    }
    const nLen = Math.hypot(ox, oy, oz) || 1;
    return az + dz * along + (oz / nLen) * h;
  },
  lookat_yaw: (ax, az, tx, tz) => (Math.atan2(tx - ax, tz - az) * 180) / Math.PI,
  lookat_pitch: (ax, ay, az, tx, ty, tz) => {
    const horiz = Math.hypot(tx - ax, tz - az);
    return (-Math.atan2(ty - ay, Math.max(1e-5, horiz)) * 180) / Math.PI;
  },
};
