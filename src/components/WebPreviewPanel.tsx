import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  ExternalLink,
  Globe,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';

interface WebPreviewPanelProps {
  initialUrl: string;
  onClose: () => void;
  onImportHtmlToCode?: (html: string, sourceUrl: string) => void;
}

interface SiteInspectInfo {
  finalUrl: string;
  status: number;
  statusText: string;
  contentType: string;
  title: string;
  description?: string;
  frameBlockedByHeader: boolean;
  html?: string;
}

type ViewportPreset = 'desktop' | 'tablet' | 'mobile';
type RenderMode = 'proxy' | 'direct';

const QUICK_SITES = [
  { label: 'example.com', url: 'https://example.com' },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com' },
  { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/' },
  { label: 'Three.js', url: 'https://threejs.org' },
];

function normalizeInputUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'https://example.com';
  if (trimmed.startsWith('/sandbox/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const WebPreviewPanel: React.FC<WebPreviewPanelProps> = ({
  initialUrl,
  onClose,
  onImportHtmlToCode,
}) => {
  const startUrl = useMemo(() => normalizeInputUrl(initialUrl), [initialUrl]);

  const [history, setHistory] = useState<string[]>([startUrl]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const [addressInput, setAddressInput] = useState<string>(startUrl);
  const [renderMode, setRenderMode] = useState<RenderMode>('proxy');
  const [viewport, setViewport] = useState<ViewportPreset>('desktop');
  const [expandedWide, setExpandedWide] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [isLoadingFrame, setIsLoadingFrame] = useState<boolean>(true);
  const [pageTitle, setPageTitle] = useState<string>(startUrl);
  const [siteInfo, setSiteInfo] = useState<SiteInspectInfo | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [isImportingHtml, setIsImportingHtml] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentUrl = history[historyIdx] || startUrl;

  // Sync when external initialUrl prop changes (e.g., user clicks Preview on a chat link)
  useEffect(() => {
    const normalized = normalizeInputUrl(initialUrl);
    setAddressInput(normalized);
    setHistory((prev) => {
      if (prev[historyIdx] === normalized) return prev;
      const next = [...prev.slice(0, historyIdx + 1), normalized];
      setHistoryIdx(next.length - 1);
      return next;
    });
    setIsLoadingFrame(true);
    setInspectError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const navigateTo = useCallback(
    (rawTarget: string) => {
      const normalized = normalizeInputUrl(rawTarget);
      setAddressInput(normalized);
      setInspectError(null);
      setIsLoadingFrame(true);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIdx + 1);
        if (sliced[sliced.length - 1] === normalized) {
          setReloadNonce((n) => n + 1);
          return sliced;
        }
        const next = [...sliced, normalized];
        setHistoryIdx(next.length - 1);
        return next;
      });
    },
    [historyIdx]
  );

  // Listen for in-iframe link clicks & title updates from /api/web/render script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }
      const data = event.data as {
        source?: string;
        type?: string;
        title?: string;
        url?: string;
      };
      if (!data || data.source !== 'folio-web-preview') return;

      if (data.type === 'loaded') {
        setIsLoadingFrame(false);
        if (data.title) setPageTitle(data.title);
      } else if (data.type === 'navigate' && data.url) {
        navigateTo(data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigateTo]);

  // Fetch lightweight site metadata whenever currentUrl changes (skipped for local /sandbox/ paths)
  useEffect(() => {
    let cancelled = false;
    setSiteInfo(null);
    setInspectError(null);

    if (currentUrl.startsWith('/sandbox/')) {
      setPageTitle('Live Online Sandbox');
      return;
    }

    const controller = new AbortController();
    fetch(`/api/web/inspect?url=${encodeURIComponent(currentUrl)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as SiteInspectInfo & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setInspectError(data.error || 'Could not inspect website.');
          return;
        }
        setSiteInfo(data);
        if (data.title) setPageTitle(data.title);
      })
      .catch(() => {
        // Ignore abort / transient inspect failure while iframe renders
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentUrl, reloadNonce]);

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(addressInput);
  };

  const handleBack = () => {
    if (historyIdx <= 0) return;
    const nextIdx = historyIdx - 1;
    setHistoryIdx(nextIdx);
    setAddressInput(history[nextIdx]);
    setIsLoadingFrame(true);
  };

  const handleForward = () => {
    if (historyIdx >= history.length - 1) return;
    const nextIdx = historyIdx + 1;
    setHistoryIdx(nextIdx);
    setAddressInput(history[nextIdx]);
    setIsLoadingFrame(true);
  };

  const handleReload = () => {
    setIsLoadingFrame(true);
    setReloadNonce((n) => n + 1);
  };

  const handleImportToCode = async () => {
    if (!onImportHtmlToCode) return;
    if (siteInfo?.html) {
      onImportHtmlToCode(siteInfo.html, siteInfo.finalUrl || currentUrl);
      return;
    }
    setIsImportingHtml(true);
    try {
      const res = await fetch(`/api/web/inspect?url=${encodeURIComponent(currentUrl)}`);
      const data = (await res.json()) as SiteInspectInfo & { error?: string };
      if (!res.ok || !data.html) {
        throw new Error(data.error || 'No HTML source available for this URL.');
      }
      onImportHtmlToCode(data.html, data.finalUrl || currentUrl);
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : 'Unable to import HTML source.');
    } finally {
      setIsImportingHtml(false);
    }
  };

  const isLocalSandbox = currentUrl.startsWith('/sandbox/');
  const iframeSrc =
    isLocalSandbox || renderMode === 'direct'
      ? currentUrl
      : `/api/web/render?url=${encodeURIComponent(currentUrl)}`;

  const externalHref = isLocalSandbox
    ? currentUrl
    : siteInfo?.finalUrl || currentUrl;

  return (
    <aside
      aria-label="Website preview and renderer"
      className={`fixed inset-0 z-40 lg:static lg:z-auto ${
        expandedWide ? 'lg:w-[760px] lg:max-w-[65vw]' : 'lg:w-[580px] lg:max-w-[52vw]'
      } w-full h-full shrink-0 border-l border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] flex flex-col overflow-hidden transition-[width] duration-150`}
    >
      {/* Top Bar */}
      <div className="h-14 shrink-0 px-3 sm:px-4 border-b border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#171717] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-[#0d0d0d] dark:text-white truncate">
            Web Preview
          </span>
          <span className="hidden sm:inline text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[200px]">
            · {pageTitle}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Proxy vs Direct Toggle */}
          {!isLocalSandbox && (
            <button
              type="button"
              onClick={() => {
                setIsLoadingFrame(true);
                setRenderMode((m) => (m === 'proxy' ? 'direct' : 'proxy'));
              }}
              title={
                renderMode === 'proxy'
                  ? 'Proxy Render active (bypasses X-Frame-Options). Click for direct iframe.'
                  : 'Direct iframe active. Click for Folio Proxy Render.'
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                renderMode === 'proxy'
                  ? 'bg-blue-600 text-white'
                  : 'border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{renderMode === 'proxy' ? 'Proxy Render' : 'Direct Iframe'}</span>
            </button>
          )}

          {/* Edit HTML in Code Workbench */}
          {onImportHtmlToCode && !isLocalSandbox && (
            <button
              type="button"
              onClick={handleImportToCode}
              disabled={isImportingHtml}
              title="Open website HTML in Code Workbench to edit or publish online"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/10 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {isImportingHtml ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Code2 className="w-3.5 h-3.5" />
              )}
              <span>Edit Source</span>
            </button>
          )}

          {/* Expand panel width */}
          <button
            type="button"
            onClick={() => setExpandedWide((w) => !w)}
            aria-label={expandedWide ? 'Restore panel width' : 'Widen preview panel'}
            title={expandedWide ? 'Standard width' : 'Wider view'}
            className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            {expandedWide ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open website in new browser tab"
            title="Open in new tab"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close web preview"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Browser Address & Viewport Toolbar */}
      <div className="px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1f1f1f] space-y-2 shrink-0">
        <form onSubmit={handleSubmitUrl} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBack}
            disabled={historyIdx <= 0}
            aria-label="Back"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={historyIdx >= history.length - 1}
            aria-label="Forward"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReload}
            aria-label="Reload page"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors shrink-0"
          >
            <RotateCw className={`w-4 h-4 ${isLoadingFrame ? 'animate-spin' : ''}`} />
          </button>

          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="https://example.com"
            aria-label="Website URL"
            className="flex-1 min-w-0 h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-[#f5f5f5] dark:bg-[#2a2a2a] px-3 text-xs font-mono text-[#0d0d0d] dark:text-[#ececec] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />

          <button
            type="submit"
            className="h-8 px-3 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            Render
          </button>
        </form>

        {/* Quick Sites + Viewport Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1 overflow-x-auto max-w-full">
            {QUICK_SITES.map((site) => {
              const active = currentUrl.startsWith(site.url);
              return (
                <button
                  key={site.url}
                  type="button"
                  onClick={() => navigateTo(site.url)}
                  className={`px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10'
                  }`}
                >
                  {site.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-white/10 p-0.5 bg-[#f5f5f5] dark:bg-[#262626] shrink-0">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              title="Desktop viewport (100%)"
              aria-label="Desktop viewport"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${
                viewport === 'desktop'
                  ? 'bg-white dark:bg-[#3a3a3a] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              <Monitor className="w-3 h-3" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setViewport('tablet')}
              title="Tablet viewport (768px)"
              aria-label="Tablet viewport"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${
                viewport === 'tablet'
                  ? 'bg-white dark:bg-[#3a3a3a] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              <Tablet className="w-3 h-3" />
              <span className="hidden sm:inline">768</span>
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              title="Mobile viewport (390px)"
              aria-label="Mobile viewport"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${
                viewport === 'mobile'
                  ? 'bg-white dark:bg-[#3a3a3a] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span className="hidden sm:inline">390</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unboxed Metadata Bar */}
      <div className="px-3 sm:px-4 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#fafafa] dark:bg-[#171717] text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between gap-2 tabular-nums shrink-0">
        <div className="flex items-center gap-2 min-w-0 truncate">
          {siteInfo ? (
            <>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                HTTP {siteInfo.status}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{siteInfo.finalUrl}</span>
              {siteInfo.frameBlockedByHeader && renderMode === 'proxy' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    X-Frame bypassed
                  </span>
                </>
              )}
            </>
          ) : inspectError ? (
            <span className="text-amber-600 dark:text-amber-400 truncate">
              {inspectError}
            </span>
          ) : (
            <span className="truncate">{currentUrl}</span>
          )}
        </div>
        <span className="shrink-0">
          {viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '768px' : '390px'}
        </span>
      </div>

      {/* Rendered Viewport Canvas */}
      <div className="flex-1 min-h-0 bg-neutral-100 dark:bg-[#101216] flex justify-center overflow-auto relative">
        {isLoadingFrame && (
          <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0d0d0d]/85 text-white text-[11px] font-medium backdrop-blur-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Rendering...</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={`${iframeSrc}-${reloadNonce}`}
          src={iframeSrc}
          title={`Website preview: ${pageTitle}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setIsLoadingFrame(false)}
          className={`h-full border-0 bg-white transition-all duration-150 ${
            viewport === 'mobile'
              ? 'w-[390px] max-w-full my-3 rounded-2xl shadow-xl border border-neutral-300 dark:border-white/15'
              : viewport === 'tablet'
              ? 'w-[768px] max-w-full my-3 rounded-xl shadow-xl border border-neutral-300 dark:border-white/15'
              : 'w-full'
          }`}
        />
      </div>
    </aside>
  );
};
