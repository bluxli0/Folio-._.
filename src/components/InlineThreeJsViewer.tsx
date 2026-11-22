import React, { useMemo, useState } from 'react';
import { Box, Code2, Download, ExternalLink, RotateCw, Sparkles } from 'lucide-react';
import { ThreeDSceneSpec } from '../types/threeD';
import { buildThreeJsHtml, parseThreeDCode, serializeThreeDToCode } from '../utils/threeDParser';

interface InlineThreeJsViewerProps {
  code: string;
  compact?: boolean;
  onOpenInStudio?: (spec: ThreeDSceneSpec) => void;
}

export const InlineThreeJsViewer: React.FC<InlineThreeJsViewerProps> = ({
  code,
  compact = true,
  onOpenInStudio,
}) => {
  const parsed = useMemo(() => parseThreeDCode(code), [code]);
  const spec = parsed.spec;
  const [iframeKey, setIframeKey] = useState<number>(0);
  const srcDoc = useMemo(() => (spec ? buildThreeJsHtml(spec) : ''), [spec]);

  if (!spec) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-xs font-mono text-red-700 dark:text-red-300">
        {parsed.error || 'Could not parse Three.js 3D scene spec.'}
      </div>
    );
  }

  const handleDownloadSnapshot = () => {
    const iframe = document.getElementById(`three-iframe-${iframeKey}`) as HTMLIFrameElement | null;
    if (!iframe || !iframe.contentWindow) return;

    const triggerDownload = (dataUrl: string) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = '3d-scene-snapshot.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    try {
      const canvas = iframe.contentWindow.document.querySelector('canvas');
      if (canvas) {
        triggerDownload(canvas.toDataURL('image/png'));
        return;
      }
    } catch {
      // Expected for sandbox="allow-scripts" opaque origin; use postMessage
    }

    const requestId = `snap-${Date.now()}-${Math.random()}`;
    const onMessage = (ev: MessageEvent) => {
      if (
        ev.data &&
        ev.data.type === 'folio-three-snapshot-data' &&
        ev.data.requestId === requestId &&
        typeof ev.data.dataUrl === 'string'
      ) {
        window.removeEventListener('message', onMessage);
        triggerDownload(ev.data.dataUrl);
      }
    };
    window.addEventListener('message', onMessage);
    setTimeout(() => window.removeEventListener('message', onMessage), 2500);
    iframe.contentWindow.postMessage({ type: 'folio-three-snapshot-request', requestId }, '*');
  };

  const bbElements = Array.isArray((spec.bbmodel as { elements?: unknown[] } | undefined)?.elements)
    ? ((spec.bbmodel as { elements?: unknown[] }).elements?.length ?? 0)
    : 0;
  const voxelCount = spec.voxels?.length || 0;
  const partCount = bbElements || voxelCount || spec.objects?.length || 0;
  const partLabel = bbElements ? 'cubes' : voxelCount ? 'voxels' : 'objects';

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#161616] text-[#0d0d0d] dark:text-[#ececec]">
      {/* Sub-bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 tabular-nums">
          <Box className="w-3.5 h-3.5 text-blue-500" />
          <span className="font-medium text-[#0d0d0d] dark:text-white">
            {spec.title || 'Three.js 3D Scene'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {partCount} {partLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenInStudio && (
            <button
              type="button"
              onClick={() => onOpenInStudio(spec)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Open in 3D Studio</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Reset simulation"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDownloadSnapshot}
            title="Download PNG snapshot"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>Snapshot</span>
          </button>
        </div>
      </div>

      {/* WebGL Canvas Viewport */}
      <div className="p-3 bg-neutral-950 flex flex-col items-center">
        <div
          className={`relative w-full ${
            compact ? 'max-w-[520px]' : 'max-w-[720px]'
          } rounded-xl overflow-hidden border border-neutral-300 dark:border-white/15 bg-black shadow-inner flex items-center justify-center`}
          style={{ aspectRatio: '16 / 10' }}
        >
          <iframe
            key={iframeKey}
            id={`three-iframe-${iframeKey}`}
            srcDoc={srcDoc}
            title={spec.title || '3D Viewport'}
            className="w-full h-full border-0 pointer-events-auto"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
};
