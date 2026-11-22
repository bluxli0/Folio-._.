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

export const FOLIO_CURRENT_VERSION = 'v4.1 · Folio Zero';

export const FOLIO_CHANGELOGS: ChangelogEntry[] = [
  {
    version: 'v4.1 · Folio Zero',
    codename: 'Folio Zero',
    date: 'Nov 2026',
    summary:
      'Godot 4 CLI + Multi-Platform Export Presets, CMake/MSVC/Clang/Kotlin Toolchains, Portable Blender LTS, Mod Studio + SQLite + CI/CD Scaffolding, Reverse Engineering Inspector, Experimental Python Neo 4 Rule AI, Thinking/Entropic/Meta Modes, bluxli.me Auth Rule, and Live Logs Tab.',
    highlights: [
      {
        category: 'Models & Chat',
        title: 'Neo 4 Python Rule AI + 5-Level Thinking + Entropic Auditor + Meta Scripting',
        detail:
          'Experimental Python rule-based engine with compositional subword tokenization, ±k semantic context disambiguation, OSASCOMP-rated Order-3 Markov Chain, AST math/physics solver, optional Shannon-entropy Entropic Auditor (OFF by default), and full studio settings parity.',
      },
      {
        category: 'Engines',
        title: 'Godot 4 CLI, CMake + MSVC Cross-Toolchain, Kotlin Compiler & Fixed Blender + Three.js',
        detail:
          'Added portable Blender LTS binary resolution, Three.js Sandpack CDN rewrite + pinned r169 compatibility, Godot 4.3 CLI + multi-platform export_presets.cfg (Linux/Win/macOS/Web/Android/iOS), CMake + MinGW-w64 MSVC cross-toolchain, and Kotlin 2.0 compiler.',
      },
      {
        category: 'Studio & Audio',
        title: 'Mod Creation Studio, Reverse Engineering Inspector & Workspace Fallback',
        detail:
          'Scaffolds CLI, Mod Loader, SDK, Object IDs, EVO/Blender 3D, Pixel v3, StopMotion v3, SQLite DB, and CI/CD inside isolated workspace repos; inspects GLB/ZIP/APK/PCK/PNG/ELF binaries safely.',
      },
      {
        category: 'Fixes & Polish',
        title: 'Live Logs (Log | Warn | Error | Success) Tab & bluxli.me Domain Login',
        detail:
          'Structured telemetry Logs tab inside Preview Drawer; Email/Password sign-in allowing @bluxli.me without verification email while enforcing verification on external domains.',
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
