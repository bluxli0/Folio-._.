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
  {
    id: 'synthwave',
    name: 'Synthwave Outrun',
    description: 'Sunset magentas, electric cyan, and deep outrun violet',
    colors: ['#0a0214', '#1b0736', '#3a0ca3', '#7209b7', '#b5179e', '#f72585', '#ff6b6b', '#ffd166', '#4cc9f0', '#4895ef', '#4361ee', '#f8f9fa'],
  },
  {
    id: 'lava',
    name: 'Volcanic Magma',
    description: 'Obsidian basalt, glowing embers, and white-hot core tones',
    colors: ['#0c0a09', '#1c1917', '#44403c', '#7c2d12', '#b91c1c', '#dc2626', '#ea580c', '#f97316', '#facc15', '#fef08a', '#ffffff'],
  },
  {
    id: 'ice',
    name: 'Glacial Arctic',
    description: 'Deep abyssal navy, frosted cyan, and crisp snow highlights',
    colors: ['#020617', '#0f172a', '#1e3a8a', '#0369a1', '#0284c7', '#06b6d4', '#22d3ee', '#67e8f9', '#cffafe', '#f0f9ff', '#ffffff'],
  },
  {
    id: 'pastel',
    name: 'Candy Pastel',
    description: 'Soft creamy pastel ramp for stylized & cozy pixel art',
    colors: ['#2b2d42', '#8d99ae', '#edf2f4', '#ffcad4', '#f4acb7', '#ff9ebb', '#bdb2ff', '#a0c4ff', '#9bf6ff', '#caffbf', '#fdffb6', '#ffd6a5'],
  },
  {
    id: 'noir',
    name: 'Film Noir',
    description: 'High-contrast grayscale ramp with single crimson accent',
    colors: ['#050505', '#171717', '#262626', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#f5f5f5', '#ffffff', '#dc2626'],
  },
  {
    id: 'forest',
    name: 'Enchanted Forest',
    description: 'Mossy greens, bark browns, and bioluminescent firefly gold',
    colors: ['#052e16', '#14532d', '#166534', '#15803d', '#22c55e', '#86efac', '#451a03', '#78350f', '#92400e', '#d97706', '#fde047', '#ecfdf5'],
  },
  {
    id: 'gold',
    name: 'Gilded Royal',
    description: 'Royal indigo, tarnished bronze, and gleaming gold highlights',
    colors: ['#090d16', '#1e1b4b', '#312e81', '#78350f', '#b45309', '#d97706', '#f59e0b', '#fbbf24', '#fde047', '#fef9c3', '#ffffff'],
  },
];

export function resolveNamedPalette(name: string): string[] | null {
  const key = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const found = PALETTE_PRESETS.find((p) => p.id.toLowerCase().replace(/[^a-z0-9]/g, '') === key);
  return found ? found.colors : null;
}

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
