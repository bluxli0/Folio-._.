import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Braces,
  Check,
  ChevronDown,
  Clock,
  Code2,
  Download,
  EyeOff,
  FileCode,
  FileJson,
  FileText,
  Film,
  Globe,
  History,
  Layers,
  ListTree,
  Lock,
  Paintbrush,
  PanelLeft,
  Shield,
  Sparkles,
  SquarePen,
  Type,
  User,
  Users,
} from 'lucide-react';
import {
  FontPresetId,
  ModelChoiceId,
  RetentionMode,
  SafetyFiltersConfig,
  TriModelConfig,
} from '../types/chat';
import {
  DEFAULT_TRI_MODEL_CONFIG,
  MODEL_OPTIONS,
  RETENTION_OPTIONS,
  areSafetyFiltersDefault,
  getModelOption,
  getSafetySummaryLabel,
} from '../data/presets';
import { FOLIO_CURRENT_VERSION } from '../data/changelogs';
import { ChatHeadingItem, FONT_PRESETS } from '../utils/textFormatting';

interface ChatHeaderProps {
  messageCount: number;
  modelId: ModelChoiceId;
  autoFallback: boolean;
  safetyFilters: SafetyFiltersConfig;
  isIncognito?: boolean;
  retention?: RetentionMode;
  triModelConfig?: TriModelConfig;
  groupName?: string;
  sharedSessionCount?: number;
  sidebarOpen: boolean;
  codePreviewOpen: boolean;
  stopMotionOpen: boolean;
  pixelArtOpen: boolean;
  threeDOpen: boolean;
  googleFlowOpen: boolean;
  webPreviewOpen: boolean;
  onOpenSidebar: () => void;
  onNewChat: () => void;
  onChangeModel: (modelId: ModelChoiceId) => void;
  onToggleAutoFallback: () => void;
  onChangeRetention?: (mode: RetentionMode) => void;
  onChangeTriModelConfig?: (next: TriModelConfig) => void;
  onOpenChangelogs?: () => void;
  onOpenSafety: () => void;
  onOpenSessionPrivacy: () => void;
  onOpenCodePreview: () => void;
  onOpenStopMotion: () => void;
  onOpenPixelArt: () => void;
  onOpenThreeD: () => void;
  onOpenGoogleFlow: () => void;
  onOpenWebPreview: () => void;
  onExportMarkdown: () => void;
  onExportJson?: () => void;
  onExportXml?: () => void;
  fontPreset?: FontPresetId;
  onChangeFontPreset?: (preset: FontPresetId) => void;
  headings?: ChatHeadingItem[];
  onJumpToHeading?: (anchorId: string) => void;
  onOpenToolsModal?: () => void;
  enabledToolsCount?: number;
  userAccount?: { displayName: string; email: string; photoURL?: string } | null;
  onOpenAccount?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  messageCount,
  modelId,
  autoFallback,
  safetyFilters,
  isIncognito = false,
  retention = 'permanent',
  triModelConfig = DEFAULT_TRI_MODEL_CONFIG,
  groupName,
  sharedSessionCount = 0,
  sidebarOpen,
  codePreviewOpen,
  stopMotionOpen,
  pixelArtOpen,
  threeDOpen,
  googleFlowOpen,
  webPreviewOpen,
  onOpenSidebar,
  onNewChat,
  onChangeModel,
  onToggleAutoFallback,
  onChangeRetention,
  onChangeTriModelConfig,
  onOpenChangelogs,
  onOpenSafety,
  onOpenSessionPrivacy,
  onOpenCodePreview,
  onOpenStopMotion,
  onOpenPixelArt,
  onOpenThreeD,
  onOpenGoogleFlow,
  onOpenWebPreview,
  onExportMarkdown,
  onExportJson,
  onExportXml,
  fontPreset = 'studio-sans',
  onChangeFontPreset,
  headings = [],
  onJumpToHeading,
  onOpenToolsModal,
  enabledToolsCount = 0,
  userAccount,
  onOpenAccount,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [studiosOpen, setStudiosOpen] = useState(false);
  const [triOpen, setTriOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [headingsOpen, setHeadingsOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const studiosDropdownRef = useRef<HTMLDivElement>(null);
  const triDropdownRef = useRef<HTMLDivElement>(null);
  const retentionDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const headingsDropdownRef = useRef<HTMLDivElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = getModelOption(modelId);
  const anyStudioOpen =
    googleFlowOpen || threeDOpen || pixelArtOpen || stopMotionOpen || webPreviewOpen;
  const activeRetentionOption =
    RETENTION_OPTIONS.find((r) => r.id === retention) || RETENTION_OPTIONS[4];
  const triCandidates = MODEL_OPTIONS.filter((m) => !m.isImageOnly && m.id !== 'auto');

  useEffect(() => {
    if (!menuOpen && !studiosOpen && !triOpen && !retentionOpen && !exportOpen && !headingsOpen && !fontOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuOpen && dropdownRef.current && !dropdownRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (
        studiosOpen &&
        studiosDropdownRef.current &&
        !studiosDropdownRef.current.contains(target)
      ) {
        setStudiosOpen(false);
      }
      if (triOpen && triDropdownRef.current && !triDropdownRef.current.contains(target)) {
        setTriOpen(false);
      }
      if (
        retentionOpen &&
        retentionDropdownRef.current &&
        !retentionDropdownRef.current.contains(target)
      ) {
        setRetentionOpen(false);
      }
      if (
        exportOpen &&
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(target)
      ) {
        setExportOpen(false);
      }
      if (
        headingsOpen &&
        headingsDropdownRef.current &&
        !headingsDropdownRef.current.contains(target)
      ) {
        setHeadingsOpen(false);
      }
      if (fontOpen && fontDropdownRef.current && !fontDropdownRef.current.contains(target)) {
        setFontOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setStudiosOpen(false);
        setTriOpen(false);
        setRetentionOpen(false);
        setExportOpen(false);
        setHeadingsOpen(false);
        setFontOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen, studiosOpen, triOpen, retentionOpen, exportOpen, headingsOpen, fontOpen]);

  const toggleTriModelSelection = (candidateId: ModelChoiceId) => {
    if (!onChangeTriModelConfig) return;
    const exists = triModelConfig.models.includes(candidateId);
    let nextModels: ModelChoiceId[];
    if (exists) {
      if (triModelConfig.models.length <= 2) return;
      nextModels = triModelConfig.models.filter((id) => id !== candidateId);
    } else {
      if (triModelConfig.models.length >= 3) {
        nextModels = [...triModelConfig.models.slice(1), candidateId];
      } else {
        nextModels = [...triModelConfig.models, candidateId];
      }
    }
    onChangeTriModelConfig({
      ...triModelConfig,
      models: nextModels,
    });
  };

  return (
    <header className="h-14 shrink-0 border-b border-neutral-200/70 dark:border-white/10 bg-white/95 dark:bg-[#212121]/95 backdrop-blur-sm px-2.5 sm:px-4 flex items-center justify-between gap-2 z-20">
      {/* Left: Sidebar, New Chat, Model Selector & v(OXYGEN) Changelogs */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className={`inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 shrink-0 ${
            sidebarOpen ? 'lg:hidden' : ''
          }`}
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          title="New chat"
          className={`inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 shrink-0 ${
            sidebarOpen ? 'lg:hidden' : ''
          }`}
        >
          <SquarePen className="w-5 h-5" />
        </button>

        <div ref={dropdownRef} className="relative min-w-0 max-w-[140px] sm:max-w-[260px]">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className="inline-flex items-center gap-1 min-w-0 max-w-full overflow-hidden min-h-[38px] px-2 sm:px-3 py-1.5 rounded-xl text-sm sm:text-base font-semibold text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <span className="truncate min-w-0 sm:hidden">{currentModel.shortName}</span>
            <span className="hidden sm:inline truncate min-w-0">{currentModel.name}</span>
            <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />
          </button>

          {menuOpen && (
            <div
              role="listbox"
              aria-label="Select model"
              className="absolute left-0 top-full mt-1.5 w-[300px] sm:w-[345px] max-h-[75vh] overflow-y-auto chat-scroll rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] shadow-xl p-1.5 z-40"
            >
              <div className="space-y-0.5">
                {MODEL_OPTIONS.map((option) => {
                  const selected = option.id === modelId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChangeModel(option.id);
                        setMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        selected
                          ? 'bg-[#f4f4f4] dark:bg-white/10'
                          : 'hover:bg-[#f4f4f4]/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#0d0d0d] dark:text-[#ececec] truncate">
                            {option.name}
                          </span>
                          {option.isPaid && (
                            <span className="text-[10px] font-mono uppercase tracking-wide text-amber-600 dark:text-amber-400 shrink-0">
                              Paid
                            </span>
                          )}
                          {option.speedLabel && !option.isPaid && (
                            <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0">
                              {option.speedLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                          {option.description}
                        </div>
                      </div>
                      {selected && (
                        <Check className="w-4 h-4 text-[#0d0d0d] dark:text-white shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="my-1.5 border-t border-neutral-200 dark:border-white/10" />

              <button
                type="button"
                onClick={onToggleAutoFallback}
                role="switch"
                aria-checked={autoFallback}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left hover:bg-[#f4f4f4]/70 dark:hover:bg-white/5 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#0d0d0d] dark:text-[#ececec]">
                    Auto-switch on high demand
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Automatically route around busy or paid-only models
                  </div>
                </div>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    autoFallback
                      ? 'bg-[#0d0d0d] dark:bg-white'
                      : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                      autoFallback
                        ? 'translate-x-[18px] bg-white dark:bg-[#0d0d0d]'
                        : 'translate-x-1 bg-white dark:bg-neutral-200'
                    }`}
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Version + Changelogs button */}
        {onOpenChangelogs && (
          <button
            type="button"
            onClick={onOpenChangelogs}
            title="View Folio release changelogs"
            aria-label="Open Folio changelogs"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors whitespace-nowrap shrink-0"
          >
            <History className="w-3 h-3" />
            <span>{FOLIO_CURRENT_VERSION}</span>
          </button>
        )}
      </div>

      {/* Right: Studios, Tri-Model, Retention, Privacy, Safety & Multi-Format Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Compact Studios Dropdown for mobile, tablet, and split-panel viewports */}
        <div ref={studiosDropdownRef} className="relative xl:hidden">
          <button
            type="button"
            onClick={() => setStudiosOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={studiosOpen}
            aria-label="Open creative studios and web preview"
            title="Studios & Web Preview"
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              anyStudioOpen
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Studios</span>
            <ChevronDown className="w-3 h-3 opacity-75" />
          </button>

          {studiosOpen && (
            <div
              role="menu"
              aria-label="Studios and tools"
              className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2a2b30] shadow-xl p-1.5 z-40 space-y-0.5"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStudiosOpen(false);
                  onOpenGoogleFlow();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                  googleFlowOpen
                    ? 'bg-blue-600 text-white'
                    : 'text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-white/10'
                }`}
              >
                <Sparkles className={`w-4 h-4 shrink-0 ${googleFlowOpen ? 'text-white' : 'text-blue-500'}`} />
                <span>Google Flow Studio</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStudiosOpen(false);
                  onOpenWebPreview();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                  webPreviewOpen
                    ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                    : 'text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-white/10'
                }`}
              >
                <Globe className={`w-4 h-4 shrink-0 ${webPreviewOpen ? '' : 'text-emerald-500'}`} />
                <span>Web Preview</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStudiosOpen(false);
                  onOpenThreeD();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                  threeDOpen
                    ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                    : 'text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-white/10'
                }`}
              >
                <Box className="w-4 h-4 shrink-0 text-blue-500" />
                <span>3D Studio</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStudiosOpen(false);
                  onOpenPixelArt();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                  pixelArtOpen
                    ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                    : 'text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-white/10'
                }`}
              >
                <Paintbrush className="w-4 h-4 shrink-0" />
                <span>Pixel Art Studio</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStudiosOpen(false);
                  onOpenStopMotion();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                  stopMotionOpen
                    ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                    : 'text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-white/10'
                }`}
              >
                <Film className="w-4 h-4 shrink-0" />
                <span>Stop Motion Studio</span>
              </button>
            </div>
          )}
        </div>

        {/* Expanded Studio buttons on wide desktops (xl+) */}
        <div className="hidden xl:flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenGoogleFlow}
            aria-label="Open Google Flow creative studio"
            aria-pressed={googleFlowOpen}
            title="Google Flow AI Creative Studio"
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              googleFlowOpen
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${googleFlowOpen ? 'text-white' : 'text-blue-500'}`} />
            <span>Flow</span>
          </button>

          <button
            type="button"
            onClick={onOpenThreeD}
            aria-label="Open 3D creation studio"
            aria-pressed={threeDOpen}
            title="3D Studio"
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              threeDOpen
                ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-blue-500" />
            <span>3D</span>
          </button>

          <button
            type="button"
            onClick={onOpenPixelArt}
            aria-label="Open pixel art creation and animation studio"
            aria-pressed={pixelArtOpen}
            title="Pixel Art Studio (up to 512px)"
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              pixelArtOpen
                ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Pixel</span>
          </button>

          <button
            type="button"
            onClick={onOpenStopMotion}
            aria-label="Open stop motion animation studio"
            aria-pressed={stopMotionOpen}
            title="Stop Motion v3 Studio"
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              stopMotionOpen
                ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Motion</span>
          </button>

          <button
            type="button"
            onClick={onOpenWebPreview}
            aria-label="Open website previewer and domain simulator"
            aria-pressed={webPreviewOpen}
            title="Preview websites & simulated custom domains"
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
              webPreviewOpen
                ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            <span>Web</span>
          </button>
        </div>

        {/* Tri-Model Orchestrator Popover (OFF by default) */}
        {onChangeTriModelConfig && (
          <div ref={triDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setTriOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={triOpen}
              title="Tri-Model Ensemble Chat Mode (2–3 models + autonomous turns)"
              className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                triModelConfig.enabled
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {triModelConfig.enabled
                  ? `Tri-Model (${triModelConfig.models.length})`
                  : 'Tri-Model'}
              </span>
            </button>

            {triOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-[315px] sm:w-[345px] rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#26272b] shadow-2xl p-3.5 z-40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
                      Tri-Model Council Mode
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Run 2–3 models in sequence with optional autonomous follow-ups
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={triModelConfig.enabled}
                    onClick={() =>
                      onChangeTriModelConfig({
                        ...triModelConfig,
                        enabled: !triModelConfig.enabled,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      triModelConfig.enabled
                        ? 'bg-sky-600'
                        : 'bg-neutral-300 dark:bg-neutral-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        triModelConfig.enabled ? 'translate-x-[18px]' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    Active Council Models (pick 2–3):
                  </div>
                  <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto chat-scroll">
                    {triCandidates.map((cand) => {
                      const active = triModelConfig.models.includes(cand.id);
                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => toggleTriModelSelection(cand.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                            active
                              ? 'border-sky-500/40 bg-sky-500/10 text-[#0d0d0d] dark:text-white'
                              : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate">{cand.name}</span>
                          {active && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200 dark:border-white/10">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Autonomous Turns
                    </label>
                    <select
                      value={triModelConfig.autonomousTurns}
                      onChange={(e) =>
                        onChangeTriModelConfig({
                          ...triModelConfig,
                          autonomousTurns: Number(e.target.value),
                        })
                      }
                      className="w-full h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-neutral-50 dark:bg-[#1a1b1e] px-2 text-xs text-[#0d0d0d] dark:text-white"
                    >
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? '0 (Manual only)' : `${n} auto round${n > 1 ? 's' : ''}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeTriModelConfig({
                          ...triModelConfig,
                          linkTempSessions: !triModelConfig.linkTempSessions,
                        })
                      }
                      className={`h-8 px-2 rounded-lg border text-[11px] font-medium transition-colors ${
                        triModelConfig.linkTempSessions
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'border-neutral-200 dark:border-white/15 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {triModelConfig.linkTempSessions ? 'Temp Linked: On' : 'Link Temp Sessions'}
                    </button>
                  </div>
                </div>

                {triModelConfig.autonomousTurns > 0 && (
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Autonomous Follow-Up Directive
                    </label>
                    <input
                      type="text"
                      value={triModelConfig.autonomousPrompt || ''}
                      onChange={(e) =>
                        onChangeTriModelConfig({
                          ...triModelConfig,
                          autonomousPrompt: e.target.value,
                        })
                      }
                      placeholder="Critique and synthesize the best ideas..."
                      className="w-full h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-neutral-50 dark:bg-[#1a1b1e] px-2.5 text-xs text-[#0d0d0d] dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Primary Workbench button */}
        <button
          type="button"
          onClick={onOpenCodePreview}
          aria-label="Open code workbench, folders and GitHub"
          aria-pressed={codePreviewOpen}
          title="Code Workbench, Project Folders & GitHub"
          className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            codePreviewOpen
              ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
              : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Workbench</span>
        </button>

        {/* Retention Timer (visible on incognito or timed retention sessions) */}
        {(isIncognito || retention !== 'permanent') && onChangeRetention && (
          <div ref={retentionDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setRetentionOpen((v) => !v)}
              title={`Retention: ${activeRetentionOption.label}`}
              aria-label="Set session retention timer"
              className="inline-flex items-center gap-1 min-h-[36px] px-2 py-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-mono font-medium whitespace-nowrap shrink-0"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{activeRetentionOption.shortLabel}</span>
            </button>

            {retentionOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2a2b30] shadow-xl p-1.5 z-40 space-y-0.5">
                {RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeRetention(opt.id);
                      setRetentionOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 ${
                      retention === opt.id
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div>{opt.label}</div>
                      <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-normal">
                        {opt.description}
                      </div>
                    </div>
                    {retention === opt.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Session Isolation / Folder Sharing / Incognito */}
        <button
          type="button"
          onClick={onOpenSessionPrivacy}
          aria-label="Session privacy, folders, and sharing"
          title={
            isIncognito
              ? 'Incognito session (ephemeral & isolated)'
              : groupName
              ? `Folder: ${groupName}`
              : sharedSessionCount > 0
              ? `Shared with ${sharedSessionCount} session(s)`
              : 'Session isolated by default — click to configure folders or sharing'
          }
          className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            isIncognito
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
          }`}
        >
          {isIncognito ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Incognito</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              {groupName && <span className="hidden md:inline truncate max-w-[90px]">{groupName}</span>}
            </>
          )}
        </button>

        {/* Safety Filters */}
        <button
          type="button"
          onClick={onOpenSafety}
          aria-label="Edit safety filters"
          title="Safety filters"
          className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <Shield className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
          <span className="hidden sm:inline">Safety</span>
          {!areSafetyFiltersDefault(safetyFilters) && (
            <span className="hidden md:inline text-neutral-500 dark:text-neutral-400">
              · {getSafetySummaryLabel(safetyFilters)}
            </span>
          )}
        </button>

        {/* Export Menu (Markdown, JSON, XML) */}
        {messageCount > 0 && (
          <div ref={exportDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              aria-label="Export conversation"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              title="Export chat (.md, .json, .xml)"
              className="inline-flex items-center justify-center gap-1 min-h-[36px] px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {exportOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2a2b30] shadow-xl p-1 z-40 space-y-0.5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    onExportMarkdown();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10"
                >
                  <FileText className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Export Markdown (.md)</span>
                </button>
                {onExportJson && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportOpen(false);
                      onExportJson();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10"
                  >
                    <FileJson className="w-3.5 h-3.5 text-sky-500" />
                    <span>Export JSON (.json)</span>
                  </button>
                )}
                {onExportXml && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportOpen(false);
                      onExportXml();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10"
                  >
                    <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Export XML (.xml)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chat Headings Outline Jump Menu */}
        {headings.length > 0 && onJumpToHeading && (
          <div ref={headingsDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setHeadingsOpen((v) => !v)}
              aria-label="Jump to chat heading"
              aria-haspopup="menu"
              aria-expanded={headingsOpen}
              title={`Chat Headings Outline (${headings.length})`}
              className="inline-flex items-center gap-1 min-h-[36px] px-2 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors whitespace-nowrap shrink-0"
            >
              <ListTree className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden lg:inline">Headings</span>
              <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                {headings.length}
              </span>
            </button>

            {headingsOpen && (
              <div
                role="menu"
                aria-label="Chat Headings"
                className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto chat-scroll rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2a2b30] shadow-xl p-1.5 z-40 space-y-0.5"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Chat Headings Outline
                </div>
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setHeadingsOpen(false);
                      onJumpToHeading(h.anchorId);
                    }}
                    className={`w-full flex items-center gap-2 py-1.5 pr-2.5 rounded-lg text-xs text-left text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors ${
                      h.level === 1 ? 'pl-2.5 font-semibold' : h.level === 2 ? 'pl-5 font-medium' : 'pl-7 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    <span className="text-[10px] font-mono text-sky-500 shrink-0">
                      H{h.level}
                    </span>
                    <span className="truncate">{h.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Font Theme Selector */}
        {onChangeFontPreset && (
          <div ref={fontDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setFontOpen((v) => !v)}
              aria-label="Change workspace font"
              aria-haspopup="menu"
              aria-expanded={fontOpen}
              title="Workspace Typography Theme"
              className="inline-flex items-center justify-center min-h-[36px] w-9 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors whitespace-nowrap shrink-0"
            >
              <Type className="w-3.5 h-3.5" />
            </button>

            {fontOpen && (
              <div
                role="menu"
                aria-label="Workspace fonts"
                className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2a2b30] shadow-xl p-1.5 z-40 space-y-0.5"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Workspace Fonts
                </div>
                {FONT_PRESETS.map((preset) => {
                  const selected = preset.id === fontPreset;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onChangeFontPreset(preset.id);
                        setFontOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left text-xs transition-colors ${
                        selected
                          ? 'bg-[#f4f4f4] dark:bg-white/10 text-[#0d0d0d] dark:text-white font-semibold'
                          : 'text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0">
                        <div style={{ fontFamily: preset.sansFamily }}>{preset.label}</div>
                        <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-normal truncate">
                          {preset.description}
                        </div>
                      </div>
                      {selected && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Function Calling Environment Modal */}
        {onOpenToolsModal && (
          <button
            type="button"
            onClick={onOpenToolsModal}
            aria-label="Open Function Calling Environment"
            title="Function Calling Environment & Custom Tools"
            className="inline-flex items-center gap-1 min-h-[36px] px-2 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors whitespace-nowrap shrink-0"
          >
            <Braces className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden 2xl:inline">Functions</span>
            {enabledToolsCount > 0 && (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                {enabledToolsCount}
              </span>
            )}
          </button>
        )}

        {/* Account Info / Sign In Button */}
        {onOpenAccount && (
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label={userAccount ? `Account: ${userAccount.displayName}` : 'Sign in to Folio'}
            title={userAccount ? `${userAccount.displayName} (${userAccount.email})` : 'Account Info & Sign In'}
            className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-2 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors whitespace-nowrap shrink-0"
          >
            {userAccount?.photoURL ? (
              <img
                src={userAccount.photoURL}
                alt={userAccount.displayName}
                className="w-5 h-5 rounded-full object-cover shrink-0"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300" />
            )}
            <span className="hidden 2xl:inline max-w-[90px] truncate">
              {userAccount ? userAccount.displayName.split(' ')[0] : 'Sign in'}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};

