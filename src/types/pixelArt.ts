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

export interface PixelArtFrame {
  id: string;
  pixels: string[]; // 1D array of hex color strings length width * height, or empty/transparent strings
  hold: number; // 1 = on ones, 2 = on twos
}

export interface PixelArtSpec {
  title?: string;
  width: number;
  height: number;
  palette?: string[];
  fps?: number;
  loop?: boolean;
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
