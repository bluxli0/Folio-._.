import type { MathAudioTrackSpec } from './mathAudioSynth';
import { UNIFIED_MATH_FUNCS, applyUnifiedEasing } from './mathFunctions';

export type EvoGeometryType =
  | 'box'
  | 'sphere'
  | 'torus'
  | 'torusKnot'
  | 'cylinder'
  | 'cone'
  | 'icosahedron'
  | 'octahedron'
  | 'dodecahedron'
  | 'tetrahedron'
  | 'prism'
  | 'pyramid'
  | 'helix'
  | 'mobius'
  | 'klein'
  | 'lathe'
  | 'gear'
  | 'star3d'
  | 'voxelGrid'
  | 'particles3d'
  | 'axes3d'
  | 'wireCube'
  | 'ring'
  | 'plane'
  | 'capsule'
  | 'graph'
  | 'surface'
  | 'curve'
  | 'group';

export type EvoEasingName = string;

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
  spinX?: number;
  spinY?: number;
  spinZ?: number;
  bob?: number | { amp: number; freq?: number; phase?: number };
  sway?: number | { amp: number; freq?: number; phase?: number };
  waveY?: number | { amp: number; freq?: number; phase?: number };
  bounceAmp?: number;
  orbit?: {
    cx?: number;
    cy?: number;
    cz?: number;
    rx: number;
    ry?: number;
    rz?: number;
    turns?: number;
    phase?: number;
  };
  orbitY?: number | { radius?: number; turns?: number; phase?: number };
  orbitX?: number | { radius?: number; turns?: number; phase?: number };
  lissajous?: { ax?: number; ay?: number; az?: number; fx?: number; fy?: number; fz?: number; phase?: number };
  spiral?: { r0?: number; r1?: number; turns?: number; height?: number };
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

export type EvoMaterialPreset =
  | 'glass'
  | 'chrome'
  | 'gold'
  | 'neon'
  | 'hologram'
  | 'clay'
  | 'toon'
  | 'carbon'
  | 'obsidian'
  | 'lava'
  | 'ice'
  | 'emerald'
  | 'copper'
  | 'pearl';

export interface EvoMaterialSpec {
  preset?: EvoMaterialPreset;
  color?: string;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  thickness?: number;
  ior?: number;
  iridescence?: number;
  sheen?: number;
  sheenColor?: string;
  flatShading?: boolean;
  side?: 'front' | 'back' | 'double';
  blending?: 'normal' | 'additive' | 'multiply';
  envMapIntensity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  emissivePulse?: { min?: number; max?: number; freq?: number };
  outlineColor?: string;
  opacity?: number;
  wireframe?: boolean;
  usePixelTexture?: boolean;
  gradient?: {
    colors: string[];
    axis?: 'x' | 'y' | 'z' | 'radial';
  };
}

export interface EvoHitboxSpec {
  shape?: 'box' | 'sphere';
  size?: [number, number, number];
  radius?: number;
  show?: boolean;
  color?: string;
  collideColor?: string;
}

export interface EvoPhysicsSpec {
  enabled?: boolean;
  velocity?: [number, number, number];
  gravity?: number;
  mass?: number;
  restitution?: number;
  friction?: number;
  drag?: number;
  attractor?: { x?: number; y?: number; z?: number; strength?: number };
  floorY?: number;
  walls?: [number, number, number];
  collidable?: boolean;
  isStatic?: boolean;
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
  hitbox?: EvoHitboxSpec;
  physics?: EvoPhysicsSpec;
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
  graph?: {
    expr?: string;
    xExpr?: string;
    yExpr?: string;
    zExpr?: string;
    xmin?: number;
    xmax?: number;
    zmin?: number;
    zmax?: number;
    samples?: number;
    tubeRadius?: number;
  };
  teeth?: number;
  turns?: number;
  points?: number;
  count?: number;
  profile?: Array<[number, number]>;
  children?: EvoNodeSpec[];
}

export interface EvoStoryboardShot {
  id?: string;
  label?: string;
  name?: string;
  start: number; // 0..1 normalized
  end: number;
  cameraCut?: 'wide' | 'medium' | 'closeup' | 'dutch' | 'overhead' | 'orbit';
  position?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
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

export type EvoEnvironmentPreset =
  | 'studio'
  | 'neon'
  | 'sunset'
  | 'obsidian'
  | 'void'
  | 'cyberpunk'
  | 'arctic'
  | 'desert'
  | 'cosmic'
  | 'forest'
  | 'vaporwave'
  | 'midnight'
  | 'goldenHour';

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
  environment: EvoEnvironmentPreset;
  fog?: boolean | { color?: string; density?: number };
  starfield?: boolean | number;
  exposure?: number;
  camera?: {
    fov?: number;
    position?: [number, number, number];
    target?: [number, number, number];
    autoRotate?: boolean;
    autoRotateSpeed?: number;
  };
  gridFloor?: boolean;
  contactShadows?: boolean;
  showHitboxes?: boolean;
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
  return applyUnifiedEasing(u, name);
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
      ...UNIFIED_MATH_FUNCS,
      t,
      u: t,
      i,
      n,
      sec: t * durationSec,
      duration: durationSec,
      PI: Math.PI,
      TAU: Math.PI * 2,
      E: Math.E,
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

  const hasPhysicsOrHitbox = spec.nodes.some((n) => Boolean(n.physics || n.hitbox));
  if (hasPhysicsOrHitbox) {
    score += 5;
    notes.push('Rigid-body physics & collision hitbox solver active');
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Invalid EVO JSON: ${err.message}`
          : 'Invalid EVO JSON syntax.',
    };
  }

  let parsedObj: Record<string, unknown> = {};
  let rawNodes: EvoNodeSpec[] = [];

  if (Array.isArray(parsed)) {
    rawNodes = parsed as EvoNodeSpec[];
    parsedObj = { nodes: rawNodes };
  } else if (parsed && typeof parsed === 'object') {
    parsedObj = parsed as Record<string, unknown>;
    const sceneObj = (parsedObj.scene && typeof parsedObj.scene === 'object' ? parsedObj.scene : null) as Record<string, unknown> | null;
    const dataObj = (parsedObj.data && typeof parsedObj.data === 'object' ? parsedObj.data : null) as Record<string, unknown> | null;
    const specObj = (parsedObj.spec && typeof parsedObj.spec === 'object' ? parsedObj.spec : null) as Record<string, unknown> | null;

    const candidateArrays = [
      parsedObj.nodes,
      parsedObj.objects,
      parsedObj.layers,
      parsedObj.elements,
      parsedObj.primitives,
      parsedObj.items,
      parsedObj.children,
      parsedObj.shapes,
      parsedObj.models,
      parsedObj.meshes,
      parsedObj.primitives3d,
      parsedObj.motionLayers,
      sceneObj?.nodes,
      sceneObj?.objects,
      sceneObj?.elements,
      sceneObj?.layers,
      dataObj?.nodes,
      dataObj?.objects,
      specObj?.nodes,
      specObj?.objects,
    ];

    for (const arr of candidateArrays) {
      if (Array.isArray(arr) && arr.length > 0) {
        rawNodes = arr as EvoNodeSpec[];
        break;
      }
    }

    // Check if the root object itself is a single 3D node primitive
    if (rawNodes.length === 0) {
      const hasNodeType =
        typeof parsedObj.type === 'string' ||
        typeof parsedObj.shape === 'string' ||
        typeof parsedObj.geometry === 'string' ||
        Boolean(parsedObj.graph || parsedObj.surface || parsedObj.curve || parsedObj.mesh);
      if (hasNodeType) {
        rawNodes = [parsedObj as unknown as EvoNodeSpec];
      }
    }
  }

  // Graceful fallback primitive so the viewer always renders an interactive 3D scene cleanly
  if (rawNodes.length === 0) {
    rawNodes = [
      {
        id: 'hero_core',
        type: 'sphere',
        radius: 0.75,
        position: [0, 0, 0],
        material: {
          color: '#38bdf8',
          metalness: 0.45,
          roughness: 0.22,
          gradient: { colors: ['#38bdf8', '#818cf8', '#f43f5e'], axis: 'y' },
        },
        motion: { bob: { amp: 0.35, freq: 1.0 }, spinY: 45 },
        hitbox: { shape: 'sphere', radius: 0.75, show: true, color: '#22d3ee' },
        physics: {
          velocity: [0, 1.4, 0],
          gravity: -9.8,
          restitution: 0.86,
          floorY: -1.35,
          collidable: true,
        },
      },
    ];
  }

  const title =
    typeof parsedObj.title === 'string' && parsedObj.title.trim()
      ? parsedObj.title.trim()
      : 'EVO 3D Scene';
  const width =
    typeof parsedObj.width === 'number' && parsedObj.width >= 160
      ? Math.min(1920, Math.round(parsedObj.width))
      : 800;
  const height =
    typeof parsedObj.height === 'number' && parsedObj.height >= 120
      ? Math.min(1080, Math.round(parsedObj.height))
      : 450;
  const fps =
    typeof parsedObj.fps === 'number' && parsedObj.fps >= 1 && parsedObj.fps <= 60
      ? Math.round(parsedObj.fps)
      : 30;
  const durationSec =
    typeof parsedObj.durationSec === 'number' && parsedObj.durationSec > 0
      ? Math.min(600, parsedObj.durationSec)
      : 4;
  const background =
    typeof parsedObj.background === 'string' && parsedObj.background.trim()
      ? parsedObj.background.trim()
      : '#090d16';

  const envRaw =
    typeof parsedObj.environment === 'string'
      ? parsedObj.environment.toLowerCase()
      : 'studio';
  const validEnvs: Record<string, EvoEnvironmentPreset> = {
    studio: 'studio',
    neon: 'neon',
    sunset: 'sunset',
    obsidian: 'obsidian',
    void: 'void',
    cyberpunk: 'cyberpunk',
    arctic: 'arctic',
    desert: 'desert',
    cosmic: 'cosmic',
    forest: 'forest',
    vaporwave: 'vaporwave',
    midnight: 'midnight',
    goldenhour: 'goldenHour',
  };
  const environment: EvoEnvironmentPreset =
    validEnvs[envRaw.replace(/[^a-z]/g, '')] || 'studio';

  const pixelLayer =
    (parsedObj.pixelLayer as Record<string, unknown> | undefined) ||
    (parsedObj.pixelArt as Record<string, unknown> | undefined) ||
    (parsedObj.pixelTexture as Record<string, unknown> | undefined);

  const storyboard = parsedObj.storyboard as EvoSceneSpec['storyboard'] | undefined;
  const audio = parsedObj.audio as MathAudioTrackSpec | undefined;

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
      loop: parsedObj.loop !== false,
      pingPong: Boolean(parsedObj.pingPong),
      background,
      environment,
      fog: parsedObj.fog as EvoSceneSpec['fog'],
      starfield: parsedObj.starfield as EvoSceneSpec['starfield'],
      exposure: typeof parsedObj.exposure === 'number' ? parsedObj.exposure : undefined,
      camera: parsedObj.camera as EvoSceneSpec['camera'],
      gridFloor: parsedObj.gridFloor !== false,
      contactShadows: parsedObj.contactShadows !== false,
      showHitboxes: parsedObj.showHitboxes === true,
      pixelLayer,
      groups: parsedObj.groups as Record<string, EvoNodeSpec> | undefined,
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
