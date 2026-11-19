import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Grid3X3,
  Maximize2,
  Paintbrush,
  Pause,
  Play,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PixelArtFrame, PixelArtSpec } from '../types/pixelArt';
import {
  parsePixelArtCode,
  pixelArtToPngBlob,
  pixelArtToSvg,
  renderPixelArtToCanvas,
} from '../utils/pixelArtParser';

interface InlinePixelArtViewerProps {
  code: string;
  compact?: boolean;
  onOpenInStudio?: (spec: PixelArtSpec) => void;
}

export const InlinePixelArtViewer: React.FC<InlinePixelArtViewerProps> = ({
  code,
  compact = true,
  onOpenInStudio,
}) => {
  const parsed = useMemo(() => parsePixelArtCode(code), [code]);
  const spec = parsed.spec;

  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(() => spec?.fps || 8);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(compact ? 8 : 10);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!spec) return;
    setFps(spec.fps || 8);
    setFrameIndex(0);
    setIsPlaying(spec.frames.length > 1);
  }, [spec]);

  // Animation scheduler
  useEffect(() => {
    if (!spec || !isPlaying || spec.frames.length <= 1) return;

    let timerId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const currentFrame = spec.frames[frameIndex];
      const delay = Math.max(
        35,
        Math.round((1000 / Math.max(1, fps)) * Math.max(1, currentFrame?.hold || 1))
      );

      timerId = window.setTimeout(() => {
        if (cancelled) return;
        setFrameIndex((prev) => (prev + 1) % spec.frames.length);
        tick();
      }, delay);
    };

    tick();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [spec, isPlaying, fps, frameIndex]);

  // Render current frame to canvas
  useEffect(() => {
    if (!spec || !canvasRef.current) return;
    const frame = spec.frames[frameIndex] || spec.frames[0];
    if (!frame) return;

    const rendered = renderPixelArtToCanvas(
      frame,
      spec.width,
      spec.height,
      zoomLevel,
      showGrid
    );

    const dest = canvasRef.current;
    dest.width = rendered.width;
    dest.height = rendered.height;
    const ctx = dest.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, dest.width, dest.height);
      ctx.drawImage(rendered, 0, 0);
    }
  }, [spec, frameIndex, zoomLevel, showGrid]);

  if (!spec || spec.frames.length === 0) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300">
        {parsed.error || 'Could not parse pixel art code.'}
      </div>
    );
  }

  const frames = spec.frames;
  const currentFrame = frames[frameIndex] || frames[0];

  // Palette extract
  const uniqueColors = Array.from(
    new Set(
      currentFrame.pixels.filter(
        (c) => c && c.trim() && c.toLowerCase() !== 'transparent'
      )
    )
  );

  const handleCopyColor = async (color: string) => {
    try {
      await navigator.clipboard.writeText(color);
      setCopiedColor(color);
      setTimeout(() => setCopiedColor(null), 1400);
    } catch {
      // Ignore
    }
  };

  const handleCopySvg = async () => {
    const svgStr = pixelArtToSvg(currentFrame, spec.width, spec.height);
    try {
      await navigator.clipboard.writeText(svgStr);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 1600);
    } catch {
      // Ignore
    }
  };

  const handleDownloadPng = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await pixelArtToPngBlob(currentFrame, spec.width, spec.height, 16);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(spec.title || 'pixel-art').toLowerCase().replace(/\s+/g, '-')}-${spec.width}x${spec.height}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#161616] text-[#0d0d0d] dark:text-[#ececec]">
      {/* Sub-bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 tabular-nums">
          <span className="font-medium text-[#0d0d0d] dark:text-white">
            {spec.title || 'Pixel Art'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {spec.width}×{spec.height}
          </span>
          <span aria-hidden="true">·</span>
          <span>{uniqueColors.length} colors</span>
          {frames.length > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {frames.length} frames ({fps} fps)
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenInStudio && (
            <button
              type="button"
              onClick={() => onOpenInStudio(spec)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <Paintbrush className="w-3 h-3" />
              <span>Open in Pixel Studio</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopySvg}
            title="Copy crisp SVG markup"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            {copiedSvg ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copiedSvg ? 'Copied' : 'SVG'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExporting}
            title="Download crisp 16× upscaled PNG"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="p-4 bg-neutral-100/90 dark:bg-[#121212] flex flex-col items-center justify-center gap-3">
        <div
          ref={canvasContainerRef}
          className="relative max-w-full overflow-auto p-4 rounded-xl border border-neutral-300 dark:border-white/15 bg-neutral-900 shadow-inner flex items-center justify-center"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            backgroundColor: '#09090b',
          }}
        >
          <canvas
            ref={canvasRef}
            className="image-render-pixel block shadow-2xl rounded-xs"
            style={{ imageRendering: 'pixelated' }}
          />

          {frames.length > 1 && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/75 text-white font-mono text-[11px] tabular-nums">
              {frameIndex + 1} / {frames.length}
            </div>
          )}
        </div>

        {/* Viewport Toolbar: Zoom, Grid & Animation */}
        <div className="w-full max-w-md flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              aria-pressed={showGrid}
              title="Toggle pixel grid lines"
              className={`inline-flex items-center gap-1 h-7 px-2 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                showGrid
                  ? 'bg-neutral-200 dark:bg-[#333] text-[#0d0d0d] dark:text-white font-medium'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>

            <div className="inline-flex items-center rounded-md bg-neutral-200/80 dark:bg-[#262626] p-0.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(2, z - 2))}
                disabled={zoomLevel <= 2}
                aria-label="Zoom out"
                className="w-6 h-6 inline-flex items-center justify-center rounded text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1.5 tabular-nums text-neutral-700 dark:text-neutral-200">
                {zoomLevel}×
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(24, z + 2))}
                disabled={zoomLevel >= 24}
                aria-label="Zoom in"
                className="w-6 h-6 inline-flex items-center justify-center rounded text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {frames.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setFrameIndex((i) => (i - 1 + frames.length) % frames.length);
                }}
                aria-label="Previous frame"
                className="w-7 h-7 inline-flex items-center justify-center rounded text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="px-2 py-1 rounded bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium inline-flex items-center gap-1"
              >
                {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setFrameIndex((i) => (i + 1) % frames.length);
                }}
                aria-label="Next frame"
                className="w-7 h-7 inline-flex items-center justify-center rounded text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Color Palette breakdown */}
        {uniqueColors.length > 0 && (
          <div className="w-full max-w-md pt-1 border-t border-neutral-200 dark:border-white/10 flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono mr-1">
              Palette:
            </span>
            {uniqueColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleCopyColor(color)}
                title={`Copy hex ${color}`}
                aria-label={`Copy color ${color}`}
                className="w-4 h-4 rounded-xs border border-white/20 hover:scale-125 transition-transform relative"
                style={{ backgroundColor: color }}
              >
                {copiedColor === color && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white bg-black/60 font-bold">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
