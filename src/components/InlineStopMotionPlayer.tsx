import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Film,
  Layers,
  Pause,
  Play,
  Repeat,
  Server,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { StopMotionFrame, VectorStopMotionSpec } from '../types/stopMotion';
import {
  bakeServerVideoViaFfmpeg,
  drawCoverOrContain,
  expandPlaybackSequence,
  exportAnimatedGif,
  exportStopMotionJson,
  exportStopMotionXml,
  exportWebmVideo,
  loadImageElement,
} from '../utils/stopMotionExport';
import { parseVectorStopMotionCode, svgMarkupToDataUrl } from '../utils/vectorBrushes';
import {
  isStopMotionSceneV2,
  recompileStopMotionAtFps,
} from '../utils/stopMotionEngine';
import { createAudioBufferFromMathSpec } from '../utils/mathAudioSynth';

interface InlineStopMotionPlayerProps {
  code: string;
  compact?: boolean;
  onOpenInStudio?: (spec: VectorStopMotionSpec) => void;
}

function resampleRawFramesToFps(
  baseSpec: VectorStopMotionSpec,
  targetFps: number
): VectorStopMotionSpec {
  const safeFps = Math.max(1, Math.min(60, Math.round(targetFps)));
  const expandedSource: StopMotionFrame[] = [];
  for (const f of baseSpec.frames) {
    const holds = Math.max(1, f.hold || 1);
    for (let h = 0; h < holds; h += 1) {
      expandedSource.push({ ...f, hold: 1 });
    }
  }
  const sourceFps = Math.max(1, baseSpec.fps || 24);
  const durationSec =
    baseSpec.durationSec && baseSpec.durationSec > 0
      ? baseSpec.durationSec
      : expandedSource.length / sourceFps;

  const targetLogicalFrames = Math.max(1, Math.min(216000, Math.round(durationSec * safeFps)));
  const previewCount = Math.min(360, targetLogicalFrames);
  const resampled: StopMotionFrame[] = [];

  for (let i = 0; i < previewCount; i += 1) {
    const u = previewCount > 1 ? i / (previewCount - 1) : 0;
    const srcIdx = Math.min(
      expandedSource.length - 1,
      Math.round(u * (expandedSource.length - 1))
    );
    const src = expandedSource[srcIdx] || baseSpec.frames[0];
    resampled.push({
      ...src,
      id: `${src.id}-rs-${i}`,
      hold: 1,
    });
  }

  return {
    ...baseSpec,
    fps: safeFps,
    durationSec,
    totalLogicalFrames: targetLogicalFrames,
    frames: resampled,
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const InlineStopMotionPlayer: React.FC<InlineStopMotionPlayerProps> = ({
  code,
  compact = true,
  onOpenInStudio,
}) => {
  const parsed = useMemo(() => parseVectorStopMotionCode(code), [code]);
  const initialSpec = parsed.spec;

  const [activeSpec, setActiveSpec] = useState<VectorStopMotionSpec | undefined>(initialSpec);
  const [fps, setFps] = useState<number>(() => initialSpec?.fps ?? 24);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [loop, setLoop] = useState<boolean>(() => initialSpec?.loop ?? true);
  const [pingPong, setPingPong] = useState<boolean>(() => initialSpec?.pingPong ?? false);
  const [onionSkin, setOnionSkin] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [isExportingGif, setIsExportingGif] = useState<boolean>(false);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [isServerBaking, setIsServerBaking] = useState<boolean>(false);
  const [bakeStatus, setBakeStatus] = useState<string | null>(null);
  const [webmUrl, setWebmUrl] = useState<string | null>(null);
  const [isBakingWebm, setIsBakingWebm] = useState<boolean>(false);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [webmFailed, setWebmFailed] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasStageRef = useRef<HTMLCanvasElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const decodedImgsRef = useRef<Array<HTMLImageElement | null>>([]);
  const liveFrameIdxRef = useRef<number>(0);

  useEffect(() => {
    if (!initialSpec) {
      setActiveSpec(undefined);
      return;
    }
    setActiveSpec(initialSpec);
    setFps(initialSpec.fps);
    setLoop(initialSpec.loop);
    setPingPong(initialSpec.pingPong);
    setFrameIndex(0);
    liveFrameIdxRef.current = 0;
    setIsPlaying(true);
  }, [initialSpec]);

  // Handle FPS change while conserving real-world durationSec (no 2.5x/5x speedup bug!)
  const handleFpsChange = (nextFps: number) => {
    const clampedFps = Math.max(1, Math.min(60, Math.round(nextFps)));
    setFps(clampedFps);
    if (!initialSpec) return;

    liveFrameIdxRef.current = 0;
    if (initialSpec.sourceScene && isStopMotionSceneV2(initialSpec.sourceScene)) {
      const recompiled = recompileStopMotionAtFps(
        initialSpec.sourceScene,
        clampedFps,
        svgMarkupToDataUrl
      );
      setActiveSpec(recompiled);
      setFrameIndex(0);
    } else {
      const resampled = resampleRawFramesToFps(initialSpec, clampedFps);
      setActiveSpec(resampled);
      setFrameIndex(0);
    }
  };

  // Compute effective preview FPS so even subsampled 10-min timelines play at true durationSec
  const effectivePreviewFps = useMemo(() => {
    if (!activeSpec) return fps;
    if (
      activeSpec.totalLogicalFrames &&
      activeSpec.totalLogicalFrames > activeSpec.frames.length &&
      activeSpec.durationSec &&
      activeSpec.durationSec > 0
    ) {
      return Math.max(1, activeSpec.frames.length / activeSpec.durationSec);
    }
    return fps;
  }, [activeSpec, fps]);

  // Sync math audio playback when user enables audio
  useEffect(() => {
    const stopAudio = () => {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch {
          // ignore
        }
        audioSourceRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };

    if (!audioEnabled || !isPlaying || !activeSpec?.audioSpec || typeof AudioContext === 'undefined') {
      stopAudio();
      return;
    }

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const buf = createAudioBufferFromMathSpec(ctx, {
        ...activeSpec.audioSpec,
        durationSec:
          activeSpec.audioSpec.durationSec ||
          activeSpec.durationSec ||
          activeSpec.frames.length / Math.max(1, fps),
      });
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;
      src.connect(ctx.destination);
      src.start();
      audioSourceRef.current = src;
    } catch {
      stopAudio();
    }

    return stopAudio;
  }, [audioEnabled, isPlaying, loop, activeSpec, fps]);

  // Background video-only WebM bake for clips <= 180 frames (never touches AudioContext so muted <video> never stalls!)
  useEffect(() => {
    setVideoReady(false);
    setWebmFailed(false);
    if (!activeSpec || activeSpec.frames.length < 2 || activeSpec.frames.length > 180) {
      setWebmUrl(null);
      setIsBakingWebm(false);
      return;
    }
    if (typeof MediaRecorder === 'undefined') return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setIsBakingWebm(true);
      try {
        const blob = await exportWebmVideo(
          activeSpec.frames,
          effectivePreviewFps,
          pingPong,
          activeSpec.width,
          activeSpec.height,
          undefined
        );
        if (cancelled) return;
        if (blob.size < 256) {
          setWebmFailed(true);
          return;
        }
        const nextUrl = URL.createObjectURL(blob);
        setWebmUrl(nextUrl);
      } catch {
        if (!cancelled) setWebmFailed(true);
      } finally {
        if (!cancelled) setIsBakingWebm(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeSpec, effectivePreviewFps, pingPong]);

  // Safely revoke previous WebM blob URL only after state changes or unmount
  useEffect(() => {
    return () => {
      if (webmUrl) URL.revokeObjectURL(webmUrl);
    };
  }, [webmUrl]);

  // Pre-decode frames into memory once so canvas RAF stage runs without SVG re-parse stutter
  useEffect(() => {
    if (!activeSpec || activeSpec.frames.length === 0) {
      decodedImgsRef.current = [];
      return;
    }
    let cancelled = false;
    decodedImgsRef.current = new Array(activeSpec.frames.length).fill(null);
    activeSpec.frames.forEach((f, idx) => {
      loadImageElement(f.dataUrl)
        .then((img) => {
          if (!cancelled) {
            decodedImgsRef.current[idx] = img;
          }
        })
        .catch(() => {
          // fallback to <img>
        });
    });
    return () => {
      cancelled = true;
    };
  }, [activeSpec]);

  const useWebmStage = Boolean(
    webmUrl && videoReady && !webmFailed && isPlaying && !onionSkin && activeSpec && activeSpec.frames.length > 1
  );

  // Zero-React-rerender Canvas RAF loop (active while background WebM bakes, for >180 frames, or onionSkin)
  useEffect(() => {
    if (!activeSpec || !isPlaying || activeSpec.frames.length === 0 || useWebmStage) return;

    const seq = expandPlaybackSequence(activeSpec.frames, pingPong);
    if (seq.length === 0) return;

    let step = Math.max(0, seq.indexOf(liveFrameIdxRef.current));
    if (step < 0) step = 0;

    const totalUnits = activeSpec.frames.reduce((acc, f) => acc + Math.max(1, f.hold || 1), 0);
    const runtimeSecLocal = activeSpec.durationSec ?? totalUnits / Math.max(1, fps);

    const drawToStageCanvas = (idx: number) => {
      liveFrameIdxRef.current = idx;
      const canvas = canvasStageRef.current;
      const decoded = decodedImgsRef.current[idx];
      if (canvas && decoded) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawCoverOrContain(
            ctx,
            decoded,
            decoded.naturalWidth || activeSpec.width,
            decoded.naturalHeight || activeSpec.height,
            activeSpec.width,
            activeSpec.height,
            'contain',
            activeSpec.frames[idx]?.background || activeSpec.background || '#18181b'
          );
        }
      } else {
        // Fallback until decode settles
        setFrameIndex(idx);
      }
      if (badgeRef.current) {
        badgeRef.current.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(activeSpec.frames.length).padStart(2, '0')} · ${runtimeSecLocal.toFixed(1)}s`;
      }
    };

    drawToStageCanvas(seq[step] ?? 0);

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const stepLoop = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;
      elapsed += dt;

      const currentIdx = seq[step] ?? 0;
      const frame = activeSpec.frames[currentIdx];
      const targetDuration = Math.max(
        16,
        (1000 / Math.max(1, effectivePreviewFps)) * Math.max(1, frame?.hold || 1)
      );

      if (elapsed >= targetDuration) {
        elapsed %= targetDuration;
        if (step + 1 < seq.length) {
          step += 1;
          drawToStageCanvas(seq[step] ?? 0);
        } else if (loop) {
          step = 0;
          drawToStageCanvas(seq[0] ?? 0);
        } else {
          setFrameIndex(seq[step] ?? 0);
          setIsPlaying(false);
          return;
        }
      }

      rafId = window.requestAnimationFrame(stepLoop);
    };

    rafId = window.requestAnimationFrame(stepLoop);

    return () => {
      window.cancelAnimationFrame(rafId);
      setFrameIndex(liveFrameIdxRef.current);
    };
  }, [activeSpec, isPlaying, effectivePreviewFps, loop, pingPong, useWebmStage, fps]);

  if (!activeSpec || activeSpec.frames.length === 0) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300">
        {parsed.error || 'Could not parse stop-motion vector frames.'}
      </div>
    );
  }

  const frames = activeSpec.frames;
  const safeIndex = Math.min(frameIndex, frames.length - 1);
  const currentFrame = frames[safeIndex];
  const prevFrame = safeIndex > 0 ? frames[safeIndex - 1] : frames[frames.length - 1];
  const totalUnits = frames.reduce((acc, f) => acc + Math.max(1, f.hold || 1), 0);
  const runtimeSec = activeSpec.durationSec ?? totalUnits / Math.max(1, fps);
  const logicalFramesCount = activeSpec.totalLogicalFrames ?? totalUnits;
  const slug = (activeSpec.title || 'stop-motion')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const handleDownloadGif = async () => {
    if (isExportingGif) return;
    setIsExportingGif(true);
    try {
      const blob = await exportAnimatedGif(
        frames,
        effectivePreviewFps,
        pingPong,
        activeSpec.width,
        activeSpec.height
      );
      triggerDownload(blob, `${slug || 'stopmotion'}-${fps}fps.gif`);
    } finally {
      setIsExportingGif(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (isExportingVideo) return;
    setIsExportingVideo(true);
    try {
      const blob = await exportWebmVideo(
        frames,
        effectivePreviewFps,
        pingPong,
        activeSpec.width,
        activeSpec.height,
        activeSpec.audioSpec
      );
      triggerDownload(blob, `${slug || 'stopmotion'}-${fps}fps.webm`);
    } finally {
      setIsExportingVideo(false);
    }
  };

  const handleServerBake = async (format: 'webm' | 'mp4') => {
    if (isServerBaking) return;
    setIsServerBaking(true);
    setBakeStatus('Preparing FFmpeg...');
    try {
      const { blob } = await bakeServerVideoViaFfmpeg({
        frames,
        fps: effectivePreviewFps,
        pingPong,
        width: activeSpec.width,
        height: activeSpec.height,
        format,
        audioSpec: activeSpec.audioSpec,
        onProgress: (pct, msg) => setBakeStatus(`${pct}% · ${msg}`),
      });
      triggerDownload(blob, `${slug || 'stopmotion'}-baked-${fps}fps.${format}`);
      setBakeStatus('Baked');
      setTimeout(() => setBakeStatus(null), 2000);
    } catch (err) {
      setBakeStatus(err instanceof Error ? err.message : 'Server bake failed');
      setTimeout(() => setBakeStatus(null), 3200);
    } finally {
      setIsServerBaking(false);
    }
  };

  const handleDownloadXml = () => {
    const xml = exportStopMotionXml(activeSpec);
    triggerDownload(new Blob([xml], { type: 'application/xml;charset=utf-8' }), `${slug || 'stopmotion'}.xml`);
  };

  const handleDownloadJson = () => {
    const json = exportStopMotionJson(activeSpec);
    triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8' }), `${slug || 'stopmotion'}.json`);
  };

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#161616] text-[#0d0d0d] dark:text-[#ececec]">
      {/* Sub-bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-neutral-600 dark:text-neutral-300 tabular-nums">
          <span className="font-medium text-[#0d0d0d] dark:text-white">
            {activeSpec.title || 'Vector Stop Motion'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {logicalFramesCount.toLocaleString()} {logicalFramesCount === 1 ? 'frame' : 'frames'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{fps} fps</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{runtimeSec.toFixed(1)}s</span>
          {activeSpec.audioSpec && (
            <>
              <span aria-hidden="true">·</span>
              <span>Math Audio</span>
            </>
          )}
          {webmUrl && videoReady && !webmFailed && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">WebM Baked</span>
            </>
          )}
          {(!webmUrl || !videoReady) && !webmFailed && isBakingWebm && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">Baking WebM…</span>
            </>
          )}
          {bakeStatus && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{bakeStatus}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {onOpenInStudio && (
            <button
              type="button"
              onClick={() => onOpenInStudio({ ...activeSpec, fps, loop, pingPong })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <Film className="w-3 h-3" />
              <span>Open in Studio</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleDownloadVideo()}
            disabled={isExportingVideo}
            title="Download WebM video"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Film className="w-3 h-3" />
            <span>{isExportingVideo ? 'WebM...' : 'WebM'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleServerBake('webm')}
            disabled={isServerBaking}
            title="Server-side FFmpeg Bake (frame-exact VP9 WebM + audio)"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Server className="w-3 h-3" />
            <span>{isServerBaking ? 'Baking...' : 'Bake'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadGif()}
            disabled={isExportingGif}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>{isExportingGif ? 'GIF...' : 'GIF'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadXml}
            title="Download Stop Motion XML"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Code2 className="w-3 h-3" />
            <span>XML</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            title="Download Stop Motion JSON"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Rendered Stage: Instant Pre-Decoded Canvas + Seamless Background-Baked WebM Video */}
      <div className="p-3 bg-neutral-100/80 dark:bg-[#111111] flex flex-col items-center gap-2.5">
        <div
          className={`relative w-full ${
            compact ? 'max-w-[520px]' : 'max-w-[680px]'
          } rounded-xl overflow-hidden border border-neutral-300 dark:border-white/15 bg-neutral-950 flex items-center justify-center`}
          style={{ aspectRatio: `${activeSpec.width} / ${activeSpec.height}` }}
        >
          {/* Base paused / onion-skin / initial <img> fallback */}
          {onionSkin && prevFrame && frames.length > 1 && (
            <img
              src={prevFrame.dataUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-30"
            />
          )}
          <img
            src={currentFrame.dataUrl}
            alt={`Frame ${safeIndex + 1} of ${frames.length}`}
            className="relative z-10 w-full h-full object-contain"
          />
          {/* High-FPS Canvas stage during active pre-bake / long-clip RAF playback (zero React re-renders) */}
          {isPlaying && !onionSkin && !useWebmStage && (
            <canvas
              ref={canvasStageRef}
              width={activeSpec.width}
              height={activeSpec.height}
              className="absolute inset-0 z-20 w-full h-full object-contain pointer-events-none"
            />
          )}
          {/* Hardware-accelerated background-baked WebM <video> overlay (stays hidden until frame 0 decodes!) */}
          {webmUrl && !webmFailed && isPlaying && !onionSkin && (
            <video
              key={webmUrl}
              src={webmUrl}
              autoPlay
              loop={loop}
              muted
              playsInline
              onLoadedData={(e) => {
                if (e.currentTarget.videoWidth > 0) {
                  setVideoReady(true);
                }
              }}
              onError={() => {
                setWebmFailed(true);
                setVideoReady(false);
              }}
              onEnded={() => {
                if (!loop) setIsPlaying(false);
              }}
              className={`absolute inset-0 z-30 w-full h-full object-contain transition-opacity duration-150 ${
                videoReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          )}
          <div
            ref={badgeRef}
            className="absolute top-2 right-2 z-40 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[11px] tabular-nums"
          >
            {useWebmStage
              ? `WebM · ${logicalFramesCount}f @ ${fps}fps`
              : `${String(safeIndex + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')} · ${runtimeSec.toFixed(1)}s`}
          </div>
        </div>

        {/* Transport & FPS Strip */}
        <div
          className={`w-full ${
            compact ? 'max-w-[520px]' : 'max-w-[680px]'
          } flex flex-wrap items-center justify-between gap-2 text-xs`}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setFrameIndex((i) => {
                  const next = (i - 1 + frames.length) % frames.length;
                  liveFrameIdxRef.current = next;
                  return next;
                });
              }}
              aria-label="Previous frame"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setFrameIndex((i) => {
                  const next = (i + 1) % frames.length;
                  liveFrameIdxRef.current = next;
                  return next;
                });
              }}
              aria-label="Next frame"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setLoop((v) => !v)}
              aria-pressed={loop}
              title="Loop"
              className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                loop
                  ? 'bg-neutral-200 dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setPingPong((v) => !v)}
              aria-pressed={pingPong}
              title="Bounce (Ping-Pong)"
              className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                pingPong
                  ? 'bg-neutral-200 dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setOnionSkin((v) => !v)}
              aria-pressed={onionSkin}
              title="Onion skin ghosting"
              className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                onionSkin
                  ? 'bg-neutral-200 dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>

            {activeSpec.audioSpec && (
              <button
                type="button"
                onClick={() => setAudioEnabled((v) => !v)}
                aria-pressed={audioEnabled}
                title={audioEnabled ? 'Mute pure-math audio track' : 'Play pure-math audio track'}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                  audioEnabled
                    ? 'bg-neutral-200 dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                }`}
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <label
            title="Adjust playback framerate (conserves total animation duration)"
            className="inline-flex items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-300"
          >
            <span className="font-mono tabular-nums whitespace-nowrap">{fps} fps</span>
            <input
              type="range"
              min={2}
              max={60}
              step={1}
              value={fps}
              onChange={(e) => handleFpsChange(Number(e.target.value))}
              aria-label="Playback FPS"
              className="w-20 accent-[#0d0d0d] dark:accent-white"
            />
          </label>
        </div>

        {/* Clickable Frame Pips Scrubber (bucketed up to 48 pips for long timelines) */}
        <div
          className={`w-full ${
            compact ? 'max-w-[520px]' : 'max-w-[680px]'
          } flex items-center gap-1 overflow-x-auto pb-0.5`}
        >
          {frames.length <= 48
            ? frames.map((f, idx) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    liveFrameIdxRef.current = idx;
                    setFrameIndex(idx);
                  }}
                  aria-label={`Jump to frame ${idx + 1}`}
                  className={`h-2 flex-1 min-w-[10px] rounded-full transition-colors ${
                    idx === safeIndex
                      ? 'bg-[#0d0d0d] dark:bg-white'
                      : 'bg-neutral-300 dark:bg-white/15 hover:bg-neutral-400 dark:hover:bg-white/30'
                  }`}
                />
              ))
            : (
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={safeIndex}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setIsPlaying(false);
                  liveFrameIdxRef.current = next;
                  setFrameIndex(next);
                }}
                aria-label="Frame timeline scrubber"
                className="w-full accent-[#0d0d0d] dark:accent-white"
              />
            )}
        </div>
      </div>
    </div>
  );
};
