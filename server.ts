import 'dotenv/config';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import dns from 'dns/promises';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
  ThinkingLevel,
  Type,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please set a billing-enabled API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface IncomingAttachment {
  name: string;
  mimeType: string;
  data?: string;
  isText?: boolean;
  textContent?: string;
}

interface IncomingMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: IncomingAttachment[];
}

type ModelChoiceId =
  | 'flash-lite-3.1'
  | 'hydrogen-4-fast'
  | 'hydrogen-4-balanced'
  | 'hydrogen-4-deep';

type SafetyLevel = 'max' | 'medium' | 'low' | 'none';

interface IncomingSafetyFilters {
  harassment?: SafetyLevel;
  hateSpeech?: SafetyLevel;
  sexuallyExplicit?: SafetyLevel;
  dangerousContent?: SafetyLevel;
}

function mapThreshold(level: SafetyLevel | undefined): HarmBlockThreshold {
  switch (level) {
    case 'max':
      return HarmBlockThreshold.BLOCK_LOW_AND_ABOVE;
    case 'low':
      return HarmBlockThreshold.BLOCK_ONLY_HIGH;
    case 'none':
      return HarmBlockThreshold.BLOCK_NONE;
    case 'medium':
    default:
      return HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
  }
}

function buildSafetySettings(filters?: IncomingSafetyFilters): SafetySetting[] {
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: mapThreshold(filters?.harassment),
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: mapThreshold(filters?.hateSpeech),
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: mapThreshold(filters?.sexuallyExplicit),
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: mapThreshold(filters?.dangerousContent),
    },
  ];
}

interface ResolvedModelConfig {
  id: ModelChoiceId;
  model: string;
  thinkingLevel: ThinkingLevel;
}

function getModelConfig(modelId: ModelChoiceId | undefined): ResolvedModelConfig {
  switch (modelId) {
    case 'hydrogen-4-deep':
      return {
        id: 'hydrogen-4-deep',
        model: 'gemini-4-hydrogen',
        thinkingLevel: ThinkingLevel.HIGH,
      };
    case 'hydrogen-4-balanced':
      return {
        id: 'hydrogen-4-balanced',
        model: 'gemini-4-hydrogen',
        thinkingLevel: ThinkingLevel.MEDIUM,
      };
    case 'hydrogen-4-fast':
      return {
        id: 'hydrogen-4-fast',
        model: 'gemini-4-hydrogen',
        thinkingLevel: ThinkingLevel.LOW,
      };
    case 'flash-lite-3.1':
    default:
      return {
        id: 'flash-lite-3.1',
        model: 'gemini-3.1-flash-lite',
        thinkingLevel: ThinkingLevel.MINIMAL,
      };
  }
}

function getFallbackConfig(primary: ResolvedModelConfig): ResolvedModelConfig {
  if (primary.model === 'gemini-3.1-flash-lite') {
    return {
      id: 'hydrogen-4-fast',
      model: 'gemini-4-hydrogen',
      thinkingLevel: ThinkingLevel.LOW,
    };
  }
  return {
    id: 'flash-lite-3.1',
    model: 'gemini-3.1-flash-lite',
    thinkingLevel: ThinkingLevel.MINIMAL,
  };
}

function isDemandOrTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('resource_exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('rate limit')
  );
}

function extractCleanErrorText(raw: string): string {
  let current = raw.trim();
  for (let i = 0; i < 3; i += 1) {
    if (!current.startsWith('{')) break;
    try {
      const parsed = JSON.parse(current) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof parsed.error === 'object' && parsed.error?.message) {
        current = parsed.error.message.trim();
      } else if (typeof parsed.message === 'string') {
        current = parsed.message.trim();
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return current;
}

function formatErrorMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const clean = extractCleanErrorText(raw);
  const lower = clean.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return {
      status: 400,
      message: 'The configured API key appears invalid. Please verify it in Settings > Secrets.',
    };
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Permission denied when reaching the model service. Check your API key in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message: 'Selected model is rate-limited right now. Try switching to another model in the top menu.',
    };
  }
  if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
    return {
      status: 503,
      message: 'This model is experiencing a temporary spike in demand. Please retry or switch models in the top selector.',
    };
  }
  if (lower.includes('gemini_api_key is not configured')) {
    return {
      status: 500,
      message: clean,
    };
  }
  return {
    status: 500,
    message: clean || 'An unexpected error occurred while generating a response.',
  };
}

app.post('/api/chat/stream', async (req: Request, res: Response) => {
  const { messages, modelId, autoFallback, systemInstruction, safetyFilters } =
    req.body as {
      messages?: IncomingMessage[];
      modelId?: ModelChoiceId;
      autoFallback?: boolean;
      systemInstruction?: string;
      safetyFilters?: IncomingSafetyFilters;
    };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'At least one message is required.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(': stream-open\n\n');

  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      clientClosed = true;
    }
  });

  const sendEvent = (payload: Record<string, unknown>) => {
    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  try {
    const ai = createGeminiClient();
    const contents = messages.map((msg) => {
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.isText && att.textContent !== undefined) {
            parts.push({
              text: `[Attached file: ${att.name}]\n\`\`\`\n${att.textContent}\n\`\`\``,
            });
          } else if (att.data && att.mimeType) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          }
        }
      }

      if (msg.text && msg.text.trim().length > 0) {
        parts.push({ text: msg.text });
      } else if (parts.length === 0) {
        parts.push({ text: '' });
      }

      return {
        role: msg.role,
        parts,
      };
    });

    const STOP_MOTION_CAPABILITY_GUIDE = `
If the user asks you to create, write, code, or animate a stop-motion animation, flipbook, or vector animation, output a single fenced code block tagged \`\`\`stopmotion containing valid JSON matching this schema:
{
  "title": "Short Animation Title",
  "fps": 10,
  "width": 800,
  "height": 450,
  "background": "#faf8f5",
  "loop": true,
  "pingPong": false,
  "frames": [
    { "hold": 1, "svg": "<circle cx=\\"120\\" cy=\\"300\\" r=\\"28\\" fill=\\"#e11d48\\" />" }
  ]
}
Requirements for \`stopmotion\` blocks:
- Include 6 to 14 frames with clear frame-by-frame motion, arcs, squash-and-stretch, or evolving SVG geometry.
- Each frame "svg" should contain clean SVG elements (<circle>, <ellipse>, <rect>, <path>, <polygon>, <line>, <g>) sized for the width/height canvas (default 800x450), with no <script> tags.
- Ensure valid JSON syntax with escaped double quotes inside "svg" strings.`;

    const PIXEL_ART_CAPABILITY_GUIDE = `
If the user asks you to create, draw, generate, or code complex pixel art, retro sprites, 8-bit/16-bit scenes, or animated pixel sprites, output a single fenced code block tagged \`\`\`pixelart containing valid JSON matching this compact palette-row schema:
{
  "title": "Scene or Character Title",
  "width": 32,
  "height": 32,
  "fps": 8,
  "loop": true,
  "palette": {
    ".": "transparent",
    "#": "#0f172a",
    "b": "#3b82f6",
    "c": "#38bdf8",
    "w": "#ffffff"
  },
  "frames": [
    [
      "................................",
      "............########............",
      "...........#bbbbbbbb#...........",
      "..."
    ]
  ]
}
Requirements for \`pixelart\` blocks:
- Use character-mapped palettes ("palette" object mapping single characters like ".", "#", "a", "b", "c", etc. to hex codes or "transparent").
- "frames" is an array of frames, where each frame is an array of strings (one string per row, each character corresponding to a palette key). Row string length must equal "width", and array length must equal "height".
- Standard canvas dimensions: 16x16, 24x24, 32x32, or 48x48.
- For animated pixel art, provide 2 to 8 frames showcasing subtle breathing, idle bobbing, blinking, glowing energy, flame flicker, or run cycles.
- For single static illustrations, a single frame is sufficient.
- Craft rich shading (highlights, midtones, shadows, bounce light, dithering) for high complexity and aesthetic polish.`;

    const WEBSITE_RENDER_CAPABILITY_GUIDE = `
When the user asks you to build, design, or render a website or web app, provide a complete, self-contained HTML (with embedded CSS/JS) or React TSX code block so Folio can immediately render it live inline and publish it to an online URL (/sandbox/:id). Note that Folio can also preview external https:// websites directly via its Web Preview browser.`;

    const trimmedSystem = systemInstruction?.trim();
    const capabilityGuides = `${STOP_MOTION_CAPABILITY_GUIDE}\n\n${PIXEL_ART_CAPABILITY_GUIDE}\n\n${WEBSITE_RENDER_CAPABILITY_GUIDE}`;
    const effectiveSystemInstruction = trimmedSystem
      ? `${trimmedSystem}\n\n${capabilityGuides}`
      : capabilityGuides;
    const safetySettings = buildSafetySettings(safetyFilters);
    const primary = getModelConfig(modelId);
    const shouldFallback = autoFallback !== false;

    const runModelStream = async (cfg: ResolvedModelConfig) => {
      const stream = await ai.models.generateContentStream({
        model: cfg.model,
        contents,
        config: {
          systemInstruction: effectiveSystemInstruction,
          safetySettings,
          thinkingConfig: {
            thinkingLevel: cfg.thinkingLevel,
          },
        },
      });

      let emittedChars = 0;
      let blockedReason: string | undefined;

      for await (const chunk of stream) {
        if (clientClosed) {
          break;
        }
        if (chunk.promptFeedback?.blockReason) {
          blockedReason = chunk.promptFeedback.blockReason;
        }
        const finishReason = chunk.candidates?.[0]?.finishReason;
        if (
          finishReason === 'SAFETY' ||
          finishReason === 'PROHIBITED_CONTENT' ||
          finishReason === 'SPII'
        ) {
          blockedReason = finishReason;
        }
        const text = chunk.text;
        if (text) {
          if (emittedChars === 0) {
            sendEvent({
              type: 'meta',
              modelId: cfg.id,
              ...(cfg.id !== primary.id ? { fallbackFrom: primary.id } : {}),
            });
          }
          emittedChars += text.length;
          sendEvent({ type: 'chunk', text });
        }
      }

      if (emittedChars === 0 && blockedReason) {
        throw new Error(
          `Blocked by safety filter (${blockedReason}). You can adjust thresholds in Safety filters.`
        );
      }

      return emittedChars;
    };

    const attempts: ResolvedModelConfig[] = shouldFallback
      ? [primary, getFallbackConfig(primary), primary]
      : [primary];

    let emittedChars = 0;
    let lastErr: unknown;

    for (let i = 0; i < attempts.length; i += 1) {
      if (clientClosed) break;
      try {
        emittedChars = await runModelStream(attempts[i]);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        const hasNext = i < attempts.length - 1;
        if (!clientClosed && hasNext && isDemandOrTransientError(err)) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        throw err;
      }
    }

    if (lastErr) {
      throw lastErr;
    }

    if (!clientClosed) {
      if (emittedChars === 0) {
        sendEvent({
          type: 'error',
          message: 'No response text was generated for this prompt. Please try again or switch models.',
        });
      } else {
        sendEvent({ type: 'done' });
      }
    }
  } catch (err) {
    const { message } = formatErrorMessage(err);
    sendEvent({ type: 'error', message });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

app.post('/api/chat/title', async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt || !prompt.trim()) {
    res.json({ title: 'New Conversation' });
    return;
  }

  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Summarize the following user request into a concise 3 to 5 word conversation title. Output only the title text without quotes or trailing punctuation:\n\n${prompt.slice(0, 600)}`,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    });

    const rawTitle = (response.text || '').trim().replace(/^["']|["']$/g, '');
    res.json({ title: rawTitle || prompt.slice(0, 42) });
  } catch {
    const fallback = prompt.trim().split(/\s+/).slice(0, 6).join(' ');
    res.json({ title: fallback || 'New Conversation' });
  }
});

function prepareReactUserSource(rawCode: string): string {
  let code = rawCode.trim();
  const hasExportDefault = /\bexport\s+default\b/.test(code);
  const hasReactImport = /\bfrom\s+['"]react['"]/.test(code);

  // Auto-import common React hooks if used without explicit import
  if (!hasReactImport) {
    const hooks = [
      'useState',
      'useEffect',
      'useRef',
      'useMemo',
      'useCallback',
      'useReducer',
      'useContext',
      'Fragment',
    ].filter((hook) => new RegExp(`\\b${hook}\\b`).test(code));

    if (hooks.length > 0) {
      code = `import React, { ${hooks.join(', ')} } from 'react';\n${code}`;
    } else {
      code = `import React from 'react';\n${code}`;
    }
  }

  if (hasExportDefault) {
    return code;
  }

  const componentMatch = code.match(
    /(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)\b/
  );
  if (componentMatch?.[1]) {
    return `${code}\nexport default ${componentMatch[1]};`;
  }

  if (code.startsWith('<')) {
    return `import React from 'react';\nexport default function PreviewComponent() {\n  return (\n    <>\n      ${code}\n    </>\n  );\n}`;
  }

  return `${code}\nexport default function PreviewFallback() { return null; }`;
}

app.post('/api/preview/bundle', async (req: Request, res: Response) => {
  const { code, language } = req.body as { code?: string; language?: string };

  if (typeof code !== 'string') {
    res.status(400).json({ error: 'Code is required.' });
    return;
  }

  const lang = (language || '').toLowerCase();

  try {
    if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
      const preparedSource = prepareReactUserSource(code);
      const loader: esbuild.Loader = lang === 'jsx' ? 'jsx' : 'tsx';
      const nodeModulesPath = path.resolve(__dirname, 'node_modules');

      const entryCode = `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import UserComponent from 'virtual:user-preview';

        const rootEl = document.getElementById('root');
        if (rootEl) {
          const root = createRoot(rootEl);
          if (typeof UserComponent === 'function') {
            root.render(React.createElement(UserComponent));
          } else if (React.isValidElement(UserComponent)) {
            root.render(UserComponent);
          } else {
            rootEl.textContent = 'Export a React component (e.g. export default function App() { ... }) to preview.';
          }
        }
      `;

      const result = await esbuild.build({
        stdin: {
          contents: entryCode,
          loader: 'tsx',
          resolveDir: __dirname,
        },
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: ['es2020'],
        jsx: 'automatic',
        nodePaths: [nodeModulesPath],
        plugins: [
          {
            name: 'virtual-user-preview',
            setup(build) {
              build.onResolve({ filter: /^virtual:user-preview$/ }, () => ({
                path: 'virtual:user-preview',
                namespace: 'user-preview-ns',
              }));
              build.onLoad(
                { filter: /.*/, namespace: 'user-preview-ns' },
                () => ({
                  contents: preparedSource,
                  loader,
                  resolveDir: __dirname,
                })
              );
            },
          },
        ],
      });

      const bundled = result.outputFiles[0]?.text || '';
      res.json({ code: bundled });
      return;
    }

    const isTs = lang === 'ts' || lang === 'typescript';
    const transformed = await esbuild.transform(code, {
      loader: isTs ? 'ts' : 'js',
      format: 'iife',
      target: 'es2020',
    });

    res.json({ code: transformed.code });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to compile code for preview.';
    res.status(400).json({ error: message });
  }
});

app.post('/api/preview/simulate', async (req: Request, res: Response) => {
  const { code, language, stdin } = req.body as {
    code?: string;
    language?: string;
    stdin?: string;
  };

  if (!code || !code.trim()) {
    res.status(400).json({ error: 'Code is required.' });
    return;
  }

  const promptText = [
    `Simulate executing the following ${language || 'code'} snippet accurately and concisely.`,
    stdin?.trim() ? `Standard input (stdin):\n${stdin}` : '',
    `Code:\n\`\`\`${language || ''}\n${code.slice(0, 8000)}\n\`\`\``,
  ]
    .filter(Boolean)
    .join('\n\n');

  const modelsToTry = [
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
  ];

  try {
    const ai = createGeminiClient();
    let lastErr: unknown;

    for (const cfg of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: cfg.model,
          contents: promptText,
          config: {
            systemInstruction:
              'You are a deterministic code execution simulator. Predict exact stdout, stderr, exitCode (0 for success, non-zero for errors), and a brief 1-sentence summary of what the program did or output.',
            thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                stdout: { type: Type.STRING },
                stderr: { type: Type.STRING },
                exitCode: { type: Type.INTEGER },
                summary: { type: Type.STRING },
              },
              required: ['stdout', 'stderr', 'exitCode', 'summary'],
            },
          },
        });

        const parsed = JSON.parse((response.text || '{}').trim()) as {
          stdout?: string;
          stderr?: string;
          exitCode?: number;
          summary?: string;
        };

        res.json({
          stdout: parsed.stdout ?? '',
          stderr: parsed.stderr ?? '',
          exitCode: typeof parsed.exitCode === 'number' ? parsed.exitCode : 0,
          summary: parsed.summary ?? '',
        });
        return;
      } catch (err) {
        lastErr = err;
        if (isDemandOrTransientError(err)) {
          continue;
        }
        throw err;
      }
    }

    throw lastErr;
  } catch (err) {
    const { status, message } = formatErrorMessage(err);
    res.status(status).json({ error: message });
  }
});

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

function runSandboxedProcess(
  command: string,
  args: string[],
  cwd: string,
  stdinText: string,
  timeoutMs = 6000
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const MAX_BYTES = 64 * 1024;
    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      env: {
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        HOME: cwd,
        TMPDIR: cwd,
        LANG: 'C.UTF-8',
        PYTHONDONTWRITEBYTECODE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_BYTES) {
        const text = chunk.toString('utf8');
        const remaining = MAX_BYTES - stdout.length;
        if (text.length > remaining) {
          stdout += text.slice(0, remaining);
          stdoutTruncated = true;
        } else {
          stdout += text;
        }
      } else {
        stdoutTruncated = true;
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_BYTES) {
        const text = chunk.toString('utf8');
        const remaining = MAX_BYTES - stderr.length;
        if (text.length > remaining) {
          stderr += text.slice(0, remaining);
          stderrTruncated = true;
        } else {
          stderr += text;
        }
      } else {
        stderrTruncated = true;
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
        durationMs: Math.round(performance.now() - startedAt),
        timedOut: false,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      let finalStdout = stdoutTruncated ? `${stdout}\n... [output truncated at 64 KB]` : stdout;
      let finalStderr = stderrTruncated ? `${stderr}\n... [stderr truncated at 64 KB]` : stderr;
      if (timedOut) {
        finalStderr = `${finalStderr ? `${finalStderr}\n` : ''}Execution timed out after ${timeoutMs / 1000}s.`;
      }
      resolve({
        stdout: finalStdout,
        stderr: finalStderr,
        exitCode: timedOut ? 124 : code ?? 0,
        durationMs: Math.round(performance.now() - startedAt),
        timedOut,
      });
    });

    if (stdinText) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();
  });
}

const SQL_RUNNER_SCRIPT = `
import sqlite3, sys

sql = open(sys.argv[1], 'r', encoding='utf-8').read()
conn = sqlite3.connect(':memory:')
cur = conn.cursor()

statements = []
buf = []
in_single = False
in_double = False
in_line_comment = False
in_block_comment = False
i = 0
n = len(sql)
while i < n:
    ch = sql[i]
    nxt = sql[i + 1] if i + 1 < n else ''
    if in_line_comment:
        buf.append(ch)
        if ch == '\\n':
            in_line_comment = False
    elif in_block_comment:
        buf.append(ch)
        if ch == '*' and nxt == '/':
            buf.append(nxt)
            in_block_comment = False
            i += 1
    elif in_single:
        buf.append(ch)
        if ch == "'" and nxt == "'":
            buf.append(nxt)
            i += 1
        elif ch == "'":
            in_single = False
    elif in_double:
        buf.append(ch)
        if ch == '"' and nxt == '"':
            buf.append(nxt)
            i += 1
        elif ch == '"':
            in_double = False
    else:
        if ch == '-' and nxt == '-':
            buf.append(ch); buf.append(nxt)
            in_line_comment = True
            i += 1
        elif ch == '/' and nxt == '*':
            buf.append(ch); buf.append(nxt)
            in_block_comment = True
            i += 1
        elif ch == "'":
            in_single = True
            buf.append(ch)
        elif ch == '"':
            in_double = True
            buf.append(ch)
        elif ch == ';':
            stmt = ''.join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
        else:
            buf.append(ch)
    i += 1

tail = ''.join(buf).strip()
if tail:
    statements.append(tail)

out_parts = []
for stmt in statements:
    cur.execute(stmt)
    if cur.description:
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        str_rows = [[('NULL' if v is None else str(v)) for v in r] for r in rows]
        widths = [len(c) for c in cols]
        for r in str_rows:
            for idx, val in enumerate(r):
                if len(val) > widths[idx]:
                    widths[idx] = min(len(val), 48)
        def fmt_row(vals):
            return ' | '.join((v[:45] + '...' if len(v) > 48 else v).ljust(widths[idx]) for idx, v in enumerate(vals))
        sep = '-+-'.join('-' * w for w in widths)
        lines = [fmt_row(cols), sep] + [fmt_row(r) for r in str_rows]
        lines.append(f"({len(rows)} row{'s' if len(rows) != 1 else ''})")
        out_parts.append('\\n'.join(lines))
    else:
        conn.commit()
        rc = cur.rowcount
        if rc is not None and rc >= 0:
            out_parts.append(f"Query OK ({rc} row{'s' if rc != 1 else ''} affected)")
        else:
            out_parts.append("Query OK")

print('\\n\\n'.join(out_parts))
`;

app.post('/api/code/execute', async (req: Request, res: Response) => {
  const { code, language, stdin } = req.body as {
    code?: string;
    language?: string;
    stdin?: string;
  };

  if (typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'Code is required.' });
    return;
  }

  const lang = (language || '').trim().toLowerCase();
  const stdinText = typeof stdin === 'string' ? stdin : '';
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folio-exec-'));

  try {
    if (lang === 'python' || lang === 'py' || lang === 'python3') {
      const scriptPath = path.join(tmpDir, 'main.py');
      await fs.promises.writeFile(scriptPath, code, 'utf8');
      const result = await runSandboxedProcess('python3', ['-u', scriptPath], tmpDir, stdinText);
      res.json({ ...result, mode: 'native', runtime: 'Python 3' });
      return;
    }

    if (lang === 'bash' || lang === 'sh' || lang === 'shell' || lang === 'zsh') {
      const scriptPath = path.join(tmpDir, 'script.sh');
      await fs.promises.writeFile(scriptPath, code, 'utf8');
      const result = await runSandboxedProcess('bash', [scriptPath], tmpDir, stdinText);
      res.json({ ...result, mode: 'native', runtime: 'Bash' });
      return;
    }

    if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
      const isTs = lang === 'typescript' || lang === 'ts';
      let compiled = code;
      try {
        const transformed = await esbuild.transform(code, {
          loader: isTs ? 'ts' : 'js',
          format: 'cjs',
          target: 'node20',
        });
        compiled = transformed.code;
      } catch (compileErr) {
        const msg = compileErr instanceof Error ? compileErr.message : 'Syntax error';
        res.json({
          stdout: '',
          stderr: msg,
          exitCode: 1,
          durationMs: 0,
          timedOut: false,
          mode: 'native',
          runtime: `Node.js ${process.version}`,
        });
        return;
      }
      const scriptPath = path.join(tmpDir, 'main.cjs');
      await fs.promises.writeFile(scriptPath, compiled, 'utf8');
      const result = await runSandboxedProcess('node', [scriptPath], tmpDir, stdinText);
      res.json({ ...result, mode: 'native', runtime: `Node.js ${process.version}` });
      return;
    }

    if (lang === 'sql' || lang === 'sqlite' || lang === 'postgres' || lang === 'postgresql' || lang === 'mysql') {
      const sqlPath = path.join(tmpDir, 'query.sql');
      const runnerPath = path.join(tmpDir, 'run_sql.py');
      await fs.promises.writeFile(sqlPath, code, 'utf8');
      await fs.promises.writeFile(runnerPath, SQL_RUNNER_SCRIPT, 'utf8');
      const result = await runSandboxedProcess('python3', [runnerPath, sqlPath], tmpDir, stdinText);
      res.json({ ...result, mode: 'native', runtime: 'SQLite 3' });
      return;
    }

    res.status(422).json({
      error: `Native execution is not installed for "${language || 'unknown'}".`,
      unsupportedNative: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Code execution failed.';
    res.status(500).json({ error: message });
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Online Sandbox Hosting (/api/sandbox/publish & /sandbox/:id)
// ---------------------------------------------------------------------------

interface PublishedSandboxRecord {
  id: string;
  title: string;
  language: string;
  html: string;
  createdAt: number;
}

const FOLIO_DATA_DIR = path.resolve(__dirname, '.folio-data');
const SANDBOX_STORE_PATH = path.join(FOLIO_DATA_DIR, 'sandboxes.json');
const FLOW_MEDIA_DIR = path.join(FOLIO_DATA_DIR, 'flow-media');

fs.mkdirSync(FLOW_MEDIA_DIR, { recursive: true });

const sandboxStore = new Map<string, PublishedSandboxRecord>();

function loadSandboxesFromDisk() {
  try {
    if (!fs.existsSync(SANDBOX_STORE_PATH)) return;
    const raw = fs.readFileSync(SANDBOX_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as PublishedSandboxRecord[];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item.id === 'string' && typeof item.html === 'string') {
          sandboxStore.set(item.id, item);
        }
      }
    }
  } catch {
    // Ignore corrupt store
  }
}

function saveSandboxesToDisk() {
  try {
    const list = Array.from(sandboxStore.values()).slice(-200);
    fs.writeFileSync(SANDBOX_STORE_PATH, JSON.stringify(list), 'utf8');
  } catch {
    // Ignore disk write failure
  }
}

loadSandboxesFromDisk();

app.post('/api/sandbox/publish', (req: Request, res: Response) => {
  const { html, title, language } = req.body as {
    html?: string;
    title?: string;
    language?: string;
  };

  if (typeof html !== 'string' || !html.trim()) {
    res.status(400).json({ error: 'Compiled HTML is required to publish online.' });
    return;
  }

  const id = crypto.randomBytes(6).toString('hex');
  const record: PublishedSandboxRecord = {
    id,
    title: (title || 'Folio Online Sandbox').slice(0, 120),
    language: (language || 'html').slice(0, 40),
    html,
    createdAt: Date.now(),
  };

  sandboxStore.set(id, record);
  saveSandboxesToDisk();

  res.json({
    id,
    url: `/sandbox/${id}`,
    createdAt: record.createdAt,
  });
});

app.get('/sandbox/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const record = sandboxStore.get(id);
  if (!record) {
    res
      .status(404)
      .type('text/html')
      .send(
        `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:40px;background:#0d0d0d;color:#ececec;"><h2>Sandbox Not Found</h2><p>This online sandbox (${id}) has expired or does not exist.</p></body></html>`
      );
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(record.html);
});

// ---------------------------------------------------------------------------
// Google Flow — Real Omni / Veo Video, Nano Banana Frames/Ingredients & Lyria
// ---------------------------------------------------------------------------

function stripDataUrlPrefix(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/png', data: dataUrl };
}

async function saveFlowVideoOutput(
  videoPart: { data?: string; uri?: string; mime_type?: string } | null | undefined,
  clipId: string
): Promise<{ videoUrl: string; mimeType: string }> {
  if (!videoPart) {
    throw new Error('The model completed without returning a video output.');
  }

  const mimeType = videoPart.mime_type || 'video/mp4';

  if (videoPart.data) {
    const buffer = Buffer.from(videoPart.data, 'base64');
    const filename = `${clipId}.mp4`;
    await fs.promises.writeFile(path.join(FLOW_MEDIA_DIR, filename), buffer);
    return { videoUrl: `/api/flow/media/${filename}`, mimeType };
  }

  if (videoPart.uri) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const fetchUrl = videoPart.uri.includes('?')
      ? `${videoPart.uri}&key=${encodeURIComponent(apiKey)}`
      : `${videoPart.uri}?key=${encodeURIComponent(apiKey)}`;
    const upstream = await fetch(fetchUrl);
    if (upstream.ok) {
      const arrayBuf = await upstream.arrayBuffer();
      const filename = `${clipId}.mp4`;
      await fs.promises.writeFile(
        path.join(FLOW_MEDIA_DIR, filename),
        Buffer.from(arrayBuf)
      );
      return { videoUrl: `/api/flow/media/${filename}`, mimeType };
    }
    return { videoUrl: videoPart.uri, mimeType };
  }

  throw new Error('Video output did not contain playable media bytes or URI.');
}

app.get('/api/flow/media/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!/^[a-zA-Z0-9_-]+\.(mp4|webm|wav|mp3)$/.test(filename)) {
    res.status(400).json({ error: 'Invalid media filename.' });
    return;
  }
  const filePath = path.join(FLOW_MEDIA_DIR, filename);
  try {
    const stat = await fs.promises.stat(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === '.wav'
        ? 'audio/wav'
        : ext === '.mp3'
        ? 'audio/mpeg'
        : ext === '.webm'
        ? 'video/webm'
        : 'video/mp4';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch {
    res.status(404).json({ error: 'Media clip not found.' });
  }
});

app.post('/api/flow/generate-image', async (req: Request, res: Response) => {
  const { prompt, aspectRatio, quality } = req.body as {
    prompt?: string;
    aspectRatio?: string;
    quality?: 'fast' | 'high';
  };

  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: 'Prompt is required to generate a frame or ingredient.' });
    return;
  }

  try {
    const ai = createGeminiClient();
    const model =
      quality === 'high' ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

    const interaction = await ai.interactions.create({
      model,
      input: prompt.trim(),
      store: true,
      response_modalities: ['image', 'text'],
      generation_config: {
        image_config: {
          aspect_ratio: aspectRatio === '9:16' || aspectRatio === '1:1' ? aspectRatio : '16:9',
          image_size: '1K',
        },
      },
    });

    let imageData: string | undefined;
    let mimeType = 'image/png';

    if (interaction.output_image?.data) {
      imageData = interaction.output_image.data;
      mimeType = interaction.output_image.mime_type || 'image/png';
    } else if (Array.isArray(interaction.steps)) {
      for (const step of interaction.steps) {
        if (step.type === 'model_output' && Array.isArray(step.content)) {
          const img = step.content.find((c) => c.type === 'image') as
            | { type: string; data?: string; mime_type?: string }
            | undefined;
          if (img?.data) {
            imageData = img.data;
            mimeType = img.mime_type || 'image/png';
            break;
          }
        }
      }
    }

    if (!imageData) {
      throw new Error('Image model returned no image data.');
    }

    res.json({
      imageDataUrl: `data:${mimeType};base64,${imageData}`,
      mimeType,
      interactionId: interaction.id,
    });
  } catch (err) {
    const { status, message } = formatErrorMessage(err);
    res.status(status).json({ error: message });
  }
});

app.post('/api/flow/generate-video', async (req: Request, res: Response) => {
  const {
    mode,
    prompt,
    cameraMotion,
    aspectRatio,
    duration,
    resolution,
    startFrame,
    endFrame,
    ingredients,
  } = req.body as {
    mode?: 'text' | 'frames' | 'ingredients';
    prompt?: string;
    cameraMotion?: string;
    aspectRatio?: '16:9' | '9:16';
    duration?: string;
    resolution?: '360p' | '720p' | '1080p';
    startFrame?: { data: string; mimeType?: string };
    endFrame?: { data: string; mimeType?: string };
    ingredients?: Array<{ name?: string; data: string; mimeType?: string }>;
  };

  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: 'A scene prompt is required.' });
    return;
  }

  try {
    const ai = createGeminiClient();
    const cameraLine =
      cameraMotion && cameraMotion !== 'Auto Director'
        ? ` Camera direction: ${cameraMotion}.`
        : '';

    const parts: Array<
      | { type: 'image'; mime_type: string; data: string }
      | { type: 'text'; text: string }
    > = [];

    if (mode === 'frames') {
      if (startFrame?.data) {
        const cleanStart = stripDataUrlPrefix(startFrame.data);
        parts.push({
          type: 'image',
          mime_type: startFrame.mimeType || cleanStart.mimeType,
          data: cleanStart.data,
        });
      }
      if (endFrame?.data) {
        const cleanEnd = stripDataUrlPrefix(endFrame.data);
        parts.push({
          type: 'image',
          mime_type: endFrame.mimeType || cleanEnd.mimeType,
          data: cleanEnd.data,
        });
      }
      const frameDirective =
        startFrame?.data && endFrame?.data
          ? 'Smoothly animate from the first frame to the second frame. '
          : startFrame?.data
          ? 'Animate starting from the provided reference frame. '
          : '';
      parts.push({
        type: 'text',
        text: `${frameDirective}${prompt.trim()}${cameraLine}`,
      });
    } else if (mode === 'ingredients' && Array.isArray(ingredients) && ingredients.length > 0) {
      const validIngredients = ingredients.slice(0, 3);
      const ingredientDescriptions: string[] = [];
      validIngredients.forEach((ing, idx) => {
        const clean = stripDataUrlPrefix(ing.data);
        parts.push({
          type: 'image',
          mime_type: ing.mimeType || clean.mimeType,
          data: clean.data,
        });
        ingredientDescriptions.push(
          `Reference ${idx + 1}${ing.name ? ` (${ing.name})` : ''}`
        );
      });
      parts.push({
        type: 'text',
        text: `Using ${ingredientDescriptions.join(', ')} consistently in the scene: ${prompt.trim()}${cameraLine}`,
      });
    }

    // For 2-frame interpolation, Omni duration max is 10s
    let safeDuration = duration || '6s';
    if (mode === 'frames' && startFrame?.data && endFrame?.data) {
      const sec = parseInt(safeDuration, 10);
      if (Number.isFinite(sec) && sec > 10) {
        safeDuration = '10s';
      }
    }

    const interactionInput =
      parts.length > 0 ? parts : `${prompt.trim()}${cameraLine}`;

    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        input: interactionInput,
        background: false,
        store: true,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: aspectRatio === '9:16' ? '9:16' : '16:9',
          duration: safeDuration as '6s',
          resolution: (resolution || '720p') as '720p',
        },
      },
      { timeout: 300000 }
    );

    const clipId = `clip_${crypto.randomBytes(6).toString('hex')}`;
    const saved = await saveFlowVideoOutput(interaction.output_video, clipId);

    res.json({
      clipId,
      videoUrl: saved.videoUrl,
      mimeType: saved.mimeType,
      interactionId: interaction.id,
    });
  } catch (err) {
    const { status, message } = formatErrorMessage(err);
    res.status(status).json({ error: message });
  }
});

app.post('/api/flow/extend-video', async (req: Request, res: Response) => {
  const { previousInteractionId, prompt, duration } = req.body as {
    previousInteractionId?: string;
    prompt?: string;
    duration?: string;
  };

  if (!previousInteractionId) {
    res.status(400).json({ error: 'Previous interaction ID is required to extend or edit this shot.' });
    return;
  }
  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: 'Continuation or edit prompt is required.' });
    return;
  }

  try {
    const ai = createGeminiClient();
    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        previous_interaction_id: previousInteractionId,
        input: prompt.trim(),
        background: false,
        store: true,
        stream: false,
        response_format: {
          type: 'video',
          duration: (duration || '5s') as '5s',
        },
      },
      { timeout: 300000 }
    );

    const clipId = `clip_${crypto.randomBytes(6).toString('hex')}`;
    const saved = await saveFlowVideoOutput(interaction.output_video, clipId);

    res.json({
      clipId,
      videoUrl: saved.videoUrl,
      mimeType: saved.mimeType,
      interactionId: interaction.id,
    });
  } catch (err) {
    const { status, message } = formatErrorMessage(err);
    res.status(status).json({ error: message });
  }
});

app.post('/api/flow/generate-music', async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: 'Music prompt is required.' });
    return;
  }

  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContentStream({
      model: 'lyria-3-clip-preview',
      contents: prompt.trim(),
    });

    let audioBase64 = '';
    let lyrics = '';
    let mimeType = 'audio/wav';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    if (!audioBase64) {
      throw new Error('Lyria did not return audio data.');
    }

    const audioId = `score_${crypto.randomBytes(6).toString('hex')}`;
    const ext = mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const filename = `${audioId}.${ext}`;
    await fs.promises.writeFile(
      path.join(FLOW_MEDIA_DIR, filename),
      Buffer.from(audioBase64, 'base64')
    );

    res.json({
      audioId,
      audioUrl: `/api/flow/media/${filename}`,
      mimeType,
      lyrics,
    });
  } catch (err) {
    const { status, message } = formatErrorMessage(err);
    res.status(status).json({ error: message });
  }
});

// ==========================================
// Website Render Proxy & Inspector (SSRF-safe)
// ==========================================

function isPrivateOrBlockedIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/i, '');
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    ) {
      return true;
    }
    return false;
  }
  return true;
}

async function validatePublicWebUrl(rawInput: string): Promise<URL> {
  const trimmed = rawInput.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Please enter a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  const hostLower = parsed.hostname.toLowerCase();
  if (
    hostLower === 'localhost' ||
    hostLower.endsWith('.localhost') ||
    hostLower.endsWith('.local') ||
    hostLower.endsWith('.internal') ||
    hostLower === 'metadata.google.internal'
  ) {
    throw new Error('Local and private network hostnames cannot be proxied.');
  }

  if (net.isIP(hostLower)) {
    if (isPrivateOrBlockedIp(hostLower)) {
      throw new Error('Private or loopback IP addresses cannot be proxied.');
    }
  } else {
    try {
      const resolved = await dns.lookup(hostLower, { all: true });
      if (!resolved.length || resolved.some((entry) => isPrivateOrBlockedIp(entry.address))) {
        throw new Error('Target domain resolves to a restricted private IP address.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('restricted')) {
        throw err;
      }
      throw new Error(`Could not resolve host "${hostLower}".`);
    }
  }

  return parsed;
}

function buildRenderableHtml(html: string, finalUrl: string): string {
  let baseHref = finalUrl;
  try {
    baseHref = new URL('./', finalUrl).href;
  } catch {
    baseHref = finalUrl;
  }

  // Remove frame-blocking or strict CSP meta tags so assets and rendering work inside Folio iframe
  let cleaned = html
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?x-frame-options["']?[^>]*>/gi, '')
    .replace(/<base[^>]*>/gi, '');

  const escapeAttr = (val: string) =>
    val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const safeFinalUrlJson = JSON.stringify(finalUrl);
  const headInjection = `<base href="${escapeAttr(baseHref)}" target="_self">
<script>
(function(){
  var FOLIO_URL = ${safeFinalUrlJson};
  function notify(type, payload){
    try { window.parent.postMessage(Object.assign({ source: 'folio-web-preview', type: type }, payload), '*'); } catch(_) {}
  }
  window.addEventListener('DOMContentLoaded', function(){
    notify('loaded', { title: document.title || FOLIO_URL, url: FOLIO_URL });
  });
  window.addEventListener('load', function(){
    notify('loaded', { title: document.title || FOLIO_URL, url: FOLIO_URL });
  });
  document.addEventListener('click', function(e){
    var target = e.target;
    while (target && target.tagName !== 'A') target = target.parentElement;
    if (!target || !target.getAttribute) return;
    var rawHref = target.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
    try {
      var resolved = new URL(rawHref, FOLIO_URL);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        e.preventDefault();
        notify('navigate', { url: resolved.href });
      }
    } catch(_) {}
  }, true);
})();
</script>`;

  if (/<head[^>]*>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<head([^>]*)>/i, `<head$1>\n${headInjection}`);
  } else if (/<html[^>]*>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<html([^>]*)>/i, `<html$1><head>${headInjection}</head>`);
  } else {
    cleaned = `<!doctype html><html><head>${headInjection}</head><body>${cleaned}</body></html>`;
  }

  return cleaned;
}

function buildRenderErrorHtml(targetUrl: string, errorMessage: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #14161b; color: #eceff4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
  .card { max-width: 520px; width: 100%; border: 1px solid rgba(255,255,255,0.12); background: #1c1f26; border-radius: 16px; padding: 24px; }
  h2 { margin: 0 0 8px; font-size: 16px; }
  p { margin: 0 0 12px; font-size: 13px; color: #9ca3af; line-height: 1.5; word-break: break-word; }
  code { display: block; font-size: 12px; background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px; color: #fca5a5; margin-bottom: 14px; word-break: break-word; }
  a { display: inline-block; padding: 8px 14px; border-radius: 999px; background: #ffffff; color: #111827; font-size: 12px; font-weight: 600; text-decoration: none; }
</style>
</head>
<body>
  <div class="card">
    <h2>Unable to render website via proxy</h2>
    <p>${esc(targetUrl)}</p>
    <code>${esc(errorMessage)}</code>
    <a href="${esc(targetUrl)}" target="_blank" rel="noopener noreferrer">Open website in new tab</a>
  </div>
</body>
</html>`;
}

async function fetchUpstreamWebPage(targetUrl: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(targetUrl.href, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const finalUrl = upstream.url || targetUrl.href;
    // Re-validate final redirected hostname against private IPs
    await validatePublicWebUrl(finalUrl);
    return upstream;
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/web/render', async (req: Request, res: Response) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  if (!rawUrl.trim()) {
    res.status(400).type('html').send(buildRenderErrorHtml('', 'Missing url query parameter.'));
    return;
  }

  try {
    const targetUrl = await validatePublicWebUrl(rawUrl);
    const upstream = await fetchUpstreamWebPage(targetUrl);
    const finalUrl = upstream.url || targetUrl.href;
    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Folio-Final-Url', finalUrl);

    if (
      contentType.toLowerCase().includes('text/html') ||
      contentType.toLowerCase().includes('application/xhtml+xml')
    ) {
      const html = await upstream.text();
      const rewritten = buildRenderableHtml(html, finalUrl);
      res.status(upstream.status >= 400 ? upstream.status : 200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(rewritten);
      return;
    }

    const arrayBuf = await upstream.arrayBuffer();
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(arrayBuf));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch website.';
    res.status(502).type('html').send(buildRenderErrorHtml(rawUrl, message));
  }
});

app.get('/api/web/inspect', async (req: Request, res: Response) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  if (!rawUrl.trim()) {
    res.status(400).json({ error: 'Missing url query parameter.' });
    return;
  }

  try {
    const targetUrl = await validatePublicWebUrl(rawUrl);
    const upstream = await fetchUpstreamWebPage(targetUrl);
    const finalUrl = upstream.url || targetUrl.href;
    const contentType = upstream.headers.get('content-type') || '';
    const xFrameOptions = upstream.headers.get('x-frame-options') || '';
    const csp = upstream.headers.get('content-security-policy') || '';
    const frameBlockedByHeader =
      Boolean(xFrameOptions) || /frame-ancestors/i.test(csp);

    let title = finalUrl;
    let description = '';
    let html: string | undefined;

    if (
      contentType.toLowerCase().includes('text/html') ||
      contentType.toLowerCase().includes('application/xhtml+xml')
    ) {
      const text = await upstream.text();
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch?.[1]) {
        title = titleMatch[1].replace(/\s+/g, ' ').trim();
      }
      const descMatch =
        text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
        text.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
      if (descMatch?.[1]) {
        description = descMatch[1].trim();
      }
      html = text.slice(0, 512 * 1024);
    }

    res.json({
      finalUrl,
      status: upstream.status,
      statusText: upstream.statusText,
      contentType,
      title,
      description,
      frameBlockedByHeader,
      html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to inspect website.';
    res.status(400).json({ error: message });
  }
});

// ===========================================================================
// Persistent Sandbox Workspace Folders & Multi-File Folder Web Renderer
// ===========================================================================

const WORKSPACES_ROOT = path.join(FOLIO_DATA_DIR, 'workspaces');
const GITHUB_SESSIONS_PATH = path.join(FOLIO_DATA_DIR, 'github-sessions.json');
fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });

function sanitizeWorkspaceId(rawId: string): string {
  const cleaned = (rawId || '').trim();
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(cleaned)) {
    throw new Error('Invalid workspace ID. Use 3–64 alphanumeric, dash, or underscore characters.');
  }
  return cleaned;
}

function getWorkspaceDir(rawId: string): string {
  const id = sanitizeWorkspaceId(rawId);
  const dir = path.join(WORKSPACES_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveWorkspaceFilePath(workspaceDir: string, relPath: string): string {
  const normalized = (relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) {
    throw new Error('Invalid file path.');
  }
  const target = path.resolve(workspaceDir, normalized);
  if (target !== workspaceDir && !target.startsWith(workspaceDir + path.sep)) {
    throw new Error('Path traversal is not permitted.');
  }
  return target;
}

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.py': 'text/x-python; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
};

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.json', '.svg', '.py', '.sh', '.md', '.txt', '.xml', '.yml', '.yaml',
  '.toml', '.ini', '.env', '.sql', '.csv',
]);

function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function isProbablyTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || base === 'readme' || base === 'makefile' || !ext;
}

async function scanWorkspaceFiles(workspaceDir: string): Promise<{
  files: Array<{ path: string; size: number; isText: boolean; mimeType: string }>;
  entryFolders: string[];
}> {
  const results: Array<{ path: string; size: number; isText: boolean; mimeType: string }> = [];
  const entryFolderSet = new Set<string>();

  async function walk(currentDir: string, prefix: string) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === '.git' ||
        entry.name === 'node_modules' ||
        entry.name === '__pycache__' ||
        entry.name === '.folio-design-system.css'
      ) {
        continue;
      }
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(full);
        results.push({
          path: rel,
          size: stat.size,
          isText: isProbablyTextFile(rel),
          mimeType: detectMimeType(rel),
        });
        if (entry.name.toLowerCase() === 'index.html' || entry.name.toLowerCase() === 'index.htm') {
          entryFolderSet.add(prefix);
        }
      }
    }
  }

  await walk(workspaceDir, '');
  results.sort((a, b) => a.path.localeCompare(b.path));
  const entryFolders = Array.from(entryFolderSet).sort((a, b) => a.length - b.length);
  return { files: results, entryFolders };
}

app.get('/api/workspace/:id/files', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(req.params.id);
    const scanned = await scanWorkspaceFiles(workspaceDir);
    res.json(scanned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to list workspace files.';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/workspace/:id/file', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(req.params.id);
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const fullPath = resolveWorkspaceFilePath(workspaceDir, relPath);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: `File "${relPath}" not found.` });
      return;
    }
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      res.status(400).json({ error: 'Selected path is a directory.' });
      return;
    }
    if (stat.size > 1024 * 1024) {
      res.status(413).json({ error: 'File is larger than 1MB preview limit.' });
      return;
    }
    const content = await fs.promises.readFile(fullPath, 'utf8');
    res.json({ path: relPath, content, size: stat.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to read workspace file.';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/workspace/:id/files', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(req.params.id);
    const { files, clearBefore, designSystemCss } = req.body as {
      files?: Array<{ path: string; content: string; encoding?: 'utf8' | 'base64' }>;
      clearBefore?: boolean;
      designSystemCss?: string;
    };

    if (clearBefore) {
      const existing = await fs.promises.readdir(workspaceDir);
      for (const name of existing) {
        if (name === '.folio-design-system.css') continue;
        await fs.promises.rm(path.join(workspaceDir, name), { recursive: true, force: true });
      }
    }

    if (typeof designSystemCss === 'string') {
      await fs.promises.writeFile(
        path.join(workspaceDir, '.folio-design-system.css'),
        designSystemCss,
        'utf8'
      );
    }

    if (Array.isArray(files)) {
      for (const file of files.slice(0, 120)) {
        if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') continue;
        const fullPath = resolveWorkspaceFilePath(workspaceDir, file.path);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        if (file.encoding === 'base64') {
          await fs.promises.writeFile(fullPath, Buffer.from(file.content, 'base64'));
        } else {
          await fs.promises.writeFile(fullPath, file.content, 'utf8');
        }
      }
    }

    const scanned = await scanWorkspaceFiles(workspaceDir);
    res.json(scanned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to write workspace files.';
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/workspace/:id/file', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(req.params.id);
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const fullPath = resolveWorkspaceFilePath(workspaceDir, relPath);
    if (fullPath === workspaceDir) {
      res.status(400).json({ error: 'Cannot delete workspace root.' });
      return;
    }
    await fs.promises.rm(fullPath, { recursive: true, force: true });
    const scanned = await scanWorkspaceFiles(workspaceDir);
    res.json(scanned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to delete path.';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/workspace/:id/execute', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(req.params.id);
    const { code, language, filePath, stdin } = req.body as {
      code?: string;
      language?: string;
      filePath?: string;
      stdin?: string;
    };

    const stdinText = typeof stdin === 'string' ? stdin : '';
    let targetCode = typeof code === 'string' ? code : '';
    let resolvedScriptFile: string | null = null;

    if (filePath && filePath.trim()) {
      resolvedScriptFile = resolveWorkspaceFilePath(workspaceDir, filePath.trim());
      if (typeof code === 'string' && code.length > 0) {
        await fs.promises.mkdir(path.dirname(resolvedScriptFile), { recursive: true });
        await fs.promises.writeFile(resolvedScriptFile, code, 'utf8');
      } else if (fs.existsSync(resolvedScriptFile)) {
        targetCode = await fs.promises.readFile(resolvedScriptFile, 'utf8');
      }
    }

    if (!targetCode.trim()) {
      res.status(400).json({ error: 'Script code or existing file is required.' });
      return;
    }

    const ext = resolvedScriptFile ? path.extname(resolvedScriptFile).toLowerCase() : '';
    const lang = (language || ext.replace(/^\./, '') || 'python').trim().toLowerCase();

    let result: {
      stdout: string;
      stderr: string;
      exitCode: number;
      durationMs: number;
      timedOut: boolean;
    };
    let runtime = 'Python 3';

    if (lang === 'python' || lang === 'py' || lang === 'python3') {
      const scriptPath = resolvedScriptFile || path.join(workspaceDir, '__runner__.py');
      if (!resolvedScriptFile) {
        await fs.promises.writeFile(scriptPath, targetCode, 'utf8');
      }
      result = await runSandboxedProcess('python3', ['-u', scriptPath], workspaceDir, stdinText);
      if (!resolvedScriptFile) {
        await fs.promises.rm(scriptPath, { force: true }).catch(() => {});
      }
      runtime = 'Python 3 (Workspace)';
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      const scriptPath = resolvedScriptFile || path.join(workspaceDir, '__runner__.sh');
      if (!resolvedScriptFile) {
        await fs.promises.writeFile(scriptPath, targetCode, 'utf8');
      }
      result = await runSandboxedProcess('bash', [scriptPath], workspaceDir, stdinText);
      if (!resolvedScriptFile) {
        await fs.promises.rm(scriptPath, { force: true }).catch(() => {});
      }
      runtime = 'Bash (Workspace)';
    } else if (lang === 'javascript' || lang === 'js' || lang === 'mjs' || lang === 'typescript' || lang === 'ts') {
      const isTs = lang === 'typescript' || lang === 'ts';
      const transformed = await esbuild.transform(targetCode, {
        loader: isTs ? 'ts' : 'js',
        format: 'cjs',
        target: 'node20',
      });
      const compiledPath = path.join(workspaceDir, '__runner__.cjs');
      await fs.promises.writeFile(compiledPath, transformed.code, 'utf8');
      result = await runSandboxedProcess('node', [compiledPath], workspaceDir, stdinText);
      await fs.promises.rm(compiledPath, { force: true }).catch(() => {});
      runtime = `Node.js ${process.version} (Workspace)`;
    } else {
      res.status(400).json({ error: `Execution inside workspace supports Python, JS/TS, and Bash (got "${lang}").` });
      return;
    }

    const scanned = await scanWorkspaceFiles(workspaceDir);
    res.json({
      ...result,
      mode: 'native',
      runtime,
      files: scanned.files,
      entryFolders: scanned.entryFolders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Workspace script execution failed.';
    res.status(500).json({ error: msg });
  }
});

// Serve any workspace folder as a live multi-file web app!
app.get(['/workspace-site/:id', '/workspace-site/:id/*'], async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(req.params.id);
    const wildcard = (req.params as Record<string, string>)[0] || '';
    const relRequested = wildcard.replace(/^\/+/, '');

    // Ensure trailing slash when loading root or a directory so relative CSS/JS links work properly!
    if (!req.path.endsWith('/') && (!relRequested || (fs.existsSync(resolveWorkspaceFilePath(workspaceDir, relRequested)) && fs.statSync(resolveWorkspaceFilePath(workspaceDir, relRequested)).isDirectory()))) {
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      res.redirect(302, `${req.path}/${qs}`);
      return;
    }

    if (relRequested === '__folio_design_system.css') {
      const dsFile = path.join(workspaceDir, '.folio-design-system.css');
      const css = fs.existsSync(dsFile) ? await fs.promises.readFile(dsFile, 'utf8') : '/* No custom design tokens saved yet */';
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(css);
      return;
    }

    let targetPath = relRequested
      ? resolveWorkspaceFilePath(workspaceDir, relRequested)
      : path.join(workspaceDir, 'index.html');

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      const indexHtml = path.join(targetPath, 'index.html');
      const indexHtm = path.join(targetPath, 'index.htm');
      targetPath = fs.existsSync(indexHtml) ? indexHtml : indexHtm;
    }

    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      res
        .status(404)
        .type('text/html')
        .send(
          `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:32px;background:#111317;color:#eceff4;"><h3>No index.html found in "/${relRequested}"</h3><p style="opacity:0.75;font-size:14px;">Create an <code>index.html</code> file (directly or via a Python script) inside this folder to render it live.</p></body></html>`
        );
      return;
    }

    const mime = detectMimeType(targetPath);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');

    if (mime.startsWith('text/html')) {
      let html = await fs.promises.readFile(targetPath, 'utf8');
      const dsFile = path.join(workspaceDir, '.folio-design-system.css');
      if (fs.existsSync(dsFile)) {
        const dsTag = `<link rel="stylesheet" href="/workspace-site/${encodeURIComponent(req.params.id)}/__folio_design_system.css" />`;
        html = /<\/head>/i.test(html)
          ? html.replace(/<\/head>/i, `  ${dsTag}\n</head>`)
          : `${dsTag}\n${html}`;
      }
      res.send(html);
      return;
    }

    const bytes = await fs.promises.readFile(targetPath);
    res.send(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to render workspace folder.';
    res.status(400).type('text/plain').send(msg);
  }
});

// ===========================================================================
// GitHub OAuth Connection + Repo Browser & Folder Script Importer
// ===========================================================================

interface GitHubSessionRecord {
  accessToken: string;
  createdAt: number;
}

const githubSessionStore = new Map<string, GitHubSessionRecord>();

function loadGitHubSessions() {
  try {
    if (!fs.existsSync(GITHUB_SESSIONS_PATH)) return;
    const raw = fs.readFileSync(GITHUB_SESSIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, GitHubSessionRecord>;
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.accessToken === 'string') {
        githubSessionStore.set(k, v);
      }
    }
  } catch {
    // Ignore corrupt store
  }
}

function saveGitHubSessions() {
  try {
    const obj: Record<string, GitHubSessionRecord> = {};
    for (const [k, v] of githubSessionStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(GITHUB_SESSIONS_PATH, JSON.stringify(obj), 'utf8');
  } catch {
    // Ignore disk write failure
  }
}

loadGitHubSessions();

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function getGitHubTokenForRequest(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const sid = cookies['folio_gh_sid'];
  if (sid && githubSessionStore.has(sid)) {
    return githubSessionStore.get(sid)!.accessToken;
  }
  return process.env.GITHUB_TOKEN || null;
}

function getAppBaseUrl(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
  return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;
}

app.get('/api/github/status', async (req: Request, res: Response) => {
  const configured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const token = getGitHubTokenForRequest(req);
  if (!token) {
    res.json({ configured, connected: false });
    return;
  }

  try {
    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Folio-Studio',
      },
    });
    if (!ghRes.ok) {
      res.json({ configured, connected: false });
      return;
    }
    const user = (await ghRes.json()) as {
      login: string;
      name?: string | null;
      avatar_url?: string;
      html_url?: string;
    };
    res.json({ configured, connected: true, user });
  } catch {
    res.json({ configured, connected: false });
  }
});

app.get('/api/github/auth/url', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
    res.status(400).json({
      error:
        'GitHub OAuth requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Settings > Secrets. You can still import any public GitHub repository URL without logging in.',
    });
    return;
  }
  const baseUrl = getAppBaseUrl(req);
  const redirectUri = `${baseUrl}/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo read:user',
  });
  res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
});

async function handleGitHubOAuthCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
  if (!code || !clientId || !clientSecret) {
    res.status(400).send('Missing OAuth code or GitHub OAuth credentials.');
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenJson.access_token) {
      res.status(400).send(tokenJson.error_description || tokenJson.error || 'GitHub token exchange failed.');
      return;
    }

    const sid = crypto.randomBytes(16).toString('hex');
    githubSessionStore.set(sid, { accessToken: tokenJson.access_token, createdAt: Date.now() });
    saveGitHubSessions();

    res.cookie('folio_gh_sid', sid, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.send(`<!doctype html>
<html>
<body style="font-family:system-ui,sans-serif;padding:32px;background:#0d0d0d;color:#ececec;text-align:center;">
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'GITHUB_OAUTH_SUCCESS' }, '*');
      window.close();
    } else {
      window.location.href = '/';
    }
  </script>
  <p>GitHub connected. You can close this window.</p>
</body>
</html>`);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'GitHub callback error.');
  }
}

app.get(['/auth/github/callback', '/auth/github/callback/'], handleGitHubOAuthCallback);

app.post('/api/github/logout', (req: Request, res: Response) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const sid = cookies['folio_gh_sid'];
  if (sid) {
    githubSessionStore.delete(sid);
    saveGitHubSessions();
  }
  res.clearCookie('folio_gh_sid', { secure: true, sameSite: 'none' });
  res.json({ ok: true });
});

app.get('/api/github/repos', async (req: Request, res: Response) => {
  const token = getGitHubTokenForRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Not connected to GitHub.' });
    return;
  }
  try {
    const ghRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Folio-Studio',
      },
    });
    if (!ghRes.ok) {
      const errText = await ghRes.text();
      res.status(ghRes.status).json({ error: errText });
      return;
    }
    const repos = await ghRes.json();
    res.json({ repos });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list repos.' });
  }
});

function parseGitHubRepoSpec(
  rawRepo: string,
  explicitBranch?: string,
  explicitSubpath?: string
): { owner: string; repo: string; branch?: string; subpath: string } {
  const trimmed = rawRepo.trim().replace(/\.git$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) {
      throw new Error('Invalid GitHub repository URL.');
    }
    const [owner, repo, maybeTree, branchFromUrl, ...restPath] = parts;
    return {
      owner,
      repo,
      branch: explicitBranch?.trim() || (maybeTree === 'tree' ? branchFromUrl : undefined),
      subpath:
        explicitSubpath?.trim().replace(/^\/+|\/+$/g, '') ||
        (maybeTree === 'tree' ? restPath.join('/') : ''),
    };
  }
  const parts = trimmed.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Enter a repo as "owner/repo" or a full https://github.com/owner/repo URL.');
  }
  return {
    owner: parts[0],
    repo: parts[1],
    branch: explicitBranch?.trim() || undefined,
    subpath: (explicitSubpath || '').trim().replace(/^\/+|\/+$/g, ''),
  };
}

app.post('/api/github/import', async (req: Request, res: Response) => {
  const { repo: rawRepo, branch: reqBranch, subpath: reqSubpath, workspaceId } = req.body as {
    repo?: string;
    branch?: string;
    subpath?: string;
    workspaceId?: string;
  };

  if (!rawRepo || !rawRepo.trim()) {
    res.status(400).json({ error: 'GitHub repository URL or owner/repo is required.' });
    return;
  }

  try {
    const workspaceDir = getWorkspaceDir(workspaceId || 'default-workspace');
    const parsed = parseGitHubRepoSpec(rawRepo, reqBranch, reqSubpath);
    const token = getGitHubTokenForRequest(req);
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Folio-Studio',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 1. Resolve default branch if omitted
    let branch = parsed.branch;
    if (!branch) {
      const repoMetaRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
        { headers }
      );
      if (!repoMetaRes.ok) {
        const msg = await repoMetaRes.text();
        throw new Error(`GitHub repo lookup failed (${repoMetaRes.status}): ${msg}`);
      }
      const meta = (await repoMetaRes.json()) as { default_branch?: string };
      branch = meta.default_branch || 'main';
    }

    // 2. Fetch recursive git tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers }
    );
    if (!treeRes.ok) {
      const msg = await treeRes.text();
      throw new Error(`Unable to read repository tree (${treeRes.status}): ${msg}`);
    }

    const treeJson = (await treeRes.json()) as {
      tree?: Array<{ path: string; type: string; size?: number; sha: string }>;
    };
    const prefix = parsed.subpath ? `${parsed.subpath}/` : '';
    const candidateBlobs = (treeJson.tree || [])
      .filter((item) => item.type === 'blob' && (item.size ?? 0) <= 512 * 1024)
      .filter((item) => (!prefix ? true : item.path.startsWith(prefix)))
      .filter((item) => !item.path.includes('node_modules/') && !item.path.startsWith('.git/'))
      .slice(0, 60);

    if (candidateBlobs.length === 0) {
      throw new Error('No importable files found at that repository path.');
    }

    // Clear existing files cleanly except design system stylesheet
    const existing = await fs.promises.readdir(workspaceDir);
    for (const name of existing) {
      if (name === '.folio-design-system.css') continue;
      await fs.promises.rm(path.join(workspaceDir, name), { recursive: true, force: true });
    }

    let importedCount = 0;
    for (const blob of candidateBlobs) {
      const relOut = prefix ? blob.path.slice(prefix.length) : blob.path;
      if (!relOut) continue;
      const blobRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/blobs/${blob.sha}`,
        { headers }
      );
      if (!blobRes.ok) continue;
      const blobData = (await blobRes.json()) as { content?: string; encoding?: string };
      if (!blobData.content) continue;
      const destPath = resolveWorkspaceFilePath(workspaceDir, relOut);
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
      const buf = Buffer.from(blobData.content.replace(/\n/g, ''), 'base64');
      await fs.promises.writeFile(destPath, buf);
      importedCount += 1;
    }

    const scanned = await scanWorkspaceFiles(workspaceDir);
    res.json({
      owner: parsed.owner,
      repo: parsed.repo,
      branch,
      importedCount,
      files: scanned.files,
      entryFolders: scanned.entryFolders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GitHub import failed.';
    res.status(400).json({ error: msg });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
