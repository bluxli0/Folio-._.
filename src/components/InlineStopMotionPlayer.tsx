import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Layers,
  Pause,
  Play,
  Repeat,
} from 'lucide-react';
import { VectorStopMotionSpec } from '../types/stopMotion';
import {
  expandPlaybackSequence,
  exportAnimatedGif,
  exportWebmVideo,
} from '../utils/stopMotionExport';
import { parseVectorStopMotionCode } from '../utils/vectorBrushes';

interface InlineStopMotionPlayerProps {
  code: string;
  compact?: boolean;
  onOpenInStudio?: (spec: VectorStopMotionSpec) => void;
}

export const InlineStopMotionPlayer: React.FC<InlineStopMotionPlayerProps> = ({
  code,
  compact = true,
  onOpenInStudio,
}) => {
  const parsed = useMemo(() => parseVectorStopMotionCode(code), [code]);
  const spec = parsed.spec;

  const [fps, setFps] = useState<number>(() => spec?.fps ?? 10);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [loop, setLoop] = useState<boolean>(() => spec?.loop ?? true);
  const [pingPong, setPingPong] = useState<boolean>(() => spec?.pingPong ?? false);
  const [onionSkin, setOnionSkin] = useState<boolean>(false);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [isExportingGif, setIsExportingGif] = useState<boolean>(false);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);

  useEffect(() => {
    if (!spec) return;
    setFps(spec.fps);
    setLoop(spec.loop);
    setPingPong(spec.pingPong);
    setFrameIndex(0);
    setIsPlaying(true);
  }, [spec]);

  useEffect(() => {
    if (!spec || !isPlaying || spec.frames.length === 0) return;

    const seq = expandPlaybackSequence(spec.frames, pingPong);
    if (seq.length === 0) return;

    let step = Math.max(0, seq.indexOf(frameIndex));
    if (step < 0) step = 0;

    let timerId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const idx = seq[step] ?? 0;
      setFrameIndex(idx);
      const frame = spec.frames[idx];
      const delay = Math.max(
        25,
        Math.round((1000 / Math.max(1, fps)) * Math.max(1, frame?.hold || 1))
      );

      timerId = window.setTimeout(() => {
        if (cancelled) return;
        if (step + 1 < seq.length) {
          step += 1;
          tick();
        } else if (loop) {
          step = 0;
          tick();
        } else {
          setIsPlaying(false);
        }
      }, delay);
    };

    tick();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [spec, isPlaying, fps, loop, pingPong]);

  if (!spec || spec.frames.length === 0) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300">
        {parsed.error || 'Could not parse stop-motion vector frames.'}
      </div>
    );
  }

  const frames = spec.frames;
  const safeIndex = Math.min(frameIndex, frames.length - 1);
  const currentFrame = frames[safeIndex];
  const prevFrame = safeIndex > 0 ? frames[safeIndex - 1] : frames[frames.length - 1];

  const handleDownloadGif = async () => {
    if (isExportingGif) return;
    setIsExportingGif(true);
    try {
      const blob = await exportAnimatedGif(
        frames,
        fps,
        pingPong,
        spec.width,
        spec.height
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vector-stopmotion-${fps}fps.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
        fps,
        pingPong,
        spec.width,
        spec.height
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vector-stopmotion-${fps}fps.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingVideo(false);
    }
  };

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#161616] text-[#0d0d0d] dark:text-[#ececec]">
      {/* Sub-bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 tabular-nums">
          <span className="font-medium text-[#0d0d0d] dark:text-white">
            {spec.title || 'Vector Stop Motion'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {frames.length} {frames.length === 1 ? 'frame' : 'frames'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{fps} fps</span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenInStudio && (
            <button
              type="button"
              onClick={() => onOpenInStudio({ ...spec, fps, loop, pingPong })}
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
            title="Download high-frame WebM video"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Film className="w-3 h-3" />
            <span>{isExportingVideo ? 'Video...' : 'Video'}</span>
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
        </div>
      </div>

      {/* Rendered Vector Stage */}
      <div className="p-3 bg-neutral-100/80 dark:bg-[#111111] flex flex-col items-center gap-2.5">
        <div
          className={`relative w-full ${
            compact ? 'max-w-[520px]' : 'max-w-[680px]'
          } rounded-xl overflow-hidden border border-neutral-300 dark:border-white/15 bg-neutral-950 flex items-center justify-center`}
          style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
        >
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
          <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[11px] tabular-nums">
            {String(safeIndex + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}
            {currentFrame.hold > 1 ? ` · ×${currentFrame.hold}` : ''}
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
                setFrameIndex((i) => (i - 1 + frames.length) % frames.length);
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
                setFrameIndex((i) => (i + 1) % frames.length);
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
          </div>

          <label className="inline-flex items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
            <span className="font-mono tabular-nums whitespace-nowrap">{fps} fps</span>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              aria-label="Playback FPS"
              className="w-20 accent-[#0d0d0d] dark:accent-white"
            />
          </label>
        </div>

        {/* Clickable Frame Pips Scrubber */}
        <div
          className={`w-full ${
            compact ? 'max-w-[520px]' : 'max-w-[680px]'
          } flex items-center gap-1 overflow-x-auto pb-0.5`}
        >
          {frames.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setFrameIndex(idx);
              }}
              aria-label={`Jump to frame ${idx + 1}`}
              className={`h-2 flex-1 min-w-[14px] rounded-full transition-colors ${
                idx === safeIndex
                  ? 'bg-[#0d0d0d] dark:bg-white'
                  : 'bg-neutral-300 dark:bg-white/15 hover:bg-neutral-400 dark:hover:bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
