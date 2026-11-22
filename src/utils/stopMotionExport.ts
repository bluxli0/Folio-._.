import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { StopMotionFrame, VectorStopMotionSpec } from '../types/stopMotion';
import {
  createAudioBufferFromMathSpec,
  MathAudioTrackSpec,
  synthesizeMathAudioWavBlob,
} from './mathAudioSynth';

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };
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

/**
 * Fixes the static-picture WebM bug:
 * Uses manual captureStream(0) + explicit track.requestFrame() per RAF tick,
 * expanding every frame hold into distinct encoded video ticks and optionally
 * muxing synthesized math audio via AudioContext.createMediaStreamDestination().
 */
export async function exportWebmVideo(
  frames: StopMotionFrame[],
  fps: number,
  pingPong: boolean,
  width: number,
  height: number,
  audioSpec?: MathAudioTrackSpec
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
  // Expand holds into individual display ticks so every logical tick requests a frame
  const timelineIndices: number[] = [];
  for (const frameIdx of sequence) {
    const holds = Math.max(1, frames[frameIdx]?.hold || 1);
    for (let h = 0; h < holds; h += 1) {
      timelineIndices.push(frameIdx);
    }
  }

  const safeFps = Math.max(1, Math.min(60, Math.round(fps)));
  const stepDurationMs = 1000 / safeFps;

  // captureStream(0) enables explicit per-frame flushing so MediaRecorder never freezes on frame 0
  let stream = canvas.captureStream(0);
  const videoTrack = stream.getVideoTracks()[0] as (MediaStreamTrack & {
    requestFrame?: () => void;
  }) | undefined;
  const supportsManualFrame = typeof videoTrack?.requestFrame === 'function';
  if (!supportsManualFrame) {
    stream.getTracks().forEach((t) => t.stop());
    stream = canvas.captureStream(safeFps);
  }

  let audioCtx: AudioContext | null = null;
  let audioSource: AudioBufferSourceNode | null = null;
  if (audioSpec && typeof AudioContext !== 'undefined') {
    try {
      audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      if (audioCtx.state === 'running') {
        const totalSec = (timelineIndices.length / safeFps) + 0.1;
        const buf = createAudioBufferFromMathSpec(audioCtx, {
          ...audioSpec,
          durationSec: audioSpec.durationSec || totalSec,
        });
        const dest = audioCtx.createMediaStreamDestination();
        audioSource = audioCtx.createBufferSource();
        audioSource.buffer = buf;
        audioSource.connect(dest);
        dest.stream.getAudioTracks().forEach((at) => stream.addTrack(at));
      } else {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    } catch {
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    }
  }

  const preferredTypes = audioSource
    ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ]
    : [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
  const mimeType = preferredTypes.find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
  if (!mimeType) {
    stream.getTracks().forEach((t) => t.stop());
    if (audioCtx) audioCtx.close().catch(() => {});
    throw new Error('WebM recording is unavailable in this browser.');
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
      const out = new Blob(chunks, { type: mimeType });
      if (out.size === 0) {
        reject(new Error('Encoded WebM stream was empty.'));
      } else {
        resolve(out);
      }
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
      reject(new Error('Failed to encode WebM video.'));
    };
  });

  const paintFrameAt = (idx: number) => {
    const img = images[idx];
    const bg = frames[idx]?.background || '#18181b';
    drawCoverOrContain(
      ctx,
      img,
      img.naturalWidth || width,
      img.naturalHeight || height,
      width,
      height,
      'contain',
      bg
    );
    const vt = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
    vt?.requestFrame?.();
  };

  // Prime first frame before and right after start
  paintFrameAt(timelineIndices[0]);
  recorder.start(50);
  paintFrameAt(timelineIndices[0]);
  if (audioSource) {
    audioSource.start();
  }

  await new Promise<void>((resolve) => {
    let currentTick = 0;
    const startTime = performance.now();

    const stepLoop = () => {
      const elapsed = performance.now() - startTime;
      const targetTick = Math.floor(elapsed / stepDurationMs);

      if (targetTick >= timelineIndices.length) {
        // Ensure final frame is emitted
        paintFrameAt(timelineIndices[timelineIndices.length - 1]);
        resolve();
        return;
      }

      if (targetTick > currentTick) {
        // Paint every skipped/current frame so encoder records complete motion
        for (let k = currentTick + 1; k <= targetTick; k += 1) {
          paintFrameAt(timelineIndices[k]);
        }
        currentTick = targetTick;
      }

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(stepLoop);
      } else {
        setTimeout(stepLoop, Math.max(8, stepDurationMs / 2));
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(stepLoop);
    } else {
      setTimeout(stepLoop, stepDurationMs);
    }
  });

  await new Promise((r) => setTimeout(r, Math.max(60, stepDurationMs)));
  if (audioSource) {
    try {
      audioSource.stop();
    } catch {
      // ignore already stopped
    }
  }
  try {
    recorder.requestData();
  } catch {
    // ignore if unsupported
  }
  recorder.stop();

  return stopped;
}

/**
 * Rasterizes any SVG/image frame to PNG dataUrl cleanly at target dimensions for FFmpeg baking.
 */
async function rasterizeFrameToPngDataUrl(
  frame: StopMotionFrame,
  width: number,
  height: number
): Promise<string> {
  if (frame.dataUrl.startsWith('data:image/png')) {
    return frame.dataUrl;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return frame.dataUrl;
  const img = await loadImageElement(frame.dataUrl);
  drawCoverOrContain(
    ctx,
    img,
    img.naturalWidth || width,
    img.naturalHeight || height,
    width,
    height,
    'contain',
    frame.background || '#18181b'
  );
  return canvas.toDataURL('image/png');
}

/**
 * Server-side FFmpeg Video Baker (/api/media/bake).
 * Renders rock-solid VP9 WebM or H.264 MP4 with frame-exact FPS, hold expansion, and pure-math WAV muxing!
 */
export async function bakeServerVideoViaFfmpeg(opts: {
  frames: StopMotionFrame[];
  fps: number;
  pingPong: boolean;
  width: number;
  height: number;
  format?: 'webm' | 'mp4';
  audioSpec?: MathAudioTrackSpec;
  onProgress?: (pct: number, status: string) => void;
}): Promise<{ blob: Blob; mimeType: string; frameCount: number; durationSec: number }> {
  const {
    frames,
    fps,
    pingPong,
    width,
    height,
    format = 'webm',
    audioSpec,
    onProgress,
  } = opts;
  if (frames.length === 0) {
    throw new Error('No frames available to bake.');
  }

  onProgress?.(5, 'Rasterizing frames for FFmpeg...');
  const pngCache = new Map<number, string>();
  const sequence = expandPlaybackSequence(frames, pingPong);
  const expandedFrames: string[] = [];

  for (let s = 0; s < sequence.length; s += 1) {
    const idx = sequence[s];
    let png = pngCache.get(idx);
    if (!png) {
      png = await rasterizeFrameToPngDataUrl(frames[idx], width, height);
      pngCache.set(idx, png);
    }
    const holds = Math.max(1, frames[idx]?.hold || 1);
    for (let h = 0; h < holds; h += 1) {
      expandedFrames.push(png);
    }
    if (s % 10 === 0) {
      onProgress?.(10 + Math.round((s / sequence.length) * 45), `Rasterized ${s + 1}/${sequence.length} keyframes`);
    }
  }

  let audioBase64: string | undefined;
  if (audioSpec) {
    onProgress?.(60, 'Synthesizing pure-math WAV track...');
    const wavBlob = synthesizeMathAudioWavBlob({
      ...audioSpec,
      durationSec: audioSpec.durationSec || expandedFrames.length / Math.max(1, fps),
    });
    audioBase64 = await blobToBase64(wavBlob);
  }

  onProgress?.(72, `Encoding ${expandedFrames.length} frames via FFmpeg (${format.toUpperCase()})...`);
  const resp = await fetch('/api/media/bake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fps: Math.max(1, Math.min(60, Math.round(fps))),
      width,
      height,
      format,
      frames: expandedFrames,
      audioWavBase64: audioBase64,
    }),
  });

  if (!resp.ok) {
    const errData = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || `Server bake failed (HTTP ${resp.status})`);
  }

  onProgress?.(98, 'Finalizing baked video stream...');
  const blob = await resp.blob();
  const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';
  return {
    blob,
    mimeType,
    frameCount: expandedFrames.length,
    durationSec: expandedFrames.length / Math.max(1, fps),
  };
}

/**
 * Stitches multiple video clips sequentially via server FFmpeg (/api/media/stitch) for 10m-60m long-form timelines.
 */
export async function stitchServerVideosViaFfmpeg(opts: {
  clips: Array<{ blob: Blob; repeatCount?: number }>;
  format?: 'webm' | 'mp4';
}): Promise<{ blob: Blob; mimeType: string }> {
  const { clips, format = 'webm' } = opts;
  if (clips.length === 0) {
    throw new Error('Provide at least one clip to stitch.');
  }

  const encodedClips = await Promise.all(
    clips.map(async (c) => ({
      base64: await blobToBase64(c.blob),
      mimeType: c.blob.type || (format === 'mp4' ? 'video/mp4' : 'video/webm'),
      repeatCount: Math.max(1, Math.min(200, Math.round(c.repeatCount || 1))),
    }))
  );

  const resp = await fetch('/api/media/stitch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, clips: encodedClips }),
  });

  if (!resp.ok) {
    const errData = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || `Video stitch failed (HTTP ${resp.status})`);
  }

  const blob = await resp.blob();
  return {
    blob,
    mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
  };
}

function escapeXmlCdata(val: string): string {
  return val.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

export function exportStopMotionXml(spec: VectorStopMotionSpec): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<stopmotion format="${esc(spec.format || 'stopmotion/v3')}" title="${esc(spec.title || 'Animation')}" fps="${spec.fps}" width="${spec.width}" height="${spec.height}" background="${esc(spec.background)}" loop="${spec.loop}" pingPong="${spec.pingPong}" durationSec="${(spec.durationSec ?? spec.frames.length / Math.max(1, spec.fps)).toFixed(3)}">`,
  ];

  if (spec.audioSpec) {
    lines.push(
      `  <audio mode="${esc(spec.audioSpec.mode || 'math')}" preset="${esc(spec.audioSpec.preset || '')}" durationSec="${spec.audioSpec.durationSec ?? ''}">${spec.audioSpec.formula ? `<![CDATA[${escapeXmlCdata(spec.audioSpec.formula)}]]>` : ''}</audio>`
    );
  }

  lines.push('  <frames>');
  spec.frames.forEach((f, idx) => {
    lines.push(
      `    <frame index="${idx}" hold="${f.hold || 1}" background="${esc(f.background || spec.background)}">`
    );
    if (f.svgMarkup) {
      lines.push(`      <svg><![CDATA[${escapeXmlCdata(f.svgMarkup)}]]></svg>`);
    } else {
      lines.push(`      <dataUrl><![CDATA[${escapeXmlCdata(f.dataUrl)}]]></dataUrl>`);
    }
    lines.push('    </frame>');
  });
  lines.push('  </frames>');
  lines.push('</stopmotion>');
  return lines.join('\n');
}

export function exportStopMotionJson(spec: VectorStopMotionSpec): string {
  if (spec.sourceScene && typeof spec.sourceScene === 'object') {
    return JSON.stringify(
      {
        ...(spec.sourceScene as Record<string, unknown>),
        fps: spec.fps,
        durationSec: spec.durationSec,
      },
      null,
      2
    );
  }
  return JSON.stringify(
    {
      format: spec.format || 'stopmotion/v3',
      title: spec.title || 'Animation',
      fps: spec.fps,
      durationSec: spec.durationSec ?? spec.frames.length / Math.max(1, spec.fps),
      width: spec.width,
      height: spec.height,
      background: spec.background,
      loop: spec.loop,
      pingPong: spec.pingPong,
      ...(spec.audioSpec ? { audio: spec.audioSpec } : {}),
      frames: spec.frames.map((f) => ({
        hold: f.hold,
        background: f.background,
        ...(f.svgMarkup ? { svg: f.svgMarkup } : { dataUrl: f.dataUrl }),
      })),
    },
    null,
    2
  );
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
    const t = i / count;
    const phase = Math.abs(Math.cos(t * Math.PI));
    const squash = i === 4 ? 0.68 : i === 3 || i === 5 ? 0.9 : 1.04;
    const stretch = 1 / squash;

    const r = Math.min(width, height) * 0.11;
    const x = width * (0.2 + (i / (count - 1)) * 0.6);
    const maxLift = height * 0.44;
    const y = floorY - r * squash - phase * maxLift;

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(24, 24, 27, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.08, floorY);
    ctx.lineTo(width * 0.92, floorY);
    ctx.stroke();

    const shadowScale = 0.4 + 0.6 * (1 - phase);
    ctx.fillStyle = `rgba(24, 24, 27, ${0.08 + 0.14 * (1 - phase)})`;
    ctx.beginPath();
    ctx.ellipse(x, floorY + 4, r * 1.1 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

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
