import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Binary,
  Box,
  Check,
  Code2,
  Copy,
  Cpu,
  Flame,
  Gamepad2,
  Layers,
  RefreshCw,
  Rotate3d,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  X,
} from 'lucide-react';
import { ChangelogEntry, FOLIO_CHANGELOGS, FOLIO_CURRENT_VERSION } from '../data/changelogs';
import { InlineEvoViewer } from './InlineEvoViewer';

function buildReleaseEvoSpec(version: string): string {
  const isZero = version.includes('4.1');
  const isOxygen = version.includes('4.0');
  const title = isZero
    ? 'Folio Zero v4.1 · EVO 3D Engine Core'
    : isOxygen
    ? 'Folio v4.0 · EVO Hybrid Core'
    : `${version} · EVO Spatial Preview`;
  const gradColors = isZero
    ? ['#38bdf8', '#8b5cf6', '#ec4899', '#facc15']
    : isOxygen
    ? ['#06b6d4', '#3b82f6', '#a855f7']
    : ['#10b981', '#38bdf8', '#f59e0b'];

  return JSON.stringify({
    format: 'evo/v1',
    title,
    fps: 30,
    durationSec: 6,
    background: '#090d16',
    nodes: [
      {
        id: 'wave_field',
        type: 'surface',
        graph: {
          expr: isZero
            ? '0.42 * sin(r * 2.4 - t * TAU) * exp(-r * 0.14)'
            : '0.35 * cos(x * 1.4) * sin(z * 1.4)',
          xmin: -3.2,
          xmax: 3.2,
          samples: 28,
        },
        material: {
          color: '#ffffff',
          gradient: { colors: gradColors, axis: 'radial' },
          metalness: 0.55,
          roughness: 0.25,
          opacity: 0.92,
        },
        motion: {
          y: '-0.85',
          ry: 't * 36',
        },
      },
      {
        id: 'harmonic_curve',
        type: 'graph',
        graph: {
          xExpr: '2.2 * cos(u * TAU)',
          yExpr: '0.75 + 0.42 * sin(u * TAU * 3)',
          zExpr: '2.2 * sin(u * TAU)',
          samples: 96,
          tubeRadius: 0.06,
        },
        material: {
          color: '#ffffff',
          gradient: { colors: gradColors, axis: 'x' },
          metalness: 0.75,
          roughness: 0.18,
          emissive: gradColors[0],
          emissiveIntensity: 0.35,
        },
        motion: {
          ry: 't * -90',
        },
      },
      {
        id: 'core_gem',
        type: isZero ? 'icosahedron' : 'torusKnot',
        size: isZero ? 0.9 : 0.72,
        material: {
          color: '#ffffff',
          gradient: { colors: gradColors, axis: 'y' },
          metalness: 0.85,
          roughness: 0.15,
        },
        motion: {
          y: '0.55 + sin(t * TAU * 2) * 0.16',
          ry: 't * 180',
          rx: 'sin(t * TAU) * 18',
        },
      },
    ],
    storyboard: {
      shots: [
        {
          name: 'Orbital Overview',
          start: 0,
          end: 0.55,
          position: [4.6, 2.8, 5.2],
          target: [0, 0.1, 0],
          fov: 45,
        },
        {
          name: 'Wave Surface Sweep',
          start: 0.55,
          end: 1.0,
          position: [-4.2, 2.2, 4.8],
          target: [0, 0.15, 0],
          fov: 42,
        },
      ],
    },
    audio: { mode: 'preset', preset: 'ambient_chime' },
  });
}

interface ChangelogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

interface HighlightCardMeta {
  badge?: string;
  chips?: string[];
  specs?: Array<{ label: string; value: string }>;
  quickAction?: {
    type: 'prompt' | 'cmd';
    content: string;
    label: string;
  };
  colSpan?: string;
  accent: 'violet' | 'sky' | 'emerald' | 'amber';
}

function getHighlightMeta(title: string, category: string, index: number, version: string): HighlightCardMeta {
  if (version.includes('4.1')) {
    if (title.toLowerCase().includes('neo 4')) {
      return {
        badge: 'Order-3 Markov + CoT Rater',
        chips: ['Lego Subwords', '±4 Context Semantics', 'OSASCOMP Grammar', 'AST Math Solver'],
        specs: [
          { label: 'Engine Core', value: 'python/neo4_engine.py' },
          { label: 'Context Radius', value: '±4 tokens semantic sense' },
          { label: 'Thinking Modes', value: 'Minimal · Low · Med · High · Deep' },
          { label: 'Auditor', value: 'Shannon Entropy H + TTR + Bigram' },
        ],
        quickAction: {
          type: 'prompt',
          content: 'Hi Neo 4, introduce yourself and solve (24 * 6) + sqrt(625).',
          label: 'Test Neo 4 Prompt',
        },
        colSpan: 'md:col-span-2',
        accent: 'violet',
      };
    }
    if (title.toLowerCase().includes('godot')) {
      return {
        badge: 'Godot 4.3 CLI + 6 Presets',
        chips: ['Linux/X11', 'Windows Desktop', 'macOS', 'Web Wasm', 'Android', 'iOS'],
        specs: [
          { label: 'Binary Path', value: '/usr/local/bin/godot4' },
          { label: 'SDK Templates', value: '/opt/folio-toolchains/godot/' },
          { label: 'Preset Config', value: 'sdk/export_presets.template.cfg' },
          { label: 'Headless Mode', value: '--headless --version' },
        ],
        quickAction: {
          type: 'cmd',
          content: 'godot4 --headless --version',
          label: 'Run Godot Check',
        },
        colSpan: 'md:col-span-1',
        accent: 'sky',
      };
    }
    if (title.toLowerCase().includes('mod creation') || title.toLowerCase().includes('reverse')) {
      return {
        badge: 'Isolated Workspace Modding',
        chips: ['CLI & Mod Loader', 'SQLite DB Registry', 'EVO 3D Model', 'Pixel v3 Texture', 'CI/CD Pipeline'],
        specs: [
          { label: 'Scaffolder Tool', value: 'mod_scaffold' },
          { label: 'Inspector Tool', value: 'reverse_engineer' },
          { label: 'Binary Formats', value: '.glb · .pck · .apk · .zip · .png · ELF' },
          { label: 'Fallback Runner', value: 'workspaces/ (Zero OOM)' },
        ],
        quickAction: {
          type: 'prompt',
          content: 'Scaffold an ObsidianReactor mod with SQLite registry, EVO 3D asset, and CI/CD workflow.',
          label: 'Scaffold Mod Project',
        },
        colSpan: 'md:col-span-1',
        accent: 'emerald',
      };
    }
    if (title.toLowerCase().includes('live logs') || title.toLowerCase().includes('bluxli')) {
      return {
        badge: 'Log | Warn | Error | Success',
        chips: ['@bluxli.me Bypass', 'External Email Verification', 'Real-Time Logger', 'Firestore Hardened Rules'],
        specs: [
          { label: 'Domain Rule', value: '@bluxli.me -> instant password-only pass' },
          { label: 'Other Domains', value: 'Gmail/Yahoo -> email verification enforced' },
          { label: 'Telemetry Tab', value: 'Live Logs in Preview Drawer' },
          { label: 'ESLint Rules', value: '@firebase/eslint-plugin-security-rules' },
        ],
        quickAction: {
          type: 'prompt',
          content: 'Open Studio Event Diagnostics and filter by Error or Success.',
          label: 'Inspect Diagnostics',
        },
        colSpan: 'md:col-span-2',
        accent: 'amber',
      };
    }
  }

  // Fallback for v4.0 OXYGEN and older releases
  if (category === 'Engines') {
    return {
      badge: 'Creative Engine',
      chips: ['60fps Engine', 'WebM VP9 Baking', 'PBR Depth Layers'],
      specs: [
        { label: 'Max Duration', value: '216,000 frames (60-min clip stitching)' },
        { label: 'Resolution', value: 'Up to 512×512 canvas' },
      ],
      colSpan: index === 0 ? 'md:col-span-2' : 'md:col-span-1',
      accent: 'sky',
    };
  }
  if (category === 'Models & Chat') {
    return {
      badge: 'Reasoning Router',
      chips: ['Hydrogen 4', 'Neon 4 Pro', 'Carbon 4 Deep', 'Nano Banana'],
      specs: [
        { label: 'Routing', value: 'Prompt-aware Auto Router' },
        { label: 'Multi-Turn', value: 'Tri-Model Autonomous continuation' },
      ],
      colSpan: 'md:col-span-1',
      accent: 'violet',
    };
  }
  if (category === 'Studio & Audio') {
    return {
      badge: 'Synthesis & Preview',
      chips: ['Waveform Synth', 'Domain Sim', 'Blender CLI'],
      specs: [
        { label: 'Audio Engine', value: 'WebAudio math-driven formula synthesis' },
        { label: 'Online Sandboxes', value: '/sandbox/:id live server previews' },
      ],
      colSpan: 'md:col-span-1',
      accent: 'emerald',
    };
  }

  return {
    badge: 'UX Polish',
    chips: ['ChatGPT Theme', 'Clamped CellMenu', 'Squircle Morph'],
    specs: [{ label: 'Interface', value: 'Full Light/Dark mode parity' }],
    colSpan: 'md:col-span-1',
    accent: 'amber',
  };
}

const ACCENT_STYLES = {
  violet: {
    border: 'border-violet-500/30 hover:border-violet-500/60 dark:border-violet-500/25 dark:hover:border-violet-400/50',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25',
    glow: 'rgba(139, 92, 246, 0.15)',
    icon: Cpu,
  },
  sky: {
    border: 'border-sky-500/30 hover:border-sky-500/60 dark:border-sky-500/25 dark:hover:border-sky-400/50',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25',
    glow: 'rgba(56, 189, 248, 0.15)',
    icon: Gamepad2,
  },
  emerald: {
    border: 'border-emerald-500/30 hover:border-emerald-500/60 dark:border-emerald-500/25 dark:hover:border-emerald-400/50',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    glow: 'rgba(16, 185, 129, 0.15)',
    icon: Box,
  },
  amber: {
    border: 'border-amber-500/30 hover:border-amber-500/60 dark:border-amber-500/25 dark:hover:border-amber-400/50',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
    glow: 'rgba(245, 158, 11, 0.15)',
    icon: Terminal,
  },
};

interface Bento3DFlashCardProps {
  item: ChangelogEntry['highlights'][number];
  index: number;
  version: string;
  forceFlipped?: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

const Bento3DFlashCard: React.FC<Bento3DFlashCardProps> = ({
  item,
  index,
  version,
  forceFlipped = false,
  onSelectPrompt,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const effectiveFlipped = forceFlipped || isFlipped;
  const meta = useMemo(() => getHighlightMeta(item.title, item.category, index, version), [item, index, version]);
  const accent = ACCENT_STYLES[meta.accent];
  const CategoryIcon = accent.icon;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || effectiveFlipped) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotX = (0.5 - py) * 14;
    const rotY = (px - 0.5) * 14;
    setTilt({
      x: rotX,
      y: rotY,
      glareX: px * 100,
      glareY: py * 100,
    });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 });
    setIsHovered(false);
  };

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative perspective-1000 min-h-[260px] cursor-pointer select-none ${meta.colSpan || 'md:col-span-1'}`}
      onClick={() => setIsFlipped((prev) => !prev)}
      title="Click card to flip between Feature Overview and 3D Technical Specs"
    >
      <div
        className={`w-full h-full transform-style-3d transition-transform duration-500 ease-out rounded-2xl ${
          effectiveFlipped ? 'rotate-y-180' : ''
        }`}
        style={{
          transform: effectiveFlipped
            ? 'rotateY(180deg)'
            : isHovered
            ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.015, 1.015, 1.015)`
            : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        }}
      >
        {/* ================= FRONT FACE ================= */}
        <div
          className={`absolute inset-0 backface-hidden rounded-2xl border p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-lg transition-all duration-300 bg-white/95 dark:bg-[#1a1b1f]/95 backdrop-blur-md ${accent.border}`}
          style={{
            boxShadow: isHovered ? `0 12px 30px -10px ${accent.glow}` : undefined,
          }}
        >
          {/* Specular glare following mouse */}
          {isHovered && !effectiveFlipped && (
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-40 transition-opacity"
              style={{
                background: `radial-gradient(circle 260px at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.25), transparent 80%)`,
              }}
            />
          )}

          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${accent.badge}`}>
                  <CategoryIcon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
                  {item.category}
                </span>
              </div>

              {meta.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border shrink-0 ${accent.badge}`}>
                  {meta.badge}
                </span>
              )}
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#0d0d0d] dark:text-white leading-snug">
                {item.title}
              </h3>
              <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {item.detail}
              </p>
            </div>

            {meta.chips && meta.chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {meta.chips.map((chip, cIdx) => (
                  <span
                    key={cIdx}
                    className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-white/10"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-white/10 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 relative z-10">
            <span className="inline-flex items-center gap-1.5 group-hover:text-[#0d0d0d] dark:group-hover:text-white transition-colors">
              <Rotate3d className="w-3.5 h-3.5 text-sky-500" />
              <span>Tap to flip for 3D technical specs</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10">
              Front
            </span>
          </div>
        </div>

        {/* ================= BACK FACE (3D FLASH CARD SPECS) ================= */}
        <div
          className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-2xl bg-[#0f1013] text-[#ececec] border-sky-500/40`}
          style={{
            boxShadow: `0 14px 34px -8px ${accent.glow}`,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Binary className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider font-mono">
                  Technical Architecture
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Flash Card Back
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-white truncate">{item.title}</div>
              {meta.specs && (
                <div className="grid grid-cols-1 gap-1.5 pt-1 text-[11px]">
                  {meta.specs.map((spec, sIdx) => (
                    <div
                      key={sIdx}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-between gap-2"
                    >
                      <span className="text-neutral-400 font-mono text-[10px]">{spec.label}</span>
                      <span className="font-mono text-neutral-200 truncate">{spec.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {meta.quickAction && (
              <div className="pt-1">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span>{meta.quickAction.label}:</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, meta.quickAction!.content)}
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-black/60 border border-white/10 font-mono text-[10.5px] text-sky-300 truncate">
                  {meta.quickAction.content}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(false);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors"
            >
              <Rotate3d className="w-3.5 h-3.5" />
              <span>Flip back ↶</span>
            </button>

            {meta.quickAction && onSelectPrompt && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPrompt(meta.quickAction!.content);
                }}
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-xs font-semibold"
              >
                <span>Use in chat</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChangelogsModal: React.FC<ChangelogsModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [activeVersion, setActiveVersion] = useState<string>(FOLIO_CHANGELOGS[0]?.version || 'v4.1 · Folio Zero');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [flipAll, setFlipAll] = useState(false);
  const [showEvoEngine, setShowEvoEngine] = useState(true);

  const releaseEvoCode = useMemo(() => buildReleaseEvoSpec(activeVersion), [activeVersion]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const activeRelease = useMemo(() => {
    return (
      FOLIO_CHANGELOGS.find((r) => r.version === activeVersion) ||
      FOLIO_CHANGELOGS[0]
    );
  }, [activeVersion]);

  const filteredHighlights = useMemo(() => {
    if (!activeRelease) return [];
    return activeRelease.highlights.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [activeRelease, activeCategory, searchQuery]);

  const categories = ['all', 'Models & Chat', 'Engines', 'Studio & Audio', 'Fixes & Polish'];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Folio Release Changelogs Bento Grid"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-[#16171a]/95 text-[#0d0d0d] dark:text-[#ececec] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] folio-oxygen-entrance"
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="px-5 py-4 border-b border-neutral-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 dark:bg-[#1a1b1f]/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  Folio Release Changelogs
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {FOLIO_CURRENT_VERSION}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                  3D Bento Grid
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                Interactive 3D flash cards for engines, compilers, Python Neo 4, and studio capabilities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowEvoEngine((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                showEvoEngine
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25'
                  : 'bg-white dark:bg-[#25262b] text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-[#2f3036]'
              }`}
              title="Toggle live EVO 3D Engine interactive release preview"
            >
              <Box className="w-4 h-4" />
              <span>EVO 3D Stage</span>
            </button>

            {/* 3D Flip All Toggle */}
            <button
              type="button"
              onClick={() => setFlipAll((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                flipAll
                  ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/25'
                  : 'bg-white dark:bg-[#25262b] text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-[#2f3036]'
              }`}
              title="Flip all cards between Overview and 3D Technical Specs"
            >
              <Rotate3d className={`w-4 h-4 ${flipAll ? 'animate-spin' : ''}`} />
              <span>{flipAll ? 'Show Overview' : '3D Flip All Cards'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close changelogs"
              className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-white/10 hover:text-neutral-800 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= VERSION SELECTOR RAIL & FILTERS ================= */}
        <div className="px-5 py-3 border-b border-neutral-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#16171a]">
          {/* Version Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto chat-scroll py-1">
            {FOLIO_CHANGELOGS.map((rel) => {
              const isActive = rel.version === activeVersion;
              const isCurrent = rel.version === FOLIO_CURRENT_VERSION;
              return (
                <button
                  key={rel.version}
                  type="button"
                  onClick={() => {
                    setActiveVersion(rel.version);
                    setFlipAll(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] shadow-sm'
                      : 'bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                  }`}
                >
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                  <span>{rel.version}</span>
                  {isCurrent && (
                    <span className="text-[10px] font-mono px-1.5 rounded bg-white/20 dark:bg-black/20 font-bold uppercase">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search specs..."
                className="w-full pl-8 pr-3 py-1 rounded-xl text-xs bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/10 text-[#0d0d0d] dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* ================= CATEGORY FILTER CHIPS ================= */}
        <div className="px-5 py-2 border-b border-neutral-200/50 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto chat-scroll text-xs">
          <span className="text-neutral-400 text-[11px] font-mono mr-1">Filter:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {cat === 'all' ? 'All Highlights' : cat}
            </button>
          ))}
        </div>

        {/* ================= SCROLLABLE BENTO GRID CONTENT ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 chat-scroll bg-neutral-100/50 dark:bg-[#121316]/50">
          {/* Active Release Hero Banner */}
          {activeRelease && (
            <div className="p-4 sm:p-5 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent relative overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-bold text-[#0d0d0d] dark:text-white">
                    {activeRelease.version} — {activeRelease.codename}
                  </h3>
                  {activeRelease.version === FOLIO_CURRENT_VERSION && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                      CURRENT ENGINE
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {activeRelease.date}
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed max-w-4xl">
                {activeRelease.summary}
              </p>
            </div>
          )}

          {/* Live Interactive EVO 3D Engine Release Showcase */}
          {showEvoEngine && (
            <div className="rounded-2xl border border-indigo-500/30 bg-[#090d16] p-3 shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2 px-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>EVO Engine · Interactive 3D Release Visualizer</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Gradient + 3D Wave Graph
                  </span>
                </div>
                <span className="text-[10px] font-mono text-neutral-400">
                  Drag to orbit · Scroll to zoom
                </span>
              </div>
              <InlineEvoViewer key={activeVersion} code={releaseEvoCode} compact />
            </div>
          )}

          {/* 3D Bento Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHighlights.map((item, idx) => (
              <Bento3DFlashCard
                key={item.title}
                item={item}
                index={idx}
                version={activeRelease.version}
                forceFlipped={flipAll}
                onSelectPrompt={(prompt) => {
                  if (onSelectPrompt) onSelectPrompt(prompt);
                  onClose();
                }}
              />
            ))}
          </div>

          {filteredHighlights.length === 0 && (
            <div className="h-44 flex flex-col items-center justify-center text-neutral-400 space-y-2">
              <Rotate3d className="w-8 h-8 opacity-40 animate-spin" />
              <p className="text-xs font-mono">No highlights match your search filter.</p>
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="px-5 py-3.5 border-t border-neutral-200/80 dark:border-white/10 bg-neutral-50/90 dark:bg-[#1a1b1f]/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 font-mono text-[11px] truncate">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">Active Runtime:</span>
            <span className="text-[#0d0d0d] dark:text-white font-semibold">{FOLIO_CURRENT_VERSION}</span>
            <span>·</span>
            <span>RAM Watchdog</span>
            <span>·</span>
            <span>Disk KB</span>
            <span>·</span>
            <span>SDK / CLI</span>
            <span>·</span>
            <span>Neo 4</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
