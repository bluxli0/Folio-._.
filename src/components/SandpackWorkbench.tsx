import React, { useEffect, useMemo, useState } from 'react';
import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  type SandpackPredefinedTemplate,
} from '@codesandbox/sandpack-react';
import {
  Code2,
  Columns2,
  Eye,
  FolderTree,
  Package,
  Plus,
  Terminal,
  X,
} from 'lucide-react';
import {
  SANDPACK_TEMPLATES,
  buildSandpackFiles,
  extractNpmDependencies,
  mapLanguageToSandpackTemplate,
} from '../utils/sandpackHelpers';
import { studioLogger } from '../utils/studioLogger';

interface SandpackWorkbenchProps {
  code: string;
  language: string;
  darkTheme: boolean;
  compact?: boolean;
  heightPx?: number;
}

export const SandpackWorkbench: React.FC<SandpackWorkbenchProps> = ({
  code,
  language,
  darkTheme,
  compact = false,
  heightPx = 380,
}) => {
  const [template, setTemplate] = useState<SandpackPredefinedTemplate>(() =>
    mapLanguageToSandpackTemplate(language, code)
  );
  const [layoutMode, setLayoutMode] = useState<'preview' | 'split' | 'editor'>(
    compact ? 'preview' : 'split'
  );
  const [showFiles, setShowFiles] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [customDeps, setCustomDeps] = useState<Record<string, string>>({});
  const [pkgInput, setPkgInput] = useState('');
  const [showPkgBar, setShowPkgBar] = useState(false);

  useEffect(() => {
    setTemplate(mapLanguageToSandpackTemplate(language, code));
  }, [language, code]);

  const detectedDeps = useMemo(() => extractNpmDependencies(code), [code]);
  const mergedDeps = useMemo(
    () => ({ ...detectedDeps, ...customDeps }),
    [detectedDeps, customDeps]
  );

  useEffect(() => {
    const depList = Object.entries(mergedDeps)
      .map(([k, v]) => `${k}@${v}`)
      .join(', ');
    if (depList) {
      studioLogger.log('Sandpack', `Bundling [${template}] with dependencies: ${depList}`);
    }
  }, [template, mergedDeps]);

  const files = useMemo(
    () => buildSandpackFiles(template, code),
    [template, code]
  );

  const handleAddPackage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pkgInput.trim();
    if (!trimmed) return;

    // Support formats like "lodash" or "lodash@4.17.21" or "@tanstack/react-query@5"
    let name = trimmed;
    let version = 'latest';
    const lastAt = trimmed.lastIndexOf('@');
    if (lastAt > 0) {
      name = trimmed.slice(0, lastAt);
      version = trimmed.slice(lastAt + 1) || 'latest';
    }

    setCustomDeps((prev) => ({ ...prev, [name]: version }));
    studioLogger.success('Sandpack', `Added npm dependency ${name}@${version}`);
    setPkgInput('');
  };

  const depEntries = Object.entries(mergedDeps);
  const effectiveHeight: number | string = compact
    ? heightPx
    : showConsole
    ? 'calc(100vh - 265px)'
    : 'calc(100vh - 115px)';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#151515] text-[#0d0d0d] dark:text-[#ececec]">
      {/* Sandpack Control Bar */}
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-white/10 bg-[#f4f4f4] dark:bg-[#1e1e1e] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as SandpackPredefinedTemplate)}
            aria-label="Sandpack template"
            className="h-7 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2a2a2a] px-2 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] focus:outline-none focus:ring-1 focus:ring-neutral-400"
          >
            {SANDPACK_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.label}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#2a2a2a] p-0.5">
            <button
              type="button"
              onClick={() => setLayoutMode('preview')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                layoutMode === 'preview'
                  ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                layoutMode === 'split'
                  ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <Columns2 className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('editor')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                layoutMode === 'editor'
                  ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>Editor</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {layoutMode !== 'preview' && (
            <button
              type="button"
              onClick={() => setShowFiles((v) => !v)}
              aria-pressed={showFiles}
              title="Toggle file explorer"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                showFiles
                  ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'
              }`}
            >
              <FolderTree className="w-3 h-3" />
              <span className="hidden sm:inline">Files</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPkgBar((v) => !v)}
            aria-pressed={showPkgBar}
            title="Manage npm packages"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors tabular-nums whitespace-nowrap shrink-0 ${
              showPkgBar
                ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'
            }`}
          >
            <Package className="w-3 h-3" />
            <span>Packages ({depEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConsole((v) => !v)}
            aria-pressed={showConsole}
            title="Toggle Sandpack console"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showConsole
                ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span className="hidden sm:inline">Console</span>
          </button>
        </div>
      </div>

      {/* npm Dependencies Bar */}
      {showPkgBar && (
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#191919] space-y-2">
          <form onSubmit={handleAddPackage} className="flex items-center gap-2">
            <input
              type="text"
              value={pkgInput}
              onChange={(e) => setPkgInput(e.target.value)}
              placeholder="Add npm package (e.g. canvas-confetti, zustand, recharts)..."
              aria-label="Add npm package"
              className="flex-1 h-7 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2.5 text-xs font-mono text-[#0d0d0d] dark:text-[#ececec] focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
            <button
              type="submit"
              disabled={!pkgInput.trim()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium disabled:opacity-40 transition-opacity"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </form>

          {depEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              {depEntries.map(([name, ver]) => {
                const isCustom = Boolean(customDeps[name]);
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] text-neutral-700 dark:text-neutral-200"
                  >
                    <span>
                      {name}@{ver}
                    </span>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() =>
                          setCustomDeps((prev) => {
                            const next = { ...prev };
                            delete next[name];
                            return next;
                          })
                        }
                        aria-label={`Remove ${name}`}
                        className="text-neutral-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sandpack Provider + Layout */}
      <div className="flex-1 min-h-0">
        <SandpackProvider
          key={`${template}-${JSON.stringify(mergedDeps)}`}
          template={template}
          files={files}
          customSetup={{ dependencies: mergedDeps }}
          theme={darkTheme ? 'dark' : 'light'}
          options={{
            autorun: true,
            autoReload: true,
            recompileMode: 'delayed',
            recompileDelay: 400,
          }}
        >
          <SandpackLayout
            style={{
              border: 'none',
              borderRadius: 0,
            }}
          >
            {showFiles && layoutMode !== 'preview' && (
              <SandpackFileExplorer style={{ height: effectiveHeight }} />
            )}

            {(layoutMode === 'split' || layoutMode === 'editor') && (
              <SandpackCodeEditor
                showTabs
                showLineNumbers
                showInlineErrors
                wrapContent
                style={{ height: effectiveHeight }}
              />
            )}

            {(layoutMode === 'split' || layoutMode === 'preview') && (
              <SandpackPreview
                showRefreshButton
                showOpenInCodeSandbox={false}
                style={{ height: effectiveHeight }}
              />
            )}
          </SandpackLayout>

          {showConsole && (
            <div className="border-t border-neutral-200 dark:border-white/10">
              <SandpackConsole style={{ height: 150 }} />
            </div>
          )}
        </SandpackProvider>
      </div>
    </div>
  );
};
