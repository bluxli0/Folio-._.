import {
  ModelOption,
  RetentionMode,
  SafetyCategoryKey,
  SafetyFiltersConfig,
  SafetyLevel,
  StarterPrompt,
  SystemPreset,
  TextAnimationPreset,
  TriModelConfig,
} from '../types/chat';

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'auto',
    name: 'Auto Router (Smart)',
    shortName: 'Auto',
    description: 'Automatically selects the optimal reasoning, creative, or image model per prompt with live fallback',
    apiModel: 'auto',
    speedLabel: 'Adaptive',
  },
  {
    id: 'flash-lite-3.1',
    name: 'Flash Lite 3.1',
    shortName: 'Flash Lite',
    description: 'Fastest responses for everyday chat and quick drafts',
    apiModel: 'gemini-3.1-flash-lite',
    speedLabel: 'Ultra Fast',
  },
  {
    id: 'hydrogen-4-fast',
    name: 'Hydrogen 4 Fast',
    shortName: 'Hydrogen Fast',
    description: 'Quick reasoning and coding with low latency',
    apiModel: 'gemini-4-hydrogen',
    speedLabel: 'Fast',
  },
  {
    id: 'hydrogen-4-balanced',
    name: 'Hydrogen 4 Balanced',
    shortName: 'Hydrogen 4',
    description: 'Stronger analytical depth for technical tasks',
    apiModel: 'gemini-4-hydrogen',
    speedLabel: 'Balanced',
  },
  {
    id: 'hydrogen-4-deep',
    name: 'Hydrogen 4 Deep',
    shortName: 'Hydrogen Deep',
    description: 'Extended multi-step thinking for complex problems',
    apiModel: 'gemini-4-hydrogen',
    speedLabel: 'Deep',
  },
  {
    id: 'neon-4',
    name: 'Neon 4 (Pro Creative)',
    shortName: 'Neon 4',
    description: 'Maximum creative synthesis, v3 shaders, 3D choreography & deep architecture',
    apiModel: 'gemini-4-neon',
    speedLabel: 'Pro Deep',
    isPaid: true,
  },
  {
    id: 'carbon-4',
    name: 'Carbon 4 (Precision)',
    shortName: 'Carbon 4',
    description: 'High-efficiency frontier coding, math & structured production pipelines',
    apiModel: 'gemini-4-carbon',
    speedLabel: 'Precision',
    isPaid: true,
  },
  {
    id: 'neo-4',
    name: 'Neo 4 (Python Rule AI)',
    shortName: 'Neo 4',
    description: 'Experimental Python rule-based engine: subword Lego bricks, ±k semantic disambiguator, OSASCOMP-rated Markov Chain & AST math/physics solver',
    apiModel: 'neo-4-python',
    speedLabel: 'Local Py',
    isLocalPython: true,
  },
  {
    id: 'nano-banana-lite',
    name: 'Nano Banana Lite (Image)',
    shortName: 'Nano Banana',
    description: 'Fast direct image synthesis & style reference rendering via gemini-3.1-flash-lite-image',
    apiModel: 'gemini-3.1-flash-lite-image',
    speedLabel: 'Image Gen',
    isPaid: true,
    isImageOnly: true,
  },
];

export const THINKING_MODE_OPTIONS: Array<{
  id: 'minimal' | 'low' | 'medium' | 'high' | 'deep';
  label: string;
  description: string;
}> = [
  { id: 'minimal', label: 'Minimal', description: 'Lowest latency, ±1 context radius' },
  { id: 'low', label: 'Low', description: 'Quick CoT pass, ±2 context radius' },
  { id: 'medium', label: 'Medium', description: 'Balanced reasoning, ±3 context radius' },
  { id: 'high', label: 'High', description: 'Deep planning & grammar pass, ±4 radius' },
  { id: 'deep', label: 'Deep', description: 'Maximum CoT beam & ±6 semantic radius' },
];

export function getModelOption(id?: string): ModelOption {
  return MODEL_OPTIONS.find((m) => m.id === id) || MODEL_OPTIONS[2];
}

export const DEFAULT_TRI_MODEL_CONFIG: TriModelConfig = {
  enabled: false,
  models: ['hydrogen-4-fast', 'hydrogen-4-balanced', 'flash-lite-3.1'],
  autonomousTurns: 0,
  linkTempSessions: false,
  autonomousPrompt: 'Critique, refine, and extend the previous ideas with a concrete next iteration.',
};

export const RETENTION_OPTIONS: Array<{
  id: RetentionMode;
  label: string;
  shortLabel: string;
  ttlMs: number | null;
  description: string;
}> = [
  {
    id: 'session',
    label: 'Temporary (Until Closed)',
    shortLabel: 'Until closed',
    ttlMs: null,
    description: 'Lives in memory only; disappears on reload or tab close.',
  },
  {
    id: '5m',
    label: 'Auto-Expire in 5 Minutes',
    shortLabel: '5 min',
    ttlMs: 5 * 60 * 1000,
    description: 'Automatically wiped from state after 5 minutes.',
  },
  {
    id: '1h',
    label: 'Auto-Expire in 1 Hour',
    shortLabel: '1 hour',
    ttlMs: 60 * 60 * 1000,
    description: 'Automatically deleted 1 hour after last update.',
  },
  {
    id: '24h',
    label: 'Auto-Expire in 24 Hours',
    shortLabel: '24 hours',
    ttlMs: 24 * 60 * 60 * 1000,
    description: 'Kept for 24 hours across reloads, then pruned.',
  },
  {
    id: 'permanent',
    label: 'Save Permanently',
    shortLabel: 'Saved',
    ttlMs: null,
    description: 'Persisted permanently to local conversation history.',
  },
];

export const TEXT_ANIMATION_PRESETS: TextAnimationPreset[] = [
  {
    id: 'kinetic-type',
    label: 'Kinetic Typography (Bounce)',
    description: 'Staggered letterforms with backOut squash-and-stretch entrance.',
    promptSnippet: 'Animate this headline using kinetic typography with staggered backOut easing, soft drop shadows, and pure-math chime audio.',
    stopMotionTemplate: JSON.stringify(
      {
        format: 'stopmotion/v3',
        title: 'Kinetic Title Drop',
        fps: 24,
        durationSec: 2.5,
        width: 800,
        height: 450,
        background: '#0f172a',
        loop: true,
        audio: {
          mode: 'math',
          formula: 'sin(TAU * 440 * t) * exp(-t * 4) * 0.35 + sin(TAU * 660 * max(0, t - 0.12)) * exp(-max(0, t - 0.12) * 5) * 0.25',
          durationSec: 2.5,
        },
        layers: [
          {
            id: 'headline',
            motion: {
              x: '400',
              y: 'lerp(90, 225, backOut(clamp(t * 1.8, 0, 1)))',
              scaleX: 'lerp(0.6, 1, backOut(clamp(t * 1.6, 0, 1)))',
              scaleY: 'lerp(1.4, 1, backOut(clamp(t * 1.6, 0, 1)))',
              opacity: 'clamp(t * 3, 0, 1)',
            },
            shadow: { groundY: 290, rx: 140, ry: 12, opacity: 0.28 },
            svg: '<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="64" fill="#f8fafc" letter-spacing="4">OXYGEN</text>',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'neon-typewriter',
    label: 'Neon Glow Typewriter',
    description: 'Luminous neon stroke reveal with pulsing cyan aura.',
    promptSnippet: 'Create a neon wireframe text reveal animation using stroke lining and glow pulse.',
    stopMotionTemplate: JSON.stringify(
      {
        format: 'stopmotion/v3',
        title: 'Neon Glow Signature',
        fps: 24,
        durationSec: 3,
        width: 800,
        height: 450,
        background: '#090d16',
        loop: true,
        layers: [
          {
            id: 'glow-title',
            pulse: { minOpacity: 0.72, maxOpacity: 1, freqHz: 2.5 },
            svg: '<text x="400" y="225" text-anchor="middle" dominant-baseline="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="54" fill="none" stroke="#38bdf8" stroke-width="2.5" filter="url(#softGlow)">FOLIO STUDIO</text>',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'parallax-lower-third',
    label: 'Broadcast Lower-Third Banner',
    description: 'Multi-plane parallax editorial callout card.',
    promptSnippet: 'Design a sleek broadcast lower-third text animation with parallax accent bar and smooth exponential slide.',
    stopMotionTemplate: JSON.stringify(
      {
        format: 'stopmotion/v3',
        title: 'Editorial Lower Third',
        fps: 24,
        durationSec: 3,
        width: 800,
        height: 450,
        background: '#111827',
        loop: true,
        layers: [
          {
            id: 'bar',
            motion: {
              x: 'lerp(-260, 120, easeOutExpo(clamp(t * 2, 0, 1)))',
              y: '320',
            },
            svg: '<rect x="0" y="0" width="8" height="68" rx="4" fill="#38bdf8"/><rect x="20" y="4" width="380" height="60" rx="10" fill="rgba(255,255,255,0.08)"/><text x="38" y="31" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" font-size="20" fill="#ffffff">Folio v(OXYGEN)</text><text x="38" y="53" font-family="JetBrains Mono, monospace" font-size="13" fill="#94a3b8">Production Timeline · 60fps Engine</text>',
          },
        ],
      },
      null,
      2
    ),
  },
];

export const DEFAULT_SAFETY_FILTERS: SafetyFiltersConfig = {
  harassment: 'medium',
  hateSpeech: 'medium',
  sexuallyExplicit: 'medium',
  dangerousContent: 'medium',
};

export const SAFETY_LEVELS: Array<{
  value: SafetyLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'none',
    label: 'None',
    description: 'Filter off — disables blocking for this category',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Relaxed filtering — blocks only high harm probability',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced default — blocks medium and high harm probability',
  },
  {
    value: 'max',
    label: 'Max',
    description: 'Strictest filtering — blocks low, medium, and high harm probability',
  },
];

export const SAFETY_CATEGORIES: Array<{
  key: SafetyCategoryKey;
  label: string;
  description: string;
}> = [
  {
    key: 'harassment',
    label: 'Harassment',
    description: 'Abusive, threatening, or bullying language',
  },
  {
    key: 'hateSpeech',
    label: 'Hate Speech',
    description: 'Content promoting hatred or discrimination',
  },
  {
    key: 'sexuallyExplicit',
    label: 'Sexually Explicit',
    description: 'Adult or explicit sexual material',
  },
  {
    key: 'dangerousContent',
    label: 'Dangerous Content',
    description: 'Harmful, illegal, or hazardous instructions',
  },
];

export function areSafetyFiltersDefault(config: SafetyFiltersConfig): boolean {
  return (
    config.harassment === DEFAULT_SAFETY_FILTERS.harassment &&
    config.hateSpeech === DEFAULT_SAFETY_FILTERS.hateSpeech &&
    config.sexuallyExplicit === DEFAULT_SAFETY_FILTERS.sexuallyExplicit &&
    config.dangerousContent === DEFAULT_SAFETY_FILTERS.dangerousContent
  );
}

export function getSafetySummaryLabel(config: SafetyFiltersConfig): string {
  const values = Object.values(config);
  if (values.every((v) => v === 'max')) return 'Max';
  if (values.every((v) => v === 'medium')) return 'Default';
  if (values.every((v) => v === 'low')) return 'Low';
  if (values.every((v) => v === 'none')) return 'None';
  return 'Custom';
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'stopmotion-v3',
    category: 'Stop Motion v3',
    title: 'Director cut + math audio',
    prompt:
      'Build a Stop Motion v3 production animation in a stopmotion block with storyboard camera cuts, bpy-style idLink reusable starships, parallax nebula, backOut easing, and pure-math stereo chord audio.',
  },
  {
    id: 'pixel-512',
    category: 'Pixel v3 (512px)',
    title: '512×512 Aurora Nightscape',
    prompt:
      'Create a crisp 512x512 pixelart/v3 aurora mountain skyline with bayer4 gradients, stardust particles, and ambient CRT scanline shader.',
  },
  {
    id: 'liquidmotion',
    category: 'Hybrid Engine',
    title: 'Liquid Motion hybrid clip',
    prompt:
      'Generate a Liquid Motion (liquidmotion) hybrid block pairing a 64x64 pixel-art lantern spirit background with smooth stopmotion/v3 fireflies and glowing light trails.',
  },
  {
    id: 'explainer-rich',
    category: 'Rich Visuals',
    title: 'Explain with chart & quiz',
    prompt:
      'Explain how Bezier easing curves work with clear analogies, an interactive comparison chart, a 3-question quiz, and matching stock icons/diagrams.',
  },
  {
    id: 'live-widget',
    category: 'Code',
    title: 'Build a live widget',
    prompt:
      'Create a self-contained interactive HTML/CSS/JS Pomodoro timer card in a single html code block with Start, Pause, and Reset buttons.',
  },
  {
    id: 'architecture',
    category: 'Engineering',
    title: 'Compare state options',
    prompt:
      'Compare local component state, URL search params, and external stores for a multi-filter data table in React. Give concrete guidance on when to choose each.',
  },
];

export const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'balanced',
    label: 'General Workspace',
    description: 'Clear, structured, and direct responses suited for everyday drafting and analysis.',
    instruction:
      'You are a thoughtful, precise collaborator. Provide clear, well-structured responses. Use Markdown formatting, concise headings, and code blocks with language tags when helpful. Avoid filler preambles.',
  },
  {
    id: 'director',
    label: 'Creative Director (v3)',
    description: 'Cinematography, Stop Motion v3 storyboards, Pixel v3 & hybrid visual pipelines.',
    instruction:
      'You are an executive Creative & Technical Director. Design multi-layer Stop Motion v3 storyboards, 512px Pixel v3 art, Blender CLI meshes, and pure-math soundtracks with rigorous camera framing, squash-and-stretch physics, lighting, and dynamic shadows.',
  },
  {
    id: 'editor',
    label: 'Concise Editor',
    description: 'Tightens prose, sharpens clarity, and cuts unnecessary words.',
    instruction:
      'You are an experienced editorial writer. Keep responses crisp, direct, and active-voiced. When reviewing text, point out structural improvements and provide a clean revised version.',
  },
  {
    id: 'engineer',
    label: 'Principal Engineer',
    description: 'Focuses on edge cases, type safety, performance, and maintainable architecture.',
    instruction:
      'You are a senior software engineer. Prioritize correctness, edge cases, clear invariants, and idiomatic code. Include concise explanations of trade-offs before jumping to implementation.',
  },
  {
    id: 'analyst',
    label: 'Research Analyst',
    description: 'Breaks complex questions into assumptions, evidence, and structured comparisons.',
    instruction:
      'You are an analytical researcher. Break problems down systematically, surface key assumptions explicitly, use comparison tables where useful, and distinguish facts from estimates.',
  },
];
