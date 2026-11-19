import React, { useEffect, useState } from 'react';
import { Shield, X } from 'lucide-react';
import {
  DEFAULT_SAFETY_FILTERS,
  SAFETY_CATEGORIES,
  SAFETY_LEVELS,
} from '../data/presets';
import {
  SafetyCategoryKey,
  SafetyFiltersConfig,
  SafetyLevel,
} from '../types/chat';

interface SafetyFiltersModalProps {
  isOpen: boolean;
  initialFilters: SafetyFiltersConfig;
  onClose: () => void;
  onSave: (filters: SafetyFiltersConfig) => void;
}

const LEVEL_INDEX: Record<SafetyLevel, number> = {
  max: 0,
  medium: 1,
  low: 2,
  none: 3,
};

const INDEX_TO_LEVEL: SafetyLevel[] = ['max', 'medium', 'low', 'none'];

export const SafetyFiltersModal: React.FC<SafetyFiltersModalProps> = ({
  isOpen,
  initialFilters,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<SafetyFiltersConfig>(initialFilters);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialFilters);
    }
  }, [isOpen, initialFilters]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const setAll = (level: SafetyLevel) => {
    setDraft({
      harassment: level,
      hateSpeech: level,
      sexuallyExplicit: level,
      dangerousContent: level,
    });
  };

  const setCategory = (key: SafetyCategoryKey, level: SafetyLevel) => {
    setDraft((prev) => ({ ...prev, [key]: level }));
  };

  const allEqual = Object.values(draft).every((v) => v === draft.harassment);
  const activeMaster = allEqual ? draft.harassment : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-modal-title"
    >
      <div
        className="w-full max-w-xl max-h-[90dvh] flex flex-col rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-neutral-600 dark:text-neutral-300 shrink-0" />
            <div>
              <h2
                id="safety-modal-title"
                className="font-display text-lg font-semibold text-[#0d0d0d] dark:text-[#ececec]"
              >
                Safety filters
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Adjust blocking thresholds from Max to None for this chat.
              </p>
            </div>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6 chat-scroll">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Set all filters
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {activeMaster
                  ? SAFETY_LEVELS.find((l) => l.value === activeMaster)?.label
                  : 'Custom mix'}
              </span>
            </div>

            <div
              role="group"
              aria-label="Set all safety filters"
              className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#f4f4f4] dark:bg-[#212121] border border-neutral-200 dark:border-white/10"
            >
              {SAFETY_LEVELS.map((level) => {
                const active = activeMaster === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setAll(level.value)}
                    aria-pressed={active}
                    className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
                    }`}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {SAFETY_CATEGORIES.map((category) => {
              const currentLevel = draft[category.key];
              const currentIndex = LEVEL_INDEX[currentLevel];
              const currentMeta =
                SAFETY_LEVELS.find((l) => l.value === currentLevel) ||
                SAFETY_LEVELS[1];

              return (
                <div
                  key={category.key}
                  className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#262626] p-4 space-y-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <label
                        htmlFor={`safety-slider-${category.key}`}
                        className="text-sm font-medium text-[#0d0d0d] dark:text-[#ececec]"
                      >
                        {category.label}
                      </label>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {category.description}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white whitespace-nowrap shrink-0 tabular-nums">
                      {currentMeta.label}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <input
                      id={`safety-slider-${category.key}`}
                      type="range"
                      min={0}
                      max={3}
                      step={1}
                      value={currentIndex}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setCategory(category.key, INDEX_TO_LEVEL[idx] || 'medium');
                      }}
                      aria-valuetext={`${currentMeta.label}: ${currentMeta.description}`}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-neutral-300 dark:bg-neutral-700 accent-[#0d0d0d] dark:accent-white"
                    />

                    <div className="grid grid-cols-4 gap-1">
                      {SAFETY_LEVELS.map((level) => {
                        const selected = currentLevel === level.value;
                        return (
                          <button
                            key={level.value}
                            type="button"
                            onClick={() => setCategory(category.key, level.value)}
                            className={`py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                              selected
                                ? 'text-[#0d0d0d] dark:text-white font-semibold bg-neutral-200/80 dark:bg-white/10'
                                : 'text-neutral-500 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-neutral-200'
                            }`}
                          >
                            {level.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#262626] shrink-0">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_SAFETY_FILTERS })}
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
                onSave(draft);
                onClose();
              }}
              className="min-h-[40px] px-4 py-2 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-90 text-xs font-medium transition-opacity"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
