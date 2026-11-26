import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import {
  PixelArtFrame,
  PixelArtSpec,
  PixelShaderSpec,
  PixelShaderType,
} from '../types/pixelArt';
import { evaluateMathExpression } from './stopMotionEngine';
import { resolveNamedPalette } from './pixelArtPalettes';

interface GradientStop {
  at: number;
  color: string;
}

interface GradientDef {
  type?: 'linear' | 'radial' | 'conic' | 'diamond' | 'spiral' | 'noise';
  from?: [number, number];
  to?: [number, number];
  cx?: number;
  cy?: number;
  r?: number;
  twists?: number;
  stops: GradientStop[];
  dither?: boolean | 'bayer4' | 'bayer8' | 'bayer2' | 'checker' | 'halftone';
  steps?: number;
}

type Rgb = [number, number, number, number];

const BAYER_2X2 = [
  [0, 2],
  [3, 1],
];

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

const BITMAP_FONT_5X7: Record<string, string[]> = {
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01110','10001','10000','10000','10000','10001','01110'],
  D: ['11100','10010','10001','10001','10001','10010','11100'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01110','10001','10000','10111','10001','10001','01111'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['01110','00100','00100','00100','00100','00100','01110'],
  J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','11011','10001'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00110','01000','10000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
  '.': ['00000','00000','00000','00000','00000','01100','01100'],
  ':': ['00000','01100','01100','00000','01100','01100','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '!': ['00100','00100','00100','00100','00100','00000','00100'],
  '/': ['00001','00010','00010','00100','01000','01000','10000'],
  '%': ['11001','11010','00010','00100','01000','01011','10011'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

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

function blendWithMode(dst: Rgb | null, src: Rgb, mode = 'normal', opacity = 1): string {
  const alpha = Math.max(0, Math.min(1, (src[3] / 255) * opacity));
  if (alpha <= 0) return dst ? rgbaToHex(dst) : '';
  if (!dst) return rgbaToHex([src[0], src[1], src[2], Math.round(alpha * 255)]);
  let r = src[0];
  let g = src[1];
  let b = src[2];
  if (mode === 'add') {
    r = Math.min(255, dst[0] + src[0] * alpha);
    g = Math.min(255, dst[1] + src[1] * alpha);
    b = Math.min(255, dst[2] + src[2] * alpha);
    return rgbaToHex([r, g, b, Math.max(dst[3], Math.round(alpha * 255))]);
  }
  if (mode === 'multiply') {
    const mr = (dst[0] * src[0]) / 255;
    const mg = (dst[1] * src[1]) / 255;
    const mb = (dst[2] * src[2]) / 255;
    r = dst[0] * (1 - alpha) + mr * alpha;
    g = dst[1] * (1 - alpha) + mg * alpha;
    b = dst[2] * (1 - alpha) + mb * alpha;
    return rgbaToHex([r, g, b, Math.max(dst[3], Math.round(alpha * 255))]);
  }
  if (mode === 'screen') {
    const sr = 255 - ((255 - dst[0]) * (255 - src[0])) / 255;
    const sg = 255 - ((255 - dst[1]) * (255 - src[1])) / 255;
    const sb = 255 - ((255 - dst[2]) * (255 - src[2])) / 255;
    r = dst[0] * (1 - alpha) + sr * alpha;
    g = dst[1] * (1 - alpha) + sg * alpha;
    b = dst[2] * (1 - alpha) + sb * alpha;
    return rgbaToHex([r, g, b, Math.max(dst[3], Math.round(alpha * 255))]);
  }
  if (mode === 'overlay') {
    const ov = (a: number, s: number) => (a < 128 ? (2 * a * s) / 255 : 255 - (2 * (255 - a) * (255 - s)) / 255);
    r = dst[0] * (1 - alpha) + ov(dst[0], src[0]) * alpha;
    g = dst[1] * (1 - alpha) + ov(dst[1], src[1]) * alpha;
    b = dst[2] * (1 - alpha) + ov(dst[2], src[2]) * alpha;
    return rgbaToHex([r, g, b, Math.max(dst[3], Math.round(alpha * 255))]);
  }
  return rgbaToHex([
    dst[0] * (1 - alpha) + src[0] * alpha,
    dst[1] * (1 - alpha) + src[1] * alpha,
    dst[2] * (1 - alpha) + src[2] * alpha,
    Math.max(dst[3], Math.round(alpha * 255)),
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
  if (grad.type === 'conic') {
    const cx = grad.cx ?? width / 2;
    const cy = grad.cy ?? height / 2;
    const ang = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
    u = ((ang + Math.PI) / (Math.PI * 2)) % 1;
  } else if (grad.type === 'radial') {
    const cx = grad.cx ?? width / 2;
    const cy = grad.cy ?? height / 2;
    const r = grad.r ?? Math.max(width, height) / 2;
    u = r > 0 ? Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r : 0;
  } else if (grad.type === 'diamond') {
    const cx = grad.cx ?? width / 2;
    const cy = grad.cy ?? height / 2;
    const r = grad.r ?? Math.max(width, height) / 2;
    u = r > 0 ? (Math.abs(x + 0.5 - cx) + Math.abs(y + 0.5 - cy)) / r : 0;
  } else if (grad.type === 'spiral') {
    const cx = grad.cx ?? width / 2;
    const cy = grad.cy ?? height / 2;
    const r = grad.r ?? Math.max(width, height) / 2;
    const dist = r > 0 ? Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r : 0;
    const ang = (Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI) / (Math.PI * 2);
    const twists = grad.twists ?? 2;
    u = ((ang + dist * twists) % 1 + 1) % 1;
  } else if (grad.type === 'noise') {
    const n1 = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453;
    const n2 = Math.sin(x * 0.14) * Math.cos(y * 0.14) * 0.5 + 0.5;
    u = 0.65 * n2 + 0.35 * (n1 - Math.floor(n1));
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
    let threshold = 0;
    if (grad.dither === 'checker') {
      threshold = (x + y) % 2 === 0 ? -0.035 : 0.035;
    } else if (grad.dither === 'bayer2') {
      threshold = (BAYER_2X2[y & 1][x & 1] / 4 - 0.375) * 0.16;
    } else if (grad.dither === 'bayer8') {
      threshold = (BAYER_8X8[y & 7][x & 7] / 64 - 0.492) * 0.14;
    } else if (grad.dither === 'halftone') {
      const dx = (x % 4) - 1.5;
      const dy = (y % 4) - 1.5;
      threshold = (Math.hypot(dx, dy) / 2.2 - 0.5) * 0.18;
    } else {
      threshold = (BAYER_4X4[y & 3][x & 3] / 16 - 0.46875) * 0.14;
    }
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
  if (op.visible === false) return;
  if (typeof op.visibleFrom === 'number' && vars.t < op.visibleFrom) return;
  if (typeof op.visibleTo === 'number' && vars.t > op.visibleTo) return;

  const kind = String(op.op || op.type || '').toLowerCase();
  const blendMode = typeof op.blendMode === 'string' ? op.blendMode.toLowerCase() : 'normal';
  const opOpacity = op.opacity !== undefined ? Math.max(0, Math.min(1, evalNum(op.opacity, vars, 1))) : 1;

  const putPixel = (px: number, py: number, color: string) => {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (ix >= 0 && ix < width && iy >= 0 && iy < height && color) {
      if (blendMode === 'normal' && opOpacity >= 0.999 && !color.startsWith('rgba') && color.length <= 7) {
        pixels[iy * width + ix] = color;
      } else {
        const src = parseColorToRgba(color);
        if (!src) return;
        const dst = pixels[iy * width + ix] ? parseColorToRgba(pixels[iy * width + ix]) : null;
        pixels[iy * width + ix] = blendWithMode(dst, src, blendMode, opOpacity);
      }
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

  // Pixel v3: Mathematical Function Graph & Gradient Fill Plotter
  if (kind === 'graph' || kind === 'plot') {
    const expr = typeof op.expr === 'string' && op.expr.trim() ? op.expr : 'sin(x * PI * 2 + t * TAU) * 0.65';
    const xMin = evalNum(op.xmin, vars, -1);
    const xMax = evalNum(op.xmax, vars, 1);
    const yMin = evalNum(op.ymin, vars, -1.2);
    const yMax = evalNum(op.ymax, vars, 1.2);
    const thickness = Math.max(1, Math.min(8, Math.round(evalNum(op.thickness ?? op.strokeWidth, vars, 2))));
    const gradColors = Array.isArray(op.colors)
      ? op.colors.map((c) => resolveColorToken(c, paletteMap)).filter(Boolean)
      : ['#38bdf8', '#a855f7', '#ec4899'];
    const showGrid = op.grid !== false;
    const fillUnder = Boolean(op.fillUnder);

    if (showGrid) {
      const zeroX = Math.round(((0 - xMin) / (xMax - xMin || 1)) * (width - 1));
      const zeroY = Math.round((1 - (0 - yMin) / (yMax - yMin || 1)) * (height - 1));
      const axisCol = resolveColorToken(op.axisColor, paletteMap) || 'rgba(148,163,184,0.35)';
      const axisRgb = parseColorToRgba(axisCol) || [148, 163, 184, 90];
      for (let x = 0; x < width; x += 2) {
        if (zeroY >= 0 && zeroY < height) {
          const dst = pixels[zeroY * width + x] ? parseColorToRgba(pixels[zeroY * width + x]) : null;
          pixels[zeroY * width + x] = blendRgbaOver(dst, axisRgb);
        }
      }
      for (let y = 0; y < height; y += 2) {
        if (zeroX >= 0 && zeroX < width) {
          const dst = pixels[y * width + zeroX] ? parseColorToRgba(pixels[y * width + zeroX]) : null;
          pixels[y * width + zeroX] = blendRgbaOver(dst, axisRgb);
        }
      }
    }

    const gradDef: GradientDef = {
      type: 'linear',
      from: [0, 0],
      to: [Math.max(1, width - 1), 0],
      stops: gradColors.map((col, idx) => ({
        at: gradColors.length > 1 ? idx / (gradColors.length - 1) : 0,
        color: col,
      })),
    };

    const zeroPy = Math.max(0, Math.min(height - 1, Math.round((1 - (0 - yMin) / (yMax - yMin || 1)) * (height - 1))));
    let prevPy = -1;
    for (let px = 0; px < width; px += 1) {
      const u = px / Math.max(1, width - 1);
      const xVal = xMin + (xMax - xMin) * u;
      let yVal = 0;
      try {
        yVal = evaluateMathExpression(expr, { ...vars, x: xVal, u });
      } catch {
        yVal = 0;
      }
      const py = Math.round((1 - (yVal - yMin) / (yMax - yMin || 1)) * (height - 1));
      const strokeCol = sampleGradient(gradDef, px, 0, width, height) || '#38bdf8';
      const strokeRgb = parseColorToRgba(strokeCol) || [56, 189, 248, 255];

      if (fillUnder) {
        const yStart = Math.min(py, zeroPy);
        const yEnd = Math.max(py, zeroPy);
        for (let fy = Math.max(0, yStart); fy <= Math.min(height - 1, yEnd); fy += 1) {
          const frac = Math.abs(fy - py) / Math.max(1, Math.abs(zeroPy - py));
          const alpha = Math.round((1 - frac * 0.78) * 115);
          const dst = pixels[fy * width + px] ? parseColorToRgba(pixels[fy * width + px]) : null;
          pixels[fy * width + px] = blendRgbaOver(dst, [strokeRgb[0], strokeRgb[1], strokeRgb[2], alpha]);
        }
      }

      const spanLo = prevPy >= 0 ? Math.min(prevPy, py) : py;
      const spanHi = prevPy >= 0 ? Math.max(prevPy, py) : py;
      for (let sy = spanLo; sy <= spanHi; sy += 1) {
        for (let dy = -Math.floor(thickness / 2); dy <= Math.floor(thickness / 2); dy += 1) {
          putPixel(px, sy + dy, strokeCol);
        }
      }
      prevPy = py;
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
    return;
  }

  // Pixel v3: Dashed Collision Hitbox & Corner Brackets
  if (kind === 'hitbox') {
    const isHit =
      typeof op.hit === 'boolean'
        ? op.hit
        : op.hit !== undefined
        ? evalNum(op.hit, vars, 0) > 0.5
        : false;
    const strokeCol = isHit
      ? resolveColorToken(op.collideColor, paletteMap) || '#f43f5e'
      : color || '#22d3ee';
    const dashStep = Math.max(2, Math.round(evalNum(op.dash, vars, 2)));

    if (op.r !== undefined || op.shape === 'circle') {
      const cx = evalNum(op.cx ?? op.x, vars, width * 0.5);
      const cy = evalNum(op.cy ?? op.y, vars, height * 0.5);
      const r = Math.max(2, evalNum(op.r ?? op.radius, vars, 8));
      const steps = Math.max(16, Math.round(r * 6));
      for (let s = 0; s < steps; s += 1) {
        if (Math.floor(s / dashStep) % 2 === 1) continue;
        const ang = (s / steps) * Math.PI * 2;
        putPixel(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), strokeCol);
      }
      putPixel(cx, cy, strokeCol);
    } else {
      const x0 = Math.round(evalNum(op.x, vars, 8));
      const y0 = Math.round(evalNum(op.y, vars, 8));
      const w = Math.max(4, Math.round(evalNum(op.w ?? op.width, vars, 16)));
      const h = Math.max(4, Math.round(evalNum(op.h ?? op.height, vars, 16)));
      const x1 = x0 + w - 1;
      const y1 = y0 + h - 1;
      for (let x = x0; x <= x1; x += 1) {
        const isCorner = x - x0 < 3 || x1 - x < 3;
        if (isCorner || Math.floor((x - x0) / dashStep) % 2 === 0) {
          putPixel(x, y0, strokeCol);
          putPixel(x, y1, strokeCol);
        }
      }
      for (let y = y0; y <= y1; y += 1) {
        const isCorner = y - y0 < 3 || y1 - y < 3;
        if (isCorner || Math.floor((y - y0) / dashStep) % 2 === 0) {
          putPixel(x0, y, strokeCol);
          putPixel(x1, y, strokeCol);
        }
      }
    }
    return;
  }

  // Pixel v3+: Ring / Annulus
  if (kind === 'ring' || kind === 'annulus') {
    const cx = evalNum(op.cx ?? op.x, vars, width / 2);
    const cy = evalNum(op.cy ?? op.y, vars, height / 2);
    const rOuter = Math.max(2, evalNum(op.r ?? op.rOuter ?? op.radius, vars, 12));
    const rInner = Math.max(0, evalNum(op.innerR ?? op.rInner, vars, rOuter * 0.55));
    const col = color || '#38bdf8';
    for (let y = Math.floor(cy - rOuter - 1); y <= Math.ceil(cy + rOuter + 1); y += 1) {
      for (let x = Math.floor(cx - rOuter - 1); x <= Math.ceil(cx + rOuter + 1); x += 1) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= rOuter && d >= rInner) putPixel(x, y, col);
      }
    }
    return;
  }

  // Pixel v3+: Arc / Wedge
  if (kind === 'arc' || kind === 'wedge') {
    const cx = evalNum(op.cx ?? op.x, vars, width / 2);
    const cy = evalNum(op.cy ?? op.y, vars, height / 2);
    const r = Math.max(2, evalNum(op.r ?? op.radius, vars, 12));
    const rInner = kind === 'wedge' ? 0 : Math.max(0, evalNum(op.innerR, vars, r - 2));
    const a0 = ((evalNum(op.startAngle ?? op.a0, vars, 0) % 360) + 360) % 360;
    const a1 = ((evalNum(op.endAngle ?? op.a1, vars, 180) % 360) + 360) % 360;
    const col = color || '#facc15';
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y += 1) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r || d < rInner) continue;
        const deg = (((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) * 180) / Math.PI) + 360) % 360;
        const inArc = a0 <= a1 ? deg >= a0 && deg <= a1 : deg >= a0 || deg <= a1;
        if (inArc) putPixel(x, y, col);
      }
    }
    return;
  }

  // Pixel v3+: Regular polygon / Star / Diamond
  if (kind === 'star' || kind === 'diamond' || kind === 'rhombus' || kind === 'hexagon' || kind === 'regularpoly') {
    const cx = evalNum(op.cx ?? op.x, vars, width / 2);
    const cy = evalNum(op.cy ?? op.y, vars, height / 2);
    const rOuter = Math.max(2, evalNum(op.r ?? op.radius, vars, 12));
    const rotRad = (evalNum(op.rotation ?? op.angle, vars, -90) * Math.PI) / 180;
    const pointsCount = kind === 'diamond' || kind === 'rhombus' ? 4 : kind === 'hexagon' ? 6 : Math.max(3, Math.round(evalNum(op.points ?? op.sides, vars, 5)));
    const isStar = kind === 'star';
    const rInner = evalNum(op.innerR, vars, rOuter * 0.45);
    const verts: Array<[number, number]> = [];
    const total = isStar ? pointsCount * 2 : pointsCount;
    for (let v = 0; v < total; v += 1) {
      const ang = rotRad + (v / total) * Math.PI * 2;
      const rad = isStar && v % 2 === 1 ? rInner : rOuter;
      verts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    applyDrawOp(pixels, width, height, { op: 'polygon', points: verts, color: color || '#fbbf24' }, paletteMap, gradients, vars);
    return;
  }

  // Pixel v3+: Rounded Rect & Capsule / Pill
  if (kind === 'roundrect' || kind === 'capsule' || kind === 'pill') {
    const x0 = Math.round(evalNum(op.x, vars, 8));
    const y0 = Math.round(evalNum(op.y, vars, 8));
    const w = Math.max(2, Math.round(evalNum(op.w ?? op.width, vars, 20)));
    const h = Math.max(2, Math.round(evalNum(op.h ?? op.height, vars, 12)));
    const rr = kind === 'capsule' || kind === 'pill'
      ? Math.min(w, h) / 2
      : Math.min(w / 2, h / 2, Math.max(0, evalNum(op.rx ?? op.r ?? op.radius, vars, 3)));
    const col = color || '#38bdf8';
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        const dx = Math.max(0, x0 + rr - (x + 0.5), (x + 0.5) - (x0 + w - rr));
        const dy = Math.max(0, y0 + rr - (y + 0.5), (y + 0.5) - (y0 + h - rr));
        if (Math.hypot(dx, dy) <= rr + 0.15) putPixel(x, y, col);
      }
    }
    return;
  }

  // Pixel v3+: Cubic / Quadratic Bezier curve
  if (kind === 'bezier') {
    const x0 = evalNum(op.x0 ?? op.x1, vars, 4);
    const y0 = evalNum(op.y0 ?? op.y1, vars, height / 2);
    const cx1 = evalNum(op.cx1 ?? op.cx, vars, width * 0.33);
    const cy1 = evalNum(op.cy1 ?? op.cy, vars, 4);
    const cx2 = evalNum(op.cx2 ?? op.cx, vars, width * 0.66);
    const cy2 = evalNum(op.cy2 ?? op.cy, vars, height - 4);
    const x1 = evalNum(op.x1_end ?? op.x2, vars, width - 4);
    const y1 = evalNum(op.y1_end ?? op.y2, vars, height / 2);
    const steps = Math.max(24, Math.round(evalNum(op.steps, vars, 64)));
    const thick = Math.max(1, Math.round(evalNum(op.thickness, vars, 1)));
    const col = color || '#f472b6';
    for (let s = 0; s <= steps; s += 1) {
      const u = s / steps;
      const iu = 1 - u;
      const px = iu * iu * iu * x0 + 3 * iu * iu * u * cx1 + 3 * iu * u * u * cx2 + u * u * u * x1;
      const py = iu * iu * iu * y0 + 3 * iu * iu * u * cy1 + 3 * iu * u * u * cy2 + u * u * u * y1;
      for (let dy = -Math.floor(thick / 2); dy <= Math.floor(thick / 2); dy += 1) {
        for (let dx = -Math.floor(thick / 2); dx <= Math.floor(thick / 2); dx += 1) {
          putPixel(px + dx, py + dy, col);
        }
      }
    }
    return;
  }

  // Pixel v3+: Checkerboard, Wiregrid, Scanlines
  if (kind === 'checker' || kind === 'checkerboard') {
    const size = Math.max(1, Math.round(evalNum(op.size ?? op.tile, vars, 4)));
    const c1 = resolveColorToken(op.color1 ?? op.color, paletteMap) || '#1e293b';
    const c2 = resolveColorToken(op.color2, paletteMap) || '#0f172a';
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        putPixel(x, y, ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) ? c1 : c2);
      }
    }
    return;
  }

  if (kind === 'grid' || kind === 'wiregrid') {
    const step = Math.max(2, Math.round(evalNum(op.step ?? op.size, vars, 8)));
    const col = color || 'rgba(56, 189, 248, 0.35)';
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (x % step === 0 || y % step === 0) putPixel(x, y, col);
      }
    }
    return;
  }

  if (kind === 'scanlines') {
    const col = color || 'rgba(2, 6, 23, 0.35)';
    const gap = Math.max(2, Math.round(evalNum(op.gap, vars, 2)));
    for (let y = 1; y < height; y += gap) {
      for (let x = 0; x < width; x += 1) putPixel(x, y, col);
    }
    return;
  }

  // Pixel v3+: Procedural Demoscene Plasma / Ocean Water / Procedural Fire
  if (kind === 'plasma') {
    const cols = Array.isArray(op.colors)
      ? op.colors.map((c) => resolveColorToken(c, paletteMap)).filter(Boolean)
      : ['#090d16', '#3b0764', '#db2777', '#38bdf8', '#fef08a'];
    const ph = vars.t * Math.PI * 2;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const v = (
          Math.sin(x * 0.14 + ph) +
          Math.sin(y * 0.14 - ph) +
          Math.sin((x + y) * 0.09 + ph) +
          Math.sin(Math.hypot(x - width / 2, y - height / 2) * 0.16 - ph)
        ) / 4;
        const u = Math.max(0, Math.min(0.999, (v + 1) * 0.5));
        putPixel(x, y, cols[Math.floor(u * cols.length)]);
      }
    }
    return;
  }

  if (kind === 'water' || kind === 'waves') {
    const yStart = Math.max(0, Math.round(evalNum(op.y, vars, height * 0.65)));
    const amp = evalNum(op.amp, vars, 2.5);
    const waterCol = resolveColorToken(op.color, paletteMap) || '#0284c7';
    const foamCol = resolveColorToken(op.foamColor, paletteMap) || '#bae6fd';
    const baseRgb = parseColorToRgba(waterCol) || [2, 132, 199, 255];
    for (let x = 0; x < width; x += 1) {
      const crest = yStart + Math.sin(x * 0.18 + vars.t * Math.PI * 2) * amp;
      const iyCrest = Math.round(crest);
      putPixel(x, iyCrest, foamCol);
      for (let y = iyCrest + 1; y < height; y += 1) {
        const depthFade = Math.max(0.32, 1 - (y - iyCrest) / Math.max(1, height - iyCrest));
        const glint = Math.sin(x * 0.3 + y * 0.5 - vars.t * Math.PI * 4) > 0.88 ? 1.25 : depthFade;
        putPixel(x, y, shadeRgba(baseRgb, glint));
      }
    }
    return;
  }

  if (kind === 'fire' || kind === 'flame') {
    const cx = evalNum(op.cx ?? op.x, vars, width * 0.5);
    const cy = evalNum(op.cy ?? op.y, vars, height * 0.8);
    const r = Math.max(4, evalNum(op.r ?? op.w, vars, 16));
    const h = Math.max(8, evalNum(op.h ?? op.height, vars, r * 2));
    const cols = ['#7c2d12', '#dc2626', '#f97316', '#facc15', '#fef9c3'];
    for (let y = Math.floor(cy - h); y <= Math.ceil(cy); y += 1) {
      const up = (cy - y) / h;
      const sway = Math.sin(up * 5 - vars.t * Math.PI * 4) * (r * 0.25 * up);
      const halfW = r * (1 - up * 0.85) * (0.85 + 0.15 * Math.sin(y * 0.5 + vars.t * 12));
      for (let x = Math.floor(cx + sway - halfW); x <= Math.ceil(cx + sway + halfW); x += 1) {
        const dist = Math.abs(x - (cx + sway)) / Math.max(1, halfW);
        const heat = (1 - dist * 0.65) * (1 - up * 0.55);
        if (heat > 0.2) {
          const ci = Math.min(cols.length - 1, Math.floor(heat * cols.length));
          putPixel(x, y, cols[ci]);
        }
      }
    }
    return;
  }

  // Pixel v3+: Weather (Rain, Snow, Lightning Bolt)
  if (kind === 'rain' || kind === 'snow') {
    const count = Math.min(500, Math.max(4, Math.round(evalNum(op.count, vars, 45))));
    const col = color || (kind === 'rain' ? '#7dd3fc' : '#f8fafc');
    const seed = evalNum(op.seed, vars, 77);
    for (let n = 0; n < count; n += 1) {
      const hx = Math.sin((n + 1) * 14.31 + seed) * 43758.5453;
      const hy = Math.sin((n + 1) * 91.77 + seed) * 24634.6345;
      const baseX = (hx - Math.floor(hx)) * width;
      const baseY = (hy - Math.floor(hy)) * height;
      const speed = kind === 'rain' ? height * 1.5 : height * 0.45;
      const px = Math.floor((baseX + (kind === 'rain' ? vars.t * 8 : Math.sin(vars.t * Math.PI * 2 + n) * 3) + width) % width);
      const py = Math.floor((baseY + vars.t * speed) % height);
      putPixel(px, py, col);
      if (kind === 'rain') {
        putPixel(px, (py + 1) % height, col);
        putPixel(px, (py + 2) % height, col);
      }
    }
    return;
  }

  if (kind === 'lightning' || kind === 'bolt') {
    let lx = evalNum(op.x1 ?? op.x, vars, width * 0.5);
    const ly0 = evalNum(op.y1 ?? op.y, vars, 0);
    const ly1 = evalNum(op.y2, vars, height * 0.85);
    const seed = evalNum(op.seed, vars, Math.floor(vars.t * 10) + 1);
    const col = color || '#fef08a';
    const segs = Math.max(4, Math.round(evalNum(op.segments, vars, 8)));
    for (let s = 0; s < segs; s += 1) {
      const sy0 = ly0 + ((ly1 - ly0) * s) / segs;
      const sy1 = ly0 + ((ly1 - ly0) * (s + 1)) / segs;
      const jitter = Math.sin((s + 1) * 37.2 + seed * 19.1) * (width * 0.12);
      const nx = lx + jitter;
      applyDrawOp(pixels, width, height, { op: 'line', x1: lx, y1: sy0, x2: nx, y2: sy1, color: col }, paletteMap, gradients, vars);
      lx = nx;
    }
    return;
  }

  // Pixel v3+: Raycasted / Shaded 3D Sphere, Pyramid/Prism, and Torus
  if (kind === 'sphere3d') {
    const cx = evalNum(op.cx ?? op.x, vars, width * 0.5);
    const cy = evalNum(op.cy ?? op.y, vars, height * 0.5);
    const r = Math.max(3, evalNum(op.r ?? op.radius, vars, 14));
    const baseRgb = parseColorToRgba(color || '#38bdf8') || [56, 189, 248, 255];
    const lx = -0.55;
    const ly = -0.62;
    const lz = 0.56;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        const nx = (x + 0.5 - cx) / r;
        const ny = (y + 0.5 - cy) / r;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - r2));
        const diff = Math.max(0.18, nx * lx + ny * ly + nz * lz);
        const spec = Math.pow(Math.max(0, nx * lx + ny * ly + nz * lz), 14) * 1.15;
        const rr = Math.min(255, baseRgb[0] * diff + 255 * spec);
        const gg = Math.min(255, baseRgb[1] * diff + 255 * spec);
        const bb = Math.min(255, baseRgb[2] * diff + 255 * spec);
        putPixel(x, y, rgbaToHex([rr, gg, bb, 255]));
      }
    }
    return;
  }

  if (kind === 'pyramid3d' || kind === 'prism3d') {
    const cx = evalNum(op.cx ?? op.x, vars, width * 0.5);
    const baseY = evalNum(op.y, vars, height * 0.72);
    const w = Math.max(6, evalNum(op.w ?? op.width, vars, 24));
    const h = Math.max(6, evalNum(op.h ?? op.height, vars, 22));
    const baseRgb = parseColorToRgba(color || '#fbbf24') || [251, 191, 36, 255];
    const apex: [number, number] = [cx, baseY - h];
    const left: [number, number] = [cx - w * 0.5, baseY];
    const front: [number, number] = [cx + w * 0.08, baseY + h * 0.16];
    const right: [number, number] = [cx + w * 0.55, baseY - h * 0.08];
    applyDrawOp(pixels, width, height, { op: 'polygon', points: [apex, left, front], color: shadeRgba(baseRgb, 1.12) }, paletteMap, gradients, vars);
    applyDrawOp(pixels, width, height, { op: 'polygon', points: [apex, front, right], color: shadeRgba(baseRgb, 0.72) }, paletteMap, gradients, vars);
    return;
  }

  if (kind === 'torus3d') {
    const cx = evalNum(op.cx ?? op.x, vars, width * 0.5);
    const cy = evalNum(op.cy ?? op.y, vars, height * 0.5);
    const rMajor = Math.max(4, evalNum(op.r ?? op.radius, vars, 14));
    const rTube = Math.max(2, evalNum(op.tube, vars, rMajor * 0.36));
    const baseRgb = parseColorToRgba(color || '#a855f7') || [168, 85, 247, 255];
    const rMax = rMajor + rTube;
    for (let y = Math.floor(cy - rMax); y <= Math.ceil(cy + rMax); y += 1) {
      for (let x = Math.floor(cx - rMax); x <= Math.ceil(cx + rMax); x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dRing = Math.hypot(dx, dy) - rMajor;
        if (Math.abs(dRing) <= rTube) {
          const nz = Math.sqrt(Math.max(0, 1 - (dRing / rTube) ** 2));
          const shade = 0.45 + 0.65 * nz - (dy / rMax) * 0.25;
          putPixel(x, y, shadeRgba(baseRgb, Math.max(0.25, shade)));
        }
      }
    }
    return;
  }

  // Pixel v3+: Marker Trick Specular Highlight arc/pip
  if (kind === 'specular' || kind === 'highlight') {
    const cx = evalNum(op.cx ?? op.x, vars, width * 0.4);
    const cy = evalNum(op.cy ?? op.y, vars, height * 0.35);
    const r = Math.max(1, evalNum(op.r ?? op.radius, vars, 3));
    const col = color || '#ffffff';
    applyDrawOp(pixels, width, height, { op: 'circle', cx, cy, r, color: col, opacity: op.opacity ?? 0.9 }, paletteMap, gradients, vars);
    return;
  }

  // Pixel v3+: Bitmap 5x7 Pixel Font Text
  if (kind === 'text' || kind === 'bitmaptext') {
    const txt = String(op.text || '').toUpperCase();
    const x0 = Math.round(evalNum(op.x, vars, 4));
    const y0 = Math.round(evalNum(op.y, vars, 4));
    const scale = Math.max(1, Math.min(6, Math.round(evalNum(op.scale, vars, 1))));
    const col = color || '#f8fafc';
    let cursorX = x0;
    for (const ch of txt) {
      const glyph = BITMAP_FONT_5X7[ch] || BITMAP_FONT_5X7[' '];
      for (let gy = 0; gy < 7; gy += 1) {
        const row = glyph[gy] || '';
        for (let gx = 0; gx < 5; gx += 1) {
          if (row[gx] === '1') {
            for (let sy = 0; sy < scale; sy += 1) {
              for (let sx = 0; sx < scale; sx += 1) {
                putPixel(cursorX + gx * scale + sx, y0 + gy * scale + sy, col);
              }
            }
          }
        }
      }
      cursorX += 6 * scale;
    }
    return;
  }

  // Pixel v3+: Stamp Sprite / Rows with scale & flipX
  if ((kind === 'sprite' || kind === 'tile') && Array.isArray(op.rows)) {
    const x0 = Math.round(evalNum(op.x, vars, 0));
    const y0 = Math.round(evalNum(op.y, vars, 0));
    const scale = Math.max(1, Math.min(8, Math.round(evalNum(op.scale, vars, 1))));
    const flipX = Boolean(op.flipX);
    const rows = op.rows.map((r) => String(r));
    for (let sy = 0; sy < rows.length; sy += 1) {
      const row = rows[sy];
      for (let sx = 0; sx < row.length; sx += 1) {
        const ch = row[flipX ? row.length - 1 - sx : sx];
        const mapped = paletteMap[ch];
        if (!mapped || ch === '.' || ch === ' ') continue;
        for (let py = 0; py < scale; py += 1) {
          for (let px = 0; px < scale; px += 1) {
            putPixel(x0 + sx * scale + px, y0 + sy * scale + py, mapped);
          }
        }
      }
    }
    return;
  }

  // Pixel v3+: Horizontal/Vertical Mirror & Auto Pixel Outline
  if (kind === 'mirror' || kind === 'symmetry') {
    const axis = String(op.axis || 'horizontal').toLowerCase();
    if (axis === 'vertical' || axis === 'quad') {
      for (let y = 0; y < Math.floor(height / 2); y += 1) {
        for (let x = 0; x < width; x += 1) {
          const c = pixels[y * width + x];
          if (c) pixels[(height - 1 - y) * width + x] = c;
        }
      }
    }
    if (axis === 'horizontal' || axis === 'quad' || axis === 'x') {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < Math.floor(width / 2); x += 1) {
          const c = pixels[y * width + x];
          if (c) pixels[y * width + (width - 1 - x)] = c;
        }
      }
    }
    return;
  }

  if (kind === 'outline') {
    const outCol = color || '#090d16';
    const snap = [...pixels];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (snap[y * width + x]) continue;
        const hasNeighbor =
          (x > 0 && snap[y * width + x - 1]) ||
          (x + 1 < width && snap[y * width + x + 1]) ||
          (y > 0 && snap[(y - 1) * width + x]) ||
          (y + 1 < height && snap[(y + 1) * width + x]);
        if (hasNeighbor) pixels[y * width + x] = outCol;
      }
    }
    return;
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
    } else if (type === 'glow' || type === 'bloom') {
      const glowRgb = sh.color ? parseColorToRgba(sh.color) : null;
      const snap = [...out];
      const radius = type === 'bloom' ? 2 : 1;
      for (let y = radius; y < height - radius; y += 1) {
        for (let x = radius; x < width - radius; x += 1) {
          const idx = y * width + x;
          if (snap[idx] && type === 'glow') continue;
          const n =
            snap[(y - 1) * width + x] ||
            snap[(y + 1) * width + x] ||
            snap[y * width + x - 1] ||
            snap[y * width + x + 1] ||
            (type === 'bloom' ? snap[(y - 2) * width + x] || snap[(y + 2) * width + x] : '');
          if (!n) continue;
          const nRgb = glowRgb || parseColorToRgba(n);
          if (nRgb) {
            const dst = snap[idx] ? parseColorToRgba(snap[idx]) : null;
            out[idx] = blendWithMode(dst, [nRgb[0], nRgb[1], nRgb[2], Math.round((type === 'bloom' ? 120 : 85) * intensity)], type === 'bloom' ? 'screen' : 'normal', 1);
          }
        }
      }
    } else if (type === 'sepia') {
      for (let idx = 0; idx < out.length; idx += 1) {
        const c = out[idx];
        if (!c) continue;
        const rgb = parseColorToRgba(c);
        if (!rgb) continue;
        const sr = Math.min(255, rgb[0] * 0.393 + rgb[1] * 0.769 + rgb[2] * 0.189);
        const sg = Math.min(255, rgb[0] * 0.349 + rgb[1] * 0.686 + rgb[2] * 0.168);
        const sb = Math.min(255, rgb[0] * 0.272 + rgb[1] * 0.534 + rgb[2] * 0.131);
        out[idx] = rgbaToHex([
          rgb[0] + (sr - rgb[0]) * intensity,
          rgb[1] + (sg - rgb[1]) * intensity,
          rgb[2] + (sb - rgb[2]) * intensity,
          rgb[3],
        ]);
      }
    } else if (type === 'invert') {
      for (let idx = 0; idx < out.length; idx += 1) {
        const c = out[idx];
        if (!c) continue;
        const rgb = parseColorToRgba(c);
        if (!rgb) continue;
        out[idx] = rgbaToHex([
          rgb[0] + (255 - rgb[0] - rgb[0]) * intensity,
          rgb[1] + (255 - rgb[1] - rgb[1]) * intensity,
          rgb[2] + (255 - rgb[2] - rgb[2]) * intensity,
          rgb[3],
        ]);
      }
    } else if (type === 'tint') {
      const tintRgb = parseColorToRgba(sh.color || '#38bdf8') || [56, 189, 248, 255];
      for (let idx = 0; idx < out.length; idx += 1) {
        const c = out[idx];
        if (!c) continue;
        const rgb = parseColorToRgba(c);
        if (!rgb) continue;
        out[idx] = rgbaToHex([
          rgb[0] * (1 - intensity) + ((rgb[0] * tintRgb[0]) / 255) * intensity,
          rgb[1] * (1 - intensity) + ((rgb[1] * tintRgb[1]) / 255) * intensity,
          rgb[2] * (1 - intensity) + ((rgb[2] * tintRgb[2]) / 255) * intensity,
          rgb[3],
        ]);
      }
    } else if (type === 'duotone') {
      const dark = parseColorToRgba(sh.color || '#090d16') || [9, 13, 22, 255];
      const light = parseColorToRgba(sh.secondaryColor || '#38bdf8') || [56, 189, 248, 255];
      for (let idx = 0; idx < out.length; idx += 1) {
        const c = out[idx];
        if (!c) continue;
        const rgb = parseColorToRgba(c);
        if (!rgb) continue;
        const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        out[idx] = rgbaToHex([
          dark[0] + (light[0] - dark[0]) * lum,
          dark[1] + (light[1] - dark[1]) * lum,
          dark[2] + (light[2] - dark[2]) * lum,
          rgb[3],
        ]);
      }
    } else if (type === 'dither' || type === 'halftone') {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          const c = out[idx];
          if (!c) continue;
          const rgb = parseColorToRgba(c);
          if (!rgb) continue;
          const bias = type === 'halftone'
            ? ((Math.hypot((x % 4) - 1.5, (y % 4) - 1.5) / 2.2) - 0.5) * 45 * intensity
            : (BAYER_4X4[y & 3][x & 3] / 16 - 0.46875) * 42 * intensity;
          out[idx] = rgbaToHex([
            Math.max(0, Math.min(255, Math.round((rgb[0] + bias) / 32) * 32)),
            Math.max(0, Math.min(255, Math.round((rgb[1] + bias) / 32) * 32)),
            Math.max(0, Math.min(255, Math.round((rgb[2] + bias) / 32) * 32)),
            rgb[3],
          ]);
        }
      }
    } else if (type === 'pixelate') {
      const blk = Math.max(2, Math.round(sh.blockSize ?? 2 + intensity * 4));
      const snap = [...out];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const sx = Math.floor(x / blk) * blk;
          const sy = Math.floor(y / blk) * blk;
          out[y * width + x] = snap[sy * width + sx];
        }
      }
    } else if (type === 'glitch') {
      const snap = [...out];
      const maxShift = Math.max(1, Math.round(intensity * 6));
      for (let y = 0; y < height; y += 1) {
        const band = Math.floor(y / 3);
        const shift = Math.sin(band * 17.3) > 0.5 ? Math.round(Math.cos(band * 41.7) * maxShift) : 0;
        if (shift === 0) continue;
        for (let x = 0; x < width; x += 1) {
          const sx = (x - shift + width) % width;
          out[y * width + x] = snap[y * width + sx];
        }
      }
    } else if (type === 'outline') {
      const outCol = sh.color || '#020617';
      const snap = [...out];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const idx = y * width + x;
          if (snap[idx]) continue;
          if (snap[(y - 1) * width + x] || snap[(y + 1) * width + x] || snap[y * width + x - 1] || snap[y * width + x + 1]) {
            out[idx] = outCol;
          }
        }
      }
    } else if (type === 'emboss' || type === 'edge') {
      const snap = [...out];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const c1 = snap[(y - 1) * width + x - 1];
          const c2 = snap[(y + 1) * width + x + 1];
          const rgb1 = c1 ? parseColorToRgba(c1) : [0, 0, 0, 255];
          const rgb2 = c2 ? parseColorToRgba(c2) : [0, 0, 0, 255];
          if (!rgb1 || !rgb2) continue;
          const base = type === 'emboss' ? 128 : 0;
          const dr = type === 'edge' ? Math.abs(rgb1[0] - rgb2[0]) * 2 : (rgb1[0] - rgb2[0]) * intensity + base;
          const dg = type === 'edge' ? Math.abs(rgb1[1] - rgb2[1]) * 2 : (rgb1[1] - rgb2[1]) * intensity + base;
          const db = type === 'edge' ? Math.abs(rgb1[2] - rgb2[2]) * 2 : (rgb1[2] - rgb2[2]) * intensity + base;
          if (snap[y * width + x]) {
            out[y * width + x] = rgbaToHex([Math.max(0, Math.min(255, dr)), Math.max(0, Math.min(255, dg)), Math.max(0, Math.min(255, db)), 255]);
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
        ? parsed.shaders.map((s) => (typeof s === 'string' ? ({ type: s as PixelShaderType } as PixelShaderSpec) : (s as PixelShaderSpec)))
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

      if (typeof rawPalette === 'string') {
        const resolved = resolveNamedPalette(rawPalette);
        if (resolved) {
          resolved.forEach((c, idx) => {
            paletteMap[String(idx)] = c;
            paletteMap[idx.toString(36)] = c;
            paletteList.push(c);
          });
        }
      } else if (rawPalette && typeof rawPalette === 'object' && !Array.isArray(rawPalette)) {
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

        const physBodies: Array<{
          opIndex: number;
          shape: 'ball' | 'box';
          x: number;
          y: number;
          vx: number;
          vy: number;
          gravity: number;
          restitution: number;
          r: number;
          w: number;
          h: number;
          hitDecay: number;
          bounds: [number, number, number, number];
        }> = [];
        const physBodyByOp = new Map<number, (typeof physBodies)[number]>();

        drawOps.forEach((op, opIdx) => {
          if (!op || typeof op !== 'object') return;
          const k = String(op.op || op.type || '').toLowerCase();
          if (k !== 'physicsball' && k !== 'physicsbox') return;
          const shape: 'ball' | 'box' = k === 'physicsball' ? 'ball' : 'box';
          const r = Math.max(2, Number(op.r ?? op.radius ?? 5));
          const w = Math.max(4, Number(op.w ?? op.width ?? 10));
          const h = Math.max(4, Number(op.h ?? op.height ?? 10));
          const bounds: [number, number, number, number] = Array.isArray(op.bounds) && op.bounds.length >= 4
            ? [Number(op.bounds[0]), Number(op.bounds[1]), Number(op.bounds[2]), Number(op.bounds[3])]
            : [2, 2, finalWidth - 2, finalHeight - 4];
          const body = {
            opIndex: opIdx,
            shape,
            x: Number(op.x0 ?? op.x ?? finalWidth * 0.5),
            y: Number(op.y0 ?? op.y ?? finalHeight * 0.3),
            vx: Number(op.vx ?? 18),
            vy: Number(op.vy ?? -10),
            gravity: Number(op.gravity ?? 95),
            restitution: Math.max(0.1, Math.min(1.02, Number(op.restitution ?? 0.85))),
            r,
            w,
            h,
            hitDecay: 0,
            bounds,
          };
          physBodies.push(body);
          physBodyByOp.set(opIdx, body);
        });

        const physDt = 1 / Math.max(1, fps);

        for (let fIdx = 0; fIdx < frameCount; fIdx += 1) {
          if (fIdx > 0 && physBodies.length > 0) {
            for (const b of physBodies) {
              if (b.hitDecay > 0) b.hitDecay -= 1;
              b.vy += b.gravity * physDt;
              b.x += b.vx * physDt;
              b.y += b.vy * physDt;
              const hw = b.shape === 'ball' ? b.r : b.w * 0.5;
              const hh = b.shape === 'ball' ? b.r : b.h * 0.5;
              const [minX, minY, maxX, maxY] = b.bounds;
              if (b.y + hh > maxY) {
                b.y = maxY - hh;
                b.vy = -Math.abs(b.vy) * b.restitution;
                b.hitDecay = 2;
              } else if (b.y - hh < minY) {
                b.y = minY + hh;
                b.vy = Math.abs(b.vy) * b.restitution;
                b.hitDecay = 2;
              }
              if (b.x + hw > maxX) {
                b.x = maxX - hw;
                b.vx = -Math.abs(b.vx) * b.restitution;
                b.hitDecay = 2;
              } else if (b.x - hw < minX) {
                b.x = minX + hw;
                b.vx = Math.abs(b.vx) * b.restitution;
                b.hitDecay = 2;
              }
            }
            for (let a = 0; a < physBodies.length; a += 1) {
              for (let bIdx = a + 1; bIdx < physBodies.length; bIdx += 1) {
                const ba = physBodies[a];
                const bb = physBodies[bIdx];
                const haw = ba.shape === 'ball' ? ba.r : ba.w * 0.5;
                const hah = ba.shape === 'ball' ? ba.r : ba.h * 0.5;
                const hbw = bb.shape === 'ball' ? bb.r : bb.w * 0.5;
                const hbh = bb.shape === 'ball' ? bb.r : bb.h * 0.5;
                const dx = bb.x - ba.x;
                const dy = bb.y - ba.y;
                const hit =
                  ba.shape === 'ball' && bb.shape === 'ball'
                    ? Math.hypot(dx, dy) <= ba.r + bb.r
                    : Math.abs(dx) <= haw + hbw && Math.abs(dy) <= hah + hbh;
                if (hit) {
                  ba.hitDecay = 3;
                  bb.hitDecay = 3;
                  const dist = Math.hypot(dx, dy) || 1;
                  const nx = dx / dist;
                  const ny = dy / dist;
                  const rvx = bb.vx - ba.vx;
                  const rvy = bb.vy - ba.vy;
                  const velAlong = rvx * nx + rvy * ny;
                  if (velAlong < 0) {
                    const e = Math.min(ba.restitution, bb.restitution);
                    const imp = -(1 + e) * velAlong * 0.5;
                    ba.vx -= imp * nx;
                    ba.vy -= imp * ny;
                    bb.vx += imp * nx;
                    bb.vy += imp * ny;
                  }
                }
              }
            }
          }

          const t = loop
            ? fIdx / frameCount
            : frameCount > 1
            ? fIdx / (frameCount - 1)
            : 0;
          const vars: Record<string, number> = {
            i: fIdx,
            n: frameCount,
            t,
            u: t,
            fps,
            sec: fIdx / Math.max(1, fps),
            w: finalWidth,
            h: finalHeight,
            cx: finalWidth / 2,
            cy: finalHeight / 2,
            PI: Math.PI,
            TAU: Math.PI * 2,
            E: Math.E,
          };
          let pixelArr = new Array<string>(finalWidth * finalHeight).fill('');
          for (const op of backdropOps) {
            if (op && typeof op === 'object') {
              applyDrawOp(pixelArr, finalWidth, finalHeight, op, paletteMap, gradients, vars);
            }
          }
          drawOps.forEach((op, opIdx) => {
            if (!op || typeof op !== 'object') return;
            const body = physBodyByOp.get(opIdx);
            if (body) {
              const col = resolveColorToken(op.color ?? op.fill, paletteMap) || (body.shape === 'ball' ? '#38bdf8' : '#facc15');
              if (op.shadow !== false) {
                applyDrawOp(
                  pixelArr,
                  finalWidth,
                  finalHeight,
                  { op: 'dropshadow', cx: body.x, cy: body.bounds[3], rx: body.shape === 'ball' ? body.r * 1.1 : body.w * 0.6, ry: 2, color: '#020617', opacity: 0.45 },
                  paletteMap,
                  gradients,
                  vars
                );
              }
              if (body.shape === 'ball') {
                applyDrawOp(pixelArr, finalWidth, finalHeight, { op: 'circle', cx: body.x, cy: body.y, r: body.r, color: col }, paletteMap, gradients, vars);
                applyDrawOp(pixelArr, finalWidth, finalHeight, { op: 'circle', cx: body.x - body.r * 0.35, cy: body.y - body.r * 0.35, r: Math.max(1, body.r * 0.25), color: '#ffffff' }, paletteMap, gradients, vars);
              } else {
                applyDrawOp(pixelArr, finalWidth, finalHeight, { op: 'box3d', x: Math.round(body.x - body.w * 0.5), y: Math.round(body.y - body.h * 0.5), w: body.w, h: body.h, z: Math.max(2, Math.round(body.w * 0.35)), color: col }, paletteMap, gradients, vars);
              }
              if (op.hitbox !== false) {
                applyDrawOp(
                  pixelArr,
                  finalWidth,
                  finalHeight,
                  body.shape === 'ball'
                    ? { op: 'hitbox', shape: 'circle', cx: body.x, cy: body.y, r: body.r + 1, hit: body.hitDecay > 0, color: op.hitboxColor || '#22d3ee', collideColor: '#f43f5e' }
                    : { op: 'hitbox', x: Math.round(body.x - body.w * 0.5) - 1, y: Math.round(body.y - body.h * 0.5) - 1, w: body.w + 2, h: body.h + 2, hit: body.hitDecay > 0, color: op.hitboxColor || '#22d3ee', collideColor: '#f43f5e' },
                  paletteMap,
                  gradients,
                  vars
                );
              }
              return;
            }
            applyDrawOp(pixelArr, finalWidth, finalHeight, op, paletteMap, gradients, vars);
          });
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
