import 'dotenv/config';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import dns from 'dns/promises';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import {
  Behavior,
  Content,
  FunctionDeclaration,
  FunctionResponseScheduling,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  InteractionStatus,
  LiveServerMessage,
  Modality,
  Part,
  SafetySetting,
  ThinkingLevel,
  Type,
} from '@google/genai';
import { FOLIO_CHANGELOGS, FOLIO_CURRENT_VERSION } from './src/data/changelogs';
import { FOLIO_DOCS_SECTIONS, searchFolioDocs } from './src/data/folioDocs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FOLIO_BIN_DIR = path.resolve(__dirname, '.folio-data', 'bin');
const FOLIO_BACKUPS_DIR = path.resolve(__dirname, '.folio-data', 'backups');
const FOLIO_NEO4_DIR = path.resolve(__dirname, '.folio-data', 'neo4');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

function createGeminiClient(apiVersion?: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please set a billing-enabled API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(apiVersion ? { apiVersion } : {}),
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
  workspacePath?: string;
  tokenEstimate?: number;
  truncatedForContext?: boolean;
}

interface IncomingMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: IncomingAttachment[];
}

type ModelChoiceId =
  | 'auto'
  | 'flash-4'
  | 'hydrogen-4-fast'
  | 'hydrogen-4-balanced'
  | 'hydrogen-4-deep'
  | 'neon-4'
  | 'carbon-4'
  | 'argon-4'
  | 'flash-3.8'
  | 'flash-lite-3.1'
  | 'omni-flash-1.2'
  | 'live-extended-3.8'
  | 'gemma-3-27b'
  | 'gemma-3-12b'
  | 'neo-4'
  | 'nano-banana-lite';

type ThinkingMode = 'minimal' | 'low' | 'medium' | 'high' | 'deep';

interface EntropicAuditMetrics {
  shannonEntropyBits: number;
  lexicalDiversityTTR: number;
  bigramRepetitionRate: number;
  grammarScore: number;
  groundingSignal: boolean;
  verdict: string;
}

function mapThinkingModeToLevel(mode: ThinkingMode | undefined, modelName: string): ThinkingLevel {
  const m = (mode || 'medium').toLowerCase();
  if (m === 'minimal') return ThinkingLevel.MINIMAL;
  if (m === 'low') return ThinkingLevel.LOW;
  if (m === 'medium') return ThinkingLevel.MEDIUM;
  if (m === 'high') return ThinkingLevel.HIGH;
  if (m === 'deep') {
    return modelName === 'gemini-4-neon' ? ThinkingLevel.XHIGH : ThinkingLevel.HIGH;
  }
  return ThinkingLevel.MEDIUM;
}

function computeEntropicAudit(text: string): EntropicAuditMetrics {
  const clean = (text || '').trim();
  if (!clean) {
    return {
      shannonEntropyBits: 0,
      lexicalDiversityTTR: 0,
      bigramRepetitionRate: 0,
      grammarScore: 0,
      groundingSignal: false,
      verdict: 'EMPTY',
    };
  }
  const freq = new Map<string, number>();
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }
  let shannon = 0;
  for (const count of freq.values()) {
    const p = count / clean.length;
    shannon -= p * Math.log2(p);
  }
  const words = (clean.toLowerCase().match(/[a-z0-9_']+/g) || []);
  const uniqueWords = new Set(words);
  const ttr = words.length > 0 ? uniqueWords.size / words.length : 0;

  let repeatedBigrams = 0;
  const totalBigrams = Math.max(0, words.length - 1);
  if (totalBigrams > 0) {
    const seen = new Set<string>();
    for (let i = 0; i < words.length - 1; i += 1) {
      const bg = `${words[i]} ${words[i + 1]}`;
      if (seen.has(bg)) repeatedBigrams += 1;
      else seen.add(bg);
    }
  }
  const bigramRep = totalBigrams > 0 ? repeatedBigrams / totalBigrams : 0;

  const hasUpperStart = /^[A-Z0-9`#<\[*]/.test(clean);
  const hasTerminal = /[.!?`\]})]$/.test(clean);
  const fenceCount = (clean.match(/```/g) || []).length;
  const balancedFences = fenceCount % 2 === 0;
  const grammarScore = Number(
    Math.min(
      1,
      Math.max(
        0,
        0.4 +
          (hasUpperStart ? 0.2 : 0) +
          (hasTerminal ? 0.2 : 0) +
          (balancedFences ? 0.2 : -0.15) -
          (bigramRep > 0.35 ? 0.2 : 0)
      )
    ).toFixed(3)
  );
  const groundingSignal =
    clean.includes('```') ||
    /https?:\/\//i.test(clean) ||
    /\d+(\.\d+)?/.test(clean) ||
    words.length >= 16;

  const verdict =
    shannon >= 3.2 && ttr >= 0.32 && bigramRep < 0.45 && grammarScore >= 0.6
      ? 'PASS'
      : 'REVIEW';

  return {
    shannonEntropyBits: Number(shannon.toFixed(3)),
    lexicalDiversityTTR: Number(ttr.toFixed(3)),
    bigramRepetitionRate: Number(bigramRep.toFixed(3)),
    grammarScore,
    groundingSignal,
    verdict,
  };
}

type SafetyLevel = 'max' | 'medium' | 'low' | 'none';

interface IncomingSafetyFilters {
  harassment?: SafetyLevel;
  hateSpeech?: SafetyLevel;
  sexuallyExplicit?: SafetyLevel;
  dangerousContent?: SafetyLevel;
}

function mapThreshold(level: SafetyLevel | undefined, useBlockNoneFallback = false): HarmBlockThreshold {
  switch (level) {
    case 'max':
      return HarmBlockThreshold.BLOCK_LOW_AND_ABOVE;
    case 'low':
      return HarmBlockThreshold.BLOCK_ONLY_HIGH;
    case 'none':
      return useBlockNoneFallback ? HarmBlockThreshold.BLOCK_NONE : HarmBlockThreshold.OFF;
    case 'medium':
    default:
      return HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
  }
}

function buildSafetySettings(filters?: IncomingSafetyFilters, useBlockNoneFallback = false): SafetySetting[] {
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: mapThreshold(filters?.harassment, useBlockNoneFallback),
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: mapThreshold(filters?.hateSpeech, useBlockNoneFallback),
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: mapThreshold(filters?.sexuallyExplicit, useBlockNoneFallback),
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: mapThreshold(filters?.dangerousContent, useBlockNoneFallback),
    },
  ];
}

interface ResolvedModelConfig {
  id: ModelChoiceId;
  model: string;
  thinkingLevel: ThinkingLevel;
  isPaid?: boolean;
}

function selectAutoModel(
  msgs: IncomingMessage[] | undefined,
  intents: CreativeIntentProfile
): ResolvedModelConfig {
  const lastUser = msgs ? [...msgs].reverse().find((m) => m.role === 'user') : undefined;
  const textLen = (lastUser?.text || '').length;
  const hasAttachments = Boolean(lastUser?.attachments && lastUser.attachments.length > 0);

  if (isModelInCooldown('gemini-4-hydrogen')) {
    if (!isModelInCooldown('gemini-3.1-flash-lite')) {
      return {
        id: 'flash-lite-3.1',
        model: 'gemini-3.1-flash-lite',
        thinkingLevel: ThinkingLevel.MINIMAL,
      };
    }
    return {
      id: 'flash-4',
      model: 'gemini-2.5-flash',
      thinkingLevel: ThinkingLevel.LOW,
    };
  }

  if (intents.blender || intents.mathCurve || intents.model3d || intents.hybrid || intents.evo) {
    return {
      id: 'hydrogen-4-balanced',
      model: 'gemini-4-hydrogen',
      thinkingLevel: ThinkingLevel.MEDIUM,
    };
  }
  if (intents.animation || intents.pixel || textLen > 320 || hasAttachments) {
    return {
      id: 'hydrogen-4-fast',
      model: 'gemini-4-hydrogen',
      thinkingLevel: ThinkingLevel.LOW,
    };
  }
  if (intents.explainer) {
    return {
      id: 'hydrogen-4-fast',
      model: 'gemini-4-hydrogen',
      thinkingLevel: ThinkingLevel.LOW,
    };
  }
  if (isModelInCooldown('gemini-3.1-flash-lite')) {
    return {
      id: 'flash-lite-3.1',
      model: 'gemini-2.5-flash-lite',
      thinkingLevel: ThinkingLevel.MINIMAL,
    };
  }
  return {
    id: 'flash-lite-3.1',
    model: 'gemini-3.1-flash-lite',
    thinkingLevel: ThinkingLevel.MINIMAL,
  };
}

function getModelConfig(
  modelId: ModelChoiceId | undefined,
  msgs?: IncomingMessage[],
  intents?: CreativeIntentProfile
): ResolvedModelConfig {
  switch (modelId) {
    case 'auto':
      return selectAutoModel(
        msgs,
        intents || {
          animation: false,
          mathCurve: false,
          pixel: false,
          model3d: false,
          blender: false,
          explainer: false,
          hybrid: false,
          evo: false,
        }
      );
    case 'neon-4':
      return {
        id: 'neon-4',
        model: 'gemini-4-neon',
        thinkingLevel: ThinkingLevel.HIGH,
        isPaid: true,
      };
    case 'carbon-4':
      return {
        id: 'carbon-4',
        model: 'gemini-4-carbon',
        thinkingLevel: ThinkingLevel.HIGH,
        isPaid: true,
      };
    case 'argon-4':
      return {
        id: 'argon-4',
        model: 'gemini-4-argon',
        thinkingLevel: ThinkingLevel.MEDIUM,
        isPaid: true,
      };
    case 'flash-3.8':
      return {
        id: 'flash-3.8',
        model: 'gemini-3.8-flash',
        thinkingLevel: ThinkingLevel.LOW,
      };
    case 'live-extended-3.8':
      return {
        id: 'live-extended-3.8',
        model: 'gemini-3.8-live-extended-thinking',
        thinkingLevel: ThinkingLevel.MEDIUM,
      };
    case 'gemma-3-27b':
      return {
        id: 'gemma-3-27b',
        model: 'gemma-3-27b-it',
        thinkingLevel: ThinkingLevel.LOW,
      };
    case 'gemma-3-12b':
      return {
        id: 'gemma-3-12b',
        model: 'gemma-3-12b-it',
        thinkingLevel: ThinkingLevel.LOW,
      };
    case 'neo-4':
      return {
        id: 'neo-4',
        model: 'neo-4-python',
        thinkingLevel: ThinkingLevel.MEDIUM,
      };
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
    case 'flash-4':
      return {
        id: 'flash-4',
        model: 'gemini-4-hydrogen',
        thinkingLevel: ThinkingLevel.LOW,
      };
    case 'omni-flash-1.2':
      return {
        id: 'omni-flash-1.2',
        model: 'gemini-omni-1.2-flash',
        thinkingLevel: ThinkingLevel.MEDIUM,
        isPaid: true,
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

const modelCooldownUntil = new Map<string, { until: number; reason: '429' | '503' | '404' }>();

function markModelCooldown(model: string, err: unknown): void {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
    modelCooldownUntil.set(model, { until: Date.now() + 300_000, reason: '429' });
  } else if (/\b404\b/.test(msg) || msg.includes('not found')) {
    modelCooldownUntil.set(model, { until: Date.now() + 600_000, reason: '404' });
  } else if (msg.includes('503') || msg.includes('high demand') || msg.includes('unavailable') || msg.includes('overloaded')) {
    modelCooldownUntil.set(model, { until: Date.now() + 30_000, reason: '503' });
  }
}

function isModelInCooldown(model: string): boolean {
  const entry = modelCooldownUntil.get(model);
  if (!entry) return false;
  if (Date.now() >= entry.until) {
    modelCooldownUntil.delete(model);
    return false;
  }
  return true;
}

function getFallbackChain(primary: ResolvedModelConfig): ResolvedModelConfig[] {
  const candidates: ResolvedModelConfig[] = [primary];
  if (primary.model === 'gemini-omni-1.2-flash' || primary.model === 'gemini-3.8-live-extended-thinking') {
    candidates.push(
      { id: 'flash-3.8', model: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW },
      { id: 'flash-4', model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
      { id: 'flash-lite-3.1', model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { id: 'flash-4', model: 'gemini-2.5-flash', thinkingLevel: ThinkingLevel.LOW },
      { id: 'flash-lite-3.1', model: 'gemini-2.5-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL }
    );
  } else if (primary.model === 'gemini-4-neon' || primary.model === 'gemini-4-carbon' || primary.model === 'gemini-4-argon') {
    candidates.push(
      { id: 'hydrogen-4-balanced', model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.MEDIUM },
      { id: 'flash-3.8', model: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.MEDIUM },
      { id: 'flash-4', model: 'gemini-2.5-flash', thinkingLevel: ThinkingLevel.MEDIUM },
      { id: 'flash-lite-3.1', model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { id: 'flash-lite-3.1', model: 'gemini-2.5-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL }
    );
  } else if (primary.model.startsWith('gemma-')) {
    candidates.push(
      ...(primary.model === 'gemma-3-27b-it'
        ? [{ id: 'gemma-3-12b' as ModelChoiceId, model: 'gemma-3-12b-it', thinkingLevel: ThinkingLevel.LOW }]
        : [{ id: 'gemma-3-27b' as ModelChoiceId, model: 'gemma-3-27b-it', thinkingLevel: ThinkingLevel.LOW }]),
      { id: 'flash-lite-3.1', model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { id: 'flash-4', model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW }
    );
  } else if (primary.model === 'gemini-3.1-flash-lite' || primary.model === 'gemini-3.8-flash') {
    candidates.push(
      { id: 'hydrogen-4-fast', model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
      { id: 'flash-lite-3.1', model: 'gemini-2.5-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { id: 'flash-4', model: 'gemini-2.5-flash', thinkingLevel: ThinkingLevel.LOW },
      { id: 'flash-lite-3.1', model: 'gemini-3.5-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL }
    );
  } else {
    candidates.push(
      { id: 'flash-3.8', model: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW },
      { id: 'flash-lite-3.1', model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { id: 'flash-4', model: 'gemini-2.5-flash', thinkingLevel: ThinkingLevel.LOW },
      { id: 'flash-lite-3.1', model: 'gemini-2.5-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL }
    );
  }
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.model}:${c.thinkingLevel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getFallbackConfig(primary: ResolvedModelConfig): ResolvedModelConfig {
  return getFallbackChain(primary)[1] || {
    id: 'flash-lite-3.1',
    model: 'gemini-2.5-flash-lite',
    thinkingLevel: ThinkingLevel.MINIMAL,
  };
}

function isBillingOrModelMissingError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const isQuota429 = msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota');
  if (isQuota429) return false;
  return (
    /\b402\b/.test(msg) ||
    /\b404\b/.test(msg) ||
    msg.includes('paid tier') ||
    msg.includes('not found')
  );
}

function isDemandOrTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    /\b402\b/.test(msg) ||
    /\b404\b/.test(msg) ||
    msg.includes('paid tier') ||
    msg.includes('quota') ||
    msg.includes('not found') ||
    msg.includes('resource_exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('rate limit') ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('eai_again') ||
    msg.includes('epipe') ||
    msg.includes('socket') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('stalled') ||
    msg.includes('network') ||
    msg.includes('aborted') ||
    msg.includes('und_err') ||
    msg.includes('internal') ||
    msg.includes('deadline_exceeded')
  );
}

function extractCleanErrorText(raw: string): string {
  let current = raw.trim();
  for (let i = 0; i < 4; i += 1) {
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
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota exceeded')) {
    const modelMatch = /model:\s*([a-z0-9._-]+)/i.exec(clean);
    const modelTag = modelMatch ? ` (${modelMatch[1]})` : '';
    return {
      status: 429,
      message: `API quota / rate limit reached${modelTag}. Switch to Flash Lite, Auto, or Neo 4 (local Python AI with zero quota), or attach a billing-enabled key in Settings > Secrets.`,
    };
  }
  if (/\b402\b/.test(lower) || lower.includes('paid tier') || lower.includes('requires active cloud billing')) {
    return {
      status: 402,
      message: 'This paid model requires active Cloud billing on your Gemini project. Switch to Flash Lite / Auto or enable Auto Fallback.',
    };
  }
  if (lower.includes('permission_denied') || /\b403\b/.test(lower)) {
    return {
      status: 403,
      message: 'Permission denied when reaching the model service. Check your API key or switch to a free-tier model.',
    };
  }
  if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
    return {
      status: 503,
      message: 'Upstream model is experiencing temporary high demand. Retry, enable Auto Fallback, or switch to Neo 4.',
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

interface CreativeIntentProfile {
  animation: boolean;
  mathCurve: boolean;
  pixel: boolean;
  model3d: boolean;
  blender: boolean;
  explainer: boolean;
  hybrid: boolean;
  evo: boolean;
}

interface IncomingCustomToolDef {
  id?: string;
  name: string;
  description: string;
  parametersJson?: string;
  handlerCode: string;
  enabled?: boolean;
}

function mapSchemaTypeString(rawType: unknown): Type {
  switch (String(rawType || '').toLowerCase()) {
    case 'string':
      return Type.STRING;
    case 'number':
      return Type.NUMBER;
    case 'integer':
      return Type.INTEGER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'array':
      return Type.ARRAY;
    case 'object':
    default:
      return Type.OBJECT;
  }
}

function convertJsonSchemaToGenAi(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: mapSchemaTypeString(raw.type),
  };
  if (typeof raw.description === 'string') out.description = raw.description;
  if (Array.isArray(raw.required)) out.required = raw.required;
  if (Array.isArray(raw.enum)) out.enum = raw.enum;
  if (raw.properties && typeof raw.properties === 'object') {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.properties as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        props[k] = convertJsonSchemaToGenAi(v as Record<string, unknown>);
      }
    }
    out.properties = props;
  }
  if (raw.items && typeof raw.items === 'object') {
    out.items = convertJsonSchemaToGenAi(raw.items as Record<string, unknown>);
  }
  return out;
}

function buildCustomFunctionDeclarations(
  customTools: IncomingCustomToolDef[] | undefined,
  reservedNames: Set<string>
): { declarations: FunctionDeclaration[]; map: Map<string, IncomingCustomToolDef> } {
  const declarations: FunctionDeclaration[] = [];
  const map = new Map<string, IncomingCustomToolDef>();
  if (!Array.isArray(customTools)) return { declarations, map };

  for (const tool of customTools) {
    if (!tool || tool.enabled === false) continue;
    const cleanName = String(tool.name || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{1,48}$/.test(cleanName)) continue;
    if (reservedNames.has(cleanName) || map.has(cleanName)) continue;

    let parameters: Record<string, unknown> = {
      type: Type.OBJECT,
      properties: {
        input: { type: Type.STRING, description: 'Input parameter' },
      },
    };
    if (typeof tool.parametersJson === 'string' && tool.parametersJson.trim()) {
      try {
        const parsed = JSON.parse(tool.parametersJson) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          parameters = convertJsonSchemaToGenAi(parsed);
        }
      } catch {
        // Fallback to default schema on invalid JSON
      }
    }

    map.set(cleanName, tool);
    declarations.push({
      name: cleanName,
      description: String(tool.description || `Custom workspace function ${cleanName}`).slice(0, 400),
      parameters: parameters as FunctionDeclaration['parameters'],
    });
  }

  return { declarations, map };
}

function executeCustomToolVm(
  tool: IncomingCustomToolDef,
  args: Record<string, unknown>
): Record<string, unknown> {
  try {
    const wrapped = `(function(args){\n${tool.handlerCode}\n})(args)`;
    const safeArgs = JSON.parse(JSON.stringify(args || {}));
    const sandbox = Object.create(null) as Record<string, unknown>;
    sandbox.args = safeArgs;
    sandbox.Math = Math;
    sandbox.JSON = JSON;
    sandbox.Date = Date;
    sandbox.Array = Array;
    sandbox.Object = Object;
    sandbox.String = String;
    sandbox.Number = Number;
    sandbox.Boolean = Boolean;
    sandbox.RegExp = RegExp;
    sandbox.Intl = Intl;
    const context = vm.createContext(sandbox);
    const result = vm.runInContext(wrapped, context, { timeout: 3000 });
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return result as Record<string, unknown>;
    }
    return { ok: true, result: result === undefined ? null : result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : `Custom function "${tool.name}" failed.`,
    };
  }
}

function detectCreativeIntents(msgs: IncomingMessage[]): CreativeIntentProfile {
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
  const text = (lastUser?.text || '').toLowerCase();
  const animation = /\b(animat|stopmotion|stop-motion|flipbook|webm|mp4|motion|walk cycle|bounce|clockwork|gear|pendulum|orbit|storyboard|camera cut|timeline|60fps|physics|hitbox|collision|gravity|kinetic|character|scene|landscape|sunset|cyberpunk|neon|demo|studio|draw|illustrat|render|art|particle|fireworks|explosion)\b/.test(text);
  const mathCurve = /\b(hilbert|dragon curve|koch|snowflake|lissajous|spirograph|rose curve|fibonacci|fractal|parametric|spiral|sine wave|fourier|epicycle|curve|graph|plot|harmonic|wave|gradient|cardioid|lemniscate|phyllotaxis|butterfly)\b/.test(text);
  const pixel = /\b(pixel\s*art|pixelart|sprite|8-bit|16-bit|tileset|dither|bayer|conic|512x512|256x256|128x128|64x64|pixelated|aurora|stardust|voxel|crt|hitbox|plasma|retro|arcade|isometric|shader)\b/.test(text);
  const blender = /\b(blender|cycles|eevee|bpy|\.blend|subsurf|boolean mesh)\b/.test(text);
  const evo = /\b(evo|evo\/v1|3d animation|3d scene|three\.?js.*motion|orbital 3d|three\.?js pbr|physics|hitbox|collision|wave surface|mobius|klein|helix|dna|hologram|crystal)\b/.test(text);
  const model3d = blender || evo || /\b(3d\s*model|3d|blockbench|bbmodel|voxel|three\.?js|mesh|low-poly|minecraft|rigged model|glb|gltf|obj|physics|hitbox|terrain|sculpture|spaceship|robot)\b/.test(text);
  const explainer = /\b(explain|how does|diagram|chart|graph|quiz|flashcard|compare|breakdown|tutorial|lesson|visual)\b/.test(text);
  const hybrid = /\b(liquidmotion|liquid\s*motion|liquiddrop|liquid\s*drop|pixelmotion|pixel\s*motion|motiondrop|motion\s*drop|hybrid)\b/.test(text);
  return { animation, mathCurve, pixel, model3d, blender, explainer, hybrid, evo };
}

interface ChatPipelineParams {
  messages: IncomingMessage[];
  modelId?: ModelChoiceId;
  neoMode?: 'llm' | 'rule';
  autoFallback?: boolean;
  systemInstruction?: string;
  safetyFilters?: IncomingSafetyFilters;
  activeWorkspaceId?: string;
  sharedSessionsContext?: string | unknown[];
  isIncognito?: boolean;
  immersivePureCode?: boolean;
  customTools?: IncomingCustomToolDef[];
  ghToken: string | null;
  thinkingMode?: ThinkingMode;
  entropicAuditorEnabled?: boolean;
  semanticEngineEnabled?: boolean;
  metaScriptingEnabled?: boolean;
  isClientClosed: () => boolean;
  onEvent: (payload: Record<string, unknown>) => void;
}

function getGodotBinary(): string | null {
  if (fs.existsSync('/usr/local/bin/godot4')) return '/usr/local/bin/godot4';
  if (fs.existsSync('/opt/folio-toolchains/godot/godot4')) return '/opt/folio-toolchains/godot/godot4';
  if (fs.existsSync('/usr/bin/godot')) return '/usr/bin/godot';
  return null;
}

function getCmakeBinary(): string | null {
  if (fs.existsSync('/usr/bin/cmake')) return '/usr/bin/cmake';
  if (fs.existsSync('/opt/folio-toolchains/cmake-dist/bin/cmake')) return '/opt/folio-toolchains/cmake-dist/bin/cmake';
  return null;
}

function getNinjaBinary(): string | null {
  if (fs.existsSync('/usr/bin/ninja')) return '/usr/bin/ninja';
  if (fs.existsSync('/opt/folio-toolchains/cmake-dist/bin/ninja')) return '/opt/folio-toolchains/cmake-dist/bin/ninja';
  return null;
}

function getKotlinBinary(): string | null {
  if (fs.existsSync('/usr/local/bin/kotlinc')) return '/usr/local/bin/kotlinc';
  if (fs.existsSync('/opt/folio-toolchains/kotlinc/bin/kotlinc')) return '/opt/folio-toolchains/kotlinc/bin/kotlinc';
  return null;
}

function getJavaBinary(): string | null {
  if (fs.existsSync('/usr/local/bin/java')) return '/usr/local/bin/java';
  if (fs.existsSync('/opt/folio-toolchains/java/bin/java')) return '/opt/folio-toolchains/java/bin/java';
  return null;
}

function getClangBinary(): string | null {
  if (fs.existsSync('/usr/bin/clang')) return '/usr/bin/clang';
  return null;
}

function getMingwGxxBinary(): string | null {
  if (fs.existsSync('/usr/bin/x86_64-w64-mingw32-g++')) return '/usr/bin/x86_64-w64-mingw32-g++';
  return null;
}

function getMemInfoStats(): {
  totalRamMb: number;
  freeRamMb: number;
  usedRamMb: number;
  swapTotalMb: number;
  swapFreeMb: number;
} {
  const totalRamMb = Math.round(os.totalmem() / 1024 / 1024);
  let freeRamMb = Math.round(os.freemem() / 1024 / 1024);
  let swapTotalMb = 0;
  let swapFreeMb = 0;
  try {
    if (fs.existsSync('/proc/meminfo')) {
      const raw = fs.readFileSync('/proc/meminfo', 'utf8');
      const parseKb = (key: string): number | null => {
        const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm'));
        return m ? Number(m[1]) : null;
      };
      const availKb = parseKb('MemAvailable');
      const freeKb = parseKb('MemFree');
      const sTotKb = parseKb('SwapTotal');
      const sFreeKb = parseKb('SwapFree');
      if (availKb !== null) freeRamMb = Math.round(availKb / 1024);
      else if (freeKb !== null) freeRamMb = Math.round(freeKb / 1024);
      if (sTotKb !== null) swapTotalMb = Math.round(sTotKb / 1024);
      if (sFreeKb !== null) swapFreeMb = Math.round(sFreeKb / 1024);
    }
  } catch {
    // Fallback to os.freemem
  }
  return {
    totalRamMb,
    freeRamMb,
    usedRamMb: Math.max(0, totalRamMb - freeRamMb),
    swapTotalMb,
    swapFreeMb,
  };
}

function getAvailableRamMb(): number {
  return getMemInfoStats().freeRamMb;
}

function formatBytesHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function listFolioBackups(): Array<{
  filename: string;
  sizeBytes: number;
  sizeHuman: string;
  createdAt: string;
}> {
  try {
    if (!fs.existsSync(FOLIO_BACKUPS_DIR)) return [];
    const entries = fs.readdirSync(FOLIO_BACKUPS_DIR);
    return entries
      .filter((name) => name.endsWith('.tar.gz'))
      .map((filename) => {
        const full = path.join(FOLIO_BACKUPS_DIR, filename);
        const st = fs.statSync(full);
        return {
          filename,
          sizeBytes: st.size,
          sizeHuman: formatBytesHuman(st.size),
          createdAt: st.mtime.toISOString(),
          mtimeMs: st.mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .map(({ mtimeMs: _m, ...rest }) => rest);
  } catch {
    return [];
  }
}

async function createFolioBackup(label?: string): Promise<{
  ok: boolean;
  filename?: string;
  sizeBytes?: number;
  sizeHuman?: string;
  createdAt?: string;
  error?: string;
}> {
  try {
    await fs.promises.mkdir(FOLIO_BACKUPS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const cleanLabel = (label || 'snapshot')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    const filename = `folio-backup-${stamp}${cleanLabel ? `-${cleanLabel}` : ''}.tar.gz`;
    const outPath = path.join(FOLIO_BACKUPS_DIR, filename);

    const exitCode = await new Promise<number>((resolve) => {
      const cp = spawn(
        'tar',
        [
          '--exclude=./node_modules',
          '--exclude=./dist',
          '--exclude=./.git',
          '--exclude=./.folio-data',
          '-czf',
          outPath,
          '-C',
          __dirname,
          '.',
        ],
        { stdio: 'ignore' }
      );
      cp.on('close', (c) => resolve(c ?? 1));
      cp.on('error', () => resolve(1));
    });

    if (exitCode !== 0 || !fs.existsSync(outPath)) {
      return { ok: false, error: 'Failed to create tar.gz backup archive.' };
    }
    const st = await fs.promises.stat(outPath);
    return {
      ok: true,
      filename,
      sizeBytes: st.size,
      sizeHuman: formatBytesHuman(st.size),
      createdAt: st.mtime.toISOString(),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Backup creation failed.' };
  }
}

function getSystemHealthSnapshot() {
  const mem = getMemInfoStats();
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  let diskTotalGb = 0;
  let diskFreeGb = 0;
  let diskUsedGb = 0;
  try {
    const stat = fs.statfsSync(__dirname);
    const bsize = Number(stat.bsize);
    const blocks = Number(stat.blocks);
    const bavail = Number(stat.bavail);
    diskTotalGb = Number(((blocks * bsize) / 1024 ** 3).toFixed(2));
    diskFreeGb = Number(((bavail * bsize) / 1024 ** 3).toFixed(2));
    diskUsedGb = Number(Math.max(0, diskTotalGb - diskFreeGb).toFixed(2));
  } catch {
    // Ignore statfs unavailability
  }

  const statSize = (p: string): number => {
    try {
      return fs.existsSync(p) ? fs.statSync(p).size : 0;
    } catch {
      return 0;
    }
  };

  const docsDbSize = statSize(path.join(FOLIO_NEO4_DIR, 'folio_docs.db'));
  const knowledgeDbSize = statSize(path.join(FOLIO_NEO4_DIR, 'knowledge.db'));
  const shardsDir = path.join(FOLIO_NEO4_DIR, 'shards');
  let shardFiles: string[] = [];
  let shardsTotalBytes = 0;
  try {
    if (fs.existsSync(shardsDir)) {
      shardFiles = fs.readdirSync(shardsDir).filter((f) => f.endsWith('.db')).sort();
      for (const f of shardFiles) {
        shardsTotalBytes += statSize(path.join(shardsDir, f));
      }
    }
  } catch {
    // Ignore shard dir scan error
  }

  const modelsDir = path.resolve(__dirname, '.folio-data', 'models');
  const llamaBinCandidates = [
    path.join(FOLIO_BIN_DIR, 'llama-completion'),
    path.join(FOLIO_BIN_DIR, 'llama-cli'),
    '/usr/local/bin/llama-completion',
    '/usr/local/bin/llama-cli',
  ];
  const llamaBinPath = llamaBinCandidates.find((p) => fs.existsSync(p)) || null;
  const availableModels: Array<{ name: string; sizeBytes: number; sizeHuman: string }> = [];
  if (fs.existsSync(modelsDir)) {
    const ggufFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.gguf')).sort();
    for (const f of ggufFiles) {
      const sz = statSize(path.join(modelsDir, f));
      availableModels.push({ name: f, sizeBytes: sz, sizeHuman: formatBytesHuman(sz) });
    }
  }

  let ggufModelPath: string | null =
    process.env.FOLIO_TINY_LLM_MODEL && fs.existsSync(process.env.FOLIO_TINY_LLM_MODEL)
      ? process.env.FOLIO_TINY_LLM_MODEL
      : null;
  if (!ggufModelPath && fs.existsSync(modelsDir)) {
    const m15b = path.join(modelsDir, 'qwen2.5-1.5b-instruct-q4_k_m.gguf');
    const m05b = path.join(modelsDir, 'qwen2.5-0.5b-instruct-q4_k_m.gguf');
    if (mem.freeRamMb >= 1650 && fs.existsSync(m15b)) {
      ggufModelPath = m15b;
    } else if (fs.existsSync(m05b)) {
      ggufModelPath = m05b;
    } else if (availableModels.length > 0) {
      ggufModelPath = path.join(modelsDir, availableModels[0].name);
    }
  }
  const ggufSizeBytes = ggufModelPath ? statSize(ggufModelPath) : 0;

  const remoteUrl = (process.env.FOLIO_REMOTE_LLM_URL || '').trim();
  const remoteModel = (process.env.FOLIO_REMOTE_LLM_MODEL || '').trim() || (remoteUrl ? 'qwen2.5:14b' : null);

  const canRunHeavyTools = mem.freeRamMb >= 450;
  const canRunBlender = mem.freeRamMb >= 650;
  const canRunTinyLlm = mem.freeRamMb >= 1100;
  const ramStatus: 'healthy' | 'tight' | 'critical' =
    mem.freeRamMb < 450 ? 'critical' : mem.freeRamMb < 900 ? 'tight' : 'healthy';

  return {
    version: FOLIO_CURRENT_VERSION,
    ram: {
      ...mem,
      rssMb,
      status: ramStatus,
    },
    disk: {
      totalGb: diskTotalGb,
      freeGb: diskFreeGb,
      usedGb: diskUsedGb,
    },
    thresholds: {
      canRunHeavyTools,
      canRunBlender,
      canRunTinyLlm,
      heavyToolsMinFreeMb: 450,
      blenderMinFreeMb: 650,
      tinyLlmMinFreeMb: 1100,
    },
    tinyLocalLlm: {
      installed: Boolean(llamaBinPath && ggufModelPath),
      binaryPath: llamaBinPath,
      modelName: ggufModelPath ? path.basename(ggufModelPath) : null,
      modelSizeBytes: ggufSizeBytes,
      modelSizeHuman: ggufSizeBytes > 0 ? formatBytesHuman(ggufSizeBytes) : null,
      availableModels,
    },
    remoteLlm: {
      configured: Boolean(remoteUrl),
      model: remoteModel,
    },
    knowledgeBase: {
      docsDbBytes: docsDbSize,
      docsDbHuman: formatBytesHuman(docsDbSize),
      docsIndexed: docsDbSize > 0,
      knowledgeDbBytes: knowledgeDbSize,
      knowledgeDbHuman: formatBytesHuman(knowledgeDbSize),
      shardCount: shardFiles.length,
      shardsTotalBytes,
      shardsTotalHuman: formatBytesHuman(shardsTotalBytes),
    },
    toolchains: {
      blenderInstalled: Boolean(getBlenderBinary()),
      godotInstalled: Boolean(getGodotBinary()),
      cmakeInstalled: Boolean(getCmakeBinary()),
      kotlinInstalled: Boolean(getKotlinBinary()),
      ghInstalled: Boolean(getGitHubCliBinary()),
      ffmpegInstalled: fs.existsSync('/usr/bin/ffmpeg') || fs.existsSync('/usr/local/bin/ffmpeg'),
    },
    backupsCount: listFolioBackups().length,
    timestamp: new Date().toISOString(),
  };
}

async function runNeo4Pipeline(params: ChatPipelineParams, fallbackFrom?: ModelChoiceId): Promise<void> {
  const {
    messages,
    systemInstruction,
    thinkingMode,
    entropicAuditorEnabled,
    semanticEngineEnabled,
    onEvent,
    isClientClosed,
  } = params;

  const startTime = Date.now();
  onEvent({
    type: 'meta',
    modelId: 'neo-4',
    ...(fallbackFrom ? { fallbackFrom } : {}),
  });

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const prompt = lastUserMsg?.text || 'Hello Neo';

  const engineScript = path.join(__dirname, 'python', 'neo4_engine.py');
  if (!fs.existsSync(engineScript)) {
    onEvent({ type: 'error', message: 'Python Neo 4 engine not found at python/neo4_engine.py.' });
    return;
  }

  const payload = {
    mode: 'chat',
    prompt,
    messages: messages.map((m) => ({ role: m.role, text: m.text })),
    neoMode: params.neoMode || 'llm',
    neo_mode: params.neoMode || 'llm',
    thinkingMode: thinkingMode || 'medium',
    thinking_mode: thinkingMode || 'medium',
    semanticEngineEnabled: semanticEngineEnabled !== false,
    semantic_engine: semanticEngineEnabled !== false,
    entropicAuditorEnabled: Boolean(params.entropicAuditorEnabled),
    metaScriptingEnabled: Boolean(params.metaScriptingEnabled),
    immersivePureCode: Boolean(params.immersivePureCode),
    safetyFilters: params.safetyFilters || {},
    systemInstruction: systemInstruction || '',
    system_instruction: systemInstruction || '',
    customTools: (params.customTools || [])
      .filter((t) => t.enabled)
      .map((t) => ({ name: t.name, description: t.description })),
  };

  const pyProcess = spawn('python3', [engineScript, '--json'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  pyProcess.stdout.on('data', (data: Buffer) => {
    stdout += data.toString('utf8');
  });

  pyProcess.stderr.on('data', (data: Buffer) => {
    stderr += data.toString('utf8');
  });

  pyProcess.stdin.write(JSON.stringify(payload));
  pyProcess.stdin.end();

  const exitCode = await new Promise<number>((resolve) => {
    pyProcess.on('close', (c) => resolve(c ?? 0));
    pyProcess.on('error', () => resolve(1));
  });

  if (isClientClosed()) return;

  if (exitCode !== 0) {
    onEvent({
      type: 'error',
      message: `Neo 4 engine process exited with code ${exitCode}: ${stderr.slice(0, 300)}`,
    });
    return;
  }

  let parsedOutput: { ok?: boolean; thoughts?: string; text?: string; audit?: unknown } = {};
  try {
    parsedOutput = JSON.parse(stdout.trim());
  } catch {
    parsedOutput = { ok: true, text: stdout };
  }

  if (parsedOutput.thoughts && thinkingMode !== 'minimal') {
    onEvent({ type: 'thought', text: parsedOutput.thoughts + '\n' });
  }

  const responseText = parsedOutput.text || stdout;
  const chunkSize = 28;
  for (let i = 0; i < responseText.length; i += chunkSize) {
    if (isClientClosed()) break;
    onEvent({ type: 'chunk', text: responseText.slice(i, i + chunkSize) });
  }

  if (entropicAuditorEnabled) {
    const audit = computeEntropicAudit(responseText);
    onEvent({ type: 'audit', audit });
  }

  onEvent({ type: 'done', durationMs: Date.now() - startTime });
}

async function runFolioChatPipeline(params: ChatPipelineParams): Promise<void> {
  const {
    messages,
    modelId,
    autoFallback,
    systemInstruction,
    safetyFilters,
    activeWorkspaceId: rawWorkspaceId,
    sharedSessionsContext,
    isIncognito,
    immersivePureCode,
    customTools,
    ghToken,
    thinkingMode,
    entropicAuditorEnabled,
    semanticEngineEnabled,
    metaScriptingEnabled,
    isClientClosed,
    onEvent,
  } = params;

  if (modelId === 'neo-4') {
    return runNeo4Pipeline(params);
  }

  const streamStartTime = Date.now();
  const ai = createGeminiClient();
  const contents = messages.map((msg) => {
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        const metaParts = [
          `Attached file: ${att.name}`,
          att.workspacePath ? `workspacePath: "${att.workspacePath}"` : '',
          att.tokenEstimate ? `~${att.tokenEstimate} tokens` : '',
          att.truncatedForContext
            ? `TOKEN-BUDGETED EXCERPT (call workspace_read_file with path="${att.workspacePath}" and startOffset/maxChars to read any section)`
            : '',
        ].filter(Boolean);

        if (att.isText && att.textContent !== undefined) {
          parts.push({
            text: `[${metaParts.join(' | ')}]\n\`\`\`\n${att.textContent}\n\`\`\``,
          });
        } else if (att.data && att.mimeType) {
          if (att.workspacePath) {
            parts.push({ text: `[${metaParts.join(' | ')}]` });
          }
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        } else if (att.workspacePath) {
          parts.push({
            text: `[${metaParts.join(' | ')} | mimeType: ${att.mimeType}. Stored in active workspace; use workspace_read_file or workspace_run_script to inspect or process it.]`,
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
STUDIO-GRADE STOP MOTION v3 (\`\`\`stopmotion — \`"format": "stopmotion/v3"\`):
ALWAYS match the artistic richness of the built-in Studio Demos (multi-layer atmospheric backdrops, depth parallax, dynamic squash-and-stretch, Marker Trick specular arcs, particle emitters, and synced WebAudio — NEVER emit bare 1-shape stubs):
- **Layered Composition**: Combine \`"backdrop"\` (sky gradient + horizon + atmospheric stars/glow), 5–14 rich \`"layers"\` with depth \`"parallax"\`, dynamic \`"shadow": { "type": "ground", "groundY": 380, "rx": 48, "ry": 10 }\`, \`"effect": "crt"|"cyberpunk"|"sepia"|"noir"\`, and built-in studio \`<defs>\`:
  - Glazes & Metals: \`url(#wetGlazeCyan)\`, \`url(#wetGlazePink)\`, \`url(#wetGlazeCaramel)\`, \`url(#wetGlazeEmerald)\`, \`url(#wetGlazePurple)\`, \`url(#wetGlazeCrimson)\`, \`url(#wetGlazeObsidian)\`, \`url(#metallicGold)\`, \`url(#metallicSteel)\`, \`url(#metallicCopper)\`, \`url(#metallicChrome)\`, \`url(#metallicRoseGold)\`, \`url(#iridescentHologram)\`, \`url(#glassSphere)\`, \`url(#sunsetSkyGrad)\`, \`url(#cyberNightGrad)\`, \`url(#auroraRibbonGrad)\`, \`url(#lavaMagmaGrad)\`.
  - Filters: \`url(#softGlow)\`, \`url(#neonBloom)\`, \`url(#tactileDoughWarp)\`, \`url(#paperGrain)\`, \`url(#claySculpt)\`, \`url(#watercolorBleed)\`, \`url(#motionBlurX)\`, \`url(#motionBlurY)\`, \`url(#frostedGlass)\`, \`url(#embossBevel)\`, \`url(#inkOutline)\`, \`url(#glitchSlice)\`.
- **Brushes & 3D Shapes**: Vector strokes with \`"brush"\` (\`spray|charcoal|ribbon|sparkle|doubleline|stipple|neon|chalk|watercolor|marker|calligraphy|dashed|glow|pixel|rough|solid\`), procedural \`"particles"\` (\`circle|star|spark|snow|smoke|confetti|bubble\`), and 3D primitives \`"threeD"\` (\`sphere|cube|torus|cylinder|octahedron|icosahedron|cone|ring|capsule|prism|gear\`).
- **Motion, Easing & Physics**: 36 unified easings + \`motion\` tags (\`x, y, rotation, scale, scaleX, scaleY, sway, bob, pulse, orbit, shake, flicker, spiral, bezierPath, trail\`), 2D rigid-body \`"physics"\` + \`"hitbox"\`, and 120+ unified math functions (\`sin, cos, tan, sinh, cosh, tanh, sinc, clamp, saturate, lerp, remap, smoothstep, smootherstep, gain, bias, impulse, gaussian, sigmoid, pingpong, sawtooth, triangle, square, pwm, noise, perlin1d, fbm, turbulence, ridges, voronoi1d, gravity, projectilex, projectiley, bouncepos, spring, dampedsine, pendulum, orbitx, orbity, lissajousx, lissajousy, aabbhit, circlehit, box3dhit, spherehit\`).
- **Curves & Storyboard/Audio**: 21 math \`"curve"\` generators (\`hilbert, dragon, koch, lissajous, spirograph, rose, spiral, butterfly, cardioid, lemniscate, astroid, hypocycloid, epicycloid, fermat, archimedes, phyllotaxis, sinewave, fourier, bezier, catmull, starpolygon, graph\`), \`"storyboard"\` cameraCuts (\`wide, medium, closeup, dutch, overhead, orbit, zoomIn, zoomOut, panLeft, panRight, shake, tilt\`) + \`"uiAngle"\` (\`fpsBadge, reticle, letterbox\`), and \`"audio"\` with 20 presets (\`ambient_chime, sci_fi_arp, cyberpunk_arp, retro_8bit, crystal_bells, deep_drone, arcade_jump, laser_pulse, rain_noise, heartbeat, lofi_chord, quantum_pad, warp_riser, marimba, orchestral_brass, bounce, chimes, synth_pulse, bass_groove, glitch\`) or custom AST \`formula\` (\`fm, pm, ringmod, lfo, chorus, vibrato, tremolo, bitcrush, fold, softclip, midi2hz, chord3, chord4, pink, white\`).`;

  const PIXEL_ART_CAPABILITY_GUIDE = `
STUDIO-GRADE PIXEL ENGINE v3 (\`\`\`pixelart — \`"format": "pixelart/v3"\`):
ALWAYS match Studio Demo fidelity (multi-stop dithered gradients, layered procedural depth ops, specular highlights, and post shaders — NEVER emit blank squares or tiny 8×8 blobs):
- **Canvas Size & Named Palettes**: Up to \`512×512\` (recommend \`64×64\` or \`128×128\` with \`frameCount: 16..24\`). Accepts explicit palette dicts/arrays OR named presets (\`"palette": "cyberpunk"|"pico8"|"endesga32"|"gameboy"|"sweetie16"|"fantasy24"|"synthwave"|"lava"|"ice"|"pastel"|"noir"|"forest"|"gold"\`).
- **Gradients & 30+ Procedural Ops** (all accept math expressions with 120+ functions, \`opacity\`, \`blendMode: "normal"|"add"|"multiply"|"screen"|"overlay"\`, \`visibleFrom\`, \`visibleTo\`):
  - \`gradients\`: \`linear\`, \`radial\`, \`conic\`, \`diamond\`, \`spiral\`, \`noise\` with \`dither: "bayer4"|"bayer8"|"bayer2"|"checker"|"halftone"\`.
  - \`backdrop\` & \`draw\` ops: \`gradient\`, \`aurora\`, \`stardust\`/\`particles\`, \`plasma\`, \`water\`/\`waves\`, \`fire\`/\`flame\`, \`rain\`, \`snow\`, \`lightning\`/\`bolt\`, \`graph\`/\`plot\`, \`sphere3d\` (Phong-shaded sphere), \`box3d\`, \`pyramid3d\`, \`torus3d\`, \`ring\`, \`arc\`, \`wedge\`, \`star\`, \`diamond\`, \`hexagon\`, \`regularpoly\`, \`roundrect\`, \`capsule\`, \`bezier\`, \`checker\`, \`grid\`, \`scanlines\`, \`dropshadow\`, \`specular\`, \`text\`/\`bitmaptext\` (5×7 pixel font), \`sprite\`/\`tile\`, \`mirror\`, \`outline\`, \`physicsball\`, \`physicsbox\`, \`hitbox\`, \`circle\`, \`ellipse\`, \`rect\`, \`polygon\`, \`line\`, \`pset\`.
- **18 Post Shaders**: \`"shaders": [{ "type": "vignette"|"scanline"|"crt"|"chromatic"|"glow"|"bloom"|"posterize"|"dither"|"outline"|"halftone"|"sepia"|"invert"|"pixelate"|"glitch"|"emboss"|"edge"|"tint"|"duotone", "intensity": 0.45 }]\`.`;

  const HYBRID_ENGINE_CAPABILITY_GUIDE = `
FOLIO v4.1 (Folio Zero) CROSS-ENGINE HYBRID FORMATS:
Supports \`\`\`liquidmotion, \`\`\`liquiddrop, \`\`\`pixelmotion, and \`\`\`motiondrop with full cross-engine blending (\`pixelBlendMode\`, \`pixelOpacity\`, \`pixelScale\`, \`particles\`, \`lighting.rimColor\`, \`letterbox\`, \`frameOverlay\`, \`postFilter: "vignette"|"bloom"|"crt"|"sepia"|"noir"|"cyberpunk"\`), plus full Stop Motion v3 layers, Storyboard camera cuts, and Math Audio synthesis.`;

  const EVO_ENGINE_CAPABILITY_GUIDE = `
STUDIO-GRADE EVO 3D ENGINE (\`\`\`evo — \`"format": "evo/v1"\`):
ALWAYS build rich multi-node PBR scenes matching the Studio Demos (never single bare cubes):
- **Environments & Atmosphere**: \`"environment": "studio"|"neon"|"sunset"|"obsidian"|"void"|"cyberpunk"|"arctic"|"desert"|"cosmic"|"forest"|"vaporwave"|"midnight"|"goldenHour"\`, \`"fog": { "color", "density" }\`, \`"starfield": true|320\`, \`"exposure": 1.15\`, \`"camera": { "fov", "position", "target", "autoRotate", "autoRotateSpeed" }\`.
- **29 Geometries**: \`box, sphere, torus, torusKnot, cylinder, cone, icosahedron, octahedron, dodecahedron, tetrahedron, prism, pyramid, helix, mobius, klein, lathe, gear, star3d, voxelGrid, particles3d, axes3d, wireCube, ring, plane, capsule, graph, surface, curve, group\`.
- **14 PBR Material Presets & Tags**: \`material.preset\`: \`glass|chrome|gold|neon|hologram|clay|toon|carbon|obsidian|lava|ice|emerald|copper|pearl\`, plus \`gradient: { colors, axis }\`, \`iridescence\`, \`sheen\`, \`flatShading\`, \`blending\`, \`emissivePulse\`, \`usePixelTexture\`.
- **Motion, Keyframes & Physics**: 120+ math funcs & 36 easings; \`motion\` (\`x, y, z, rx, ry, rz, spinX, spinY, spinZ, bob, waveY, bounceAmp, sway, orbit, orbitY, orbitX, lissajous, spiral, pulse\`), \`repeat\`, \`follow\`, rigid-body \`physics\` (\`velocity, gravity, drag, attractor, restitution, floorY, walls\`) + \`hitbox\`, \`storyboard.shots\`, and \`audio\`.`;

  const MODEL_ENGINE_CAPABILITY_GUIDE = `
STUDIO-GRADE 3D ENGINE / MODEL PIPELINES:
- **EVO 3D (\`\`\`evo)**: Full PBR 3D motion (29 geometries, 14 material presets, 13 environments, rigid-body physics/attractor/hitboxes, storyboard camera cuts, WebAudio).
- **Three.js (\`\`\`threejs)**: Structured JSON with 27 shapes (\`box, sphere, torus, torusKnot, cylinder, cone, icosahedron, dodecahedron, octahedron, tetrahedron, capsule, ring, plane, pyramid, prism, helix, mobius, gear, star, crystal, gridFloor, particleCloud, splineTube, terrain, dnaHelix, waveSurface, graphRibbon\`), 20 materials (\`pbr, glass, gold, chrome, copper, carbon, obsidian, lava, ice, emerald, hologram, iridescent, matte, clay, toon, neon, wireframe, normal, glassTinted, additiveGlow\`), 12 lighting presets (\`studio, sunset, cyberpunk, dramatic, matrix, vaporwave, noir, arctic, volcanic, emeraldForest, goldenHour, void\`), 17 animations (\`rotate, bounce, physicsBounce, pulse, breathing, float, orbit, figure8, lissajous, spiral, pendulum, wobble, spinX, spinZ, spring, explodeLoop, chaos\`), \`repeat\`, \`starfield\`, \`fogDensity\`, \`physics.drag/attractor\`, and \`hitbox\`.
- **Blockbench (\`\`\`bbmodel)** & **Voxels (\`\`\`voxels)** & **Headless Blender CLI (\`blender_cli\`)**: Supported natively.`;

  const RICH_MEDIA_EXPLAINER_GUIDE = `
When explaining concepts, giving tutorials, comparing data, or teaching:
- **Inline Interactive Charts (\`\`\`chart)**: Valid JSON \`{ "type": "bar"|"line"|"area"|"pie"|"donut"|"scatter"|"radar", "title": "...", "xLabel": "...", "yLabel": "...", "labels": [...], "series": [{ "name": "...", "color": "#...", "data": [...] }] }\`.
- **Inline Interactive Quizzes (\`\`\`quiz)**: Valid JSON \`{ "title": "...", "questions": [{ "question": "...", "options": [...], "correctIndex": 0, "hint": "...", "explanation": "..." }] }\`.
- **Stock Media, GIFs & SVG Icons (\`stock_media_search\`)**: Call \`stock_media_search\` (\`kind: "all"|"icons"|"images"|"gifs"\`) for verified public Wikimedia Commons photos/diagrams/GIFs and Iconify SVG icons — never invent external image URLs!`;

  const CREATIVE_ENGINE_PIPELINE_GUIDE = `
CREATIVE ORCHESTRATOR & STUDIO DEMO QUALITY PROTOCOL:
Whenever generating \`stopmotion\`, \`pixelart\`, \`evo\`, \`threejs\`, \`liquidmotion\`, \`liquiddrop\`, \`pixelmotion\`, \`motiondrop\`, or \`bbmodel\`:
1. Match **Engine Studio Demo quality** every single time — NEVER output minimal 1-primitive placeholders! Always compose multi-layered atmospheric backdrops, multi-stop gradients (\`gradient\`, \`bayer4/bayer8\`, \`wetGlaze*\`), dynamic contact shadows & Marker Trick specular highlights, smooth easing or physics kinematics, particle depth, storyboard camera framing, and matching math audio.
2. Always call \`validate_creative_code\` before emitting your final JSON block.`;

  const COMPACT_STUDIO_CAPABILITY_SUMMARY = `
FOLIO ${FOLIO_CURRENT_VERSION} RUNTIME OVERVIEW:
- Visual & Audio Code Blocks supported inline: \`\`\`evo (29 3D geometries + 14 PBR presets + physics/hitboxes), \`\`\`stopmotion (v3 + 16 vector brushes + 21 curves + 22 studio defs + 120 math funcs + 36 easings + 20 audio presets), \`\`\`pixelart (up to 512px + 30 procedural draw ops + 18 post shaders + named palettes + 5x7 bitmap font), \`\`\`liquidmotion / \`\`\`liquiddrop / \`\`\`pixelmotion / \`\`\`motiondrop (hybrids), \`\`\`threejs (27 shapes + 20 PBR materials + 12 lighting rigs + 17 animations), \`\`\`bbmodel, \`\`\`chart, \`\`\`quiz, \`\`\`html / \`\`\`tsx.
- Tools: \`folio_docs_lookup\` (authoritative Folio Docs/SDK/CLI/Changelog search), GitHub & \`gh\` CLI, \`antigravity_cli\`, workspace files/scripts, \`blender_cli\` (with RAM watchdog & pure-Python OBJ fallback), \`stock_media_search\`, \`namecom_domain_sim\`, \`validate_creative_code\`.`;

  const ghCliPath = getGitHubCliBinary();
  const blenderBin = getBlenderBinary();
  let activeWsId = 'folio-sandbox-1';
  try {
    if (rawWorkspaceId && /^[a-zA-Z0-9_-]{3,64}$/.test(rawWorkspaceId.trim())) {
      activeWsId = rawWorkspaceId.trim();
    }
  } catch {
    // Keep default workspace
  }

  const [ghUserSummary, activeWsScan] = await Promise.all([
    resolveChatGitHubUser(ghToken),
    scanWorkspaceFiles(getWorkspaceDir(activeWsId)).catch(() => ({
      files: [],
      entryFolders: [],
    })),
  ]);

  const hasFfmpeg = fs.existsSync('/usr/bin/ffmpeg') || fs.existsSync('/usr/local/bin/ffmpeg');
  const godotBin = getGodotBinary();
  const cmakeBin = getCmakeBinary();
  const kotlincBin = getKotlinBinary();
  const LIVE_ENV_CONTEXT = `
LIVE ENVIRONMENT STATE:
- Engine: ${FOLIO_CURRENT_VERSION} (Codename: Folio Core)
- CURRENT ACTIVE VERSION (AUTHORITATIVE): ${FOLIO_CURRENT_VERSION}. You are running ${FOLIO_CURRENT_VERSION} (upgraded from v4.1 Folio Zero and v4.0 OXYGEN). Always confirm **${FOLIO_CURRENT_VERSION}** with Official TypeScript & Python SDKs, \`folio\` CLI, Disk-Sharded SQLite FTS5/BM25 Knowledge Base (\`folio_docs_lookup\`), 4 GB RAM Watchdog & Snapshot Backups, Flash 4 / Omni Flash 1.2 / Neo 4 Python rule AI, EVO 3D Engine, Stop Motion v3, and Pixel Engine v3.
- Memory Watchdog: ${getAvailableRamMb()} MB free RAM (${getMemInfoStats().totalRamMb} MB total, swap ${getMemInfoStats().swapTotalMb} MB).
- GitHub: ${
    ghUserSummary
      ? `CONNECTED as @${ghUserSummary.login}${ghUserSummary.name ? ` (${ghUserSummary.name})` : ''}`
      : 'NOT CONNECTED (public repo reads still work)'
  } | gh CLI: ${ghCliPath ? 'ready' : 'unavailable'}
- Toolchains: Antigravity CLI (ready) | Godot 4.3 (${godotBin ? 'ready' : 'unavailable'}) | CMake/Ninja (${cmakeBin ? 'ready' : 'unavailable'}) | Kotlin 2.0 (${kotlincBin ? 'ready' : 'unavailable'}) | Neo 4 Python Engine + Disk KB (ready) | Blender CLI (${blenderBin ? 'ready' : 'pure-Python OBJ fallback'}) | FFmpeg (${hasFfmpeg ? 'ready' : 'unavailable'})
- Active Workspace "${activeWsId}": ${activeWsScan.files.length} file(s)${
    activeWsScan.files.length > 0
      ? ` (${activeWsScan.files
          .slice(0, 15)
          .map((f) => f.path)
          .join(', ')})`
      : ''
  }`;

  const creativeIntents = detectCreativeIntents(messages);
  const anyCreativeIntent =
    creativeIntents.animation ||
    creativeIntents.mathCurve ||
    creativeIntents.pixel ||
    creativeIntents.model3d ||
    creativeIntents.blender ||
    creativeIntents.explainer ||
    creativeIntents.hybrid ||
    creativeIntents.evo;

  const normalizedSharedSessions =
    typeof sharedSessionsContext === 'string'
      ? sharedSessionsContext.trim()
      : Array.isArray(sharedSessionsContext) && sharedSessionsContext.length > 0
        ? JSON.stringify(sharedSessionsContext)
        : '';
  const sessionPrivacyContext =
    !isIncognito && normalizedSharedSessions.length > 0
      ? `\n\nSHARED SESSIONS CONTEXT (explicitly permitted by user):\n${normalizedSharedSessions.slice(0, 18000)}`
      : '';

  const IMMERSIVE_PURE_CODE_DIRECTIVE = immersivePureCode
    ? `IMMERSIVE PURE-CODE MODE ENABLED:
Write your substantive response strictly as clean, executable, well-commented code blocks (TypeScript, JavaScript, Python, HTML/TSX, EVO 3D \`\`\`evo, Liquid Motion \`\`\`liquidmotion, Stop Motion \`\`\`stopmotion, Pixel Art \`\`\`pixelart, JSON, SQL, or heavily-commented algorithmic code). Avoid conversational prose outside code blocks; keep any section markers minimal (e.g., short markdown headings or concise 1-line comments inside code) and express full explanations, schemas, and logic directly inside the pure code.`
    : '';

  const conditionalGuides: string[] = [];
  if (creativeIntents.animation || creativeIntents.mathCurve) {
    conditionalGuides.push(STOP_MOTION_CAPABILITY_GUIDE);
  }
  if (creativeIntents.pixel) {
    conditionalGuides.push(PIXEL_ART_CAPABILITY_GUIDE);
  }
  if (creativeIntents.hybrid) {
    conditionalGuides.push(HYBRID_ENGINE_CAPABILITY_GUIDE);
  }
  if (creativeIntents.evo) {
    conditionalGuides.push(EVO_ENGINE_CAPABILITY_GUIDE);
  }
  if (creativeIntents.model3d || creativeIntents.blender) {
    conditionalGuides.push(MODEL_ENGINE_CAPABILITY_GUIDE);
  }
  if (creativeIntents.explainer) {
    conditionalGuides.push(RICH_MEDIA_EXPLAINER_GUIDE);
  }
  if (anyCreativeIntent) {
    conditionalGuides.push(CREATIVE_ENGINE_PIPELINE_GUIDE);
  }
  const latestUserText =
    [...messages].reverse().find((m) => m.role === 'user')?.text?.trim() || '';
  if (
    /\b(folio|sdk|cli|changelog|version|backup|ram|watchdog|blender|stopmotion|pixelart|evo|threejs|liquidmotion|liquiddrop|pixelmotion|motiondrop|neo\s*4|docs?|documentation|kb|shard)\b/i.test(
      latestUserText
    )
  ) {
    const docHits = searchFolioDocs(latestUserText, 2);
    if (docHits.length > 0) {
      const snippet = docHits
        .map((d) => `### ${d.title} [${d.category}]\n${d.content.slice(0, 720)}`)
        .join('\n\n')
        .slice(0, 1600);
      conditionalGuides.push(`FOLIO DOCUMENTATION CONTEXT (AUTHORITATIVE):\n${snippet}`);
    }
  }

  const trimmedSystem = systemInstruction?.trim();
  const capabilityGuides = [
    ...(IMMERSIVE_PURE_CODE_DIRECTIVE ? [IMMERSIVE_PURE_CODE_DIRECTIVE] : []),
    COMPACT_STUDIO_CAPABILITY_SUMMARY,
    ...conditionalGuides,
    LIVE_ENV_CONTEXT,
  ].join('\n\n') + sessionPrivacyContext;

  const effectiveSystemInstruction = trimmedSystem
    ? `${trimmedSystem}\n\n${capabilityGuides}`
    : capabilityGuides;
  const primary = getModelConfig(modelId, messages, creativeIntents);
  const shouldFallback = autoFallback !== false;
  const builtInDeclarations = getChatToolDeclarations();
  const reservedToolNames = new Set(
    builtInDeclarations.map((d) => d.name).filter((n): n is string => typeof n === 'string')
  );
  const { declarations: customDeclarations, map: customToolMap } =
    buildCustomFunctionDeclarations(customTools, reservedToolNames);
  const chatTools = [{ functionDeclarations: [...builtInDeclarations, ...customDeclarations] }];

  const resolveEffectiveThinkingLevel = (baseLevel: ThinkingLevel, targetModel: string): ThinkingLevel => {
    const supportsMinimal =
      targetModel === 'gemini-3.1-flash-lite' || targetModel === 'gemini-3.5-flash-lite';
    let chosen = baseLevel;
    if (thinkingMode) {
      chosen = mapThinkingModeToLevel(thinkingMode, targetModel);
    } else if (anyCreativeIntent) {
      if (targetModel === 'gemini-4-neon') {
        chosen = creativeIntents.blender || creativeIntents.hybrid || creativeIntents.mathCurve
          ? ThinkingLevel.XHIGH
          : baseLevel;
      } else if (targetModel === 'gemini-4-carbon') {
        chosen = ThinkingLevel.HIGH;
      } else if (baseLevel === ThinkingLevel.MINIMAL) {
        if (targetModel === 'gemini-4-hydrogen' && (creativeIntents.blender || creativeIntents.mathCurve || creativeIntents.model3d)) {
          chosen = ThinkingLevel.MEDIUM;
        } else {
          chosen = ThinkingLevel.LOW;
        }
      }
    }
    if (!supportsMinimal && chosen === ThinkingLevel.MINIMAL) {
      return ThinkingLevel.LOW;
    }
    if (targetModel !== 'gemini-4-neon' && targetModel !== 'gemini-4-hydrogen' && chosen === ThinkingLevel.XHIGH) {
      return ThinkingLevel.HIGH;
    }
    return chosen;
  };

  const runModelStream = async (cfg: ResolvedModelConfig, hasFallbackCandidate: boolean) => {
    const conversationContents: Content[] = contents.map((c) => ({
      role: c.role,
      parts: c.parts as Part[],
    }));

    let emittedChars = 0;
    let sentMeta = false;
    let blockedReason: string | undefined;
    let useBlockNoneFallback = false;
    const effectiveThinkingLevel = resolveEffectiveThinkingLevel(cfg.thinkingLevel, cfg.model);

    const emitMetaOnce = () => {
      if (sentMeta) return;
      sentMeta = true;
      onEvent({
        type: 'meta',
        modelId: cfg.id,
        ...(cfg.id !== primary.id ? { fallbackFrom: primary.id } : {}),
      });
    };

    const firstByteTimeoutMs = hasFallbackCandidate
      ? effectiveThinkingLevel === ThinkingLevel.MINIMAL || effectiveThinkingLevel === ThinkingLevel.LOW
        ? 15_000
        : 22_000
      : 55_000;
    const interChunkTimeoutMs = 45_000;

    if (cfg.model === 'gemini-omni-1.2-flash') {
      const omniPrompt = messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n\n');
      const interaction = await ai.interactions.create({
        model: 'gemini-omni-1.2-flash',
        input: omniPrompt,
        system_instruction: effectiveSystemInstruction,
        generation_config: {
          thinking_level:
            effectiveThinkingLevel === ThinkingLevel.LOW
              ? 'low'
              : effectiveThinkingLevel === ThinkingLevel.HIGH
              ? 'high'
              : 'medium',
        },
      });
      emitMetaOnce();
      let fullText = '';
      if (Array.isArray(interaction.steps)) {
        for (const step of interaction.steps) {
          if (step.type === 'thought' && Array.isArray(step.summary)) {
            const th = step.summary
              .map((c) => ('text' in c && typeof c.text === 'string' ? c.text : ''))
              .join('');
            if (th) onEvent({ type: 'thought', text: th });
          } else if (step.type === 'model_output' && Array.isArray(step.content)) {
            for (const c of step.content) {
              if (c.type === 'text' && c.text) fullText += c.text;
            }
          }
        }
      }
      if (!fullText && interaction.output_text) {
        fullText = interaction.output_text;
      }
      const chunkSize = 36;
      for (let idx = 0; idx < fullText.length; idx += chunkSize) {
        if (isClientClosed()) break;
        const slice = fullText.slice(idx, idx + chunkSize);
        emittedChars += slice.length;
        onEvent({ type: 'chunk', text: slice });
      }
      return emittedChars;
    }

    if (cfg.model === 'gemini-3.8-live-extended-thinking') {
      const liveLevel =
        effectiveThinkingLevel === ThinkingLevel.HIGH || effectiveThinkingLevel === ThinkingLevel.XHIGH
          ? ThinkingLevel.HIGH
          : effectiveThinkingLevel === ThinkingLevel.LOW || effectiveThinkingLevel === ThinkingLevel.MINIMAL
          ? ThinkingLevel.LOW
          : ThinkingLevel.MEDIUM;

      const nonBlockingTools: Array<{ functionDeclarations: FunctionDeclaration[] }> = [
        {
          functionDeclarations: [...builtInDeclarations, ...customDeclarations].map((d) => ({
            ...d,
            behavior: Behavior.NON_BLOCKING,
          })),
        },
      ];

      const runLiveAttempt = async (useAudioWithTranscription: boolean): Promise<number> => {
        let localEmitted = 0;
        let resolvedDone = false;
        const pendingToolJobs: Promise<void>[] = [];

        return new Promise<number>(async (resolve, reject) => {
          let settleTimer: NodeJS.Timeout | undefined;
          let sessionRef: Awaited<ReturnType<typeof ai.live.connect>> | undefined;

          const finish = (err?: unknown) => {
            if (resolvedDone) return;
            resolvedDone = true;
            if (settleTimer) clearTimeout(settleTimer);
            try {
              sessionRef?.close();
            } catch {
              // ignore close errors
            }
            if (err) reject(err);
            else resolve(localEmitted);
          };

          settleTimer = setTimeout(() => {
            if (localEmitted > 0) finish();
            else finish(new Error(`Model ${cfg.model} Live API timed out before responding.`));
          }, 50_000);

          try {
            const liveAi = createGeminiClient('v1beta');
            sessionRef = await liveAi.live.connect({
              model: 'gemini-3.8-live-extended-thinking',
              config: {
                responseModalities: [useAudioWithTranscription ? Modality.AUDIO : Modality.TEXT],
                ...(useAudioWithTranscription ? { outputAudioTranscription: {} } : {}),
                thinkingConfig: { thinkingLevel: liveLevel },
                tools: nonBlockingTools,
                systemInstruction: effectiveSystemInstruction,
              },
              callbacks: {
                onmessage: (message: LiveServerMessage) => {
                  if (isClientClosed()) {
                    finish();
                    return;
                  }
                  const parts = message.serverContent?.modelTurn?.parts ?? [];
                  for (const part of parts) {
                    if (part.thought === true && typeof part.text === 'string' && part.text.length > 0) {
                      emitMetaOnce();
                      onEvent({ type: 'thought', text: part.text });
                    } else if (!part.thought && typeof part.text === 'string' && part.text.length > 0) {
                      emitMetaOnce();
                      localEmitted += part.text.length;
                      onEvent({ type: 'chunk', text: part.text });
                    }
                  }
                  const transcriptText = message.serverContent?.outputTranscription?.text;
                  if (useAudioWithTranscription && transcriptText) {
                    emitMetaOnce();
                    localEmitted += transcriptText.length;
                    onEvent({ type: 'chunk', text: transcriptText });
                  }
                  for (const call of message.toolCall?.functionCalls ?? []) {
                    if (!call?.name) continue;
                    emitMetaOnce();
                    const callId = call.id || crypto.randomUUID();
                    const callArgs = (call.args || {}) as Record<string, unknown>;
                    onEvent({
                      type: 'thought',
                      text: `\n• Async Live tool call: ${call.name}\n`,
                    });
                    onEvent({
                      type: 'tool_call',
                      id: callId,
                      name: call.name,
                      args: callArgs,
                    });
                    const job = (async () => {
                      const started = Date.now();
                      const customDef = customToolMap.get(call.name!);
                      const toolResult = customDef
                        ? executeCustomToolVm(customDef, callArgs)
                        : await executeChatToolCall(call.name!, callArgs, {
                            ghToken,
                            activeWorkspaceId: activeWsId,
                          });
                      onEvent({
                        type: 'tool_result',
                        id: callId,
                        name: call.name!,
                        result: toolResult,
                        ok: !toolResult.error,
                        durationMs: Date.now() - started,
                      });
                      sessionRef?.sendToolResponse({
                        functionResponses: [
                          {
                            id: call.id,
                            name: call.name,
                            response: toolResult,
                            scheduling: FunctionResponseScheduling.WHEN_IDLE,
                          },
                        ],
                      });
                    })();
                    pendingToolJobs.push(job);
                  }
                  const status = message.serverContent?.interactionStatus;
                  if (status === InteractionStatus.IDLE && pendingToolJobs.length === 0) {
                    finish();
                  } else if (status === InteractionStatus.IDLE) {
                    void Promise.allSettled(pendingToolJobs).then(() => {
                      setTimeout(() => {
                        if (!resolvedDone && localEmitted > 0) finish();
                      }, 800);
                    });
                  } else if (!status && message.serverContent?.turnComplete && pendingToolJobs.length === 0 && localEmitted > 0) {
                    setTimeout(() => finish(), 250);
                  }
                },
                onerror: (ev: unknown) => {
                  const errMsg = ev instanceof Error ? ev.message : String((ev as { message?: string })?.message || ev);
                  finish(new Error(errMsg || 'Live Extended session error'));
                },
                onclose: () => {
                  if (localEmitted > 0) finish();
                },
              },
            });

            sessionRef.sendClientContent({
              turns: conversationContents,
              turnComplete: true,
            });
          } catch (connectErr) {
            finish(connectErr);
          }
        });
      };

      try {
        emittedChars = await runLiveAttempt(true);
      } catch (liveAudioErr) {
        const msg = (liveAudioErr instanceof Error ? liveAudioErr.message : String(liveAudioErr)).toLowerCase();
        if (msg.includes('modality') || msg.includes('audio') || msg.includes('invalid_argument') || msg.includes('unsupported')) {
          emittedChars = await runLiveAttempt(false);
        } else {
          throw liveAudioErr;
        }
      }
      return emittedChars;
    }

    const isGemmaModel = cfg.model.startsWith('gemma-');
    const gemmaContents: Content[] = isGemmaModel
      ? (() => {
          const cloned: Content[] = conversationContents.map((c) => ({
            role: c.role,
            parts: [...(c.parts || [])],
          }));
          const firstUser = cloned.find((c) => c.role === 'user');
          const sysPrefix = `[System Instructions]\n${effectiveSystemInstruction}\n\n[User Request]\n`;
          if (firstUser && Array.isArray(firstUser.parts)) {
            firstUser.parts = [{ text: sysPrefix }, ...firstUser.parts];
          } else {
            cloned.unshift({ role: 'user', parts: [{ text: sysPrefix }] });
          }
          return cloned;
        })()
      : conversationContents;

    for (let round = 0; round < 6; round += 1) {
      if (isClientClosed()) break;

      const roundAbort = new AbortController();
      let timedOut = false;
      let receivedAnyPart = false;
      let roundTimer: NodeJS.Timeout | undefined = setTimeout(() => {
        timedOut = true;
        roundAbort.abort(new Error(`Upstream model ${cfg.model} timed out before first byte (${firstByteTimeoutMs}ms)`));
      }, firstByteTimeoutMs);

      const bumpRoundTimeout = () => {
        receivedAnyPart = true;
        if (roundTimer) clearTimeout(roundTimer);
        roundTimer = setTimeout(() => {
          timedOut = true;
          roundAbort.abort(new Error(`Upstream model ${cfg.model} stalled`));
        }, interChunkTimeoutMs);
      };

      try {
        const isGemini25 = cfg.model.startsWith('gemini-2.5');
        const resolvedThinkingConfig = isGemini25
          ? effectiveThinkingLevel === ThinkingLevel.MINIMAL || effectiveThinkingLevel === ThinkingLevel.LOW
            ? { thinkingBudget: 0 }
            : { thinkingBudget: 1024, includeThoughts: true }
          : {
              thinkingLevel: effectiveThinkingLevel,
              ...(effectiveThinkingLevel !== ThinkingLevel.MINIMAL
                ? { includeThoughts: true }
                : {}),
            };
        const streamConfig = isGemmaModel
          ? {
              abortSignal: roundAbort.signal,
              safetySettings: buildSafetySettings(safetyFilters, useBlockNoneFallback),
            }
          : {
              abortSignal: roundAbort.signal,
              systemInstruction: effectiveSystemInstruction,
              safetySettings: buildSafetySettings(safetyFilters, useBlockNoneFallback),
              thinkingConfig: resolvedThinkingConfig,
              tools: chatTools,
            };
        const targetAi = isGemmaModel ? createGeminiClient('v1beta') : ai;
        let stream;
        try {
          stream = await targetAi.models.generateContentStream({
            model: cfg.model,
            contents: isGemmaModel ? gemmaContents : conversationContents,
            config: streamConfig,
          });
        } catch (streamInitErr) {
          if (timedOut) {
            throw new Error(`Model ${cfg.model} timed out before responding.`);
          }
          const msgLower = (streamInitErr instanceof Error ? streamInitErr.message : String(streamInitErr)).toLowerCase();
          if (!useBlockNoneFallback && safetyFilters && Object.values(safetyFilters).includes('none') && (msgLower.includes('harm_block_threshold') || msgLower.includes('off') || msgLower.includes('invalid_argument'))) {
            useBlockNoneFallback = true;
            stream = await targetAi.models.generateContentStream({
              model: cfg.model,
              contents: isGemmaModel ? gemmaContents : conversationContents,
              config: {
                ...streamConfig,
                safetySettings: buildSafetySettings(safetyFilters, true),
              },
            });
          } else {
            throw streamInitErr;
          }
        }

        const roundModelParts: Part[] = [];
        const pendingCalls: Array<{ id?: string; name: string; args?: Record<string, unknown> }> = [];

        for await (const chunk of stream) {
          bumpRoundTimeout();
          if (isClientClosed()) {
            roundAbort.abort();
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

          const candidateParts = chunk.candidates?.[0]?.content?.parts;
          if (Array.isArray(candidateParts)) {
            for (const part of candidateParts) {
              if (
                part &&
                (part.functionCall ||
                  part.thoughtSignature ||
                  part.thought ||
                  (typeof part.text === 'string' && part.text.length > 0))
              ) {
                roundModelParts.push(part);
              }
              if (part?.thought === true && typeof part.text === 'string' && part.text.length > 0) {
                emitMetaOnce();
                onEvent({ type: 'thought', text: part.text });
              }
            }
          }

          if (Array.isArray(chunk.functionCalls) && chunk.functionCalls.length > 0) {
            for (const fc of chunk.functionCalls) {
              if (fc && fc.name) {
                pendingCalls.push({
                  id: fc.id,
                  name: fc.name,
                  args: (fc.args || {}) as Record<string, unknown>,
                });
              }
            }
          }

          const text = chunk.text;
          if (text) {
            emitMetaOnce();
            emittedChars += text.length;
            onEvent({ type: 'chunk', text });
          }
        }

        if (timedOut && !receivedAnyPart) {
          throw new Error(`Model ${cfg.model} timed out before finishing response.`);
        }
        if (timedOut) {
          throw new Error(`Model ${cfg.model} stalled mid-response.`);
        }

        if (pendingCalls.length === 0 || isClientClosed()) {
          break;
        }

        if (roundTimer) {
          clearTimeout(roundTimer);
          roundTimer = undefined;
        }

        const modelTurnParts: Part[] =
          roundModelParts.length > 0
            ? roundModelParts
            : pendingCalls.map((call) => ({
                functionCall: {
                  id: call.id,
                  name: call.name,
                  args: call.args || {},
                },
              }));

        const functionResponseParts: Part[] = [];
        for (const call of pendingCalls) {
          emitMetaOnce();
          const callId = call.id || crypto.randomUUID();
          const callArgs = call.args || {};
          const argSummary = Object.entries(callArgs)
            .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v)}`)
            .join(', ');
          onEvent({
            type: 'thought',
            text: `\n• Tool call: ${call.name}(${argSummary})\n`,
          });
          onEvent({
            type: 'tool_call',
            id: callId,
            name: call.name,
            args: callArgs,
          });

          const toolStartedAt = Date.now();
          const customDef = customToolMap.get(call.name);
          const toolResult = customDef
            ? executeCustomToolVm(customDef, callArgs)
            : await executeChatToolCall(call.name, callArgs, {
                ghToken,
                activeWorkspaceId: activeWsId,
              });
          const toolDurationMs = Date.now() - toolStartedAt;

          onEvent({
            type: 'tool_result',
            id: callId,
            name: call.name,
            result: toolResult,
            ok: !toolResult.error,
            durationMs: toolDurationMs,
          });

          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: toolResult,
            },
          });
        }

        conversationContents.push({ role: 'model', parts: modelTurnParts });
        conversationContents.push({ role: 'user', parts: functionResponseParts });
      } catch (roundErr) {
        if (timedOut) {
          throw new Error(`Model ${cfg.model} timed out before responding.`);
        }
        throw roundErr;
      } finally {
        if (roundTimer) {
          clearTimeout(roundTimer);
          roundTimer = undefined;
        }
      }
    }

    if (emittedChars === 0 && blockedReason) {
      throw new Error(
        `Blocked by safety filter (${blockedReason}). You can adjust thresholds in Safety filters.`
      );
    }

    if (emittedChars > 0 && blockedReason && !isClientClosed()) {
      const notice = `\n\n> **Safety notice:** Stream stopped early (${blockedReason}). Adjust thresholds in **Safety filters** in the header if needed.`;
      emittedChars += notice.length;
      onEvent({ type: 'chunk', text: notice });
    }

    return emittedChars;
  };

  const rawChain: ResolvedModelConfig[] = shouldFallback
    ? getFallbackChain(primary)
    : [primary, primary, primary];
  const nonCooldown = rawChain.filter((c) => !isModelInCooldown(c.model));
  const softCooldown503 = rawChain.filter((c) => {
    const entry = modelCooldownUntil.get(c.model);
    return Boolean(entry && Date.now() < entry.until && entry.reason === '503');
  });
  const healthyFirst = shouldFallback
    ? nonCooldown.length > 0
      ? [...nonCooldown, ...softCooldown503]
      : softCooldown503.length > 0
      ? softCooldown503
      : rawChain
    : rawChain;
  const attempts = healthyFirst.length > 0 ? healthyFirst : rawChain;

  let emittedChars = 0;
  let lastErr: unknown;

  for (let i = 0; i < attempts.length; i += 1) {
    if (isClientClosed()) break;
    const hasNext = i < attempts.length - 1;
    try {
      emittedChars = await runModelStream(attempts[i], hasNext);
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      markModelCooldown(attempts[i].model, err);
      const errLower = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isQuota429 =
        errLower.includes('429') || errLower.includes('resource_exhausted') || errLower.includes('quota');
      const nextIsSameModel =
        hasNext &&
        attempts[i + 1].model === attempts[i].model &&
        attempts[i + 1].thinkingLevel === attempts[i].thinkingLevel;
      const canRetry =
        !isClientClosed() &&
        hasNext &&
        isDemandOrTransientError(err) &&
        !(nextIsSameModel && (isBillingOrModelMissingError(err) || isQuota429));
      if (canRetry) {
        const baseDelay = nextIsSameModel ? (i === 0 ? 750 : 1650) : 260;
        const jitter = Math.floor(Math.random() * 180);
        await new Promise((r) => setTimeout(r, baseDelay + jitter));
        continue;
      }
      if (shouldFallback && !isClientClosed() && emittedChars === 0 && isDemandOrTransientError(err)) {
        return runNeo4Pipeline(params, primary.id);
      }
      throw err;
    }
  }

  if (lastErr) {
    if (shouldFallback && !isClientClosed() && emittedChars === 0 && isDemandOrTransientError(lastErr)) {
      return runNeo4Pipeline(params, primary.id);
    }
    throw lastErr;
  }

  if (!isClientClosed()) {
    if (emittedChars === 0) {
      onEvent({
        type: 'error',
        message: 'No response text was generated for this prompt. Please try again or switch models.',
      });
    } else {
      onEvent({ type: 'done', durationMs: Date.now() - streamStartTime });
    }
  }
}

app.post('/api/chat/stream', async (req: Request, res: Response) => {
  const {
    messages,
    modelId,
    neoMode,
    autoFallback,
    systemInstruction,
    safetyFilters,
    activeWorkspaceId,
    sharedSessionsContext,
    isIncognito,
    immersivePureCode,
    customTools,
    thinkingMode,
    entropicAuditorEnabled,
    semanticEngineEnabled,
    metaScriptingEnabled,
  } = req.body as {
    messages?: IncomingMessage[];
    modelId?: ModelChoiceId;
    neoMode?: 'llm' | 'rule';
    autoFallback?: boolean;
    systemInstruction?: string;
    safetyFilters?: IncomingSafetyFilters;
    activeWorkspaceId?: string;
    sharedSessionsContext?: string | unknown[];
    isIncognito?: boolean;
    immersivePureCode?: boolean;
    customTools?: IncomingCustomToolDef[];
    thinkingMode?: ThinkingMode;
    entropicAuditorEnabled?: boolean;
    semanticEngineEnabled?: boolean;
    metaScriptingEnabled?: boolean;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'At least one message is required.' });
    return;
  }

  req.socket?.setTimeout(0);
  req.socket?.setNoDelay(true);
  res.socket?.setNoDelay(true);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(': stream-open\n\ndata: {"type":"ping"}\n\n');

  let clientClosed = false;
  const heartbeatTimer = setInterval(() => {
    if (!clientClosed && !res.writableEnded) {
      res.write('data: {"type":"ping"}\n\n');
    }
  }, 3500);

  res.on('close', () => {
    if (!res.writableFinished) {
      clientClosed = true;
    }
    clearInterval(heartbeatTimer);
  });

  const sendEvent = (payload: Record<string, unknown>) => {
    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  try {
    await runFolioChatPipeline({
      messages,
      modelId,
      neoMode,
      autoFallback,
      systemInstruction,
      safetyFilters,
      activeWorkspaceId,
      sharedSessionsContext,
      isIncognito,
      immersivePureCode,
      customTools,
      ghToken: getGitHubTokenForRequest(req),
      thinkingMode,
      entropicAuditorEnabled,
      semanticEngineEnabled,
      metaScriptingEnabled,
      isClientClosed: () => clientClosed,
      onEvent: sendEvent,
    });
  } catch (err) {
    const { message } = formatErrorMessage(err);
    sendEvent({ type: 'error', message });
  } finally {
    clearInterval(heartbeatTimer);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

app.post('/api/chat/complete', async (req: Request, res: Response) => {
  const {
    messages,
    modelId,
    neoMode,
    autoFallback,
    systemInstruction,
    safetyFilters,
    activeWorkspaceId,
    sharedSessionsContext,
    isIncognito,
    immersivePureCode,
    customTools,
    thinkingMode,
    entropicAuditorEnabled,
    semanticEngineEnabled,
    metaScriptingEnabled,
  } = req.body as {
    messages?: IncomingMessage[];
    modelId?: ModelChoiceId;
    neoMode?: 'llm' | 'rule';
    autoFallback?: boolean;
    systemInstruction?: string;
    safetyFilters?: IncomingSafetyFilters;
    activeWorkspaceId?: string;
    sharedSessionsContext?: string | unknown[];
    isIncognito?: boolean;
    immersivePureCode?: boolean;
    customTools?: IncomingCustomToolDef[];
    thinkingMode?: ThinkingMode;
    entropicAuditorEnabled?: boolean;
    semanticEngineEnabled?: boolean;
    metaScriptingEnabled?: boolean;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'At least one message is required.' });
    return;
  }

  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableFinished) clientClosed = true;
  });

  let resolvedModelId: ModelChoiceId | undefined = modelId;
  let fallbackFrom: ModelChoiceId | undefined;
  let text = '';
  let thoughts = '';
  let durationMs = 0;
  let errorMsg: string | null = null;
  let auditReport: EntropicAuditMetrics | undefined;
  const toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: 'done' | 'error';
    result?: unknown;
    durationMs?: number;
  }> = [];

  try {
    await runFolioChatPipeline({
      messages,
      modelId,
      neoMode,
      autoFallback: autoFallback ?? true,
      systemInstruction,
      safetyFilters,
      activeWorkspaceId,
      sharedSessionsContext,
      isIncognito,
      immersivePureCode,
      customTools,
      ghToken: getGitHubTokenForRequest(req),
      thinkingMode,
      entropicAuditorEnabled,
      semanticEngineEnabled,
      metaScriptingEnabled,
      isClientClosed: () => clientClosed,
      onEvent: (ev) => {
        if (ev.type === 'meta') {
          resolvedModelId = ev.modelId as ModelChoiceId | undefined;
          fallbackFrom = ev.fallbackFrom as ModelChoiceId | undefined;
        } else if (ev.type === 'thought' && typeof ev.text === 'string') {
          thoughts += ev.text;
        } else if (ev.type === 'chunk' && typeof ev.text === 'string') {
          text += ev.text;
        } else if (ev.type === 'audit' && ev.audit) {
          auditReport = ev.audit as EntropicAuditMetrics;
        } else if (ev.type === 'tool_call' && typeof ev.name === 'string') {
          toolCalls.push({
            id: String(ev.id || crypto.randomUUID()),
            name: ev.name,
            args: (ev.args as Record<string, unknown>) || {},
            status: 'done',
          });
        } else if (ev.type === 'tool_result' && typeof ev.name === 'string') {
          const match = toolCalls.find((tc) => tc.id === ev.id) || [...toolCalls].reverse().find((tc) => tc.name === ev.name);
          if (match) {
            match.status = ev.ok === false ? 'error' : 'done';
            match.result = ev.result;
            match.durationMs = typeof ev.durationMs === 'number' ? ev.durationMs : undefined;
          }
        } else if (ev.type === 'done' && typeof ev.durationMs === 'number') {
          durationMs = ev.durationMs;
        } else if (ev.type === 'error' && typeof ev.message === 'string') {
          errorMsg = ev.message;
        }
      },
    });

    if (errorMsg && !text) {
      res.status(502).json({ error: errorMsg });
      return;
    }

    res.json({
      ok: true,
      modelId: resolvedModelId,
      fallbackFrom,
      text,
      thoughts: thoughts || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      audit: auditReport || (entropicAuditorEnabled ? computeEntropicAudit(text) : undefined),
      durationMs,
    });
  } catch (err) {
    const { status, message } = formatErrorMessage(err);
    res.status(status).json({ error: message });
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
    const titleModels = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'];
    let rawTitle = '';
    for (const tm of titleModels) {
      if (isModelInCooldown(tm)) continue;
      try {
        const response = await ai.models.generateContent({
          model: tm,
          contents: `Summarize the following user request into a concise 3 to 5 word conversation title. Output only the title text without quotes or trailing punctuation:\n\n${prompt.slice(0, 600)}`,
          config: {
            abortSignal: AbortSignal.timeout(6000),
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
        });
        rawTitle = (response.text || '').trim().replace(/^["']|["']$/g, '');
        if (rawTitle) break;
      } catch (e) {
        markModelCooldown(tm, e);
      }
    }
    res.json({ title: rawTitle || prompt.slice(0, 42) });
  } catch {
    const fallback = prompt.trim().split(/\s+/).slice(0, 6).join(' ');
    res.json({ title: fallback || 'New Conversation' });
  }
});

app.post('/api/chat/image', async (req: Request, res: Response) => {
  const startMs = Date.now();
  const { prompt, aspectRatio, attachments } = req.body as {
    prompt?: string;
    aspectRatio?: string;
    attachments?: Array<{ mimeType?: string; data?: string; name?: string }>;
  };

  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: 'Prompt is required for image generation.' });
    return;
  }

  try {
    const ai = createGeminiClient();
    const validRatio =
      aspectRatio === '1:1' || aspectRatio === '9:16' || aspectRatio === '4:3' || aspectRatio === '3:4'
        ? aspectRatio
        : '16:9';

    const refImages = Array.isArray(attachments)
      ? attachments.filter((a) => a && typeof a.data === 'string' && a.data.length > 0 && (a.mimeType || '').startsWith('image/'))
      : [];

    const inputPayload: unknown =
      refImages.length > 0
        ? [
            { type: 'text', text: prompt.trim() },
            ...refImages.slice(0, 3).map((img) => ({
              type: 'image',
              data: img.data,
              mime_type: img.mimeType || 'image/png',
            })),
          ]
        : prompt.trim();

    const interaction = await ai.interactions.create({
      model: 'gemini-3.1-flash-lite-image',
      input: inputPayload as string,
      store: true,
      response_modalities: ['image', 'text'],
      generation_config: {
        image_config: {
          aspect_ratio: validRatio,
          image_size: '1K',
        },
      },
    });

    const images: Array<{ mimeType: string; dataUrl: string; prompt: string }> = [];
    let textOut = '';

    if (interaction.output_image?.data) {
      const mimeType = interaction.output_image.mime_type || 'image/png';
      images.push({
        mimeType,
        dataUrl: `data:${mimeType};base64,${interaction.output_image.data}`,
        prompt: prompt.trim(),
      });
    }

    if (Array.isArray(interaction.steps)) {
      for (const step of interaction.steps) {
        if (step.type === 'model_output' && Array.isArray(step.content)) {
          for (const item of step.content) {
            const c = item as { type?: string; data?: string; mime_type?: string; text?: string };
            if (c.type === 'image' && c.data) {
              const mimeType = c.mime_type || 'image/png';
              images.push({
                mimeType,
                dataUrl: `data:${mimeType};base64,${c.data}`,
                prompt: prompt.trim(),
              });
            } else if (c.type === 'text' && typeof c.text === 'string') {
              textOut += c.text;
            }
          }
        }
      }
    }

    if (images.length === 0) {
      throw new Error('Nano Banana Lite did not return any image output.');
    }

    res.json({
      images,
      text: textOut.trim() || `Generated with Nano Banana Lite (\`${validRatio}\`): ${prompt.trim()}`,
      modelId: 'nano-banana-lite',
      durationMs: Date.now() - startMs,
    });
  } catch (err) {
    const { status, message } = formatErrorMessage(err);
    res.status(status).json({ error: message, durationMs: Date.now() - startMs });
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

let cachedThreeBundleJs: string | null = null;

app.get('/api/vendor/three.min.js', async (_req: Request, res: Response) => {
  try {
    if (!cachedThreeBundleJs) {
      const nodeModulesPath = path.resolve(__dirname, 'node_modules');
      const result = await esbuild.build({
        stdin: {
          contents: `
            import * as THREE from 'three';
            import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
            const ThreeExport = Object.assign({}, THREE, { OrbitControls });
            globalThis.THREE = ThreeExport;
            if (typeof window !== 'undefined') window.THREE = ThreeExport;
          `,
          loader: 'js',
          resolveDir: __dirname,
        },
        bundle: true,
        minify: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: ['es2020'],
        nodePaths: [nodeModulesPath],
      });
      cachedThreeBundleJs = result.outputFiles?.[0]?.text || '';
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(cachedThreeBundleJs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to bundle Three.js';
    res.status(500).type('text/plain').send(`console.error(${JSON.stringify(msg)});`);
  }
});

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
        PATH: `${FOLIO_BIN_DIR}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
        HOME: cwd,
        TMPDIR: cwd,
        XDG_STATE_HOME: path.join(__dirname, '.folio-data', 'xdg-state'),
        XDG_CONFIG_HOME: path.join(__dirname, '.folio-data', 'xdg-config'),
        GH_NO_UPDATE_NOTIFIER: '1',
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
  const id = (req.params.id as string) as string;
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
  const filename = (req.params.filename as string) as string;
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
fs.mkdirSync(path.join(WORKSPACES_ROOT, 'folio-sandbox-1'), { recursive: true });

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

app.get('/api/workspaces', async (_req: Request, res: Response) => {
  try {
    fs.mkdirSync(path.join(WORKSPACES_ROOT, 'folio-sandbox-1'), { recursive: true });
    const entries = await fs.promises.readdir(WORKSPACES_ROOT, { withFileTypes: true });
    const workspaces = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!/^[a-zA-Z0-9_-]{3,64}$/.test(entry.name)) continue;
      const dir = path.join(WORKSPACES_ROOT, entry.name);
      const stat = await fs.promises.stat(dir);
      const scanned = await scanWorkspaceFiles(dir);
      workspaces.push({
        id: entry.name,
        fileCount: scanned.files.length,
        entryFolders: scanned.entryFolders,
        hasWorkflow: scanned.files.some((f) => f.path === 'folio.workflow.json'),
        updatedAt: Math.round(stat.mtimeMs),
      });
    }
    workspaces.sort((a, b) => {
      if (a.id === 'folio-sandbox-1') return -1;
      if (b.id === 'folio-sandbox-1') return 1;
      return b.updatedAt - a.updatedAt;
    });
    res.json({ workspaces });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to list workspaces.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/workspaces', async (req: Request, res: Response) => {
  try {
    const { id } = req.body as { id?: string };
    const cleanId = sanitizeWorkspaceId(id || '');
    const dir = getWorkspaceDir(cleanId);
    const scanned = await scanWorkspaceFiles(dir);
    res.json({
      workspace: {
        id: cleanId,
        fileCount: scanned.files.length,
        entryFolders: scanned.entryFolders,
        hasWorkflow: scanned.files.some((f) => f.path === 'folio.workflow.json'),
        updatedAt: Date.now(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to create workspace.';
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const id = sanitizeWorkspaceId(((req.params.id as string) as string));
    if (id === 'folio-sandbox-1') {
      res.status(400).json({ error: 'Default workspace cannot be deleted.' });
      return;
    }
    const dir = path.join(WORKSPACES_ROOT, id);
    await fs.promises.rm(dir, { recursive: true, force: true });
    res.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to delete workspace.';
    res.status(400).json({ error: msg });
  }
});

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
  '.toml', '.ini', '.env', '.sql', '.csv', '.bbmodel', '.obj', '.mtl',
  '.gltf', '.log', '.diff', '.patch', '.glsl', '.vert', '.frag', '.tex',
  '.rst', '.c', '.cpp', '.h', '.java', '.rs', '.go', '.rb', '.php',
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
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
    const scanned = await scanWorkspaceFiles(workspaceDir);
    res.json(scanned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to list workspace files.';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/workspace/:id/file', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
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
    if (stat.size > 2 * 1024 * 1024) {
      res.status(413).json({ error: 'File is larger than 2MB editor preview limit. Use AI token-chunk reader for up to 200MB files.' });
      return;
    }
    const content = await fs.promises.readFile(fullPath, 'utf8');
    res.json({ path: relPath, content, size: stat.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to read workspace file.';
    res.status(400).json({ error: msg });
  }
});

const MAX_LARGE_UPLOAD_BYTES = 200 * 1024 * 1024;

app.post('/api/workspace/:id/upload-large', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const fullPath = resolveWorkspaceFilePath(workspaceDir, relPath);

    const contentLengthHeader = Number(req.headers['content-length'] || '0');
    if (Number.isFinite(contentLengthHeader) && contentLengthHeader > MAX_LARGE_UPLOAD_BYTES) {
      res.status(413).json({ error: 'File exceeds 200 MB upload limit.' });
      return;
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(fullPath);
      let received = 0;
      let aborted = false;

      const fail = (err: Error) => {
        if (aborted) return;
        aborted = true;
        req.unpipe(writeStream);
        writeStream.destroy();
        fs.promises.rm(fullPath, { force: true }).catch(() => {});
        reject(err);
      };

      req.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_LARGE_UPLOAD_BYTES) {
          fail(new Error('File exceeds 200 MB upload limit.'));
        }
      });

      req.on('error', (err) => fail(err));
      writeStream.on('error', (err) => fail(err));
      writeStream.on('finish', () => {
        if (!aborted) resolve();
      });

      req.pipe(writeStream);
    });

    const stat = await fs.promises.stat(fullPath);
    res.json({ ok: true, path: relPath, size: stat.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to upload file.';
    res.status(msg.includes('200 MB') ? 413 : 400).json({ error: msg });
  }
});

app.post('/api/workspace/:id/files', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
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
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
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

async function executeWorkspaceScript(
  workspaceDir: string,
  opts: {
    code?: string;
    language?: string;
    filePath?: string;
    stdin?: string;
    timeoutMs?: number;
  }
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  runtime: string;
}> {
  const stdinText = typeof opts.stdin === 'string' ? opts.stdin : '';
  const timeoutMs = Math.min(30000, Math.max(1000, opts.timeoutMs ?? 15000));
  let targetCode = typeof opts.code === 'string' ? opts.code : '';
  let resolvedScriptFile: string | null = null;

  if (opts.filePath && opts.filePath.trim()) {
    resolvedScriptFile = resolveWorkspaceFilePath(workspaceDir, opts.filePath.trim());
    if (typeof opts.code === 'string' && opts.code.length > 0) {
      await fs.promises.mkdir(path.dirname(resolvedScriptFile), { recursive: true });
      await fs.promises.writeFile(resolvedScriptFile, opts.code, 'utf8');
    } else if (fs.existsSync(resolvedScriptFile)) {
      targetCode = await fs.promises.readFile(resolvedScriptFile, 'utf8');
    }
  }

  if (!targetCode.trim()) {
    throw new Error('Script code or existing file is required.');
  }

  const ext = resolvedScriptFile ? path.extname(resolvedScriptFile).toLowerCase() : '';
  const lang = (opts.language || ext.replace(/^\./, '') || 'python').trim().toLowerCase();

  if (lang === 'python' || lang === 'py' || lang === 'python3') {
    const scriptPath = resolvedScriptFile || path.join(workspaceDir, '__runner__.py');
    if (!resolvedScriptFile) {
      await fs.promises.writeFile(scriptPath, targetCode, 'utf8');
    }
    const result = await runSandboxedProcess('python3', ['-u', scriptPath], workspaceDir, stdinText, timeoutMs);
    if (!resolvedScriptFile) {
      await fs.promises.rm(scriptPath, { force: true }).catch(() => {});
    }
    return { ...result, runtime: 'Python 3 (Workspace)' };
  }

  if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
    const scriptPath = resolvedScriptFile || path.join(workspaceDir, '__runner__.sh');
    if (!resolvedScriptFile) {
      await fs.promises.writeFile(scriptPath, targetCode, 'utf8');
    }
    const result = await runSandboxedProcess('bash', [scriptPath], workspaceDir, stdinText, timeoutMs);
    if (!resolvedScriptFile) {
      await fs.promises.rm(scriptPath, { force: true }).catch(() => {});
    }
    return { ...result, runtime: 'Bash (Workspace)' };
  }

  if (lang === 'javascript' || lang === 'js' || lang === 'mjs' || lang === 'typescript' || lang === 'ts') {
    const isTs = lang === 'typescript' || lang === 'ts';
    const transformed = await esbuild.transform(targetCode, {
      loader: isTs ? 'ts' : 'js',
      format: 'cjs',
      target: 'node20',
    });
    const compiledPath = path.join(workspaceDir, '__runner__.cjs');
    await fs.promises.writeFile(compiledPath, transformed.code, 'utf8');
    const result = await runSandboxedProcess('node', [compiledPath], workspaceDir, stdinText, timeoutMs);
    await fs.promises.rm(compiledPath, { force: true }).catch(() => {});
    return { ...result, runtime: `Node.js ${process.version} (Workspace)` };
  }

  throw new Error(`Execution inside workspace supports Python, JS/TS, and Bash (got "${lang}").`);
}

app.post('/api/workspace/:id/execute', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
    const { code, language, filePath, stdin, timeoutMs } = req.body as {
      code?: string;
      language?: string;
      filePath?: string;
      stdin?: string;
      timeoutMs?: number;
    };

    const execOut = await executeWorkspaceScript(workspaceDir, {
      code,
      language,
      filePath,
      stdin,
      timeoutMs,
    });
    const scanned = await scanWorkspaceFiles(workspaceDir);
    res.json({
      ...execOut,
      mode: 'native',
      files: scanned.files,
      entryFolders: scanned.entryFolders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Workspace script execution failed.';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/workspace/:id/workflow', async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
    const { steps: bodySteps, stopOnError = true } = req.body as {
      steps?: Array<{ name?: string; language?: string; filePath?: string; code?: string }>;
      stopOnError?: boolean;
    };

    let steps = Array.isArray(bodySteps) ? bodySteps : [];
    if (steps.length === 0) {
      const wfFile = path.join(workspaceDir, 'folio.workflow.json');
      if (fs.existsSync(wfFile)) {
        const parsed = JSON.parse(await fs.promises.readFile(wfFile, 'utf8')) as {
          steps?: Array<{ name?: string; language?: string; filePath?: string; code?: string }>;
        };
        if (Array.isArray(parsed.steps)) {
          steps = parsed.steps;
        }
      }
    }

    if (steps.length === 0) {
      res.status(400).json({ error: 'No workflow steps found. Add steps or a folio.workflow.json file.' });
      return;
    }

    const stepResults: Array<{
      name: string;
      runtime: string;
      exitCode: number;
      durationMs: number;
      stdout: string;
      stderr: string;
      timedOut: boolean;
    }> = [];

    for (let i = 0; i < steps.slice(0, 12).length; i += 1) {
      const step = steps[i];
      const stepName = step.name || step.filePath || `Step ${i + 1}`;
      try {
        const out = await executeWorkspaceScript(workspaceDir, {
          code: step.code,
          language: step.language,
          filePath: step.filePath,
          timeoutMs: 20000,
        });
        stepResults.push({
          name: stepName,
          ...out,
        });
        if (stopOnError && out.exitCode !== 0) {
          break;
        }
      } catch (stepErr) {
        const msg = stepErr instanceof Error ? stepErr.message : 'Step failed';
        stepResults.push({
          name: stepName,
          runtime: step.language || 'Unknown',
          exitCode: 1,
          durationMs: 0,
          stdout: '',
          stderr: msg,
          timedOut: false,
        });
        if (stopOnError) break;
      }
    }

    const scanned = await scanWorkspaceFiles(workspaceDir);
    const overallExitCode = stepResults.some((s) => s.exitCode !== 0) ? 1 : 0;
    res.json({
      exitCode: overallExitCode,
      steps: stepResults,
      files: scanned.files,
      entryFolders: scanned.entryFolders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Workflow execution failed.';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/workspace/:id/archive.zip', async (req: Request, res: Response) => {
  let tmpZipDir = '';
  try {
    const workspaceId = sanitizeWorkspaceId(((req.params.id as string) as string));
    const workspaceDir = getWorkspaceDir(workspaceId);
    tmpZipDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folio-zip-'));
    const zipPath = path.join(tmpZipDir, `${workspaceId}.zip`);

    const pyZipper = `
import os, sys, zipfile
src = sys.argv[1]
dst = sys.argv[2]
skip_dirs = {'.git', 'node_modules', '__pycache__'}
skip_files = {'.folio-design-system.css'}
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            if fname in skip_files:
                continue
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, src)
            zf.write(full, rel)
`;
    const pyScript = path.join(tmpZipDir, 'make_zip.py');
    await fs.promises.writeFile(pyScript, pyZipper, 'utf8');
    const result = await runSandboxedProcess('python3', [pyScript, workspaceDir, zipPath], tmpZipDir, '', 15000);
    if (result.exitCode !== 0 || !fs.existsSync(zipPath)) {
      throw new Error(result.stderr || 'Failed to package workspace zip.');
    }

    const bytes = await fs.promises.readFile(zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${workspaceId}.zip"`);
    res.send(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to create ZIP archive.';
    res.status(400).json({ error: msg });
  } finally {
    if (tmpZipDir) {
      await fs.promises.rm(tmpZipDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

// Serve any workspace folder as a live multi-file web app!
app.get(['/workspace-site/:id', '/workspace-site/:id/*'], async (req: Request, res: Response) => {
  try {
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
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
        const dsTag = `<link rel="stylesheet" href="/workspace-site/${encodeURIComponent(((req.params.id as string) as string))}/__folio_design_system.css" />`;
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
// Server-Side Media Baking & Multi-Clip Stitching (FFmpeg) + Stock GIF Search +
// Workspace AI Assistant + Domain Simulator
// ===========================================================================

function runExecFileAsync(
  bin: string,
  args: string[],
  timeoutMs = 120_000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error((stderr || err.message || 'Command failed').slice(0, 2000)));
          return;
        }
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
      }
    );
  });
}

function resolveFfmpegBin(): string {
  if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  if (fs.existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
  return 'ffmpeg';
}

app.post(
  '/api/media/bake',
  express.json({ limit: '160mb' }),
  async (req: Request, res: Response) => {
    let tmpDir = '';
    try {
      const { fps, width, height, format, frames, audioWavBase64 } = req.body as {
        fps?: number;
        width?: number;
        height?: number;
        format?: 'webm' | 'mp4';
        frames?: string[];
        audioWavBase64?: string;
      };

      if (!Array.isArray(frames) || frames.length === 0) {
        res.status(400).json({ error: 'Provide at least 1 frame to bake.' });
        return;
      }
      if (frames.length > 3000) {
        res.status(400).json({ error: 'Max 3000 expanded frames per bake chunk (use /api/media/stitch for multi-minute timelines).' });
        return;
      }

      const safeFps = Math.max(1, Math.min(60, Math.round(Number(fps) || 24)));
      const outFormat = format === 'mp4' ? 'mp4' : 'webm';
      const safeW = Math.max(16, Math.min(1920, Math.round(Number(width) || 800)));
      const safeH = Math.max(16, Math.min(1080, Math.round(Number(height) || 450)));
      const evenW = safeW % 2 === 0 ? safeW : safeW - 1;
      const evenH = safeH % 2 === 0 ? safeH : safeH - 1;

      tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folio-bake-'));
      for (let i = 0; i < frames.length; i += 1) {
        const raw = typeof frames[i] === 'string' ? frames[i] : '';
        const b64Match = raw.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([\s\S]+)$/i);
        const cleanB64 = b64Match ? b64Match[1] : raw;
        if (!cleanB64) {
          res.status(400).json({ error: `Invalid frame payload at index ${i}.` });
          return;
        }
        const framePath = path.join(tmpDir, `frame_${String(i).padStart(6, '0')}.png`);
        await fs.promises.writeFile(framePath, Buffer.from(cleanB64, 'base64'));
      }

      let hasAudio = false;
      const audioPath = path.join(tmpDir, 'audio.wav');
      if (typeof audioWavBase64 === 'string' && audioWavBase64.trim().length > 0) {
        const cleanAudio = audioWavBase64.replace(/^data:[^;]+;base64,/i, '');
        await fs.promises.writeFile(audioPath, Buffer.from(cleanAudio, 'base64'));
        hasAudio = true;
      }

      const outName = `baked.${outFormat}`;
      const outPath = path.join(tmpDir, outName);
      const ffmpegArgs: string[] = [
        '-y',
        '-framerate',
        String(safeFps),
        '-i',
        path.join(tmpDir, 'frame_%06d.png'),
      ];
      if (hasAudio) {
        ffmpegArgs.push('-i', audioPath);
      }
      ffmpegArgs.push('-vf', `scale=${evenW}:${evenH}:flags=lanczos,format=yuv420p`);

      if (outFormat === 'mp4') {
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-movflags', '+faststart');
        if (hasAudio) {
          ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
        }
      } else {
        ffmpegArgs.push('-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '6', '-b:v', '0', '-crf', '30');
        if (hasAudio) {
          ffmpegArgs.push('-c:a', 'libopus', '-b:a', '96k', '-shortest');
        }
      }
      ffmpegArgs.push(outPath);

      await runExecFileAsync(resolveFfmpegBin(), ffmpegArgs, 180_000);
      const videoBytes = await fs.promises.readFile(outPath);
      res.setHeader('Content-Type', outFormat === 'mp4' ? 'video/mp4' : 'video/webm');
      res.setHeader('Content-Disposition', `attachment; filename="folio-baked.${outFormat}"`);
      res.send(videoBytes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FFmpeg baking failed.';
      res.status(500).json({ error: msg });
    } finally {
      if (tmpDir) {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
);

app.post(
  '/api/media/stitch',
  express.json({ limit: '180mb' }),
  async (req: Request, res: Response) => {
    let tmpDir = '';
    try {
      const { format, clips } = req.body as {
        format?: 'webm' | 'mp4';
        clips?: Array<{ base64?: string; mimeType?: string; repeatCount?: number }>;
      };

      if (!Array.isArray(clips) || clips.length === 0) {
        res.status(400).json({ error: 'Provide at least 1 clip to stitch.' });
        return;
      }
      if (clips.length > 50) {
        res.status(400).json({ error: 'Maximum 50 source clips per stitch request.' });
        return;
      }

      const outFormat = format === 'mp4' ? 'mp4' : 'webm';
      tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folio-stitch-'));
      const concatLines: string[] = [];

      for (let i = 0; i < clips.length; i += 1) {
        const clip = clips[i];
        const rawB64 = typeof clip?.base64 === 'string' ? clip.base64.replace(/^data:[^;]+;base64,/i, '') : '';
        if (!rawB64) {
          res.status(400).json({ error: `Clip ${i + 1} is empty.` });
          return;
        }
        const clipExt = (clip.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
        const clipPath = path.join(tmpDir, `clip_${i}.${clipExt}`);
        await fs.promises.writeFile(clipPath, Buffer.from(rawB64, 'base64'));
        const repeat = Math.max(1, Math.min(200, Math.round(clip.repeatCount || 1)));
        const safeLine = clipPath.replace(/'/g, "'\\''");
        for (let r = 0; r < repeat; r += 1) {
          concatLines.push(`file '${safeLine}'`);
        }
      }

      const concatPath = path.join(tmpDir, 'concat.txt');
      await fs.promises.writeFile(concatPath, concatLines.join('\n'), 'utf8');
      const outPath = path.join(tmpDir, `stitched.${outFormat}`);
      const ffmpeg = resolveFfmpegBin();

      try {
        await runExecFileAsync(
          ffmpeg,
          ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', outPath],
          180_000
        );
      } catch {
        const reencodeArgs =
          outFormat === 'mp4'
            ? ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', outPath]
            : ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '6', '-crf', '31', outPath];
        await runExecFileAsync(ffmpeg, reencodeArgs, 240_000);
      }

      const videoBytes = await fs.promises.readFile(outPath);
      res.setHeader('Content-Type', outFormat === 'mp4' ? 'video/mp4' : 'video/webm');
      res.setHeader('Content-Disposition', `attachment; filename="folio-stitched.${outFormat}"`);
      res.send(videoBytes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FFmpeg clip stitching failed.';
      res.status(500).json({ error: msg });
    } finally {
      if (tmpDir) {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
);

async function searchStockMedia(query: string, rawKind: string, limit: number) {
  const kind = (rawKind || 'all').toLowerCase();
  const safeLimit = Math.min(12, Math.max(1, Math.floor(limit || 6)));
  const icons: Array<{ id: string; svgUrl: string }> = [];
  const images: Array<{ title: string; url: string; thumbUrl: string; license: string }> = [];
  const gifs: Array<{ title: string; url: string; thumbUrl: string; license: string }> = [];

  if (kind === 'all' || kind === 'icons') {
    try {
      const iconRes = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${safeLimit}`
      );
      if (iconRes.ok) {
        const iconData = (await iconRes.json()) as { icons?: string[] };
        for (const iconName of iconData.icons || []) {
          const [prefix, namePart] = iconName.split(':');
          if (prefix && namePart) {
            icons.push({
              id: iconName,
              svgUrl: `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(namePart)}.svg`,
            });
          }
        }
      }
    } catch {
      // keep partial results
    }
  }

  if (kind === 'all' || kind === 'images') {
    try {
      const wikiRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${safeLimit}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=640&format=json`,
        { headers: { 'User-Agent': 'Folio-Studio/1.0' } }
      );
      if (wikiRes.ok) {
        const wikiJson = (await wikiRes.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                title?: string;
                imageinfo?: Array<{
                  url?: string;
                  thumburl?: string;
                  mime?: string;
                  extmetadata?: { LicenseShortName?: { value?: string } };
                }>;
              }
            >;
          };
        };
        for (const p of Object.values(wikiJson.query?.pages || {})) {
          const info = p.imageinfo?.[0];
          if (info?.url) {
            const entry = {
              title: (p.title || '').replace(/^File:/, ''),
              url: info.url,
              thumbUrl: info.thumburl || info.url,
              license: info.extmetadata?.LicenseShortName?.value || 'Wikimedia Commons',
            };
            if ((info.mime || '').includes('gif') || info.url.toLowerCase().endsWith('.gif')) {
              gifs.push(entry);
            } else {
              images.push(entry);
            }
          }
        }
      }
    } catch {
      // keep partial results
    }
  }

  if (kind === 'all' || kind === 'gifs') {
    try {
      const gifRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(`${query} animation gif`)}&gsrlimit=${safeLimit}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=480&format=json`,
        { headers: { 'User-Agent': 'Folio-Studio/1.0' } }
      );
      if (gifRes.ok) {
        const gifJson = (await gifRes.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                title?: string;
                imageinfo?: Array<{
                  url?: string;
                  thumburl?: string;
                  mime?: string;
                  extmetadata?: { LicenseShortName?: { value?: string } };
                }>;
              }
            >;
          };
        };
        for (const p of Object.values(gifJson.query?.pages || {})) {
          const info = p.imageinfo?.[0];
          if (info?.url && ((info.mime || '').includes('gif') || info.url.toLowerCase().endsWith('.gif') || (p.title || '').toLowerCase().includes('.gif'))) {
            if (!gifs.some((g) => g.url === info.url)) {
              gifs.push({
                title: (p.title || '').replace(/^File:/, ''),
                url: info.url,
                thumbUrl: info.thumburl || info.url,
                license: info.extmetadata?.LicenseShortName?.value || 'Wikimedia Commons GIF',
              });
            }
          }
        }
      }
    } catch {
      // keep partial results
    }
  }

  return { ok: true, query, icons, images, gifs };
}

app.get('/api/stock/search', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const kind = typeof req.query.kind === 'string' ? req.query.kind.trim() : 'all';
  const limit = Number(req.query.limit) || 6;
  if (!q) {
    res.status(400).json({ error: 'Query parameter q is required.' });
    return;
  }
  const result = await searchStockMedia(q, kind, limit);
  res.json(result);
});

app.post('/api/workspace/:id/ai-run', async (req: Request, res: Response) => {
  const startMs = Date.now();
  try {
    const workspaceDir = getWorkspaceDir(((req.params.id as string) as string));
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt is required for Workspace AI.' });
      return;
    }

    const scanned = await scanWorkspaceFiles(workspaceDir);
    const contextSnippets: string[] = [];
    let totalChars = 0;
    for (const f of scanned.files.slice(0, 15)) {
      if (!f.isText || totalChars > 24000) continue;
      try {
        const full = resolveWorkspaceFilePath(workspaceDir, f.path);
        const text = await fs.promises.readFile(full, 'utf8');
        const excerpt = text.slice(0, 3500);
        totalChars += excerpt.length;
        contextSnippets.push(`--- FILE: ${f.path} ---\n${excerpt}`);
      } catch {
        // skip unreadable file
      }
    }

    const ai = createGeminiClient();
    const systemPrompt = [
      'You are the Folio Workspace AI Engineer.',
      'Return ONLY a strict JSON object matching:',
      '{ "summary": "concise description of changes", "writes": [{ "path": "relative/file.ext", "content": "full file text" }] }',
      'Paths must be relative inside the workspace (no .., no leading /). Emit complete working files.',
    ].join('\n');

    const userPrompt = `WORKSPACE FILES (${scanned.files.length} total):\n${scanned.files
      .slice(0, 40)
      .map((f) => `- ${f.path} (${f.size}B)`)
      .join('\n')}\n\nEXCERPTS:\n${contextSnippets.join('\n\n') || '(empty workspace)'}\n\nTASK:\n${prompt.trim()}`;

    const result = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const rawText = (result.text || '').trim();
    const parsed = JSON.parse(rawText) as {
      summary?: string;
      writes?: Array<{ path?: string; content?: string }>;
    };

    const writtenPaths: string[] = [];
    if (Array.isArray(parsed.writes)) {
      for (const item of parsed.writes.slice(0, 20)) {
        if (!item?.path || typeof item.content !== 'string') continue;
        const target = resolveWorkspaceFilePath(workspaceDir, item.path);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, item.content, 'utf8');
        writtenPaths.push(item.path.replace(/^\/+/, ''));
      }
    }

    const updatedScan = await scanWorkspaceFiles(workspaceDir);
    res.json({
      ok: true,
      summary: parsed.summary || `Updated ${writtenPaths.length} file(s).`,
      writtenPaths,
      files: updatedScan.files,
      entryFolders: updatedScan.entryFolders,
      durationMs: Date.now() - startMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Workspace AI task failed.';
    res.status(400).json({ error: msg, durationMs: Date.now() - startMs });
  }
});

interface SimulatedDnsRecord {
  type: 'A' | 'CNAME' | 'TXT' | 'MX';
  host: string;
  value: string;
  ttl?: number;
}

interface SimulatedDomainRecord {
  domain: string;
  mode: 'workspace' | 'html' | 'proxy';
  registrar?: 'name.com' | 'local';
  sslEnabled?: boolean;
  dnsRecords?: SimulatedDnsRecord[];
  workspaceId?: string;
  entryFolder?: string;
  html?: string;
  targetUrl?: string;
  updatedAt: number;
}

const DOMAINS_PATH = path.join(FOLIO_DATA_DIR, 'domains.json');

function loadDomainsMap(): Record<string, SimulatedDomainRecord> {
  try {
    if (!fs.existsSync(DOMAINS_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(DOMAINS_PATH, 'utf8')) as Record<string, SimulatedDomainRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveDomainsMap(map: Record<string, SimulatedDomainRecord>) {
  fs.mkdirSync(FOLIO_DATA_DIR, { recursive: true });
  fs.writeFileSync(DOMAINS_PATH, JSON.stringify(map, null, 2), 'utf8');
}

function validateDomainName(raw: string): string {
  const clean = (raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (
    !clean ||
    clean.length > 128 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(clean)
  ) {
    throw new Error('Enter a valid simulated domain (e.g. demo.folio.local or app.example.dev).');
  }
  return clean;
}

app.get('/api/domains', (_req: Request, res: Response) => {
  const map = loadDomainsMap();
  const domains = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ domains });
});

app.post('/api/domains', async (req: Request, res: Response) => {
  try {
    const { domain: rawDomain, mode, workspaceId, entryFolder, html, targetUrl } = req.body as {
      domain?: string;
      mode?: 'workspace' | 'html' | 'proxy';
      workspaceId?: string;
      entryFolder?: string;
      html?: string;
      targetUrl?: string;
    };

    const domain = validateDomainName(rawDomain || '');
    const resolvedMode: SimulatedDomainRecord['mode'] =
      mode === 'html' || mode === 'proxy' ? mode : 'workspace';

    const record: SimulatedDomainRecord = {
      domain,
      mode: resolvedMode,
      updatedAt: Date.now(),
    };

    if (resolvedMode === 'workspace') {
      record.workspaceId = sanitizeWorkspaceId(workspaceId || 'folio-sandbox-1');
      if (entryFolder && typeof entryFolder === 'string') {
        record.entryFolder = entryFolder.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
      }
    } else if (resolvedMode === 'html') {
      if (!html || !html.trim()) {
        res.status(400).json({ error: 'HTML content is required for HTML domain mode.' });
        return;
      }
      record.html = html.slice(0, 512_000);
    } else if (resolvedMode === 'proxy') {
      const validated = await validatePublicWebUrl(targetUrl || '');
      record.targetUrl = validated.href;
    }

    const map = loadDomainsMap();
    map[domain] = record;
    saveDomainsMap(map);
    res.json({
      domain: record,
      previewUrl: `/domain-preview/${encodeURIComponent(domain)}/`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to save simulated domain.';
    res.status(400).json({ error: msg });
  }
});

const NAMECOM_TLD_PRICING: Array<{
  tld: string;
  priceUsd: number;
  renewalUsd: number;
  premium?: boolean;
}> = [
  { tld: '.com', priceUsd: 10.99, renewalUsd: 15.99 },
  { tld: '.ai', priceUsd: 69.0, renewalUsd: 79.0, premium: true },
  { tld: '.dev', priceUsd: 14.99, renewalUsd: 18.99 },
  { tld: '.io', priceUsd: 39.99, renewalUsd: 49.99 },
  { tld: '.app', priceUsd: 16.99, renewalUsd: 19.99 },
  { tld: '.xyz', priceUsd: 2.99, renewalUsd: 14.99 },
  { tld: '.org', priceUsd: 9.99, renewalUsd: 16.99 },
];

function searchNameComDomains(query: string) {
  const cleanRaw = (query || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0];
  const baseLabel = cleanRaw
    .replace(/\.[a-z0-9-]+$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '') || 'folio-studio';
  const map = loadDomainsMap();
  return NAMECOM_TLD_PRICING.map((item) => {
    const domain = `${baseLabel}${item.tld}`;
    const existing = map[domain];
    return {
      domain,
      tld: item.tld,
      available: !existing,
      priceUsd: item.priceUsd,
      renewalUsd: item.renewalUsd,
      premium: Boolean(item.premium) || baseLabel.length <= 4,
      ...(existing ? { previewUrl: `/domain-preview/${encodeURIComponent(domain)}/` } : {}),
    };
  });
}

app.get('/api/domains/namecom/search', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : 'folio-studio';
  res.json({
    registrar: 'name.com',
    results: searchNameComDomains(q),
  });
});

app.post('/api/domains/namecom/register', async (req: Request, res: Response) => {
  try {
    const {
      domain: rawDomain,
      mode,
      workspaceId,
      entryFolder,
      html,
      targetUrl,
      sslEnabled,
      dnsRecords,
    } = req.body as {
      domain?: string;
      mode?: 'workspace' | 'html' | 'proxy';
      workspaceId?: string;
      entryFolder?: string;
      html?: string;
      targetUrl?: string;
      sslEnabled?: boolean;
      dnsRecords?: SimulatedDnsRecord[];
    };

    const domain = validateDomainName(rawDomain || '');
    const resolvedMode: SimulatedDomainRecord['mode'] =
      mode === 'workspace' || mode === 'proxy' || mode === 'html' ? mode : 'html';

    const sanitizedDns: SimulatedDnsRecord[] =
      Array.isArray(dnsRecords) && dnsRecords.length > 0
        ? dnsRecords
            .filter(
              (r) =>
                r &&
                (r.type === 'A' || r.type === 'CNAME' || r.type === 'TXT' || r.type === 'MX') &&
                typeof r.host === 'string' &&
                typeof r.value === 'string'
            )
            .slice(0, 12)
        : [
            { type: 'A', host: '@', value: '104.21.48.192', ttl: 300 },
            { type: 'CNAME', host: 'www', value: domain, ttl: 300 },
            { type: 'TXT', host: '@', value: `v=folio-namecom site=${domain}`, ttl: 300 },
          ];

    const record: SimulatedDomainRecord = {
      domain,
      mode: resolvedMode,
      registrar: 'name.com',
      sslEnabled: sslEnabled !== false,
      dnsRecords: sanitizedDns,
      updatedAt: Date.now(),
    };

    if (resolvedMode === 'workspace') {
      record.workspaceId = sanitizeWorkspaceId(workspaceId || 'folio-sandbox-1');
      if (entryFolder && typeof entryFolder === 'string') {
        record.entryFolder = entryFolder.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
      }
    } else if (resolvedMode === 'html') {
      record.html =
        html && html.trim()
          ? html.slice(0, 512_000)
          : `<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#090d16;color:#f8fafc;"><h1>${domain}</h1><p>Registered via Name.com Domain Simulator (SSL ${record.sslEnabled ? 'Enabled' : 'Off'}).</p></body></html>`;
    } else if (resolvedMode === 'proxy') {
      const validated = await validatePublicWebUrl(targetUrl || '');
      record.targetUrl = validated.href;
    }

    const map = loadDomainsMap();
    map[domain] = record;
    saveDomainsMap(map);

    res.json({
      ok: true,
      registrar: 'name.com',
      domain: record,
      previewUrl: `/domain-preview/${encodeURIComponent(domain)}/`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to register domain on Name.com sim.';
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/domains/:domain', (req: Request, res: Response) => {
  try {
    const domain = validateDomainName(((req.params.domain as string) as string));
    const map = loadDomainsMap();
    delete map[domain];
    saveDomainsMap(map);
    res.json({ ok: true, domain });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid domain.';
    res.status(400).json({ error: msg });
  }
});

app.get(['/domain-preview/:domain', '/domain-preview/:domain/*'], async (req: Request, res: Response) => {
  try {
    const domain = validateDomainName(((req.params.domain as string) as string));
    const map = loadDomainsMap();
    const record = map[domain];
    if (!record) {
      res
        .status(404)
        .type('text/html')
        .send(buildRenderErrorHtml(`https://${domain}`, 'This simulated domain is not mapped yet. Bind it in the Domain Sim panel.'));
      return;
    }

    if (!req.path.endsWith('/') && !(req.params as Record<string, string>)[0]) {
      res.redirect(302, `${req.path}/`);
      return;
    }

    if (record.mode === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(record.html || '');
      return;
    }

    if (record.mode === 'proxy' && record.targetUrl) {
      const targetUrl = await validatePublicWebUrl(record.targetUrl);
      const upstream = await fetchUpstreamWebPage(targetUrl);
      const text = await upstream.text();
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(buildRenderableHtml(text, upstream.url || targetUrl.href));
      return;
    }

    const wsId = sanitizeWorkspaceId(record.workspaceId || 'folio-sandbox-1');
    const workspaceDir = getWorkspaceDir(wsId);
    const wildcard = ((req.params as Record<string, string>)[0] || '').replace(/^\/+/, '');
    const prefix = record.entryFolder ? `${record.entryFolder}/` : '';
    const relPath = wildcard || `${prefix}index.html`;
    let targetPath = resolveWorkspaceFilePath(workspaceDir, relPath);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    }
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      res
        .status(404)
        .type('text/html')
        .send(buildRenderErrorHtml(`https://${domain}/${relPath}`, `File "${relPath}" was not found in workspace "${wsId}".`));
      return;
    }
    res.setHeader('Content-Type', detectMimeType(targetPath));
    res.setHeader('Cache-Control', 'no-store');
    res.send(await fs.promises.readFile(targetPath));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Domain preview failed.';
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

  let tmpCloneDir = '';
  try {
    const workspaceDir = getWorkspaceDir(workspaceId || 'folio-sandbox-1');
    const parsed = parseGitHubRepoSpec(rawRepo, reqBranch, reqSubpath);
    if (!/^[a-zA-Z0-9_.-]+$/.test(parsed.owner) || !/^[a-zA-Z0-9_.-]+$/.test(parsed.repo)) {
      throw new Error('Invalid GitHub owner or repository name.');
    }
    if (parsed.branch && parsed.branch.startsWith('-')) {
      throw new Error('Invalid branch name.');
    }

    const token = getGitHubTokenForRequest(req);

    // Fast path for public repositories (uses 0 REST API calls, avoids 60/hr unauthenticated limit)
    if (!token) {
      tmpCloneDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folio-gh-clone-'));
      const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
      const cloneArgs = ['clone', '--depth', '1'];
      if (parsed.branch) {
        cloneArgs.push('--branch', parsed.branch);
      }
      cloneArgs.push(repoUrl, tmpCloneDir);

      const cloneRes = await new Promise<{ exitCode: number; stderr: string }>((resolve) => {
        const child = spawn('git', cloneArgs, {
          env: {
            PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            GIT_TERMINAL_PROMPT: '0',
            HOME: tmpCloneDir,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
        child.stderr.on('data', (d: Buffer) => {
          stderr += d.toString('utf8');
        });
        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({ exitCode: 1, stderr: err.message });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ exitCode: code ?? 0, stderr });
        });
      });

      if (cloneRes.exitCode !== 0) {
        throw new Error(
          cloneRes.stderr.trim() ||
            `Could not clone public repo ${parsed.owner}/${parsed.repo}. If it is private, click Connect GitHub first.`
        );
      }

      // Detect actual branch checked out
      const headRef = await new Promise<string>((resolve) => {
        const child = spawn('git', ['-C', tmpCloneDir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        let out = '';
        child.stdout.on('data', (d: Buffer) => {
          out += d.toString('utf8');
        });
        child.on('close', () => resolve(out.trim() || parsed.branch || 'main'));
        child.on('error', () => resolve(parsed.branch || 'main'));
      });

      const sourceRoot = parsed.subpath
        ? resolveWorkspaceFilePath(tmpCloneDir, parsed.subpath)
        : tmpCloneDir;
      if (!fs.existsSync(sourceRoot)) {
        throw new Error(`Subfolder "${parsed.subpath}" not found in ${parsed.owner}/${parsed.repo}.`);
      }

      const collected: Array<{ rel: string; full: string }> = [];
      async function collectFiles(dir: string, prefix: string) {
        if (collected.length >= 80) return;
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (collected.length >= 80) break;
          if (
            entry.name === '.git' ||
            entry.name === 'node_modules' ||
            entry.name === '__pycache__'
          ) {
            continue;
          }
          const full = path.join(dir, entry.name);
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await collectFiles(full, rel);
          } else if (entry.isFile()) {
            const st = await fs.promises.stat(full);
            if (st.size <= 512 * 1024) {
              collected.push({ rel, full });
            }
          }
        }
      }
      await collectFiles(sourceRoot, '');

      if (collected.length === 0) {
        throw new Error('No importable files found at that repository path.');
      }

      const existing = await fs.promises.readdir(workspaceDir);
      for (const name of existing) {
        if (name === '.folio-design-system.css') continue;
        await fs.promises.rm(path.join(workspaceDir, name), { recursive: true, force: true });
      }

      let importedCount = 0;
      for (const item of collected) {
        const dest = resolveWorkspaceFilePath(workspaceDir, item.rel);
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        await fs.promises.copyFile(item.full, dest);
        importedCount += 1;
      }

      const scanned = await scanWorkspaceFiles(workspaceDir);
      res.json({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: headRef,
        importedCount,
        files: scanned.files,
        entryFolders: scanned.entryFolders,
      });
      return;
    }

    // Authenticated path via GitHub REST API (supports private & public repos)
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Folio-Studio',
      Authorization: `Bearer ${token}`,
    };

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
      .slice(0, 80);

    if (candidateBlobs.length === 0) {
      throw new Error('No importable files found at that repository path.');
    }

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
  } finally {
    if (tmpCloneDir) {
      await fs.promises.rm(tmpCloneDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

app.post('/api/github/repos/create', async (req: Request, res: Response) => {
  const token = getGitHubTokenForRequest(req);
  if (!token) {
    res.status(401).json({
      error: 'Connect your GitHub account first to create a repository.',
    });
    return;
  }

  const { name, description, isPrivate } = req.body as {
    name?: string;
    description?: string;
    isPrivate?: boolean;
  };
  const cleanName = (name || '').trim().replace(/\s+/g, '-');
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(cleanName)) {
    res.status(400).json({ error: 'Enter a valid repository name (letters, numbers, ".", "_", "-").' });
    return;
  }

  try {
    const ghRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Folio-Studio',
      },
      body: JSON.stringify({
        name: cleanName,
        description: (description || 'Created from Folio Sandbox').trim(),
        private: Boolean(isPrivate),
        auto_init: true,
      }),
    });
    const data = (await ghRes.json()) as {
      message?: string;
      id?: number;
      full_name?: string;
      name?: string;
      private?: boolean;
      default_branch?: string;
      description?: string | null;
      html_url?: string;
    };
    if (!ghRes.ok) {
      throw new Error(data.message || `GitHub repo creation failed (${ghRes.status})`);
    }
    res.json({ repo: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to create GitHub repository.';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/github/push', async (req: Request, res: Response) => {
  const token = getGitHubTokenForRequest(req);
  if (!token) {
    res.status(401).json({
      error: 'Connect your GitHub account first to commit and push files.',
    });
    return;
  }

  const {
    repo: rawRepo,
    branch: reqBranch,
    subpath: reqSubpath,
    commitMessage,
    workspaceId,
  } = req.body as {
    repo?: string;
    branch?: string;
    subpath?: string;
    commitMessage?: string;
    workspaceId?: string;
  };

  if (!rawRepo || !rawRepo.trim()) {
    res.status(400).json({ error: 'Target GitHub repository ("owner/repo") is required.' });
    return;
  }

  try {
    const workspaceDir = getWorkspaceDir(workspaceId || 'folio-sandbox-1');
    const scanned = await scanWorkspaceFiles(workspaceDir);
    const filesToPush = scanned.files.filter((f) => f.size <= 1024 * 1024).slice(0, 100);
    if (filesToPush.length === 0) {
      throw new Error('Workspace folder is empty—create or build files before pushing.');
    }

    const parsed = parseGitHubRepoSpec(rawRepo, reqBranch, reqSubpath);
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Folio-Studio',
    };
    const repoBase = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;

    // 1. Lookup repo metadata
    const repoRes = await fetch(repoBase, { headers });
    if (!repoRes.ok) {
      const errTxt = await repoRes.text();
      throw new Error(`Repository lookup failed (${repoRes.status}): ${errTxt}`);
    }
    const repoMeta = (await repoRes.json()) as {
      default_branch?: string;
      html_url?: string;
    };
    const defaultBranch = repoMeta.default_branch || 'main';
    const targetBranch = (parsed.branch || defaultBranch).trim();

    // 2. Locate base commit/tree (or bootstrap if repo is completely empty)
    let parentCommitSha: string | null = null;
    let baseTreeSha: string | null = null;
    let refExists = false;

    const refRes = await fetch(`${repoBase}/git/ref/heads/${encodeURIComponent(targetBranch)}`, { headers });
    if (refRes.ok) {
      const refJson = (await refRes.json()) as { object?: { sha?: string } };
      parentCommitSha = refJson.object?.sha || null;
      refExists = Boolean(parentCommitSha);
    } else if (targetBranch !== defaultBranch) {
      const defRefRes = await fetch(`${repoBase}/git/ref/heads/${encodeURIComponent(defaultBranch)}`, { headers });
      if (defRefRes.ok) {
        const defJson = (await defRefRes.json()) as { object?: { sha?: string } };
        parentCommitSha = defJson.object?.sha || null;
      }
    }

    if (!parentCommitSha) {
      // Empty repo with 0 commits: create README.md via Contents API so Git Data API has a root commit
      const initRes = await fetch(`${repoBase}/contents/README.md`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: 'Initialize repository from Folio Sandbox',
          content: Buffer.from(`# ${parsed.repo}\n`, 'utf8').toString('base64'),
          branch: targetBranch,
        }),
      });
      if (!initRes.ok) {
        const initErr = await initRes.text();
        throw new Error(`Could not initialize empty repository (${initRes.status}): ${initErr}`);
      }
      const initJson = (await initRes.json()) as { commit?: { sha?: string } };
      parentCommitSha = initJson.commit?.sha || null;
      refExists = true;
    }

    if (parentCommitSha) {
      const commitRes = await fetch(`${repoBase}/git/commits/${encodeURIComponent(parentCommitSha)}`, { headers });
      if (commitRes.ok) {
        const commitJson = (await commitRes.json()) as { tree?: { sha?: string } };
        baseTreeSha = commitJson.tree?.sha || null;
      }
    }

    // 3. Create blobs & build tree entries
    const prefix = parsed.subpath ? `${parsed.subpath.replace(/^\/+|\/+$/g, '')}/` : '';
    const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];

    for (const file of filesToPush) {
      const fullPath = resolveWorkspaceFilePath(workspaceDir, file.path);
      const rawBytes = await fs.promises.readFile(fullPath);
      const blobRes = await fetch(`${repoBase}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: rawBytes.toString('base64'),
          encoding: 'base64',
        }),
      });
      if (!blobRes.ok) {
        const blobErr = await blobRes.text();
        throw new Error(`Failed uploading "${file.path}": ${blobErr}`);
      }
      const blobJson = (await blobRes.json()) as { sha: string };
      treeEntries.push({
        path: `${prefix}${file.path}`,
        mode: '100644',
        type: 'blob',
        sha: blobJson.sha,
      });
    }

    // 4. Create Git tree
    const treeRes = await fetch(`${repoBase}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
        tree: treeEntries,
      }),
    });
    if (!treeRes.ok) {
      const treeErr = await treeRes.text();
      throw new Error(`Git tree creation failed: ${treeErr}`);
    }
    const treeJson = (await treeRes.json()) as { sha: string };

    // 5. Create Commit
    const msgText = (commitMessage || `Update from Folio project "${workspaceId || 'folio-sandbox-1'}"`).trim();
    const newCommitRes = await fetch(`${repoBase}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: msgText,
        tree: treeJson.sha,
        parents: parentCommitSha ? [parentCommitSha] : [],
      }),
    });
    if (!newCommitRes.ok) {
      const commitErr = await newCommitRes.text();
      throw new Error(`Git commit failed: ${commitErr}`);
    }
    const newCommitJson = (await newCommitRes.json()) as { sha: string; html_url?: string };

    // 6. Update or create branch ref
    if (refExists) {
      const patchRes = await fetch(`${repoBase}/git/refs/heads/${encodeURIComponent(targetBranch)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: newCommitJson.sha, force: false }),
      });
      if (!patchRes.ok) {
        const patchErr = await patchRes.text();
        throw new Error(`Branch push failed: ${patchErr}`);
      }
    } else {
      const createRefRes = await fetch(`${repoBase}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha: newCommitJson.sha,
        }),
      });
      if (!createRefRes.ok) {
        const refErr = await createRefRes.text();
        throw new Error(`Branch creation failed: ${refErr}`);
      }
    }

    const repoUrl = repoMeta.html_url || `https://github.com/${parsed.owner}/${parsed.repo}`;
    res.json({
      owner: parsed.owner,
      repo: parsed.repo,
      branch: targetBranch,
      commitSha: newCommitJson.sha,
      commitUrl: newCommitJson.html_url || `${repoUrl}/commit/${newCommitJson.sha}`,
      repoUrl,
      pushedCount: treeEntries.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GitHub push failed.';
    res.status(400).json({ error: msg });
  }
});

// ===========================================================================
// Live Chat Tooling Helpers (GitHub + Workspace Awareness & Direct Execution)
// ===========================================================================

interface ChatGitHubUserSummary {
  login: string;
  name?: string | null;
}

const chatGitHubUserCache = new Map<
  string,
  { summary: ChatGitHubUserSummary | null; expiresAt: number }
>();

async function resolveChatGitHubUser(
  token: string | null
): Promise<ChatGitHubUserSummary | null> {
  if (!token) return null;
  const cacheKey = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
  const cached = chatGitHubUserCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.summary;
  }

  try {
    const ghRes = await fetch('https://api.github.com/user', {
      signal: AbortSignal.timeout(2500),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Folio-Studio',
      },
    });
    if (!ghRes.ok) {
      chatGitHubUserCache.set(cacheKey, { summary: null, expiresAt: Date.now() + 30_000 });
      return null;
    }
    const data = (await ghRes.json()) as { login?: string; name?: string | null };
    const summary = data.login ? { login: data.login, name: data.name ?? null } : null;
    chatGitHubUserCache.set(cacheKey, { summary, expiresAt: Date.now() + 120_000 });
    return summary;
  } catch {
    return null;
  }
}

function getChatToolDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: 'github_list_repos',
      description:
        'List repositories directly from GitHub for the connected user (or a specified public GitHub username). Call this immediately whenever the user asks about their repos or public repositories.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          visibility: {
            type: Type.STRING,
            description: 'Optional filter: "all", "public", or "private". Defaults to "all".',
          },
          username: {
            type: Type.STRING,
            description:
              'Optional GitHub username to list public repos for. Omit when listing the currently connected account repositories.',
          },
        },
      },
    },
    {
      name: 'github_list_files',
      description: 'List files inside a GitHub repository (public or accessible private repo).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          repo: {
            type: Type.STRING,
            description: 'Repository as "owner/repo" or full https://github.com/owner/repo URL.',
          },
          branch: {
            type: Type.STRING,
            description: 'Optional branch name. Defaults to the repository default branch.',
          },
          subpath: {
            type: Type.STRING,
            description: 'Optional folder path inside the repository to filter results.',
          },
        },
        required: ['repo'],
      },
    },
    {
      name: 'github_read_file',
      description: 'Read the text contents of a specific file from a GitHub repository.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          repo: {
            type: Type.STRING,
            description: 'Repository as "owner/repo" or full GitHub URL.',
          },
          path: {
            type: Type.STRING,
            description: 'File path inside the repository (e.g. "README.md" or "src/index.ts").',
          },
          branch: {
            type: Type.STRING,
            description: 'Optional branch name.',
          },
        },
        required: ['repo', 'path'],
      },
    },
    {
      name: 'github_import_repo',
      description:
        'Clone or import files from a GitHub repository into a Folio local project workspace folder.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          repo: {
            type: Type.STRING,
            description: 'Repository as "owner/repo" or full GitHub URL.',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Target local workspace ID. Omit to use the active workspace.',
          },
          branch: {
            type: Type.STRING,
            description: 'Optional branch name.',
          },
          subpath: {
            type: Type.STRING,
            description: 'Optional subfolder inside the repository to import.',
          },
        },
        required: ['repo'],
      },
    },
    {
      name: 'github_create_repo',
      description:
        'Create a new repository on the connected GitHub account (requires an active GitHub connection).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Repository name (letters, numbers, ".", "_", "-").',
          },
          description: {
            type: Type.STRING,
            description: 'Optional repository description.',
          },
          isPrivate: {
            type: Type.BOOLEAN,
            description: 'Whether the new repository should be private. Defaults to false (public).',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'github_push_workspace',
      description:
        'Commit and push all files from a local Folio project workspace directly to a GitHub repository.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          repo: {
            type: Type.STRING,
            description: 'Target repository as "owner/repo" or full GitHub URL.',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Source local workspace ID. Omit to use the active workspace.',
          },
          branch: {
            type: Type.STRING,
            description: 'Optional target branch name. Defaults to the repo default branch.',
          },
          subpath: {
            type: Type.STRING,
            description: 'Optional subfolder path inside the target repository.',
          },
          commitMessage: {
            type: Type.STRING,
            description: 'Optional Git commit message.',
          },
        },
        required: ['repo'],
      },
    },
    {
      name: 'github_cli',
      description:
        'Execute a GitHub CLI (gh) command cleanly in the sandbox (e.g. ["repo", "view", "owner/repo"], ["issue", "list", "-R", "owner/repo"], ["pr", "list", "-R", "owner/repo"], ["run", "list", "-R", "owner/repo"], ["release", "list", "-R", "owner/repo"]). Use immediately without asking for read-only inspections.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          args: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Arguments array passed to "gh" (do not include leading "gh").',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional local workspace ID for working directory.',
          },
        },
        required: ['args'],
      },
    },
    {
      name: 'workspace_list',
      description:
        'List all local Folio project workspaces and show the files inside the active or specified workspace.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID to inspect. Defaults to active workspace.',
          },
        },
      },
    },
    {
      name: 'workspace_read_file',
      description:
        'Read a file (or a byte/character slice of up to 200 MB files) from the local Folio project workspace. Supports startOffset and maxChars for token-budgeted chunk inspection.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description: 'Relative file path inside the workspace.',
          },
          startOffset: {
            type: Type.INTEGER,
            description: 'Optional byte offset to start reading from (default 0).',
          },
          maxChars: {
            type: Type.INTEGER,
            description: 'Optional maximum bytes/chars to read (default 32000, max 64000).',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID. Defaults to active workspace.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'workspace_write_file',
      description: 'Create or update a file inside the local Folio project workspace.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description: 'Relative file path inside the workspace.',
          },
          content: {
            type: Type.STRING,
            description: 'Full UTF-8 text contents to write.',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID. Defaults to active workspace.',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'workspace_run_script',
      description:
        'Execute a Python 3, Node.js/TypeScript, or Bash script inside the local Folio project workspace.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          filePath: {
            type: Type.STRING,
            description: 'Optional existing workspace script path to execute (or save to).',
          },
          code: {
            type: Type.STRING,
            description: 'Optional inline script code to run (or write to filePath first).',
          },
          language: {
            type: Type.STRING,
            description: 'Script runtime: "python", "javascript", "typescript", or "bash".',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID. Defaults to active workspace.',
          },
        },
      },
    },
    {
      name: 'stock_media_search',
      description:
        'Search public stock SVG icons (Iconify), Wikimedia Commons images/diagrams, and animated GIFs without requiring API keys.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'Search keywords (e.g. "solar system", "dna helix", "clock gear").',
          },
          kind: {
            type: Type.STRING,
            description: '"all" | "icons" | "images" | "gifs" (defaults to "all").',
          },
          limit: {
            type: Type.INTEGER,
            description: 'Maximum results per source (default 6, max 12).',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'blender_cli',
      description:
        'Run headless Blender 3.4.1 CLI inside the active workspace with a Python bpy script (blender -b -noaudio --python <script>) to generate .glb, .obj, or rendered .png assets.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          pythonCode: {
            type: Type.STRING,
            description: 'Blender bpy Python script source to execute headlessly inside the workspace.',
          },
          scriptPath: {
            type: Type.STRING,
            description: 'Optional workspace path for the script (defaults to "blender_script.py").',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID. Defaults to active workspace.',
          },
        },
        required: ['pythonCode'],
      },
    },
    {
      name: 'validate_creative_code',
      description:
        'Validate structured JSON creative specs ("evo", "stopmotion", "pixelart", "liquidmotion", "liquiddrop", "pixelmotion", "motiondrop", "bbmodel", "chart", "quiz") for syntax, dimensions (up to 512x512 for pixelart, up to 216000 frames @ 60fps for stopmotion), and schema compliance before final output.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          kind: {
            type: Type.STRING,
            description: '"evo" | "stopmotion" | "pixelart" | "liquidmotion" | "liquiddrop" | "pixelmotion" | "motiondrop" | "bbmodel" | "chart" | "quiz"',
          },
          code: {
            type: Type.STRING,
            description: 'Raw JSON string to validate.',
          },
        },
        required: ['kind', 'code'],
      },
    },
    {
      name: 'namecom_domain_sim',
      description:
        'Interact with the Folio https://name.com Domain Registrar Simulator: search domain TLD availability/pricing ("search"), register a domain with DNS records & SSL ("register"), or list active domains ("list").',
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            description: '"search" | "register" | "list"',
          },
          query: {
            type: Type.STRING,
            description: 'Keyword or label when action="search".',
          },
          domain: {
            type: Type.STRING,
            description: 'Full domain name when action="register" (e.g. "foliozero.ai").',
          },
          mode: {
            type: Type.STRING,
            description: '"workspace" | "html" | "proxy" (for register).',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Workspace ID if mode="workspace".',
          },
          html: {
            type: Type.STRING,
            description: 'Optional HTML document when mode="html".',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'godot_cli',
      description:
        'Execute Godot 4.3 CLI in headless mode: check engine version, inspect project, create project, generate export presets (Linux, Windows, macOS, Web, Android, iOS), or run headless test scripts.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            description: '"version" | "init_project" | "export_presets" | "build" | "run_script"',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional target workspace ID.',
          },
          scriptPath: {
            type: Type.STRING,
            description: 'Relative path to GDScript or test script.',
          },
          platform: {
            type: Type.STRING,
            description: '"linux" | "windows" | "macos" | "web" | "android" | "ios"',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'cmake_build',
      description:
        'Configure and build native C/C++ or Windows/MSVC cross-compiled binaries using CMake, Ninja, Clang, and MinGW-w64.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID.',
          },
          sourceDir: {
            type: Type.STRING,
            description: 'Source directory containing CMakeLists.txt (defaults to ".").',
          },
          buildDir: {
            type: Type.STRING,
            description: 'Build directory (defaults to "build").',
          },
          targetPlatform: {
            type: Type.STRING,
            description: '"native" (Clang Linux) or "msvc-windows" (cross-compile for Windows x64).',
          },
          target: {
            type: Type.STRING,
            description: 'Optional specific build target name.',
          },
        },
      },
    },
    {
      name: 'kotlin_compile',
      description:
        'Compile Kotlin source code to runnable JAR bytecode using kotlinc compiler (Kotlin 2.0.21 on JRE 21).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID.',
          },
          sourceFile: {
            type: Type.STRING,
            description: 'Relative path to Kotlin source file (e.g. "Main.kt").',
          },
          outputJar: {
            type: Type.STRING,
            description: 'Output jar name (defaults to "app.jar").',
          },
          includeRuntime: {
            type: Type.BOOLEAN,
            description: 'Include Kotlin runtime in the jar (defaults to true).',
          },
          runAfterBuild: {
            type: Type.BOOLEAN,
            description: 'Execute the jar with Java after successful compilation.',
          },
        },
        required: ['sourceFile'],
      },
    },
    {
      name: 'mod_scaffold',
      description:
        'Scaffold a complete Mod Suite inside a dedicated workspace folder with CLI, Mod Loader manifest, SDK, Docs, Object IDs JSON + SQLite database, EVO Engine/Blender 3D assets, Pixel/Rewind graphics, animations, CI/CD workflow, and server.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          modName: {
            type: Type.STRING,
            description: 'Name of the mod (e.g. "CosmicRealmMod").',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Target workspace ID.',
          },
          gameTarget: {
            type: Type.STRING,
            description: 'Target engine/game (e.g. "Folio Sandbox", "Godot 4", "Minecraft", "Generic").',
          },
          category: {
            type: Type.STRING,
            description: '"gameplay" | "graphics" | "total_conversion" | "utility"',
          },
          includeSqlite: {
            type: Type.BOOLEAN,
            description: 'Initialize a real SQLite object/item database with sqlite3 (defaults to true).',
          },
        },
        required: ['modName'],
      },
    },
    {
      name: 'reverse_engineer',
      description:
        'Safely inspect, disassemble, and extract source structures, chunks, symbols, strings, and metadata from complex or baked files (.glb, .zip, .jar, .apk, .pck, .png, ELF, PE, HTML/JS bundles).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          workspaceId: {
            type: Type.STRING,
            description: 'Workspace ID where the file is stored.',
          },
          filePath: {
            type: Type.STRING,
            description: 'Relative path to the baked file in workspace.',
          },
          action: {
            type: Type.STRING,
            description: '"inspect" | "extract" | "disassemble" | "symbols" | "strings"',
          },
          extractToDir: {
            type: Type.STRING,
            description: 'Optional subfolder to place extracted assets into.',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'workspace_fallback_runner',
      description:
        'Run a heavy, complex, or binary-dependent task in an isolated workspace folder when standard execution requires space, binaries, or isolated repo workspace.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          workspaceId: {
            type: Type.STRING,
            description: 'Workspace ID.',
          },
          folderName: {
            type: Type.STRING,
            description: 'Subfolder in the workspace (defaults to "folio-fallback-task").',
          },
          command: {
            type: Type.STRING,
            description: 'Command line to execute inside the folder.',
          },
          timeoutMs: {
            type: Type.INTEGER,
            description: 'Timeout in ms (default 30000, max 60000).',
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'meta_script_run',
      description:
        'Execute a Folio Meta-Script in Node.js with workspace file access and studio logging.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          scriptCode: {
            type: Type.STRING,
            description: 'JavaScript/TypeScript script code to execute.',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional workspace ID.',
          },
        },
        required: ['scriptCode'],
      },
    },
    {
      name: 'antigravity_cli',
      description:
        'Invoke the Antigravity Autonomous Agent CLI (cloud Interactions API antigravity-preview-09-2026 when enabled, or isolated local workspace sandbox execution) to inspect files, run scripts/tests, and automate coding workflows while preserving a clean backup.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            description: '"run" | "inspect" | "test" | "status"',
          },
          task: {
            type: Type.STRING,
            description: 'Task instruction or shell/test command for Antigravity CLI.',
          },
          agentModel: {
            type: Type.STRING,
            description: 'Optional model for cloud Antigravity agent ("gemini-4-carbon" | "gemini-4-hydrogen" | "gemini-3.8-flash").',
          },
          mode: {
            type: Type.STRING,
            description: '"auto" | "cloud" | "local" (defaults to "auto", preferring local sandbox unless cloud is requested).',
          },
          workspaceId: {
            type: Type.STRING,
            description: 'Optional target workspace ID.',
          },
        },
      },
    },
    {
      name: 'folio_docs_lookup',
      description:
        'Search authoritative Folio v4.2 documentation, TypeScript/Python SDK APIs, folio CLI commands, engine JSON schemas (EVO 3D, Stop Motion v3, Pixel Engine v3, Three.js, Hybrid), RAM watchdog specs, and the complete Folio changelog.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'Search query (e.g. "evo hitbox", "python sdk", "folio cli", "changelog", "blender fallback").',
          },
          limit: {
            type: Type.NUMBER,
            description: 'Max matching sections to return (1-6, default 3).',
          },
        },
        required: ['query'],
      },
    },
  ];
}

async function executeChatToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: { ghToken: string | null; activeWorkspaceId: string }
): Promise<Record<string, unknown>> {
  const strArg = (key: string): string =>
    typeof args[key] === 'string' ? (args[key] as string).trim() : '';

  const ghHeaders = (includeJson = false): Record<string, string> => ({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Folio-Studio',
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(ctx.ghToken ? { Authorization: `Bearer ${ctx.ghToken}` } : {}),
  });

  try {
    switch (name) {
      case 'github_list_repos': {
        const username = strArg('username');
        const visibility = (strArg('visibility') || 'all').toLowerCase();

        if (username && !/^[a-zA-Z0-9-]+$/.test(username)) {
          return { error: 'Invalid GitHub username format.' };
        }

        let endpoint = '';
        if (username) {
          endpoint = `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=50`;
        } else if (ctx.ghToken) {
          endpoint =
            'https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator,organization_member';
        } else {
          return {
            error:
              'GitHub is not connected right now. Ask the user to connect GitHub in Folder -> GitHub, or provide a specific public username.',
          };
        }

        const ghRes = await fetch(endpoint, { headers: ghHeaders() });
        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return { error: `GitHub API error (${ghRes.status}): ${errText.slice(0, 300)}` };
        }

        const rawRepos = (await ghRes.json()) as Array<{
          full_name: string;
          name: string;
          private?: boolean;
          default_branch?: string;
          description?: string | null;
          language?: string | null;
          updated_at?: string;
          html_url?: string;
          stargazers_count?: number;
        }>;

        const filtered = rawRepos.filter((r) => {
          if (visibility === 'public') return !r.private;
          if (visibility === 'private') return Boolean(r.private);
          return true;
        });

        return {
          ok: true,
          count: filtered.length,
          visibility,
          repos: filtered.map((r) => ({
            fullName: r.full_name,
            name: r.name,
            private: Boolean(r.private),
            defaultBranch: r.default_branch || 'main',
            description: r.description || '',
            language: r.language || null,
            stars: r.stargazers_count ?? 0,
            updatedAt: r.updated_at || '',
            url: r.html_url || `https://github.com/${r.full_name}`,
          })),
        };
      }

      case 'github_list_files': {
        const rawRepo = strArg('repo');
        if (!rawRepo) return { error: 'repo parameter is required.' };
        const parsed = parseGitHubRepoSpec(rawRepo, strArg('branch') || undefined, strArg('subpath') || undefined);
        if (!/^[a-zA-Z0-9_.-]+$/.test(parsed.owner) || !/^[a-zA-Z0-9_.-]+$/.test(parsed.repo)) {
          return { error: 'Invalid GitHub owner or repository name.' };
        }

        let branch = parsed.branch;
        if (!branch) {
          const metaRes = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
            { headers: ghHeaders() }
          );
          if (metaRes.ok) {
            const meta = (await metaRes.json()) as { default_branch?: string };
            branch = meta.default_branch || 'main';
          } else {
            branch = 'main';
          }
        }

        const treeRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
          { headers: ghHeaders() }
        );
        if (!treeRes.ok) {
          const msg = await treeRes.text();
          return { error: `Unable to list repository files (${treeRes.status}): ${msg.slice(0, 300)}` };
        }

        const treeJson = (await treeRes.json()) as {
          tree?: Array<{ path: string; type: string; size?: number }>;
          truncated?: boolean;
        };
        const prefix = parsed.subpath ? `${parsed.subpath}/` : '';
        const matching = (treeJson.tree || [])
          .filter((item) => item.type === 'blob')
          .filter((item) => (!prefix ? true : item.path.startsWith(prefix)))
          .map((item) => ({ path: item.path, size: item.size ?? 0 }));

        return {
          ok: true,
          owner: parsed.owner,
          repo: parsed.repo,
          branch,
          totalFiles: matching.length,
          truncated: matching.length > 200 || Boolean(treeJson.truncated),
          files: matching.slice(0, 200),
        };
      }

      case 'github_read_file': {
        const rawRepo = strArg('repo');
        const filePath = strArg('path').replace(/^\/+/, '');
        if (!rawRepo || !filePath) {
          return { error: 'Both repo and path parameters are required.' };
        }
        if (filePath.includes('..') || filePath.includes('\0')) {
          return { error: 'Invalid file path.' };
        }
        const parsed = parseGitHubRepoSpec(rawRepo, strArg('branch') || undefined);
        if (!/^[a-zA-Z0-9_.-]+$/.test(parsed.owner) || !/^[a-zA-Z0-9_.-]+$/.test(parsed.repo)) {
          return { error: 'Invalid GitHub owner or repository name.' };
        }

        const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
        const qs = parsed.branch ? `?ref=${encodeURIComponent(parsed.branch)}` : '';
        const contentRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/contents/${encodedPath}${qs}`,
          { headers: ghHeaders() }
        );

        let textContent = '';
        if (contentRes.ok) {
          const data = (await contentRes.json()) as {
            type?: string;
            content?: string;
            encoding?: string;
            size?: number;
          };
          if (data.type && data.type !== 'file') {
            return { error: `"${filePath}" is not a file (${data.type}).` };
          }
          if (typeof data.content === 'string') {
            textContent = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
          }
        } else if (!ctx.ghToken) {
          const ref = parsed.branch || 'HEAD';
          const rawRes = await fetch(
            `https://raw.githubusercontent.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/${encodeURIComponent(ref)}/${encodedPath}`
          );
          if (!rawRes.ok) {
            return { error: `Unable to read file (${rawRes.status}).` };
          }
          textContent = await rawRes.text();
        } else {
          const errMsg = await contentRes.text();
          return { error: `GitHub read failed (${contentRes.status}): ${errMsg.slice(0, 300)}` };
        }

        const MAX_CHARS = 32_000;
        const truncated = textContent.length > MAX_CHARS;
        return {
          ok: true,
          repo: `${parsed.owner}/${parsed.repo}`,
          path: filePath,
          truncated,
          content: truncated ? textContent.slice(0, MAX_CHARS) : textContent,
        };
      }

      case 'github_import_repo': {
        const rawRepo = strArg('repo');
        if (!rawRepo) return { error: 'repo parameter is required.' };
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const parsed = parseGitHubRepoSpec(rawRepo, strArg('branch') || undefined, strArg('subpath') || undefined);
        if (!/^[a-zA-Z0-9_.-]+$/.test(parsed.owner) || !/^[a-zA-Z0-9_.-]+$/.test(parsed.repo)) {
          return { error: 'Invalid GitHub owner or repository name.' };
        }
        if (parsed.branch && parsed.branch.startsWith('-')) {
          return { error: 'Invalid branch name.' };
        }

        if (!ctx.ghToken) {
          let tmpCloneDir = '';
          try {
            tmpCloneDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folio-chat-clone-'));
            const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
            const cloneArgs = ['clone', '--depth', '1'];
            if (parsed.branch) cloneArgs.push('--branch', parsed.branch);
            cloneArgs.push(repoUrl, tmpCloneDir);

            const cloneRes = await new Promise<{ exitCode: number; stderr: string }>((resolve) => {
              const child = spawn('git', cloneArgs, {
                env: {
                  PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
                  GIT_TERMINAL_PROMPT: '0',
                  HOME: tmpCloneDir,
                },
                stdio: ['ignore', 'pipe', 'pipe'],
              });
              let stderr = '';
              const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
              child.stderr.on('data', (d: Buffer) => {
                stderr += d.toString('utf8');
              });
              child.on('error', (err) => {
                clearTimeout(timer);
                resolve({ exitCode: 1, stderr: err.message });
              });
              child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ exitCode: code ?? 0, stderr });
              });
            });

            if (cloneRes.exitCode !== 0) {
              return { error: cloneRes.stderr.trim() || `Could not clone ${parsed.owner}/${parsed.repo}.` };
            }

            const sourceRoot = parsed.subpath
              ? resolveWorkspaceFilePath(tmpCloneDir, parsed.subpath)
              : tmpCloneDir;
            const collected: Array<{ rel: string; full: string }> = [];
            async function walkClone(dir: string, prefix: string) {
              if (collected.length >= 80) return;
              const entries = await fs.promises.readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (collected.length >= 80) break;
                if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '__pycache__') {
                  continue;
                }
                const full = path.join(dir, entry.name);
                const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                  await walkClone(full, rel);
                } else if (entry.isFile()) {
                  const st = await fs.promises.stat(full);
                  if (st.size <= 512 * 1024) collected.push({ rel, full });
                }
              }
            }
            await walkClone(sourceRoot, '');
            if (collected.length === 0) {
              return { error: 'No importable files found at that repository path.' };
            }

            const existing = await fs.promises.readdir(workspaceDir);
            for (const entryName of existing) {
              if (entryName === '.folio-design-system.css') continue;
              await fs.promises.rm(path.join(workspaceDir, entryName), { recursive: true, force: true });
            }
            for (const item of collected) {
              const dest = resolveWorkspaceFilePath(workspaceDir, item.rel);
              await fs.promises.mkdir(path.dirname(dest), { recursive: true });
              await fs.promises.copyFile(item.full, dest);
            }
            const scanned = await scanWorkspaceFiles(workspaceDir);
            return {
              ok: true,
              workspaceId: wsId,
              owner: parsed.owner,
              repo: parsed.repo,
              importedCount: collected.length,
              files: scanned.files.map((f) => f.path).slice(0, 60),
            };
          } finally {
            if (tmpCloneDir) {
              await fs.promises.rm(tmpCloneDir, { recursive: true, force: true }).catch(() => {});
            }
          }
        }

        let branch = parsed.branch;
        if (!branch) {
          const metaRes = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
            { headers: ghHeaders() }
          );
          if (!metaRes.ok) {
            return { error: `GitHub repo lookup failed (${metaRes.status}).` };
          }
          const meta = (await metaRes.json()) as { default_branch?: string };
          branch = meta.default_branch || 'main';
        }

        const treeRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
          { headers: ghHeaders() }
        );
        if (!treeRes.ok) {
          return { error: `Unable to read repository tree (${treeRes.status}).` };
        }
        const treeJson = (await treeRes.json()) as {
          tree?: Array<{ path: string; type: string; size?: number; sha: string }>;
        };
        const prefix = parsed.subpath ? `${parsed.subpath}/` : '';
        const blobs = (treeJson.tree || [])
          .filter((item) => item.type === 'blob' && (item.size ?? 0) <= 512 * 1024)
          .filter((item) => (!prefix ? true : item.path.startsWith(prefix)))
          .filter((item) => !item.path.includes('node_modules/') && !item.path.startsWith('.git/'))
          .slice(0, 80);

        if (blobs.length === 0) {
          return { error: 'No importable files found at that repository path.' };
        }

        const existing = await fs.promises.readdir(workspaceDir);
        for (const entryName of existing) {
          if (entryName === '.folio-design-system.css') continue;
          await fs.promises.rm(path.join(workspaceDir, entryName), { recursive: true, force: true });
        }

        let importedCount = 0;
        for (const blob of blobs) {
          const relOut = prefix ? blob.path.slice(prefix.length) : blob.path;
          if (!relOut) continue;
          const blobRes = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/blobs/${blob.sha}`,
            { headers: ghHeaders() }
          );
          if (!blobRes.ok) continue;
          const blobData = (await blobRes.json()) as { content?: string };
          if (!blobData.content) continue;
          const destPath = resolveWorkspaceFilePath(workspaceDir, relOut);
          await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
          await fs.promises.writeFile(
            destPath,
            Buffer.from(blobData.content.replace(/\n/g, ''), 'base64')
          );
          importedCount += 1;
        }
        const scanned = await scanWorkspaceFiles(workspaceDir);
        return {
          ok: true,
          workspaceId: wsId,
          owner: parsed.owner,
          repo: parsed.repo,
          branch,
          importedCount,
          files: scanned.files.map((f) => f.path).slice(0, 60),
        };
      }

      case 'github_create_repo': {
        if (!ctx.ghToken) {
          return { error: 'Connect your GitHub account first to create a repository.' };
        }
        const cleanName = strArg('name').replace(/\s+/g, '-');
        if (!/^[a-zA-Z0-9._-]{1,100}$/.test(cleanName)) {
          return { error: 'Invalid repository name. Use letters, numbers, ".", "_", "-".' };
        }
        const ghRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: ghHeaders(true),
          body: JSON.stringify({
            name: cleanName,
            description: strArg('description') || 'Created from Folio Sandbox',
            private: Boolean(args.isPrivate),
            auto_init: true,
          }),
        });
        const data = (await ghRes.json()) as {
          message?: string;
          full_name?: string;
          private?: boolean;
          default_branch?: string;
          html_url?: string;
        };
        if (!ghRes.ok) {
          return { error: data.message || `GitHub repo creation failed (${ghRes.status})` };
        }
        return {
          ok: true,
          fullName: data.full_name,
          private: Boolean(data.private),
          defaultBranch: data.default_branch || 'main',
          url: data.html_url,
        };
      }

      case 'github_push_workspace': {
        if (!ctx.ghToken) {
          return { error: 'Connect your GitHub account first to commit and push files.' };
        }
        const rawRepo = strArg('repo');
        if (!rawRepo) return { error: 'Target repo ("owner/repo") is required.' };
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const scanned = await scanWorkspaceFiles(workspaceDir);
        const filesToPush = scanned.files.filter((f) => f.size <= 1024 * 1024).slice(0, 100);
        if (filesToPush.length === 0) {
          return { error: `Workspace "${wsId}" is empty—create files before pushing.` };
        }

        const parsed = parseGitHubRepoSpec(
          rawRepo,
          strArg('branch') || undefined,
          strArg('subpath') || undefined
        );
        const headers = ghHeaders(true);
        const repoBase = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;

        const repoRes = await fetch(repoBase, { headers });
        if (!repoRes.ok) {
          return { error: `Repository lookup failed (${repoRes.status}).` };
        }
        const repoMeta = (await repoRes.json()) as { default_branch?: string; html_url?: string };
        const defaultBranch = repoMeta.default_branch || 'main';
        const targetBranch = (parsed.branch || defaultBranch).trim();

        let parentCommitSha: string | null = null;
        let baseTreeSha: string | null = null;
        let refExists = false;

        const refRes = await fetch(`${repoBase}/git/ref/heads/${encodeURIComponent(targetBranch)}`, { headers });
        if (refRes.ok) {
          const refJson = (await refRes.json()) as { object?: { sha?: string } };
          parentCommitSha = refJson.object?.sha || null;
          refExists = Boolean(parentCommitSha);
        } else if (targetBranch !== defaultBranch) {
          const defRes = await fetch(`${repoBase}/git/ref/heads/${encodeURIComponent(defaultBranch)}`, { headers });
          if (defRes.ok) {
            const defJson = (await defRes.json()) as { object?: { sha?: string } };
            parentCommitSha = defJson.object?.sha || null;
          }
        }

        if (!parentCommitSha) {
          const initRes = await fetch(`${repoBase}/contents/README.md`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              message: 'Initialize repository from Folio Sandbox',
              content: Buffer.from(`# ${parsed.repo}\n`, 'utf8').toString('base64'),
              branch: targetBranch,
            }),
          });
          if (!initRes.ok) {
            return { error: `Could not initialize empty repository (${initRes.status}).` };
          }
          const initJson = (await initRes.json()) as { commit?: { sha?: string } };
          parentCommitSha = initJson.commit?.sha || null;
          refExists = true;
        }

        if (parentCommitSha) {
          const commitRes = await fetch(`${repoBase}/git/commits/${encodeURIComponent(parentCommitSha)}`, { headers });
          if (commitRes.ok) {
            const commitJson = (await commitRes.json()) as { tree?: { sha?: string } };
            baseTreeSha = commitJson.tree?.sha || null;
          }
        }

        const prefix = parsed.subpath ? `${parsed.subpath.replace(/^\/+|\/+$/g, '')}/` : '';
        const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
        for (const file of filesToPush) {
          const fullPath = resolveWorkspaceFilePath(workspaceDir, file.path);
          const rawBytes = await fs.promises.readFile(fullPath);
          const blobRes = await fetch(`${repoBase}/git/blobs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content: rawBytes.toString('base64'), encoding: 'base64' }),
          });
          if (!blobRes.ok) {
            return { error: `Failed uploading "${file.path}" (${blobRes.status}).` };
          }
          const blobJson = (await blobRes.json()) as { sha: string };
          treeEntries.push({
            path: `${prefix}${file.path}`,
            mode: '100644',
            type: 'blob',
            sha: blobJson.sha,
          });
        }

        const treeRes = await fetch(`${repoBase}/git/trees`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
            tree: treeEntries,
          }),
        });
        if (!treeRes.ok) {
          return { error: `Git tree creation failed (${treeRes.status}).` };
        }
        const treeJson = (await treeRes.json()) as { sha: string };

        const msgText = strArg('commitMessage') || `Update from Folio project "${wsId}"`;
        const newCommitRes = await fetch(`${repoBase}/git/commits`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: msgText,
            tree: treeJson.sha,
            parents: parentCommitSha ? [parentCommitSha] : [],
          }),
        });
        if (!newCommitRes.ok) {
          return { error: `Git commit failed (${newCommitRes.status}).` };
        }
        const newCommitJson = (await newCommitRes.json()) as { sha: string; html_url?: string };

        if (refExists) {
          const patchRes = await fetch(`${repoBase}/git/refs/heads/${encodeURIComponent(targetBranch)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ sha: newCommitJson.sha, force: false }),
          });
          if (!patchRes.ok) {
            return { error: `Branch push failed (${patchRes.status}).` };
          }
        } else {
          const createRefRes = await fetch(`${repoBase}/git/refs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ref: `refs/heads/${targetBranch}`, sha: newCommitJson.sha }),
          });
          if (!createRefRes.ok) {
            return { error: `Branch creation failed (${createRefRes.status}).` };
          }
        }

        const repoUrl = repoMeta.html_url || `https://github.com/${parsed.owner}/${parsed.repo}`;
        return {
          ok: true,
          workspaceId: wsId,
          repo: `${parsed.owner}/${parsed.repo}`,
          branch: targetBranch,
          pushedCount: treeEntries.length,
          commitSha: newCommitJson.sha,
          commitUrl: newCommitJson.html_url || `${repoUrl}/commit/${newCommitJson.sha}`,
          repoUrl,
        };
      }

      case 'workspace_list': {
        const targetId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const entries = await fs.promises.readdir(WORKSPACES_ROOT, { withFileTypes: true });
        const workspaces: Array<{ id: string; fileCount: number; hasWorkflow: boolean }> = [];
        for (const entry of entries) {
          if (!entry.isDirectory() || !/^[a-zA-Z0-9_-]{3,64}$/.test(entry.name)) continue;
          const scanned = await scanWorkspaceFiles(path.join(WORKSPACES_ROOT, entry.name));
          workspaces.push({
            id: entry.name,
            fileCount: scanned.files.length,
            hasWorkflow: scanned.files.some((f) => f.path === 'folio.workflow.json'),
          });
        }
        const targetScan = await scanWorkspaceFiles(getWorkspaceDir(targetId));
        return {
          ok: true,
          activeWorkspaceId: targetId,
          workspaces,
          files: targetScan.files.map((f) => ({ path: f.path, size: f.size })),
          entryFolders: targetScan.entryFolders,
        };
      }

      case 'workspace_read_file': {
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const relPath = strArg('path');
        if (!relPath) return { error: 'path parameter is required.' };
        const fullPath = resolveWorkspaceFilePath(getWorkspaceDir(wsId), relPath);
        if (!fs.existsSync(fullPath)) {
          return { error: `File "${relPath}" not found in workspace "${wsId}".` };
        }
        const st = await fs.promises.stat(fullPath);
        if (st.isDirectory()) return { error: `"${relPath}" is a directory.` };
        if (st.size > 200 * 1024 * 1024) return { error: 'File exceeds 200MB read limit.' };

        const rawStart = typeof args.startOffset === 'number' ? Math.max(0, Math.floor(args.startOffset)) : 0;
        const rawMax = typeof args.maxChars === 'number' ? Math.min(64_000, Math.max(512, Math.floor(args.maxChars))) : 32_000;
        const startOffset = Math.min(rawStart, st.size);
        const bytesToRead = Math.min(rawMax, Math.max(0, st.size - startOffset));

        let content = '';
        if (bytesToRead > 0) {
          const handle = await fs.promises.open(fullPath, 'r');
          try {
            const buf = Buffer.alloc(bytesToRead);
            const { bytesRead } = await handle.read(buf, 0, bytesToRead, startOffset);
            content = buf.subarray(0, bytesRead).toString('utf8');
          } finally {
            await handle.close();
          }
        }

        const nextOffset = startOffset + bytesToRead;
        const truncated = nextOffset < st.size || startOffset > 0;
        return {
          ok: true,
          workspaceId: wsId,
          path: relPath,
          totalBytes: st.size,
          estimatedTokens: Math.ceil(st.size / 4),
          startOffset,
          nextOffset,
          hasMore: nextOffset < st.size,
          truncated,
          content,
        };
      }

      case 'workspace_write_file': {
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const relPath = strArg('path');
        const content = typeof args.content === 'string' ? args.content : '';
        if (!relPath) return { error: 'path parameter is required.' };
        const workspaceDir = getWorkspaceDir(wsId);
        const fullPath = resolveWorkspaceFilePath(workspaceDir, relPath);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, content, 'utf8');
        const scanned = await scanWorkspaceFiles(workspaceDir);
        return {
          ok: true,
          workspaceId: wsId,
          path: relPath,
          fileCount: scanned.files.length,
          entryFolders: scanned.entryFolders,
        };
      }

      case 'workspace_run_script': {
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const execOut = await executeWorkspaceScript(workspaceDir, {
          filePath: strArg('filePath') || undefined,
          code: typeof args.code === 'string' ? args.code : undefined,
          language: strArg('language') || undefined,
          timeoutMs: 20000,
        });
        const scanned = await scanWorkspaceFiles(workspaceDir);
        return {
          ok: true,
          workspaceId: wsId,
          ...execOut,
          files: scanned.files.map((f) => f.path).slice(0, 50),
        };
      }

      case 'stock_media_search': {
        const query = strArg('query');
        if (!query) return { error: 'query parameter is required.' };
        const kind = (strArg('kind') || 'all').toLowerCase();
        const limit = typeof args.limit === 'number' ? Math.min(12, Math.max(1, Math.floor(args.limit))) : 6;
        return searchStockMedia(query, kind, limit);
      }

      case 'folio_docs_lookup': {
        const query = strArg('query') || 'overview';
        const limit = typeof args.limit === 'number' ? Math.min(6, Math.max(1, Math.floor(args.limit))) : 3;
        const hits = searchFolioDocs(query, limit);
        const includeChangelog = /\b(changelog|version|release|history|v4\.|v3\.)\b/i.test(query);
        return {
          ok: true,
          version: FOLIO_CURRENT_VERSION,
          query,
          matches: hits.map((h) => ({
            id: h.id,
            category: h.category,
            title: h.title,
            summary: h.summary,
            content: h.content.slice(0, 1600),
          })),
          ...(includeChangelog ? { changelogs: FOLIO_CHANGELOGS } : {}),
        };
      }

      case 'blender_cli': {
        const blenderBin = getBlenderBinary();
        const freeRamMb = getAvailableRamMb();
        const pythonCode = typeof args.pythonCode === 'string' ? args.pythonCode : '';
        if (!pythonCode.trim()) return { error: 'pythonCode is required.' };
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const relScript = strArg('scriptPath') || 'blender_script.py';
        const fullScript = resolveWorkspaceFilePath(workspaceDir, relScript);
        const headlessHeader = [
          'import bpy as _folio_bpy',
          'try:',
          '    import numpy as _folio_np',
          '    if not hasattr(_folio_np, "bool"):',
          '        _folio_np.bool = _folio_np.bool_',
          '    _s = _folio_bpy.context.scene',
          "    _s.render.engine = 'CYCLES'",
          "    _s.cycles.device = 'CPU'",
          '    _s.cycles.use_denoising = False',
          'except Exception:',
          '    pass',
          '',
        ].join('\n');
        const preparedPython = pythonCode.includes('use_denoising')
          ? pythonCode
          : `${headlessHeader}${pythonCode}`;
        await fs.promises.mkdir(path.dirname(fullScript), { recursive: true });
        await fs.promises.writeFile(fullScript, preparedPython, 'utf8');

        // Low-RAM Guard or missing Blender CLI -> zero-bloat pure-Python procedural OBJ/MTL mesh fallback
        if (!blenderBin || freeRamMb < 650) {
          const fallbackPy = path.join(workspaceDir, '.folio_obj_fallback.py');
          const pyFallbackCode = `
import os, math

obj_path = os.path.join(${JSON.stringify(workspaceDir)}, "fallback_scene.obj")
mtl_path = os.path.join(${JSON.stringify(workspaceDir)}, "fallback_scene.mtl")

with open(mtl_path, "w", encoding="utf-8") as mf:
    mf.write("newmtl folio_accent\\nKd 0.22 0.74 0.97\\nKs 0.8 0.8 0.8\\nNs 64.0\\n")
    mf.write("newmtl folio_ground\\nKd 0.14 0.16 0.22\\nKs 0.2 0.2 0.2\\nNs 16.0\\n")

verts = []
faces = []

def add_box(cx, cy, cz, sx, sy, sz, mat):
    base = len(verts) + 1
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    for dx in (-hx, hx):
        for dy in (-hy, hy):
            for dz in (-hz, hz):
                verts.append((cx + dx, cy + dy, cz + dz))
    quads = [
        (0,1,3,2), (4,6,7,5), (0,4,5,1),
        (2,3,7,6), (0,2,6,4), (1,5,7,3)
    ]
    faces.append((mat, [(base+a, base+b, base+c, base+d) for a,b,c,d in quads]))

add_box(0.0, -0.05, 0.0, 4.0, 0.1, 4.0, "folio_ground")
add_box(0.0, 0.55, 0.0, 1.0, 1.0, 1.0, "folio_accent")

with open(obj_path, "w", encoding="utf-8") as of:
    of.write("# Folio Pure-Python Procedural Fallback Mesh\\n")
    of.write("mtllib fallback_scene.mtl\\n")
    for vx, vy, vz in verts:
        of.write(f"v {vx:.4f} {vy:.4f} {vz:.4f}\\n")
    for mat, qs in faces:
        of.write(f"usemtl {mat}\\n")
        for a, b, c, d in qs:
            of.write(f"f {a} {b} {c} {d}\\n")
print("Generated fallback_scene.obj and fallback_scene.mtl")
`;
          await fs.promises.writeFile(fallbackPy, pyFallbackCode.trim(), 'utf8');
          await new Promise<void>((resolve) => {
            const cp = spawn('python3', [fallbackPy], { cwd: workspaceDir, stdio: 'ignore' });
            cp.on('close', () => resolve());
            cp.on('error', () => resolve());
          });
          await fs.promises.unlink(fallbackPy).catch(() => {});
          const scanned = await scanWorkspaceFiles(workspaceDir);
          const ramReason = blenderBin && freeRamMb < 650;
          return {
            ok: true,
            fallbackMode: true,
            blenderInstalled: Boolean(blenderBin),
            ramGuardTriggered: Boolean(ramReason),
            freeRamMb,
            workspaceId: wsId,
            scriptPath: relScript,
            fallbackMesh: 'fallback_scene.obj',
            notice: ramReason
              ? `RAM Watchdog blocked Blender Cycles (${freeRamMb} MB free < 650 MB safe minimum) to prevent container OOM and generated a lightweight procedural fallback_scene.obj instead.`
              : 'Blender CLI binary is not installed; saved script and generated lightweight procedural fallback_scene.obj (.obj/.mtl). Install Blender via "python3 scripts/bootstrap_toolchains.py blender" or render inline with ```evo or ```threejs.',
            files: scanned.files.map((f) => ({ path: f.path, size: f.size })).slice(0, 60),
          };
        }

        const blOut = await new Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }>(
          (resolve) => {
            const child = spawn(blenderBin, ['-b', '-noaudio', '--python', fullScript], {
              cwd: workspaceDir,
              env: {
                PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
                HOME: workspaceDir,
                TMPDIR: workspaceDir,
                ...(fs.existsSync('/usr/lib/libextern_draco.so')
                  ? { BLENDER_EXTERN_DRACO_LIBRARY_PATH: '/usr/lib/libextern_draco.so' }
                  : {}),
              },
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            const timer = setTimeout(() => {
              timedOut = true;
              child.kill('SIGKILL');
            }, 45_000);
            child.stdout.on('data', (d: Buffer) => {
              if (stdout.length < 32_000) stdout += d.toString('utf8');
            });
            child.stderr.on('data', (d: Buffer) => {
              if (stderr.length < 16_000) stderr += d.toString('utf8');
            });
            child.on('error', (err) => {
              clearTimeout(timer);
              resolve({ exitCode: 1, stdout, stderr: err.message, timedOut });
            });
            child.on('close', (code) => {
              clearTimeout(timer);
              resolve({ exitCode: code ?? 0, stdout, stderr, timedOut });
            });
          }
        );

        const scanned = await scanWorkspaceFiles(workspaceDir);
        return {
          ok: blOut.exitCode === 0,
          workspaceId: wsId,
          scriptPath: relScript,
          exitCode: blOut.exitCode,
          timedOut: blOut.timedOut,
          stdout: blOut.stdout,
          stderr: blOut.stderr,
          files: scanned.files.map((f) => ({ path: f.path, size: f.size })).slice(0, 60),
        };
      }

      case 'validate_creative_code': {
        const kind = strArg('kind').toLowerCase();
        const rawCode = typeof args.code === 'string' ? args.code.trim() : '';
        if (!rawCode) return { ok: false, errors: ['Empty code input.'] };
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(rawCode) as Record<string, unknown>;
        } catch (err) {
          return {
            ok: false,
            errors: [`Invalid JSON: ${err instanceof Error ? err.message : 'syntax error'}`],
          };
        }
        const errors: string[] = [];
        const warnings: string[] = [];

        if (kind === 'stopmotion') {
          const isScene =
            parsed.format === 'stopmotion/v2' ||
            parsed.format === 'stopmotion/v3' ||
            Array.isArray(parsed.layers);
          if (isScene) {
            if (!Array.isArray(parsed.layers) || parsed.layers.length === 0) {
              errors.push('stopmotion v2/v3 requires a non-empty "layers" array.');
            }
            const fps = Number(parsed.fps ?? 24);
            if (!Number.isFinite(fps) || fps < 1 || fps > 60) {
              errors.push('stopmotion fps must be between 1 and 60.');
            }
            const fc = Number(parsed.frameCount ?? 0);
            if (fc > 216000) {
              errors.push('stopmotion frameCount exceeds 216,000 max.');
            }
          } else if (!Array.isArray(parsed.frames) || parsed.frames.length === 0) {
            errors.push('stopmotion v1 requires a non-empty "frames" array.');
          }
          if (rawCode.includes('<script')) {
            errors.push('Stopmotion SVG must not contain <script> tags.');
          }
        } else if (kind === 'pixelart') {
          const w = Number(parsed.width ?? 64);
          const h = Number(parsed.height ?? 64);
          if (!Number.isFinite(w) || w < 1 || w > 512 || !Number.isFinite(h) || h < 1 || h > 512) {
            errors.push('pixelart width & height must be between 1 and 512.');
          }
          const hasPixelContent =
            (Array.isArray(parsed.frames) && parsed.frames.length > 0) ||
            (Array.isArray(parsed.draw) && parsed.draw.length > 0) ||
            (Array.isArray(parsed.backdrop) && parsed.backdrop.length > 0) ||
            Boolean(parsed.pixels) ||
            Boolean(parsed.rle);
          if (!hasPixelContent) {
            errors.push('pixelart requires "frames", procedural "draw"/"backdrop" ops, "pixels", or "rle".');
          }
        } else if (kind === 'liquidmotion') {
          if (!parsed.pixelLayer && !parsed.pixelArt && !Array.isArray(parsed.motionLayers) && !Array.isArray(parsed.layers)) {
            errors.push('liquidmotion requires "pixelLayer"/"pixelArt" and/or "motionLayers"/"layers".');
          }
        } else if (kind === 'liquiddrop' || kind === 'motiondrop') {
          if (!parsed.pixelLayer && !parsed.pixelArt && typeof parsed.svg !== 'string' && !Array.isArray(parsed.layers)) {
            errors.push(`${kind} requires "pixelLayer", "layers", and/or "svg" visual data.`);
          }
        } else if (kind === 'pixelmotion') {
          if (!parsed.pixelArt && !parsed.pixelLayer && !Array.isArray(parsed.draw)) {
            errors.push('pixelmotion requires "pixelArt" (or "pixelLayer") spec.');
          }
        } else if (kind === 'threejs') {
          const hasThree =
            (Array.isArray(parsed.objects) && parsed.objects.length > 0) ||
            (Array.isArray(parsed.voxels) && parsed.voxels.length > 0) ||
            (Array.isArray(parsed.elements) && parsed.elements.length > 0);
          if (!hasThree) {
            errors.push('threejs JSON requires non-empty "objects", "voxels", or "elements".');
          }
        } else if (kind === 'evo') {
          const sceneObj = (parsed.scene && typeof parsed.scene === 'object' ? parsed.scene : null) as Record<string, unknown> | null;
          const hasObjects =
            (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) ||
            (Array.isArray(parsed.objects) && parsed.objects.length > 0) ||
            (Array.isArray(parsed.layers) && parsed.layers.length > 0) ||
            (Array.isArray(parsed.elements) && parsed.elements.length > 0) ||
            (Array.isArray(parsed.primitives) && parsed.primitives.length > 0) ||
            (Array.isArray(parsed.items) && parsed.items.length > 0) ||
            (Array.isArray(parsed.shapes) && parsed.shapes.length > 0) ||
            (Array.isArray(sceneObj?.nodes) && sceneObj.nodes.length > 0) ||
            Boolean(parsed.groups && typeof parsed.groups === 'object') ||
            typeof parsed.type === 'string' ||
            typeof parsed.shape === 'string';
          if (!hasObjects) {
            errors.push('evo requires a non-empty "nodes" (or "objects" / "layers" / "elements") array or primitive node.');
          }
          const fps = Number(parsed.fps ?? 30);
          if (!Number.isFinite(fps) || fps < 1 || fps > 60) {
            errors.push('evo fps must be between 1 and 60.');
          }
        } else if (kind === 'bbmodel') {
          if (!Array.isArray(parsed.elements) || parsed.elements.length === 0) {
            errors.push('bbmodel requires at least one cube in "elements".');
          }
        } else if (kind === 'chart') {
          if (!Array.isArray(parsed.series) || parsed.series.length === 0) {
            errors.push('chart requires a non-empty "series" array.');
          }
        } else if (kind === 'quiz') {
          if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            errors.push('quiz requires a non-empty "questions" array.');
          }
        } else {
          warnings.push(`Unknown validation kind "${kind}" — verified valid JSON only.`);
        }

        return { ok: errors.length === 0, kind, errors, warnings };
      }

      case 'namecom_domain_sim': {
        const action = (strArg('action') || 'list').toLowerCase();
        if (action === 'search') {
          const query = strArg('query') || 'folio-studio';
          return {
            ok: true,
            registrar: 'name.com',
            query,
            results: searchNameComDomains(query),
          };
        }
        if (action === 'register') {
          const domain = validateDomainName(strArg('domain') || '');
          const resolvedMode: SimulatedDomainRecord['mode'] =
            args.mode === 'html' || args.mode === 'proxy' ? (args.mode as 'html' | 'proxy') : 'workspace';
          const record: SimulatedDomainRecord = {
            domain,
            mode: resolvedMode,
            registrar: 'name.com',
            sslEnabled: true,
            dnsRecords: [
              { type: 'A', host: '@', value: '104.21.48.192', ttl: 300 },
              { type: 'CNAME', host: 'www', value: domain, ttl: 300 },
              { type: 'TXT', host: '@', value: `v=folio-namecom site=${domain}`, ttl: 300 },
            ],
            updatedAt: Date.now(),
          };
          if (resolvedMode === 'workspace') {
            record.workspaceId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
          } else if (resolvedMode === 'html') {
            record.html =
              typeof args.html === 'string' && args.html.trim()
                ? args.html.slice(0, 512_000)
                : `<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#090d16;color:#f8fafc;"><h1>${domain}</h1><p>Registered via Name.com Domain Simulator.</p></body></html>`;
          }
          const map = loadDomainsMap();
          map[domain] = record;
          saveDomainsMap(map);
          return {
            ok: true,
            registrar: 'name.com',
            domain: record,
            previewUrl: `/domain-preview/${encodeURIComponent(domain)}/`,
          };
        }
        const map = loadDomainsMap();
        return {
          ok: true,
          registrar: 'name.com',
          domains: Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt),
        };
      }

      case 'github_cli': {
        const ghBin = getGitHubCliBinary();
        if (!ghBin) {
          return { error: 'GitHub CLI (gh) is not installed yet in .folio-data/bin.' };
        }
        const rawArgs = Array.isArray(args.args)
          ? (args.args as unknown[]).filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
          : [];
        if (rawArgs.length === 0) {
          return { error: 'args array is required (e.g. ["repo", "list"]).' };
        }
        const joinedLower = rawArgs.join(' ').toLowerCase();
        if (
          joinedLower.includes('auth token') ||
          joinedLower.includes('auth login') ||
          joinedLower.includes('auth logout')
        ) {
          return { error: 'Interactive or token-dumping gh auth subcommands are disabled.' };
        }

        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const ghRun = await new Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }>(
          (resolve) => {
            const child = spawn(ghBin, rawArgs, {
              cwd: workspaceDir,
              env: {
                PATH: `${FOLIO_BIN_DIR}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
                HOME: workspaceDir,
                TMPDIR: workspaceDir,
                XDG_STATE_HOME: path.join(__dirname, '.folio-data', 'xdg-state'),
                XDG_CONFIG_HOME: path.join(__dirname, '.folio-data', 'xdg-config'),
                GH_NO_UPDATE_NOTIFIER: '1',
                LANG: 'C.UTF-8',
                GH_PROMPT_DISABLED: '1',
                NO_COLOR: '1',
                ...(ctx.ghToken ? { GH_TOKEN: ctx.ghToken } : {}),
              },
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            const timer = setTimeout(() => {
              timedOut = true;
              child.kill('SIGKILL');
            }, 20000);
            child.stdout.on('data', (d: Buffer) => {
              if (stdout.length < 32_000) stdout += d.toString('utf8');
            });
            child.stderr.on('data', (d: Buffer) => {
              if (stderr.length < 16_000) stderr += d.toString('utf8');
            });
            child.on('error', (err) => {
              clearTimeout(timer);
              resolve({ exitCode: 1, stdout, stderr: err.message, timedOut });
            });
            child.on('close', (code) => {
              clearTimeout(timer);
              resolve({ exitCode: code ?? 0, stdout, stderr, timedOut });
            });
          }
        );

        const sanitizeOutput = (text: string) =>
          ctx.ghToken ? text.split(ctx.ghToken).join('[REDACTED]') : text;

        return {
          ok: ghRun.exitCode === 0,
          exitCode: ghRun.exitCode,
          timedOut: ghRun.timedOut,
          stdout: sanitizeOutput(ghRun.stdout),
          stderr: sanitizeOutput(ghRun.stderr),
        };
      }

      case 'godot_cli': {
        const godotBin = getGodotBinary();
        if (!godotBin) return { error: 'Godot CLI is not installed in the toolchain.' };
        const action = (strArg('action') || 'version').toLowerCase();
        const freeRamMb = getAvailableRamMb();
        if (action !== 'version' && freeRamMb < 450) {
          return {
            error: `RAM Watchdog blocked heavy Godot operation (${freeRamMb} MB free < 450 MB minimum) to prevent OOM.`,
            ramGuardTriggered: true,
            freeRamMb,
          };
        }
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);

        if (action === 'version') {
          const out = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
            const cp = spawn(godotBin, ['--headless', '--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
            let stdout = '', stderr = '';
            cp.stdout.on('data', (d) => { stdout += d.toString(); });
            cp.stderr.on('data', (d) => { stderr += d.toString(); });
            cp.on('close', (c) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: c ?? 0 }));
            cp.on('error', (e) => resolve({ stdout: '', stderr: e.message, exitCode: 1 }));
          });
          return { ok: out.exitCode === 0, action, version: out.stdout, stderr: out.stderr };
        }

        if (action === 'init_project') {
          const projFile = path.join(workspaceDir, 'project.godot');
          const projContent = [
            '; Engine configuration file.',
            '; Generated by Folio Zero (Update 4.1).',
            '',
            'config_version=5',
            '',
            '[application]',
            'config/name="FolioProject"',
            'config/features=PackedStringArray("4.3", "Forward Plus")',
            '',
            '[rendering]',
            'renderer/rendering_method="forward_plus"',
            '',
          ].join('\n');
          await fs.promises.mkdir(workspaceDir, { recursive: true });
          await fs.promises.writeFile(projFile, projContent, 'utf8');
          return { ok: true, action, projectFile: 'project.godot', workspaceId: wsId };
        }

        if (action === 'export_presets') {
          const presetsPath = path.join(workspaceDir, 'export_presets.cfg');
          const presetsContent = [
            '; Folio Multi-Platform Export Presets (Godot 4.3)',
            '[preset.0]',
            'name="Linux/X11"',
            'platform="Linux/X11"',
            'runnable=true',
            'export_path="build/linux/game.x86_64"',
            '',
            '[preset.1]',
            'name="Windows Desktop"',
            'platform="Windows Desktop"',
            'runnable=true',
            'export_path="build/windows/game.exe"',
            '',
            '[preset.2]',
            'name="macOS"',
            'platform="macOS"',
            'runnable=true',
            'export_path="build/macos/game.zip"',
            '',
            '[preset.3]',
            'name="Web"',
            'platform="Web"',
            'runnable=true',
            'export_path="build/web/index.html"',
            '',
            '[preset.4]',
            'name="Android"',
            'platform="Android"',
            'runnable=true',
            'export_path="build/android/game.apk"',
            '',
            '[preset.5]',
            'name="iOS"',
            'platform="iOS"',
            'runnable=true',
            'export_path="build/ios/game.ipa"',
            '',
          ].join('\n');
          await fs.promises.mkdir(workspaceDir, { recursive: true });
          await fs.promises.writeFile(presetsPath, presetsContent, 'utf8');
          return { ok: true, action, file: 'export_presets.cfg', presets: ['Linux/X11', 'Windows Desktop', 'macOS', 'Web', 'Android', 'iOS'] };
        }

        if (action === 'run_script') {
          const scriptRel = strArg('scriptPath') || 'main.gd';
          const fullScript = resolveWorkspaceFilePath(workspaceDir, scriptRel);
          const out = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
            const cp = spawn(godotBin, ['--headless', '-s', fullScript], {
              cwd: workspaceDir,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '', stderr = '';
            const t = setTimeout(() => cp.kill('SIGKILL'), 20000);
            cp.stdout.on('data', (d) => { if (stdout.length < 32000) stdout += d.toString(); });
            cp.stderr.on('data', (d) => { if (stderr.length < 16000) stderr += d.toString(); });
            cp.on('close', (c) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: c ?? 0 }); });
            cp.on('error', (e) => { clearTimeout(t); resolve({ stdout: '', stderr: e.message, exitCode: 1 }); });
          });
          return { ok: out.exitCode === 0, action, scriptPath: scriptRel, stdout: out.stdout, stderr: out.stderr };
        }

        return { error: `Unsupported Godot action "${action}". Use version, init_project, export_presets, or run_script.` };
      }

      case 'cmake_build': {
        const cmakeBin = getCmakeBinary();
        const ninjaBin = getNinjaBinary();
        if (!cmakeBin) return { error: 'CMake binary not found.' };
        const freeRamMb = getAvailableRamMb();
        if (freeRamMb < 450) {
          return {
            error: `RAM Watchdog blocked CMake build (${freeRamMb} MB free < 450 MB minimum) to prevent OOM.`,
            ramGuardTriggered: true,
            freeRamMb,
          };
        }
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const relSource = strArg('sourceDir') || '.';
        const relBuild = strArg('buildDir') || 'build';
        const targetPlatform = (strArg('targetPlatform') || 'native').toLowerCase();
        const fullSource = resolveWorkspaceFilePath(workspaceDir, relSource);
        const fullBuild = resolveWorkspaceFilePath(workspaceDir, relBuild);

        const cmakeArgs = ['-B', fullBuild, '-S', fullSource];
        if (ninjaBin) cmakeArgs.push('-G', 'Ninja');
        if (targetPlatform === 'msvc-windows') {
          cmakeArgs.push('-DCMAKE_TOOLCHAIN_FILE=/opt/folio-toolchains/cmake/msvc-x64.cmake');
        }

        const configOut = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
          const cp = spawn(cmakeBin, cmakeArgs, {
            cwd: workspaceDir,
            env: { ...process.env, PATH: `/opt/folio-toolchains/cmake-dist/bin:${process.env.PATH}` },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '', stderr = '';
          const t = setTimeout(() => cp.kill('SIGKILL'), 30000);
          cp.stdout.on('data', (d) => { stdout += d.toString(); });
          cp.stderr.on('data', (d) => { stderr += d.toString(); });
          cp.on('close', (c) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: c ?? 0 }); });
          cp.on('error', (e) => { clearTimeout(t); resolve({ stdout: '', stderr: e.message, exitCode: 1 }); });
        });

        if (configOut.exitCode !== 0) {
          return { ok: false, stage: 'configure', exitCode: configOut.exitCode, stdout: configOut.stdout, stderr: configOut.stderr };
        }

        const buildArgs = ['--build', fullBuild];
        const target = strArg('target');
        if (target) buildArgs.push('--target', target);

        const buildOut = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
          const cp = spawn(cmakeBin, buildArgs, {
            cwd: workspaceDir,
            env: { ...process.env, PATH: `/opt/folio-toolchains/cmake-dist/bin:${process.env.PATH}` },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '', stderr = '';
          const t = setTimeout(() => cp.kill('SIGKILL'), 45000);
          cp.stdout.on('data', (d) => { stdout += d.toString(); });
          cp.stderr.on('data', (d) => { stderr += d.toString(); });
          cp.on('close', (c) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: c ?? 0 }); });
          cp.on('error', (e) => { clearTimeout(t); resolve({ stdout: '', stderr: e.message, exitCode: 1 }); });
        });

        const scanned = await scanWorkspaceFiles(fullBuild).catch(() => ({ files: [] }));
        return {
          ok: buildOut.exitCode === 0,
          stage: 'build',
          targetPlatform,
          exitCode: buildOut.exitCode,
          stdout: `${configOut.stdout}\n${buildOut.stdout}`.slice(-32000),
          stderr: `${configOut.stderr}\n${buildOut.stderr}`.slice(-16000),
          artifacts: scanned.files.map((f) => f.path).slice(0, 30),
        };
      }

      case 'kotlin_compile': {
        const kotlincBin = getKotlinBinary();
        if (!kotlincBin) return { error: 'Kotlin compiler (kotlinc) not found.' };
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const relSource = strArg('sourceFile') || 'Main.kt';
        const relOutput = strArg('outputJar') || 'app.jar';
        const fullSource = resolveWorkspaceFilePath(workspaceDir, relSource);
        const fullOutput = resolveWorkspaceFilePath(workspaceDir, relOutput);

        const compileArgs = [fullSource];
        if (args.includeRuntime !== false) compileArgs.push('-include-runtime');
        compileArgs.push('-d', fullOutput);

        const compOut = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
          const cp = spawn(kotlincBin, compileArgs, {
            cwd: workspaceDir,
            env: {
              ...process.env,
              PATH: `/opt/folio-toolchains/java/bin:${process.env.PATH}`,
              JAVA_HOME: '/opt/folio-toolchains/java',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '', stderr = '';
          const t = setTimeout(() => cp.kill('SIGKILL'), 35000);
          cp.stdout.on('data', (d) => { stdout += d.toString(); });
          cp.stderr.on('data', (d) => { stderr += d.toString(); });
          cp.on('close', (c) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: c ?? 0 }); });
          cp.on('error', (e) => { clearTimeout(t); resolve({ stdout: '', stderr: e.message, exitCode: 1 }); });
        });

        let runResult: Record<string, unknown> | undefined;
        if (compOut.exitCode === 0 && args.runAfterBuild === true) {
          const javaBin = getJavaBinary() || 'java';
          const rOut = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
            const cp = spawn(javaBin, ['-jar', fullOutput], {
              cwd: workspaceDir,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '', stderr = '';
            const t = setTimeout(() => cp.kill('SIGKILL'), 15000);
            cp.stdout.on('data', (d) => { stdout += d.toString(); });
            cp.stderr.on('data', (d) => { stderr += d.toString(); });
            cp.on('close', (c) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: c ?? 0 }); });
            cp.on('error', (e) => { clearTimeout(t); resolve({ stdout: '', stderr: e.message, exitCode: 1 }); });
          });
          runResult = { exitCode: rOut.exitCode, stdout: rOut.stdout.slice(-16000), stderr: rOut.stderr.slice(-8000) };
        }

        return {
          ok: compOut.exitCode === 0,
          sourceFile: relSource,
          outputJar: relOutput,
          exitCode: compOut.exitCode,
          stdout: compOut.stdout,
          stderr: compOut.stderr,
          runResult,
        };
      }

      case 'mod_scaffold': {
        const rawModName = strArg('modName') || 'CosmicMod';
        const modName = rawModName.replace(/[^a-zA-Z0-9_-]/g, '') || 'CustomMod';
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const targetDir = path.join(workspaceDir, 'mods', modName);
        await fs.promises.mkdir(targetDir, { recursive: true });

        const manifest = {
          id: modName.toLowerCase(),
          name: modName,
          version: '1.0.0',
          engine: strArg('gameTarget') || 'Folio Sandbox / Godot 4',
          category: strArg('category') || 'gameplay',
          dependencies: ['core-engine>=4.0', 'evo-render>=1.2', 'liquid-motion>=3.0'],
          plugins: ['pixel-engine-v3', 'rewind-motion', 'sqlite-registry'],
          entrypoints: {
            client: 'sdk/client.js',
            server: 'server/index.js',
          },
        };
        await fs.promises.writeFile(path.join(targetDir, 'mod.json'), JSON.stringify(manifest, null, 2), 'utf8');

        // SDK bindings & Hooks
        const sdkDir = path.join(targetDir, 'sdk');
        await fs.promises.mkdir(sdkDir, { recursive: true });
        const sdkContent = [
          '// Folio Mod Loader SDK v4.1',
          'export class ModSdk {',
          '  constructor(public modId = "' + modName.toLowerCase() + '") {}',
          '  registerHook(event, callback) { console.log(`[ModHook] Registered ${event} for ${this.modId}`); }',
          '  registerItem(itemDef) { return { ok: true, id: itemDef.id }; }',
          '  registerModel(modelId, evoJson) { return { ok: true, id: modelId }; }',
          '}',
          'export const mod = new ModSdk();',
        ].join('\n');
        await fs.promises.writeFile(path.join(sdkDir, 'index.js'), sdkContent, 'utf8');

        // Object IDs JSON
        const objectIds = {
          mod: modName,
          version: '1.0.0',
          registry: {
            items: [{ id: `${modName.toLowerCase()}:energy_crystal`, maxStack: 64, rarity: 'rare' }],
            blocks: [{ id: `${modName.toLowerCase()}:plasma_forge`, hardness: 4.5, lightLevel: 14 }],
            entities: [{ id: `${modName.toLowerCase()}:evo_sentinel`, health: 120, renderType: 'evo_3d' }],
          },
        };
        await fs.promises.writeFile(path.join(targetDir, 'object_ids.json'), JSON.stringify(objectIds, null, 2), 'utf8');

        // SQLite DB creation
        const dataDir = path.join(targetDir, 'data');
        await fs.promises.mkdir(dataDir, { recursive: true });
        const sqliteDbPath = path.join(dataDir, 'database.sqlite');
        try {
          const sqlInit = `
CREATE TABLE IF NOT EXISTS mod_registry (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  attributes TEXT
);
INSERT OR REPLACE INTO mod_registry VALUES ('item_1', 'item', 'Energy Crystal', '{"durability": 500}');
INSERT OR REPLACE INTO mod_registry VALUES ('block_1', 'block', 'Plasma Forge', '{"temperature": 1800}');
`;
          await new Promise<void>((resolve) => {
            const cp = spawn('sqlite3', [sqliteDbPath], { stdio: ['pipe', 'ignore', 'ignore'] });
            cp.stdin.write(sqlInit);
            cp.stdin.end();
            cp.on('close', () => resolve());
            cp.on('error', () => resolve());
          });
        } catch {
          // Non-blocking fallback
        }

        // Models (EVO Engine JSON & Blender Python)
        const modelsDir = path.join(targetDir, 'models');
        await fs.promises.mkdir(modelsDir, { recursive: true });
        const evoModel = {
          format: 'evo/v1',
          objects: [
            { id: 'core', type: 'sphere', radius: 1.5, material: { pbr: 'metallic', color: '#38bdf8', roughness: 0.2 } },
            { id: 'ring', type: 'torus', radius: 2.8, tube: 0.15, material: { pbr: 'emissive', color: '#a855f7' } },
          ],
        };
        await fs.promises.writeFile(path.join(modelsDir, 'model.evo.json'), JSON.stringify(evoModel, null, 2), 'utf8');
        const blenderScript = [
          'import bpy',
          'bpy.ops.wm.read_factory_settings(use_empty=True)',
          'bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.5)',
          'obj = bpy.context.active_object',
          'obj.name = "EvoCore"',
          'print("[Blender] Mod mesh created")',
        ].join('\n');
        await fs.promises.writeFile(path.join(modelsDir, 'generate_mesh.py'), blenderScript, 'utf8');

        // Graphics & Animations
        const graphicsDir = path.join(targetDir, 'graphics');
        await fs.promises.mkdir(graphicsDir, { recursive: true });
        const palette = { format: 'pixelart/v3', palette: ['#090d16', '#38bdf8', '#a855f7', '#f43f5e', '#ffffff'] };
        await fs.promises.writeFile(path.join(graphicsDir, 'palette.json'), JSON.stringify(palette, null, 2), 'utf8');

        const animsDir = path.join(targetDir, 'animations');
        await fs.promises.mkdir(animsDir, { recursive: true });
        const stopMotionAnim = { format: 'stopmotion/v3', fps: 30, layers: [{ name: 'glow', motion: { pulse: { freqHz: 1.5 } } }] };
        await fs.promises.writeFile(path.join(animsDir, 'glow.stopmotion.json'), JSON.stringify(stopMotionAnim, null, 2), 'utf8');

        // CI/CD Automation & Build files
        const ciDir = path.join(targetDir, 'ci');
        await fs.promises.mkdir(ciDir, { recursive: true });
        const workflow = {
          name: `${modName} CI Pipeline`,
          on: ['push', 'build'],
          jobs: [
            { step: 'lint-manifest', run: 'node -e "JSON.parse(require(\'fs\').readFileSync(\'mod.json\'))"' },
            { step: 'verify-db', run: 'sqlite3 data/database.sqlite "SELECT count(*) FROM mod_registry;"' },
            { step: 'package-bundle', run: 'tar -czf dist/' + modName + '.tar.gz sdk models graphics data mod.json' },
          ],
        };
        await fs.promises.writeFile(path.join(ciDir, 'folio.workflow.json'), JSON.stringify(workflow, null, 2), 'utf8');

        const buildDir = path.join(targetDir, 'build');
        await fs.promises.mkdir(buildDir, { recursive: true });
        const cmakeLists = [
          'cmake_minimum_required(VERSION 3.20)',
          `project(${modName} NativeExtension CXX)`,
          'set(CMAKE_CXX_STANDARD 17)',
          'add_library(' + modName + ' SHARED sdk/index.js)',
        ].join('\n');
        await fs.promises.writeFile(path.join(buildDir, 'CMakeLists.txt'), cmakeLists, 'utf8');

        // Server
        const serverDir = path.join(targetDir, 'server');
        await fs.promises.mkdir(serverDir, { recursive: true });
        const serverJs = [
          '// Folio Mod Server',
          'console.log("[ModServer] Initializing ' + modName + ' server runtime...");',
          'export function startServer() { return { status: "running", port: 4800 }; }',
        ].join('\n');
        await fs.promises.writeFile(path.join(serverDir, 'index.js'), serverJs, 'utf8');

        const docsDir = path.join(targetDir, 'docs');
        await fs.promises.mkdir(docsDir, { recursive: true });
        await fs.promises.writeFile(path.join(docsDir, 'README.md'), `# ${modName}\n\nComplete Mod Suite for ${manifest.engine}.\n`, 'utf8');

        const scanned = await scanWorkspaceFiles(targetDir);
        return {
          ok: true,
          modName,
          path: `mods/${modName}`,
          filesCreated: scanned.files.map((f) => f.path),
          sqliteReady: fs.existsSync(sqliteDbPath),
        };
      }

      case 'reverse_engineer': {
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const relPath = strArg('filePath');
        if (!relPath) return { error: 'filePath parameter is required.' };
        const fullPath = resolveWorkspaceFilePath(workspaceDir, relPath);
        if (!fs.existsSync(fullPath)) return { error: `File not found: ${relPath}` };

        const stats = await fs.promises.stat(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const action = (strArg('action') || 'inspect').toLowerCase();

        // 1. GLB / GLTF inspection
        if (ext === '.glb' || ext === '.gltf') {
          if (ext === '.gltf') {
            const raw = await fs.promises.readFile(fullPath, 'utf8');
            try {
              const parsed = JSON.parse(raw);
              return {
                ok: true,
                type: 'gltf',
                file: relPath,
                sizeBytes: stats.size,
                nodes: (parsed.nodes || []).length,
                meshes: (parsed.meshes || []).length,
                materials: (parsed.materials || []).map((m: any) => m.name || 'unnamed'),
                animations: (parsed.animations || []).map((a: any) => a.name || 'anim'),
              };
            } catch {
              return { ok: false, error: 'Malformed glTF JSON' };
            }
          }
          // GLB binary parser
          const fd = await fs.promises.open(fullPath, 'r');
          const headerBuf = Buffer.alloc(12);
          await fd.read(headerBuf, 0, 12, 0);
          const magic = headerBuf.toString('ascii', 0, 4);
          const version = headerBuf.readUInt32LE(4);
          const length = headerBuf.readUInt32LE(8);

          const chunkHeaderBuf = Buffer.alloc(8);
          await fd.read(chunkHeaderBuf, 0, 8, 12);
          const chunkLength = chunkHeaderBuf.readUInt32LE(0);
          const chunkType = chunkHeaderBuf.readUInt32LE(4);

          let jsonChunk: any = {};
          if (chunkType === 0x4e4f534a) {
            const jsonBuf = Buffer.alloc(chunkLength);
            await fd.read(jsonBuf, 0, chunkLength, 20);
            try { jsonChunk = JSON.parse(jsonBuf.toString('utf8')); } catch {}
          }
          await fd.close();

          return {
            ok: true,
            type: 'glb_binary',
            file: relPath,
            sizeBytes: stats.size,
            glbHeader: { magic, version, declaredLength: length },
            nodes: (jsonChunk.nodes || []).length,
            meshes: (jsonChunk.meshes || []).length,
            materials: (jsonChunk.materials || []).map((m: any) => m.name || 'pbr_material'),
            animations: (jsonChunk.animations || []).map((a: any) => a.name || 'anim'),
            generators: jsonChunk.asset?.generator,
          };
        }

        // 2. ZIP / JAR / APK / PCK inspection & extraction
        if (['.zip', '.jar', '.apk', '.pck'].includes(ext)) {
          const extractDirRel = strArg('extractToDir') || `extracted_${path.basename(relPath, ext)}`;
          const fullExtractDir = resolveWorkspaceFilePath(workspaceDir, extractDirRel);
          if (action === 'extract') {
            await fs.promises.mkdir(fullExtractDir, { recursive: true });
            const pyExtract = `
import zipfile, sys
try:
    with zipfile.ZipFile(sys.argv[1], 'r') as zf:
        zf.extractall(sys.argv[2])
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
`;
            const out = await new Promise<string>((resolve) => {
              const cp = spawn('python3', ['-c', pyExtract, fullPath, fullExtractDir]);
              let s = '';
              cp.stdout.on('data', (d) => s += d.toString());
              cp.on('close', () => resolve(s.trim()));
            });
            const files = await scanWorkspaceFiles(fullExtractDir).catch(() => ({ files: [] }));
            return { ok: out.includes('SUCCESS'), action: 'extract', extractedTo: extractDirRel, files: files.files.map((f) => f.path).slice(0, 50) };
          }
          // Inspect contents
          const pyInspect = `
import zipfile, sys, json
try:
    with zipfile.ZipFile(sys.argv[1], 'r') as zf:
        il = [{"name": info.filename, "size": info.file_size} for info in zf.infolist()[:60]]
        print(json.dumps({"ok": True, "entries": il, "total": len(zf.infolist())}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;
          const inspectOut = await new Promise<string>((resolve) => {
            const cp = spawn('python3', ['-c', pyInspect, fullPath]);
            let s = '';
            cp.stdout.on('data', (d) => s += d.toString());
            cp.on('close', () => resolve(s.trim()));
          });
          try {
            return JSON.parse(inspectOut);
          } catch {
            return { ok: false, raw: inspectOut };
          }
        }

        // 3. PNG Chunk analyzer
        if (ext === '.png') {
          const fd = await fs.promises.open(fullPath, 'r');
          const header = Buffer.alloc(8);
          await fd.read(header, 0, 8, 0);
          const isPng = header.toString('hex') === '89504e470d0a1a0a';
          const chunks: Array<{ type: string; length: number; dataSnippet?: string }> = [];
          let offset = 8;
          while (offset < Math.min(stats.size, 1024 * 1024)) {
            const cHeader = Buffer.alloc(8);
            const { bytesRead } = await fd.read(cHeader, 0, 8, offset);
            if (bytesRead < 8) break;
            const cLen = cHeader.readUInt32BE(0);
            const cType = cHeader.toString('ascii', 4, 8);
            let snippet = '';
            if (['tEXt', 'zTXt', 'iTXt', 'IHDR'].includes(cType) && cLen < 4096) {
              const dBuf = Buffer.alloc(cLen);
              await fd.read(dBuf, 0, cLen, offset + 8);
              snippet = dBuf.toString('ascii').replace(/[^\x20-\x7E]/g, ' ');
            }
            chunks.push({ type: cType, length: cLen, dataSnippet: snippet || undefined });
            offset += 12 + cLen;
            if (cType === 'IEND') break;
          }
          await fd.close();
          return { ok: isPng, type: 'png_chunks', file: relPath, sizeBytes: stats.size, chunks };
        }

        // 4. Binary ELF / PE inspection via strings & objdump
        const stringsOut = await new Promise<string[]>((resolve) => {
          const cp = spawn('strings', ['-n', '6', fullPath]);
          let s = '';
          cp.stdout.on('data', (d) => { if (s.length < 32000) s += d.toString(); });
          cp.on('close', () => resolve(s.split('\n').filter((l) => l.trim().length > 5).slice(0, 40)));
          cp.on('error', () => resolve([]));
        });

        return {
          ok: true,
          type: 'binary_disasm',
          file: relPath,
          sizeBytes: stats.size,
          recognizedStrings: stringsOut,
        };
      }

      case 'workspace_fallback_runner': {
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const folderName = strArg('folderName') || 'folio-fallback-task';
        const targetFolder = resolveWorkspaceFilePath(workspaceDir, folderName);
        await fs.promises.mkdir(targetFolder, { recursive: true });

        const command = strArg('command');
        if (!command) return { error: 'command parameter is required.' };

        const timeoutMs = typeof args.timeoutMs === 'number' ? Math.min(60000, Math.max(2000, args.timeoutMs)) : 30000;

        const runOut = await new Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }>((resolve) => {
          const cp = spawn('bash', ['-c', command], {
            cwd: targetFolder,
            env: {
              ...process.env,
              PATH: `/opt/folio-toolchains/java/bin:/opt/folio-toolchains/cmake-dist/bin:${process.env.PATH}`,
              HOME: targetFolder,
              TMPDIR: targetFolder,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '', stderr = '';
          let timedOut = false;
          const t = setTimeout(() => {
            timedOut = true;
            cp.kill('SIGKILL');
          }, timeoutMs);
          cp.stdout.on('data', (d) => { if (stdout.length < 32000) stdout += d.toString(); });
          cp.stderr.on('data', (d) => { if (stderr.length < 16000) stderr += d.toString(); });
          cp.on('close', (c) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: c ?? 0, timedOut }); });
          cp.on('error', (e) => { clearTimeout(t); resolve({ stdout: '', stderr: e.message, exitCode: 1, timedOut }); });
        });

        const scanned = await scanWorkspaceFiles(targetFolder).catch(() => ({ files: [] }));
        return {
          ok: runOut.exitCode === 0 && !runOut.timedOut,
          workspaceId: wsId,
          folder: folderName,
          exitCode: runOut.exitCode,
          timedOut: runOut.timedOut,
          stdout: runOut.stdout,
          stderr: runOut.stderr,
          generatedFiles: scanned.files.map((f) => f.path).slice(0, 40),
        };
      }

      case 'meta_script_run': {
        const scriptCode = strArg('scriptCode');
        if (!scriptCode) return { error: 'scriptCode is required.' };
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);

        const runnerScript = path.join(workspaceDir, '.folio_meta_runner.mjs');
        const wrappedCode = `
import fs from 'fs';
import path from 'path';
const WORKSPACE_DIR = ${JSON.stringify(workspaceDir)};
async function run() {
${scriptCode}
}
run().then(res => console.log('META_RESULT:', JSON.stringify(res ?? { ok: true }))).catch(err => console.error('META_ERROR:', err.message));
`;
        await fs.promises.writeFile(runnerScript, wrappedCode, 'utf8');

        const out = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
          const cp = spawn('node', [runnerScript], {
            cwd: workspaceDir,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '', stderr = '';
          const t = setTimeout(() => cp.kill('SIGKILL'), 15000);
          cp.stdout.on('data', (d) => { stdout += d.toString(); });
          cp.stderr.on('data', (d) => { stderr += d.toString(); });
          cp.on('close', (c) => { clearTimeout(t); resolve({ stdout, stderr, exitCode: c ?? 0 }); });
          cp.on('error', (e) => { clearTimeout(t); resolve({ stdout: '', stderr: e.message, exitCode: 1 }); });
        });

        await fs.promises.rm(runnerScript, { force: true }).catch(() => {});
        return {
          ok: out.exitCode === 0,
          stdout: out.stdout.slice(-16000),
          stderr: out.stderr.slice(-8000),
        };
      }

      case 'antigravity_cli': {
        const action = (strArg('action') || 'inspect').toLowerCase();
        const task = strArg('task') || 'Inspect active workspace and summarize structure.';
        const reqMode = (strArg('mode') || 'auto').toLowerCase();
        const agentModel = strArg('agentModel') || 'gemini-4-carbon';
        const wsId = sanitizeWorkspaceId(strArg('workspaceId') || ctx.activeWorkspaceId);
        const workspaceDir = getWorkspaceDir(wsId);
        const backupDir = path.join(__dirname, '.folio-data', 'backups');
        const backups = fs.existsSync(backupDir)
          ? (await fs.promises.readdir(backupDir)).filter((f) => f.endsWith('.tar.gz'))
          : [];

        if (action === 'status') {
          return {
            ok: true,
            cli: 'antigravity_cli',
            agent: 'antigravity-preview-09-2026',
            cloudReady: Boolean(process.env.GEMINI_API_KEY),
            localSandboxReady: true,
            workspaceId: wsId,
            backupsAvailable: backups,
          };
        }

        if (reqMode === 'cloud' && process.env.GEMINI_API_KEY) {
          const ai = createGeminiClient();
          const interaction = await ai.interactions.create(
            {
              agent: 'antigravity-preview-09-2026',
              input: task,
              environment: 'remote',
              agent_config: {
                type: 'antigravity',
                model: agentModel,
                max_total_tokens: '120000',
              },
            },
            { timeout: 120000 }
          );
          let fullOutput = '';
          const stepSummary: Array<{ type: string; detail?: string }> = [];
          if (Array.isArray(interaction.steps)) {
            for (const step of interaction.steps) {
              stepSummary.push({ type: step.type });
              if (step.type === 'model_output' && Array.isArray(step.content)) {
                for (const c of step.content) {
                  if (c.type === 'text' && c.text) fullOutput += c.text;
                }
              }
            }
          }
          if (!fullOutput && interaction.output_text) {
            fullOutput = interaction.output_text;
          }
          return {
            ok: true,
            mode: 'cloud',
            agent: 'antigravity-preview-09-2026',
            model: agentModel,
            interactionId: interaction.id,
            steps: stepSummary.slice(0, 20),
            output: fullOutput.slice(0, 16000),
            backupsAvailable: backups,
          };
        }

        const scan = await scanWorkspaceFiles(workspaceDir).catch(() => ({
          files: [],
          entryFolders: [],
        }));
        let commandStdout = '';
        let commandStderr = '';
        let exitCode = 0;

        if (action === 'run' || action === 'test') {
          const cmdToRun =
            action === 'test' && task === 'Inspect active workspace and summarize structure.'
              ? 'ls -la'
              : task;
          const runResult = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
            const cp = spawn('bash', ['-lc', cmdToRun], {
              cwd: workspaceDir,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '', stderr = '';
            const timer = setTimeout(() => cp.kill('SIGKILL'), 15000);
            cp.stdout.on('data', (d) => { if (stdout.length < 16000) stdout += d.toString(); });
            cp.stderr.on('data', (d) => { if (stderr.length < 8000) stderr += d.toString(); });
            cp.on('close', (c) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: c ?? 0 }); });
            cp.on('error', (e) => { clearTimeout(timer); resolve({ stdout: '', stderr: e.message, exitCode: 1 }); });
          });
          commandStdout = runResult.stdout;
          commandStderr = runResult.stderr;
          exitCode = runResult.exitCode;
        }

        return {
          ok: exitCode === 0,
          mode: 'local-sandbox',
          cli: 'antigravity_cli',
          agent: 'antigravity-preview-09-2026',
          workspaceId: wsId,
          task,
          fileCount: scan.files.length,
          files: scan.files.slice(0, 30).map((f) => f.path),
          stdout: commandStdout,
          stderr: commandStderr,
          exitCode,
          backupsAvailable: backups,
        };
      }

      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : `Tool "${name}" execution failed.`,
    };
  }
}

app.post('/api/tools/execute', async (req: Request, res: Response) => {
  const { name, args, activeWorkspaceId, customTools } = req.body as {
    name?: string;
    args?: Record<string, unknown>;
    activeWorkspaceId?: string;
    customTools?: IncomingCustomToolDef[];
  };
  if (!name || !name.trim()) {
    res.status(400).json({ ok: false, error: 'Tool name is required.' });
    return;
  }

  const cleanName = name.trim();
  const startedAt = Date.now();
  const ghToken = getGitHubTokenForRequest(req);
  const wsId = sanitizeWorkspaceId(activeWorkspaceId || 'folio-sandbox-1');

  const matchingCustom = Array.isArray(customTools)
    ? customTools.find((t) => t && t.name === cleanName)
    : undefined;

  const result = matchingCustom
    ? executeCustomToolVm(matchingCustom, args || {})
    : await executeChatToolCall(cleanName, args || {}, {
        ghToken,
        activeWorkspaceId: wsId,
      });

  res.json({
    ok: !result.error,
    name: cleanName,
    durationMs: Date.now() - startedAt,
    result,
  });
});

app.get('/api/toolchains/status', async (_req: Request, res: Response) => {
  const godot = getGodotBinary();
  const cmake = getCmakeBinary();
  const ninja = getNinjaBinary();
  const kotlinc = getKotlinBinary();
  const java = getJavaBinary();
  const clang = getClangBinary();
  const mingw = getMingwGxxBinary();
  const blender = getBlenderBinary();
  const gh = getGitHubCliBinary();
  const msvcTc = fs.existsSync('/opt/folio-toolchains/cmake/msvc-x64.cmake');
  const neo4Engine = fs.existsSync(path.join(__dirname, 'python', 'neo4_engine.py'));

  res.json({
    ok: true,
    version: '4.2',
    codename: FOLIO_CURRENT_VERSION,
    toolchains: {
      godot: { available: Boolean(godot), path: godot, version: '4.3-stable' },
      cmake: { available: Boolean(cmake), path: cmake, version: '3.25+' },
      ninja: { available: Boolean(ninja), path: ninja },
      clang: { available: Boolean(clang), path: clang },
      msvcWindowsCross: { available: Boolean(mingw && msvcTc), toolchain: '/opt/folio-toolchains/cmake/msvc-x64.cmake' },
      kotlin: { available: Boolean(kotlinc), path: kotlinc, version: '2.0.21' },
      java: { available: Boolean(java), path: java, version: 'Adoptium 21 LTS' },
      blender: { available: Boolean(blender), path: blender },
      sqlite: { available: fs.existsSync('/usr/bin/sqlite3') },
      neo4PythonEngine: { available: neo4Engine, path: 'python/neo4_engine.py' },
      antigravityCli: {
        available: true,
        agent: 'antigravity-preview-09-2026',
        cloudReady: Boolean(process.env.GEMINI_API_KEY),
        localSandboxReady: true,
      },
      ghCli: { available: Boolean(gh), path: gh },
    },
    exportPresetsSupported: ['Linux/X11', 'Windows Desktop', 'macOS', 'Web', 'Android', 'iOS'],
  });
});

app.post('/api/toolchains/antigravity', async (req: Request, res: Response) => {
  const { action, task, agentModel, mode, workspaceId } = req.body as Record<string, unknown>;
  const wsId = sanitizeWorkspaceId(typeof workspaceId === 'string' ? workspaceId : 'folio-sandbox-1');
  const startedAt = Date.now();
  try {
    const result = await executeChatToolCall(
      'antigravity_cli',
      {
        action: typeof action === 'string' ? action : 'inspect',
        task: typeof task === 'string' ? task : 'Inspect workspace files',
        agentModel: typeof agentModel === 'string' ? agentModel : 'gemini-4-carbon',
        mode: typeof mode === 'string' ? mode : 'auto',
        workspaceId: wsId,
      },
      { ghToken: null, activeWorkspaceId: wsId }
    );
    res.json({ ok: !result.error && result.ok !== false, durationMs: Date.now() - startedAt, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Antigravity CLI failed.' });
  }
});

app.post('/api/toolchains/build', async (req: Request, res: Response) => {
  const { toolchain, action, sourceFile, outputJar, targetPlatform, sourceDir, buildDir, target, scriptPath, workspaceId } = req.body as Record<string, unknown>;
  const wsId = sanitizeWorkspaceId(typeof workspaceId === 'string' ? workspaceId : 'folio-sandbox-1');
  const startedAt = Date.now();

  try {
    let result: Record<string, unknown>;
    if (toolchain === 'kotlin') {
      result = await executeChatToolCall('kotlin_compile', {
        sourceFile,
        outputJar,
        includeRuntime: true,
        runAfterBuild: Boolean(req.body.runAfterBuild),
        workspaceId: wsId,
      }, { ghToken: null, activeWorkspaceId: wsId });
    } else if (toolchain === 'cmake') {
      result = await executeChatToolCall('cmake_build', {
        sourceDir,
        buildDir,
        targetPlatform,
        target,
        workspaceId: wsId,
      }, { ghToken: null, activeWorkspaceId: wsId });
    } else if (toolchain === 'godot') {
      result = await executeChatToolCall('godot_cli', {
        action: action || 'version',
        scriptPath,
        workspaceId: wsId,
      }, { ghToken: null, activeWorkspaceId: wsId });
    } else {
      res.status(400).json({ ok: false, error: `Unknown toolchain "${toolchain}". Supported: kotlin, cmake, godot.` });
      return;
    }
    res.json({ ok: !result.error && result.ok !== false, durationMs: Date.now() - startedAt, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Build failed.' });
  }
});

app.post('/api/reverse-engineer', async (req: Request, res: Response) => {
  const { filePath, action, extractToDir, workspaceId } = req.body as Record<string, unknown>;
  const wsId = sanitizeWorkspaceId(typeof workspaceId === 'string' ? workspaceId : 'folio-sandbox-1');
  if (!filePath || typeof filePath !== 'string') {
    res.status(400).json({ ok: false, error: 'filePath parameter is required.' });
    return;
  }
  const startedAt = Date.now();
  try {
    const result = await executeChatToolCall('reverse_engineer', {
      filePath,
      action: action || 'inspect',
      extractToDir,
      workspaceId: wsId,
    }, { ghToken: null, activeWorkspaceId: wsId });
    res.json({ ok: !result.error && result.ok !== false, durationMs: Date.now() - startedAt, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Reverse engineering failed.' });
  }
});

app.get('/api/docs', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;
  const sections = q ? searchFolioDocs(q, limit) : FOLIO_DOCS_SECTIONS;
  res.json({
    ok: true,
    version: FOLIO_CURRENT_VERSION,
    query: q,
    total: FOLIO_DOCS_SECTIONS.length,
    sections,
  });
});

app.get('/api/changelog', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    currentVersion: FOLIO_CURRENT_VERSION,
    changelogs: FOLIO_CHANGELOGS,
  });
});

app.get('/api/system/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    ...getSystemHealthSnapshot(),
  });
});

app.get('/api/system/backups', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    backups: listFolioBackups(),
  });
});

app.post('/api/system/backup', async (req: Request, res: Response) => {
  const label = typeof req.body?.label === 'string' ? req.body.label : undefined;
  const created = await createFolioBackup(label);
  if (!created.ok) {
    res.status(500).json({ ok: false, error: created.error || 'Backup failed.' });
    return;
  }
  res.json({
    ok: true,
    backup: created,
    backups: listFolioBackups(),
  });
});

function getBlenderBinary(): string | null {
  const candidates = [
    '/opt/folio-toolchains/blender/blender',
    path.join(FOLIO_BIN_DIR, 'blender'),
    '/usr/local/bin/blender',
    '/usr/bin/blender',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getGitHubCliBinary(): string | null {
  const localGh = path.join(FOLIO_BIN_DIR, 'gh');
  if (fs.existsSync(localGh)) return localGh;
  if (fs.existsSync('/usr/local/bin/gh')) return '/usr/local/bin/gh';
  if (fs.existsSync('/usr/bin/gh')) return '/usr/bin/gh';
  return null;
}

async function ensureGitHubCliInstalled() {
  if (getGitHubCliBinary()) return;
  if (os.platform() !== 'linux' || os.arch() !== 'x64') return;
  let tmpDir = '';
  try {
    fs.mkdirSync(FOLIO_BIN_DIR, { recursive: true });
    const relRes = await fetch('https://api.github.com/repos/cli/cli/releases/latest', {
      headers: { 'User-Agent': 'Folio-Studio' },
    });
    if (!relRes.ok) return;
    const relJson = (await relRes.json()) as {
      assets?: Array<{ name: string; browser_download_url: string }>;
    };
    const asset = (relJson.assets || []).find((a) => /linux_amd64\.tar\.gz$/.test(a.name));
    if (!asset) return;

    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'folio-gh-boot-'));
    const tgzPath = path.join(tmpDir, 'gh.tar.gz');
    const dlRes = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'Folio-Studio' },
    });
    if (!dlRes.ok) return;
    const bytes = Buffer.from(await dlRes.arrayBuffer());
    await fs.promises.writeFile(tgzPath, bytes);

    const extractRes = await new Promise<number>((resolve) => {
      const child = spawn('tar', ['-xzf', tgzPath, '-C', tmpDir], { stdio: 'ignore' });
      child.on('close', (c) => resolve(c ?? 1));
      child.on('error', () => resolve(1));
    });
    if (extractRes !== 0) return;

    const extractedDirs = await fs.promises.readdir(tmpDir);
    const ghFolder = extractedDirs.find((d) => d.startsWith('gh_') && d.endsWith('_linux_amd64'));
    if (!ghFolder) return;
    const binSrc = path.join(tmpDir, ghFolder, 'bin', 'gh');
    const binDst = path.join(FOLIO_BIN_DIR, 'gh');
    if (fs.existsSync(binSrc)) {
      await fs.promises.copyFile(binSrc, binDst);
      await fs.promises.chmod(binDst, 0o755);
      console.log(`GitHub CLI installed at ${binDst}`);
    }
  } catch {
    // Non-fatal background bootstrap
  } finally {
    if (tmpDir) {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function ensureFolioDocsIndexedOnBoot(): Promise<void> {
  try {
    fs.mkdirSync(FOLIO_NEO4_DIR, { recursive: true });
    const docsDbPath = path.join(FOLIO_NEO4_DIR, 'folio_docs.db');
    if (fs.existsSync(docsDbPath) && fs.statSync(docsDbPath).size > 4096) return;
    const trainerScript = path.join(__dirname, 'python', 'neo4_trainer.py');
    if (!fs.existsSync(trainerScript)) return;
    const payload = JSON.stringify({
      sections: FOLIO_DOCS_SECTIONS,
      changelogs: FOLIO_CHANGELOGS,
      version: FOLIO_CURRENT_VERSION,
    });
    const child = spawn('python3', [trainerScript, '--ingest-folio-docs'], {
      cwd: __dirname,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    child.stdin.write(payload);
    child.stdin.end();
  } catch {
    // Non-fatal boot docs index
  }
}

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

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    void ensureGitHubCliInstalled();
    void ensureFolioDocsIndexedOnBoot();
  });
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${PORT} is in use, trying port 0 (random ephemeral)...`);
      const fallbackServer = app.listen(0, '0.0.0.0', () => {
        const addr = fallbackServer.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : 0;
        console.log(`Server fallback listening on http://0.0.0.0:${actualPort}`);
        void ensureGitHubCliInstalled();
        void ensureFolioDocsIndexedOnBoot();
      });
      fallbackServer.requestTimeout = 300_000;
      fallbackServer.headersTimeout = 66_000;
      fallbackServer.keepAliveTimeout = 65_000;
    } else {
      console.error('Server listen error:', err);
    }
  });
  httpServer.requestTimeout = 300_000;
  httpServer.headersTimeout = 66_000;
  httpServer.keepAliveTimeout = 65_000;
}

startServer();
