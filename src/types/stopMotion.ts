import type { MathAudioTrackSpec } from '../utils/mathAudioSynth';

export type CaptureSourceMode = 'draw' | 'camera' | 'vector' | 'import';

export type VectorBrushStyle =
  | 'pen'
  | 'calligraphy'
  | 'marker'
  | 'highlighter'
  | 'dashed'
  | 'dots'
  | 'airbrush'
  | 'neon'
  | 'watercolor'
  | 'pixel';

export type DrawTool =
  | VectorBrushStyle
  | 'eraser'
  | 'line'
  | 'circle'
  | 'rect';

export type AspectRatioPreset = '16:9' | '4:3' | '1:1';

export interface VectorPoint {
  x: number;
  y: number;
}

export type VectorStrokeElement =
  | {
      id: string;
      kind: 'path';
      brush: VectorBrushStyle;
      points: VectorPoint[];
      color: string;
      width: number;
    }
  | {
      id: string;
      kind: 'line' | 'rect' | 'circle';
      color: string;
      width: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export interface StopMotionFrame {
  id: string;
  dataUrl: string;
  svgMarkup?: string;
  vectorElements?: VectorStrokeElement[];
  background?: string;
  hold: number; // 1 = on ones, 2 = on twos, 3 = on threes, etc.
  createdAt: number;
}

export interface VectorStopMotionSpec {
  title?: string;
  format?: string;
  fps: number;
  width: number;
  height: number;
  background: string;
  loop: boolean;
  pingPong: boolean;
  durationSec?: number;
  totalLogicalFrames?: number;
  sourceScene?: unknown;
  audioSpec?: MathAudioTrackSpec;
  frames: StopMotionFrame[];
}

export interface StopMotionDemo {
  id: string;
  title: string;
  category: string;
  description: string;
  fps: number;
  pingPong: boolean;
  background: string;
  buildFrames: (width: number, height: number) => StopMotionFrame[];
}

export const ASPECT_DIMENSIONS: Record<
  AspectRatioPreset,
  { width: number; height: number; label: string }
> = {
  '16:9': { width: 800, height: 450, label: '16:9' },
  '4:3': { width: 800, height: 600, label: '4:3' },
  '1:1': { width: 640, height: 640, label: '1:1' },
};
