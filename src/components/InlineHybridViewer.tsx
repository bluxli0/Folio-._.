import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Download,
  FileCode2,
  Film,
  Layers,
  Sparkles,
} from 'lucide-react';
import { VectorStopMotionSpec } from '../types/stopMotion';
import {
  exportHybridXml,
  HybridEngineKind,
  parseHybridCode,
} from '../utils/hybridEngines';
import { serializeFramesToStopMotionCode } from '../utils/vectorBrushes';
import { InlineStopMotionPlayer } from './InlineStopMotionPlayer';

interface InlineHybridViewerProps {
  kind: HybridEngineKind;
  code: string;
  compact?: boolean;
  onOpenStopMotionSpec?: (spec: VectorStopMotionSpec) => void;
}

const ENGINE_LABELS: Record<HybridEngineKind, { title: string; badge: string; desc: string }> = {
  liquidmotion: {
    title: 'Liquid Motion',
    badge: 'SVG + Procedural FX',
    desc: 'Animated organic & fluid procedural motion timeline',
  },
  liquiddrop: {
    title: 'Liquid Drop',
    badge: 'Still Composite',
    desc: 'High-fidelity still graphic with procedural SVG/CSS filters',
  },
  pixelmotion: {
    title: 'Pixel Motion',
    badge: 'Pixel + StopMotion Timeline',
    desc: 'Crisp pixel matrices animated along a Stop Motion v3 camera & audio timeline',
  },
  motiondrop: {
    title: 'Motion Drop',
    badge: 'Lit 3D + Pixel Still',
    desc: 'Studio-lit 3D geometry & contact shadows blended with crisp pixel art',
  },
};

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

export const InlineHybridViewer: React.FC<InlineHybridViewerProps> = ({
  kind,
  code,
  compact = true,
  onOpenStopMotionSpec,
}) => {
  const parsed = useMemo(() => parseHybridCode(kind, code), [kind, code]);
  const result = parsed.result;
  const meta = ENGINE_LABELS[kind];
  const [showFidelityNotes, setShowFidelityNotes] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!result) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300 border-t border-neutral-200 dark:border-white/10">
        {parsed.error || `Could not render ${meta.title} composition.`}
      </div>
    );
  }

  const slug = (result.title || kind)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const handleDownloadJson = () => {
    const blob = new Blob([result.rawJson], { type: 'application/json;charset=utf-8' });
    triggerDownload(blob, `${slug || kind}.json`);
  };

  const handleDownloadXml = () => {
    const xml = exportHybridXml(result);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    triggerDownload(blob, `${slug || kind}.xml`);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(result.rawJson);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDownloadStillSvg = () => {
    if (!result.svgMarkup) return;
    const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${result.width} ${result.height}" width="${result.width}" height="${result.height}">\n  <rect width="100%" height="100%" fill="${result.background}" />\n  ${result.svgMarkup}\n</svg>`;
    const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `${slug || kind}.svg`);
  };

  const handleDownloadStillPng = async () => {
    if (!result.dataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not decode still image'));
      img.src = result.dataUrl!;
    });
    ctx.drawImage(img, 0, 0, result.width, result.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (blob) triggerDownload(blob, `${slug || kind}.png`);
  };

  // Animated hybrid video specs delegate stage & export to StopMotionPlayer
  const compiledCodeForVideo = useMemo(() => {
    if (result.outputType !== 'video' || !result.stopMotionSpec) return '';
    if (result.stopMotionSpec.sourceScene) {
      return JSON.stringify(result.stopMotionSpec.sourceScene);
    }
    return serializeFramesToStopMotionCode(
      result.stopMotionSpec.frames,
      result.stopMotionSpec.fps,
      result.stopMotionSpec.width,
      result.stopMotionSpec.height,
      result.stopMotionSpec.background,
      result.stopMotionSpec.pingPong,
      result.stopMotionSpec.title
    );
  }, [result]);

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#161616] text-[#0d0d0d] dark:text-[#ececec]">
      {/* Hybrid Engine Sub-bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-neutral-600 dark:text-neutral-300 tabular-nums min-w-0">
          <span className="font-semibold text-[#0d0d0d] dark:text-white truncate">
            {meta.title}: {result.title}
          </span>
          <span aria-hidden="true">·</span>
          <span>{meta.badge}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">
            {result.width}×{result.height}
          </span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setShowFidelityNotes((v) => !v)}
            className="text-neutral-700 dark:text-neutral-200 underline decoration-dotted underline-offset-4 hover:text-[#0d0d0d] dark:hover:text-white whitespace-nowrap shrink-0"
          >
            Fidelity {result.fidelity.score}/100
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {result.outputType === 'still' && (
            <>
              <button
                type="button"
                onClick={handleDownloadStillSvg}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                <FileCode2 className="w-3 h-3" />
                <span>SVG</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadStillPng()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>PNG</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownloadXml}
            title="Export hybrid composition as XML"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Code2 className="w-3 h-3" />
            <span>XML</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            title="Export hybrid composition as JSON"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopyJson()}
            title="Copy JSON specification"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            {copiedJson ? <Check className="w-3 h-3 text-emerald-500" /> : <Layers className="w-3 h-3" />}
            <span>{copiedJson ? 'Copied' : 'Spec'}</span>
          </button>
        </div>
      </div>

      {showFidelityNotes && result.fidelity.notes.length > 0 && (
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-white/10 bg-neutral-100/70 dark:bg-[#1a1a1a] text-[11px] text-neutral-600 dark:text-neutral-300 space-y-0.5">
          <div className="font-medium text-[#0d0d0d] dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Pre-flight Engine Verification</span>
          </div>
          {result.fidelity.notes.map((n, i) => (
            <div key={i} className="pl-4">
              · {n}
            </div>
          ))}
        </div>
      )}

      {result.outputType === 'video' && result.stopMotionSpec ? (
        <InlineStopMotionPlayer
          code={compiledCodeForVideo}
          compact={compact}
          onOpenInStudio={onOpenStopMotionSpec}
        />
      ) : (
        <div className="p-4 bg-neutral-100/80 dark:bg-[#111111] flex flex-col items-center gap-2.5">
          <div
            className={`relative w-full ${
              compact ? 'max-w-[520px]' : 'max-w-[680px]'
            } rounded-xl overflow-hidden border border-neutral-300 dark:border-white/15 bg-neutral-950 flex items-center justify-center`}
            style={{ aspectRatio: `${result.width} / ${result.height}` }}
          >
            {result.dataUrl && (
              <img
                src={result.dataUrl}
                alt={result.title}
                className="w-full h-full object-contain"
              />
            )}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[11px] tabular-nums">
              {kind} · {result.width}×{result.height}
            </div>
          </div>

          {onOpenStopMotionSpec && result.svgMarkup && (
            <button
              type="button"
              onClick={() =>
                onOpenStopMotionSpec({
                  format: 'stopmotion/v3',
                  title: result.title,
                  fps: 24,
                  width: result.width,
                  height: result.height,
                  background: result.background,
                  loop: true,
                  pingPong: false,
                  frames: [
                    {
                      id: crypto.randomUUID(),
                      dataUrl: result.dataUrl || '',
                      svgMarkup: result.svgMarkup,
                      background: result.background,
                      hold: 1,
                      createdAt: Date.now(),
                    },
                  ],
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <Film className="w-3 h-3" />
              <span>Promote Still to Stop Motion Studio</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
