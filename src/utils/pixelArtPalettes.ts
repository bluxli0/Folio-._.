import { PalettePreset } from '../types/pixelArt';

export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: 'pico8',
    name: 'PICO-8 (16)',
    description: 'Iconic fantasy console 16-color retro palette',
    colors: [
      '#000000',
      '#1D2B53',
      '#7E2553',
      '#008751',
      '#AB5236',
      '#5F574F',
      '#C2C3C7',
      '#FFF1E8',
      '#FF004D',
      '#FFA300',
      '#FFEC27',
      '#00E436',
      '#29ADFF',
      '#83769C',
      '#FF77A8',
      '#FFCCAA',
    ],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Vibrant neon synthwave & dark cityscape tones',
    colors: [
      '#0b091a',
      '#1a102f',
      '#2b1842',
      '#49185e',
      '#7b1875',
      '#b31278',
      '#ff007f',
      '#ff4099',
      '#00f0ff',
      '#00b4d8',
      '#0077b6',
      '#ffe600',
      '#39ff14',
      '#9d4edd',
      '#f8fafc',
      '#475569',
    ],
  },
  {
    id: 'endesga32',
    name: 'Endesga 32',
    description: 'Versatile 32-color indie pixel art palette with rich ramps',
    colors: [
      '#be4a2f',
      '#d77643',
      '#ead4aa',
      '#e4a672',
      '#b86f50',
      '#733e39',
      '#3e2731',
      '#a22633',
      '#e43b44',
      '#f77622',
      '#feae34',
      '#fee761',
      '#63c74d',
      '#3e8948',
      '#265c42',
      '#193c3e',
      '#124e89',
      '#0099db',
      '#2ce8f5',
      '#ffffff',
      '#c0cbdc',
      '#8b9bb4',
      '#5a6988',
      '#3a4466',
      '#262b44',
      '#181425',
      '#ff0044',
      '#68386c',
      '#b55088',
      '#f6757a',
      '#e8b796',
      '#c28569',
    ],
  },
  {
    id: 'gameboy',
    name: 'Game Boy (4)',
    description: 'Classic monochrome 4-shade greenish LCD palette',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  {
    id: 'sweetie16',
    name: 'Sweetie 16',
    description: 'Soft, whimsical palette tailored for characters & cozy scenes',
    colors: [
      '#1a1c2c',
      '#5d275d',
      '#b13e53',
      '#ef7d57',
      '#ffcd75',
      '#a7f070',
      '#38b764',
      '#257179',
      '#29366f',
      '#3b5dc9',
      '#41a6f6',
      '#73eff7',
      '#f4f4f4',
      '#94b0c2',
      '#566c86',
      '#333c57',
    ],
  },
  {
    id: 'fantasy24',
    name: 'Fantasy RPG (24)',
    description: 'Rich armors, spells, stones, and atmospheric foliage',
    colors: [
      '#0f172a',
      '#1e293b',
      '#334155',
      '#64748b',
      '#94a3b8',
      '#f1f5f9',
      '#450a0a',
      '#7f1d1d',
      '#b91c1c',
      '#ef4444',
      '#f87171',
      '#78350f',
      '#b45309',
      '#f59e0b',
      '#fbbf24',
      '#fef3c7',
      '#14532d',
      '#15803d',
      '#22c55e',
      '#86efac',
      '#1e3a8a',
      '#2563eb',
      '#60a5fa',
      '#9333ea',
    ],
  },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lightenColor(hex: string, percent = 18): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 + percent / 100;
  return rgbToHex(
    Math.min(255, rgb.r * factor + 12),
    Math.min(255, rgb.g * factor + 12),
    Math.min(255, rgb.b * factor + 12)
  );
}

export function darkenColor(hex: string, percent = 18): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = Math.max(0, 1 - percent / 100);
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

export function getContrastingTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  // Luminance formula
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}
