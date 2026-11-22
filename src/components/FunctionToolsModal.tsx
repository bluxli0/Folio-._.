import React, { useState } from 'react';
import {
  Braces,
  Check,
  Play,
  Plus,
  Terminal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { CustomFunctionToolDef } from '../types/chat';

interface BuiltInToolMeta {
  name: string;
  description: string;
  sampleArgs: string;
}

const BUILTIN_TOOLS: BuiltInToolMeta[] = [
  {
    name: 'namecom_domain_sim',
    description: 'Search simulated Name.com TLDs, register a simulated domain with DNS records, or list active domain bindings.',
    sampleArgs: JSON.stringify({ action: 'search', query: 'folio-studio' }, null, 2),
  },
  {
    name: 'workspace_list',
    description: 'List active Folio project workspaces and files.',
    sampleArgs: JSON.stringify({}, null, 2),
  },
  {
    name: 'workspace_read_file',
    description: 'Read a file slice cleanly from the active workspace.',
    sampleArgs: JSON.stringify({ path: 'index.html', maxChars: 4000 }, null, 2),
  },
  {
    name: 'workspace_write_file',
    description: 'Create or update a file in the active project workspace.',
    sampleArgs: JSON.stringify({ path: 'notes.txt', content: 'Created from Function Runner' }, null, 2),
  },
  {
    name: 'workspace_run_script',
    description: 'Execute Python 3, JavaScript, TypeScript, or Bash inside the workspace.',
    sampleArgs: JSON.stringify({ language: 'javascript', code: 'console.log(2 + 2);' }, null, 2),
  },
  {
    name: 'stock_media_search',
    description: 'Search public stock SVG icons, Wikimedia Commons images, and GIFs.',
    sampleArgs: JSON.stringify({ query: 'nebula space', kind: 'images', limit: 3 }, null, 2),
  },
  {
    name: 'blender_cli',
    description: 'Execute headless Blender 3.4.1 bpy scripts with Draco support.',
    sampleArgs: JSON.stringify({ pythonCode: 'import bpy\nprint("Blender objects:", len(bpy.data.objects))' }, null, 2),
  },
  {
    name: 'validate_creative_code',
    description: 'Validate evo, stopmotion, pixelart, liquidmotion, bbmodel, chart, or quiz JSON specs.',
    sampleArgs: JSON.stringify({ kind: 'evo', code: '{"format":"evo/v1","nodes":[{"type":"sphere"}]}' }, null, 2),
  },
];

interface FunctionToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customTools: CustomFunctionToolDef[];
  onSaveTool: (
    tool: Omit<CustomFunctionToolDef, 'createdAt' | 'updatedAt'>,
    isNew: boolean
  ) => Promise<void>;
  onDeleteTool: (id: string) => Promise<void>;
  onToggleTool: (tool: CustomFunctionToolDef) => Promise<void>;
  activeWorkspaceId?: string;
}

const DEFAULT_PARAM_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input value passed to the function',
      },
    },
    required: ['input'],
  },
  null,
  2
);

const DEFAULT_HANDLER_CODE = `// Receives \`args\` object and returns any JSON-serializable value
const text = String(args.input || '').trim();
return {
  ok: true,
  length: text.length,
  upper: text.toUpperCase(),
};`;

export const FunctionToolsModal: React.FC<FunctionToolsModalProps> = ({
  isOpen,
  onClose,
  customTools,
  onSaveTool,
  onDeleteTool,
  onToggleTool,
  activeWorkspaceId,
}) => {
  const [activeTab, setActiveTab] = useState<'custom' | 'builtin'>('custom');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parametersJson, setParametersJson] = useState(DEFAULT_PARAM_SCHEMA);
  const [handlerCode, setHandlerCode] = useState(DEFAULT_HANDLER_CODE);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Interactive test runner state
  const [testToolName, setTestToolName] = useState<string>(BUILTIN_TOOLS[0].name);
  const [testArgsJson, setTestArgsJson] = useState<string>(BUILTIN_TOOLS[0].sampleArgs);
  const [testCustomTool, setTestCustomTool] = useState<CustomFunctionToolDef | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string>('');

  if (!isOpen) return null;

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setName('calculate_orbit');
    setDescription('Compute orbital velocity and period for a given radius and mass factor.');
    setParametersJson(
      JSON.stringify(
        {
          type: 'object',
          properties: {
            radiusKm: { type: 'number', description: 'Orbital radius in km' },
          },
          required: ['radiusKm'],
        },
        null,
        2
      )
    );
    setHandlerCode(
      `const r = Number(args.radiusKm || 6771);\nconst mu = 398600.4418;\nconst v = Math.sqrt(mu / r);\nreturn { radiusKm: r, velocityKmS: Number(v.toFixed(3)) };`
    );
    setEnabled(true);
    setFormError(null);
  };

  const startEdit = (tool: CustomFunctionToolDef) => {
    setIsCreating(false);
    setEditingId(tool.id);
    setName(tool.name);
    setDescription(tool.description);
    setParametersJson(tool.parametersJson);
    setHandlerCode(tool.handlerCode);
    setEnabled(tool.enabled);
    setFormError(null);
  };

  const handleSave = async () => {
    const cleanName = name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (!cleanName || !/^[a-zA-Z_][a-zA-Z0-9_]{1,63}$/.test(cleanName)) {
      setFormError('Function name must start with a letter/underscore and use alphanumeric/underscore characters.');
      return;
    }
    try {
      JSON.parse(parametersJson);
    } catch {
      setFormError('Parameters Schema must be valid JSON.');
      return;
    }
    if (!handlerCode.trim()) {
      setFormError('JavaScript handler body is required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const id = isCreating ? `fn-${Date.now()}` : editingId || `fn-${Date.now()}`;
      await onSaveTool(
        {
          id,
          name: cleanName,
          description: description.trim() || `Custom tool ${cleanName}`,
          parametersJson,
          handlerCode,
          enabled,
        },
        isCreating
      );
      setIsCreating(false);
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save function tool.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async (
    targetName: string,
    rawArgsJson: string,
    customDef?: CustomFunctionToolDef | null
  ) => {
    setTestRunning(true);
    setTestOutput('');
    try {
      const parsedArgs = JSON.parse(rawArgsJson || '{}') as Record<string, unknown>;
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetName,
          args: parsedArgs,
          activeWorkspaceId,
          customTools: customDef ? [customDef] : customTools,
        }),
      });
      const data = await res.json();
      setTestOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setTestOutput(
        JSON.stringify(
          { error: err instanceof Error ? err.message : 'Execution failed' },
          null,
          2
        )
      );
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#1d1d1d] border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden text-[#0d0d0d] dark:text-[#ececec]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Braces className="w-4 h-4 text-cyan-500 shrink-0" />
            <div>
              <h2 className="font-display text-base font-semibold">
                Function Calling Environment & Interface
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Inspect built-in environment tools or define custom sandboxed JavaScript functions callable by models in chat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-nav */}
        <div className="px-5 py-2 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#232323] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'custom'
                  ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              Custom Functions ({customTools.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('builtin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'builtin'
                  ? 'bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d]'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10'
              }`}
            >
              Built-in Environment Tools ({BUILTIN_TOOLS.length})
            </button>
          </div>

          {activeTab === 'custom' && (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-500 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Function</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: Tool list / editor */}
          <div className="lg:col-span-7 space-y-3">
            {activeTab === 'custom' ? (
              <>
                {(isCreating || editingId) && (
                  <div className="p-4 rounded-xl border border-cyan-500/40 bg-neutral-50 dark:bg-[#242424] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        {isCreating ? 'Create Callable Function' : 'Edit Function'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingId(null);
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                          Function Name (snake_case)
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. convert_currency"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-[#191919] text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                          Description (shown to model)
                        </label>
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="What this tool does"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-[#191919] text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        JSON Schema Parameters
                      </label>
                      <textarea
                        rows={5}
                        value={parametersJson}
                        onChange={(e) => setParametersJson(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-[#191919] text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Sandboxed JS Handler Body (`args` in scope, must `return` result)
                      </label>
                      <textarea
                        rows={5}
                        value={handlerCode}
                        onChange={(e) => setHandlerCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-[#191919] text-xs font-mono"
                      />
                    </div>

                    {formError && (
                      <div className="text-xs text-red-500">{formError}</div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setEnabled(e.target.checked)}
                          className="accent-cyan-500"
                        />
                        <span>Enabled in chat</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-medium disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Function'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {customTools.length === 0 && !isCreating ? (
                  <div className="p-6 rounded-xl border border-dashed border-neutral-300 dark:border-white/15 text-center space-y-2">
                    <Wrench className="w-6 h-6 mx-auto text-neutral-400" />
                    <div className="text-xs font-medium">No custom functions yet</div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Add your own JSON-schema tools executed safely in Node VM during model tool calls.
                    </p>
                  </div>
                ) : (
                  customTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="p-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-[#242424] flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                            {tool.name}()
                          </span>
                          <button
                            type="button"
                            onClick={() => void onToggleTool(tool)}
                            className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                              tool.enabled
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                : 'bg-neutral-200 dark:bg-white/10 text-neutral-500'
                            }`}
                          >
                            {tool.enabled ? 'Active' : 'Paused'}
                          </button>
                        </div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
                          {tool.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setTestToolName(tool.name);
                            setTestCustomTool(tool);
                            setTestArgsJson('{}');
                          }}
                          className="px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] hover:bg-neutral-200/70 dark:hover:bg-white/10"
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(tool)}
                          className="px-2 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] hover:bg-neutral-200/70 dark:hover:bg-white/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteTool(tool.id)}
                          className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-500/10"
                          title="Delete function"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div className="space-y-2.5">
                {BUILTIN_TOOLS.map((bt) => (
                  <div
                    key={bt.name}
                    className="p-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-[#242424] flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold text-[#0d0d0d] dark:text-white">
                        {bt.name}()
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                        {bt.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTestToolName(bt.name);
                        setTestCustomTool(null);
                        setTestArgsJson(bt.sampleArgs);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-300 dark:border-white/15 text-[11px] font-medium hover:bg-neutral-200/70 dark:hover:bg-white/10 shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      <span>Load Tester</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: Interactive Function Call Test Runner */}
          <div className="lg:col-span-5 flex flex-col rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#171717] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span>Interactive Tool Runner</span>
              </div>
              <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                {testToolName}
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-neutral-500 mb-1">
                JSON Arguments
              </label>
              <textarea
                rows={6}
                value={testArgsJson}
                onChange={(e) => setTestArgsJson(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-[#111111] text-xs font-mono"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleRunTest(testToolName, testArgsJson, testCustomTool)}
              disabled={testRunning}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0d0d0d] dark:bg-white text-white dark:text-[#0d0d0d] text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testRunning ? 'Executing...' : `Execute ${testToolName}`}</span>
            </button>

            <div className="flex-1 min-h-[160px] flex flex-col">
              <div className="text-[11px] text-neutral-500 mb-1">Response Payload</div>
              <pre className="flex-1 p-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#101010] text-[11px] font-mono overflow-auto max-h-[240px] whitespace-pre-wrap">
                {testOutput || '// Run any built-in or custom function to inspect live output'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
