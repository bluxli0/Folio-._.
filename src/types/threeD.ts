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
  | 'custom';

export type ThreeDMaterialType =
  | 'pbr'
  | 'glass'
  | 'gold'
  | 'neon'
  | 'clay'
  | 'wireframe'
  | 'toon'
  | 'normal';

export type ThreeDLightingPreset =
  | 'studio'
  | 'sunset'
  | 'cyberpunk'
  | 'dramatic'
  | 'matrix';

export type ThreeDAnimationPreset =
  | 'rotate'
  | 'bounce'
  | 'pulse'
  | 'float'
  | 'orbit'
  | 'chaos'
  | 'none';

export interface ThreeDObjectSpec {
  id: string;
  shape: ThreeDShapeType;
  material: ThreeDMaterialType;
  color: string;
  roughness: number;
  metalness: number;
  wireframe: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  animation: ThreeDAnimationPreset;
  speed: number;
}

export interface ThreeDSceneSpec {
  title: string;
  description?: string;
  background: string;
  lighting: ThreeDLightingPreset;
  autoRotate: boolean;
  bloom: boolean;
  shadows: boolean;
  objects: ThreeDObjectSpec[];
  customJsCode?: string;
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
