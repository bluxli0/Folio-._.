import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  Film,
  Layers,
  Loader2,
  Maximize2,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import {
  ThreeDAnimationPreset,
  ThreeDLightingPreset,
  ThreeDMaterialType,
  ThreeDObjectSpec,
  ThreeDSceneSpec,
  ThreeDShapeType,
} from '../types/threeD';
import { ChatAttachment } from '../types/chat';
import { THREE_D_DEMOS } from '../utils/threeDPresets';
import { buildThreeJsHtml, parseThreeDCode, serializeThreeDToCode } from '../utils/threeDParser';
import { GoogleFlowPanel } from './GoogleFlowPanel';

interface ThreeDStudioProps {
  externalSpec?: ThreeDSceneSpec | null;
  onConsumeExternalSpec?: () => void;
  onPostToChat: (markdownText: string) => void;
  onAttachToChat: (attachment: ChatAttachment) => void;
  onClose: () => void;
}

export const ThreeDStudio: React.FC<ThreeDStudioProps> = ({
  externalSpec,
  onConsumeExternalSpec,
  onPostToChat,
  onAttachToChat,
  onClose,
}) => {
  const [sceneSpec, setSceneSpec] = useState<ThreeDSceneSpec>(() => THREE_D_DEMOS[0].spec);
  const [activeDemoId, setActiveDemoId] = useState<string>(THREE_D_DEMOS[0].id);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(() => THREE_D_DEMOS[0].spec.objects[0]?.id || null);
  const [activeTab, setActiveTab] = useState<'viewport' | 'objects' | 'code' | 'flow'>('viewport');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [demosMenuOpen, setDemosMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const demosMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const showTempStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  useEffect(() => {
    if (externalSpec) {
      setSceneSpec(externalSpec);
      setSelectedObjId(externalSpec.objects[0]?.id || null);
      if (onConsumeExternalSpec) onConsumeExternalSpec();
      showTempStatus('Loaded 3D scene from chat.');
    }
  }, [externalSpec, onConsumeExternalSpec, showTempStatus]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (demosMenuRef.current && !demosMenuRef.current.contains(e.target as Node)) {
        setDemosMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const srcDoc = useMemo(() => buildThreeJsHtml(sceneSpec), [sceneSpec]);

  const selectedObject = useMemo(
    () => sceneSpec.objects.find((o) => o.id === selectedObjId) || null,
    [sceneSpec.objects, selectedObjId]
  );

  const handleSelectDemo = (demo: (typeof THREE_D_DEMOS)[0]) => {
    setDemosMenuOpen(false);
    setSceneSpec(JSON.parse(JSON.stringify(demo.spec)));
    setActiveDemoId(demo.id);
    setSelectedObjId(demo.spec.objects[0]?.id || null);
    setIframeKey((k) => k + 1);
    showTempStatus(`Loaded ${demo.title}.`);
  };

  const handleAddObject = (shape: ThreeDShapeType = 'box') => {
    const newObj: ThreeDObjectSpec = {
      id: crypto.randomUUID(),
      shape,
      material: 'pbr',
      color: '#38bdf8',
      roughness: 0.3,
      metalness: 0.8,
      wireframe: false,
      position: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      animation: 'rotate',
      speed: 1.0,
    };
    setSceneSpec((prev) => ({
      ...prev,
      objects: [...prev.objects, newObj],
    }));
    setSelectedObjId(newObj.id);
    setIframeKey((k) => k + 1);
    showTempStatus(`Added 3D ${shape}.`);
  };

  const handleUpdateSelectedObject = (patch: Partial<ThreeDObjectSpec>) => {
    if (!selectedObjId) return;
    setSceneSpec((prev) => ({
      ...prev,
      objects: prev.objects.map((o) => (o.id === selectedObjId ? { ...o, ...patch } : o)),
    }));
  };

  const handleDeleteSelectedObject = () => {
    if (!selectedObjId) return;
    setSceneSpec((prev) => ({
      ...prev,
      objects: prev.objects.filter((o) => o.id !== selectedObjId),
    }));
    setSelectedObjId(null);
    setIframeKey((k) => k + 1);
    showTempStatus('Deleted 3D object.');
  };

  const handlePostToChat = () => {
    setExportMenuOpen(false);
    const code = serializeThreeDToCode(sceneSpec);
    const md = `**${sceneSpec.title}** · Three.js 3D Scene\n\n\`\`\`threejs\n${code}\n\`\`\``;
    onPostToChat(md);
    showTempStatus('Posted 3D scene to chat.');
  };

  const handleCopyCode = async () => {
    setExportMenuOpen(false);
    const code = serializeThreeDToCode(sceneSpec);
    try {
      await navigator.clipboard.writeText(code);
      showTempStatus('Copied 3D JSON code to clipboard.');
    } catch {
      showTempStatus('Clipboard unavailable.');
    }
  };

  const captureIframeSnapshot = (onDataUrl: (dataUrl: string) => void, onError: () => void) => {
    const iframe = document.getElementById('three-studio-iframe') as HTMLIFrameElement | null;
    if (!iframe || !iframe.contentWindow) {
      onError();
      return;
    }
    try {
      const canvas = iframe.contentWindow.document.querySelector('canvas');
      if (canvas) {
        onDataUrl(canvas.toDataURL('image/png'));
        return;
      }
    } catch {
      // Sandboxed iframe — use postMessage bridge
    }
    const requestId = `studio-snap-${Date.now()}-${Math.random()}`;
    let settled = false;
    const onMessage = (ev: MessageEvent) => {
      if (
        ev.data &&
        ev.data.type === 'folio-three-snapshot-data' &&
        ev.data.requestId === requestId &&
        typeof ev.data.dataUrl === 'string'
      ) {
        settled = true;
        window.removeEventListener('message', onMessage);
        onDataUrl(ev.data.dataUrl);
      }
    };
    window.addEventListener('message', onMessage);
    setTimeout(() => {
      window.removeEventListener('message', onMessage);
      if (!settled) onError();
    }, 2500);
    iframe.contentWindow.postMessage({ type: 'folio-three-snapshot-request', requestId }, '*');
  };

  const handleSnapshotPng = () => {
    setExportMenuOpen(false);
    captureIframeSnapshot(
      (dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${(sceneSpec.title || '3d-scene').toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showTempStatus('Downloaded PNG snapshot.');
      },
      () => showTempStatus('Snapshot capture failed.')
    );
  };

  const handleAttachSnapshotToChat = () => {
    setExportMenuOpen(false);
    captureIframeSnapshot(
      (dataUrl) => {
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        onAttachToChat({
          id: crypto.randomUUID(),
          name: '3d-scene-snapshot.png',
          mimeType: 'image/png',
          size: Math.round((base64.length * 3) / 4),
          isText: false,
          data: base64,
          previewUrl: dataUrl,
        });
        showTempStatus('Attached 3D snapshot to composer.');
      },
      () => showTempStatus('Attachment failed.')
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-md flex flex-col text-[#ececec]">
      {/* Studio Header */}
      <header className="h-14 shrink-0 bg-[#161616] border-b border-white/10 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Box className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-sm sm:text-base text-white truncate">
              {sceneSpec.title}
            </h1>
            <p className="text-xs text-neutral-400 truncate">
              Three.js 3D Creation Studio & Google Flow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Demos Dropdown */}
          <div ref={demosMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setDemosMenuOpen((v) => !v);
                setExportMenuOpen(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={demosMenuOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
            >
              <span>Demos ({THREE_D_DEMOS.length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {demosMenuOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-full mt-1.5 w-72 rounded-2xl border border-white/10 bg-[#222] shadow-2xl p-1.5 z-50 max-h-96 overflow-y-auto chat-scroll space-y-0.5"
              >
                {THREE_D_DEMOS.map((demo) => {
                  const selected = demo.id === activeDemoId;
                  return (
                    <button
                      key={demo.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelectDemo(demo)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors ${
                        selected ? 'bg-white/15 text-white font-medium' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="font-medium">{demo.title}</div>
                      <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {demo.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export / Render Menu */}
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen((v) => !v);
                setDemosMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Render & Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/70" />
            </button>

            {exportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border border-white/10 bg-[#222] shadow-2xl p-1.5 z-50 space-y-0.5 text-xs font-medium"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handlePostToChat}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-white/10 text-white transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Post 3D Scene to Chat</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleAttachSnapshotToChat}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-white/10 text-white transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Attach PNG to Composer</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSnapshotPng}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-white/10 text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Download PNG Snapshot</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleCopyCode}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-white/10 text-white transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Copy JSON Spec</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close 3D studio"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workbench */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Viewport / Tabs Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] relative">
          {/* Sub-toolbar */}
          <div className="h-11 px-4 border-b border-white/10 bg-[#141414] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('viewport')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'viewport' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                3D Viewport
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('objects')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'objects' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Scene Objects ({sceneSpec.objects.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('flow')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'flow' ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-blue-300'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Google Flow</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'code' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                JSON Spec
              </button>
            </div>

            {statusMessage && (
              <div className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[11px]">
                {statusMessage}
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
            {activeTab === 'viewport' && (
              <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center">
                <iframe
                  key={iframeKey}
                  id="three-studio-iframe"
                  srcDoc={srcDoc}
                  title="3D Studio Viewport"
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                />
              </div>
            )}

            {activeTab === 'objects' && (
              <div className="flex-1 p-6 overflow-y-auto chat-scroll space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Scene Mesh Elements</h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAddObject('box')}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
                    >
                      + Box
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddObject('sphere')}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
                    >
                      + Sphere
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddObject('torusKnot')}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
                    >
                      + Torus Knot
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddObject('icosahedron')}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
                    >
                      + Crystal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddObject('waveSurface')}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-xs text-cyan-200"
                    >
                      + Wave Surface
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddObject('graphRibbon')}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-xs text-purple-200"
                    >
                      + Graph Ribbon
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sceneSpec.objects.map((obj) => {
                    const isSelected = obj.id === selectedObjId;
                    return (
                      <div
                        key={obj.id}
                        onClick={() => setSelectedObjId(obj.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/15 shadow-md'
                            : 'border-white/10 bg-[#141414] hover:bg-[#1f1f1f]'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-xs text-white mb-2">
                          <span className="capitalize font-semibold">{obj.shape}</span>
                          <span className="text-[10px] text-neutral-400">{obj.material}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                          <span
                            className="w-3 h-3 rounded-full border border-white/20"
                            style={{ backgroundColor: obj.color }}
                          />
                          <span>Anim: {obj.animation}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'flow' && (
              <GoogleFlowPanel
                onSendFilmToChat={(summaryMarkdown) => {
                  onPostToChat(summaryMarkdown);
                  setActiveTab('viewport');
                }}
                onClose={() => setActiveTab('viewport')}
              />
            )}

            {activeTab === 'code' && (
              <div className="flex-1 p-5 bg-[#0e0e0e] font-mono text-xs overflow-auto chat-scroll">
                <pre className="text-emerald-300 whitespace-pre-wrap">
                  {serializeThreeDToCode(sceneSpec)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Inspector Sidebar */}
        <aside className="w-80 shrink-0 bg-[#161616] border-l border-white/10 flex flex-col min-h-0 overflow-y-auto chat-scroll p-4 space-y-5 text-xs">
          <div>
            <h3 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Scene Settings</span>
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-neutral-400 text-[11px] mb-1 block">Lighting Rig</label>
                <select
                  value={sceneSpec.lighting}
                  onChange={(e) =>
                    setSceneSpec((prev) => ({
                      ...prev,
                      lighting: e.target.value as ThreeDLightingPreset,
                    }))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#222] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="studio">Studio Clean</option>
                  <option value="sunset">Golden Sunset</option>
                  <option value="cyberpunk">Cyberpunk Neon</option>
                  <option value="dramatic">Dramatic High Contrast</option>
                  <option value="matrix">Matrix Code Green</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-neutral-300">Auto Rotate Scene</span>
                <input
                  type="checkbox"
                  checked={sceneSpec.autoRotate}
                  onChange={(e) =>
                    setSceneSpec((prev) => ({ ...prev, autoRotate: e.target.checked }))
                  }
                  className="w-4 h-4 rounded accent-blue-600"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-neutral-300">Show Collision Hitboxes</span>
                <input
                  type="checkbox"
                  checked={Boolean(sceneSpec.showHitboxes)}
                  onChange={(e) =>
                    setSceneSpec((prev) => ({ ...prev, showHitboxes: e.target.checked }))
                  }
                  className="w-4 h-4 rounded accent-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="font-display font-semibold text-white mb-3 flex items-center justify-between">
              <span>Object Inspector</span>
              {selectedObject && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedObject}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </h3>

            {selectedObject ? (
              <div className="space-y-3">
                <div>
                  <label className="text-neutral-400 text-[11px] mb-1 block">Material Type</label>
                  <select
                    value={selectedObject.material}
                    onChange={(e) =>
                      handleUpdateSelectedObject({
                        material: e.target.value as ThreeDMaterialType,
                      })
                    }
                    className="w-full rounded-xl border border-white/15 bg-[#222] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pbr">PBR Standard</option>
                    <option value="glass">Refractive Glass</option>
                    <option value="gold">Polished Gold</option>
                    <option value="neon">Neon Wireframe</option>
                    <option value="clay">Matte Clay</option>
                    <option value="toon">Cel Shaded (Toon)</option>
                    <option value="normal">Normal Vectors</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 text-[11px] mb-1 block">Base Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedObject.color}
                      onChange={(e) => handleUpdateSelectedObject({ color: e.target.value })}
                      className="w-9 h-9 rounded-lg bg-transparent border border-white/20 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={selectedObject.color}
                      onChange={(e) => handleUpdateSelectedObject({ color: e.target.value })}
                      className="flex-1 rounded-xl border border-white/15 bg-[#222] px-3 py-2 font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-neutral-400 text-[11px] mb-1 block">Animation Behavior</label>
                  <select
                    value={selectedObject.animation}
                    onChange={(e) =>
                      handleUpdateSelectedObject({
                        animation: e.target.value as ThreeDAnimationPreset,
                      })
                    }
                    className="w-full rounded-xl border border-white/15 bg-[#222] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="rotate">Continuous Spin</option>
                    <option value="bounce">Vertical Bobbing</option>
                    <option value="physicsBounce">Rigid-Body Physics</option>
                    <option value="pulse">Breathing Scale</option>
                    <option value="float">Gentle Float & Tilt</option>
                    <option value="orbit">Axis Orbit</option>
                    <option value="chaos">Chaotic Gyro</option>
                    <option value="none">Static (No Animation)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-neutral-300">Object Hitbox Wireframe</span>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedObject.hitbox)}
                    onChange={(e) => handleUpdateSelectedObject({ hitbox: e.target.checked })}
                    className="w-4 h-4 rounded accent-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-neutral-300">Gravity & Collision Physics</span>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedObject.physics?.enabled || selectedObject.animation === 'physicsBounce')}
                    onChange={(e) =>
                      handleUpdateSelectedObject({
                        animation: e.target.checked ? 'physicsBounce' : 'rotate',
                        physics: e.target.checked
                          ? { enabled: true, vx: 1.5, vy: 0.4, vz: 1.1, gravity: -9.8, restitution: 0.86, floorY: -1.8, walls: [2.8, 3.2, 2.8] }
                          : { enabled: false },
                      })
                    }
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div className="text-neutral-500 text-xs py-4 text-center">
                Select an object from the Scene Objects tab to inspect properties.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
