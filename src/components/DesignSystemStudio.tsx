import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Dices,
  Download,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { DesignCustomVarType, DesignSystemConfig } from '../types/designSystem';
import {
  HTML_DESIGN_MODULE_CODE,
  REACT_DESIGN_MODULE_CODE,
  buildDesignSystemCss,
  buildDesignSystemTokensJson,
  generateDesignSystemFromSeed,
  generateRandomSeed,
  sanitizeVarKey,
} from '../utils/designSystem';

interface DesignSystemStudioProps {
  config: DesignSystemConfig;
  onChange: (next: DesignSystemConfig) => void;
  onLaunchModule: (code: string, language: 'html' | 'tsx') => void;
  onDownloadBundleJson: () => void;
  onTriggerUploadJson: () => void;
}

export const DesignSystemStudio: React.FC<DesignSystemStudioProps> = ({
  config,
  onChange,
  onLaunchModule,
  onDownloadBundleJson,
  onTriggerUploadJson,
}) => {
  const [exportTab, setExportTab] = useState<'css' | 'json'>('css');
  const [copied, setCopied] = useState(false);

  const [newVarKey, setNewVarKey] = useState('');
  const [newVarType, setNewVarType] = useState<DesignCustomVarType>('number');
  const [newVarValue, setNewVarValue] = useState('16');
  const [newVarUnit, setNewVarUnit] = useState('px');

  const generatedCss = useMemo(() => buildDesignSystemCss(config), [config]);
  const generatedJson = useMemo(() => buildDesignSystemTokensJson(config), [config]);
  const activeExportText = exportTab === 'css' ? generatedCss : generatedJson;

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(activeExportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleDownloadAsset = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddCustomVar = () => {
    const cleanKey = sanitizeVarKey(newVarKey);
    if (!cleanKey) return;
    onChange({
      ...config,
      customVars: [
        ...config.customVars,
        {
          id: crypto.randomUUID(),
          key: cleanKey,
          label: newVarKey.trim() || cleanKey,
          type: newVarType,
          value: newVarValue || (newVarType === 'color' ? '#10b981' : '0'),
          unit: newVarType === 'number' && newVarUnit.trim() ? newVarUnit.trim() : undefined,
        },
      ],
    });
    setNewVarKey('');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4 bg-white dark:bg-[#171717] chat-scroll">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-200 dark:border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <Palette className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#0d0d0d] dark:text-white truncate">
              Design System &amp; Variable Module
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Injected automatically into HTML, React, CSS &amp; Workspace renders
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onLaunchModule(HTML_DESIGN_MODULE_CODE, 'html')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium hover:opacity-90 whitespace-nowrap"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>HTML Module</span>
          </button>
          <button
            type="button"
            onClick={() => onLaunchModule(REACT_DESIGN_MODULE_CODE, 'tsx')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-white/15 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>React Module</span>
          </button>
          <button
            type="button"
            onClick={onTriggerUploadJson}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-white/15 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload JSON</span>
          </button>
          <button
            type="button"
            onClick={onDownloadBundleJson}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-white/15 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </button>
        </div>
      </div>

      {/* Optional Procedural Seed Generator */}
      <section className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#fafafa] dark:bg-[#202227] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
              Optional Procedural Seed Generator
            </span>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.seedEnabled}
              onChange={(e) => onChange({ ...config, seedEnabled: e.target.checked })}
              className="rounded border-neutral-300 dark:border-white/20"
            />
            <span>Seed Active in Previews</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={config.seed}
            onChange={(e) => onChange({ ...config, seed: e.target.value })}
            placeholder="e.g. folio-42"
            aria-label="Procedural seed"
            className="flex-1 min-w-[160px] h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2.5 text-xs font-mono text-[#0d0d0d] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="button"
            onClick={() => {
              const nextSeed = generateRandomSeed();
              onChange(generateDesignSystemFromSeed(nextSeed, config));
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-500/25 whitespace-nowrap"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Randomize &amp; Generate</span>
          </button>
          <button
            type="button"
            onClick={() => onChange(generateDesignSystemFromSeed(config.seed, config))}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-neutral-200 dark:border-white/15 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-white/10 whitespace-nowrap"
          >
            <span>Apply Seed Tokens</span>
          </button>
        </div>
      </section>

      {/* Core Variables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Colors */}
        <section className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#fafafa] dark:bg-[#202227] p-3.5 space-y-3">
          <h4 className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
            Theme &amp; Palette Variables
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                ['themeColor', 'Theme Colour'],
                ['accentColor', 'Accent Colour'],
                ['surfaceColor', 'Surface'],
                ['textColor', 'Text Colour'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="space-y-1 text-[11px]">
                <span className="block text-neutral-600 dark:text-neutral-400">{label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={config[field]}
                    onChange={(e) => onChange({ ...config, [field]: e.target.value })}
                    className="w-8 h-8 rounded-md border border-neutral-300 dark:border-white/15 bg-transparent cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={config[field]}
                    onChange={(e) => onChange({ ...config, [field]: e.target.value })}
                    className="w-full h-8 rounded-lg border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 text-xs font-mono text-[#0d0d0d] dark:text-white"
                  />
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Motion, Sprite & Scale */}
        <section className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#fafafa] dark:bg-[#202227] p-3.5 space-y-2.5">
          <h4 className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
            Animation, Sprite &amp; Layout Variables
          </h4>

          <div className="space-y-2 text-xs tabular-nums">
            <label className="block space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-600 dark:text-neutral-400">
                  Animation Speed (<code>--animation-speed</code>)
                </span>
                <span className="font-mono text-[#0d0d0d] dark:text-white">
                  {config.animationSpeed}x
                </span>
              </div>
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={config.animationSpeed}
                onChange={(e) =>
                  onChange({ ...config, animationSpeed: Number(e.target.value) })
                }
                className="w-full accent-blue-600"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-600 dark:text-neutral-400">
                  Sprite Size (<code>--sprite-size</code>)
                </span>
                <span className="font-mono text-[#0d0d0d] dark:text-white">
                  {config.spriteSize}px
                </span>
              </div>
              <input
                type="range"
                min={16}
                max={128}
                step={2}
                value={config.spriteSize}
                onChange={(e) =>
                  onChange({ ...config, spriteSize: Number(e.target.value) })
                }
                className="w-full accent-blue-600"
              />
            </label>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <label className="space-y-1 text-[11px]">
                <span className="block text-neutral-600 dark:text-neutral-400">Radius px</span>
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={config.borderRadius}
                  onChange={(e) =>
                    onChange({ ...config, borderRadius: Number(e.target.value) || 0 })
                  }
                  className="w-full h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 font-mono text-xs text-[#0d0d0d] dark:text-white"
                />
              </label>
              <label className="space-y-1 text-[11px]">
                <span className="block text-neutral-600 dark:text-neutral-400">Spacing px</span>
                <input
                  type="number"
                  min={2}
                  max={24}
                  value={config.spacingUnit}
                  onChange={(e) =>
                    onChange({ ...config, spacingUnit: Number(e.target.value) || 4 })
                  }
                  className="w-full h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 font-mono text-xs text-[#0d0d0d] dark:text-white"
                />
              </label>
              <label className="space-y-1 text-[11px]">
                <span className="block text-neutral-600 dark:text-neutral-400">Font Scale</span>
                <input
                  type="number"
                  min={0.75}
                  max={1.75}
                  step={0.05}
                  value={config.fontScale}
                  onChange={(e) =>
                    onChange({ ...config, fontScale: Number(e.target.value) || 1 })
                  }
                  className="w-full h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 font-mono text-xs text-[#0d0d0d] dark:text-white"
                />
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* Custom Variables */}
      <section className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#fafafa] dark:bg-[#202227] p-3.5 space-y-2.5">
        <h4 className="text-xs font-semibold text-[#0d0d0d] dark:text-white">
          Custom Module Variables
        </h4>

        <div className="space-y-1.5">
          {config.customVars.map((cv) => (
            <div key={cv.id} className="flex items-center gap-2 text-xs">
              <code className="px-2 py-1 rounded bg-neutral-200/70 dark:bg-white/10 font-mono text-[11px] text-[#0d0d0d] dark:text-white shrink-0">
                --{cv.key}
              </code>
              {cv.type === 'color' ? (
                <input
                  type="color"
                  value={cv.value}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      customVars: config.customVars.map((item) =>
                        item.id === cv.id ? { ...item, value: e.target.value } : item
                      ),
                    })
                  }
                  className="w-8 h-7 rounded border border-neutral-300 dark:border-white/15 cursor-pointer"
                />
              ) : null}
              <input
                type={cv.type === 'number' ? 'number' : 'text'}
                step={cv.step || 'any'}
                value={cv.value}
                onChange={(e) =>
                  onChange({
                    ...config,
                    customVars: config.customVars.map((item) =>
                      item.id === cv.id ? { ...item, value: e.target.value } : item
                    ),
                  })
                }
                className="flex-1 h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 font-mono text-xs text-[#0d0d0d] dark:text-white"
              />
              {cv.unit && (
                <span className="text-[11px] font-mono text-neutral-500">{cv.unit}</span>
              )}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    customVars: config.customVars.filter((item) => item.id !== cv.id),
                  })
                }
                aria-label={`Remove ${cv.key}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <input
            type="text"
            value={newVarKey}
            onChange={(e) => setNewVarKey(e.target.value)}
            placeholder="variable-name"
            className="flex-1 min-w-[120px] h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 font-mono text-xs text-[#0d0d0d] dark:text-white"
          />
          <select
            value={newVarType}
            onChange={(e) => setNewVarType(e.target.value as DesignCustomVarType)}
            className="h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 text-xs text-[#0d0d0d] dark:text-white"
          >
            <option value="number">Number</option>
            <option value="color">Color</option>
            <option value="text">Text</option>
          </select>
          <input
            type={newVarType === 'color' ? 'color' : 'text'}
            value={newVarValue}
            onChange={(e) => setNewVarValue(e.target.value)}
            placeholder="value"
            className="w-20 h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 font-mono text-xs text-[#0d0d0d] dark:text-white"
          />
          {newVarType === 'number' && (
            <input
              type="text"
              value={newVarUnit}
              onChange={(e) => setNewVarUnit(e.target.value)}
              placeholder="unit"
              className="w-14 h-7 rounded-md border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#14161a] px-2 font-mono text-xs text-[#0d0d0d] dark:text-white"
            />
          )}
          <button
            type="button"
            onClick={handleAddCustomVar}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Var</span>
          </button>
        </div>
      </section>

      {/* Live Preview Swatch & Sprite Check */}
      <section
        className="rounded-xl border border-neutral-200 dark:border-white/10 p-4 flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: config.surfaceColor,
          color: config.textColor,
          borderRadius: `${config.borderRadius}px`,
        }}
      >
        <div className="space-y-1">
          <div className="text-xs font-semibold" style={{ fontSize: `${13 * config.fontScale}px` }}>
            Live Design System Specimen
          </div>
          <div className="text-[11px] opacity-75 font-mono">
            {config.themeColor} · {config.accentColor} · {config.spriteSize}px · {config.animationSpeed}x
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: `${Math.min(64, config.spriteSize)}px`,
              height: `${Math.min(64, config.spriteSize)}px`,
              borderRadius: `${Math.min(24, config.borderRadius * 0.7)}px`,
              background: `linear-gradient(135deg, ${config.themeColor}, ${config.accentColor})`,
            }}
            title="Live Sprite Box"
          />
          <button
            type="button"
            onClick={() => onLaunchModule(HTML_DESIGN_MODULE_CODE, 'html')}
            style={{
              backgroundColor: config.themeColor,
              color: '#ffffff',
              borderRadius: `${config.borderRadius}px`,
            }}
            className="px-3 py-1.5 text-xs font-medium whitespace-nowrap"
          >
            Preview Animated Stage
          </button>
        </div>
      </section>

      {/* Generated CSS / JSON Design System Output */}
      <section className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-[#0d0d0d] text-[#ececec]">
        <div className="px-3 py-2 border-b border-white/10 bg-[#1c1c1c] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExportTab('css')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                exportTab === 'css' ? 'bg-white text-[#0d0d0d]' : 'text-neutral-300 hover:bg-white/10'
              }`}
            >
              design-system.css
            </button>
            <button
              type="button"
              onClick={() => setExportTab('json')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                exportTab === 'json' ? 'bg-white text-[#0d0d0d]' : 'text-neutral-300 hover:bg-white/10'
              }`}
            >
              design-system.json
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyExport}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownloadAsset(
                  exportTab === 'css' ? 'design-system.css' : 'design-system.json',
                  activeExportText,
                  exportTab === 'css' ? 'text/css;charset=utf-8' : 'application/json;charset=utf-8'
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/10 text-xs font-medium text-white hover:bg-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .{exportTab}</span>
            </button>
          </div>
        </div>

        <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto max-h-64 chat-scroll">
          <code>{activeExportText}</code>
        </pre>
      </section>
    </div>
  );
};
