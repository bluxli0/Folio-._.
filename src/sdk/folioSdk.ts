import { FOLIO_CHANGELOGS, FOLIO_CURRENT_VERSION, type ChangelogEntry } from '../data/changelogs';
import { FOLIO_DOCS_SECTIONS, searchFolioDocs, type FolioDocSection } from '../data/folioDocs';
import {
  CHRONO_SINGULARITY_EVO_SPEC,
  ENGINE_DATASETS,
  searchEngineDatasets,
  type EngineDataset,
  type EngineDatasetExample,
  type EngineDatasetId,
  type EngineParameterSpec,
} from '../data/engineDatasets';

export {
  CHRONO_SINGULARITY_EVO_SPEC,
  ENGINE_DATASETS,
  FOLIO_CHANGELOGS,
  FOLIO_CURRENT_VERSION,
  FOLIO_DOCS_SECTIONS,
  searchEngineDatasets,
  searchFolioDocs,
};
export type {
  ChangelogEntry,
  EngineDataset,
  EngineDatasetExample,
  EngineDatasetId,
  EngineParameterSpec,
  FolioDocSection,
};

export const FOLIO_SDK_VERSION = '4.2.0';

export type FolioModelId =
  | 'auto'
  | 'flash-4'
  | 'hydrogen-4-fast'
  | 'hydrogen-4-balanced'
  | 'hydrogen-4-deep'
  | 'neon-4'
  | 'carbon-4'
  | 'argon-4'
  | 'flash-3.8'
  | 'flash-lite-3.1'
  | 'omni-flash-1.2'
  | 'live-extended-3.8'
  | 'gemma-3-27b'
  | 'gemma-3-12b'
  | 'neo-4'
  | 'nano-banana-lite';

export interface FolioChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface FolioChatOptions {
  modelId?: FolioModelId;
  neoMode?: 'llm' | 'rule';
  autoFallback?: boolean;
  thinkingMode?: 'minimal' | 'low' | 'medium' | 'high' | 'deep';
  systemInstruction?: string;
  activeWorkspaceId?: string;
  entropicAuditorEnabled?: boolean;
  semanticEngineEnabled?: boolean;
  metaScriptingEnabled?: boolean;
  immersivePureCode?: boolean;
}

export interface FolioChatResponse {
  ok: boolean;
  modelId?: string;
  fallbackFrom?: string;
  text: string;
  thoughts?: string;
  durationMs?: number;
  error?: string;
}

export interface FolioSystemHealth {
  ok: boolean;
  version: string;
  memory: {
    totalMb: number;
    freeMb: number;
    usedMb: number;
    usedPercent: number;
    processRssMb: number;
    status: 'healthy' | 'elevated' | 'critical';
    canRunHeavyTools: boolean;
    canRunBlender: boolean;
    canRunTinyLlm: boolean;
  };
  disk?: {
    availableGb: string;
    totalGb: string;
  };
  knowledgeBase?: {
    folioDocsIndexed: boolean;
    knowledgeDbExists: boolean;
    shardCount: number;
  };
}

export class FolioClient {
  private readonly baseUrl: string;

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = (options?.baseUrl || '').replace(/\/+$/, '');
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async chat(
    messages: FolioChatMessage[],
    options: FolioChatOptions = {}
  ): Promise<FolioChatResponse> {
    const res = await fetch(this.url('/api/chat/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        modelId: options.modelId ?? 'auto',
        neoMode: options.neoMode ?? 'llm',
        autoFallback: options.autoFallback ?? true,
        thinkingMode: options.thinkingMode ?? 'medium',
        systemInstruction: options.systemInstruction,
        activeWorkspaceId: options.activeWorkspaceId,
        entropicAuditorEnabled: options.entropicAuditorEnabled,
        semanticEngineEnabled: options.semanticEngineEnabled,
        metaScriptingEnabled: options.metaScriptingEnabled,
        immersivePureCode: options.immersivePureCode,
      }),
    });
    const data = (await res.json()) as FolioChatResponse;
    if (!res.ok) {
      throw new Error(data.error || `Folio chat failed (${res.status})`);
    }
    return data;
  }

  async getHealth(): Promise<FolioSystemHealth> {
    const res = await fetch(this.url('/api/system/health'));
    if (!res.ok) throw new Error(`Health check failed (${res.status})`);
    return (await res.json()) as FolioSystemHealth;
  }

  async listBackups(): Promise<{ ok: boolean; backups: Array<{ name: string; sizeBytes: number; createdAt: string }> }> {
    const res = await fetch(this.url('/api/system/backups'));
    if (!res.ok) throw new Error(`Backup list failed (${res.status})`);
    return res.json();
  }

  async createBackup(label?: string): Promise<{ ok: boolean; file: string; sizeBytes: number }> {
    const res = await fetch(this.url('/api/system/backup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Backup failed (${res.status})`);
    return data;
  }

  async getToolchains(): Promise<Record<string, unknown>> {
    const res = await fetch(this.url('/api/toolchains/status'));
    if (!res.ok) throw new Error(`Toolchains status failed (${res.status})`);
    return res.json();
  }

  async restoreLlm(): Promise<{ ok: boolean; installed?: boolean; model?: string; message?: string }> {
    const res = await fetch(this.url('/api/system/restore-llm'), { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `LLM restore failed (${res.status})`);
    return data;
  }

  getDocs(query?: string): FolioDocSection[] {
    return query ? searchFolioDocs(query) : FOLIO_DOCS_SECTIONS;
  }

  getDatasets(query?: string, engineId?: EngineDatasetId): EngineDataset[] {
    return query || engineId ? searchEngineDatasets(query || '', engineId) : ENGINE_DATASETS;
  }

  async trainDatasets(): Promise<{ ok: boolean; ingestedFacts?: number; docsSections?: number }> {
    const res = await fetch(this.url('/api/datasets/train'), { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Dataset training failed (${res.status})`);
    return data;
  }

  getChangelog(): ChangelogEntry[] {
    return FOLIO_CHANGELOGS;
  }
}

export function createEvoScene(input: {
  title: string;
  nodes: Array<Record<string, unknown>>;
  ikChains?: Array<Record<string, unknown>>;
  forceFields?: Array<Record<string, unknown>>;
  triggers?: Array<Record<string, unknown>>;
  groups?: Record<string, Record<string, unknown>>;
  storyboard?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  environment?: string;
  background?: string;
  starfield?: boolean | number | { count?: number; radius?: number; color?: string };
  gridFloor?: boolean;
  contactShadows?: boolean;
  fog?: boolean | Record<string, unknown>;
  exposure?: number;
  durationSec?: number;
  fps?: number;
  audio?: Record<string, unknown>;
}) {
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    throw new Error('EVO 3D requires at least one node in "nodes".');
  }
  return {
    format: 'evo/v1',
    title: input.title,
    fps: input.fps ?? 30,
    durationSec: input.durationSec ?? 6,
    loop: true,
    background: input.background ?? '#080d1a',
    environment: input.environment ?? 'cyberpunk',
    starfield: input.starfield ?? true,
    gridFloor: input.gridFloor ?? true,
    contactShadows: input.contactShadows ?? true,
    ...(input.camera ? { camera: input.camera } : {}),
    ...(input.fog !== undefined ? { fog: input.fog } : {}),
    ...(input.exposure !== undefined ? { exposure: input.exposure } : {}),
    ...(input.groups ? { groups: input.groups } : {}),
    nodes: input.nodes,
    ...(input.ikChains ? { ikChains: input.ikChains } : {}),
    ...(input.forceFields ? { forceFields: input.forceFields } : {}),
    ...(input.triggers ? { triggers: input.triggers } : {}),
    ...(input.storyboard ? { storyboard: input.storyboard } : {}),
    ...(input.audio ? { audio: input.audio } : {}),
  };
}

export function createStopMotionScene(input: {
  title: string;
  layers: Array<Record<string, unknown>>;
  width?: number;
  height?: number;
  fps?: number;
  durationSec?: number;
  background?: string;
  effect?: string;
  particles?: Record<string, unknown>;
  audio?: Record<string, unknown>;
}) {
  if (!Array.isArray(input.layers) || input.layers.length === 0) {
    throw new Error('Stop Motion v3 requires at least one layer in "layers".');
  }
  return {
    format: 'stopmotion/v3',
    title: input.title,
    width: input.width ?? 640,
    height: input.height ?? 360,
    fps: input.fps ?? 24,
    durationSec: input.durationSec ?? 5,
    background: input.background ?? 'linear-gradient(180deg, #090d24 0%, #1e1b4b 100%)',
    ...(input.effect ? { effect: input.effect } : {}),
    ...(input.particles ? { particles: input.particles } : {}),
    layers: input.layers,
    ...(input.audio ? { audio: input.audio } : {}),
  };
}

export function createPixelArtScene(input: {
  title: string;
  width?: number;
  height?: number;
  fps?: number;
  frameCount?: number;
  palette?: string | string[];
  draw: Array<Record<string, unknown>>;
  shaders?: Array<string | Record<string, unknown>>;
}) {
  if (!Array.isArray(input.draw) || input.draw.length === 0) {
    throw new Error('Pixel Engine v3 procedural scene requires a non-empty "draw" array.');
  }
  return {
    format: 'pixelart/v3',
    title: input.title,
    width: input.width ?? 64,
    height: input.height ?? 64,
    fps: input.fps ?? 12,
    frameCount: input.frameCount ?? 16,
    ...(input.palette ? { palette: input.palette } : {}),
    draw: input.draw,
    shaders: input.shaders ?? ['bloom', 'vignette'],
  };
}

export function createThreeJsScene(input: {
  title: string;
  objects: Array<Record<string, unknown>>;
  ikChains?: Array<Record<string, unknown>>;
  environment?: string;
  background?: string;
  starfield?: boolean;
  gridFloor?: boolean;
  audio?: Record<string, unknown>;
}) {
  if (!Array.isArray(input.objects) || input.objects.length === 0) {
    throw new Error('Three.js Studio requires a non-empty "objects" array.');
  }
  return {
    format: 'threejs/v1',
    title: input.title,
    background: input.background ?? '#050816',
    environment: input.environment ?? 'cosmic',
    starfield: input.starfield ?? true,
    gridFloor: input.gridFloor ?? true,
    objects: input.objects,
    ...(input.ikChains ? { ikChains: input.ikChains } : {}),
    ...(input.audio ? { audio: input.audio } : {}),
  };
}

export function createHybridScene(input: {
  kind?: 'liquidmotion' | 'liquiddrop' | 'pixelmotion' | 'motiondrop';
  title: string;
  pixelBackdrop: Record<string, unknown>;
  layers: Array<Record<string, unknown>>;
  particles?: Record<string, unknown>;
  postFilter?: string;
  audio?: Record<string, unknown>;
}) {
  const kind = input.kind ?? 'liquidmotion';
  return {
    format: `${kind}/v1`,
    title: input.title,
    width: 640,
    height: 360,
    fps: 30,
    durationSec: 6,
    pixelScale: 2,
    pixelBlendMode: 'screen',
    pixelOpacity: 0.9,
    pixelBackdrop: input.pixelBackdrop,
    layers: input.layers,
    ...(input.particles ? { particles: input.particles } : {}),
    ...(input.postFilter ? { postFilter: input.postFilter } : {}),
    ...(input.audio ? { audio: input.audio } : {}),
  };
}

export function validateCreativeBlock(
  kind: 'evo' | 'pixelart' | 'stopmotion' | 'threejs' | 'liquidmotion',
  rawJson: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson) as Record<string, unknown>;
  } catch (err) {
    return { valid: false, errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`] };
  }

  if (kind === 'evo') {
    const nodes = parsed.nodes ?? parsed.objects ?? parsed.layers;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      errors.push('EVO requires a non-empty "nodes" array of 3D primitives.');
    }
  } else if (kind === 'pixelart') {
    const hasDraw = Array.isArray(parsed.draw) && parsed.draw.length > 0;
    const hasBackdrop = Array.isArray(parsed.backdrop) && parsed.backdrop.length > 0;
    const hasFrames = Array.isArray(parsed.frames) && parsed.frames.length > 0;
    if (!hasDraw && !hasBackdrop && !hasFrames && !parsed.pixels && !parsed.rle) {
      errors.push('Pixel Engine v3 requires "draw", "backdrop", "frames", "pixels", or "rle".');
    }
  } else if (kind === 'stopmotion') {
    if (!Array.isArray(parsed.layers) || parsed.layers.length === 0) {
      errors.push('Stop Motion v3 requires a non-empty "layers" array.');
    }
  } else if (kind === 'threejs') {
    const objs = parsed.objects ?? parsed.nodes;
    if (!Array.isArray(objs) || objs.length === 0) {
      errors.push('Three.js Studio requires a non-empty "objects" array.');
    }
  } else if (kind === 'liquidmotion') {
    const hasLayers = Array.isArray(parsed.layers) && parsed.layers.length > 0;
    if (!hasLayers && !parsed.pixelBackdrop) {
      errors.push('Hybrid scene requires "layers" or "pixelBackdrop".');
    }
  }

  return { valid: errors.length === 0, errors };
}
