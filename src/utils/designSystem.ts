import {
  DesignCustomVariable,
  DesignSystemConfig,
  PreviewBundleJson,
} from '../types/designSystem';

export const DEFAULT_DESIGN_SYSTEM: DesignSystemConfig = {
  name: 'Folio System',
  themeColor: '#2563eb',
  accentColor: '#f59e0b',
  surfaceColor: '#111827',
  textColor: '#f8fafc',
  animationSpeed: 1,
  spriteSize: 48,
  borderRadius: 14,
  spacingUnit: 8,
  fontScale: 1,
  seedEnabled: true,
  seed: 'folio-42',
  customVars: [
    {
      id: 'var-glow',
      key: 'glow-intensity',
      label: 'Glow Intensity',
      type: 'number',
      value: '0.65',
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: 'var-pixel-snap',
      key: 'sprite-scale',
      label: 'Sprite Scale',
      type: 'number',
      value: '1.2',
      min: 0.5,
      max: 3,
      step: 0.1,
    },
  ],
};

// Deterministic FNV-1a string hash -> 32-bit unsigned int
export function hashSeedToInt(seed: string | number): number {
  const str = String(seed || 'folio-default');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32 deterministic PRNG returning floats in [0, 1)
export function createSeededRng(seed: string | number): () => number {
  let state = hashSeedToInt(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomSeed(): string {
  const prefixes = ['orbit', 'prism', 'pixel', 'nebula', 'kinetic', 'studio', 'flux', 'chroma'];
  const word = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generateDesignSystemFromSeed(
  seedInput: string,
  prev: DesignSystemConfig
): DesignSystemConfig {
  const cleanSeed = seedInput.trim() || generateRandomSeed();
  const rng = createSeededRng(cleanSeed);
  const baseHue = Math.floor(rng() * 360);
  const harmonyOffset = [30, 135, 180, 210][Math.floor(rng() * 4)];
  const accentHue = (baseHue + harmonyOffset) % 360;
  const isDarkSurface = rng() > 0.25;

  const themeColor = hslToHex(baseHue, 74 + Math.floor(rng() * 18), isDarkSurface ? 56 : 46);
  const accentColor = hslToHex(accentHue, 78 + Math.floor(rng() * 16), isDarkSurface ? 62 : 48);
  const surfaceColor = isDarkSurface
    ? hslToHex(baseHue, 18, 9 + Math.floor(rng() * 6))
    : hslToHex(baseHue, 24, 96);
  const textColor = isDarkSurface ? '#f8fafc' : '#0f172a';

  const spriteSizes = [24, 32, 48, 64, 80, 96];
  const spriteSize = spriteSizes[Math.floor(rng() * spriteSizes.length)];
  const animationSpeed = Number((0.6 + rng() * 1.4).toFixed(2));
  const borderRadius = Math.floor(rng() * 5) * 4 + 4;
  const spacingUnit = [4, 6, 8, 10, 12][Math.floor(rng() * 5)];
  const fontScale = Number((0.92 + rng() * 0.24).toFixed(2));

  return {
    ...prev,
    seedEnabled: true,
    seed: cleanSeed,
    themeColor,
    accentColor,
    surfaceColor,
    textColor,
    spriteSize,
    animationSpeed,
    borderRadius,
    spacingUnit,
    fontScale,
  };
}

export function sanitizeVarKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-var';
}

export function buildCssVarMap(config: DesignSystemConfig): Record<string, string> {
  const vars: Record<string, string> = {
    '--theme-color': config.themeColor,
    '--accent-color': config.accentColor,
    '--surface-color': config.surfaceColor,
    '--text-color': config.textColor,
    '--animation-speed': String(config.animationSpeed),
    '--animation-duration': `${(1 / Math.max(0.1, config.animationSpeed)).toFixed(3)}s`,
    '--sprite-size': `${config.spriteSize}px`,
    '--radius': `${config.borderRadius}px`,
    '--spacing-unit': `${config.spacingUnit}px`,
    '--font-scale': String(config.fontScale),
    '--procedural-seed': config.seedEnabled ? `"${config.seed.replace(/"/g, '')}"` : '"none"',
  };

  for (const cv of config.customVars) {
    const key = sanitizeVarKey(cv.key);
    vars[`--${key}`] = `${cv.value}${cv.unit || ''}`;
  }
  return vars;
}

export function buildDesignSystemCss(config: DesignSystemConfig): string {
  const varMap = buildCssVarMap(config);
  const lines = Object.entries(varMap).map(([k, v]) => `  ${k}: ${v};`);
  return `/* Folio Generated Design System — ${config.name}${config.seedEnabled ? ` (seed: ${config.seed})` : ''} */
:root {
${lines.join('\n')}
}

.folio-surface {
  background: var(--surface-color);
  color: var(--text-color);
  border-radius: var(--radius);
  font-size: calc(1rem * var(--font-scale));
}

.folio-btn-primary {
  background: var(--theme-color);
  color: #ffffff;
  border-radius: var(--radius);
  padding: calc(var(--spacing-unit) * 1.25) calc(var(--spacing-unit) * 2.5);
  transition: transform calc(0.18s / var(--animation-speed)) ease;
}

.folio-sprite-box {
  width: var(--sprite-size);
  height: var(--sprite-size);
  border-radius: calc(var(--radius) * 0.65);
  background: linear-gradient(135deg, var(--theme-color), var(--accent-color));
}
`;
}

export function buildDesignSystemTokensJson(config: DesignSystemConfig): string {
  const cssVariables = buildCssVarMap(config);
  const payload = {
    $schema: 'folio-design-system-v1',
    name: config.name,
    seed: config.seedEnabled ? config.seed : null,
    tokens: {
      colors: {
        theme: config.themeColor,
        accent: config.accentColor,
        surface: config.surfaceColor,
        text: config.textColor,
      },
      motion: {
        animationSpeed: config.animationSpeed,
      },
      layout: {
        spriteSize: config.spriteSize,
        borderRadius: config.borderRadius,
        spacingUnit: config.spacingUnit,
        fontScale: config.fontScale,
      },
      custom: config.customVars.reduce<Record<string, string | number>>((acc, item) => {
        acc[sanitizeVarKey(item.key)] =
          item.type === 'number' && !Number.isNaN(Number(item.value))
            ? Number(item.value)
            : item.value;
        return acc;
      }, {}),
    },
    cssVariables,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildFolioRuntimeVarsObject(config: DesignSystemConfig): Record<string, unknown> {
  const customMap: Record<string, string | number> = {};
  for (const cv of config.customVars) {
    const key = sanitizeVarKey(cv.key);
    customMap[key] =
      cv.type === 'number' && !Number.isNaN(Number(cv.value))
        ? Number(cv.value)
        : cv.value;
  }
  return {
    name: config.name,
    themeColor: config.themeColor,
    accentColor: config.accentColor,
    surfaceColor: config.surfaceColor,
    textColor: config.textColor,
    animationSpeed: config.animationSpeed,
    spriteSize: config.spriteSize,
    borderRadius: config.borderRadius,
    spacingUnit: config.spacingUnit,
    fontScale: config.fontScale,
    seedEnabled: config.seedEnabled,
    seed: config.seedEnabled ? config.seed : null,
    ...customMap,
  };
}

export function buildDesignSystemHeadInjection(config: DesignSystemConfig): string {
  const css = buildDesignSystemCss(config).replace(/<\/style>/gi, '');
  const varsJson = JSON.stringify(buildFolioRuntimeVarsObject(config)).replace(/</g, '\\u003c');
  const seedStrJson = JSON.stringify(config.seedEnabled ? config.seed : '');
  const seedInt = config.seedEnabled ? hashSeedToInt(config.seed) : 0;

  return `<style id="folio-design-system">
${css}
</style>
<script>
(function(){
  window.__FOLIO_VARS__ = ${varsJson};
  window.__FOLIO_SEED__ = ${seedStrJson};
  window.folioCreateRng = function(customSeed){
    var str = String(customSeed !== undefined ? customSeed : (${seedStrJson} || Date.now()));
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var state = (h >>> 0) || ${seedInt || 1};
    return function(){
      state = (state + 0x6d2b79f5) >>> 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  window.folioRandom = window.folioCreateRng(${seedStrJson} || undefined);
})();
</script>`;
}

export function injectDesignSystemIntoSrcDoc(
  srcDocHtml: string,
  config?: DesignSystemConfig
): string {
  if (!config) return srcDocHtml;
  const snippet = buildDesignSystemHeadInjection(config);
  if (/<\/head>/i.test(srcDocHtml)) {
    return srcDocHtml.replace(/<\/head>/i, `${snippet}\n</head>`);
  }
  if (/<head[^>]*>/i.test(srcDocHtml)) {
    return srcDocHtml.replace(/<head([^>]*)>/i, `<head$1>\n${snippet}`);
  }
  return `${snippet}\n${srcDocHtml}`;
}

export function buildPreviewBundleJson(params: {
  language: string;
  code: string;
  designSystem: DesignSystemConfig;
  workspaceFiles?: Array<{ path: string; content: string }>;
}): string {
  const bundle: PreviewBundleJson = {
    format: 'folio-preview-bundle-v1',
    exportedAt: Date.now(),
    language: params.language,
    code: params.code,
    designSystem: params.designSystem,
    workspaceFiles: params.workspaceFiles,
  };
  return JSON.stringify(bundle, null, 2);
}

export interface ParsedUploadedJsonResult {
  designSystem?: Partial<DesignSystemConfig>;
  code?: string;
  language?: string;
  workspaceFiles?: Array<{ path: string; content: string }>;
}

export function parseUploadedPreviewJson(
  rawText: string,
  fallback: DesignSystemConfig
): ParsedUploadedJsonResult {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Uploaded JSON must be an object.');
  }

  // Case 1: Full Folio Preview Bundle JSON
  if (parsed.format === 'folio-preview-bundle-v1' && parsed.designSystem) {
    const ds = parsed.designSystem as Partial<DesignSystemConfig>;
    return {
      designSystem: {
        ...fallback,
        ...ds,
        customVars: Array.isArray(ds.customVars)
          ? (ds.customVars as DesignCustomVariable[])
          : fallback.customVars,
      },
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      language: typeof parsed.language === 'string' ? parsed.language : undefined,
      workspaceFiles: Array.isArray(parsed.workspaceFiles)
        ? (parsed.workspaceFiles as Array<{ path: string; content: string }>)
        : undefined,
    };
  }

  // Case 2: Standalone Folio Design System JSON ($schema: folio-design-system-v1)
  if (parsed.tokens && typeof parsed.tokens === 'object') {
    const tokens = parsed.tokens as {
      colors?: Record<string, string>;
      motion?: Record<string, number>;
      layout?: Record<string, number>;
      custom?: Record<string, string | number>;
    };
    const nextCustom: DesignCustomVariable[] = tokens.custom
      ? Object.entries(tokens.custom).map(([k, v], idx) => ({
          id: `imp-${idx}-${k}`,
          key: sanitizeVarKey(k),
          label: k,
          type: typeof v === 'number' ? 'number' : typeof v === 'string' && v.startsWith('#') ? 'color' : 'text',
          value: String(v),
        }))
      : fallback.customVars;

    return {
      designSystem: {
        ...fallback,
        name: typeof parsed.name === 'string' ? parsed.name : fallback.name,
        seedEnabled: typeof parsed.seed === 'string' && parsed.seed.length > 0,
        seed: typeof parsed.seed === 'string' ? parsed.seed : fallback.seed,
        themeColor: tokens.colors?.theme || fallback.themeColor,
        accentColor: tokens.colors?.accent || fallback.accentColor,
        surfaceColor: tokens.colors?.surface || fallback.surfaceColor,
        textColor: tokens.colors?.text || fallback.textColor,
        animationSpeed:
          typeof tokens.motion?.animationSpeed === 'number'
            ? tokens.motion.animationSpeed
            : fallback.animationSpeed,
        spriteSize:
          typeof tokens.layout?.spriteSize === 'number'
            ? tokens.layout.spriteSize
            : fallback.spriteSize,
        borderRadius:
          typeof tokens.layout?.borderRadius === 'number'
            ? tokens.layout.borderRadius
            : fallback.borderRadius,
        spacingUnit:
          typeof tokens.layout?.spacingUnit === 'number'
            ? tokens.layout.spacingUnit
            : fallback.spacingUnit,
        fontScale:
          typeof tokens.layout?.fontScale === 'number'
            ? tokens.layout.fontScale
            : fallback.fontScale,
        customVars: nextCustom,
      },
    };
  }

  // Case 3: Flat variables JSON (e.g. { themeColor, animationSpeed, spriteSize, ... })
  const maybeFlat: Partial<DesignSystemConfig> = {};
  if (typeof parsed.themeColor === 'string') maybeFlat.themeColor = parsed.themeColor;
  if (typeof parsed.accentColor === 'string') maybeFlat.accentColor = parsed.accentColor;
  if (typeof parsed.surfaceColor === 'string') maybeFlat.surfaceColor = parsed.surfaceColor;
  if (typeof parsed.textColor === 'string') maybeFlat.textColor = parsed.textColor;
  if (typeof parsed.animationSpeed === 'number') maybeFlat.animationSpeed = parsed.animationSpeed;
  if (typeof parsed.spriteSize === 'number') maybeFlat.spriteSize = parsed.spriteSize;
  if (typeof parsed.borderRadius === 'number') maybeFlat.borderRadius = parsed.borderRadius;
  if (typeof parsed.spacingUnit === 'number') maybeFlat.spacingUnit = parsed.spacingUnit;
  if (typeof parsed.fontScale === 'number') maybeFlat.fontScale = parsed.fontScale;
  if (typeof parsed.seed === 'string') {
    maybeFlat.seed = parsed.seed;
    maybeFlat.seedEnabled = true;
  }

  if (Object.keys(maybeFlat).length > 0 || typeof parsed.code === 'string') {
    return {
      designSystem: { ...fallback, ...maybeFlat },
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      language: typeof parsed.language === 'string' ? parsed.language : undefined,
    };
  }

  throw new Error('Unrecognized JSON schema. Expected a Folio Preview Bundle or Design System JSON.');
}

export const HTML_DESIGN_MODULE_CODE = `<div id="stage" class="folio-surface" style="padding:24px;min-height:360px;font-family:system-ui,sans-serif;border:1px solid rgba(255,255,255,0.12);">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;">
    <div>
      <h2 style="margin:0;font-size:calc(20px * var(--font-scale));color:var(--text-color);">HTML Design Variables &amp; Seed Stage</h2>
      <p id="meta" style="margin:4px 0 0;font-size:12px;opacity:0.75;"></p>
    </div>
    <button class="folio-btn-primary" onclick="spawnWave()" style="border:none;cursor:pointer;font-weight:600;font-size:12px;">
      Reseed Wave
    </button>
  </div>
  <canvas id="sprite-canvas" width="560" height="240" style="width:100%;height:240px;border-radius:var(--radius);display:block;background:rgba(0,0,0,0.28);"></canvas>
</div>
<script>
  const vars = window.__FOLIO_VARS__ || {};
  const meta = document.getElementById('meta');
  meta.textContent = 'Theme ' + (vars.themeColor || '#2563eb') + ' · Speed ' + (vars.animationSpeed || 1) + 'x · Sprite ' + (vars.spriteSize || 48) + 'px' + (vars.seed ? ' · Seed: ' + vars.seed : '');

  const canvas = document.getElementById('sprite-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function spawnWave() {
    const rng = window.folioCreateRng ? window.folioCreateRng(vars.seed || Date.now()) : Math.random;
    particles = Array.from({ length: 14 }, (_, i) => ({
      x: 40 + (i / 13) * (canvas.width - 80),
      y: 70 + rng() * 100,
      phase: rng() * Math.PI * 2,
      hueShift: rng(),
      amp: 16 + rng() * 32,
    }));
  }
  spawnWave();

  let t = 0;
  function frame() {
    const speed = Number(vars.animationSpeed || 1);
    const size = Number(vars.spriteSize || 48) * Number(vars['sprite-scale'] || 1);
    const radius = Math.min(size / 2, Number(vars.borderRadius || 14));
    t += 0.03 * speed;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      const y = p.y + Math.sin(t + p.phase) * p.amp;
      const pulse = 0.85 + 0.15 * Math.cos(t * 1.6 + p.phase);
      const s = size * 0.55 * pulse;
      ctx.save();
      ctx.translate(p.x, y);
      ctx.rotate(Math.sin(t * 0.7 + p.phase) * 0.35);
      ctx.fillStyle = p.hueShift > 0.5 ? (vars.themeColor || '#2563eb') : (vars.accentColor || '#f59e0b');
      ctx.beginPath();
      ctx.roundRect(-s / 2, -s / 2, s, s, radius * 0.4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-s * 0.18, -s * 0.16, s * 0.14, s * 0.14);
      ctx.fillRect(s * 0.06, -s * 0.16, s * 0.14, s * 0.14);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  frame();
</script>`;

export const REACT_DESIGN_MODULE_CODE = `function useFolioDesignVars() {
  const v = (window as any).__FOLIO_VARS__ || {};
  return {
    themeColor: v.themeColor || '#2563eb',
    accentColor: v.accentColor || '#f59e0b',
    surfaceColor: v.surfaceColor || '#111827',
    textColor: v.textColor || '#f8fafc',
    animationSpeed: Number(v.animationSpeed || 1),
    spriteSize: Number(v.spriteSize || 48),
    borderRadius: Number(v.borderRadius || 14),
    seed: v.seed || 'none',
    glowIntensity: Number(v['glow-intensity'] ?? 0.65),
  };
}

export default function DesignVariableModule() {
  const vars = useFolioDesignVars();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, Math.max(24, Math.round(60 / Math.max(0.2, vars.animationSpeed))));
    return () => clearInterval(id);
  }, [vars.animationSpeed]);

  const sprites = useMemo(() => {
    const rng = (window as any).folioCreateRng
      ? (window as any).folioCreateRng(vars.seed)
      : Math.random;
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      offset: rng() * Math.PI * 2,
      useAccent: rng() > 0.5,
    }));
  }, [vars.seed]);

  return (
    <div
      style={{
        background: vars.surfaceColor,
        color: vars.textColor,
        borderRadius: vars.borderRadius,
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>React Design Variable Module</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.72 }}>
            Speed {vars.animationSpeed}x · Sprite {vars.spriteSize}px · Seed {String(vars.seed)}
          </p>
        </div>
        <span
          style={{
            padding: '6px 12px',
            borderRadius: vars.borderRadius,
            background: vars.themeColor,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Live Tokens
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', minHeight: 150 }}>
        {sprites.map((sp) => {
          const y = Math.sin(tick * 0.14 * vars.animationSpeed + sp.offset) * 20;
          const color = sp.useAccent ? vars.accentColor : vars.themeColor;
          return (
            <div
              key={sp.id}
              style={{
                width: vars.spriteSize,
                height: vars.spriteSize,
                borderRadius: Math.min(vars.spriteSize / 2, vars.borderRadius * 0.6),
                background: color,
                transform: \`translateY(\${y.toFixed(1)}px)\`,
                boxShadow: \`0 8px 24px rgba(0,0,0,0.35)\`,
                transition: 'width 150ms, height 150ms',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}`;
