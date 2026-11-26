export type MathAudioPresetName =
  | 'chime'
  | 'clockwork'
  | 'subbass'
  | 'synthlead'
  | 'ambient'
  | 'ambient_chime'
  | 'sci_fi_arp'
  | 'cyberpunk_arp'
  | 'retro_8bit'
  | 'crystal_bells'
  | 'deep_drone'
  | 'arcade_jump'
  | 'laser_pulse'
  | 'rain_noise'
  | 'heartbeat'
  | 'lofi_chord'
  | 'quantum_pad'
  | 'warp_riser'
  | 'marimba'
  | 'orchestral_brass';

export interface MathAudioTrackSpec {
  mode?: 'math' | 'preset';
  formula?: string;
  preset?: MathAudioPresetName | string;
  durationSec?: number;
  sampleRate?: number;
  gain?: number;
}

export const MATH_AUDIO_PRESETS: Record<
  string,
  { label: string; formula: string; description: string }
> = {
  chime: {
    label: 'Harmonic Crystal Chime',
    formula:
      '(sin(TAU * 523.25 * t) * 0.55 + sin(TAU * 659.25 * t) * 0.35 + sin(TAU * 783.99 * t) * 0.25) * exp(-mod(t, 1.0) * 3.8)',
    description: 'C major triad bell overtones with exponential decay.',
  },
  ambient_chime: {
    label: 'Ambient Studio Chime',
    formula:
      '(sin(TAU * 440 * t) * 0.4 + sin(TAU * 554.37 * t) * 0.3 + sin(TAU * 659.25 * t) * 0.25 + sin(TAU * 880 * t) * 0.15) * exp(-mod(t, 1.5) * 2.4) * (0.7 + 0.3 * sin(TAU * 0.5 * t))',
    description: 'Shimmering A-major ambient bell chime.',
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
  sci_fi_arp: {
    label: 'Sci-Fi Hyper Arpeggio',
    formula:
      'fm(220 * pow(2, floor(mod(t * 6, 6)) * 2 / 12), 110, 1.4, t) * adsr(mod(t, 0.166), 0.166, 0.01, 0.06, 0.45, 0.05)',
    description: 'Futuristic FM harmonic sequence for 3D & cyberpunk scenes.',
  },
  cyberpunk_arp: {
    label: 'Cyberpunk Neon Bassline',
    formula:
      'softclip(saw(55 * (1 + floor(mod(t * 4, 4)) * 0.25) * t) * 0.9 + square(110 * t, 0.35) * 0.35, 1.8) * envexp(mod(t, 0.25), 7)',
    description: 'Saturated neon synthwave arpeggio bass.',
  },
  retro_8bit: {
    label: '8-Bit Chiptune Lead',
    formula:
      'bitcrush(square((261.63 * pow(2, floor(mod(t * 8, 5)) / 12)) * t, 0.25), 4) * adsr(mod(t, 0.125), 0.125, 0.005, 0.04, 0.5, 0.03)',
    description: 'Classic quantized 8-bit square pulse melody.',
  },
  crystal_bells: {
    label: 'FM Crystal Bells',
    formula:
      'fm(587.33, 1468.3, 2.2 * exp(-mod(t, 1.2) * 3), t) * exp(-mod(t, 1.2) * 2.8) * 0.7',
    description: 'Glassy inharmonic FM bell chimes.',
  },
  deep_drone: {
    label: 'Obsidian Void Drone',
    formula:
      'softclip(chord3(t, 55, 82.41, 110.25) * (0.6 + 0.4 * lfo(t, 0.25)), 1.5) * 0.5',
    description: 'Rich sub-harmonic cinematic drone.',
  },
  arcade_jump: {
    label: 'Arcade Kinetic Bounce',
    formula:
      'square((180 + 480 * clamp01(mod(t, 0.6) * 2.5)) * t, 0.5) * envexp(mod(t, 0.6), 6)',
    description: 'Upward pitch-sweep kinetic impact SFX.',
  },
  laser_pulse: {
    label: 'Photon Laser Sweep',
    formula:
      'sin(TAU * (920 * exp(-mod(t, 0.5) * 8) + 90) * t) * envexp(mod(t, 0.5), 5.5)',
    description: 'Exponential downward frequency sweep sci-fi laser.',
  },
  rain_noise: {
    label: 'Atmospheric Rain Wash',
    formula:
      '(pink(t * 1400) * 0.55 + white(t * 3200) * 0.18) * (0.75 + 0.25 * lfo(t, 0.35))',
    description: 'Filtered pink/white rainfall ambience.',
  },
  heartbeat: {
    label: 'Sub Heartbeat Pulse',
    formula:
      'sin(TAU * 52 * t) * (envexp(mod(t, 1.0), 14) + 0.7 * envexp(mod(t + 0.78, 1.0), 16))',
    description: 'Double-thump organic rhythmic pulse.',
  },
  lofi_chord: {
    label: 'Lo-Fi Warm Electric Chord',
    formula:
      'softclip(chord4(t, 261.63, 311.13, 392.0, 466.16) * (0.85 + 0.15 * vibrato(t, 4.5, 0.02)), 1.2) * (0.5 + 0.5 * exp(-mod(t, 2.0) * 1.4))',
    description: 'Warm minor-7th chord progression with tape wobble.',
  },
  quantum_pad: {
    label: 'Quantum Shimmer Pad',
    formula:
      '(chorus(t, 220, 0.008) + 0.5 * chorus(t, 329.63, 0.012)) * 0.45 * (0.65 + 0.35 * sin(TAU * 0.2 * t))',
    description: 'Detuned multi-voice shimmer pad.',
  },
  warp_riser: {
    label: 'Hyperspace Warp Riser',
    formula:
      'fm(110 + 660 * (t / max(0.5, dur)), 55, 2.5, t) * clamp01(t / max(0.5, dur)) * 0.7',
    description: 'Continuous pitch-climbing warp riser.',
  },
  marimba: {
    label: 'Tactile Wooden Marimba',
    formula:
      '(sin(TAU * 392 * t) * 0.7 + sin(TAU * 1568 * t) * 0.2 * exp(-mod(t, 0.4) * 28)) * exp(-mod(t, 0.4) * 9)',
    description: 'Percussive woody fourth-harmonic mallet tone.',
  },
  orchestral_brass: {
    label: 'Brass Fanfare Swell',
    formula:
      'softclip((saw(146.83 * t) * 0.5 + saw(220 * t) * 0.35 + saw(293.66 * t) * 0.3) * smoothstep(mod(t, 2.0), 0, 0.35), 1.6) * 0.6',
    description: 'Warm brass fifth harmonic swell.',
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
          case 'clamp01':
            return Math.max(0, Math.min(1, x));
          case 'step':
            return y < x ? 0 : 1;
          case 'smoothstep': {
            const u = Math.max(0, Math.min(1, (x - y) / ((z || 1) - y || 1)));
            return u * u * (3 - 2 * u);
          }
          case 'fract':
            return x - Math.floor(x);
          case 'sign':
            return Math.sign(x);
          case 'lerp':
          case 'mix':
            return x + (y - x) * z;
          case 'mod':
            return y === 0 ? 0 : ((x % y) + y) % y;
          case 'saw':
          case 'sawtooth': {
            const p = ((x % 1) + 1) % 1;
            return p * 2 - 1;
          }
          case 'tri':
          case 'triangle': {
            const p = ((x % 1) + 1) % 1;
            return 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25));
          }
          case 'square':
          case 'pulse': {
            const p = ((x % 1) + 1) % 1;
            return p < (a[1] ?? 0.5) ? 1 : -1;
          }
          case 'noise':
          case 'white': {
            const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
            return (s - Math.floor(s)) * 2 - 1;
          }
          case 'pink': {
            const s1 = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
            const s2 = Math.sin(x * 0.5 * 39.346 + 11.135) * 24634.6345;
            const s3 = Math.sin(x * 0.25 * 73.156 + 52.235) * 19384.2341;
            return (((s1 - Math.floor(s1)) + (s2 - Math.floor(s2)) + (s3 - Math.floor(s3))) / 3) * 2 - 1;
          }
          case 'lfo':
            return 0.5 + 0.5 * Math.sin(Math.PI * 2 * (y || 1) * x + z);
          case 'fm':
          case 'pm': {
            const car = x || 220;
            const modF = y || 110;
            const idx = a[2] ?? 1.2;
            const tv = a[3] ?? t;
            return Math.sin(Math.PI * 2 * car * tv + idx * Math.sin(Math.PI * 2 * modF * tv));
          }
          case 'ringmod':
            return Math.sin(Math.PI * 2 * x * t) * Math.sin(Math.PI * 2 * (y || 110) * t);
          case 'bitcrush': {
            const bits = Math.max(1, Math.min(16, Math.round(y || 4)));
            const levels = Math.pow(2, bits);
            return Math.round(x * levels) / levels;
          }
          case 'fold': {
            const g = y || 2;
            return Math.sin(x * g * Math.PI * 0.5);
          }
          case 'softclip':
            return Math.tanh(x * (y || 1.5));
          case 'hardclip':
            return Math.max(-(y || 1), Math.min(y || 1, x));
          case 'midi2hz':
            return 440 * Math.pow(2, (x - 69) / 12);
          case 'chord3':
            return (Math.sin(Math.PI * 2 * y * x) + Math.sin(Math.PI * 2 * z * x) + Math.sin(Math.PI * 2 * (a[3] ?? z * 1.25) * x)) / 3;
          case 'chord4':
            return (
              Math.sin(Math.PI * 2 * y * x) +
              Math.sin(Math.PI * 2 * z * x) +
              Math.sin(Math.PI * 2 * (a[3] ?? z * 1.25) * x) +
              Math.sin(Math.PI * 2 * (a[4] ?? z * 1.5) * x)
            ) / 4;
          case 'chorus': {
            const freq = y || 220;
            const detune = z || 0.01;
            return (
              Math.sin(Math.PI * 2 * freq * x) +
              Math.sin(Math.PI * 2 * freq * (1 + detune) * x) +
              Math.sin(Math.PI * 2 * freq * (1 - detune) * x)
            ) / 3;
          }
          case 'vibrato':
            return Math.sin(Math.PI * 2 * (y || 5) * x) * (z || 0.05);
          case 'tremolo':
            return 1 - (z || 0.4) * (0.5 + 0.5 * Math.sin(Math.PI * 2 * (y || 4) * x));
          case 'envexp':
            return Math.exp(-Math.max(0, x) * (y || 5));
          case 'ramp':
            return Math.max(0, Math.min(1, x / Math.max(1e-4, y || 1)));
          case 'gate':
            return x >= y && x <= (z || y + 0.1) ? 1 : 0;
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
