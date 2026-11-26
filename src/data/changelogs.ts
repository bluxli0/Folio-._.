export interface ChangelogEntry {
  version: string;
  codename: string;
  date: string;
  summary: string;
  highlights: Array<{
    category: 'Engines' | 'Models & Chat' | 'Studio & Audio' | 'Fixes & Polish';
    title: string;
    detail: string;
  }>;
}

export const FOLIO_CURRENT_VERSION = 'v4.2 · Folio Core';

export const FOLIO_CHANGELOGS: ChangelogEntry[] = [
  {
    version: 'v4.2 · Folio Core',
    codename: 'Folio Core',
    date: 'Nov 2026',
    summary:
      'Complete Folio Documentation Hub, Official TypeScript & Python SDKs, `folio` CLI, Disk-Sharded SQLite FTS5/BM25 Knowledge Engine (low-RAM streaming for 100M+ indexed rows), Optional Tiny Local LLM RAG Bridge, 4 GB RAM Watchdog & Automated Snapshot Backups, 100+ new tags/functions per creative engine, and Resilient Upstream/Blender Fallbacks.',
    highlights: [
      {
        category: 'Models & Chat',
        title: 'Disk-Sharded Neo 4 RAG + Tiny LLM Bridge & Model Grounding',
        detail:
          'Added disk-backed sharded SQLite FTS5 + BM25 indexing (capped <150 MB RAM), automatic Folio Docs & Changelog indexing, `folio_docs_lookup` tool + prompt grounding to cut schema hallucinations, optional tiny Q4 local LLM bridge with strict RAM guards, and Gemini 2.5 GA fallback + Neo 4 last-resort failover.',
      },
      {
        category: 'Studio & Audio',
        title: 'Official Folio CLI, TypeScript SDK, Python SDK & Master Docs',
        detail:
          'Shipped complete Markdown & in-app Docs/SDK/CLI Modal, typed TypeScript SDK (`src/sdk/folioSdk.ts`) and Python SDK (`python/folio_sdk.py`) with schema builders, and `folio` CLI (`status`, `doctor`, `docs`, `changelog`, `sdk`, `kb`, `validate`, `backup`).',
      },
      {
        category: 'Engines',
        title: '100+ New Tags & Functions Across Every Creative Engine',
        detail:
          'Added 120+ unified math functions, 36 easings, 20 audio presets + 25 AST synth funcs, 16 vector brushes, 30+ Pixel v3 procedural ops + 18 shaders + 13 palettes, 14+ EVO 3D/Three.js PBR materials & geometries, and Studio-Demo validation fixes.',
      },
      {
        category: 'Fixes & Polish',
        title: '4 GB RAM Watchdog, Snapshot Backups & Headless Blender Fallback',
        detail:
          'Added live memory watchdog throttling heavy subprocesses before OOM crashes, one-click `.tar.gz` clean backups (`/api/system/backup`), fixed Blender toolchain path detection, and added pure-Python `.obj`/`.gltf` fallback when Blender binary is absent.',
      },
    ],
  },
  {
    version: 'v4.1 · Folio Zero',
    codename: 'Folio Zero',
    date: 'Nov 2026',
    summary:
      'Godot 4 CLI + Multi-Platform Export Presets, CMake/MSVC/Clang/Kotlin Toolchains, Antigravity Agent CLI, Gemini Flash Models, EVO 3D Interactive Changelogs, Gradient + Math Graph Functions across all engines, Experimental Python Neo 4 Rule AI (3.1B taxonomy & Aleph-Zero), and Live Logs.',
    highlights: [
      {
        category: 'Models & Chat',
        title: 'Neo 4 Python Rule AI (3.1B Research & Aleph-Zero) + Gemini Flash Models',
        detail:
          'Added Gemini 4 Flash & Omni 1.2 Flash alongside Hydrogen/Neon/Carbon. Trained Neo 4 on the 520k–3.1B linguistic scale, Lego subword bricks, ±k context disambiguation, OSASCOMP grammar scoring, and Aleph-Zero mathematical continuum.',
      },
      {
        category: 'Engines',
        title: 'EVO 3D Engine Changelogs + Gradients & Math Graphs Across All Engines',
        detail:
          'Embedded live EVO 3D PBR visualizer into Changelogs; added 3D graph/surface plotters & vertex gradients to EVO 3D and Three.js Studio, conic/graph ops to Pixel v3, and animated math function plotters with multi-stop gradients to Stop Motion v3.',
      },
      {
        category: 'Studio & Audio',
        title: 'Antigravity Agent CLI, Godot 4.3 CLI, CMake/MSVC, Kotlin 2.0 & Mod Studio',
        detail:
          'Added Antigravity autonomous software engineering CLI (antigravity_cli) with workspace sandbox fallback & clean snapshot backup, Godot 4.3 multi-platform exports, CMake/MSVC cross-toolchain, SQLite Mod Studio, and Reverse Engineering inspector.',
      },
      {
        category: 'Fixes & Polish',
        title: 'Zero Version Mismatch + Live Logs (Log | Warn | Error | Success) & bluxli.me Auth',
        detail:
          'Synchronized Folio v4.1 (Folio Zero) across runtime system instructions, composer, previews, and presets; added structured telemetry Logs tab and instant @bluxli.me login.',
      },
    ],
  },
  {
    version: 'v(OXYGEN) · 4.0',
    codename: 'OXYGEN Release',
    date: 'Nov 2026',
    summary:
      'Production-grade creative engines, lossless WebM/FFmpeg video baking up to 216,000 frames, 512×512 Pixel v3, 4 hybrid renderers, Auto + Neon 4 + Carbon 4 + Nano Banana Lite routing, Tri-Model orchestration, and refreshed composer/menu ergonomics.',
    highlights: [
      {
        category: 'Engines',
        title: 'Stop Motion v3 + True Duration FPS + FFmpeg Baking',
        detail:
          'Storyboard shots, camera cuts, UI angles, bpy-style idLinks/groups, Three.js PBR depth/reflection/refraction layers, extended easings (exponential, backIn/Out, elastic, bounce), fixed captureStream(0) + FFmpeg VP9 WebM encoding, 10-min (216k frame) baking & 60-min clip stitching.',
      },
      {
        category: 'Engines',
        title: 'Pixel Engine v3 (up to 512×512) & 4 Cross-Engine Hybrids',
        detail:
          'Expanded canvas & parser ceiling to 512×512 with shaders (vignette, CRT, chromatic, glow), aurora/stardust particle ops, Blockbench Z-depth contact shadows, plus Liquid Motion, Liquid Drop, Pixel Motion, and Motion Drop renderers.',
      },
      {
        category: 'Models & Chat',
        title: 'Auto Router, Neon 4, Carbon 4, Nano Banana Lite & Tri-Model Mode',
        detail:
          'Smart prompt-aware Auto router with automatic fallback, Neon 4 & Carbon 4 frontier reasoning, direct Nano Banana Lite image generation, optional 2–3 model Tri-Model chat with autonomous continuation turns, generation timer, XML/JSON thread & cell exports, and timed incognito retention.',
      },
      {
        category: 'Studio & Audio',
        title: 'Pure-Math Waveform Synth, Domain Sim & Workspace AI',
        detail:
          'Code-driven WAV/WebAudio synthesis using sin, cos, tan, tanh, sinh, cosh, and hypot envelopes; Custom Domain Simulator inside Web Preview; direct Workspace AI automation in Folder Sandbox; Stock GIFs & Emotes.',
      },
      {
        category: 'Fixes & Polish',
        title: 'Squircle Morph Menu, Dynamic Greetings & Viewport-Safe Cell Menus',
        detail:
          'Desktop-visible user message action buttons, viewport-clamped floating CellMenu on compact screens, smooth squircle-to-arrow-to-circle composer morph, custom presets & text animations, and contextual greetings.',
      },
    ],
  },
  {
    version: 'v3.8 · Blender & Workflows',
    codename: 'Sculpt & Pipeline',
    date: 'Oct 2026',
    summary:
      'Headless Blender 3.4.1 CLI with Draco mesh compression, Blockbench (.bbmodel) & Three.js live viewports, Google Flow Scenebuilder, and 200 MB chunked workspaces.',
    highlights: [
      {
        category: 'Studio & Audio',
        title: 'Blender CLI + Draco Compression',
        detail:
          'Patched glTF2 importer compatibility and integrated headless CYCLES rendering & .glb Draco exports directly from chat.',
      },
      {
        category: 'Engines',
        title: 'Online Hosted Sandboxes & Multi-File Workflows',
        detail:
          'Server-hosted /sandbox/:id previews and folio.workflow.json multi-step Python/Node build pipelines with ZIP & GitHub integration.',
      },
    ],
  },
  {
    version: 'v3.5 · Motion & Pixels',
    codename: 'Kinetic Foundations',
    date: 'Sep 2026',
    summary:
      'Introduced procedural Stop Motion v2 math expressions, tactile SVG lighting filters, and Pixel Engine v2 Bayer dithering.',
    highlights: [
      {
        category: 'Engines',
        title: 'Stop Motion v2 & Pixel Engine v2',
        detail:
          'Procedural kinematics, dynamic ground contact shadows, and exact fractal curves (Hilbert, Dragon, Koch, Spirograph).',
      },
    ],
  },
];
