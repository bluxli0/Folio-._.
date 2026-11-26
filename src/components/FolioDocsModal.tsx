import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  BookOpen,
  Check,
  Code2,
  Copy,
  Cpu,
  Database,
  HardDrive,
  History,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import { FOLIO_CHANGELOGS, FOLIO_CURRENT_VERSION } from '../data/changelogs';
import {
  ENGINE_DATASETS,
  EngineDataset,
  EngineDatasetId,
  searchEngineDatasets,
} from '../data/engineDatasets';
import { FOLIO_DOCS_SECTIONS, FolioDocSection, searchFolioDocs } from '../data/folioDocs';

export type DocsTabId = 'docs' | 'datasets' | 'cli' | 'sdk' | 'changelog' | 'health';

interface SystemHealthResponse {
  ok: boolean;
  version: string;
  ram: {
    totalRamMb: number;
    freeRamMb: number;
    usedRamMb: number;
    swapTotalMb: number;
    swapFreeMb: number;
    rssMb: number;
    status: 'healthy' | 'tight' | 'critical';
  };
  disk: {
    totalGb: number;
    freeGb: number;
    usedGb: number;
  };
  thresholds: {
    canRunHeavyTools: boolean;
    canRunBlender: boolean;
    canRunTinyLlm: boolean;
    heavyToolsMinFreeMb: number;
    blenderMinFreeMb: number;
    tinyLlmMinFreeMb: number;
  };
  tinyLocalLlm?: {
    installed: boolean;
    binaryPath: string | null;
    modelName: string | null;
    modelSizeBytes: number;
    modelSizeHuman: string | null;
    availableModels?: Array<{ name: string; sizeBytes: number; sizeHuman: string }>;
  };
  remoteLlm?: {
    configured: boolean;
    model: string | null;
  };
  knowledgeBase: {
    docsDbBytes: number;
    docsDbHuman: string;
    docsIndexed: boolean;
    knowledgeDbBytes: number;
    knowledgeDbHuman: string;
    shardCount: number;
    shardsTotalBytes: number;
    shardsTotalHuman: string;
  };
  toolchains: {
    blenderInstalled: boolean;
    godotInstalled: boolean;
    cmakeInstalled: boolean;
    kotlinInstalled: boolean;
    ghInstalled: boolean;
    ffmpegInstalled: boolean;
  };
  backupsCount: number;
  timestamp: string;
}

interface BackupRecord {
  filename: string;
  sizeBytes: number;
  sizeHuman: string;
  createdAt: string;
}

interface FolioDocsModalProps {
  isOpen: boolean;
  initialTab?: DocsTabId;
  onClose: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

export const FolioDocsModal: React.FC<FolioDocsModalProps> = ({
  isOpen,
  initialTab = 'docs',
  onClose,
  onSelectPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<DocsTabId>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackupFile, setRestoringBackupFile] = useState<string | null>(null);
  const [restoringLlm, setRestoringLlm] = useState(false);
  const [restoreLlmNotice, setRestoreLlmNotice] = useState<string | null>(null);
  const [backupLabel, setBackupLabel] = useState('manual');
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [datasetEngine, setDatasetEngine] = useState<'all' | EngineDatasetId>('all');
  const [trainingDatasets, setTrainingDatasets] = useState(false);
  const [trainNotice, setTrainNotice] = useState<string | null>(null);

  const fetchSystemData = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const [hRes, bRes] = await Promise.all([
        fetch('/api/system/health'),
        fetch('/api/system/backups'),
      ]);
      if (hRes.ok) {
        const hJson = (await hRes.json()) as SystemHealthResponse;
        setHealth(hJson);
      }
      if (bRes.ok) {
        const bJson = (await bRes.json()) as { ok: boolean; backups: BackupRecord[] };
        setBackups(bJson.backups || []);
      }
    } catch {
      // Ignore fetch errors silently in modal
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'health') {
      void fetchSystemData();
    }
  }, [isOpen, activeTab, fetchSystemData]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  };

  const handleCreateBackup = async () => {
    if (creatingBackup) return;
    setCreatingBackup(true);
    setBackupNotice(null);
    try {
      const res = await fetch('/api/system/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: backupLabel.trim() || 'manual' }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        backup?: BackupRecord;
        backups?: BackupRecord[];
        error?: string;
      };
      if (json.ok && json.backup) {
        setBackups(json.backups || []);
        setBackupNotice(`Created ${json.backup.filename} (${json.backup.sizeHuman})`);
        void fetchSystemData();
      } else {
        setBackupNotice(json.error || 'Backup creation failed.');
      }
    } catch {
      setBackupNotice('Failed to contact backup endpoint.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (restoringBackupFile) return;
    setRestoringBackupFile(filename);
    setBackupNotice(null);
    try {
      const res = await fetch('/api/system/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const json = (await res.json()) as { ok: boolean; restored?: string; error?: string };
      if (json.ok) {
        setBackupNotice(`Restored snapshot ${json.restored || filename} and refreshed docs index.`);
        void fetchSystemData();
      } else {
        setBackupNotice(json.error || 'Snapshot restore failed.');
      }
    } catch {
      setBackupNotice('Failed to contact backup restore endpoint.');
    } finally {
      setRestoringBackupFile(null);
    }
  };

  const handleRestoreLlm = async () => {
    if (restoringLlm) return;
    setRestoringLlm(true);
    setRestoreLlmNotice('Checking RAM & streaming missing Local LLM / Docs to disk...');
    try {
      const res = await fetch('/api/system/restore-llm', { method: 'POST' });
      const json = (await res.json()) as { ok: boolean; actions?: string[]; error?: string };
      if (json.ok) {
        setRestoreLlmNotice(`Ready: ${(json.actions || ['Verified']).join(' · ')}`);
        void fetchSystemData();
      } else {
        setRestoreLlmNotice(json.error || 'Failed to restore Local LLM.');
      }
    } catch {
      setRestoreLlmNotice('Failed to contact restore-llm endpoint.');
    } finally {
      setRestoringLlm(false);
    }
  };

  const handleTrainDatasets = async () => {
    if (trainingDatasets) return;
    setTrainingDatasets(true);
    setTrainNotice('Ingesting multi-engine datasets & Markov trigrams into SQLite knowledge.db + folio_docs.db...');
    try {
      const res = await fetch('/api/datasets/train', { method: 'POST' });
      const json = (await res.json()) as {
        ok: boolean;
        datasets?: number;
        parameters?: number;
        examples?: number;
        factsInserted?: number;
        trigramsTrained?: number;
        error?: string;
      };
      if (json.ok) {
        setTrainNotice(
          `Trained ${json.datasets ?? ENGINE_DATASETS.length} engines · ${json.parameters ?? 0} parameters · ${json.examples ?? 0} examples · ${json.trigramsTrained ?? 0} Markov trigrams`
        );
        void fetchSystemData();
      } else {
        setTrainNotice(json.error || 'Dataset training failed.');
      }
    } catch {
      setTrainNotice('Failed to contact /api/datasets/train.');
    } finally {
      setTrainingDatasets(false);
    }
  };

  const docsList = useMemo<FolioDocSection[]>(() => {
    if (searchQuery.trim()) {
      return searchFolioDocs(searchQuery, 12);
    }
    return FOLIO_DOCS_SECTIONS.filter(
      (s) => s.category === 'Overview' || s.category === 'Models' || s.category === 'Engines' || s.category === 'Operations'
    );
  }, [searchQuery]);

  const datasetsList = useMemo<EngineDataset[]>(() => {
    const engineFilter = datasetEngine === 'all' ? undefined : datasetEngine;
    if (searchQuery.trim()) {
      return searchEngineDatasets(searchQuery, engineFilter);
    }
    return engineFilter ? ENGINE_DATASETS.filter((d) => d.id === engineFilter) : ENGINE_DATASETS;
  }, [datasetEngine, searchQuery]);

  const cliSection = useMemo(
    () => FOLIO_DOCS_SECTIONS.find((s) => s.id === 'cli'),
    []
  );

  const sdkSections = useMemo(
    () => FOLIO_DOCS_SECTIONS.filter((s) => s.id === 'sdk-ts' || s.id === 'sdk-python'),
    []
  );

  if (!isOpen) return null;

  const tabs: Array<{ id: DocsTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'docs', label: 'Docs & Engines', icon: BookOpen },
    { id: 'datasets', label: 'Datasets', icon: Database },
    { id: 'cli', label: 'CLI', icon: Terminal },
    { id: 'sdk', label: 'TS & Python SDK', icon: Code2 },
    { id: 'changelog', label: 'Changelog', icon: History },
    { id: 'health', label: 'RAM & Backups', icon: Activity },
  ];

  const ramUsedPct =
    health && health.ram.totalRamMb > 0
      ? Math.min(100, Math.round((health.ram.usedRamMb / health.ram.totalRamMb) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Folio Documentation, CLI, SDK & System Health"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-[#16171a]/95 text-[#0d0d0d] dark:text-[#ececec] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 dark:bg-[#1a1b1f]/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-sky-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  Folio Docs, CLI & SDK Hub
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {FOLIO_CURRENT_VERSION}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                Authoritative engine schemas, official SDKs, disk-sharded KB, 4 GB RAM watchdog & snapshot backups.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close documentation modal"
            className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-white/10 hover:text-neutral-800 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs + Search */}
        <div className="px-5 py-3 border-b border-neutral-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#16171a]">
          <div className="flex items-center gap-1.5 overflow-x-auto chat-scroll py-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    selected
                      ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                      : 'bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {(activeTab === 'docs' || activeTab === 'datasets') && (
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'datasets' ? 'Filter examples & params...' : 'Search docs, ops, schemas...'}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 chat-scroll bg-neutral-100/50 dark:bg-[#121316]/50">
          {activeTab === 'docs' && (
            <div className="space-y-4">
              {docsList.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                        {sec.category}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold mt-1.5">{sec.title}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{sec.summary}</p>
                    </div>
                    {onSelectPrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPrompt(`Using Folio docs for "${sec.title}", build an interactive example.`);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors"
                      >
                        Try in Chat
                      </button>
                    )}
                  </div>

                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-black/30 rounded-xl p-3.5 border border-neutral-200/70 dark:border-white/10">
                    {sec.content}
                  </pre>

                  {sec.codeExample && (
                    <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-[#0f1116] text-neutral-100">
                      <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                        <span>{sec.codeExample.label}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`doc-${sec.id}`, sec.codeExample!.code)}
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                        >
                          {copiedId === `doc-${sec.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === `doc-${sec.id}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="p-3 text-[11.5px] font-mono overflow-x-auto">{sec.codeExample.code}</pre>
                    </div>
                  )}
                </div>
              ))}
              {docsList.length === 0 && (
                <div className="text-center py-12 text-xs text-neutral-500">
                  No documentation sections matched "{searchQuery}".
                </div>
              )}
            </div>
          )}

          {activeTab === 'datasets' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/25 bg-white dark:bg-[#1c1d22] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All Engines' },
                      { id: 'evo3d', label: 'EVO 3D' },
                      { id: 'threejs', label: 'Three.js' },
                      { id: 'stopmotion', label: 'Stop Motion' },
                      { id: 'pixelart', label: 'Pixel Art' },
                      { id: 'hybrid', label: 'Hybrid' },
                      { id: 'ik-math', label: 'IK & Math' },
                    ] as Array<{ id: 'all' | EngineDatasetId; label: string }>
                  ).map((item) => {
                    const selected = datasetEngine === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDatasetEngine(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => void handleTrainDatasets()}
                  disabled={trainingDatasets}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${trainingDatasets ? 'animate-spin' : ''}`} />
                  <span>{trainingDatasets ? 'Training Neo 4...' : 'Train Neo 4 on Engine Datasets'}</span>
                </button>
              </div>

              {trainNotice && (
                <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-700 dark:text-emerald-300">
                  {trainNotice}
                </div>
              )}

              {datasetsList.map((ds) => (
                <div
                  key={ds.id}
                  className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-4 sm:p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/25">
                          {ds.format}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold">{ds.engineName}</h3>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">{ds.summary}</p>
                    </div>
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200">
                    <strong>Design Rule:</strong> {ds.designRule}
                  </div>

                  {/* Calibrated Parameters Table */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                      Calibrated Parameters ({ds.parameters.length})
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-white/10">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-neutral-100/80 dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 font-mono">
                            <th className="py-2 px-3 border-b border-neutral-200/70 dark:border-white/10">Parameter</th>
                            <th className="py-2 px-3 border-b border-neutral-200/70 dark:border-white/10">Type</th>
                            <th className="py-2 px-3 border-b border-neutral-200/70 dark:border-white/10">Recommended</th>
                            <th className="py-2 px-3 border-b border-neutral-200/70 dark:border-white/10">Options / Range</th>
                            <th className="py-2 px-3 border-b border-neutral-200/70 dark:border-white/10">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ds.parameters.map((p) => (
                            <tr key={p.param} className="border-b last:border-b-0 border-neutral-200/50 dark:border-white/[0.06]">
                              <td className="py-2 px-3 font-mono font-semibold text-sky-700 dark:text-sky-300 whitespace-nowrap">{p.param}</td>
                              <td className="py-2 px-3 font-mono text-neutral-500 whitespace-nowrap">{p.type}</td>
                              <td className="py-2 px-3 font-mono text-emerald-700 dark:text-emerald-300">{p.recommendedValues}</td>
                              <td className="py-2 px-3 font-mono text-neutral-600 dark:text-neutral-400">{p.rangeOrOptions}</td>
                              <td className="py-2 px-3 text-neutral-600 dark:text-neutral-300">{p.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Curated Examples */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                      Curated Training Examples ({ds.examples.length})
                    </div>
                    {ds.examples.map((ex) => (
                      <div
                        key={ex.id}
                        className="rounded-xl border border-neutral-200/80 dark:border-white/10 bg-neutral-50/70 dark:bg-black/25 p-3.5 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold">{ex.title}</div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              Prompt: <span className="italic">"{ex.prompt}"</span>
                            </div>
                            <p className="text-[11.5px] text-neutral-600 dark:text-neutral-300 mt-1">{ex.description}</p>
                          </div>
                          {onSelectPrompt && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectPrompt(ex.prompt);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors shrink-0"
                            >
                              Try in Chat
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(ex.keyValues).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-white dark:bg-white/[0.06] border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300"
                            >
                              {k}: <strong>{String(v)}</strong>
                            </span>
                          ))}
                        </div>

                        <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-[#0f1116] text-neutral-100">
                          <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                            <span>{ex.language} · {ex.id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(`ds-${ex.id}`, ex.code)}
                              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                            >
                              {copiedId === `ds-${ex.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === `ds-${ex.id}` ? 'Copied' : 'Copy Spec'}</span>
                            </button>
                          </div>
                          <pre className="p-3 text-[11px] font-mono overflow-x-auto max-h-64">{ex.code}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {datasetsList.length === 0 && (
                <div className="text-center py-12 text-xs text-neutral-500">
                  No engine datasets matched "{searchQuery}".
                </div>
              )}
            </div>
          )}

          {activeTab === 'cli' && cliSection && (
            <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold">{cliSection.title}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{cliSection.summary}</p>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-black/30 rounded-xl p-4 border border-neutral-200/70 dark:border-white/10">
                {cliSection.content}
              </pre>
              {cliSection.codeExample && (
                <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-[#0f1116] text-neutral-100">
                  <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <span>{cliSection.codeExample.label}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('cli-quick', cliSection.codeExample!.code)}
                      className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                    >
                      {copiedId === 'cli-quick' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === 'cli-quick' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 text-xs font-mono overflow-x-auto">{cliSection.codeExample.code}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sdk' && (
            <div className="space-y-4">
              {sdkSections.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-5 space-y-3"
                >
                  <div>
                    <h3 className="text-base font-bold">{sec.title}</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{sec.summary}</p>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-black/30 rounded-xl p-3.5 border border-neutral-200/70 dark:border-white/10">
                    {sec.content}
                  </pre>
                  {sec.codeExample && (
                    <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-[#0f1116] text-neutral-100">
                      <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                        <span>{sec.codeExample.label}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`sdk-${sec.id}`, sec.codeExample!.code)}
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                        >
                          {copiedId === `sdk-${sec.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === `sdk-${sec.id}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="p-3 text-[11.5px] font-mono overflow-x-auto">{sec.codeExample.code}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'changelog' && (
            <div className="space-y-4">
              {FOLIO_CHANGELOGS.map((rel) => (
                <div
                  key={rel.version}
                  className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold">
                        {rel.version} — {rel.codename}
                      </h3>
                      {rel.version === FOLIO_CURRENT_VERSION && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-neutral-500">{rel.date}</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">{rel.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    {rel.highlights.map((h) => (
                      <div
                        key={h.title}
                        className="p-3 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-neutral-50 dark:bg-black/25 space-y-1"
                      >
                        <div className="text-[10px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          {h.category}
                        </div>
                        <div className="text-xs font-semibold">{h.title}</div>
                        <p className="text-[11.5px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          {h.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Live 4 GB RAM watchdog, disk-backed Knowledge DB telemetry, and clean `.tar.gz` snapshots.
                </div>
                <button
                  type="button"
                  onClick={() => void fetchSystemData()}
                  disabled={loadingHealth}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {health && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* RAM Watchdog */}
                  <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                        <Cpu className="w-4 h-4 text-sky-500" />
                        RAM Watchdog
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          health.ram.status === 'healthy'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : health.ram.status === 'tight'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                        }`}
                      >
                        {health.ram.status}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span>{health.ram.freeRamMb} MB free</span>
                        <span className="text-neutral-500">{health.ram.totalRamMb} MB total</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            health.ram.status === 'healthy'
                              ? 'bg-emerald-500'
                              : health.ram.status === 'tight'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${ramUsedPct}%` }}
                        />
                      </div>
                      <div className="text-[11px] font-mono text-neutral-500">
                        Node RSS: {health.ram.rssMb} MB · Swap: {health.ram.swapTotalMb} MB
                      </div>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-neutral-200/70 dark:border-white/10 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span>Heavy Tools (&gt;=450MB)</span>
                        <span className={health.thresholds.canRunHeavyTools ? 'text-emerald-500' : 'text-red-500'}>
                          {health.thresholds.canRunHeavyTools ? 'READY' : 'GUARDED'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Blender (&gt;=650MB)</span>
                        <span className={health.thresholds.canRunBlender ? 'text-emerald-500' : 'text-amber-500'}>
                          {health.thresholds.canRunBlender ? 'SAFE' : 'FALLBACK ONLY'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tiny Local LLM (&gt;={health.thresholds.tinyLlmMinFreeMb}MB)</span>
                        <span className={health.thresholds.canRunTinyLlm ? 'text-emerald-500' : 'text-amber-500'}>
                          {health.tinyLocalLlm?.installed
                            ? health.thresholds.canRunTinyLlm
                              ? 'READY (0MB IDLE)'
                              : 'RAM GUARDED'
                            : 'NOT INSTALLED'}
                        </span>
                      </div>
                      {health.tinyLocalLlm?.installed && (
                        <div className="text-[10.5px] text-neutral-500 truncate pt-0.5">
                          Active: {health.tinyLocalLlm.modelName} ({health.tinyLocalLlm.modelSizeHuman})
                        </div>
                      )}
                      {health.tinyLocalLlm?.availableModels && health.tinyLocalLlm.availableModels.length > 1 && (
                        <div className="text-[10px] text-neutral-500 truncate">
                          Tiers: {health.tinyLocalLlm.availableModels.map((m) => m.name.replace('qwen2.5-', '').replace('-instruct-q4_k_m.gguf', '')).join(' · ')}
                        </div>
                      )}
                      <div className="flex justify-between pt-0.5">
                        <span>Remote Huge-RAM Bridge</span>
                        <span className={health.remoteLlm?.configured ? 'text-emerald-500' : 'text-neutral-500'}>
                          {health.remoteLlm?.configured ? `ON (${health.remoteLlm.model})` : 'ENV STANDBY'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 leading-snug pt-0.5">
                        4,096 MB host cap (0 swap). Offload large models with 0 MB local RAM via{' '}
                        <code>FOLIO_REMOTE_LLM_URL</code> or cloud models.
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-200/70 dark:border-white/10 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => void handleRestoreLlm()}
                        disabled={restoringLlm}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-bold transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${restoringLlm ? 'animate-spin' : ''}`} />
                        <span>{restoringLlm ? 'Restoring Local LLM & Docs...' : 'Restore Local LLM & Docs'}</span>
                      </button>
                      {restoreLlmNotice && (
                        <div className="text-[10.5px] font-mono text-sky-700 dark:text-sky-300 leading-snug">
                          {restoreLlmNotice}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Disk & Sharded KB */}
                  <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Database className="w-4 h-4 text-violet-500" />
                      <span>Disk &amp; Sharded Knowledge DB</span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Disk Free</span>
                        <span>{health.disk.freeGb} GB / {health.disk.totalGb} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">folio_docs.db</span>
                        <span className={health.knowledgeBase.docsIndexed ? 'text-emerald-500' : 'text-amber-500'}>
                          {health.knowledgeBase.docsDbHuman}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">knowledge.db</span>
                        <span>{health.knowledgeBase.knowledgeDbHuman}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Disk Shards</span>
                        <span>
                          {health.knowledgeBase.shardCount} ({health.knowledgeBase.shardsTotalHuman})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Toolchains & Blender Fallback */}
                  <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <HardDrive className="w-4 h-4 text-emerald-500" />
                      <span>Toolchains &amp; Fallbacks</span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Blender CLI</span>
                        <span className={health.toolchains.blenderInstalled ? 'text-emerald-500' : 'text-sky-500'}>
                          {health.toolchains.blenderInstalled ? 'INSTALLED' : 'OBJ FALLBACK'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Godot 4.3</span>
                        <span>{health.toolchains.godotInstalled ? 'READY' : 'NOT INSTALLED'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">CMake / Kotlin</span>
                        <span>
                          {health.toolchains.cmakeInstalled ? 'CMake' : '—'} / {health.toolchains.kotlinInstalled ? 'Kotlin' : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">FFmpeg / gh CLI</span>
                        <span>
                          {health.toolchains.ffmpegInstalled ? 'FFmpeg' : '—'} / {health.toolchains.ghInstalled ? 'gh' : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Remote Huge-RAM LLM Bridge Explanation & Env Guide */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] dark:bg-sky-500/[0.08] p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#0d0d0d] dark:text-white">
                      <Cpu className="w-4 h-4 text-sky-500" />
                      <span>Where is the Remote Huge-RAM LLM Bridge?</span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                      The Remote Bridge runs inside <code className="font-mono">python/neo4_engine.py</code> (<code>_try_remote_llm</code>). Because this host is capped at 4,096 MB RAM with 0 swap, setting <code>FOLIO_REMOTE_LLM_URL</code> in your server environment automatically offloads Neo 4 Neural LLM inference to any OpenAI-compatible or Ollama server (local tunnel, GPU box, OpenRouter, Together, or Fireworks) using <strong>0 MB local RAM</strong>.
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border shrink-0 ${
                      health?.remoteLlm?.configured
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-neutral-200/70 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 border-neutral-300 dark:border-white/15'
                    }`}
                  >
                    {health?.remoteLlm?.configured
                      ? `ACTIVE · ${health.remoteLlm.model}`
                      : 'ENV STANDBY · Local Qwen2.5 Active'}
                  </span>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-[#0f1116] text-neutral-100">
                  <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <span>Server .env variables (0 MB local RAM)</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          'remote-env',
                          'FOLIO_REMOTE_LLM_URL=https://your-gpu-or-ollama-host/v1/chat/completions\nFOLIO_REMOTE_LLM_MODEL=qwen2.5:32b'
                        )
                      }
                      className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                    >
                      {copiedId === 'remote-env' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === 'remote-env' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 text-[11.5px] font-mono overflow-x-auto">{`FOLIO_REMOTE_LLM_URL=https://your-gpu-or-ollama-host/v1/chat/completions
FOLIO_REMOTE_LLM_MODEL=qwen2.5:32b`}</pre>
                </div>
              </div>

              {/* Where to Move Folio for Huge RAM & Real Storage-to-RAM Swap */}
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.06] dark:bg-violet-500/[0.08] p-4 sm:p-5 space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0d0d0d] dark:text-white">
                    <HardDrive className="w-4 h-4 text-violet-500" />
                    <span>Where to Move Folio for Huge RAM &amp; Real Storage-to-RAM Swap</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                    This preview sandbox runs in an unprivileged container overlay capped at <strong>4,096 MB RAM</strong> with{' '}
                    <strong>0 MB swap</strong> (Linux <code>swapon</code> is blocked by container capabilities, and any OOM reboot wipes untracked{' '}
                    <code>.folio-data</code> binaries). Move Folio using the included <code>Dockerfile</code> to unlock huge RAM and persistent swap:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] font-mono">
                  <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#0f1116] text-neutral-100 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-violet-300 font-bold">
                      <span>1. Google Cloud Run (8–32 GiB)</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            'move-cloudrun',
                            'gcloud auth login && gcloud config set project YOUR_PROJECT_ID && gcloud run deploy folio --source . --region us-central1 --allow-unauthenticated --memory 8Gi --cpu 4 --port 3000 --set-env-vars GEMINI_API_KEY=YOUR_KEY'
                          )
                        }
                        className="text-sky-400 hover:text-sky-300"
                      >
                        {copiedId === 'move-cloudrun' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[10.5px] text-neutral-400 font-sans">
                      Uses included Dockerfile — zero swap setup, up to 32 GiB RAM.
                    </p>
                    <pre className="text-[10px] overflow-x-auto text-neutral-200">{`gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud run deploy folio --source . \\
  --region us-central1 --allow-unauthenticated \\
  --memory 8Gi --cpu 4 --port 3000 \\
  --set-env-vars GEMINI_API_KEY=YOUR_KEY`}</pre>
                  </div>

                  <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#0f1116] text-neutral-100 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-emerald-300 font-bold">
                      <span>2. Linux VPS + 16GB Swap</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            'move-vps-swap',
                            'fallocate -l 16G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile'
                          )
                        }
                        className="text-sky-400 hover:text-sky-300"
                      >
                        {copiedId === 'move-vps-swap' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[10.5px] text-neutral-400 font-sans">
                      Turns fast NVMe SSD storage into real OS swap.
                    </p>
                    <pre className="text-[10px] overflow-x-auto text-neutral-200">{`fallocate -l 16G /swapfile
chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile`}</pre>
                  </div>

                  <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#0f1116] text-neutral-100 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-amber-300 font-bold">
                      <span>3. Railway / Fly.io</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy('move-docker', 'docker build -t folio . && docker run -p 3000:3000 -v folio_data:/app/.folio-data folio')
                        }
                        className="text-sky-400 hover:text-sky-300"
                      >
                        {copiedId === 'move-docker' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[10.5px] text-neutral-400 font-sans">
                      Mount persistent volume at /app/.folio-data.
                    </p>
                    <pre className="text-[10px] overflow-x-auto text-neutral-200">{`docker build -t folio .
docker run -p 3000:3000 \\
  -v folio_data:/app/.folio-data folio`}</pre>
                  </div>
                </div>
              </div>

              {/* Clean Snapshot Backups */}
              <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1d22] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Archive className="w-4 h-4 text-amber-500" />
                      <span>Clean Snapshot Backups (.tar.gz)</span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Excludes node_modules, dist, .git, and .folio-data so clean recovery snapshots stay ~3 MB.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={backupLabel}
                      onChange={(e) => setBackupLabel(e.target.value)}
                      placeholder="Snapshot label"
                      className="w-32 px-2.5 py-1.5 rounded-xl text-xs bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreateBackup()}
                      disabled={creatingBackup}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{creatingBackup ? 'Creating...' : 'Create Clean Backup'}</span>
                    </button>
                  </div>
                </div>

                {backupNotice && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-700 dark:text-emerald-300">
                    {backupNotice}
                  </div>
                )}

                <div className="space-y-1.5">
                  {backups.map((b) => (
                    <div
                      key={b.filename}
                      className="px-3 py-2 rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-50 dark:bg-black/25 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                    >
                      <span className="font-semibold truncate">{b.filename}</span>
                      <div className="flex items-center gap-3 text-neutral-500">
                        <span>{b.sizeHuman}</span>
                        <span>{b.createdAt.slice(0, 19).replace('T', ' ')} UTC</span>
                        <button
                          type="button"
                          onClick={() => void handleRestoreBackup(b.filename)}
                          disabled={restoringBackupFile !== null}
                          className="px-2 py-0.5 rounded-lg bg-neutral-200/80 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-[#0d0d0d] dark:text-white font-semibold disabled:opacity-50"
                        >
                          {restoringBackupFile === b.filename ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {backups.length === 0 && (
                    <div className="text-xs text-neutral-500 py-3">
                      {loadingHealth ? 'Loading backup snapshots...' : 'No snapshots found yet.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-neutral-200/80 dark:border-white/10 bg-neutral-50/90 dark:bg-[#1a1b1f]/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{FOLIO_CURRENT_VERSION} · Docs, CLI, TS/Python SDK, Disk KB &amp; RAM Watchdog</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
