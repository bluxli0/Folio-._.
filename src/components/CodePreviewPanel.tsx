import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Columns2,
  Copy,
  Dices,
  Download,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Play,
  RotateCw,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Terminal,
  Upload,
  X,
} from 'lucide-react';
import {
  CODE_TEMPLATES,
  PREVIEW_LANGUAGE_OPTIONS,
  buildCssSrcDoc,
  buildFletSrcDoc,
  buildHtmlSrcDoc,
  buildJsRunnerSrcDoc,
  buildNiceGuiSrcDoc,
  buildPyScriptSrcDoc,
  buildReactSrcDoc,
  getFileExtension,
  getPreviewCategory,
  isNativeExecutable,
  normalizeLanguage,
  parseCsvRows,
} from '../utils/codePreview';
import { hasThirdPartyImports } from '../utils/sandpackHelpers';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SandpackWorkbench } from './SandpackWorkbench';
import { InlineStopMotionPlayer } from './InlineStopMotionPlayer';
import { InlinePixelArtViewer } from './InlinePixelArtViewer';
import { InlineThreeJsViewer } from './InlineThreeJsViewer';
import {
  PublishSandboxResult,
  canPublishOnlineSandbox,
  publishOnlineSandbox,
} from '../utils/sandboxOnline';
import { DesignSystemStudio } from './DesignSystemStudio';
import { FolderSandboxPanel } from './FolderSandboxPanel';
import { DesignSystemConfig } from '../types/designSystem';
import {
  DEFAULT_DESIGN_SYSTEM,
  buildPreviewBundleJson,
  generateDesignSystemFromSeed,
  generateRandomSeed,
  parseUploadedPreviewJson,
} from '../utils/designSystem';

const DESIGN_SYSTEM_STORAGE_KEY = 'folio-design-system-v1';
const DEFAULT_WORKSPACE_ID = 'folio-sandbox-1';

function loadInitialDesignSystem(): DesignSystemConfig {
  try {
    const raw = localStorage.getItem(DESIGN_SYSTEM_STORAGE_KEY);
    if (!raw) return DEFAULT_DESIGN_SYSTEM;
    const parsed = JSON.parse(raw) as Partial<DesignSystemConfig>;
    return {
      ...DEFAULT_DESIGN_SYSTEM,
      ...parsed,
      customVars: Array.isArray(parsed.customVars)
        ? parsed.customVars
        : DEFAULT_DESIGN_SYSTEM.customVars,
    };
  } catch {
    return DEFAULT_DESIGN_SYSTEM;
  }
}

export interface CodePreviewData {
  id: string;
  code: string;
  language: string;
}

interface ConsoleEntry {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs?: number;
  mode: 'native' | 'simulated';
  runtime?: string;
  summary?: string;
}

interface CodePreviewPanelProps {
  preview: CodePreviewData;
  appTheme: 'light' | 'dark';
  onClose: () => void;
}

function JsonNode({
  name,
  value,
  depth = 0,
}: {
  name?: string;
  value: unknown;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null || typeof value !== 'object') {
    const colorClass =
      typeof value === 'string'
        ? 'text-emerald-600 dark:text-emerald-400'
        : typeof value === 'number'
        ? 'text-blue-600 dark:text-blue-400'
        : typeof value === 'boolean'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-neutral-500 dark:text-neutral-400';

    return (
      <div className="font-mono text-xs leading-6 flex items-baseline gap-1.5 pl-4">
        {name !== undefined && (
          <span className="text-neutral-600 dark:text-neutral-300 shrink-0">
            {name}:
          </span>
        )}
        <span className={`${colorClass} break-all`}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((v, idx) => [String(idx), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div className="font-mono text-xs leading-6">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1 text-left hover:bg-neutral-200/60 dark:hover:bg-white/10 rounded px-1 py-0.5 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
        )}
        {name !== undefined && (
          <span className="text-neutral-700 dark:text-neutral-200 font-medium">
            {name}:
          </span>
        )}
        <span className="text-neutral-500 dark:text-neutral-400">
          {isArray ? `Array(${entries.length})` : `Object{${entries.length}}`}
        </span>
      </button>

      {expanded && (
        <div className="ml-3 pl-2 border-l border-neutral-200 dark:border-white/10">
          {entries.length === 0 ? (
            <div className="pl-4 text-neutral-400 italic">empty</div>
          ) : (
            entries.map(([k, v]) => <JsonNode key={k} name={k} value={v} depth={depth + 1} />)
          )}
        </div>
      )}
    </div>
  );
}

export const CodePreviewPanel: React.FC<CodePreviewPanelProps> = ({
  preview,
  appTheme,
  onClose,
}) => {
  const [code, setCode] = useState(preview.code);
  const [language, setLanguage] = useState(() =>
    normalizeLanguage(preview.language, preview.code)
  );
  const [viewMode, setViewMode] = useState<
    'preview' | 'split' | 'code' | 'sandpack' | 'folder' | 'design'
  >(() => {
    const norm = normalizeLanguage(preview.language, preview.code);
    return getPreviewCategory(norm) === 'sandpack' || hasThirdPartyImports(preview.code)
      ? 'sandpack'
      : 'preview';
  });
  const [darkCanvas, setDarkCanvas] = useState(appTheme === 'dark');
  const [viewportWidth, setViewportWidth] = useState<'full' | 'mobile'>('full');
  const [runCounter, setRunCounter] = useState(0);
  const [copied, setCopied] = useState(false);

  // Iframe URL mode (optional external URL renderer inside HTML/Iframe tab)
  const [iframeUrlMode, setIframeUrlMode] = useState(false);
  const [iframeUrlInput, setIframeUrlInput] = useState('https://example.com');
  const [activeIframeUrl, setActiveIframeUrl] = useState('https://example.com');
  const [useProxyUrlRender, setUseProxyUrlRender] = useState(true);

  // JS/TS execution runtime: browser iframe (supports DOM + console) vs Node.js server
  const [jsRuntime, setJsRuntime] = useState<'browser' | 'node'>('browser');
  const [jsHasDomOutput, setJsHasDomOutput] = useState(false);

  // Runtime states
  const [srcDoc, setSrcDoc] = useState('');
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [elapsedMs, setElapsedMs] = useState<string | null>(null);

  // Mermaid SVG state
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);

  // Server execution / simulation state
  const [stdinText, setStdinText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // Online sandbox hosting state
  const [isPublishingOnline, setIsPublishingOnline] = useState(false);
  const [onlineSandbox, setOnlineSandbox] = useState<PublishSandboxResult | null>(null);
  const [useOnlineIframe, setUseOnlineIframe] = useState(false);
  const [onlinePublishError, setOnlinePublishError] = useState<string | null>(null);
  const [copiedOnlineUrl, setCopiedOnlineUrl] = useState(false);

  // Design System, Procedural Seed & Upload/Download JSON state
  const [designSystem, setDesignSystem] = useState<DesignSystemConfig>(loadInitialDesignSystem);
  const [varsBarOpen, setVarsBarOpen] = useState(false);
  const [jsonToast, setJsonToast] = useState<string | null>(null);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<
    Array<{ path: string; content: string }>
  >([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const jsonUploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DESIGN_SYSTEM_STORAGE_KEY, JSON.stringify(designSystem));
    } catch {
      // Ignore storage quota errors
    }
  }, [designSystem]);

  useEffect(() => {
    setCode(preview.code);
    const normalized = normalizeLanguage(preview.language, preview.code);
    setLanguage(normalized);
    const shouldDefaultSandpack =
      getPreviewCategory(normalized) === 'sandpack' || hasThirdPartyImports(preview.code);
    setViewMode(shouldDefaultSandpack ? 'sandpack' : 'preview');
    setIframeUrlMode(false);
    setExecResult(null);
    setExecError(null);
    setJsHasDomOutput(false);
    setRunCounter((c) => c + 1);
  }, [preview.id, preview.code, preview.language]);

  const category = useMemo(() => getPreviewCategory(language), [language]);
  const nativeSupported = useMemo(() => isNativeExecutable(language), [language]);
  const isSandpackActive =
    viewMode === 'sandpack' || (viewMode === 'preview' && category === 'sandpack');

  // Listen to iframe postMessage console & timing events
  useEffect(() => {
    const handleMsg = (event: MessageEvent) => {
      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }
      const data = event.data as {
        source?: string;
        type?: string;
        level?: ConsoleEntry['level'];
        text?: string;
        elapsedMs?: string;
        hasDomOutput?: boolean;
      };
      if (!data || data.source !== 'folio-preview') return;

      if (data.type === 'console' && data.text !== undefined) {
        setConsoleLogs((prev) => [
          ...prev.slice(-99),
          {
            id: crypto.randomUUID(),
            level: data.level || 'log',
            text: data.text || '',
          },
        ]);
      } else if (data.type === 'done') {
        if (data.elapsedMs) setElapsedMs(data.elapsedMs);
        if (typeof data.hasDomOutput === 'boolean') {
          setJsHasDomOutput(data.hasDomOutput);
        }
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  // Build / compile preview whenever code, language, darkCanvas, viewMode, designSystem, or runCounter updates
  useEffect(() => {
    if (
      viewMode === 'code' ||
      viewMode === 'folder' ||
      viewMode === 'design' ||
      isSandpackActive
    ) {
      return;
    }
    if (iframeUrlMode && category === 'html') return;

    let cancelled = false;
    setCompileError(null);
    setElapsedMs(null);

    if (category === 'html') {
      setConsoleLogs([]);
      setSrcDoc(buildHtmlSrcDoc(code, darkCanvas, designSystem));
      return;
    }

    if (category === 'css') {
      setConsoleLogs([]);
      setSrcDoc(buildCssSrcDoc(code, darkCanvas, designSystem));
      return;
    }

    if (category === 'flet' || category === 'nicegui' || category === 'pyscript') {
      setConsoleLogs([]);
      const builder =
        category === 'flet'
          ? buildFletSrcDoc
          : category === 'nicegui'
          ? buildNiceGuiSrcDoc
          : buildPyScriptSrcDoc;
      if (viewMode !== 'split') {
        setSrcDoc(builder(code, darkCanvas));
        return;
      }
      const timer = setTimeout(() => {
        if (!cancelled) {
          setSrcDoc(builder(code, darkCanvas));
        }
      }, 650);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    if (category === 'react' || (category === 'javascript' && jsRuntime === 'browser')) {
      setConsoleLogs([]);
      setJsHasDomOutput(false);
      setIsCompiling(true);
      fetch('/api/preview/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })
        .then(async (res) => {
          const data = (await res.json()) as { code?: string; error?: string };
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Compilation failed.');
          }
          return data.code || '';
        })
        .then((compiled) => {
          if (cancelled) return;
          setSrcDoc(
            category === 'react'
              ? buildReactSrcDoc(compiled, darkCanvas, designSystem)
              : buildJsRunnerSrcDoc(compiled, darkCanvas, designSystem)
          );
        })
        .catch((err) => {
          if (cancelled) return;
          setCompileError(
            err instanceof Error ? err.message : 'Could not compile code.'
          );
        })
        .finally(() => {
          if (!cancelled) setIsCompiling(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (category === 'mermaid') {
      setMermaidError(null);
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: darkCanvas ? 'dark' : 'default',
      });
      const diagramId = `mermaid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      mermaid
        .render(diagramId, code.trim() || 'flowchart LR\n  A[Start] --> B[End]')
        .then(({ svg }) => {
          if (!cancelled) setMermaidSvg(svg);
        })
        .catch((err) => {
          if (!cancelled) {
            setMermaidError(
              err instanceof Error ? err.message : 'Invalid Mermaid syntax.'
            );
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [
    code,
    language,
    category,
    darkCanvas,
    viewMode,
    runCounter,
    iframeUrlMode,
    jsRuntime,
    isSandpackActive,
    designSystem,
  ]);

  const handleExecuteCode = useCallback(async () => {
    if (!code.trim()) return;
    setIsExecuting(true);
    setExecError(null);

    try {
      const endpoint = nativeSupported ? '/api/code/execute' : '/api/preview/simulate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, stdin: stdinText }),
      });
      const data = (await res.json()) as {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        durationMs?: number;
        mode?: 'native' | 'simulated';
        runtime?: string;
        summary?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Execution failed.');
      }

      setExecResult({
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? '',
        exitCode: typeof data.exitCode === 'number' ? data.exitCode : 0,
        durationMs: data.durationMs,
        mode: data.mode || (nativeSupported ? 'native' : 'simulated'),
        runtime: data.runtime,
        summary: data.summary,
      });
    } catch (err) {
      setExecError(
        err instanceof Error ? err.message : 'Failed to execute code.'
      );
    } finally {
      setIsExecuting(false);
    }
  }, [code, language, stdinText, nativeSupported]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDownloadCode = () => {
    const ext = getFileExtension(language);
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleApplyIframeUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = iframeUrlInput.trim();
    if (!trimmed) return;
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        setIframeUrlInput(parsed.toString());
        setActiveIframeUrl(parsed.toString());
      }
    } catch {
      // Invalid URL
    }
  };

  const parsedJson = useMemo(() => {
    if (category !== 'json') return null;
    try {
      return { ok: true as const, value: JSON.parse(code) as unknown };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Invalid JSON',
      };
    }
  }, [category, code]);

  const parsedCsv = useMemo(() => {
    if (category !== 'csv') return [];
    return parseCsvRows(code);
  }, [category, code]);

  const showResponsiveToggle =
    category === 'html' ||
    category === 'css' ||
    category === 'react' ||
    category === 'flet' ||
    category === 'nicegui' ||
    category === 'pyscript' ||
    (category === 'javascript' && jsRuntime === 'browser');

  const isKnownOption = PREVIEW_LANGUAGE_OPTIONS.some((o) => o.id === language);

  const handleDownloadJsonBundle = useCallback(() => {
    const jsonText = buildPreviewBundleJson({
      language,
      code,
      designSystem,
      workspaceFiles: workspaceSnapshot.length > 0 ? workspaceSnapshot : undefined,
    });
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folio-preview-${designSystem.seedEnabled && designSystem.seed ? designSystem.seed : 'bundle'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setJsonToast('Downloaded preview JSON bundle');
    setTimeout(() => setJsonToast(null), 2200);
  }, [language, code, designSystem, workspaceSnapshot]);

  const handleUploadJsonBundle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseUploadedPreviewJson(text, designSystem);
      if (parsed.designSystem) {
        setDesignSystem((prev) => ({ ...prev, ...parsed.designSystem }));
      }
      if (typeof parsed.language === 'string' && parsed.language) {
        setLanguage(parsed.language);
      }
      if (typeof parsed.code === 'string') {
        setCode(parsed.code);
      }
      if (parsed.workspaceFiles && parsed.workspaceFiles.length > 0) {
        await fetch(`/api/workspace/${encodeURIComponent(DEFAULT_WORKSPACE_ID)}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clearBefore: true,
            files: parsed.workspaceFiles,
          }),
        });
      }
      setRunCounter((c) => c + 1);
      setJsonToast(`Loaded ${file.name}`);
      setTimeout(() => setJsonToast(null), 2400);
    } catch (err) {
      setJsonToast(err instanceof Error ? err.message : 'Invalid JSON file');
      setTimeout(() => setJsonToast(null), 3200);
    }
  };

  const showEditor = !isSandpackActive && (viewMode === 'code' || viewMode === 'split');
  const showOutput = !isSandpackActive && (viewMode === 'preview' || viewMode === 'split');
  const isServerRunnerView =
    !isSandpackActive &&
    (category === 'simulated' || (category === 'javascript' && jsRuntime === 'node'));

  return (
    <aside
      aria-label="Code execution and iframe renderer"
      className="fixed inset-0 z-40 lg:static lg:z-auto w-full lg:w-[50%] lg:max-w-[780px] lg:min-w-[440px] h-full flex flex-col border-l border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl lg:shadow-none"
    >
      {/* Top Toolbar */}
      <div className="h-14 shrink-0 px-2.5 sm:px-3 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between gap-2 bg-[#f9f9f9] dark:bg-[#171717] overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <div
            role="tablist"
            aria-label="Workbench layout"
            className="flex items-center p-0.5 rounded-xl bg-neutral-200/80 dark:bg-[#262626] border border-neutral-200 dark:border-white/10"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'preview' && !isSandpackActive}
              onClick={() => {
                if (category === 'sandpack') {
                  setViewMode('sandpack');
                } else {
                  setViewMode('preview');
                }
              }}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'preview' && !isSandpackActive
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Render</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'split'}
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'code'}
              onClick={() => setViewMode('code')}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'code'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Code</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSandpackActive}
              onClick={() => setViewMode('sandpack')}
              title="Open interactive Sandpack multi-file bundle"
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isSandpackActive
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Sandpack</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'folder'}
              onClick={() => setViewMode('folder')}
              title="Python folder builder, multi-file renderer & GitHub script runner"
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'folder'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Folder</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'design'}
              onClick={() => setViewMode('design')}
              title="Design system (CSS/JSON), variables & procedural seed generator"
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'design'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Design</span>
            </button>
          </div>

          <select
            value={language}
            onChange={(e) => {
              const nextLang = e.target.value;
              setLanguage(nextLang);
              if (getPreviewCategory(nextLang) === 'sandpack') {
                setViewMode('sandpack');
              } else if (
                viewMode === 'sandpack' ||
                viewMode === 'folder' ||
                viewMode === 'design'
              ) {
                setViewMode('preview');
              }
              setIframeUrlMode(false);
              setExecResult(null);
              setExecError(null);
              setRunCounter((c) => c + 1);
            }}
            aria-label="Select language"
            className="h-8 max-w-[125px] rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] focus:outline-none focus:ring-2 focus:ring-neutral-400"
          >
            {!isKnownOption && (
              <option value={language}>{language.toUpperCase()} (Simulated)</option>
            )}
            {PREVIEW_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={jsonUploadInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleUploadJsonBundle}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setVarsBarOpen((v) => !v)}
            aria-pressed={varsBarOpen}
            title="Live Variables & Procedural Seed bar"
            className={`inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              varsBarOpen
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/35'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Vars</span>
          </button>

          <button
            type="button"
            onClick={() => jsonUploadInputRef.current?.click()}
            aria-label="Upload JSON bundle or design system"
            title="Upload JSON"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <Upload className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownloadJsonBundle}
            aria-label="Download preview JSON bundle"
            title="Download JSON (variables, seed, code)"
            className="inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">JSON</span>
          </button>

          {canPublishOnlineSandbox(language) && (
            <button
              type="button"
              onClick={async () => {
                if (isPublishingOnline) return;
                setIsPublishingOnline(true);
                setOnlinePublishError(null);
                try {
                  const res = await publishOnlineSandbox({
                    code,
                    language,
                    darkCanvas,
                    designSystem,
                  });
                  setOnlineSandbox(res);
                  setUseOnlineIframe(true);
                } catch (err) {
                  setOnlinePublishError(
                    err instanceof Error ? err.message : 'Failed to publish online.'
                  );
                } finally {
                  setIsPublishingOnline(false);
                }
              }}
              disabled={isPublishingOnline}
              title="Host this sandbox online with a shareable live URL"
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                useOnlineIframe && onlineSandbox
                  ? 'bg-blue-600 text-white'
                  : 'border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              {isPublishingOnline ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {onlineSandbox ? 'Update Online' : 'Go Online'}
              </span>
            </button>
          )}

          {showOutput && category === 'html' && (
            <button
              type="button"
              onClick={() => setIframeUrlMode((v) => !v)}
              aria-label={iframeUrlMode ? 'Render HTML code' : 'Render external URL in iframe'}
              aria-pressed={iframeUrlMode}
              title={iframeUrlMode ? 'Switch to HTML code' : 'Load URL in iframe'}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                iframeUrlMode
                  ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              <Globe className="w-4 h-4" />
            </button>
          )}

          {showOutput && showResponsiveToggle && (
            <button
              type="button"
              onClick={() =>
                setViewportWidth((v) => (v === 'full' ? 'mobile' : 'full'))
              }
              aria-label={
                viewportWidth === 'full'
                  ? 'Switch to mobile width'
                  : 'Switch to full width'
              }
              title={viewportWidth === 'full' ? 'Mobile width (375px)' : 'Full width'}
              className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
            >
              {viewportWidth === 'full' ? (
                <Smartphone className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
            </button>
          )}

          {(isSandpackActive ||
            (showOutput &&
              (showResponsiveToggle || category === 'svg' || category === 'mermaid'))) && (
            <button
              type="button"
              onClick={() => setDarkCanvas((d) => !d)}
              aria-label="Toggle iframe canvas background"
              title={darkCanvas ? 'Light canvas' : 'Dark canvas'}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
            >
              {darkCanvas ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          )}

          {showOutput && !isServerRunnerView && (
            <button
              type="button"
              onClick={() => setRunCounter((c) => c + 1)}
              aria-label="Reload renderer"
              title="Reload / Re-run"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyCode}
            aria-label={copied ? 'Copied' : 'Copy code'}
            title="Copy code"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadCode}
            aria-label="Download code file"
            title="Download file"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close code workbench"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Online Hosted URL Bar */}
      {(onlineSandbox || onlinePublishError) && (
        <div className="px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-white/10 bg-blue-50/70 dark:bg-blue-950/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {onlinePublishError ? (
            <span className="text-red-600 dark:text-red-400">{onlinePublishError}</span>
          ) : onlineSandbox ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap">
                  Live Sandbox
                </span>
                <code className="font-mono text-[11px] text-neutral-700 dark:text-neutral-200 truncate max-w-[260px]">
                  {onlineSandbox.fullUrl}
                </code>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setUseOnlineIframe((v) => !v)}
                  className="px-2 py-1 rounded-md bg-white dark:bg-[#262626] border border-neutral-200 dark:border-white/10 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
                >
                  {useOnlineIframe ? 'Online Mode' : 'Switch to Online'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(onlineSandbox.fullUrl);
                      setCopiedOnlineUrl(true);
                      setTimeout(() => setCopiedOnlineUrl(false), 1600);
                    } catch {
                      // Ignore clipboard error
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-[#262626] border border-neutral-200 dark:border-white/10 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
                >
                  {copiedOnlineUrl ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedOnlineUrl ? 'Copied' : 'Copy Link'}</span>
                </button>
                <a
                  href={onlineSandbox.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-500 whitespace-nowrap"
                >
                  <span>Open Live</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* JSON Upload/Download Notification Bar */}
      {jsonToast && (
        <div className="px-3 sm:px-4 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-emerald-50/80 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300 shrink-0">
          {jsonToast}
        </div>
      )}

      {/* Live Variables & Optional Procedural Seed Bar */}
      {varsBarOpen && (
        <div className="px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-white/10 bg-[#f6f7f9] dark:bg-[#1d1f24] flex flex-wrap items-center gap-3 text-xs shrink-0">
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Theme</span>
            <input
              type="color"
              value={designSystem.themeColor}
              onChange={(e) =>
                setDesignSystem((prev) => ({ ...prev, themeColor: e.target.value }))
              }
              className="w-6 h-6 rounded border border-neutral-300 dark:border-white/20 cursor-pointer"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Accent</span>
            <input
              type="color"
              value={designSystem.accentColor}
              onChange={(e) =>
                setDesignSystem((prev) => ({ ...prev, accentColor: e.target.value }))
              }
              className="w-6 h-6 rounded border border-neutral-300 dark:border-white/20 cursor-pointer"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 tabular-nums">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Speed {designSystem.animationSpeed}x
            </span>
            <input
              type="range"
              min={0.25}
              max={3}
              step={0.05}
              value={designSystem.animationSpeed}
              onChange={(e) =>
                setDesignSystem((prev) => ({
                  ...prev,
                  animationSpeed: Number(e.target.value),
                }))
              }
              className="w-20 accent-blue-600"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 tabular-nums">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Sprite {designSystem.spriteSize}px
            </span>
            <input
              type="range"
              min={16}
              max={128}
              step={2}
              value={designSystem.spriteSize}
              onChange={(e) =>
                setDesignSystem((prev) => ({
                  ...prev,
                  spriteSize: Number(e.target.value),
                }))
              }
              className="w-20 accent-blue-600"
            />
          </label>
          <div className="inline-flex items-center gap-1.5">
            <input
              type="text"
              value={designSystem.seed}
              onChange={(e) =>
                setDesignSystem((prev) => ({
                  ...prev,
                  seedEnabled: true,
                  seed: e.target.value,
                }))
              }
              placeholder="Seed"
              aria-label="Procedural seed"
              className="w-24 h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 text-[11px] font-mono text-[#0d0d0d] dark:text-white"
            />
            <button
              type="button"
              onClick={() =>
                setDesignSystem((prev) =>
                  generateDesignSystemFromSeed(generateRandomSeed(), prev)
                )
              }
              title="Randomize procedural seed & palette"
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-medium"
            >
              <Dices className="w-3 h-3" />
              <span>Reseed</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('design')}
            className="ml-auto text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Full Design System →
          </button>
        </div>
      )}

      {/* Main Content Area (supports Split, Code, Render, Sandpack, Folder & GitHub, or Design System) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {viewMode === 'design' && (
          <DesignSystemStudio
            config={designSystem}
            onChange={setDesignSystem}
            onLaunchModule={(moduleCode, moduleLang) => {
              setCode(moduleCode);
              setLanguage(moduleLang);
              setViewMode('preview');
              setIframeUrlMode(false);
              setRunCounter((c) => c + 1);
            }}
            onDownloadBundleJson={handleDownloadJsonBundle}
            onTriggerUploadJson={() => jsonUploadInputRef.current?.click()}
          />
        )}

        {viewMode === 'folder' && (
          <FolderSandboxPanel
            workspaceId={DEFAULT_WORKSPACE_ID}
            designSystem={designSystem}
            onWorkspaceFilesSnapshot={setWorkspaceSnapshot}
          />
        )}

        {isSandpackActive && (
          <SandpackWorkbench
            key={`${preview.id}-${language}`}
            code={code}
            language={language}
            darkTheme={darkCanvas}
          />
        )}

        {showEditor && (
          <div
            className={`flex flex-col min-h-0 bg-[#0d0d0d] text-[#ececec] ${
              viewMode === 'split'
                ? 'h-[45%] shrink-0 border-b border-neutral-200 dark:border-white/15'
                : 'flex-1'
            }`}
          >
            <div className="px-3 sm:px-4 py-2 border-b border-white/10 flex items-center justify-between gap-2 text-xs text-neutral-400">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate hidden sm:inline">Editor</span>
                <select
                  value=""
                  onChange={(e) => {
                    const tpl = CODE_TEMPLATES.find((t) => t.id === e.target.value);
                    if (!tpl) return;
                    setLanguage(tpl.language);
                    setCode(tpl.code);
                    if (getPreviewCategory(tpl.language) === 'sandpack') {
                      setViewMode('sandpack');
                    }
                    setIframeUrlMode(false);
                    setExecResult(null);
                    setExecError(null);
                    setRunCounter((c) => c + 1);
                  }}
                  aria-label="Load starter template"
                  className="h-7 rounded-lg border border-white/15 bg-[#1b1b1b] px-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-white/30"
                >
                  <option value="" disabled>
                    Load template...
                  </option>
                  {CODE_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (viewMode === 'code') {
                    setViewMode('preview');
                  }
                  if (isServerRunnerView) {
                    void handleExecuteCode();
                  } else {
                    setRunCounter((c) => c + 1);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#0d0d0d] font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isServerRunnerView ? 'Execute' : 'Run'}</span>
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              aria-label="Code editor"
              className="flex-1 w-full resize-none bg-transparent p-4 font-mono text-[13.5px] leading-relaxed text-[#ececec] focus:outline-none chat-scroll"
            />
          </div>
        )}

        {showOutput && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Optional URL bar when Globe URL iframe mode is active */}
            {category === 'html' && iframeUrlMode && (
              <form
                onSubmit={handleApplyIframeUrl}
                className="px-3 py-2 border-b border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#171717] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={iframeUrlInput}
                  onChange={(e) => setIframeUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  aria-label="Iframe URL"
                  className="flex-1 h-8 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2.5 text-xs font-mono text-[#0d0d0d] dark:text-[#ececec] focus:outline-none focus:ring-2 focus:ring-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => setUseProxyUrlRender((v) => !v)}
                  title="Toggle server proxy render (bypasses X-Frame-Options)"
                  className={`h-8 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    useProxyUrlRender
                      ? 'bg-blue-600 text-white'
                      : 'border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200'
                  }`}
                >
                  {useProxyUrlRender ? 'Proxy On' : 'Direct'}
                </button>
                <button
                  type="submit"
                  className="h-8 px-3 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  Load URL
                </button>
              </form>
            )}

            {/* HTML / CSS / React / Flet / NiceGUI / PyScript Live Iframe Renderer */}
            {(category === 'html' ||
              category === 'css' ||
              category === 'react' ||
              category === 'flet' ||
              category === 'nicegui' ||
              category === 'pyscript') && (
              <div className="flex-1 flex flex-col min-h-0">
                {compileError && !iframeUrlMode ? (
                  <div className="m-4 rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-mono text-red-700 dark:text-red-300 whitespace-pre-wrap overflow-auto">
                    {compileError}
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex justify-center bg-neutral-100 dark:bg-[#121212] overflow-auto">
                    {isCompiling && !iframeUrlMode ? (
                      <div className="self-center text-xs text-neutral-500 dark:text-neutral-400">
                        Bundling & rendering iframe...
                      </div>
                    ) : iframeUrlMode ? (
                      <iframe
                        key={`url-${activeIframeUrl}-${useProxyUrlRender}-${runCounter}`}
                        title="External URL iframe renderer"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        src={
                          useProxyUrlRender
                            ? `/api/web/render?url=${encodeURIComponent(activeIframeUrl)}`
                            : activeIframeUrl
                        }
                        className={`h-full border-0 bg-white transition-all duration-150 ${
                          viewportWidth === 'mobile'
                            ? 'w-[375px] max-w-full my-3 rounded-2xl shadow-lg border border-neutral-300 dark:border-white/15'
                            : 'w-full'
                        }`}
                      />
                    ) : useOnlineIframe && onlineSandbox ? (
                      <iframe
                        key={`online-${onlineSandbox.id}-${runCounter}`}
                        title="Online hosted sandbox renderer"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        src={onlineSandbox.url}
                        className={`h-full border-0 transition-all duration-150 ${
                          viewportWidth === 'mobile'
                            ? 'w-[375px] max-w-full my-3 rounded-2xl shadow-lg border border-neutral-300 dark:border-white/15'
                            : 'w-full'
                        }`}
                      />
                    ) : (
                      <iframe
                        ref={iframeRef}
                        key={`${runCounter}-${darkCanvas}`}
                        title="Sandboxed iframe renderer"
                        sandbox="allow-scripts"
                        srcDoc={srcDoc}
                        className={`h-full border-0 transition-all duration-150 ${
                          viewportWidth === 'mobile'
                            ? 'w-[375px] max-w-full my-3 rounded-2xl shadow-lg border border-neutral-300 dark:border-white/15'
                            : 'w-full'
                        }`}
                      />
                    )}
                  </div>
                )}

                {consoleLogs.length > 0 && !iframeUrlMode && (
                  <div className="max-h-40 shrink-0 border-t border-neutral-200 dark:border-white/10 bg-[#0d0d0d] text-[#ececec] flex flex-col">
                    <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Terminal className="w-3.5 h-3.5" />
                        Console ({consoleLogs.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setConsoleLogs([])}
                        className="hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="overflow-y-auto p-2.5 space-y-1 font-mono text-xs chat-scroll">
                      {consoleLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className={
                            entry.level === 'error'
                              ? 'text-red-400'
                              : entry.level === 'warn'
                              ? 'text-amber-300'
                              : 'text-neutral-200'
                          }
                        >
                          {entry.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SVG Canvas */}
            {category === 'svg' && (
              <div
                className={`flex-1 overflow-auto flex items-center justify-center p-6 ${
                  darkCanvas ? 'bg-[#18181b]' : 'bg-white'
                }`}
              >
                <div
                  className="max-w-full max-h-full flex items-center justify-center"
                  dangerouslySetInnerHTML={{
                    __html: code.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''),
                  }}
                />
              </div>
            )}

            {/* JavaScript / TypeScript: Browser Iframe (DOM + Console) OR Native Node.js */}
            {category === 'javascript' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-white/10 bg-[#f4f4f4] dark:bg-[#171717] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setJsRuntime('browser');
                        setRunCounter((c) => c + 1);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        jsRuntime === 'browser'
                          ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
                      }`}
                    >
                      Browser Iframe
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setJsRuntime('node');
                        setExecResult(null);
                        setExecError(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        jsRuntime === 'node'
                          ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
                      }`}
                    >
                      Node.js Server
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {jsRuntime === 'browser' && elapsedMs && (
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {elapsedMs} ms
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (jsRuntime === 'node') {
                          void handleExecuteCode();
                        } else {
                          setRunCounter((c) => c + 1);
                        }
                      }}
                      disabled={jsRuntime === 'node' && isExecuting}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>
                        {jsRuntime === 'node'
                          ? isExecuting
                            ? 'Running...'
                            : 'Execute'
                          : 'Run'}
                      </span>
                    </button>
                  </div>
                </div>

                {jsRuntime === 'browser' ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div
                      className={
                        jsHasDomOutput
                          ? 'h-1/2 min-h-[160px] flex justify-center bg-neutral-100 dark:bg-[#121212] border-b border-neutral-200 dark:border-white/10 overflow-auto'
                          : 'hidden'
                      }
                    >
                      <iframe
                        ref={iframeRef}
                        key={`js-iframe-${runCounter}-${darkCanvas}`}
                        title="JavaScript iframe renderer"
                        sandbox="allow-scripts"
                        srcDoc={srcDoc}
                        className={`h-full border-0 transition-all duration-150 ${
                          viewportWidth === 'mobile'
                            ? 'w-[375px] max-w-full my-2 rounded-xl shadow-md border border-neutral-300 dark:border-white/15'
                            : 'w-full'
                        }`}
                      />
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d] text-[#ececec]">
                      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between text-xs text-neutral-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Console Output</span>
                        </span>
                        {jsHasDomOutput && (
                          <span className="text-[11px] text-emerald-400">
                            DOM rendered in iframe above
                          </span>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-2 chat-scroll">
                        {isCompiling ? (
                          <div className="text-neutral-400">Transpiling & running...</div>
                        ) : compileError ? (
                          <div className="text-red-400 whitespace-pre-wrap">{compileError}</div>
                        ) : consoleLogs.length === 0 ? (
                          <div className="text-neutral-500">
                            {jsHasDomOutput
                              ? 'Executed cleanly with DOM output rendered in the iframe above.'
                              : 'No console output emitted. Use console.log(...) or append elements to document.body.'}
                          </div>
                        ) : (
                          consoleLogs.map((entry) => (
                            <div
                              key={entry.id}
                              className={`whitespace-pre-wrap break-words py-1 border-b border-white/5 ${
                                entry.level === 'error'
                                  ? 'text-red-400'
                                  : entry.level === 'warn'
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                              }`}
                            >
                              {entry.text}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <ServerExecutionView
                    language={language}
                    nativeSupported={true}
                    stdinText={stdinText}
                    onChangeStdin={setStdinText}
                    isExecuting={isExecuting}
                    execResult={execResult}
                    execError={execError}
                    onExecute={() => void handleExecuteCode()}
                    hideHeaderBar={true}
                  />
                )}
              </div>
            )}

            {/* Markdown Document */}
            {category === 'markdown' && (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white dark:bg-[#212121] chat-scroll">
                <MarkdownRenderer content={code} />
              </div>
            )}

            {/* Stop Motion Vector Player */}
            {category === 'stopmotion' && (
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-[#1a1a1a] chat-scroll">
                <InlineStopMotionPlayer code={code} compact={false} />
              </div>
            )}

            {/* Pixel Art Studio / Viewer */}
            {category === 'pixelart' && (
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-[#1a1a1a] chat-scroll">
                <InlinePixelArtViewer code={code} compact={false} />
              </div>
            )}

            {/* Three.js 3D Viewer */}
            {category === 'threejs' && (
              <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-[#1a1a1a] chat-scroll">
                <InlineThreeJsViewer code={code} compact={false} />
              </div>
            )}

            {/* Mermaid Diagram */}
            {category === 'mermaid' && (
              <div
                className={`flex-1 overflow-auto p-6 flex flex-col items-center justify-center ${
                  darkCanvas ? 'bg-[#18181b]' : 'bg-white'
                }`}
              >
                {mermaidError ? (
                  <div className="max-w-md rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-mono text-red-700 dark:text-red-300 whitespace-pre-wrap">
                    {mermaidError}
                  </div>
                ) : (
                  <div
                    className="max-w-full overflow-auto"
                    dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                  />
                )}
              </div>
            )}

            {/* JSON Tree Inspector */}
            {category === 'json' && (
              <div className="flex-1 overflow-y-auto p-5 bg-white dark:bg-[#1a1a1a] chat-scroll">
                {parsedJson?.ok ? (
                  <JsonNode value={parsedJson.value} />
                ) : (
                  <div className="rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-mono text-red-700 dark:text-red-300">
                    {parsedJson?.error || 'Invalid JSON'}
                  </div>
                )}
              </div>
            )}

            {/* CSV Table Preview */}
            {category === 'csv' && (
              <div className="flex-1 overflow-auto p-4 bg-white dark:bg-[#1a1a1a] chat-scroll">
                {parsedCsv.length === 0 ? (
                  <div className="text-xs text-neutral-500">No CSV rows found.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-white/10">
                    <table className="w-full border-collapse text-left text-xs tabular-nums">
                      <thead className="bg-[#f4f4f4] dark:bg-[#262626] border-b border-neutral-200 dark:border-white/10 font-semibold">
                        <tr>
                          {parsedCsv[0].map((cell, idx) => (
                            <th key={idx} className="px-3 py-2 whitespace-nowrap">
                              {cell || `Col ${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedCsv.slice(1).map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="border-t border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5"
                          >
                            {parsedCsv[0].map((_, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                                {row[cIdx] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Server Native Execution (Python, SQL, Bash) or Simulated Execution (Rust, Go, C++, Java, etc.) */}
            {category === 'simulated' && (
              <ServerExecutionView
                language={language}
                nativeSupported={nativeSupported}
                stdinText={stdinText}
                onChangeStdin={setStdinText}
                isExecuting={isExecuting}
                execResult={execResult}
                execError={execError}
                onExecute={() => void handleExecuteCode()}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

interface ServerExecutionViewProps {
  language: string;
  nativeSupported: boolean;
  stdinText: string;
  onChangeStdin: (val: string) => void;
  isExecuting: boolean;
  execResult: ExecutionResult | null;
  execError: string | null;
  onExecute: () => void;
  hideHeaderBar?: boolean;
}

function ServerExecutionView({
  language,
  nativeSupported,
  stdinText,
  onChangeStdin,
  isExecuting,
  execResult,
  execError,
  onExecute,
  hideHeaderBar = false,
}: ServerExecutionViewProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d] text-[#ececec]">
      {!hideHeaderBar && (
        <div className="px-4 py-3 border-b border-white/10 bg-[#171717] flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-neutral-400">
            {nativeSupported ? (
              <>
                Native sandbox execution for{' '}
                <span className="text-white font-medium">{language}</span>
              </>
            ) : (
              <>
                Simulated runtime for{' '}
                <span className="text-white font-medium">{language}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onExecute}
            disabled={isExecuting}
            className="inline-flex items-center gap-1.5 min-h-[34px] px-3.5 py-1.5 rounded-full bg-white text-[#0d0d0d] text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>
              {isExecuting
                ? 'Running...'
                : nativeSupported
                ? 'Execute code'
                : 'Simulate run'}
            </span>
          </button>
        </div>
      )}

      <div className="px-4 py-2.5 border-b border-white/10 bg-[#121212]">
        <input
          type="text"
          value={stdinText}
          onChange={(e) => onChangeStdin(e.target.value)}
          placeholder="Optional stdin input..."
          aria-label="Standard input"
          className="w-full bg-transparent text-xs font-mono text-[#ececec] placeholder:text-neutral-500 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-4 chat-scroll">
        {execError && (
          <div className="rounded-xl border border-red-900/70 bg-red-950/40 p-3 text-red-300">
            {execError}
          </div>
        )}

        {!execResult && !isExecuting && !execError && (
          <div className="text-neutral-400 space-y-2">
            <p>
              Click{' '}
              <span className="text-white font-semibold">
                {nativeSupported ? 'Execute' : 'Simulate run'}
              </span>{' '}
              to run this <span className="text-white">{language}</span> code{' '}
              {nativeSupported
                ? 'in an isolated server sandbox (6s timeout).'
                : 'through the simulated runtime.'}
            </p>
          </div>
        )}

        {isExecuting && (
          <div className="text-neutral-400">
            {nativeSupported ? 'Executing in sandbox...' : 'Running simulated execution...'}
          </div>
        )}

        {execResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 tabular-nums">
              {execResult.runtime && (
                <>
                  <span className="text-neutral-200 font-medium">{execResult.runtime}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span
                className={
                  execResult.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'
                }
              >
                Exit code: {execResult.exitCode}
              </span>
              {execResult.durationMs !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{execResult.durationMs} ms</span>
                </>
              )}
              {execResult.summary && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans text-neutral-300">{execResult.summary}</span>
                </>
              )}
            </div>

            {execResult.stdout && (
              <div className="space-y-1">
                <div className="text-[11px] text-neutral-500">stdout</div>
                <pre className="rounded-xl bg-[#171717] border border-white/10 p-3 text-emerald-300 whitespace-pre-wrap overflow-x-auto">
                  {execResult.stdout}
                </pre>
              </div>
            )}

            {execResult.stderr && (
              <div className="space-y-1">
                <div className="text-[11px] text-neutral-500">stderr</div>
                <pre className="rounded-xl bg-[#171717] border border-red-900/50 p-3 text-red-400 whitespace-pre-wrap overflow-x-auto">
                  {execResult.stderr}
                </pre>
              </div>
            )}

            {!execResult.stdout && !execResult.stderr && (
              <div className="text-neutral-500">
                Process finished with no stdout or stderr output.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
