import {
  StopMotionFrame,
  VectorBrushStyle,
  VectorPoint,
  VectorStopMotionSpec,
  VectorStrokeElement,
} from '../types/stopMotion';
import type { MathAudioTrackSpec } from './mathAudioSynth';
import {
  compileStopMotionSceneV2,
  isStopMotionSceneV2,
} from './stopMotionEngine';

export const VECTOR_BRUSH_META: Array<{
  id: VectorBrushStyle;
  label: string;
  description: string;
}> = [
  { id: 'pen', label: 'Vector Pen', description: 'Smooth Bezier ink stroke' },
  { id: 'calligraphy', label: 'Calligraphy', description: 'Variable-width angled nib' },
  { id: 'marker', label: 'Felt Marker', description: 'Bold chiseled studio stroke' },
  { id: 'highlighter', label: 'Highlighter', description: 'Translucent cel-shading tint' },
  { id: 'dashed', label: 'Dashed Arc', description: 'Stitched motion-line path' },
  { id: 'dots', label: 'Stipple Dots', description: 'Beaded vector dot trail' },
  { id: 'airbrush', label: 'Airbrush', description: 'Soft feathered mist & scatter' },
  { id: 'neon', label: 'Neon Tube', description: 'Luminous outer aura + core' },
  { id: 'watercolor', label: 'Watercolor', description: 'Translucent layered wet wash' },
  { id: 'pixel', label: 'Pixel Brush', description: 'Snapped crisp grid squares' },
];

export function isVectorBrushStyle(tool: string): tool is VectorBrushStyle {
  return (
    tool === 'pen' ||
    tool === 'calligraphy' ||
    tool === 'marker' ||
    tool === 'highlighter' ||
    tool === 'dashed' ||
    tool === 'dots' ||
    tool === 'airbrush' ||
    tool === 'neon' ||
    tool === 'watercolor' ||
    tool === 'pixel'
  );
}

export function buildSmoothSvgPath(points: VectorPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.1).toFixed(1)} ${(p.y + 0.1).toFixed(1)}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function vectorElementsToSvgMarkup(elements: VectorStrokeElement[]): string {
  return elements
    .map((el) => {
      const color = escapeAttr(el.color);
      if (el.kind === 'line') {
        return `<line x1="${el.x1.toFixed(1)}" y1="${el.y1.toFixed(1)}" x2="${el.x2.toFixed(1)}" y2="${el.y2.toFixed(1)}" stroke="${color}" stroke-width="${el.width}" stroke-linecap="round" />`;
      }
      if (el.kind === 'rect') {
        const x = Math.min(el.x1, el.x2);
        const y = Math.min(el.y1, el.y2);
        const w = Math.abs(el.x2 - el.x1);
        const h = Math.abs(el.y2 - el.y1);
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${el.width}" stroke-linejoin="round" />`;
      }
      if (el.kind === 'circle') {
        const cx = (el.x1 + el.x2) / 2;
        const cy = (el.y1 + el.y2) / 2;
        const rx = Math.max(1, Math.abs(el.x2 - el.x1) / 2);
        const ry = Math.max(1, Math.abs(el.y2 - el.y1) / 2);
        return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${el.width}" />`;
      }

      if (el.kind !== 'path') return '';

      const d = buildSmoothSvgPath(el.points);
      if (!d) return '';

      switch (el.brush) {
        case 'highlighter':
          return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(el.width * 2.4).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.38" />`;
        case 'marker':
          return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(el.width * 1.45).toFixed(1)}" stroke-linecap="square" stroke-linejoin="round" opacity="0.88" />`;
        case 'dashed':
          return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${el.width}" stroke-linecap="round" stroke-dasharray="${Math.max(6, el.width * 2.2).toFixed(0)} ${Math.max(4, el.width * 1.5).toFixed(0)}" />`;
        case 'airbrush':
          return `<g opacity="0.45"><path d="${d}" fill="none" stroke="${color}" stroke-width="${(el.width * 3.2).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.28" filter="url(#airbrushSoft)" /><path d="${d}" fill="none" stroke="${color}" stroke-width="${(el.width * 1.6).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" /></g>`;
        case 'neon':
          return `<g filter="url(#neonBloom)"><path d="${d}" fill="none" stroke="${color}" stroke-width="${(el.width * 2.1).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.55" /><path d="${d}" fill="none" stroke="#ffffff" stroke-width="${Math.max(1.2, el.width * 0.65).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" /></g>`;
        case 'watercolor':
          return `<g opacity="0.72"><path d="${d}" fill="none" stroke="${color}" stroke-width="${(el.width * 2.5).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.26" /><path d="${d}" fill="none" stroke="${color}" stroke-width="${(el.width * 1.4).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" /></g>`;
        case 'pixel': {
          const grid = Math.max(4, Math.round(el.width * 1.4));
          const seen = new Set<string>();
          const rects: string[] = [];
          for (const p of el.points) {
            const gx = Math.floor(p.x / grid) * grid;
            const gy = Math.floor(p.y / grid) * grid;
            const key = `${gx}:${gy}`;
            if (!seen.has(key)) {
              seen.add(key);
              rects.push(`<rect x="${gx}" y="${gy}" width="${grid}" height="${grid}" fill="${color}" shape-rendering="crispEdges" />`);
            }
          }
          return `<g shape-rendering="crispEdges">${rects.join('')}</g>`;
        }
        case 'dots': {
          const step = Math.max(8, el.width * 2);
          const circles: string[] = [];
          let acc = step;
          for (let i = 0; i < el.points.length; i += 1) {
            const p = el.points[i];
            if (i === 0) {
              circles.push(
                `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${Math.max(1.5, el.width * 0.6).toFixed(1)}" fill="${color}" />`
              );
              acc = 0;
              continue;
            }
            const prev = el.points[i - 1];
            const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
            acc += dist;
            if (acc >= step) {
              circles.push(
                `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${Math.max(1.5, el.width * 0.6).toFixed(1)}" fill="${color}" />`
              );
              acc = 0;
            }
          }
          return `<g>${circles.join('')}</g>`;
        }
        case 'calligraphy': {
          const thin = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${Math.max(1.5, el.width * 0.65).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" />`;
          const nibOffsetX = el.width * 0.28;
          const nibOffsetY = -el.width * 0.28;
          const shifted = buildSmoothSvgPath(
            el.points.map((p) => ({ x: p.x + nibOffsetX, y: p.y + nibOffsetY }))
          );
          const bold = `<path d="${shifted}" fill="none" stroke="${color}" stroke-width="${Math.max(2, el.width * 1.15).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />`;
          return `<g>${thin}${bold}</g>`;
        }
        case 'pen':
        default:
          return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round" />`;
      }
    })
    .filter(Boolean)
    .join('\n');
}

export function renderVectorElementOnCanvas(
  ctx: CanvasRenderingContext2D,
  el: VectorStrokeElement
) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;

  if (el.kind === 'line') {
    ctx.lineCap = 'round';
    ctx.lineWidth = el.width;
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.kind === 'rect') {
    ctx.lineJoin = 'round';
    ctx.lineWidth = el.width;
    ctx.strokeRect(
      Math.min(el.x1, el.x2),
      Math.min(el.y1, el.y2),
      Math.abs(el.x2 - el.x1),
      Math.abs(el.y2 - el.y1)
    );
    ctx.restore();
    return;
  }

  if (el.kind === 'circle') {
    ctx.lineWidth = el.width;
    const cx = (el.x1 + el.x2) / 2;
    const cy = (el.y1 + el.y2) / 2;
    const rx = Math.max(1, Math.abs(el.x2 - el.x1) / 2);
    const ry = Math.max(1, Math.abs(el.y2 - el.y1) / 2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.kind !== 'path') {
    ctx.restore();
    return;
  }

  const pts = el.points;
  if (pts.length === 0) {
    ctx.restore();
    return;
  }

  const traceSmooth = (points: VectorPoint[]) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) {
      ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
      return;
    }
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }
    for (let i = 1; i < points.length - 1; i += 1) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  };

  if (el.brush === 'pixel') {
    const grid = Math.max(4, Math.round(el.width * 1.4));
    const seen = new Set<string>();
    for (const p of pts) {
      const gx = Math.floor(p.x / grid) * grid;
      const gy = Math.floor(p.y / grid) * grid;
      const key = `${gx}:${gy}`;
      if (!seen.has(key)) {
        seen.add(key);
        ctx.fillRect(gx, gy, grid, grid);
      }
    }
    ctx.restore();
    return;
  }

  if (el.brush === 'dots') {
    const step = Math.max(8, el.width * 2);
    const radius = Math.max(1.5, el.width * 0.6);
    let acc = step;
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      if (i > 0) {
        acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      }
      if (i === 0 || acc >= step) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        acc = 0;
      }
    }
    ctx.restore();
    return;
  }

  if (el.brush === 'neon') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = el.color;
    ctx.shadowBlur = el.width * 2.6;
    ctx.lineWidth = el.width * 1.8;
    traceSmooth(pts);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.2, el.width * 0.65);
    traceSmooth(pts);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.brush === 'airbrush') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = el.color;
    ctx.shadowBlur = el.width * 2.2;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = el.width * 2.8;
    traceSmooth(pts);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = el.width * 1.4;
    traceSmooth(pts);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.brush === 'watercolor') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = el.width * 2.5;
    traceSmooth(pts);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = el.width * 1.4;
    traceSmooth(pts);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.brush === 'calligraphy') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, el.width * 0.65);
    traceSmooth(pts);
    ctx.stroke();

    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(2, el.width * 1.15);
    const dx = el.width * 0.28;
    const dy = -el.width * 0.28;
    traceSmooth(pts.map((p) => ({ x: p.x + dx, y: p.y + dy })));
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.brush === 'highlighter') {
    ctx.globalAlpha = 0.38;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = el.width * 2.4;
  } else if (el.brush === 'marker') {
    ctx.globalAlpha = 0.88;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'round';
    ctx.lineWidth = el.width * 1.45;
  } else if (el.brush === 'dashed') {
    ctx.lineCap = 'round';
    ctx.lineWidth = el.width;
    ctx.setLineDash([Math.max(6, el.width * 2.2), Math.max(4, el.width * 1.5)]);
  } else {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = el.width;
  }

  traceSmooth(pts);
  ctx.stroke();
  ctx.restore();
}

export function pointHitsVectorElement(
  pt: VectorPoint,
  el: VectorStrokeElement,
  radius: number
): boolean {
  const thresh = radius + el.width / 2 + 6;
  if (el.kind === 'line') {
    const steps = 12;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = el.x1 + (el.x2 - el.x1) * t;
      const y = el.y1 + (el.y2 - el.y1) * t;
      if (Math.hypot(pt.x - x, pt.y - y) <= thresh) return true;
    }
    return false;
  }
  if (el.kind === 'rect') {
    const minX = Math.min(el.x1, el.x2) - thresh;
    const maxX = Math.max(el.x1, el.x2) + thresh;
    const minY = Math.min(el.y1, el.y2) - thresh;
    const maxY = Math.max(el.y1, el.y2) + thresh;
    if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) return false;
    const nearLeft = Math.abs(pt.x - Math.min(el.x1, el.x2)) <= thresh;
    const nearRight = Math.abs(pt.x - Math.max(el.x1, el.x2)) <= thresh;
    const nearTop = Math.abs(pt.y - Math.min(el.y1, el.y2)) <= thresh;
    const nearBottom = Math.abs(pt.y - Math.max(el.y1, el.y2)) <= thresh;
    return nearLeft || nearRight || nearTop || nearBottom;
  }
  if (el.kind === 'circle') {
    const cx = (el.x1 + el.x2) / 2;
    const cy = (el.y1 + el.y2) / 2;
    const rx = Math.max(1, Math.abs(el.x2 - el.x1) / 2);
    const ry = Math.max(1, Math.abs(el.y2 - el.y1) / 2);
    const norm = Math.hypot((pt.x - cx) / rx, (pt.y - cy) / ry);
    return Math.abs(norm - 1) * Math.max(rx, ry) <= thresh;
  }
  if (el.kind !== 'path') return false;
  return el.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= thresh);
}

export function svgMarkupToDataUrl(
  innerOrFullSvg: string,
  width: number,
  height: number,
  background = '#faf8f5'
): string {
  const trimmed = innerOrFullSvg.trim();
  let fullSvg: string;

  if (/^<svg[\s>]/i.test(trimmed)) {
    fullSvg = /xmlns=/i.test(trimmed)
      ? trimmed
      : trimmed.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  } else {
    fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${escapeAttr(background)}"/>${trimmed}</svg>`;
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fullSvg)}`;
}

function stripOuterSvgTag(rawSvg: string): {
  inner: string;
  viewBoxW?: number;
  viewBoxH?: number;
} {
  const trimmed = rawSvg.trim();
  const match = trimmed.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/i);
  if (!match) {
    return { inner: trimmed };
  }
  const attrs = match[1];
  const inner = match[2];
  const vb = attrs.match(/viewBox\s*=\s*["'][\d.\s-]+?([\d.]+)\s+([\d.]+)["']/i);
  return {
    inner,
    viewBoxW: vb ? Number(vb[1]) : undefined,
    viewBoxH: vb ? Number(vb[2]) : undefined,
  };
}

export function parseVectorStopMotionCode(
  rawCode: string
): { spec?: VectorStopMotionSpec; error?: string } {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { error: 'Stop-motion vector code is empty.' };
  }

  // 1. Structured JSON format (v1 frames, v2 layers, or v3 storyboard + groups + audio)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      type ParsedFrameItem =
        | string
        | {
            svg?: string;
            dataUrl?: string;
            hold?: number;
            background?: string;
          };
      type ParsedSpecJson = {
        format?: string;
        title?: string;
        fps?: number;
        durationSec?: number;
        width?: number;
        height?: number;
        background?: string;
        loop?: boolean;
        pingPong?: boolean;
        audio?: MathAudioTrackSpec;
        frames?: ParsedFrameItem[];
      };

      const parsed = JSON.parse(trimmed) as ParsedSpecJson | ParsedFrameItem[];
      if (isStopMotionSceneV2(parsed)) {
        return {
          spec: compileStopMotionSceneV2(parsed, svgMarkupToDataUrl),
        };
      }

      const obj: ParsedSpecJson = Array.isArray(parsed)
        ? { frames: parsed }
        : parsed;

      if (!Array.isArray(obj.frames) || obj.frames.length === 0) {
        return { error: 'JSON must contain a non-empty "frames" or "layers" array.' };
      }

      const width =
        typeof obj.width === 'number' && obj.width >= 64 ? obj.width : 800;
      const height =
        typeof obj.height === 'number' && obj.height >= 64 ? obj.height : 450;
      const background =
        typeof obj.background === 'string' && obj.background
          ? obj.background
          : '#faf8f5';
      const fps =
        typeof obj.fps === 'number' && obj.fps >= 1 && obj.fps <= 60
          ? obj.fps
          : 10;

      const frames: StopMotionFrame[] = obj.frames.map((item, idx) => {
        if (typeof item === 'string') {
          const isData = item.startsWith('data:image/');
          const stripped = isData ? undefined : stripOuterSvgTag(item).inner;
          return {
            id: `vec-frame-${idx}-${Date.now()}`,
            dataUrl: isData
              ? item
              : svgMarkupToDataUrl(item, width, height, background),
            svgMarkup: stripped,
            background,
            hold: 1,
            createdAt: Date.now() + idx,
          };
        }

        const frameBg = item.background || background;
        const hold =
          typeof item.hold === 'number' && item.hold >= 1
            ? Math.min(8, Math.round(item.hold))
            : 1;

        if (item.dataUrl && item.dataUrl.startsWith('data:image/')) {
          return {
            id: `vec-frame-${idx}-${Date.now()}`,
            dataUrl: item.dataUrl,
            svgMarkup: item.svg,
            background: frameBg,
            hold,
            createdAt: Date.now() + idx,
          };
        }

        const svgStr = item.svg || '';
        const stripped = stripOuterSvgTag(svgStr).inner;
        return {
          id: `vec-frame-${idx}-${Date.now()}`,
          dataUrl: svgMarkupToDataUrl(svgStr, width, height, frameBg),
          svgMarkup: stripped,
          background: frameBg,
          hold,
          createdAt: Date.now() + idx,
        };
      });

      const totalHolds = frames.reduce((s, f) => s + Math.max(1, f.hold), 0);
      const durationSec =
        typeof obj.durationSec === 'number' && obj.durationSec > 0
          ? obj.durationSec
          : totalHolds / Math.max(1, fps);

      return {
        spec: {
          title: obj.title || 'Vector Stop Motion',
          format: obj.format || 'stopmotion/v1',
          fps,
          width,
          height,
          background,
          loop: obj.loop !== false,
          pingPong: Boolean(obj.pingPong),
          durationSec,
          totalLogicalFrames: totalHolds,
          audioSpec: obj.audio,
          frames,
        },
      };
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? `Invalid vector JSON: ${err.message}`
            : 'Invalid vector JSON.',
      };
    }
  }

  // 2. Multi-SVG markup sequence (<svg>...</svg> repeated)
  const svgMatches = trimmed.match(/<svg[\s\S]*?<\/svg>/gi);
  if (svgMatches && svgMatches.length > 0) {
    const fpsMatch = trimmed.match(/<!--\s*fps\s*:\s*(\d+)\s*-->/i);
    const fps = fpsMatch ? Math.min(60, Math.max(1, Number(fpsMatch[1]))) : 10;
    let width = 800;
    let height = 450;

    const frames: StopMotionFrame[] = svgMatches.map((rawSvg, idx) => {
      const parsed = stripOuterSvgTag(rawSvg);
      if (idx === 0 && parsed.viewBoxW && parsed.viewBoxH) {
        width = parsed.viewBoxW;
        height = parsed.viewBoxH;
      }
      const holdMatch = rawSvg.match(/data-hold\s*=\s*["'](\d+)["']/i);
      const hold = holdMatch ? Math.min(8, Math.max(1, Number(holdMatch[1]))) : 1;
      return {
        id: `svg-frame-${idx}-${Date.now()}`,
        dataUrl: svgMarkupToDataUrl(rawSvg, width, height, '#faf8f5'),
        svgMarkup: parsed.inner,
        background: '#faf8f5',
        hold,
        createdAt: Date.now() + idx,
      };
    });

    const totalHolds = frames.reduce((s, f) => s + Math.max(1, f.hold), 0);
    return {
      spec: {
        title: 'Vector Stop Motion',
        fps,
        width,
        height,
        background: '#faf8f5',
        loop: true,
        pingPong: false,
        durationSec: totalHolds / Math.max(1, fps),
        totalLogicalFrames: totalHolds,
        frames,
      },
    };
  }

  return {
    error:
      'Provide a JSON object with a "frames" or "layers" array, or multiple <svg>...</svg> frames.',
  };
}

export function serializeFramesToStopMotionCode(
  frames: StopMotionFrame[],
  fps: number,
  width: number,
  height: number,
  background = '#faf8f5',
  pingPong = false,
  title = 'Stop Motion Animation',
  audio?: unknown
): string {
  const totalHolds = frames.reduce((s, f) => s + Math.max(1, f.hold || 1), 0);
  const payload = {
    format: 'stopmotion/v3',
    title,
    fps,
    durationSec: Number((totalHolds / Math.max(1, fps)).toFixed(3)),
    width,
    height,
    background,
    loop: true,
    pingPong,
    ...(audio ? { audio } : {}),
    frames: frames.map((f) =>
      f.svgMarkup !== undefined
        ? {
            hold: f.hold,
            ...(f.background && f.background !== background
              ? { background: f.background }
              : {}),
            svg: f.svgMarkup,
          }
        : {
            hold: f.hold,
            svg: `<image href="${f.dataUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`,
          }
    ),
  };

  return JSON.stringify(payload, null, 2);
}

export const TACTILE_SVG_FILTERS_DEFS = `
<defs>
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
</defs>
`;

export function generateProcedural120Frames(
  theme: 'dough-ball' | 'wet-donut' | 'tactile-flame' | 'glossy-marker' | 'cosmic-vortex',
  width: number,
  height: number,
  background = '#faf8f5'
): StopMotionFrame[] {
  const count = 120;
  const frames: StopMotionFrame[] = [];
  const cx = width * 0.5;
  const cy = height * 0.5;

  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    let markup = '';

    if (theme === 'dough-ball') {
      const arc = Math.abs(Math.sin(t * Math.PI * 4));
      const squash = arc < 0.15 ? 0.6 : 1 + (1 - arc) * 0.14;
      const stretch = 1 / squash;
      const ballR = Math.min(width, height) * 0.12;
      const x = width * (0.15 + t * 0.7);
      const y = height * 0.78 - ballR * squash - arc * (height * 0.4);

      markup = `
        ${TACTILE_SVG_FILTERS_DEFS}
        <line x1="${width * 0.08}" y1="${height * 0.78}" x2="${width * 0.92}" y2="${height * 0.78}" stroke="#cbd5e1" stroke-width="2" />
        <ellipse cx="${x}" cy="${height * 0.78 + 4}" rx="${ballR * (1.1 + (1 - arc) * 0.4)}" ry="${8 * (1 - arc * 0.6)}" fill="rgba(15,23,42,0.14)" />
        <g transform="translate(${x} ${y}) scale(${stretch} ${squash})" filter="url(#tactileDoughWarp)">
          <circle cx="0" cy="0" r="${ballR}" fill="url(#wetGlazePink)" />
        </g>
        <g transform="translate(${x} ${y}) scale(${stretch} ${squash})">
          <ellipse cx="${-ballR * 0.3}" cy="${-ballR * 0.3}" rx="${ballR * 0.32}" ry="${ballR * 0.16}" transform="rotate(-30)" fill="rgba(255,255,255,0.75)" style="mix-blend-mode: screen;" />
        </g>
      `;
    } else if (theme === 'wet-donut') {
      const donutR = Math.min(width, height) * 0.22;
      const rot = (t * 360) % 360;
      markup = `
        ${TACTILE_SVG_FILTERS_DEFS}
        <ellipse cx="${cx}" cy="${cy + donutR * 1.1}" rx="${donutR * 1.1}" ry="${donutR * 0.25}" fill="rgba(136,19,55,0.12)" />
        <g transform="translate(${cx} ${cy}) rotate(${rot})" filter="url(#tactileDoughWarp)">
          <circle cx="0" cy="0" r="${donutR}" fill="url(#wetGlazePink)" stroke="#881337" stroke-width="2" />
          <circle cx="0" cy="0" r="${donutR * 0.38}" fill="${background}" stroke="#881337" stroke-width="2" />
        </g>
        <g transform="translate(${cx} ${cy})">
          <ellipse cx="${-donutR * 0.35}" cy="${-donutR * 0.35}" rx="${donutR * 0.34}" ry="${donutR * 0.16}" transform="rotate(-30)" fill="rgba(255,255,255,0.75)" style="mix-blend-mode: screen;" />
        </g>
      `;
    } else if (theme === 'tactile-flame') {
      const f1 = Math.sin((i / 5) * Math.PI) * 16;
      const fHeight = 110 + f1;
      markup = `
        ${TACTILE_SVG_FILTERS_DEFS}
        <ellipse cx="${cx}" cy="${height * 0.8}" rx="60" ry="18" fill="#451a03" filter="url(#tactileOrganicNoise)" />
        <g transform="translate(${cx} ${height * 0.78})" filter="url(#tactileDoughWarp)">
          <path d="M -46 0 C -34 ${-fHeight * 0.4} ${-16 + f1} ${-fHeight * 0.8} 0 ${-fHeight} C ${16 + f1} ${-fHeight * 0.8} 34 ${-fHeight * 0.4} 46 0 Z" fill="#ea580c" />
          <path d="M -30 0 C -20 ${-fHeight * 0.35} 0 ${-fHeight * 0.65} 0 ${-fHeight * 0.82} C 0 ${-fHeight * 0.65} 20 ${-fHeight * 0.35} 30 0 Z" fill="#f59e0b" />
          <ellipse cx="0" cy="${-fHeight * 0.25}" rx="12" ry="20" fill="#fef08a" />
        </g>
      `;
    } else if (theme === 'glossy-marker') {
      const mx = cx + Math.sin(t * Math.PI * 4) * (width * 0.25);
      const my = cy + Math.cos(t * Math.PI * 2) * (height * 0.15);
      const mRot = Math.sin(t * Math.PI * 2) * 25;
      markup = `
        ${TACTILE_SVG_FILTERS_DEFS}
        <g transform="translate(${mx} ${my}) rotate(${mRot})">
          <rect x="-18" y="-70" width="36" height="140" rx="14" fill="#2563eb" stroke="#1d4ed8" stroke-width="2" filter="url(#tactileOrganicNoise)" />
          <polygon points="-12,-70 12,-70 0,-100" fill="#1e293b" />
          <ellipse cx="-6" cy="0" rx="4" ry="58" fill="rgba(255,255,255,0.72)" style="mix-blend-mode: screen;" />
        </g>
      `;
    } else {
      const vortexAngle = t * 360;
      markup = `
        ${TACTILE_SVG_FILTERS_DEFS}
        <g transform="translate(${cx} ${cy}) rotate(${vortexAngle})" filter="url(#tactileDoughWarp)">
          <circle cx="0" cy="0" r="80" fill="url(#wetGlazeCyan)" />
          <circle cx="0" cy="0" r="40" fill="url(#wetGlazePink)" />
        </g>
        <circle cx="${cx}" cy="${cy}" r="16" fill="#ffffff" style="mix-blend-mode: screen;" />
      `;
    }

    frames.push({
      id: crypto.randomUUID(),
      dataUrl: svgMarkupToDataUrl(markup, width, height, background),
      svgMarkup: markup,
      background,
      hold: 1,
      createdAt: Date.now() + i,
    });
  }

  return frames;
}
