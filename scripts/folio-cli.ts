#!/usr/bin/env tsx
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import {
  FOLIO_CHANGELOGS,
  FOLIO_CURRENT_VERSION,
  FOLIO_DOCS_SECTIONS,
  FOLIO_SDK_VERSION,
  searchFolioDocs,
  validateCreativeBlock,
} from '../src/sdk/folioSdk';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function printHelp(): void {
  console.log(`
Folio CLI (${FOLIO_CURRENT_VERSION} · SDK v${FOLIO_SDK_VERSION})

Usage:
  npm run folio -- <command> [options]

Commands:
  status | doctor                 Inspect RAM, disk, binaries, Neo 4 KB, and backups
  docs [query]                    Show or search Folio documentation
  changelog [version]             Print complete Folio changelog
  sdk [ts|python]                 Print TypeScript & Python SDK reference
  chat "<prompt>" [--model id]    Send prompt to local server (fallback: Neo 4)
  neo4 "<prompt>"                 Run local Python Neo 4 engine offline
  kb ingest-docs                  Index Folio Docs, SDK, CLI & Changelog into folio_docs.db
  kb ingest <path> [--shard-rows] Stream large datasets into disk-sharded SQLite FTS5
  kb search "<query>"             Search disk-backed Folio Docs + Knowledge Shards
  kb stats                        Show disk-backed DB & shard stats
  validate <file>                 Validate evo/pixelart/stopmotion/threejs/liquidmotion spec
  backup create [label]           Create clean .tar.gz backup snapshot
  backup list                     List snapshots in .folio-data/backups
`);
}

function cmdDoctor(): void {
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  const checkBin = (paths: string[], cmdName: string): string => {
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    const w = spawnSync('which', [cmdName], { encoding: 'utf8' });
    return w.status === 0 && w.stdout.trim() ? w.stdout.trim() : 'not installed';
  };

  const kbStatsRaw = spawnSync(
    'python3',
    [path.join(ROOT_DIR, 'python', 'neo4_trainer.py'), '--stats'],
    { cwd: ROOT_DIR, encoding: 'utf8' }
  );
  let kbStats: Record<string, unknown> = {};
  try {
    kbStats = JSON.parse(kbStatsRaw.stdout || '{}');
  } catch {
    kbStats = { error: kbStatsRaw.stderr || 'unavailable' };
  }

  const backupsDir = path.join(ROOT_DIR, '.folio-data', 'backups');
  const backups = fs.existsSync(backupsDir)
    ? fs.readdirSync(backupsDir).filter((f) => f.endsWith('.tar.gz'))
    : [];

  const modelsDir = path.join(ROOT_DIR, '.folio-data', 'models');
  const ggufModels = fs.existsSync(modelsDir)
    ? fs.readdirSync(modelsDir).filter((f) => f.endsWith('.gguf'))
    : [];

  console.log(
    JSON.stringify(
      {
        version: FOLIO_CURRENT_VERSION,
        memory: { totalMb, freeMb, healthyForHeavyTools: freeMb >= 450, healthyForBlender: freeMb >= 650, healthyForTinyLlm: freeMb >= 1100 },
        toolchains: {
          node: process.version,
          python3: checkBin(['/usr/bin/python3'], 'python3'),
          ffmpeg: checkBin(['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'], 'ffmpeg'),
          llamaCpp: checkBin([path.join(ROOT_DIR, '.folio-data', 'bin', 'llama-completion'), path.join(ROOT_DIR, '.folio-data', 'bin', 'llama-cli')], 'llama-completion'),
          blender: checkBin(['/opt/folio-toolchains/blender/blender', '/usr/bin/blender', '/usr/local/bin/blender'], 'blender'),
          godot: checkBin(['/opt/folio-toolchains/godot/godot4', '/usr/local/bin/godot4', '/usr/bin/godot'], 'godot'),
          cmake: checkBin(['/opt/folio-toolchains/cmake-dist/bin/cmake', '/usr/bin/cmake'], 'cmake'),
          kotlinc: checkBin(['/opt/folio-toolchains/kotlinc/bin/kotlinc', '/usr/bin/kotlinc'], 'kotlinc'),
        },
        tinyLocalLlm: {
          installed: ggufModels.length > 0,
          models: ggufModels,
        },
        knowledgeBase: kbStats,
        backups,
      },
      null,
      2
    )
  );
}

function cmdDocs(args: string[]): void {
  const query = args.join(' ').trim();
  const hits = query ? searchFolioDocs(query, 6) : FOLIO_DOCS_SECTIONS;
  if (hits.length === 0) {
    console.log(`No documentation sections matched "${query}".`);
    return;
  }
  for (const sec of hits) {
    console.log(`\n=== [${sec.category}] ${sec.title} (id: ${sec.id}) ===`);
    console.log(sec.summary);
    if (query) {
      console.log('\n' + sec.content);
      if (sec.codeExample) {
        console.log(`\n--- ${sec.codeExample.label} ---\n${sec.codeExample.code}`);
      }
    }
  }
}

function cmdChangelog(args: string[]): void {
  const filter = args.join(' ').trim().toLowerCase();
  const list = filter
    ? FOLIO_CHANGELOGS.filter(
        (c) => c.version.toLowerCase().includes(filter) || c.codename.toLowerCase().includes(filter)
      )
    : FOLIO_CHANGELOGS;
  for (const rel of list) {
    console.log(`\n## ${rel.version} (${rel.codename} · ${rel.date})`);
    console.log(rel.summary);
    for (const hl of rel.highlights) {
      console.log(`  - [${hl.category}] ${hl.title}: ${hl.detail}`);
    }
  }
}

function cmdSdk(args: string[]): void {
  const target = (args[0] || '').toLowerCase();
  if (target === 'python' || target === 'py') {
    cmdDocs(['sdk-python']);
  } else if (target === 'ts' || target === 'typescript') {
    cmdDocs(['sdk-ts']);
  } else {
    cmdDocs(['sdk-ts']);
    cmdDocs(['sdk-python']);
  }
}

function cmdNeo4(args: string[]): void {
  const prompt = args.join(' ').trim();
  if (!prompt) {
    console.error('Usage: folio neo4 "<prompt>"');
    process.exit(1);
  }
  const proc = spawnSync('python3', [path.join(ROOT_DIR, 'python', 'neo4_engine.py')], {
    cwd: ROOT_DIR,
    input: JSON.stringify({
      thinkingMode: 'deep',
      semanticEngineEnabled: true,
      messages: [{ role: 'user', text: prompt }],
    }),
    encoding: 'utf8',
  });
  if (proc.status !== 0) {
    console.error(proc.stderr || 'Neo 4 execution failed');
    process.exit(1);
  }
  const res = JSON.parse(proc.stdout);
  console.log(res.text || proc.stdout);
}

async function cmdChat(args: string[]): Promise<void> {
  let modelId = 'auto';
  const promptParts: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--model' && i + 1 < args.length) {
      modelId = args[i + 1];
      i += 1;
    } else {
      promptParts.push(args[i]);
    }
  }
  const prompt = promptParts.join(' ').trim();
  if (!prompt) {
    console.error('Usage: folio chat "<prompt>" [--model auto|neo-4|flash-lite-3.1]');
    process.exit(1);
  }
  try {
    const res = await fetch('http://localhost:3000/api/chat/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId,
        autoFallback: true,
        messages: [{ role: 'user', text: prompt }],
      }),
    });
    const data = (await res.json()) as { text?: string; error?: string; modelId?: string };
    if (!res.ok || !data.text) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    console.log(`[model: ${data.modelId || modelId}]\n${data.text}`);
  } catch {
    console.log('[server unavailable — running offline via Neo 4]');
    cmdNeo4([prompt]);
  }
}

function cmdKb(args: string[]): void {
  const sub = args[0];
  const trainer = path.join(ROOT_DIR, 'python', 'neo4_trainer.py');
  if (sub === 'ingest-docs') {
    const payload = JSON.stringify({
      sections: FOLIO_DOCS_SECTIONS,
      changelogs: FOLIO_CHANGELOGS,
      version: FOLIO_CURRENT_VERSION,
    });
    const out = execFileSync('python3', [trainer, '--ingest-folio-docs'], {
      cwd: ROOT_DIR,
      input: payload,
      encoding: 'utf8',
    });
    console.log(out.trim());
  } else if (sub === 'stats') {
    const out = execFileSync('python3', [trainer, '--stats'], { cwd: ROOT_DIR, encoding: 'utf8' });
    console.log(out.trim());
  } else if (sub === 'ingest') {
    const target = args[1];
    if (!target) {
      console.error('Usage: folio kb ingest <file-or-dir> [--shard-rows 500000]');
      process.exit(1);
    }
    const extra = args.slice(2);
    const out = execFileSync('python3', [trainer, '--ingest-shards', target, ...extra], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    });
    console.log(out.trim());
  } else if (sub === 'search') {
    const query = args.slice(1).join(' ').trim();
    if (!query) {
      console.error('Usage: folio kb search "<query>"');
      process.exit(1);
    }
    const pyCode = `import json, sys; sys.path.insert(0, 'python'); from folio_sdk import KnowledgeStore; print(json.dumps(KnowledgeStore().search(sys.argv[1], limit=8), indent=2))`;
    const out = execFileSync('python3', ['-c', pyCode, query], { cwd: ROOT_DIR, encoding: 'utf8' });
    console.log(out.trim());
  } else {
    console.error('Unknown kb subcommand. Use: ingest-docs | ingest | search | stats');
    process.exit(1);
  }
}

function cmdValidate(args: string[]): void {
  const filePath = args[0];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('Usage: folio validate <path-to-json-or-md>');
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const fenceMatch = /```(evo|pixelart|stopmotion|threejs|liquidmotion)\s*([\s\S]*?)```/i.exec(raw);
  if (fenceMatch) {
    const kind = fenceMatch[1].toLowerCase() as 'evo' | 'pixelart' | 'stopmotion' | 'threejs' | 'liquidmotion';
    const res = validateCreativeBlock(kind, fenceMatch[2].trim());
    console.log(JSON.stringify({ file: filePath, kind, ...res }, null, 2));
    if (!res.valid) process.exit(1);
    return;
  }
  const parsed = JSON.parse(raw) as { format?: string; nodes?: unknown[]; objects?: unknown[]; draw?: unknown[] };
  const fmt = String(parsed.format || '').toLowerCase();
  const kind = fmt.startsWith('evo') || Array.isArray(parsed.nodes)
    ? 'evo'
    : fmt.startsWith('pixel') || Array.isArray(parsed.draw)
    ? 'pixelart'
    : fmt.startsWith('three') || Array.isArray(parsed.objects)
    ? 'threejs'
    : fmt.startsWith('liquid')
    ? 'liquidmotion'
    : 'stopmotion';
  const res = validateCreativeBlock(kind, raw);
  console.log(JSON.stringify({ file: filePath, kind, ...res }, null, 2));
  if (!res.valid) process.exit(1);
}

function cmdBackup(args: string[]): void {
  const sub = args[0] || 'list';
  const backupsDir = path.join(ROOT_DIR, '.folio-data', 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  if (sub === 'list') {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.endsWith('.tar.gz'))
      .map((name) => {
        const st = fs.statSync(path.join(backupsDir, name));
        return { name, sizeMb: Number((st.size / 1024 / 1024).toFixed(2)), mtime: st.mtime.toISOString() };
      });
    console.log(JSON.stringify({ backupsDir, count: files.length, backups: files }, null, 2));
    return;
  }
  if (sub === 'create') {
    const label = (args[1] || 'cli').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(backupsDir, `folio-${label}-${stamp}.tar.gz`);
    execFileSync(
      'tar',
      ['--exclude=.folio-data', '--exclude=node_modules', '--exclude=dist', '--exclude=.git', '-czf', dest, '.'],
      { cwd: ROOT_DIR }
    );
    const st = fs.statSync(dest);
    console.log(JSON.stringify({ ok: true, file: dest, sizeMb: Number((st.size / 1024 / 1024).toFixed(2)) }, null, 2));
    return;
  }
  console.error('Usage: folio backup [list|create [label]]');
  process.exit(1);
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  switch ((cmd || '').toLowerCase()) {
    case 'status':
    case 'doctor':
      cmdDoctor();
      break;
    case 'docs':
      cmdDocs(rest);
      break;
    case 'changelog':
      cmdChangelog(rest);
      break;
    case 'sdk':
      cmdSdk(rest);
      break;
    case 'neo4':
      cmdNeo4(rest);
      break;
    case 'chat':
      await cmdChat(rest);
      break;
    case 'kb':
      cmdKb(rest);
      break;
    case 'validate':
      cmdValidate(rest);
      break;
    case 'backup':
      cmdBackup(rest);
      break;
    default:
      printHelp();
      break;
  }
}

void main();
