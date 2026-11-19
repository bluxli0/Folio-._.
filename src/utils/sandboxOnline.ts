import {
  buildCssSrcDoc,
  buildFletSrcDoc,
  buildHtmlSrcDoc,
  buildJsRunnerSrcDoc,
  buildNiceGuiSrcDoc,
  buildPyScriptSrcDoc,
  buildReactSrcDoc,
  getPreviewCategory,
  normalizeLanguage,
} from './codePreview';
import { buildThreeJsHtml, parseThreeDCode } from './threeDParser';
import { DesignSystemConfig } from '../types/designSystem';

export interface PublishSandboxResult {
  id: string;
  url: string;
  fullUrl: string;
  createdAt: number;
}

export function canPublishOnlineSandbox(language: string): boolean {
  const norm = normalizeLanguage(language);
  const cat = getPreviewCategory(norm);
  return (
    cat === 'html' ||
    cat === 'css' ||
    cat === 'react' ||
    cat === 'javascript' ||
    cat === 'svg' ||
    cat === 'flet' ||
    cat === 'nicegui' ||
    cat === 'pyscript' ||
    cat === 'threejs' ||
    cat === 'sandpack'
  );
}

function buildSvgDocument(svgCode: string, darkCanvas: boolean): string {
  const safeSvg = svgCode.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  const bg = darkCanvas ? '#18181b' : '#ffffff';
  const fg = darkCanvas ? '#f4f4f5' : '#111827';
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Folio Online SVG Sandbox</title>
  <style>
    html, body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: ${bg}; color: ${fg}; }
    svg { max-width: 96vw; max-height: 92vh; }
  </style>
</head>
<body>${safeSvg}</body>
</html>`;
}

function buildSandpackFallbackOnlineHtml(code: string, language: string, darkCanvas: boolean): string {
  const bg = darkCanvas ? '#18181b' : '#ffffff';
  const fg = darkCanvas ? '#f4f4f5' : '#111827';
  const safeCode = JSON.stringify(code).replace(/<\/script>/gi, '<\\/script>');
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Folio Online Sandbox (${language})</title>
  <style>
    body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; color: ${fg}; }
    pre { padding: 16px; border-radius: 12px; background: rgba(128,128,128,0.12); overflow: auto; font-family: ui-monospace, monospace; font-size: 13px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <pre id="source-view"></pre>
  <script>document.getElementById('source-view').textContent = ${safeCode};</script>
</body>
</html>`;
}

export async function publishOnlineSandbox(opts: {
  code: string;
  language: string;
  darkCanvas: boolean;
  title?: string;
  designSystem?: DesignSystemConfig;
}): Promise<PublishSandboxResult> {
  const norm = normalizeLanguage(opts.language, opts.code);
  const category = getPreviewCategory(norm);

  let html = '';

  if (category === 'html') {
    html = buildHtmlSrcDoc(opts.code, opts.darkCanvas, opts.designSystem);
  } else if (category === 'css') {
    html = buildCssSrcDoc(opts.code, opts.darkCanvas, opts.designSystem);
  } else if (category === 'flet') {
    html = buildFletSrcDoc(opts.code, opts.darkCanvas);
  } else if (category === 'nicegui') {
    html = buildNiceGuiSrcDoc(opts.code, opts.darkCanvas);
  } else if (category === 'pyscript') {
    html = buildPyScriptSrcDoc(opts.code, opts.darkCanvas);
  } else if (category === 'svg') {
    html = buildSvgDocument(opts.code, opts.darkCanvas);
  } else if (category === 'threejs') {
    const parsed = parseThreeDCode(opts.code);
    html = buildThreeJsHtml(
      parsed.spec ?? {
        title: 'Three.js Scene',
        background: '#090d16',
        lighting: 'studio',
        autoRotate: false,
        bloom: false,
        shadows: true,
        objects: [],
        customJsCode: opts.code,
      }
    );
  } else if (category === 'react' || category === 'javascript') {
    const res = await fetch('/api/preview/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: opts.code, language: norm }),
    });
    const data = (await res.json()) as { code?: string; error?: string };
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to bundle code for online sandbox.');
    }
    html =
      category === 'react'
        ? buildReactSrcDoc(data.code || '', opts.darkCanvas, opts.designSystem)
        : buildJsRunnerSrcDoc(data.code || '', opts.darkCanvas, opts.designSystem);
  } else if (category === 'sandpack') {
    // Try bundling TSX/JSX directly via esbuild first; fall back to printable view if third-party npm packages are unresolvable server-side
    try {
      const res = await fetch('/api/preview/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: opts.code, language: 'tsx' }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (res.ok && data.code) {
        html = buildReactSrcDoc(data.code, opts.darkCanvas, opts.designSystem);
      } else {
        html = buildSandpackFallbackOnlineHtml(opts.code, norm, opts.darkCanvas);
      }
    } catch {
      html = buildSandpackFallbackOnlineHtml(opts.code, norm, opts.darkCanvas);
    }
  } else {
    html = buildHtmlSrcDoc(opts.code, opts.darkCanvas, opts.designSystem);
  }

  const pubRes = await fetch('/api/sandbox/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      language: norm,
      title: opts.title || `Folio ${norm.toUpperCase()} Sandbox`,
    }),
  });

  const pubData = (await pubRes.json()) as {
    id?: string;
    url?: string;
    createdAt?: number;
    error?: string;
  };

  if (!pubRes.ok || !pubData.id || !pubData.url) {
    throw new Error(pubData.error || 'Failed to publish online sandbox.');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    id: pubData.id,
    url: pubData.url,
    fullUrl: `${origin}${pubData.url}`,
    createdAt: pubData.createdAt || Date.now(),
  };
}
