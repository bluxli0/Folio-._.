declare module 'gifenc' {
  export type PaletteRGB = number[][];

  export interface GifEncoderOptions {
    initialCapacity?: number;
    auto?: boolean;
  }

  export interface WriteFrameOptions {
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    palette?: PaletteRGB | null;
    repeat?: number;
    colorDepth?: number;
    dispose?: number;
    first?: boolean;
  }

  export interface GifEncoderInstance {
    reset: () => void;
    finish: () => void;
    bytes: () => Uint8Array;
    bytesView: () => Uint8Array;
    writeHeader: () => void;
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts?: WriteFrameOptions
    ) => void;
  }

  export function GIFEncoder(opt?: GifEncoderOptions): GifEncoderInstance;

  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean | number;
      clearAlpha?: boolean;
      clearAlphaThreshold?: number;
      clearAlphaColor?: number;
    }
  ): PaletteRGB;

  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: PaletteRGB,
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;
}
