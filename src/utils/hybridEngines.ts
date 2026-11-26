import { VectorStopMotionSpec } from '../types/stopMotion';
import {
  compileStopMotionSceneV2,
  evaluateStopMotionFidelity,
  StopMotionLayerSpec,
  StopMotionSceneV2,
} from './stopMotionEngine';
import { parsePixelArtCode, renderPixelArtToCanvas } from './pixelArtParser';
import { svgMarkupToDataUrl } from './vectorBrushes';
import { exportStopMotionXml } from './stopMotionExport';

export type HybridEngineKind =
  | 'liquidmotion'
  | 'liquiddrop'
  | 'pixelmotion'
  | 'motiondrop';

export interface HybridRenderResult {
  kind: HybridEngineKind;
  outputType: 'video' | 'still';
  title: string;
  width: number;
  height: number;
  background: string;
  stopMotionSpec?: VectorStopMotionSpec;
  svgMarkup?: string;
  dataUrl?: string;
  rawJson: string;
  fidelity: {
    score: number;
    notes: string[];
  };
}

function buildPixelLayerDataUrls(pixelSource: Record<string, unknown>): {
  urls: string[];
  pw: number;
  ph: number;
} {
  const { spec } = parsePixelArtCode(JSON.stringify(pixelSource));
  if (!spec || spec.frames.length === 0) {
    return { urls: [], pw: 64, ph: 64 };
  }
  const urls = spec.frames.map((frame) => {
    const canvas = renderPixelArtToCanvas(frame, spec.width, spec.height, 1, false);
    return canvas.toDataURL('image/png');
  });
  return { urls, pw: spec.width, ph: spec.height };
}

export function parseHybridCode(
  kind: HybridEngineKind,
  rawCode: string
): { result?: HybridRenderResult; error?: string } {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { error: `Empty ${kind} specification.` };
  }
  const unfenced = trimmed
    .replace(/^```(?:[a-z0-9_-]+)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(unfenced) as Record<string, unknown>;
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Invalid ${kind} JSON: ${err.message}`
          : `Invalid ${kind} JSON.`,
    };
  }

  const title =
    typeof parsed.title === 'string' && parsed.title
      ? parsed.title
      : kind === 'liquidmotion'
      ? 'Liquid Motion Clip'
      : kind === 'liquiddrop'
      ? 'Liquid Drop Still'
      : kind === 'pixelmotion'
      ? 'Pixel Motion Clip'
      : 'Motion Drop Still';

  const width =
    typeof parsed.width === 'number' && parsed.width >= 64
      ? Math.min(1920, parsed.width)
      : kind === 'liquiddrop' || kind === 'motiondrop'
      ? 640
      : 800;
  const height =
    typeof parsed.height === 'number' && parsed.height >= 64
      ? Math.min(1920, parsed.height)
      : kind === 'liquiddrop' || kind === 'motiondrop'
      ? 640
      : 450;
  const background =
    typeof parsed.background === 'string' && parsed.background
      ? parsed.background
      : '#0f172a';
  const fps =
    typeof parsed.fps === 'number' && parsed.fps >= 1 && parsed.fps <= 60
      ? parsed.fps
      : 24;
  const durationSec =
    typeof parsed.durationSec === 'number' && parsed.durationSec > 0
      ? Math.min(600, parsed.durationSec)
      : 3;

  // Extract embedded pixel definition if supplied
  const pixelBlock =
    (parsed.pixelArt as Record<string, unknown> | undefined) ||
    (parsed.pixelLayer as Record<string, unknown> | undefined) ||
    (parsed.pixel as Record<string, unknown> | undefined) ||
    (parsed.palette || parsed.draw || parsed.rle || parsed.pixels
      ? {
          width:
            typeof parsed.pixelWidth === 'number'
              ? parsed.pixelWidth
              : Math.min(512, typeof parsed.width === 'number' && parsed.width <= 512 ? parsed.width : 64),
          height:
            typeof parsed.pixelHeight === 'number'
              ? parsed.pixelHeight
              : Math.min(512, typeof parsed.height === 'number' && parsed.height <= 512 ? parsed.height : 64),
          palette: parsed.palette,
          gradients: parsed.gradients,
          shaders: parsed.shaders,
          backdrop: parsed.pixelBackdrop,
          draw: parsed.draw,
          rle: parsed.rle,
          pixels: parsed.pixels,
          frames: parsed.pixelFrames,
        }
      : undefined);

  const syntheticLayers: StopMotionLayerSpec[] = [];

  if (pixelBlock) {
    const { urls } = buildPixelLayerDataUrls(pixelBlock);
    if (urls.length > 0) {
      const pScale = typeof parsed.pixelScale === 'number' ? parsed.pixelScale : 1;
      const targetW = (typeof parsed.pixelRenderWidth === 'number' ? parsed.pixelRenderWidth : width) * pScale;
      const targetH = (typeof parsed.pixelRenderHeight === 'number' ? parsed.pixelRenderHeight : height) * pScale;
      const pxX = typeof parsed.pixelX === 'number' ? parsed.pixelX : (width - targetW) / 2;
      const pxY = typeof parsed.pixelY === 'number' ? parsed.pixelY : (height - targetH) / 2;
      const pBlend = typeof parsed.pixelBlendMode === 'string' ? parsed.pixelBlendMode : 'normal';
      const pOpacity = typeof parsed.pixelOpacity === 'number' ? parsed.pixelOpacity : 1;
      const imgStyle = `image-rendering: pixelated; mix-blend-mode: ${pBlend}; opacity: ${pOpacity};`;

      if (urls.length === 1 || kind === 'liquiddrop' || kind === 'motiondrop') {
        syntheticLayers.push({
          id: 'hybrid-pixel-base',
          x: pxX,
          y: pxY,
          motion: parsed.pixelMotion as StopMotionLayerSpec['motion'],
          shadow: parsed.pixelShadow as StopMotionLayerSpec['shadow'],
          svg: `<image href="${urls[0]}" width="${targetW}" height="${targetH}" preserveAspectRatio="xMidYMid meet" style="${imgStyle}" />`,
        });
      } else {
        urls.forEach((url, idx) => {
          const slice = 1 / urls.length;
          syntheticLayers.push({
            id: `hybrid-pixel-frame-${idx}`,
            x: pxX,
            y: pxY,
            visibleFrom: idx * slice,
            visibleTo: idx === urls.length - 1 ? 1.01 : (idx + 1) * slice - 0.0001,
            motion: parsed.pixelMotion as StopMotionLayerSpec['motion'],
            svg: `<image href="${url}" width="${targetW}" height="${targetH}" preserveAspectRatio="xMidYMid meet" style="${imgStyle}" />`,
          });
        });
      }
    }
  }

  const userLayers = Array.isArray(parsed.layers)
    ? (parsed.layers as StopMotionLayerSpec[])
    : Array.isArray(parsed.motionLayers)
    ? (parsed.motionLayers as StopMotionLayerSpec[])
    : [];

  const extraOverlayLayers: StopMotionLayerSpec[] = [];
  if (parsed.particles && typeof parsed.particles === 'object') {
    extraOverlayLayers.push({
      id: 'hybrid-particles',
      particles: parsed.particles as StopMotionLayerSpec['particles'],
    });
  }
  if (parsed.lighting && typeof parsed.lighting === 'object') {
    const rimCol = String((parsed.lighting as Record<string, unknown>).rimColor || '#38bdf8');
    extraOverlayLayers.push({
      id: 'hybrid-rim-light',
      blendMode: 'screen',
      opacity: 0.42,
      svg: `<ellipse cx="${width * 0.5}" cy="${height * 0.18}" rx="${width * 0.42}" ry="${height * 0.14}" fill="${rimCol}" filter="url(#neonBloom)" />`,
    });
  }

  let fgOverlay = typeof parsed.foreground === 'string' ? parsed.foreground : '';
  if (parsed.letterbox) {
    const barH = Math.round(height * 0.08);
    fgOverlay += `<rect x="0" y="0" width="${width}" height="${barH}" fill="#020617" /><rect x="0" y="${height - barH}" width="${width}" height="${barH}" fill="#020617" />`;
  }
  if (typeof parsed.frameOverlay === 'string') {
    fgOverlay += parsed.frameOverlay;
  }

  const combinedLayers = [...syntheticLayers, ...userLayers, ...extraOverlayLayers];
  if (combinedLayers.length === 0) {
    // Provide graceful fallback visual if only top-level svg/glow/threeD provided
    if (typeof parsed.svg === 'string') {
      combinedLayers.push({ id: 'hybrid-svg', svg: parsed.svg });
    } else if (parsed.threeD) {
      combinedLayers.push({
        id: 'hybrid-3d',
        x: width / 2,
        y: height / 2,
        shadow: true,
        threeD: parsed.threeD as StopMotionLayerSpec['threeD'],
      });
    } else {
      return {
        error: `Include "layers", "motionLayers", or pixel art ops/frames inside your ${kind} block.`,
      };
    }
  }

  const validEffects = new Set(['vignette', 'chromatic', 'bloom', 'grain', 'sepia', 'noir', 'cyberpunk', 'crt', 'none']);
  const postFilterPreset =
    typeof parsed.postFilter === 'string' && validEffects.has(parsed.postFilter)
      ? (parsed.postFilter as NonNullable<StopMotionSceneV2['storyboard']>['shots'][number]['effect'])
      : undefined;
  const resolvedStoryboard: StopMotionSceneV2['storyboard'] =
    (parsed.storyboard as StopMotionSceneV2['storyboard']) ||
    (postFilterPreset
      ? { shots: [{ label: 'Hybrid Pass', start: 0, end: 1, effect: postFilterPreset }] }
      : undefined);

  const scene: StopMotionSceneV2 = {
    format: kind,
    title,
    fps,
    durationSec: kind === 'liquiddrop' || kind === 'motiondrop' ? 1 / fps : durationSec,
    frameCount: kind === 'liquiddrop' || kind === 'motiondrop' ? 1 : Math.round(durationSec * fps),
    width,
    height,
    background,
    loop: parsed.loop !== false,
    pingPong: Boolean(parsed.pingPong),
    defs: typeof parsed.defs === 'string' ? parsed.defs : undefined,
    backdrop: typeof parsed.backdrop === 'string' ? parsed.backdrop : undefined,
    foreground: fgOverlay || undefined,
    groups: parsed.groups as StopMotionSceneV2['groups'],
    storyboard: resolvedStoryboard,
    threeLighting: parsed.threeLighting as StopMotionSceneV2['threeLighting'],
    audio: parsed.audio as StopMotionSceneV2['audio'],
    layers: combinedLayers,
  };

  const stopMotionSpec = compileStopMotionSceneV2(scene, svgMarkupToDataUrl);
  const fid = evaluateStopMotionFidelity(scene);
  const notes = [
    `Engine: ${kind.toUpperCase()} (${kind === 'liquiddrop' || kind === 'motiondrop' ? 'Static Composite Still' : 'Video Hybrid Timeline'})`,
    ...fid.notes,
  ];

  if (kind === 'liquiddrop' || kind === 'motiondrop') {
    const firstFrame = stopMotionSpec.frames[0];
    return {
      result: {
        kind,
        outputType: 'still',
        title,
        width,
        height,
        background,
        svgMarkup: firstFrame?.svgMarkup || '',
        dataUrl: firstFrame?.dataUrl || '',
        rawJson: unfenced,
        fidelity: { score: fid.score, notes },
      },
    };
  }

  return {
    result: {
      kind,
      outputType: 'video',
      title,
      width,
      height,
      background,
      stopMotionSpec,
      rawJson: unfenced,
      fidelity: { score: fid.score, notes },
    },
  };
}

export function exportHybridXml(res: HybridRenderResult): string {
  if (res.stopMotionSpec) {
    return exportStopMotionXml(res.stopMotionSpec);
  }
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeSvg = (res.svgMarkup || '').replace(/\]\]>/g, ']]]]><![CDATA[>');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<hybrid format="${esc(res.kind)}" outputType="still" title="${esc(res.title)}" width="${res.width}" height="${res.height}" background="${esc(res.background)}">`,
    `  <svg><![CDATA[${safeSvg}]]></svg>`,
    `</hybrid>`,
  ].join('\n');
}
