import {
  ModelOption,
  SafetyCategoryKey,
  SafetyFiltersConfig,
  SafetyLevel,
  StarterPrompt,
  SystemPreset,
} from '../types/chat';

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'flash-lite-3.1',
    name: 'Flash Lite 3.1',
    shortName: 'Flash Lite',
    description: 'Fastest responses for everyday chat and quick drafts',
    apiModel: 'gemini-3.1-flash-lite',
  },
  {
    id: 'hydrogen-4-fast',
    name: 'Hydrogen 4 Fast',
    shortName: 'Hydrogen Fast',
    description: 'Quick reasoning and coding with low latency',
    apiModel: 'gemini-4-hydrogen',
  },
  {
    id: 'hydrogen-4-balanced',
    name: 'Hydrogen 4 Balanced',
    shortName: 'Hydrogen 4',
    description: 'Stronger analytical depth for technical tasks',
    apiModel: 'gemini-4-hydrogen',
  },
  {
    id: 'hydrogen-4-deep',
    name: 'Hydrogen 4 Deep',
    shortName: 'Hydrogen Deep',
    description: 'Extended multi-step thinking for complex problems',
    apiModel: 'gemini-4-hydrogen',
  },
];

export function getModelOption(id?: string): ModelOption {
  return MODEL_OPTIONS.find((m) => m.id === id) || MODEL_OPTIONS[0];
}

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
    value: 'max',
    label: 'Max',
    description: 'Strictest filtering — blocks low, medium, and high harm probability',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced default — blocks medium and high harm probability',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Relaxed filtering — blocks only high harm probability',
  },
  {
    value: 'none',
    label: 'None',
    description: 'Filter disabled — does not block based on this category',
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
    id: 'architecture',
    category: 'Engineering',
    title: 'Compare state options',
    prompt:
      'Compare local component state, URL search params, and external stores for a multi-filter data table in React. Give concrete guidance on when to choose each.',
  },
  {
    id: 'writing',
    category: 'Writing',
    title: 'Draft a status memo',
    prompt:
      'Draft a concise Friday stakeholder update covering: database migration completed ahead of schedule, search latency reduced by 38%, and one open risk around third-party rate limits.',
  },
  {
    id: 'live-widget',
    category: 'Code',
    title: 'Build a live widget',
    prompt:
      'Create a self-contained interactive HTML/CSS/JS Pomodoro timer card in a single html code block with Start, Pause, and Reset buttons.',
  },
  {
    id: 'debugging',
    category: 'Code',
    title: 'Fix async race condition',
    prompt:
      'Explain why rapid filter changes in a React search input can display stale responses, and show how to solve it cleanly using AbortController inside useEffect.',
  },
  {
    id: 'stopmotion',
    category: 'Animation',
    title: 'Animate vector stop-motion',
    prompt:
      'Write vector stop-motion animation code in a stopmotion block showing a bright paper airplane gliding in a graceful loop across a twilight sky with twinkling stars.',
  },
  {
    id: 'pixelart',
    category: 'Pixel Art',
    title: 'Create complex pixel art',
    prompt:
      'Create a complex, beautifully shaded 32x32 animated pixel art sprite of an armored sci-fi mech with pulsing energy core in a pixelart code block.',
  },
  {
    id: 'analysis',
    category: 'Analysis',
    title: 'Build a decision matrix',
    prompt:
      'Build a weighted decision matrix template in Markdown to evaluate three cloud database options across cost predictability, operational overhead, latency, and backup recovery.',
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
