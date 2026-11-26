export type ThreeDShapeType =
  | 'box'
  | 'sphere'
  | 'torus'
  | 'torusKnot'
  | 'cylinder'
  | 'cone'
  | 'icosahedron'
  | 'dodecahedron'
  | 'octahedron'
  | 'tetrahedron'
  | 'capsule'
  | 'ring'
  | 'plane'
  | 'pyramid'
  | 'prism'
  | 'helix'
  | 'mobius'
  | 'gear'
  | 'star'
  | 'crystal'
  | 'gridFloor'
  | 'particleCloud'
  | 'splineTube'
  | 'terrain'
  | 'dnaHelix'
  | 'waveSurface'
  | 'graphRibbon'
  | 'custom';

export type ThreeDMaterialType =
  | 'pbr'
  | 'glass'
  | 'gold'
  | 'neon'
  | 'clay'
  | 'wireframe'
  | 'toon'
  | 'normal'
  | 'chrome'
  | 'hologram'
  | 'iridescent'
  | 'matte'
  | 'obsidian'
  | 'lava'
  | 'ice'
  | 'emerald'
  | 'copper'
  | 'carbon'
  | 'glassTinted'
  | 'additiveGlow';

export type ThreeDLightingPreset =
  | 'studio'
  | 'sunset'
  | 'cyberpunk'
  | 'dramatic'
  | 'matrix'
  | 'vaporwave'
  | 'noir'
  | 'arctic'
  | 'volcanic'
  | 'emeraldForest'
  | 'goldenHour'
  | 'void';

export type ThreeDAnimationPreset =
  | 'rotate'
  | 'bounce'
  | 'physicsBounce'
  | 'pulse'
  | 'float'
  | 'orbit'
  | 'chaos'
  | 'figure8'
  | 'spiral'
  | 'pendulum'
  | 'wobble'
  | 'breathing'
  | 'spinX'
  | 'spinZ'
  | 'spring'
  | 'lissajous'
  | 'explodeLoop'
  | 'none';

export interface ThreeDPhysicsSpec {
  enabled?: boolean;
  vx?: number;
  vy?: number;
  vz?: number;
  gravity?: number;
  restitution?: number;
  floorY?: number;
  walls?: [number, number, number];
  mass?: number;
  drag?: number;
  attractor?: { x?: number; y?: number; z?: number; strength?: number };
}

export interface ThreeDObjectSpec {
  id: string;
  shape: ThreeDShapeType;
  material: ThreeDMaterialType;
  color: string;
  gradientColors?: string[];
  mathExpr?: string;
  roughness: number;
  metalness: number;
  wireframe: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  flatShading?: boolean;
  repeat?: number | { count: number; radius?: number; dy?: number };
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  animation: ThreeDAnimationPreset;
  speed: number;
  hitbox?: boolean;
  hitboxColor?: string;
  collideColor?: string;
  physics?: ThreeDPhysicsSpec;
  trackTo?: string;
}

export interface ThreeDVoxel {
  x: number;
  y: number;
  z: number;
  color: string;
  size?: number;
}

export interface ThreeDIkChainSpec {
  id?: string;
  nodes: string[];
  targetId?: string;
  targetPos?: [number, number, number];
  iterations?: number;
  aimNodes?: boolean;
}

export interface ThreeDSceneSpec {
  title: string;
  description?: string;
  background: string;
  lighting: ThreeDLightingPreset;
  autoRotate: boolean;
  bloom: boolean;
  shadows: boolean;
  showHitboxes?: boolean;
  physicsFloorY?: number;
  fogColor?: string;
  fogDensity?: number;
  starfield?: boolean | number;
  gridFloor?: boolean;
  cameraFov?: number;
  exposure?: number;
  objects: ThreeDObjectSpec[];
  ikChains?: ThreeDIkChainSpec[];
  customJsCode?: string;
  bbmodel?: Record<string, unknown>;
  voxels?: ThreeDVoxel[];
}

export interface ThreeDDemo {
  id: string;
  title: string;
  category: string;
  description: string;
  spec: ThreeDSceneSpec;
}

export interface GoogleFlowStep {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'completed';
  prompt: string;
  outputSummary?: string;
}

export interface GoogleFlowPipeline {
  id: string;
  title: string;
  prompt: string;
  steps: GoogleFlowStep[];
  isExecuting: boolean;
}
