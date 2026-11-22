import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  BookmarkPlus,
  Braces,
  Code2,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { ChatAttachment, CustomPresetItem, ModelChoiceId } from '../types/chat';
import { TEXT_ANIMATION_PRESETS } from '../data/presets';
import {
  UNICODE_STYLE_OPTIONS,
  UnicodeStyleKind,
  transformUnicodeText,
} from '../utils/textFormatting';

interface ComposerProps {
  isStreaming: boolean;
  centered?: boolean;
  activeModelId?: ModelChoiceId;
  externalAttachments?: ChatAttachment[];
  onConsumeExternalAttachments?: () => void;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
  onQuickGenerateImage?: (prompt: string, attachments: ChatAttachment[]) => void;
  immersivePureCode?: boolean;
  onTogglePureCode?: () => void;
  onOpenToolsModal?: () => void;
  enabledToolsCount?: number;
}

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const INLINE_TEXT_BUDGET_CHARS = 48_000;
const INLINE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const CUSTOM_PRESETS_KEY = 'folio-custom-presets-v1';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonc', 'bbmodel', 'csv', 'tsv',
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'html', 'htm', 'css',
  'scss', 'yaml', 'yml', 'toml', 'ini', 'env', 'xml', 'svg', 'sql',
  'sh', 'bash', 'log', 'diff', 'patch', 'tex', 'latex', 'obj', 'mtl',
  'gltf', 'stl', 'rs', 'go', 'java', 'cpp', 'c', 'h',
]);

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function getActiveWorkspaceId(): string {
  try {
    const saved = localStorage.getItem('folio-active-workspace-v1');
    if (saved && /^[a-zA-Z0-9_-]{3,64}$/.test(saved)) return saved;
  } catch {
    // Ignore storage error
  }
  return 'folio-sandbox-1';
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function formatTokenEstimate(tokens?: number): string {
  if (!tokens) return '';
  if (tokens < 1000) return `~${tokens} tok`;
  if (tokens < 1_000_000) return `~${(tokens / 1000).toFixed(1)}k tok`;
  return `~${(tokens / 1_000_000).toFixed(2)}M tok`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildTokenBudgetedExcerpt(text: string, filename: string, totalBytes: number): string {
  const head = text.slice(0, Math.floor(INLINE_TEXT_BUDGET_CHARS * 0.65));
  const tail = text.slice(-Math.floor(INLINE_TEXT_BUDGET_CHARS * 0.25));
  const totalTok = estimateTokens(text);
  return [
    `[Large file "${filename}" (${formatBytes(totalBytes)}, ~${totalTok.toLocaleString()} tokens) — full file saved to workspace; showing head & tail excerpt. Use workspace_read_file with startOffset/maxChars to inspect any section.]`,
    '--- START OF FILE ---',
    head,
    '--- ... MIDDLE OMITTED FOR TOKEN BUDGET ... ---',
    tail,
    '--- END OF FILE ---',
  ].join('\n');
}

async function uploadFileToWorkspace(file: File): Promise<string | null> {
  const wsId = getActiveWorkspaceId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relPath = `uploads/${Date.now()}-${safeName}`;
  try {
    const res = await fetch(
      `/api/workspace/${encodeURIComponent(wsId)}/upload-large?path=${encodeURIComponent(relPath)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { path?: string };
    return data.path || relPath;
  } catch {
    return null;
  }
}

function loadCustomPresets(): CustomPresetItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomPresetItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface StockSearchResponse {
  icons: Array<{ id: string; svgUrl: string }>;
  images: Array<{ title: string; url: string; thumbUrl: string; license: string }>;
  gifs: Array<{ title: string; url: string; thumbUrl: string; license: string }>;
}

export const Composer: React.FC<ComposerProps> = ({
  isStreaming,
  centered = false,
  activeModelId,
  externalAttachments,
  onConsumeExternalAttachments,
  onSend,
  onStop,
  onQuickGenerateImage,
  immersivePureCode = false,
  onTogglePureCode,
  onOpenToolsModal,
  enabledToolsCount = 0,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formatBarOpen, setFormatBarOpen] = useState(false);
  const [activeUnicodeStyle, setActiveUnicodeStyle] = useState<UnicodeStyleKind>('normal');

  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [plusSubDrawer, setPlusSubDrawer] = useState<'none' | 'stock' | 'link' | 'presets'>('none');

  const [stockQuery, setStockQuery] = useState('');
  const [stockKind, setStockKind] = useState<'all' | 'gifs' | 'images' | 'icons'>('all');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockResults, setStockResults] = useState<StockSearchResponse | null>(null);

  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [customPresets, setCustomPresets] = useState<CustomPresetItem[]>(loadCustomPresets);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetPrompt, setNewPresetPrompt] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalAttachments && externalAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...externalAttachments].slice(0, 6));
      onConsumeExternalAttachments?.();
    }
  }, [externalAttachments, onConsumeExternalAttachments]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (!plusMenuOpen && plusSubDrawer === 'none') return;
    const handleOutside = (e: MouseEvent) => {
      if (plusContainerRef.current && !plusContainerRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlusMenuOpen(false);
        setPlusSubDrawer('none');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [plusMenuOpen, plusSubDrawer]);

  const persistCustomPresets = (next: CustomPresetItem[]) => {
    setCustomPresets(next);
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  };

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setAttachmentError(null);
    const added: ChatAttachment[] = [];

    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = file.type.startsWith('image/');
      const isText =
        file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        TEXT_EXTENSIONS.has(ext);

      if (file.size > MAX_FILE_BYTES) {
        setAttachmentError(`${file.name} exceeds the 200 MB per-file limit.`);
        continue;
      }

      if (!isImage && !isText) {
        const savedPath = await uploadFileToWorkspace(file);
        if (!savedPath) {
          setAttachmentError(`Could not upload binary file ${file.name} to workspace.`);
          continue;
        }
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          isText: true,
          workspacePath: savedPath,
          tokenEstimate: Math.ceil(file.size / 4),
          truncatedForContext: true,
          source: 'upload',
          textContent: `[Asset file "${file.name}" (${formatBytes(file.size)}) uploaded to workspace at "${savedPath}".]`,
        });
        continue;
      }

      try {
        if (isImage) {
          if (file.size > INLINE_IMAGE_MAX_BYTES) {
            const savedPath = await uploadFileToWorkspace(file);
            added.push({
              id: crypto.randomUUID(),
              name: file.name,
              mimeType: file.type,
              size: file.size,
              isText: true,
              workspacePath: savedPath || undefined,
              tokenEstimate: 1024,
              truncatedForContext: true,
              source: 'upload',
              textContent: `[Large image "${file.name}" (${formatBytes(file.size)}) saved in workspace at "${savedPath || file.name}".]`,
            });
          } else {
            const base64 = await readFileAsBase64(file);
            const previewUrl = `data:${file.type};base64,${base64}`;
            added.push({
              id: crypto.randomUUID(),
              name: file.name,
              mimeType: file.type,
              size: file.size,
              isText: false,
              data: base64,
              previewUrl,
              tokenEstimate: 258,
              source: 'upload',
            });
          }
        } else if (file.size > 180 * 1024) {
          const savedPath = await uploadFileToWorkspace(file);
          let excerptText = '';
          let fullTokens = Math.ceil(file.size / 4);
          if (file.size <= 16 * 1024 * 1024) {
            const fullText = await file.text();
            fullTokens = estimateTokens(fullText);
            excerptText =
              fullText.length > INLINE_TEXT_BUDGET_CHARS
                ? buildTokenBudgetedExcerpt(fullText, file.name, file.size)
                : fullText;
          } else {
            const headChunk = await file.slice(0, 32 * 1024).text();
            const tailChunk = await file.slice(Math.max(0, file.size - 16 * 1024)).text();
            excerptText = buildTokenBudgetedExcerpt(`${headChunk}\n${tailChunk}`, file.name, file.size);
          }

          added.push({
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: file.type || 'text/plain',
            size: file.size,
            isText: true,
            textContent: excerptText,
            tokenEstimate: fullTokens,
            workspacePath: savedPath || undefined,
            truncatedForContext: true,
            source: 'upload',
          });
        } else {
          const textContent = await file.text();
          added.push({
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: file.type || 'text/plain',
            size: file.size,
            isText: true,
            textContent,
            tokenEstimate: estimateTokens(textContent),
            source: 'upload',
          });
        }
      } catch {
        setAttachmentError(`Failed to read ${file.name}.`);
      }
    }

    if (added.length > 0) {
      setAttachments((prev) => [...prev, ...added].slice(0, 6));
    }
  };

  const handleSearchStock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = stockQuery.trim() || 'animation';
    setStockLoading(true);
    try {
      const res = await fetch(
        `/api/stock/search?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(stockKind)}&limit=8`
      );
      if (res.ok) {
        const data = (await res.json()) as StockSearchResponse;
        setStockResults(data);
      }
    } catch {
      // ignore transient error
    } finally {
      setStockLoading(false);
    }
  };

  const handleAttachStockItem = (name: string, url: string, mimeType: string) => {
    setAttachments((prev) =>
      [
        ...prev,
        {
          id: crypto.randomUUID(),
          name,
          mimeType,
          size: url.length,
          isText: true,
          previewUrl: url,
          linkUrl: url,
          source: 'stock' as const,
          textContent: `[Stock reference media "${name}": ${url}]`,
        },
      ].slice(0, 6)
    );
    setPlusSubDrawer('none');
    setPlusMenuOpen(false);
  };

  const handleAttachLink = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = linkUrlInput.trim();
    if (!raw) return;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setAttachments((prev) =>
      [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: normalized.replace(/^https?:\/\//, '').slice(0, 42),
          mimeType: 'text/uri-list',
          size: normalized.length,
          isText: true,
          linkUrl: normalized,
          source: 'link' as const,
          textContent: `[Attached web reference URL: ${normalized}]`,
        },
      ].slice(0, 6)
    );
    setLinkUrlInput('');
    setPlusSubDrawer('none');
    setPlusMenuOpen(false);
  };

  const handleAddCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetLabel.trim() || !newPresetPrompt.trim()) return;
    const item: CustomPresetItem = {
      id: crypto.randomUUID(),
      label: newPresetLabel.trim(),
      promptPrefix: newPresetPrompt.trim(),
      createdAt: Date.now(),
    };
    persistCustomPresets([item, ...customPresets]);
    setNewPresetLabel('');
    setNewPresetPrompt('');
  };

  const handleSubmit = () => {
    if (isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setText('');
    setAttachments([]);
    setAttachmentError(null);
    setPlusMenuOpen(false);
    setPlusSubDrawer('none');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = !isStreaming && (text.trim().length > 0 || attachments.length > 0);
  const isImageMode = activeModelId === 'nano-banana-lite';

  return (
    <div
      className={
        centered
          ? 'w-full'
          : 'shrink-0 bg-white dark:bg-[#212121] pt-1 pb-3 sm:pb-4 px-3 sm:px-6'
      }
    >
      <div className="max-w-3xl mx-auto relative">
        {attachmentError && (
          <div className="mb-2 px-3.5 py-2 rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span>{attachmentError}</span>
            <button
              type="button"
              onClick={() => setAttachmentError(null)}
              aria-label="Dismiss error"
              className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Sub-Drawers triggered from + squircle menu */}
        {plusSubDrawer !== 'none' && (
          <div className="mb-2.5 rounded-2xl border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#26272b] p-3.5 shadow-xl text-xs space-y-3 folio-oxygen-entrance">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#0d0d0d] dark:text-white flex items-center gap-1.5">
                {plusSubDrawer === 'stock' && (
                  <>
                    <Film className="w-4 h-4 text-sky-500" />
                    <span>Stock Media, Icons &amp; Animated GIFs</span>
                  </>
                )}
                {plusSubDrawer === 'link' && (
                  <>
                    <Link2 className="w-4 h-4 text-emerald-500" />
                    <span>Attach Web Reference Link</span>
                  </>
                )}
                {plusSubDrawer === 'presets' && (
                  <>
                    <BookmarkPlus className="w-4 h-4 text-violet-500" />
                    <span>Custom Presets &amp; Animated Text Macros</span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setPlusSubDrawer('none')}
                aria-label="Close drawer"
                className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {plusSubDrawer === 'stock' && (
              <div className="space-y-2.5">
                <form onSubmit={handleSearchStock} className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    value={stockQuery}
                    onChange={(e) => setStockQuery(e.target.value)}
                    placeholder="Search icons, Wikimedia photos, or GIFs..."
                    className="flex-1 min-w-[180px] h-8 rounded-xl border border-neutral-200 dark:border-white/15 bg-[#f6f6f7] dark:bg-[#1a1b1f] px-3 text-xs text-[#0d0d0d] dark:text-white focus:outline-none"
                  />
                  <select
                    value={stockKind}
                    onChange={(e) => setStockKind(e.target.value as 'all' | 'gifs' | 'images' | 'icons')}
                    aria-label="Stock media filter"
                    className="h-8 rounded-xl border border-neutral-200 dark:border-white/15 bg-[#f6f6f7] dark:bg-[#1a1b1f] px-2 text-xs text-[#0d0d0d] dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="gifs">GIFs</option>
                    <option value="images">Images</option>
                    <option value="icons">SVG Icons</option>
                  </select>
                  <button
                    type="submit"
                    disabled={stockLoading}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-xl bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {stockLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Search</span>
                  </button>
                </form>

                {stockResults && (
                  <div className="max-h-48 overflow-y-auto chat-scroll grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {stockResults.gifs.map((g) => (
                      <button
                        key={g.url}
                        type="button"
                        onClick={() => handleAttachStockItem(g.title, g.url, 'image/gif')}
                        className="group/item rounded-xl border border-neutral-200 dark:border-white/10 p-1.5 text-left hover:border-sky-500 transition-colors bg-[#fafafa] dark:bg-[#1b1c20]"
                      >
                        <img
                          src={g.thumbUrl}
                          alt={g.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-16 object-cover rounded-lg mb-1"
                        />
                        <div className="text-[10px] font-medium truncate">GIF · {g.title}</div>
                      </button>
                    ))}
                    {stockResults.images.map((im) => (
                      <button
                        key={im.url}
                        type="button"
                        onClick={() => handleAttachStockItem(im.title, im.url, 'image/jpeg')}
                        className="group/item rounded-xl border border-neutral-200 dark:border-white/10 p-1.5 text-left hover:border-sky-500 transition-colors bg-[#fafafa] dark:bg-[#1b1c20]"
                      >
                        <img
                          src={im.thumbUrl}
                          alt={im.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-16 object-cover rounded-lg mb-1"
                        />
                        <div className="text-[10px] font-medium truncate">{im.title}</div>
                      </button>
                    ))}
                    {stockResults.icons.map((ic) => (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => handleAttachStockItem(`${ic.id}.svg`, ic.svgUrl, 'image/svg+xml')}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200 dark:border-white/10 p-2 hover:border-sky-500 transition-colors bg-[#fafafa] dark:bg-[#1b1c20]"
                      >
                        <img
                          src={ic.svgUrl}
                          alt={ic.id}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 object-contain dark:invert"
                        />
                        <span className="text-[10px] font-mono truncate w-full text-center">{ic.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {plusSubDrawer === 'link' && (
              <form onSubmit={handleAttachLink} className="flex items-center gap-2">
                <input
                  type="url"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  placeholder="https://example.com/reference"
                  className="flex-1 h-8 rounded-xl border border-neutral-200 dark:border-white/15 bg-[#f6f6f7] dark:bg-[#1a1b1f] px-3 text-xs font-mono text-[#0d0d0d] dark:text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-8 px-3 rounded-xl bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] font-medium"
                >
                  Attach
                </button>
              </form>
            )}

            {plusSubDrawer === 'presets' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Animated Text Presets (Stop Motion v3)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_ANIMATION_PRESETS.map((tp) => (
                      <button
                        key={tp.id}
                        type="button"
                        onClick={() => {
                          setText((prev) => (prev ? `${prev}\n${tp.promptSnippet}` : tp.promptSnippet));
                          setPlusSubDrawer('none');
                          setPlusMenuOpen(false);
                        }}
                        title={tp.description}
                        className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-white/15 bg-[#f7f7f8] dark:bg-[#1b1c20] hover:border-sky-500 text-[11px] font-medium"
                      >
                        {tp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-neutral-200 dark:border-white/10 pt-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Your Saved Presets ({customPresets.length})
                  </div>
                  {customPresets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customPresets.map((cp) => (
                        <div
                          key={cp.id}
                          className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 dark:border-white/15 bg-[#f7f7f8] dark:bg-[#1b1c20] pl-2.5 pr-1 py-1"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setText((prev) => (prev ? `${cp.promptPrefix}\n${prev}` : cp.promptPrefix));
                              setPlusSubDrawer('none');
                              setPlusMenuOpen(false);
                            }}
                            className="text-[11px] font-medium hover:underline"
                          >
                            {cp.label}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              persistCustomPresets(customPresets.filter((item) => item.id !== cp.id))
                            }
                            aria-label={`Delete preset ${cp.label}`}
                            className="p-0.5 text-neutral-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddCustomPreset} className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newPresetLabel}
                      onChange={(e) => setNewPresetLabel(e.target.value)}
                      placeholder="Preset name"
                      className="h-8 rounded-xl border border-neutral-200 dark:border-white/15 bg-[#f6f6f7] dark:bg-[#1a1b1f] px-2.5 text-xs"
                    />
                    <input
                      type="text"
                      value={newPresetPrompt}
                      onChange={(e) => setNewPresetPrompt(e.target.value)}
                      placeholder="Prompt prefix or style instructions..."
                      className="h-8 rounded-xl border border-neutral-200 dark:border-white/15 bg-[#f6f6f7] dark:bg-[#1a1b1f] px-2.5 text-xs"
                    />
                    <button
                      type="submit"
                      className="h-8 rounded-xl bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium"
                    >
                      Save Preset
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void processFiles(e.dataTransfer.files);
          }}
          className={`rounded-[26px] border transition-colors duration-150 bg-[#f4f4f4] dark:bg-[#2f2f2f] ${
            isDragging
              ? 'border-neutral-500 dark:border-white/40 ring-2 ring-neutral-400/25'
              : 'border-neutral-200 dark:border-white/10 focus-within:border-neutral-300 dark:focus-within:border-white/20'
          }`}
        >
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3.5 pb-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative group flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#212121] px-2.5 py-1.5 text-xs text-[#0d0d0d] dark:text-[#ececec]"
                >
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                  <div className="min-w-0 max-w-[175px]">
                    <div className="truncate font-medium">{att.name}</div>
                    <div className="text-[11px] text-neutral-400 tabular-nums truncate">
                      {att.source === 'stock'
                        ? 'Stock'
                        : att.source === 'link'
                        ? 'Link'
                        : formatBytes(att.size)}
                      {att.tokenEstimate ? ` · ${formatTokenEstimate(att.tokenEstimate)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                    }
                    aria-label={`Remove ${att.name}`}
                    className="p-1 rounded-md text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {formatBarOpen && (
            <div className="px-4 pt-3 pb-1 flex flex-wrap items-center gap-1 border-b border-neutral-200/70 dark:border-white/10">
              {([1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    const el = textareaRef.current;
                    const prefix = `${'#'.repeat(lvl)} `;
                    if (!el) {
                      setText((prev) => `${prefix}${prev}`);
                      return;
                    }
                    const start = el.selectionStart ?? 0;
                    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
                    const updated = `${text.slice(0, lineStart)}${prefix}${text.slice(lineStart)}`;
                    setText(updated);
                    requestAnimationFrame(() => {
                      el.focus();
                      el.setSelectionRange(start + prefix.length, start + prefix.length);
                    });
                  }}
                  title={`Insert H${lvl} chat heading`}
                  className="px-2 py-1 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#222] text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10"
                >
                  H{lvl}
                </button>
              ))}

              <span className="mx-1 text-neutral-300 dark:text-neutral-600">|</span>

              {UNICODE_STYLE_OPTIONS.map((opt) => {
                const isActive = activeUnicodeStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const el = textareaRef.current;
                      if (el && el.selectionStart !== el.selectionEnd) {
                        const s = el.selectionStart;
                        const end = el.selectionEnd;
                        const transformed = transformUnicodeText(text.slice(s, end), opt.id);
                        setText(`${text.slice(0, s)}${transformed}${text.slice(end)}`);
                        requestAnimationFrame(() => {
                          el.focus();
                          el.setSelectionRange(s, s + transformed.length);
                        });
                      } else {
                        setActiveUnicodeStyle(opt.id);
                        el?.focus();
                      }
                    }}
                    title={`Transform selection or type in ${opt.label}`}
                    className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${
                      isActive
                        ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                        : 'border-neutral-200 dark:border-white/15 bg-white dark:bg-[#222] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {opt.sample}
                  </button>
                );
              })}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              const nextVal = e.target.value;
              if (activeUnicodeStyle !== 'normal' && nextVal.length > text.length) {
                const el = e.target;
                const cursor = el.selectionStart ?? nextVal.length;
                const addedLen = nextVal.length - text.length;
                const insertStart = Math.max(0, cursor - addedLen);
                const inserted = nextVal.slice(insertStart, cursor);
                const converted = transformUnicodeText(inserted, activeUnicodeStyle);
                const patched = `${nextVal.slice(0, insertStart)}${converted}${nextVal.slice(cursor)}`;
                setText(patched);
                requestAnimationFrame(() => {
                  const newPos = insertStart + converted.length;
                  textareaRef.current?.setSelectionRange(newPos, newPos);
                });
              } else {
                setText(nextVal);
              }
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              isImageMode
                ? 'Describe an image to synthesize with Nano Banana Lite...'
                : immersivePureCode
                ? 'Pure Code Mode — describe the app, 3D scene, or animation to generate in pure runnable code...'
                : 'Message Folio v(OXYGEN)...'
            }
            aria-label="Message input"
            className="w-full resize-none bg-transparent px-5 pt-3.5 pb-2 text-[15.5px] leading-relaxed text-[#0d0d0d] dark:text-[#ececec] placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none chat-scroll max-h-[200px]"
          />

          <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-0.5">
            <div ref={plusContainerRef} className="relative flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.markdown,.json,.bbmodel,.csv,.tsv,.ts,.tsx,.js,.jsx,.py,.html,.css,.yaml,.yml,.toml,.ini,.env,.xml,.svg,.sql,.sh,.log,.diff,.patch,.tex,.obj,.gltf,.glb,.stl"
                onChange={(e) => {
                  void processFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />

              {/* Morphing Squircle + Menu Trigger (squircle -> up arrow -> circle) */}
              <button
                type="button"
                data-open={plusMenuOpen ? 'true' : 'false'}
                onClick={() => setPlusMenuOpen((v) => !v)}
                aria-label="Open composer attachments & presets menu"
                aria-expanded={plusMenuOpen}
                title="Upload files, Stock GIFs, Links, Presets & Image Gen"
                className={`folio-squircle-btn inline-flex items-center justify-center w-9 h-9 border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                  plusMenuOpen
                    ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] border-transparent'
                    : 'bg-white dark:bg-[#232428] border-neutral-200 dark:border-white/15 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                }`}
              >
                {plusMenuOpen ? (
                  <ArrowUp className="w-4 h-4 stroke-[2.25]" />
                ) : (
                  <Plus className="w-4 h-4 stroke-[2.25]" />
                )}
              </button>

              {plusMenuOpen && (
                <div
                  role="menu"
                  aria-label="Composer tools"
                  className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#27282c] p-1.5 shadow-2xl z-40 space-y-0.5"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-neutral-500 shrink-0" />
                    <span>Upload file (up to 200 MB)</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      setPlusSubDrawer('stock');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors"
                  >
                    <Film className="w-4 h-4 text-sky-500 shrink-0" />
                    <span>Stock Media, Icons &amp; GIFs</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      setPlusSubDrawer('link');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors"
                  >
                    <Link2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Attach Web Reference Link</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      setPlusSubDrawer('presets');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors"
                  >
                    <BookmarkPlus className="w-4 h-4 text-violet-500 shrink-0" />
                    <span>Presets &amp; Text Animations</span>
                  </button>

                  {onQuickGenerateImage && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!text.trim()}
                      onClick={() => {
                        if (!text.trim()) return;
                        setPlusMenuOpen(false);
                        onQuickGenerateImage(text.trim(), attachments);
                        setText('');
                        setAttachments([]);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Generate Image (Nano Banana)</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setFormatBarOpen((v) => !v)}
                title="Unicode 𝚏𝚘𝚛𝚖𝚊𝚝𝚝𝚒𝚗𝚐 & Chat Headings (H1/H2/H3)"
                className={`inline-flex items-center gap-1 px-2 h-8 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  formatBarOpen || activeUnicodeStyle !== 'normal'
                    ? 'border-neutral-400 dark:border-white/30 bg-white dark:bg-[#232428] text-[#0d0d0d] dark:text-white'
                    : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Aa</span>
              </button>

              {onTogglePureCode && (
                <button
                  type="button"
                  onClick={onTogglePureCode}
                  title="Immersive Pure-Code Responses (replies in pure runnable code with live sandboxes)"
                  className={`inline-flex items-center gap-1 px-2 h-8 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    immersivePureCode
                      ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                      : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pure Code</span>
                </button>
              )}

              {onOpenToolsModal && (
                <button
                  type="button"
                  onClick={onOpenToolsModal}
                  title="Environment Function Calling Tools & Custom Functions"
                  className="inline-flex items-center gap-1 px-2 h-8 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                >
                  <Braces className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    Functions{enabledToolsCount > 0 ? ` (${enabledToolsCount})` : ''}
                  </span>
                </button>
              )}

              {isImageMode && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 px-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Nano Banana Image Mode</span>
                </span>
              )}
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-85 transition-opacity shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-label="Send message"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] disabled:bg-neutral-300 dark:disabled:bg-[#676767] disabled:text-neutral-500 dark:disabled:text-[#2f2f2f] hover:opacity-90 transition-opacity shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.25]" />
              </button>
            )}
          </div>
        </div>

        {!centered && (
          <p className="mt-2 text-center text-[11px] text-neutral-500 dark:text-neutral-400">
            Folio v(OXYGEN) can make mistakes. Verify important information.
          </p>
        )}
      </div>
    </div>
  );
};
