import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Download,
  Film,
  ImagePlus,
  Layers,
  Loader2,
  MessageSquarePlus,
  Music,
  Play,
  Plus,
  RefreshCw,
  Scissors,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import {
  FlowAspectRatio,
  FlowAudioScore,
  FlowCameraMotion,
  FlowClip,
  FlowCreditState,
  FlowFrameSlot,
  FlowGenerationMode,
  FlowIngredient,
  FlowIngredientCategory,
  FlowQualityTier,
  FlowResolution,
  FlowSceneItem,
} from '../types/flow';
import {
  FLOW_CREDIT_COSTS,
  FLOW_DAILY_CREDIT_LIMIT,
  formatMidnightCountdown,
  getLocalDateKey,
  getMillisecondsUntilMidnight,
  getVideoCreditCost,
  loadCreditState,
  reconcileCreditState,
  saveCreditState,
} from '../utils/flowCredits';

interface GoogleFlowPanelProps {
  onSendFilmToChat: (summaryMarkdown: string) => void;
  onClose: () => void;
}

const CAMERA_MOTIONS: FlowCameraMotion[] = [
  'Auto Director',
  'Static Tripod',
  'Slow Dolly In',
  'Dolly Out',
  'Smooth Pan Left',
  'Smooth Pan Right',
  'Tilt Up Reveal',
  'Orbit 360°',
  'Aerial Drone Sweep',
  'Handheld Follow',
];

const STARTER_SHOT_IDEAS = [
  {
    label: 'Rain-soaked neon alley',
    prompt:
      'A lone detective in a weathered trench coat walks down a rain-slicked Tokyo alleyway at night, neon kanji reflecting in puddles, shallow depth of field, 35mm anamorphic film grain.',
    camera: 'Slow Dolly In' as FlowCameraMotion,
  },
  {
    label: 'Alpine train crossing',
    prompt:
      'Golden hour sunlight sweeping across a vintage crimson locomotive crossing a stone viaduct above misty pine valleys, cinematic orchestral atmosphere.',
    camera: 'Aerial Drone Sweep' as FlowCameraMotion,
  },
  {
    label: 'Ceramic studio macro',
    prompt:
      'Warm afternoon sunbeam hitting wet terracotta clay spinning on a potter wheel, fine water droplets catching the light, quiet artisanal workshop.',
    camera: 'Orbit 360°' as FlowCameraMotion,
  },
];

function fileToDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUrl: String(reader.result || ''),
        mimeType: file.type || 'image/png',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export const GoogleFlowPanel: React.FC<GoogleFlowPanelProps> = ({
  onSendFilmToChat,
  onClose,
}) => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTab, setActiveTab] = useState<FlowGenerationMode>('text');

  // 50-Credit Daily Wallet refreshing at 00:00
  const [creditState, setCreditState] = useState<FlowCreditState>(() => loadCreditState());
  const [countdownMs, setCountdownMs] = useState<number>(() =>
    getMillisecondsUntilMidnight()
  );
  const [creditDrawerOpen, setCreditDrawerOpen] = useState(false);

  // Director Controls
  const [prompt, setPrompt] = useState(STARTER_SHOT_IDEAS[0].prompt);
  const [cameraMotion, setCameraMotion] = useState<FlowCameraMotion>('Slow Dolly In');
  const [aspectRatio, setAspectRatio] = useState<FlowAspectRatio>('16:9');
  const [duration, setDuration] = useState<string>('6s');
  const [resolution, setResolution] = useState<FlowResolution>('720p');
  const [qualityTier, setQualityTier] = useState<FlowQualityTier>('fast');

  // Frames to Video State
  const [startFrame, setStartFrame] = useState<FlowFrameSlot | null>(null);
  const [endFrame, setEndFrame] = useState<FlowFrameSlot | null>(null);
  const [framePromptInput, setFramePromptInput] = useState('');
  const [generatingFrameTarget, setGeneratingFrameTarget] = useState<
    'start' | 'end' | null
  >(null);

  // Ingredients to Video State
  const [ingredients, setIngredients] = useState<FlowIngredient[]>([]);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientCategory, setNewIngredientCategory] =
    useState<FlowIngredientCategory>('character');
  const [newIngredientPrompt, setNewIngredientPrompt] = useState('');
  const [isGeneratingIngredient, setIsGeneratingIngredient] = useState(false);

  // Clips Bin, Active Monitor & Scenebuilder Timeline
  const [clips, setClips] = useState<FlowClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [sceneItems, setSceneItems] = useState<FlowSceneItem[]>([]);

  // Extend / Edit Shot Controls
  const [extendTargetClipId, setExtendTargetClipId] = useState<string | null>(null);
  const [extendPrompt, setExtendPrompt] = useState('');
  const [extendDuration, setExtendDuration] = useState('5s');

  // Reel Playback & Lyria Film Score
  const [isPlayingReel, setIsPlayingReel] = useState(false);
  const [reelIndex, setReelIndex] = useState(0);
  const [audioScore, setAudioScore] = useState<FlowAudioScore | null>(null);
  const [scorePrompt, setScorePrompt] = useState(
    'Warm cinematic cello and subtle analog synth pulse for a moody night scene'
  );
  const [isGeneratingScore, setIsGeneratingScore] = useState(false);

  // Request Status & Errors
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scoreAudioRef = useRef<HTMLAudioElement>(null);

  // Keep daily 00:00 countdown & midnight reset synchronized every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCountdownMs(getMillisecondsUntilMidnight(now));
      const today = getLocalDateKey(now);
      setCreditState((prev) => {
        if (prev.lastResetDate !== today) {
          const fresh = reconcileCreditState(prev);
          saveCreditState(fresh);
          return fresh;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist credit changes
  useEffect(() => {
    saveCreditState(creditState);
  }, [creditState]);

  const deductCredits = useCallback(
    (action: string, cost: number): string | null => {
      const snapshot = reconcileCreditState(creditState);
      if (snapshot.balance < cost) {
        setCreditState(snapshot);
        return null;
      }
      const txId = crypto.randomUUID();
      setCreditState((prev) => {
        const current = reconcileCreditState(prev);
        if (current.balance < cost) {
          return current;
        }
        return {
          ...current,
          balance: current.balance - cost,
          transactions: [
            {
              id: txId,
              action,
              cost,
              timestamp: Date.now(),
              status: 'completed' as const,
            },
            ...current.transactions,
          ].slice(0, 30),
        };
      });
      return txId;
    },
    [creditState]
  );

  const refundCredits = useCallback((txId: string | null, cost: number) => {
    if (!txId) return;
    setCreditState((prev) => {
      const current = reconcileCreditState(prev);
      return {
        ...current,
        balance: Math.min(FLOW_DAILY_CREDIT_LIMIT, current.balance + cost),
        transactions: current.transactions.map((tx) =>
          tx.id === txId ? { ...tx, status: 'refunded' as const } : tx
        ),
      };
    });
  }, []);

  const activeClip = useMemo(
    () => clips.find((c) => c.id === activeClipId) || clips[0] || null,
    [clips, activeClipId]
  );

  const sceneClips = useMemo(() => {
    const sorted = [...sceneItems].sort((a, b) => a.order - b.order);
    return sorted
      .map((item) => ({
        item,
        clip: clips.find((c) => c.id === item.clipId) || null,
      }))
      .filter((entry): entry is { item: FlowSceneItem; clip: FlowClip } => Boolean(entry.clip));
  }, [sceneItems, clips]);

  const currentReelClip = isPlayingReel ? sceneClips[reelIndex]?.clip || null : null;
  const displayedVideoClip = currentReelClip || activeClip;

  // Sync optional Lyria score audio when playing full reel
  useEffect(() => {
    const audioEl = scoreAudioRef.current;
    if (!audioEl || !audioScore) return;
    if (isPlayingReel) {
      audioEl.currentTime = 0;
      void audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  }, [isPlayingReel, audioScore]);

  const currentShotCost = getVideoCreditCost(resolution, qualityTier);

  const handleGenerateFrameImage = async (target: 'start' | 'end') => {
    const text = framePromptInput.trim() || prompt.trim();
    if (!text) {
      setErrorMessage('Enter a prompt to generate a frame image.');
      return;
    }

    const currentCredits = reconcileCreditState(creditState);
    if (currentCredits.balance < FLOW_CREDIT_COSTS.imageFrame) {
      setErrorMessage(
        `Insufficient daily credits (${currentCredits.balance} left). Credits refresh to 50 at 00:00.`
      );
      return;
    }

    setErrorMessage(null);
    setGeneratingFrameTarget(target);
    const txId = deductCredits(
      `Generate ${target === 'start' ? 'Start' : 'End'} Frame (Nano Banana)`,
      FLOW_CREDIT_COSTS.imageFrame
    );

    try {
      const res = await fetch('/api/flow/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          aspectRatio,
          quality: qualityTier === 'quality' ? 'high' : 'fast',
        }),
      });
      const data = (await res.json()) as {
        imageDataUrl?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !data.imageDataUrl) {
        throw new Error(data.error || 'Frame generation failed.');
      }

      const slot: FlowFrameSlot = {
        id: crypto.randomUUID(),
        label: target === 'start' ? 'Start Frame' : 'End Frame',
        mimeType: data.mimeType || 'image/png',
        imageDataUrl: data.imageDataUrl,
        prompt: text,
      };
      if (target === 'start') {
        setStartFrame(slot);
      } else {
        setEndFrame(slot);
      }
    } catch (err) {
      refundCredits(txId, FLOW_CREDIT_COSTS.imageFrame);
      setErrorMessage(err instanceof Error ? err.message : 'Frame generation failed.');
    } finally {
      setGeneratingFrameTarget(null);
    }
  };

  const handleUploadFrameFile = async (
    target: 'start' | 'end',
    file: File | undefined
  ) => {
    if (!file) return;
    try {
      const { dataUrl, mimeType } = await fileToDataUrl(file);
      const slot: FlowFrameSlot = {
        id: crypto.randomUUID(),
        label: target === 'start' ? 'Start Frame' : 'End Frame',
        mimeType,
        imageDataUrl: dataUrl,
      };
      if (target === 'start') setStartFrame(slot);
      else setEndFrame(slot);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not load image file.');
    }
  };

  const handleGenerateIngredient = async () => {
    const text = newIngredientPrompt.trim();
    if (!text) {
      setErrorMessage('Describe the character, object, or scene ingredient to generate.');
      return;
    }

    const currentCredits = reconcileCreditState(creditState);
    if (currentCredits.balance < FLOW_CREDIT_COSTS.imageFrame) {
      setErrorMessage(
        `Insufficient daily credits (${currentCredits.balance} left). Credits refresh to 50 at 00:00.`
      );
      return;
    }

    setErrorMessage(null);
    setIsGeneratingIngredient(true);
    const labelName = newIngredientName.trim() || `${newIngredientCategory} ref`;
    const txId = deductCredits(
      `Generate Ingredient: ${labelName}`,
      FLOW_CREDIT_COSTS.imageFrame
    );

    try {
      const res = await fetch('/api/flow/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${text}, clean isolated studio reference visual for film continuity`,
          aspectRatio: '1:1',
          quality: qualityTier === 'quality' ? 'high' : 'fast',
        }),
      });
      const data = (await res.json()) as {
        imageDataUrl?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !data.imageDataUrl) {
        throw new Error(data.error || 'Ingredient generation failed.');
      }

      const ing: FlowIngredient = {
        id: crypto.randomUUID(),
        name: labelName,
        category: newIngredientCategory,
        mimeType: data.mimeType || 'image/png',
        imageDataUrl: data.imageDataUrl,
        createdAt: Date.now(),
      };
      setIngredients((prev) => [ing, ...prev]);
      setSelectedIngredientIds((prev) =>
        prev.length < 3 ? [...prev, ing.id] : prev
      );
      setNewIngredientName('');
      setNewIngredientPrompt('');
    } catch (err) {
      refundCredits(txId, FLOW_CREDIT_COSTS.imageFrame);
      setErrorMessage(err instanceof Error ? err.message : 'Ingredient generation failed.');
    } finally {
      setIsGeneratingIngredient(false);
    }
  };

  const handleUploadIngredientFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { dataUrl, mimeType } = await fileToDataUrl(file);
      const ing: FlowIngredient = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Ingredient',
        category: newIngredientCategory,
        mimeType,
        imageDataUrl: dataUrl,
        createdAt: Date.now(),
      };
      setIngredients((prev) => [ing, ...prev]);
      setSelectedIngredientIds((prev) =>
        prev.length < 3 ? [...prev, ing.id] : prev
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not read image.');
    }
  };

  const toggleIngredientSelection = (id: string) => {
    setSelectedIngredientIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const handleGenerateVideo = async () => {
    if (isGeneratingVideo) return;
    if (!prompt.trim()) {
      setErrorMessage('Write a scene description before generating.');
      return;
    }

    const mode: 'text' | 'frames' | 'ingredients' =
      activeTab === 'frames'
        ? 'frames'
        : activeTab === 'ingredients'
        ? 'ingredients'
        : 'text';

    if (mode === 'frames' && !startFrame && !endFrame) {
      setErrorMessage('Add or generate at least a Start Frame for Frames to Video.');
      return;
    }
    if (mode === 'ingredients' && selectedIngredientIds.length === 0) {
      setErrorMessage('Select 1 to 3 Ingredients for character/object continuity.');
      return;
    }

    const currentCredits = reconcileCreditState(creditState);
    if (currentCredits.balance < currentShotCost) {
      setErrorMessage(
        `Insufficient daily credits (${currentCredits.balance} remaining, need ${currentShotCost}). Refreshes to 50 at 00:00.`
      );
      return;
    }

    setErrorMessage(null);
    setIsGeneratingVideo(true);
    setIsPlayingReel(false);
    setGenerationStatus('Rendering shot with Omni / Veo...');
    const txId = deductCredits(
      `Generate ${resolution} ${mode} shot (${duration})`,
      currentShotCost
    );

    try {
      const selectedIngs = ingredients
        .filter((i) => selectedIngredientIds.includes(i.id))
        .slice(0, 3)
        .map((i) => ({
          name: i.name,
          data: i.imageDataUrl,
          mimeType: i.mimeType,
        }));

      const res = await fetch('/api/flow/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          cameraMotion,
          aspectRatio,
          duration,
          resolution,
          startFrame: startFrame
            ? { data: startFrame.imageDataUrl, mimeType: startFrame.mimeType }
            : undefined,
          endFrame: endFrame
            ? { data: endFrame.imageDataUrl, mimeType: endFrame.mimeType }
            : undefined,
          ingredients: selectedIngs,
        }),
      });

      const data = (await res.json()) as {
        clipId?: string;
        videoUrl?: string;
        mimeType?: string;
        interactionId?: string;
        error?: string;
      };

      if (!res.ok || !data.videoUrl) {
        throw new Error(data.error || 'Video generation failed.');
      }

      const newClip: FlowClip = {
        id: data.clipId || crypto.randomUUID(),
        prompt: prompt.trim(),
        mode,
        cameraMotion,
        aspectRatio,
        duration,
        resolution,
        qualityTier,
        videoUrl: data.videoUrl,
        mimeType: data.mimeType || 'video/mp4',
        interactionId: data.interactionId,
        creditCost: currentShotCost,
        createdAt: Date.now(),
      };

      setClips((prev) => [newClip, ...prev]);
      setActiveClipId(newClip.id);
      setSceneItems((prev) => [
        ...prev,
        { id: crypto.randomUUID(), clipId: newClip.id, order: prev.length },
      ]);
    } catch (err) {
      refundCredits(txId, currentShotCost);
      setErrorMessage(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setIsGeneratingVideo(false);
      setGenerationStatus('');
    }
  };

  const handleExtendOrEditClip = async () => {
    const targetClip = clips.find((c) => c.id === extendTargetClipId);
    if (!targetClip || !targetClip.interactionId) {
      setErrorMessage('This clip does not have a stored interaction ID for extension.');
      return;
    }
    if (!extendPrompt.trim()) {
      setErrorMessage('Describe how the shot should continue or be edited.');
      return;
    }

    const currentCredits = reconcileCreditState(creditState);
    if (currentCredits.balance < FLOW_CREDIT_COSTS.extendShot) {
      setErrorMessage(
        `Need ${FLOW_CREDIT_COSTS.extendShot} credits (${currentCredits.balance} remaining). Refreshes to 50 at 00:00.`
      );
      return;
    }

    setErrorMessage(null);
    setIsGeneratingVideo(true);
    setGenerationStatus(`Extending shot (+${extendDuration}) with Omni / Veo...`);
    const txId = deductCredits(
      `Extend shot (+${extendDuration})`,
      FLOW_CREDIT_COSTS.extendShot
    );

    try {
      const res = await fetch('/api/flow/extend-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousInteractionId: targetClip.interactionId,
          prompt: extendPrompt.trim(),
          duration: extendDuration,
        }),
      });
      const data = (await res.json()) as {
        clipId?: string;
        videoUrl?: string;
        mimeType?: string;
        interactionId?: string;
        error?: string;
      };
      if (!res.ok || !data.videoUrl) {
        throw new Error(data.error || 'Failed to extend clip.');
      }

      const extendedClip: FlowClip = {
        id: data.clipId || crypto.randomUUID(),
        prompt: extendPrompt.trim(),
        mode: 'extend',
        cameraMotion: targetClip.cameraMotion,
        aspectRatio: targetClip.aspectRatio,
        duration: extendDuration,
        resolution: targetClip.resolution,
        qualityTier: targetClip.qualityTier,
        videoUrl: data.videoUrl,
        mimeType: data.mimeType || 'video/mp4',
        interactionId: data.interactionId,
        creditCost: FLOW_CREDIT_COSTS.extendShot,
        createdAt: Date.now(),
        parentClipId: targetClip.id,
      };

      setClips((prev) => [extendedClip, ...prev]);
      setActiveClipId(extendedClip.id);
      setSceneItems((prev) => [
        ...prev,
        { id: crypto.randomUUID(), clipId: extendedClip.id, order: prev.length },
      ]);
      setExtendTargetClipId(null);
      setExtendPrompt('');
    } catch (err) {
      refundCredits(txId, FLOW_CREDIT_COSTS.extendShot);
      setErrorMessage(err instanceof Error ? err.message : 'Shot extension failed.');
    } finally {
      setIsGeneratingVideo(false);
      setGenerationStatus('');
    }
  };

  const handleGenerateMusicScore = async () => {
    if (!scorePrompt.trim() || isGeneratingScore) return;
    const currentCredits = reconcileCreditState(creditState);
    if (currentCredits.balance < FLOW_CREDIT_COSTS.musicScore) {
      setErrorMessage(
        `Need ${FLOW_CREDIT_COSTS.musicScore} credits for a film score (${currentCredits.balance} remaining).`
      );
      return;
    }

    setErrorMessage(null);
    setIsGeneratingScore(true);
    const txId = deductCredits('Generate Film Score (Lyria)', FLOW_CREDIT_COSTS.musicScore);

    try {
      const res = await fetch('/api/flow/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: scorePrompt.trim() }),
      });
      const data = (await res.json()) as {
        audioId?: string;
        audioUrl?: string;
        mimeType?: string;
        lyrics?: string;
        error?: string;
      };
      if (!res.ok || !data.audioUrl) {
        throw new Error(data.error || 'Music generation failed.');
      }
      setAudioScore({
        id: data.audioId || crypto.randomUUID(),
        prompt: scorePrompt.trim(),
        audioUrl: data.audioUrl,
        mimeType: data.mimeType || 'audio/wav',
        lyrics: data.lyrics,
        createdAt: Date.now(),
      });
    } catch (err) {
      refundCredits(txId, FLOW_CREDIT_COSTS.musicScore);
      setErrorMessage(err instanceof Error ? err.message : 'Film score generation failed.');
    } finally {
      setIsGeneratingScore(false);
    }
  };

  const handleAddClipToScene = (clipId: string) => {
    setSceneItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), clipId, order: prev.length },
    ]);
  };

  const handleMoveSceneItem = (itemId: string, dir: -1 | 1) => {
    setSceneItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === itemId);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const copy = [...sorted];
      const temp = copy[idx];
      copy[idx] = copy[swapIdx];
      copy[swapIdx] = temp;
      return copy.map((item, i) => ({ ...item, order: i }));
    });
  };

  const handleRemoveSceneItem = (itemId: string) => {
    setSceneItems((prev) =>
      prev
        .filter((s) => s.id !== itemId)
        .sort((a, b) => a.order - b.order)
        .map((item, idx) => ({ ...item, order: idx }))
    );
  };

  const handleStartReelPlayback = () => {
    if (sceneClips.length === 0) return;
    setReelIndex(0);
    setIsPlayingReel(true);
    setTimeout(() => {
      void videoRef.current?.play().catch(() => {});
    }, 50);
  };

  const handleVideoEnded = () => {
    if (!isPlayingReel) return;
    if (reelIndex + 1 < sceneClips.length) {
      setReelIndex((i) => i + 1);
      setTimeout(() => {
        void videoRef.current?.play().catch(() => {});
      }, 60);
    } else {
      setIsPlayingReel(false);
      setReelIndex(0);
    }
  };

  const handleSendToChat = () => {
    const lines = [
      `### Google Flow Film Storyboard (${sceneClips.length || clips.length} shots)`,
      `Daily credits remaining: **${creditState.balance} / ${FLOW_DAILY_CREDIT_LIMIT}** (refreshes at 00:00)`,
      '',
    ];
    const exportList = sceneClips.length > 0 ? sceneClips.map((s) => s.clip) : clips;
    exportList.forEach((c, idx) => {
      lines.push(
        `${idx + 1}. **${c.mode.toUpperCase()} (${c.duration}, ${c.resolution}, ${c.cameraMotion})**: ${c.prompt}`
      );
    });
    if (audioScore) {
      lines.push('', `**Film Score (Lyria)**: ${audioScore.prompt}`);
    }
    onSendFilmToChat(lines.join('\n'));
    onClose();
  };

  const resetCountdownText = formatMidnightCountdown(countdownMs);

  return (
    <div
      role="dialog"
      aria-label="Google Flow AI Filmmaking Studio"
      className="fixed inset-0 z-50 bg-[#08090c] text-[#f5f6f8] flex flex-col overflow-hidden select-none"
    >
      {/* Top Bar (3-zone contract) */}
      <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-white/10 bg-[#0d0f14] flex items-center justify-between gap-4">
        {/* Zone 1: Brand & Back */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Folio</span>
          </button>
          <span className="h-4 w-px bg-white/15" aria-hidden="true" />
          <span className="font-display text-base font-semibold tracking-tight text-white whitespace-nowrap shrink-0">
            Google Flow
          </span>
        </div>

        {/* Zone 2: Studio Mode Tabs */}
        <nav
          aria-label="Google Flow studio modes"
          className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10"
        >
          {(
            [
              { id: 'text', label: 'Text to Video', icon: Video },
              { id: 'frames', label: 'Frames to Video', icon: Film },
              { id: 'ingredients', label: 'Ingredients to Video', icon: Layers },
              { id: 'scenebuilder', label: 'Scenebuilder', icon: Scissors },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setShowWelcome(false);
                  setActiveTab(tab.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-[#0d0d0d] shadow-xs'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 50-Credit Daily Wallet (Refreshes at 00:00) */}
        <div className="relative flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCreditDrawerOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.09] text-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-white tabular-nums">
              {creditState.balance} / {FLOW_DAILY_CREDIT_LIMIT}
            </span>
            <span className="text-neutral-400 hidden sm:inline tabular-nums">
              · 00:00 in {resetCountdownText}
            </span>
          </button>

          {creditDrawerOpen && (
            <div className="absolute right-0 top-12 w-80 rounded-2xl border border-white/15 bg-[#12151d] shadow-2xl p-4 z-50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Daily Free Credits</div>
                  <div className="text-xs text-neutral-400 tabular-nums">
                    Refreshes to 50 at 00:00 (in {resetCountdownText})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreditDrawerOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: `${(creditState.balance / FLOW_DAILY_CREDIT_LIMIT) * 100}%`,
                  }}
                />
              </div>

              <div className="text-[11px] text-neutral-400 space-y-1 border-t border-white/10 pt-2.5">
                <div className="flex justify-between tabular-nums">
                  <span>Omni / Veo Fast (720p)</span>
                  <span className="text-neutral-200">{FLOW_CREDIT_COSTS.videoFast720} credits</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span>Omni / Veo Quality (1080p)</span>
                  <span className="text-neutral-200">{FLOW_CREDIT_COSTS.videoQuality1080} credits</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span>Extend / Edit Shot</span>
                  <span className="text-neutral-200">{FLOW_CREDIT_COSTS.extendShot} credits</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span>Frame / Ingredient (Nano Banana)</span>
                  <span className="text-neutral-200">{FLOW_CREDIT_COSTS.imageFrame} credits</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span>Film Score (Lyria Clip)</span>
                  <span className="text-neutral-200">{FLOW_CREDIT_COSTS.musicScore} credits</span>
                </div>
              </div>

              {creditState.transactions.length > 0 && (
                <div className="border-t border-white/10 pt-2.5 max-h-40 overflow-y-auto space-y-1.5 chat-scroll">
                  <div className="text-[11px] font-medium text-neutral-400">Recent activity</div>
                  {creditState.transactions.slice(0, 6).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-[11px] text-neutral-300"
                    >
                      <span className="truncate pr-2">{tx.action}</span>
                      <span
                        className={`font-mono tabular-nums shrink-0 ${
                          tx.status === 'refunded' ? 'text-emerald-400' : 'text-neutral-400'
                        }`}
                      >
                        {tx.status === 'refunded' ? 'Refunded' : `-${tx.cost}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-[#0d0f14] overflow-x-auto">
        {(
          [
            { id: 'text', label: 'Text' },
            { id: 'frames', label: 'Frames' },
            { id: 'ingredients', label: 'Ingredients' },
            { id: 'scenebuilder', label: 'Scenebuilder' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setShowWelcome(false);
              setActiveTab(tab.id);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white text-[#0d0d0d]'
                : 'text-neutral-300 bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Welcome Landing Hero (inspired by flow.google screenshot) */}
      {showWelcome ? (
        <div className="flex-1 relative flex items-center justify-center overflow-y-auto p-6">
          <img
            src="/assets/aistudio/Screenshot_2026-11-17-17-59-26-791_com.chrome.dev_cd56b393.jpg"
            alt="Google Flow AI filmmaking backdrop"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-25 blur-xs scale-105 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090c]/75 via-[#08090c]/85 to-[#08090c]" />

          <div className="relative z-10 max-w-2xl w-full text-center space-y-6 py-8">
            <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-white [text-wrap:balance]">
              Google Flow
            </h1>
            <p className="text-lg sm:text-xl text-neutral-200 max-w-xl mx-auto leading-relaxed [text-wrap:balance]">
              Your AI creative studio built with Google&apos;s advanced generative models.
            </p>

            <div className="flex flex-col items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowWelcome(false)}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-white text-[#0d0d0d] font-semibold text-base shadow-xl hover:bg-neutral-100 active:scale-[0.99] transition-all whitespace-nowrap cursor-pointer"
              >
                <span>Create with Google Flow</span>
              </button>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-300 tabular-nums">
                <span>{creditState.balance} / 50 free daily credits</span>
                <span aria-hidden="true">·</span>
                <span>Refreshes at 00:00 ({resetCountdownText})</span>
                <span aria-hidden="true">·</span>
                <span>Omni / Veo &amp; Nano Banana</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('text');
                  setShowWelcome(false);
                }}
                className="p-4 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-left space-y-1.5"
              >
                <div className="text-sm font-semibold text-white">Text &amp; Camera to Video</div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Direct Omni / Veo shots with pan, dolly, orbit, and native audio.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('frames');
                  setShowWelcome(false);
                }}
                className="p-4 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-left space-y-1.5"
              >
                <div className="text-sm font-semibold text-white">Frames &amp; Ingredients</div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Lock start/end keyframes or up to 3 character &amp; scene ingredients.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('scenebuilder');
                  setShowWelcome(false);
                }}
                className="p-4 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-left space-y-1.5"
              >
                <div className="text-sm font-semibold text-white">Scenebuilder Timeline</div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Extend shots seamlessly, score with Lyria, and play your full film reel.
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Main Filmmaking Workspace */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left Director Panel */}
            <aside className="w-full lg:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0d0f14] flex flex-col min-h-0 overflow-y-auto chat-scroll p-4 sm:p-5 space-y-5">
              {/* Frames to Video Controls */}
              {activeTab === 'frames' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Keyframe Slots (Start &amp; End)
                    </span>
                    <span className="text-[11px] text-neutral-400 tabular-nums">
                      {FLOW_CREDIT_COSTS.imageFrame} credits / AI frame
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {(['start', 'end'] as const).map((slotKey) => {
                      const slot = slotKey === 'start' ? startFrame : endFrame;
                      const isBusy = generatingFrameTarget === slotKey;
                      return (
                        <div
                          key={slotKey}
                          className="rounded-xl border border-white/10 bg-black/40 p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-neutral-200">
                              {slotKey === 'start' ? 'Start Frame' : 'End Frame (opt)'}
                            </span>
                            {slot && (
                              <button
                                type="button"
                                onClick={() =>
                                  slotKey === 'start'
                                    ? setStartFrame(null)
                                    : setEndFrame(null)
                                }
                                className="text-neutral-400 hover:text-red-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {slot ? (
                            <img
                              src={slot.imageDataUrl}
                              alt={slot.label}
                              referrerPolicy="no-referrer"
                              className="w-full h-24 object-cover rounded-lg border border-white/10"
                            />
                          ) : (
                            <div className="w-full h-24 rounded-lg border border-dashed border-white/15 flex flex-col items-center justify-center text-[11px] text-neutral-500">
                              <ImagePlus className="w-4 h-4 mb-1" />
                              <span>Empty slot</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <label className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-neutral-200 cursor-pointer whitespace-nowrap">
                              <Upload className="w-3 h-3" />
                              <span>Upload</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  void handleUploadFrameFile(slotKey, e.target.files?.[0])
                                }
                              />
                            </label>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleGenerateFrameImage(slotKey)}
                              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-600/25 hover:bg-blue-600/35 text-[11px] text-blue-200 disabled:opacity-50 whitespace-nowrap"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Wand2 className="w-3 h-3" />
                              )}
                              <span>Generate</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={framePromptInput}
                    onChange={(e) => setFramePromptInput(e.target.value)}
                    placeholder="Optional frame image prompt (defaults to scene prompt)..."
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Ingredients to Video Controls */}
              {activeTab === 'ingredients' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Ingredients Drawer ({selectedIngredientIds.length} / 3 active)
                    </span>
                    <span className="text-[11px] text-neutral-400 tabular-nums">
                      {FLOW_CREDIT_COSTS.imageFrame} credits / AI asset
                    </span>
                  </div>

                  {/* Create / Upload Ingredient */}
                  <div className="rounded-xl border border-white/10 bg-black/35 p-3 space-y-2.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newIngredientName}
                        onChange={(e) => setNewIngredientName(e.target.value)}
                        placeholder="Ingredient name (e.g. Detective Mara)"
                        className="flex-1 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={newIngredientCategory}
                        onChange={(e) =>
                          setNewIngredientCategory(e.target.value as FlowIngredientCategory)
                        }
                        aria-label="Ingredient category"
                        className="rounded-lg border border-white/10 bg-[#151822] px-2 py-1.5 text-xs text-neutral-200 focus:outline-none"
                      >
                        <option value="character">Character</option>
                        <option value="object">Prop / Object</option>
                        <option value="location">Location</option>
                        <option value="style">Style</option>
                      </select>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newIngredientPrompt}
                        onChange={(e) => setNewIngredientPrompt(e.target.value)}
                        placeholder="Describe ingredient to generate with Nano Banana..."
                        className="flex-1 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        disabled={isGeneratingIngredient}
                        onClick={() => void handleGenerateIngredient()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {isGeneratingIngredient ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Create</span>
                      </button>
                      <label className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-xs text-neutral-200 cursor-pointer shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            void handleUploadIngredientFile(e.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {ingredients.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-neutral-400">
                      Generate or upload characters, props, or sets to keep continuity across shots.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {ingredients.map((ing) => {
                        const selected = selectedIngredientIds.includes(ing.id);
                        return (
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => toggleIngredientSelection(ing.id)}
                            className={`rounded-xl border p-1.5 text-left transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-500/15'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                            }`}
                          >
                            <img
                              src={ing.imageDataUrl}
                              alt={ing.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-16 object-cover rounded-lg"
                            />
                            <div className="text-[11px] font-medium text-white truncate mt-1">
                              {ing.name}
                            </div>
                            <div className="text-[10px] text-neutral-400 capitalize">
                              {ing.category}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Scenebuilder Film Score Panel */}
              {activeTab === 'scenebuilder' && (
                <div className="rounded-xl border border-white/10 bg-black/35 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Lyria Film Score
                    </span>
                    <span className="text-[11px] text-neutral-400 tabular-nums">
                      {FLOW_CREDIT_COSTS.musicScore} credits
                    </span>
                  </div>
                  <textarea
                    value={scorePrompt}
                    onChange={(e) => setScorePrompt(e.target.value)}
                    rows={2}
                    placeholder="Describe mood, tempo, instruments..."
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  <button
                    type="button"
                    disabled={isGeneratingScore}
                    onClick={() => void handleGenerateMusicScore()}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {isGeneratingScore ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Music className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isGeneratingScore
                        ? 'Composing Score...'
                        : `Generate 30s Score · ${FLOW_CREDIT_COSTS.musicScore} credits`}
                    </span>
                  </button>
                  {audioScore && (
                    <div className="space-y-1.5 pt-1">
                      <audio
                        ref={scoreAudioRef}
                        src={audioScore.audioUrl}
                        controls
                        className="w-full h-8"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Scene Prompt & Camera / Model Settings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white">
                    Director Prompt
                  </label>
                  <div className="flex items-center gap-1">
                    {STARTER_SHOT_IDEAS.map((idea) => (
                      <button
                        key={idea.label}
                        type="button"
                        onClick={() => {
                          setPrompt(idea.prompt);
                          setCameraMotion(idea.camera);
                        }}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-neutral-300 whitespace-nowrap"
                      >
                        {idea.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Describe subject, action, lighting, lens, and atmosphere..."
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-neutral-400 flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    <span>Camera Motion</span>
                  </label>
                  <select
                    value={cameraMotion}
                    onChange={(e) => setCameraMotion(e.target.value as FlowCameraMotion)}
                    className="w-full rounded-xl border border-white/10 bg-[#151822] px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    {CAMERA_MOTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Clip Duration</span>
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151822] px-2.5 py-2 text-xs text-white focus:outline-none tabular-nums"
                  >
                    <option value="3s">3s</option>
                    <option value="5s">5s</option>
                    <option value="6s">6s</option>
                    <option value="8s">8s</option>
                    <option value="10s">10s</option>
                    <option value="15s">15s</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-neutral-400">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
                    {(['16:9', '9:16'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                          aspectRatio === ratio
                            ? 'bg-white text-[#0d0d0d]'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-neutral-400">
                    Veo / Omni Tier
                  </label>
                  <select
                    value={`${qualityTier}-${resolution}`}
                    onChange={(e) => {
                      const [tier, res] = e.target.value.split('-') as [
                        FlowQualityTier,
                        FlowResolution,
                      ];
                      setQualityTier(tier);
                      setResolution(res);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#151822] px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="fast-720p">Omni / Veo Fast · 720p (5 cr)</option>
                    <option value="fast-360p">Omni / Veo Draft · 360p (5 cr)</option>
                    <option value="quality-1080p">Omni / Veo Quality · 1080p (10 cr)</option>
                  </select>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 leading-relaxed">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                disabled={isGeneratingVideo || creditState.balance < currentShotCost}
                onClick={() => void handleGenerateVideo()}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-white text-[#0d0d0d] hover:bg-neutral-200 disabled:opacity-45 font-semibold text-sm shadow-lg transition-all whitespace-nowrap cursor-pointer"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{generationStatus || 'Generating Shot...'}</span>
                  </>
                ) : creditState.balance < currentShotCost ? (
                  <span>Daily Limit Reached · Resets at 00:00</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span className="tabular-nums">
                      Generate Shot · {currentShotCost} credits
                    </span>
                  </>
                )}
              </button>
            </aside>

            {/* Center Screening Monitor & Clip Bin */}
            <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#08090c] overflow-hidden">
              {/* Monitor Canvas */}
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 sm:p-6 relative">
                {displayedVideoClip ? (
                  <div className="w-full max-w-4xl flex flex-col items-center gap-3">
                    <div
                      className={`relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl ${
                        displayedVideoClip.aspectRatio === '9:16'
                          ? 'max-w-[340px] aspect-[9/16]'
                          : 'aspect-video max-h-[54vh]'
                      }`}
                    >
                      <video
                        ref={videoRef}
                        key={displayedVideoClip.id + (isPlayingReel ? `-reel-${reelIndex}` : '')}
                        src={displayedVideoClip.videoUrl}
                        controls
                        autoPlay
                        loop={!isPlayingReel}
                        playsInline
                        onEnded={handleVideoEnded}
                        className="w-full h-full object-contain bg-black"
                      />
                    </div>

                    {/* Active Shot Metadata & Controls */}
                    <div className="w-full flex flex-wrap items-center justify-between gap-3 px-1">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs text-white font-medium truncate max-w-xl">
                          {isPlayingReel
                            ? `Reel Shot ${reelIndex + 1} of ${sceneClips.length} · ${displayedVideoClip.prompt}`
                            : displayedVideoClip.prompt}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 tabular-nums">
                          <span>Omni / Veo</span>
                          <span aria-hidden="true">·</span>
                          <span>{displayedVideoClip.duration}</span>
                          <span aria-hidden="true">·</span>
                          <span>{displayedVideoClip.resolution}</span>
                          <span aria-hidden="true">·</span>
                          <span>{displayedVideoClip.cameraMotion}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {displayedVideoClip.interactionId && (
                          <button
                            type="button"
                            onClick={() => {
                              setExtendTargetClipId(
                                extendTargetClipId === displayedVideoClip.id
                                  ? null
                                  : displayedVideoClip.id
                              );
                              setExtendPrompt('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-white whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Extend / Edit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAddClipToScene(displayedVideoClip.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-white whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Scene</span>
                        </button>
                        <a
                          href={displayedVideoClip.videoUrl}
                          download={`${displayedVideoClip.id}.mp4`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#0d0d0d] hover:bg-neutral-200 text-xs font-semibold whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>MP4</span>
                        </a>
                      </div>
                    </div>

                    {/* Extend / Edit Drawer */}
                    {extendTargetClipId === displayedVideoClip.id && (
                      <div className="w-full rounded-xl border border-blue-500/35 bg-[#111622] p-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={extendPrompt}
                          onChange={(e) => setExtendPrompt(e.target.value)}
                          placeholder="Describe continuation (e.g. 'Camera pulls back to reveal neon skyline') or edit..."
                          className="flex-1 min-w-[220px] rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <select
                          value={extendDuration}
                          onChange={(e) => setExtendDuration(e.target.value)}
                          aria-label="Extension duration"
                          className="rounded-lg border border-white/15 bg-[#151822] px-2.5 py-1.5 text-xs text-white tabular-nums"
                        >
                          <option value="3s">+3s</option>
                          <option value="5s">+5s</option>
                          <option value="8s">+8s</option>
                          <option value="10s">+10s</option>
                        </select>
                        <button
                          type="button"
                          disabled={isGeneratingVideo}
                          onClick={() => void handleExtendOrEditClip()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                        >
                          {isGeneratingVideo ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>Run ({FLOW_CREDIT_COSTS.extendShot} cr)</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="max-w-md text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center mx-auto text-neutral-300">
                      <Film className="w-6 h-6" />
                    </div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Screening Monitor Ready
                    </h2>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Write a director prompt on the left, attach Start/End frames or up to 3 visual ingredients, and generate your first shot with Omni / Veo.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Scenebuilder Film Timeline */}
              <div className="shrink-0 border-t border-white/10 bg-[#0d0f14] px-4 py-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-white">
                      Scenebuilder Timeline
                    </span>
                    <span className="text-neutral-400 tabular-nums">
                      {sceneClips.length} {sceneClips.length === 1 ? 'shot' : 'shots'}
                    </span>
                    <span className="text-neutral-500 hidden sm:inline">·</span>
                    <span className="text-neutral-400 hidden sm:inline tabular-nums">
                      {clips.length} in bin
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={sceneClips.length === 0}
                      onClick={() =>
                        isPlayingReel ? setIsPlayingReel(false) : handleStartReelPlayback()
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#0d0d0d] hover:bg-neutral-200 disabled:opacity-40 text-xs font-semibold whitespace-nowrap"
                    >
                      {isPlayingReel ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop Reel</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play Film Reel</span>
                        </>
                      )}
                    </button>

                    {clips.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSendToChat}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-white whitespace-nowrap"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        <span>Post Film to Chat</span>
                      </button>
                    )}
                  </div>
                </div>

                {sceneClips.length === 0 ? (
                  <div className="h-20 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-xs text-neutral-500">
                    Generated shots appear here automatically for continuous Scenebuilder playback.
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 chat-scroll">
                    {sceneClips.map(({ item, clip }, idx) => {
                      const isCurrent =
                        (isPlayingReel && reelIndex === idx) ||
                        (!isPlayingReel && activeClip?.id === clip.id);
                      return (
                        <div
                          key={item.id}
                          className={`w-48 shrink-0 rounded-xl border p-2 transition-colors ${
                            isCurrent
                              ? 'border-blue-500 bg-blue-500/15'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsPlayingReel(false);
                                setActiveClipId(clip.id);
                              }}
                              className="text-[11px] font-semibold text-white truncate text-left flex-1"
                            >
                              Shot {idx + 1} · {clip.duration}
                            </button>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveSceneItem(item.id, -1)}
                                title="Move earlier"
                                className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === sceneClips.length - 1}
                                onClick={() => handleMoveSceneItem(item.id, 1)}
                                title="Move later"
                                className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSceneItem(item.id)}
                                title="Remove from timeline"
                                className="p-0.5 text-neutral-400 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPlayingReel(false);
                              setActiveClipId(clip.id);
                            }}
                            className="w-full text-left"
                          >
                            <div className="text-[11px] text-neutral-300 line-clamp-2 leading-snug">
                              {clip.prompt}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
