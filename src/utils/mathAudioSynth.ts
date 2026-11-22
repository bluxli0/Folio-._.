export interface MathAudioTrackSpec {
  mode?: 'math' | 'preset';
  formula?: string;
  preset?: 'chime' | 'clockwork' | 'subbass' | 'synthlead' | 'ambient';
  durationSec?: number;
  sampleRate?: number;
  gain?: number;
}

export const MATH_AUDIO_PRESETS: Record<
  NonNullable<MathAudioTrackSpec['preset']>,
  { label: string; formula: string; description: string }
> = {
  chime: {
    label: 'Harmonic Crystal Chime',
    formula:
      '(sin(TAU * 523.25 * t) * 0.55 + sin(TAU * 659.25 * t) * 0.35 + sin(TAU * 783.99 * t) * 0.25) * exp(-mod(t, 1.0) * 3.8)',
    description: 'C major triad bell overtones with exponential decay.',
  },
  clockwork: {
    label: 'Mechanical Clockwork Tick',
    formula:
      'sin(TAU * 1200 * mod(t, 0.5)) * exp(-mod(t, 0.5) * 48) * 0.65 + sin(TAU * 180 * mod(t + 0.25, 0.5)) * exp(-mod(t + 0.25, 0.5) * 38) * 0.45',
    description: 'Crisp pendulum escapement ticks + gear resonance.',
  },
  subbass: {
    label: 'Hypersaw & Sub Pulse',
    formula:
      'tanh(sin(TAU * 55 * t) * 1.8 + sin(TAU * 110 * t) * 0.6) * (0.4 + 0.6 * abs(sin(PI * t * 2)))',
    description: 'Soft-clipped hyperbolic tangent bass pulse.',
  },
  synthlead: {
    label: 'FM Cosine Arpeggio',
    formula:
      'sin(TAU * (220 * pow(2, floor(mod(t * 4, 4)) / 12)) * t + 1.8 * cos(TAU * 110 * t)) * adsr(mod(t, 0.25), 0.25, 0.02, 0.08, 0.5, 0.08)',
    description: 'FM phase-modulated step arpeggiator with ADSR shaping.',
  },
  ambient: {
    label: 'Celestial Pad Drift',
    formula:
      '(sin(TAU * 220 * t + sin(TAU * 0.4 * t) * 0.5) + cos(TAU * 277.18 * t) * 0.7 + sin(TAU * 329.63 * t) * 0.6) * 0.28 * (0.65 + 0.35 * sin(TAU * 0.25 * t))',
    description: 'Smooth detuned harmonic pad.',
  },
};

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i += 1;
      while (i < expr.length && /[0-9.eE]/.test(expr[i])) {
        if ((expr[i] === 'e' || expr[i] === 'E') && (expr[i + 1] === '+' || expr[i + 1] === '-')) {
          num += expr[i] + expr[i + 1];
          i += 2;
        } else {
          num += expr[i];
          i += 1;
        }
      }
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = ch;
      i += 1;
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i];
        i += 1;
      }
      tokens.push(id);
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '==' || two === '!=' || two === '**') {
      tokens.push(two);
      i += 2;
      continue;
    }
    tokens.push(ch);
    i += 1;
  }
  return tokens;
}

type AstNode =
  | { type: 'num'; v: number }
  | { type: 'var'; name: string }
  | { type: 'unary'; op: string; arg: AstNode }
  | { type: 'bin'; op: string; l: AstNode; r: AstNode }
  | { type: 'tern'; c: AstNode; a: AstNode; b: AstNode }
  | { type: 'call'; fn: string; args: AstNode[] };

export function compileAudioFormulaAst(rawFormula: string): (t: number, dur: number, sr: number) => number {
  const tokens = tokenize(rawFormula || '0');
  let pos = 0;
  const peek = () => tokens[pos] || '';
  const consume = () => tokens[pos++] || '';

  function parseTernary(): AstNode {
    const cond = parseCompare();
    if (peek() === '?') {
      consume();
      const a = parseTernary();
      if (peek() === ':') consume();
      const b = parseTernary();
      return { type: 'tern', c: cond, a, b };
    }
    return cond;
  }

  function parseCompare(): AstNode {
    let left = parseAdd();
    while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) {
      const op = consume();
      left = { type: 'bin', op, l: left, r: parseAdd() };
    }
    return left;
  }

  function parseAdd(): AstNode {
    let left = parseMul();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      left = { type: 'bin', op, l: left, r: parseMul() };
    }
    return left;
  }

  function parseMul(): AstNode {
    let left = parsePow();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      left = { type: 'bin', op, l: left, r: parsePow() };
    }
    return left;
  }

  function parsePow(): AstNode {
    const base = parseUnary();
    if (peek() === '^' || peek() === '**') {
      consume();
      return { type: 'bin', op: '^', l: base, r: parsePow() };
    }
    return base;
  }

  function parseUnary(): AstNode {
    if (peek() === '-' || peek() === '+' || peek() === '!') {
      const op = consume();
      return { type: 'unary', op, arg: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary(): AstNode {
    const tok = peek();
    if (!tok) return { type: 'num', v: 0 };
    if (tok === '(') {
      consume();
      const inner = parseTernary();
      if (peek() === ')') consume();
      return inner;
    }
    if (/^[0-9.]/.test(tok)) {
      consume();
      const n = Number(tok);
      return { type: 'num', v: Number.isFinite(n) ? n : 0 };
    }
    if (/^[a-zA-Z_]/.test(tok)) {
      const name = consume();
      if (peek() === '(') {
        consume();
        const args: AstNode[] = [];
        while (peek() && peek() !== ')') {
          args.push(parseTernary());
          if (peek() === ',') consume();
          else break;
        }
        if (peek() === ')') consume();
        return { type: 'call', fn: name, args };
      }
      return { type: 'var', name };
    }
    consume();
    return { type: 'num', v: 0 };
  }

  let ast: AstNode = { type: 'num', v: 0 };
  try {
    ast = parseTernary();
  } catch {
    ast = { type: 'num', v: 0 };
  }

  const evalNode = (node: AstNode, t: number, dur: number, sr: number): number => {
    switch (node.type) {
      case 'num':
        return node.v;
      case 'var': {
        switch (node.name) {
          case 't':
            return t;
          case 'dur':
          case 'duration':
            return dur;
          case 'sr':
            return sr;
          case 'PI':
          case 'pi':
            return Math.PI;
          case 'TAU':
          case 'tau':
            return Math.PI * 2;
          case 'E':
          case 'e':
            return Math.E;
          default:
            return 0;
        }
      }
      case 'unary': {
        const v = evalNode(node.arg, t, dur, sr);
        if (node.op === '-') return -v;
        if (node.op === '!') return v ? 0 : 1;
        return v;
      }
      case 'tern':
        return evalNode(node.c, t, dur, sr)
          ? evalNode(node.a, t, dur, sr)
          : evalNode(node.b, t, dur, sr);
      case 'bin': {
        const l = evalNode(node.l, t, dur, sr);
        const r = evalNode(node.r, t, dur, sr);
        switch (node.op) {
          case '+':
            return l + r;
          case '-':
            return l - r;
          case '*':
            return l * r;
          case '/':
            return r === 0 ? 0 : l / r;
          case '%':
            return r === 0 ? 0 : ((l % r) + r) % r;
          case '^':
            return Math.pow(l, r);
          case '<':
            return l < r ? 1 : 0;
          case '>':
            return l > r ? 1 : 0;
          case '<=':
            return l <= r ? 1 : 0;
          case '>=':
            return l >= r ? 1 : 0;
          case '==':
            return Math.abs(l - r) < 1e-9 ? 1 : 0;
          case '!=':
            return Math.abs(l - r) >= 1e-9 ? 1 : 0;
          default:
            return 0;
        }
      }
      case 'call': {
        const a = node.args.map((arg) => evalNode(arg, t, dur, sr));
        const x = a[0] ?? 0;
        const y = a[1] ?? 0;
        const z = a[2] ?? 0;
        switch (node.fn) {
          case 'sin':
            return Math.sin(x);
          case 'cos':
            return Math.cos(x);
          case 'tan':
            return Math.max(-4, Math.min(4, Math.tan(x)));
          case 'sinh':
            return Math.sinh(Math.max(-6, Math.min(6, x)));
          case 'cosh':
            return Math.cosh(Math.max(-6, Math.min(6, x)));
          case 'tanh':
            return Math.tanh(x);
          case 'hyp':
          case 'hypot':
            return Math.hypot(x, y);
          case 'abs':
            return Math.abs(x);
          case 'sqrt':
            return Math.sqrt(Math.max(0, x));
          case 'pow':
            return Math.pow(x, y);
          case 'exp':
            return Math.exp(Math.max(-30, Math.min(10, x)));
          case 'log':
            return Math.log(Math.max(1e-6, x));
          case 'floor':
            return Math.floor(x);
          case 'ceil':
            return Math.ceil(x);
          case 'round':
            return Math.round(x);
          case 'min':
            return Math.min(...a);
          case 'max':
            return Math.max(...a);
          case 'clamp':
            return Math.max(y, Math.min(z, x));
          case 'lerp':
          case 'mix':
            return x + (y - x) * z;
          case 'mod':
            return y === 0 ? 0 : ((x % y) + y) % y;
          case 'saw': {
            const p = ((x % 1) + 1) % 1;
            return p * 2 - 1;
          }
          case 'tri': {
            const p = ((x % 1) + 1) % 1;
            return 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25));
          }
          case 'square': {
            const p = ((x % 1) + 1) % 1;
            return p < (a[1] ?? 0.5) ? 1 : -1;
          }
          case 'noise': {
            const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
            return (s - Math.floor(s)) * 2 - 1;
          }
          case 'adsr': {
            const localT = x;
            const totalDur = Math.max(0.01, y || 1);
            const atk = a[2] ?? 0.02;
            const dec = a[3] ?? 0.1;
            const sus = a[4] ?? 0.6;
            const rel = a[5] ?? 0.15;
            if (localT < 0 || localT > totalDur) return 0;
            if (localT < atk) return atk > 0 ? localT / atk : 1;
            if (localT < atk + dec) {
              const dt = (localT - atk) / Math.max(1e-4, dec);
              return 1 + (sus - 1) * dt;
            }
            if (localT > totalDur - rel) {
              return sus * Math.max(0, (totalDur - localT) / Math.max(1e-4, rel));
            }
            return sus;
          }
          default:
            return 0;
        }
      }
    }
  };

  return (t: number, dur: number, sr: number) => {
    const val = evalNode(ast, t, dur, sr);
    if (!Number.isFinite(val)) return 0;
    return Math.max(-1, Math.min(1, val));
  };
}

export function synthesizeMathAudioSamples(spec: MathAudioTrackSpec): {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
} {
  const sampleRate = Math.max(8000, Math.min(48000, spec.sampleRate || 22050));
  const durationSec = Math.max(0.2, Math.min(600, spec.durationSec || 3));
  const formula =
    spec.formula?.trim() ||
    (spec.preset && MATH_AUDIO_PRESETS[spec.preset]?.formula) ||
    MATH_AUDIO_PRESETS.chime.formula;
  const gain = typeof spec.gain === 'number' ? Math.max(0.05, Math.min(1.5, spec.gain)) : 0.7;

  const fn = compileAudioFormulaAst(formula);
  const length = Math.max(1, Math.round(sampleRate * durationSec));
  const samples = new Float32Array(length);
  const fadeSamples = Math.min(Math.floor(length * 0.05), Math.floor(sampleRate * 0.02));

  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    let s = fn(t, durationSec, sampleRate) * gain;
    if (i < fadeSamples) {
      s *= i / Math.max(1, fadeSamples);
    } else if (i > length - fadeSamples) {
      s *= (length - i) / Math.max(1, fadeSamples);
    }
    samples[i] = Math.max(-0.98, Math.min(0.98, s));
  }

  return { samples, sampleRate, durationSec };
}

export function encodeFloat32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function synthesizeMathAudioWavBlob(spec: MathAudioTrackSpec): Blob {
  const { samples, sampleRate } = synthesizeMathAudioSamples(spec);
  return encodeFloat32ToWavBlob(samples, sampleRate);
}

export function createAudioBufferFromMathSpec(
  ctx: AudioContext,
  spec: MathAudioTrackSpec
): AudioBuffer {
  const { samples, sampleRate } = synthesizeMathAudioSamples({
    ...spec,
    sampleRate: ctx.sampleRate || 44100,
  });
  const buf = ctx.createBuffer(1, samples.length, sampleRate);
  buf.getChannelData(0).set(samples);
  return buf;
}
