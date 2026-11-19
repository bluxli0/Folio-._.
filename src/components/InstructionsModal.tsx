import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { SYSTEM_PRESETS } from '../data/presets';

interface InstructionsModalProps {
  isOpen: boolean;
  initialInstruction: string;
  onClose: () => void;
  onSave: (instruction: string) => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  initialInstruction,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState(initialInstruction);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialInstruction);
    }
  }, [isOpen, initialInstruction]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructions-modal-title"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10">
          <div>
            <h2
              id="instructions-modal-title"
              className="font-display text-lg font-semibold text-[#0d0d0d] dark:text-[#ececec]"
            >
              Custom instructions
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Guide tone, formatting, and focus for the active chat.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-neutral-500 hover:text-[#0d0d0d] dark:text-neutral-400 dark:hover:text-white hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Presets
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SYSTEM_PRESETS.map((preset) => {
                const isSelected = draft.trim() === preset.instruction.trim();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDraft(preset.instruction)}
                    className={`text-left p-3 rounded-xl border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                      isSelected
                        ? 'border-[#0d0d0d] dark:border-white bg-[#f4f4f4] dark:bg-white/10 text-[#0d0d0d] dark:text-white'
                        : 'border-neutral-200 dark:border-white/10 hover:bg-[#f4f4f4]/70 dark:hover:bg-white/5 text-[#0d0d0d] dark:text-[#ececec]'
                    }`}
                  >
                    <div className="text-sm font-medium">{preset.label}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="custom-system-instruction"
              className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >
              Instructions
            </label>
            <textarea
              id="custom-system-instruction"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder="Describe how responses should be structured or what role to take..."
              className="w-full rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#212121] p-3.5 text-sm leading-relaxed text-[#0d0d0d] dark:text-[#ececec] placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-white/30"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#262626]">
          <button
            type="button"
            onClick={() => setDraft(SYSTEM_PRESETS[0].instruction)}
            className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-[#ececec] dark:hover:bg-white/10 transition-colors"
          >
            Reset to default
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-[#ececec] dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft.trim());
                onClose();
              }}
              className="min-h-[40px] px-4 py-2 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-90 text-xs font-medium transition-opacity"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
