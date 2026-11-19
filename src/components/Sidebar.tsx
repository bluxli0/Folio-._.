import React, { useMemo, useState } from 'react';
import {
  Check,
  Moon,
  PanelLeft,
  Pencil,
  Search,
  Shield,
  SlidersHorizontal,
  SquarePen,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { ConversationThread } from '../types/chat';

interface SidebarProps {
  threads: ConversationThread[];
  activeThreadId: string;
  isOpen: boolean;
  theme: 'light' | 'dark';
  hasCustomInstructions: boolean;
  safetySummary: string;
  onCloseMobile: () => void;
  onCollapseDesktop: () => void;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onToggleTheme: () => void;
  onOpenInstructions: () => void;
  onOpenSafety: () => void;
}

function getDateBucket(timestamp: number): 'Today' | 'Previous 7 Days' | 'Earlier' {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= sevenDaysAgo) return 'Previous 7 Days';
  return 'Earlier';
}

export const Sidebar: React.FC<SidebarProps> = ({
  threads,
  activeThreadId,
  isOpen,
  theme,
  hasCustomInstructions,
  safetySummary,
  onCloseMobile,
  onCollapseDesktop,
  onSelectThread,
  onNewChat,
  onRenameThread,
  onDeleteThread,
  onToggleTheme,
  onOpenInstructions,
  onOpenSafety,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [threads, searchQuery]);

  const groupedThreads = useMemo(() => {
    const groups: Record<'Today' | 'Previous 7 Days' | 'Earlier', ConversationThread[]> = {
      Today: [],
      'Previous 7 Days': [],
      Earlier: [],
    };
    for (const thread of filteredThreads) {
      groups[getDateBucket(thread.updatedAt)].push(thread);
    }
    return groups;
  }, [filteredThreads]);

  const beginRename = (thread: ConversationThread) => {
    setEditingId(thread.id);
    setEditingTitle(thread.title);
  };

  const commitRename = () => {
    if (editingId && editingTitle.trim()) {
      onRenameThread(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const bucketOrder: Array<'Today' | 'Previous 7 Days' | 'Earlier'> = [
    'Today',
    'Previous 7 Days',
    'Earlier',
  ];

  const sidebarBody = (
    <aside
      aria-label="Conversation history"
      className="flex h-full w-[260px] shrink-0 flex-col bg-[#f9f9f9] dark:bg-[#171717] border-r border-neutral-200/80 dark:border-white/5"
    >
      <div className="flex items-center justify-between px-3 h-14">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCollapseDesktop}
            aria-label="Close sidebar"
            className="hidden lg:inline-flex items-center justify-center w-10 h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-[#ececec] dark:hover:bg-[#212121] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-[#ececec] dark:hover:bg-[#212121] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="font-display text-base font-semibold tracking-tight text-[#0d0d0d] dark:text-[#ececec] px-1 whitespace-nowrap shrink-0">
            Folio
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          aria-label="New chat"
          title="New chat"
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-[#ececec] dark:hover:bg-[#212121] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <SquarePen className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 pb-2 space-y-1.5">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-sm font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#ececec] dark:hover:bg-[#212121] flex items-center gap-2.5 transition-colors duration-150 whitespace-nowrap"
        >
          <SquarePen className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
          <span>New chat</span>
        </button>

        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-transparent hover:bg-[#ececec]/60 dark:hover:bg-[#212121]/70 focus:bg-white dark:focus:bg-[#212121] border border-transparent focus:border-neutral-300 dark:focus:border-white/15 text-sm text-[#0d0d0d] dark:text-[#ececec] placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-5 chat-scroll">
        {filteredThreads.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            No matching chats.
          </div>
        ) : (
          bucketOrder.map((bucket) => {
            const list = groupedThreads[bucket];
            if (list.length === 0) return null;
            return (
              <div key={bucket} className="space-y-0.5">
                <div className="px-2.5 pb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {bucket}
                </div>
                <ul className="space-y-0.5">
                  {list.map((thread) => {
                    const isActive = thread.id === activeThreadId;
                    const isEditing = editingId === thread.id;

                    return (
                      <li key={thread.id} className="group relative">
                        {isEditing ? (
                          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#212121] border border-neutral-400 dark:border-white/25">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') cancelRename();
                              }}
                              autoFocus
                              aria-label="Edit chat title"
                              className="flex-1 min-w-0 bg-transparent text-sm text-[#0d0d0d] dark:text-[#ececec] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={commitRename}
                              aria-label="Save title"
                              className="p-1 text-[#0d0d0d] dark:text-white hover:bg-neutral-200 dark:hover:bg-white/10 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`flex items-center rounded-lg transition-colors duration-150 ${
                              isActive
                                ? 'bg-[#ececec] dark:bg-[#212121] text-[#0d0d0d] dark:text-white'
                                : 'text-neutral-700 dark:text-[#ececec]/85 hover:bg-[#ececec]/70 dark:hover:bg-[#212121]/70'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectThread(thread.id);
                                onCloseMobile();
                              }}
                              className="flex-1 min-w-0 text-left px-2.5 py-2 text-sm truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-lg"
                            >
                              {thread.title}
                            </button>

                            <div
                              className={`flex items-center pr-1 gap-0.5 shrink-0 transition-opacity duration-150 ${
                                isActive
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  beginRename(thread);
                                }}
                                aria-label={`Rename ${thread.title}`}
                                className="p-1.5 rounded-md text-neutral-500 hover:text-[#0d0d0d] dark:text-neutral-400 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteThread(thread.id);
                                }}
                                aria-label={`Delete ${thread.title}`}
                                className="p-1.5 rounded-md text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </nav>

      <div className="p-2.5 border-t border-neutral-200/80 dark:border-white/5 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onOpenSafety();
            onCloseMobile();
          }}
          className="w-full min-h-[40px] px-2.5 py-2 rounded-lg text-sm text-neutral-700 dark:text-[#ececec] hover:bg-[#ececec] dark:hover:bg-[#212121] flex items-center justify-between transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <Shield className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <span>Safety filters</span>
          </span>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {safetySummary}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenInstructions();
            onCloseMobile();
          }}
          className="w-full min-h-[40px] px-2.5 py-2 rounded-lg text-sm text-neutral-700 dark:text-[#ececec] hover:bg-[#ececec] dark:hover:bg-[#212121] flex items-center justify-between transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            <SlidersHorizontal className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <span>Custom instructions</span>
          </span>
          {hasCustomInstructions && (
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              On
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full min-h-[40px] px-2.5 py-2 rounded-lg text-sm text-neutral-700 dark:text-[#ececec] hover:bg-[#ececec] dark:hover:bg-[#212121] flex items-center justify-between transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-neutral-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-500" />
            )}
            <span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className={`hidden lg:block h-full ${isOpen ? '' : 'lg:hidden'}`}>
        {sidebarBody}
      </div>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full shadow-2xl">{sidebarBody}</div>
        </div>
      )}
    </>
  );
};
