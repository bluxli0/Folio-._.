import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { StopMotionFrame } from '../types/stopMotion';

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load frame image'));
    img.src = src;
  });
}

export function drawCoverOrContain(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  mode: 'contain' | 'cover' = 'contain',
  bgColor = '#18181b'
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, destW, destH);
  if (!srcW || !srcH) return;

  const scale =
    mode === 'cover'
      ? Math.max(destW / srcW, destH / srcH)
      : Math.min(destW / srcW, destH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const dx = (destW - drawW) / 2;
  const dy = (destH - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

export function expandPlaybackSequence(
  frames: StopMotionFrame[],
  pingPong: boolean
): number[] {
  if (frames.length === 0) return [];
  const forward = frames.map((_, i) => i);
  if (!pingPong || frames.length <= 2) return forward;
  const backward = frames
    .slice(1, -1)
    .map((_, i) => frames.length - 2 - i);
  return [...forward, ...backward];
}

export async function exportAnimatedGif(
  frames: StopMotionFrame[],
  fps: number,
  pingPong: boolean,
  width: number,
  height: number
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('Capture at least one frame before exporting.');
  }

  // Keep GIF export crisp yet fast by capping longest dimension at 640px
  const scale = Math.min(1, 640 / Math.max(width, height));
  const outW = Math.max(16, Math.round(width * scale));
  const outH = Math.max(16, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }

  const images = await Promise.all(frames.map((f) => loadImageElement(f.dataUrl)));
  const sequence = expandPlaybackSequence(frames, pingPong);
  const baseFrameDelayMs = Math.max(20, Math.round(1000 / Math.max(1, fps)));

  const encoder = GIFEncoder();

  for (let sIdx = 0; sIdx < sequence.length; sIdx += 1) {
    const frameIndex = sequence[sIdx];
    const frame = frames[frameIndex];
    const img = images[frameIndex];

    drawCoverOrContain(
      ctx,
      img,
      img.naturalWidth || width,
      img.naturalHeight || height,
      outW,
      outH,
      'contain',
      '#18181b'
    );

    const imageData = ctx.getImageData(0, 0, outW, outH);
    const palette = quantize(imageData.data, 256);
    const indexed = applyPalette(imageData.data, palette);

    encoder.writeFrame(indexed, outW, outH, {
      palette,
      delay: baseFrameDelayMs * Math.max(1, frame.hold),
      repeat: 0,
    });
  }

  encoder.finish();
  const bytes = encoder.bytes();
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'image/gif' });
}

export async function exportWebmVideo(
  frames: StopMotionFrame[],
  fps: number,
  pingPong: boolean,
  width: number,
  height: number
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('Capture at least one frame before exporting.');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video recording is not supported in this browser.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }

  if (typeof canvas.captureStream !== 'function') {
    throw new Error('Canvas stream capture is not supported in this browser.');
  }

  const images = await Promise.all(frames.map((f) => loadImageElement(f.dataUrl)));
  const sequence = expandPlaybackSequence(frames, pingPong);
  const baseDelayMs = Math.max(20, Math.round(1000 / Math.max(1, fps)));

  const preferredTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const mimeType = preferredTypes.find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
  if (!mimeType) {
    throw new Error('WebM recording is unavailable in this browser.');
  }

  const stream = canvas.captureStream(Math.max(12, fps));
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = () => {
      reject(new Error('Failed to encode WebM video.'));
    };
  });

  recorder.start(100);

  for (const frameIdx of sequence) {
    const frame = frames[frameIdx];
    const img = images[frameIdx];
    drawCoverOrContain(
      ctx,
      img,
      img.naturalWidth || width,
      img.naturalHeight || height,
      width,
      height,
      'contain',
      '#18181b'
    );
    await new Promise((r) =>
      setTimeout(r, baseDelayMs * Math.max(1, frame.hold))
    );
  }

  // Slight tail buffer ensures last frame commits cleanly
  await new Promise((r) => setTimeout(r, 80));
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  return stopped;
}

export async function exportSpriteSheetPng(
  frames: StopMotionFrame[],
  width: number,
  height: number
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('Capture at least one frame first.');
  }
  const images = await Promise.all(frames.map((f) => loadImageElement(f.dataUrl)));
  const cols = Math.min(4, frames.length);
  const rows = Math.ceil(frames.length / cols);
  const cellW = Math.round(width / 2);
  const cellH = Math.round(height / 2);
  const pad = 12;

  const sheet = document.createElement('canvas');
  sheet.width = cols * cellW + (cols + 1) * pad;
  sheet.height = rows * cellH + (rows + 1) * pad;

  const ctx = sheet.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  images.forEach((img, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = pad + col * (cellW + pad);
    const y = pad + row * (cellH + pad);
    ctx.drawImage(img, x, y, cellW, cellH);

    // Subtle frame number badge in corner
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x + 8, y + 8, 32, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(String(idx + 1).padStart(2, '0'), x + 16, y + 22);
  });

  return new Promise((resolve, reject) => {
    sheet.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode sprite sheet PNG.'));
    }, 'image/png');
  });
}

export function createStarterStopMotionFrames(
  width: number,
  height: number
): StopMotionFrame[] {
  const count = 8;
  const frames: StopMotionFrame[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return frames;

  const floorY = height * 0.78;

  for (let i = 0; i < count; i += 1) {
    const t = i / count; // 0..0.875
    // Parabolic bounce arc: peaks at i=0 and lands/squashes at i=4
    const phase = Math.abs(Math.cos(t * Math.PI));
    const squash = i === 4 ? 0.68 : i === 3 || i === 5 ? 0.9 : 1.04;
    const stretch = 1 / squash;

    const r = Math.min(width, height) * 0.11;
    const x = width * (0.2 + (i / (count - 1)) * 0.6);
    const maxLift = height * 0.44;
    const y = floorY - r * squash - phase * maxLift;

    // Warm studio paper backdrop
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, width, height);

    // Subtle desk horizon line
    ctx.strokeStyle = 'rgba(24, 24, 27, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.08, floorY);
    ctx.lineTo(width * 0.92, floorY);
    ctx.stroke();

    // Soft ground shadow shrinking as ball rises
    const shadowScale = 0.4 + 0.6 * (1 - phase);
    ctx.fillStyle = `rgba(24, 24, 27, ${0.08 + 0.14 * (1 - phase)})`;
    ctx.beginPath();
    ctx.ellipse(x, floorY + 4, r * 1.1 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tactile clay ball with squash & stretch
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(stretch, squash);

    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
    grad.addColorStop(0, '#fb7185');
    grad.addColorStop(0.65, '#e11d48');
    grad.addColorStop(1, '#9f1239');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Hand-sculpted clay highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.24, r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    frames.push({
      id: crypto.randomUUID(),
      dataUrl: canvas.toDataURL('image/png'),
      hold: i === 4 ? 2 : 1,
      createdAt: Date.now() + i,
    });
  }

  return frames;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not convert blob to base64.'));
    reader.readAsDataURL(blob);
  });
}
