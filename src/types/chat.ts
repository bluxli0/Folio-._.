export type ModelChoiceId =
  | 'auto'
  | 'flash-4'
  | 'hydrogen-4-fast'
  | 'hydrogen-4-balanced'
  | 'hydrogen-4-deep'
  | 'neon-4'
  | 'carbon-4'
  | 'argon-4'
  | 'flash-3.8'
  | 'flash-lite-3.1'
  | 'omni-flash-1.2'
  | 'live-extended-3.8'
  | 'gemma-3-27b'
  | 'gemma-3-12b'
  | 'neo-4'
  | 'nano-banana-lite';

export type ThinkingMode = 'minimal' | 'low' | 'medium' | 'high' | 'deep';

export type NeoMode = 'llm' | 'rule';

export interface EntropicAuditReport {
  shannonEntropyBits: number;
  lexicalDiversityTTR: number;
  bigramRepetitionRate: number;
  grammarScore: number;
  groundingSignal: boolean;
  verdict: string;
}

export interface ModelOption {
  id: ModelChoiceId;
  name: string;
  shortName: string;
  description: string;
  apiModel: string;
  group?: string;
  speedLabel?: string;
  isPaid?: boolean;
  isImageOnly?: boolean;
  isLocalPython?: boolean;
}

export type SafetyLevel = 'none' | 'low' | 'medium' | 'max';

export type SafetyCategoryKey =
  | 'harassment'
  | 'hateSpeech'
  | 'sexuallyExplicit'
  | 'dangerousContent';

export type SafetyFiltersConfig = Record<SafetyCategoryKey, SafetyLevel>;

export type RetentionMode = 'session' | '5m' | '1h' | '24h' | 'permanent';

export type FontPresetId =
  | 'studio-sans'
  | 'geometric-outfit'
  | 'editorial-serif'
  | 'technical-mono';

export interface InstructionProfile {
  id: string;
  name: string;
  instruction: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomFunctionToolDef {
  id: string;
  name: string;
  description: string;
  parametersJson: string;
  handlerCode: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: unknown;
  durationMs?: number;
}

export interface TriModelConfig {
  enabled: boolean;
  models: ModelChoiceId[];
  autonomousTurns: number;
  linkTempSessions: boolean;
  autonomousPrompt?: string;
}

export interface CustomPresetItem {
  id: string;
  label: string;
  promptPrefix: string;
  textAnimStyle?: string;
  createdAt: number;
}

export interface TextAnimationPreset {
  id: string;
  label: string;
  description: string;
  promptSnippet: string;
  stopMotionTemplate: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isText: boolean;
  data?: string;
  previewUrl?: string;
  textContent?: string;
  tokenEstimate?: number;
  workspacePath?: string;
  truncatedForContext?: boolean;
  source?: 'upload' | 'stock' | 'link' | 'generated' | 'studio';
  linkUrl?: string;
}

export interface ChatImageResult {
  mimeType: string;
  dataUrl: string;
  prompt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  thoughts?: string;
  toolCalls?: ToolCallRecord[];
  createdAt: number;
  durationMs?: number;
  attachments?: ChatAttachment[];
  imageResults?: ChatImageResult[];
  engineRating?: {
    score: number;
    notes: string[];
  };
  audit?: EntropicAuditReport;
  error?: string;
  modelId?: ModelChoiceId;
  fallbackFrom?: ModelChoiceId;
  triModelIndex?: number;
  triModelLabel?: string;
  censored?: boolean;
  pinned?: boolean;
}

export interface ConversationThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId: ModelChoiceId;
  autoFallback: boolean;
  neoMode?: NeoMode;
  thinkingMode?: ThinkingMode;
  entropicAuditorEnabled?: boolean;
  semanticEngineEnabled?: boolean;
  metaScriptingEnabled?: boolean;
  systemInstruction: string;
  safetyFilters: SafetyFiltersConfig;
  immersivePureCode?: boolean;
  incognito?: boolean;
  retention?: RetentionMode;
  expiresAt?: number;
  triModelConfig?: TriModelConfig;
  groupName?: string;
  sharedThreadIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StarterPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

export interface SystemPreset {
  id: string;
  label: string;
  description: string;
  instruction: string;
}
