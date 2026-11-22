import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import {
  PixelArtFrame,
  PixelArtSpec,
  PixelShaderSpec,
  PixelShaderType,
} from '../types/pixelArt';
import { evaluateMathExpression } from './stopMotionEngine';

interface GradientStop {
  at: number;
  color: string;
}

interface GradientDef {
  type?: 'linear' | 'radial';
  from?: [number, number];
  to?: [number, number];
  cx?: number;
  cy?: number;
  r?: number;
  stops: GradientStop[];
  dither?: boolean | 'bayer4' | 'checker';
  steps?: number;
}

type Rgb = [number, number, number, number];

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const MAX_PIXEL_DIMENSION = 512;

export function parseColorToRgba(color: string): Rgb | null {
  const c = color.trim().toLowerCase();
  if (!c || c === 'transparent' || c === 'none') return null;

  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) : 255;
      return [r, g, b, a];
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
      return [r, g, b, a];
    }
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(c);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((s) => Number(s.trim()));
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      const a =
        parts.length >= 4
          ? Math.round(Math.max(0, Math.min(1, parts[3])) * 255)
          : 255;
      return [
        Math.round(Math.max(0, Math.min(255, parts[0]))),
        Math.round(Math.max(0, Math.min(255, parts[1]))),
        Math.round(Math.max(0, Math.min(255, parts[2]))),
        a,
      ];
    }
  }

  return null;
}

function rgbaToHex([r, g, b, a]: Rgb): string {
  if (a <= 0) return '';
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  if (a < 255) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function shadeRgba(rgb: Rgb, factor: number): string {
  return rgbaToHex([
    rgb[0] * factor,
    rgb[1] * factor,
    rgb[2] * factor,
    rgb[3],
  ]);
}

function blendRgbaOver(dst: Rgb | null, src: Rgb): string {
  if (!dst || src[3] >= 254) return rgbaToHex(src);
  const a = src[3] / 255;
  return rgbaToHex([
    dst[0] * (1 - a) + src[0] * a,
    dst[1] * (1 - a) + src[1] * a,
    dst[2] * (1 - a) + src[2] * a,
    Math.max(dst[3], src[3]),
  ]);
}

function sampleGradient(
  grad: GradientDef,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const stops = [...(grad.stops || [])].sort((a, b) => a.at - b.at);
  if (stops.length === 0) return '';

  let u = 0;
  if (grad.type === 'radial') {
    const cx = grad.cx ?? width / 2;
    const cy = grad.cy ?? height / 2;
    const r = grad.r ?? Math.max(width, height) / 2;
    u = r > 0 ? Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r : 0;
  } else {
    const x0 = grad.from?.[0] ?? 0;
    const y0 = grad.from?.[1] ?? 0;
    const x1 = grad.to?.[0] ?? 0;
    const y1 = grad.to?.[1] ?? Math.max(1, height - 1);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lenSq = dx * dx + dy * dy;
    u = lenSq > 0 ? ((x - x0) * dx + (y - y0) * dy) / lenSq : 0;
  }

  u = Math.max(0, Math.min(1, u));

  if (grad.dither) {
    const threshold =
      grad.dither === 'checker'
        ? (x + y) % 2 === 0
          ? -0.03
          : 0.03
        : (BAYER_4X4[y & 3][x & 3] / 16 - 0.46875) * 0.14;
    u = Math.max(0, Math.min(1, u + threshold));
  }

  if (typeof grad.steps === 'number' && grad.steps >= 2) {
    const s = Math.max(2, Math.min(64, Math.round(grad.steps)));
    u = Math.round(u * (s - 1)) / (s - 1);
  }

  if (u <= stops[0].at) return stops[0].color;
  if (u >= stops[stops.length - 1].at) return stops[stops.length - 1].color;

  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (u >= a.at && u <= b.at) {
      const span = b.at - a.at || 1;
      const local = (u - a.at) / span;
      const rgbA = parseColorToRgba(a.color);
      const rgbB = parseColorToRgba(b.color);
      if (!rgbA || !rgbB) return local < 0.5 ? a.color : b.color;
      return rgbaToHex([
        rgbA[0] + (rgbB[0] - rgbA[0]) * local,
        rgbA[1] + (rgbB[1] - rgbA[1]) * local,
        rgbA[2] + (rgbB[2] - rgbA[2]) * local,
        rgbA[3] + (rgbB[3] - rgbA[3]) * local,
      ]);
    }
  }
  return stops[stops.length - 1].color;
}

function expandRleRow(row: string, width: number, forceRle: boolean): string {
  if (!forceRle && row.length === width) return row;
  if (forceRle || /^(\d+[^\d])+$/.test(row)) {
    let expanded = '';
    const rx = /(\d+)([^\d])/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(row)) !== null) {
      const count = Math.min(width * 2, Math.max(0, Number(m[1])));
      expanded += m[2].repeat(count);
    }
    if (expanded.length > 0) return expanded;
  }
  return row;
}

function evalNum(val: unknown, vars: Record<string, number>, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
    try {
      return evaluateMathExpression(trimmed, vars);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function resolveColorToken(
  token: unknown,
  paletteMap: Record<string, string>
): string {
  if (typeof token !== 'string') return '';
  const trimmed = token.trim();
  if (!trimmed || trimmed.toLowerCase() === 'transparent') return '';
  if (paletteMap[trimmed] !== undefined) return paletteMap[trimmed];
  return trimmed;
}

function applyDrawOp(
  pixels: string[],
  width: number,
  height: number,
  op: Record<string, unknown>,
  paletteMap: Record<string, string>,
  gradients: Record<string, GradientDef>,
  vars: Record<string, number>
) {
  const kind = String(op.op || op.type || '').toLowerCase();
  const putPixel = (px: number, py: number, color: string) => {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (ix >= 0 && ix < width && iy >= 0 && iy < height && color) {
      pixels[iy * width + ix] = color;
    }
  };

  if (kind === 'gradient' || kind === 'gradientrect') {
    const gradName = typeof op.gradient === 'string' ? op.gradient : '';
    const grad = gradName ? gradients[gradName] : (op as unknown as GradientDef);
    if (!grad || !Array.isArray(grad.stops)) return;
    const x0 = Math.max(0, Math.floor(evalNum(op.x, vars, 0)));
    const y0 = Math.max(0, Math.floor(evalNum(op.y, vars, 0)));
    const w = Math.max(1, Math.floor(evalNum(op.w ?? op.width, vars, width - x0)));
    const h = Math.max(1, Math.floor(evalNum(op.h ?? op.height, vars, height - y0)));
    for (let y = y0; y < Math.min(height, y0 + h); y += 1) {
      for (let x = x0; x < Math.min(width, x0 + w); x += 1) {
        const col = sampleGradient(grad, x - x0, y - y0, w, h);
        if (col) pixels[y * width + x] = col;
      }
    }
    return;
  }

  const color = resolveColorToken(op.color ?? op.fill ?? op.c, paletteMap);

  if (kind === 'fill' || kind === 'clear') {
    const c = color || '';
    for (let idx = 0; idx < pixels.length; idx += 1) {
      pixels[idx] = c;
    }
    return;
  }

  if (kind === 'pset' || kind === 'pixel') {
    putPixel(evalNum(op.x, vars, 0), evalNum(op.y, vars, 0), color);
    return;
  }

  if (kind === 'rect') {
    const x0 = Math.round(evalNum(op.x, vars, 0));
    const y0 = Math.round(evalNum(op.y, vars, 0));
    const w = Math.max(1, Math.round(evalNum(op.w ?? op.width, vars, 1)));
    const h = Math.max(1, Math.round(evalNum(op.h ?? op.height, vars, 1)));
    const strokeOnly = op.filled === false;
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        if (!strokeOnly || x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1) {
          putPixel(x, y, color);
        }
      }
    }
    return;
  }

  if (kind === 'circle' || kind === 'disc') {
    const cx = evalNum(op.cx ?? op.x, vars, width / 2);
    const cy = evalNum(op.cy ?? op.y, vars, height / 2);
    const r = Math.max(0.5, evalNum(op.r ?? op.radius, vars, 4));
    const strokeOnly = op.filled === false;
    const minX = Math.max(0, Math.floor(cx - r - 1));
    const maxX = Math.min(width - 1, Math.ceil(cx + r + 1));
    const minY = Math.max(0, Math.floor(cy - r - 1));
    const maxY = Math.min(height - 1, Math.ceil(cy + r + 1));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (strokeOnly ? Math.abs(dist - r) <= 0.7 : dist <= r) {
          putPixel(x, y, color);
        }
      }
    }
    return;
  }

  if (kind === 'ellipse') {
    const cx = evalNum(op.cx ?? op.x, vars, width / 2);
    const cy = evalNum(op.cy ?? op.y, vars, height / 2);
    const rx = Math.max(0.5, evalNum(op.rx, vars, 6));
    const ry = Math.max(0.5, evalNum(op.ry, vars, 4));
    const minX = Math.max(0, Math.floor(cx - rx - 1));
    const maxX = Math.min(width - 1, Math.ceil(cx + rx + 1));
    const minY = Math.max(0, Math.floor(cy - ry - 1));
    const maxY = Math.min(height - 1, Math.ceil(cy + ry + 1));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) {
          putPixel(x, y, color);
        }
      }
    }
    return;
  }

  if (kind === 'line') {
    let x0 = Math.round(evalNum(op.x1 ?? op.x0, vars, 0));
    let y0 = Math.round(evalNum(op.y1 ?? op.y0, vars, 0));
    const x1 = Math.round(evalNum(op.x2, vars, width - 1));
    const y1 = Math.round(evalNum(op.y2, vars, height - 1));
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      putPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return;
  }

  if (kind === 'polygon' && Array.isArray(op.points)) {
    const pts = op.points
      .filter(
        (p): p is [number | string, number | string] =>
          Array.isArray(p) && p.length >= 2
      )
      .map(([px, py]) => [evalNum(px, vars, 0), evalNum(py, vars, 0)] as [number, number]);
    if (pts.length < 3) return;
    let minY = height;
    let maxY = 0;
    for (const [, py] of pts) {
      minY = Math.min(minY, Math.floor(py));
      maxY = Math.max(maxY, Math.ceil(py));
    }
    minY = Math.max(0, minY);
    maxY = Math.min(height - 1, maxY);
    for (let y = minY; y <= maxY; y += 1) {
      const scanY = y + 0.5;
      const nodes: number[] = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi <= scanY && yj > scanY) || (yj <= scanY && yi > scanY)) {
          nodes.push(xi + ((scanY - yi) / (yj - yi)) * (xj - xi));
        }
      }
      nodes.sort((a, b) => a - b);
      for (let k = 0; k < nodes.length; k += 2) {
        if (k + 1 >= nodes.length) break;
        const startX = Math.max(0, Math.ceil(nodes[k] - 0.5));
        const endX = Math.min(width - 1, Math.floor(nodes[k + 1] - 0.5));
        for (let x = startX; x <= endX; x += 1) {
          putPixel(x, y, color);
        }
      }
    }
    return;
  }

  if (kind === 'noise' || kind === 'stars') {
    const count = Math.min(12000, Math.max(1, Math.round(evalNum(op.count, vars, 40))));
    const seed = evalNum(op.seed, vars, 1337);
    for (let n = 0; n < count; n += 1) {
      const hx = Math.sin((n + 1) * 12.9898 + seed * 78.233) * 43758.5453;
      const hy = Math.sin((n + 1) * 93.989 + seed * 37.719) * 24634.6345;
      const rx = Math.floor((hx - Math.floor(hx)) * width);
      const ry = Math.floor((hy - Math.floor(hy)) * height);
      putPixel(rx, ry, color);
    }
    return;
  }

  // Pixel v3: Aurora ribbons
  if (kind === 'aurora') {
    const colors = Array.isArray(op.colors)
      ? op.colors.map((c) => resolveColorToken(c, paletteMap)).filter(Boolean)
      : [color || '#34d399', '#38bdf8', '#a855f7'];
    const baseY = evalNum(op.y, vars, height * 0.28);
    const amp = evalNum(op.amp, vars, Math.max(4, height * 0.08));
    const ribbonH = Math.max(4, Math.round(evalNum(op.thickness ?? op.h, vars, height * 0.2)));
    const phase = vars.t * Math.PI * 2 + evalNum(op.phase, vars, 0);

    for (let x = 0; x < width; x += 1) {
      const wave =
        Math.sin((x / Math.max(8, width)) * Math.PI * 3.2 + phase) * amp +
        Math.cos((x / Math.max(8, width)) * Math.PI * 5.7 - phase * 1.4) * (amp * 0.45);
      const startY = Math.round(baseY + wave);
      for (let dy = 0; dy < ribbonH; dy += 1) {
        const py = startY + dy;
        if (py < 0 || py >= height) continue;
        const norm = dy / Math.max(1, ribbonH - 1);
        const colIdx = Math.min(
          colors.length - 1,
          Math.floor(norm * colors.length)
        );
        const rgba = parseColorToRgba(colors[colIdx] || '#34d399');
        if (!rgba) continue;
        const alpha = Math.round(Math.sin(norm * Math.PI) * 190);
        const dst = pixels[py * width + x] ? parseColorToRgba(pixels[py * width + x]) : null;
        pixels[py * width + x] = blendRgbaOver(dst, [rgba[0], rgba[1], rgba[2], alpha]);
      }
    }
    return;
  }

  // Pixel v3: Stardust / Sparkling Particles
  if (kind === 'stardust' || kind === 'particles') {
    const count = Math.min(2000, Math.max(1, Math.round(evalNum(op.count, vars, 60))));
    const seed = evalNum(op.seed, vars, 42);
    const starRgb = parseColorToRgba(color || '#fef08a') || [254, 240, 138, 255];
    for (let n = 0; n < count; n += 1) {
      const hx = Math.sin((n + 1) * 19.13 + seed * 41.7) * 43758.5453;
      const hy = Math.sin((n + 1) * 73.91 + seed * 17.3) * 29431.719;
      const drift = vars.t * (n % 3 === 0 ? 12 : -6);
      const px = Math.floor(((hx - Math.floor(hx)) * width + drift + width) % width);
      const py = Math.floor((hy - Math.floor(hy)) * height);
      const twinkle = 0.45 + 0.55 * Math.sin(vars.t * Math.PI * 2 + n);
      putPixel(
        px,
        py,
        rgbaToHex([starRgb[0], starRgb[1], starRgb[2], Math.round(twinkle * 255)])
      );
      if (n % 5 === 0) {
        const halo = rgbaToHex([starRgb[0], starRgb[1], starRgb[2], Math.round(twinkle * 96)]);
        putPixel(px - 1, py, halo);
        putPixel(px + 1, py, halo);
        putPixel(px, py - 1, halo);
        putPixel(px, py + 1, halo);
      }
    }
    return;
  }

  // Pixel v3: Blockbench-style 2.5D shaded box (box3d / voxel / cube)
  if (kind === 'box3d' || kind === 'voxel' || kind === 'cube') {
    const x0 = Math.round(evalNum(op.x, vars, width * 0.35));
    const y0 = Math.round(evalNum(op.y, vars, height * 0.35));
    const w = Math.max(2, Math.round(evalNum(op.w ?? op.width, vars, 16)));
    const h = Math.max(2, Math.round(evalNum(op.h ?? op.height, vars, 16)));
    const depth = Math.max(2, Math.round(evalNum(op.z ?? op.depth, vars, Math.round(w * 0.45))));
    const baseRgb = parseColorToRgba(color || '#60a5fa') || [96, 165, 250, 255];

    const topCol = shadeRgba(baseRgb, 1.22);
    const frontCol = shadeRgba(baseRgb, 0.95);
    const sideCol = shadeRgba(baseRgb, 0.68);

    // Top extruded parallelogram
    for (let d = 1; d <= depth; d += 1) {
      for (let x = 0; x < w; x += 1) {
        putPixel(x0 + x + d, y0 - d, topCol);
      }
    }
    // Right extruded side
    for (let d = 1; d <= depth; d += 1) {
      for (let y = 0; y < h; y += 1) {
        putPixel(x0 + w - 1 + d, y0 + y - d, sideCol);
      }
    }
    // Front face
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        putPixel(x0 + x, y0 + y, frontCol);
      }
    }
    return;
  }

  // Pixel v3: Contact / Drop Shadow ellipse
  if (kind === 'dropshadow' || kind === 'contactshadow') {
    const cx = evalNum(op.cx ?? op.x, vars, width / 2);
    const cy = evalNum(op.cy ?? op.y, vars, height * 0.8);
    const rx = Math.max(2, evalNum(op.rx ?? op.r, vars, 16));
    const ry = Math.max(1, evalNum(op.ry, vars, Math.max(2, rx * 0.3)));
    const shRgb = parseColorToRgba(color || '#0f172a') || [15, 23, 42, 255];
    const maxAlpha = Math.round(255 * Math.max(0.08, Math.min(0.85, evalNum(op.opacity, vars, 0.35))));

    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if (x < 0 || x >= width) continue;
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 <= 1) {
          const alpha = Math.round(maxAlpha * (1 - d2));
          const dst = pixels[y * width + x] ? parseColorToRgba(pixels[y * width + x]) : null;
          pixels[y * width + x] = blendRgbaOver(dst, [shRgb[0], shRgb[1], shRgb[2], alpha]);
        }
      }
    }
  }
}

export function applyPixelShaders(
  pixels: string[],
  width: number,
  height: number,
  shaders: PixelShaderSpec[]
): string[] {
  if (!shaders || shaders.length === 0) return pixels;
  const out = [...pixels];

  for (const sh of shaders) {
    const type = String(sh.type || '').toLowerCase() as PixelShaderType;
    const intensity = typeof sh.intensity === 'number' ? Math.max(0, Math.min(1, sh.intensity)) : 0.45;

    if (type === 'scanline' || type === 'crt') {
      const darkFactor = type === 'crt' ? 1 - 0.38 * intensity : 1 - 0.28 * intensity;
      for (let y = 0; y < height; y += 1) {
        if (y % 2 === 1) {
          for (let x = 0; x < width; x += 1) {
            const c = out[y * width + x];
            if (!c) continue;
            const rgb = parseColorToRgba(c);
            if (rgb) out[y * width + x] = shadeRgba(rgb, darkFactor);
          }
        }
      }
      if (type === 'crt') {
        // Subtle vignette corners
        const cx = width / 2;
        const cy = height / 2;
        const maxD = Math.hypot(cx, cy) || 1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const d = Math.hypot(x - cx, y - cy) / maxD;
            if (d > 0.65) {
              const vig = 1 - Math.min(0.65, (d - 0.65) * 1.4 * intensity);
              const c = out[y * width + x];
              if (!c) continue;
              const rgb = parseColorToRgba(c);
              if (rgb) out[y * width + x] = shadeRgba(rgb, vig);
            }
          }
        }
      }
    } else if (type === 'vignette') {
      const cx = width / 2;
      const cy = height / 2;
      const maxD = Math.hypot(cx, cy) || 1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const d = Math.hypot(x - cx, y - cy) / maxD;
          const vig = 1 - Math.pow(d, 2.1) * 0.58 * intensity;
          const c = out[y * width + x];
          if (!c) continue;
          const rgb = parseColorToRgba(c);
          if (rgb) out[y * width + x] = shadeRgba(rgb, vig);
        }
      }
    } else if (type === 'chromatic') {
      const shift = Math.max(1, Math.round(intensity * 3));
      const snap = [...out];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const c = snap[y * width + x];
          const rgbC = c ? parseColorToRgba(c) : null;
          const lCol = snap[y * width + Math.max(0, x - shift)];
          const rCol = snap[y * width + Math.min(width - 1, x + shift)];
          const rgbL = lCol ? parseColorToRgba(lCol) : rgbC;
          const rgbR = rCol ? parseColorToRgba(rCol) : rgbC;
          if (!rgbC && !rgbL && !rgbR) continue;
          out[y * width + x] = rgbaToHex([
            rgbL?.[0] ?? rgbC?.[0] ?? 0,
            rgbC?.[1] ?? 0,
            rgbR?.[2] ?? rgbC?.[2] ?? 0,
            rgbC?.[3] ?? Math.round(((rgbL?.[3] ?? 0) + (rgbR?.[3] ?? 0)) * 0.35),
          ]);
        }
      }
    } else if (type === 'posterize') {
      const levels = Math.max(2, Math.round(6 - intensity * 3));
      const step = 255 / (levels - 1);
      for (let idx = 0; idx < out.length; idx += 1) {
        const c = out[idx];
        if (!c) continue;
        const rgb = parseColorToRgba(c);
        if (rgb) {
          out[idx] = rgbaToHex([
            Math.round(rgb[0] / step) * step,
            Math.round(rgb[1] / step) * step,
            Math.round(rgb[2] / step) * step,
            rgb[3],
          ]);
        }
      }
    } else if (type === 'glow') {
      const glowRgb = sh.color ? parseColorToRgba(sh.color) : null;
      const snap = [...out];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const idx = y * width + x;
          if (snap[idx]) continue;
          const n = snap[(y - 1) * width + x] || snap[(y + 1) * width + x] || snap[y * width + x - 1] || snap[y * width + x + 1];
          if (!n) continue;
          const nRgb = glowRgb || parseColorToRgba(n);
          if (nRgb) {
            out[idx] = rgbaToHex([nRgb[0], nRgb[1], nRgb[2], Math.round(85 * intensity)]);
          }
        }
      }
    }
  }

  return out;
}

/**
 * Parses pixel art JSON into normalized PixelArtSpec up to 512x512px.
 * Supports pixelart/v1, pixelart/v2, and pixelart/v3 (512x512, aurora/stardust/box3d/dropShadow ops, post shaders).
 */
export function parsePixelArtCode(
  rawCode: string
): { spec?: PixelArtSpec; error?: string } {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { error: 'Pixel art code is empty.' };
  }

  const unfenced = trimmed
    .replace(/^```(?:pixelart|json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (unfenced.startsWith('{') || unfenced.startsWith('[')) {
    try {
      const parsed = JSON.parse(unfenced) as Record<string, unknown>;

      const title =
        typeof parsed.title === 'string' && parsed.title
          ? parsed.title
          : 'Pixel Art';
      const format =
        typeof parsed.format === 'string' && parsed.format
          ? parsed.format
          : 'pixelart/v3';
      const fps =
        typeof parsed.fps === 'number' && parsed.fps >= 1 && parsed.fps <= 60
          ? parsed.fps
          : 8;
      const loop = parsed.loop !== false;
      const shaders: PixelShaderSpec[] | undefined = Array.isArray(parsed.shaders)
        ? (parsed.shaders as PixelShaderSpec[])
        : undefined;
      const isV2OrV3 =
        parsed.format === 'pixelart/v2' ||
        parsed.format === 'pixelart/v3' ||
        'gradients' in parsed ||
        'draw' in parsed ||
        'backdrop' in parsed ||
        'rle' in parsed ||
        'frameCount' in parsed ||
        'shaders' in parsed;

      const rawPalette = parsed.palette;
      const paletteMap: Record<string, string> = {};
      const paletteList: string[] = [];

      if (rawPalette && typeof rawPalette === 'object' && !Array.isArray(rawPalette)) {
        for (const [k, v] of Object.entries(rawPalette)) {
          if (typeof v === 'string') {
            paletteMap[k] = v.toLowerCase() === 'transparent' ? '' : v;
            if (v && v.toLowerCase() !== 'transparent') {
              paletteList.push(v);
            }
          }
        }
      } else if (Array.isArray(rawPalette)) {
        rawPalette.forEach((c, idx) => {
          if (typeof c === 'string') {
            const val = c.toLowerCase() === 'transparent' ? '' : c;
            paletteMap[String(idx)] = val;
            if (val) paletteList.push(val);
          }
        });
      }

      const gradients =
        parsed.gradients && typeof parsed.gradients === 'object' && !Array.isArray(parsed.gradients)
          ? (parsed.gradients as Record<string, GradientDef>)
          : {};

      let detectedWidth = typeof parsed.width === 'number' ? parsed.width : 0;
      let detectedHeight = typeof parsed.height === 'number' ? parsed.height : 0;

      const normalizedFrames: PixelArtFrame[] = [];
      const baseTs = Date.now();

      if (
        !Array.isArray(parsed.frames) &&
        !parsed.pixels &&
        (Array.isArray(parsed.draw) || Array.isArray(parsed.backdrop))
      ) {
        const finalWidth = Math.max(8, Math.min(MAX_PIXEL_DIMENSION, detectedWidth || 64));
        const finalHeight = Math.max(8, Math.min(MAX_PIXEL_DIMENSION, detectedHeight || 64));
        const frameCount =
          typeof parsed.frameCount === 'number' && parsed.frameCount >= 1
            ? Math.min(120, Math.round(parsed.frameCount))
            : 1;
        const backdropOps = Array.isArray(parsed.backdrop)
          ? (parsed.backdrop as Record<string, unknown>[])
          : [];
        const drawOps = Array.isArray(parsed.draw)
          ? (parsed.draw as Record<string, unknown>[])
          : [];

        for (let fIdx = 0; fIdx < frameCount; fIdx += 1) {
          const t = loop
            ? fIdx / frameCount
            : frameCount > 1
            ? fIdx / (frameCount - 1)
            : 0;
          const vars: Record<string, number> = {
            i: fIdx,
            n: frameCount,
            t,
            w: finalWidth,
            h: finalHeight,
            cx: finalWidth / 2,
            cy: finalHeight / 2,
            PI: Math.PI,
            TAU: Math.PI * 2,
          };
          let pixelArr = new Array<string>(finalWidth * finalHeight).fill('');
          for (const op of backdropOps) {
            if (op && typeof op === 'object') {
              applyDrawOp(pixelArr, finalWidth, finalHeight, op, paletteMap, gradients, vars);
            }
          }
          for (const op of drawOps) {
            if (op && typeof op === 'object') {
              applyDrawOp(pixelArr, finalWidth, finalHeight, op, paletteMap, gradients, vars);
            }
          }
          if (shaders && shaders.length > 0) {
            pixelArr = applyPixelShaders(pixelArr, finalWidth, finalHeight, shaders);
          }
          normalizedFrames.push({
            id: `f-${fIdx}-${baseTs}`,
            pixels: pixelArr,
            hold: 1,
          });
        }

        return {
          spec: {
            title,
            format,
            width: finalWidth,
            height: finalHeight,
            fps,
            loop,
            shaders,
            palette: paletteList.length > 0 ? Array.from(new Set(paletteList)) : undefined,
            frames: normalizedFrames,
          },
        };
      }

      const rawFrames = parsed.frames || (parsed.pixels ? [parsed.pixels] : null);
      if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
        return { error: 'Missing "frames", "pixels", or "draw" ops in pixel art JSON.' };
      }

      const backdropOps = Array.isArray(parsed.backdrop)
        ? (parsed.backdrop as Record<string, unknown>[])
        : [];
      const globalDrawOps = Array.isArray(parsed.draw)
        ? (parsed.draw as Record<string, unknown>[])
        : [];

      for (let fIdx = 0; fIdx < rawFrames.length; fIdx += 1) {
        const f = rawFrames[fIdx];
        let rowStrings: string[] = [];
        let frameDrawOps: Record<string, unknown>[] = [];
        let hold = 1;

        if (Array.isArray(f)) {
          rowStrings = f.map((r) => String(r));
        } else if (f && typeof f === 'object') {
          const fObj = f as {
            pixels?: unknown;
            rle?: unknown;
            draw?: unknown;
            hold?: number;
          };
          hold = typeof fObj.hold === 'number' && fObj.hold >= 1 ? fObj.hold : 1;
          if (Array.isArray(fObj.rle)) {
            rowStrings = fObj.rle.map((r) => String(r));
          } else if (Array.isArray(fObj.pixels)) {
            rowStrings = fObj.pixels.map((r) => String(r));
          }
          if (Array.isArray(fObj.draw)) {
            frameDrawOps = fObj.draw as Record<string, unknown>[];
          }
        } else if (typeof f === 'string') {
          rowStrings = f.split('\n').filter((l) => l.trim().length > 0);
        }

        if (rowStrings.length === 0 && frameDrawOps.length === 0 && backdropOps.length === 0) {
          continue;
        }

        const firstExpanded = rowStrings[0]
          ? expandRleRow(rowStrings[0], detectedWidth || MAX_PIXEL_DIMENSION, Boolean(isV2OrV3 || parsed.rle))
          : '';
        const h = rowStrings.length || detectedHeight || 32;
        const w = firstExpanded.length || detectedWidth || 32;
        if (!detectedWidth) detectedWidth = w;
        if (!detectedHeight) detectedHeight = h;

        const frameW = Math.max(8, Math.min(MAX_PIXEL_DIMENSION, detectedWidth));
        const frameH = Math.max(8, Math.min(MAX_PIXEL_DIMENSION, detectedHeight));
        let pixelArr = new Array<string>(frameW * frameH).fill('');

        const t = loop
          ? fIdx / Math.max(1, rawFrames.length)
          : rawFrames.length > 1
          ? fIdx / (rawFrames.length - 1)
          : 0;
        const vars: Record<string, number> = {
          i: fIdx,
          n: rawFrames.length,
          t,
          w: frameW,
          h: frameH,
          cx: frameW / 2,
          cy: frameH / 2,
          PI: Math.PI,
          TAU: Math.PI * 2,
        };

        for (const op of backdropOps) {
          if (op && typeof op === 'object') {
            applyDrawOp(pixelArr, frameW, frameH, op, paletteMap, gradients, vars);
          }
        }

        for (let y = 0; y < frameH; y += 1) {
          const rawRow = rowStrings[y] || '';
          if (!rawRow) continue;
          const row = expandRleRow(rawRow, frameW, Boolean(isV2OrV3 || parsed.rle));
          for (let x = 0; x < frameW; x += 1) {
            const char = row[x] || '.';
            const mappedColor = paletteMap[char];
            if (mappedColor !== undefined) {
              if (mappedColor) pixelArr[y * frameW + x] = mappedColor;
            } else if (char !== '.' && char !== ' ' && char !== '_') {
              if (/^#[0-9a-f]{3,8}$/i.test(char)) {
                pixelArr[y * frameW + x] = char;
              }
            }
          }
        }

        for (const op of globalDrawOps) {
          if (op && typeof op === 'object') {
            applyDrawOp(pixelArr, frameW, frameH, op, paletteMap, gradients, vars);
          }
        }
        for (const op of frameDrawOps) {
          if (op && typeof op === 'object') {
            applyDrawOp(pixelArr, frameW, frameH, op, paletteMap, gradients, vars);
          }
        }

        if (shaders && shaders.length > 0) {
          pixelArr = applyPixelShaders(pixelArr, frameW, frameH, shaders);
        }

        normalizedFrames.push({
          id: `f-${fIdx}-${baseTs}`,
          pixels: pixelArr,
          hold,
        });
      }

      if (normalizedFrames.length === 0) {
        return { error: 'Could not extract valid frame pixels.' };
      }

      const finalWidth = Math.max(8, Math.min(MAX_PIXEL_DIMENSION, detectedWidth || 32));
      const finalHeight = Math.max(8, Math.min(MAX_PIXEL_DIMENSION, detectedHeight || 32));

      return {
        spec: {
          title,
          format,
          width: finalWidth,
          height: finalHeight,
          fps,
          loop,
          shaders,
          palette: paletteList.length > 0 ? Array.from(new Set(paletteList)) : undefined,
          frames: normalizedFrames,
        },
      };
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? `Invalid pixel art JSON: ${err.message}`
            : 'Invalid pixel art JSON.',
      };
    }
  }

  return {
    error: 'Pixel art must be formatted as JSON with width, height, palette, and frames.',
  };
}

export function serializePixelArtSpec(spec: PixelArtSpec): string {
  const colorSet = new Set<string>();
  for (const f of spec.frames) {
    for (const c of f.pixels) {
      if (c && c.trim() && c.toLowerCase() !== 'transparent') {
        colorSet.add(c.toLowerCase());
      }
    }
  }

  const CHAR_BANK = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$@%&*+=~?^';
  const paletteObj: Record<string, string> = { '.': 'transparent' };
  const colorToChar: Record<string, string> = {};

  let charIdx = 0;
  for (const color of colorSet) {
    const ch = CHAR_BANK[charIdx % CHAR_BANK.length];
    charIdx += 1;
    paletteObj[ch] = color;
    colorToChar[color] = ch;
  }

  const useRle = spec.width > 48 || spec.height > 48;

  const encodedFrames = spec.frames.map((frame) => {
    const rows: string[] = [];
    for (let y = 0; y < spec.height; y += 1) {
      let rowStr = '';
      for (let x = 0; x < spec.width; x += 1) {
        const color = frame.pixels[y * spec.width + x];
        if (!color || color.toLowerCase() === 'transparent') {
          rowStr += '.';
        } else {
          rowStr += colorToChar[color.toLowerCase()] || '.';
        }
      }
      if (useRle) {
        let rle = '';
        let runChar = rowStr[0] || '.';
        let runLen = 1;
        for (let i = 1; i < rowStr.length; i += 1) {
          if (rowStr[i] === runChar) {
            runLen += 1;
          } else {
            rle += `${runLen}${runChar}`;
            runChar = rowStr[i];
            runLen = 1;
          }
        }
        rle += `${runLen}${runChar}`;
        rows.push(rle);
      } else {
        rows.push(rowStr);
      }
    }
    return useRle ? { rle: rows, hold: frame.hold || 1 } : rows;
  });

  const payload = {
    ...(useRle || spec.shaders?.length
      ? { format: spec.format || 'pixelart/v3', rle: useRle }
      : {}),
    title: spec.title || 'Pixel Art',
    width: spec.width,
    height: spec.height,
    fps: spec.fps || 8,
    loop: spec.loop !== false,
    ...(spec.shaders?.length ? { shaders: spec.shaders } : {}),
    palette: paletteObj,
    frames: encodedFrames,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Renders a frame to a crisp canvas element using fast ImageData buffer (handles up to 512×512 cleanly).
 */
export function renderPixelArtToCanvas(
  frame: PixelArtFrame,
  width: number,
  height: number,
  scale = 1,
  showGrid = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext('2d');

  if (baseCtx) {
    const imgData = baseCtx.createImageData(width, height);
    const data = imgData.data;
    const cache = new Map<string, Rgb | null>();

    for (let idx = 0; idx < width * height; idx += 1) {
      const color = frame.pixels[idx];
      if (!color || color.toLowerCase() === 'transparent') continue;
      let rgb = cache.get(color);
      if (rgb === undefined) {
        rgb = parseColorToRgba(color);
        cache.set(color, rgb);
      }
      if (rgb) {
        const off = idx * 4;
        data[off] = rgb[0];
        data[off + 1] = rgb[1];
        data[off + 2] = rgb[2];
        data[off + 3] = rgb[3];
      }
    }
    baseCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(baseCanvas, 0, 0, canvas.width, canvas.height);
  }

  if (showGrid && scale >= 4) {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.22)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, height * scale);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(width * scale, y * scale);
      ctx.stroke();
    }
  }

  return canvas;
}

/**
 * Generates crisp SVG for pixel art by merging horizontal spans of matching pixels.
 * Note: For >= 256px matrices with thousands of unique gradients, embeds crisp PNG image inside SVG
 * to keep SVG export lightweight and instant!
 */
export function pixelArtToSvg(
  frame: PixelArtFrame,
  width: number,
  height: number,
  background = 'transparent'
): string {
  const outScale = width >= 256 ? 2 : width >= 128 ? 4 : width >= 64 ? 8 : 16;

  if (width >= 256 || height >= 256) {
    const canvas = renderPixelArtToCanvas(frame, width, height, 1, false);
    const pngDataUrl = canvas.toDataURL('image/png');
    const bgRect =
      background && background !== 'transparent'
        ? `<rect width="${width}" height="${height}" fill="${background}" />`
        : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * outScale}" height="${height * outScale}" shape-rendering="crispEdges">\n${bgRect}<image href="${pngDataUrl}" width="${width}" height="${height}" style="image-rendering: pixelated;" />\n</svg>`;
  }

  const rects: string[] = [];
  if (background && background !== 'transparent') {
    rects.push(`<rect width="${width}" height="${height}" fill="${background}" />`);
  }

  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      const color = frame.pixels[y * width + x];
      if (!color || color.toLowerCase() === 'transparent') {
        x += 1;
        continue;
      }
      let span = 1;
      while (x + span < width && frame.pixels[y * width + x + span] === color) {
        span += 1;
      }
      rects.push(
        `<rect x="${x}" y="${y}" width="${span}" height="1" fill="${color}" shape-rendering="crispEdges" />`
      );
      x += span;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * outScale}" height="${height * outScale}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>`;
}

export function pixelArtToPngBlob(
  frame: PixelArtFrame,
  width: number,
  height: number,
  scale = 16
): Promise<Blob> {
  const effectiveScale =
    width >= 256 && scale > 2
      ? 2
      : width >= 128 && scale > 4
      ? 4
      : scale;
  const canvas = renderPixelArtToCanvas(frame, width, height, effectiveScale, false);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create PNG blob'));
    }, 'image/png');
  });
}

export async function exportPixelArtGif(
  frames: PixelArtFrame[],
  width: number,
  height: number,
  fps = 8,
  scale = 16
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No frames to export.');
  }

  const effectiveScale =
    width >= 256 && scale > 2
      ? 2
      : width >= 128 && scale > 4
      ? 4
      : width >= 64 && scale > 8
      ? 8
      : scale;
  const gifWidth = width * effectiveScale;
  const gifHeight = height * effectiveScale;
  const gif = GIFEncoder();
  const delay = Math.round(1000 / Math.max(1, fps));

  for (const frame of frames) {
    const canvas = renderPixelArtToCanvas(frame, width, height, effectiveScale, false);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const { data } = ctx.getImageData(0, 0, gifWidth, gifHeight);
    const palette = quantize(data, 256, { format: 'rgba4444' });
    const index = applyPalette(data, palette);
    const frameDelay = delay * Math.max(1, frame.hold || 1);
    gif.writeFrame(index, gifWidth, gifHeight, {
      palette,
      delay: frameDelay,
      transparent: true,
      transparentIndex: 0,
    });
  }

  gif.finish();
  const bytes = gif.bytesView();
  return new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });
}
