export type FlowGenerationMode = 'text' | 'frames' | 'ingredients' | 'scenebuilder';

export type FlowCameraMotion =
  | 'Auto Director'
  | 'Static Tripod'
  | 'Slow Dolly In'
  | 'Dolly Out'
  | 'Smooth Pan Left'
  | 'Smooth Pan Right'
  | 'Tilt Up Reveal'
  | 'Orbit 360°'
  | 'Aerial Drone Sweep'
  | 'Handheld Follow';

export type FlowAspectRatio = '16:9' | '9:16';

export type FlowResolution = '360p' | '720p' | '1080p';

export type FlowQualityTier = 'fast' | 'quality';

export type FlowIngredientCategory = 'character' | 'object' | 'location' | 'style';

export interface FlowIngredient {
  id: string;
  name: string;
  category: FlowIngredientCategory;
  mimeType: string;
  imageDataUrl: string;
  createdAt: number;
}

export interface FlowFrameSlot {
  id: string;
  label: 'Start Frame' | 'End Frame';
  mimeType: string;
  imageDataUrl: string;
  prompt?: string;
}

export interface FlowClip {
  id: string;
  prompt: string;
  mode: 'text' | 'frames' | 'ingredients' | 'extend' | 'edit';
  cameraMotion: FlowCameraMotion;
  aspectRatio: FlowAspectRatio;
  duration: string;
  resolution: FlowResolution;
  qualityTier: FlowQualityTier;
  videoUrl: string;
  mimeType: string;
  interactionId?: string;
  creditCost: number;
  createdAt: number;
  parentClipId?: string;
}

export interface FlowSceneItem {
  id: string;
  clipId: string;
  order: number;
}

export interface FlowCreditTransaction {
  id: string;
  action: string;
  cost: number;
  timestamp: number;
  status: 'completed' | 'refunded';
}

export interface FlowCreditState {
  balance: number;
  dailyLimit: number;
  lastResetDate: string; // Local YYYY-MM-DD
  transactions: FlowCreditTransaction[];
}

export interface FlowAudioScore {
  id: string;
  prompt: string;
  audioUrl: string;
  mimeType: string;
  lyrics?: string;
  createdAt: number;
}
