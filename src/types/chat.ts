export type ModelChoiceId =
  | 'flash-lite-3.1'
  | 'hydrogen-4-fast'
  | 'hydrogen-4-balanced'
  | 'hydrogen-4-deep';

export interface ModelOption {
  id: ModelChoiceId;
  name: string;
  shortName: string;
  description: string;
  apiModel: string;
}

export type SafetyLevel = 'max' | 'medium' | 'low' | 'none';

export type SafetyCategoryKey =
  | 'harassment'
  | 'hateSpeech'
  | 'sexuallyExplicit'
  | 'dangerousContent';

export type SafetyFiltersConfig = Record<SafetyCategoryKey, SafetyLevel>;

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isText: boolean;
  data?: string;
  previewUrl?: string;
  textContent?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  error?: string;
  modelId?: ModelChoiceId;
  fallbackFrom?: ModelChoiceId;
  censored?: boolean;
  pinned?: boolean;
}

export interface ConversationThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId: ModelChoiceId;
  autoFallback: boolean;
  systemInstruction: string;
  safetyFilters: SafetyFiltersConfig;
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
