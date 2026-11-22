import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Eraser,
  Eye,
  Film,
  Grid3X3,
  Minus,
  Move,
  PaintBucket,
  Paintbrush,
  Palette,
  Pause,
  Pencil,
  Pipette,
  Play,
  Plus,
  Redo2,
  Repeat,
  RotateCcw,
  RotateCw,
  Send,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  PalettePreset,
  PixelArtDemo,
  PixelArtFrame,
  PixelArtSpec,
  PixelArtTool,
  PixelShaderSpec,
  PixelShaderType,
  SymmetryMode,
} from '../types/pixelArt';
import { ChatAttachment } from '../types/chat';
import {
  darkenColor,
  getContrastingTextColor,
  lightenColor,
  PALETTE_PRESETS,
} from '../utils/pixelArtPalettes';
import { PIXEL_ART_DEMOS } from '../utils/pixelArtDemos';
import {
  applyPixelShaders,
  exportPixelArtGif,
  pixelArtToPngBlob,
  pixelArtToSvg,
  renderPixelArtToCanvas,
  serializePixelArtSpec,
} from '../utils/pixelArtParser';

interface PixelArtStudioProps {
  externalSpec?: PixelArtSpec | null;
  onConsumeExternalSpec?: () => void;
  onPostToChat: (markdownText: string) => void;
  onAttachToChat: (attachment: ChatAttachment) => void;
  onClose: () => void;
}

const CANVAS_SIZE_PRESETS = [
  { w: 16, h: 16, label: '16×16 (Mini)' },
  { w: 24, h: 24, label: '24×24 (Medium)' },
  { w: 32, h: 32, label: '32×32 (Classic 16-bit)' },
  { w: 48, h: 48, label: '48×48 (Detailed)' },
  { w: 64, h: 64, label: '64×64 (Complex Scene)' },
  { w: 128, h: 128, label: '128×128 (HD Sprite)' },
  { w: 256, h: 256, label: '256×256 (Mega Canvas)' },
  { w: 512, h: 512, label: '512×512 (Ultra 512)' },
];

const SHADER_PRESETS: Array<{ id: PixelShaderType; label: string }> = [
  { id: 'vignette', label: 'Vignette' },
  { id: 'scanline', label: 'Scanlines' },
  { id: 'crt', label: 'CRT' },
  { id: 'chromatic', label: 'Chromatic' },
  { id: 'glow', label: 'Glow' },
  { id: 'posterize', label: 'Posterize' },
];

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

export const PixelArtStudio: React.FC<PixelArtStudioProps> = ({
  externalSpec,
  onConsumeExternalSpec,
  onPostToChat,
  onAttachToChat,
  onClose,
}) => {
  const [projectTitle, setProjectTitle] = useState(PIXEL_ART_DEMOS[0].title);
  const [activeDemoId, setActiveDemoId] = useState<string>(PIXEL_ART_DEMOS[0].id);

  const [width, setWidth] = useState<number>(PIXEL_ART_DEMOS[0].width);
  const [height, setHeight] = useState<number>(PIXEL_ART_DEMOS[0].height);

  const [frames, setFrames] = useState<PixelArtFrame[]>(() =>
    PIXEL_ART_DEMOS[0].buildFrames()
  );
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);

  // Playback & FPS
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playIndex, setPlayIndex] = useState<number>(0);
  const [fps, setFps] = useState<number>(PIXEL_ART_DEMOS[0].fps || 8);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(true);

  // Tools & Brushes
  const [activeTool, setActiveTool] = useState<PixelArtTool>('pencil');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [symmetry, setSymmetry] = useState<SymmetryMode>('none');
  const [shadeMode, setShadeMode] = useState<'lighten' | 'darken'>('lighten');

  // Palette & Color Picker
  const [activePaletteIndex, setActivePaletteIndex] = useState<number>(0);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [primaryColor, setPrimaryColor] = useState<string>('#ec4899');
  const [secondaryColor, setSecondaryColor] = useState<string>('#06b6d4');
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Canvas Viewport Options & v3 Shaders
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(12);
  const [activeShaders, setActiveShaders] = useState<PixelShaderSpec[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Two Studio Menus
  const [demosMenuOpen, setDemosMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Undo / Redo history stack (stores array of frames)
  const undoStackRef = useRef<PixelArtFrame[][]>([]);
  const redoStackRef = useRef<PixelArtFrame[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Drawing refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDownRef = useRef(false);
  const lineStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragSnapshotPixelsRef = useRef<string[] | null>(null);
  const demosMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const showTempStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(null), 2800);
    return () => clearTimeout(t);
  }, [statusMessage]);

  // Outside click & ESC listeners for dropdown menus
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

  // Handoff from chat (Open in Pixel Studio)
  useEffect(() => {
    if (!externalSpec) return;
    setIsPlaying(false);
    setWidth(externalSpec.width);
    setHeight(externalSpec.height);
    setFrames(externalSpec.frames);
    setFps(externalSpec.fps || 8);
    setProjectTitle(externalSpec.title || 'AI Pixel Art');
    setActiveShaders(externalSpec.shaders || []);
    setActiveDemoId('');
    setSelectedFrameIndex(0);
    setShowGrid(externalSpec.width < 128);
    setZoomLevel(
      externalSpec.width >= 256
        ? 1
        : externalSpec.width >= 128
        ? 2
        : externalSpec.width >= 64
        ? 5
        : 12
    );
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    if (externalSpec.palette && externalSpec.palette.length > 0) {
      setCustomColors(externalSpec.palette);
      setPrimaryColor(externalSpec.palette[0] || '#ffffff');
      if (externalSpec.palette[1]) setSecondaryColor(externalSpec.palette[1]);
    }
    showTempStatus('Loaded pixel art into Studio.');
    onConsumeExternalSpec?.();
  }, [externalSpec, onConsumeExternalSpec, showTempStatus]);

  // Keep selected frame index in bounds
  useEffect(() => {
    if (frames.length === 0) {
      setSelectedFrameIndex(0);
      setIsPlaying(false);
    } else if (selectedFrameIndex >= frames.length) {
      setSelectedFrameIndex(frames.length - 1);
    }
  }, [frames.length, selectedFrameIndex]);

  // Animation playback scheduler
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    let timerId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const current = frames[playIndex] || frames[0];
      const delay = Math.max(
        35,
        Math.round((1000 / Math.max(1, fps)) * Math.max(1, current?.hold || 1))
      );

      timerId = window.setTimeout(() => {
        if (cancelled) return;
        setPlayIndex((prev) => (prev + 1) % frames.length);
        tick();
      }, delay);
    };

    tick();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [isPlaying, frames, fps, playIndex]);

  // Render main canvas & 1:1 true scale preview canvas
  const currentFrame = isPlaying
    ? frames[playIndex] || frames[0]
    : frames[selectedFrameIndex] || frames[0];

  const redrawCanvas = useCallback(() => {
    if (!currentFrame || !canvasRef.current) return;
    const displayFrame: PixelArtFrame =
      activeShaders.length > 0
        ? {
            ...currentFrame,
            pixels: applyPixelShaders(currentFrame.pixels, width, height, activeShaders),
          }
        : currentFrame;
    const dest = canvasRef.current;
    const rendered = renderPixelArtToCanvas(
      displayFrame,
      width,
      height,
      zoomLevel,
      showGrid
    );
    dest.width = rendered.width;
    dest.height = rendered.height;
    const ctx = dest.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, dest.width, dest.height);
      ctx.drawImage(rendered, 0, 0);
    }

    if (previewCanvasRef.current) {
      const pDest = previewCanvasRef.current;
      const miniScale = width >= 256 ? 0.25 : width >= 128 ? 0.5 : 2;
      const pRendered = renderPixelArtToCanvas(displayFrame, width, height, miniScale, false);
      pDest.width = pRendered.width;
      pDest.height = pRendered.height;
      const pCtx = pDest.getContext('2d');
      if (pCtx) {
        pCtx.imageSmoothingEnabled = false;
        pCtx.clearRect(0, 0, pDest.width, pDest.height);
        pCtx.drawImage(pRendered, 0, 0);
      }
    }
  }, [currentFrame, width, height, zoomLevel, showGrid, activeShaders]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Save history state
  const pushUndoSnapshot = useCallback(() => {
    const snapshot = frames.map((f) => ({ ...f, pixels: [...f.pixels] }));
    undoStackRef.current = [...undoStackRef.current.slice(-49), snapshot];
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [frames]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const currentSnapshot = frames.map((f) => ({ ...f, pixels: [...f.pixels] }));
    redoStackRef.current = [...redoStackRef.current.slice(-49), currentSnapshot];
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setFrames(prev);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [frames]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const currentSnapshot = frames.map((f) => ({ ...f, pixels: [...f.pixels] }));
    undoStackRef.current = [...undoStackRef.current.slice(-49), currentSnapshot];
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    setFrames(next);
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, [frames]);

  // Symmetry coordinate generator
  const getSymmetricPoints = useCallback(
    (x: number, y: number): Array<{ x: number; y: number }> => {
      const pts = [{ x, y }];
      if (symmetry === 'horizontal' || symmetry === 'quad') {
        pts.push({ x: width - 1 - x, y });
      }
      if (symmetry === 'vertical' || symmetry === 'quad') {
        pts.push({ x, y: height - 1 - y });
      }
      if (symmetry === 'quad') {
        pts.push({ x: width - 1 - x, y: height - 1 - y });
      }
      return pts;
    },
    [symmetry, width, height]
  );

  // Mutate current frame pixels
  const applyPixels = useCallback(
    (coords: Array<{ x: number; y: number; color: string }>) => {
      setFrames((prev) =>
        prev.map((frame, idx) => {
          if (idx !== selectedFrameIndex) return frame;
          const nextPixels = [...frame.pixels];
          for (const { x, y, color } of coords) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
              nextPixels[y * width + x] = color;
            }
          }
          return { ...frame, pixels: nextPixels };
        })
      );
    },
    [selectedFrameIndex, width, height]
  );

  // Bresenham line algorithm
  const getBresenhamLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): Array<{ x: number; y: number }> => {
    const points: Array<{ x: number; y: number }> = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let currX = x0;
    let currY = y0;

    while (true) {
      points.push({ x: currX, y: currY });
      if (currX === x1 && currY === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currY += sy;
      }
    }
    return points;
  };

  // Midpoint circle algorithm
  const getMidpointCircle = (
    cx: number,
    cy: number,
    r: number
  ): Array<{ x: number; y: number }> => {
    const points: Array<{ x: number; y: number }> = [];
    let x = r;
    let y = 0;
    let err = 0;

    while (x >= y) {
      points.push(
        { x: cx + x, y: cy + y },
        { x: cx + y, y: cy + x },
        { x: cx - y, y: cy + x },
        { x: cx - x, y: cy + y },
        { x: cx - x, y: cy - y },
        { x: cx - y, y: cy - x },
        { x: cx + y, y: cy - x },
        { x: cx + x, y: cy - y }
      );
      if (err <= 0) {
        y += 1;
        err += 2 * y + 1;
      }
      if (err > 0) {
        x -= 1;
        err -= 2 * x + 1;
      }
    }
    return points;
  };

  // Breadth-first Flood fill
  const handleFloodFill = (startX: number, startY: number, fillColor: string) => {
    if (!currentFrame) return;
    const targetColor = currentFrame.pixels[startY * width + startX] || '';
    if (targetColor.toLowerCase() === fillColor.toLowerCase()) return;

    pushUndoSnapshot();

    const nextPixels = [...currentFrame.pixels];
    const queue: Array<[number, number]> = [[startX, startY]];
    const visited = new Uint8Array(width * height);
    visited[startY * width + startX] = 1;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      nextPixels[cy * width + cx] = fillColor;

      const neighbors: Array<[number, number]> = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          if (!visited[idx]) {
            visited[idx] = 1;
            const c = nextPixels[idx] || '';
            if (c.toLowerCase() === targetColor.toLowerCase()) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    setFrames((prev) =>
      prev.map((f, i) =>
        i === selectedFrameIndex ? { ...f, pixels: nextPixels } : f
      )
    );
  };

  const getCanvasPixelCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const px = Math.floor((rawX / rect.width) * width);
    const py = Math.floor((rawY / rect.height) * height);
    return {
      x: Math.max(0, Math.min(width - 1, px)),
      y: Math.max(0, Math.min(height - 1, py)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying) setIsPlaying(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;

    const { x, y } = getCanvasPixelCoords(e);
    lineStartPointRef.current = { x, y };
    dragSnapshotPixelsRef.current = currentFrame ? [...currentFrame.pixels] : null;

    if (activeTool === 'picker') {
      const picked = currentFrame?.pixels[y * width + x] || '';
      if (picked) {
        setPrimaryColor(picked);
        setRecentColors((prev) => Array.from(new Set([picked, ...prev])).slice(0, 10));
        showTempStatus(`Picked ${picked}`);
      }
      return;
    }

    if (activeTool === 'bucket') {
      handleFloodFill(x, y, primaryColor);
      return;
    }

    pushUndoSnapshot();

    if (activeTool === 'pencil' || activeTool === 'eraser' || activeTool === 'dither' || activeTool === 'shade') {
      applyBrushAt(x, y);
    }
  };

  const applyBrushAt = (baseX: number, baseY: number) => {
    const color = activeTool === 'eraser' ? '' : primaryColor;
    const updates: Array<{ x: number; y: number; color: string }> = [];

    const radius = Math.floor(brushSize / 2);

    for (let dy = -radius; dy < -radius + brushSize; dy += 1) {
      for (let dx = -radius; dx < -radius + brushSize; dx += 1) {
        const targetX = baseX + dx;
        const targetY = baseY + dy;
        if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;

        const symPoints = getSymmetricPoints(targetX, targetY);

        for (const pt of symPoints) {
          if (activeTool === 'dither') {
            const isChecker = (pt.x + pt.y) % 2 === 0;
            updates.push({ x: pt.x, y: pt.y, color: isChecker ? primaryColor : secondaryColor });
          } else if (activeTool === 'shade') {
            const existing = currentFrame?.pixels[pt.y * width + pt.x] || '';
            if (existing) {
              const shaded = shadeMode === 'lighten' ? lightenColor(existing, 20) : darkenColor(existing, 20);
              updates.push({ x: pt.x, y: pt.y, color: shaded });
            }
          } else {
            updates.push({ x: pt.x, y: pt.y, color });
          }
        }
      }
    }

    if (color && !recentColors.includes(color)) {
      setRecentColors((prev) => [color, ...prev].slice(0, 10));
    }

    applyPixels(updates);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    const { x, y } = getCanvasPixelCoords(e);

    if (activeTool === 'pencil' || activeTool === 'eraser' || activeTool === 'dither' || activeTool === 'shade') {
      applyBrushAt(x, y);
      return;
    }

    // Line / Rect / Circle real-time preview during drag
    if ((activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle') && lineStartPointRef.current && dragSnapshotPixelsRef.current) {
      const start = lineStartPointRef.current;
      const basePixels = [...dragSnapshotPixelsRef.current];
      let strokePoints: Array<{ x: number; y: number }> = [];

      if (activeTool === 'line') {
        strokePoints = getBresenhamLine(start.x, start.y, x, y);
      } else if (activeTool === 'rect') {
        const minX = Math.min(start.x, x);
        const maxX = Math.max(start.x, x);
        const minY = Math.min(start.y, y);
        const maxY = Math.max(start.y, y);
        for (let rx = minX; rx <= maxX; rx += 1) {
          strokePoints.push({ x: rx, y: minY }, { x: rx, y: maxY });
        }
        for (let ry = minY; ry <= maxY; ry += 1) {
          strokePoints.push({ x: minX, y: ry }, { x: maxX, y: ry });
        }
      } else if (activeTool === 'circle') {
        const radius = Math.round(Math.hypot(x - start.x, y - start.y));
        strokePoints = getMidpointCircle(start.x, start.y, radius);
      }

      for (const pt of strokePoints) {
        for (const sPt of getSymmetricPoints(pt.x, pt.y)) {
          if (sPt.x >= 0 && sPt.x < width && sPt.y >= 0 && sPt.y < height) {
            basePixels[sPt.y * width + sPt.x] = primaryColor;
          }
        }
      }

      setFrames((prev) =>
        prev.map((f, i) =>
          i === selectedFrameIndex ? { ...f, pixels: basePixels } : f
        )
      );
    }
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    lineStartPointRef.current = null;
    dragSnapshotPixelsRef.current = null;
  };

  // Canvas Transformations
  const handleFlipHorizontal = () => {
    if (!currentFrame) return;
    pushUndoSnapshot();
    const next = new Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        next[y * width + (width - 1 - x)] = currentFrame.pixels[y * width + x];
      }
    }
    setFrames((prev) =>
      prev.map((f, i) => (i === selectedFrameIndex ? { ...f, pixels: next } : f))
    );
    showTempStatus('Flipped horizontally.');
  };

  const handleFlipVertical = () => {
    if (!currentFrame) return;
    pushUndoSnapshot();
    const next = new Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        next[(height - 1 - y) * width + x] = currentFrame.pixels[y * width + x];
      }
    }
    setFrames((prev) =>
      prev.map((f, i) => (i === selectedFrameIndex ? { ...f, pixels: next } : f))
    );
    showTempStatus('Flipped vertically.');
  };

  const handleRotate90 = () => {
    if (!currentFrame || width !== height) {
      showTempStatus('Rotate 90° requires a square canvas.');
      return;
    }
    pushUndoSnapshot();
    const next = new Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const destX = height - 1 - y;
        const destY = x;
        next[destY * width + destX] = currentFrame.pixels[y * width + x];
      }
    }
    setFrames((prev) =>
      prev.map((f, i) => (i === selectedFrameIndex ? { ...f, pixels: next } : f))
    );
    showTempStatus('Rotated 90° CW.');
  };

  const handleClearCurrentFrame = () => {
    pushUndoSnapshot();
    setFrames((prev) =>
      prev.map((f, i) =>
        i === selectedFrameIndex
          ? { ...f, pixels: new Array(width * height).fill('') }
          : f
      )
    );
    showTempStatus('Cleared frame.');
  };

  // Timeline Frames Management
  const handleAddFrame = () => {
    pushUndoSnapshot();
    const newFrame: PixelArtFrame = {
      id: crypto.randomUUID(),
      pixels: new Array(width * height).fill(''),
      hold: 1,
    };
    setFrames((prev) => [...prev, newFrame]);
    setSelectedFrameIndex(frames.length);
    showTempStatus('Added blank frame.');
  };

  const handleDuplicateFrame = (idx: number) => {
    const target = frames[idx];
    if (!target) return;
    pushUndoSnapshot();
    const copy: PixelArtFrame = {
      id: crypto.randomUUID(),
      pixels: [...target.pixels],
      hold: target.hold,
    };
    setFrames((prev) => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    setSelectedFrameIndex(idx + 1);
    showTempStatus('Duplicated frame.');
  };

  const handleDeleteFrame = (idx: number) => {
    if (frames.length <= 1) {
      handleClearCurrentFrame();
      return;
    }
    pushUndoSnapshot();
    setFrames((prev) => prev.filter((_, i) => i !== idx));
    setSelectedFrameIndex((prev) => Math.max(0, Math.min(prev, frames.length - 2)));
    showTempStatus('Deleted frame.');
  };

  // Load Curated Demo
  const handleSelectDemo = (demo: PixelArtDemo) => {
    setDemosMenuOpen(false);
    setIsPlaying(false);
    setWidth(demo.width);
    setHeight(demo.height);
    const builtFrames = demo.buildFrames();
    setFrames(builtFrames);
    setFps(demo.fps || 8);
    setProjectTitle(demo.title);
    setActiveDemoId(demo.id);
    setSelectedFrameIndex(0);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setCustomColors(demo.palette);
    setPrimaryColor(demo.palette[0] || '#ffffff');
    if (demo.palette[1]) setSecondaryColor(demo.palette[1]);
    showTempStatus(`Loaded ${demo.title}.`);
  };

  // Change Canvas Size Preset
  const handleSelectSizePreset = (presetW: number, presetH: number) => {
    setDemosMenuOpen(false);
    setIsPlaying(false);
    pushUndoSnapshot();
    setWidth(presetW);
    setHeight(presetH);
    setShowGrid(presetW < 128);
    setZoomLevel(presetW >= 256 ? 1 : presetW >= 128 ? 2 : presetW >= 64 ? 5 : 12);
    setFrames([
      {
        id: crypto.randomUUID(),
        pixels: new Array(presetW * presetH).fill(''),
        hold: 1,
      },
    ]);
    setSelectedFrameIndex(0);
    setActiveDemoId('');
    setProjectTitle(`New ${presetW}×${presetH} Pixel Art`);
    showTempStatus(`Canvas set to ${presetW}×${presetH}.`);
  };

  const toggleShader = (type: PixelShaderType) => {
    setActiveShaders((prev) =>
      prev.some((s) => s.type === type)
        ? prev.filter((s) => s.type !== type)
        : [...prev, { type, intensity: 0.5 }]
    );
  };

  // Render & Export actions
  const handlePostLiveRenderToChat = () => {
    if (!currentFrame) return;
    setExportMenuOpen(false);
    const spec: PixelArtSpec = {
      format: 'pixelart/v3',
      title: projectTitle,
      width,
      height,
      fps,
      loop: loopPlayback,
      ...(activeShaders.length > 0 ? { shaders: activeShaders } : {}),
      frames,
    };
    const code = serializePixelArtSpec(spec);
    const md = `**${projectTitle}** · ${width}×${height} · ${frames.length} ${frames.length === 1 ? 'frame' : 'frames'}\n\n\`\`\`pixelart\n${code}\n\`\`\``;
    onPostToChat(md);
    showTempStatus('Rendered pixel art into chat.');
  };

  const handleAttachToComposer = async () => {
    if (!currentFrame) return;
    setExportMenuOpen(false);
    try {
      const blob = await pixelArtToPngBlob(currentFrame, width, height, 16);
      const reader = new FileReader();
      reader.onload = () => {
        const base64Url = reader.result as string;
        const comma = base64Url.indexOf(',');
        const base64 = comma >= 0 ? base64Url.slice(comma + 1) : base64Url;
        onAttachToChat({
          id: crypto.randomUUID(),
          name: `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-${width}x${height}.png`,
          mimeType: 'image/png',
          size: blob.size,
          isText: false,
          data: base64,
          previewUrl: base64Url,
        });
        showTempStatus('Attached 16× PNG to composer.');
      };
      reader.readAsDataURL(blob);
    } catch {
      showTempStatus('Could not attach to composer.');
    }
  };

  const handleExportPng = async (scale = 16) => {
    if (!currentFrame) return;
    setExportMenuOpen(false);
    try {
      const blob = await pixelArtToPngBlob(currentFrame, width, height, scale);
      downloadBlob(
        blob,
        `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-${width}x${height}-${scale}x.png`
      );
      showTempStatus(`Downloaded ${scale}× upscaled PNG.`);
    } catch {
      showTempStatus('PNG export failed.');
    }
  };

  const handleExportSvg = () => {
    if (!currentFrame) return;
    setExportMenuOpen(false);
    const svgStr = pixelArtToSvg(currentFrame, width, height);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(
      blob,
      `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-${width}x${height}.svg`
    );
    showTempStatus('Downloaded SVG vector.');
  };

  const handleExportGif = async () => {
    setExportMenuOpen(false);
    try {
      const blob = await exportPixelArtGif(frames, width, height, fps, 16);
      downloadBlob(
        blob,
        `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-${fps}fps.gif`
      );
      showTempStatus('Exported animated GIF.');
    } catch (err) {
      showTempStatus(err instanceof Error ? err.message : 'GIF export failed.');
    }
  };

  const handleCopyJsonCode = async () => {
    setExportMenuOpen(false);
    const spec: PixelArtSpec = {
      format: 'pixelart/v3',
      title: projectTitle,
      width,
      height,
      fps,
      loop: loopPlayback,
      ...(activeShaders.length > 0 ? { shaders: activeShaders } : {}),
      frames,
    };
    const code = serializePixelArtSpec(spec);
    try {
      await navigator.clipboard.writeText(code);
      showTempStatus('Copied pixelart JSON code.');
    } catch {
      showTempStatus('Clipboard unavailable.');
    }
  };

  const currentPalette = PALETTE_PRESETS[activePaletteIndex] || PALETTE_PRESETS[0];

  return (
    <aside
      aria-label="Pixel art creation studio"
      className="fixed inset-0 z-40 lg:static lg:z-auto w-full lg:w-[56%] lg:max-w-[860px] lg:min-w-[460px] h-full flex flex-col border-l border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl lg:shadow-none"
    >
      {/* Studio Top Header */}
      <div className="h-14 shrink-0 px-3 sm:px-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between gap-2 bg-[#f9f9f9] dark:bg-[#171717]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0d0d0d] dark:text-white truncate">
            <Paintbrush className="w-4 h-4 text-pink-500 shrink-0" />
            <span className="truncate">{projectTitle}</span>
            <span className="font-mono text-[11px] text-neutral-500 font-normal">
              ({width}×{height})
            </span>
          </div>
        </div>

        {/* Two Studio Header Dropdown Menus */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Menu 1: Demos & Presets */}
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
              <span>Demos ({PIXEL_ART_DEMOS.length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>

            {demosMenuOpen && (
              <div
                role="menu"
                aria-label="Pixel art demos and resolution presets"
                className="absolute right-0 top-full mt-1.5 w-80 max-w-[calc(100vw-2rem)] z-50 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#242424] shadow-2xl p-1.5 max-h-[72vh] overflow-y-auto chat-scroll"
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider font-mono">
                  Complex Pixel Art Demos
                </div>
                {PIXEL_ART_DEMOS.map((demo) => {
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
                          {demo.category} · {demo.width}×{demo.height} · {demo.description}
                        </div>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 mt-0.5 text-pink-500 shrink-0" />}
                    </button>
                  );
                })}

                <div className="my-1 border-t border-neutral-200 dark:border-white/10" />

                <div className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider font-mono">
                  New Blank Canvas Presets
                </div>
                <div className="grid grid-cols-2 gap-1 p-1">
                  {CANVAS_SIZE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSelectSizePreset(p.w, p.h)}
                      className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 text-[11px] font-mono text-left hover:bg-neutral-100 dark:hover:bg-white/10"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
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
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Render &amp; Export</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-75" />
            </button>

            {exportMenuOpen && (
              <div
                role="menu"
                aria-label="Render and export options"
                className="absolute right-0 top-full mt-1.5 w-64 z-50 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#242424] shadow-2xl p-1.5 text-[#0d0d0d] dark:text-[#ececec]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handlePostLiveRenderToChat}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                  <span>Post Live Render to Chat</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleAttachToComposer()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Attach 16× PNG to Composer</span>
                </button>

                <div className="my-1 border-t border-neutral-200 dark:border-white/10" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleExportPng(16)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Download Crisp PNG (16×)</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleExportPng(1)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Download 1:1 Actual Pixel PNG</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportSvg}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Download SVG Vector Grid</span>
                </button>

                {frames.length > 1 && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleExportGif()}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                  >
                    <Film className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                    <span>Download Animated GIF</span>
                  </button>
                )}

                <div className="my-1 border-t border-neutral-200 dark:border-white/10" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleCopyJsonCode()}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300 shrink-0" />
                  <span>Copy Pixel Art JSON Spec</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close pixel art studio"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Body: Canvas & Toolbars */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto chat-scroll">
        {/* Drawing Tools, Symmetry & Size bar */}
        <div className="p-2 sm:px-4 border-b border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#181818] flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Tool Selector */}
          <div className="flex flex-wrap items-center gap-1">
            <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#262626] p-0.5">
              {(
                [
                  { id: 'pencil', icon: Pencil, label: 'Pixel Pencil' },
                  { id: 'eraser', icon: Eraser, label: 'Pixel Eraser' },
                  { id: 'bucket', icon: PaintBucket, label: 'Flood Fill' },
                  { id: 'picker', icon: Pipette, label: 'Eyedropper' },
                  { id: 'line', icon: Minus, label: 'Crisp Line' },
                  { id: 'rect', icon: Square, label: 'Rectangle' },
                  { id: 'circle', icon: Circle, label: 'Circle' },
                  { id: 'dither', icon: Grid3X3, label: 'Bayer Dither Brush' },
                  { id: 'shade', icon: Sun, label: 'Shading Brush (Lighten/Darken)' },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTool(id)}
                  title={label}
                  aria-label={label}
                  aria-pressed={activeTool === id}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                    activeTool === id
                      ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-[#0d0d0d] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            {/* Brush Sizes */}
            <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#262626] p-0.5">
              {[1, 2, 3, 4].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setBrushSize(sz)}
                  className={`px-1.5 py-1 rounded-md font-mono text-[11px] tabular-nums transition-colors ${
                    brushSize === sz
                      ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>

            {/* Symmetry Mirroring */}
            <div className="inline-flex items-center rounded-lg bg-neutral-200/80 dark:bg-[#262626] p-0.5">
              {(
                [
                  { id: 'none', label: 'Off' },
                  { id: 'horizontal', label: 'Sym X' },
                  { id: 'vertical', label: 'Sym Y' },
                  { id: 'quad', label: 'Quad' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSymmetry(id)}
                  className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    symmetry === id
                      ? 'bg-white dark:bg-[#3c3c3c] text-[#0d0d0d] dark:text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTool === 'shade' && (
              <button
                type="button"
                onClick={() =>
                  setShadeMode((m) => (m === 'lighten' ? 'darken' : 'lighten'))
                }
                className="h-7 px-2 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium capitalize"
              >
                {shadeMode}
              </button>
            )}
          </div>

          {/* Undo / Redo / Transforms */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 disabled:opacity-35"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 disabled:opacity-35"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-4 bg-neutral-300 dark:bg-white/15 mx-0.5" />
            <button
              type="button"
              onClick={handleFlipHorizontal}
              title="Flip Horizontal"
              aria-label="Flip horizontal"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRotate90}
              title="Rotate 90° Clockwise"
              aria-label="Rotate 90 degrees"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClearCurrentFrame}
              title="Clear Canvas"
              aria-label="Clear canvas"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Color Palette & Custom Swatches Strip */}
        <div className="px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-white/10 bg-[#f4f4f4] dark:bg-[#1a1a1a] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary & Secondary Color Swatches */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-neutral-300 dark:border-white/15">
              <div className="flex flex-col items-center gap-0.5">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  title="Primary Color"
                  aria-label="Primary color"
                  className="w-7 h-7 p-0 rounded-md border border-neutral-400 dark:border-white/30 cursor-pointer"
                />
                <span className="text-[9px] uppercase font-mono text-neutral-500">Pri</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  title="Secondary Color (for Dither)"
                  aria-label="Secondary color"
                  className="w-7 h-7 p-0 rounded-md border border-neutral-400 dark:border-white/30 cursor-pointer"
                />
                <span className="text-[9px] uppercase font-mono text-neutral-500">Sec</span>
              </div>
            </div>

            {/* Palette Selection Dropdown */}
            <select
              value={activePaletteIndex}
              onChange={(e) => setActivePaletteIndex(Number(e.target.value))}
              aria-label="Palette preset"
              className="h-7 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#262626] px-2 text-[11px] font-medium text-[#0d0d0d] dark:text-[#ececec]"
            >
              {PALETTE_PRESETS.map((pal, idx) => (
                <option key={pal.id} value={idx}>
                  {pal.name}
                </option>
              ))}
            </select>

            {/* Preset Color Swatches */}
            <div className="flex items-center gap-1 flex-wrap">
              {(customColors.length > 0 ? customColors : currentPalette.colors).map((c) => {
                const isSelected = primaryColor.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPrimaryColor(c)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSecondaryColor(c);
                      showTempStatus(`Secondary color: ${c}`);
                    }}
                    title={`Left-click: Primary | Right-click: Secondary (${c})`}
                    className={`w-5 h-5 rounded-xs border transition-transform ${
                      isSelected
                        ? 'scale-115 ring-2 ring-[#0d0d0d] dark:ring-white border-white'
                        : 'border-black/20 dark:border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
          </div>

          {/* Quick Recent Colors */}
          {recentColors.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-neutral-300 dark:border-white/15">
              <span className="text-[10px] text-neutral-400 font-mono">Recent:</span>
              {recentColors.map((rc) => (
                <button
                  key={rc}
                  type="button"
                  onClick={() => setPrimaryColor(rc)}
                  className="w-4 h-4 rounded-xs border border-white/20 hover:scale-110"
                  style={{ backgroundColor: rc }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Viewport Stage Area */}
        <div className="relative flex-1 p-4 bg-neutral-100/90 dark:bg-[#121212] flex items-center justify-center overflow-auto min-h-[320px]">
          <div
            className="relative p-6 rounded-2xl border border-neutral-300 dark:border-white/15 shadow-2xl flex items-center justify-center select-none"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundColor: '#09090b',
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="touch-none cursor-crosshair block rounded-xs shadow-xl"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Symmetry Overlay Guides */}
            {symmetry !== 'none' && (
              <div
                aria-hidden="true"
                className="absolute inset-6 pointer-events-none"
              >
                {(symmetry === 'horizontal' || symmetry === 'quad') && (
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-cyan-400/40 border-r border-cyan-400/80" />
                )}
                {(symmetry === 'vertical' || symmetry === 'quad') && (
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-cyan-400/40 border-b border-cyan-400/80" />
                )}
              </div>
            )}
          </div>

          {/* Floating 1:1 True-Scale Miniature Box */}
          <div className="absolute bottom-4 right-4 p-2.5 rounded-xl border border-neutral-300 dark:border-white/15 bg-white/95 dark:bg-[#1f1f1f]/95 shadow-xl backdrop-blur-sm space-y-1">
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider flex items-center justify-between gap-3">
              <span>Actual Size (2×)</span>
              <span>{width}×{height}</span>
            </div>
            <div className="p-1.5 rounded-lg bg-neutral-900 border border-black/20 flex items-center justify-center">
              <canvas
                ref={previewCanvasRef}
                className="block"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
        </div>

        {/* Zoom, Grid & Navigation Sub-strip */}
        <div className="px-3 sm:px-4 py-2 border-t border-b border-neutral-200 dark:border-white/10 bg-[#f9f9f9] dark:bg-[#171717] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              aria-pressed={showGrid}
              className={`inline-flex items-center gap-1 h-7 px-2 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                showGrid
                  ? 'bg-neutral-200 dark:bg-[#333] text-[#0d0d0d] dark:text-white font-medium'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Grid Lines</span>
            </button>

            <div className="inline-flex items-center rounded-md bg-neutral-200/80 dark:bg-[#262626] p-0.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(1, z - (z <= 4 ? 1 : 2)))}
                disabled={zoomLevel <= 1}
                className="w-6 h-6 inline-flex items-center justify-center rounded text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1.5 tabular-nums text-neutral-700 dark:text-neutral-200">
                {zoomLevel}×
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(32, z + (z < 4 ? 1 : 2)))}
                disabled={zoomLevel >= 32}
                className="w-6 h-6 inline-flex items-center justify-center rounded text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Post Shaders Toggle Chips */}
            <div className="hidden md:flex items-center gap-1 pl-2 border-l border-neutral-300 dark:border-white/10">
              {SHADER_PRESETS.map((sh) => {
                const active = activeShaders.some((s) => s.type === sh.id);
                return (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => toggleShader(sh.id)}
                    aria-pressed={active}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-white/10'
                    }`}
                  >
                    {sh.label}
                  </button>
                );
              })}
            </div>
          </div>

          {statusMessage && (
            <span className="text-pink-600 dark:text-pink-400 font-medium text-xs">
              {statusMessage}
            </span>
          )}

          {/* Transport / Animation bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              disabled={frames.length <= 1}
              className="h-7 px-2.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-40"
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play Animation'}</span>
            </button>

            <label className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300 font-mono">
              <span>{fps} fps</span>
              <input
                type="range"
                min={1}
                max={24}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-16 accent-[#0d0d0d] dark:accent-white"
              />
            </label>
          </div>
        </div>

        {/* Timeline Frames Strip */}
        <div className="p-3 sm:p-4 space-y-2 bg-[#f4f4f4] dark:bg-[#1a1a1a]">
          <div className="flex items-center justify-between text-xs text-neutral-500 font-mono">
            <span>
              Frames ({frames.length}) · {isPlaying ? `Playing ${playIndex + 1}` : `Editing ${selectedFrameIndex + 1}`}
            </span>
            <button
              type="button"
              onClick={handleAddFrame}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-[11px] font-medium"
            >
              <Plus className="w-3 h-3" />
              <span>Add Frame</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 chat-scroll">
            {frames.map((frame, idx) => {
              const isSelected = !isPlaying && idx === selectedFrameIndex;
              const isCurrentlyPlaying = isPlaying && idx === playIndex;
              return (
                <div
                  key={frame.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setSelectedFrameIndex(idx);
                  }}
                  className={`group relative shrink-0 w-20 p-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                    isSelected || isCurrentlyPlaying
                      ? 'border-[#0d0d0d] dark:border-white ring-2 ring-pink-500/50 bg-white dark:bg-[#252525]'
                      : 'border-neutral-300 dark:border-white/10 bg-white/60 dark:bg-[#202020] hover:border-neutral-400'
                  }`}
                >
                  <div className="w-full aspect-square rounded-md bg-neutral-900 border border-black/20 flex items-center justify-center overflow-hidden mb-1">
                    <span className="font-mono text-xs text-neutral-400">#{idx + 1}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                    <span>F{idx + 1}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateFrame(idx);
                      }}
                      title="Duplicate frame"
                      className="hover:text-black dark:hover:text-white"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {frames.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFrame(idx);
                        }}
                        title="Delete frame"
                        className="hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
