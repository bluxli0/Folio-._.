import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Box,
  Camera,
  Code2,
  Download,
  Film,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  EvoEasingName,
  EvoKeyframeSpec,
  EvoMaterialPreset,
  EvoMaterialSpec,
  EvoNodeSpec,
  EvoSceneSpec,
  applyEvoEasing,
  evaluateEvoMathExpr,
  exportEvoXml,
  parseEvoCode,
} from '../utils/evoEngine';
import { UNIFIED_MATH_FUNCS } from '../utils/mathFunctions';
import { parsePixelArtCode, renderPixelArtToCanvas } from '../utils/pixelArtParser';
import { createAudioBufferFromMathSpec } from '../utils/mathAudioSynth';

interface InlineEvoViewerProps {
  code: string;
  compact?: boolean;
}

interface RuntimeNodeRecord {
  id?: string;
  object: THREE.Object3D;
  spec: EvoNodeSpec;
  repeatIndex: number;
  repeatTotal: number;
  basePos: THREE.Vector3;
  baseRotDeg: THREE.Vector3;
  baseScale: THREE.Vector3;
  hasPhysics: boolean;
  isStatic: boolean;
  simPos: THREE.Vector3;
  simVel: THREE.Vector3;
  halfSize: THREE.Vector3;
  hitboxRadius: number;
  hitboxShape: 'box' | 'sphere';
  hitboxHelper?: THREE.LineSegments | THREE.Mesh;
  hitboxMat?: THREE.LineBasicMaterial | THREE.MeshBasicMaterial;
  hitboxIdleColor: THREE.Color;
  hitboxCollideColor: THREE.Color;
  hitFlashTimer: number;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function evaluateGraphPoint(
  expr: string | undefined,
  vars: Record<string, number>,
  fallback: number
): number {
  if (!expr) return fallback;
  try {
    const scope = {
      ...UNIFIED_MATH_FUNCS,
      ...vars,
      PI: Math.PI,
      TAU: Math.PI * 2,
      E: Math.E,
    };
    if (/(?:window|document|globalThis|Function|eval|fetch|import|require|process)\b/.test(expr)) {
      return fallback;
    }
    const fn = new Function(...Object.keys(scope), `"use strict"; return (${expr});`);
    const v = fn(...Object.values(scope));
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function applyVertexGradient(
  geom: THREE.BufferGeometry,
  gradient?: { colors: string[]; axis?: 'x' | 'y' | 'z' | 'radial' }
): boolean {
  if (!gradient || !Array.isArray(gradient.colors) || gradient.colors.length < 2) {
    return false;
  }
  const posAttr = geom.getAttribute('position');
  if (!posAttr) return false;

  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return false;

  const axis = gradient.axis || 'y';
  const stops = gradient.colors.map((c) => new THREE.Color(c));
  const colors = new Float32Array(posAttr.count * 3);
  const tmp = new THREE.Color();

  const spanX = Math.max(1e-4, bb.max.x - bb.min.x);
  const spanY = Math.max(1e-4, bb.max.y - bb.min.y);
  const spanZ = Math.max(1e-4, bb.max.z - bb.min.z);
  const maxR = Math.max(1e-4, Math.hypot(spanX * 0.5, spanY * 0.5, spanZ * 0.5));
  const cx = (bb.min.x + bb.max.x) * 0.5;
  const cy = (bb.min.y + bb.max.y) * 0.5;
  const cz = (bb.min.z + bb.max.z) * 0.5;

  for (let i = 0; i < posAttr.count; i += 1) {
    const px = posAttr.getX(i);
    const py = posAttr.getY(i);
    const pz = posAttr.getZ(i);
    let u = 0;
    if (axis === 'x') u = (px - bb.min.x) / spanX;
    else if (axis === 'z') u = (pz - bb.min.z) / spanZ;
    else if (axis === 'radial') u = Math.hypot(px - cx, py - cy, pz - cz) / maxR;
    else u = (py - bb.min.y) / spanY;

    u = Math.max(0, Math.min(1, u));
    const scaled = u * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(scaled));
    const frac = scaled - idx;
    tmp.copy(stops[idx]).lerp(stops[idx + 1], frac);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return true;
}

function buildGeometry(node: EvoNodeSpec): THREE.BufferGeometry {
  const seg = Math.max(8, Math.min(96, Math.round(node.segments ?? 28)));
  const r = node.radius ?? 0.6;
  const h = node.height ?? 1.2;
  switch (node.type) {
    case 'graph':
    case 'curve': {
      const g = node.graph || {};
      const samples = Math.max(24, Math.min(180, Math.round(g.samples ?? 72)));
      const xmin = g.xmin ?? -2.4;
      const xmax = g.xmax ?? 2.4;
      const tubeR = g.tubeRadius ?? 0.055;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= samples; i += 1) {
        const u = i / samples;
        const xBase = xmin + (xmax - xmin) * u;
        const vars = { u, x: xBase, t: 0, i, n: samples };
        const xVal = g.xExpr ? evaluateGraphPoint(g.xExpr, vars, xBase) : xBase;
        const yVal = evaluateGraphPoint(g.yExpr || g.expr || 'sin(x * 2.2) * 0.65', vars, 0);
        const zVal = g.zExpr ? evaluateGraphPoint(g.zExpr, vars, 0) : 0;
        pts.push(new THREE.Vector3(xVal, yVal, zVal));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.TubeGeometry(curve, samples, tubeR, 10, false);
    }
    case 'surface': {
      const g = node.graph || {};
      const segs = Math.max(12, Math.min(48, Math.round(g.samples ?? 28)));
      const sz = Array.isArray(node.size) ? node.size : [node.size ?? 3.6, node.size ?? 3.6];
      const geom = new THREE.PlaneGeometry(sz[0], sz[1], segs, segs);
      geom.rotateX(-Math.PI / 2);
      const pos = geom.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.hypot(x, z);
        const y = evaluateGraphPoint(
          g.expr || g.yExpr || 'sin(x * 1.8) * cos(z * 1.8) * 0.48',
          { x, z, r, u: x / (sz[0] || 1) + 0.5, t: 0 },
          0
        );
        pos.setY(i, y);
      }
      geom.computeVertexNormals();
      return geom;
    }
    case 'sphere':
      return new THREE.SphereGeometry(r, seg, seg);
    case 'torus':
      return new THREE.TorusGeometry(r, node.tube ?? r * 0.32, Math.max(12, Math.round(seg / 2)), seg);
    case 'torusKnot':
      return new THREE.TorusKnotGeometry(r * 0.72, node.tube ?? r * 0.22, seg * 3, 12);
    case 'cylinder':
      return new THREE.CylinderGeometry(r, r, h, seg);
    case 'cone':
      return new THREE.ConeGeometry(r, h, seg);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(r, 0);
    case 'octahedron':
      return new THREE.OctahedronGeometry(r, 0);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(r, 0);
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(r, 0);
    case 'prism':
      return new THREE.CylinderGeometry(r, r, h, Math.max(3, Math.round(node.points ?? 6)));
    case 'pyramid':
      return new THREE.ConeGeometry(r, h, Math.max(3, Math.round(node.points ?? 4)));
    case 'helix': {
      const turns = node.turns ?? 3;
      const samples = Math.max(32, Math.round(node.segments ?? 96));
      const pts: THREE.Vector3[] = [];
      for (let idx = 0; idx <= samples; idx += 1) {
        const u = idx / samples;
        const a = u * turns * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, (u - 0.5) * h * 1.8, Math.sin(a) * r));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), samples, node.tube ?? 0.08, 10, false);
    }
    case 'mobius': {
      const segU = Math.max(24, seg * 2);
      const segV = 8;
      const geom = new THREE.PlaneGeometry(1, 1, segU, segV);
      const pos = geom.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        const u = (pos.getX(i) + 0.5) * Math.PI * 2;
        const v = pos.getY(i) * (r * 0.55);
        const halfU = u * 0.5;
        const x = (r + v * Math.cos(halfU)) * Math.cos(u);
        const y = (r + v * Math.cos(halfU)) * Math.sin(u);
        const z = v * Math.sin(halfU);
        pos.setXYZ(i, x, y, z);
      }
      geom.computeVertexNormals();
      return geom;
    }
    case 'klein': {
      const segU = 36;
      const segV = 18;
      const geom = new THREE.PlaneGeometry(1, 1, segU, segV);
      const pos = geom.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) {
        const u = (pos.getX(i) + 0.5) * Math.PI * 2;
        const v = (pos.getY(i) + 0.5) * Math.PI * 2;
        const s = r * 0.28;
        const rad = 4 * (1 - Math.cos(u) / 2);
        let x: number;
        let y: number;
        if (u < Math.PI) {
          x = 6 * Math.cos(u) * (1 + Math.sin(u)) + rad * Math.cos(u) * Math.cos(v);
          y = 16 * Math.sin(u) + rad * Math.sin(u) * Math.cos(v);
        } else {
          x = 6 * Math.cos(u) * (1 + Math.sin(u)) + rad * Math.cos(v + Math.PI);
          y = 16 * Math.sin(u);
        }
        const z = rad * Math.sin(v);
        pos.setXYZ(i, x * s * 0.14, y * s * 0.14, z * s * 0.14);
      }
      geom.computeVertexNormals();
      return geom;
    }
    case 'lathe': {
      const pts = Array.isArray(node.profile) && node.profile.length >= 2
        ? node.profile.map(([px, py]) => new THREE.Vector2(px, py))
        : [
            new THREE.Vector2(0.01, -h * 0.5),
            new THREE.Vector2(r * 0.85, -h * 0.35),
            new THREE.Vector2(r * 0.4, 0),
            new THREE.Vector2(r * 0.9, h * 0.35),
            new THREE.Vector2(r * 0.5, h * 0.5),
          ];
      return new THREE.LatheGeometry(pts, seg);
    }
    case 'gear': {
      const teeth = Math.max(5, Math.round(node.teeth ?? 10));
      const shape = new THREE.Shape();
      const total = teeth * 4;
      const innerR = r * 0.72;
      const outerR = r;
      for (let i = 0; i <= total; i += 1) {
        const a = (i / total) * Math.PI * 2;
        const mod = i % 4;
        const rad = mod === 1 || mod === 2 ? outerR : innerR;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      const hole = new THREE.Path();
      hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geom = new THREE.ExtrudeGeometry(shape, { depth: h * 0.25, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03 });
      geom.center();
      return geom;
    }
    case 'star3d': {
      const pts = Math.max(4, Math.round(node.points ?? 5));
      const shape = new THREE.Shape();
      for (let i = 0; i <= pts * 2; i += 1) {
        const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.44;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      const geom = new THREE.ExtrudeGeometry(shape, { depth: h * 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03 });
      geom.center();
      return geom;
    }
    case 'wireCube':
    case 'voxelGrid':
    case 'axes3d':
    case 'particles3d': {
      const s = Array.isArray(node.size) ? node.size : [node.size ?? r * 2, node.size ?? r * 2, node.size ?? r * 2];
      return new THREE.BoxGeometry(s[0], s[1], s[2]);
    }
    case 'ring':
      return new THREE.RingGeometry(r * 0.55, r, seg);
    case 'plane': {
      const sz = Array.isArray(node.size) ? node.size : [node.size ?? 2, node.size ?? 2];
      return new THREE.PlaneGeometry(sz[0], sz[1]);
    }
    case 'capsule':
      return new THREE.CapsuleGeometry(r * 0.55, h * 0.65, 8, seg);
    case 'box':
    default: {
      if (Array.isArray(node.size)) {
        return new THREE.BoxGeometry(node.size[0], node.size[1], node.size[2]);
      }
      const s = node.size ?? 1;
      return new THREE.BoxGeometry(s, s, s);
    }
  }
}

function sampleKeyframes(
  keyframes: EvoKeyframeSpec[],
  u: number
): Partial<EvoKeyframeSpec> {
  if (keyframes.length === 0) return {};
  const sorted = [...keyframes].sort((a, b) => a.at - b.at);
  if (u <= sorted[0].at) return sorted[0];
  if (u >= sorted[sorted.length - 1].at) return sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (u >= a.at && u <= b.at) {
      const span = b.at - a.at || 1;
      const local = applyEvoEasing((b.ease || a.ease) as EvoEasingName | undefined, (u - a.at) / span);
      const lerpNum = (va?: number, vb?: number) => {
        if (va === undefined && vb === undefined) return undefined;
        const nA = va ?? vb ?? 0;
        const nB = vb ?? va ?? 0;
        return nA + (nB - nA) * local;
      };
      return {
        x: lerpNum(a.x, b.x),
        y: lerpNum(a.y, b.y),
        z: lerpNum(a.z, b.z),
        rx: lerpNum(a.rx, b.rx),
        ry: lerpNum(a.ry, b.ry),
        rz: lerpNum(a.rz, b.rz),
        scale: lerpNum(a.scale, b.scale),
      };
    }
  }
  return sorted[sorted.length - 1];
}

function resolveBackgroundColor(spec: EvoSceneSpec): string {
  if (spec.background) return spec.background;
  switch (spec.environment) {
    case 'neon':
    case 'cyberpunk':
      return '#050816';
    case 'sunset':
    case 'goldenHour':
      return '#1a0f18';
    case 'obsidian':
      return '#0a0a0c';
    case 'arctic':
      return '#061526';
    case 'desert':
      return '#1f1309';
    case 'cosmic':
    case 'midnight':
      return '#040511';
    case 'forest':
      return '#05160e';
    case 'vaporwave':
      return '#160726';
    case 'void':
      return '#030407';
    default:
      return '#0f172a';
  }
}

const EVO_MATERIAL_PRESETS: Record<EvoMaterialPreset, Partial<EvoMaterialSpec>> = {
  glass: { color: '#e0f2fe', roughness: 0.06, metalness: 0.05, transmission: 0.92, thickness: 1.0, ior: 1.5, clearcoat: 1 },
  chrome: { color: '#e2e8f0', roughness: 0.06, metalness: 0.98, clearcoat: 0.8 },
  gold: { color: '#fbbf24', roughness: 0.16, metalness: 0.94, clearcoat: 0.4 },
  neon: { color: '#22d3ee', roughness: 0.2, metalness: 0.1, emissive: '#22d3ee', emissiveIntensity: 1.6 },
  hologram: { color: '#38bdf8', roughness: 0.15, metalness: 0.2, iridescence: 1.0, opacity: 0.68, emissive: '#818cf8', emissiveIntensity: 0.7 },
  clay: { color: '#f97316', roughness: 0.88, metalness: 0.04, clearcoat: 0 },
  toon: { color: '#38bdf8', roughness: 0.75, metalness: 0.02, flatShading: true },
  carbon: { color: '#1e293b', roughness: 0.35, metalness: 0.65, clearcoat: 0.9 },
  obsidian: { color: '#09090b', roughness: 0.08, metalness: 0.82, clearcoat: 1.0 },
  lava: { color: '#ea580c', roughness: 0.55, metalness: 0.15, emissive: '#f97316', emissiveIntensity: 1.4 },
  ice: { color: '#bae6fd', roughness: 0.12, metalness: 0.08, transmission: 0.78, ior: 1.31, clearcoat: 0.9 },
  emerald: { color: '#10b981', roughness: 0.1, metalness: 0.15, transmission: 0.68, ior: 1.57, clearcoat: 1 },
  copper: { color: '#d97757', roughness: 0.22, metalness: 0.92, clearcoat: 0.3 },
  pearl: { color: '#fdf2f8', roughness: 0.14, metalness: 0.12, iridescence: 0.95, sheen: 0.8, sheenColor: '#f472b6', clearcoat: 1 },
};

export const InlineEvoViewer: React.FC<InlineEvoViewerProps> = ({
  code,
  compact = true,
}) => {
  const parsed = useMemo(() => parseEvoCode(code), [code]);
  const spec = parsed.spec;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0..1
  const [autoCamera, setAutoCamera] = useState(true);
  const [showHitboxes, setShowHitboxes] = useState(() =>
    Boolean(spec?.showHitboxes || spec?.nodes.some((n) => Boolean(n.hitbox?.show || n.physics)))
  );
  const [audioMuted, setAudioMuted] = useState(true);
  const [showHud, setShowHud] = useState(true);
  const [showFidelity, setShowFidelity] = useState(false);
  const [isBakingWebm, setIsBakingWebm] = useState(false);
  const [hudShotLabel, setHudShotLabel] = useState<string>('');
  const [webglError, setWebglError] = useState<string | null>(null);

  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const autoCameraRef = useRef(autoCamera);
  autoCameraRef.current = autoCamera;
  const showHitboxesRef = useRef(showHitboxes);
  showHitboxesRef.current = showHitboxes;
  const audioMutedRef = useRef(audioMuted);
  audioMutedRef.current = audioMuted;
  const resetPhysicsRef = useRef<(() => void) | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch {
        // already stopped
      }
      audioSourceRef.current = null;
    }
  };

  useEffect(() => {
    if (!spec?.audio || audioMuted || !isPlaying) {
      stopAudio();
      return;
    }

    let cancelled = false;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      if (cancelled) return;
      const buf = createAudioBufferFromMathSpec(ctx, {
        ...spec.audio,
        durationSec: spec.audio.durationSec ?? spec.durationSec,
      });
      stopAudio();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = spec.loop;
      src.connect(ctx.destination);
      const offset = (progressRef.current * spec.durationSec) % Math.max(0.1, buf.duration);
      src.start(0, offset);
      audioSourceRef.current = src;
    } catch {
      // Ignore WebAudio restriction
    }

    return () => {
      cancelled = true;
      stopAudio();
    };
  }, [spec, audioMuted, isPlaying]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !spec) return;

    setWebglError(null);
    let disposed = false;
    let rafId = 0;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'WebGL context unavailable in this browser.'
      );
      return;
    }

    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareWebGL = /SwiftShader|llvmpipe|Softpipe/i.test(rendererStr);

    renderer.setPixelRatio(isSoftwareWebGL ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = spec.exposure ?? 1.1;
    renderer.shadowMap.enabled = Boolean(spec.contactShadows && !isSoftwareWebGL);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvasRef.current = canvas;
    container.innerHTML = '';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const bgHex = resolveBackgroundColor(spec);
    scene.background = new THREE.Color(bgHex);
    if (spec.fog !== false) {
      const fogCol = typeof spec.fog === 'object' && spec.fog.color ? spec.fog.color : bgHex;
      const fogDen = typeof spec.fog === 'object' && typeof spec.fog.density === 'number'
        ? spec.fog.density
        : spec.environment === 'void' || spec.environment === 'cosmic'
        ? 0.045
        : 0.024;
      scene.fog = new THREE.FogExp2(fogCol, fogDen);
    }

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const initialW = container.clientWidth || spec.width || 640;
    const initialH = container.clientHeight || Math.round((initialW * spec.height) / spec.width) || 360;
    renderer.setSize(initialW, initialH, false);

    const camera = new THREE.PerspectiveCamera(spec.camera?.fov ?? 45, initialW / Math.max(1, initialH), 0.1, 180);
    const camPos = spec.camera?.position || [0, 2.4, 6.2];
    const camTarget = spec.camera?.target || [0, 0.2, 0];
    camera.position.set(camPos[0], camPos[1], camPos[2]);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.autoRotate = Boolean(spec.camera?.autoRotate);
    controls.autoRotateSpeed = spec.camera?.autoRotateSpeed ?? 1.2;
    controls.target.set(camTarget[0], camTarget[1], camTarget[2]);

    let userInteracting = false;
    const onControlStart = () => {
      userInteracting = true;
    };
    controls.addEventListener('start', onControlStart);

    // Environment-matched Lighting Rig
    const hemiSky =
      spec.environment === 'sunset' || spec.environment === 'goldenHour' || spec.environment === 'desert'
        ? 0xfdba74
        : spec.environment === 'forest'
        ? 0x86efac
        : spec.environment === 'vaporwave' || spec.environment === 'cyberpunk'
        ? 0xf472b6
        : 0xe0f2fe;
    const hemiLight = new THREE.HemisphereLight(hemiSky, 0x111827, 0.55);
    scene.add(hemiLight);

    const keyColor =
      spec.environment === 'sunset' || spec.environment === 'desert'
        ? 0xfb923c
        : spec.environment === 'neon' || spec.environment === 'cyberpunk' || spec.environment === 'arctic'
        ? 0x38bdf8
        : spec.environment === 'forest'
        ? 0x4ade80
        : 0xffffff;
    const keyLight = new THREE.DirectionalLight(keyColor, 2.1);
    keyLight.position.set(4.5, 7, 5);
    if (renderer.shadowMap.enabled) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 25;
      keyLight.shadow.bias = -0.0004;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
      spec.environment === 'neon' || spec.environment === 'cyberpunk' || spec.environment === 'vaporwave' ? 0xe879f9 : 0x60a5fa,
      1.15
    );
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    let starPoints: THREE.Points | null = null;
    if (spec.starfield || spec.environment === 'cosmic' || spec.environment === 'midnight') {
      const starCount = typeof spec.starfield === 'number' ? Math.max(40, Math.min(2000, spec.starfield)) : 320;
      const starPos = new Float32Array(starCount * 3);
      for (let si = 0; si < starCount; si += 1) {
        const theta = (si * 2.39996) % (Math.PI * 2);
        const phi = Math.acos(1 - 2 * ((si + 0.5) / starCount));
        const rad = 18 + (si % 11) * 1.4;
        starPos[si * 3] = Math.sin(phi) * Math.cos(theta) * rad;
        starPos[si * 3 + 1] = Math.cos(phi) * rad * 0.7 + 2;
        starPos[si * 3 + 2] = Math.sin(phi) * Math.sin(theta) * rad;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const sm = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.14, transparent: true, opacity: 0.8 });
      starPoints = new THREE.Points(sg, sm);
      scene.add(starPoints);
    }

    let gridHelper: THREE.GridHelper | null = null;
    if (spec.gridFloor !== false) {
      gridHelper = new THREE.GridHelper(18, 24, 0x334155, 0x1e293b);
      gridHelper.position.y = -1.35;
      scene.add(gridHelper);
    }

    // Optional Pixel Engine Texture Synthesis
    let sharedPixelTexture: THREE.CanvasTexture | null = null;
    if (spec.pixelLayer) {
      const pixParsed = parsePixelArtCode(JSON.stringify(spec.pixelLayer));
      if (pixParsed.spec && pixParsed.spec.frames.length > 0) {
        const pxCanvas = renderPixelArtToCanvas(
          pixParsed.spec.frames[0],
          pixParsed.spec.width,
          pixParsed.spec.height,
          1,
          false
        );
        sharedPixelTexture = new THREE.CanvasTexture(pxCanvas);
        sharedPixelTexture.colorSpace = THREE.SRGBColorSpace;
        sharedPixelTexture.magFilter = THREE.NearestFilter;
        sharedPixelTexture.minFilter = THREE.NearestFilter;
        sharedPixelTexture.needsUpdate = true;
      }
    }

    const disposables: {
      geometries: THREE.BufferGeometry[];
      materials: THREE.Material[];
    } = { geometries: [], materials: [] };

    const runtimeNodes: RuntimeNodeRecord[] = [];
    const nodeById = new Map<string, RuntimeNodeRecord>();

    const buildNodeHierarchy = (
      rawNode: EvoNodeSpec,
      parent: THREE.Object3D,
      repeatIndex: number,
      repeatTotal: number
    ) => {
      const merged: EvoNodeSpec =
        rawNode.idLink && spec.groups?.[rawNode.idLink]
          ? {
              ...spec.groups[rawNode.idLink],
              ...rawNode,
              material: {
                ...(spec.groups[rawNode.idLink].material || {}),
                ...(rawNode.material || {}),
              },
              motion: {
                ...(spec.groups[rawNode.idLink].motion || {}),
                ...(rawNode.motion || {}),
              },
            }
          : rawNode;

      let obj: THREE.Object3D;
      if (merged.type === 'group') {
        obj = new THREE.Group();
      } else if (merged.type === 'axes3d') {
        obj = new THREE.AxesHelper(merged.radius ?? 1.8);
      } else if (merged.type === 'particles3d') {
        const count = Math.max(24, Math.min(2000, Math.round(merged.count ?? 180)));
        const rad = merged.radius ?? 1.6;
        const pPos = new Float32Array(count * 3);
        for (let pi = 0; pi < count; pi += 1) {
          const a = (pi * 2.39996) % (Math.PI * 2);
          const phi = Math.acos(1 - 2 * ((pi + 0.5) / count));
          const rVal = rad * (0.4 + 0.6 * ((pi % 7) / 6));
          pPos[pi * 3] = Math.sin(phi) * Math.cos(a) * rVal;
          pPos[pi * 3 + 1] = Math.cos(phi) * rVal;
          pPos[pi * 3 + 2] = Math.sin(phi) * Math.sin(a) * rVal;
        }
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        const pm = new THREE.PointsMaterial({
          color: new THREE.Color(merged.material?.color || '#38bdf8'),
          size: merged.tube ?? 0.08,
          transparent: true,
          opacity: merged.material?.opacity ?? 0.85,
          blending: merged.material?.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        disposables.geometries.push(pg);
        disposables.materials.push(pm);
        obj = new THREE.Points(pg, pm);
      } else {
        const geom = buildGeometry(merged);
        const rawMat = merged.material || {};
        const presetMat = rawMat.preset ? EVO_MATERIAL_PRESETS[rawMat.preset] || {} : {};
        const mSpec: EvoMaterialSpec = { ...presetMat, ...rawMat };
        if (merged.type === 'wireCube') {
          mSpec.wireframe = true;
        }
        const hasVertexGrad = applyVertexGradient(geom, mSpec.gradient);
        disposables.geometries.push(geom);
        const useTex = Boolean(sharedPixelTexture && mSpec.usePixelTexture !== false && (mSpec.usePixelTexture === true || !mSpec.color));
        const sideConst =
          mSpec.side === 'double' || merged.type === 'surface' || merged.type === 'mobius' || merged.type === 'klein'
            ? THREE.DoubleSide
            : mSpec.side === 'back'
            ? THREE.BackSide
            : THREE.FrontSide;
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(hasVertexGrad ? '#ffffff' : (mSpec.color || (useTex ? '#ffffff' : '#38bdf8'))),
          vertexColors: hasVertexGrad,
          roughness: mSpec.roughness ?? 0.34,
          metalness: mSpec.metalness ?? 0.25,
          clearcoat: mSpec.clearcoat ?? 0.35,
          clearcoatRoughness: mSpec.clearcoatRoughness ?? 0.2,
          transmission: mSpec.transmission ?? 0,
          thickness: mSpec.thickness ?? 0.5,
          ior: mSpec.ior ?? 1.45,
          iridescence: mSpec.iridescence ?? 0,
          sheen: mSpec.sheen ?? 0,
          sheenColor: new THREE.Color(mSpec.sheenColor || '#ffffff'),
          flatShading: Boolean(mSpec.flatShading),
          envMapIntensity: mSpec.envMapIntensity ?? 1.0,
          emissive: new THREE.Color(mSpec.emissive || '#000000'),
          emissiveIntensity: mSpec.emissiveIntensity ?? (mSpec.emissive ? 0.65 : 0),
          transparent: (typeof mSpec.opacity === 'number' && mSpec.opacity < 1) || mSpec.blending === 'additive',
          opacity: mSpec.opacity ?? 1,
          blending: mSpec.blending === 'additive' ? THREE.AdditiveBlending : mSpec.blending === 'multiply' ? THREE.MultiplyBlending : THREE.NormalBlending,
          wireframe: Boolean(mSpec.wireframe),
          side: sideConst,
          ...(useTex && sharedPixelTexture ? { map: sharedPixelTexture } : {}),
        });
        disposables.materials.push(mat);
        const mesh = new THREE.Mesh(geom, mat);
        if (renderer.shadowMap.enabled) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
        obj = mesh;
      }

      const pos = merged.position || [0, 0, 0];
      const rot = merged.rotation || [0, 0, 0];
      const scl: [number, number, number] = Array.isArray(merged.scale)
        ? merged.scale
        : [merged.scale ?? 1, merged.scale ?? 1, merged.scale ?? 1];

      const rep = merged.repeat;
      let rxOff = 0;
      let ryOff = 0;
      let rzOff = 0;
      if (rep && repeatTotal > 1) {
        if (rep.radius) {
          const ang =
            rep.angleStep !== undefined
              ? (repeatIndex * rep.angleStep * Math.PI) / 180
              : (repeatIndex / repeatTotal) * Math.PI * 2;
          rxOff = Math.cos(ang) * rep.radius;
          rzOff = Math.sin(ang) * rep.radius;
        }
        rxOff += (rep.dx ?? 0) * repeatIndex;
        ryOff += (rep.dy ?? 0) * repeatIndex;
        rzOff += (rep.dz ?? 0) * repeatIndex;
      }

      const basePos = new THREE.Vector3(pos[0] + rxOff, pos[1] + ryOff, pos[2] + rzOff);
      const baseRotDeg = new THREE.Vector3(rot[0], rot[1], rot[2]);
      const baseScale = new THREE.Vector3(scl[0], scl[1], scl[2]);

      obj.position.copy(basePos);
      obj.rotation.set(
        THREE.MathUtils.degToRad(baseRotDeg.x),
        THREE.MathUtils.degToRad(baseRotDeg.y),
        THREE.MathUtils.degToRad(baseRotDeg.z)
      );
      obj.scale.copy(baseScale);

      parent.add(obj);

      // Compute local bounding half-extents for physics & hitbox wireframes
      const halfSize = new THREE.Vector3(0.5, 0.5, 0.5);
      let hitboxRadius = 0.6;
      if (merged.hitbox?.size) {
        halfSize.set(
          Math.max(0.05, merged.hitbox.size[0] * 0.5),
          Math.max(0.05, merged.hitbox.size[1] * 0.5),
          Math.max(0.05, merged.hitbox.size[2] * 0.5)
        );
        hitboxRadius = Math.max(halfSize.x, halfSize.y, halfSize.z);
      } else if (merged.hitbox?.radius) {
        hitboxRadius = Math.max(0.05, merged.hitbox.radius);
        halfSize.set(hitboxRadius, hitboxRadius, hitboxRadius);
      } else if (obj instanceof THREE.Mesh && obj.geometry) {
        obj.geometry.computeBoundingBox();
        const bb = obj.geometry.boundingBox;
        if (bb) {
          const sz = bb.getSize(new THREE.Vector3());
          halfSize.set(
            Math.max(0.08, (sz.x * Math.abs(baseScale.x)) * 0.5),
            Math.max(0.08, (sz.y * Math.abs(baseScale.y)) * 0.5),
            Math.max(0.08, (sz.z * Math.abs(baseScale.z)) * 0.5)
          );
          hitboxRadius = Math.max(halfSize.x, halfSize.y, halfSize.z);
        }
      }

      const hitboxShape: 'box' | 'sphere' =
        merged.hitbox?.shape || (merged.type === 'sphere' ? 'sphere' : 'box');
      const hitboxIdleColor = new THREE.Color(merged.hitbox?.color || '#22d3ee');
      const hitboxCollideColor = new THREE.Color(merged.hitbox?.collideColor || '#f43f5e');

      let hitboxHelper: THREE.LineSegments | THREE.Mesh | undefined;
      let hitboxMat: THREE.LineBasicMaterial | THREE.MeshBasicMaterial | undefined;
      if (merged.type !== 'group') {
        if (hitboxShape === 'sphere') {
          const sg = new THREE.SphereGeometry(hitboxRadius, 14, 10);
          const sm = new THREE.MeshBasicMaterial({
            color: hitboxIdleColor,
            wireframe: true,
            transparent: true,
            opacity: 0.7,
          });
          disposables.geometries.push(sg);
          disposables.materials.push(sm);
          hitboxHelper = new THREE.Mesh(sg, sm);
          hitboxMat = sm;
        } else {
          const bg = new THREE.BoxGeometry(halfSize.x * 2, halfSize.y * 2, halfSize.z * 2);
          const eg = new THREE.EdgesGeometry(bg);
          bg.dispose();
          const lm = new THREE.LineBasicMaterial({
            color: hitboxIdleColor,
            transparent: true,
            opacity: 0.85,
          });
          disposables.geometries.push(eg);
          disposables.materials.push(lm);
          hitboxHelper = new THREE.LineSegments(eg, lm);
          hitboxMat = lm;
        }
        hitboxHelper.position.copy(basePos);
        hitboxHelper.visible = Boolean(showHitboxesRef.current || merged.hitbox?.show);
        scene.add(hitboxHelper);
      }

      const physVel = merged.physics?.velocity || [0, 0, 0];
      const hasPhysics = Boolean(merged.physics && merged.physics.enabled !== false);
      const isStatic = Boolean(merged.physics?.isStatic);

      const rec: RuntimeNodeRecord = {
        id: merged.id,
        object: obj,
        spec: merged,
        repeatIndex,
        repeatTotal,
        basePos,
        baseRotDeg,
        baseScale,
        hasPhysics,
        isStatic,
        simPos: basePos.clone(),
        simVel: new THREE.Vector3(physVel[0] || 0, physVel[1] || 0, physVel[2] || 0),
        halfSize,
        hitboxRadius,
        hitboxShape,
        hitboxHelper,
        hitboxMat,
        hitboxIdleColor,
        hitboxCollideColor,
        hitFlashTimer: 0,
      };
      runtimeNodes.push(rec);
      if (merged.id && !nodeById.has(merged.id)) {
        nodeById.set(merged.id, rec);
      }

      if (Array.isArray(merged.children)) {
        for (const child of merged.children) {
          const cCount = Math.max(1, Math.min(48, Math.round(child.repeat?.count ?? 1)));
          for (let ci = 0; ci < cCount; ci += 1) {
            buildNodeHierarchy(child, obj, ci, cCount);
          }
        }
      }
    };

    for (const rootNode of spec.nodes) {
      const count = Math.max(1, Math.min(48, Math.round(rootNode.repeat?.count ?? 1)));
      for (let i = 0; i < count; i += 1) {
        buildNodeHierarchy(rootNode, scene, i, count);
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const w = Math.max(160, Math.round(entry.contentRect.width));
        const h = Math.max(120, Math.round(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(container);

    const resetPhysics = () => {
      for (const rec of runtimeNodes) {
        rec.simPos.copy(rec.basePos);
        const v = rec.spec.physics?.velocity || [0, 0, 0];
        rec.simVel.set(v[0] || 0, v[1] || 0, v[2] || 0);
        rec.hitFlashTimer = 0;
      }
    };
    resetPhysicsRef.current = resetPhysics;

    const desiredCamPos = new THREE.Vector3(0, 2.4, 6.2);
    const desiredCamTarget = new THREE.Vector3(0, 0.2, 0);
    let lastTimeMs = performance.now();
    let localProgress = progressRef.current;

    const evaluateSceneAt = (tNorm: number, dt: number) => {
      const effectiveT = spec.pingPong
        ? 1 - Math.abs(((tNorm * 2) % 2) - 1)
        : tNorm;
      const stepDt = Math.min(0.05, Math.max(0.001, dt || 0.016));

      // 1. Evaluate node keyframes & Liquid-Motion math expressions
      for (const rec of runtimeNodes) {
        const s = rec.spec;
        let px = rec.hasPhysics ? rec.simPos.x : rec.basePos.x;
        let py = rec.hasPhysics ? rec.simPos.y : rec.basePos.y;
        let pz = rec.hasPhysics ? rec.simPos.z : rec.basePos.z;
        let rx = rec.baseRotDeg.x;
        let ry = rec.baseRotDeg.y;
        let rz = rec.baseRotDeg.z;
        let sx = rec.baseScale.x;
        let sy = rec.baseScale.y;
        let sz = rec.baseScale.z;

        if (!rec.hasPhysics && s.keyframes && s.keyframes.length > 0) {
          const kf = sampleKeyframes(s.keyframes, effectiveT);
          if (kf.x !== undefined) px = kf.x;
          if (kf.y !== undefined) py = kf.y;
          if (kf.z !== undefined) pz = kf.z;
          if (kf.rx !== undefined) rx = kf.rx;
          if (kf.ry !== undefined) ry = kf.ry;
          if (kf.rz !== undefined) rz = kf.rz;
          if (kf.scale !== undefined) {
            sx = kf.scale;
            sy = kf.scale;
            sz = kf.scale;
          }
        }

        const m = s.motion;
        if (m) {
          const evalExpr = (v: number | string | undefined, fb: number) =>
            evaluateEvoMathExpr(v, effectiveT, rec.repeatIndex, rec.repeatTotal, spec.durationSec, fb);

          if (!rec.hasPhysics) {
            if (m.x !== undefined) px = evalExpr(m.x, px);
            if (m.y !== undefined) py = evalExpr(m.y, py);
            if (m.z !== undefined) pz = evalExpr(m.z, pz);
          }

          const rxExpr = m.rx ?? m.rotateX;
          const ryExpr = m.ry ?? m.rotateY;
          const rzExpr = m.rz ?? m.rotateZ;
          if (rxExpr !== undefined) rx = evalExpr(rxExpr, rx);
          if (ryExpr !== undefined) ry = evalExpr(ryExpr, ry);
          if (rzExpr !== undefined) rz = evalExpr(rzExpr, rz);

          if (m.spinX) rx += effectiveT * 360 * m.spinX;
          if (m.spinY) ry += effectiveT * 360 * m.spinY;
          if (m.spinZ) rz += effectiveT * 360 * m.spinZ;

          if (m.scale !== undefined) {
            const sc = evalExpr(m.scale, 1);
            sx = sc;
            sy = sc;
            sz = sc;
          }
          if (m.scaleX !== undefined) sx = evalExpr(m.scaleX, sx);
          if (m.scaleY !== undefined) sy = evalExpr(m.scaleY, sy);
          if (m.scaleZ !== undefined) sz = evalExpr(m.scaleZ, sz);

          if (!rec.hasPhysics && m.bob) {
            const amp = typeof m.bob === 'number' ? m.bob : m.bob.amp;
            const freq = typeof m.bob === 'number' ? 1 : m.bob.freq ?? 1;
            const phase = typeof m.bob === 'number' ? 0 : m.bob.phase ?? 0;
            py += Math.sin(effectiveT * Math.PI * 2 * freq + phase + rec.repeatIndex * 0.45) * amp;
          }
          if (!rec.hasPhysics && m.waveY) {
            const amp = typeof m.waveY === 'number' ? m.waveY : m.waveY.amp;
            const freq = typeof m.waveY === 'number' ? 1 : m.waveY.freq ?? 1;
            const phase = typeof m.waveY === 'number' ? 0 : m.waveY.phase ?? 0;
            py += Math.sin(effectiveT * Math.PI * 2 * freq + phase + px * 0.8 + pz * 0.8) * amp;
          }
          if (!rec.hasPhysics && m.bounceAmp) {
            py += Math.abs(Math.sin(effectiveT * Math.PI * 2)) * m.bounceAmp;
          }
          if (!rec.hasPhysics && m.sway) {
            const amp = typeof m.sway === 'number' ? m.sway : m.sway.amp;
            const freq = typeof m.sway === 'number' ? 1 : m.sway.freq ?? 1;
            const phase = typeof m.sway === 'number' ? 0 : m.sway.phase ?? 0;
            px += Math.cos(effectiveT * Math.PI * 2 * freq + phase + rec.repeatIndex * 0.45) * amp;
          }
          if (!rec.hasPhysics && m.orbit) {
            const turns = m.orbit.turns ?? 1;
            const phase = m.orbit.phase ?? 0;
            const ang = effectiveT * Math.PI * 2 * turns + phase + (rec.repeatIndex / Math.max(1, rec.repeatTotal)) * Math.PI * 2;
            const cx = m.orbit.cx ?? 0;
            const cy = m.orbit.cy ?? py;
            const cz = m.orbit.cz ?? 0;
            const radX = m.orbit.rx;
            const radZ = m.orbit.rz ?? m.orbit.rx;
            px = cx + Math.cos(ang) * radX;
            pz = cz + Math.sin(ang) * radZ;
            if (m.orbit.ry) py = cy + Math.sin(ang) * m.orbit.ry;
          }
          if (!rec.hasPhysics && m.orbitY) {
            const rad = typeof m.orbitY === 'number' ? m.orbitY : m.orbitY.radius ?? 2;
            const turns = typeof m.orbitY === 'number' ? 1 : m.orbitY.turns ?? 1;
            const phase = typeof m.orbitY === 'number' ? 0 : m.orbitY.phase ?? 0;
            const ang = effectiveT * Math.PI * 2 * turns + phase;
            px = Math.cos(ang) * rad;
            pz = Math.sin(ang) * rad;
          }
          if (!rec.hasPhysics && m.orbitX) {
            const rad = typeof m.orbitX === 'number' ? m.orbitX : m.orbitX.radius ?? 2;
            const turns = typeof m.orbitX === 'number' ? 1 : m.orbitX.turns ?? 1;
            const phase = typeof m.orbitX === 'number' ? 0 : m.orbitX.phase ?? 0;
            const ang = effectiveT * Math.PI * 2 * turns + phase;
            py = Math.cos(ang) * rad;
            pz = Math.sin(ang) * rad;
          }
          if (!rec.hasPhysics && m.lissajous) {
            const lj = m.lissajous;
            const u = effectiveT * Math.PI * 2 + (lj.phase ?? 0);
            px = (lj.ax ?? 2) * Math.sin((lj.fx ?? 3) * u);
            py = (lj.ay ?? 1.2) * Math.sin((lj.fy ?? 2) * u);
            pz = (lj.az ?? 1.5) * Math.cos((lj.fz ?? 4) * u);
          }
          if (!rec.hasPhysics && m.spiral) {
            const sp = m.spiral;
            const u = effectiveT;
            const ang = u * Math.PI * 2 * (sp.turns ?? 3);
            const rCur = (sp.r0 ?? 0.2) + ((sp.r1 ?? 2.5) - (sp.r0 ?? 0.2)) * u;
            px = Math.cos(ang) * rCur;
            pz = Math.sin(ang) * rCur;
            py = (u - 0.5) * (sp.height ?? 2.4);
          }
          if (m.pulse) {
            const lo = m.pulse.min ?? 0.85;
            const hi = m.pulse.max ?? 1.15;
            const freq = m.pulse.freq ?? 1;
            const phase = m.pulse.phase ?? 0;
            const w = 0.5 + 0.5 * Math.sin(effectiveT * Math.PI * 2 * freq + phase);
            const pScale = lo + (hi - lo) * w;
            sx *= pScale;
            sy *= pScale;
            sz *= pScale;
          }
        }

        if (s.material?.emissivePulse && rec.object instanceof THREE.Mesh && rec.object.material instanceof THREE.MeshPhysicalMaterial) {
          const ep = s.material.emissivePulse;
          const w = 0.5 + 0.5 * Math.sin(effectiveT * Math.PI * 2 * (ep.freq ?? 2));
          rec.object.material.emissiveIntensity = (ep.min ?? 0.2) + ((ep.max ?? 1.6) - (ep.min ?? 0.2)) * w;
        }

        // 1b. Rigid-Body Euler Kinematics & Boundary Restitution
        if (rec.hasPhysics && playingRef.current && !rec.isStatic) {
          const phys = s.physics!;
          const grav = phys.gravity ?? -9.8;
          const rest = Math.max(0.05, Math.min(1.05, phys.restitution ?? 0.78));
          const fric = Math.max(0.85, Math.min(1, phys.friction ?? 0.992));
          const floorY = phys.floorY ?? -1.35;

          rec.simVel.y += grav * stepDt;
          if (phys.attractor) {
            const ax = (phys.attractor.x ?? 0) - rec.simPos.x;
            const ay = (phys.attractor.y ?? 0) - rec.simPos.y;
            const az = (phys.attractor.z ?? 0) - rec.simPos.z;
            const d2 = Math.max(0.25, ax * ax + ay * ay + az * az);
            const str = phys.attractor.strength ?? 5;
            rec.simVel.x += (ax / Math.sqrt(d2)) * (str / d2) * stepDt;
            rec.simVel.y += (ay / Math.sqrt(d2)) * (str / d2) * stepDt;
            rec.simVel.z += (az / Math.sqrt(d2)) * (str / d2) * stepDt;
          }
          if (phys.drag) {
            const damp = Math.max(0, 1 - phys.drag * stepDt);
            rec.simVel.multiplyScalar(damp);
          }
          rec.simPos.x += rec.simVel.x * stepDt;
          rec.simPos.y += rec.simVel.y * stepDt;
          rec.simPos.z += rec.simVel.z * stepDt;

          const minY = floorY + (rec.hitboxShape === 'sphere' ? rec.hitboxRadius : rec.halfSize.y);
          if (rec.simPos.y < minY) {
            rec.simPos.y = minY;
            if (Math.abs(rec.simVel.y) > 0.25) {
              rec.simVel.y = Math.abs(rec.simVel.y) * rest;
              rec.hitFlashTimer = 0.14;
            } else {
              rec.simVel.y = 0;
            }
            rec.simVel.x *= fric;
            rec.simVel.z *= fric;
          }

          const walls = phys.walls || [4.2, 4.5, 4.2];
          const hx = Math.max(0.5, walls[0] - (rec.hitboxShape === 'sphere' ? rec.hitboxRadius : rec.halfSize.x));
          const hz = Math.max(0.5, walls[2] - (rec.hitboxShape === 'sphere' ? rec.hitboxRadius : rec.halfSize.z));
          if (rec.simPos.x > hx) {
            rec.simPos.x = hx;
            rec.simVel.x = -Math.abs(rec.simVel.x) * rest;
            rec.hitFlashTimer = 0.14;
          } else if (rec.simPos.x < -hx) {
            rec.simPos.x = -hx;
            rec.simVel.x = Math.abs(rec.simVel.x) * rest;
            rec.hitFlashTimer = 0.14;
          }
          if (rec.simPos.z > hz) {
            rec.simPos.z = hz;
            rec.simVel.z = -Math.abs(rec.simVel.z) * rest;
            rec.hitFlashTimer = 0.14;
          } else if (rec.simPos.z < -hz) {
            rec.simPos.z = -hz;
            rec.simVel.z = Math.abs(rec.simVel.z) * rest;
            rec.hitFlashTimer = 0.14;
          }

          px = rec.simPos.x;
          py = rec.simPos.y;
          pz = rec.simPos.z;
        }

        rec.object.position.set(px, py, pz);
        rec.object.rotation.set(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz)
        );
        rec.object.scale.set(sx, sy, sz);
      }

      // 1c. Pairwise Hitbox Collision Detection & Elastic Impulse
      const worldPosA = new THREE.Vector3();
      const worldPosB = new THREE.Vector3();
      for (const rec of runtimeNodes) {
        if (rec.hitFlashTimer > 0) rec.hitFlashTimer = Math.max(0, rec.hitFlashTimer - stepDt);
      }

      const colliders = runtimeNodes.filter(
        (r) => r.spec.type !== 'group' && (r.spec.physics?.collidable !== false) && (r.hasPhysics || Boolean(r.spec.hitbox))
      );
      for (let aIdx = 0; aIdx < colliders.length; aIdx += 1) {
        for (let bIdx = aIdx + 1; bIdx < colliders.length; bIdx += 1) {
          const a = colliders[aIdx];
          const b = colliders[bIdx];
          a.object.getWorldPosition(worldPosA);
          b.object.getWorldPosition(worldPosB);

          let hit = false;
          const normal = new THREE.Vector3(0, 1, 0);
          let overlap = 0;

          if (a.hitboxShape === 'sphere' && b.hitboxShape === 'sphere') {
            const diff = worldPosA.clone().sub(worldPosB);
            const dist = diff.length();
            const minDist = a.hitboxRadius + b.hitboxRadius;
            if (dist < minDist) {
              hit = true;
              overlap = minDist - dist;
              if (dist > 1e-4) normal.copy(diff.divideScalar(dist));
            }
          } else {
            const dx = worldPosA.x - worldPosB.x;
            const dy = worldPosA.y - worldPosB.y;
            const dz = worldPosA.z - worldPosB.z;
            const ox = a.halfSize.x + b.halfSize.x - Math.abs(dx);
            const oy = a.halfSize.y + b.halfSize.y - Math.abs(dy);
            const oz = a.halfSize.z + b.halfSize.z - Math.abs(dz);
            if (ox > 0 && oy > 0 && oz > 0) {
              hit = true;
              if (ox <= oy && ox <= oz) {
                overlap = ox;
                normal.set(dx >= 0 ? 1 : -1, 0, 0);
              } else if (oy <= oz) {
                overlap = oy;
                normal.set(0, dy >= 0 ? 1 : -1, 0);
              } else {
                overlap = oz;
                normal.set(0, 0, dz >= 0 ? 1 : -1);
              }
            }
          }

          if (hit) {
            a.hitFlashTimer = 0.16;
            b.hitFlashTimer = 0.16;
            if (playingRef.current && (a.hasPhysics || b.hasPhysics)) {
              const aDyn = a.hasPhysics && !a.isStatic;
              const bDyn = b.hasPhysics && !b.isStatic;
              if (aDyn && bDyn) {
                a.simPos.addScaledVector(normal, overlap * 0.5);
                b.simPos.addScaledVector(normal, -overlap * 0.5);
                a.object.position.copy(a.simPos);
                b.object.position.copy(b.simPos);
                const relVel = a.simVel.clone().sub(b.simVel);
                const velAlongNormal = relVel.dot(normal);
                if (velAlongNormal < 0) {
                  const e = Math.min(a.spec.physics?.restitution ?? 0.8, b.spec.physics?.restitution ?? 0.8);
                  const ma = a.spec.physics?.mass ?? 1;
                  const mb = b.spec.physics?.mass ?? 1;
                  const j = (-(1 + e) * velAlongNormal) / (1 / ma + 1 / mb);
                  a.simVel.addScaledVector(normal, j / ma);
                  b.simVel.addScaledVector(normal, -j / mb);
                }
              } else if (aDyn) {
                a.simPos.addScaledVector(normal, overlap);
                a.object.position.copy(a.simPos);
                const vn = a.simVel.dot(normal);
                if (vn < 0) a.simVel.addScaledVector(normal, -(1 + (a.spec.physics?.restitution ?? 0.8)) * vn);
              } else if (bDyn) {
                b.simPos.addScaledVector(normal, -overlap);
                b.object.position.copy(b.simPos);
                const vn = b.simVel.dot(normal);
                if (vn > 0) b.simVel.addScaledVector(normal, -(1 + (b.spec.physics?.restitution ?? 0.8)) * vn);
              }
            }
          }
        }
      }

      // 2. Follow constraints (lagged tracking of targetId)
      for (const rec of runtimeNodes) {
        if (!rec.spec.follow?.targetId) continue;
        const target = nodeById.get(rec.spec.follow.targetId);
        if (!target) continue;
        const stiffness = Math.max(0.05, Math.min(1, 1 - (rec.spec.follow.lag ?? 0.35)));
        const tx = target.object.position.x + (rec.spec.follow.offsetX ?? 0);
        const ty = target.object.position.y + (rec.spec.follow.offsetY ?? 0);
        const tz = target.object.position.z + (rec.spec.follow.offsetZ ?? 0);
        rec.object.position.lerp(new THREE.Vector3(tx, ty, tz), stiffness);
      }

      // 2b. Sync wireframe hitbox helpers
      const tmpWorldPos = new THREE.Vector3();
      for (const rec of runtimeNodes) {
        if (!rec.hitboxHelper || !rec.hitboxMat) continue;
        const showThis = showHitboxesRef.current || Boolean(rec.spec.hitbox?.show);
        rec.hitboxHelper.visible = showThis;
        if (showThis) {
          rec.object.getWorldPosition(tmpWorldPos);
          rec.hitboxHelper.position.copy(tmpWorldPos);
          rec.hitboxMat.color.copy(
            rec.hitFlashTimer > 0 ? rec.hitboxCollideColor : rec.hitboxIdleColor
          );
        }
      }

      // 3. Storyboard Damped Camera Cuts
      const shots = spec.storyboard?.shots;
      if (autoCameraRef.current && !userInteracting && Array.isArray(shots) && shots.length > 0) {
        const activeShot =
          shots.find((sh) => effectiveT >= sh.start && effectiveT <= sh.end) ||
          shots[shots.length - 1];
        if (activeShot) {
          setHudShotLabel(activeShot.uiAngle?.title || activeShot.label || activeShot.name || activeShot.cameraCut || '');
          const cam = activeShot.camera;
          if (cam) {
            desiredCamPos.set(cam.x ?? 0, cam.y ?? 2.4, cam.z ?? 6.2);
            desiredCamTarget.set(cam.targetX ?? 0, cam.targetY ?? 0.2, cam.targetZ ?? 0);
          } else if (Array.isArray(activeShot.position)) {
            desiredCamPos.set(activeShot.position[0] ?? 0, activeShot.position[1] ?? 2.4, activeShot.position[2] ?? 6.2);
            if (Array.isArray(activeShot.target)) {
              desiredCamTarget.set(activeShot.target[0] ?? 0, activeShot.target[1] ?? 0.2, activeShot.target[2] ?? 0);
            }
          } else {
            switch (activeShot.cameraCut) {
              case 'closeup':
                desiredCamPos.set(0.6, 1.3, 3.2);
                break;
              case 'overhead':
                desiredCamPos.set(0, 7.2, 0.8);
                break;
              case 'dutch':
                desiredCamPos.set(4.2, 1.9, 4.4);
                break;
              case 'orbit': {
                const a = effectiveT * Math.PI * 2;
                desiredCamPos.set(Math.sin(a) * 6.2, 2.6, Math.cos(a) * 6.2);
                break;
              }
              default:
                desiredCamPos.set(0, 2.4, 6.2);
                break;
            }
          }
          const damp = 1 - Math.exp(-5.5 * Math.min(0.1, dt || 0.016));
          camera.position.lerp(desiredCamPos, damp);
          controls.target.lerp(desiredCamTarget, damp);
          const targetFov = cam?.fov ?? activeShot.fov;
          if (targetFov && Math.abs(camera.fov - targetFov) > 0.2) {
            camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, damp);
            camera.updateProjectionMatrix();
          }
        }
      } else if (spec.storyboard?.shots?.[0]) {
        setHudShotLabel(spec.storyboard.shots[0].uiAngle?.title || spec.storyboard.shots[0].label || spec.storyboard.shots[0].name || '');
      }
    };

    const animate = (nowMs: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      const dt = Math.max(0.001, (nowMs - lastTimeMs) / 1000);
      lastTimeMs = nowMs;

      if (playingRef.current) {
        const rawNext = localProgress + dt / Math.max(0.25, spec.durationSec);
        if (spec.loop && rawNext >= 1) {
          resetPhysics();
        }
        const nextP = rawNext;
        localProgress = spec.loop ? nextP % 1 : Math.min(1, nextP);
        progressRef.current = localProgress;
        setProgress(localProgress);
        if (!spec.loop && localProgress >= 1) {
          setIsPlaying(false);
        }
      } else {
        localProgress = progressRef.current;
      }

      evaluateSceneAt(localProgress, dt);
      controls.update();
      renderer.render(scene, camera);
    };

    evaluateSceneAt(localProgress, 0.016);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      envTarget.dispose();
      if (sharedPixelTexture) sharedPixelTexture.dispose();
      for (const g of disposables.geometries) g.dispose();
      for (const m of disposables.materials) m.dispose();
      if (starPoints) {
        starPoints.geometry.dispose();
        (starPoints.material as THREE.Material).dispose();
      }
      if (gridHelper) {
        gridHelper.geometry.dispose();
        if (Array.isArray(gridHelper.material)) {
          gridHelper.material.forEach((m) => m.dispose());
        } else {
          gridHelper.material.dispose();
        }
      }
      renderer.dispose();
    };
  }, [spec]);

  if (!spec) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300 border-t border-neutral-200 dark:border-white/10">
        {parsed.error || 'Could not parse EVO 3D specification.'}
      </div>
    );
  }

  const slug = (spec.title || 'evo-3d')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const currentFrame = Math.round(progress * Math.max(1, Math.round(spec.durationSec * spec.fps)));
  const totalFrames = Math.max(1, Math.round(spec.durationSec * spec.fps));

  const handleDownloadJson = () => {
    triggerDownload(
      new Blob([spec.rawJson], { type: 'application/json;charset=utf-8' }),
      `${slug || 'evo-scene'}.json`
    );
  };

  const handleDownloadXml = () => {
    triggerDownload(
      new Blob([exportEvoXml(spec)], { type: 'application/xml;charset=utf-8' }),
      `${slug || 'evo-scene'}.xml`
    );
  };

  const handleCapturePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `${slug || 'evo-scene'}.png`);
    }, 'image/png');
  };

  const handleBakeWebm = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isBakingWebm) return;
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      return;
    }

    setIsBakingWebm(true);
    setProgress(0);
    progressRef.current = 0;
    setIsPlaying(true);

    try {
      const stream = canvas.captureStream(Math.min(60, Math.max(15, spec.fps)));
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_500_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      const recordDurationMs = Math.min(15_000, Math.max(1000, Math.round(spec.durationSec * 1000)));
      await new Promise((r) => setTimeout(r, recordDurationMs));
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      await donePromise;
      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      triggerDownload(webmBlob, `${slug || 'evo-scene'}.webm`);
    } finally {
      setIsBakingWebm(false);
    }
  };

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#161616] text-[#0d0d0d] dark:text-[#ececec]">
      {/* EVO Sub-bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-neutral-600 dark:text-neutral-300 tabular-nums min-w-0">
          <Box className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span className="font-semibold text-[#0d0d0d] dark:text-white truncate">
            EVO 3D: {spec.title}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">
            {spec.nodes.length} nodes · {spec.fps}fps · {spec.durationSec}s
          </span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setShowFidelity((v) => !v)}
            className="text-neutral-700 dark:text-neutral-200 underline decoration-dotted underline-offset-4 hover:text-[#0d0d0d] dark:hover:text-white whitespace-nowrap shrink-0"
          >
            Fidelity {spec.fidelity.score}/100
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setAutoCamera((v) => !v)}
            title="Toggle storyboard auto camera"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              autoCamera
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'border-neutral-300 dark:border-white/15 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            <Camera className="w-3 h-3" />
            <span>{autoCamera ? 'Auto Cam' : 'Free Orbit'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHitboxes((v) => !v)}
            title="Toggle wireframe collision hitboxes"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showHitboxes
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'border-neutral-300 dark:border-white/15 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            <Box className="w-3 h-3" />
            <span>Hitbox</span>
          </button>

          <button
            type="button"
            onClick={handleCapturePng}
            title="Save PNG snapshot"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={() => void handleBakeWebm()}
            disabled={isBakingWebm}
            title="Record EVO 3D animation as WebM video"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Film className="w-3 h-3" />
            <span>{isBakingWebm ? 'Recording...' : 'WebM'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadXml}
            title="Export EVO spec as XML"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Code2 className="w-3 h-3" />
            <span>XML</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            title="Export EVO spec as JSON"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {showFidelity && spec.fidelity.notes.length > 0 && (
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-white/10 bg-neutral-100/70 dark:bg-[#1a1a1a] text-[11px] text-neutral-600 dark:text-neutral-300 space-y-0.5">
          <div className="font-medium text-[#0d0d0d] dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            <span>EVO 3D Verification ({spec.environment} lighting)</span>
          </div>
          {spec.fidelity.notes.map((n, i) => (
            <div key={i} className="pl-4">
              · {n}
            </div>
          ))}
        </div>
      )}

      {/* WebGL Stage */}
      <div className="p-3 bg-neutral-950 flex flex-col items-center gap-2">
        <div
          className={`relative w-full ${
            compact ? 'max-w-[540px]' : 'max-w-[760px]'
          } rounded-xl overflow-hidden border border-white/15 bg-black`}
          style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
        >
          {webglError ? (
            <div className="w-full h-full flex items-center justify-center p-4 text-xs font-mono text-red-400">
              WebGL Error: {webglError}
            </div>
          ) : (
            <div ref={containerRef} className="w-full h-full" />
          )}

          {/* Top-left shot overlay without backdrop-blur */}
          {hudShotLabel && showHud && (
            <div className="pointer-events-none absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 border border-white/10 text-[11px] font-mono text-cyan-300">
              {hudShotLabel}
            </div>
          )}

          {/* Collapsible corner dock */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/80 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white font-mono">
            {showHud && (
              <>
                <span className="tabular-nums text-neutral-300 pr-1">
                  F{currentFrame}/{totalFrames}
                </span>
                <span className="text-neutral-600">|</span>
                <span className="text-neutral-400">Drag to orbit</span>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowHud((v) => !v)}
              className="ml-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px]"
            >
              {showHud ? 'Hide HUD' : 'HUD'}
            </button>
          </div>
        </div>

        {/* Transport & Timeline Controls */}
        <div
          className={`w-full ${
            compact ? 'max-w-[540px]' : 'max-w-[760px]'
          } flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#1c1c1e] border border-white/10 text-xs text-neutral-200`}
        >
          <button
            type="button"
            onClick={() => setIsPlaying((v) => !v)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setProgress(0);
              progressRef.current = 0;
              if (resetPhysicsRef.current) resetPhysicsRef.current();
            }}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/10 text-neutral-300 shrink-0"
            title="Restart timeline & physics"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.002}
            value={progress}
            onChange={(e) => {
              const val = Number(e.target.value);
              progressRef.current = val;
              setProgress(val);
            }}
            className="flex-1 accent-cyan-400 h-1.5 cursor-pointer"
          />

          <span className="font-mono text-[11px] tabular-nums text-neutral-400 shrink-0">
            {(progress * spec.durationSec).toFixed(2)}s / {spec.durationSec.toFixed(1)}s
          </span>

          {spec.audio && (
            <button
              type="button"
              onClick={() => setAudioMuted((m) => !m)}
              title={audioMuted ? 'Unmute math audio' : 'Mute math audio'}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${
                audioMuted ? 'text-neutral-400 hover:bg-white/10' : 'bg-cyan-500/20 text-cyan-300'
              }`}
            >
              {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
