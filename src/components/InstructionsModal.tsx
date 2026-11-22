import React, { useEffect, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { SYSTEM_PRESETS } from '../data/presets';
import { InstructionProfile } from '../types/chat';

interface InstructionsModalProps {
  isOpen: boolean;
  initialInstruction: string;
  onClose: () => void;
  onSave: (instruction: string) => void;
  savedProfiles?: InstructionProfile[];
  onSaveProfile?: (
    profile: { id: string; name: string; instruction: string },
    isNew: boolean
  ) => Promise<void>;
  onDeleteProfile?: (id: string) => Promise<void>;
  startCreating?: boolean;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  initialInstruction,
  onClose,
  onSave,
  savedProfiles = [],
  onSaveProfile,
  onDeleteProfile,
  startCreating = false,
}) => {
  const [draft, setDraft] = useState(initialInstruction);
  const [creating, setCreating] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialInstruction);
      setCreating(startCreating);
      if (startCreating) {
        setProfileName('');
        setDraft('');
      }
    }
  }, [isOpen, initialInstruction, startCreating]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveNewProfile = async () => {
    if (!onSaveProfile || !draft.trim()) return;
    setSavingProfile(true);
    try {
      await onSaveProfile(
        {
          id: `inst-${Date.now()}`,
          name: profileName.trim() || 'Custom Instruction',
          instruction: draft.trim(),
        },
        true
      );
      setCreating(false);
      setProfileName('');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructions-modal-title"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 shrink-0">
          <div>
            <h2
              id="instructions-modal-title"
              className="font-display text-lg font-semibold text-[#0d0d0d] dark:text-[#ececec]"
            >
              Custom instructions
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Guide tone, formatting, or create reusable instruction profiles.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onSaveProfile && (
              <button
                type="button"
                onClick={() => {
                  setCreating((v) => !v);
                  if (!creating) {
                    setProfileName('');
                    setDraft('');
                  }
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  creating
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                    : 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-90'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creating ? 'Cancel new' : 'New Instruction'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-neutral-500 hover:text-[#0d0d0d] dark:text-neutral-400 dark:hover:text-white hover:bg-[#f4f4f4] dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto chat-scroll">
          {savedProfiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Your Saved Instructions ({savedProfiles.length})
              </div>
              <div className="space-y-1.5">
                {savedProfiles.map((prof) => {
                  const isActive = draft.trim() === prof.instruction.trim();
                  return (
                    <div
                      key={prof.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors ${
                        isActive
                          ? 'border-[#0d0d0d] dark:border-white bg-[#f4f4f4] dark:bg-white/10'
                          : 'border-neutral-200 dark:border-white/10 hover:bg-[#f4f4f4]/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCreating(false);
                          setDraft(prof.instruction);
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="text-xs font-semibold text-[#0d0d0d] dark:text-white truncate">
                          {prof.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {prof.instruction}
                        </div>
                      </button>
                      {onDeleteProfile && (
                        <button
                          type="button"
                          onClick={() => void onDeleteProfile(prof.id)}
                          aria-label={`Delete ${prof.name}`}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!creating && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Built-in Presets
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
          )}

          {creating && (
            <div className="space-y-2">
              <label
                htmlFor="new-instruction-name"
                className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
              >
                New Instruction Profile Name
              </label>
              <input
                id="new-instruction-name"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. EVO 3D Architect, Strict TypeScript Reviewer..."
                className="w-full rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#212121] px-3.5 py-2 text-sm text-[#0d0d0d] dark:text-[#ececec] placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-white/30"
              />
            </div>
          )}

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

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#262626] shrink-0">
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

            {creating && onSaveProfile ? (
              <button
                type="button"
                disabled={!draft.trim() || savingProfile}
                onClick={() => void handleSaveNewProfile()}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-full bg-cyan-600 text-white hover:bg-cyan-500 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSave(draft.trim());
                  onClose();
                }}
                className="min-h-[40px] px-4 py-2 rounded-full bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-90 text-xs font-medium transition-opacity"
              >
                Apply to Chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
