import { StopMotionFrame, VectorStopMotionSpec } from '../types/stopMotion';
import type { MathAudioTrackSpec } from './mathAudioSynth';

export type EasingName =
  | 'linear'
  | 'in'
  | 'out'
  | 'inOut'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'exponential'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  | 'bounce'
  | 'easeOutBounce'
  | 'elastic'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'back'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeInOutBack';

export interface StopMotionKeyframe {
  at: number; // 0..1 normalized progress (or >1 treated as frame index)
  x?: number | string;
  y?: number | string;
  z?: number | string;
  rotate?: number | string;
  scale?: number | string;
  scaleX?: number | string;
  scaleY?: number | string;
  skewX?: number | string;
  skewY?: number | string;
  opacity?: number | string;
  ease?: EasingName;
}

export interface StopMotionShadowSpec {
  type?: 'ground' | 'drop';
  groundY?: number;
  dx?: number;
  dy?: number;
  rx?: number;
  ry?: number;
  blur?: number;
  color?: string;
  opacity?: number;
}

export interface StopMotionMotionSpec {
  x?: number | string | [number, number];
  y?: number | string | [number, number];
  z?: number | string | [number, number];
  rotate?: number | string | [number, number];
  scale?: number | string | [number, number];
  scaleX?: number | string | [number, number];
  scaleY?: number | string | [number, number];
  skewX?: number | string | [number, number];
  skewY?: number | string | [number, number];
  opacity?: number | string | [number, number];
  // Expressive kinematic shorthands
  spin?: number; // total degrees rotated over loop
  bob?: number | { amp: number; freq?: number; phase?: number };
  sway?: number | { amp: number; freq?: number; phase?: number };
  pulse?: number | { min?: number; max?: number; freq?: number; phase?: number };
  orbit?: {
    cx?: number;
    cy?: number;
    rx: number;
    ry?: number;
    turns?: number;
    phase?: number;
  };
  squash?: {
    amp?: number;
    freq?: number;
    phase?: number;
  };
}

export interface StopMotionRepeatSpec {
  count: number;
  angleStep?: number;
  startAngle?: number;
  radius?: number | string;
  dx?: number;
  dy?: number;
}

export interface StopMotionAxisDivisionSpec {
  mode?: 'mirrorX' | 'mirrorY' | 'quad' | 'radial';
  count?: number;
  cx?: number;
  cy?: number;
}

export interface StopMotionFollowSpec {
  targetId: string;
  lag?: number; // 0..0.5 time lag in normalized t
  offsetX?: number;
  offsetY?: number;
  inheritRotation?: boolean;
}

export interface StopMotionLiningSpec {
  progress?: number | string; // 0..1 stroke reveal progress
  strokeWidth?: number;
  strokeColor?: string;
  dashLength?: number;
  glow?: boolean;
}

export interface StopMotionPulseSpec {
  minOpacity?: number;
  maxOpacity?: number;
  minScale?: number;
  maxScale?: number;
  freqHz?: number;
  phase?: number;
}

export interface StopMotionPixelTextureSpec {
  width: number;
  height: number;
  x?: number;
  y?: number;
  renderWidth?: number;
  renderHeight?: number;
  palette?: Record<string, string>;
  rows?: string[];
  rle?: string[];
  opacity?: number;
}

export interface StopMotionAssetRefSpec {
  kind: 'stock' | 'upload' | 'generated' | 'image' | 'video' | 'model' | 'audio' | 'file';
  url?: string;
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  preserveAspectRatio?: string;
}

export interface StopMotionThreeDLayerSpec {
  shape: 'cube' | 'sphere' | 'cylinder' | 'torus' | 'pyramid' | 'crystal';
  size?: number;
  rx?: number | string;
  ry?: number | string;
  rz?: number | string;
  color?: string;
  accent?: string;
  reflection?: number; // 0..1
  refraction?: number; // 0..1
  metallic?: number; // 0..1
  wireframe?: boolean;
}

export interface StopMotionCurveSpec {
  type: 'hilbert' | 'dragon' | 'koch' | 'lissajous' | 'spirograph' | 'rose' | 'spiral';
  order?: number; // for hilbert/dragon/koch (1..6)
  size?: number; // bounding box / scale
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  a?: number; // lissajous freq x or spirograph R
  b?: number; // lissajous freq y or spirograph r
  d?: number; // spirograph pen offset
  delta?: number; // lissajous phase radians
  turns?: number;
  petals?: number; // rose k
  samples?: number;
  progress?: number | string; // 0..1 reveal fraction (defaults to 1)
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  closed?: boolean;
  glow?: boolean;
  headDot?: boolean;
  dotColor?: string;
  dotRadius?: number;
  rainbow?: boolean;
}

export interface StopMotionLayerSpec {
  id?: string;
  idLink?: string; // References a reusable group/family in scene.groups
  svg?: string;
  curve?: StopMotionCurveSpec;
  threeD?: StopMotionThreeDLayerSpec;
  pixelTexture?: StopMotionPixelTextureSpec;
  assetRef?: StopMotionAssetRefSpec;
  origin?: [number, number];
  x?: number | string;
  y?: number | string;
  z?: number | string;
  depth?: number; // 0 = foreground, positive = further back
  parallax?: number | { x?: number; y?: number };
  rotate?: number | string;
  scale?: number | string;
  scaleX?: number | string;
  scaleY?: number | string;
  skewX?: number | string;
  skewY?: number | string;
  opacity?: number | string;
  filter?: string;
  blendMode?: string;
  cssStyles?: string;
  visibleFrom?: number;
  visibleTo?: number;
  shadow?: boolean | StopMotionShadowSpec;
  motion?: StopMotionMotionSpec;
  keyframes?: StopMotionKeyframe[];
  repeat?: StopMotionRepeatSpec;
  axisDivision?: StopMotionAxisDivisionSpec;
  follow?: StopMotionFollowSpec;
  lining?: StopMotionLiningSpec;
  pulse?: StopMotionPulseSpec;
  children?: StopMotionLayerSpec[];
}

export interface StopMotionStoryboardShot {
  id?: string;
  label?: string;
  start: number; // normalized 0..1 or seconds if >1 and <= durationSec
  end: number;
  cameraCut?: 'wide' | 'medium' | 'closeup' | 'dutch' | 'tracking' | 'overhead';
  cameraAngle?: {
    panX?: number | string;
    panY?: number | string;
    zoom?: number | string;
    roll?: number | string;
  };
  trackingTarget?: string;
  uiAngle?: {
    title?: string;
    subtitle?: string;
    badge?: string;
    showTimecode?: boolean;
  };
  effect?: 'vignette' | 'chromatic' | 'bloom' | 'grain' | 'none';
}

export interface StopMotionStoryboardSpec {
  script?: string;
  shots: StopMotionStoryboardShot[];
}

export interface StopMotionThreeLightingSpec {
  ambient?: number;
  keyLight?: { x: number; y: number; color?: string; intensity?: number };
  rimColor?: string;
  refraction?: number;
}

export interface StopMotionSceneV2 {
  format?: string;
  title?: string;
  fps?: number;
  frameCount?: number;
  durationSec?: number;
  width?: number;
  height?: number;
  background?: string;
  loop?: boolean;
  pingPong?: boolean;
  defs?: string;
  backdrop?: string;
  foreground?: string;
  groups?: Record<string, StopMotionLayerSpec | StopMotionLayerSpec[]>;
  storyboard?: StopMotionStoryboardSpec;
  threeLighting?: StopMotionThreeLightingSpec;
  audio?: MathAudioTrackSpec;
  layers: StopMotionLayerSpec[];
}

export type StopMotionSceneV3 = StopMotionSceneV2;

export const MAX_PREVIEW_FRAMES = 360;
export const MAX_PRODUCTION_FRAMES = 216_000; // 10 minutes @ 60fps

export const ENGINE_STUDIO_DEFS = `
<defs>
  <!-- Studio Ambient & Cast Shadows -->
  <filter id="studioDropShadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="10" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.32" />
  </filter>
  <filter id="softDropShadow" x="-25%" y="-25%" width="150%" height="150%">
    <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.24" />
  </filter>
  <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="6" result="blur" />
    <feMerge>
      <feMergeNode in="blur" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
  <filter id="neonBloom" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="9" result="blur1" />
    <feGaussianBlur stdDeviation="3" result="blur2" />
    <feMerge>
      <feMergeNode in="blur1" />
      <feMergeNode in="blur2" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
  <filter id="airbrushSoft" x="-35%" y="-35%" width="170%" height="170%">
    <feGaussianBlur stdDeviation="4.2" />
  </filter>
  <filter id="chromaticShift" x="-10%" y="-10%" width="120%" height="120%">
    <feOffset in="SourceGraphic" dx="2" dy="0" result="r" />
    <feOffset in="SourceGraphic" dx="-2" dy="0" result="b" />
    <feBlend in="r" in2="b" mode="screen" />
  </filter>

  <!-- Tactile Surface & Organic Noise -->
  <filter id="tactileOrganicNoise" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" />
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0" result="subtleGrain" />
    <feComposite in="SourceGraphic" in2="subtleGrain" operator="over" />
  </filter>
  <filter id="tactileDoughWarp" x="-25%" y="-25%" width="150%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="3" result="roughNoise" />
    <feDisplacementMap in="SourceGraphic" in2="roughNoise" scale="9.5" xChannelSelector="R" yChannelSelector="G" result="warpedDough" />
    <feGaussianBlur in="warpedDough" stdDeviation="0.6" result="softDough" />
    <feSpecularLighting in="roughNoise" surfaceScale="2.2" specularConstant="0.9" specularExponent="18" lighting-color="#ffffff" result="specularLight">
      <fePointLight x="200" y="80" z="260" />
    </feSpecularLighting>
    <feComposite in="specularLight" in2="SourceGraphic" operator="in" result="specularClay" />
    <feComposite in="softDough" in2="specularClay" operator="arithmetic" k1="0" k2="1" k3="0.4" k4="0" />
  </filter>
  <filter id="tactileSoftEdge">
    <feGaussianBlur stdDeviation="1.5" />
  </filter>

  <!-- Studio Wet Glaze, Glass Refraction & Metallic Materials -->
  <radialGradient id="wetGlazePink" cx="34%" cy="28%" r="66%" fx="30%" fy="22%">
    <stop offset="0%" stop-color="#fbcfe8" stop-opacity="0.96" />
    <stop offset="25%" stop-color="#f43f5e" stop-opacity="0.92" />
    <stop offset="70%" stop-color="#e11d48" stop-opacity="0.9" />
    <stop offset="100%" stop-color="#881337" stop-opacity="0.96" />
  </radialGradient>
  <radialGradient id="wetGlazeCaramel" cx="34%" cy="28%" r="66%" fx="30%" fy="22%">
    <stop offset="0%" stop-color="#fed7aa" stop-opacity="0.96" />
    <stop offset="30%" stop-color="#f59e0b" stop-opacity="0.92" />
    <stop offset="70%" stop-color="#d97706" stop-opacity="0.9" />
    <stop offset="100%" stop-color="#78350f" stop-opacity="0.96" />
  </radialGradient>
  <radialGradient id="wetGlazeCyan" cx="34%" cy="28%" r="66%" fx="30%" fy="22%">
    <stop offset="0%" stop-color="#cffafe" stop-opacity="0.96" />
    <stop offset="28%" stop-color="#06b6d4" stop-opacity="0.92" />
    <stop offset="70%" stop-color="#0284c7" stop-opacity="0.9" />
    <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0.96" />
  </radialGradient>
  <radialGradient id="metallicGold" cx="34%" cy="28%" r="70%" fx="28%" fy="22%">
    <stop offset="0%" stop-color="#fef9c3" />
    <stop offset="35%" stop-color="#eab308" />
    <stop offset="75%" stop-color="#a16207" />
    <stop offset="100%" stop-color="#713f12" />
  </radialGradient>
  <radialGradient id="metallicSteel" cx="34%" cy="28%" r="70%" fx="28%" fy="22%">
    <stop offset="0%" stop-color="#f8fafc" />
    <stop offset="35%" stop-color="#94a3b8" />
    <stop offset="75%" stop-color="#475569" />
    <stop offset="100%" stop-color="#1e293b" />
  </radialGradient>
  <radialGradient id="glassSphere" cx="32%" cy="28%" r="70%" fx="28%" fy="24%">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.92" />
    <stop offset="30%" stop-color="#7dd3fc" stop-opacity="0.7" />
    <stop offset="75%" stop-color="#0284c7" stop-opacity="0.82" />
    <stop offset="100%" stop-color="#082f49" stop-opacity="0.94" />
  </radialGradient>
  <radialGradient id="groundShadowGrad" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#0f172a" stop-opacity="0.45" />
    <stop offset="65%" stop-color="#0f172a" stop-opacity="0.18" />
    <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
  </radialGradient>
  <radialGradient id="cinemaVignette" cx="50%" cy="50%" r="72%">
    <stop offset="55%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.52" />
  </radialGradient>
</defs>
`.trim();

// ---------------------------------------------------------------------------
// Safe Zero-Eval Mathematical Expression Evaluator
// ---------------------------------------------------------------------------

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; value: string }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }
  | { type: 'q' }
  | { type: 'colon' };

function tokenizeExpr(expr: string): Token[] {
  const tokens: Token[] = [];
  let idx = 0;
  const len = expr.length;

  while (idx < len) {
    const ch = expr[idx];
    if (/\s/.test(ch)) {
      idx += 1;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && idx + 1 < len && /[0-9]/.test(expr[idx + 1]))) {
      let end = idx + 1;
      while (end < len && /[0-9.]/.test(expr[end])) end += 1;
      const num = Number(expr.slice(idx, end));
      if (!Number.isFinite(num)) throw new Error(`Invalid number in expression: ${expr.slice(idx, end)}`);
      tokens.push({ type: 'num', value: num });
      idx = end;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let end = idx + 1;
      while (end < len && /[a-zA-Z0-9_]/.test(expr[end])) end += 1;
      tokens.push({ type: 'id', value: expr.slice(idx, end) });
      idx = end;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      idx += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      idx += 1;
      continue;
    }
    if (ch === '?') {
      tokens.push({ type: 'q' });
      idx += 1;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon' });
      idx += 1;
      continue;
    }

    const two = expr.slice(idx, idx + 2);
    if (two === '<=' || two === '>=' || two === '==' || two === '!=' || two === '&&' || two === '||') {
      tokens.push({ type: 'op', value: two });
      idx += 2;
      continue;
    }

    if ('+-*/%^<>!'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      idx += 1;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" in expression.`);
  }

  return tokens;
}

const MATH_FUNCS: Record<string, (...args: number[]) => number> = {
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
  hypot: (x, y) => Math.hypot(x, y),
  hyp: (x, y) => Math.hypot(x, y),
  abs: (x) => Math.abs(x),
  sqrt: (x) => Math.sqrt(Math.max(0, x)),
  pow: (a, b) => Math.pow(a, b),
  exp: (x) => Math.exp(Math.max(-30, Math.min(15, x))),
  log: (x) => Math.log(Math.max(1e-9, x)),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  sign: (x) => Math.sign(x),
  deg2rad: (d) => (d * Math.PI) / 180,
  rad2deg: (r) => (r * 180) / Math.PI,
  step: (edge, x) => (x < edge ? 0 : 1),
  clamp: (v, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi),
  lerp: (a, b, t) => a + (b - a) * t,
  invlerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
  mod: (a, b) => (b === 0 ? 0 : ((a % b) + b) % b),
  fract: (x) => x - Math.floor(x),
  smoothstep: (x, e0 = 0, e1 = 1) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0 || 1), 0), 1);
    return t * t * (3 - 2 * t);
  },
  easein: (t) => applyEasing(t, 'easeIn'),
  easeout: (t) => applyEasing(t, 'easeOut'),
  easeinout: (t) => applyEasing(t, 'easeInOut'),
  easeinexpo: (t) => applyEasing(t, 'easeInExpo'),
  easeoutexpo: (t) => applyEasing(t, 'easeOutExpo'),
  easeinoutexpo: (t) => applyEasing(t, 'easeInOutExpo'),
  backin: (t) => applyEasing(t, 'backIn'),
  easeinback: (t) => applyEasing(t, 'easeInBack'),
  backout: (t) => applyEasing(t, 'backOut'),
  easeoutback: (t) => applyEasing(t, 'easeOutBack'),
  backinout: (t) => applyEasing(t, 'backInOut'),
  easeinoutback: (t) => applyEasing(t, 'easeInOutBack'),
  easeinelastic: (t) => applyEasing(t, 'easeInElastic'),
  easeoutelastic: (t) => applyEasing(t, 'easeOutElastic'),
  easeoutbounce: (t) => applyEasing(t, 'bounce'),
  pingpong: (t) => {
    const m = ((t % 1) + 1) % 1;
    return 1 - Math.abs(m * 2 - 1);
  },
  bounce: (t, count = 1) => Math.abs(Math.sin(t * Math.PI * count)),
  wave: (t, min = -1, max = 1, freq = 1) =>
    min + (max - min) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * freq)),
  noise: (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const hash = (n: number) => {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    return hash(i) * (1 - u) + hash(i + 1) * u;
  },
};

export function evaluateMathExpression(
  expr: string,
  vars: Record<string, number>
): number {
  const tokens = tokenizeExpr(expr);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseTernary(): number {
    const cond = parseOr();
    if (peek()?.type === 'q') {
      consume();
      const truthy = parseTernary();
      if (peek()?.type !== 'colon') throw new Error('Expected ":" in ternary expression');
      consume();
      const falsy = parseTernary();
      return cond ? truthy : falsy;
    }
    return cond;
  }

  function parseOr(): number {
    let left = parseAnd();
    while (peek()?.type === 'op' && (peek() as { value: string }).value === '||') {
      consume();
      const right = parseAnd();
      left = left || right ? 1 : 0;
    }
    return left;
  }

  function parseAnd(): number {
    let left = parseEquality();
    while (peek()?.type === 'op' && (peek() as { value: string }).value === '&&') {
      consume();
      const right = parseEquality();
      left = left && right ? 1 : 0;
    }
    return left;
  }

  function parseEquality(): number {
    let left = parseComparison();
    while (
      peek()?.type === 'op' &&
      ((peek() as { value: string }).value === '==' ||
        (peek() as { value: string }).value === '!=')
    ) {
      const op = (consume() as { value: string }).value;
      const right = parseComparison();
      left = op === '==' ? (left === right ? 1 : 0) : left !== right ? 1 : 0;
    }
    return left;
  }

  function parseComparison(): number {
    let left = parseAdditive();
    while (
      peek()?.type === 'op' &&
      ['<', '<=', '>', '>='].includes((peek() as { value: string }).value)
    ) {
      const op = (consume() as { value: string }).value;
      const right = parseAdditive();
      if (op === '<') left = left < right ? 1 : 0;
      else if (op === '<=') left = left <= right ? 1 : 0;
      else if (op === '>') left = left > right ? 1 : 0;
      else left = left >= right ? 1 : 0;
    }
    return left;
  }

  function parseAdditive(): number {
    let left = parseMultiplicative();
    while (
      peek()?.type === 'op' &&
      ((peek() as { value: string }).value === '+' ||
        (peek() as { value: string }).value === '-')
    ) {
      const op = (consume() as { value: string }).value;
      const right = parseMultiplicative();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseMultiplicative(): number {
    let left = parsePower();
    while (
      peek()?.type === 'op' &&
      ['*', '/', '%'].includes((peek() as { value: string }).value)
    ) {
      const op = (consume() as { value: string }).value;
      const right = parsePower();
      if (op === '*') left *= right;
      else if (op === '/') left = right === 0 ? 0 : left / right;
      else left = right === 0 ? 0 : left % right;
    }
    return left;
  }

  function parsePower(): number {
    const base = parseUnary();
    if (peek()?.type === 'op' && (peek() as { value: string }).value === '^') {
      consume();
      return Math.pow(base, parsePower());
    }
    return base;
  }

  function parseUnary(): number {
    if (peek()?.type === 'op') {
      const op = (peek() as { value: string }).value;
      if (op === '-') {
        consume();
        return -parseUnary();
      }
      if (op === '+') {
        consume();
        return parseUnary();
      }
      if (op === '!') {
        consume();
        return parseUnary() ? 0 : 1;
      }
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'num') {
      consume();
      return tok.value;
    }

    if (tok.type === 'paren' && tok.value === '(') {
      consume();
      const val = parseTernary();
      const close = peek();
      if (!close || close.type !== 'paren' || close.value !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      consume();
      return val;
    }

    if (tok.type === 'id') {
      consume();
      const name = tok.value;
      const next = peek();
      if (next && next.type === 'paren' && next.value === '(') {
        consume();
        const args: number[] = [];
        if (!(peek()?.type === 'paren' && (peek() as { value: string }).value === ')')) {
          while (true) {
            args.push(parseTernary());
            if (peek()?.type === 'comma') {
              consume();
            } else {
              break;
            }
          }
        }
        const close = peek();
        if (!close || close.type !== 'paren' || close.value !== ')') {
          throw new Error(`Missing ")" in call to ${name}()`);
        }
        consume();
        const fn = MATH_FUNCS[name.toLowerCase()];
        if (!fn) throw new Error(`Unknown function: ${name}`);
        return fn(...args);
      }

      if (name in vars) return vars[name];
      const lower = name.toLowerCase();
      if (lower === 'pi') return Math.PI;
      if (lower === 'tau') return Math.PI * 2;
      if (lower === 'e') return Math.E;
      if (lower in vars) return vars[lower];
      return 0;
    }

    throw new Error('Unexpected token in expression');
  }

  const result = parseTernary();
  return Number.isFinite(result) ? result : 0;
}

export function applyEasing(rawT: number, ease: EasingName = 'linear'): number {
  const t = Math.min(Math.max(rawT, 0), 1);
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;

  switch (ease) {
    case 'in':
    case 'easeIn':
      return t * t * t;
    case 'out':
    case 'easeOut':
      return 1 - Math.pow(1 - t, 3);
    case 'inOut':
    case 'easeInOut':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'easeInExpo':
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 'exponential':
    case 'easeOutExpo':
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 'easeInOutExpo':
      if (t === 0 || t === 1) return t;
      return t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;
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
    case 'easeInElastic': {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }
    case 'elastic':
    case 'easeOutElastic': {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'bounce':
    case 'easeOutBounce': {
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
    case 'linear':
    default:
      return t;
  }
}

// ---------------------------------------------------------------------------
// Property Resolution & Layer Compilation
// ---------------------------------------------------------------------------

function evalNumericValue(
  val: number | string | [number, number] | undefined,
  vars: Record<string, number>,
  fallback = 0
): number {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (Array.isArray(val) && val.length >= 2) {
    const a = Number(val[0]) || 0;
    const b = Number(val[1]) || 0;
    return a + (b - a) * vars.t;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) return asNum;
    try {
      return evaluateMathExpression(trimmed, vars);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function interpolateTemplateExpressions(
  markup: string,
  vars: Record<string, number>
): string {
  if (!markup || !markup.includes('{{')) return markup;
  return markup.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    try {
      const val = evaluateMathExpression(expr.trim(), vars);
      if (!Number.isFinite(val)) return '0';
      return Math.abs(val - Math.round(val)) < 1e-4
        ? String(Math.round(val))
        : val.toFixed(2);
    } catch {
      return '0';
    }
  });
}

function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface ResolvedTransform {
  x: number;
  y: number;
  z: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  opacity: number;
}

function resolveKeyframeProperty(
  keyframes: StopMotionKeyframe[],
  prop: 'x' | 'y' | 'z' | 'rotate' | 'scale' | 'scaleX' | 'scaleY' | 'skewX' | 'skewY' | 'opacity',
  t: number,
  frameCount: number,
  vars: Record<string, number>
): number | undefined {
  const entries = keyframes
    .filter((kf) => kf[prop] !== undefined)
    .map((kf) => ({
      at: kf.at > 1 ? Math.min(1, kf.at / Math.max(1, frameCount - 1)) : Math.max(0, Math.min(1, kf.at)),
      val: evalNumericValue(kf[prop], vars, 0),
      ease: kf.ease || 'inOut',
    }))
    .sort((a, b) => a.at - b.at);

  if (entries.length === 0) return undefined;
  if (t <= entries[0].at) return entries[0].val;
  if (t >= entries[entries.length - 1].at) return entries[entries.length - 1].val;

  for (let i = 0; i < entries.length - 1; i += 1) {
    const a = entries[i];
    const b = entries[i + 1];
    if (t >= a.at && t <= b.at) {
      const span = b.at - a.at || 1;
      const localT = applyEasing((t - a.at) / span, b.ease);
      return a.val + (b.val - a.val) * localT;
    }
  }
  return entries[entries.length - 1].val;
}

function resolveLayerTransform(
  layer: StopMotionLayerSpec,
  vars: Record<string, number>,
  frameCount: number
): ResolvedTransform {
  let x = evalNumericValue(layer.x, vars, 0);
  let y = evalNumericValue(layer.y, vars, 0);
  let z = evalNumericValue(layer.z ?? layer.depth, vars, 0);
  let rotate = evalNumericValue(layer.rotate, vars, 0);
  const baseScale = evalNumericValue(layer.scale, vars, 1);
  let scaleX = evalNumericValue(layer.scaleX, vars, baseScale);
  let scaleY = evalNumericValue(layer.scaleY, vars, baseScale);
  let skewX = evalNumericValue(layer.skewX, vars, 0);
  let skewY = evalNumericValue(layer.skewY, vars, 0);
  let opacity = evalNumericValue(layer.opacity, vars, 1);

  if (Array.isArray(layer.keyframes) && layer.keyframes.length > 0) {
    const kfX = resolveKeyframeProperty(layer.keyframes, 'x', vars.t, frameCount, vars);
    const kfY = resolveKeyframeProperty(layer.keyframes, 'y', vars.t, frameCount, vars);
    const kfZ = resolveKeyframeProperty(layer.keyframes, 'z', vars.t, frameCount, vars);
    const kfRot = resolveKeyframeProperty(layer.keyframes, 'rotate', vars.t, frameCount, vars);
    const kfScale = resolveKeyframeProperty(layer.keyframes, 'scale', vars.t, frameCount, vars);
    const kfScaleX = resolveKeyframeProperty(layer.keyframes, 'scaleX', vars.t, frameCount, vars);
    const kfScaleY = resolveKeyframeProperty(layer.keyframes, 'scaleY', vars.t, frameCount, vars);
    const kfSkewX = resolveKeyframeProperty(layer.keyframes, 'skewX', vars.t, frameCount, vars);
    const kfSkewY = resolveKeyframeProperty(layer.keyframes, 'skewY', vars.t, frameCount, vars);
    const kfOp = resolveKeyframeProperty(layer.keyframes, 'opacity', vars.t, frameCount, vars);

    if (kfX !== undefined) x = kfX;
    if (kfY !== undefined) y = kfY;
    if (kfZ !== undefined) z = kfZ;
    if (kfRot !== undefined) rotate = kfRot;
    if (kfScale !== undefined) {
      scaleX = kfScale;
      scaleY = kfScale;
    }
    if (kfScaleX !== undefined) scaleX = kfScaleX;
    if (kfScaleY !== undefined) scaleY = kfScaleY;
    if (kfSkewX !== undefined) skewX = kfSkewX;
    if (kfSkewY !== undefined) skewY = kfSkewY;
    if (kfOp !== undefined) opacity = kfOp;
  }

  const m = layer.motion;
  if (m) {
    if (m.x !== undefined) x = evalNumericValue(m.x, vars, x);
    if (m.y !== undefined) y = evalNumericValue(m.y, vars, y);
    if (m.z !== undefined) z = evalNumericValue(m.z, vars, z);
    if (m.rotate !== undefined) rotate = evalNumericValue(m.rotate, vars, rotate);
    if (m.scale !== undefined) {
      const s = evalNumericValue(m.scale, vars, 1);
      scaleX = s;
      scaleY = s;
    }
    if (m.scaleX !== undefined) scaleX = evalNumericValue(m.scaleX, vars, scaleX);
    if (m.scaleY !== undefined) scaleY = evalNumericValue(m.scaleY, vars, scaleY);
    if (m.skewX !== undefined) skewX = evalNumericValue(m.skewX, vars, skewX);
    if (m.skewY !== undefined) skewY = evalNumericValue(m.skewY, vars, skewY);
    if (m.opacity !== undefined) opacity = evalNumericValue(m.opacity, vars, opacity);

    if (typeof m.spin === 'number') {
      rotate += vars.t * m.spin;
    }
    if (m.bob !== undefined) {
      const cfg = typeof m.bob === 'number' ? { amp: m.bob } : m.bob;
      const freq = cfg.freq ?? 1;
      const phase = cfg.phase ?? 0;
      y += Math.sin((vars.t * freq + phase) * Math.PI * 2) * cfg.amp;
    }
    if (m.sway !== undefined) {
      const cfg = typeof m.sway === 'number' ? { amp: m.sway } : m.sway;
      const freq = cfg.freq ?? 1;
      const phase = cfg.phase ?? 0;
      rotate += Math.sin((vars.t * freq + phase) * Math.PI * 2) * cfg.amp;
    }
    if (m.pulse !== undefined) {
      const cfg = typeof m.pulse === 'number' ? { min: 1 - m.pulse, max: 1 + m.pulse } : m.pulse;
      const min = cfg.min ?? 0.92;
      const max = cfg.max ?? 1.08;
      const freq = cfg.freq ?? 1;
      const phase = cfg.phase ?? 0;
      const s = min + (max - min) * (0.5 + 0.5 * Math.sin((vars.t * freq + phase) * Math.PI * 2));
      scaleX *= s;
      scaleY *= s;
    }
    if (m.orbit) {
      const ocx = m.orbit.cx ?? vars.cx;
      const ocy = m.orbit.cy ?? vars.cy;
      const rx = m.orbit.rx;
      const ry = m.orbit.ry ?? rx;
      const turns = m.orbit.turns ?? 1;
      const phase = m.orbit.phase ?? 0;
      const theta = (vars.t * turns + phase) * Math.PI * 2;
      x = ocx + Math.cos(theta) * rx;
      y = ocy + Math.sin(theta) * ry;
    }
    if (m.squash) {
      const amp = m.squash.amp ?? 0.16;
      const freq = m.squash.freq ?? 2;
      const phase = m.squash.phase ?? 0;
      const sy = 1 + Math.sin((vars.t * freq + phase) * Math.PI * 2) * amp;
      const sx = 1 / Math.max(0.35, sy);
      scaleX *= sx;
      scaleY *= sy;
    }
  }

  // Layer-level pulse helper
  if (layer.pulse) {
    const freqHz = layer.pulse.freqHz ?? 1;
    const phase = layer.pulse.phase ?? 0;
    const duration = Math.max(0.5, vars.dur || 2);
    const wave = 0.5 + 0.5 * Math.sin((vars.t * duration * freqHz + phase) * Math.PI * 2);
    if (layer.pulse.minOpacity !== undefined || layer.pulse.maxOpacity !== undefined) {
      const minO = layer.pulse.minOpacity ?? 0.65;
      const maxO = layer.pulse.maxOpacity ?? 1;
      opacity *= minO + (maxO - minO) * wave;
    }
    if (layer.pulse.minScale !== undefined || layer.pulse.maxScale !== undefined) {
      const minS = layer.pulse.minScale ?? 0.94;
      const maxS = layer.pulse.maxScale ?? 1.06;
      const s = minS + (maxS - minS) * wave;
      scaleX *= s;
      scaleY *= s;
    }
  }

  // Depth perspective attenuation (z > 0 pushes into distance)
  if (Math.abs(z) > 1e-3) {
    const persp = 420 / Math.max(80, 420 + z);
    scaleX *= persp;
    scaleY *= persp;
  }

  return {
    x,
    y,
    z,
    rotate,
    scaleX,
    scaleY,
    skewX,
    skewY,
    opacity: Math.max(0, Math.min(1, opacity)),
  };
}

function buildTransformAttr(
  tf: ResolvedTransform,
  origin?: [number, number]
): string {
  const parts: string[] = [];
  if (Math.abs(tf.x) > 1e-4 || Math.abs(tf.y) > 1e-4) {
    parts.push(`translate(${tf.x.toFixed(2)} ${tf.y.toFixed(2)})`);
  }
  const ox = origin?.[0] ?? 0;
  const oy = origin?.[1] ?? 0;
  const hasOrigin = Math.abs(ox) > 1e-4 || Math.abs(oy) > 1e-4;
  if (hasOrigin && (Math.abs(tf.rotate) > 1e-4 || Math.abs(tf.scaleX - 1) > 1e-4 || Math.abs(tf.scaleY - 1) > 1e-4)) {
    parts.push(`translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
  }
  if (Math.abs(tf.rotate) > 1e-4) {
    parts.push(`rotate(${tf.rotate.toFixed(2)})`);
  }
  if (Math.abs(tf.skewX) > 1e-4) {
    parts.push(`skewX(${tf.skewX.toFixed(2)})`);
  }
  if (Math.abs(tf.skewY) > 1e-4) {
    parts.push(`skewY(${tf.skewY.toFixed(2)})`);
  }
  if (Math.abs(tf.scaleX - 1) > 1e-4 || Math.abs(tf.scaleY - 1) > 1e-4) {
    parts.push(`scale(${tf.scaleX.toFixed(3)} ${tf.scaleY.toFixed(3)})`);
  }
  if (hasOrigin && (Math.abs(tf.rotate) > 1e-4 || Math.abs(tf.scaleX - 1) > 1e-4 || Math.abs(tf.scaleY - 1) > 1e-4)) {
    parts.push(`translate(${(-ox).toFixed(2)} ${(-oy).toFixed(2)})`);
  }
  return parts.join(' ');
}

function hilbertD2xy(n: number, d: number): [number, number] {
  let rx = 0;
  let ry = 0;
  let t = d;
  let x = 0;
  let y = 0;
  for (let s = 1; s < n; s *= 2) {
    rx = 1 & (t >> 1);
    ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      const tmp = x;
      x = y;
      y = tmp;
    }
    x += s * rx;
    y += s * ry;
    t >>= 2;
  }
  return [x, y];
}

function generateMathCurvePoints(
  curve: StopMotionCurveSpec,
  vars: Record<string, number>
): Array<[number, number]> {
  const cx = curve.cx ?? 0;
  const cy = curve.cy ?? 0;
  const size = curve.size ?? 240;

  if (curve.type === 'hilbert') {
    const order = Math.max(1, Math.min(6, Math.round(curve.order ?? 4)));
    const gridN = 1 << order;
    const total = gridN * gridN;
    const half = size / 2;
    const step = gridN > 1 ? size / (gridN - 1) : size;
    const pts: Array<[number, number]> = [];
    for (let d = 0; d < total; d += 1) {
      const [gx, gy] = hilbertD2xy(gridN, d);
      pts.push([cx - half + gx * step, cy - half + gy * step]);
    }
    return pts;
  }

  if (curve.type === 'dragon') {
    const order = Math.max(1, Math.min(11, Math.round(curve.order ?? 9)));
    let pts: Array<[number, number]> = [
      [-size * 0.42, 0],
      [size * 0.42, 0],
    ];
    for (let it = 0; it < order; it += 1) {
      const next: Array<[number, number]> = [pts[0]];
      for (let i = 0; i < pts.length - 1; i += 1) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const dx = (x1 - x0) / 2;
        const dy = (y1 - y0) / 2;
        const sign = i % 2 === 0 ? 1 : -1;
        next.push([mx - dy * sign, my + dx * sign], [x1, y1]);
      }
      pts = next;
    }
    return pts.map(([x, y]) => [cx + x, cy + y]);
  }

  if (curve.type === 'koch') {
    const order = Math.max(0, Math.min(4, Math.round(curve.order ?? 3)));
    const r = size * 0.5;
    let pts: Array<[number, number]> = [
      [0, -r],
      [r * Math.cos(Math.PI / 6), r * Math.sin(Math.PI / 6)],
      [-r * Math.cos(Math.PI / 6), r * Math.sin(Math.PI / 6)],
      [0, -r],
    ];
    for (let it = 0; it < order; it += 1) {
      const next: Array<[number, number]> = [];
      for (let i = 0; i < pts.length - 1; i += 1) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const dx = (x2 - x1) / 3;
        const dy = (y2 - y1) / 3;
        const ax = x1 + dx;
        const ay = y1 + dy;
        const bx = x1 + 2 * dx;
        const by = y1 + 2 * dy;
        const cos60 = 0.5;
        const sin60 = Math.sqrt(3) / 2;
        const px = ax + (dx * cos60 + dy * sin60);
        const py = ay + (-dx * sin60 + dy * cos60);
        next.push([x1, y1], [ax, ay], [px, py], [bx, by]);
      }
      next.push(pts[pts.length - 1]);
      pts = next;
    }
    return pts.map(([x, y]) => [cx + x, cy + y]);
  }

  if (curve.type === 'lissajous') {
    const rx = curve.rx ?? size * 0.45;
    const ry = curve.ry ?? size * 0.45;
    const a = curve.a ?? 3;
    const b = curve.b ?? 2;
    const delta = curve.delta ?? vars.t * Math.PI * 2;
    const samples = Math.min(600, Math.max(60, curve.samples ?? 240));
    const pts: Array<[number, number]> = [];
    for (let s = 0; s <= samples; s += 1) {
      const th = (s / samples) * Math.PI * 2;
      pts.push([cx + rx * Math.sin(a * th + delta), cy + ry * Math.sin(b * th)]);
    }
    return pts;
  }

  if (curve.type === 'spirograph') {
    const R = curve.a ?? size * 0.38;
    const r = curve.b ?? size * 0.14;
    const d = curve.d ?? size * 0.2;
    const turns = curve.turns ?? 5;
    const samples = Math.min(800, Math.max(80, curve.samples ?? 320));
    const pts: Array<[number, number]> = [];
    for (let s = 0; s <= samples; s += 1) {
      const th = (s / samples) * Math.PI * 2 * turns;
      const x = (R - r) * Math.cos(th) + d * Math.cos(((R - r) / (r || 1)) * th);
      const y = (R - r) * Math.sin(th) - d * Math.sin(((R - r) / (r || 1)) * th);
      pts.push([cx + x, cy + y]);
    }
    return pts;
  }

  if (curve.type === 'rose') {
    const k = curve.petals ?? 5;
    const radius = curve.rx ?? size * 0.46;
    const turns = curve.turns ?? 2;
    const samples = Math.min(600, Math.max(80, curve.samples ?? 240));
    const pts: Array<[number, number]> = [];
    for (let s = 0; s <= samples; s += 1) {
      const th = (s / samples) * Math.PI * 2 * turns;
      const r = radius * Math.cos(k * th);
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
    }
    return pts;
  }

  const maxR = curve.rx ?? size * 0.48;
  const turns = curve.turns ?? 4.5;
  const samples = Math.min(500, Math.max(60, curve.samples ?? 200));
  const pts: Array<[number, number]> = [];
  for (let s = 0; s <= samples; s += 1) {
    const frac = s / samples;
    const th = frac * Math.PI * 2 * turns;
    const r = maxR * frac;
    pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return pts;
}

function renderCurveSvg(
  curve: StopMotionCurveSpec,
  vars: Record<string, number>
): string {
  const allPts = generateMathCurvePoints(curve, vars);
  if (allPts.length < 2) return '';

  const progress = Math.max(0, Math.min(1, evalNumericValue(curve.progress, vars, 1)));
  const maxFloatIdx = progress * (allPts.length - 1);
  const wholeCount = Math.floor(maxFloatIdx);
  const frac = maxFloatIdx - wholeCount;

  const visiblePts = allPts.slice(0, wholeCount + 1);
  if (wholeCount < allPts.length - 1 && frac > 0.001) {
    const [x0, y0] = allPts[wholeCount];
    const [x1, y1] = allPts[wholeCount + 1];
    visiblePts.push([x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac]);
  }
  if (visiblePts.length < 2) return '';

  const dParts = visiblePts.map(([x, y], idx) =>
    `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  );
  if (curve.closed && progress >= 0.999) dParts.push('Z');

  const stroke = curve.stroke || '#38bdf8';
  const strokeWidth = curve.strokeWidth ?? 3;
  const fill = curve.fill || 'none';
  const filterAttr = curve.glow ? ' filter="url(#softGlow)"' : '';

  let markup = `<path d="${dParts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${filterAttr} />`;

  if (curve.headDot !== false && progress < 1) {
    const [hx, hy] = visiblePts[visiblePts.length - 1];
    const dotColor = curve.dotColor || '#ffffff';
    const dotRadius = curve.dotRadius ?? Math.max(3.5, strokeWidth * 1.45);
    markup += `<circle cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="${dotRadius}" fill="${dotColor}" filter="url(#softGlow)" />`;
  }
  return markup;
}

// ---------------------------------------------------------------------------
// 3D Lit & Refractive Projected Primitive Renderer (for SVG/FFmpeg Pipeline)
// ---------------------------------------------------------------------------

function adjustHexShade(hex: string, factor: number): string {
  const clean = hex.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return hex;
  const r = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) * factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function renderThreeDPrimitiveSvg(
  spec: StopMotionThreeDLayerSpec,
  vars: Record<string, number>,
  lighting?: StopMotionThreeLightingSpec
): string {
  const size = spec.size ?? 90;
  const rx = (evalNumericValue(spec.rx, vars, 22) * Math.PI) / 180;
  const ry = (evalNumericValue(spec.ry, vars, vars.deg * 0.75) * Math.PI) / 180;
  const rz = (evalNumericValue(spec.rz, vars, 0) * Math.PI) / 180;
  const baseColor = spec.color || '#38bdf8';
  const rimColor = spec.accent || lighting?.rimColor || '#f0f9ff';
  const reflection = spec.reflection ?? 0.55;
  const refraction = spec.refraction ?? lighting?.refraction ?? 0.25;

  const project = (pt: [number, number, number]): [number, number, number] => {
    let [x, y, z] = pt;
    // Rotate X
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    y = y1;
    z = z1;
    // Rotate Y
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x2 = x * cosY + z * sinY;
    const z2 = -x * sinY + z * cosY;
    x = x2;
    z = z2;
    // Rotate Z
    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);
    const x3 = x * cosZ - y * sinZ;
    const y3 = x * sinZ + y * cosZ;
    x = x3;
    y = y3;

    const p = 360 / Math.max(90, 360 + z);
    return [x * p, y * p, z];
  };

  if (spec.shape === 'sphere') {
    const r = size * 0.55;
    const fresnelOpacity = Math.min(0.85, 0.25 + reflection * 0.5).toFixed(2);
    const specX = (-r * 0.34).toFixed(2);
    const specY = (-r * 0.34).toFixed(2);
    return [
      `<circle cx="0" cy="0" r="${r.toFixed(2)}" fill="${adjustHexShade(baseColor, 0.85)}" stroke="${rimColor}" stroke-width="${refraction > 0.1 ? '1.8' : '1'}" opacity="${(1 - refraction * 0.35).toFixed(2)}" />`,
      refraction > 0.1
        ? `<circle cx="0" cy="0" r="${(r * 0.88).toFixed(2)}" fill="url(#glassSphere)" opacity="${Math.min(0.9, refraction + 0.25).toFixed(2)}" />`
        : '',
      `<ellipse cx="${specX}" cy="${specY}" rx="${(r * 0.32).toFixed(2)}" ry="${(r * 0.16).toFixed(2)}" transform="rotate(-32 ${specX} ${specY})" fill="#ffffff" opacity="${fresnelOpacity}" />`,
    ]
      .filter(Boolean)
      .join('');
  }

  if (spec.shape === 'torus') {
    const R = size * 0.45;
    const r = size * 0.17;
    const tilt = Math.max(0.25, Math.abs(Math.cos(rx)));
    return [
      `<ellipse cx="0" cy="0" rx="${R.toFixed(2)}" ry="${(R * tilt).toFixed(2)}" fill="none" stroke="${adjustHexShade(baseColor, 0.65)}" stroke-width="${(r * 1.9).toFixed(2)}" />`,
      `<ellipse cx="0" cy="-2" rx="${R.toFixed(2)}" ry="${(R * tilt).toFixed(2)}" fill="none" stroke="${baseColor}" stroke-width="${(r * 1.25).toFixed(2)}" opacity="0.92" />`,
      `<ellipse cx="0" cy="-4" rx="${R.toFixed(2)}" ry="${(R * tilt).toFixed(2)}" fill="none" stroke="${rimColor}" stroke-width="${(r * 0.35).toFixed(2)}" opacity="${(0.35 + reflection * 0.5).toFixed(2)}" />`,
    ].join('');
  }

  if (spec.shape === 'cylinder') {
    const r = size * 0.36;
    const h = size * 0.72;
    const capRy = Math.max(6, Math.abs(Math.sin(rx)) * r * 0.55 + 6);
    return [
      `<path d="M ${-r} ${-h / 2} L ${-r} ${h / 2} A ${r} ${capRy.toFixed(2)} 0 0 0 ${r} ${h / 2} L ${r} ${-h / 2} Z" fill="${adjustHexShade(baseColor, 0.78)}" />`,
      `<ellipse cx="0" cy="${-h / 2}" rx="${r}" ry="${capRy.toFixed(2)}" fill="${adjustHexShade(baseColor, 1.15)}" stroke="${rimColor}" stroke-width="1" />`,
      `<rect x="${(-r * 0.55).toFixed(2)}" y="${(-h / 2 + capRy * 0.4).toFixed(2)}" width="${(r * 0.25).toFixed(2)}" height="${(h - capRy * 0.8).toFixed(2)}" rx="4" fill="#ffffff" opacity="${(0.2 + reflection * 0.35).toFixed(2)}" />`,
    ].join('');
  }

  // Faceted meshes: cube, pyramid, crystal
  const h = size * 0.5;
  const vertices: Array<[number, number, number]> =
    spec.shape === 'pyramid'
      ? [
          [0, -h * 1.15, 0],
          [-h, h * 0.65, -h],
          [h, h * 0.65, -h],
          [h, h * 0.65, h],
          [-h, h * 0.65, h],
        ]
      : spec.shape === 'crystal'
      ? [
          [0, -h * 1.35, 0],
          [-h * 0.65, 0, -h * 0.65],
          [h * 0.65, 0, -h * 0.65],
          [h * 0.65, 0, h * 0.65],
          [-h * 0.65, 0, h * 0.65],
          [0, h * 1.35, 0],
        ]
      : [
          [-h, -h, -h],
          [h, -h, -h],
          [h, h, -h],
          [-h, h, -h],
          [-h, -h, h],
          [h, -h, h],
          [h, h, h],
          [-h, h, h],
        ];

  const faces: Array<{ idx: number[]; shade: number }> =
    spec.shape === 'pyramid'
      ? [
          { idx: [0, 1, 2], shade: 1.12 },
          { idx: [0, 2, 3], shade: 0.92 },
          { idx: [0, 3, 4], shade: 0.72 },
          { idx: [0, 4, 1], shade: 1.02 },
          { idx: [1, 4, 3, 2], shade: 0.58 },
        ]
      : spec.shape === 'crystal'
      ? [
          { idx: [0, 1, 2], shade: 1.25 },
          { idx: [0, 2, 3], shade: 0.98 },
          { idx: [0, 3, 4], shade: 0.78 },
          { idx: [0, 4, 1], shade: 1.08 },
          { idx: [5, 2, 1], shade: 0.85 },
          { idx: [5, 3, 2], shade: 0.7 },
          { idx: [5, 4, 3], shade: 0.58 },
          { idx: [5, 1, 4], shade: 0.9 },
        ]
      : [
          { idx: [0, 1, 2, 3], shade: 1.05 }, // back
          { idx: [4, 5, 6, 7], shade: 0.95 }, // front
          { idx: [0, 4, 7, 3], shade: 0.74 }, // left
          { idx: [1, 5, 6, 2], shade: 1.15 }, // right
          { idx: [0, 1, 5, 4], shade: 1.24 }, // top
          { idx: [3, 2, 6, 7], shade: 0.62 }, // bottom
        ];

  const projected = vertices.map(project);
  const sortedFaces = faces
    .map((face) => {
      const avgZ =
        face.idx.reduce((sum, vi) => sum + projected[vi][2], 0) / face.idx.length;
      return { ...face, avgZ };
    })
    .sort((a, b) => a.avgZ - b.avgZ);

  const opacity = spec.wireframe ? 0.2 : Math.max(0.42, 1 - refraction * 0.45);
  return sortedFaces
    .map((f) => {
      const pts = f.idx
        .map((vi) => `${projected[vi][0].toFixed(2)},${projected[vi][1].toFixed(2)}`)
        .join(' ');
      const fill = spec.wireframe ? 'none' : adjustHexShade(baseColor, f.shade);
      return `<polygon points="${pts}" fill="${fill}" fill-opacity="${opacity.toFixed(2)}" stroke="${rimColor}" stroke-opacity="${(0.35 + reflection * 0.5).toFixed(2)}" stroke-width="1.3" stroke-linejoin="round" />`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Embedded Pixel Texture Helper (4x4 -> 512x512 inside Stop Motion SVG)
// ---------------------------------------------------------------------------

function expandRleRowSimple(row: string, width: number): string {
  if (row.length === width) return row;
  if (/^(\d+[^\d])+$/.test(row)) {
    let out = '';
    const rx = /(\d+)([^\d])/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(row)) !== null) {
      out += m[2].repeat(Math.min(width * 2, Number(m[1])));
    }
    if (out.length > 0) return out;
  }
  return row;
}

function renderPixelTextureSvg(tex: StopMotionPixelTextureSpec): string {
  const w = Math.max(4, Math.min(512, Math.round(tex.width || 16)));
  const h = Math.max(4, Math.min(512, Math.round(tex.height || 16)));
  const rawRows = Array.isArray(tex.rle) ? tex.rle : Array.isArray(tex.rows) ? tex.rows : [];
  if (rawRows.length === 0) return '';

  const palette = tex.palette || {};
  const rects: string[] = [];
  const rw = tex.renderWidth ?? w * 4;
  const rh = tex.renderHeight ?? h * 4;
  const x0 = tex.x ?? -rw / 2;
  const y0 = tex.y ?? -rh / 2;
  const pxW = rw / w;
  const pxH = rh / h;

  for (let y = 0; y < Math.min(h, rawRows.length); y += 1) {
    const row = expandRleRowSimple(String(rawRows[y] || ''), w);
    let x = 0;
    while (x < w) {
      const ch = row[x] || '.';
      const color = palette[ch];
      if (!color || color === 'transparent' || ch === '.' || ch === ' ') {
        x += 1;
        continue;
      }
      let span = 1;
      while (x + span < w && row[x + span] === ch) span += 1;
      rects.push(
        `<rect x="${(x0 + x * pxW).toFixed(2)}" y="${(y0 + y * pxH).toFixed(2)}" width="${(span * pxW).toFixed(2)}" height="${pxH.toFixed(2)}" fill="${escapeXmlAttr(color)}" shape-rendering="crispEdges" />`
      );
      x += span;
    }
  }

  const op = typeof tex.opacity === 'number' ? ` opacity="${Math.max(0, Math.min(1, tex.opacity)).toFixed(2)}"` : '';
  return `<g shape-rendering="crispEdges"${op}>${rects.join('')}</g>`;
}

// ---------------------------------------------------------------------------
// Link / Group Expansion & Layer Rendering (bpy-style Groups + IDs + Follow)
// ---------------------------------------------------------------------------

function expandLayerWithGroups(
  layer: StopMotionLayerSpec,
  groups: Record<string, StopMotionLayerSpec | StopMotionLayerSpec[]> | undefined,
  depth = 0
): StopMotionLayerSpec {
  if (!layer.idLink || !groups || !groups[layer.idLink] || depth > 4) {
    return layer;
  }
  const tplRaw = groups[layer.idLink];
  const tplList = Array.isArray(tplRaw) ? tplRaw : [tplRaw];
  const primary = tplList[0] || {};
  const rest = tplList.slice(1);
  return {
    ...primary,
    ...layer,
    motion: layer.motion || primary.motion,
    shadow: layer.shadow !== undefined ? layer.shadow : primary.shadow,
    children: [
      ...(primary.children || []),
      ...rest.map((item) => expandLayerWithGroups(item, groups, depth + 1)),
      ...(layer.children || []),
    ].map((c) => expandLayerWithGroups(c, groups, depth + 1)),
  };
}

function renderLayer(
  rawLayer: StopMotionLayerSpec,
  vars: Record<string, number>,
  frameCount: number,
  canvasWidth: number,
  canvasHeight: number,
  groups: Record<string, StopMotionLayerSpec | StopMotionLayerSpec[]> | undefined,
  sceneLighting: StopMotionThreeLightingSpec | undefined,
  transformMap: Map<string, ResolvedTransform>,
  camOffset: { x: number; y: number }
): string {
  const layer = expandLayerWithGroups(rawLayer, groups);
  if (layer.visibleFrom !== undefined && vars.t < layer.visibleFrom) return '';
  if (layer.visibleTo !== undefined && vars.t > layer.visibleTo) return '';

  let tf = resolveLayerTransform(layer, vars, frameCount);

  // Follow another layer's evaluated or lagged transform
  if (layer.follow?.targetId) {
    const targetTf = transformMap.get(layer.follow.targetId);
    if (targetTf) {
      const lag = Math.max(0, Math.min(0.95, layer.follow.lag ?? 0));
      const weight = 1 - lag * 0.35;
      tf = {
        ...tf,
        x: tf.x + (targetTf.x + (layer.follow.offsetX ?? 0)) * weight,
        y: tf.y + (targetTf.y + (layer.follow.offsetY ?? 0)) * weight,
        rotate: layer.follow.inheritRotation ? tf.rotate + targetTf.rotate * weight : tf.rotate,
      };
    }
  }

  // Apply parallax depth offset relative to camera
  if (layer.parallax !== undefined && (Math.abs(camOffset.x) > 1e-3 || Math.abs(camOffset.y) > 1e-3)) {
    const px = typeof layer.parallax === 'number' ? layer.parallax : layer.parallax.x ?? 1;
    const py = typeof layer.parallax === 'number' ? layer.parallax : layer.parallax.y ?? 1;
    tf = {
      ...tf,
      x: tf.x + camOffset.x * (px - 1),
      y: tf.y + camOffset.y * (py - 1),
    };
  }

  if (layer.id) {
    transformMap.set(layer.id, tf);
  }
  if (tf.opacity <= 0.002) return '';

  let innerSvg = '';
  if (layer.curve) {
    innerSvg += renderCurveSvg(layer.curve, vars);
  }
  if (layer.threeD) {
    innerSvg += renderThreeDPrimitiveSvg(layer.threeD, vars, sceneLighting);
  }
  if (layer.pixelTexture) {
    innerSvg += renderPixelTextureSvg(layer.pixelTexture);
  }
  if (layer.assetRef?.url && (layer.assetRef.kind === 'image' || layer.assetRef.kind === 'stock' || layer.assetRef.kind === 'upload' || layer.assetRef.kind === 'generated')) {
    const aw = layer.assetRef.width ?? 220;
    const ah = layer.assetRef.height ?? 140;
    const ax = layer.assetRef.x ?? -aw / 2;
    const ay = layer.assetRef.y ?? -ah / 2;
    const par = layer.assetRef.preserveAspectRatio || 'xMidYMid meet';
    innerSvg += `<image href="${escapeXmlAttr(layer.assetRef.url)}" x="${ax}" y="${ay}" width="${aw}" height="${ah}" preserveAspectRatio="${par}" />`;
  }

  if (layer.repeat && layer.repeat.count > 0 && layer.svg) {
    const count = Math.min(120, Math.max(1, Math.round(layer.repeat.count)));
    const angleStep = layer.repeat.angleStep ?? 360 / count;
    const startAngle = layer.repeat.startAngle ?? 0;
    const radius = evalNumericValue(layer.repeat.radius, vars, 0);
    const dxStep = layer.repeat.dx ?? 0;
    const dyStep = layer.repeat.dy ?? 0;

    const pieces: string[] = [];
    for (let k = 0; k < count; k += 1) {
      const cloneVars: Record<string, number> = {
        ...vars,
        k,
        kt: count > 1 ? k / count : 0,
        count,
      };
      const ang = startAngle + k * angleStep;
      const rad = (ang * Math.PI) / 180;
      const px = Math.cos(rad) * radius + k * dxStep;
      const py = Math.sin(rad) * radius + k * dyStep;
      const renderedPiece = interpolateTemplateExpressions(layer.svg, cloneVars);
      if (Math.abs(px) > 1e-4 || Math.abs(py) > 1e-4 || Math.abs(ang) > 1e-4) {
        pieces.push(
          `<g transform="translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${ang.toFixed(2)})">${renderedPiece}</g>`
        );
      } else {
        pieces.push(renderedPiece);
      }
    }
    innerSvg += pieces.join('');
  } else if (layer.svg) {
    let svgPiece = interpolateTemplateExpressions(layer.svg, vars);
    if (layer.lining) {
      const prog = Math.max(0.01, Math.min(1, evalNumericValue(layer.lining.progress, vars, vars.t)));
      const dashLen = layer.lining.dashLength ?? 1000;
      const drawn = (prog * dashLen).toFixed(1);
      svgPiece = `<g stroke-dasharray="${drawn} ${dashLen}" stroke-linecap="round">${svgPiece}</g>`;
    }
    innerSvg += svgPiece;
  }

  const childrenSvg = Array.isArray(layer.children)
    ? layer.children
        .map((child) =>
          renderLayer(
            child,
            vars,
            frameCount,
            canvasWidth,
            canvasHeight,
            groups,
            sceneLighting,
            transformMap,
            camOffset
          )
        )
        .filter(Boolean)
        .join('')
    : '';

  // Optional axisDivision symmetry tiling
  let bodyContent = `${innerSvg}${childrenSvg}`;
  if (layer.axisDivision && bodyContent) {
    const mode = layer.axisDivision.mode || 'mirrorX';
    const dcx = layer.axisDivision.cx ?? 0;
    const dcy = layer.axisDivision.cy ?? 0;
    if (mode === 'mirrorX') {
      bodyContent = `${bodyContent}<g transform="translate(${dcx * 2} 0) scale(-1 1)">${bodyContent}</g>`;
    } else if (mode === 'mirrorY') {
      bodyContent = `${bodyContent}<g transform="translate(0 ${dcy * 2}) scale(1 -1)">${bodyContent}</g>`;
    } else if (mode === 'quad') {
      bodyContent = `${bodyContent}<g transform="translate(${dcx * 2} 0) scale(-1 1)">${bodyContent}</g><g transform="translate(0 ${dcy * 2}) scale(1 -1)">${bodyContent}</g><g transform="translate(${dcx * 2} ${dcy * 2}) scale(-1 -1)">${bodyContent}</g>`;
    } else if (mode === 'radial') {
      const cnt = Math.max(2, Math.min(16, Math.round(layer.axisDivision.count ?? 6)));
      const stepDeg = 360 / cnt;
      const radialPieces: string[] = [];
      for (let rIdx = 0; rIdx < cnt; rIdx += 1) {
        radialPieces.push(
          `<g transform="rotate(${(rIdx * stepDeg).toFixed(2)} ${dcx} ${dcy})">${bodyContent}</g>`
        );
      }
      bodyContent = radialPieces.join('');
    }
  }

  // Automatic dynamic shadow
  let groundShadowSvg = '';
  let filterAttr = layer.filter ? ` filter="${layer.filter}"` : '';

  if (layer.shadow) {
    const sh: StopMotionShadowSpec =
      layer.shadow === true ? { type: 'ground' } : layer.shadow;
    if (sh.type === 'drop') {
      if (!filterAttr) filterAttr = ' filter="url(#studioDropShadow)"';
    } else {
      const groundY = sh.groundY ?? canvasHeight * 0.82;
      const baseRx = sh.rx ?? 48;
      const baseRy = sh.ry ?? 10;
      const baseOpacity = sh.opacity ?? 0.24;
      const color = sh.color ?? '#0f172a';
      const dist = Math.max(0, groundY - tf.y);
      const heightFactor = Math.max(0.28, 1 - dist / Math.max(120, canvasHeight * 0.85));
      const rx = baseRx * heightFactor * Math.max(0.5, tf.scaleX);
      const ry = baseRy * heightFactor;
      const op = baseOpacity * heightFactor * tf.opacity;
      const sx = tf.x + (sh.dx ?? 0);
      const sy = groundY + (sh.dy ?? 0);
      groundShadowSvg = `<ellipse cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${color}" opacity="${op.toFixed(3)}" filter="url(#tactileSoftEdge)" />`;
    }
  }

  const tfAttr = buildTransformAttr(tf, layer.origin);
  const styleParts = [
    layer.blendMode ? `mix-blend-mode: ${layer.blendMode};` : '',
    layer.cssStyles ? layer.cssStyles : '',
  ]
    .filter(Boolean)
    .join(' ');

  const attrs = [
    layer.id ? `id="${escapeXmlAttr(layer.id)}"` : '',
    tfAttr ? `transform="${tfAttr}"` : '',
    tf.opacity < 0.999 ? `opacity="${tf.opacity.toFixed(3)}"` : '',
    styleParts ? `style="${escapeXmlAttr(styleParts)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const groupMarkup = `<g${attrs ? ` ${attrs}` : ''}${filterAttr}>${bodyContent}</g>`;
  return groundShadowSvg ? `${groundShadowSvg}${groupMarkup}` : groupMarkup;
}

function resolveStoryboardCamera(
  storyboard: StopMotionStoryboardSpec | undefined,
  vars: Record<string, number>,
  durationSec: number,
  width: number,
  height: number,
  transformMap: Map<string, ResolvedTransform>
): { cameraTransform: string; camOffset: { x: number; y: number }; uiOverlaySvg: string; postEffectSvg: string } {
  if (!storyboard || !Array.isArray(storyboard.shots) || storyboard.shots.length === 0) {
    return {
      cameraTransform: '',
      camOffset: { x: 0, y: 0 },
      uiOverlaySvg: '',
      postEffectSvg: '',
    };
  }

  const activeShot =
    storyboard.shots.find((s) => {
      const startNorm = s.start > 1 && durationSec > 1 ? s.start / durationSec : s.start;
      const endNorm = s.end > 1 && durationSec > 1 ? s.end / durationSec : s.end;
      return vars.t >= startNorm && vars.t <= endNorm + 1e-4;
    }) || storyboard.shots[0];

  if (!activeShot) {
    return { cameraTransform: '', camOffset: { x: 0, y: 0 }, uiOverlaySvg: '', postEffectSvg: '' };
  }

  let zoom = evalNumericValue(activeShot.cameraAngle?.zoom, vars, 1);
  let panX = evalNumericValue(activeShot.cameraAngle?.panX, vars, 0);
  let panY = evalNumericValue(activeShot.cameraAngle?.panY, vars, 0);
  let roll = evalNumericValue(activeShot.cameraAngle?.roll, vars, 0);

  if (activeShot.cameraCut === 'closeup' && activeShot.cameraAngle?.zoom === undefined) zoom = 1.32;
  if (activeShot.cameraCut === 'wide' && activeShot.cameraAngle?.zoom === undefined) zoom = 0.9;
  if (activeShot.cameraCut === 'dutch' && activeShot.cameraAngle?.roll === undefined) roll = -6;

  if (activeShot.trackingTarget) {
    const tracked = transformMap.get(activeShot.trackingTarget);
    if (tracked) {
      panX += width / 2 - tracked.x;
      panY += height / 2 - tracked.y;
    }
  }

  const cx = width / 2;
  const cy = height / 2;
  const hasCam =
    Math.abs(zoom - 1) > 1e-3 ||
    Math.abs(panX) > 1e-2 ||
    Math.abs(panY) > 1e-2 ||
    Math.abs(roll) > 1e-3;
  const cameraTransform = hasCam
    ? `translate(${(cx + panX).toFixed(2)} ${(cy + panY).toFixed(2)}) rotate(${roll.toFixed(2)}) scale(${zoom.toFixed(3)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`
    : '';

  let uiOverlaySvg = '';
  if (activeShot.uiAngle) {
    const { title, subtitle, badge, showTimecode } = activeShot.uiAngle;
    const secs = (vars.t * durationSec).toFixed(2);
    const pieces: string[] = [];
    if (title || subtitle || badge) {
      pieces.push(
        `<g transform="translate(24 ${height - 76})">` +
          `<rect x="0" y="0" width="290" height="52" rx="10" fill="rgba(15,23,42,0.72)" stroke="rgba(255,255,255,0.16)" />` +
          (badge
            ? `<rect x="12" y="10" width="${Math.max(44, badge.length * 7 + 16)}" height="16" rx="4" fill="#38bdf8" /><text x="20" y="21" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700" fill="#0f172a">${escapeXmlAttr(badge)}</text>`
            : '') +
          (title
            ? `<text x="${badge ? 22 + Math.max(44, badge.length * 7 + 16) : 14}" y="22" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" fill="#f8fafc">${escapeXmlAttr(title)}</text>`
            : '') +
          (subtitle
            ? `<text x="14" y="40" font-family="Plus Jakarta Sans, sans-serif" font-size="11" fill="#cbd5e1">${escapeXmlAttr(subtitle)}</text>`
            : '') +
          `</g>`
      );
    }
    if (showTimecode) {
      pieces.push(
        `<g transform="translate(${width - 118} 20)"><rect x="0" y="0" width="96" height="24" rx="6" fill="rgba(15,23,42,0.72)" /><text x="48" y="16" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" font-weight="600" fill="#e2e8f0">TC ${secs}s</text></g>`
      );
    }
    uiOverlaySvg = pieces.join('');
  }

  let postEffectSvg = '';
  if (activeShot.effect === 'vignette') {
    postEffectSvg = `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#cinemaVignette)" pointer-events="none" />`;
  }

  return {
    cameraTransform,
    camOffset: { x: panX, y: panY },
    uiOverlaySvg,
    postEffectSvg,
  };
}

export function isStopMotionSceneV2(obj: unknown): obj is StopMotionSceneV2 {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const rec = obj as Record<string, unknown>;
  return Array.isArray(rec.layers) && rec.layers.length > 0;
}

export function getSceneTimingMeta(
  scene: StopMotionSceneV2,
  overrideFps?: number
): {
  fps: number;
  durationSec: number;
  totalLogicalFrames: number;
  previewFrameCount: number;
} {
  const sourceFps =
    typeof scene.fps === 'number' && scene.fps >= 1 && scene.fps <= 60
      ? Math.round(scene.fps)
      : 24;
  const fps =
    typeof overrideFps === 'number' && overrideFps >= 1 && overrideFps <= 60
      ? Math.round(overrideFps)
      : sourceFps;

  const baseFrames =
    typeof scene.frameCount === 'number' && scene.frameCount >= 1
      ? Math.min(MAX_PRODUCTION_FRAMES, Math.round(scene.frameCount))
      : 48;

  const durationSec =
    typeof scene.durationSec === 'number' && scene.durationSec > 0
      ? Math.min(600, scene.durationSec)
      : Math.max(0.25, baseFrames / sourceFps);

  const totalLogicalFrames = Math.max(
    1,
    Math.min(MAX_PRODUCTION_FRAMES, Math.round(durationSec * fps))
  );
  const previewFrameCount = Math.min(MAX_PREVIEW_FRAMES, totalLogicalFrames);

  return {
    fps,
    durationSec,
    totalLogicalFrames,
    previewFrameCount,
  };
}

export function renderStopMotionSceneFrameSvg(
  scene: StopMotionSceneV2,
  frameIdx: number,
  totalFrames: number,
  fps: number
): string {
  const width =
    typeof scene.width === 'number' && scene.width >= 64 ? scene.width : 800;
  const height =
    typeof scene.height === 'number' && scene.height >= 64 ? scene.height : 450;
  const loop = scene.loop !== false;
  const durationSec =
    typeof scene.durationSec === 'number' && scene.durationSec > 0
      ? Math.min(600, scene.durationSec)
      : Math.max(0.25, totalFrames / Math.max(1, fps));

  const t = loop
    ? frameIdx / Math.max(1, totalFrames)
    : totalFrames > 1
    ? frameIdx / (totalFrames - 1)
    : 0;
  const u = totalFrames > 1 ? frameIdx / (totalFrames - 1) : 0;

  const vars: Record<string, number> = {
    i: frameIdx,
    n: totalFrames,
    frameCount: totalFrames,
    fps,
    dur: durationSec,
    time: t * durationSec,
    t,
    u,
    deg: t * 360,
    rad: t * Math.PI * 2,
    angle: t * Math.PI * 2,
    w: width,
    h: height,
    cx: width / 2,
    cy: height / 2,
    PI: Math.PI,
    TAU: Math.PI * 2,
    E: Math.E,
  };

  const customDefs =
    typeof scene.defs === 'string' && scene.defs.trim()
      ? /<defs[\s>]/i.test(scene.defs)
        ? scene.defs.trim()
        : `<defs>${scene.defs.trim()}</defs>`
      : '';

  const backdropSvg = scene.backdrop
    ? interpolateTemplateExpressions(scene.backdrop, vars)
    : '';
  const foregroundSvg = scene.foreground
    ? interpolateTemplateExpressions(scene.foreground, vars)
    : '';

  const transformMap = new Map<string, ResolvedTransform>();
  // Pre-pass camera without tracking offset for base positions if storyboard has tracking
  const preCam = resolveStoryboardCamera(
    scene.storyboard,
    vars,
    durationSec,
    width,
    height,
    transformMap
  );

  const layersSvg = scene.layers
    .map((layer) =>
      renderLayer(
        layer,
        vars,
        totalFrames,
        width,
        height,
        scene.groups,
        scene.threeLighting,
        transformMap,
        preCam.camOffset
      )
    )
    .filter(Boolean)
    .join('\n');

  const finalCam = resolveStoryboardCamera(
    scene.storyboard,
    vars,
    durationSec,
    width,
    height,
    transformMap
  );

  const worldContent = [backdropSvg, layersSvg, foregroundSvg].filter(Boolean).join('\n');
  const wrappedWorld = finalCam.cameraTransform
    ? `<g transform="${finalCam.cameraTransform}">${worldContent}</g>`
    : worldContent;

  return [
    ENGINE_STUDIO_DEFS,
    customDefs,
    wrappedWorld,
    finalCam.postEffectSvg,
    finalCam.uiOverlaySvg,
  ]
    .filter(Boolean)
    .join('\n');
}

export function compileStopMotionSceneV2(
  scene: StopMotionSceneV2,
  svgMarkupToDataUrlFn: (svg: string, w: number, h: number, bg: string) => string,
  overrideFps?: number
): VectorStopMotionSpec {
  const width =
    typeof scene.width === 'number' && scene.width >= 64 ? scene.width : 800;
  const height =
    typeof scene.height === 'number' && scene.height >= 64 ? scene.height : 450;
  const background =
    typeof scene.background === 'string' && scene.background
      ? scene.background
      : '#faf8f5';
  const loop = scene.loop !== false;
  const pingPong = Boolean(scene.pingPong);

  const { fps, durationSec, totalLogicalFrames, previewFrameCount } = getSceneTimingMeta(
    scene,
    overrideFps
  );

  const frames: StopMotionFrame[] = [];
  const baseTs = Date.now();

  for (let pIdx = 0; pIdx < previewFrameCount; pIdx += 1) {
    // Map preview sample evenly across totalLogicalFrames so duration & kinematics match 1:1
    const logicalIdx =
      previewFrameCount === totalLogicalFrames
        ? pIdx
        : Math.round((pIdx / Math.max(1, previewFrameCount - 1)) * (totalLogicalFrames - 1));

    const innerSvg = renderStopMotionSceneFrameSvg(
      scene,
      logicalIdx,
      totalLogicalFrames,
      fps
    );

    frames.push({
      id: `v3-frame-${pIdx}-${baseTs}`,
      dataUrl: svgMarkupToDataUrlFn(innerSvg, width, height, background),
      svgMarkup: innerSvg,
      background,
      hold: 1,
      createdAt: baseTs + pIdx,
    });
  }

  return {
    title: scene.title || 'Vector Animation',
    format: scene.format || 'stopmotion/v3',
    fps,
    width,
    height,
    background,
    loop,
    pingPong,
    durationSec,
    totalLogicalFrames,
    sourceScene: scene,
    audioSpec: scene.audio,
    frames,
  };
}

/**
 * Conserves true real-world timeline durationSec when changing target FPS!
 */
export function recompileStopMotionAtFps(
  scene: StopMotionSceneV2,
  targetFps: number,
  svgMarkupToDataUrlFn: (svg: string, w: number, h: number, bg: string) => string
): VectorStopMotionSpec {
  const clampedFps = Math.max(1, Math.min(60, Math.round(targetFps)));
  return compileStopMotionSceneV2(scene, svgMarkupToDataUrlFn, clampedFps);
}

/**
 * Pre-flight Chain-of-Thought fidelity evaluator ("what-if" physics, shadow, audio & timing checks).
 */
export function evaluateStopMotionFidelity(scene: StopMotionSceneV2): {
  score: number;
  notes: string[];
  estimatedTotalFrames: number;
  durationSec: number;
} {
  const { durationSec, totalLogicalFrames } = getSceneTimingMeta(scene);
  const notes: string[] = [];
  let score = 70;

  if (scene.layers.some((l) => Boolean(l.shadow))) {
    score += 8;
    notes.push('Dynamic contact/drop shadows enabled');
  } else {
    notes.push('Tip: Add shadow layers for stronger depth grounding');
  }

  if (scene.storyboard?.shots && scene.storyboard.shots.length > 0) {
    score += 7;
    notes.push(`${scene.storyboard.shots.length} storyboard camera shot(s) configured`);
  }

  if (scene.groups && Object.keys(scene.groups).length > 0) {
    score += 5;
    notes.push(`${Object.keys(scene.groups).length} reusable idLink group(s) linked`);
  }

  if (scene.audio) {
    score += 6;
    notes.push('Pure-math audio waveform track synced');
  }

  if (
    scene.layers.some(
      (l) => Boolean(l.threeD || l.curve || l.pixelTexture || l.follow || l.lining)
    )
  ) {
    score += 4;
    notes.push('Multi-modal 3D/Curve/Texture choreography active');
  }

  if (totalLogicalFrames > MAX_PREVIEW_FRAMES) {
    notes.push(
      `Long-form timeline (${totalLogicalFrames.toLocaleString()} frames / ${durationSec.toFixed(1)}s): preview smoothly subsampled to ${MAX_PREVIEW_FRAMES}f; use Server Bake for full frame-exact WebM`
    );
  }

  return {
    score: Math.min(100, score),
    notes,
    estimatedTotalFrames: totalLogicalFrames,
    durationSec,
  };
}
