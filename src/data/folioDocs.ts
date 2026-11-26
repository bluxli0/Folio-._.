import { FOLIO_CHANGELOGS, FOLIO_CURRENT_VERSION } from './changelogs';

export interface FolioDocSection {
  id: string;
  title: string;
  category: 'Overview' | 'Models' | 'Engines' | 'CLI & SDK' | 'Operations' | 'Changelog';
  summary: string;
  keywords: string[];
  content: string;
  codeExample?: {
    language: string;
    label: string;
    code: string;
  };
}

export const FOLIO_DOCS_SECTIONS: FolioDocSection[] = [
  {
    id: 'overview',
    title: 'Folio Architecture & Grounding System',
    category: 'Overview',
    summary:
      'How Folio combines cloud Gemini models, local Neo 4 disk-sharded knowledge, strict creative schemas, and 4 GB RAM safeguards.',
    keywords: ['architecture', 'overview', 'folio', 'zero', 'core', 'grounding', 'accuracy'],
    content: `Folio (${FOLIO_CURRENT_VERSION}) is a multi-model creative engineering studio and AI orchestration runtime designed to minimize model mistakes and schema hallucinations.

Key Principles for Model Accuracy:
1. Grounded Tooling (\`folio_docs_lookup\` + \`validate_creative_code\`): Cloud models can query exact Folio specs and validate \`stopmotion/v3\`, \`pixelart/v3\`, \`evo/v1\`, \`threejs/v1\`, and \`liquidmotion/v1\` payloads before returning them.
2. Targeted Prompt Context: Only relevant engine guides and doc snippets are injected per prompt, keeping context tight and preventing instruction drift.
3. Disk-Backed Sharded RAG: Large knowledge bases (WordNet, Wikipedia/Wiktionary dumps, Folio Docs, Changelogs) live in SQLite FTS5 + BM25 disk shards (\`cache_size=-16384\`, ~16 MB RAM), leaving RAM free for reasoning.
4. Resilient Fallback & RAM Guard: If a cloud model hits 503/429, Auto Fallback routes through Flash Lite / Gemini 2.5 GA models and falls back to local Neo 4 if all cloud endpoints are busy. A 4 GB RAM watchdog guards heavy subprocesses.`,
  },
  {
    id: 'models',
    title: 'AI Models, Auto Router & Neo 4 Hybrid Engine',
    category: 'Models',
    summary:
      'Grouped Gemini 4 Series, Gemini 3.8 Flash, Gemini Extended Live, Gemma 3 27B/12B, Auto Router, and Neo 4 LLM/Rule + Remote Bridge.',
    keywords: ['models', 'auto', 'gemini 4', 'hydrogen', 'neon', 'carbon', 'argon', 'flash 3.8', 'live extended', 'gemma', 'neo4', 'tiny llm', 'remote', 'fallback'],
    content: `Available Model Groups:
- Smart Routing (\`auto\`): Intent-aware router that picks Flash Lite 3.1 for fast chat, Hydrogen 4 for 3D/math/creative scenes, and automatically routes around models in 503/429 cooldown.
- Gemini 4 Series: \`flash-4\`, \`hydrogen-4-fast\`, \`hydrogen-4-balanced\`, \`hydrogen-4-deep\` (\`gemini-4-hydrogen\`), plus \`neon-4\` (\`gemini-4-neon\`), \`carbon-4\` (\`gemini-4-carbon\`), and \`argon-4\` (\`gemini-4-argon\`, Paid).
- Gemini 3 Series & Live: \`flash-3.8\` (\`gemini-3.8-flash\`), \`flash-lite-3.1\` (\`gemini-3.1-flash-lite\`), \`omni-flash-1.2\` (\`gemini-omni-1.2-flash\`), and \`live-extended-3.8\` (\`gemini-3.8-live-extended-thinking\` via Live API with \`Behavior.NON_BLOCKING\` async tool calling).
- Gemma Open Models: \`gemma-3-27b\` (\`gemma-3-27b-it\`) and \`gemma-3-12b\` (\`gemma-3-12b-it\`).
- Local & Remote Hybrid (\`neo-4\`): Switchable directly in the model dropdown between \`LLM\` mode ("When using LLM it's smarter" — runs local quantized Qwen2.5 1.5B/0.5B GGUFs via \`llama.cpp\` or offloads 0 MB local RAM to \`FOLIO_REMOTE_LLM_URL\`) and \`Rule AI\` mode ("When using rule-based Markov chains 🥀" — deterministic OSASCOMP + Markov + AST solver).
- Image Synthesis (\`nano-banana-lite\`): Direct image generation (\`gemini-3.1-flash-lite-image\`).`,
  },
  {
    id: 'stopmotion',
    title: 'Stop Motion v3 Engine (Vector, Physics & Storyboard)',
    category: 'Engines',
    summary:
      'Procedural SVG vector animation format (stopmotion/v3) with 16 brushes, 22 defs, 120+ math functions, 36 easings, particles, and camera storyboards.',
    keywords: ['stopmotion', 'svg', 'brush', 'defs', 'curve', 'storyboard', 'particles', 'physics'],
    content: `Format: \`\`\`stopmotion with \`"format": "stopmotion/v3"\`.
Core Capabilities:
- Multi-layer \`layers\` array (5–14 rich layers recommended) with \`parallax\`, \`depth\`, \`blendMode\`, \`visibleFrom\`/\`visibleTo\`, \`shadow\`, and \`filter\`.
- Built-in \`<defs>\` presets: \`wetGlazeCyan\`, \`wetGlazePink\`, \`wetGlazeCaramel\`, \`wetGlazeEmerald\`, \`wetGlazePurple\`, \`wetGlazeCrimson\`, \`wetGlazeObsidian\`, \`metallicGold\`, \`metallicSteel\`, \`metallicCopper\`, \`metallicChrome\`, \`metallicRoseGold\`, \`iridescentHologram\`, \`glassSphere\`, \`sunsetSkyGrad\`, \`cyberNightGrad\`, \`auroraRibbonGrad\`, \`lavaMagmaGrad\`, \`softGlow\`, \`neonBloom\`, \`tactileDoughWarp\`, \`paperGrain\`, \`claySculpt\`, \`watercolorBleed\`, \`motionBlurX/Y\`, \`frostedGlass\`, \`embossBevel\`, \`inkOutline\`, \`glitchSlice\`.
- 16 Vector Brushes: \`spray, charcoal, ribbon, sparkle, doubleline, stipple, neon, chalk, watercolor, marker, calligraphy, dashed, glow, pixel, rough, solid\`.
- 21 Curves (\`hilbert, dragon, koch, lissajous, spirograph, rose, spiral, butterfly, cardioid, lemniscate, astroid, hypocycloid, epicycloid, fermat, archimedes, phyllotaxis, sinewave, fourier, bezier, catmull, starpolygon, graph\`) + procedural \`particles\` (\`circle, star, spark, snow, smoke, confetti, bubble\`).
- Motion & Storyboard: 36 easings, \`shake, flicker, spiral, bezierPath, trail, bounceAmp, squashStretch\`, \`cameraCut\` (\`wide, medium, closeup, dutch, overhead, orbit, zoomIn, zoomOut, panLeft, panRight, shake, tilt\`), \`uiAngle\`, and \`effect\` (\`crt, cyberpunk, sepia, noir, vignette, bloom, grain\`).`,
    codeExample: {
      language: 'json',
      label: 'Minimal valid stopmotion/v3 block',
      code: `{
  "format": "stopmotion/v3",
  "title": "Neon Studio Stage",
  "width": 640,
  "height": 360,
  "fps": 24,
  "durationSec": 4,
  "effect": "cyberpunk",
  "particles": { "count": 28, "color": "#38bdf8", "style": "sparkle" },
  "layers": [
    {
      "id": "orb",
      "type": "circle",
      "cx": 320,
      "cy": 180,
      "r": 42,
      "fill": "url(#wetGlazeCyan)",
      "motion": { "bounceAmp": 24, "easing": "easeOutBounce", "trail": true }
    }
  ],
  "audio": { "mode": "preset", "preset": "chime_celesta", "durationSec": 4 }
}`,
    },
  },
  {
    id: 'pixelart',
    title: 'Pixel Engine v3 (Procedural Raster & Shaders)',
    category: 'Engines',
    summary:
      'Procedural & sprite-based pixel animation engine up to 512x512 with 13 named palettes, 30+ draw ops, dithered gradients, and 18 post shaders.',
    keywords: ['pixelart', 'pixel', 'palette', 'shaders', 'bayer', 'draw', 'sprite', 'raster'],
    content: `Format: \`\`\`pixelart with \`"format": "pixelart/v3"\`.
Important Rule: Procedural \`pixelart/v3\` scenes using \`draw\` or \`backdrop\` do NOT require a \`frames\` array (the parser compiles procedural ops into frames automatically up to 512×512).

Core Capabilities:
- 13 Named Palettes (\`"palette": "..."\`): \`pico8, cyberpunk, endesga32, gameboy, sweetie16, fantasy24, synthwave, lava, ice, pastel, noir, forest, gold\`.
- Gradients & Dithers: \`linear, radial, conic, diamond, spiral, noise\` with \`dither: "bayer4"|"bayer8"|"bayer2"|"checker"|"halftone"\`.
- 30+ Procedural \`draw\` Ops: \`gradient, aurora, stardust/particles, plasma, water/waves, fire/flame, rain, snow, lightning/bolt, graph/plot, sphere3d, box3d, pyramid3d, torus3d, ring, arc, wedge, star, diamond, hexagon, regularpoly, roundrect, capsule, bezier, checker, grid, scanlines, dropshadow, specular, text/bitmaptext, sprite/tile, mirror, outline, physicsball, physicsbox, hitbox, circle, ellipse, rect, polygon, line, pset\`.
- Blend & Visibility: \`blendMode\` (\`normal, add, multiply, screen, overlay\`), \`opacity\`, \`visibleFrom\`, \`visibleTo\`.
- 18 Shaders: \`vignette, scanline, crt, chromatic, glow, bloom, posterize, dither, outline, halftone, sepia, invert, pixelate, glitch, emboss, edge, tint, duotone\`.`,
  },
  {
    id: 'evo3d',
    title: 'EVO 3D Engine (PBR Scenes, Physics & Hitboxes)',
    category: 'Engines',
    summary:
      'Interactive Three.js-powered declarative 3D engine (evo/v1) requiring a non-empty nodes array with PBR presets, starfields, physics, and hitboxes.',
    keywords: ['evo', '3d', 'nodes', 'pbr', 'hitbox', 'physics', 'starfield', 'gear', 'helix'],
    content: `Format: \`\`\`evo with \`"format": "evo/v1"\`.
Critical Schema Rule: ALWAYS include a non-empty top-level \`"nodes": [ ... ]\` array of 3D primitives (never leave \`nodes\` empty).

Core Capabilities:
- Geometries: \`sphere, box, cylinder, cone, torus, torusKnot, plane, ring, capsule, octahedron, icosahedron, dodecahedron, tetrahedron, prism, pyramid, helix, mobius, klein, lathe, gear, star3d, voxelGrid, particles3d, axes3d, wireCube, graph\`.
- 14 PBR Material Presets (\`material.preset\`): \`glass, chrome, gold, neon, hologram, clay, toon, carbon, obsidian, lava, ice, emerald, copper, pearl\`, plus \`gradient\`, \`sheen\`, \`flatShading\`, \`emissivePulse\`.
- Environments & Atmosphere: \`neon, studio, dusk, space, forest, cyberpunk, arctic, desert, cosmic, vaporwave, midnight, goldenHour\`, \`starfield: true\`, \`fog\`, \`gridFloor\`, \`contactShadows\`, \`exposure\`.
- Motion & Rigid-Body Physics: \`spinX/Y/Z, orbitX/Y, waveY, bounceAmp, lissajous, spiral\`, \`physics\` (\`velocity, gravity, restitution, floorY, drag, attractor, collidable\`), and \`hitbox\`.`,
  },
  {
    id: 'threejs-hybrid',
    title: 'Three.js Studio & Cross-Engine Hybrid Formats',
    category: 'Engines',
    summary:
      'Declarative threejs/v1 scenes plus liquidmotion, liquiddrop, pixelmotion, and motiondrop cross-engine compositing.',
    keywords: ['threejs', 'hybrid', 'liquidmotion', 'liquiddrop', 'pixelmotion', 'motiondrop'],
    content: `Three.js Studio (\`\`\`threejs — \`"format": "threejs/v1"\`):
- Uses \`"objects": [ ... ]\` with all 20+ geometries (\`helix, gear, dodecahedron, star3d, graph\`, etc.), 12+ PBR materials, 7+ lighting presets, \`starfield\`, \`fogColor/fogDensity\`, \`gridFloor\`, \`cameraFov\`, \`exposure\`, \`repeat\`, and physics \`drag\`/\`attractor\`.

Hybrid Formats (\`\`\`liquidmotion, \`\`\`liquiddrop, \`\`\`pixelmotion, \`\`\`motiondrop):
- Composite a procedural \`pixelBackdrop\` (\`pixelart/v3\`) beneath crisp SVG Stop Motion v3 \`layers\` using \`pixelScale\`, \`pixelBlendMode\`, \`pixelOpacity\`, \`particles\`, \`lighting.rimColor\`, \`letterbox\`, \`frameOverlay\`, \`postFilter\`, and \`audio\`.`,
  },
  {
    id: 'audio-math',
    title: 'Unified Math (120+ Funcs), 36 Easings & Audio Synth',
    category: 'Engines',
    summary:
      'Shared AST expression evaluator across all engines plus 20 WebAudio synth presets and 25 synthesis primitives.',
    keywords: ['math', 'easing', 'audio', 'synth', 'fm', 'waveform', 'noise', 'fbm', 'physics'],
    content: `Unified Math Core (\`src/utils/mathFunctions.ts\`):
- Constants: \`PI, TAU, E, PHI, SQRT2, DEG2RAD, RAD2DEG\`.
- 120+ Safe AST Functions: trig/hyperbolic (\`sin, cos, tan, sinh, cosh, tanh, sinc\`), shaping (\`clamp, saturate, lerp, remap, smoothstep, smootherstep, gain, bias, impulse, gaussian, sigmoid\`), waveforms (\`pingpong, sawtooth, triangle, square, pwm\`), noise (\`noise, perlin1d, fbm, turbulence, ridges, voronoi1d\`), physics/geometry (\`gravity, projectilex, projectiley, bouncepos, spring, dampedsine, pendulum, orbitx, orbity, lissajousx, lissajousy, aabbhit, circlehit, box3dhit, spherehit\`), and all 36 easing curves (\`easeInOutCubic, easeOutBounce, easeOutElastic, easeOutBack\`, etc.).

Math Audio Synth (\`audio\` block):
- 20 Presets (\`ambient_chime, sci_fi_arp, cyberpunk_arp, retro_8bit, crystal_bells, deep_drone, arcade_jump, laser_pulse, rain_noise, heartbeat, lofi_chord, quantum_pad, warp_riser, marimba, orchestral_brass, bounce, chimes, synth_pulse, bass_groove, glitch\`) or custom AST \`formula\` using \`fm, pm, ringmod, lfo, chorus, vibrato, tremolo, bitcrush, fold, softclip, midi2hz, chord3, chord4, pink, white\`.`,
  },
  {
    id: 'cli',
    title: 'Official Folio CLI (`folio` / `npm run folio`)',
    category: 'CLI & SDK',
    summary:
      'Command-line interface for system diagnostics, docs/changelog search, disk-sharded KB ingestion, schema validation, Neo 4 chat, and backups.',
    keywords: ['cli', 'command', 'folio', 'doctor', 'validate', 'backup', 'kb', 'ingest'],
    content: `Run via \`npm run folio -- <command>\` or \`npx tsx scripts/folio-cli.ts <command>\`.

Commands:
- \`folio status\` / \`folio doctor\`: Checks 4 GB RAM availability, disk free space, Node/Python/FFmpeg/Blender/Godot/CMake/Kotlin availability, Neo 4 DB stats, and active backup snapshots.
- \`folio docs [query]\`: Lists or searches Folio documentation sections.
- \`folio changelog [version]\`: Prints the complete Folio changelog (\`v3.5\` through \`${FOLIO_CURRENT_VERSION}\`).
- \`folio sdk [ts|python]\`: Displays TypeScript and Python SDK usage guides.
- \`folio chat "<prompt>" [--model auto|neo-4|flash-lite-3.1]\`: Sends a prompt to a running Folio server or Neo 4 directly.
- \`folio neo4 "<prompt>"\`: Runs the local Python Neo 4 engine directly offline.
- \`folio kb ingest-docs\`: Indexes all Folio Docs, SDK docs, CLI guide, and Changelogs into \`.folio-data/neo4/folio_docs.db\`.
- \`folio kb ingest <file-or-dir> [--shard-rows 500000]\`: Streams massive \`.txt/.jsonl/.csv/.md\` datasets into disk-sharded SQLite FTS5 databases under strict <150 MB RAM limits.
- \`folio kb search "<query>"\`: Searches all disk-backed Knowledge + Folio Docs shards via BM25 ranking.
- \`folio kb stats\`: Shows shard counts, indexed rows, disk footprint, and WordNet/corpus metadata.
- \`folio validate <file>\`: Validates a creative JSON/Markdown spec (\`evo\`, \`pixelart\`, \`stopmotion\`, \`threejs\`, \`liquidmotion\`).
- \`folio backup create [label]\` / \`folio backup list\`: Creates or lists compressed \`.tar.gz\` clean workspace snapshots in \`.folio-data/backups/\`.`,
    codeExample: {
      language: 'bash',
      label: 'Folio CLI Quickstart',
      code: `npm run folio -- doctor
npm run folio -- kb ingest-docs
npm run folio -- kb search "evo hitbox"
npm run folio -- neo4 "derivative of 3x^3 + 2x"
npm run folio -- backup create milestone`,
    },
  },
  {
    id: 'sdk-ts',
    title: 'Official Folio TypeScript / JavaScript SDK',
    category: 'CLI & SDK',
    summary:
      'Typed client and schema-safe creative builders in src/sdk/folioSdk.ts for Node.js, scripts, and browser apps.',
    keywords: ['sdk', 'typescript', 'javascript', 'folioclient', 'builder', 'api'],
    content: `Import from \`src/sdk/folioSdk.ts\`:
- \`new FolioClient({ baseUrl: 'http://localhost:3000' })\`:
  - \`client.chat(messages, { modelId, autoFallback, thinkingMode })\`
  - \`client.streamChat(messages, onEvent, options)\`
  - \`client.getDocs(query?)\`, \`client.getChangelog()\`, \`client.getHealth()\`, \`client.listBackups()\`, \`client.createBackup(label?)\`, \`client.getToolchains()\`
  - \`client.validateCreativeBlock(kind, content)\`
- Schema-Safe Builders (prevent malformed JSON):
  - \`createEvoScene({ title, nodes, environment, starfield, audio })\`
  - \`createStopMotionScene({ title, layers, width, height, fps, durationSec, effect, audio })\`
  - \`createPixelArtScene({ title, width, height, palette, draw, shaders })\`
  - \`createThreeJsScene({ title, objects, environment, starfield })\`
  - \`createHybridScene({ kind, title, pixelBackdrop, layers, particles })\``,
    codeExample: {
      language: 'typescript',
      label: 'TypeScript SDK Example',
      code: `import { FolioClient, createEvoScene } from './src/sdk/folioSdk';

const client = new FolioClient({ baseUrl: 'http://localhost:3000' });
const evo = createEvoScene({
  title: 'SDK Orbital Demo',
  environment: 'cosmic',
  starfield: true,
  nodes: [
    { id: 'core', type: 'helix', material: { preset: 'hologram' }, motion: { spinY: 1 } },
  ],
});
const reply = await client.chat([{ role: 'user', text: 'Summarize Folio v4.2' }], { modelId: 'auto' });`,
    },
  },
  {
    id: 'sdk-python',
    title: 'Official Folio Python SDK (`python/folio_sdk.py`)',
    category: 'CLI & SDK',
    summary:
      'Python client, local Neo 4 & disk-sharded KnowledgeStore interface, creative builders, MemoryGuard, and snapshot backup utilities.',
    keywords: ['python', 'sdk', 'knowledgestore', 'memoryguard', 'neo4', 'builder'],
    content: `Import from \`python/folio_sdk.py\`:
- \`FolioClient(base_url="http://localhost:3000")\`: HTTP client for \`/api/chat/complete\`, \`/api/docs\`, \`/api/changelog\`, \`/api/system/health\`, \`/api/system/backup\`, plus \`ask_neo4(prompt)\` offline fallback.
- \`KnowledgeStore(data_dir=".folio-data/neo4")\`: Direct low-RAM SQLite FTS5 + BM25 search across \`folio_docs.db\`, \`knowledge.db\`, and all \`shards/*.db\`, plus \`ingest_file()\`.
- \`MemoryGuard.snapshot()\` & \`MemoryGuard.ensure_available_mb(min_mb)\`: Reads \`/proc/meminfo\` to block runaway RAM allocations before OOM crashes.
- Builders: \`EvoBuilder\`, \`StopMotionBuilder\`, \`PixelArtBuilder\`, \`ThreeJSBuilder\`, \`create_backup()\`.`,
    codeExample: {
      language: 'python',
      label: 'Python SDK Example',
      code: `from python.folio_sdk import FolioClient, KnowledgeStore, MemoryGuard, EvoBuilder

mem = MemoryGuard.snapshot()
print("Free RAM MB:", mem["available_mb"])

kb = KnowledgeStore()
hits = kb.search("stopmotion wetGlaze", limit=3)

scene = (
    EvoBuilder("PySDK Arena", environment="cyberpunk", starfield=True)
    .add_node("orb", "sphere", position=[0, 1, 0], material={"preset": "neon"})
    .to_markdown()
)`,
    },
  },
  {
    id: 'toolchains-ram-backups',
    title: 'RAM Watchdog, Backups, Toolchains & Blender Fallback',
    category: 'Operations',
    summary:
      'How Folio protects 4 GB RAM containers against OOM crashes, manages clean .tar.gz backups, and handles missing Blender binaries gracefully.',
    keywords: ['ram', 'memory', 'oom', 'backup', 'snapshot', 'blender', 'godot', 'cmake', 'kotlin', 'llm', 'remote', 'qwen'],
    content: `4 GB RAM Watchdog & Huge-RAM Remote Offload:
- Containers have a hard 4,096 MB (4 GB) kernel RAM limit with 0 swap (OS RAM cannot be expanded from inside the container).
- \`server.ts\` runs a live RAM guard (\`/api/system/health\`) checking \`/proc/meminfo\` before spawning heavy toolchains:
  - Heavy 3D/compiler tools require >= 450 MB free RAM (Blender requires >= 650 MB).
  - SQLite FTS5 knowledge queries cap \`cache_size\` to <= 16 MB and \`mmap_size\` to <= 64 MB.
  - Tiered Local Quantized LLM (\`llama.cpp\` + Qwen2.5): runs \`Qwen2.5-1.5B-Instruct Q4_K_M\` when free RAM >= 1,650 MB, and falls back gracefully to \`Qwen2.5-0.5B-Instruct Q4_K_M\` when free RAM is 1,100–1,649 MB (0 MB idle footprint).
  - Huge-RAM Remote LLM Bridge (0 MB local RAM): set \`FOLIO_REMOTE_LLM_URL\`, \`FOLIO_REMOTE_LLM_MODEL\`, and optional \`FOLIO_REMOTE_LLM_KEY\` in server env to run 7B–70B+ models on any external Ollama or OpenAI-compatible GPU/high-RAM server while keeping Folio's disk-backed RAG active.

Clean Snapshot Backups:
- Stored in \`.folio-data/backups/\` as compressed \`.tar.gz\` archives (excluding \`node_modules\`, \`dist\`, and backup files themselves so snapshots stay ~3 MB).
- Endpoints: \`GET /api/system/backups\` and \`POST /api/system/backup\`. Milestone backups such as \`folio-v4.1-milestone-snapshot.tar.gz\` are always preserved.

Blender CLI Detection & Zero-Bloat Fallback:
- \`getBlenderBinary()\` checks \`/opt/folio-toolchains/blender/blender\`, \`.folio-data/bin/blender\`, \`/usr/bin/blender\`, and \`/usr/local/bin/blender\`.
- Install portable Blender 3.6 LTS / Godot 4.3 / CMake / Kotlin anytime via \`python3 scripts/bootstrap_toolchains.py <target>\`.
- When Blender binary is absent or RAM is too low for Cycles, \`blender_cli\` generates a clean pure-Python procedural \`.obj\` / \`.gltf\` / EVO 3D fallback asset instead of crashing.`,
  },
  {
    id: 'changelog',
    title: `Complete Folio Changelog (v3.5 – ${FOLIO_CURRENT_VERSION})`,
    category: 'Changelog',
    summary: 'Full chronological release history of Folio models, engines, SDKs, CLI, and fixes.',
    keywords: ['changelog', 'history', 'release', 'notes', 'versions', 'v4.2', 'v4.1', 'v4.0', 'v3.8', 'v3.5'],
    content: FOLIO_CHANGELOGS.map(
      (entry) =>
        `## ${entry.version} — ${entry.codename} (${entry.date})\n${entry.summary}\n` +
        entry.highlights
          .map((h) => `- [${h.category}] **${h.title}**: ${h.detail}`)
          .join('\n')
    ).join('\n\n'),
  },
];

export function searchFolioDocs(query: string, limit = 4): FolioDocSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOLIO_DOCS_SECTIONS.slice(0, limit);
  const terms = q.split(/[^a-z0-9_.-]+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return FOLIO_DOCS_SECTIONS.slice(0, limit);

  const scored = FOLIO_DOCS_SECTIONS.map((sec) => {
    const titleLow = sec.title.toLowerCase();
    const summaryLow = sec.summary.toLowerCase();
    const contentLow = sec.content.toLowerCase();
    const kwSet = sec.keywords.map((k) => k.toLowerCase());
    let score = 0;
    for (const term of terms) {
      if (sec.id.toLowerCase() === term) score += 10;
      if (kwSet.some((k) => k === term || k.includes(term))) score += 6;
      if (titleLow.includes(term)) score += 5;
      if (summaryLow.includes(term)) score += 3;
      if (contentLow.includes(term)) score += 1.5;
    }
    return { sec, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.sec);
}
