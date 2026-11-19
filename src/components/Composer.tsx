import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, FileText, Paperclip, Square, X } from 'lucide-react';
import { ChatAttachment } from '../types/chat';

interface ComposerProps {
  isStreaming: boolean;
  centered?: boolean;
  externalAttachments?: ChatAttachment[];
  onConsumeExternalAttachments?: () => void;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 200 * 1024;

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'html',
  'css',
  'yaml',
  'yml',
  'xml',
  'sql',
  'sh',
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const Composer: React.FC<ComposerProps> = ({
  isStreaming,
  centered = false,
  externalAttachments,
  onConsumeExternalAttachments,
  onSend,
  onStop,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      if (!isImage && !isText) {
        setAttachmentError(`Unsupported file type: ${file.name}. Attach images or text/code files.`);
        continue;
      }

      if (isImage && file.size > MAX_IMAGE_BYTES) {
        setAttachmentError(`${file.name} exceeds the 5 MB image limit.`);
        continue;
      }

      if (isText && file.size > MAX_TEXT_BYTES) {
        setAttachmentError(`${file.name} exceeds the 200 KB text file limit.`);
        continue;
      }

      try {
        if (isImage) {
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

  const handleSubmit = () => {
    if (isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setText('');
    setAttachments([]);
    setAttachmentError(null);
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

  return (
    <div
      className={
        centered
          ? 'w-full'
          : 'shrink-0 bg-white dark:bg-[#212121] pt-1 pb-3 sm:pb-4 px-3 sm:px-6'
      }
    >
      <div className="max-w-3xl mx-auto">
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
                  {!att.isText && att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                  <div className="min-w-0 max-w-[140px]">
                    <div className="truncate font-medium">{att.name}</div>
                    <div className="text-[11px] text-neutral-400 tabular-nums">
                      {formatBytes(att.size)}
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

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message Folio"
            aria-label="Message input"
            className="w-full resize-none bg-transparent px-5 pt-3.5 pb-2 text-[15.5px] leading-relaxed text-[#0d0d0d] dark:text-[#ececec] placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none chat-scroll max-h-[200px]"
          />

          <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-0.5">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.markdown,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.yaml,.yml,.xml,.sql,.sh"
                onChange={(e) => {
                  void processFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image or text file"
                title="Attach file"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full text-neutral-600 dark:text-neutral-300 hover:text-[#0d0d0d] dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              >
                <Paperclip className="w-4 h-4" />
              </button>
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
            Folio can make mistakes. Verify important information.
          </p>
        )}
      </div>
    </div>
  );
};
