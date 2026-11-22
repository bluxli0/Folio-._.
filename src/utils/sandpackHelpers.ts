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

const PINNED_PACKAGE_VERSIONS: Record<string, string> = {
  three: '^0.169.0',
  '@types/three': '^0.169.0',
  '@react-three/fiber': '^8.17.10',
  '@react-three/drei': '^9.114.3',
  '@react-three/postprocessing': '^2.16.3',
  postprocessing: '^6.36.3',
};

const VALID_NPM_PKG_REGEX = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;

function normalizeCdnSpecifier(spec: string): string {
  const s = spec.trim();
  const cdnMatch = s.match(
    /^https?:\/\/(?:esm\.sh|cdn\.skypack\.dev|cdn\.jsdelivr\.net\/npm|unpkg\.com)\/((?:@[^/@]+(?:\/[^/@]+)?)|[^/@]+)(?:@[^/]+)?(\/.*)?$/i
  );
  if (cdnMatch?.[1]) {
    const pkg = cdnMatch[1];
    const sub = cdnMatch[2] || '';
    if (pkg === 'three' && sub.includes('/addons/')) {
      return `three${sub.replace('/addons/', '/examples/jsm/')}`;
    }
    return `${pkg}${sub}`;
  }
  return s;
}

export function extractNpmDependencies(code: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      let spec = match[1].trim();
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:') || spec.startsWith('data:') || spec.startsWith('blob:')) {
        continue;
      }
      if (/^https?:\/\//i.test(spec)) {
        spec = normalizeCdnSpecifier(spec);
        if (/^https?:\/\//i.test(spec)) continue;
      }
      const pkgName = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0];

      if (!pkgName || BUILTIN_IGNORED_PACKAGES.has(pkgName) || !VALID_NPM_PKG_REGEX.test(pkgName)) {
        continue;
      }
      deps[pkgName] = PINNED_PACKAGE_VERSIONS[pkgName] || 'latest';
    }
  }

  if (/\bTHREE\./.test(code) && !deps['three']) {
    deps['three'] = PINNED_PACKAGE_VERSIONS['three'];
  }
  if (deps['three'] && !deps['@types/three']) {
    deps['@types/three'] = PINNED_PACKAGE_VERSIONS['@types/three'];
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
  if (lower === 'threejs') return 'vanilla-ts';
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

function normalizeThreeImports(code: string): string {
  let out = code
    .replace(
      /(['"])https?:\/\/(?:esm\.sh|cdn\.skypack\.dev|cdn\.jsdelivr\.net\/npm|unpkg\.com)\/((?:@[^/'"]+\/)?[^/'"]+)(?:@[^/'"]+)?(\/[^'"]*)?\1/gi,
      (_all, quote, pkg, sub = '') => {
        const fixedSub = pkg === 'three' && sub.includes('/addons/')
          ? sub.replace('/addons/', '/examples/jsm/')
          : sub;
        return `${quote}${pkg}${fixedSub}${quote}`;
      }
    )
    .replace(/(['"])three\/addons\/([^'"]+)\1/g, '$1three/examples/jsm/$2$1');

  if (/\bTHREE\./.test(out) && !/\bfrom\s+['"]three['"]|\brequire\(['"]three['"]\)/.test(out)) {
    out = `import * as THREE from 'three';\n${out}`;
  }
  return out;
}

function prepareReactEntryCode(rawCode: string, isTs: boolean): string {
  let code = normalizeThreeImports(rawCode.trim());
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

const THREE_VIEWPORT_CSS = `html, body, #root, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #090d16;
}
canvas { display: block; width: 100%; height: 100%; }
`;

export function buildSandpackFiles(
  template: SandpackPredefinedTemplate,
  rawCode: string
): Record<string, string> {
  const code = normalizeThreeImports(rawCode.trim());
  const usesThree = /\bfrom\s+['"]three['"]|\bTHREE\.|Canvas\b/.test(code);
  switch (template) {
    case 'react-ts':
      return {
        '/App.tsx': usesThree
          ? `import './styles.css';\n${prepareReactEntryCode(code, true)}`
          : prepareReactEntryCode(code, true),
        ...(usesThree ? { '/styles.css': THREE_VIEWPORT_CSS } : {}),
      };
    case 'react':
      return {
        '/App.js': usesThree
          ? `import './styles.css';\n${prepareReactEntryCode(code, false)}`
          : prepareReactEntryCode(code, false),
        ...(usesThree ? { '/styles.css': THREE_VIEWPORT_CSS } : {}),
      };
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
      return {
        '/index.ts': usesThree ? `import './styles.css';\n${code}` : code,
        ...(usesThree ? { '/styles.css': THREE_VIEWPORT_CSS } : {}),
      };
    case 'vanilla':
    case 'node':
    default:
      return {
        '/index.js': usesThree ? `import './styles.css';\n${code}` : code,
        ...(usesThree ? { '/styles.css': THREE_VIEWPORT_CSS } : {}),
      };
  }
}

export function isSandpackCompatibleCategory(category: string, language: string): boolean {
  const lower = language.toLowerCase();
  return (
    category === 'react' ||
    category === 'html' ||
    category === 'javascript' ||
    category === 'sandpack' ||
    lower === 'threejs' ||
    lower === 'vue' ||
    lower === 'svelte' ||
    lower === 'solid'
  );
}
