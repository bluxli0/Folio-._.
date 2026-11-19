import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { PixelArtFrame, PixelArtSpec } from '../types/pixelArt';

/**
 * Parses user-provided or AI-generated pixel art code into a normalized PixelArtSpec.
 * Supports:
 * 1. Palette map format (e.g. { palette: { ".": "transparent", "#": "#000" }, frames: [["....", ".##."]] })
 * 2. Palette array format with indexed rows or 1D arrays
 * 3. Direct color hex arrays
 */
export function parsePixelArtCode(
  rawCode: string
): { spec?: PixelArtSpec; error?: string } {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { error: 'Pixel art code is empty.' };
  }

  // Strip optional markdown fencing if someone pasted ```pixelart ... ``` directly
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
      const fps =
        typeof parsed.fps === 'number' && parsed.fps >= 1 && parsed.fps <= 30
          ? parsed.fps
          : 8;
      const loop = parsed.loop !== false;

      // Detect palette map vs palette array
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

      // Frames extraction
      const rawFrames = parsed.frames || (parsed.pixels ? [parsed.pixels] : null);
      if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
        return { error: 'Missing "frames" or "pixels" grid in pixel art JSON.' };
      }

      let detectedWidth = typeof parsed.width === 'number' ? parsed.width : 0;
      let detectedHeight = typeof parsed.height === 'number' ? parsed.height : 0;

      const normalizedFrames: PixelArtFrame[] = [];

      for (let fIdx = 0; fIdx < rawFrames.length; fIdx += 1) {
        const f = rawFrames[fIdx];
        let rowStrings: string[] = [];
        let hold = 1;

        if (Array.isArray(f)) {
          rowStrings = f.map((r) => String(r));
        } else if (f && typeof f === 'object' && 'pixels' in f) {
          const fObj = f as { pixels?: unknown; hold?: number };
          hold = typeof fObj.hold === 'number' && fObj.hold >= 1 ? fObj.hold : 1;
          if (Array.isArray(fObj.pixels)) {
            rowStrings = fObj.pixels.map((r) => String(r));
          }
        } else if (typeof f === 'string') {
          rowStrings = f.split('\n').filter((l) => l.trim().length > 0);
        }

        if (rowStrings.length === 0) continue;

        const h = rowStrings.length;
        const w = rowStrings[0].length;
        if (!detectedWidth) detectedWidth = w;
        if (!detectedHeight) detectedHeight = h;

        const pixelArr: string[] = [];

        for (let y = 0; y < detectedHeight; y += 1) {
          const row = rowStrings[y] || '';
          for (let x = 0; x < detectedWidth; x += 1) {
            const char = row[x] || '.';
            const mappedColor = paletteMap[char];
            if (mappedColor !== undefined) {
              pixelArr.push(mappedColor);
            } else if (char === '.' || char === ' ' || char === '_') {
              pixelArr.push('');
            } else if (/^#[0-9a-f]{3,8}$/i.test(char)) {
              pixelArr.push(char);
            } else {
              pixelArr.push('');
            }
          }
        }

        normalizedFrames.push({
          id: `f-${fIdx}-${Date.now()}`,
          pixels: pixelArr,
          hold,
        });
      }

      if (normalizedFrames.length === 0) {
        return { error: 'Could not extract valid frame pixels.' };
      }

      const finalWidth = Math.max(8, Math.min(128, detectedWidth || 32));
      const finalHeight = Math.max(8, Math.min(128, detectedHeight || 32));

      return {
        spec: {
          title,
          width: finalWidth,
          height: finalHeight,
          fps,
          loop,
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

/**
 * Serializes a PixelArtSpec into a readable, concise JSON string with palette dictionary and row strings.
 */
export function serializePixelArtSpec(spec: PixelArtSpec): string {
  // Collect all unique colors
  const colorSet = new Set<string>();
  for (const f of spec.frames) {
    for (const c of f.pixels) {
      if (c && c.trim() && c.toLowerCase() !== 'transparent') {
        colorSet.add(c.toLowerCase());
      }
    }
  }

  // Assign a distinct character to each color
  const CHAR_BANK = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#$@%&*+=~';
  const paletteObj: Record<string, string> = { '.': 'transparent' };
  const colorToChar: Record<string, string> = {};

  let charIdx = 0;
  for (const color of colorSet) {
    const ch = CHAR_BANK[charIdx % CHAR_BANK.length];
    charIdx += 1;
    paletteObj[ch] = color;
    colorToChar[color] = ch;
  }

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
      rows.push(rowStr);
    }
    return rows;
  });

  const payload = {
    title: spec.title || 'Pixel Art',
    width: spec.width,
    height: spec.height,
    fps: spec.fps || 8,
    loop: spec.loop !== false,
    palette: paletteObj,
    frames: encodedFrames,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Renders a frame to a crisp canvas element with optional grid lines and scaling.
 */
export function renderPixelArtToCanvas(
  frame: PixelArtFrame,
  width: number,
  height: number,
  scale = 1,
  showGrid = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = frame.pixels[y * width + x];
      if (color && color.toLowerCase() !== 'transparent') {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
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
 * Generates clean crisp SVG for pixel art with crisp 1x1 `<rect>` units.
 */
export function pixelArtToSvg(
  frame: PixelArtFrame,
  width: number,
  height: number,
  background = 'transparent'
): string {
  const rects: string[] = [];
  if (background && background !== 'transparent') {
    rects.push(`<rect width="${width}" height="${height}" fill="${background}" />`);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = frame.pixels[y * width + x];
      if (color && color.toLowerCase() !== 'transparent') {
        rects.push(
          `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}" shape-rendering="crispEdges" />`
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 16}" height="${height * 16}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>`;
}

/**
 * Converts a pixel art frame to a crisp PNG blob scaled by `scale` factor with nearest neighbor.
 */
export function pixelArtToPngBlob(
  frame: PixelArtFrame,
  width: number,
  height: number,
  scale = 16
): Promise<Blob> {
  const canvas = renderPixelArtToCanvas(frame, width, height, scale, false);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create PNG blob'));
    }, 'image/png');
  });
}

/**
 * Exports an animated GIF using gifenc for multi-frame pixel art with nearest neighbor clarity.
 */
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

  const gifWidth = width * scale;
  const gifHeight = height * scale;
  const gif = GIFEncoder();
  const delay = Math.round(1000 / Math.max(1, fps));

  for (const frame of frames) {
    const canvas = renderPixelArtToCanvas(frame, width, height, scale, false);
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
