import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Moon,
  Pencil,
  Play,
  RotateCw,
  Sun,
  Terminal,
} from 'lucide-react';
import {
  buildCssSrcDoc,
  buildFletSrcDoc,
  buildHtmlSrcDoc,
  buildJsRunnerSrcDoc,
  buildNiceGuiSrcDoc,
  buildPyScriptSrcDoc,
  buildReactSrcDoc,
  getPreviewCategory,
  isNativeExecutable,
  normalizeLanguage,
  parseCsvRows,
} from '../utils/codePreview';
import {
  hasThirdPartyImports,
  isSandpackCompatibleCategory,
} from '../utils/sandpackHelpers';
import { SandpackWorkbench } from './SandpackWorkbench';
import { InlineStopMotionPlayer } from './InlineStopMotionPlayer';
import { InlinePixelArtViewer } from './InlinePixelArtViewer';
import { InlineThreeJsViewer } from './InlineThreeJsViewer';
import {
  PublishSandboxResult,
  canPublishOnlineSandbox,
  publishOnlineSandbox,
} from '../utils/sandboxOnline';

interface ConsoleEntry {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs?: number;
  mode: 'native' | 'simulated';
  runtime?: string;
  summary?: string;
}

interface InlineCodeSandboxProps {
  initialCode: string;
  rawLanguage?: string;
  autoExecuteOnMount?: boolean;
  onSyncCode?: (updatedCode: string) => void;
}

function InlineJsonNode({
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
            entries.map(([k, v]) => (
              <InlineJsonNode key={k} name={k} value={v} depth={depth + 1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export const InlineCodeSandbox: React.FC<InlineCodeSandboxProps> = ({
  initialCode,
  rawLanguage,
  autoExecuteOnMount = true,
  onSyncCode,
}) => {
  const [code, setCode] = useState(initialCode);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [tallIframe, setTallIframe] = useState(false);
  const [darkCanvas, setDarkCanvas] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true
  );
  const [runCounter, setRunCounter] = useState(0);

  const language = useMemo(
    () => normalizeLanguage(rawLanguage, code),
    [rawLanguage, code]
  );
  const category = useMemo(() => getPreviewCategory(language), [language]);
  const nativeSupported = useMemo(() => isNativeExecutable(language), [language]);
  const sandpackCompatible = useMemo(
    () => isSandpackCompatibleCategory(category, language),
    [category, language]
  );

  // Engine switcher: fast local sandbox vs CodeSandbox Sandpack (npm packages + multi-framework)
  const [engine, setEngine] = useState<'local' | 'sandpack'>(() => {
    const norm = normalizeLanguage(rawLanguage, initialCode);
    const cat = getPreviewCategory(norm);
    return cat === 'sandpack' || hasThirdPartyImports(initialCode)
      ? 'sandpack'
      : 'local';
  });

  // JS/TS can run in Browser Iframe (with DOM + console) or Node.js server
  const [jsRuntime, setJsRuntime] = useState<'browser' | 'node'>('browser');
  const [jsHasDomOutput, setJsHasDomOutput] = useState(false);

  // Browser iframe state
  const [srcDoc, setSrcDoc] = useState('');
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [elapsedMs, setElapsedMs] = useState<string | null>(null);

  // Mermaid SVG state
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);

  // Server execution state
  const [stdinText, setStdinText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // Online hosted sandbox state
  const [isPublishingOnline, setIsPublishingOnline] = useState(false);
  const [onlineSandbox, setOnlineSandbox] = useState<PublishSandboxResult | null>(null);
  const [useOnlineIframe, setUseOnlineIframe] = useState(false);
  const [onlinePublishError, setOnlinePublishError] = useState<string | null>(null);
  const [copiedOnlineUrl, setCopiedOnlineUrl] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const autoExecutedRef = useRef(false);

  useEffect(() => {
    setCode(initialCode);
    const norm = normalizeLanguage(rawLanguage, initialCode);
    const cat = getPreviewCategory(norm);
    setEngine(
      cat === 'sandpack' || hasThirdPartyImports(initialCode)
        ? 'sandpack'
        : 'local'
    );
  }, [initialCode, rawLanguage]);

  const activeSandpack =
    category === 'sandpack' || (sandpackCompatible && engine === 'sandpack');

  // Listen to postMessage only from this sandbox's iframe
  useEffect(() => {
    const handleMsg = (event: MessageEvent) => {
      if (
        !iframeRef.current?.contentWindow ||
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
          ...prev.slice(-79),
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

  // Build / render client iframe / mermaid previews
  useEffect(() => {
    if (activeSandpack) return;
    let cancelled = false;
    setCompileError(null);
    setElapsedMs(null);

    if (category === 'html') {
      setConsoleLogs([]);
      setSrcDoc(buildHtmlSrcDoc(code, darkCanvas));
      return;
    }

    if (category === 'css') {
      setConsoleLogs([]);
      setSrcDoc(buildCssSrcDoc(code, darkCanvas));
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
      if (!isEditingInline) {
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
              ? buildReactSrcDoc(compiled, darkCanvas)
              : buildJsRunnerSrcDoc(compiled, darkCanvas)
          );
        })
        .catch((err) => {
          if (cancelled) return;
          setCompileError(
            err instanceof Error ? err.message : 'Could not compile snippet.'
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
      const diagramId = `inline-mmd-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
  }, [code, language, category, darkCanvas, runCounter, jsRuntime, isEditingInline, activeSandpack]);

  const handleServerExecute = useCallback(async () => {
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
      setExecError(err instanceof Error ? err.message : 'Execution failed.');
    } finally {
      setIsExecuting(false);
    }
  }, [code, language, stdinText, nativeSupported]);

  // Auto-execute server snippet when explicitly opened via user clicking Run
  useEffect(() => {
    if (
      autoExecuteOnMount &&
      !autoExecutedRef.current &&
      category === 'simulated' &&
      nativeSupported &&
      language !== 'bash'
    ) {
      autoExecutedRef.current = true;
      void handleServerExecute();
    }
  }, [autoExecuteOnMount, category, nativeSupported, language, handleServerExecute]);

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

  const isIframeVisual =
    !activeSandpack &&
    (category === 'html' ||
      category === 'css' ||
      category === 'react' ||
      category === 'flet' ||
      category === 'nicegui' ||
      category === 'pyscript');
  const isServerView =
    !activeSandpack &&
    (category === 'simulated' || (category === 'javascript' && jsRuntime === 'node'));

  return (
    <div className="border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#161616] text-[#0d0d0d] dark:text-[#ececec]">
      {/* Embedded Sandbox Sub-bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-neutral-700 dark:text-neutral-200">
            {activeSandpack
              ? 'Sandpack Sandbox'
              : category === 'flet'
              ? 'Flet Live Sandbox'
              : category === 'nicegui'
              ? 'NiceGUI Live Sandbox'
              : category === 'pyscript'
              ? 'PyScript Live Sandbox'
              : isIframeVisual
              ? 'Live Iframe Sandbox'
              : category === 'javascript'
              ? 'JS / TS Sandbox'
              : category === 'stopmotion'
              ? 'Vector Stop Motion'
              : category === 'svg'
              ? 'SVG Render'
              : category === 'mermaid'
              ? 'Mermaid Diagram'
              : category === 'json'
              ? 'JSON Inspector'
              : category === 'csv'
              ? 'CSV Table'
              : nativeSupported
              ? 'Native Sandbox'
              : 'Simulated Runner'}
          </span>

          {sandpackCompatible && category !== 'sandpack' && (
            <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#2a2a2a] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setEngine('local');
                  setRunCounter((c) => c + 1);
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  !activeSandpack
                    ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Local
              </button>
              <button
                type="button"
                onClick={() => setEngine('sandpack')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeSandpack
                    ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Sandpack
              </button>
            </div>
          )}

          {!activeSandpack && category === 'javascript' && (
            <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#2a2a2a] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setJsRuntime('browser');
                  setRunCounter((c) => c + 1);
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  jsRuntime === 'browser'
                    ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Iframe
              </button>
              <button
                type="button"
                onClick={() => setJsRuntime('node')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  jsRuntime === 'node'
                    ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Node.js
              </button>
            </div>
          )}

          {!activeSandpack && elapsedMs && category === 'javascript' && jsRuntime === 'browser' && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              {elapsedMs} ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
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
              title="Host this sandbox online with a live URL"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                useOnlineIframe && onlineSandbox
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'
              }`}
            >
              {isPublishingOnline ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Globe className="w-3 h-3" />
              )}
              <span>{onlineSandbox ? 'Republish' : 'Go Online'}</span>
            </button>
          )}

          {!activeSandpack && (
            <button
              type="button"
              onClick={() => setIsEditingInline((v) => !v)}
              aria-pressed={isEditingInline}
              title="Edit code inline"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                isEditingInline
                  ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'
              }`}
            >
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}

          {(activeSandpack ||
            isIframeVisual ||
            category === 'svg' ||
            category === 'mermaid' ||
            (category === 'javascript' && jsRuntime === 'browser')) && (
            <button
              type="button"
              onClick={() => setDarkCanvas((d) => !d)}
              title={darkCanvas ? 'Light canvas' : 'Dark canvas'}
              aria-label="Toggle sandbox canvas theme"
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
            >
              {darkCanvas ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          )}

          {(activeSandpack ||
            isIframeVisual ||
            (category === 'javascript' && jsRuntime === 'browser' && jsHasDomOutput)) && (
            <button
              type="button"
              onClick={() => setTallIframe((t) => !t)}
              className="px-2 py-1 rounded-md text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              {tallIframe ? 'Compact' : 'Taller'}
            </button>
          )}

          {!activeSandpack && (
            <button
              type="button"
              onClick={() => {
                if (isServerView) {
                  void handleServerExecute();
                } else {
                  setRunCounter((c) => c + 1);
                }
              }}
              disabled={isServerView && isExecuting}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0"
            >
              {isServerView ? (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>{isExecuting ? 'Running...' : 'Run'}</span>
                </>
              ) : (
                <>
                  <RotateCw className="w-2.5 h-2.5" />
                  <span>Re-run</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Live Online Hosted URL Bar */}
      {(onlineSandbox || onlinePublishError) && (
        <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-blue-50/70 dark:bg-blue-950/30 flex flex-wrap items-center justify-between gap-2 text-xs">
          {onlinePublishError ? (
            <span className="text-red-600 dark:text-red-400">{onlinePublishError}</span>
          ) : onlineSandbox ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap">
                  Online URL
                </span>
                <code className="font-mono text-[11px] text-neutral-700 dark:text-neutral-200 truncate max-w-[240px] sm:max-w-[340px]">
                  {onlineSandbox.fullUrl}
                </code>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setUseOnlineIframe((v) => !v)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-[#262626] border border-neutral-200 dark:border-white/10 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
                >
                  {useOnlineIframe ? 'Viewing Online' : 'Switch to Online'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(onlineSandbox.fullUrl);
                      setCopiedOnlineUrl(true);
                      setTimeout(() => setCopiedOnlineUrl(false), 1600);
                    } catch {
                      // Ignore clipboard failure
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-[#262626] border border-neutral-200 dark:border-white/10 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
                >
                  {copiedOnlineUrl ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedOnlineUrl ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={onlineSandbox.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-500 whitespace-nowrap"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Inline Code Editor (optional quick edit right inside the chat message) */}
      {!activeSandpack && isEditingInline && (
        <div className="border-b border-neutral-200 dark:border-white/10 bg-[#0d0d0d] text-[#ececec]">
          <textarea
            value={code}
            onChange={(e) => {
              const next = e.target.value;
              setCode(next);
              onSyncCode?.(next);
            }}
            rows={7}
            spellCheck={false}
            aria-label="Edit snippet inline"
            className="w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-relaxed text-[#ececec] focus:outline-none chat-scroll"
          />
        </div>
      )}

      {/* CodeSandbox Sandpack Embedded Sandbox */}
      {activeSandpack && (
        <SandpackWorkbench
          code={code}
          language={language}
          darkTheme={darkCanvas}
          compact
          heightPx={tallIframe ? 460 : 340}
        />
      )}

      {/* HTML / CSS / React Embedded Sandboxed Iframe */}
      {isIframeVisual && (
        <div>
          {compileError ? (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-mono text-xs whitespace-pre-wrap">
              {compileError}
            </div>
          ) : isCompiling ? (
            <div className="h-32 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400">
              Bundling &amp; mounting sandboxed iframe...
            </div>
          ) : useOnlineIframe && onlineSandbox ? (
            <iframe
              key={`inline-online-${onlineSandbox.id}-${runCounter}`}
              title="Online hosted sandbox iframe"
              sandbox="allow-scripts allow-same-origin allow-forms"
              src={onlineSandbox.url}
              className={`w-full border-0 block transition-all duration-150 ${
                tallIframe ? 'h-[440px]' : 'h-[280px]'
              }`}
            />
          ) : (
            <iframe
              ref={iframeRef}
              key={`inline-iframe-${runCounter}-${darkCanvas}`}
              title="Embedded sandboxed iframe"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className={`w-full border-0 block transition-all duration-150 ${
                tallIframe ? 'h-[440px]' : 'h-[280px]'
              }`}
            />
          )}

          {consoleLogs.length > 0 && (
            <div className="max-h-32 border-t border-neutral-200 dark:border-white/10 bg-[#0d0d0d] text-[#ececec] flex flex-col">
              <div className="px-3 py-1 border-b border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" />
                  Console ({consoleLogs.length})
                </span>
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  className="hover:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-0.5 font-mono text-xs chat-scroll">
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

      {/* JS / TS Browser Iframe + Console OR Node.js */}
      {!activeSandpack && category === 'javascript' && jsRuntime === 'browser' && (
        <div>
          <div className={jsHasDomOutput ? 'border-b border-neutral-200 dark:border-white/10' : 'hidden'}>
            <iframe
              ref={iframeRef}
              key={`inline-js-${runCounter}-${darkCanvas}`}
              title="Embedded JS sandboxed iframe"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className={`w-full border-0 block ${tallIframe ? 'h-[360px]' : 'h-[220px]'}`}
            />
          </div>

          <div className="bg-[#0d0d0d] text-[#ececec] p-3 font-mono text-xs leading-relaxed max-h-52 overflow-y-auto chat-scroll space-y-1">
            {isCompiling ? (
              <div className="text-neutral-400">Executing in sandboxed iframe...</div>
            ) : compileError ? (
              <div className="text-red-400 whitespace-pre-wrap">{compileError}</div>
            ) : consoleLogs.length === 0 ? (
              <div className="text-neutral-500">
                {jsHasDomOutput
                  ? 'DOM rendered inside sandboxed iframe above.'
                  : 'Executed cleanly with no console output.'}
              </div>
            ) : (
              consoleLogs.map((entry) => (
                <div
                  key={entry.id}
                  className={`whitespace-pre-wrap break-words ${
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
      )}

      {/* Server Native Execution (Python, SQL, Bash, Node.js) or Simulated */}
      {isServerView && (
        <div className="bg-[#0d0d0d] text-[#ececec]">
          <div className="px-3 py-2 border-b border-white/10 bg-[#141414]">
            <input
              type="text"
              value={stdinText}
              onChange={(e) => setStdinText(e.target.value)}
              placeholder="Optional stdin..."
              aria-label="Standard input"
              className="w-full bg-transparent text-xs font-mono text-[#ececec] placeholder:text-neutral-500 focus:outline-none"
            />
          </div>
          <div className="p-3 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto chat-scroll space-y-2">
            {execError && <div className="text-red-400">{execError}</div>}
            {!execResult && !isExecuting && !execError && (
              <div className="text-neutral-400">
                Click <span className="text-white font-semibold">Run</span> above to execute this {language} code.
              </div>
            )}
            {isExecuting && (
              <div className="text-neutral-400">
                {nativeSupported ? 'Executing in isolated sandbox...' : 'Running simulation...'}
              </div>
            )}
            {execResult && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 tabular-nums">
                  {execResult.runtime && (
                    <>
                      <span className="text-neutral-200">{execResult.runtime}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span className={execResult.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    Exit {execResult.exitCode}
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
                  <pre className="rounded-lg bg-[#171717] border border-white/10 p-2.5 text-emerald-300 whitespace-pre-wrap overflow-x-auto">
                    {execResult.stdout}
                  </pre>
                )}

                {execResult.stderr && (
                  <pre className="rounded-lg bg-[#171717] border border-red-900/50 p-2.5 text-red-400 whitespace-pre-wrap overflow-x-auto">
                    {execResult.stderr}
                  </pre>
                )}

                {!execResult.stdout && !execResult.stderr && (
                  <div className="text-neutral-500">Finished with empty output.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stop Motion Vector Player */}
      {category === 'stopmotion' && (
        <InlineStopMotionPlayer code={code} />
      )}

      {/* Pixel Art Studio / Viewer */}
      {category === 'pixelart' && (
        <InlinePixelArtViewer code={code} />
      )}

      {/* Three.js 3D Viewer */}
      {category === 'threejs' && (
        <InlineThreeJsViewer code={code} />
      )}

      {/* SVG */}
      {category === 'svg' && (
        <div
          className={`p-5 flex items-center justify-center overflow-auto max-h-[360px] ${
            darkCanvas ? 'bg-[#18181b]' : 'bg-white'
          }`}
          dangerouslySetInnerHTML={{
            __html: code.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''),
          }}
        />
      )}

      {/* Mermaid */}
      {category === 'mermaid' && (
        <div
          className={`p-5 flex items-center justify-center overflow-auto max-h-[380px] ${
            darkCanvas ? 'bg-[#18181b]' : 'bg-white'
          }`}
        >
          {mermaidError ? (
            <div className="text-xs font-mono text-red-500 whitespace-pre-wrap">
              {mermaidError}
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
          )}
        </div>
      )}

      {/* JSON */}
      {category === 'json' && (
        <div className="p-4 max-h-72 overflow-y-auto chat-scroll bg-white dark:bg-[#1a1a1a]">
          {parsedJson?.ok ? (
            <InlineJsonNode value={parsedJson.value} />
          ) : (
            <div className="text-xs font-mono text-red-500">
              {parsedJson?.error || 'Invalid JSON'}
            </div>
          )}
        </div>
      )}

      {/* CSV */}
      {category === 'csv' && (
        <div className="p-3 max-h-72 overflow-auto chat-scroll bg-white dark:bg-[#1a1a1a]">
          {parsedCsv.length === 0 ? (
            <div className="text-xs text-neutral-500">No CSV rows found.</div>
          ) : (
            <table className="w-full border-collapse text-left text-xs tabular-nums">
              <thead className="bg-[#f4f4f4] dark:bg-[#262626] border-b border-neutral-200 dark:border-white/10 font-semibold">
                <tr>
                  {parsedCsv[0].map((cell, idx) => (
                    <th key={idx} className="px-2.5 py-1.5 whitespace-nowrap">
                      {cell || `Col ${idx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedCsv.slice(1).map((row, rIdx) => (
                  <tr key={rIdx} className="border-t border-neutral-200 dark:border-white/10">
                    {parsedCsv[0].map((_, cIdx) => (
                      <td key={cIdx} className="px-2.5 py-1.5 whitespace-nowrap">
                        {row[cIdx] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
