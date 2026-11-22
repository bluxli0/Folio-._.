import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Brush,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Code2,
  Copy,
  Download,
  Eraser,
  Film,
  Grid3X3,
  ImagePlus,
  Layers,
  MessageSquarePlus,
  Minus,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  RotateCcw,
  Send,
  Server,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  ASPECT_DIMENSIONS,
  AspectRatioPreset,
  CaptureSourceMode,
  DrawTool,
  StopMotionDemo,
  StopMotionFrame,
  VectorBrushStyle,
  VectorStopMotionSpec,
  VectorStrokeElement,
} from '../types/stopMotion';
import { ChatAttachment } from '../types/chat';
import {
  bakeServerVideoViaFfmpeg,
  blobToBase64,
  createStarterStopMotionFrames,
  drawCoverOrContain,
  expandPlaybackSequence,
  exportAnimatedGif,
  exportSpriteSheetPng,
  exportStopMotionJson,
  exportStopMotionXml,
  exportWebmVideo,
  loadImageElement,
  stitchServerVideosViaFfmpeg,
} from '../utils/stopMotionExport';
import { STOP_MOTION_DEMOS } from '../utils/stopMotionDemos';
import {
  isVectorBrushStyle,
  parseVectorStopMotionCode,
  pointHitsVectorElement,
  renderVectorElementOnCanvas,
  serializeFramesToStopMotionCode,
  svgMarkupToDataUrl,
  VECTOR_BRUSH_META,
  vectorElementsToSvgMarkup,
} from '../utils/vectorBrushes';
import {
  evaluateStopMotionFidelity,
  isStopMotionSceneV2,
  recompileStopMotionAtFps,
  StopMotionSceneV2,
} from '../utils/stopMotionEngine';
import {
  createAudioBufferFromMathSpec,
  MATH_AUDIO_PRESETS,
  MathAudioTrackSpec,
  synthesizeMathAudioWavBlob,
} from '../utils/mathAudioSynth';

interface StopMotionPanelProps {
  externalSpec?: VectorStopMotionSpec | null;
  onConsumeExternalSpec?: () => void;
  onPostToChat: (markdownText: string) => void;
  onAttachToChat: (attachment: ChatAttachment) => void;
  onClose: () => void;
}

const BRUSH_COLORS = [
  '#111827',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#2563eb',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
];

const PAPER_COLORS = [
  { color: '#faf8f5', label: 'Warm paper' },
  { color: '#ffffff', label: 'Pure white' },
  { color: '#fef3c7', label: 'Cream card' },
  { color: '#18181b', label: 'Dark slate' },
  { color: '#0f172a', label: 'Midnight navy' },
];

const BRUSH_SIZES = [3, 6, 12, 22];
const FPS_PRESETS = [6, 12, 24, 30, 60];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const StopMotionPanel: React.FC<StopMotionPanelProps> = ({
  externalSpec,
  onConsumeExternalSpec,
  onPostToChat,
  onAttachToChat,
  onClose,
}) => {
  const [aspect, setAspect] = useState<AspectRatioPreset>('16:9');
  const dimensions = ASPECT_DIMENSIONS[aspect];

  const [projectTitle, setProjectTitle] = useState(STOP_MOTION_DEMOS[0].title);
  const [activeDemoId, setActiveDemoId] = useState<string>(STOP_MOTION_DEMOS[0].id);
  const [frames, setFrames] = useState<StopMotionFrame[]>(() =>
    createStarterStopMotionFrames(800, 450)
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [sourceMode, setSourceMode] = useState<CaptureSourceMode>('draw');

  // Playback & FPS state (v3 duration-preserving engine)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [fps, setFps] = useState(STOP_MOTION_DEMOS[0].fps);
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [pingPong, setPingPong] = useState(STOP_MOTION_DEMOS[0].pingPong);
  const [durationSecOverride, setDurationSecOverride] = useState<number | null>(null);
  const [totalLogicalFramesOverride, setTotalLogicalFramesOverride] = useState<number | null>(null);
  const [conserveDuration, setConserveDuration] = useState(true);

  // Onion skin & guides
  const [onionEnabled, setOnionEnabled] = useState(true);
  const [onionOpacity, setOnionOpacity] = useState(0.35);
  const [showGrid, setShowGrid] = useState(false);

  // Vector brush & draw canvas state
  const [activeBrushStyle, setActiveBrushStyle] = useState<VectorBrushStyle>('pen');
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [brushColor, setBrushColor] = useState('#111827');
  const [brushSize, setBrushSize] = useState(6);
  const [paperColor, setPaperColor] = useState('#faf8f5');
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [vectorStrokeCount, setVectorStrokeCount] = useState(0);

  // Production v3 drawer: Pure-Math Audio + Server Bake + CI/CD Clip Stitcher
  const [productionOpen, setProductionOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioPreset, setAudioPreset] = useState<NonNullable<MathAudioTrackSpec['preset']>>('chime');
  const [audioFormula, setAudioFormula] = useState<string>(MATH_AUDIO_PRESETS.chime.formula);
  const [bakeProgressText, setBakeProgressText] = useState<string | null>(null);
  const [stitchQueue, setStitchQueue] = useState<
    Array<{ id: string; label: string; blob: Blob; repeatCount: number }>
  >([]);

  // Vector code editor state
  const [vectorCodeDraft, setVectorCodeDraft] = useState(() =>
    serializeFramesToStopMotionCode(
      STOP_MOTION_DEMOS[0].buildFrames(800, 450),
      STOP_MOTION_DEMOS[0].fps,
      800,
      450,
      STOP_MOTION_DEMOS[0].background,
      STOP_MOTION_DEMOS[0].pingPong,
      STOP_MOTION_DEMOS[0].title
    )
  );
  const [vectorCodeError, setVectorCodeError] = useState<string | null>(null);

  // Two Studio Header Menus
  const [demosMenuOpen, setDemosMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Camera state
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [intervalSec, setIntervalSec] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  // Export & status feedback
  const [isExporting, setIsExporting] = useState<'gif' | 'webm' | 'sheet' | 'chat' | 'bake' | 'stitch' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const demosMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const sourceSceneRef = useRef<StopMotionSceneV2 | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Vector drawing & undo refs
  const vectorElementsRef = useRef<VectorStrokeElement[]>([]);
  const activeElementRef = useRef<VectorStrokeElement | null>(null);
  const undoStackRef = useRef<VectorStrokeElement[][]>([]);
  const baseSvgMarkupRef = useRef<string | null>(null);
  const baseRasterUrlRef = useRef<string | null>(null);
  const baseOverlayImgRef = useRef<HTMLImageElement | null>(null);
  const isErasingStrokeRef = useRef(false);
  const isDrawingRef = useRef(false);

  const showTempStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(null), 2800);
    return () => clearTimeout(t);
  }, [statusMessage]);

  // Close either header menu on outside click or Escape
  useEffect(() => {
    if (!demosMenuOpen && !exportMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (demosMenuOpen && demosMenuRef.current && !demosMenuRef.current.contains(target)) {
        setDemosMenuOpen(false);
      }
      if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDemosMenuOpen(false);
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [demosMenuOpen, exportMenuOpen]);

  // Consume externalSpec when user clicks "Open in Studio" from a chat cell
  useEffect(() => {
    if (!externalSpec) return;
    setIsPlaying(false);
    sourceSceneRef.current = isStopMotionSceneV2(externalSpec.sourceScene)
      ? externalSpec.sourceScene
      : null;
    setFrames(externalSpec.frames);
    setFps(externalSpec.fps);
    setLoopPlayback(externalSpec.loop);
    setPingPong(externalSpec.pingPong);
    setDurationSecOverride(externalSpec.durationSec ?? null);
    setTotalLogicalFramesOverride(externalSpec.totalLogicalFrames ?? null);
    if (externalSpec.audioSpec) {
      setAudioEnabled(true);
      if (externalSpec.audioSpec.preset) setAudioPreset(externalSpec.audioSpec.preset);
      if (externalSpec.audioSpec.formula) setAudioFormula(externalSpec.audioSpec.formula);
    }
    setPaperColor(externalSpec.background || '#faf8f5');
    setProjectTitle(externalSpec.title || 'AI Vector Animation');
    setActiveDemoId('');
    setSelectedIndex(0);
    setEditingFrameId(null);
    setVectorCodeDraft(
      externalSpec.sourceScene
        ? JSON.stringify(externalSpec.sourceScene, null, 2)
        : serializeFramesToStopMotionCode(
            externalSpec.frames,
            externalSpec.fps,
            externalSpec.width,
            externalSpec.height,
            externalSpec.background,
            externalSpec.pingPong,
            externalSpec.title || 'AI Vector Animation'
          )
    );
    setVectorCodeError(null);
    setSourceMode('vector');
    showTempStatus('Loaded animation into Studio.');
    onConsumeExternalSpec?.();
  }, [externalSpec, onConsumeExternalSpec, showTempStatus]);

  const totalUnits = useMemo(
    () => frames.reduce((acc, f) => acc + Math.max(1, f.hold), 0),
    [frames]
  );
  const totalSeconds = useMemo(
    () => (durationSecOverride ?? totalUnits / Math.max(1, fps)).toFixed(1),
    [durationSecOverride, totalUnits, fps]
  );
  const effectivePlayFps = useMemo(() => {
    if (
      totalLogicalFramesOverride &&
      totalLogicalFramesOverride > frames.length &&
      durationSecOverride &&
      durationSecOverride > 0
    ) {
      return Math.max(1, frames.length / durationSecOverride);
    }
    if (conserveDuration && durationSecOverride && durationSecOverride > 0 && frames.length > 0 && !sourceSceneRef.current) {
      return Math.max(1, totalUnits / durationSecOverride);
    }
    return fps;
  }, [totalLogicalFramesOverride, frames.length, durationSecOverride, conserveDuration, totalUnits, fps]);

  const activeAudioSpec = useMemo<MathAudioTrackSpec | undefined>(() => {
    if (!audioEnabled) return undefined;
    return {
      mode: 'math',
      preset: audioPreset,
      formula: audioFormula,
      durationSec: Number(totalSeconds) || 3,
      gain: 0.72,
    };
  }, [audioEnabled, audioPreset, audioFormula, totalSeconds]);

  const handleFpsChange = (nextFps: number) => {
    const clampedFps = Math.max(1, Math.min(60, Math.round(nextFps)));
    setFps(clampedFps);

    if (sourceSceneRef.current) {
      const recompiled = recompileStopMotionAtFps(
        sourceSceneRef.current,
        clampedFps,
        svgMarkupToDataUrl
      );
      setFrames(recompiled.frames);
      setDurationSecOverride(recompiled.durationSec ?? null);
      setTotalLogicalFramesOverride(recompiled.totalLogicalFrames ?? null);
      setSelectedIndex(0);
      showTempStatus(
        `Recompiled ${recompiled.totalLogicalFrames?.toLocaleString() || recompiled.frames.length}f @ ${clampedFps}fps (${(recompiled.durationSec ?? 0).toFixed(1)}s locked).`
      );
    } else if (conserveDuration && frames.length > 0) {
      if (!durationSecOverride) {
        setDurationSecOverride(totalUnits / Math.max(1, fps));
      }
      showTempStatus(`FPS set to ${clampedFps} (runtime locked at ${totalSeconds}s).`);
    }
  };

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (frames.length === 0) {
      setSelectedIndex(0);
      setIsPlaying(false);
    } else if (selectedIndex >= frames.length) {
      setSelectedIndex(frames.length - 1);
    }
  }, [frames.length, selectedIndex]);

  // Smooth requestAnimationFrame playback scheduler respecting per-frame hold counts & ping-pong
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const seq = expandPlaybackSequence(frames, pingPong);
    if (seq.length === 0) {
      setIsPlaying(false);
      return;
    }

    let step = 0;
    setPlayIndex(seq[0] ?? 0);

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const stepLoop = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;
      elapsed += dt;

      const frameIdx = seq[step] ?? 0;
      const frame = frames[frameIdx];
      const targetDuration = Math.max(
        16,
        (1000 / Math.max(1, effectivePlayFps)) * Math.max(1, frame?.hold || 1)
      );

      if (elapsed >= targetDuration) {
        elapsed %= targetDuration;
        if (step + 1 < seq.length) {
          step += 1;
          setPlayIndex(seq[step] ?? 0);
        } else if (loopPlayback) {
          step = 0;
          setPlayIndex(seq[0] ?? 0);
        } else {
          setIsPlaying(false);
          setSelectedIndex(frameIdx);
          return;
        }
      }

      rafId = window.requestAnimationFrame(stepLoop);
    };

    rafId = window.requestAnimationFrame(stepLoop);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, frames, effectivePlayFps, loopPlayback, pingPong]);

  // Camera stream management
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (sourceMode !== 'camera' || isPlaying) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setCameraError(
          err instanceof Error
            ? `Camera unavailable: ${err.message}`
            : 'Camera permission denied or no camera detected.'
        );
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [sourceMode, isPlaying, facingMode, stopCamera]);

  // Vector Draw Canvas Rendering
  const redrawDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (baseOverlayImgRef.current) {
      ctx.drawImage(baseOverlayImgRef.current, 0, 0, canvas.width, canvas.height);
    }

    for (const el of vectorElementsRef.current) {
      renderVectorElementOnCanvas(ctx, el);
    }
    if (activeElementRef.current) {
      renderVectorElementOnCanvas(ctx, activeElementRef.current);
    }
  }, []);

  useEffect(() => {
    if (sourceMode === 'draw' && !isPlaying) {
      redrawDrawCanvas();
    }
  }, [sourceMode, isPlaying, dimensions.width, dimensions.height, redrawDrawCanvas]);

  const pushVectorUndoSnapshot = useCallback(() => {
    const snapshot = vectorElementsRef.current.map((el) =>
      el.kind === 'path' ? { ...el, points: [...el.points] } : { ...el }
    );
    undoStackRef.current = [...undoStackRef.current.slice(-29), snapshot];
    setCanUndo(true);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    vectorElementsRef.current = prev;
    setVectorStrokeCount(prev.length);
    setCanUndo(undoStackRef.current.length > 0);
    redrawDrawCanvas();
  }, [redrawDrawCanvas]);

  const clearDrawCanvas = useCallback(() => {
    if (
      vectorElementsRef.current.length > 0 ||
      baseSvgMarkupRef.current ||
      baseRasterUrlRef.current
    ) {
      pushVectorUndoSnapshot();
    }
    vectorElementsRef.current = [];
    activeElementRef.current = null;
    baseSvgMarkupRef.current = null;
    baseRasterUrlRef.current = null;
    baseOverlayImgRef.current = null;
    setVectorStrokeCount(0);
    redrawDrawCanvas();
  }, [pushVectorUndoSnapshot, redrawDrawCanvas]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const eraseVectorAtPoint = useCallback(
    (pt: { x: number; y: number }) => {
      const hitAny = vectorElementsRef.current.some((el) =>
        pointHitsVectorElement(pt, el, brushSize / 2)
      );
      if (!hitAny) return;
      if (!isErasingStrokeRef.current) {
        pushVectorUndoSnapshot();
        isErasingStrokeRef.current = true;
      }
      vectorElementsRef.current = vectorElementsRef.current.filter(
        (el) => !pointHitsVectorElement(pt, el, brushSize / 2)
      );
      setVectorStrokeCount(vectorElementsRef.current.length);
      redrawDrawCanvas();
    },
    [brushSize, pushVectorUndoSnapshot, redrawDrawCanvas]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    isDrawingRef.current = true;
    isErasingStrokeRef.current = false;

    if (drawTool === 'eraser') {
      eraseVectorAtPoint(pt);
      return;
    }

    pushVectorUndoSnapshot();

    if (drawTool === 'line' || drawTool === 'rect' || drawTool === 'circle') {
      activeElementRef.current = {
        id: crypto.randomUUID(),
        kind: drawTool,
        color: brushColor,
        width: brushSize,
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
      };
    } else {
      const style: VectorBrushStyle = isVectorBrushStyle(drawTool)
        ? drawTool
        : activeBrushStyle;
      activeElementRef.current = {
        id: crypto.randomUUID(),
        kind: 'path',
        brush: style,
        points: [pt],
        color: brushColor,
        width: brushSize,
      };
    }

    redrawDrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getCanvasPoint(e);

    if (drawTool === 'eraser') {
      eraseVectorAtPoint(pt);
      return;
    }

    const active = activeElementRef.current;
    if (!active) return;

    if (active.kind === 'path') {
      const last = active.points[active.points.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 1.5) {
        active.points.push(pt);
        redrawDrawCanvas();
      }
    } else {
      active.x2 = pt.x;
      active.y2 = pt.y;
      redrawDrawCanvas();
    }
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    isErasingStrokeRef.current = false;

    const active = activeElementRef.current;
    if (active) {
      vectorElementsRef.current = [...vectorElementsRef.current, active];
      activeElementRef.current = null;
      setVectorStrokeCount(vectorElementsRef.current.length);
      redrawDrawCanvas();
    }
  };

  const triggerShutterFlash = useCallback(() => {
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 140);
  }, []);

  // Capture current Draw vector canvas into timeline
  const handleCaptureDrawFrame = useCallback(() => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;

    const strokeSvg = vectorElementsToSvgMarkup(vectorElementsRef.current);
    const combinedSvg = [baseSvgMarkupRef.current, strokeSvg]
      .filter((s): s is string => Boolean(s && s.trim().length > 0))
      .join('\n');

    let dataUrl: string;
    if (baseRasterUrlRef.current) {
      const composite = document.createElement('canvas');
      composite.width = dimensions.width;
      composite.height = dimensions.height;
      const ctx = composite.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, composite.width, composite.height);
      ctx.drawImage(drawCanvas, 0, 0, composite.width, composite.height);
      dataUrl = composite.toDataURL('image/png');
    } else {
      dataUrl = svgMarkupToDataUrl(
        combinedSvg,
        dimensions.width,
        dimensions.height,
        paperColor
      );
    }

    triggerShutterFlash();

    const capturedElements = vectorElementsRef.current.map((el) =>
      el.kind === 'path' ? { ...el, points: [...el.points] } : { ...el }
    );

    if (editingFrameId) {
      setFrames((prev) =>
        prev.map((f) =>
          f.id === editingFrameId
            ? {
                ...f,
                dataUrl,
                svgMarkup: baseRasterUrlRef.current ? undefined : combinedSvg,
                vectorElements: baseRasterUrlRef.current ? undefined : capturedElements,
                background: paperColor,
              }
            : f
        )
      );
      setEditingFrameId(null);
      showTempStatus('Vector frame updated.');
    } else {
      const nextFrame: StopMotionFrame = {
        id: crypto.randomUUID(),
        dataUrl,
        svgMarkup: baseRasterUrlRef.current ? undefined : combinedSvg,
        vectorElements: baseRasterUrlRef.current ? undefined : capturedElements,
        background: paperColor,
        hold: 1,
        createdAt: Date.now(),
      };
      setFrames((prev) => {
        const next = [...prev, nextFrame];
        setSelectedIndex(next.length - 1);
        return next;
      });
      showTempStatus('Vector frame captured.');
    }

    vectorElementsRef.current = [];
    activeElementRef.current = null;
    baseSvgMarkupRef.current = null;
    baseRasterUrlRef.current = null;
    baseOverlayImgRef.current = null;
    undoStackRef.current = [];
    setCanUndo(false);
    setVectorStrokeCount(0);
    redrawDrawCanvas();
  }, [
    dimensions.width,
    dimensions.height,
    paperColor,
    editingFrameId,
    triggerShutterFlash,
    showTempStatus,
    redrawDrawCanvas,
  ]);

  // Capture live webcam frame into timeline
  const handleCaptureCameraFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const composite = document.createElement('canvas');
    composite.width = dimensions.width;
    composite.height = dimensions.height;
    const ctx = composite.getContext('2d');
    if (!ctx) return;

    drawCoverOrContain(
      ctx,
      video,
      video.videoWidth,
      video.videoHeight,
      composite.width,
      composite.height,
      'cover',
      '#18181b'
    );

    const nextFrame: StopMotionFrame = {
      id: crypto.randomUUID(),
      dataUrl: composite.toDataURL('image/png'),
      hold: 1,
      createdAt: Date.now(),
    };

    triggerShutterFlash();
    setFrames((prev) => {
      const next = [...prev, nextFrame];
      setSelectedIndex(next.length - 1);
      return next;
    });
    showTempStatus('Camera frame captured.');
  }, [dimensions.width, dimensions.height, triggerShutterFlash, showTempStatus]);

  // Intervalometer auto-capture for Camera mode
  useEffect(() => {
    if (sourceMode !== 'camera' || !cameraReady || isPlaying || intervalSec <= 0) {
      setCountdown(null);
      return;
    }

    let remaining = intervalSec;
    setCountdown(remaining);

    const id = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        handleCaptureCameraFrame();
        remaining = intervalSec;
      }
      setCountdown(remaining);
    }, 1000);

    return () => window.clearInterval(id);
  }, [sourceMode, cameraReady, isPlaying, intervalSec, handleCaptureCameraFrame]);

  // Load any frame onto the Draw vector canvas (preserves VectorStrokeElement[] when present!)
  const loadFrameIntoDrawCanvas = useCallback(
    async (frame: StopMotionFrame, asEditTarget: boolean) => {
      setSourceMode('draw');
      setIsPlaying(false);
      setEditingFrameId(asEditTarget ? frame.id : null);

      if (frame.background) {
        setPaperColor(frame.background);
      }

      if (frame.vectorElements && frame.vectorElements.length > 0 && !frame.svgMarkup?.includes('<circle') && !frame.svgMarkup?.includes('<polygon')) {
        // Pure vector brush strokes
        baseSvgMarkupRef.current = null;
        baseRasterUrlRef.current = null;
        baseOverlayImgRef.current = null;
        vectorElementsRef.current = frame.vectorElements.map((el) =>
          el.kind === 'path' ? { ...el, points: [...el.points] } : { ...el }
        );
        setVectorStrokeCount(vectorElementsRef.current.length);
      } else if (frame.svgMarkup !== undefined) {
        // Rehydrate editable strokes if saved alongside a base SVG, or load SVG transparently over paper
        baseSvgMarkupRef.current = frame.svgMarkup;
        baseRasterUrlRef.current = null;
        vectorElementsRef.current = [];
        setVectorStrokeCount(0);
        try {
          const transparentSvgUrl = svgMarkupToDataUrl(
            frame.svgMarkup,
            dimensions.width,
            dimensions.height,
            'transparent'
          );
          baseOverlayImgRef.current = await loadImageElement(transparentSvgUrl);
        } catch {
          baseOverlayImgRef.current = null;
        }
      } else {
        baseSvgMarkupRef.current = null;
        baseRasterUrlRef.current = frame.dataUrl;
        vectorElementsRef.current = [];
        setVectorStrokeCount(0);
        try {
          baseOverlayImgRef.current = await loadImageElement(frame.dataUrl);
        } catch {
          baseOverlayImgRef.current = null;
        }
      }

      undoStackRef.current = [];
      setCanUndo(false);
      requestAnimationFrame(() => redrawDrawCanvas());
      showTempStatus(
        asEditTarget ? 'Frame loaded for vector editing.' : 'Previous frame copied to canvas.'
      );
    },
    [dimensions.width, dimensions.height, redrawDrawCanvas, showTempStatus]
  );

  // Batch import image files as timeline frames
  const handleImportFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const imageFiles = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (imageFiles.length === 0) {
      showTempStatus('Select PNG, JPEG, WebP, or GIF images.');
      return;
    }

    const added: StopMotionFrame[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');

    for (const file of imageFiles) {
      if (!ctx) break;
      const objUrl = URL.createObjectURL(file);
      try {
        const img = await loadImageElement(objUrl);
        drawCoverOrContain(
          ctx,
          img,
          img.naturalWidth,
          img.naturalHeight,
          canvas.width,
          canvas.height,
          'contain',
          '#18181b'
        );
        added.push({
          id: crypto.randomUUID(),
          dataUrl: canvas.toDataURL('image/png'),
          hold: 1,
          createdAt: Date.now() + added.length,
        });
      } catch {
        // Skip unreadable image
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    }

    if (added.length > 0) {
      setFrames((prev) => {
        const next = [...prev, ...added];
        setSelectedIndex(next.length - 1);
        return next;
      });
      showTempStatus(`Imported ${added.length} frame${added.length === 1 ? '' : 's'}.`);
    }
  };

  // Load any of the curated vector demos
  const handleSelectDemo = (demo: StopMotionDemo) => {
    setDemosMenuOpen(false);
    setIsPlaying(false);
    sourceSceneRef.current = null;
    setDurationSecOverride(null);
    setTotalLogicalFramesOverride(null);
    const builtFrames = demo.buildFrames(dimensions.width, dimensions.height);
    setFrames(builtFrames);
    setFps(demo.fps);
    setPingPong(demo.pingPong);
    setLoopPlayback(true);
    setPaperColor(demo.background);
    setProjectTitle(demo.title);
    setActiveDemoId(demo.id);
    setSelectedIndex(0);
    setEditingFrameId(null);
    setVectorCodeError(null);
    setVectorCodeDraft(
      serializeFramesToStopMotionCode(
        builtFrames,
        demo.fps,
        dimensions.width,
        dimensions.height,
        demo.background,
        demo.pingPong,
        demo.title
      )
    );
    showTempStatus(`Loaded ${demo.title}.`);
  };

  // Compile vector code editor text into timeline frames
  const handleCompileVectorCode = () => {
    const res = parseVectorStopMotionCode(vectorCodeDraft);
    if (res.error || !res.spec) {
      setVectorCodeError(res.error || 'Could not parse vector stop-motion code.');
      return;
    }
    setVectorCodeError(null);
    setIsPlaying(false);
    sourceSceneRef.current = isStopMotionSceneV2(res.spec.sourceScene)
      ? res.spec.sourceScene
      : null;
    setFrames(res.spec.frames);
    setFps(res.spec.fps);
    setDurationSecOverride(res.spec.durationSec ?? null);
    setTotalLogicalFramesOverride(res.spec.totalLogicalFrames ?? null);
    if (res.spec.audioSpec) {
      setAudioEnabled(true);
      if (res.spec.audioSpec.preset) setAudioPreset(res.spec.audioSpec.preset);
      if (res.spec.audioSpec.formula) setAudioFormula(res.spec.audioSpec.formula);
    }
    setLoopPlayback(res.spec.loop);
    setPingPong(res.spec.pingPong);
    setPaperColor(res.spec.background);
    setProjectTitle(res.spec.title || 'Vector Stop Motion');
    setActiveDemoId('');
    setSelectedIndex(0);
    setEditingFrameId(null);
    showTempStatus(
      `Compiled ${(res.spec.totalLogicalFrames ?? res.spec.frames.length).toLocaleString()} frames (${res.spec.durationSec?.toFixed(1) || totalSeconds}s).`
    );
  };

  const handleSyncVectorCodeFromTimeline = () => {
    const serialized = sourceSceneRef.current
      ? JSON.stringify({ ...sourceSceneRef.current, fps }, null, 2)
      : serializeFramesToStopMotionCode(
          frames,
          fps,
          dimensions.width,
          dimensions.height,
          paperColor,
          pingPong,
          projectTitle,
          activeAudioSpec
        );
    setVectorCodeDraft(serialized);
    setVectorCodeError(null);
    showTempStatus('Synced vector JSON from timeline.');
  };

  // Frame timeline actions
  const selectedFrame = frames[selectedIndex] || null;

  const handleSetHold = (idx: number, hold: number) => {
    setFrames((prev) => prev.map((f, i) => (i === idx ? { ...f, hold } : f)));
  };

  const handleDuplicateFrame = (idx: number) => {
    const target = frames[idx];
    if (!target) return;
    const copy: StopMotionFrame = {
      ...target,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setFrames((prev) => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    setSelectedIndex(idx + 1);
  };

  const handleMoveFrame = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= frames.length) return;
    setFrames((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
    setSelectedIndex(targetIdx);
  };

  const handleDeleteFrame = (idx: number) => {
    const removed = frames[idx];
    if (removed && removed.id === editingFrameId) {
      setEditingFrameId(null);
    }
    setFrames((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIndex((prevIdx) => Math.max(0, Math.min(prevIdx, frames.length - 2)));
  };

  // Post live render block directly into the chat thread
  const handlePostRenderToChat = () => {
    if (frames.length === 0) return;
    setExportMenuOpen(false);
    const code = sourceSceneRef.current
      ? JSON.stringify({ ...sourceSceneRef.current, fps, ...(activeAudioSpec ? { audio: activeAudioSpec } : {}) }, null, 2)
      : serializeFramesToStopMotionCode(
          frames,
          fps,
          dimensions.width,
          dimensions.height,
          paperColor,
          pingPong,
          projectTitle,
          activeAudioSpec
        );
    const md = `**${projectTitle}** · ${totalLogicalFramesOverride ?? frames.length} frames · ${fps} fps\n\n\`\`\`stopmotion\n${code}\n\`\`\``;
    onPostToChat(md);
    showTempStatus('Rendered animation into chat.');
  };

  const handleCopyVectorCode = async () => {
    if (frames.length === 0) return;
    setExportMenuOpen(false);
    const code = sourceSceneRef.current
      ? JSON.stringify({ ...sourceSceneRef.current, fps, ...(activeAudioSpec ? { audio: activeAudioSpec } : {}) }, null, 2)
      : serializeFramesToStopMotionCode(
          frames,
          fps,
          dimensions.width,
          dimensions.height,
          paperColor,
          pingPong,
          projectTitle,
          activeAudioSpec
        );
    try {
      await navigator.clipboard.writeText(code);
      showTempStatus('Copied vector JSON code.');
    } catch {
      showTempStatus('Clipboard unavailable.');
    }
  };

  const currentSpecSnapshot = useCallback((): VectorStopMotionSpec => ({
    format: 'stopmotion/v3',
    title: projectTitle,
    fps,
    width: dimensions.width,
    height: dimensions.height,
    background: paperColor,
    loop: loopPlayback,
    pingPong,
    durationSec: durationSecOverride ?? totalUnits / Math.max(1, fps),
    totalLogicalFrames: totalLogicalFramesOverride ?? totalUnits,
    sourceScene: sourceSceneRef.current ?? undefined,
    audioSpec: activeAudioSpec,
    frames,
  }), [projectTitle, fps, dimensions, paperColor, loopPlayback, pingPong, durationSecOverride, totalUnits, totalLogicalFramesOverride, activeAudioSpec, frames]);

  const handleExportXml = () => {
    if (frames.length === 0) return;
    setExportMenuOpen(false);
    const xml = exportStopMotionXml(currentSpecSnapshot());
    downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }), 'stop-motion-v3.xml');
    showTempStatus('Exported Stop Motion XML.');
  };

  const handleExportJson = () => {
    if (frames.length === 0) return;
    setExportMenuOpen(false);
    const json = exportStopMotionJson(currentSpecSnapshot());
    downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), 'stop-motion-v3.json');
    showTempStatus('Exported Stop Motion JSON.');
  };

  // Exports & Send GIF to Composer
  const handleExportGif = async () => {
    if (frames.length === 0 || isExporting) return;
    setExportMenuOpen(false);
    setIsExporting('gif');
    try {
      const blob = await exportAnimatedGif(
        frames,
        effectivePlayFps,
        pingPong,
        dimensions.width,
        dimensions.height
      );
      downloadBlob(blob, `stop-motion-${fps}fps.gif`);
      showTempStatus('Exported animated GIF.');
    } catch (err) {
      showTempStatus(err instanceof Error ? err.message : 'GIF export failed.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportWebm = async () => {
    if (frames.length === 0 || isExporting) return;
    setExportMenuOpen(false);
    setIsExporting('webm');
    try {
      const blob = await exportWebmVideo(
        frames,
        effectivePlayFps,
        pingPong,
        dimensions.width,
        dimensions.height,
        activeAudioSpec
      );
      downloadBlob(blob, `stop-motion-${fps}fps.webm`);
      showTempStatus('Exported WebM video.');
    } catch (err) {
      showTempStatus(err instanceof Error ? err.message : 'WebM export failed.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleServerBake = async (format: 'webm' | 'mp4', addToStitchQueue = false) => {
    if (frames.length === 0 || isExporting) return;
    setExportMenuOpen(false);
    setIsExporting('bake');
    setBakeProgressText('Starting FFmpeg...');
    try {
      const { blob } = await bakeServerVideoViaFfmpeg({
        frames,
        fps: effectivePlayFps,
        pingPong,
        width: dimensions.width,
        height: dimensions.height,
        format,
        audioSpec: activeAudioSpec,
        onProgress: (pct, msg) => setBakeProgressText(`${pct}% · ${msg}`),
      });
      if (addToStitchQueue) {
        setStitchQueue((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            label: `${projectTitle} (${frames.length}f @ ${fps}fps)`,
            blob,
            repeatCount: 1,
          },
        ]);
        showTempStatus(`Added baked ${format.toUpperCase()} clip to Stitch Queue.`);
      } else {
        downloadBlob(blob, `stop-motion-baked-${fps}fps.${format}`);
        showTempStatus(`Baked ${format.toUpperCase()} via FFmpeg.`);
      }
    } catch (err) {
      showTempStatus(err instanceof Error ? err.message : 'Server FFmpeg bake failed.');
    } finally {
      setIsExporting(null);
      setTimeout(() => setBakeProgressText(null), 2000);
    }
  };

  const handleStitchQueue = async () => {
    if (stitchQueue.length === 0 || isExporting) return;
    setIsExporting('stitch');
    setBakeProgressText('Stitching long-form video via FFmpeg...');
    try {
      const { blob } = await stitchServerVideosViaFfmpeg({
        clips: stitchQueue.map((c) => ({ blob: c.blob, repeatCount: c.repeatCount })),
        format: 'webm',
      });
      downloadBlob(blob, 'stop-motion-stitched.webm');
      showTempStatus('Stitched continuous WebM video.');
    } catch (err) {
      showTempStatus(err instanceof Error ? err.message : 'Stitch failed.');
    } finally {
      setIsExporting(null);
      setTimeout(() => setBakeProgressText(null), 2000);
    }
  };

  const handlePreviewMathAudio = () => {
    if (typeof AudioContext === 'undefined') return;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const buf = createAudioBufferFromMathSpec(ctx, {
      mode: 'math',
      preset: audioPreset,
      formula: audioFormula,
      durationSec: Math.min(8, Number(totalSeconds) || 3),
      gain: 0.72,
    });
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    showTempStatus('Playing pure-math audio waveform...');
  };

  const handleDownloadWav = () => {
    const blob = synthesizeMathAudioWavBlob({
      mode: 'math',
      preset: audioPreset,
      formula: audioFormula,
      durationSec: Number(totalSeconds) || 3,
      gain: 0.75,
    });
    downloadBlob(blob, 'stop-motion-math-audio.wav');
    showTempStatus('Downloaded WAV audio.');
  };

  const handleExportSpriteSheet = async () => {
    if (frames.length === 0 || isExporting) return;
    setExportMenuOpen(false);
    setIsExporting('sheet');
    try {
      const blob = await exportSpriteSheetPng(
        frames,
        dimensions.width,
        dimensions.height
      );
      downloadBlob(blob, 'stop-motion-spritesheet.png');
      showTempStatus('Exported sprite sheet PNG.');
    } catch (err) {
      showTempStatus(err instanceof Error ? err.message : 'Sprite sheet export failed.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleAttachToChat = async () => {
    if (frames.length === 0 || isExporting) return;
    setExportMenuOpen(false);
    setIsExporting('chat');
    try {
      if (frames.length >= 2) {
        const blob = await exportAnimatedGif(
          frames,
          fps,
          pingPong,
          dimensions.width,
          dimensions.height
        );
        const base64 = await blobToBase64(blob);
        onAttachToChat({
          id: crypto.randomUUID(),
          name: `stop-motion-${frames.length}f-${fps}fps.gif`,
          mimeType: 'image/gif',
          size: blob.size,
          isText: false,
          data: base64,
          previewUrl: `data:image/gif;base64,${base64}`,
        });
        showTempStatus('Animated GIF attached to composer.');
      } else {
        const dataUrl = frames[0].dataUrl;
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        onAttachToChat({
          id: crypto.randomUUID(),
          name: 'stop-motion-frame-01.png',
          mimeType: 'image/png',
          size: Math.round((base64.length * 3) / 4),
          isText: false,
          data: base64,
          previewUrl: dataUrl,
        });
        showTempStatus('Frame attached to composer.');
      }
    } catch (err) {
      showTempStatus(err instanceof Error ? err.message : 'Could not attach to composer.');
    } finally {
      setIsExporting(null);
    }
  };

  // Onion-skin references
  const editingIndex = editingFrameId
    ? frames.findIndex((f) => f.id === editingFrameId)
    : -1;
  const onionPrevFrame =
    editingIndex >= 0
      ? frames[editingIndex - 1] || null
      : frames[frames.length - 1] || null;
  const onionTwoBackFrame =
    editingIndex >= 0
      ? frames[editingIndex - 2] || null
      : frames[frames.length - 2] || null;
  const onionNextFrame =
    editingIndex >= 0 ? frames[editingIndex + 1] || null : null;

  const stageAspectClass =
    aspect === '16:9'
      ? 'aspect-video'
      : aspect === '4:3'
      ? 'aspect-[4/3]'
      : 'aspect-square max-h-[380px]';

  const activeBrushMeta =
    VECTOR_BRUSH_META.find((b) => b.id === activeBrushStyle) || VECTOR_BRUSH_META[0];

  const previewFrame = isPlaying
    ? frames[playIndex]
    : frames[selectedIndex] || frames[0];

  return (
    <aside
      aria-label="Stop motion animation studio"
      className="fixed inset-0 z-40 lg:static lg:z-auto w-full lg:w-[54%] lg:max-w-[840px] lg:min-w-[460px] h-full flex flex-col border-l border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl lg:shadow-none"
    >
      {/* Top Studio Header with Mode Tabs & Two Dedicated Menus */}
      <div className="h-14 shrink-0 px-3 sm:px-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between gap-2 bg-[#f9f9f9] dark:bg-[#171717]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            role="tablist"
            aria-label="Studio workspace mode"
            className="flex items-center p-0.5 rounded-xl bg-neutral-200/80 dark:bg-[#262626] border border-neutral-200 dark:border-white/10"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === 'draw'}
              onClick={() => {
                setIsPlaying(false);
                setSourceMode('draw');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                sourceMode === 'draw'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Brush className="w-3.5 h-3.5" />
              <span>Draw</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === 'camera'}
              onClick={() => {
                setIsPlaying(false);
                setSourceMode('camera');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                sourceMode === 'camera'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === 'vector'}
              onClick={() => {
                setIsPlaying(false);
                setSourceMode('vector');
                setVectorCodeDraft(
                  serializeFramesToStopMotionCode(
                    frames,
                    fps,
                    dimensions.width,
                    dimensions.height,
                    paperColor,
                    pingPong,
                    projectTitle
                  )
                );
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                sourceMode === 'vector'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Vector</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === 'import'}
              onClick={() => {
                setIsPlaying(false);
                setSourceMode('import');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                sourceMode === 'import'
                  ? 'bg-white dark:bg-[#383838] text-[#0d0d0d] dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
              }`}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
          </div>

          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as AspectRatioPreset)}
            aria-label="Aspect ratio"
            className="hidden sm:block h-8 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] focus:outline-none focus:ring-2 focus:ring-neutral-400"
          >
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1</option>
          </select>
        </div>

        {/* Two Studio Menus + Close */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Menu 1: 10 Vector Demos */}
          <div ref={demosMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen(false);
                setDemosMenuOpen((v) => !v);
              }}
              aria-haspopup="menu"
              aria-expanded={demosMenuOpen}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                demosMenuOpen
                  ? 'border-[#0d0d0d] dark:border-white bg-neutral-200/70 dark:bg-white/10 text-[#0d0d0d] dark:text-white'
                  : 'border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] text-[#0d0d0d] dark:text-[#ececec] hover:bg-neutral-100 dark:hover:bg-[#303030]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Demos ({STOP_MOTION_DEMOS.length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>

            {demosMenuOpen && (
              <div
                role="menu"
                aria-label="Vector stop-motion demos"
                className="absolute right-0 top-full mt-1.5 w-80 max-w-[calc(100vw-2rem)] z-50 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#242424] shadow-2xl p-1.5 max-h-[70vh] overflow-y-auto chat-scroll"
              >
                <div className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  Vector Stop-Motion Demos
                </div>
                {STOP_MOTION_DEMOS.map((demo) => {
                  const isActive = activeDemoId === demo.id;
                  return (
                    <button
                      key={demo.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectDemo(demo)}
                      className={`w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                        isActive
                          ? 'bg-neutral-100 dark:bg-white/10'
                          : 'hover:bg-neutral-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#0d0d0d] dark:text-white truncate">
                          {demo.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {demo.category} · {demo.fps} fps · {demo.description}
                        </div>
                      </div>
                      {isActive && (
                        <Check className="w-3.5 h-3.5 mt-0.5 text-[#0d0d0d] dark:text-white shrink-0" />
                      )}
                    </button>
                  );
                })}
                <div className="my-1 border-t border-neutral-200 dark:border-white/10" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDemosMenuOpen(false);
                    setIsPlaying(false);
                    setFrames([]);
                    setActiveDemoId('');
                    setProjectTitle('Untitled Stop Motion');
                    setSelectedIndex(0);
                    setEditingFrameId(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Clear Timeline</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu 2: Render & Export */}
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setDemosMenuOpen(false);
                setExportMenuOpen((v) => !v);
              }}
              disabled={Boolean(isExporting)}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Render & Export'}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-75" />
            </button>

            {exportMenuOpen && (
              <div
                role="menu"
                aria-label="Render and export options"
                className="absolute right-0 top-full mt-1.5 w-60 z-50 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#242424] shadow-2xl p-1.5 text-[#0d0d0d] dark:text-[#ececec]"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={handlePostRenderToChat}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Post Live Render to Chat</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={() => void handleAttachToChat()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Attach GIF to Composer</span>
                </button>

                <div className="my-1 border-t border-neutral-200 dark:border-white/10" />

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={() => void handleExportGif()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Download Animated GIF</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={() => void handleExportWebm()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Film className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Download WebM Video</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={() => void handleServerBake('webm')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Server className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>FFmpeg Bake WebM (60fps + Audio)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={() => void handleServerBake('mp4')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Server className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>FFmpeg Bake MP4 (H.264)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={() => void handleExportSpriteSheet()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Grid3X3 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Download Sprite Sheet PNG</span>
                </button>

                <div className="my-1 border-t border-neutral-200 dark:border-white/10" />

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={handleExportXml}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Code2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Export Stop Motion XML</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={handleExportJson}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Export Stop Motion JSON</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={frames.length === 0}
                  onClick={() => void handleCopyVectorCode()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Copy Vector JSON Code</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close stop motion studio"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Stage & Controls */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto chat-scroll">
        {/* Stage Viewport */}
        <div className="p-3 sm:p-4 bg-neutral-100/80 dark:bg-[#121212] border-b border-neutral-200 dark:border-white/10 flex flex-col items-center gap-3">
          <div
            className={`relative w-full max-w-[680px] ${stageAspectClass} mx-auto rounded-xl overflow-hidden border border-neutral-300 dark:border-white/15 bg-neutral-900 shadow-sm flex items-center justify-center`}
          >
            {isPlaying && previewFrame ? (
              <>
                <img
                  src={previewFrame.dataUrl}
                  alt={`Frame ${playIndex + 1}`}
                  className="w-full h-full object-contain bg-neutral-950"
                />
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 text-white font-mono text-[11px] tabular-nums">
                  {String(playIndex + 1).padStart(2, '0')} /{' '}
                  {String(frames.length).padStart(2, '0')}
                </div>
              </>
            ) : sourceMode === 'draw' ? (
              <div
                className="relative w-full h-full select-none"
                style={{ backgroundColor: paperColor }}
              >
                {/* Onion skin previous/next frames */}
                {onionEnabled && onionTwoBackFrame && (
                  <img
                    src={onionTwoBackFrame.dataUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{
                      opacity: onionOpacity * 0.4,
                      filter: 'sepia(0.5) hue-rotate(175deg)',
                    }}
                  />
                )}
                {onionEnabled && onionPrevFrame && (
                  <img
                    src={onionPrevFrame.dataUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{
                      opacity: onionOpacity,
                    }}
                  />
                )}
                {onionEnabled && onionNextFrame && (
                  <img
                    src={onionNextFrame.dataUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{
                      opacity: onionOpacity * 0.45,
                      filter: 'sepia(0.4) hue-rotate(80deg)',
                    }}
                  />
                )}

                {/* Optional 3x3 alignment grid */}
                {showGrid && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3"
                  >
                    {Array.from({ length: 9 }).map((_, idx) => (
                      <div key={idx} className="border border-neutral-400/25" />
                    ))}
                  </div>
                )}

                <canvas
                  ref={drawCanvasRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="relative z-10 w-full h-full touch-none cursor-crosshair block"
                />
              </div>
            ) : sourceMode === 'camera' ? (
              <div className="relative w-full h-full bg-neutral-950 flex items-center justify-center">
                {cameraError ? (
                  <div className="p-6 text-center max-w-sm space-y-3">
                    <p className="text-xs text-red-300">{cameraError}</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSourceMode('draw')}
                        className="px-3 py-1.5 rounded-lg bg-white text-[#0d0d0d] text-xs font-medium whitespace-nowrap shrink-0"
                      >
                        Switch to Draw
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('import')}
                        className="px-3 py-1.5 rounded-lg border border-white/20 text-white text-xs font-medium whitespace-nowrap shrink-0"
                      >
                        Import Photos
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {onionEnabled && frames[frames.length - 1] && (
                      <img
                        src={frames[frames.length - 1].dataUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        style={{ opacity: onionOpacity }}
                      />
                    )}
                    {showGrid && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3"
                      >
                        {Array.from({ length: 9 }).map((_, idx) => (
                          <div key={idx} className="border border-white/20" />
                        ))}
                      </div>
                    )}
                    {countdown !== null && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 text-white font-mono text-xs tabular-nums">
                        Capturing in {countdown}s
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : sourceMode === 'vector' ? (
              /* Vector Code Live Stage Preview */
              <div className="relative w-full h-full bg-neutral-950 flex items-center justify-center">
                {previewFrame ? (
                  <>
                    <img
                      src={previewFrame.dataUrl}
                      alt={`Frame ${selectedIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 text-white font-mono text-[11px] tabular-nums">
                      {String(selectedIndex + 1).padStart(2, '0')} /{' '}
                      {String(frames.length).padStart(2, '0')}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-neutral-400">
                    Paste or write stop-motion vector JSON / SVG frames below and click Compile.
                  </div>
                )}
              </div>
            ) : (
              /* Import Photos */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleImportFiles(e.dataTransfer.files);
                }}
                className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center p-6 text-center text-neutral-200 gap-3"
              >
                <input
                  ref={importInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    void handleImportFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <Upload className="w-7 h-7 text-neutral-400" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">
                    Drop photos or frame sequence here
                  </div>
                  <p className="text-xs text-neutral-400">
                    PNG, JPEG, WebP frames are sorted numerically and fitted to {aspect}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-[#0d0d0d] text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Choose Images</span>
                </button>
              </div>
            )}

            {/* Shutter Flash Feedback */}
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 ${
                shutterFlash ? 'opacity-50' : 'opacity-0'
              }`}
            />
          </div>

          {/* Draw Mode: Vector Brushes & Shape Tools Strip */}
          {!isPlaying && sourceMode === 'draw' && (
            <div className="w-full max-w-[680px] space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Vector Brush Preset Selector */}
                  <select
                    value={activeBrushStyle}
                    onChange={(e) => {
                      const nextStyle = e.target.value as VectorBrushStyle;
                      setActiveBrushStyle(nextStyle);
                      setDrawTool(nextStyle);
                    }}
                    title={activeBrushMeta.description}
                    aria-label="Vector brush style"
                    className="h-8 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2 text-xs font-medium text-[#0d0d0d] dark:text-[#ececec] focus:outline-none focus:ring-2 focus:ring-neutral-400"
                  >
                    {VECTOR_BRUSH_META.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>

                  {/* Vector Tool Buttons */}
                  <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#262626] p-0.5">
                    <button
                      type="button"
                      onClick={() => setDrawTool(activeBrushStyle)}
                      title={`Active brush: ${activeBrushMeta.label}`}
                      aria-label={`Vector brush ${activeBrushMeta.label}`}
                      aria-pressed={isVectorBrushStyle(drawTool)}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                        isVectorBrushStyle(drawTool)
                          ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
                      }`}
                    >
                      <Brush className="w-3.5 h-3.5" />
                    </button>
                    {(
                      [
                        { id: 'eraser', icon: Eraser, label: 'Vector Eraser' },
                        { id: 'line', icon: Minus, label: 'Vector Line' },
                        { id: 'circle', icon: Circle, label: 'Vector Ellipse' },
                        { id: 'rect', icon: Square, label: 'Vector Rect' },
                      ] as const
                    ).map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDrawTool(id)}
                        title={label}
                        aria-label={label}
                        aria-pressed={drawTool === id}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                          drawTool === id
                            ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>

                  {/* Ink Colors */}
                  <div className="flex items-center gap-1 px-1">
                    {BRUSH_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setBrushColor(color);
                          if (drawTool === 'eraser') setDrawTool(activeBrushStyle);
                        }}
                        aria-label={`Ink color ${color}`}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          brushColor === color && drawTool !== 'eraser'
                            ? 'scale-110 ring-2 ring-neutral-500 dark:ring-white border-white'
                            : 'border-neutral-300 dark:border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {/* Stroke Widths */}
                  <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#262626] p-0.5">
                    {BRUSH_SIZES.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setBrushSize(sz)}
                        aria-label={`Stroke size ${sz}px`}
                        className={`px-1.5 py-1 rounded-md font-mono text-[11px] tabular-nums transition-colors ${
                          brushSize === sz
                            ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>

                  {/* Paper Backdrop Colors */}
                  <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-neutral-300 dark:border-white/10">
                    {PAPER_COLORS.map((p) => (
                      <button
                        key={p.color}
                        type="button"
                        onClick={() => setPaperColor(p.color)}
                        title={`Paper: ${p.label}`}
                        aria-label={`Paper ${p.label}`}
                        className={`w-5 h-5 rounded-md border ${
                          paperColor === p.color
                            ? 'ring-2 ring-neutral-500 dark:ring-white border-white'
                            : 'border-neutral-300 dark:border-white/20'
                        }`}
                        style={{ backgroundColor: p.color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    title="Undo last vector stroke"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#303030] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>

                  {frames.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void loadFrameIntoDrawCanvas(frames[frames.length - 1], false)
                      }
                      title="Copy previous frame onto vector canvas"
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#303030] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy Prev</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={clearDrawCanvas}
                    title="Clear active canvas"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#303030] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  {editingFrameId && (
                    <button
                      type="button"
                      onClick={() => setEditingFrameId(null)}
                      className="h-8 px-2.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 whitespace-nowrap shrink-0"
                    >
                      Cancel Edit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCaptureDrawFrame}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingFrameId ? 'Update Frame' : 'Capture Frame'}</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between tabular-nums">
                <span>
                  {activeBrushMeta.label} · {activeBrushMeta.description}
                </span>
                <span>{vectorStrokeCount} active vector paths</span>
              </div>
            </div>
          )}

          {/* Vector Code Workspace Editor */}
          {sourceMode === 'vector' && (
            <div className="w-full max-w-[680px] rounded-xl border border-neutral-200 dark:border-white/15 bg-[#0d0d0d] text-[#ececec] overflow-hidden">
              <div className="px-3 py-2 border-b border-white/10 bg-[#171717] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono text-neutral-300">
                  Vector Stop-Motion Code (JSON or SVG frames)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSyncVectorCodeFromTimeline}
                    className="px-2.5 py-1 rounded-lg border border-white/15 text-neutral-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                  >
                    Pull Timeline
                  </button>
                  <button
                    type="button"
                    onClick={handlePostRenderToChat}
                    disabled={frames.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 text-neutral-200 hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3 h-3" />
                    <span>Render in Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCompileVectorCode}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-[#0d0d0d] font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Compile</span>
                  </button>
                </div>
              </div>

              {vectorCodeError && (
                <div className="px-3 py-2 bg-red-950/60 border-b border-red-900/60 text-xs font-mono text-red-300">
                  {vectorCodeError}
                </div>
              )}

              <textarea
                value={vectorCodeDraft}
                onChange={(e) => setVectorCodeDraft(e.target.value)}
                rows={7}
                spellCheck={false}
                aria-label="Vector stop-motion code editor"
                className="w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed text-[#ececec] focus:outline-none chat-scroll"
              />
            </div>
          )}

          {/* Camera Tool Strip */}
          {!isPlaying && sourceMode === 'camera' && !cameraError && (
            <div className="w-full max-w-[680px] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                  }
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-[#303030] whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Flip Camera</span>
                </button>

                <label className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                  <span>Timer:</span>
                  <select
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    className="h-8 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2 text-xs text-[#0d0d0d] dark:text-[#ececec]"
                  >
                    <option value={0}>Manual</option>
                    <option value={2}>Every 2s</option>
                    <option value={4}>Every 4s</option>
                    <option value={6}>Every 6s</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCaptureCameraFrame}
                disabled={!cameraReady}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Capture Frame</span>
              </button>
            </div>
          )}
        </div>

        {/* Transport, FPS Presets/Slider & Onion Skin Controls */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#171717] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setSelectedIndex(0);
              }}
              disabled={frames.length === 0}
              aria-label="Jump to first frame"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setSelectedIndex((i) => Math.max(0, i - 1));
              }}
              disabled={frames.length === 0 || selectedIndex === 0}
              aria-label="Previous frame"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              disabled={frames.length === 0}
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setSelectedIndex((i) => Math.min(frames.length - 1, i + 1));
              }}
              disabled={frames.length === 0 || selectedIndex >= frames.length - 1}
              aria-label="Next frame"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setSelectedIndex(Math.max(0, frames.length - 1));
              }}
              disabled={frames.length === 0}
              aria-label="Jump to last frame"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 disabled:opacity-40"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setLoopPlayback((v) => !v)}
              aria-pressed={loopPlayback}
              title="Loop playback"
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                loopPlayback
                  ? 'bg-neutral-200 dark:bg-[#333333] text-[#0d0d0d] dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setPingPong((v) => !v)}
              aria-pressed={pingPong}
              title="Ping-pong (Boomerang) playback"
              className={`inline-flex items-center gap-1 h-8 px-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                pingPong
                  ? 'bg-neutral-200 dark:bg-[#333333] text-[#0d0d0d] dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bounce</span>
            </button>
          </div>

          {/* FPS Slider, Presets & Onion Skin */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5">
              <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#262626] p-0.5">
                {FPS_PRESETS.map((presetFps) => (
                  <button
                    key={presetFps}
                    type="button"
                    onClick={() => handleFpsChange(presetFps)}
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] tabular-nums transition-colors ${
                      fps === presetFps
                        ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {presetFps}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <input
                  type="range"
                  min={2}
                  max={60}
                  step={1}
                  value={fps}
                  onChange={(e) => handleFpsChange(Number(e.target.value))}
                  aria-label="Frames per second"
                  className="w-16 accent-[#0d0d0d] dark:accent-white"
                />
                <span className="font-mono tabular-nums whitespace-nowrap w-11 text-right">
                  {fps} fps
                </span>
              </label>
              <button
                type="button"
                onClick={() => setConserveDuration((v) => !v)}
                aria-pressed={conserveDuration}
                title="Lock animation duration in seconds when changing FPS"
                className={`h-7 px-2 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  conserveDuration
                    ? 'bg-neutral-200 dark:bg-[#333333] text-[#0d0d0d] dark:text-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10'
                }`}
              >
                {conserveDuration ? 'Duration Locked' : 'Variable Speed'}
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOnionEnabled((v) => !v)}
                aria-pressed={onionEnabled}
                title="Toggle onion skin ghosting"
                className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  onionEnabled
                    ? 'bg-neutral-200 dark:bg-[#333333] text-[#0d0d0d] dark:text-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Onion</span>
              </button>
              {onionEnabled && (
                <input
                  type="range"
                  min={0.1}
                  max={0.75}
                  step={0.05}
                  value={onionOpacity}
                  onChange={(e) => setOnionOpacity(Number(e.target.value))}
                  aria-label="Onion skin opacity"
                  className="w-14 accent-[#0d0d0d] dark:accent-white"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              aria-pressed={showGrid}
              title="Toggle 3x3 alignment grid"
              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                showGrid
                  ? 'bg-neutral-200 dark:bg-[#333333] text-[#0d0d0d] dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setProductionOpen((v) => !v)}
              aria-expanded={productionOpen}
              className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                productionOpen
                  ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                  : 'border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Production &amp; Audio</span>
            </button>
          </div>
        </div>

        {/* Collapsible Stop Motion v3 Production Drawer: Audio Math Synth + FFmpeg Bake + CI/CD Stitcher */}
        {productionOpen && (
          <div className="px-3 sm:px-4 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#141414] space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Pure-Math Audio Waveform Synth */}
              <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium text-[#0d0d0d] dark:text-white">
                    <Music className="w-3.5 h-3.5" />
                    <span>Pure-Math Audio Track</span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={audioEnabled}
                      onChange={(e) => setAudioEnabled(e.target.checked)}
                      className="accent-[#0d0d0d] dark:accent-white"
                    />
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-300">Mux to Export</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={audioPreset}
                    onChange={(e) => {
                      const next = e.target.value as NonNullable<MathAudioTrackSpec['preset']>;
                      setAudioPreset(next);
                      setAudioFormula(MATH_AUDIO_PRESETS[next].formula);
                      setAudioEnabled(true);
                    }}
                    aria-label="Audio math waveform preset"
                    className="h-7 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2 text-[11px]"
                  >
                    {Object.entries(MATH_AUDIO_PRESETS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handlePreviewMathAudio}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 text-[11px] whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Test Wave</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadWav}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 text-[11px] whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    <span>WAV</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={audioFormula}
                  onChange={(e) => {
                    setAudioFormula(e.target.value);
                    setAudioEnabled(true);
                  }}
                  spellCheck={false}
                  aria-label="Audio math formula"
                  placeholder="sin(TAU * 440 * t) * tanh(cos(PI * t))"
                  className="w-full h-8 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#111] px-2.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-neutral-400"
                />
              </div>

              {/* FFmpeg Server Baker & Long-Form CI/CD Clip Stitcher */}
              <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium text-[#0d0d0d] dark:text-white">
                    <Server className="w-3.5 h-3.5" />
                    <span>FFmpeg Bake &amp; 60m Stitcher</span>
                  </div>
                  {sourceSceneRef.current && (
                    <span className="font-mono text-[11px] text-neutral-500">
                      CoT Fidelity {evaluateStopMotionFidelity(sourceSceneRef.current).score}/100
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={frames.length === 0 || Boolean(isExporting)}
                    onClick={() => void handleServerBake('webm', false)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <Server className="w-3 h-3" />
                    <span>Bake WebM</span>
                  </button>
                  <button
                    type="button"
                    disabled={frames.length === 0 || Boolean(isExporting)}
                    onClick={() => void handleServerBake('mp4', false)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 text-[11px] disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <Film className="w-3 h-3" />
                    <span>Bake MP4</span>
                  </button>
                  <button
                    type="button"
                    disabled={frames.length === 0 || Boolean(isExporting)}
                    onClick={() => void handleServerBake('webm', true)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 text-[11px] disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Queue Clip ({stitchQueue.length})</span>
                  </button>
                  {stitchQueue.length > 0 && (
                    <button
                      type="button"
                      disabled={Boolean(isExporting)}
                      onClick={() => void handleStitchQueue()}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-medium disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      <Film className="w-3 h-3" />
                      <span>Stitch Queue</span>
                    </button>
                  )}
                </div>

                {bakeProgressText && (
                  <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                    {bakeProgressText}
                  </div>
                )}

                {stitchQueue.length > 0 && (
                  <div className="space-y-1 max-h-20 overflow-y-auto chat-scroll">
                    {stitchQueue.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-[11px] bg-neutral-50 dark:bg-[#141414] px-2 py-1 rounded">
                        <span className="truncate">{item.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="inline-flex items-center gap-1 font-mono">
                            <span>×</span>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={item.repeatCount}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(200, Number(e.target.value) || 1));
                                setStitchQueue((q) =>
                                  q.map((x) => (x.id === item.id ? { ...x, repeatCount: val } : x))
                                );
                              }}
                              className="w-12 rounded border border-neutral-200 dark:border-white/10 bg-transparent px-1 text-center"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setStitchQueue((q) => q.filter((x) => x.id !== item.id))}
                            aria-label="Remove queued clip"
                            className="text-red-500 hover:opacity-80"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Clean Unboxed Timeline Metadata & Status */}
        <div className="px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 tabular-nums">
            <span className="font-medium text-[#0d0d0d] dark:text-white truncate max-w-[180px]">
              {projectTitle}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {(totalLogicalFramesOverride ?? frames.length).toLocaleString()}{' '}
              {(totalLogicalFramesOverride ?? frames.length) === 1 ? 'frame' : 'frames'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{totalSeconds}s runtime</span>
            {statusMessage && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#0d0d0d] dark:text-white font-medium">
                  {statusMessage}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handlePostRenderToChat}
            disabled={frames.length === 0}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3 h-3" />
            <span>Render in Chat</span>
          </button>
        </div>

        {/* Filmstrip Timeline */}
        <div className="p-3 sm:p-4 space-y-3">
          {frames.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 dark:border-white/15 py-10 px-4 text-center space-y-3">
              <p className="text-sm font-medium text-[#0d0d0d] dark:text-white">
                No frames in your sequence yet
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                Sketch with Vector Brushes, write Vector JSON/SVG code, snap shots with your Camera, or pick one of the 10 curated demos.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectDemo(STOP_MOTION_DEMOS[0])}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Starter Demo</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 chat-scroll">
                {frames.map((frame, idx) => {
                  const isCurrent = isPlaying
                    ? idx === playIndex
                    : idx === selectedIndex;
                  const isEditingThis = frame.id === editingFrameId;

                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setSelectedIndex(idx);
                      }}
                      className={`group relative shrink-0 w-28 rounded-xl overflow-hidden border text-left transition-all ${
                        isCurrent
                          ? 'border-[#0d0d0d] dark:border-white ring-2 ring-[#0d0d0d]/25 dark:ring-white/30'
                          : 'border-neutral-200 dark:border-white/10 hover:border-neutral-400 dark:hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-video w-full bg-neutral-900 overflow-hidden">
                        <img
                          src={frame.dataUrl}
                          alt={`Frame ${idx + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="px-2 py-1 bg-[#f9f9f9] dark:bg-[#222222] flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                        <span>
                          {String(idx + 1).padStart(2, '0')}
                          {isEditingThis ? ' · edit' : ''}
                        </span>
                        {frame.hold > 1 && (
                          <span className="text-[#0d0d0d] dark:text-white font-semibold">
                            ×{frame.hold}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Frame Actions Strip */}
              {selectedFrame && (
                <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#171717] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                      Frame {String(selectedIndex + 1).padStart(2, '0')}
                    </span>
                    <span className="text-neutral-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">Hold:</span>
                    <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#262626] p-0.5">
                      {[1, 2, 3, 4].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleSetHold(selectedIndex, h)}
                          className={`px-2 py-0.5 rounded-md font-mono text-[11px] tabular-nums transition-colors ${
                            selectedFrame.hold === h
                              ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                              : 'text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          ×{h}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveFrame(selectedIndex, -1)}
                      disabled={selectedIndex === 0}
                      title="Move frame left"
                      aria-label="Move frame left"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 disabled:opacity-35"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveFrame(selectedIndex, 1)}
                      disabled={selectedIndex >= frames.length - 1}
                      title="Move frame right"
                      aria-label="Move frame right"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 disabled:opacity-35"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateFrame(selectedIndex)}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 whitespace-nowrap shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadFrameIntoDrawCanvas(selectedFrame, true)}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 whitespace-nowrap shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Frame</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFrame(selectedIndex)}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
