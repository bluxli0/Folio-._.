import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import {
  ChatAttachment,
  ChatMessage,
  ConversationThread,
  ModelChoiceId,
  SafetyFiltersConfig,
  SafetyLevel,
} from './types/chat';
import {
  DEFAULT_SAFETY_FILTERS,
  STARTER_PROMPTS,
  SYSTEM_PRESETS,
  getSafetySummaryLabel,
} from './data/presets';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { MessageItem } from './components/MessageItem';
import { Composer } from './components/Composer';
import { InstructionsModal } from './components/InstructionsModal';
import { SafetyFiltersModal } from './components/SafetyFiltersModal';
import { CodePreviewData, CodePreviewPanel } from './components/CodePreviewPanel';
import { StopMotionPanel } from './components/StopMotionPanel';
import { PixelArtStudio } from './components/PixelArtStudio';
import { ThreeDStudio } from './components/ThreeDStudio';
import { GoogleFlowPanel } from './components/GoogleFlowPanel';
import { WebPreviewPanel } from './components/WebPreviewPanel';
import { VectorStopMotionSpec } from './types/stopMotion';
import { PixelArtSpec } from './types/pixelArt';
import { ThreeDSceneSpec } from './types/threeD';

const STORAGE_KEY = 'folio-threads-v1';
const THEME_KEY = 'folio-theme';
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

function createNewThread(
  modelId: ModelChoiceId = 'hydrogen-4-fast',
  safetyFilters: SafetyFiltersConfig = { ...DEFAULT_SAFETY_FILTERS }
): ConversationThread {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    messages: [],
    modelId,
    autoFallback: true,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
    safetyFilters,
    createdAt: now,
    updatedAt: now,
  };
}

function isValidSafetyLevel(val: unknown): val is SafetyLevel {
  return val === 'max' || val === 'medium' || val === 'low' || val === 'none';
}

function normalizeThread(raw: Partial<ConversationThread> & Record<string, unknown>): ConversationThread {
  const now = Date.now();
  let modelId: ModelChoiceId = 'hydrogen-4-fast';
  if (
    raw.modelId === 'flash-lite-3.1' ||
    raw.modelId === 'hydrogen-4-fast' ||
    raw.modelId === 'hydrogen-4-balanced' ||
    raw.modelId === 'hydrogen-4-deep'
  ) {
    modelId = raw.modelId;
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
      return parsed.map(normalizeThread);
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
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch {
      try {
        const compact = threads.map((t) => ({
          ...t,
          messages: t.messages.map((m) => ({
            ...m,
            attachments: m.attachments?.map((a) => ({
              ...a,
              data: undefined,
              previewUrl: undefined,
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
      safetyFilters: SafetyFiltersConfig
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStreamingThreadId(threadId);
      setStreamingMessageId(assistantMessageId);

      let receivedAnyText = false;
      let receivedError = false;

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const rawJson = line.slice(6).trim();
        if (!rawJson) return;

        const event = JSON.parse(rawJson) as {
          type: 'meta' | 'chunk' | 'done' | 'error';
          modelId?: ModelChoiceId;
          fallbackFrom?: ModelChoiceId;
          text?: string;
          message?: string;
        };

        if (event.type === 'meta' && event.modelId) {
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
        } else if (event.type === 'chunk' && event.text) {
          receivedAnyText = true;
          updateThread(threadId, (t) => ({
            ...t,
            updatedAt: Date.now(),
            messages: t.messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, text: m.text + event.text }
                : m
            ),
          }));
        } else if (event.type === 'error') {
          receivedError = true;
          throw new Error(event.message || 'Failed to generate response.');
        }
      };

      try {
        const payloadMessages = historyMessages.map((m) => ({
          role: m.role,
          text: m.text,
          attachments: m.attachments?.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            data: a.data,
            isText: a.isText,
            textContent: a.textContent,
          })),
        }));

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            modelId,
            autoFallback,
            systemInstruction,
            safetyFilters,
          }),
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
          throw new Error('The response stream ended without content. Please try again.');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach the server. Please try again.';
        updateThread(threadId, (t) => ({
          ...t,
          updatedAt: Date.now(),
          messages: t.messages.map((m) =>
            m.id === assistantMessageId ? { ...m, error: message } : m
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

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: '',
        createdAt: now + 1,
        modelId: activeThread.modelId,
      };

      const nextHistory = [...activeThread.messages, userMessage];

      updateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: now,
        messages: [...nextHistory, assistantMessage],
      }));

      isNearBottomRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 30);

      if (isFirstTurn) {
        const titleSeed = text || attachments[0]?.name || 'New chat';
        void generateThreadTitle(activeThread.id, titleSeed);
      }

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
    if (activeThread && activeThread.messages.length === 0) {
      return;
    }
    const fresh = createNewThread(
      activeThread?.modelId || 'hydrogen-4-fast',
      activeThread?.safetyFilters || { ...DEFAULT_SAFETY_FILTERS }
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

    const lines = [
      `# ${activeThread.title}`,
      '',
      ...activeThread.messages.flatMap((m) => {
        const speaker = m.role === 'user' ? 'User' : 'Folio';
        const time = new Date(m.createdAt).toLocaleString();
        const body = m.censored ? '[Censored]' : m.text || m.error || '';
        return [`## ${speaker} (${time})`, '', body, ''];
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = activeThread.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `${slug || 'conversation'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        onToggleTheme={toggleTheme}
        onOpenInstructions={() => setInstructionsModalOpen(true)}
        onOpenSafety={() => setSafetyModalOpen(true)}
      />

      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        <main className="flex-1 min-w-0 flex flex-col h-full relative bg-white dark:bg-[#212121]">
          <ChatHeader
            messageCount={activeThread.messages.length}
            modelId={activeThread.modelId}
            autoFallback={activeThread.autoFallback}
            safetyFilters={activeThread.safetyFilters}
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
            onOpenSafety={() => setSafetyModalOpen(true)}
            onOpenCodePreview={handleToggleCodePreview}
            onOpenStopMotion={handleToggleStopMotion}
            onOpenPixelArt={handleTogglePixelArt}
            onOpenThreeD={handleToggleThreeD}
            onOpenGoogleFlow={() => setGoogleFlowOpen((v) => !v)}
            onOpenWebPreview={handleToggleWebPreview}
            onExportMarkdown={handleExportMarkdown}
          />

          {isEmpty ? (
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 sm:px-6 pb-12 chat-scroll">
              <div className="w-full max-w-3xl space-y-6">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-center text-[#0d0d0d] dark:text-[#ececec] [text-wrap:balance]">
                  What can I help with?
                </h1>

                <Composer
                  isStreaming={isStreamingActiveThread}
                  centered={true}
                  externalAttachments={pendingAttachments}
                  onConsumeExternalAttachments={handleConsumePendingAttachments}
                  onSend={handleSendMessage}
                  onStop={handleStopStreaming}
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
                externalAttachments={pendingAttachments}
                onConsumeExternalAttachments={handleConsumePendingAttachments}
                onSend={handleSendMessage}
                onStop={handleStopStreaming}
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
        onClose={() => setInstructionsModalOpen(false)}
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
    </div>
  );
}
