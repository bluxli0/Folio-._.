import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  Code2,
  Download,
  Film,
  Globe,
  Paintbrush,
  PanelLeft,
  Shield,
  Sparkles,
  SquarePen,
} from 'lucide-react';
import { ModelChoiceId, SafetyFiltersConfig } from '../types/chat';
import {
  MODEL_OPTIONS,
  areSafetyFiltersDefault,
  getModelOption,
  getSafetySummaryLabel,
} from '../data/presets';

interface ChatHeaderProps {
  messageCount: number;
  modelId: ModelChoiceId;
  autoFallback: boolean;
  safetyFilters: SafetyFiltersConfig;
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
  onOpenSafety: () => void;
  onOpenCodePreview: () => void;
  onOpenStopMotion: () => void;
  onOpenPixelArt: () => void;
  onOpenThreeD: () => void;
  onOpenGoogleFlow: () => void;
  onOpenWebPreview: () => void;
  onExportMarkdown: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  messageCount,
  modelId,
  autoFallback,
  safetyFilters,
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
  onOpenSafety,
  onOpenCodePreview,
  onOpenStopMotion,
  onOpenPixelArt,
  onOpenThreeD,
  onOpenGoogleFlow,
  onOpenWebPreview,
  onExportMarkdown,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentModel = getModelOption(modelId);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  return (
    <header className="h-14 shrink-0 bg-white/95 dark:bg-[#212121]/95 backdrop-blur-sm px-3 sm:px-4 flex items-center justify-between gap-2 z-20">
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 shrink-0 ${
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
          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 shrink-0 ${
            sidebarOpen ? 'lg:hidden' : ''
          }`}
        >
          <SquarePen className="w-5 h-5" />
        </button>

        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl text-[15px] sm:text-base font-semibold text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <span>{currentModel.name}</span>
            <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          </button>

          {menuOpen && (
            <div
              role="listbox"
              aria-label="Select model"
              className="absolute left-0 top-full mt-1.5 w-[290px] sm:w-[320px] rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] shadow-xl p-1.5 z-40"
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
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#0d0d0d] dark:text-[#ececec]">
                          {option.name}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
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
                    Automatically route around busy models
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
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenGoogleFlow}
          aria-label="Open Google Flow creative studio"
          aria-pressed={googleFlowOpen}
          title="Google Flow AI Creative Studio"
          className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            googleFlowOpen
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">Google Flow</span>
        </button>

        <button
          type="button"
          onClick={onOpenThreeD}
          aria-label="Open 3D creation studio"
          aria-pressed={threeDOpen}
          title="3D Studio"
          className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            threeDOpen
              ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
              : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
          }`}
        >
          <Box className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">3D Studio</span>
        </button>

        <button
          type="button"
          onClick={onOpenPixelArt}
          aria-label="Open pixel art creation and animation studio"
          aria-pressed={pixelArtOpen}
          title="Pixel Art Studio"
          className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            pixelArtOpen
              ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
              : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
          }`}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pixel Art</span>
        </button>

        <button
          type="button"
          onClick={onOpenStopMotion}
          aria-label="Open stop motion animation studio"
          aria-pressed={stopMotionOpen}
          title="Stop Motion Studio"
          className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            stopMotionOpen
              ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
              : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Stop Motion</span>
        </button>

        <button
          type="button"
          onClick={onOpenWebPreview}
          aria-label="Open website previewer and renderer"
          aria-pressed={webPreviewOpen}
          title="Preview & render live websites"
          className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            webPreviewOpen
              ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
              : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">Web Preview</span>
        </button>

        <button
          type="button"
          onClick={onOpenCodePreview}
          aria-label="Open code execution and iframe renderer"
          aria-pressed={codePreviewOpen}
          title="Execute code & iframe renderer"
          className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            codePreviewOpen
              ? 'border-[#0d0d0d] dark:border-white bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
              : 'border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Run &amp; Render</span>
        </button>

        <button
          type="button"
          onClick={onOpenSafety}
          aria-label="Edit safety filters"
          title="Safety filters"
          className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <Shield className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
          <span>Safety</span>
          {!areSafetyFiltersDefault(safetyFilters) && (
            <span className="text-neutral-500 dark:text-neutral-400">
              · {getSafetySummaryLabel(safetyFilters)}
            </span>
          )}
        </button>

        {messageCount > 0 && (
          <button
            type="button"
            onClick={onExportMarkdown}
            aria-label="Export conversation as Markdown"
            title="Export as Markdown"
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>
    </header>
  );
};
