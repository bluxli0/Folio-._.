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
    title: 'EVO 3D Engine (IK, Manifolds, Modifiers, Constraints & Physics)',
    category: 'Engines',
    summary:
      'Interactive Three.js-powered declarative 3D engine (evo/v1) with non-Euclidean manifolds (klein, mobius, torusKnot), 10-iteration FABRIK IK, Blender modifiers, constraints, soft-body metaballs, spline pathFollow, forceFields, and triggers.',
    keywords: ['evo', '3d', 'nodes', 'pbr', 'hitbox', 'physics', 'ik', 'ikchains', 'modifiers', 'constraints', 'softbody', 'forcefield', 'forcefields', 'triggers', 'pathfollow', 'morph', 'terrain', 'metaball', 'custommesh', 'klein', 'mobius', 'torusknot'],
    content: `Format: \`\`\`evo with \`"format": "evo/v1"\`.
Critical Schema Rule: ALWAYS include a non-empty top-level \`"nodes": [ ... ]\` array of sculpted 3D primitives (accepts \`"type"\` or \`"geometry"\` or \`"shape"\` — NEVER default to plain cube-only scenes unless specifically creating crates/voxels).

Core Capabilities:
- 33 Geometries: \`klein, mobius, torusKnot, helix, lathe, metaball, terrain, gear, star3d, icosahedron, octahedron, dodecahedron, tetrahedron, prism, pyramid, sphere, torus, cylinder, cone, capsule, ring, plane, box, voxelGrid, particles3d, axes3d, wireCube, graph, surface, curve, customMesh (meshData: { vertices, faces }), ikJoint, group\`.
- 14 PBR Material Presets (\`material.preset\`): \`glass, chrome, gold, neon, hologram, clay, toon, carbon, obsidian, lava, ice, emerald, copper, pearl\`, plus \`gradient\`, \`sheen\`, \`flatShading\`, \`emissivePulse\` (boolean | number | \`{ min, max, freq }\`).
- Blender-Grade Rigging & Inverse Kinematics:
  - Top-level \`"ikChains": [{ "nodes": ["arm_shoulder", "arm_elbow", "arm_wrist"], "targetId": "ik_target_orb", "pole": [0, 4.5, 2.0], "iterations": 10, "aimNodes": true }]\` runs real-time FABRIK IK + limb aiming.
  - Node \`"constraints"\`: \`trackTo\`, \`copyRotation\`, \`copyLocation\`, \`limitDistance\` (with \`targetId\`, \`influence\`, \`maxDist\`).
- Deformers, Splines & Strips:
  - Vertex \`"modifiers"\`: \`bend\`, \`twist\`, \`taper\`, \`wave\`, \`noise\`, \`squash\`, \`mirror\` (\`axis\`, \`strength\`, \`frequency\`, \`speed\`).
  - \`"morphTargets"\`: weighted shape-key blending (\`name\`, \`scale\`, \`twist\`, \`bend\`, \`bulge\`, \`weight\`).
  - \`"pathFollow"\`: Catmull-Rom spline curve \`points\` with \`closed\`, \`orientToPath\`, \`speed\`, \`ease\`.
  - \`"actionStrips"\`: blend multiple timed \`motion\` strips across normalized \`0..1\` windows.
- Atmosphere, Physics, Force Fields & Triggers:
  - \`starfield\`: \`true | number | { count, radius, color }\`, \`camera\`: \`{ fov, position, target, exposure }\`, \`storyboard.shots\`: \`{ name, position, target, duration }\`.
  - Rigid-body \`"physics"\` + \`"hitbox"\`, \`"softBody"\` (\`stiffness, damping, squash, squashOnBounce\`), top-level \`"forceFields"\` + node \`"forceField"\` (\`attractor | repulsor | vortex\`), and top-level \`"triggers"\` + node \`"triggerZone"\` (\`pulse | bounce | glow | reverse\`).`,
  },
  {
    id: 'engine-datasets',
    title: 'Multi-Engine Training Datasets, Parameter Values & Examples',
    category: 'Engines',
    summary:
      'Structured datasets, calibrated parameter ranges, and multi-example training specs for EVO 3D, Three.js Studio, Stop Motion v3, Pixel Engine v3, Hybrid, and IK Math — wired into SDK, CLI, Docs UI, and Neo 4.',
    keywords: ['datasets', 'training', 'examples', 'values', 'parameters', 'evo3d', 'threejs', 'stopmotion', 'pixelart', 'hybrid', 'ik-math', 'chrono', 'singularity'],
    content: `Folio ships curated training & reference datasets (\`src/data/engineDatasets.ts\`, \`GET /api/datasets\`) for every engine so models, SDK users, and Neo 4 learn exact valid shapes, ranges, and multi-layered compositions instead of generic cubes:

1. **EVO 3D (\`evo3d\`)**: Chrono-Singularity Manifold (\`klein\` + \`mobius\` + \`torusKnot\`, 10-iter FABRIK IK, Catmull-Rom \`metaball\`, \`trackTo\`/\`copyRotation\`/\`limitDistance\`, \`forceFields\`, \`triggers\`), Cryo-Helix \`lathe\`+\`helix\` Reactor, and Polyhedral Soft-Body Bounce Arena.
2. **Three.js Studio (\`threejs\`)**: Quantum DNA Observatory (\`dnaHelix\`, \`gear\`, \`dodecahedron\`) and FABRIK Articulated Scanner (\`capsule\` + \`octahedron\` + \`ikChains\`).
3. **Stop Motion v3 (\`stopmotion\`)**: Harmonic Spirograph Observatory + Animated Analytical 2-Bone IK Limb (\`ik2d_elbow_x/y\`, \`url(#wetGlaze*)\`, particles, math audio).
4. **Pixel Engine v3 (\`pixelart\`)**: 128×128 Bayer4 Dithered Exoplanet & Aurora (\`sphere3d\`, \`aurora\`, \`stardust\`, \`ring\`, \`bloom\`, \`vignette\`).
5. **Hybrid Engine (\`hybrid\`)**: Bioluminescent Bayou (\`160×90\` \`pixelBackdrop\` with \`pixelBlendMode: "screen"\` + SVG firefly trails + WebAudio).
6. **Unified IK & Math Kernel (\`ik-math\`)**: Calibrated parameter tables for all 11 IK/LookAt solvers (\`ik2d_*\`, \`ik3d_mid_*\`, \`lookat_*\`).

Train Neo 4 offline KB anytime via \`npm run folio -- kb train-datasets\` or the **"Datasets"** tab in Docs Hub.`,
    codeExample: {
      language: 'bash',
      label: 'Ingest & Train Multi-Engine Datasets into Neo 4',
      code: `npm run folio -- kb train-datasets
curl http://localhost:3000/api/datasets?engine=evo3d
curl -X POST http://localhost:3000/api/datasets/train`,
    },
  },
  {
    id: 'threejs-hybrid',
    title: 'Three.js Studio & Cross-Engine Hybrid Formats',
    category: 'Engines',
    summary:
      'Declarative threejs/v1 scenes with IK chains & trackTo constraints plus liquidmotion, liquiddrop, pixelmotion, and motiondrop cross-engine compositing.',
    keywords: ['threejs', 'hybrid', 'liquidmotion', 'liquiddrop', 'pixelmotion', 'motiondrop', 'ik', 'trackto'],
    content: `Three.js Studio (\`\`\`threejs — \`"format": "threejs/v1"\`):
- Uses \`"objects": [ ... ]\` with all 20+ geometries (\`helix, gear, dodecahedron, star3d, terrain, graphRibbon\`, etc.), 20 PBR materials, 12 lighting presets, \`starfield\`, \`fogColor/fogDensity\`, \`gridFloor\`, \`cameraFov\`, \`exposure\`, \`repeat\`, \`trackTo\`, top-level \`ikChains\` FABRIK solver, and global \`ik2d_*\` / \`ik3d_mid_*\` / \`lookat_*\` helpers.

Hybrid Formats (\`\`\`liquidmotion, \`\`\`liquiddrop, \`\`\`pixelmotion, \`\`\`motiondrop):
- Composite a procedural \`pixelBackdrop\` (\`pixelart/v3\`) beneath crisp SVG Stop Motion v3 \`layers\` using \`pixelScale\`, \`pixelBlendMode\`, \`pixelOpacity\`, \`particles\`, \`lighting.rimColor\`, \`letterbox\`, \`frameOverlay\`, \`postFilter\`, and \`audio\`.`,
  },
  {
    id: 'audio-math',
    title: 'Unified Math (130+ Funcs), IK Solvers, 36 Easings & Audio Synth',
    category: 'Engines',
    summary:
      'Shared AST expression evaluator across all engines including 11 Inverse Kinematics (IK) & Aim solvers plus 20 WebAudio synth presets.',
    keywords: ['math', 'easing', 'audio', 'synth', 'fm', 'waveform', 'noise', 'fbm', 'physics', 'ik', 'ik2d', 'ik3d', 'kinematics', 'lookat'],
    content: `Unified Math Core (\`src/utils/mathFunctions.ts\` — shared across EVO 3D, Stop Motion v3, Pixel Engine v3, Hybrid Engines & Three.js Studio):
- Constants: \`PI, TAU, E, PHI, SQRT2, DEG2RAD, RAD2DEG\`.
- 11 Inverse Kinematics (IK) & LookAt Functions:
  - 2-Bone Analytical 2D IK: \`ik2d_theta1(tx, ty, l1, l2, bend)\`, \`ik2d_theta2(...)\`, \`ik2d_deg1(...)\`, \`ik2d_deg2(...)\`, \`ik2d_elbow_x(...)\`, \`ik2d_elbow_y(...)\`.
  - 3D Pole-Vector 2-Bone IK: \`ik3d_mid_x(ax, ay, az, tx, ty, tz, l1, l2, px, py, pz)\`, \`ik3d_mid_y(...)\`, \`ik3d_mid_z(...)\`.
  - Aim / Constraint Solvers: \`lookat_yaw(ax, az, tx, tz)\`, \`lookat_pitch(ax, ay, az, tx, ty, tz)\`.
- 120+ Safe AST Functions: trig/hyperbolic (\`sin, cos, tan, sinh, cosh, tanh, sinc\`), shaping (\`clamp, saturate, lerp, remap, smoothstep, smootherstep, gain, bias, impulse, gaussian, sigmoid\`), waveforms (\`pingpong, sawtooth, triangle, square, pwm\`), noise (\`noise, perlin1d, fbm, turbulence, ridges, voronoi1d\`), physics/geometry (\`gravity, projectilex, projectiley, bouncepos, spring, dampedsine, pendulum, orbitx, orbity, lissajousx, lissajousy, aabbhit, circlehit, box3dhit, spherehit\`), and all 36 easing curves.

Math Audio Synth (\`audio\` block):
- 20 Presets (\`ambient_chime, sci_fi_arp, cyberpunk_arp, retro_8bit, crystal_bells, deep_drone, arcade_jump, laser_pulse, rain_noise, heartbeat, lofi_chord, quantum_pad, warp_riser, marimba, orchestral_brass, bounce, chimes, synth_pulse, bass_groove, glitch\`) or custom AST \`formula\`.`,
  },
  {
    id: 'cli',
    title: 'Official Folio CLI (`folio` / `npm run folio`)',
    category: 'CLI & SDK',
    summary:
      'Command-line interface for system diagnostics, docs/changelog search, disk-sharded KB ingestion, LLM setup, schema validation, Neo 4 chat, and backups.',
    keywords: ['cli', 'command', 'folio', 'doctor', 'validate', 'backup', 'restore', 'setup-llm', 'kb', 'ingest'],
    content: `Run via \`npm run folio -- <command>\` or \`npx tsx scripts/folio-cli.ts <command>\`.

Commands:
- \`folio status\` / \`folio doctor\`: Checks 4 GB RAM availability, disk free space, Node/Python/FFmpeg/Blender/Godot/CMake/Kotlin availability, Neo 4 DB stats, and active backup snapshots.
- \`folio setup-llm\`: Safely installs \`llama.cpp\` (\`llama-completion\`) + \`Qwen2.5-0.5B-Instruct Q4_K_M\` sequentially with RAM guards (skips cleanly if already installed).
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
- \`folio backup create [label]\` / \`folio backup list\` / \`folio backup restore <file>\`: Creates, lists, or restores clean \`.tar.gz\` workspace snapshots in \`.folio-data/backups/\`.`,
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
    title: 'RAM Watchdog, Google Cloud Transfer, Migration & Swap Guide',
    category: 'Operations',
    summary:
      'Why ephemeral container resets happen, why disk swap is 0 MB inside sandboxed containers, and exact step-by-step instructions to transfer Folio to Google Cloud (8–32 GiB RAM) or a Linux VPS with real NVMe swap.',
    keywords: ['ram', 'memory', 'oom', 'swap', 'docker', 'google cloud', 'cloud run', 'gce', 'compute engine', 'vps', 'migrate', 'transfer', 'backup', 'snapshot', 'blender', 'godot', 'cmake', 'kotlin', 'llm', 'remote', 'qwen'],
    content: `Why Container Restarts & 0 MB Swap Happen Here:
- Preview sandboxes enforce a strict **4,096 MB (4 GB) RAM cgroup cap** with **0 MB swap**, and unprivileged Linux containers block \`swapon\` at the kernel hypervisor level (meaning storage cannot be turned into OS swap RAM from inside the container).
- When memory spikes past 4 GB, the Linux OOM killer reboots the container overlay and wipes untracked files in \`.folio-data/\`.
- Built-in Anti-Wipe Recovery: \`server.ts\` auto-reindexes \`folio_docs.db\` on boot, enforces RAM guards, and restores via \`POST /api/system/restore-llm\` or \`npm run folio -- setup-llm\`.

How to Transfer Folio to Google Cloud (Step-by-Step):
1. **Export Code from AI Studio**: Download/clone the Folio project folder (or push it to GitHub) — the repo already includes a production \`Dockerfile\`, \`.dockerignore\`, and \`"start": "tsx server.ts"\`.
2. **Sign In & Select Project** (in Google Cloud Shell or local terminal with \`gcloud\` CLI):
   \`\`\`bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   \`\`\`
3. **Option A — Google Cloud Run (Fastest Serverless 8–32 GiB RAM)**:
   Deploy straight from the project root using Cloud Build + the repo \`Dockerfile\`:
   \`\`\`bash
   gcloud run deploy folio \\
     --source . \\
     --region us-central1 \\
     --allow-unauthenticated \\
     --memory 8Gi \\
     --cpu 4 \\
     --port 3000 \\
     --set-env-vars GEMINI_API_KEY=YOUR_GEMINI_KEY
   \`\`\`
   (Optional persistent disk for \`.folio-data\`: create a GCS bucket and add \`--add-volume name=folio-vol,type=cloud-storage,bucket=YOUR_BUCKET --add-volume-mount volume=folio-vol,mount-path=/app/.folio-data\`).
4. **Option B — Google Compute Engine VM (Persistent SSD + Real Storage-to-RAM Swap)**:
   Provision an Ubuntu VM (\`e2-standard-4\` or \`n2-standard-4\` with 50 GB SSD), attach a 16 GB swapfile, and run Docker:
   \`\`\`bash
   sudo fallocate -l 16G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   docker build -t folio .
   docker run -d --restart unless-stopped -p 3000:3000 -e GEMINI_API_KEY=YOUR_GEMINI_KEY -v folio_data:/app/.folio-data folio
   \`\`\`
5. **Option C — Keep Hosting Here with 0 MB Local RAM**: Set \`FOLIO_REMOTE_LLM_URL\` + \`FOLIO_REMOTE_LLM_MODEL\` so Neo 4 delegates inference off-box.

Blender CLI & Native Toolchains:
- Optional native binaries (Blender 3.6 LTS, Godot 4.3, CMake/Ninja, Kotlin 2.0) can be installed anytime on persistent Google Cloud hosts via \`python3 scripts/bootstrap_toolchains.py blender\`. When Blender is absent, Folio uses pure-Python \`.obj\` fallbacks + interactive \`evo/v1\` & \`threejs/v1\` WebGL rigs.`,
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
