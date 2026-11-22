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
  EvoNodeSpec,
  EvoSceneSpec,
  applyEvoEasing,
  evaluateEvoMathExpr,
  exportEvoXml,
  parseEvoCode,
} from '../utils/evoEngine';
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

function buildGeometry(node: EvoNodeSpec): THREE.BufferGeometry {
  const seg = Math.max(8, Math.min(64, Math.round(node.segments ?? 28)));
  const r = node.radius ?? 0.6;
  const h = node.height ?? 1.2;
  switch (node.type) {
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
      return '#050816';
    case 'sunset':
      return '#1a0f18';
    case 'obsidian':
      return '#0a0a0c';
    case 'void':
      return '#030407';
    default:
      return '#0f172a';
  }
}

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
  const audioMutedRef = useRef(audioMuted);
  audioMutedRef.current = audioMuted;

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
    renderer.toneMappingExposure = 1.1;
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
    scene.fog = new THREE.FogExp2(bgHex, spec.environment === 'void' ? 0.045 : 0.024);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const initialW = container.clientWidth || spec.width || 640;
    const initialH = container.clientHeight || Math.round((initialW * spec.height) / spec.width) || 360;
    renderer.setSize(initialW, initialH, false);

    const camera = new THREE.PerspectiveCamera(45, initialW / Math.max(1, initialH), 0.1, 150);
    camera.position.set(0, 2.4, 6.2);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 0.2, 0);

    let userInteracting = false;
    const onControlStart = () => {
      userInteracting = true;
    };
    controls.addEventListener('start', onControlStart);

    // Environment-matched Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      spec.environment === 'sunset' ? 0xfdba74 : 0xe0f2fe,
      0x111827,
      0.55
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(
      spec.environment === 'sunset' ? 0xfb923c : spec.environment === 'neon' ? 0x38bdf8 : 0xffffff,
      2.1
    );
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
      spec.environment === 'neon' ? 0xe879f9 : 0x60a5fa,
      1.15
    );
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

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
      } else {
        const geom = buildGeometry(merged);
        disposables.geometries.push(geom);
        const mSpec = merged.material || {};
        const useTex = Boolean(sharedPixelTexture && mSpec.usePixelTexture !== false && (mSpec.usePixelTexture === true || !mSpec.color));
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(mSpec.color || (useTex ? '#ffffff' : '#38bdf8')),
          roughness: mSpec.roughness ?? 0.34,
          metalness: mSpec.metalness ?? 0.25,
          clearcoat: mSpec.clearcoat ?? 0.35,
          clearcoatRoughness: mSpec.clearcoatRoughness ?? 0.2,
          transmission: mSpec.transmission ?? 0,
          thickness: mSpec.thickness ?? 0.5,
          ior: mSpec.ior ?? 1.45,
          iridescence: mSpec.iridescence ?? 0,
          emissive: new THREE.Color(mSpec.emissive || '#000000'),
          emissiveIntensity: mSpec.emissiveIntensity ?? (mSpec.emissive ? 0.65 : 0),
          transparent: typeof mSpec.opacity === 'number' && mSpec.opacity < 1,
          opacity: mSpec.opacity ?? 1,
          wireframe: Boolean(mSpec.wireframe),
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

      const rec: RuntimeNodeRecord = {
        id: merged.id,
        object: obj,
        spec: merged,
        repeatIndex,
        repeatTotal,
        basePos,
        baseRotDeg,
        baseScale,
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

    const desiredCamPos = new THREE.Vector3(0, 2.4, 6.2);
    const desiredCamTarget = new THREE.Vector3(0, 0.2, 0);
    let lastTimeMs = performance.now();
    let localProgress = progressRef.current;

    const evaluateSceneAt = (tNorm: number, dt: number) => {
      const effectiveT = spec.pingPong
        ? 1 - Math.abs(((tNorm * 2) % 2) - 1)
        : tNorm;

      // 1. Evaluate node keyframes & Liquid-Motion math expressions
      for (const rec of runtimeNodes) {
        const s = rec.spec;
        let px = rec.basePos.x;
        let py = rec.basePos.y;
        let pz = rec.basePos.z;
        let rx = rec.baseRotDeg.x;
        let ry = rec.baseRotDeg.y;
        let rz = rec.baseRotDeg.z;
        let sx = rec.baseScale.x;
        let sy = rec.baseScale.y;
        let sz = rec.baseScale.z;

        if (s.keyframes && s.keyframes.length > 0) {
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

          if (m.x !== undefined) px = evalExpr(m.x, px);
          if (m.y !== undefined) py = evalExpr(m.y, py);
          if (m.z !== undefined) pz = evalExpr(m.z, pz);

          const rxExpr = m.rx ?? m.rotateX;
          const ryExpr = m.ry ?? m.rotateY;
          const rzExpr = m.rz ?? m.rotateZ;
          if (rxExpr !== undefined) rx = evalExpr(rxExpr, rx);
          if (ryExpr !== undefined) ry = evalExpr(ryExpr, ry);
          if (rzExpr !== undefined) rz = evalExpr(rzExpr, rz);

          if (m.spinX) rx += effectiveT * 360 * m.spinX;
          if (m.spinY) ry += effectiveT * 360 * m.spinY;

          if (m.scale !== undefined) {
            const sc = evalExpr(m.scale, 1);
            sx = sc;
            sy = sc;
            sz = sc;
          }
          if (m.scaleX !== undefined) sx = evalExpr(m.scaleX, sx);
          if (m.scaleY !== undefined) sy = evalExpr(m.scaleY, sy);
          if (m.scaleZ !== undefined) sz = evalExpr(m.scaleZ, sz);

          if (m.bob) {
            const amp = typeof m.bob === 'number' ? m.bob : m.bob.amp;
            const freq = typeof m.bob === 'number' ? 1 : m.bob.freq ?? 1;
            const phase = typeof m.bob === 'number' ? 0 : m.bob.phase ?? 0;
            py += Math.sin(effectiveT * Math.PI * 2 * freq + phase + rec.repeatIndex * 0.45) * amp;
          }
          if (m.sway) {
            const amp = typeof m.sway === 'number' ? m.sway : m.sway.amp;
            const freq = typeof m.sway === 'number' ? 1 : m.sway.freq ?? 1;
            const phase = typeof m.sway === 'number' ? 0 : m.sway.phase ?? 0;
            px += Math.cos(effectiveT * Math.PI * 2 * freq + phase + rec.repeatIndex * 0.45) * amp;
          }
          if (m.orbit) {
            const turns = m.orbit.turns ?? 1;
            const phase = m.orbit.phase ?? 0;
            const ang = effectiveT * Math.PI * 2 * turns + phase + (rec.repeatIndex / Math.max(1, rec.repeatTotal)) * Math.PI * 2;
            const cx = m.orbit.cx ?? 0;
            const cz = m.orbit.cz ?? 0;
            const radX = m.orbit.rx;
            const radZ = m.orbit.rz ?? m.orbit.rx;
            px = cx + Math.cos(ang) * radX;
            pz = cz + Math.sin(ang) * radZ;
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

        rec.object.position.set(px, py, pz);
        rec.object.rotation.set(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz)
        );
        rec.object.scale.set(sx, sy, sz);
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

      // 3. Storyboard Damped Camera Cuts
      const shots = spec.storyboard?.shots;
      if (autoCameraRef.current && !userInteracting && Array.isArray(shots) && shots.length > 0) {
        const activeShot =
          shots.find((sh) => effectiveT >= sh.start && effectiveT <= sh.end) ||
          shots[shots.length - 1];
        if (activeShot) {
          setHudShotLabel(activeShot.uiAngle?.title || activeShot.label || activeShot.cameraCut || '');
          const cam = activeShot.camera;
          if (cam) {
            desiredCamPos.set(cam.x ?? 0, cam.y ?? 2.4, cam.z ?? 6.2);
            desiredCamTarget.set(cam.targetX ?? 0, cam.targetY ?? 0.2, cam.targetZ ?? 0);
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
          if (cam?.fov && Math.abs(camera.fov - cam.fov) > 0.2) {
            camera.fov = THREE.MathUtils.lerp(camera.fov, cam.fov, damp);
            camera.updateProjectionMatrix();
          }
        }
      } else if (spec.storyboard?.shots?.[0]) {
        setHudShotLabel(spec.storyboard.shots[0].uiAngle?.title || spec.storyboard.shots[0].label || '');
      }
    };

    const animate = (nowMs: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      const dt = Math.max(0.001, (nowMs - lastTimeMs) / 1000);
      lastTimeMs = nowMs;

      if (playingRef.current) {
        const nextP = localProgress + dt / Math.max(0.25, spec.durationSec);
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
            }}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/10 text-neutral-300 shrink-0"
            title="Restart timeline"
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
