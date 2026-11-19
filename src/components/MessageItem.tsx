import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { VectorStopMotionSpec } from '../types/stopMotion';
import { PixelArtSpec } from '../types/pixelArt';
import { ThreeDSceneSpec } from '../types/threeD';
import { getModelOption } from '../data/presets';
import { MarkdownRenderer } from './MarkdownRenderer';

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
  onPreviewCode?: (code: string, language: string) => void;
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
  isLatestModelMessage: boolean;
  canMutate: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onToggleCensor: () => void;
  onTogglePin: () => void;
  onToggleSpeak: () => void;
  onDownloadCell: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

const CellMenu: React.FC<CellMenuProps> = ({
  message,
  isUser,
  copied,
  isSpeaking,
  isLatestModelMessage,
  canMutate,
  onCopy,
  onEdit,
  onToggleCensor,
  onTogglePin,
  onToggleSpeak,
  onDownloadCell,
  onRegenerate,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const runAction = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const hasText = Boolean(message.text && message.text.trim().length > 0);
  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
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
          className={`absolute ${
            isUser ? 'right-0' : 'left-0 sm:right-0 sm:left-auto'
          } top-full mt-1 w-48 z-30 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] p-1.5 text-[#0d0d0d] dark:text-[#ececec] shadow-xl`}
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

          {hasText && (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAction(onDownloadCell)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
              <span>Download .md</span>
            </button>
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
  onPreviewCode,
  onOpenStopMotionSpec,
  onOpenPixelArtSpec,
  onOpenThreeDSpec,
  onPreviewWebUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(message.text);
  const [isSpeaking, setIsSpeaking] = useState(false);

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
            <div className="opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <CellMenu
                message={message}
                isUser={true}
                copied={copied}
                isSpeaking={isSpeaking}
                isLatestModelMessage={false}
                canMutate={canEditOrRegenerate}
                onCopy={handleCopy}
                onEdit={() => {
                  setDraftText(message.text);
                  setIsEditing(true);
                }}
                onToggleCensor={() =>
                  onUpdateMessage(message.id, { censored: !message.censored })
                }
                onTogglePin={() =>
                  onUpdateMessage(message.id, { pinned: !message.pinned })
                }
                onToggleSpeak={handleToggleSpeak}
                onDownloadCell={handleDownloadCell}
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
            <button
              type="button"
              onClick={onRetryError}
              className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-white dark:bg-[#2f2f2f] border border-red-200 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Retry
            </button>
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
            {message.text ? (
              <MarkdownRenderer
                content={message.text}
                isStreaming={isStreaming}
                autoEmbedLive={isLatestModelMessage && !isStreaming}
                onPreviewCode={onPreviewCode}
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

            {isStreaming && message.text && (
              <span
                aria-hidden="true"
                className="inline-block w-2 h-4 ml-1 align-middle bg-[#0d0d0d] dark:bg-[#ececec] animate-pulse rounded-xs"
              />
            )}
          </div>
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
                isLatestModelMessage={isLatestModelMessage}
                canMutate={!isStreaming && canEditOrRegenerate}
                onCopy={handleCopy}
                onEdit={() => {
                  setDraftText(message.text);
                  setIsEditing(true);
                }}
                onToggleCensor={() =>
                  onUpdateMessage(message.id, { censored: !message.censored })
                }
                onTogglePin={() =>
                  onUpdateMessage(message.id, { pinned: !message.pinned })
                }
                onToggleSpeak={handleToggleSpeak}
                onDownloadCell={handleDownloadCell}
                onRegenerate={onRegenerate}
                onDelete={() => onDeleteMessage(message.id)}
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              {message.pinned && (
                <>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Pinned
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>
                {modelOption.shortName}
                {fallbackOption ? ` (switched from ${fallbackOption.shortName})` : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatTime(message.createdAt)}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
