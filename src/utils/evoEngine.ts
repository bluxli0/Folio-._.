import type { MathAudioTrackSpec } from './mathAudioSynth';

export type EvoGeometryType =
  | 'box'
  | 'sphere'
  | 'torus'
  | 'torusKnot'
  | 'cylinder'
  | 'cone'
  | 'icosahedron'
  | 'octahedron'
  | 'ring'
  | 'plane'
  | 'capsule'
  | 'group';

export type EvoEasingName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeOutExpo'
  | 'easeOutBounce'
  | 'backOut'
  | 'elasticOut';

export interface EvoMotionSpec {
  x?: number | string;
  y?: number | string;
  z?: number | string;
  rx?: number | string;
  ry?: number | string;
  rz?: number | string;
  rotateX?: number | string;
  rotateY?: number | string;
  rotateZ?: number | string;
  scale?: number | string;
  scaleX?: number | string;
  scaleY?: number | string;
  scaleZ?: number | string;
  spinY?: number;
  spinX?: number;
  bob?: number | { amp: number; freq?: number; phase?: number };
  sway?: number | { amp: number; freq?: number; phase?: number };
  orbit?: {
    cx?: number;
    cz?: number;
    rx: number;
    rz?: number;
    turns?: number;
    phase?: number;
  };
  pulse?: { min?: number; max?: number; freq?: number; phase?: number };
}

export interface EvoKeyframeSpec {
  at: number;
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  scale?: number;
  ease?: EvoEasingName;
}

export interface EvoMaterialSpec {
  color?: string;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  thickness?: number;
  ior?: number;
  iridescence?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  wireframe?: boolean;
  usePixelTexture?: boolean;
}

export interface EvoNodeSpec {
  id?: string;
  idLink?: string;
  type?: EvoGeometryType;
  size?: number | [number, number, number];
  radius?: number;
  tube?: number;
  height?: number;
  segments?: number;
  position?: [number, number, number];
  rotation?: [number, number, number]; // degrees
  scale?: number | [number, number, number];
  material?: EvoMaterialSpec;
  motion?: EvoMotionSpec;
  keyframes?: EvoKeyframeSpec[];
  follow?: {
    targetId: string;
    lag?: number;
    offsetX?: number;
    offsetY?: number;
    offsetZ?: number;
  };
  repeat?: {
    count: number;
    radius?: number;
    angleStep?: number;
    dx?: number;
    dy?: number;
    dz?: number;
  };
  children?: EvoNodeSpec[];
}

export interface EvoStoryboardShot {
  id?: string;
  label?: string;
  start: number; // 0..1 normalized
  end: number;
  cameraCut?: 'wide' | 'medium' | 'closeup' | 'dutch' | 'overhead' | 'orbit';
  camera?: {
    x?: number;
    y?: number;
    z?: number;
    targetX?: number;
    targetY?: number;
    targetZ?: number;
    fov?: number;
    roll?: number;
  };
  trackingTarget?: string;
  uiAngle?: {
    title?: string;
    subtitle?: string;
    badge?: string;
    showTimecode?: boolean;
  };
}

export interface EvoSceneSpec {
  format: 'evo/v1';
  title: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  loop: boolean;
  pingPong: boolean;
  background: string;
  environment: 'studio' | 'neon' | 'sunset' | 'obsidian' | 'void';
  gridFloor?: boolean;
  contactShadows?: boolean;
  pixelLayer?: Record<string, unknown>;
  groups?: Record<string, EvoNodeSpec>;
  nodes: EvoNodeSpec[];
  storyboard?: {
    script?: string;
    shots: EvoStoryboardShot[];
  };
  audio?: MathAudioTrackSpec;
  rawJson: string;
  fidelity: {
    score: number;
    notes: string[];
  };
}

export function applyEvoEasing(name: EvoEasingName | undefined, u: number): number {
  const x = Math.max(0, Math.min(1, u));
  switch (name) {
    case 'easeIn':
      return x * x * x;
    case 'easeOut':
      return 1 - Math.pow(1 - x, 3);
    case 'easeInOut':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'easeOutExpo':
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    case 'easeOutBounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) {
        const k = x - 1.5 / d1;
        return n1 * k * k + 0.75;
      }
      if (x < 2.5 / d1) {
        const k = x - 2.25 / d1;
        return n1 * k * k + 0.9375;
      }
      const k = x - 2.625 / d1;
      return n1 * k * k + 0.984375;
    }
    case 'backOut': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    case 'elasticOut': {
      if (x === 0 || x === 1) return x;
      return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    }
    default:
      return x;
  }
}

export function evaluateEvoMathExpr(
  expr: number | string | undefined,
  t: number,
  i: number,
  n: number,
  durationSec: number,
  fallback = 0
): number {
  if (typeof expr === 'number') return Number.isFinite(expr) ? expr : fallback;
  if (typeof expr !== 'string' || !expr.trim()) return fallback;
  const trimmed = expr.trim();
  const numVal = Number(trimmed);
  if (Number.isFinite(numVal)) return numVal;

  try {
    const scope = {
      t,
      u: t,
      i,
      n,
      sec: t * durationSec,
      duration: durationSec,
      PI: Math.PI,
      TAU: Math.PI * 2,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      abs: Math.abs,
      sqrt: Math.sqrt,
      pow: Math.pow,
      exp: Math.exp,
      min: Math.min,
      max: Math.max,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      atan2: Math.atan2,
      hypot: Math.hypot,
      lerp: (a: number, b: number, f: number) => a + (b - a) * f,
      clamp: (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)),
      pingpong: (x: number) => 1 - Math.abs(((x % 2) + 2) % 2 - 1),
      smoothstep: (e0: number, e1: number, x: number) => {
        const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1)));
        return k * k * (3 - 2 * k);
      },
      easeInOut: (x: number) => applyEvoEasing('easeInOut', x),
      easeOutExpo: (x: number) => applyEvoEasing('easeOutExpo', x),
      easeOutBounce: (x: number) => applyEvoEasing('easeOutBounce', x),
      backOut: (x: number) => applyEvoEasing('backOut', x),
      elasticOut: (x: number) => applyEvoEasing('elasticOut', x),
      wave: (x: number, freq = 1) => 0.5 + 0.5 * Math.sin(x * Math.PI * 2 * freq),
      deg: (d: number) => (d * Math.PI) / 180,
    };

    const keys = Object.keys(scope);
    const vals = Object.values(scope);
    // Reject obvious unsafe identifiers
    if (/(?:window|document|globalThis|Function|eval|fetch|import|require|process)\b/.test(trimmed)) {
      return fallback;
    }
    const fn = new Function(...keys, `"use strict"; return (${trimmed});`);
    const out = fn(...vals);
    return typeof out === 'number' && Number.isFinite(out) ? out : fallback;
  } catch {
    return fallback;
  }
}

export function evaluateEvoSpecFidelity(spec: {
  nodes: EvoNodeSpec[];
  storyboard?: EvoSceneSpec['storyboard'];
  pixelLayer?: Record<string, unknown>;
  audio?: MathAudioTrackSpec;
  durationSec: number;
  fps: number;
}): { score: number; notes: string[] } {
  let score = 68;
  const notes: string[] = [];

  const nodeCount = spec.nodes.length;
  if (nodeCount >= 3) {
    score += 10;
    notes.push(`Composite 3D hierarchy (${nodeCount} top-level node${nodeCount === 1 ? '' : 's'})`);
  } else {
    notes.push(`${nodeCount} top-level node(s)`);
  }

  const hasMotion = spec.nodes.some((n) => Boolean(n.motion || n.keyframes?.length));
  if (hasMotion) {
    score += 8;
    notes.push('Liquid-Motion math expressions / keyframes active');
  }

  if (spec.storyboard?.shots && spec.storyboard.shots.length > 0) {
    score += 6;
    notes.push(`${spec.storyboard.shots.length} damped storyboard camera shot(s)`);
  }

  if (spec.pixelLayer) {
    score += 4;
    notes.push('Pixel Engine texture mapped onto 3D surface');
  }

  if (spec.audio) {
    score += 4;
    notes.push('Math-synthesized audio track synced to timeline');
  }

  notes.push(`Timeline: ${spec.durationSec}s @ ${spec.fps}fps`);

  return {
    score: Math.min(100, score),
    notes,
  };
}

export function parseEvoCode(
  rawCode: string
): { spec?: EvoSceneSpec; error?: string } {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { error: 'Empty EVO 3D specification.' };
  }

  const unfenced = trimmed
    .replace(/^```(?:evo(?:\/v1)?|json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(unfenced) as Record<string, unknown>;
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Invalid EVO JSON: ${err.message}`
          : 'Invalid EVO JSON syntax.',
    };
  }

  const rawNodes = Array.isArray(parsed.nodes)
    ? (parsed.nodes as EvoNodeSpec[])
    : Array.isArray(parsed.objects)
    ? (parsed.objects as EvoNodeSpec[])
    : Array.isArray(parsed.layers)
    ? (parsed.layers as EvoNodeSpec[])
    : Array.isArray(parsed.motionLayers)
    ? (parsed.motionLayers as EvoNodeSpec[])
    : [];

  if (rawNodes.length === 0) {
    return {
      error:
        'EVO requires a non-empty "nodes" (or "objects" / "layers") array of 3D primitives.',
    };
  }

  const title =
    typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : 'EVO 3D Scene';
  const width =
    typeof parsed.width === 'number' && parsed.width >= 160
      ? Math.min(1920, Math.round(parsed.width))
      : 800;
  const height =
    typeof parsed.height === 'number' && parsed.height >= 120
      ? Math.min(1080, Math.round(parsed.height))
      : 450;
  const fps =
    typeof parsed.fps === 'number' && parsed.fps >= 1 && parsed.fps <= 60
      ? Math.round(parsed.fps)
      : 30;
  const durationSec =
    typeof parsed.durationSec === 'number' && parsed.durationSec > 0
      ? Math.min(600, parsed.durationSec)
      : 4;
  const background =
    typeof parsed.background === 'string' && parsed.background.trim()
      ? parsed.background.trim()
      : '#090d16';

  const envRaw =
    typeof parsed.environment === 'string'
      ? parsed.environment.toLowerCase()
      : 'studio';
  const environment: EvoSceneSpec['environment'] =
    envRaw === 'neon' ||
    envRaw === 'sunset' ||
    envRaw === 'obsidian' ||
    envRaw === 'void'
      ? envRaw
      : 'studio';

  const pixelLayer =
    (parsed.pixelLayer as Record<string, unknown> | undefined) ||
    (parsed.pixelArt as Record<string, unknown> | undefined) ||
    (parsed.pixelTexture as Record<string, unknown> | undefined);

  const storyboard = parsed.storyboard as EvoSceneSpec['storyboard'] | undefined;
  const audio = parsed.audio as MathAudioTrackSpec | undefined;

  const fidelity = evaluateEvoSpecFidelity({
    nodes: rawNodes,
    storyboard,
    pixelLayer,
    audio,
    durationSec,
    fps,
  });

  return {
    spec: {
      format: 'evo/v1',
      title,
      width,
      height,
      fps,
      durationSec,
      loop: parsed.loop !== false,
      pingPong: Boolean(parsed.pingPong),
      background,
      environment,
      gridFloor: parsed.gridFloor !== false,
      contactShadows: parsed.contactShadows !== false,
      pixelLayer,
      groups: parsed.groups as Record<string, EvoNodeSpec> | undefined,
      nodes: rawNodes,
      storyboard,
      audio,
      rawJson: JSON.stringify(parsed, null, 2),
      fidelity,
    },
  };
}

export function exportEvoXml(spec: EvoSceneSpec): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const safeJson = spec.rawJson.replace(/\]\]>/g, ']]]]><![CDATA[>');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<evo format="evo/v1" title="${esc(spec.title)}" width="${spec.width}" height="${spec.height}" fps="${spec.fps}" durationSec="${spec.durationSec}" environment="${esc(spec.environment)}">`,
    `  <nodes count="${spec.nodes.length}" />`,
    `  <spec><![CDATA[${safeJson}]]></spec>`,
    '</evo>',
  ].join('\n');
}
