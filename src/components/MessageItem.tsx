import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Braces,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  FolderPlus,
  FolderTree,
  Layers,
  Loader2,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { VectorStopMotionSpec } from '../types/stopMotion';
import { PixelArtSpec } from '../types/pixelArt';
import { ThreeDSceneSpec } from '../types/threeD';
import { getModelOption } from '../data/presets';
import { MarkdownRenderer } from './MarkdownRenderer';
import { exportMessageAsJson, exportMessageAsXml } from '../utils/threadExport';
import {
  HiddenLayerCategory,
  HiddenLayerFinding,
  HiddenLayerReport,
  analyzeHiddenLayer,
  applyAllSafeFixes,
  applyHiddenLayerFix,
} from '../utils/hiddenLayerParser';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming: boolean;
  isLatestModelMessage: boolean;
  canEditOrRegenerate: boolean;
  onEditAndResend: (messageId: string, newText: string) => void;
  onUpdateMessage: (messageId: string, patch: Partial<ChatMessage>) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerate: () => void;
  onRetryError: () => void;
  onRetryWithFallback?: () => void;
  onSwitchToNeo4?: () => void;
  onPreviewCode?: (code: string, language: string) => void;
  onSaveCodeToFolder?: (code: string, language: string) => void;
  onCreateFoldersInWorkspace?: (
    folders: string[],
    fileTargets: Array<{ path: string; code?: string }>
  ) => Promise<{ workspaceId: string; createdCount: number } | null>;
  onOpenStopMotionSpec?: (spec: VectorStopMotionSpec) => void;
  onOpenPixelArtSpec?: (spec: PixelArtSpec) => void;
  onOpenThreeDSpec?: (spec: ThreeDSceneSpec) => void;
  onPreviewWebUrl?: (url: string) => void;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

interface CellMenuProps {
  message: ChatMessage;
  isUser: boolean;
  copied: boolean;
  isSpeaking: boolean;
  thoughtsOpen: boolean;
  layerOpen: boolean;
  layerBadgeText?: string;
  layerBadgeTone?: 'error' | 'warning' | 'folder' | 'clean';
  isLatestModelMessage: boolean;
  canMutate: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onToggleThoughts: () => void;
  onToggleLayerParser: () => void;
  onToggleCensor: () => void;
  onTogglePin: () => void;
  onToggleSpeak: () => void;
  onDownloadCell: () => void;
  onDownloadJson: () => void;
  onDownloadXml: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

const CellMenu: React.FC<CellMenuProps> = ({
  message,
  isUser,
  copied,
  isSpeaking,
  thoughtsOpen,
  layerOpen,
  layerBadgeText,
  layerBadgeTone,
  isLatestModelMessage,
  canMutate,
  onCopy,
  onEdit,
  onToggleThoughts,
  onToggleLayerParser,
  onToggleCensor,
  onTogglePin,
  onToggleSpeak,
  onDownloadCell,
  onDownloadJson,
  onDownloadXml,
  onRegenerate,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const computeMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || typeof window === 'undefined') return null;
    const menuWidth = 248;
    const estimatedHeight = 360;
    const pad = 10;
    let left = isUser ? rect.right - menuWidth : rect.left;
    if (left + menuWidth > window.innerWidth - pad) {
      left = window.innerWidth - menuWidth - pad;
    }
    if (left < pad) left = pad;

    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - pad && rect.top - estimatedHeight > pad) {
      top = Math.max(pad, rect.top - estimatedHeight - 6);
    } else if (top + 220 > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - pad * 2) - pad);
    }
    return { top, left };
  };

  useEffect(() => {
    if (!open) return;
    setMenuPos(computeMenuPosition());
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleReposition = () => {
      setMenuPos(computeMenuPosition());
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runAction = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const hasText = Boolean(message.text && message.text.trim().length > 0);
  const hasThoughts = Boolean(message.thoughts && message.thoughts.trim().length > 0);
  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Message actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white hover:bg-[#ececec] dark:hover:bg-[#2f2f2f] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Message actions"
          style={
            menuPos
              ? {
                  position: 'fixed',
                  top: `${menuPos.top}px`,
                  left: `${menuPos.left}px`,
                }
              : undefined
          }
          className="w-[248px] max-h-[calc(100vh-24px)] overflow-y-auto chat-scroll z-50 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] p-1.5 text-[#0d0d0d] dark:text-[#ececec] shadow-2xl"
        >
          {hasText && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onCopy)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
              )}
              <span>{copied ? 'Copied' : 'Copy text'}</span>
            </button>
          )}

          {canMutate && !message.error && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onEdit)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <Pencil className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
              <span>Edit</span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onToggleThoughts)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <span className="flex items-center gap-2.5">
              <BrainCircuit className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400 shrink-0" />
              <span>{thoughtsOpen ? 'Hide thoughts' : 'Show thoughts'}</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-300">
              {hasThoughts ? 'View/Edit' : 'Add'}
            </span>
          </button>

          {hasText && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onToggleLayerParser)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <span className="flex items-center gap-2.5">
                <Layers className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                <span>{layerOpen ? 'Hide code layer' : 'Hidden code layer'}</span>
              </span>
              {layerBadgeText && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                    layerBadgeTone === 'error'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                      : layerBadgeTone === 'warning'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : layerBadgeTone === 'folder'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {layerBadgeText}
                </span>
              )}
            </button>
          )}

          {hasText && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onToggleCensor)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              {message.censored ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                  <span>Uncensor</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                  <span>Censor</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onTogglePin)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            {message.pinned ? (
              <>
                <PinOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Unpin</span>
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                <span>Pin</span>
              </>
            )}
          </button>

          {hasText && speechSupported && !message.censored && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onToggleSpeak)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-200 shrink-0" />
                  <span>Stop reading</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                  <span>Read aloud</span>
                </>
              )}
            </button>
          )}

          {!isUser && isLatestModelMessage && canMutate && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onRegenerate)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
              <span>Regenerate</span>
            </button>
          )}

          {(hasText || message.error) && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(onDownloadCell)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                <span>Export .md</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(onDownloadJson)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                <FileCode2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Export .json</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(onDownloadXml)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                <FileCode2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Export .xml</span>
              </button>
            </>
          )}

          {canMutate && (
            <>
              <div className="my-1 border-t border-neutral-200 dark:border-white/10" />
              <button
                type="button"
                role="menuitem"
                onClick={() => runAction(onDelete)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface ThoughtsDrawerProps {
  thoughts: string;
  isStreaming: boolean;
  canEdit: boolean;
  onSaveThoughts: (nextThoughts: string) => void;
  onClose: () => void;
}

const ThoughtsDrawer: React.FC<ThoughtsDrawerProps> = ({
  thoughts,
  isStreaming,
  canEdit,
  onSaveThoughts,
  onClose,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thoughts);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(thoughts);
    }
  }, [thoughts, editing]);

  const handleCopyThoughts = async () => {
    try {
      await navigator.clipboard.writeText(thoughts);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="w-full rounded-2xl border border-violet-500/25 bg-violet-50/50 dark:bg-[#25242c] p-3.5 text-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-violet-700 dark:text-violet-300">
          <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
          <span>Model Thoughts &amp; Trace</span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] font-normal text-violet-500 dark:text-violet-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              thinking
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {thoughts && !editing && (
            <button
              type="button"
              onClick={handleCopyThoughts}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
          {canEdit && !isStreaming && !editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(thoughts);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              <span>{thoughts ? 'Edit' : 'Add thoughts'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide thoughts"
            className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-neutral-500 hover:text-[#0d0d0d] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            placeholder="Write or refine reasoning thoughts, tool notes, or hidden layer notes..."
            className="w-full rounded-xl border border-neutral-300 dark:border-white/15 bg-white dark:bg-[#1b1c20] px-3 py-2 text-xs leading-relaxed text-[#0d0d0d] dark:text-[#ececec] font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(thoughts);
                setEditing(false);
              }}
              className="px-3 py-1 rounded-full text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveThoughts(draft.trim());
                setEditing(false);
              }}
              className="px-3.5 py-1 rounded-full text-[11px] font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
            >
              Save thoughts
            </button>
          </div>
        </div>
      ) : thoughts ? (
        <div className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-neutral-700 dark:text-neutral-300 chat-scroll">
          {thoughts}
        </div>
      ) : (
        <div className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
          No captured model thoughts for this message yet (models like Hydrogen 4 emit reasoning traces automatically; you can also click <span className="font-medium">Add thoughts</span> to store your own).
        </div>
      )}
    </div>
  );
};

interface HiddenLayerDrawerProps {
  report: HiddenLayerReport;
  canEdit: boolean;
  onApplyFix: (finding: HiddenLayerFinding) => void;
  onApplyAllFixes: () => void;
  onOpenMessageEditor: () => void;
  onCreateFolders?: () => Promise<void>;
  folderActionMessage: string | null;
  creatingFolders: boolean;
  onClose: () => void;
}

const HiddenLayerDrawer: React.FC<HiddenLayerDrawerProps> = ({
  report,
  canEdit,
  onApplyFix,
  onApplyAllFixes,
  onOpenMessageEditor,
  onCreateFolders,
  folderActionMessage,
  creatingFolders,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | HiddenLayerCategory>('all');
  const [issuesOnly, setIssuesOnly] = useState(false);

  const filtered = useMemo(() => {
    return report.findings.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (issuesOnly && item.severity === 'info') return false;
      return true;
    });
  }, [report.findings, activeCategory, issuesOnly]);

  const filterButtons: Array<{ id: 'all' | HiddenLayerCategory; label: string; count: number }> = [
    { id: 'all', label: 'All', count: report.counts.all },
    { id: 'syntax', label: 'Syntax', count: report.counts.syntax },
    { id: 'filenames', label: 'Filenames', count: report.counts.filenames },
    { id: 'typos', label: 'Typos', count: report.counts.typos },
    { id: 'folders', label: 'Folders', count: report.counts.folders },
  ];

  return (
    <div className="w-full rounded-2xl border border-blue-500/25 bg-[#f5f7fb] dark:bg-[#1e2128] p-3.5 text-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-[#0d0d0d] dark:text-[#ececec]">
          <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>Hidden Layer Code Parser &amp; Filter</span>
          <span className="text-[11px] font-normal text-neutral-500 dark:text-neutral-400">
            ({report.codeBlocks.length} block{report.codeBlocks.length === 1 ? '' : 's'})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {canEdit && report.counts.fixable > 0 && (
            <button
              type="button"
              onClick={onApplyAllFixes}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-500 transition-colors"
            >
              <Wrench className="w-3 h-3" />
              <span>Fix all ({report.counts.fixable})</span>
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onOpenMessageEditor}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-neutral-300 dark:border-white/15 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit cell</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hidden layer parser"
            className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-neutral-500 hover:text-[#0d0d0d] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {filterButtons.map((btn) => {
            const active = activeCategory === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setActiveCategory(btn.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                    : 'bg-white dark:bg-[#2a2d36] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'
                }`}
              >
                <span>{btn.label}</span>
                <span className="opacity-75 tabular-nums">{btn.count}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIssuesOnly((v) => !v)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
            issuesOnly
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Errors &amp; warnings only</span>
        </button>
      </div>

      {/* Folder scaffolding bar */}
      {(report.folders.length > 0 || report.fileTargets.length > 0) && onCreateFolders && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0 text-[11px] text-blue-800 dark:text-blue-200">
            <FolderTree className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Detected {report.folders.length} folder{report.folders.length === 1 ? '' : 's'}
              {report.fileTargets.length > 0
                ? ` · ${report.fileTargets.length} file target${report.fileTargets.length === 1 ? '' : 's'}`
                : ''}
            </span>
          </div>
          <button
            type="button"
            disabled={creatingFolders}
            onClick={() => {
              void onCreateFolders();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
          >
            <FolderPlus className="w-3 h-3" />
            <span>{creatingFolders ? 'Creating...' : 'Create in Workspace'}</span>
          </button>
        </div>
      )}

      {folderActionMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
          {folderActionMessage}
        </div>
      )}

      {/* Results list */}
      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-[11.5px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {report.counts.all === 0
              ? 'Clean scan — no broken syntax, malformed filenames, typos, or folder commands found.'
              : 'No items match the current filter.'}
          </span>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-2 chat-scroll pr-0.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262932] p-2.5 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                      item.severity === 'error'
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : item.severity === 'warning'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {item.severity}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-[10px] font-medium text-neutral-600 dark:text-neutral-300 capitalize">
                    {item.category}
                  </span>
                  {item.location && (
                    <span className="text-[10.5px] font-mono text-neutral-500 dark:text-neutral-400">
                      {item.location}
                    </span>
                  )}
                </div>

                {canEdit && item.original && item.replacement !== undefined && (
                  <button
                    type="button"
                    onClick={() => onApplyFix(item)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/15 text-blue-700 dark:text-blue-300 hover:bg-blue-600/25 text-[10.5px] font-medium shrink-0 transition-colors"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Fix</span>
                  </button>
                )}
              </div>

              <div className="font-medium text-[#0d0d0d] dark:text-[#ececec] flex items-center gap-1.5">
                {item.category === 'folders' ? (
                  <FolderTree className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                ) : item.category === 'filenames' ? (
                  <FileCode2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : null}
                <span>{item.title}</span>
              </div>

              <div className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {item.detail}
              </div>

              {item.snippet && (
                <pre className="rounded-lg bg-[#f4f4f4] dark:bg-[#181a20] px-2.5 py-1.5 text-[11px] font-mono text-neutral-800 dark:text-neutral-200 overflow-x-auto">
                  {item.snippet}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming,
  isLatestModelMessage,
  canEditOrRegenerate,
  onEditAndResend,
  onUpdateMessage,
  onDeleteMessage,
  onRegenerate,
  onRetryError,
  onRetryWithFallback,
  onSwitchToNeo4,
  onPreviewCode,
  onSaveCodeToFolder,
  onCreateFoldersInWorkspace,
  onOpenStopMotionSpec,
  onOpenPixelArtSpec,
  onOpenThreeDSpec,
  onPreviewWebUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(message.text);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [folderActionMessage, setFolderActionMessage] = useState<string | null>(null);

  const layerReport = useMemo<HiddenLayerReport>(() => {
    if (isStreaming || !message.text || !message.text.trim()) {
      return {
        findings: [],
        codeBlocks: [],
        folders: [],
        fileTargets: [],
        counts: {
          all: 0,
          syntax: 0,
          filenames: 0,
          typos: 0,
          folders: 0,
          errors: 0,
          warnings: 0,
          fixable: 0,
        },
      };
    }
    return analyzeHiddenLayer(message.text);
  }, [message.text, isStreaming]);

  const layerMenuBadge = useMemo(() => {
    const issueCount = layerReport.counts.errors + layerReport.counts.warnings;
    if (layerReport.counts.errors > 0) {
      return {
        text: `${issueCount} issue${issueCount === 1 ? '' : 's'}`,
        tone: 'error' as const,
      };
    }
    if (layerReport.counts.warnings > 0) {
      return {
        text: `${issueCount} warn`,
        tone: 'warning' as const,
      };
    }
    if (layerReport.counts.folders > 0) {
      return {
        text: `${layerReport.counts.folders} folder${layerReport.counts.folders === 1 ? '' : 's'}`,
        tone: 'folder' as const,
      };
    }
    return { text: 'Clean', tone: 'clean' as const };
  }, [layerReport.counts]);

  useEffect(() => {
    return () => {
      if (isSpeaking && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleToggleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleDownloadCell = () => {
    const blob = new Blob([message.text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-${message.role}-${message.id.slice(0, 6)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveOnly = () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    onUpdateMessage(message.id, { text: trimmed });
  };

  const handleSaveAndResend = () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    onEditAndResend(message.id, trimmed);
  };

  const handleApplyFix = (finding: HiddenLayerFinding) => {
    const fixed = applyHiddenLayerFix(message.text, finding);
    if (fixed !== message.text) {
      onUpdateMessage(message.id, { text: fixed });
    }
  };

  const handleApplyAllFixes = () => {
    const fixed = applyAllSafeFixes(message.text, layerReport.findings);
    if (fixed !== message.text) {
      onUpdateMessage(message.id, { text: fixed });
    }
  };

  const handleCreateFolders = async () => {
    if (!onCreateFoldersInWorkspace) return;
    setCreatingFolders(true);
    setFolderActionMessage(null);
    try {
      const filesWithCode = layerReport.fileTargets.map((target) => {
        const block = target.codeBlockIndex
          ? layerReport.codeBlocks.find((b) => b.index === target.codeBlockIndex)
          : undefined;
        return { path: target.path, code: block?.code };
      });
      const res = await onCreateFoldersInWorkspace(layerReport.folders, filesWithCode);
      if (res) {
        setFolderActionMessage(
          `Created ${res.createdCount} path${res.createdCount === 1 ? '' : 's'} inside workspace "${res.workspaceId}".`
        );
      }
    } finally {
      setCreatingFolders(false);
    }
  };

  if (message.role === 'user') {
    return (
      <article className="group flex flex-col items-end gap-1.5">
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 max-w-[85%]">
            {message.attachments.map((att) =>
              !att.isText && att.previewUrl ? (
                <div
                  key={att.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-[#f4f4f4] dark:bg-[#2f2f2f] max-w-[220px]"
                >
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className={`max-h-44 w-auto object-cover ${
                      message.censored ? 'blur-lg' : ''
                    }`}
                  />
                </div>
              ) : (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f4f4f4] dark:bg-[#2f2f2f] text-xs text-[#0d0d0d] dark:text-[#ececec]"
                >
                  <FileText className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                  <span className="truncate max-w-[180px] font-medium">{att.name}</span>
                </div>
              )
            )}
          </div>
        )}

        {isEditing ? (
          <div className="w-full max-w-[85%] rounded-3xl border border-neutral-300 dark:border-white/15 bg-[#f4f4f4] dark:bg-[#2f2f2f] p-4 space-y-3">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={3}
              aria-label="Edit your message"
              className="w-full resize-y bg-transparent text-[15.5px] leading-relaxed text-[#0d0d0d] dark:text-[#ececec] focus:outline-none"
              autoFocus
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftText(message.text);
                  setIsEditing(false);
                }}
                className="min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={!draftText.trim()}
                className="min-h-[36px] px-3.5 py-1.5 rounded-full border border-neutral-300 dark:border-white/15 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleSaveAndResend}
                disabled={!draftText.trim()}
                className="min-h-[36px] px-4 py-1.5 rounded-full text-xs font-medium bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5 max-w-full">
            <div className="opacity-75 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
              <CellMenu
                message={message}
                isUser={true}
                copied={copied}
                isSpeaking={isSpeaking}
                thoughtsOpen={thoughtsOpen}
                layerOpen={layerOpen}
                layerBadgeText={layerMenuBadge.text}
                layerBadgeTone={layerMenuBadge.tone}
                isLatestModelMessage={false}
                canMutate={canEditOrRegenerate}
                onCopy={handleCopy}
                onEdit={() => {
                  setDraftText(message.text);
                  setIsEditing(true);
                }}
                onToggleThoughts={() => setThoughtsOpen((v) => !v)}
                onToggleLayerParser={() => setLayerOpen((v) => !v)}
                onToggleCensor={() =>
                  onUpdateMessage(message.id, { censored: !message.censored })
                }
                onTogglePin={() =>
                  onUpdateMessage(message.id, { pinned: !message.pinned })
                }
                onToggleSpeak={handleToggleSpeak}
                onDownloadCell={handleDownloadCell}
                onDownloadJson={() => exportMessageAsJson(message)}
                onDownloadXml={() => exportMessageAsXml(message)}
                onRegenerate={onRegenerate}
                onDelete={() => onDeleteMessage(message.id)}
              />
            </div>

            <div
              className={`${
                message.text.includes('```')
                  ? 'w-full max-w-[92%] sm:max-w-[85%]'
                  : 'max-w-[82%] sm:max-w-[75%]'
              } rounded-3xl bg-[#f4f4f4] dark:bg-[#2f2f2f] px-5 py-3 text-[15.5px] leading-relaxed text-[#0d0d0d] dark:text-[#ececec] ${
                message.pinned ? 'ring-1 ring-amber-500/60' : ''
              }`}
            >
              {message.censored ? (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm tracking-widest text-neutral-400 select-none">
                    ••••••••••••
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateMessage(message.id, { censored: false })}
                    className="text-xs font-medium underline underline-offset-2 text-neutral-600 dark:text-neutral-300 hover:text-[#0d0d0d] dark:hover:text-white whitespace-nowrap"
                  >
                    Reveal
                  </button>
                </div>
              ) : message.text.includes('```') ? (
                <MarkdownRenderer
                  content={message.text}
                  autoEmbedLive={true}
                  onPreviewCode={onPreviewCode}
                  onSaveCodeToFolder={onSaveCodeToFolder}
                  onOpenStopMotionSpec={onOpenStopMotionSpec}
                  onOpenPixelArtSpec={onOpenPixelArtSpec}
                  onOpenThreeDSpec={onOpenThreeDSpec}
                  onPreviewWebUrl={onPreviewWebUrl}
                />
              ) : (
                <div className="whitespace-pre-wrap break-words">{message.text}</div>
              )}
            </div>
          </div>
        )}

        {!isEditing && thoughtsOpen && (
          <div className="w-full max-w-[92%] sm:max-w-[85%]">
            <ThoughtsDrawer
              thoughts={message.thoughts || ''}
              isStreaming={false}
              canEdit={canEditOrRegenerate}
              onSaveThoughts={(nextThoughts) =>
                onUpdateMessage(message.id, { thoughts: nextThoughts })
              }
              onClose={() => setThoughtsOpen(false)}
            />
          </div>
        )}

        {!isEditing && layerOpen && (
          <div className="w-full max-w-[92%] sm:max-w-[85%]">
            <HiddenLayerDrawer
              report={layerReport}
              canEdit={canEditOrRegenerate}
              onApplyFix={handleApplyFix}
              onApplyAllFixes={handleApplyAllFixes}
              onOpenMessageEditor={() => {
                setDraftText(message.text);
                setIsEditing(true);
              }}
              onCreateFolders={onCreateFoldersInWorkspace ? handleCreateFolders : undefined}
              folderActionMessage={folderActionMessage}
              creatingFolders={creatingFolders}
              onClose={() => setLayerOpen(false)}
            />
          </div>
        )}

        {!isEditing && (message.pinned || message.censored) && (
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 px-2 tabular-nums">
            {message.pinned && (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Pinned
              </span>
            )}
            {message.pinned && message.censored && <span aria-hidden="true">·</span>}
            {message.censored && <span>Censored</span>}
          </div>
        )}
      </article>
    );
  }

  const modelOption = getModelOption(message.modelId);
  const fallbackOption = message.fallbackFrom
    ? getModelOption(message.fallbackFrom)
    : null;

  return (
    <article className="group flex gap-3 sm:gap-4 items-start">
      <div
        aria-hidden="true"
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#212121] flex items-center justify-center shrink-0 mt-0.5"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#0d0d0d] dark:bg-[#ececec]" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {isEditing ? (
          <div className="rounded-2xl border border-neutral-300 dark:border-white/15 bg-[#f4f4f4] dark:bg-[#2f2f2f] p-4 space-y-3">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={5}
              aria-label="Edit response"
              className="w-full resize-y bg-transparent text-[15.5px] leading-relaxed text-[#0d0d0d] dark:text-[#ececec] focus:outline-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftText(message.text);
                  setIsEditing(false);
                }}
                className="min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={!draftText.trim()}
                className="min-h-[36px] px-4 py-1.5 rounded-full text-xs font-medium bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        ) : message.error ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/35 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{message.error}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
              {onRetryWithFallback && /high demand|auto fallback|503|429|quota|billing|unavailable/i.test(message.error) && (
                <button
                  type="button"
                  onClick={onRetryWithFallback}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  Enable Auto Fallback & Retry
                </button>
              )}
              {onSwitchToNeo4 && /neo 4|high demand|503|429|quota|unavailable/i.test(message.error) && (
                <button
                  type="button"
                  onClick={onSwitchToNeo4}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-white dark:bg-[#2f2f2f] border border-red-200 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors whitespace-nowrap"
                >
                  Switch to Neo 4
                </button>
              )}
              <button
                type="button"
                onClick={onRetryError}
                className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-white dark:bg-[#2f2f2f] border border-red-200 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          </div>
        ) : message.censored ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#2a2a2a] px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="font-mono text-xs tracking-widest text-neutral-400 select-none">
                ••••••••••••••••••••••••••••••••••••
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Message censored. Select Reveal or Uncensor to restore.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateMessage(message.id, { censored: false })}
              className="min-h-[36px] px-3.5 py-1.5 rounded-full border border-neutral-300 dark:border-white/15 bg-white dark:bg-[#212121] text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-[#2f2f2f] transition-colors whitespace-nowrap shrink-0"
            >
              Reveal
            </button>
          </div>
        ) : (
          <div>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {message.toolCalls.map((tc) => (
                  <details
                    key={tc.id}
                    className="group/tc rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f7f8fa] dark:bg-[#1a1b1f] overflow-hidden text-xs"
                  >
                    <summary className="px-3 py-2 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-white/5">
                      <span className="flex items-center gap-2 min-w-0">
                        {tc.status === 'running' ? (
                          <Loader2 className="w-3.5 h-3.5 text-cyan-500 animate-spin shrink-0" />
                        ) : tc.status === 'error' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                        <Braces className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="font-mono font-semibold text-[#0d0d0d] dark:text-white truncate">
                          {tc.name}()
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                        {typeof tc.durationMs === 'number' && <span>{tc.durationMs}ms</span>}
                        <span>{tc.status === 'running' ? 'Running' : tc.status === 'error' ? 'Error' : 'Done'}</span>
                        <ChevronDown className="w-3.5 h-3.5 transition-transform group-open/tc:rotate-180" />
                      </span>
                    </summary>
                    <div className="px-3 py-2 border-t border-neutral-200 dark:border-white/10 space-y-2 bg-white dark:bg-[#131418] font-mono text-[11px]">
                      <div>
                        <div className="text-neutral-500 mb-0.5">Arguments</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                          {JSON.stringify(tc.args || {}, null, 2)}
                        </pre>
                      </div>
                      {tc.result !== undefined && (
                        <div>
                          <div className="text-neutral-500 mb-0.5">Result</div>
                          <pre className="overflow-x-auto max-h-48 whitespace-pre-wrap text-emerald-700 dark:text-emerald-300">
                            {typeof tc.result === 'string'
                              ? tc.result
                              : JSON.stringify(tc.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {message.text ? (
              <MarkdownRenderer
                content={message.text}
                isStreaming={isStreaming}
                autoEmbedLive={isLatestModelMessage && !isStreaming}
                onPreviewCode={onPreviewCode}
                onSaveCodeToFolder={onSaveCodeToFolder}
                onOpenStopMotionSpec={onOpenStopMotionSpec}
                onOpenPixelArtSpec={onOpenPixelArtSpec}
                onOpenThreeDSpec={onOpenThreeDSpec}
                onPreviewWebUrl={onPreviewWebUrl}
              />
            ) : isStreaming ? (
              <div className="flex items-center gap-2 py-2" aria-label="Generating response">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-pulse" />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Thinking...
                </span>
              </div>
            ) : null}

            {message.imageResults && message.imageResults.length > 0 && !message.censored && (
              <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {message.imageResults.map((img, imgIdx) => (
                  <div
                    key={imgIdx}
                    className="group/img relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-[#141518]"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.prompt || 'Generated image'}
                      className="w-full h-auto max-h-80 object-contain"
                    />
                    <a
                      href={img.dataUrl}
                      download={`folio-nano-banana-${imgIdx + 1}.png`}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-medium opacity-0 group-hover/img:opacity-100 transition-opacity"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG</span>
                    </a>
                  </div>
                ))}
              </div>
            )}

            {isStreaming && message.text && (
              <span
                aria-hidden="true"
                className="inline-block w-2 h-4 ml-1 align-middle bg-[#0d0d0d] dark:bg-[#ececec] animate-pulse rounded-xs"
              />
            )}
          </div>
        )}

        {!isEditing && thoughtsOpen && (
          <ThoughtsDrawer
            thoughts={message.thoughts || ''}
            isStreaming={isStreaming}
            canEdit={!isStreaming && canEditOrRegenerate}
            onSaveThoughts={(nextThoughts) =>
              onUpdateMessage(message.id, { thoughts: nextThoughts })
            }
            onClose={() => setThoughtsOpen(false)}
          />
        )}

        {!isEditing && layerOpen && (
          <HiddenLayerDrawer
            report={layerReport}
            canEdit={!isStreaming && canEditOrRegenerate}
            onApplyFix={handleApplyFix}
            onApplyAllFixes={handleApplyAllFixes}
            onOpenMessageEditor={() => {
              setDraftText(message.text);
              setIsEditing(true);
            }}
            onCreateFolders={onCreateFoldersInWorkspace ? handleCreateFolders : undefined}
            folderActionMessage={folderActionMessage}
            creatingFolders={creatingFolders}
            onClose={() => setLayerOpen(false)}
          />
        )}

        {!isEditing && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-0.5">
              {!isStreaming && !message.error && message.text && (
                <>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copied ? 'Copied' : 'Copy'}
                    title="Copy"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white hover:bg-[#ececec] dark:hover:bg-[#2f2f2f] transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  {isLatestModelMessage && canEditOrRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      aria-label="Regenerate response"
                      title="Regenerate"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white hover:bg-[#ececec] dark:hover:bg-[#2f2f2f] transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              <CellMenu
                message={message}
                isUser={false}
                copied={copied}
                isSpeaking={isSpeaking}
                thoughtsOpen={thoughtsOpen}
                layerOpen={layerOpen}
                layerBadgeText={layerMenuBadge.text}
                layerBadgeTone={layerMenuBadge.tone}
                isLatestModelMessage={isLatestModelMessage}
                canMutate={!isStreaming && canEditOrRegenerate}
                onCopy={handleCopy}
                onEdit={() => {
                  setDraftText(message.text);
                  setIsEditing(true);
                }}
                onToggleThoughts={() => setThoughtsOpen((v) => !v)}
                onToggleLayerParser={() => setLayerOpen((v) => !v)}
                onToggleCensor={() =>
                  onUpdateMessage(message.id, { censored: !message.censored })
                }
                onTogglePin={() =>
                  onUpdateMessage(message.id, { pinned: !message.pinned })
                }
                onToggleSpeak={handleToggleSpeak}
                onDownloadCell={handleDownloadCell}
                onDownloadJson={() => exportMessageAsJson(message)}
                onDownloadXml={() => exportMessageAsXml(message)}
                onRegenerate={onRegenerate}
                onDelete={() => onDeleteMessage(message.id)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              {message.pinned && (
                <>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Pinned
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {message.triModelLabel && (
                <>
                  <span className="font-medium text-sky-600 dark:text-sky-400">
                    {message.triModelLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>
                {modelOption.shortName}
                {fallbackOption ? ` (from ${fallbackOption.shortName})` : ''}
              </span>
              {typeof message.durationMs === 'number' && message.durationMs > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{(message.durationMs / 1000).toFixed(2)}s</span>
                </>
              )}
              {message.engineRating && (
                <>
                  <span aria-hidden="true">·</span>
                  <span title={message.engineRating.notes.join(' | ')}>
                    Quality {message.engineRating.score}/100
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{formatTime(message.createdAt)}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
