import { RetentionMode } from '../types/chat';

export interface GreetingContext {
  threadId: string;
  isIncognito?: boolean;
  retention?: RetentionMode;
  groupName?: string;
  triModelEnabled?: boolean;
  systemInstruction?: string;
}

function getTimeBucket(hour: number): 'early' | 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 4 && hour < 7) return 'early';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function getPersonaTag(instruction = ''): 'director' | 'engineer' | 'editor' | 'analyst' | 'general' {
  const lower = instruction.toLowerCase();
  if (/director|storyboard|pixel|stop motion|blender|cinemat/.test(lower)) return 'director';
  if (/engineer|invariant|type safety|edge case/.test(lower)) return 'engineer';
  if (/editorial|tighten|prose|active-voiced/.test(lower)) return 'editor';
  if (/analytical|researcher|assumptions|evidence/.test(lower)) return 'analyst';
  return 'general';
}

function getSeasonalNote(date: Date): string | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1 && day === 1) return 'Fresh year, clean canvas.';
  if (month === 10 && day >= 25) return 'Spooky season studio vibes.';
  if (month === 11 && day >= 20 && day <= 30) return 'Late-autumn sprint energy.';
  if (month === 12 && day >= 18) return 'Year-end shipping season.';
  const weekday = date.getDay();
  if (weekday === 5) return 'Friday build energy.';
  if (weekday === 0 || weekday === 6) return 'Weekend studio session.';
  return null;
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getContextualGreeting(ctx: GreetingContext): {
  headline: string;
  subtitle: string;
} {
  const now = new Date();
  const bucket = getTimeBucket(now.getHours());
  const persona = getPersonaTag(ctx.systemInstruction);
  const seasonal = getSeasonalNote(now);
  const pick = (items: string[]) => items[hashSeed(`${ctx.threadId}-${now.getMinutes()}`) % items.length];

  if (ctx.isIncognito) {
    const retentionHint =
      ctx.retention === '5m'
        ? 'Self-destructs in 5 minutes.'
        : ctx.retention === '1h'
        ? 'Auto-clears in 1 hour.'
        : ctx.retention === '24h'
        ? 'Auto-clears in 24 hours.'
        : 'Isolated in memory until closed.';
    return {
      headline: pick([
        'Incognito Session Ready',
        'Private Sandbox Open',
        'Off-the-Record Workspace',
      ]),
      subtitle: `${retentionHint} Zero cross-session history leakage.`,
    };
  }

  if (ctx.triModelEnabled) {
    return {
      headline: pick([
        'Tri-Model Council Online',
        'Multi-Model Ensemble Ready',
        'Three Minds, One Thread',
      ]),
      subtitle:
        'Parallel and autonomous model perspectives active · Ask a complex creative or engineering challenge.',
    };
  }

  if (ctx.groupName) {
    return {
      headline: pick([
        `Back in ${ctx.groupName}`,
        `${ctx.groupName} Studio`,
        `Workspace: ${ctx.groupName}`,
      ]),
      subtitle:
        'Context-linked with sibling sessions in this folder · Ready to continue where you left off.',
    };
  }

  const timeHeadlines: Record<typeof bucket, string[]> = {
    early: ['Up early with Folio', 'Quiet dawn build session', 'First light in the studio'],
    morning: ['Good morning — what are we building?', 'Morning spark ready', 'Fresh coffee, clean canvas'],
    afternoon: ['Good afternoon — what is next?', 'Afternoon studio ready', 'What can we prototype today?'],
    evening: ['Good evening — ready to create?', 'Evening focus mode', 'Late-day ship & polish'],
    night: ['Night owl session', 'Midnight studio online', 'Deep focus after dark'],
  };

  const personaSubtitles: Record<typeof persona, string[]> = {
    director: [
      'Stop Motion v3, 512px Pixel v3, Blender CLI & pure-math audio standing by.',
      'Direct shot-by-shot camera cuts, 3D lighting, or hybrid liquid renders.',
    ],
    engineer: [
      'Full-stack code, workspace automation, benchmarks & crisp architecture reviews.',
      'Drop a file, repo, or system invariant to dissect.',
    ],
    editor: [
      'Sharp drafting, structural tightening, and clear editorial passes.',
      'Paste any draft to refine tone, pacing, and precision.',
    ],
    analyst: [
      'Decision matrices, interactive charts, evidence checks & deep comparisons.',
      'Give me a question to model visually and rigorously.',
    ],
    general: [
      'Code live sandboxes, animate in Stop Motion v3, draw 512px pixel art, or brainstorm.',
      'Folio Zero (v4.1) multi-engine suite ready — ask anything or launch a studio above.',
    ],
  };

  const headline = pick(timeHeadlines[bucket]);
  const baseSub = pick(personaSubtitles[persona]);
  return {
    headline,
    subtitle: seasonal ? `${seasonal} ${baseSub}` : baseSub,
  };
}
