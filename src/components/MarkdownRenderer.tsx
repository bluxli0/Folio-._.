import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, EyeOff, Globe, Maximize2, Play } from 'lucide-react';
import { InlineCodeSandbox } from './InlineCodeSandbox';
import { InlineStopMotionPlayer } from './InlineStopMotionPlayer';
import { InlinePixelArtViewer } from './InlinePixelArtViewer';
import { InlineThreeJsViewer } from './InlineThreeJsViewer';
import { getPreviewCategory, normalizeLanguage } from '../utils/codePreview';
import { VectorStopMotionSpec } from '../types/stopMotion';
import { PixelArtSpec } from '../types/pixelArt';
import { ThreeDSceneSpec } from '../types/threeD';

const AUTO_EMBED_CATEGORIES = new Set([
  'html',
  'css',
  'react',
  'svg',
  'mermaid',
  'javascript',
  'flet',
  'nicegui',
  'pyscript',
  'sandpack',
  'stopmotion',
  'pixelart',
  'threejs',
]);

interface CodeBlockProps {
  language?: string;
  value: string;
  isStreaming?: boolean;
  autoEmbedLive?: boolean;
  onPreviewCode?: (code: string, language: string) => void;
  onOpenStopMotionSpec?: (spec: VectorStopMotionSpec) => void;
  onOpenPixelArtSpec?: (spec: PixelArtSpec) => void;
  onOpenThreeDSpec?: (spec: ThreeDSceneSpec) => void;
}

function CodeBlock({
  language,
  value,
  isStreaming = false,
  autoEmbedLive = false,
  onPreviewCode,
  onOpenStopMotionSpec,
  onOpenPixelArtSpec,
  onOpenThreeDSpec,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [editedValue, setEditedValue] = useState(value);
  const userToggledRef = useRef(false);

  useEffect(() => {
    setEditedValue(value);
  }, [value]);

  const rawLangLower = (language || '').trim().toLowerCase();
  const isPlainText =
    rawLangLower === 'text' ||
    rawLangLower === 'txt' ||
    rawLangLower === 'plaintext' ||
    rawLangLower === 'diff';

  const normalizedLang = useMemo(
    () => normalizeLanguage(language, value),
    [language, value]
  );
  const category = useMemo(
    () => getPreviewCategory(normalizedLang),
    [normalizedLang]
  );

  const canInlineSandbox = !isPlainText && category !== 'markdown';
  const shouldAutoEmbed =
    (autoEmbedLive || category === 'stopmotion' || category === 'pixelart' || category === 'threejs') &&
    !isStreaming &&
    canInlineSandbox &&
    AUTO_EMBED_CATEGORIES.has(category);

  const [inlineOpen, setInlineOpen] = useState<boolean>(shouldAutoEmbed);

  useEffect(() => {
    if (!userToggledRef.current && shouldAutoEmbed) {
      setInlineOpen(true);
    }
  }, [shouldAutoEmbed]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const isExecutableLabel =
    category === 'simulated' || category === 'javascript';

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-neutral-200 dark:border-white/10 bg-[#0d0d0d] text-[#ececec]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2f2f2f] text-xs text-neutral-300 gap-2">
        <span className="font-mono truncate">{language || 'text'}</span>
        <div className="flex items-center gap-1 shrink-0">
          {canInlineSandbox && !isStreaming && (
            <button
              type="button"
              onClick={() => {
                userToggledRef.current = true;
                setInlineOpen((v) => !v);
              }}
              aria-expanded={inlineOpen}
              aria-label={inlineOpen ? 'Hide live sandbox' : 'Run or render inline'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap shrink-0 ${
                inlineOpen
                  ? 'bg-white/15 text-white'
                  : 'text-neutral-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {inlineOpen ? (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Hide sandbox</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>
                    {category === 'stopmotion'
                      ? 'Stop Motion'
                      : category === 'pixelart'
                      ? 'Pixel Art'
                      : category === 'threejs'
                      ? '3D Scene'
                      : category === 'sandpack'
                      ? 'Sandpack'
                      : isExecutableLabel
                      ? 'Run'
                      : 'Live Iframe'}
                  </span>
                </>
              )}
            </button>
          )}

          {onPreviewCode && (
            <button
              type="button"
              onClick={() => onPreviewCode(editedValue, language || '')}
              aria-label="Open in full workbench"
              title="Open in side workbench"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden sm:inline">Workbench</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Code copied' : 'Copy code'}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <pre className="overflow-x-auto p-4 text-[13.5px] leading-relaxed font-mono chat-scroll">
        <code>{value}</code>
      </pre>

      {inlineOpen && !isStreaming && canInlineSandbox && (
        category === 'stopmotion' ? (
          <InlineStopMotionPlayer
            code={editedValue}
            onOpenInStudio={onOpenStopMotionSpec}
          />
        ) : category === 'pixelart' ? (
          <InlinePixelArtViewer
            code={editedValue}
            onOpenInStudio={onOpenPixelArtSpec}
          />
        ) : category === 'threejs' ? (
          <InlineThreeJsViewer
            code={editedValue}
            onOpenInStudio={onOpenThreeDSpec}
          />
        ) : (
          <InlineCodeSandbox
            initialCode={value}
            rawLanguage={language}
            autoExecuteOnMount={true}
            onSyncCode={setEditedValue}
          />
        )
      )}
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  autoEmbedLive?: boolean;
  onPreviewCode?: (code: string, language: string) => void;
  onOpenStopMotionSpec?: (spec: VectorStopMotionSpec) => void;
  onOpenPixelArtSpec?: (spec: PixelArtSpec) => void;
  onOpenThreeDSpec?: (spec: ThreeDSceneSpec) => void;
  onPreviewWebUrl?: (url: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isStreaming = false,
  autoEmbedLive = false,
  onPreviewCode,
  onOpenStopMotionSpec,
  onOpenPixelArtSpec,
  onOpenThreeDSpec,
  onPreviewWebUrl,
}) => {
  return (
    <div className="text-[15.5px] leading-[1.7] text-[#0d0d0d] dark:text-[#ececec] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#0d0d0d] dark:text-white mt-6 mb-3 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-xl font-semibold tracking-tight text-[#0d0d0d] dark:text-white mt-6 mb-2.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-lg font-semibold text-[#0d0d0d] dark:text-white mt-5 mb-2 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-5 list-disc space-y-1.5 marker:text-neutral-400 dark:marker:text-neutral-500 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-5 list-decimal space-y-1.5 marker:text-neutral-500 dark:marker:text-neutral-400 marker:font-mono marker:text-sm last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1">{children}</li>
          ),
          a: ({ href, children }) => {
            const canPreview =
              Boolean(onPreviewWebUrl) &&
              Boolean(href) &&
              (/^https?:\/\//i.test(href || '') || (href || '').startsWith('/sandbox/'));
            return (
              <span className="inline-flex items-center gap-1 flex-wrap align-baseline">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline decoration-blue-600/30 underline-offset-4 hover:decoration-blue-600 dark:hover:decoration-blue-400 transition-colors"
                >
                  {children}
                </a>
                {canPreview && href && onPreviewWebUrl && (
                  <button
                    type="button"
                    onClick={() => onPreviewWebUrl(href)}
                    title={`Render ${href} inside Folio`}
                    aria-label={`Preview website ${href}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-blue-500/25 bg-blue-500/10 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors whitespace-nowrap shrink-0 align-middle"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                )}
              </span>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#2a2a2a] px-4 py-3 text-neutral-700 dark:text-neutral-300">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-6 border-t border-neutral-200 dark:border-white/10" />
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-neutral-200 dark:border-white/10">
              <table className="w-full border-collapse text-left text-sm tabular-nums">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#f4f4f4] dark:bg-[#2a2a2a] border-b border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-white font-semibold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 border-t border-neutral-200 dark:border-white/10 align-top">
              {children}
            </td>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const match = /language-([^\s]+)/.exec(className || '');
            const rawCode = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || rawCode.includes('\n');

            if (isBlock) {
              return (
                <CodeBlock
                  language={match?.[1]}
                  value={rawCode}
                  isStreaming={isStreaming}
                  autoEmbedLive={autoEmbedLive}
                  onPreviewCode={onPreviewCode}
                  onOpenStopMotionSpec={onOpenStopMotionSpec}
                  onOpenPixelArtSpec={onOpenPixelArtSpec}
                  onOpenThreeDSpec={onOpenThreeDSpec}
                />
              );
            }

            return (
              <code
                className="rounded-md bg-[#f4f4f4] dark:bg-[#2f2f2f] px-1.5 py-0.5 font-mono text-[0.875em] text-[#0d0d0d] dark:text-[#ececec]"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
