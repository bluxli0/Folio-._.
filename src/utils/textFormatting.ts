import { ChatMessage, FontPresetId } from '../types/chat';

export interface FontPresetMeta {
  id: FontPresetId;
  label: string;
  preview: string;
  description: string;
  sansFamily: string;
  displayFamily: string;
}

export const FONT_PRESETS: FontPresetMeta[] = [
  {
    id: 'studio-sans',
    label: 'Studio Sans',
    preview: 'Folio · Bricolage + Jakarta',
    description: 'Balanced studio sans with expressive display headers',
    sansFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    displayFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'geometric-outfit',
    label: 'Geometric Outfit',
    preview: 'Folio · Outfit + DM Sans',
    description: 'Clean geometric proportions for modern workspaces',
    sansFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    displayFamily: '"Outfit", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'editorial-serif',
    label: 'Editorial Serif',
    preview: 'Folio · Fraunces + Playfair',
    description: 'High-contrast magazine serif paired with readable sans',
    sansFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    displayFamily: '"Fraunces", "Playfair Display", Georgia, serif',
  },
  {
    id: 'technical-mono',
    label: 'Technical Mono',
    preview: '𝙵𝚘𝚕𝚒𝚘 · 𝙹𝚎𝚝𝙱𝚛𝚊𝚒𝚗𝚜 𝙼𝚘𝚗𝚘',
    description: 'Crisp terminal-grade monospace throughout conversation UI',
    sansFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    displayFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
];

export type UnicodeStyleKind =
  | 'monospace'
  | 'bold'
  | 'italic'
  | 'boldItalic'
  | 'script'
  | 'doubleStruck'
  | 'sansBold'
  | 'normal';

export interface UnicodeStyleOption {
  id: UnicodeStyleKind;
  label: string;
  sample: string;
}

export const UNICODE_STYLE_OPTIONS: UnicodeStyleOption[] = [
  { id: 'monospace', label: 'Mono', sample: '𝚖𝚘𝚗𝚘' },
  { id: 'bold', label: 'Bold', sample: '𝐛𝐨𝐥𝐝' },
  { id: 'italic', label: 'Italic', sample: '𝑖𝑡𝑎𝑙𝑖𝑐' },
  { id: 'boldItalic', label: 'B+I', sample: '𝒃𝒐𝒍𝒅' },
  { id: 'script', label: 'Script', sample: '𝓈𝒸𝓇𝒾𝓅𝓉' },
  { id: 'doubleStruck', label: 'Double', sample: '𝕕𝕠𝕦𝕓𝕝𝕖' },
  { id: 'sansBold', label: 'Sans B', sample: '𝗯𝗼𝗹𝗱' },
  { id: 'normal', label: 'Plain', sample: 'plain' },
];

const SCRIPT_UPPER_EXCEPTIONS: Record<string, string> = {
  B: '\u212C',
  E: '\u2130',
  F: '\u2131',
  H: '\u210B',
  I: '\u2110',
  L: '\u2112',
  M: '\u2133',
  R: '\u211B',
};

const SCRIPT_LOWER_EXCEPTIONS: Record<string, string> = {
  e: '\u212F',
  g: '\u210A',
  o: '\u2134',
};

const DOUBLE_UPPER_EXCEPTIONS: Record<string, string> = {
  C: '\u2102',
  H: '\u210D',
  N: '\u2115',
  P: '\u2119',
  Q: '\u211A',
  R: '\u211D',
  Z: '\u2124',
};

const CHAR_TO_ASCII_MAP: Map<string, string> = new Map();

function mapCodepointRange(
  char: string,
  upperStart: number,
  lowerStart: number,
  digitStart?: number,
  upperExceptions?: Record<string, string>,
  lowerExceptions?: Record<string, string>
): string {
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    if (upperExceptions?.[char]) return upperExceptions[char];
    return String.fromCodePoint(upperStart + (code - 65));
  }
  if (code >= 97 && code <= 122) {
    if (lowerExceptions?.[char]) return lowerExceptions[char];
    return String.fromCodePoint(lowerStart + (code - 97));
  }
  if (digitStart !== undefined && code >= 48 && code <= 57) {
    return String.fromCodePoint(digitStart + (code - 48));
  }
  return char;
}

// Build reverse ASCII normalizer once so styles can cleanly swap or revert
(function initReverseMap() {
  const styles: Array<{
    u: number;
    l: number;
    d?: number;
    ue?: Record<string, string>;
    le?: Record<string, string>;
  }> = [
    { u: 0x1d670, l: 0x1d68a, d: 0x1d7f6 }, // monospace
    { u: 0x1d400, l: 0x1d41a, d: 0x1d7ce }, // bold
    { u: 0x1d434, l: 0x1d44e, le: { h: '\u210E' } }, // italic
    { u: 0x1d468, l: 0x1d482 }, // boldItalic
    {
      u: 0x1d49c,
      l: 0x1d4b6,
      ue: SCRIPT_UPPER_EXCEPTIONS,
      le: SCRIPT_LOWER_EXCEPTIONS,
    }, // script
    { u: 0x1d538, l: 0x1d552, d: 0x1d7d8, ue: DOUBLE_UPPER_EXCEPTIONS }, // doubleStruck
    { u: 0x1d5d4, l: 0x1d5ee, d: 0x1d7ec }, // sansBold
  ];

  for (const s of styles) {
    for (let i = 0; i < 26; i += 1) {
      const up = String.fromCharCode(65 + i);
      const lo = String.fromCharCode(97 + i);
      CHAR_TO_ASCII_MAP.set(
        s.ue?.[up] || String.fromCodePoint(s.u + i),
        up
      );
      CHAR_TO_ASCII_MAP.set(
        s.le?.[lo] || String.fromCodePoint(s.l + i),
        lo
      );
    }
    if (s.d !== undefined) {
      for (let d = 0; d < 10; d += 1) {
        CHAR_TO_ASCII_MAP.set(
          String.fromCodePoint(s.d + d),
          String.fromCharCode(48 + d)
        );
      }
    }
  }
})();

export function normalizeUnicodeToAscii(input: string): string {
  let out = '';
  for (const ch of input) {
    out += CHAR_TO_ASCII_MAP.get(ch) ?? ch;
  }
  return out;
}

export function transformUnicodeText(
  input: string,
  style: UnicodeStyleKind
): string {
  const plain = normalizeUnicodeToAscii(input);
  if (style === 'normal') return plain;

  let out = '';
  for (const ch of plain) {
    switch (style) {
      case 'monospace':
        out += mapCodepointRange(ch, 0x1d670, 0x1d68a, 0x1d7f6);
        break;
      case 'bold':
        out += mapCodepointRange(ch, 0x1d400, 0x1d41a, 0x1d7ce);
        break;
      case 'italic':
        out += mapCodepointRange(ch, 0x1d434, 0x1d44e, undefined, undefined, {
          h: '\u210E',
        });
        break;
      case 'boldItalic':
        out += mapCodepointRange(ch, 0x1d468, 0x1d482);
        break;
      case 'script':
        out += mapCodepointRange(
          ch,
          0x1d49c,
          0x1d4b6,
          undefined,
          SCRIPT_UPPER_EXCEPTIONS,
          SCRIPT_LOWER_EXCEPTIONS
        );
        break;
      case 'doubleStruck':
        out += mapCodepointRange(
          ch,
          0x1d538,
          0x1d552,
          0x1d7d8,
          DOUBLE_UPPER_EXCEPTIONS
        );
        break;
      case 'sansBold':
        out += mapCodepointRange(ch, 0x1d5d4, 0x1d5ee, 0x1d7ec);
        break;
      default:
        out += ch;
        break;
    }
  }
  return out;
}

export interface ChatHeadingItem {
  id: string;
  anchorId: string;
  messageId: string;
  role: 'user' | 'model';
  level: 1 | 2 | 3;
  text: string;
}

export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 64) || 'section'
  );
}

export function extractChatHeadings(messages: ChatMessage[]): ChatHeadingItem[] {
  const headings: ChatHeadingItem[] = [];
  const seen = new Map<string, number>();

  for (const msg of messages) {
    if (!msg.text || msg.censored) continue;
    const lines = msg.text.split(/\r?\n/);
    let inFence = false;
    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
      if (!m) continue;
      const level = m[1].length as 1 | 2 | 3;
      const rawText = m[2].replace(/[*_`~]/g, '').trim();
      if (!rawText) continue;
      const baseSlug = slugifyHeading(rawText);
      const count = (seen.get(baseSlug) || 0) + 1;
      seen.set(baseSlug, count);
      const anchorId = `h-${baseSlug}`;
      headings.push({
        id: `${msg.id}-${headings.length}`,
        anchorId,
        messageId: msg.id,
        role: msg.role,
        level,
        text: rawText,
      });
    }
  }

  return headings;
}
