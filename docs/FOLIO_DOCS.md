# Folio Complete Documentation, SDK, CLI & Changelog Reference

> Synchronized for **Folio v4.2 · Folio Core** — Source of truth for developers, CLI users, Neo 4 disk-backed RAG, and cloud model grounding.

## 1. Architecture & Accuracy Design
Folio combines cloud Gemini models (`auto`, `flash-lite-3.1`, `hydrogen-4-*`, `neon-4`, `carbon-4`, `omni-flash-1.2`, `nano-banana-lite`) with local **Neo 4** (Python Rule + Subword + AST Math/Physics + Disk-Sharded SQLite FTS5/BM25 RAG + optional Tiny Quantized Local LLM bridge).

How models avoid mistakes in Folio:
1. **Schema Grounding (`folio_docs_lookup` + auto-context)**: Models can inspect exact engine fields and valid presets before emitting creative specs.
2. **Pre-Flight Schema Validation (`validate_creative_code`)**: Catches malformed `evo/v1` empty `nodes` arrays, legacy `threejs` gaps, and missing fields before display.
3. **Resilient Fallback & 4 GB RAM Watchdog**: Automatically routes around upstream 503/429 spikes (including Gemini 2.5 GA backups and Neo 4 last-resort failover) while guarding RAM against OOM crashes like heavy Blender Cycles runs.

---

## 2. Creative Engines Quick Contract
- **Stop Motion v3 (`stopmotion/v3`)**: Multi-layer SVG vector scenes with 22 `<defs>` glazes/filters, 16 vector brushes, 21 math curve generators, procedural `particles`, 120+ unified math functions, 36 easings, `storyboard` cameraCuts (`zoomIn, zoomOut, panLeft, panRight, shake, tilt`), `uiAngle`, `effect` (`crt, cyberpunk, sepia, noir`), and synced WebAudio `audio`.
- **Pixel Engine v3 (`pixelart/v3`)**: Up to `512x512`, 13 named palettes (`cyberpunk, synthwave, lava, ice, pastel, noir, forest, gold, pico8, endesga32, gameboy, sweetie16, fantasy24`), 30+ procedural `draw` ops (`plasma, aurora, water, fire, rain, snow, lightning, sphere3d, torus3d, pyramid3d, ring, star, hexagon, text, mirror, hitbox`), 6 gradient modes + 5 dithers, `blendMode`, and 18 post shaders. Procedural `draw`/`backdrop` specs do NOT need `frames`.
- **EVO 3D (`evo/v1`)**: MUST have a non-empty top-level `nodes` array. Supports 26 geometries (`sphere, box, gear, helix, dodecahedron, mobius, klein, lathe, star3d, voxelGrid, particles3d`, etc.), 14 PBR material presets (`glass, chrome, gold, neon, hologram, clay, toon, carbon, obsidian, lava, ice, emerald, copper, pearl`), 12 environments, `fog`, `starfield`, `exposure`, rigid-body `physics` (`drag`, `attractor`), and `hitbox`.
- **Three.js Studio (`threejs/v1`) & Hybrids (`liquidmotion/v1`, `liquiddrop/v1`, `pixelmotion/v1`, `motiondrop/v1`)**: Cross-engine pixel backdrop + vector motion layers with `pixelBlendMode`, `pixelOpacity`, `particles`, `letterbox`, and `postFilter`.

---

## 3. Folio CLI (`npm run folio -- <command>`)
- `folio status` / `folio doctor` — Inspects RAM, disk, binaries (Node, Python, FFmpeg, Blender, Godot, CMake, Kotlin), DB shards, and backups.
- `folio docs [query]` — Searches Folio documentation sections.
- `folio changelog [version]` — Prints the full changelog from `v3.5` through `v4.2`.
- `folio sdk [ts|python]` — Prints TypeScript & Python SDK reference and examples.
- `folio chat "<prompt>" [--model auto|neo-4]` — Queries the running Folio server or Neo 4.
- `folio neo4 "<prompt>"` — Executes local Neo 4 offline.
- `folio kb ingest-docs` — Builds/updates `.folio-data/neo4/folio_docs.db` from Folio Docs, SDKs, CLI, and Changelogs.
- `folio kb ingest <path> [--shard-rows 500000]` — Streams large `.txt/.jsonl/.csv/.md` datasets into disk-sharded SQLite FTS5 databases under strict low-RAM caps.
- `folio kb search "<query>"` / `folio kb stats` — Searches and inspects disk-backed shards.
- `folio validate <file>` — Validates any creative engine JSON/Markdown file.
- `folio backup create [label]` / `folio backup list` — Creates and lists clean `.tar.gz` workspace snapshots.

---

## 4. TypeScript SDK (`src/sdk/folioSdk.ts`) & Python SDK (`python/folio_sdk.py`)
- **TypeScript SDK**: `FolioClient`, `createEvoScene`, `createStopMotionScene`, `createPixelArtScene`, `createThreeJsScene`, `createHybridScene`, `validateCreativeBlock`, `searchFolioDocs`, `FOLIO_CHANGELOGS`.
- **Python SDK**: `FolioClient`, `KnowledgeStore` (disk-sharded SQLite FTS5 + BM25 search/ingest), `MemoryGuard`, `EvoBuilder`, `StopMotionBuilder`, `PixelArtBuilder`, `ThreeJSBuilder`, `create_backup`.

---

## 5. 4 GB RAM Protection, Backups & Blender CLI Fallback
- Live RAM watchdog enforces free-memory thresholds before launching heavy subprocesses (`>= 450 MB` general tools, `>= 650 MB` Blender, `>= 1,400 MB` optional local tiny LLM).
- SQLite disk shards cap RAM cache to `16 MB` (`PRAGMA cache_size=-16384`) and `64 MB` mmap so even 100M+ rows across disk shards never blow 4 GB RAM.
- Clean `.tar.gz` snapshots live in `.folio-data/backups/` and preserve existing milestone backups.
- `blender_cli` checks `/opt/folio-toolchains/blender/blender` and system paths, and falls back to lightweight pure-Python `.obj` / `.gltf` mesh synthesis when Blender isn't installed or RAM is constrained.
