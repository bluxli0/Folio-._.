export type HiddenLayerCategory = 'syntax' | 'filenames' | 'typos' | 'folders';
export type HiddenLayerSeverity = 'error' | 'warning' | 'info';

export interface HiddenLayerFinding {
  id: string;
  category: HiddenLayerCategory;
  severity: HiddenLayerSeverity;
  title: string;
  detail: string;
  location?: string;
  snippet?: string;
  original?: string;
  replacement?: string;
  folderPath?: string;
  codeBlockIndex?: number;
}

export interface ParsedCodeBlock {
  index: number;
  language: string;
  rawInfo: string;
  startLine: number;
  code: string;
  closed: boolean;
  suggestedFilename?: string;
}

export interface DetectedFileTarget {
  path: string;
  folder: string;
  codeBlockIndex?: number;
}

export interface HiddenLayerReport {
  findings: HiddenLayerFinding[];
  codeBlocks: ParsedCodeBlock[];
  folders: string[];
  fileTargets: DetectedFileTarget[];
  counts: {
    all: number;
    syntax: number;
    filenames: number;
    typos: number;
    folders: number;
    errors: number;
    warnings: number;
    fixable: number;
  };
}

interface TypoRule {
  pattern: RegExp;
  wrong: string;
  right: string;
  scope: 'anywhere' | 'codeOnly';
  note?: string;
}

const TYPO_RULES: TypoRule[] = [
  { pattern: /\b(packge|pacakge|pakcage|pacage)\.json\b/g, wrong: 'packge.json', right: 'package.json', scope: 'anywhere', note: 'Node manifest filename typo' },
  { pattern: /\b(tsconfg|tsconifg|tsconfigg)\.json\b/g, wrong: 'tsconfg.json', right: 'tsconfig.json', scope: 'anywhere', note: 'TypeScript config filename typo' },
  { pattern: /\b(idex|indxe|indext)\.html?\b/g, wrong: 'idex.html', right: 'index.html', scope: 'anywhere', note: 'HTML entry filename typo' },
  { pattern: /\b(readm|radme|redame)\.md\b/gi, wrong: 'radme.md', right: 'README.md', scope: 'anywhere', note: 'README filename typo' },
  { pattern: /\bvite\.confg\.(ts|js|mjs)\b/g, wrong: 'vite.confg', right: 'vite.config', scope: 'anywhere', note: 'Vite config filename typo' },
  { pattern: /\bfucntion\b/g, wrong: 'fucntion', right: 'function', scope: 'anywhere' },
  { pattern: /\bfunciton\b/g, wrong: 'funciton', right: 'function', scope: 'anywhere' },
  { pattern: /\bfuntion\b/g, wrong: 'funtion', right: 'function', scope: 'anywhere' },
  { pattern: /\bretrun\b/g, wrong: 'retrun', right: 'return', scope: 'anywhere' },
  { pattern: /\bretunr\b/g, wrong: 'retunr', right: 'return', scope: 'anywhere' },
  { pattern: /\bimprot\b/g, wrong: 'improt', right: 'import', scope: 'anywhere' },
  { pattern: /\bimoprt\b/g, wrong: 'imoprt', right: 'import', scope: 'anywhere' },
  { pattern: /\bexprot\b/g, wrong: 'exprot', right: 'export', scope: 'anywhere' },
  { pattern: /\bcosnt\b/g, wrong: 'cosnt', right: 'const', scope: 'anywhere' },
  { pattern: /\bconset\b/g, wrong: 'conset', right: 'const', scope: 'codeOnly' },
  { pattern: /\bdefualt\b/g, wrong: 'defualt', right: 'default', scope: 'anywhere' },
  { pattern: /\bconsol\.log\b/g, wrong: 'consol.log', right: 'console.log', scope: 'anywhere' },
  { pattern: /\bdocumnet\b/g, wrong: 'documnet', right: 'document', scope: 'anywhere' },
  { pattern: /\bdocuemnt\b/g, wrong: 'docuemnt', right: 'document', scope: 'anywhere' },
  { pattern: /\bwindwo\b/g, wrong: 'windwo', right: 'window', scope: 'anywhere' },
  { pattern: /\blenght\b/g, wrong: 'lenght', right: 'length', scope: 'anywhere' },
  { pattern: /\bheigth\b/g, wrong: 'heigth', right: 'height', scope: 'anywhere' },
  { pattern: /\bwidht\b/g, wrong: 'widht', right: 'width', scope: 'anywhere' },
  { pattern: /\bundefiend\b/g, wrong: 'undefiend', right: 'undefined', scope: 'anywhere' },
  { pattern: /\bflase\b/g, wrong: 'flase', right: 'false', scope: 'anywhere' },
  { pattern: /\bture\b/g, wrong: 'ture', right: 'true', scope: 'codeOnly' },
  { pattern: /\bawiat\b/g, wrong: 'awiat', right: 'await', scope: 'anywhere' },
  { pattern: /\basyncronous\b/g, wrong: 'asyncronous', right: 'asynchronous', scope: 'anywhere' },
  { pattern: /\bpritn\s*\(/g, wrong: 'pritn(', right: 'print(', scope: 'codeOnly' },
  { pattern: /\brequrie\s*\(/g, wrong: 'requrie(', right: 'require(', scope: 'codeOnly' },
  { pattern: /\bbackgroud\b/g, wrong: 'backgroud', right: 'background', scope: 'anywhere' },
  { pattern: /\bcolro\b/g, wrong: 'colro', right: 'color', scope: 'codeOnly' },
  { pattern: /\bdisplya\b/g, wrong: 'displya', right: 'display', scope: 'anywhere' },
  { pattern: /\bpositoin\b/g, wrong: 'positoin', right: 'position', scope: 'anywhere' },
  { pattern: /\btranform\b/g, wrong: 'tranform', right: 'transform', scope: 'anywhere' },
  { pattern: /\bopactiy\b/g, wrong: 'opactiy', right: 'opacity', scope: 'anywhere' },
  { pattern: /\bstylsheet\b/g, wrong: 'stylsheet', right: 'stylesheet', scope: 'anywhere' },
];

const EXTENSION_TYPOS: Record<string, string> = {
  '.htlm': '.html',
  '.htmll': '.html',
  '.hmtl': '.html',
  '.tsxx': '.tsx',
  '.jsxx': '.jsx',
  '.jso': '.json',
  '.josn': '.json',
  '.csss': '.css',
  '.pyhton': '.py',
  '.pythn': '.py',
  '.javscript': '.js',
  '.typescipt': '.ts',
  '.mdown': '.md',
  '.ymls': '.yml',
};

const RESERVED_WIN_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

function normalizeFenceLanguage(rawInfo: string): { language: string; filename?: string } {
  const trimmed = rawInfo.trim();
  if (!trimmed) return { language: 'text' };

  // Match e.g. ```tsx:src/App.tsx or ```tsx:src/my file.tsx or ```tsx title="App.tsx"
  const colonMatch = /^([a-zA-Z0-9_+-]+):(.+)$/.exec(trimmed);
  if (colonMatch) {
    return {
      language: colonMatch[1].toLowerCase(),
      filename: colonMatch[2].trim().replace(/^["']|["']$/g, ''),
    };
  }

  const titleMatch = /\b(?:title|file|path)=["']([^"']+)["']/i.exec(trimmed);
  const parts = trimmed.split(/\s+/);
  const lang = parts[0].toLowerCase();
  if (titleMatch?.[1]) {
    return { language: lang, filename: titleMatch[1] };
  }
  if (parts[1] && /[./\\]/.test(parts[1]) && !parts[1].startsWith('{')) {
    return { language: lang, filename: parts[1].replace(/^["']|["']$/g, '') };
  }
  return { language: lang };
}

function detectFilenameCommentInCode(code: string): string | undefined {
  const firstLines = code.split('\n').slice(0, 3);
  for (const line of firstLines) {
    const m =
      /^\s*(?:\/\/|#|\/\*|<!--)\s*(?:file(?:name|path)?|path|save\s+as|target)\s*:\s*([^\s*<>]+(?:\s+[^\s*<>]+)*?)(?:\s*\*\/|\s*-->)?\s*$/i.exec(
        line
      ) ||
      /^\s*(?:\/\/|#)\s*([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]{1,8})\s*$/.exec(line);
    if (m?.[1]) {
      return m[1].trim();
    }
  }
  return undefined;
}

function checkBalancedDelimiters(
  code: string,
  lang: string
): Array<{ message: string; line: number; snippet: string }> {
  const issues: Array<{ message: string; line: number; snippet: string }> = [];
  const isBraceLang = new Set([
    'js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx', 'react',
    'css', 'scss', 'less', 'java', 'c', 'cpp', 'c++', 'cs', 'csharp',
    'rust', 'rs', 'go', 'php', 'swift', 'kotlin', 'dart', 'json', 'jsonc',
  ]).has(lang);

  const isPython = lang === 'py' || lang === 'python' || lang === 'python3';
  const isShell = lang === 'sh' || lang === 'bash' || lang === 'shell' || lang === 'zsh';

  if (!isBraceLang && !isPython && !isShell) {
    return issues;
  }

  const lines = code.split('\n');
  const stack: Array<{ ch: string; line: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closingToOpen: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  let inBlockComment = false;
  let inTripleQuote: string | null = null;
  let inBacktick = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const lineText = lines[lineIdx];
    const lineNum = lineIdx + 1;
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < lineText.length; i += 1) {
      const ch = lineText[i];
      const next = lineText[i + 1] || '';
      const next3 = lineText.slice(i, i + 3);

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 1;
        }
        continue;
      }

      if (inTripleQuote) {
        if (next3 === inTripleQuote) {
          inTripleQuote = null;
          i += 2;
        }
        continue;
      }

      if (inBacktick) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === '`') {
          inBacktick = false;
        } else if (ch === '$' && next === '{') {
          stack.push({ ch: '{', line: lineNum });
          i += 1;
        }
        continue;
      }

      if (inSingle) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === "'") inSingle = false;
        continue;
      }

      if (inDouble) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === '"') inDouble = false;
        continue;
      }

      // Comments
      if (isBraceLang && ch === '/' && next === '/') break;
      if (isBraceLang && ch === '/' && next === '*') {
        inBlockComment = true;
        i += 1;
        continue;
      }
      if ((isPython || isShell) && ch === '#') break;

      // Triple quotes for python
      if (isPython && (next3 === '"""' || next3 === "'''")) {
        inTripleQuote = next3;
        i += 2;
        continue;
      }

      // Regex literal rough skip in JS/TS so regex brackets don't false-trigger
      if (
        (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript' || lang === 'jsx' || lang === 'tsx') &&
        ch === '/' &&
        next !== '/' &&
        next !== '*'
      ) {
        const prevNonSpace = lineText.slice(0, i).trimEnd().slice(-1);
        if (!prevNonSpace || '(=[,;:!&|?{'.includes(prevNonSpace)) {
          let j = i + 1;
          let inClass = false;
          let closedRegex = false;
          while (j < lineText.length) {
            const rc = lineText[j];
            if (rc === '\\') {
              j += 2;
              continue;
            }
            if (rc === '[') inClass = true;
            else if (rc === ']') inClass = false;
            else if (rc === '/' && !inClass) {
              closedRegex = true;
              break;
            }
            j += 1;
          }
          if (closedRegex) {
            i = j;
            continue;
          }
        }
      }

      if (ch === "'") {
        inSingle = true;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        continue;
      }
      if (ch === '`' && isBraceLang) {
        inBacktick = true;
        continue;
      }

      if (pairs[ch]) {
        stack.push({ ch, line: lineNum });
      } else if (closingToOpen[ch]) {
        const expectedOpen = closingToOpen[ch];
        const top = stack[stack.length - 1];
        if (!top) {
          issues.push({
            message: `Unexpected closing "${ch}" with no matching "${expectedOpen}".`,
            line: lineNum,
            snippet: lineText.trim().slice(0, 90),
          });
        } else if (top.ch !== expectedOpen) {
          issues.push({
            message: `Mismatched delimiter: expected closing "${pairs[top.ch]}" (opened line ${top.line}), found "${ch}".`,
            line: lineNum,
            snippet: lineText.trim().slice(0, 90),
          });
          stack.pop();
        } else {
          stack.pop();
        }
      }
    }

    if ((inSingle || inDouble) && !lineText.trimEnd().endsWith('\\')) {
      issues.push({
        message: `Unterminated ${inSingle ? 'single-quoted' : 'double-quoted'} string literal.`,
        line: lineNum,
        snippet: lineText.trim().slice(0, 90),
      });
    }
  }

  if (inBlockComment) {
    issues.push({
      message: 'Unclosed block comment "/* ... */".',
      line: lines.length,
      snippet: lines[lines.length - 1]?.trim().slice(0, 90) || '',
    });
  }
  if (inBacktick) {
    issues.push({
      message: 'Unclosed template literal backtick "`".',
      line: lines.length,
      snippet: lines[lines.length - 1]?.trim().slice(0, 90) || '',
    });
  }
  for (const unclosed of stack.slice(-3)) {
    issues.push({
      message: `Unclosed "${unclosed.ch}" (missing "${pairs[unclosed.ch]}").`,
      line: unclosed.line,
      snippet: (lines[unclosed.line - 1] || '').trim().slice(0, 90),
    });
  }

  return issues.slice(0, 6);
}

function checkPythonSyntax(code: string): Array<{ message: string; severity: HiddenLayerSeverity; line: number; snippet: string }> {
  const issues: Array<{ message: string; severity: HiddenLayerSeverity; line: number; snippet: string }> = [];
  const lines = code.split('\n');
  let sawSpaces = false;
  let sawTabs = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (/^\t+ +|^ +\t+/.test(raw)) {
      issues.push({
        message: 'Mixed tabs and spaces in leading indentation.',
        severity: 'error',
        line: i + 1,
        snippet: raw.slice(0, 80),
      });
    }
    if (raw.startsWith('\t')) sawTabs = true;
    if (raw.startsWith('  ')) sawSpaces = true;

    // Missing colon on single-line block starters
    const strippedComment = trimmed.replace(/\s+#.*$/, '').trim();
    if (
      /^(?:async\s+)?(?:def|class|if|elif|else|for|while|try|except|finally|with)\b/.test(strippedComment) &&
      !strippedComment.endsWith(':') &&
      !strippedComment.endsWith('\\') &&
      !strippedComment.endsWith('(') &&
      !strippedComment.endsWith('[') &&
      !strippedComment.endsWith('{') &&
      !strippedComment.endsWith(',')
    ) {
      // Avoid single-line ternary `x = a if b else c` (not starting with `if`), already anchored with ^
      issues.push({
        message: 'Python block statement appears to be missing a trailing ":".',
        severity: 'error',
        line: i + 1,
        snippet: trimmed.slice(0, 90),
      });
    }

    if (/^print\s+["']/.test(trimmed)) {
      issues.push({
        message: 'Python 2 style "print" statement missing parentheses.',
        severity: 'warning',
        line: i + 1,
        snippet: trimmed.slice(0, 90),
      });
    }
  }

  if (sawSpaces && sawTabs) {
    issues.push({
      message: 'File mixes tab-indented and space-indented blocks.',
      severity: 'warning',
      line: 1,
      snippet: 'Inconsistent indentation',
    });
  }

  return issues.slice(0, 5);
}

function checkHtmlTagSyntax(code: string): Array<{ message: string; severity: HiddenLayerSeverity; line: number; snippet: string }> {
  const issues: Array<{ message: string; severity: HiddenLayerSeverity; line: number; snippet: string }> = [];
  const criticalTags = ['script', 'style', 'svg', 'form', 'table', 'head', 'body', 'html'];
  for (const tag of criticalTags) {
    const openMatches = code.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || [];
    const selfClosed = code.match(new RegExp(`<${tag}[^>]*/>`, 'gi')) || [];
    const closeMatches = code.match(new RegExp(`</${tag}\\s*>`, 'gi')) || [];
    const unclosedCount = openMatches.length - selfClosed.length - closeMatches.length;
    if (unclosedCount > 0) {
      issues.push({
        message: `Unclosed <${tag}> tag (${unclosedCount} missing </${tag}>).`,
        severity: tag === 'script' || tag === 'style' ? 'error' : 'warning',
        line: 1,
        snippet: `<${tag}> ...`,
      });
    } else if (unclosedCount < 0) {
      issues.push({
        message: `Extra closing </${tag}> tag without matching <${tag}>.`,
        severity: 'warning',
        line: 1,
        snippet: `</${tag}>`,
      });
    }
  }
  return issues.slice(0, 5);
}

function evaluateFilename(
  rawPath: string,
  location: string,
  findings: HiddenLayerFinding[],
  seenKeys: Set<string>
): string | null {
  const cleaned = rawPath.trim();
  if (!cleaned || cleaned.length > 220) return null;
  if (/^(https?:|mailto:|data:|blob:|#|\/api\/)/i.test(cleaned)) return null;

  const pushFinding = (f: Omit<HiddenLayerFinding, 'id'>) => {
    const key = `${f.category}:${f.title}:${f.original || f.detail}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    findings.push({ id: `hl-${findings.length + 1}`, ...f });
  };

  // Backslashes in path (except windows explicit root shouldn't be mixed with forward slashes)
  if (cleaned.includes('\\')) {
    const fixed = cleaned.replace(/\\+/g, '/');
    pushFinding({
      category: 'filenames',
      severity: 'warning',
      title: 'Backslashes in file path',
      detail: `"${cleaned}" uses "\\" separators instead of POSIX "/".`,
      location,
      original: cleaned,
      replacement: fixed,
    });
  }

  // Illegal OS filename characters
  if (/[<>"|?*\0]/.test(cleaned) || /:(?!\\|\/)/.test(cleaned.replace(/^[a-zA-Z]:/, ''))) {
    const fixed = cleaned.replace(/[<>"|?*\0:]/g, '-');
    pushFinding({
      category: 'filenames',
      severity: 'error',
      title: 'Illegal characters in filename',
      detail: `"${cleaned}" contains reserved OS characters (< > : " | ? *).`,
      location,
      original: cleaned,
      replacement: fixed,
    });
  }

  // Spaces in code/project filenames
  const baseName = cleaned.split('/').pop() || cleaned;
  if (/\s/.test(baseName) && /\.[a-zA-Z0-9]{1,8}$/.test(baseName)) {
    const fixedBase = baseName.replace(/\s+\./g, '.').replace(/\s+/g, '-');
    const dirPart = cleaned.includes('/') ? cleaned.slice(0, cleaned.lastIndexOf('/') + 1) : '';
    pushFinding({
      category: 'filenames',
      severity: 'warning',
      title: 'Whitespace inside filename',
      detail: `"${cleaned}" contains spaces which can break imports and CLI scripts.`,
      location,
      original: cleaned,
      replacement: `${dirPart}${fixedBase}`,
    });
  }

  // Double slashes
  if (/[^:]\/\//.test(cleaned) || cleaned.startsWith('//')) {
    pushFinding({
      category: 'filenames',
      severity: 'warning',
      title: 'Double slash in path',
      detail: `"${cleaned}" contains "//" which creates malformed path segments.`,
      location,
      original: cleaned,
      replacement: cleaned.replace(/\/{2,}/g, '/'),
    });
  }

  // Doubled extension e.g. app.tsx.tsx
  const dblExtMatch = /(\.[a-zA-Z0-9]{1,6})\1$/.exec(baseName);
  if (dblExtMatch) {
    pushFinding({
      category: 'filenames',
      severity: 'error',
      title: 'Doubled file extension',
      detail: `"${cleaned}" repeats extension "${dblExtMatch[1]}".`,
      location,
      original: cleaned,
      replacement: cleaned.slice(0, cleaned.length - dblExtMatch[1].length),
    });
  }

  // Typo extension
  const extMatch = /(\.[a-zA-Z0-9]+)$/.exec(baseName.toLowerCase());
  if (extMatch && EXTENSION_TYPOS[extMatch[1]]) {
    const wrongExt = extMatch[1];
    const rightExt = EXTENSION_TYPOS[wrongExt];
    const fixed = cleaned.slice(0, cleaned.length - wrongExt.length) + rightExt;
    pushFinding({
      category: 'filenames',
      severity: 'error',
      title: `Broken extension "${wrongExt}"`,
      detail: `"${cleaned}" looks like a typo for "${fixed}".`,
      location,
      original: cleaned,
      replacement: fixed,
    });
  }

  // Trailing dot on filename
  if (baseName.endsWith('.') && baseName !== '.' && baseName !== '..') {
    pushFinding({
      category: 'filenames',
      severity: 'error',
      title: 'Trailing dot in filename',
      detail: `"${cleaned}" ends with a trailing "." which fails on Windows and web servers.`,
      location,
      original: cleaned,
      replacement: cleaned.replace(/\.+$/, ''),
    });
  }

  // Reserved Windows names
  const stem = baseName.split('.')[0].toUpperCase();
  if (RESERVED_WIN_NAMES.has(stem)) {
    pushFinding({
      category: 'filenames',
      severity: 'error',
      title: `Reserved OS filename "${stem}"`,
      detail: `"${cleaned}" uses a reserved Windows device name.`,
      location,
    });
  }

  return cleaned.replace(/\\+/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+/, '');
}

function addFolderAncestors(folderPath: string, folderSet: Set<string>) {
  const cleaned = folderPath
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^(\.\/|\/)+/, '')
    .replace(/\/+$/, '');
  if (!cleaned || cleaned === '.' || cleaned === '..' || cleaned.includes('..')) return;
  if (/^(https?:|data:|node_modules|\.git)/i.test(cleaned)) return;
  folderSet.add(cleaned);
}

export function analyzeHiddenLayer(content: string): HiddenLayerReport {
  const findings: HiddenLayerFinding[] = [];
  const seenKeys = new Set<string>();
  const codeBlocks: ParsedCodeBlock[] = [];
  const folderSet = new Set<string>();
  const fileTargetMap = new Map<string, DetectedFileTarget>();

  const pushFinding = (f: Omit<HiddenLayerFinding, 'id'>) => {
    const key = `${f.category}:${f.location || ''}:${f.title}:${f.original || f.snippet || f.detail}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    findings.push({ id: `hl-${findings.length + 1}`, ...f });
  };

  // 1. Parse fenced code blocks line-by-line (detects unclosed fences too)
  const lines = content.split('\n');
  let activeFence: {
    marker: string;
    language: string;
    rawInfo: string;
    startLine: number;
    filename?: string;
    bodyLines: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (!activeFence) {
      if (fenceMatch) {
        const info = normalizeFenceLanguage(fenceMatch[2] || '');
        activeFence = {
          marker: fenceMatch[1].slice(0, 3),
          language: info.language,
          rawInfo: fenceMatch[2].trim(),
          startLine: i + 1,
          filename: info.filename,
          bodyLines: [],
        };
      }
    } else if (
      fenceMatch &&
      line.trim().startsWith(activeFence.marker) &&
      fenceMatch[2].trim() === ''
    ) {
      const code = activeFence.bodyLines.join('\n');
      const detectedCommentFile = detectFilenameCommentInCode(code);
      codeBlocks.push({
        index: codeBlocks.length + 1,
        language: activeFence.language,
        rawInfo: activeFence.rawInfo,
        startLine: activeFence.startLine,
        code,
        closed: true,
        suggestedFilename: activeFence.filename || detectedCommentFile,
      });
      activeFence = null;
    } else {
      activeFence.bodyLines.push(line);
    }
  }

  if (activeFence) {
    const code = activeFence.bodyLines.join('\n');
    const detectedCommentFile = detectFilenameCommentInCode(code);
    const blockIdx = codeBlocks.length + 1;
    codeBlocks.push({
      index: blockIdx,
      language: activeFence.language,
      rawInfo: activeFence.rawInfo,
      startLine: activeFence.startLine,
      code,
      closed: false,
      suggestedFilename: activeFence.filename || detectedCommentFile,
    });
    pushFinding({
      category: 'syntax',
      severity: 'error',
      title: 'Unclosed fenced code block',
      detail: `Code block #${blockIdx} (${activeFence.language}) opened at line ${activeFence.startLine} is missing closing \`\`\`.`,
      location: `Line ${activeFence.startLine}`,
      snippet: `\`\`\`${activeFence.rawInfo}`,
      codeBlockIndex: blockIdx,
      original: content,
      replacement: `${content.replace(/\s+$/, '')}\n\`\`\``,
    });
  }

  // 2. Analyze each code block for syntax, filenames, typos, and folder commands
  for (const block of codeBlocks) {
    const locPrefix = `Block #${block.index} (${block.language})`;

    if (block.suggestedFilename) {
      const normalized = evaluateFilename(block.suggestedFilename, locPrefix, findings, seenKeys);
      if (normalized && normalized.includes('/')) {
        const folder = normalized.slice(0, normalized.lastIndexOf('/'));
        addFolderAncestors(folder, folderSet);
        fileTargetMap.set(normalized, { path: normalized, folder, codeBlockIndex: block.index });
      } else if (normalized) {
        fileTargetMap.set(normalized, { path: normalized, folder: '', codeBlockIndex: block.index });
      }
    }

    // JSON & Creative Engine Schema Validation
    const isCreativeJsonLang =
      block.language === 'json' ||
      block.language === 'pixelart' ||
      block.language === 'pixel-art' ||
      block.language === 'pixart' ||
      block.language === 'pixels' ||
      block.language === 'stopmotion' ||
      block.language === 'stop-motion' ||
      block.language === 'vector-anim' ||
      block.language === 'bbmodel' ||
      block.language === 'blockbench' ||
      block.language === 'threejs' ||
      block.language === 'chart' ||
      block.language === 'charts' ||
      block.language === 'quiz';

    if (isCreativeJsonLang && (block.code.trim().startsWith('{') || block.code.trim().startsWith('['))) {
      try {
        const parsedObj = JSON.parse(block.code) as Record<string, unknown>;

        if (parsedObj && typeof parsedObj === 'object' && !Array.isArray(parsedObj)) {
          // Pixel Art v1/v2 validation
          if (
            block.language.startsWith('pixel') ||
            parsedObj.format === 'pixelart/v2' ||
            ('palette' in parsedObj && ('frames' in parsedObj || 'pixels' in parsedObj || 'draw' in parsedObj))
          ) {
            const w = typeof parsedObj.width === 'number' ? parsedObj.width : 0;
            const h = typeof parsedObj.height === 'number' ? parsedObj.height : 0;
            if (w > 256 || h > 256) {
              pushFinding({
                category: 'syntax',
                severity: 'warning',
                title: `Pixel canvas exceeds 256×256 (${w}×${h})`,
                detail: 'Dimensions above 256×256 will be clamped by the Pixel Engine.',
                location: locPrefix,
                codeBlockIndex: block.index,
              });
            }
            if (Array.isArray(parsedObj.frames) && parsedObj.palette && typeof parsedObj.palette === 'object') {
              const paletteKeys = new Set(Object.keys(parsedObj.palette as Record<string, unknown>));
              paletteKeys.add('.');
              paletteKeys.add(' ');
              const firstFrame = parsedObj.frames[0];
              if (Array.isArray(firstFrame) && firstFrame.length > 0 && typeof firstFrame[0] === 'string') {
                const rowWidths = new Set(firstFrame.map((r) => (typeof r === 'string' && !/^\d+/.test(r) ? r.length : w)));
                if (rowWidths.size > 1 && !String(firstFrame[0]).match(/\d+[a-zA-Z.#]/)) {
                  pushFinding({
                    category: 'syntax',
                    severity: 'warning',
                    title: 'Pixel Art uneven row lengths',
                    detail: `Rows in frame 1 have inconsistent widths (${Array.from(rowWidths).join(', ')}).`,
                    location: locPrefix,
                    codeBlockIndex: block.index,
                  });
                }
              }
            }
          }

          // StopMotion v2 / Math curve validation
          if (
            block.language.includes('stopmotion') ||
            block.language === 'vector-anim' ||
            parsedObj.format === 'stopmotion/v2' ||
            Array.isArray(parsedObj.layers)
          ) {
            if (Array.isArray(parsedObj.layers)) {
              for (const layer of parsedObj.layers) {
                if (layer && typeof layer === 'object') {
                  const lObj = layer as Record<string, unknown>;
                  if (typeof lObj.svg === 'string') {
                    const openSvgTags = (lObj.svg.match(/<(g|path|circle|rect|ellipse|polygon|polyline)\b/gi) || []).length;
                    const selfClosing = (lObj.svg.match(/<[^>]*\/>/g) || []).length;
                    const closeG = (lObj.svg.match(/<\/g>/gi) || []).length;
                    const openG = (lObj.svg.match(/<g[\s>]/gi) || []).length;
                    if (openG > closeG) {
                      pushFinding({
                        category: 'syntax',
                        severity: 'error',
                        title: 'Unclosed <g> inside StopMotion layer SVG',
                        detail: `Layer "${String(lObj.id || 'layer')}" opens ${openG} <g> tag(s) but closes ${closeG}.`,
                        location: locPrefix,
                        codeBlockIndex: block.index,
                      });
                    }
                    if (openSvgTags === 0 && selfClosing === 0 && !lObj.curve && !Array.isArray(lObj.children)) {
                      pushFinding({
                        category: 'syntax',
                        severity: 'warning',
                        title: 'Empty or non-SVG StopMotion layer',
                        detail: `Layer "${String(lObj.id || 'layer')}" has no recognizable SVG primitives or curve.`,
                        location: locPrefix,
                        codeBlockIndex: block.index,
                      });
                    }
                  }
                }
              }
            }
          }

          // Blockbench .bbmodel validation
          if (
            block.language === 'bbmodel' ||
            block.language === 'blockbench' ||
            (Array.isArray(parsedObj.elements) && ('outliner' in parsedObj || 'meta' in parsedObj))
          ) {
            const elems = Array.isArray(parsedObj.elements) ? parsedObj.elements : [];
            const missingBounds = elems.filter(
              (el) => !el || typeof el !== 'object' || !Array.isArray((el as Record<string, unknown>).from) || !Array.isArray((el as Record<string, unknown>).to)
            );
            if (missingBounds.length > 0) {
              pushFinding({
                category: 'syntax',
                severity: 'error',
                title: 'Blockbench element missing from/to coordinates',
                detail: `${missingBounds.length} element(s) lack valid 3D "from"/"to" bounds.`,
                location: locPrefix,
                codeBlockIndex: block.index,
              });
            }
          }

          // Chart schema validation
          if (block.language === 'chart' || block.language === 'charts') {
            const sArr = Array.isArray(parsedObj.series)
              ? parsedObj.series
              : Array.isArray(parsedObj.datasets)
              ? parsedObj.datasets
              : [];
            if (sArr.length === 0) {
              pushFinding({
                category: 'syntax',
                severity: 'error',
                title: 'Chart missing "series" array',
                detail: 'Provide a non-empty "series" array with { name, data: [...] }.',
                location: locPrefix,
                codeBlockIndex: block.index,
              });
            }
          }

          // Quiz schema validation
          if (block.language === 'quiz') {
            const qs = Array.isArray(parsedObj.questions) ? parsedObj.questions : [];
            if (qs.length === 0) {
              pushFinding({
                category: 'syntax',
                severity: 'error',
                title: 'Quiz missing "questions" array',
                detail: 'Provide at least one question with options and correctIndex.',
                location: locPrefix,
                codeBlockIndex: block.index,
              });
            } else {
              qs.forEach((q, qIdx) => {
                if (q && typeof q === 'object') {
                  const qo = q as Record<string, unknown>;
                  const opts = Array.isArray(qo.options) ? qo.options : [];
                  const ci = typeof qo.correctIndex === 'number' ? qo.correctIndex : -1;
                  if (ci < 0 || ci >= opts.length) {
                    pushFinding({
                      category: 'syntax',
                      severity: 'error',
                      title: `Quiz Q${qIdx + 1} invalid correctIndex`,
                      detail: `correctIndex (${ci}) is out of bounds for ${opts.length} options.`,
                      location: locPrefix,
                      codeBlockIndex: block.index,
                    });
                  }
                }
              });
            }
          }
        }
      } catch (err) {
        const hasTrailingComma = /,\s*[}\]]/.test(block.code);
        const fixedJson = hasTrailingComma ? block.code.replace(/,(\s*[}\]])/g, '$1') : undefined;
        pushFinding({
          category: 'syntax',
          severity: 'error',
          title: `Invalid ${block.language.toUpperCase()} JSON syntax`,
          detail: err instanceof Error ? err.message : 'Unable to parse JSON.',
          location: locPrefix,
          snippet: block.code.slice(0, 90),
          codeBlockIndex: block.index,
          ...(fixedJson ? { original: block.code, replacement: fixedJson } : {}),
        });
      }
    }

    // Bracket/string balance
    const delimIssues = checkBalancedDelimiters(block.code, block.language);
    for (const iss of delimIssues) {
      pushFinding({
        category: 'syntax',
        severity: 'error',
        title: 'Broken syntax / delimiter mismatch',
        detail: iss.message,
        location: `${locPrefix} · line ${iss.line}`,
        snippet: iss.snippet,
        codeBlockIndex: block.index,
      });
    }

    // Python syntax
    if (block.language === 'py' || block.language === 'python' || block.language === 'python3') {
      for (const pyIss of checkPythonSyntax(block.code)) {
        pushFinding({
          category: 'syntax',
          severity: pyIss.severity,
          title: 'Python syntax issue',
          detail: pyIss.message,
          location: `${locPrefix} · line ${pyIss.line}`,
          snippet: pyIss.snippet,
          codeBlockIndex: block.index,
        });
      }
    }

    // HTML / SVG tags
    if (block.language === 'html' || block.language === 'htm' || block.language === 'svg' || block.language === 'xml') {
      for (const htmlIss of checkHtmlTagSyntax(block.code)) {
        pushFinding({
          category: 'syntax',
          severity: htmlIss.severity,
          title: 'HTML/markup structure issue',
          detail: htmlIss.message,
          location: `${locPrefix}`,
          snippet: htmlIss.snippet,
          codeBlockIndex: block.index,
        });
      }
    }

    // Truncated code ellipsis check
    const blockLines = block.code.split('\n');
    for (let li = 0; li < blockLines.length; li += 1) {
      const trimmedLine = blockLines[li].trim();
      if (
        trimmedLine === '...' ||
        /^(\/\/|#|\*)\s*\.\.\.\s*(rest|remaining|existing|other|same|more)/i.test(trimmedLine)
      ) {
        pushFinding({
          category: 'syntax',
          severity: 'warning',
          title: 'Truncated placeholder in code',
          detail: 'Code block contains an ellipsis/placeholder ("...") instead of full runnable implementation.',
          location: `${locPrefix} · line ${li + 1}`,
          snippet: trimmedLine,
          codeBlockIndex: block.index,
        });
        break;
      }
    }

    // Typos inside code blocks
    for (const rule of TYPO_RULES) {
      const rx = new RegExp(rule.pattern.source, rule.pattern.flags);
      const match = rx.exec(block.code);
      if (match) {
        const matchedText = match[0];
        const rightText =
          rule.pattern.source.includes('vite\\.confg')
            ? matchedText.replace('vite.confg', 'vite.config')
            : rule.pattern.source.includes('\\.json')
            ? rule.right
            : rule.pattern.source.includes('\\.html')
            ? rule.right
            : rule.pattern.source.includes('\\.md')
            ? rule.right
            : rule.right;
        pushFinding({
          category: 'typos',
          severity: 'warning',
          title: `Typo "${matchedText}" → "${rightText}"`,
          detail: rule.note || `Possible typo in code: "${matchedText}" should likely be "${rightText}".`,
          location: locPrefix,
          snippet: matchedText,
          original: matchedText,
          replacement: rightText,
          codeBlockIndex: block.index,
        });
      }
    }

    // Extract import / src / href / mkdir / os.makedirs / fs.mkdir inside code
    const mkdirCmds = block.code.matchAll(/(?:^|\s)mkdir(?:\s+-p)?\s+([^\n;&|]+)/gm);
    for (const m of mkdirCmds) {
      for (const token of m[1].trim().split(/\s+/)) {
        const clean = token.replace(/^["']|["']$/g, '');
        if (clean && !clean.startsWith('-')) {
          addFolderAncestors(clean, folderSet);
        }
      }
    }

    const programmaticMkdir = block.code.matchAll(
      /(?:os\.makedirs|os\.mkdir|fs\.mkdirSync|fs\.promises\.mkdir|mkdirSync)\(\s*['"`]([^'"`]+)['"`]/g
    );
    for (const m of programmaticMkdir) {
      addFolderAncestors(m[1], folderSet);
    }

    const pathLiterals = block.code.matchAll(
      /(?:from\s+|import\s+|require\(|src=|href=)\s*['"]([^'"]+\.[a-zA-Z0-9]{1,8})['"]/g
    );
    for (const m of pathLiterals) {
      const candidate = m[1];
      if (!candidate.startsWith('http') && !candidate.startsWith('data:')) {
        evaluateFilename(candidate, locPrefix, findings, seenKeys);
      }
    }
  }

  // 3. Scan inline backticks & prose for broken filenames, typos, and folder creation commands
  const inlineCodeMatches = content.matchAll(/`([^`\n]{2,180})`/g);
  for (const m of inlineCodeMatches) {
    const token = m[1].trim();
    // Check if looks like a file path or filename
    if (
      /[./\\]/.test(token) &&
      !/^(https?:|npm |npx |git |curl |python |node )/.test(token) &&
      !token.includes('=')
    ) {
      const normalized = evaluateFilename(token, 'Inline path', findings, seenKeys);
      if (normalized && normalized.includes('/') && /\.[a-zA-Z0-9]{1,8}$/.test(normalized)) {
        const folder = normalized.slice(0, normalized.lastIndexOf('/'));
        addFolderAncestors(folder, folderSet);
        if (!fileTargetMap.has(normalized)) {
          fileTargetMap.set(normalized, { path: normalized, folder });
        }
      } else if (token.endsWith('/') && token.length > 1) {
        addFolderAncestors(token, folderSet);
      }
    }

    // Inline typos
    for (const rule of TYPO_RULES) {
      const rx = new RegExp(rule.pattern.source, rule.pattern.flags);
      const tm = rx.exec(token);
      if (tm) {
        const matchedText = tm[0];
        const rightText = rule.pattern.source.includes('vite\\.confg')
          ? matchedText.replace('vite.confg', 'vite.config')
          : rule.right;
        pushFinding({
          category: 'typos',
          severity: 'warning',
          title: `Typo "${matchedText}" → "${rightText}"`,
          detail: rule.note || `Detected typo "${matchedText}" inside inline code.`,
          location: 'Inline code',
          snippet: matchedText,
          original: matchedText,
          replacement: rightText,
        });
      }
    }
  }

  // Global anywhere-scope typos in plain text outside fenced blocks and inline code
  const proseWithoutCode = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ');

  for (const rule of TYPO_RULES) {
    if (rule.scope !== 'anywhere') continue;
    const rx = new RegExp(rule.pattern.source, rule.pattern.flags);
    const tm = rx.exec(proseWithoutCode);
    if (tm) {
      const matchedText = tm[0];
      const rightText = rule.pattern.source.includes('vite\\.confg')
        ? matchedText.replace('vite.confg', 'vite.config')
        : rule.right;
      pushFinding({
        category: 'typos',
        severity: 'warning',
        title: `Typo "${matchedText}" → "${rightText}"`,
        detail: rule.note || `Detected typo "${matchedText}".`,
        location: 'Message text',
        snippet: matchedText,
        original: matchedText,
        replacement: rightText,
      });
    }
  }

  // 4. Scan ASCII tree diagrams & shell mkdir commands in prose
  const proseMkdir = content.matchAll(/(?:^|\s)mkdir(?:\s+-p)?\s+([^\n`;&|]+)/gm);
  for (const m of proseMkdir) {
    for (const token of m[1].trim().split(/\s+/)) {
      const clean = token.replace(/^["']|["']$/g, '');
      if (clean && !clean.startsWith('-')) {
        addFolderAncestors(clean, folderSet);
      }
    }
  }

  const treeStack: Array<{ depth: number; name: string }> = [];
  for (const line of lines) {
    const treeMatch = /^([│\s]*)(?:├──|└──|\|--|\+--)\s+([^\s#]+)\/?/.exec(line);
    if (treeMatch) {
      const depth = treeMatch[1].length;
      const rawEntry = treeMatch[2].trim();
      const isDir = line.trimEnd().endsWith('/') || !/\.[a-zA-Z0-9]{1,8}$/.test(rawEntry);
      while (treeStack.length > 0 && treeStack[treeStack.length - 1].depth >= depth) {
        treeStack.pop();
      }
      const cleanEntry = rawEntry.replace(/\/+$/, '');
      if (!cleanEntry) continue;
      const fullPath = [...treeStack.map((t) => t.name), cleanEntry].join('/');
      if (isDir) {
        treeStack.push({ depth, name: cleanEntry });
        addFolderAncestors(fullPath, folderSet);
      } else {
        evaluateFilename(fullPath, 'Folder tree', findings, seenKeys);
        const folder = fullPath.includes('/') ? fullPath.slice(0, fullPath.lastIndexOf('/')) : '';
        if (folder) addFolderAncestors(folder, folderSet);
        if (!fileTargetMap.has(fullPath)) {
          fileTargetMap.set(fullPath, { path: fullPath, folder });
        }
      }
    }
  }

  const folders = Array.from(folderSet).sort((a, b) => a.localeCompare(b));
  for (const folder of folders) {
    pushFinding({
      category: 'folders',
      severity: 'info',
      title: `Folder: ${folder}/`,
      detail: 'Detected folder structure ready to create in your active project workspace.',
      location: 'Folder layout',
      folderPath: folder,
    });
  }

  const fileTargets = Array.from(fileTargetMap.values());

  const counts = {
    all: findings.length,
    syntax: findings.filter((f) => f.category === 'syntax').length,
    filenames: findings.filter((f) => f.category === 'filenames').length,
    typos: findings.filter((f) => f.category === 'typos').length,
    folders: findings.filter((f) => f.category === 'folders').length,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    fixable: findings.filter((f) => Boolean(f.original && f.replacement !== undefined)).length,
  };

  return {
    findings,
    codeBlocks,
    folders,
    fileTargets,
    counts,
  };
}

export function applyHiddenLayerFix(content: string, finding: HiddenLayerFinding): string {
  if (!finding.original || finding.replacement === undefined) return content;
  if (finding.original === content) {
    return finding.replacement;
  }
  return content.split(finding.original).join(finding.replacement);
}

export function applyAllSafeFixes(content: string, findings: HiddenLayerFinding[]): string {
  let next = content;
  for (const f of findings) {
    if (f.original && f.replacement !== undefined && f.original !== content) {
      next = next.split(f.original).join(f.replacement);
    }
  }
  for (const f of findings) {
    if (f.original === content && f.replacement !== undefined && !next.trimEnd().endsWith('```')) {
      next = `${next.replace(/\s+$/, '')}\n\`\`\``;
    }
  }
  return next;
}
