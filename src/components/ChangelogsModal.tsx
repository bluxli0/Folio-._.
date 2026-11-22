import React, { useEffect } from 'react';
import { Layers, Sparkles, X } from 'lucide-react';
import { FOLIO_CHANGELOGS, FOLIO_CURRENT_VERSION } from '../data/changelogs';

interface ChangelogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogsModal: React.FC<ChangelogsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Folio Changelogs"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#232428] text-[#0d0d0d] dark:text-[#ececec] shadow-2xl overflow-hidden flex flex-col max-h-[86vh] folio-oxygen-entrance"
      >
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold truncate">Folio Release Changelogs</h2>
                <span className="font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  {FOLIO_CURRENT_VERSION}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                Release history across engines, models, audio, and workspace tooling.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close changelogs"
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 chat-scroll">
          {FOLIO_CHANGELOGS.map((release, idx) => (
            <section
              key={release.version}
              className={`rounded-xl border p-4 space-y-3 ${
                idx === 0
                  ? 'border-sky-500/35 bg-sky-500/5'
                  : 'border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-[#1c1d21]'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#0d0d0d] dark:text-white">
                    {release.version}
                  </span>
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    — {release.codename}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {release.date}
                </span>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {release.summary}
              </p>

              <div className="space-y-2 pt-1">
                {release.highlights.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-[#26282e] p-2.5 space-y-1"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0d0d0d] dark:text-white">
                      <Layers className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span>{item.title}</span>
                      <span className="ml-auto text-[10px] font-mono uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-neutral-600 dark:text-neutral-400 leading-relaxed pl-5">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-[#1d1e22] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-semibold hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
