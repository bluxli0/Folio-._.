import { FLET_PYTHON_SHIM, NICEGUI_PYTHON_SHIM } from './pythonUiShims';
import { DesignSystemConfig } from '../types/designSystem';
import {
  HTML_DESIGN_MODULE_CODE,
  REACT_DESIGN_MODULE_CODE,
  injectDesignSystemIntoSrcDoc,
} from './designSystem';

export type PreviewCategory =
  | 'html'
  | 'css'
  | 'react'
  | 'svg'
  | 'javascript'
  | 'markdown'
  | 'mermaid'
  | 'json'
  | 'csv'
  | 'flet'
  | 'nicegui'
  | 'pyscript'
  | 'sandpack'
  | 'stopmotion'
  | 'pixelart'
  | 'liquidmotion'
  | 'liquiddrop'
  | 'pixelmotion'
  | 'motiondrop'
  | 'evo'
  | 'simulated'
  | 'threejs'
  | 'chart'
  | 'quiz';

export function isMediaCodeCategory(category: PreviewCategory): boolean {
  return (
    category === 'stopmotion' ||
    category === 'pixelart' ||
    category === 'liquidmotion' ||
    category === 'liquiddrop' ||
    category === 'pixelmotion' ||
    category === 'motiondrop' ||
    category === 'evo' ||
    category === 'threejs' ||
    category === 'svg' ||
    category === 'chart' ||
    category === 'quiz'
  );
}

export interface PreviewLanguageOption {
  id: string;
  label: string;
  extension: string;
  category: PreviewCategory;
}

export const PREVIEW_LANGUAGE_OPTIONS: PreviewLanguageOption[] = [
  { id: 'html', label: 'HTML', extension: 'html', category: 'html' },
  { id: 'tsx', label: 'React (TSX)', extension: 'tsx', category: 'react' },
  { id: 'jsx', label: 'React (JSX)', extension: 'jsx', category: 'react' },
  { id: 'sandpack', label: 'Sandpack (React + npm)', extension: 'tsx', category: 'sandpack' },
  { id: 'vue', label: 'Vue 3 (Sandpack)', extension: 'vue', category: 'sandpack' },
  { id: 'svelte', label: 'Svelte (Sandpack)', extension: 'svelte', category: 'sandpack' },
  { id: 'solid', label: 'SolidJS (Sandpack)', extension: 'tsx', category: 'sandpack' },
  { id: 'svg', label: 'SVG', extension: 'svg', category: 'svg' },
  { id: 'css', label: 'CSS', extension: 'css', category: 'css' },
  { id: 'javascript', label: 'JavaScript', extension: 'js', category: 'javascript' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts', category: 'javascript' },
  { id: 'threejs', label: 'Three.js (3D WebGL)', extension: 'js', category: 'threejs' },
  { id: 'bbmodel', label: 'Blockbench (.bbmodel)', extension: 'bbmodel', category: 'threejs' },
  { id: 'p5', label: 'p5.js (Creative Coding)', extension: 'js', category: 'javascript' },
  { id: 'gsap', label: 'GSAP (GreenSock Motion)', extension: 'js', category: 'javascript' },
  { id: 'markdown', label: 'Markdown', extension: 'md', category: 'markdown' },
  { id: 'mermaid', label: 'Mermaid Diagram', extension: 'mmd', category: 'mermaid' },
  { id: 'stopmotion', label: 'Stop Motion v3 (Vector)', extension: 'json', category: 'stopmotion' },
  { id: 'pixelart', label: 'Pixel Art v3 (up to 512×512)', extension: 'json', category: 'pixelart' },
  { id: 'liquidmotion', label: 'Liquid Motion (Video Hybrid)', extension: 'json', category: 'liquidmotion' },
  { id: 'liquiddrop', label: 'Liquid Drop (Still Hybrid)', extension: 'json', category: 'liquiddrop' },
  { id: 'pixelmotion', label: 'Pixel Motion (Animated Pixel Video)', extension: 'json', category: 'pixelmotion' },
  { id: 'motiondrop', label: 'Motion Drop (3D + Pixel Still)', extension: 'json', category: 'motiondrop' },
  { id: 'evo', label: 'EVO 3D Engine (Three.js + Liquid Motion)', extension: 'json', category: 'evo' },
  { id: 'chart', label: 'Interactive Chart', extension: 'json', category: 'chart' },
  { id: 'quiz', label: 'Interactive Quiz', extension: 'json', category: 'quiz' },
  { id: 'json', label: 'JSON', extension: 'json', category: 'json' },
  { id: 'yaml', label: 'YAML', extension: 'yaml', category: 'simulated' },
  { id: 'toml', label: 'TOML', extension: 'toml', category: 'simulated' },
  { id: 'diff', label: 'Diff / Patch', extension: 'diff', category: 'simulated' },
  { id: 'latex', label: 'LaTeX / Math', extension: 'tex', category: 'simulated' },
  { id: 'csv', label: 'CSV Table', extension: 'csv', category: 'csv' },
  { id: 'flet', label: 'Flet (Python UI)', extension: 'py', category: 'flet' },
  { id: 'nicegui', label: 'NiceGUI (Python UI)', extension: 'py', category: 'nicegui' },
  { id: 'pyscript', label: 'PyScript (Browser Python)', extension: 'html', category: 'pyscript' },
  { id: 'python', label: 'Python 3 (Native)', extension: 'py', category: 'simulated' },
  { id: 'sql', label: 'SQL / SQLite (Native)', extension: 'sql', category: 'simulated' },
  { id: 'bash', label: 'Bash / Shell (Native)', extension: 'sh', category: 'simulated' },
  { id: 'rust', label: 'Rust (Simulated)', extension: 'rs', category: 'simulated' },
  { id: 'go', label: 'Go (Simulated)', extension: 'go', category: 'simulated' },
  { id: 'cpp', label: 'C++ (Simulated)', extension: 'cpp', category: 'simulated' },
  { id: 'java', label: 'Java (Simulated)', extension: 'java', category: 'simulated' },
];

export const NATIVE_EXEC_LANGUAGES = new Set([
  'python',
  'sql',
  'bash',
  'javascript',
  'typescript',
]);

export function isNativeExecutable(langId: string): boolean {
  return NATIVE_EXEC_LANGUAGES.has(langId);
}

export interface CodeStarterTemplate {
  id: string;
  label: string;
  language: string;
  code: string;
}

export const CODE_TEMPLATES: CodeStarterTemplate[] = [
  {
    id: 'html',
    label: 'HTML + CSS + JS',
    language: 'html',
    code: `<div style="max-width:420px;margin:24px auto;padding:24px;border-radius:16px;border:1px solid rgba(128,128,128,0.25);font-family:system-ui,sans-serif;">
  <h2 style="margin:0 0 8px;font-size:18px;">Iframe Renderer</h2>
  <p style="margin:0 0 16px;font-size:14px;opacity:0.8;">
    Edit HTML, CSS, or JavaScript on the Code tab or switch to Split view to see live iframe updates.
  </p>
  <button id="demo-btn" style="padding:8px 16px;border-radius:999px;border:none;background:#0d0d0d;color:#fff;cursor:pointer;font-size:13px;">
    Clicked 0 times
  </button>
</div>
<script>
  let count = 0;
  const btn = document.getElementById('demo-btn');
  btn.addEventListener('click', () => {
    count += 1;
    btn.textContent = 'Clicked ' + count + (count === 1 ? ' time' : ' times');
    console.log('Button click count:', count);
  });
</script>`,
  },
  {
    id: 'html-design-module',
    label: 'HTML Design Variables & Seed Module',
    language: 'html',
    code: HTML_DESIGN_MODULE_CODE,
  },
  {
    id: 'tsx',
    label: 'React (TSX)',
    language: 'tsx',
    code: `export default function CounterCard() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20, maxWidth: 380, margin: '16px auto', borderRadius: 14, border: '1px solid rgba(128,128,128,0.25)' }}>
      <h3 style={{ margin: '0 0 8px' }}>React Live Component</h3>
      <p style={{ margin: '0 0 14px', opacity: 0.75, fontSize: 14 }}>Count: {count}</p>
      <button
        onClick={() => {
          setCount((c) => c + 1);
          console.log('Incremented to', count + 1);
        }}
        style={{ padding: '8px 14px', borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', cursor: 'pointer' }}
      >
        Increment
      </button>
    </div>
  );
}`,
  },
  {
    id: 'react-design-module',
    label: 'React Design Variables & Seed Module',
    language: 'tsx',
    code: REACT_DESIGN_MODULE_CODE,
  },
  {
    id: 'python',
    label: 'Python 3',
    language: 'python',
    code: `import math

def primes_up_to(n):
    return [
        x for x in range(2, n + 1)
        if all(x % d != 0 for d in range(2, int(math.isqrt(x)) + 1))
    ]

primes = primes_up_to(50)
print(f"Found {len(primes)} primes up to 50:")
print(primes)`,
  },
  {
    id: 'sql',
    label: 'SQL (SQLite)',
    language: 'sql',
    code: `CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, stars INTEGER);
INSERT INTO projects (name, stars) VALUES ('Folio', 128), ('Parser', 64), ('Runner', 256);

SELECT name, stars
FROM projects
ORDER BY stars DESC;`,
  },
  {
    id: 'javascript',
    label: 'JS (DOM + Console)',
    language: 'javascript',
    code: `const app = document.createElement('div');
app.style.cssText = 'padding:16px;border-radius:12px;border:1px solid rgba(128,128,128,0.25);';
app.innerHTML = '<strong>Rendered from JS inside iframe</strong><p style="margin:6px 0 0;opacity:0.8">DOM elements and console logs both appear live.</p>';
document.body.appendChild(app);

const values = [10, 20, 30];
console.log('Sum:', values.reduce((a, b) => a + b, 0));`,
  },
  {
    id: 'flet',
    label: 'Flet (Python UI)',
    language: 'flet',
    code: `import flet as ft

def main(page: ft.Page):
    page.title = "Flet Counter"
    txt_number = ft.Text("0", size=28, weight=ft.FontWeight.BOLD)

    def minus_click(e):
        txt_number.value = str(int(txt_number.value) - 1)
        page.update()

    def plus_click(e):
        txt_number.value = str(int(txt_number.value) + 1)
        page.update()

    page.add(
        ft.Card(
            content=ft.Container(
                padding=20,
                content=ft.Column([
                    ft.Text("Flet Counter", size=18, weight=ft.FontWeight.W_600),
                    ft.Row(
                        [
                            ft.IconButton(ft.Icons.REMOVE, on_click=minus_click),
                            txt_number,
                            ft.IconButton(ft.Icons.ADD, on_click=plus_click),
                        ],
                        alignment=ft.MainAxisAlignment.CENTER,
                    ),
                ]),
            )
        )
    )

ft.app(target=main)`,
  },
  {
    id: 'nicegui',
    label: 'NiceGUI (Python UI)',
    language: 'nicegui',
    code: `from nicegui import ui

count = 0
with ui.card():
    ui.label('NiceGUI Interactive Card')
    status = ui.label('Clicks: 0')

    def increment():
        global count
        count += 1
        status.text = f'Clicks: {count}'
        ui.notify(f'Clicked {count} times!')

    with ui.row():
        ui.button('Increment', on_click=increment)
        ui.slider(min=0, max=100, value=40, on_change=lambda e: status.set_text(f'Slider: {int(e.value)}'))

ui.run()`,
  },
  {
    id: 'pyscript',
    label: 'PyScript (Browser)',
    language: 'pyscript',
    code: `<div style="font-family:system-ui,sans-serif;padding:16px;border-radius:12px;border:1px solid rgba(128,128,128,0.25);">
  <h3 style="margin:0 0 8px;">PyScript Browser Python</h3>
  <div id="py-out" style="font-family:monospace;font-size:14px;"></div>
</div>
  <script type="py">
  from pyscript import display
  import sys
  squares = [x * x for x in range(1, 7)]
  display(f"Python {sys.version.split()[0]} squares: {squares}", target="py-out")
</script>`,
  },
  {
    id: 'sandpack',
    label: 'Sandpack (React + npm)',
    language: 'sandpack',
    code: `import { useState } from 'react';
import confetti from 'canvas-confetti';

export default function App() {
  const [clicks, setClicks] = useState(0);

  const celebrate = () => {
    setClicks((c) => c + 1);
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.65 } });
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 400, margin: '24px auto', borderRadius: 16, border: '1px solid rgba(128,128,128,0.25)', textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 8px' }}>Sandpack npm Sandbox</h2>
      <p style={{ margin: '0 0 18px', opacity: 0.75, fontSize: 14 }}>
        Auto-resolves <code>canvas-confetti</code> from npm inside CodeSandbox Sandpack.
      </p>
      <button
        onClick={celebrate}
        style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
      >
        Celebrate ({clicks})
      </button>
    </div>
  );
}`,
  },
  {
    id: 'vue',
    label: 'Vue 3 (Sandpack)',
    language: 'vue',
    code: `<script setup>
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <div class="card">
    <h2>Vue 3 in Sandpack</h2>
    <p>Reactive counter: <strong>{{ count }}</strong></p>
    <button @click="count++">Increment</button>
  </div>
</template>

<style scoped>
.card {
  font-family: system-ui, sans-serif;
  max-width: 360px;
  margin: 24px auto;
  padding: 20px;
  border-radius: 14px;
  border: 1px solid rgba(128, 128, 128, 0.25);
}
button {
  margin-top: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  background: #10b981;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
</style>`,
  },
  {
    id: 'stopmotion',
    label: 'Stop Motion v2 (Engine)',
    language: 'stopmotion',
    code: `{
  "format": "stopmotion/v2",
  "title": "Glossy Kinetic Orb (48f)",
  "fps": 24,
  "frameCount": 48,
  "width": 800,
  "height": 450,
  "background": "#faf8f5",
  "loop": true,
  "backdrop": "<line x1=\\"80\\" y1=\\"365\\" x2=\\"720\\" y2=\\"365\\" stroke=\\"#cbd5e1\\" stroke-width=\\"2\\"/>",
  "layers": [
    {
      "id": "orb",
      "shadow": { "groundY": 365, "rx": 52, "ry": 11, "opacity": 0.24 },
      "motion": {
        "x": "lerp(180, 620, pingpong(t))",
        "y": "315 - abs(sin(t * TAU * 2)) * 175",
        "scaleX": "1 / (abs(sin(t * TAU * 2)) < 0.14 ? 0.68 : 1.04)",
        "scaleY": "abs(sin(t * TAU * 2)) < 0.14 ? 0.68 : 1.04"
      },
      "svg": "<circle cx=\\"0\\" cy=\\"0\\" r=\\"44\\" fill=\\"url(#wetGlazePink)\\"/><ellipse cx=\\"-14\\" cy=\\"-15\\" rx=\\"13\\" ry=\\"7\\" transform=\\"rotate(-30 -14 -15)\\" fill=\\"rgba(255,255,255,0.78)\\" style=\\"mix-blend-mode: screen;\\"/>"
    }
  ]
}`,
  },
  {
    id: 'evo-3d-demo',
    label: 'EVO 3D Engine (Three.js + Liquid Motion)',
    language: 'evo',
    code: `{
  "format": "evo/v1",
  "title": "Orbital Core",
  "width": 800,
  "height": 450,
  "fps": 30,
  "durationSec": 4,
  "loop": true,
  "environment": "neon",
  "background": "#050816",
  "nodes": [
    {
      "id": "core",
      "type": "icosahedron",
      "radius": 0.85,
      "material": { "color": "#38bdf8", "metalness": 0.4, "roughness": 0.2, "iridescence": 0.8 },
      "motion": { "spinY": 1, "bob": { "amp": 0.18, "freq": 1 } }
    },
    {
      "id": "halo",
      "type": "torus",
      "radius": 1.65,
      "tube": 0.08,
      "material": { "color": "#e879f9", "emissive": "#a855f7", "emissiveIntensity": 0.5 },
      "motion": { "rx": "35 + sin(t * TAU) * 25", "ry": "t * 360" }
    }
  ],
  "storyboard": {
    "shots": [
      { "label": "Hero Orbit", "start": 0, "end": 1, "cameraCut": "orbit" }
    ]
  },
  "audio": { "mode": "preset", "preset": "ambient", "durationSec": 4 }
}`,
  },
];

const ALIAS_MAP: Record<string, string> = {
  htm: 'html',
  html: 'html',
  react: 'tsx',
  tsx: 'tsx',
  jsx: 'jsx',
  sandpack: 'sandpack',
  vue: 'vue',
  svelte: 'svelte',
  solid: 'solid',
  solidjs: 'solid',
  svg: 'svg',
  css: 'css',
  scss: 'css',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  typescript: 'typescript',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  mermaid: 'mermaid',
  mmd: 'mermaid',
  stopmotion: 'stopmotion',
  'stop-motion': 'stopmotion',
  'vector-anim': 'stopmotion',
  'svg-frames': 'stopmotion',
  'svg-anim': 'stopmotion',
  pixelart: 'pixelart',
  'pixel-art': 'pixelart',
  pixart: 'pixelart',
  pixels: 'pixelart',
  liquidmotion: 'liquidmotion',
  'liquid-motion': 'liquidmotion',
  liquiddrop: 'liquiddrop',
  'liquid-drop': 'liquiddrop',
  pixelmotion: 'pixelmotion',
  'pixel-motion': 'pixelmotion',
  motiondrop: 'motiondrop',
  'motion-drop': 'motiondrop',
  evo: 'evo',
  evo3d: 'evo',
  'evo/v1': 'evo',
  json: 'json',
  jsonc: 'json',
  csv: 'csv',
  tsv: 'csv',
  py: 'python',
  python: 'python',
  python3: 'python',
  flet: 'flet',
  nicegui: 'nicegui',
  pyscript: 'pyscript',
  'py-script': 'pyscript',
  sql: 'sql',
  postgres: 'sql',
  postgresql: 'sql',
  sqlite: 'sql',
  mysql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',
  rs: 'rust',
  rust: 'rust',
  go: 'go',
  golang: 'go',
  c: 'cpp',
  cpp: 'cpp',
  'c++': 'cpp',
  java: 'java',
  three: 'threejs',
  threejs: 'threejs',
  'three.js': 'threejs',
  bbmodel: 'bbmodel',
  blockbench: 'bbmodel',
  chart: 'chart',
  charts: 'chart',
  rechart: 'chart',
  quiz: 'quiz',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  diff: 'diff',
  patch: 'diff',
  latex: 'latex',
  tex: 'latex',
  math: 'latex',
  p5: 'p5',
  p5js: 'p5',
  'p5.js': 'p5',
  gsap: 'gsap',
  greensock: 'gsap',
};

function detectPythonSubframework(code: string): 'flet' | 'nicegui' | 'pyscript' | null {
  if (/\b(import\s+flet|from\s+flet\s+import)\b/.test(code)) return 'flet';
  if (/\b(import\s+nicegui|from\s+nicegui\s+import)\b/.test(code)) return 'nicegui';
  if (/\b(import\s+pyscript|from\s+pyscript\s+import)\b/.test(code)) return 'pyscript';
  return null;
}

function isPyScriptHtml(code: string): boolean {
  return /<py-script\b|<script[^>]+type=["'](?:py|mpy)["']|pyscript\.net/i.test(code);
}

function isStopMotionJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    const parsed = JSON.parse(trimmed) as
      | { frames?: Array<unknown>; layers?: Array<unknown> }
      | Array<unknown>;
    if (!Array.isArray(parsed) && Array.isArray(parsed?.layers) && parsed.layers.length > 0) {
      return parsed.layers.some(
        (l) => Boolean(l && typeof l === 'object' && ('svg' in l || 'children' in l))
      );
    }
    const frames = Array.isArray(parsed) ? parsed : parsed?.frames;
    if (!Array.isArray(frames) || frames.length === 0) return false;
    return frames.some((f) => {
      if (typeof f === 'string') return /<svg[\s>]|data:image\//i.test(f);
      if (f && typeof f === 'object') {
        const obj = f as Record<string, unknown>;
        return typeof obj.svg === 'string' || typeof obj.dataUrl === 'string';
      }
      return false;
    });
  } catch {
    return false;
  }
}

function detectHybridFormatJson(
  code: string
): 'liquidmotion' | 'liquiddrop' | 'pixelmotion' | 'motiondrop' | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const fmt = typeof parsed.format === 'string' ? parsed.format.toLowerCase().trim() : '';
    if (
      fmt === 'liquidmotion' ||
      fmt === 'liquiddrop' ||
      fmt === 'pixelmotion' ||
      fmt === 'motiondrop'
    ) {
      return fmt;
    }
    return null;
  } catch {
    return null;
  }
}

function isPixelArtJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.format === 'pixelart/v2' || parsed.format === 'pixelart/v3') return true;
    const hasPalette = 'palette' in parsed;
    const hasPixelsOrFrames = 'frames' in parsed || 'pixels' in parsed || 'draw' in parsed || 'gradients' in parsed;
    const hasDimensions = 'width' in parsed || 'height' in parsed;
    return Boolean((hasPalette || 'draw' in parsed) && (hasPixelsOrFrames || hasDimensions));
  } catch {
    return false;
  }
}

function isBlockbenchOrVoxelJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (Array.isArray(parsed.elements) && ('outliner' in parsed || 'meta' in parsed || 'resolution' in parsed || 'textures' in parsed)) {
      return true;
    }
    if (Array.isArray(parsed.voxels) || Array.isArray(parsed.objects)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isChartJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const hasSeries = Array.isArray(parsed.series) || Array.isArray(parsed.datasets);
    const hasType = typeof parsed.type === 'string' && /^(bar|line|area|pie|donut|doughnut|scatter|radar)$/i.test(parsed.type);
    return Boolean(hasSeries && (hasType || Array.isArray(parsed.labels)));
  } catch {
    return false;
  }
}

function isQuizJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return Array.isArray(parsed.questions) && parsed.questions.length > 0;
  } catch {
    return false;
  }
}

function isMultiSvgFrames(code: string): boolean {
  const matches = code.match(/<svg[\s>]/gi);
  return Boolean(matches && matches.length >= 2);
}

function detectEvoJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const fmt = typeof parsed.format === 'string' ? parsed.format.toLowerCase().trim() : '';
    return fmt === 'evo/v1' || fmt === 'evo';
  } catch {
    return false;
  }
}

export function normalizeLanguage(rawLang?: string, code?: string): string {
  const cleaned = (rawLang || '').trim().toLowerCase();
  const rawCode = code || '';

  if (cleaned && ALIAS_MAP[cleaned]) {
    const mapped = ALIAS_MAP[cleaned];
    if (mapped === 'python') {
      return detectPythonSubframework(rawCode) || 'python';
    }
    if (mapped === 'html' && isPyScriptHtml(rawCode)) {
      return 'pyscript';
    }
    if (mapped === 'json') {
      if (detectEvoJson(rawCode)) return 'evo';
      const hybrid = detectHybridFormatJson(rawCode);
      if (hybrid) return hybrid;
      if (isPixelArtJson(rawCode)) return 'pixelart';
      if (isStopMotionJson(rawCode)) return 'stopmotion';
      if (isBlockbenchOrVoxelJson(rawCode)) return 'threejs';
      if (isChartJson(rawCode)) return 'chart';
      if (isQuizJson(rawCode)) return 'quiz';
    }
    if (mapped === 'svg' && isMultiSvgFrames(rawCode)) {
      return 'stopmotion';
    }
    return mapped;
  }

  if (cleaned) {
    return cleaned;
  }

  const trimmed = rawCode.trim();
  if (!trimmed) return 'html';

  if (isPyScriptHtml(trimmed)) {
    return 'pyscript';
  }
  const pySub = detectPythonSubframework(trimmed);
  if (pySub) return pySub;

  if (/^<template[\s>]/i.test(trimmed) && /<script[\s>]/i.test(trimmed)) {
    return 'vue';
  }
  if (/^<!doctype\s+html|^<html[\s>]|^<body[\s>]|^<div[\s>]|^<style[\s>]/i.test(trimmed)) {
    if (/\bclassName=/.test(trimmed) || /\buseState\b|\bexport\s+default\b/.test(trimmed)) {
      return 'tsx';
    }
    return 'html';
  }
  if (isMultiSvgFrames(trimmed)) return 'stopmotion';
  if (/^<svg[\s>]/i.test(trimmed)) return 'svg';
  if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)\b/m.test(trimmed)) {
    return 'mermaid';
  }
  if (/^(import\s+.*from\s+['"]react['"]|export\s+default\s+function|function\s+[A-Z])/.test(trimmed)) {
    return 'tsx';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const hybrid = detectHybridFormatJson(trimmed);
    if (hybrid) {
      return hybrid;
    }
    if (isPixelArtJson(trimmed)) {
      return 'pixelart';
    }
    if (isStopMotionJson(trimmed)) {
      return 'stopmotion';
    }
    if (isBlockbenchOrVoxelJson(trimmed)) {
      return 'threejs';
    }
    if (isChartJson(trimmed)) {
      return 'chart';
    }
    if (isQuizJson(trimmed)) {
      return 'quiz';
    }
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|WITH)\b/i.test(trimmed)) {
    return 'sql';
  }
  if (/^\s*(def\s+\w+|import\s+\w+|from\s+\w+\s+import|print\()/m.test(trimmed)) {
    return 'python';
  }
  if (/:\s*(string|number|boolean|Record<|Array<)|\binterface\s+\w+|\btype\s+\w+\s*=/.test(trimmed)) {
    return 'typescript';
  }
  if (/^\s*(const|let|var|function|console\.log)\b/m.test(trimmed)) {
    return 'javascript';
  }
  if (/^[.#]?[a-zA-Z0-9_-]+\s*\{[^}]*:[^}]*\}/m.test(trimmed)) {
    return 'css';
  }
  if (/^#{1,3}\s+/m.test(trimmed)) {
    return 'markdown';
  }

  return 'javascript';
}

export function getPreviewCategory(langId: string): PreviewCategory {
  const found = PREVIEW_LANGUAGE_OPTIONS.find((opt) => opt.id === langId);
  if (found) return found.category;
  return 'simulated';
}

export function getFileExtension(langId: string): string {
  const found = PREVIEW_LANGUAGE_OPTIONS.find((opt) => opt.id === langId);
  return found?.extension || langId || 'txt';
}

function getLibrariesBundleScripts(): string {
  const origin =
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
      ? window.location.origin
      : '';
  return `
<script src="${origin}/api/vendor/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"></script>
`;
}

const CONSOLE_BRIDGE_SCRIPT = `
${getLibrariesBundleScripts()}
<script>
(function() {
  function serialize(arg) {
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean' || arg === null || arg === undefined) {
      return String(arg);
    }
    try {
      return JSON.stringify(arg, null, 2);
    } catch (e) {
      return String(arg);
    }
  }
  ['log', 'info', 'warn', 'error'].forEach(function(level) {
    var orig = console[level];
    console[level] = function() {
      var args = Array.prototype.slice.call(arguments).map(serialize);
      try {
        parent.postMessage({ source: 'folio-preview', type: 'console', level: level, text: args.join(' ') }, '*');
      } catch (e) {}
      if (orig) orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function(e) {
    try {
      parent.postMessage({ source: 'folio-preview', type: 'console', level: 'error', text: e.message || 'Runtime error' }, '*');
    } catch (err) {}
  });
  window.addEventListener('unhandledrejection', function(e) {
    try {
      var reason = e.reason && e.reason.message ? e.reason.message : String(e.reason);
      parent.postMessage({ source: 'folio-preview', type: 'console', level: 'error', text: 'Unhandled rejection: ' + reason }, '*');
    } catch (err) {}
  });
})();
</script>
`;

export function buildHtmlSrcDoc(
  html: string,
  darkCanvas: boolean,
  designSystem?: DesignSystemConfig
): string {
  const trimmed = html.trim();
  const baseBg = darkCanvas ? '#18181b' : '#ffffff';
  const baseFg = darkCanvas ? '#f4f4f5' : '#111827';
  const baseCss = `<style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; background: ${baseBg}; color: ${baseFg}; line-height: 1.5; }
  </style>`;

  if (/<html[\s>]/i.test(trimmed) || /^<!doctype/i.test(trimmed)) {
    const withConsole = /<head[\s>]/i.test(trimmed)
      ? trimmed.replace(/<head([^>]*)>/i, `<head$1>${CONSOLE_BRIDGE_SCRIPT}`)
      : `${CONSOLE_BRIDGE_SCRIPT}${trimmed}`;
    return injectDesignSystemIntoSrcDoc(withConsole, designSystem);
  }

  const doc = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${baseCss}
  ${CONSOLE_BRIDGE_SCRIPT}
</head>
<body>
${trimmed}
</body>
</html>`;
  return injectDesignSystemIntoSrcDoc(doc, designSystem);
}

export function buildCssSrcDoc(
  css: string,
  darkCanvas: boolean,
  designSystem?: DesignSystemConfig
): string {
  const bg = darkCanvas ? '#18181b' : '#ffffff';
  const fg = darkCanvas ? '#f4f4f5' : '#111827';
  const doc = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; color: ${fg}; }
  </style>
  <style>${css}</style>
  ${CONSOLE_BRIDGE_SCRIPT}
</head>
<body>
  <div class="container card box panel">
    <h1>Heading Preview</h1>
    <p>Paragraph text showing typography, spacing, and link styling <a href="#preview">Sample link</a>.</p>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
      <button type="button" class="btn button primary">Primary Button</button>
      <button type="button" class="btn button secondary">Secondary Button</button>
    </div>
  </div>
</body>
</html>`;
  return injectDesignSystemIntoSrcDoc(doc, designSystem);
}

export function buildReactSrcDoc(
  bundledJs: string,
  darkCanvas: boolean,
  designSystem?: DesignSystemConfig
): string {
  const bg = darkCanvas ? '#18181b' : '#ffffff';
  const fg = darkCanvas ? '#f4f4f5' : '#111827';
  const safeJs = bundledJs.replace(/<\/script>/gi, '<\\/script>');
  const doc = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; color: ${fg}; line-height: 1.5; }
    button, input, select, textarea { font: inherit; }
  </style>
  ${CONSOLE_BRIDGE_SCRIPT}
</head>
<body>
  <div id="root"></div>
  <script>${safeJs}</script>
</body>
</html>`;
  return injectDesignSystemIntoSrcDoc(doc, designSystem);
}

export function buildJsRunnerSrcDoc(
  compiledJs: string,
  darkCanvas = false,
  designSystem?: DesignSystemConfig
): string {
  const bg = darkCanvas ? '#18181b' : '#ffffff';
  const fg = darkCanvas ? '#f4f4f5' : '#111827';
  const safeJs = compiledJs.replace(/<\/script>/gi, '<\\/script>');
  const doc = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; color: ${fg}; line-height: 1.5; }
  </style>
  ${CONSOLE_BRIDGE_SCRIPT}
</head>
<body>
  <script>
    (function() {
      var start = performance.now();
      try {
        ${safeJs}
        if (typeof window.setup === 'function' && typeof window.p5 === 'function' && !window._p5Inst) {
          window._p5Inst = new window.p5();
        }
        var elapsed = (performance.now() - start).toFixed(1);
        var hasDom = Array.prototype.slice.call(document.body.children).some(function(el) { return el.tagName !== 'SCRIPT'; }) || document.body.innerText.trim().length > 0;
        parent.postMessage({ source: 'folio-preview', type: 'done', elapsedMs: elapsed, hasDomOutput: hasDom }, '*');
      } catch (err) {
        parent.postMessage({ source: 'folio-preview', type: 'console', level: 'error', text: err && err.message ? err.message : String(err) }, '*');
        parent.postMessage({ source: 'folio-preview', type: 'done', elapsedMs: (performance.now() - start).toFixed(1), hasDomOutput: false }, '*');
      }
    })();
  </script>
</body>
</html>`;
  return injectDesignSystemIntoSrcDoc(doc, designSystem);
}

function buildPyodideUiRunnerSrcDoc(opts: {
  title: string;
  rootId: string;
  moduleName: 'flet' | 'nicegui';
  shimSource: string;
  userCode: string;
  darkCanvas: boolean;
}): string {
  const bg = opts.darkCanvas ? '#18181b' : '#f8fafc';
  const fg = opts.darkCanvas ? '#f4f4f5' : '#0f172a';
  const surface = opts.darkCanvas ? '#27272a' : '#ffffff';
  const border = opts.darkCanvas ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';
  const inputBg = opts.darkCanvas ? '#18181b' : '#ffffff';
  const muted = opts.darkCanvas ? '#a1a1aa' : '#64748b';

  const safeShim = JSON.stringify(opts.shimSource).replace(/<\/script>/gi, '<\\/script>');
  const safeCode = JSON.stringify(opts.userCode).replace(/<\/script>/gi, '<\\/script>');

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0,0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${bg};
      color: ${fg};
      line-height: 1.5;
    }
    .py-loader {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 12px;
      background: ${surface};
      border: 1px solid ${border};
      font-size: 13px;
      color: ${muted};
    }
    .py-loader-spin {
      width: 16px; height: 16px;
      border-radius: 999px;
      border: 2px solid ${border};
      border-top-color: #2563eb;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .py-err {
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid rgba(239,68,68,0.45);
      background: rgba(239,68,68,0.1);
      color: ${opts.darkCanvas ? '#fca5a5' : '#b91c1c'};
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      white-space: pre-wrap;
      overflow-x: auto;
    }

    /* Flet & NiceGUI shared Material/Quasar-inspired styles */
    .ft-col, .ng-col { display: flex; flex-direction: column; gap: 10px; }
    .ft-row, .ng-row { display: flex; flex-direction: row; align-items: center; gap: 10px; flex-wrap: wrap; }
    .ng-grid { display: grid; gap: 12px; }
    .ft-card, .ng-card {
      background: ${surface};
      border: 1px solid ${border};
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ft-appbar {
      padding: 12px 16px;
      border-radius: 12px;
      background: #2563eb;
      color: #fff;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .ft-text, .ng-label { font-size: 14.5px; }
    .ft-markdown, .ng-markdown {
      margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 14px;
    }
    .ft-btn, .ng-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 500;
      cursor: pointer; border: 1px solid transparent; transition: opacity 0.15s, transform 0.1s;
    }
    .ft-btn:active, .ng-btn:active { transform: scale(0.98); }
    .ft-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .ft-btn-elevated { background: ${surface}; color: #2563eb; border-color: ${border}; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .ft-btn-filled, .ng-btn { background: #2563eb; color: #ffffff; }
    .ft-btn-tonal { background: rgba(37,99,235,0.14); color: ${opts.darkCanvas ? '#93c5fd' : '#1d4ed8'}; }
    .ft-btn-outlined { background: transparent; color: ${fg}; border-color: ${border}; }
    .ft-btn-text { background: transparent; color: #2563eb; padding: 6px 10px; }
    .ft-btn-icon { background: transparent; color: ${fg}; padding: 8px; border-radius: 999px; }
    .ft-btn-icon:hover { background: rgba(128,128,128,0.14); }
    .ft-field, .ng-field { display: flex; flex-direction: column; gap: 4px; }
    .ft-field-label, .ng-field-label { font-size: 12px; font-weight: 500; color: ${muted}; }
    .ft-input, .ng-input {
      width: 100%; padding: 8px 11px; border-radius: 9px;
      border: 1px solid ${border}; background: ${inputBg}; color: ${fg};
      font-size: 13.5px; font-family: inherit; outline: none;
    }
    .ft-input:focus, .ng-input:focus { border-color: #2563eb; }
    .ft-check-row, .ng-check-row {
      display: inline-flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;
    }
    .ft-slider-wrap, .ng-slider-wrap { display: flex; align-items: center; gap: 10px; width: 100%; }
    .ft-slider-wrap input[type=range], .ng-slider-wrap input[type=range] { flex: 1; accent-color: #2563eb; }
    .ft-slider-val, .ng-slider-val { font-size: 12px; font-family: monospace; min-width: 32px; text-align: right; color: ${muted}; }
    .ft-divider, .ng-separator { border: 0; border-top: 1px solid ${border}; margin: 4px 0; width: 100%; }
    .ft-progress-track, .ng-progress-track { width: 100%; height: 6px; border-radius: 999px; background: ${border}; overflow: hidden; }
    .ft-progress-fill, .ng-progress-fill { height: 100%; background: #2563eb; transition: width 0.2s; }
    .ft-progress-fill.indeterminate { width: 45% !important; animation: indet 1.2s ease-in-out infinite; }
    @keyframes indet { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
    .ft-spinner { width: 22px; height: 22px; border-radius: 999px; border: 2.5px solid ${border}; border-top-color: #2563eb; animation: spin 0.8s linear infinite; }
    .ft-tab-bar { display: flex; gap: 4px; border-bottom: 1px solid ${border}; margin-bottom: 10px; }
    .ft-tab-btn { background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 8px 12px; color: ${muted}; font-size: 13px; font-weight: 500; cursor: pointer; }
    .ft-tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }
    .ft-table, .ng-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .ft-table th, .ft-table td, .ng-table th, .ng-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid ${border}; }
    .ft-table th, .ng-table th { font-weight: 600; color: ${muted}; }
    .ng-table-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
    .ng-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 11px; font-weight: 600; width: fit-content; }
    .ng-chip { background: rgba(128,128,128,0.14); color: ${fg}; border-radius: 999px; padding: 5px 12px; font-size: 12.5px; }
    .ng-expansion { border: 1px solid ${border}; border-radius: 10px; padding: 8px 12px; background: ${surface}; }
    .ng-expansion summary { cursor: pointer; font-weight: 500; font-size: 13.5px; }
    .ft-dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
    .ft-dialog { background: ${surface}; border: 1px solid ${border}; border-radius: 16px; padding: 18px; max-width: 380px; width: 100%; display: flex; flex-direction: column; gap: 12px; }
    .ft-dialog-title { font-weight: 600; font-size: 16px; }
    .ft-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .ft-snackbar, .ng-toast { position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%); background: #111827; color: #fff; padding: 8px 14px; border-radius: 10px; font-size: 12.5px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); z-index: 60; }
    .material-symbols-rounded { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; user-select: none; }
  </style>
  ${CONSOLE_BRIDGE_SCRIPT}
</head>
<body>
  <div id="loader" class="py-loader">
    <div class="py-loader-spin"></div>
    <span>Initializing ${opts.title} sandbox...</span>
  </div>
  <div id="${opts.rootId}"></div>
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"></script>
  <script>
    (async function() {
      var loader = document.getElementById('loader');
      var root = document.getElementById('${opts.rootId}');
      try {
        if (typeof loadPyodide !== 'function') {
          throw new Error('Could not load Pyodide runtime from CDN.');
        }
        var pyodide = await loadPyodide({
          stdout: function(txt) { console.log(txt); },
          stderr: function(txt) { console.error(txt); }
        });
        pyodide.FS.writeFile('/home/pyodide/${opts.moduleName}.py', ${safeShim});
        await pyodide.runPythonAsync(${safeCode});
        if (loader) loader.remove();
      } catch (err) {
        if (loader) loader.remove();
        var msg = err && err.message ? err.message : String(err);
        console.error(msg);
        var box = document.createElement('div');
        box.className = 'py-err';
        box.textContent = msg;
        root.appendChild(box);
      }
    })();
  </script>
</body>
</html>`;
}

export function buildFletSrcDoc(code: string, darkCanvas: boolean): string {
  return buildPyodideUiRunnerSrcDoc({
    title: 'Flet',
    rootId: 'flet-root',
    moduleName: 'flet',
    shimSource: FLET_PYTHON_SHIM,
    userCode: code,
    darkCanvas,
  });
}

export function buildNiceGuiSrcDoc(code: string, darkCanvas: boolean): string {
  return buildPyodideUiRunnerSrcDoc({
    title: 'NiceGUI',
    rootId: 'nicegui-root',
    moduleName: 'nicegui',
    shimSource: NICEGUI_PYTHON_SHIM,
    userCode: code,
    darkCanvas,
  });
}

export function buildPyScriptSrcDoc(code: string, darkCanvas: boolean): string {
  const trimmed = code.trim();
  const bg = darkCanvas ? '#18181b' : '#ffffff';
  const fg = darkCanvas ? '#f4f4f5' : '#111827';
  const muted = darkCanvas ? '#a1a1aa' : '#64748b';

  const pyScriptTags = `
  <link rel="stylesheet" href="https://pyscript.net/releases/2024.11.1/core.css" />
  <script type="module" src="https://pyscript.net/releases/2024.11.1/core.js"></script>`;

  const loaderCssAndScript = `
  <style>
    .ps-banner {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 12px; margin-bottom: 12px; border-radius: 999px;
      font-family: system-ui, sans-serif; font-size: 12px;
      color: ${muted}; background: rgba(128,128,128,0.12);
    }
  </style>
  <script>
    window.addEventListener('py:ready', function() {
      var b = document.getElementById('ps-loading-banner');
      if (b) b.remove();
    });
    window.addEventListener('mpy:ready', function() {
      var b = document.getElementById('ps-loading-banner');
      if (b) b.remove();
    });
  </script>`;

  const hasPyScriptRuntime = /pyscript\.net\/releases/i.test(trimmed);
  const looksLikeHtml = /<(?:html|body|div|p|h1|h2|h3|button|input|script|py-script|style|section|main|!doctype)/i.test(trimmed);

  if (looksLikeHtml) {
    const baseStyle = `<style>
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; color: ${fg}; line-height: 1.5; }
    </style>`;
    const injectHead = `${baseStyle}${hasPyScriptRuntime ? '' : pyScriptTags}${CONSOLE_BRIDGE_SCRIPT}${loaderCssAndScript}`;
    const banner = `<div id="ps-loading-banner" class="ps-banner">Initializing PyScript runtime...</div>`;

    if (/<html[\s>]/i.test(trimmed) || /^<!doctype/i.test(trimmed)) {
      let out = /<head[\s>]/i.test(trimmed)
        ? trimmed.replace(/<head([^>]*)>/i, `<head$1>${injectHead}`)
        : `${injectHead}${trimmed}`;
      if (/<body[^>]*>/i.test(out)) {
        out = out.replace(/<body([^>]*)>/i, `<body$1>${banner}`);
      }
      return out;
    }

    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${injectHead}
</head>
<body>
  ${banner}
  ${trimmed}
</body>
</html>`;
  }

  // Raw Python wrapped inside PyScript <script type="py">
  const safePy = trimmed.replace(/<\/script>/gi, '<\\/script>');
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; color: ${fg}; line-height: 1.5; }
    #py-output { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13.5px; white-space: pre-wrap; }
  </style>
  ${pyScriptTags}
  ${CONSOLE_BRIDGE_SCRIPT}
  ${loaderCssAndScript}
</head>
<body>
  <div id="ps-loading-banner" class="ps-banner">Initializing PyScript runtime...</div>
  <div id="py-output"></div>
  <script type="py" target="py-output">
${safePy}
  </script>
</body>
</html>`;
}

export function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const normalized = raw.replace(/\r\n/g, '\n').trim();
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}
