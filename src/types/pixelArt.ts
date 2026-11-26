export type PixelArtTool =
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'picker'
  | 'line'
  | 'rect'
  | 'circle'
  | 'dither'
  | 'shade';

export type SymmetryMode = 'none' | 'horizontal' | 'vertical' | 'quad';

export type PixelShaderType =
  | 'vignette'
  | 'scanline'
  | 'crt'
  | 'chromatic'
  | 'glow'
  | 'posterize'
  | 'bloom'
  | 'dither'
  | 'outline'
  | 'halftone'
  | 'sepia'
  | 'invert'
  | 'pixelate'
  | 'glitch'
  | 'emboss'
  | 'edge'
  | 'tint'
  | 'duotone';

export interface PixelShaderSpec {
  type: PixelShaderType;
  intensity?: number;
  color?: string;
  secondaryColor?: string;
  threshold?: number;
  blockSize?: number;
}

export interface PixelArtFrame {
  id: string;
  pixels: string[]; // 1D array of hex color strings length width * height, or empty/transparent strings
  hold: number; // 1 = on ones, 2 = on twos
}

export interface PixelArtSpec {
  title?: string;
  format?: string;
  width: number;
  height: number;
  palette?: string | string[];
  fps?: number;
  loop?: boolean;
  shaders?: PixelShaderSpec[];
  frames: PixelArtFrame[];
}

export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  colors: string[];
}

export interface PixelArtDemo {
  id: string;
  title: string;
  category: string;
  description: string;
  width: number;
  height: number;
  fps?: number;
  palette: string[];
  buildFrames: () => PixelArtFrame[];
}
