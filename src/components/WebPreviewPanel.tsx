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
  Plus,
  RotateCw,
  Server,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from 'lucide-react';

interface DnsRecordEntry {
  type: 'A' | 'CNAME' | 'TXT' | 'MX';
  host: string;
  value: string;
  ttl?: number;
}

interface SimulatedDomainRecord {
  domain: string;
  mode: 'workspace' | 'html' | 'proxy';
  registrar?: 'name.com' | 'local';
  sslEnabled?: boolean;
  dnsRecords?: DnsRecordEntry[];
  workspaceId?: string;
  entryFolder?: string;
  targetUrl?: string;
  title?: string;
  updatedAt?: number;
}

interface NameComSearchItem {
  domain: string;
  tld: string;
  available: boolean;
  priceUsd: number;
  renewalUsd: number;
  premium: boolean;
}

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
  { label: 'https://name.com', url: 'https://name.com' },
  { label: 'example.com', url: 'https://example.com' },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/' },
  { label: 'Three.js', url: 'https://threejs.org' },
];

function normalizeInputUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'https://example.com';
  if (trimmed.startsWith('/sandbox/') || trimmed.startsWith('/domain-preview/')) return trimmed;
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

  // Domain Simulator state
  const [domainDrawerOpen, setDomainDrawerOpen] = useState<boolean>(false);
  const [domainsList, setDomainsList] = useState<SimulatedDomainRecord[]>([]);
  const [newDomainName, setNewDomainName] = useState<string>('app.folio.local');
  const [newDomainMode, setNewDomainMode] = useState<'workspace' | 'html' | 'proxy'>('html');
  const [newDomainWorkspaceId, setNewDomainWorkspaceId] = useState<string>('folio-sandbox-1');
  const [newDomainEntryFolder, setNewDomainEntryFolder] = useState<string>('site');
  const [newDomainHtml, setNewDomainHtml] = useState<string>(
    '<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0f172a;color:#f8fafc;"><h1>Simulated Domain Active</h1><p>Hosted via Folio v(OXYGEN) Domain Simulator.</p></body></html>'
  );
  const [newDomainTargetUrl, setNewDomainTargetUrl] = useState<string>('https://example.com');
  const [domainBusy, setDomainBusy] = useState<boolean>(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [nameComQuery, setNameComQuery] = useState<string>('folio-studio');
  const [nameComResults, setNameComResults] = useState<NameComSearchItem[]>([]);
  const [nameComSearching, setNameComSearching] = useState<boolean>(false);
  const [sslEnabled, setSslEnabled] = useState<boolean>(true);
  const [dnsTargetIp, setDnsTargetIp] = useState<string>('104.21.48.192');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentUrl = history[historyIdx] || startUrl;
  const isNameComSimUrl = /^https?:\/\/(?:www\.)?name\.com(?:\/|$|\?)/i.test(currentUrl);

  const refreshDomains = useCallback(async () => {
    try {
      const res = await fetch('/api/domains');
      if (!res.ok) return;
      const data = (await res.json()) as { domains?: SimulatedDomainRecord[] };
      if (Array.isArray(data.domains)) {
        setDomainsList(data.domains);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    void refreshDomains();
  }, [refreshDomains]);

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

  // Fetch lightweight site metadata whenever currentUrl changes (skipped for local /sandbox/ & simulated name.com)
  useEffect(() => {
    let cancelled = false;
    setSiteInfo(null);
    setInspectError(null);

    if (isNameComSimUrl) {
      setPageTitle('Name.com · Simulated Domain Registrar & DNS');
      setIsLoadingFrame(false);
      return;
    }

    if (currentUrl.startsWith('/sandbox/') || currentUrl.startsWith('/domain-preview/')) {
      setPageTitle(
        currentUrl.startsWith('/domain-preview/')
          ? `https://${decodeURIComponent(currentUrl.replace('/domain-preview/', '').replace(/\/$/, ''))}`
          : 'Live Online Sandbox'
      );
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

  const handleBindDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setDomainError(null);
    setDomainBusy(true);
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomainName.trim(),
          mode: newDomainMode,
          workspaceId: newDomainWorkspaceId.trim() || 'folio-sandbox-1',
          entryFolder: newDomainEntryFolder.trim(),
          html: newDomainHtml,
          targetUrl: newDomainTargetUrl.trim(),
          title: newDomainName.trim(),
        }),
      });
      const data = (await res.json()) as { previewUrl?: string; error?: string };
      if (!res.ok || !data.previewUrl) {
        throw new Error(data.error || 'Could not register simulated domain.');
      }
      await refreshDomains();
      navigateTo(data.previewUrl);
      setDomainDrawerOpen(false);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Domain registration failed.');
    } finally {
      setDomainBusy(false);
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    try {
      await fetch(`/api/domains/${encodeURIComponent(domain)}`, { method: 'DELETE' });
      void refreshDomains();
    } catch {
      // Ignore
    }
  };

  const handleSearchNameCom = useCallback(async (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setNameComSearching(true);
    setDomainError(null);
    try {
      const res = await fetch(`/api/domains/namecom/search?q=${encodeURIComponent(clean)}`);
      const data = (await res.json()) as { results?: NameComSearchItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Name.com search failed');
      setNameComResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Name.com lookup failed');
    } finally {
      setNameComSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isNameComSimUrl && nameComResults.length === 0 && !nameComSearching) {
      void handleSearchNameCom(nameComQuery);
    }
  }, [isNameComSimUrl, nameComResults.length, nameComSearching, nameComQuery, handleSearchNameCom]);

  const handleRegisterNameCom = async (domainToReg: string) => {
    setDomainBusy(true);
    setDomainError(null);
    try {
      const res = await fetch('/api/domains/namecom/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domainToReg,
          mode: newDomainMode,
          workspaceId: newDomainWorkspaceId.trim() || 'folio-sandbox-1',
          entryFolder: newDomainEntryFolder.trim(),
          html: newDomainHtml,
          targetUrl: newDomainTargetUrl.trim(),
          sslEnabled,
          dnsRecords: [
            { type: 'A', host: '@', value: dnsTargetIp || '104.21.48.192', ttl: 300 },
            { type: 'CNAME', host: 'www', value: domainToReg, ttl: 300 },
            { type: 'TXT', host: '@', value: `v=folio-oxygen site=${domainToReg}`, ttl: 300 },
          ],
        }),
      });
      const data = (await res.json()) as { previewUrl?: string; error?: string };
      if (!res.ok || !data.previewUrl) {
        throw new Error(data.error || 'Could not register domain on Name.com sim');
      }
      await refreshDomains();
      await handleSearchNameCom(nameComQuery);
      navigateTo(data.previewUrl);
      setDomainDrawerOpen(false);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Name.com registration failed');
    } finally {
      setDomainBusy(false);
    }
  };

  const isLocalSandbox =
    currentUrl.startsWith('/sandbox/') || currentUrl.startsWith('/domain-preview/');
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
          <button
            type="button"
            onClick={() => setDomainDrawerOpen((v) => !v)}
            title="Custom Domain Simulator"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              domainDrawerOpen || currentUrl.startsWith('/domain-preview/')
                ? 'bg-emerald-600 text-white'
                : 'border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Domain Sim</span>
          </button>

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

      {/* Domain Simulator Drawer */}
      {domainDrawerOpen && (
        <div className="border-b border-neutral-200 dark:border-white/10 bg-[#f7f8fa] dark:bg-[#18191e] p-3 space-y-3 shrink-0 max-h-72 overflow-y-auto chat-scroll">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
              Custom Domain Simulator ({domainsList.length})
            </span>
            <button
              type="button"
              onClick={() => setDomainDrawerOpen(false)}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleBindDomain} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                placeholder="app.folio.local"
                className="sm:col-span-2 h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#111216] px-2.5 text-xs font-mono text-[#0d0d0d] dark:text-white"
              />
              <select
                value={newDomainMode}
                onChange={(e) =>
                  setNewDomainMode(e.target.value as 'workspace' | 'html' | 'proxy')
                }
                className="h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#111216] px-2 text-xs text-[#0d0d0d] dark:text-white"
              >
                <option value="html">Custom HTML</option>
                <option value="workspace">Sandbox Folder</option>
                <option value="proxy">Proxy Target</option>
              </select>
            </div>

            {newDomainMode === 'workspace' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newDomainWorkspaceId}
                  onChange={(e) => setNewDomainWorkspaceId(e.target.value)}
                  placeholder="workspaceId (folio-sandbox-1)"
                  className="h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#111216] px-2.5 text-xs font-mono"
                />
                <input
                  type="text"
                  value={newDomainEntryFolder}
                  onChange={(e) => setNewDomainEntryFolder(e.target.value)}
                  placeholder="folder (e.g. site)"
                  className="h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#111216] px-2.5 text-xs font-mono"
                />
              </div>
            )}

            {newDomainMode === 'html' && (
              <textarea
                value={newDomainHtml}
                onChange={(e) => setNewDomainHtml(e.target.value)}
                rows={2}
                placeholder="<!doctype html>..."
                className="w-full rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#111216] p-2 text-[11px] font-mono"
              />
            )}

            {newDomainMode === 'proxy' && (
              <input
                type="text"
                value={newDomainTargetUrl}
                onChange={(e) => setNewDomainTargetUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#111216] px-2.5 text-xs font-mono"
              />
            )}

            {domainError && <p className="text-[11px] text-red-500">{domainError}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={domainBusy}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {domainBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Bind &amp; Open Domain</span>
              </button>
            </div>
          </form>

          {domainsList.length > 0 && (
            <div className="space-y-1">
              {domainsList.map((d) => (
                <div
                  key={d.domain}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#121318] text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo(`/domain-preview/${encodeURIComponent(d.domain)}/`);
                      setDomainDrawerOpen(false);
                    }}
                    className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline truncate text-left flex-1"
                  >
                    {d.domain} ({d.mode})
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteDomain(d.domain)}
                    aria-label={`Delete ${d.domain}`}
                    className="p-1 text-neutral-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        {isNameComSimUrl ? (
          <div className="w-full h-full overflow-y-auto chat-scroll bg-[#0b1020] text-slate-100 p-5 sm:p-7">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Name.com Simulated Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-sm">
                    N
                  </div>
                  <div>
                    <div className="text-base font-bold tracking-tight text-white">
                      name.com <span className="text-[11px] font-mono font-normal text-emerald-400">· Folio Registrar Sim</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Instant domain search, TLS/SSL provisioning &amp; live Folio hosting binding
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">HTTPS · Simulated Registrar</span>
              </div>

              {/* Search Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSearchNameCom(nameComQuery);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={nameComQuery}
                  onChange={(e) => setNameComQuery(e.target.value)}
                  placeholder="Find your domain (e.g. orbitlab, my-studio.ai)..."
                  className="flex-1 h-10 rounded-xl border border-white/15 bg-slate-900 px-3.5 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  disabled={nameComSearching}
                  className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 shrink-0"
                >
                  {nameComSearching ? 'Searching...' : 'Search Domains'}
                </button>
              </form>

              {/* Target Binding Options */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/70 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Host Mode</label>
                  <select
                    value={newDomainMode}
                    onChange={(e) => setNewDomainMode(e.target.value as 'workspace' | 'html' | 'proxy')}
                    className="w-full h-8 rounded-lg border border-white/15 bg-slate-950 px-2 text-xs text-white"
                  >
                    <option value="workspace">Active Workspace ({newDomainWorkspaceId})</option>
                    <option value="html">Custom HTML Landing</option>
                    <option value="proxy">External Proxy Target</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Primary A Record IP</label>
                  <input
                    type="text"
                    value={dnsTargetIp}
                    onChange={(e) => setDnsTargetIp(e.target.value)}
                    className="w-full h-8 rounded-lg border border-white/15 bg-slate-950 px-2.5 text-xs font-mono text-white"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sslEnabled}
                      onChange={(e) => setSslEnabled(e.target.checked)}
                      className="accent-emerald-400"
                    />
                    <span>Provision Let&apos;s Encrypt SSL</span>
                  </label>
                </div>
              </div>

              {domainError && (
                <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                  {domainError}
                </div>
              )}

              {/* Search Results */}
              <div className="space-y-2">
                {nameComResults.map((item) => (
                  <div
                    key={item.domain}
                    className="p-3 rounded-xl border border-white/10 bg-slate-900/80 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-white truncate">
                        {item.domain}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.available
                          ? `Available · $${item.priceUsd.toFixed(2)}/yr (renews $${item.renewalUsd.toFixed(2)})`
                          : 'Already registered in Folio DNS'}
                      </div>
                    </div>

                    {item.available ? (
                      <button
                        type="button"
                        disabled={domainBusy}
                        onClick={() => void handleRegisterNameCom(item.domain)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors shrink-0 disabled:opacity-50"
                      >
                        Register &amp; Launch
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(`/domain-preview/${encodeURIComponent(item.domain)}/`)
                        }
                        className="px-3 py-1.5 rounded-lg border border-emerald-400/40 text-emerald-300 text-xs font-medium hover:bg-emerald-500/10 shrink-0"
                      >
                        Visit Site
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Registered Domains + DNS Records */}
              {domainsList.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="text-xs font-semibold text-slate-300">
                    Registered Domains &amp; DNS Zones ({domainsList.length})
                  </div>
                  {domainsList.map((d) => (
                    <div
                      key={d.domain}
                      className="p-3 rounded-xl border border-white/10 bg-slate-950/70 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigateTo(`/domain-preview/${encodeURIComponent(d.domain)}/`)
                          }
                          className="font-mono text-xs font-semibold text-emerald-400 hover:underline truncate"
                        >
                          https://{d.domain}
                        </button>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{d.registrar === 'name.com' ? 'Name.com Sim' : 'Local'}</span>
                          <span>{d.sslEnabled !== false ? '· SSL Active' : ''}</span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteDomain(d.domain)}
                            className="text-slate-500 hover:text-red-400"
                            title="Release domain"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {d.dnsRecords && d.dnsRecords.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px] font-mono text-slate-400">
                          {d.dnsRecords.map((rec, rIdx) => (
                            <div key={rIdx} className="px-2 py-1 rounded bg-white/5 truncate">
                              {rec.type} {rec.host} → {rec.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </aside>
  );
};
