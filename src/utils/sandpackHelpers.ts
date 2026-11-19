import type { SandpackPredefinedTemplate } from '@codesandbox/sandpack-react';

export interface SandpackTemplateChoice {
  id: SandpackPredefinedTemplate;
  label: string;
}

export const SANDPACK_TEMPLATES: SandpackTemplateChoice[] = [
  { id: 'react-ts', label: 'React (TSX)' },
  { id: 'react', label: 'React (JSX)' },
  { id: 'vue', label: 'Vue 3' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'vanilla-ts', label: 'Vanilla TS' },
  { id: 'vanilla', label: 'Vanilla JS' },
  { id: 'static', label: 'Static HTML' },
  { id: 'solid', label: 'SolidJS' },
  { id: 'node', label: 'Node.js' },
];

const BUILTIN_IGNORED_PACKAGES = new Set([
  'react',
  'react-dom',
  'vue',
  'svelte',
  'solid-js',
  'fs',
  'path',
  'os',
  'http',
  'https',
  'url',
  'util',
  'crypto',
  'stream',
  'events',
  'buffer',
  'child_process',
]);

export function extractNpmDependencies(code: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const spec = match[1].trim();
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) {
        continue;
      }
      const pkgName = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0];

      if (!pkgName || BUILTIN_IGNORED_PACKAGES.has(pkgName)) {
        continue;
      }
      deps[pkgName] = 'latest';
    }
  }

  return deps;
}

export function hasThirdPartyImports(code: string): boolean {
  const deps = extractNpmDependencies(code);
  return Object.keys(deps).some((pkg) => pkg !== 'lucide-react');
}

export function mapLanguageToSandpackTemplate(
  lang: string,
  code: string
): SandpackPredefinedTemplate {
  const lower = lang.trim().toLowerCase();
  if (lower === 'vue') return 'vue';
  if (lower === 'svelte') return 'svelte';
  if (lower === 'solid') return 'solid';
  if (lower === 'html' || lower === 'static') return 'static';
  if (lower === 'jsx') return 'react';
  if (lower === 'tsx' || lower === 'react') return 'react-ts';
  if (lower === 'ts' || lower === 'typescript') {
    return /<[A-Z][A-Za-z0-9]*|return\s*\(?\s*</.test(code) ? 'react-ts' : 'vanilla-ts';
  }
  if (lower === 'js' || lower === 'javascript') {
    return /\bfrom\s+['"]react['"]|\buseState\b|\bexport\s+default\s+function\s+[A-Z]/.test(code)
      ? 'react'
      : 'vanilla';
  }
  if (lower === 'node') return 'node';
  return 'react-ts';
}

function prepareReactEntryCode(rawCode: string, isTs: boolean): string {
  let code = rawCode.trim();
  const hasExportDefault = /\bexport\s+default\b/.test(code);
  const hasReactImport = /\bfrom\s+['"]react['"]/.test(code);

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
    ].filter((h) => new RegExp(`\\b${h}\\b`).test(code));

    if (hooks.length > 0) {
      code = `import React, { ${hooks.join(', ')} } from 'react';\n${code}`;
    } else {
      code = `import React from 'react';\n${code}`;
    }
  }

  if (hasExportDefault) {
    return code;
  }

  const fnMatch = code.match(/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)\b/);
  if (fnMatch?.[1]) {
    return `${code}\n\nexport default ${fnMatch[1]};`;
  }

  if (code.startsWith('<')) {
    return `${isTs ? '' : ''}import React from 'react';\n\nexport default function App() {\n  return (\n    <>\n      ${code}\n    </>\n  );\n}`;
  }

  return code;
}

export function buildSandpackFiles(
  template: SandpackPredefinedTemplate,
  rawCode: string
): Record<string, string> {
  const code = rawCode.trim();
  switch (template) {
    case 'react-ts':
      return { '/App.tsx': prepareReactEntryCode(code, true) };
    case 'react':
      return { '/App.js': prepareReactEntryCode(code, false) };
    case 'vue':
    case 'vue-ts':
      return { '/src/App.vue': code };
    case 'svelte':
      return { '/App.svelte': code };
    case 'solid':
      return { '/App.tsx': code };
    case 'static':
      return {
        '/index.html': /<html[\s>]/i.test(code)
          ? code
          : `<!doctype html><html><head><meta charset="UTF-8" /></head><body style="font-family:system-ui,sans-serif;padding:16px;">${code}</body></html>`,
      };
    case 'vanilla-ts':
      return { '/index.ts': code };
    case 'vanilla':
    case 'node':
    default:
      return { '/index.js': code };
  }
}

export function isSandpackCompatibleCategory(category: string, language: string): boolean {
  const lower = language.toLowerCase();
  return (
    category === 'react' ||
    category === 'html' ||
    category === 'javascript' ||
    category === 'sandpack' ||
    lower === 'vue' ||
    lower === 'svelte' ||
    lower === 'solid'
  );
}
