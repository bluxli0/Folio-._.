import React, { useEffect, useState } from 'react';
import { Check, Clock, EyeOff, Folder, Globe, Lock, ShieldAlert, X } from 'lucide-react';
import { ConversationThread, RetentionMode } from '../types/chat';
import { RETENTION_OPTIONS } from '../data/presets';

interface SessionPrivacyModalProps {
  isOpen: boolean;
  activeThread: ConversationThread;
  allThreads: ConversationThread[];
  allowAllSessionsView: boolean;
  onClose: () => void;
  onSaveSessionPrivacy: (patch: {
    groupName?: string;
    sharedThreadIds?: string[];
    retention?: RetentionMode;
    expiresAt?: number;
  }) => void;
  onToggleAllowAllSessions: (allow: boolean) => void;
}

export const SessionPrivacyModal: React.FC<SessionPrivacyModalProps> = ({
  isOpen,
  activeThread,
  allThreads,
  allowAllSessionsView,
  onClose,
  onSaveSessionPrivacy,
  onToggleAllowAllSessions,
}) => {
  const [groupName, setGroupName] = useState(activeThread.groupName || '');
  const [selectedIds, setSelectedIds] = useState<string[]>(activeThread.sharedThreadIds || []);
  const [retention, setRetention] = useState<RetentionMode>(
    activeThread.retention || (activeThread.incognito ? 'session' : 'permanent')
  );

  useEffect(() => {
    if (isOpen) {
      setGroupName(activeThread.groupName || '');
      setSelectedIds(activeThread.sharedThreadIds || []);
      setRetention(
        activeThread.retention || (activeThread.incognito ? 'session' : 'permanent')
      );
    }
  }, [
    isOpen,
    activeThread.groupName,
    activeThread.sharedThreadIds,
    activeThread.retention,
    activeThread.incognito,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isTempOrIncognito = Boolean(activeThread.incognito);
  const shareableOthers = isTempOrIncognito
    ? allThreads.filter(
        (t) =>
          t.id !== activeThread.id &&
          (t.incognito || (t.retention && t.retention !== 'permanent')) &&
          t.messages.length > 0
      )
    : allThreads.filter(
        (t) => t.id !== activeThread.id && !t.incognito && t.messages.length > 0
      );

  const existingGroups = Array.from(
    new Set(
      allThreads
        .filter((t) => !t.incognito && t.groupName && t.groupName.trim().length > 0)
        .map((t) => t.groupName!.trim())
    )
  ).sort();

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    const retentionOpt = RETENTION_OPTIONS.find((r) => r.id === retention);
    const expiresAt = retentionOpt?.ttlMs ? Date.now() + retentionOpt.ttlMs : undefined;
    onSaveSessionPrivacy({
      groupName: activeThread.incognito ? undefined : groupName.trim() || undefined,
      sharedThreadIds: selectedIds,
      retention,
      expiresAt,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session Isolation & Sharing"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#242426] text-[#0d0d0d] dark:text-[#ececec] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {activeThread.incognito ? (
              <EyeOff className="w-5 h-5 text-amber-500" />
            ) : (
              <Lock className="w-5 h-5 text-blue-500" />
            )}
            <div>
              <h2 className="text-base font-semibold">Session Isolation &amp; Retention</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Sessions are strictly isolated by default unless folder-linked or shared.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session privacy settings"
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto chat-scroll text-sm">
          {activeThread.incognito && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold mb-1">Incognito / Temporary Session Active</p>
                <p>
                  Isolated from permanent history. You can still configure auto-expiry TTL or
                  link sibling temporary sessions for Tri-Model cross-reference below.
                </p>
              </div>
            </div>
          )}

          {/* Retention / Auto-Expire Timer */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Retention &amp; Auto-Expiry</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {RETENTION_OPTIONS.filter((opt) =>
                activeThread.incognito ? opt.id !== 'permanent' : true
              ).map((opt) => {
                const selected = retention === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRetention(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      selected
                        ? 'border-amber-500/60 bg-amber-500/10 text-[#0d0d0d] dark:text-white'
                        : 'border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span>{opt.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {!activeThread.incognito && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Session Group / Folder
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Folder className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Animation Project, Work, Research"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-200 dark:border-white/15 bg-neutral-50 dark:bg-[#1a1a1c] text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                {groupName && (
                  <button
                    type="button"
                    onClick={() => setGroupName('')}
                    className="px-3 h-10 rounded-xl border border-neutral-200 dark:border-white/15 text-xs hover:bg-neutral-100 dark:hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
              {existingGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {existingGroups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setGroupName(grp)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        groupName === grp
                          ? 'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-300'
                          : 'border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'
                      }`}
                    >
                      <Folder className="w-3 h-3" />
                      <span>{grp}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Sessions inside the same folder automatically share context with each other.
              </p>
            </div>
          )}

          {/* Sibling Session Sharing (works for saved sessions or linking temp/incognito siblings) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {activeThread.incognito
                  ? 'Linked Temporary / Incognito Sessions'
                  : 'Manually Shared Sessions'}
              </span>
              <span className="text-[11px] text-neutral-500">
                {selectedIds.length} selected
              </span>
            </div>
            {shareableOthers.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 dark:border-white/10 p-3 text-xs text-neutral-500">
                {activeThread.incognito
                  ? 'No other temporary or incognito sessions with messages to link.'
                  : 'No other saved sessions available to share yet.'}
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto chat-scroll rounded-xl border border-neutral-200 dark:border-white/10 divide-y divide-neutral-200 dark:divide-white/10">
                {shareableOthers.map((t) => {
                  const checked = selectedIds.includes(t.id);
                  const sameFolder =
                    !activeThread.incognito &&
                    Boolean(groupName.trim()) &&
                    t.groupName === groupName.trim();
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleId(t.id)}
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{t.title}</div>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                          <span>{t.messages.length} msgs</span>
                          {t.groupName && (
                            <span className="inline-flex items-center gap-0.5 text-blue-500">
                              · <Folder className="w-2.5 h-2.5" /> {t.groupName}
                            </span>
                          )}
                          {t.incognito && (
                            <span className="text-amber-500">· Incognito</span>
                          )}
                          {sameFolder && (
                            <span className="text-emerald-500">· Shared via folder</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          checked || sameFolder
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-neutral-300 dark:border-white/20'
                        }`}
                      >
                        {(checked || sameFolder) && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Global Toggle */}
          <div className="pt-2 border-t border-neutral-200 dark:border-white/10">
            <button
              type="button"
              role="switch"
              aria-checked={allowAllSessionsView}
              onClick={() => onToggleAllowAllSessions(!allowAllSessionsView)}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5 text-left transition-colors"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Globe className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">
                    Allow all saved sessions to view each other
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Off by default. Incognito sessions remain isolated unless explicitly linked.
                  </div>
                </div>
              </div>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  allowAllSessionsView
                    ? 'bg-blue-600'
                    : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    allowAllSessionsView ? 'translate-x-[18px]' : 'translate-x-1'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-[#1d1d20] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] hover:opacity-90"
          >
            Save Session Settings
          </button>
        </div>
      </div>
    </div>
  );
};

