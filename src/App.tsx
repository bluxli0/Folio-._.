import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ChatAttachment,
  ChatImageResult,
  ChatMessage,
  ConversationThread,
  CustomFunctionToolDef,
  FontPresetId,
  InstructionProfile,
  ModelChoiceId,
  RetentionMode,
  SafetyFiltersConfig,
  SafetyLevel,
  ToolCallRecord,
  TriModelConfig,
} from './types/chat';
import {
  DEFAULT_SAFETY_FILTERS,
  DEFAULT_TRI_MODEL_CONFIG,
  RETENTION_OPTIONS,
  STARTER_PROMPTS,
  SYSTEM_PRESETS,
  getModelOption,
  getSafetySummaryLabel,
} from './data/presets';
import {
  deleteCustomInstruction,
  deleteCustomTool,
  ensureUserProfileDoc,
  fetchUserPreferences,
  saveCustomInstruction,
  saveCustomTool,
  subscribeAuthUser,
  subscribeCustomInstructions,
  subscribeCustomTools,
} from './firebase';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { MessageItem } from './components/MessageItem';
import { Composer } from './components/Composer';
import { InstructionsModal } from './components/InstructionsModal';
import { SafetyFiltersModal } from './components/SafetyFiltersModal';
import { SessionPrivacyModal } from './components/SessionPrivacyModal';
import { ChangelogsModal } from './components/ChangelogsModal';
import { AccountModal } from './components/AccountModal';
import { FunctionToolsModal } from './components/FunctionToolsModal';
import { CodePreviewData, CodePreviewPanel } from './components/CodePreviewPanel';
import { StopMotionPanel } from './components/StopMotionPanel';
import { PixelArtStudio } from './components/PixelArtStudio';
import { ThreeDStudio } from './components/ThreeDStudio';
import { GoogleFlowPanel } from './components/GoogleFlowPanel';
import { WebPreviewPanel } from './components/WebPreviewPanel';
import { VectorStopMotionSpec } from './types/stopMotion';
import { PixelArtSpec } from './types/pixelArt';
import { ThreeDSceneSpec } from './types/threeD';
import { getContextualGreeting } from './utils/greetings';
import {
  exportThreadAsJson,
  exportThreadAsMarkdown,
  exportThreadAsXml,
} from './utils/threadExport';
import { parseVectorStopMotionCode } from './utils/vectorBrushes';
import { evaluateStopMotionFidelity, isStopMotionSceneV2 } from './utils/stopMotionEngine';
import { parsePixelArtCode } from './utils/pixelArtParser';
import { HybridEngineKind, parseHybridCode } from './utils/hybridEngines';
import { parseEvoCode } from './utils/evoEngine';
import { FONT_PRESETS, extractChatHeadings } from './utils/textFormatting';

const STORAGE_KEY = 'folio-threads-v1';
const THEME_KEY = 'folio-theme';
const ALLOW_ALL_SESSIONS_KEY = 'folio-allow-all-sessions-v1';
const FONT_PRESET_KEY = 'folio-font-preset-v1';
const DEFAULT_PURE_CODE_KEY = 'folio-default-pure-code-v1';
const LOCAL_INSTRUCTIONS_KEY = 'folio-saved-instructions-v1';
const LOCAL_TOOLS_KEY = 'folio-custom-tools-v1';
const DEFAULT_SYSTEM_INSTRUCTION = SYSTEM_PRESETS[0].instruction;

const STARTER_PREVIEW_CODE = `<div style="max-width:420px;margin:24px auto;padding:24px;border-radius:16px;border:1px solid rgba(128,128,128,0.22);font-family:system-ui,sans-serif;">
  <h2 style="margin:0 0 8px;font-size:18px;">Universal Code Preview</h2>
  <p style="margin:0 0 16px;font-size:14px;opacity:0.8;">
    Switch to the Code tab to paste HTML, React (JSX/TSX), CSS, JavaScript, TypeScript, SVG, Markdown, Mermaid, JSON, CSV, Python, SQL, or any other language.
  </p>
  <button id="demo-btn" style="padding:8px 14px;border-radius:999px;border:none;background:#0d0d0d;color:#fff;cursor:pointer;font-size:13px;">
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
</script>`;

const VALID_MODEL_IDS = new Set<ModelChoiceId>([
  'auto',
  'flash-lite-3.1',
  'hydrogen-4-fast',
  'hydrogen-4-balanced',
  'hydrogen-4-deep',
  'neon-4',
  'carbon-4',
  'nano-banana-lite',
]);

const VALID_RETENTION_MODES = new Set<RetentionMode>([
  'session',
  '5m',
  '1h',
  '24h',
  'permanent',
]);

function evaluateAssistantCreativeRating(
  text: string
): { score: number; notes: string[] } | undefined {
  if (!text) return undefined;
  const regex =
    /```(stopmotion(?:\/v[23])?|pixelart(?:\/v[23])?|liquidmotion|liquiddrop|pixelmotion|motiondrop|evo)\b[^\n]*\n([\s\S]*?)```/gi;
  const match = regex.exec(text);
  if (!match) return undefined;

  const lang = match[1].toLowerCase();
  const body = match[2];

  if (lang === 'evo') {
    const parsed = parseEvoCode(body);
    return parsed.spec?.fidelity;
  }

  if (lang.startsWith('stopmotion')) {
    const parsed = parseVectorStopMotionCode(body);
    if (parsed.spec && isStopMotionSceneV2(parsed.spec.sourceScene)) {
      const fid = evaluateStopMotionFidelity(parsed.spec.sourceScene);
      return { score: fid.score, notes: fid.notes };
    }
    if (parsed.spec) {
      return {
        score: parsed.spec.frames.length >= 12 ? 84 : 74,
        notes: [
          `Stop Motion compiled ${parsed.spec.frames.length} keyframe(s) @ ${parsed.spec.fps}fps`,
        ],
      };
    }
    return undefined;
  }

  if (lang.startsWith('pixelart')) {
    const parsed = parsePixelArtCode(body);
    if (parsed.spec) {
      const dims = `${parsed.spec.width}×${parsed.spec.height}`;
      const hasShaders = Boolean(parsed.spec.shaders && parsed.spec.shaders.length > 0);
      const score = Math.min(
        100,
        74 +
          (parsed.spec.width >= 64 ? 10 : 4) +
          (parsed.spec.frames.length > 1 ? 8 : 2) +
          (hasShaders ? 8 : 0)
      );
      return {
        score,
        notes: [
          `Pixel v3 compiled ${dims}px (${parsed.spec.frames.length} frame${parsed.spec.frames.length === 1 ? '' : 's'})`,
          hasShaders ? 'Post-processing shaders active' : 'Crisp integer pixel grid ready',
        ],
      };
    }
    return undefined;
  }

  if (
    lang === 'liquidmotion' ||
    lang === 'liquiddrop' ||
    lang === 'pixelmotion' ||
    lang === 'motiondrop'
  ) {
    const res = parseHybridCode(lang as HybridEngineKind, body);
    if (res.result?.fidelity) {
      return res.result.fidelity;
    }
  }

  return undefined;
}

function getDefaultPureCodePref(): boolean {
  try {
    return localStorage.getItem(DEFAULT_PURE_CODE_KEY) === 'true';
  } catch {
    return false;
  }
}

function createNewThread(
  modelId: ModelChoiceId = 'auto',
  safetyFilters: SafetyFiltersConfig = { ...DEFAULT_SAFETY_FILTERS },
  opts?: { incognito?: boolean; retention?: RetentionMode; immersivePureCode?: boolean }
): ConversationThread {
  const now = Date.now();
  const retention: RetentionMode =
    opts?.retention || (opts?.incognito ? 'session' : 'permanent');
  const retentionOpt = RETENTION_OPTIONS.find((r) => r.id === retention);
  return {
    id: crypto.randomUUID(),
    title: opts?.incognito ? 'Incognito chat' : 'New chat',
    messages: [],
    modelId,
    autoFallback: true,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
    safetyFilters,
    immersivePureCode: opts?.immersivePureCode ?? getDefaultPureCodePref(),
    incognito: opts?.incognito || false,
    retention,
    expiresAt: retentionOpt?.ttlMs ? now + retentionOpt.ttlMs : undefined,
    triModelConfig: { ...DEFAULT_TRI_MODEL_CONFIG },
    createdAt: now,
    updatedAt: now,
  };
}

function isValidSafetyLevel(val: unknown): val is SafetyLevel {
  return val === 'max' || val === 'medium' || val === 'low' || val === 'none';
}

function normalizeThread(raw: Partial<ConversationThread> & Record<string, unknown>): ConversationThread {
  const now = Date.now();
  let modelId: ModelChoiceId = 'auto';
  if (typeof raw.modelId === 'string' && VALID_MODEL_IDS.has(raw.modelId as ModelChoiceId)) {
    modelId = raw.modelId as ModelChoiceId;
  } else if (raw.reasoningMode === 'balanced') {
    modelId = 'hydrogen-4-balanced';
  } else if (raw.reasoningMode === 'deep') {
    modelId = 'hydrogen-4-deep';
  }

  const rawSafety = (raw.safetyFilters || {}) as Partial<Record<string, unknown>>;
  const safetyFilters: SafetyFiltersConfig = {
    harassment: isValidSafetyLevel(rawSafety.harassment)
      ? rawSafety.harassment
      : DEFAULT_SAFETY_FILTERS.harassment,
    hateSpeech: isValidSafetyLevel(rawSafety.hateSpeech)
      ? rawSafety.hateSpeech
      : DEFAULT_SAFETY_FILTERS.hateSpeech,
    sexuallyExplicit: isValidSafetyLevel(rawSafety.sexuallyExplicit)
      ? rawSafety.sexuallyExplicit
      : DEFAULT_SAFETY_FILTERS.sexuallyExplicit,
    dangerousContent: isValidSafetyLevel(rawSafety.dangerousContent)
      ? rawSafety.dangerousContent
      : DEFAULT_SAFETY_FILTERS.dangerousContent,
  };

  const retention: RetentionMode =
    typeof raw.retention === 'string' && VALID_RETENTION_MODES.has(raw.retention as RetentionMode)
      ? (raw.retention as RetentionMode)
      : raw.incognito
      ? 'session'
      : 'permanent';

  const rawTri = raw.triModelConfig as Partial<TriModelConfig> | undefined;
  const triModelConfig: TriModelConfig = rawTri
    ? {
        enabled: Boolean(rawTri.enabled),
        models:
          Array.isArray(rawTri.models) && rawTri.models.length >= 2
            ? rawTri.models.filter((id): id is ModelChoiceId => VALID_MODEL_IDS.has(id)).slice(0, 3)
            : [...DEFAULT_TRI_MODEL_CONFIG.models],
        autonomousTurns:
          typeof rawTri.autonomousTurns === 'number'
            ? Math.max(0, Math.min(5, Math.round(rawTri.autonomousTurns)))
            : 0,
        linkTempSessions: Boolean(rawTri.linkTempSessions),
        autonomousPrompt:
          typeof rawTri.autonomousPrompt === 'string'
            ? rawTri.autonomousPrompt
            : DEFAULT_TRI_MODEL_CONFIG.autonomousPrompt,
      }
    : { ...DEFAULT_TRI_MODEL_CONFIG };

  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    title: typeof raw.title === 'string' && raw.title ? raw.title : 'New chat',
    messages: Array.isArray(raw.messages) ? (raw.messages as ChatMessage[]) : [],
    modelId,
    autoFallback: typeof raw.autoFallback === 'boolean' ? raw.autoFallback : true,
    systemInstruction:
      typeof raw.systemInstruction === 'string'
        ? raw.systemInstruction
        : DEFAULT_SYSTEM_INSTRUCTION,
    safetyFilters,
    immersivePureCode: Boolean(raw.immersivePureCode),
    incognito: Boolean(raw.incognito),
    retention,
    expiresAt: typeof raw.expiresAt === 'number' ? raw.expiresAt : undefined,
    triModelConfig,
    groupName: typeof raw.groupName === 'string' && raw.groupName.trim() ? raw.groupName.trim() : undefined,
    sharedThreadIds: Array.isArray(raw.sharedThreadIds)
      ? raw.sharedThreadIds.filter((s): s is string => typeof s === 'string')
      : undefined,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

function loadInitialThreads(): ConversationThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createNewThread()];
    const parsed = JSON.parse(raw) as Array<Partial<ConversationThread> & Record<string, unknown>>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const now = Date.now();
      const valid = parsed
        .map(normalizeThread)
        .filter((t) => !t.expiresAt || t.expiresAt > now);
      if (valid.length > 0) return valid;
    }
  } catch {
    // Ignore storage read errors
  }
  return [createNewThread()];
}

export default function App() {
  const [threads, setThreads] = useState<ConversationThread[]>(loadInitialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    const initial = loadInitialThreads();
    return initial[0].id;
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [instructionsModalOpen, setInstructionsModalOpen] = useState(false);
  const [instructionsStartCreating, setInstructionsStartCreating] = useState(false);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [changelogsOpen, setChangelogsOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [fontPreset, setFontPreset] = useState<FontPresetId>(() => {
    try {
      const saved = localStorage.getItem(FONT_PRESET_KEY) as FontPresetId | null;
      if (saved && FONT_PRESETS.some((p) => p.id === saved)) return saved;
    } catch {
      // Ignore storage read error
    }
    return 'studio-sans';
  });
  const [defaultPureCode, setDefaultPureCode] = useState<boolean>(getDefaultPureCodePref);
  const [savedInstructions, setSavedInstructions] = useState<InstructionProfile[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_INSTRUCTIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as InstructionProfile[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });
  const [customTools, setCustomTools] = useState<CustomFunctionToolDef[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_TOOLS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CustomFunctionToolDef[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });
  const [allowAllSessionsView, setAllowAllSessionsView] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ALLOW_ALL_SESSIONS_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [codePreview, setCodePreview] = useState<CodePreviewData | null>(null);
  const [stopMotionOpen, setStopMotionOpen] = useState(false);
  const [loadedStopMotionSpec, setLoadedStopMotionSpec] =
    useState<VectorStopMotionSpec | null>(null);
  const [pixelArtOpen, setPixelArtOpen] = useState(false);
  const [loadedPixelArtSpec, setLoadedPixelArtSpec] =
    useState<PixelArtSpec | null>(null);
  const [threeDOpen, setThreeDOpen] = useState(false);
  const [googleFlowOpen, setGoogleFlowOpen] = useState(false);
  const [webPreviewUrl, setWebPreviewUrl] = useState<string | null>(null);
  const [loadedThreeDSpec, setLoadedThreeDSpec] =
    useState<ThreeDSceneSpec | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  // Sync typography preset to HTML root dataset + CSS variables
  useEffect(() => {
    const meta = FONT_PRESETS.find((p) => p.id === fontPreset) || FONT_PRESETS[0];
    document.documentElement.dataset.fontPreset = meta.id;
    document.documentElement.style.setProperty('--font-sans', meta.sansFamily);
    document.documentElement.style.setProperty('--font-display', meta.displayFamily);
    try {
      localStorage.setItem(FONT_PRESET_KEY, meta.id);
    } catch {
      // Ignore storage error
    }
  }, [fontPreset]);

  // Firebase Auth & Firestore realtime sync (fallback to localStorage when signed out)
  useEffect(() => {
    let unsubInst: (() => void) | null = null;
    let unsubTools: (() => void) | null = null;

    const unsubAuth = subscribeAuthUser((user) => {
      setAuthUser(user);
      unsubInst?.();
      unsubTools?.();
      unsubInst = null;
      unsubTools = null;

      if (user && user.emailVerified) {
        void ensureUserProfileDoc(user).catch(() => {});
        void fetchUserPreferences(user.uid)
          .then((prefs) => {
            if (prefs?.fontPreset && FONT_PRESETS.some((p) => p.id === prefs.fontPreset)) {
              setFontPreset(prefs.fontPreset);
            }
            if (typeof prefs?.defaultPureCode === 'boolean') {
              setDefaultPureCode(prefs.defaultPureCode);
            }
          })
          .catch(() => {});
        unsubInst = subscribeCustomInstructions(
          user.uid,
          (items) => setSavedInstructions(items),
          () => {}
        );
        unsubTools = subscribeCustomTools(
          user.uid,
          (items) => setCustomTools(items),
          () => {}
        );
      } else {
        try {
          const rawInst = localStorage.getItem(LOCAL_INSTRUCTIONS_KEY);
          if (rawInst) setSavedInstructions(JSON.parse(rawInst) as InstructionProfile[]);
          const rawTools = localStorage.getItem(LOCAL_TOOLS_KEY);
          if (rawTools) setCustomTools(JSON.parse(rawTools) as CustomFunctionToolDef[]);
        } catch {
          // Ignore parse error
        }
      }
    });

    return () => {
      unsubAuth();
      unsubInst?.();
      unsubTools?.();
    };
  }, []);

  // Periodic retention expiration cleanup (every 30s)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setThreads((prev) => {
        const hasExpired = prev.some((t) => t.expiresAt && t.expiresAt <= now);
        if (!hasExpired) return prev;
        const alive = prev.filter((t) => !t.expiresAt || t.expiresAt > now);
        if (alive.length === 0) {
          const fresh = createNewThread();
          setActiveThreadId(fresh.id);
          return [fresh];
        }
        if (!alive.some((t) => t.id === activeThreadId)) {
          setActiveThreadId(alive[0].id);
        }
        return alive;
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [activeThreadId]);

  // Exclude incognito/session-only threads & trim oversized inline attachment data before saving to localStorage
  useEffect(() => {
    const persistable = threads
      .filter((t) => !t.incognito && t.retention !== 'session')
      .map((t) => ({
        ...t,
        messages: t.messages.map((m) => ({
          ...m,
          attachments: m.attachments?.map((a) => ({
            ...a,
            textContent:
              a.textContent && a.textContent.length > 64_000
                ? a.textContent.slice(0, 64_000)
                : a.textContent,
            data: a.data && a.data.length > 256_000 ? undefined : a.data,
            previewUrl: a.previewUrl && a.previewUrl.length > 256_000 ? undefined : a.previewUrl,
          })),
        })),
      }));

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch {
      try {
        const compact = persistable.map((t) => ({
          ...t,
          messages: t.messages.map((m) => ({
            ...m,
            attachments: m.attachments?.map((a) => ({
              ...a,
              data: undefined,
              previewUrl: undefined,
              textContent: a.textContent?.slice(0, 4000),
            })),
          })),
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
      } catch {
        // Storage unavailable
      }
    }
  }, [threads]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 110;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom && (activeThread?.messages.length ?? 0) > 0);
  }, [activeThread?.messages.length]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom('auto');
    }
  }, [activeThread?.messages, scrollToBottom]);

  const updateThread = useCallback(
    (threadId: string, updater: (thread: ConversationThread) => ConversationThread) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? updater(t) : t))
      );
    },
    []
  );

  const generateThreadTitle = useCallback(
    async (threadId: string, firstPrompt: string) => {
      try {
        const res = await fetch('/api/chat/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: firstPrompt }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { title?: string };
        if (data.title) {
          updateThread(threadId, (t) =>
            t.title === 'New chat' || t.title === 'New conversation'
              ? { ...t, title: data.title! }
              : t
          );
        }
      } catch {
        // Non-critical title generation failure
      }
    },
    [updateThread]
  );

  const streamAssistantResponse = useCallback(
    async (
      threadId: string,
      historyMessages: ChatMessage[],
      assistantMessageId: string,
      modelId: ModelChoiceId,
      autoFallback: boolean,
      systemInstruction: string,
      safetyFilters: SafetyFiltersConfig,
      immersivePureCodeOverride?: boolean
    ): Promise<{ text: string; durationMs: number; aborted?: boolean }> => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStreamingThreadId(threadId);
      setStreamingMessageId(assistantMessageId);

      const clientStart = performance.now();
      let receivedAnyText = false;
      let receivedError = false;
      let accumulatedText = '';
      let serverDurationMs: number | undefined;

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const rawJson = line.slice(6).trim();
        if (!rawJson) return;

        const event = JSON.parse(rawJson) as {
          type: 'ping' | 'meta' | 'chunk' | 'thought' | 'tool_call' | 'tool_result' | 'done' | 'error';
          modelId?: ModelChoiceId;
          fallbackFrom?: ModelChoiceId;
          text?: string;
          message?: string;
          durationMs?: number;
          id?: string;
          name?: string;
          args?: Record<string, unknown>;
          result?: unknown;
          ok?: boolean;
        };

        if (event.type === 'ping') {
          return;
        } else if (event.type === 'meta' && event.modelId) {
          updateThread(threadId, (t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    modelId: event.modelId,
                    fallbackFrom: event.fallbackFrom,
                  }
                : m
            ),
          }));
        } else if (event.type === 'thought' && event.text) {
          updateThread(threadId, (t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, thoughts: (m.thoughts || '') + event.text }
                : m
            ),
          }));
        } else if (event.type === 'tool_call' && event.name) {
          const callRecord: ToolCallRecord = {
            id: event.id || crypto.randomUUID(),
            name: event.name,
            args: event.args || {},
            status: 'running',
          };
          updateThread(threadId, (t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, toolCalls: [...(m.toolCalls || []), callRecord] }
                : m
            ),
          }));
        } else if (event.type === 'tool_result' && event.name) {
          updateThread(threadId, (t) => ({
            ...t,
            messages: t.messages.map((m) => {
              if (m.id !== assistantMessageId) return m;
              const existing = m.toolCalls || [];
              let updated = false;
              const nextCalls = existing.map((tc) => {
                if (!updated && ((event.id && tc.id === event.id) || (tc.name === event.name && tc.status === 'running'))) {
                  updated = true;
                  return {
                    ...tc,
                    status: (event.ok === false ? 'error' : 'done') as ToolCallRecord['status'],
                    result: event.result,
                    durationMs: event.durationMs,
                  };
                }
                return tc;
              });
              if (!updated) {
                nextCalls.push({
                  id: event.id || crypto.randomUUID(),
                  name: event.name!,
                  args: {},
                  status: event.ok === false ? 'error' : 'done',
                  result: event.result,
                  durationMs: event.durationMs,
                });
              }
              return { ...m, toolCalls: nextCalls };
            }),
          }));
        } else if (event.type === 'chunk' && event.text) {
          receivedAnyText = true;
          accumulatedText += event.text;
          updateThread(threadId, (t) => ({
            ...t,
            updatedAt: Date.now(),
            messages: t.messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, text: m.text + event.text }
                : m
            ),
          }));
        } else if (event.type === 'done') {
          if (typeof event.durationMs === 'number') {
            serverDurationMs = event.durationMs;
          }
        } else if (event.type === 'error') {
          receivedError = true;
          throw new Error(event.message || 'Failed to generate response.');
        }
      };

      try {
        const payloadMessages = historyMessages.map((m, idx) => {
          const isRecentTurn = idx >= historyMessages.length - 2;
          return {
            role: m.role,
            text: m.text,
            attachments: m.attachments?.map((a) => {
              const trimmedTextContent =
                !isRecentTurn && a.textContent && a.textContent.length > 16_000
                  ? a.textContent.slice(0, 16_000)
                  : a.textContent;
              return {
                name: a.name,
                mimeType: a.mimeType,
                data: isRecentTurn ? a.data : undefined,
                isText: a.isText,
                textContent: trimmedTextContent,
                workspacePath: a.workspacePath,
                tokenEstimate: a.tokenEstimate,
                truncatedForContext:
                  Boolean(a.truncatedForContext) ||
                  (!isRecentTurn && Boolean(a.textContent && a.textContent.length > 16_000)),
              };
            }),
          };
        });

        // Build strictly isolated sharedSessionsContext only from explicitly allowed sessions
        const currentThread = threads.find((t) => t.id === threadId);
        const linkTemp = Boolean(currentThread?.triModelConfig?.linkTempSessions);
        const sharedSessionsContext = currentThread
          ? currentThread.incognito
            ? threads
                .filter((t) => {
                  if (t.id === threadId || t.messages.length === 0) return false;
                  const isTemp = Boolean(t.incognito || (t.retention && t.retention !== 'permanent'));
                  if (!isTemp) return false;
                  if (linkTemp) return true;
                  return Boolean(currentThread.sharedThreadIds?.includes(t.id));
                })
                .slice(0, 5)
                .map((t) => ({
                  id: t.id,
                  title: t.title,
                  groupName: t.groupName,
                  recentMessages: t.messages.slice(-4).map((m) => ({
                    role: m.role,
                    snippet: (m.text || '').slice(0, 500),
                  })),
                }))
            : threads
                .filter((t) => {
                  if (t.id === threadId || t.incognito || t.messages.length === 0) return false;
                  if (allowAllSessionsView) return true;
                  if (currentThread.groupName && t.groupName === currentThread.groupName) return true;
                  if (currentThread.sharedThreadIds?.includes(t.id)) return true;
                  return false;
                })
                .slice(0, 5)
                .map((t) => ({
                  id: t.id,
                  title: t.title,
                  groupName: t.groupName,
                  recentMessages: t.messages.slice(-4).map((m) => ({
                    role: m.role,
                    snippet: (m.text || '').slice(0, 500),
                  })),
                }))
          : [];

        let activeWorkspaceId = 'folio-sandbox-1';
        try {
          const savedWs = localStorage.getItem('folio-active-workspace-v1');
          if (savedWs && /^[a-zA-Z0-9_-]{3,64}$/.test(savedWs)) {
            activeWorkspaceId = savedWs;
          }
        } catch {
          // Ignore storage error
        }

        const requestPayload = {
          messages: payloadMessages,
          modelId,
          autoFallback,
          systemInstruction,
          safetyFilters,
          activeWorkspaceId,
          sharedSessionsContext,
          isIncognito: Boolean(currentThread?.incognito),
          immersivePureCode:
            immersivePureCodeOverride ?? Boolean(currentThread?.immersivePureCode),
          customTools: customTools.filter((t) => t.enabled),
        };
        const requestBody = JSON.stringify(requestPayload);

        const isTransientNetworkError = (err: unknown): boolean => {
          if (err instanceof DOMException && err.name === 'AbortError') return false;
          if (err instanceof TypeError) return true;
          const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
          return (
            m.includes('failed to fetch') ||
            m.includes('networkerror') ||
            m.includes('load failed') ||
            m.includes('chunked') ||
            m.includes('network connection') ||
            m.includes('stream ended without content')
          );
        };

        const runNonStreamingFallback = async () => {
          const completeRes = await fetch('/api/chat/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...requestPayload, autoFallback: true }),
            signal: controller.signal,
          });
          if (!completeRes.ok) {
            let errMsg = `Fallback request failed (${completeRes.status})`;
            try {
              const errJson = (await completeRes.json()) as { error?: string };
              if (errJson.error) errMsg = errJson.error;
            } catch {
              // Keep HTTP status message
            }
            throw new Error(errMsg);
          }
          const data = (await completeRes.json()) as {
            ok?: boolean;
            modelId?: ModelChoiceId;
            fallbackFrom?: ModelChoiceId;
            text?: string;
            thoughts?: string;
            toolCalls?: ToolCallRecord[];
            durationMs?: number;
            error?: string;
          };
          if (!data.text) {
            throw new Error(data.error || 'The server returned an empty response.');
          }
          accumulatedText = data.text;
          receivedAnyText = true;
          if (typeof data.durationMs === 'number') {
            serverDurationMs = data.durationMs;
          }
          updateThread(threadId, (t) => ({
            ...t,
            updatedAt: Date.now(),
            messages: t.messages.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    modelId: data.modelId || m.modelId,
                    fallbackFrom: data.fallbackFrom,
                    text: data.text!,
                    thoughts: data.thoughts,
                    toolCalls: data.toolCalls,
                  }
                : m
            ),
          }));
        };

        let lastStreamError: unknown = null;
        let completedViaStream = false;
        const maxStreamAttempts = 2;

        for (let attempt = 0; attempt < maxStreamAttempts; attempt += 1) {
          try {
            const response = await fetch('/api/chat/stream', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: requestBody,
              signal: controller.signal,
            });

            if (!response.ok || !response.body) {
              let errMsg = `Request failed (${response.status})`;
              try {
                const errJson = (await response.json()) as { error?: string };
                if (errJson.error) errMsg = errJson.error;
              } catch {
                // Keep HTTP status message
              }
              throw new Error(errMsg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n\n');
              buffer = parts.pop() || '';

              for (const part of parts) {
                for (const line of part.split('\n')) {
                  processLine(line);
                }
              }
            }

            if (buffer.trim()) {
              for (const line of buffer.split('\n')) {
                processLine(line);
              }
            }

            if (!receivedAnyText && !receivedError) {
              throw new Error('The response stream ended without content.');
            }
            completedViaStream = true;
            break;
          } catch (attemptErr) {
            lastStreamError = attemptErr;
            if (
              controller.signal.aborted ||
              receivedError ||
              !isTransientNetworkError(attemptErr)
            ) {
              throw attemptErr;
            }

            // If we haven't received text yet on first attempt, retry SSE cleanly once;
            // if partial text already arrived or SSE dropped twice, fail over to /api/chat/complete below.
            if (attempt < maxStreamAttempts - 1 && !receivedAnyText) {
              updateThread(threadId, (t) => ({
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, thoughts: undefined, toolCalls: undefined }
                    : m
                ),
              }));
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            break;
          }
        }

        if (!completedViaStream) {
          if (lastStreamError && !controller.signal.aborted && !receivedError) {
            await new Promise((r) => setTimeout(r, 300));
            await runNonStreamingFallback();
          } else if (lastStreamError) {
            throw lastStreamError;
          }
        }

        if (!receivedAnyText && !receivedError) {
          throw new Error('The response stream ended without content. Please try again.');
        }

        const finalDurationMs =
          typeof serverDurationMs === 'number'
            ? serverDurationMs
            : Math.round(performance.now() - clientStart);
        const engineRating = evaluateAssistantCreativeRating(accumulatedText);

        updateThread(threadId, (t) => ({
          ...t,
          updatedAt: Date.now(),
          messages: t.messages.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  durationMs: finalDurationMs,
                  ...(engineRating ? { engineRating } : {}),
                }
              : m
          ),
        }));

        return { text: accumulatedText, durationMs: finalDurationMs };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return {
            text: accumulatedText,
            durationMs: Math.round(performance.now() - clientStart),
            aborted: true,
          };
        }
        const rawMessage =
          err instanceof Error
            ? err.message
            : 'Unable to reach the server. Please try again.';
        const message = /failed to fetch|networkerror|load failed/i.test(rawMessage)
          ? `Connection to the Folio server dropped (${rawMessage}). Streaming retry and standard fallback could not complete — please try again or switch to Flash Lite 3.1 / Auto.`
          : rawMessage;
        const finalDurationMs = Math.round(performance.now() - clientStart);
        updateThread(threadId, (t) => ({
          ...t,
          updatedAt: Date.now(),
          messages: t.messages.map((m) =>
            m.id === assistantMessageId
              ? { ...m, error: message, durationMs: finalDurationMs }
              : m
          ),
        }));
        return { text: accumulatedText, durationMs: finalDurationMs };
      } finally {
        setStreamingThreadId((prev) => (prev === threadId ? null : prev));
        setStreamingMessageId((prev) => (prev === assistantMessageId ? null : prev));
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [updateThread, threads, allowAllSessionsView, customTools]
  );

  const runImageGeneration = useCallback(
    async (
      threadId: string,
      promptText: string,
      attachments: ChatAttachment[],
      assistantMessageId: string
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStreamingThreadId(threadId);
      setStreamingMessageId(assistantMessageId);
      const clientStart = performance.now();

      try {
        const res = await fetch('/api/chat/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            attachments: attachments.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              data: a.data,
            })),
          }),
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          images?: ChatImageResult[];
          text?: string;
          modelId?: ModelChoiceId;
          durationMs?: number;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Image generation failed.');
        }
        const finalDuration =
          typeof data.durationMs === 'number'
            ? data.durationMs
            : Math.round(performance.now() - clientStart);
        updateThread(threadId, (t) => ({
          ...t,
          updatedAt: Date.now(),
          messages: t.messages.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  text:
                    data.text ||
                    (data.images && data.images.length > 0
                      ? 'Generated with Nano Banana Lite (`gemini-3.1-flash-lite-image`).'
                      : 'No images were returned.'),
                  imageResults: data.images,
                  modelId: data.modelId || 'nano-banana-lite',
                  durationMs: finalDuration,
                }
              : m
          ),
        }));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof Error ? err.message : 'Image generation failed.';
        updateThread(threadId, (t) => ({
          ...t,
          updatedAt: Date.now(),
          messages: t.messages.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  error: message,
                  durationMs: Math.round(performance.now() - clientStart),
                }
              : m
          ),
        }));
      } finally {
        setStreamingThreadId((prev) => (prev === threadId ? null : prev));
        setStreamingMessageId((prev) => (prev === assistantMessageId ? null : prev));
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [updateThread]
  );

  const runTriModelCouncil = useCallback(
    async (
      threadId: string,
      baseHistory: ChatMessage[],
      triConfig: TriModelConfig,
      systemInstruction: string,
      safetyFilters: SafetyFiltersConfig
    ) => {
      const models =
        triConfig.models && triConfig.models.length >= 2
          ? triConfig.models.slice(0, 3)
          : DEFAULT_TRI_MODEL_CONFIG.models;

      let cumulativeHistory = [...baseHistory];

      for (let i = 0; i < models.length; i += 1) {
        const mId = models[i];
        const cellId = crypto.randomUUID();
        const label = getModelOption(mId).shortName;
        const placeholder: ChatMessage = {
          id: cellId,
          role: 'model',
          text: '',
          createdAt: Date.now(),
          modelId: mId,
          triModelIndex: i,
          triModelLabel: label,
        };

        updateThread(threadId, (t) => ({
          ...t,
          updatedAt: Date.now(),
          messages: [...t.messages, placeholder],
        }));

        const res = await streamAssistantResponse(
          threadId,
          baseHistory,
          cellId,
          mId,
          true,
          systemInstruction,
          safetyFilters
        );
        if (res.aborted) return;

        if (res.text) {
          cumulativeHistory = [
            ...cumulativeHistory,
            { ...placeholder, text: res.text, durationMs: res.durationMs },
          ];
        }
      }

      const autoRounds = Math.max(0, Math.min(5, triConfig.autonomousTurns || 0));
      const directive =
        triConfig.autonomousPrompt?.trim() ||
        DEFAULT_TRI_MODEL_CONFIG.autonomousPrompt ||
        'Critique, refine, and extend the previous responses.';

      for (let round = 1; round <= autoRounds; round += 1) {
        const synthModel = models[round % models.length];
        const cellId = crypto.randomUUID();
        const label = `${getModelOption(synthModel).shortName} · Auto #${round}`;
        const synthPlaceholder: ChatMessage = {
          id: cellId,
          role: 'model',
          text: '',
          createdAt: Date.now(),
          modelId: synthModel,
          triModelIndex: models.length + round - 1,
          triModelLabel: label,
        };

        updateThread(threadId, (t) => ({
          ...t,
          updatedAt: Date.now(),
          messages: [...t.messages, synthPlaceholder],
        }));

        const synthHistory: ChatMessage[] = [
          ...cumulativeHistory,
          {
            id: `auto-round-${round}`,
            role: 'user',
            text: `[Autonomous Council Round ${round}/${autoRounds}] ${directive}`,
            createdAt: Date.now(),
          },
        ];

        const res = await streamAssistantResponse(
          threadId,
          synthHistory,
          cellId,
          synthModel,
          true,
          systemInstruction,
          safetyFilters
        );
        if (res.aborted) return;

        if (res.text) {
          cumulativeHistory = [
            ...cumulativeHistory,
            { ...synthPlaceholder, text: res.text, durationMs: res.durationMs },
          ];
        }
      }
    },
    [streamAssistantResponse, updateThread]
  );

  const handleQuickGenerateImage = useCallback(
    (promptText: string, attachments: ChatAttachment[]) => {
      if (!activeThread || streamingThreadId) return;
      const isFirstTurn = activeThread.messages.length === 0;
      const now = Date.now();

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: promptText || 'Generate image',
        attachments: attachments.length > 0 ? attachments : undefined,
        createdAt: now,
      };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: '',
        createdAt: now + 1,
        modelId: 'nano-banana-lite',
      };

      updateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: now,
        messages: [...t.messages, userMessage, assistantMessage],
      }));

      isNearBottomRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 30);

      if (isFirstTurn) {
        void generateThreadTitle(activeThread.id, promptText || 'Nano Banana Image');
      }

      void runImageGeneration(
        activeThread.id,
        promptText,
        attachments,
        assistantMessage.id
      );
    },
    [
      activeThread,
      streamingThreadId,
      updateThread,
      scrollToBottom,
      generateThreadTitle,
      runImageGeneration,
    ]
  );

  const handleSendMessage = useCallback(
    (text: string, attachments: ChatAttachment[]) => {
      if (!activeThread || streamingThreadId) return;

      const isFirstTurn = activeThread.messages.length === 0;
      const now = Date.now();

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        attachments: attachments.length > 0 ? attachments : undefined,
        createdAt: now,
      };

      const nextHistory = [...activeThread.messages, userMessage];

      isNearBottomRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 30);

      if (isFirstTurn) {
        const titleSeed = text || attachments[0]?.name || 'New chat';
        void generateThreadTitle(activeThread.id, titleSeed);
      }

      if (activeThread.modelId === 'nano-banana-lite') {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'model',
          text: '',
          createdAt: now + 1,
          modelId: 'nano-banana-lite',
        };
        updateThread(activeThread.id, (t) => ({
          ...t,
          updatedAt: now,
          messages: [...nextHistory, assistantMessage],
        }));
        void runImageGeneration(
          activeThread.id,
          text,
          attachments,
          assistantMessage.id
        );
        return;
      }

      if (activeThread.triModelConfig?.enabled) {
        updateThread(activeThread.id, (t) => ({
          ...t,
          updatedAt: now,
          messages: nextHistory,
        }));
        void runTriModelCouncil(
          activeThread.id,
          nextHistory,
          activeThread.triModelConfig,
          activeThread.systemInstruction,
          activeThread.safetyFilters
        );
        return;
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: '',
        createdAt: now + 1,
        modelId: activeThread.modelId,
      };

      updateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: now,
        messages: [...nextHistory, assistantMessage],
      }));

      void streamAssistantResponse(
        activeThread.id,
        nextHistory,
        assistantMessage.id,
        activeThread.modelId,
        activeThread.autoFallback,
        activeThread.systemInstruction,
        activeThread.safetyFilters
      );
    },
    [
      activeThread,
      streamingThreadId,
      updateThread,
      scrollToBottom,
      generateThreadTitle,
      streamAssistantResponse,
      runImageGeneration,
      runTriModelCouncil,
    ]
  );

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleEditAndResend = useCallback(
    (messageId: string, newText: string) => {
      if (!activeThread || streamingThreadId) return;
      const idx = activeThread.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;

      const updatedUserMsg: ChatMessage = {
        ...activeThread.messages[idx],
        text: newText,
        createdAt: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: '',
        createdAt: Date.now() + 1,
        modelId: activeThread.modelId,
      };

      const truncatedHistory = [
        ...activeThread.messages.slice(0, idx),
        updatedUserMsg,
      ];

      updateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: [...truncatedHistory, assistantMessage],
      }));

      void streamAssistantResponse(
        activeThread.id,
        truncatedHistory,
        assistantMessage.id,
        activeThread.modelId,
        activeThread.autoFallback,
        activeThread.systemInstruction,
        activeThread.safetyFilters
      );
    },
    [activeThread, streamingThreadId, updateThread, streamAssistantResponse]
  );

  const handleUpdateMessage = useCallback(
    (messageId: string, patch: Partial<ChatMessage>) => {
      if (!activeThread) return;
      updateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: t.messages.map((m) =>
          m.id === messageId ? { ...m, ...patch } : m
        ),
      }));
    },
    [activeThread, updateThread]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!activeThread || streamingThreadId === activeThread.id) return;
      updateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: t.messages.filter((m) => m.id !== messageId),
      }));
    },
    [activeThread, streamingThreadId, updateThread]
  );

  const handleRegenerateLatest = useCallback(() => {
    if (!activeThread || streamingThreadId) return;
    const msgs = activeThread.messages;
    if (msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    const baseHistory = lastMsg.role === 'model' ? msgs.slice(0, -1) : msgs;
    if (baseHistory.length === 0) return;

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'model',
      text: '',
      createdAt: Date.now(),
      modelId: activeThread.modelId,
    };

    updateThread(activeThread.id, (t) => ({
      ...t,
      updatedAt: Date.now(),
      messages: [...baseHistory, assistantMessage],
    }));

    void streamAssistantResponse(
      activeThread.id,
      baseHistory,
      assistantMessage.id,
      activeThread.modelId,
      activeThread.autoFallback,
      activeThread.systemInstruction,
      activeThread.safetyFilters
    );
  }, [activeThread, streamingThreadId, updateThread, streamAssistantResponse]);

  const handleNewChat = useCallback(() => {
    if (streamingThreadId) {
      abortControllerRef.current?.abort();
    }
    if (activeThread && activeThread.messages.length === 0 && !activeThread.incognito) {
      return;
    }
    const fresh = createNewThread(
      activeThread?.modelId || 'hydrogen-4-fast',
      activeThread?.safetyFilters || { ...DEFAULT_SAFETY_FILTERS }
    );
    setThreads((prev) => [fresh, ...prev]);
    setActiveThreadId(fresh.id);
  }, [activeThread, streamingThreadId]);

  const handleNewIncognitoChat = useCallback(() => {
    if (streamingThreadId) {
      abortControllerRef.current?.abort();
    }
    const fresh = createNewThread(
      activeThread?.modelId || 'hydrogen-4-fast',
      activeThread?.safetyFilters || { ...DEFAULT_SAFETY_FILTERS },
      { incognito: true }
    );
    setThreads((prev) => [fresh, ...prev]);
    setActiveThreadId(fresh.id);
  }, [activeThread, streamingThreadId]);

  const handleSelectThread = useCallback(
    (id: string) => {
      if (id === activeThreadId) return;
      if (streamingThreadId) {
        abortControllerRef.current?.abort();
      }
      setActiveThreadId(id);
    },
    [activeThreadId, streamingThreadId]
  );

  const handleRenameThread = useCallback(
    (id: string, title: string) => {
      updateThread(id, (t) => ({ ...t, title }));
    },
    [updateThread]
  );

  const handleDeleteThread = useCallback(
    (id: string) => {
      if (streamingThreadId === id) {
        abortControllerRef.current?.abort();
      }
      setThreads((prev) => {
        const remaining = prev.filter((t) => t.id !== id);
        if (remaining.length === 0) {
          const fresh = createNewThread();
          setActiveThreadId(fresh.id);
          return [fresh];
        }
        if (activeThreadId === id) {
          setActiveThreadId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeThreadId, streamingThreadId]
  );

  const handleExportMarkdown = useCallback(() => {
    if (!activeThread || activeThread.messages.length === 0) return;
    exportThreadAsMarkdown(activeThread);
  }, [activeThread]);

  const handleExportJson = useCallback(() => {
    if (!activeThread || activeThread.messages.length === 0) return;
    exportThreadAsJson(activeThread);
  }, [activeThread]);

  const handleExportXml = useCallback(() => {
    if (!activeThread || activeThread.messages.length === 0) return;
    exportThreadAsXml(activeThread);
  }, [activeThread]);

  const handleOpenCodePreview = useCallback((code: string, language: string) => {
    setStopMotionOpen(false);
    setPixelArtOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl(null);
    setCodePreview({
      id: crypto.randomUUID(),
      code,
      language,
    });
  }, []);

  const handleSaveCodeToFolder = useCallback(async (code: string, language: string) => {
    setStopMotionOpen(false);
    setPixelArtOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl(null);

    let activeWs = 'folio-sandbox-1';
    try {
      const saved = localStorage.getItem('folio-active-workspace-v1');
      if (saved && /^[a-zA-Z0-9_-]{3,64}$/.test(saved)) {
        activeWs = saved;
      }
    } catch {
      // Ignore storage error
    }

    const lang = (language || '').trim().toLowerCase();
    let targetPath = 'snippet.txt';
    if (lang === 'python' || lang === 'py' || lang === 'python3') {
      targetPath = 'build_tool.py';
    } else if (lang === 'html' || lang === 'htm') {
      targetPath = 'index.html';
    } else if (lang === 'css' || lang === 'scss') {
      targetPath = 'style.css';
    } else if (lang === 'javascript' || lang === 'js' || lang === 'mjs') {
      targetPath = 'app.js';
    } else if (lang === 'typescript' || lang === 'ts') {
      targetPath = 'tool.ts';
    } else if (lang === 'tsx' || lang === 'jsx' || lang === 'react') {
      targetPath = `Component.${lang === 'tsx' ? 'tsx' : 'jsx'}`;
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      targetPath = 'run.sh';
    } else if (lang === 'json') {
      targetPath = code.includes('"steps"') ? 'folio.workflow.json' : 'manifest.json';
    } else if (lang === 'sql') {
      targetPath = 'query.sql';
    } else if (lang) {
      targetPath = `file.${lang}`;
    }

    try {
      await fetch(`/api/workspace/${encodeURIComponent(activeWs)}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: targetPath, content: code }],
        }),
      });
    } catch {
      // Still open folder view
    }

    setCodePreview({
      id: crypto.randomUUID(),
      code,
      language,
      initialViewMode: 'folder',
      toastMessage: `Saved ${targetPath} to project "${activeWs}"`,
    });
  }, []);

  const handleCreateFoldersInWorkspace = useCallback(
    async (
      folders: string[],
      fileTargets: Array<{ path: string; code?: string }>
    ): Promise<{ workspaceId: string; createdCount: number } | null> => {
      let activeWs = 'folio-sandbox-1';
      try {
        const saved = localStorage.getItem('folio-active-workspace-v1');
        if (saved && /^[a-zA-Z0-9_-]{3,64}$/.test(saved)) {
          activeWs = saved;
        }
      } catch {
        // Ignore storage error
      }

      const filesToWrite: Array<{ path: string; content: string }> = [];
      const coveredFolders = new Set<string>();

      for (const ft of fileTargets) {
        if (!ft.path) continue;
        const cleanPath = ft.path.replace(/^\/+/, '');
        if (cleanPath.includes('/')) {
          coveredFolders.add(cleanPath.slice(0, cleanPath.lastIndexOf('/')));
        }
        if (ft.code !== undefined) {
          filesToWrite.push({ path: cleanPath, content: ft.code });
        }
      }

      for (const folder of folders) {
        const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
        if (!cleanFolder) continue;
        const alreadyCovered = Array.from(coveredFolders).some(
          (cf) => cf === cleanFolder || cf.startsWith(`${cleanFolder}/`)
        );
        if (!alreadyCovered) {
          filesToWrite.push({ path: `${cleanFolder}/.gitkeep`, content: '' });
        }
      }

      if (filesToWrite.length === 0) return null;

      try {
        const res = await fetch(`/api/workspace/${encodeURIComponent(activeWs)}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: filesToWrite }),
        });
        if (!res.ok) return null;
        return { workspaceId: activeWs, createdCount: filesToWrite.length };
      } catch {
        return null;
      }
    },
    []
  );

  const handleToggleCodePreview = useCallback(() => {
    setStopMotionOpen(false);
    setPixelArtOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl(null);
    setCodePreview((prev) =>
      prev
        ? null
        : {
            id: crypto.randomUUID(),
            code: STARTER_PREVIEW_CODE,
            language: 'html',
          }
    );
  }, []);

  const handleToggleWebPreview = useCallback(() => {
    setCodePreview(null);
    setStopMotionOpen(false);
    setPixelArtOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl((prev) => (prev ? null : 'https://example.com'));
  }, []);

  const handleOpenWebPreview = useCallback((url: string) => {
    setCodePreview(null);
    setStopMotionOpen(false);
    setPixelArtOpen(false);
    setThreeDOpen(false);
    setGoogleFlowOpen(false);
    setWebPreviewUrl(url);
  }, []);

  const handleImportWebHtmlToCode = useCallback((html: string, sourceUrl: string) => {
    setWebPreviewUrl(null);
    setCodePreview({
      id: crypto.randomUUID(),
      code: `<!-- Imported from ${sourceUrl} -->\n${html}`,
      language: 'html',
    });
  }, []);

  const handleToggleStopMotion = useCallback(() => {
    setCodePreview(null);
    setPixelArtOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl(null);
    setStopMotionOpen((v) => !v);
  }, []);

  const handleOpenStopMotionSpec = useCallback((spec: VectorStopMotionSpec) => {
    setCodePreview(null);
    setPixelArtOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl(null);
    setLoadedStopMotionSpec(spec);
    setStopMotionOpen(true);
  }, []);

  const handleConsumeExternalStopMotionSpec = useCallback(() => {
    setLoadedStopMotionSpec(null);
  }, []);

  const handlePostStopMotionToChat = useCallback(
    (markdownText: string) => {
      if (!activeThread) return;
      const now = Date.now();
      const renderedMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: markdownText,
        createdAt: now,
        modelId: activeThread.modelId,
      };
      updateThread(activeThread.id, (t) => ({
        ...t,
        title:
          t.title === 'New chat' || t.title === 'New conversation'
            ? 'Stop Motion Render'
            : t.title,
        updatedAt: now,
        messages: [...t.messages, renderedMessage],
      }));
      isNearBottomRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 40);
    },
    [activeThread, updateThread, scrollToBottom]
  );

  const handleTogglePixelArt = useCallback(() => {
    setCodePreview(null);
    setStopMotionOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl(null);
    setPixelArtOpen((v) => !v);
  }, []);

  const handleOpenPixelArtSpec = useCallback((spec: PixelArtSpec) => {
    setCodePreview(null);
    setStopMotionOpen(false);
    setThreeDOpen(false);
    setWebPreviewUrl(null);
    setLoadedPixelArtSpec(spec);
    setPixelArtOpen(true);
  }, []);

  const handleConsumeExternalPixelArtSpec = useCallback(() => {
    setLoadedPixelArtSpec(null);
  }, []);

  const handlePostPixelArtToChat = useCallback(
    (markdownText: string) => {
      if (!activeThread) return;
      const now = Date.now();
      const renderedMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: markdownText,
        createdAt: now,
        modelId: activeThread.modelId,
      };
      updateThread(activeThread.id, (t) => ({
        ...t,
        title:
          t.title === 'New chat' || t.title === 'New conversation'
            ? 'Pixel Art Canvas'
            : t.title,
        updatedAt: now,
        messages: [...t.messages, renderedMessage],
      }));
      isNearBottomRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 40);
    },
    [activeThread, updateThread, scrollToBottom]
  );

  const handleToggleThreeD = useCallback(() => {
    setCodePreview(null);
    setStopMotionOpen(false);
    setPixelArtOpen(false);
    setWebPreviewUrl(null);
    setThreeDOpen((v) => !v);
  }, []);

  const handleOpenThreeDSpec = useCallback((spec: ThreeDSceneSpec) => {
    setCodePreview(null);
    setStopMotionOpen(false);
    setPixelArtOpen(false);
    setWebPreviewUrl(null);
    setLoadedThreeDSpec(spec);
    setThreeDOpen(true);
  }, []);

  const handleConsumeExternalThreeDSpec = useCallback(() => {
    setLoadedThreeDSpec(null);
  }, []);

  const handlePostThreeDToChat = useCallback(
    (markdownText: string) => {
      if (!activeThread) return;
      const now = Date.now();
      const renderedMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: markdownText,
        createdAt: now,
        modelId: activeThread.modelId,
      };
      updateThread(activeThread.id, (t) => ({
        ...t,
        title:
          t.title === 'New chat' || t.title === 'New conversation'
            ? '3D Scene Viewport'
            : t.title,
        updatedAt: now,
        messages: [...t.messages, renderedMessage],
      }));
      isNearBottomRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 40);
    },
    [activeThread, updateThread, scrollToBottom]
  );

  const handleConsumePendingAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  const handleChangeFontPreset = useCallback(
    (preset: FontPresetId) => {
      setFontPreset(preset);
      if (authUser && authUser.emailVerified) {
        void ensureUserProfileDoc(authUser, { fontPreset: preset }).catch(() => {});
      }
    },
    [authUser]
  );

  const handleToggleDefaultPureCode = useCallback(() => {
    setDefaultPureCode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DEFAULT_PURE_CODE_KEY, next ? 'true' : 'false');
      } catch {
        // Ignore storage error
      }
      if (authUser && authUser.emailVerified) {
        void ensureUserProfileDoc(authUser, { defaultPureCode: next }).catch(() => {});
      }
      return next;
    });
  }, [authUser]);

  const handleSaveInstructionProfile = useCallback(
    async (profile: { id: string; name: string; instruction: string }, isNew: boolean) => {
      if (authUser && authUser.emailVerified) {
        await saveCustomInstruction(authUser.uid, profile, isNew);
        return;
      }
      const now = Date.now();
      setSavedInstructions((prev) => {
        const next = isNew
          ? [
              { ...profile, createdAt: now, updatedAt: now },
              ...prev.filter((p) => p.id !== profile.id),
            ]
          : prev.map((p) =>
              p.id === profile.id ? { ...p, ...profile, updatedAt: now } : p
            );
        try {
          localStorage.setItem(LOCAL_INSTRUCTIONS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage error
        }
        return next;
      });
    },
    [authUser]
  );

  const handleDeleteInstructionProfile = useCallback(
    async (id: string) => {
      if (authUser && authUser.emailVerified) {
        await deleteCustomInstruction(authUser.uid, id);
        return;
      }
      setSavedInstructions((prev) => {
        const next = prev.filter((p) => p.id !== id);
        try {
          localStorage.setItem(LOCAL_INSTRUCTIONS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage error
        }
        return next;
      });
    },
    [authUser]
  );

  const handleSaveCustomTool = useCallback(
    async (
      tool: Omit<CustomFunctionToolDef, 'createdAt' | 'updatedAt'>,
      isNew: boolean
    ) => {
      if (authUser && authUser.emailVerified) {
        await saveCustomTool(authUser.uid, tool, isNew);
        return;
      }
      const now = Date.now();
      setCustomTools((prev) => {
        const next = isNew
          ? [
              { ...tool, createdAt: now, updatedAt: now },
              ...prev.filter((t) => t.id !== tool.id),
            ]
          : prev.map((t) =>
              t.id === tool.id ? { ...t, ...tool, updatedAt: now } : t
            );
        try {
          localStorage.setItem(LOCAL_TOOLS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage error
        }
        return next;
      });
    },
    [authUser]
  );

  const handleDeleteCustomTool = useCallback(
    async (id: string) => {
      if (authUser && authUser.emailVerified) {
        await deleteCustomTool(authUser.uid, id);
        return;
      }
      setCustomTools((prev) => {
        const next = prev.filter((t) => t.id !== id);
        try {
          localStorage.setItem(LOCAL_TOOLS_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage error
        }
        return next;
      });
    },
    [authUser]
  );

  const handleToggleCustomTool = useCallback(
    async (tool: CustomFunctionToolDef) => {
      await handleSaveCustomTool(
        {
          id: tool.id,
          name: tool.name,
          description: tool.description,
          parametersJson: tool.parametersJson,
          handlerCode: tool.handlerCode,
          enabled: !tool.enabled,
        },
        false
      );
    },
    [handleSaveCustomTool]
  );

  const chatHeadings = useMemo(
    () => extractChatHeadings(activeThread.messages),
    [activeThread.messages]
  );

  const handleJumpToHeading = useCallback((anchorId: string) => {
    const target = document.getElementById(anchorId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const userAccountSummary = useMemo(
    () =>
      authUser
        ? {
            displayName:
              authUser.displayName || authUser.email?.split('@')[0] || 'Folio User',
            email: authUser.email || '',
            photoURL: authUser.photoURL || undefined,
          }
        : null,
    [authUser]
  );

  const activeWorkspaceId = useMemo(() => {
    try {
      const saved = localStorage.getItem('folio-active-workspace-v1');
      if (saved && /^[a-zA-Z0-9_-]{3,64}$/.test(saved)) return saved;
    } catch {
      // Ignore storage error
    }
    return 'folio-sandbox-1';
  }, [toolsModalOpen]);

  const isStreamingActiveThread = streamingThreadId === activeThread.id;
  const hasCustomInstructions =
    activeThread.systemInstruction.trim() !== DEFAULT_SYSTEM_INSTRUCTION.trim();

  const latestModelMsgId = useMemo(() => {
    for (let i = activeThread.messages.length - 1; i >= 0; i -= 1) {
      if (activeThread.messages[i].role === 'model') {
        return activeThread.messages[i].id;
      }
    }
    return null;
  }, [activeThread.messages]);

  const isEmpty = activeThread.messages.length === 0;

  const contextualGreeting = useMemo(
    () =>
      getContextualGreeting({
        threadId: activeThread.id,
        isIncognito: activeThread.incognito,
        retention: activeThread.retention,
        groupName: activeThread.groupName,
        triModelEnabled: Boolean(activeThread.triModelConfig?.enabled),
        systemInstruction: activeThread.systemInstruction,
      }),
    [
      activeThread.id,
      activeThread.incognito,
      activeThread.retention,
      activeThread.groupName,
      activeThread.triModelConfig?.enabled,
      activeThread.systemInstruction,
    ]
  );

  return (
    <div className="h-dvh w-full overflow-hidden flex bg-white dark:bg-[#212121] text-[#0d0d0d] dark:text-[#ececec]">
      <Sidebar
        threads={threads}
        activeThreadId={activeThread.id}
        isOpen={sidebarOpen}
        theme={theme}
        hasCustomInstructions={hasCustomInstructions}
        safetySummary={getSafetySummaryLabel(activeThread.safetyFilters)}
        onCloseMobile={() => setSidebarOpen(false)}
        onCollapseDesktop={() => setSidebarOpen(false)}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onNewIncognitoChat={handleNewIncognitoChat}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        onToggleTheme={toggleTheme}
        onOpenInstructions={() => {
          setInstructionsStartCreating(false);
          setInstructionsModalOpen(true);
        }}
        onCreateInstruction={() => {
          setInstructionsStartCreating(true);
          setInstructionsModalOpen(true);
        }}
        onOpenSafety={() => setSafetyModalOpen(true)}
        onOpenChangelogs={() => setChangelogsOpen(true)}
        userAccount={userAccountSummary}
        onOpenAccount={() => setAccountModalOpen(true)}
      />

      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        <main className="flex-1 min-w-0 flex flex-col h-full relative bg-white dark:bg-[#212121]">
          <ChatHeader
            messageCount={activeThread.messages.length}
            modelId={activeThread.modelId}
            autoFallback={activeThread.autoFallback}
            safetyFilters={activeThread.safetyFilters}
            isIncognito={Boolean(activeThread.incognito)}
            retention={activeThread.retention}
            triModelConfig={activeThread.triModelConfig}
            groupName={activeThread.groupName}
            sharedSessionCount={activeThread.sharedThreadIds?.length || 0}
            sidebarOpen={sidebarOpen}
            codePreviewOpen={Boolean(codePreview)}
            stopMotionOpen={stopMotionOpen}
            pixelArtOpen={pixelArtOpen}
            threeDOpen={threeDOpen}
            googleFlowOpen={googleFlowOpen}
            webPreviewOpen={Boolean(webPreviewUrl)}
            onOpenSidebar={() => setSidebarOpen(true)}
            onNewChat={handleNewChat}
            onChangeModel={(modelId) =>
              updateThread(activeThread.id, (t) => ({ ...t, modelId }))
            }
            onToggleAutoFallback={() =>
              updateThread(activeThread.id, (t) => ({
                ...t,
                autoFallback: !t.autoFallback,
              }))
            }
            onChangeRetention={(retention) => {
              const opt = RETENTION_OPTIONS.find((r) => r.id === retention);
              updateThread(activeThread.id, (t) => ({
                ...t,
                retention,
                expiresAt: opt?.ttlMs ? Date.now() + opt.ttlMs : undefined,
              }));
            }}
            onChangeTriModelConfig={(triModelConfig) =>
              updateThread(activeThread.id, (t) => ({ ...t, triModelConfig }))
            }
            onOpenChangelogs={() => setChangelogsOpen(true)}
            onOpenSafety={() => setSafetyModalOpen(true)}
            onOpenSessionPrivacy={() => setPrivacyModalOpen(true)}
            onOpenCodePreview={handleToggleCodePreview}
            onOpenStopMotion={handleToggleStopMotion}
            onOpenPixelArt={handleTogglePixelArt}
            onOpenThreeD={handleToggleThreeD}
            onOpenGoogleFlow={() => setGoogleFlowOpen((v) => !v)}
            onOpenWebPreview={handleToggleWebPreview}
            onExportMarkdown={handleExportMarkdown}
            onExportJson={handleExportJson}
            onExportXml={handleExportXml}
            fontPreset={fontPreset}
            onChangeFontPreset={handleChangeFontPreset}
            headings={chatHeadings}
            onJumpToHeading={handleJumpToHeading}
            onOpenToolsModal={() => setToolsModalOpen(true)}
            enabledToolsCount={customTools.filter((t) => t.enabled).length}
            userAccount={userAccountSummary}
            onOpenAccount={() => setAccountModalOpen(true)}
          />

          {isEmpty ? (
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 sm:px-6 pb-12 chat-scroll">
              <div className="w-full max-w-3xl space-y-6">
                <div
                  key={activeThread.id}
                  className="space-y-1.5 text-center folio-oxygen-entrance"
                >
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#0d0d0d] dark:text-[#ececec] [text-wrap:balance]">
                    {contextualGreeting.headline}
                  </h1>
                  <p
                    className={`text-xs ${
                      activeThread.incognito
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {contextualGreeting.subtitle}
                  </p>
                </div>

                <Composer
                  isStreaming={isStreamingActiveThread}
                  centered={true}
                  activeModelId={activeThread.modelId}
                  externalAttachments={pendingAttachments}
                  onConsumeExternalAttachments={handleConsumePendingAttachments}
                  onSend={handleSendMessage}
                  onStop={handleStopStreaming}
                  onQuickGenerateImage={handleQuickGenerateImage}
                  immersivePureCode={Boolean(activeThread.immersivePureCode)}
                  onTogglePureCode={() =>
                    updateThread(activeThread.id, (t) => ({
                      ...t,
                      immersivePureCode: !t.immersivePureCode,
                    }))
                  }
                  onOpenToolsModal={() => setToolsModalOpen(true)}
                  enabledToolsCount={customTools.filter((t) => t.enabled).length}
                />

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt, [])}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-neutral-200 dark:border-white/15 bg-white dark:bg-transparent hover:bg-[#f4f4f4] dark:hover:bg-[#2f2f2f] text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    >
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto chat-scroll"
              >
                <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-7">
                  {activeThread.messages.map((message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      isStreaming={
                        isStreamingActiveThread && streamingMessageId === message.id
                      }
                      isLatestModelMessage={message.id === latestModelMsgId}
                      canEditOrRegenerate={!isStreamingActiveThread}
                      onEditAndResend={handleEditAndResend}
                      onUpdateMessage={handleUpdateMessage}
                      onDeleteMessage={handleDeleteMessage}
                      onRegenerate={handleRegenerateLatest}
                      onRetryError={handleRegenerateLatest}
                      onPreviewCode={handleOpenCodePreview}
                      onSaveCodeToFolder={handleSaveCodeToFolder}
                      onCreateFoldersInWorkspace={handleCreateFoldersInWorkspace}
                      onOpenStopMotionSpec={handleOpenStopMotionSpec}
                      onOpenPixelArtSpec={handleOpenPixelArtSpec}
                      onOpenThreeDSpec={handleOpenThreeDSpec}
                      onPreviewWebUrl={handleOpenWebPreview}
                    />
                  ))}
                </div>
              </div>

              {showScrollBottom && (
                <div className="pointer-events-none flex justify-center -mt-12 mb-2 z-10">
                  <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    aria-label="Jump to latest message"
                    className="pointer-events-auto inline-flex items-center justify-center w-9 h-9 rounded-full border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-[#ececec] shadow-md hover:bg-[#f4f4f4] dark:hover:bg-[#3a3a3a] transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              <Composer
                isStreaming={isStreamingActiveThread}
                activeModelId={activeThread.modelId}
                externalAttachments={pendingAttachments}
                onConsumeExternalAttachments={handleConsumePendingAttachments}
                onSend={handleSendMessage}
                onStop={handleStopStreaming}
                onQuickGenerateImage={handleQuickGenerateImage}
                immersivePureCode={Boolean(activeThread.immersivePureCode)}
                onTogglePureCode={() =>
                  updateThread(activeThread.id, (t) => ({
                    ...t,
                    immersivePureCode: !t.immersivePureCode,
                  }))
                }
                onOpenToolsModal={() => setToolsModalOpen(true)}
                enabledToolsCount={customTools.filter((t) => t.enabled).length}
              />
            </>
          )}
        </main>

        {codePreview && (
          <CodePreviewPanel
            preview={codePreview}
            appTheme={theme}
            onClose={() => setCodePreview(null)}
          />
        )}

        {webPreviewUrl && (
          <WebPreviewPanel
            initialUrl={webPreviewUrl}
            onClose={() => setWebPreviewUrl(null)}
            onImportHtmlToCode={handleImportWebHtmlToCode}
          />
        )}

        {stopMotionOpen && (
          <StopMotionPanel
            externalSpec={loadedStopMotionSpec}
            onConsumeExternalSpec={handleConsumeExternalStopMotionSpec}
            onPostToChat={handlePostStopMotionToChat}
            onClose={() => setStopMotionOpen(false)}
            onAttachToChat={(attachment) =>
              setPendingAttachments((prev) => [...prev, attachment])
            }
          />
        )}

        {pixelArtOpen && (
          <PixelArtStudio
            externalSpec={loadedPixelArtSpec}
            onConsumeExternalSpec={handleConsumeExternalPixelArtSpec}
            onPostToChat={handlePostPixelArtToChat}
            onClose={() => setPixelArtOpen(false)}
            onAttachToChat={(attachment) =>
              setPendingAttachments((prev) => [...prev, attachment])
            }
          />
        )}

        {threeDOpen && (
          <ThreeDStudio
            externalSpec={loadedThreeDSpec}
            onConsumeExternalSpec={handleConsumeExternalThreeDSpec}
            onPostToChat={handlePostThreeDToChat}
            onClose={() => setThreeDOpen(false)}
            onAttachToChat={(attachment) =>
              setPendingAttachments((prev) => [...prev, attachment])
            }
          />
        )}

        {googleFlowOpen && (
          <GoogleFlowPanel
            onClose={() => setGoogleFlowOpen(false)}
            onSendFilmToChat={(summaryMarkdown) => {
              setGoogleFlowOpen(false);
              handlePostThreeDToChat(summaryMarkdown);
            }}
          />
        )}
      </div>

      <InstructionsModal
        isOpen={instructionsModalOpen}
        initialInstruction={activeThread.systemInstruction}
        savedProfiles={savedInstructions}
        startCreating={instructionsStartCreating}
        onSaveProfile={handleSaveInstructionProfile}
        onDeleteProfile={handleDeleteInstructionProfile}
        onClose={() => {
          setInstructionsModalOpen(false);
          setInstructionsStartCreating(false);
        }}
        onSave={(instruction) =>
          updateThread(activeThread.id, (t) => ({
            ...t,
            systemInstruction: instruction || DEFAULT_SYSTEM_INSTRUCTION,
          }))
        }
      />

      <SafetyFiltersModal
        isOpen={safetyModalOpen}
        initialFilters={activeThread.safetyFilters}
        onClose={() => setSafetyModalOpen(false)}
        onSave={(safetyFilters) =>
          updateThread(activeThread.id, (t) => ({
            ...t,
            safetyFilters,
          }))
        }
      />

      <SessionPrivacyModal
        isOpen={privacyModalOpen}
        activeThread={activeThread}
        allThreads={threads}
        allowAllSessionsView={allowAllSessionsView}
        onClose={() => setPrivacyModalOpen(false)}
        onSaveSessionPrivacy={(patch) =>
          updateThread(activeThread.id, (t) => ({
            ...t,
            ...patch,
          }))
        }
        onToggleAllowAllSessions={(allow) => {
          setAllowAllSessionsView(allow);
          try {
            localStorage.setItem(ALLOW_ALL_SESSIONS_KEY, allow ? 'true' : 'false');
          } catch {
            // Ignore storage error
          }
        }}
      />

      <ChangelogsModal
        isOpen={changelogsOpen}
        onClose={() => setChangelogsOpen(false)}
      />

      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        user={authUser}
        fontPreset={fontPreset}
        onChangeFontPreset={handleChangeFontPreset}
        defaultPureCode={defaultPureCode}
        onToggleDefaultPureCode={handleToggleDefaultPureCode}
        instructionsCount={savedInstructions.length}
        toolsCount={customTools.length}
        onOpenInstructions={() => {
          setAccountModalOpen(false);
          setInstructionsStartCreating(false);
          setInstructionsModalOpen(true);
        }}
        onOpenTools={() => {
          setAccountModalOpen(false);
          setToolsModalOpen(true);
        }}
      />

      <FunctionToolsModal
        isOpen={toolsModalOpen}
        onClose={() => setToolsModalOpen(false)}
        customTools={customTools}
        onSaveTool={handleSaveCustomTool}
        onDeleteTool={handleDeleteCustomTool}
        onToggleTool={handleToggleCustomTool}
        activeWorkspaceId={activeWorkspaceId}
      />
    </div>
  );
}
