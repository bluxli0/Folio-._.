import { StopMotionDemo, StopMotionFrame } from '../types/stopMotion';
import { svgMarkupToDataUrl, TACTILE_SVG_FILTERS_DEFS } from './vectorBrushes';

function makeVectorFrame(
  svgMarkup: string,
  width: number,
  height: number,
  background: string,
  hold = 1,
  idx = 0
): StopMotionFrame {
  return {
    id: crypto.randomUUID(),
    dataUrl: svgMarkupToDataUrl(svgMarkup, width, height, background),
    svgMarkup,
    background,
    hold,
    createdAt: Date.now() + idx,
  };
}

export const STOP_MOTION_DEMOS: StopMotionDemo[] = [
  // 01. Bouncing Clay Ball (120 Frames) - Procedural dough displacement + Marker trick specular highlights
  {
    id: 'bouncing-clay-ball',
    title: '01. Bouncing Clay Ball (120f)',
    category: 'Physics',
    description: '120-frame gravity bounces with dough displacement map & glossy marker highlight',
    fps: 24,
    pingPong: false,
    background: '#faf8f5',
    buildFrames: (w, h) => {
      const count = 120;
      const floorY = h * 0.8;
      const baseR = Math.min(w, h) * 0.1;
      const bg = '#faf8f5';

      return Array.from({ length: count }, (_, i) => {
        const t = i / count; // 0..1
        // 4 bounces with progressive height decay
        const bounceCount = 4;
        const bouncePhase = (t * bounceCount) % 1; // 0..1 within each bounce
        const bounceIdx = Math.floor(t * bounceCount);
        const decay = Math.pow(0.72, bounceIdx);
        const maxLift = h * 0.44 * decay;

        // Parabolic arc for realistic gravity (fast at bottom, slow at peak)
        const arc = Math.sin(bouncePhase * Math.PI);
        const isImpact = bouncePhase < 0.08 || bouncePhase > 0.92;
        const squash = isImpact ? 0.62 + 0.38 * (1 - decay * 0.8) : 1 + (1 - arc) * 0.12;
        const stretch = 1 / squash;

        const x = w * (0.12 + t * 0.76);
        const y = floorY - baseR * squash - arc * maxLift;
        const shadowScale = (0.35 + 0.65 * (1 - arc)) * decay;
        const shadowAlpha = (0.06 + 0.18 * (1 - arc)) * decay;

        // The Marker Trick: Specular highlight ellipse angle rotates with trajectory
        const hlAngle = -25 + (t * 360) % 90;
        const hx = -baseR * 0.28;
        const hy = -baseR * 0.3;

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Floor line with procedural grain -->
          <line x1="${(w * 0.06).toFixed(1)}" y1="${floorY.toFixed(1)}" x2="${(w * 0.94).toFixed(1)}" y2="${floorY.toFixed(1)}" stroke="#cbd5e1" stroke-width="2" />

          <!-- Dynamic impact shadow -->
          <ellipse cx="${x.toFixed(1)}" cy="${(floorY + 4).toFixed(1)}" rx="${(baseR * 1.25 * shadowScale).toFixed(1)}" ry="${(9 * shadowScale).toFixed(1)}" fill="rgba(15,23,42,${shadowAlpha.toFixed(3)})" />

          <!-- Impact shockwave ripple on heavy impacts -->
          ${
            isImpact && bounceIdx < 2
              ? `<ellipse cx="${x.toFixed(1)}" cy="${(floorY + 4).toFixed(1)}" rx="${(baseR * 1.8 * (1 - bouncePhase)).toFixed(1)}" ry="${(12 * (1 - bouncePhase)).toFixed(1)}" fill="none" stroke="#e2e8f0" stroke-width="1.5" opacity="${(0.6 * decay).toFixed(2)}" />`
              : ''
          }

          <!-- Tactile Clay Dough Ball with SVG displacement map warping -->
          <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${stretch.toFixed(3)} ${squash.toFixed(3)})" filter="url(#tactileDoughWarp)">
            <!-- Base dough body with off-center wet gradient -->
            <circle cx="0" cy="0" r="${baseR.toFixed(1)}" fill="url(#wetGlazePink)" />
            <!-- Inner tactile clay shading -->
            <ellipse cx="${(baseR * 0.15).toFixed(1)}" cy="${(baseR * 0.2).toFixed(1)}" rx="${(baseR * 0.75).toFixed(1)}" ry="${(baseR * 0.7).toFixed(1)}" fill="rgba(136,19,55,0.22)" />
          </g>

          <!-- The Marker Trick: Specular highlight with mix-blend-mode: screen (drawn on top for glossy sheen) -->
          <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${stretch.toFixed(3)} ${squash.toFixed(3)})">
            <ellipse cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" rx="${(baseR * 0.32).toFixed(1)}" ry="${(baseR * 0.18).toFixed(1)}" transform="rotate(${hlAngle.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)})" fill="rgba(255,255,255,0.78)" style="mix-blend-mode: screen;" />
            <circle cx="${(hx + baseR * 0.18).toFixed(1)}" cy="${(hy + baseR * 0.16).toFixed(1)}" r="${(baseR * 0.08).toFixed(1)}" fill="rgba(255,255,255,0.9)" style="mix-blend-mode: screen;" />
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 02. Paper & Plastic Rocket (120 Frames) - Ignition countdown, turbulence smoke plume, warp stars
  {
    id: 'paper-rocket-launch',
    title: '02. Paper & Plastic Rocket (120f)',
    category: 'Sci-Fi',
    description: '120-frame launch sequence with turbulence smoke puffs & glossy cylinder highlight',
    fps: 24,
    pingPong: false,
    background: '#090d16',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#090d16';
      const cx = w * 0.5;

      // 18 procedural background stars
      const stars = Array.from({ length: 22 }, (_, s) => ({
        x: ((s * 47) % 100) / 100,
        y: ((s * 73) % 100) / 100,
        r: (s % 3) * 0.8 + 1.2,
      }));

      return Array.from({ length: count }, (_, i) => {
        const t = i / count;
        // Stages: 0..20: countdown rumble, 21..70: liftoff & smoke, 71..120: deep space warp
        const isCountdown = i < 22;
        const isLiftoff = i >= 22 && i < 75;
        const isSpace = i >= 75;

        const shake = isCountdown ? (i % 2 === 0 ? 3 : -3) : isLiftoff ? (i % 2 === 0 ? 1.5 : -1.5) : 0;
        const lift = isCountdown
          ? 0
          : isLiftoff
          ? Math.pow((i - 22) / 53, 1.8) * (h * 0.65)
          : h * 0.65 + ((i - 75) / 45) * (h * 0.25);

        const ry = h * 0.74 - lift;
        const flameLen = isCountdown ? 8 + (i % 3) * 4 : isLiftoff ? 28 + (i % 4) * 12 : 36 + (i % 2) * 6;

        // Twinkling / warping stars
        const starSvg = stars
          .map((s, idx) => {
            const starY = isSpace ? (s.y + (t * 2 + idx * 0.05)) % 1 : s.y;
            const starLen = isSpace ? 8 + ((i - 75) / 45) * 16 : s.r;
            return isSpace
              ? `<line x1="${(w * s.x).toFixed(1)}" y1="${(h * starY).toFixed(1)}" x2="${(w * s.x).toFixed(1)}" y2="${(h * starY + starLen).toFixed(1)}" stroke="#e2e8f0" stroke-width="${s.r.toFixed(1)}" opacity="${(0.4 + ((i + idx) % 3) * 0.25).toFixed(2)}" />`
              : `<circle cx="${(w * s.x).toFixed(1)}" cy="${(h * s.y).toFixed(1)}" r="${s.r.toFixed(1)}" fill="#e2e8f0" opacity="${(0.35 + ((i + idx) % 2) * 0.45).toFixed(2)}" />`;
          })
          .join('');

        // Billowing turbulent smoke clouds during liftoff
        const smokeSvg = isLiftoff
          ? Array.from({ length: 6 }, (_, sIdx) => {
              const age = (i - 22 + sIdx * 6) % 30;
              const puffR = 12 + age * 2.2;
              const puffX = cx + (sIdx % 2 === 0 ? -1 : 1) * (18 + age * 1.4);
              const puffY = h * 0.78 - age * 0.8;
              const opacity = Math.max(0, 0.7 - age * 0.022);
              return `<circle cx="${puffX.toFixed(1)}" cy="${puffY.toFixed(1)}" r="${puffR.toFixed(1)}" fill="#94a3b8" opacity="${opacity.toFixed(2)}" filter="url(#tactileDoughWarp)" />`;
            }).join('')
          : '';

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          ${starSvg}

          <!-- Ground platform during early launch -->
          ${
            ry > h * 0.15
              ? `<rect x="0" y="${(h * 0.84).toFixed(1)}" width="${w}" height="${(h * 0.16).toFixed(1)}" fill="#1e293b" />
                 <line x1="0" y1="${(h * 0.84).toFixed(1)}" x2="${w}" y2="${(h * 0.84).toFixed(1)}" stroke="#334155" stroke-width="2" />`
              : ''
          }

          <!-- Billowing turbulence smoke clouds -->
          ${smokeSvg}

          <!-- Rocket Group with The Marker Trick Specular Highlight -->
          <g transform="translate(${(cx + shake).toFixed(1)} ${ry.toFixed(1)})">
            <!-- Rocket Exhaust Flame with turbulent flicker -->
            ${
              flameLen > 0
                ? `<polygon points="-12,24 12,24 0,${(24 + flameLen).toFixed(1)}" fill="#f97316" filter="url(#tactileDoughWarp)" />
                   <polygon points="-6,24 6,24 0,${(22 + flameLen * 0.65).toFixed(1)}" fill="#fef08a" />`
                : ''
            }

            <!-- Red aerodynamic fins -->
            <polygon points="-18,16 -32,32 -14,24" fill="#ef4444" />
            <polygon points="18,16 32,32 14,24" fill="#ef4444" />

            <!-- Rocket Fuselage Body -->
            <path d="M 0 -58 C 20 -34 20 8 15 24 L -15 24 C -20 8 -20 -34 0 -58 Z" fill="#f8fafc" stroke="#334155" stroke-width="1.5" />
            <!-- Nose cone -->
            <path d="M 0 -58 C 11 -40 14 -24 15 -16 L -15 -16 C -14 -24 -11 -40 0 -58 Z" fill="#ef4444" />

            <!-- Cyan portal window with wet glaze -->
            <circle cx="0" cy="-4" r="9" fill="url(#wetGlazeCyan)" stroke="#0f172a" stroke-width="2.5" />

            <!-- The Marker Trick: Specular highlight ellipse along glossy cylindrical fuselage -->
            <ellipse cx="-6" cy="-8" rx="4" ry="26" transform="rotate(-6 -6 -8)" fill="rgba(255,255,255,0.7)" style="mix-blend-mode: screen;" />
            <ellipse cx="0" cy="-5" rx="3" ry="2" fill="rgba(255,255,255,0.85)" style="mix-blend-mode: screen;" />
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 03. Tactile Walking Character (120 Frames) - 5 complete continuous walk cycles with dough head
  {
    id: 'stick-walk-cycle',
    title: '03. Tactile Clay Walker (120f)',
    category: 'Character',
    description: '120-frame continuous walk animation with clay dough head & procedural sweater noise',
    fps: 24,
    pingPong: false,
    background: '#faf8f5',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#faf8f5';
      const groundY = h * 0.78;
      const cx = w * 0.5;

      return Array.from({ length: count }, (_, i) => {
        // 5 complete cycles of 24 frames
        const cycleProgress = (i % 24) / 24;
        const phase = cycleProgress * Math.PI * 2;

        // Kinematics: vertical hip bobbing (2 bobs per cycle)
        const hipBob = Math.cos(phase * 2) * 6;
        const hipY = groundY - 110 + hipBob;

        // Leg swings
        const legLeftAngle = Math.sin(phase) * 32;
        const legRightAngle = -legLeftAngle;
        const armLeftAngle = -legLeftAngle * 0.85;
        const armRightAngle = -legRightAngle * 0.85;

        // Eye blinking on frames 24..28, 72..76, 110..114
        const isBlinking =
          (i >= 24 && i <= 28) || (i >= 72 && i <= 76) || (i >= 110 && i <= 114);

        // Legs forward/back positions
        const legLRad = (legLeftAngle * Math.PI) / 180;
        const legRRad = (legRightAngle * Math.PI) / 180;
        const footLX = cx + Math.sin(legLRad) * 60;
        const footLY = hipY + Math.cos(legLRad) * 60;
        const footRX = cx + Math.sin(legRRad) * 60;
        const footRY = hipY + Math.cos(legRRad) * 60;

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Desk line with organic wood grain -->
          <line x1="${(w * 0.08).toFixed(1)}" y1="${groundY.toFixed(1)}" x2="${(w * 0.92).toFixed(1)}" y2="${groundY.toFixed(1)}" stroke="#cbd5e1" stroke-width="2" />

          <!-- Dynamic ground shadow -->
          <ellipse cx="${cx.toFixed(1)}" cy="${(groundY + 4).toFixed(1)}" rx="${(34 + Math.abs(legLeftAngle) * 0.4).toFixed(1)}" ry="7" fill="rgba(15,23,42,0.14)" />

          <!-- Back Arm (Right) -->
          <line x1="${cx.toFixed(1)}" y1="${(hipY - 24).toFixed(1)}" x2="${(cx + Math.sin((armRightAngle * Math.PI) / 180) * 44).toFixed(1)}" y2="${(hipY - 24 + Math.cos((armRightAngle * Math.PI) / 180) * 44).toFixed(1)}" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" />

          <!-- Back Leg (Right) -->
          <line x1="${cx.toFixed(1)}" y1="${hipY.toFixed(1)}" x2="${footRX.toFixed(1)}" y2="${footRY.toFixed(1)}" stroke="#475569" stroke-width="9" stroke-linecap="round" />
          <ellipse cx="${(footRX + 4).toFixed(1)}" cy="${footRY.toFixed(1)}" rx="10" ry="5" fill="#1e293b" />

          <!-- Torso with Procedural Noise Filter (Sweater Texture) -->
          <g filter="url(#tactileOrganicNoise)">
            <rect x="${(cx - 16).toFixed(1)}" y="${(hipY - 48).toFixed(1)}" width="32" height="48" rx="10" fill="#2563eb" />
            <line x1="${(cx - 16).toFixed(1)}" y1="${(hipY - 28).toFixed(1)}" x2="${(cx + 16).toFixed(1)}" y2="${(hipY - 28).toFixed(1)}" stroke="#1d4ed8" stroke-width="2.5" />
          </g>

          <!-- Front Leg (Left) -->
          <line x1="${cx.toFixed(1)}" y1="${hipY.toFixed(1)}" x2="${footLX.toFixed(1)}" y2="${footLY.toFixed(1)}" stroke="#1e293b" stroke-width="9" stroke-linecap="round" />
          <ellipse cx="${(footLX + 4).toFixed(1)}" cy="${footLY.toFixed(1)}" rx="10" ry="5" fill="#0f172a" />

          <!-- Front Arm (Left) with The Marker Trick Specular Highlight -->
          <line x1="${cx.toFixed(1)}" y1="${(hipY - 24).toFixed(1)}" x2="${(cx + Math.sin((armLeftAngle * Math.PI) / 180) * 44).toFixed(1)}" y2="${(hipY - 24 + Math.cos((armLeftAngle * Math.PI) / 180) * 44).toFixed(1)}" stroke="#3b82f6" stroke-width="8" stroke-linecap="round" />

          <!-- Head (Clay Dough Warped Circle) -->
          <g filter="url(#tactileDoughWarp)">
            <circle cx="${cx.toFixed(1)}" cy="${(hipY - 70).toFixed(1)}" r="22" fill="#fed7aa" />
          </g>

          <!-- Face details + The Marker Trick glossy highlight on clay cheek -->
          <g transform="translate(${cx.toFixed(1)} ${(hipY - 70).toFixed(1)})">
            <!-- Eyes -->
            ${
              isBlinking
                ? `<line x1="2" y1="-2" x2="8" y2="-2" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" />`
                : `<circle cx="6" cy="-3" r="2.8" fill="#1e293b" /><circle cx="7" cy="-4" r="0.9" fill="#ffffff" />`
            }
            <!-- Smile -->
            <path d="M 2 5 Q 6 9 10 5" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
            <!-- Cheerful clay hair tuft -->
            <path d="M -6 -18 Q -2 -28 6 -24 Q 10 -20 12 -16" fill="none" stroke="#b45309" stroke-width="4" stroke-linecap="round" />
            <!-- Marker trick specular glint on cheek -->
            <ellipse cx="-8" cy="-8" rx="6" ry="4" transform="rotate(-20 -8 -8)" fill="rgba(255,255,255,0.65)" style="mix-blend-mode: screen;" />
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 04. Tactile Glazed Donut & Liquid Metamorphosis (120 Frames) - The Donut Trick + Wet Glaze + Dough Warp
  {
    id: 'metamorphosis-blob',
    title: '04. Glazed Donut & Morphing Blob (120f)',
    category: 'Organic',
    description: '120-frame wet glazed donut morphing into clay ball, star gem, droplet & heart',
    fps: 24,
    pingPong: false,
    background: '#faf5ff',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#faf5ff';
      const cx = w * 0.5;
      const cy = h * 0.5;
      const baseR = Math.min(w, h) * 0.22;

      // 12 colorful sprinkles for the donut
      const sprinkles = [
        { x: -38, y: -22, color: '#38bdf8', rot: 15 },
        { x: 26, y: -34, color: '#facc15', rot: -25 },
        { x: 42, y: 12, color: '#4ade80', rot: 40 },
        { x: -28, y: 32, color: '#f43f5e', rot: -10 },
        { x: 8, y: 44, color: '#c084fc', rot: 60 },
        { x: -44, y: 8, color: '#fb923c', rot: -45 },
        { x: 34, y: -12, color: '#38bdf8', rot: 30 },
        { x: -8, y: -42, color: '#4ade80', rot: -70 },
      ];

      return Array.from({ length: count }, (_, i) => {
        const t = i / count; // 0..1
        // 5 morph stages:
        // 0..24: Glazed Donut
        // 25..48: Bouncing Clay Sphere
        // 49..72: Radiant 5-Point Star Gem
        // 73..96: Liquid Water Droplet
        // 97..120: Tactile Dough Heart -> morph back to Donut
        const rot = (t * 360) % 360;

        // Parametric harmonic shape coordinates (16 points around circumference)
        const pts = Array.from({ length: 32 }, (_, pIdx) => {
          const theta = (pIdx / 32) * Math.PI * 2;
          let r = baseR;

          if (i < 25) {
            // Donut outer rim with subtle pulsation
            r = baseR * (1 + 0.04 * Math.sin(theta * 6 + t * Math.PI * 4));
          } else if (i < 49) {
            // Sphere with squash & stretch bounce
            const phase = ((i - 25) / 24) * Math.PI * 2;
            const squash = 1 + Math.sin(phase) * 0.18;
            r = baseR * (squash * Math.cos(theta) * Math.cos(theta) + (1 / squash) * Math.sin(theta) * Math.sin(theta));
          } else if (i < 73) {
            // 5-Point Star Gem
            const starMod = Math.cos(theta * 5);
            r = baseR * (0.8 + starMod * 0.32);
          } else if (i < 97) {
            // Teardrop liquid droplet
            const dropMod = Math.sin(theta) > 0 ? 1 + Math.sin(theta) * 0.38 : 0.9;
            r = baseR * dropMod;
          } else {
            // Tactile Heart
            const heartMod = 1 - Math.abs(Math.sin(theta)) * 0.22 + (theta > Math.PI ? 0.15 : 0);
            r = baseR * heartMod;
          }

          const px = Math.cos(theta) * r;
          const py = Math.sin(theta) * r;
          return `${pIdx === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
        }).join(' ') + ' Z';

        const isDonutPhase = i < 24 || i >= 114;

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Ambient soft shadow -->
          <ellipse cx="${cx.toFixed(1)}" cy="${(cy + baseR * 1.15).toFixed(1)}" rx="${(baseR * 1.1).toFixed(1)}" ry="${(baseR * 0.24).toFixed(1)}" fill="rgba(76,29,149,0.12)" />

          <!-- Main Tactile Dough Body with SVG displacement warping -->
          <g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})" filter="url(#tactileDoughWarp)">
            <path d="${pts}" fill="url(#wetGlazePink)" stroke="#881337" stroke-width="2.5" />
            <!-- Donut hole when in donut phase -->
            ${
              isDonutPhase
                ? `<circle cx="0" cy="0" r="${(baseR * 0.38).toFixed(1)}" fill="#faf5ff" stroke="#881337" stroke-width="2" />`
                : ''
            }
          </g>

          <!-- Donut Sprinkles & Glossy Specular Highlights -->
          <g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})">
            ${
              isDonutPhase
                ? sprinkles
                    .map(
                      (sp) =>
                        `<rect x="${sp.x}" y="${sp.y}" width="9" height="4.5" rx="2" transform="rotate(${sp.rot} ${sp.x} ${sp.y})" fill="${sp.color}" />`
                    )
                    .join('')
                : ''
            }

            <!-- The Donut & Marker Trick: Specular Wet Glaze Reflection -->
            <ellipse cx="${(-baseR * 0.35).toFixed(1)}" cy="${(-baseR * 0.35).toFixed(1)}" rx="${(baseR * 0.34).toFixed(1)}" ry="${(baseR * 0.16).toFixed(1)}" transform="rotate(-30 ${(-baseR * 0.35).toFixed(1)} ${(-baseR * 0.35).toFixed(1)})" fill="rgba(255,255,255,0.78)" style="mix-blend-mode: screen;" />
            <circle cx="${(-baseR * 0.18).toFixed(1)}" cy="${(-baseR * 0.2).toFixed(1)}" r="${(baseR * 0.08).toFixed(1)}" fill="rgba(255,255,255,0.92)" style="mix-blend-mode: screen;" />
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 05. Blooming Organic Flower (120 Frames) - Sprout push, stem curl, 12 petals unfurl, dewdrops
  {
    id: 'blooming-flower',
    title: '05. Blooming Organic Flower (120f)',
    category: 'Nature',
    description: '120-frame botanical growth from seed to 12 unfurling petals with wet dewdrops',
    fps: 24,
    pingPong: false,
    background: '#f0fdf4',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#f0fdf4';
      const groundY = h * 0.84;
      const cx = w * 0.5;

      return Array.from({ length: count }, (_, i) => {
        // Growth progression:
        // 0..25: sprout rises from soil
        // 26..60: stem curves & leaf unfurls
        // 61..85: central bud swells
        // 86..120: 12 petals bloom & dewdrops shine
        const t = i / count;
        const stemHeight = Math.min(1, i / 55) * (h * 0.44);
        const flowerHeadY = groundY - stemHeight;
        const bloomProgress = i < 60 ? 0 : Math.min(1, (i - 60) / 45);
        const petalLen = bloomProgress * 46;
        const windSway = Math.sin((i / 12) * Math.PI) * (4 * bloomProgress);

        // 10 Petals array
        const petalSvg = Array.from({ length: 10 }, (_, pIdx) => {
          const angle = (pIdx / 10) * 360 + windSway * 2;
          const rad = (angle * Math.PI) / 180;
          const px = Math.cos(rad) * petalLen;
          const py = Math.sin(rad) * petalLen;
          return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(petalLen * 0.52).toFixed(1)}" ry="${(petalLen * 0.28).toFixed(1)}" transform="rotate(${angle.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})" fill="url(#wetGlazePink)" stroke="#be185d" stroke-width="1.2" filter="url(#tactileDoughWarp)" />`;
        }).join('');

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Rich soil mound with procedural noise -->
          <ellipse cx="${cx.toFixed(1)}" cy="${groundY.toFixed(1)}" rx="${(w * 0.3).toFixed(1)}" ry="18" fill="#78350f" filter="url(#tactileOrganicNoise)" />
          <ellipse cx="${cx.toFixed(1)}" cy="${(groundY - 4).toFixed(1)}" rx="${(w * 0.22).toFixed(1)}" ry="10" fill="#92400e" />

          <!-- Organic curved stem -->
          <path d="M ${cx} ${groundY} Q ${(cx + windSway * 2).toFixed(1)} ${(groundY - stemHeight * 0.5).toFixed(1)} ${(cx + windSway).toFixed(1)} ${flowerHeadY.toFixed(1)}" fill="none" stroke="#15803d" stroke-width="7" stroke-linecap="round" />

          <!-- Unfurling leaf -->
          ${
            i >= 25
              ? `<path d="M ${(cx + windSway * 0.5).toFixed(1)} ${(groundY - stemHeight * 0.4).toFixed(1)} Q ${(cx - 38).toFixed(1)} ${(groundY - stemHeight * 0.5).toFixed(1)} ${(cx - 46).toFixed(1)} ${(groundY - stemHeight * 0.35).toFixed(1)} Q ${(cx - 24).toFixed(1)} ${(groundY - stemHeight * 0.3).toFixed(1)} ${(cx + windSway * 0.5).toFixed(1)} ${(groundY - stemHeight * 0.4).toFixed(1)}" fill="#22c55e" stroke="#166534" stroke-width="1.5" />`
              : ''
          }

          <!-- Flower Head (Petals + Pistil + Dewdrop) -->
          <g transform="translate(${(cx + windSway).toFixed(1)} ${flowerHeadY.toFixed(1)})">
            <!-- 10 Bloom Petals with wet glaze gradient -->
            ${bloomProgress > 0 ? petalSvg : ''}

            <!-- Central Pistil Disk (Tactile Golden Dough) -->
            <circle cx="0" cy="0" r="${(8 + bloomProgress * 12).toFixed(1)}" fill="url(#wetGlazeCaramel)" stroke="#b45309" stroke-width="2" filter="url(#tactileDoughWarp)" />

            <!-- The Marker Trick: Specular highlight on glistening dewdrop -->
            ${
              bloomProgress > 0.4
                ? `<circle cx="6" cy="-6" r="3.5" fill="rgba(255,255,255,0.85)" style="mix-blend-mode: screen;" />
                   <ellipse cx="6" cy="-6" rx="4" ry="2" transform="rotate(-30 6 -6)" fill="rgba(255,255,255,0.7)" style="mix-blend-mode: screen;" />`
                : ''
            }
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 06. Roaring Campfire with Procedural Embers (120 Frames) - Turbulence flames, 20 rising embers
  {
    id: 'flickering-campfire',
    title: '06. Roaring Campfire (120f)',
    category: 'Elements',
    description: '120-frame flame physics with turbulence displacement & 20 turbulent embers',
    fps: 24,
    pingPong: false,
    background: '#0a0f1d',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#0a0f1d';
      const cx = w * 0.5;
      const groundY = h * 0.78;

      // 20 independent ember particles
      const embers = Array.from({ length: 20 }, (_, idx) => ({
        speed: 1.2 + (idx % 4) * 0.4,
        drift: ((idx * 17) % 7) - 3,
        size: 2 + (idx % 3) * 1.2,
        phaseOffset: idx * 6,
      }));

      return Array.from({ length: count }, (_, i) => {
        // Multi-frequency flame waves
        const f1 = Math.sin((i / 5) * Math.PI) * 18;
        const f2 = Math.cos((i / 7) * Math.PI) * 14;
        const f3 = Math.sin((i / 4) * Math.PI) * 10;
        const flameHeight = 110 + f1;

        // Ember positions
        const emberSvg = embers
          .map((em) => {
            const age = (i + em.phaseOffset) % count;
            const progress = age / count; // 0..1
            const ex = cx + Math.sin(progress * Math.PI * 4 + em.drift) * 36 + em.drift * progress * 24;
            const ey = groundY - 20 - progress * (h * 0.65);
            const alpha = Math.max(0, 1 - progress * 1.1);
            return `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${em.size.toFixed(1)}" fill="${progress > 0.6 ? '#f97316' : '#fef08a'}" opacity="${alpha.toFixed(2)}" filter="url(#tactileSoftEdge)" />`;
          })
          .join('');

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Ambient warm campfire glow -->
          <circle cx="${cx.toFixed(1)}" cy="${(groundY - 40).toFixed(1)}" r="140" fill="rgba(249,115,22,0.12)" />

          <!-- Charred wood logs with procedural wood grain -->
          <g filter="url(#tactileOrganicNoise)">
            <rect x="${(cx - 68).toFixed(1)}" y="${(groundY - 14).toFixed(1)}" width="136" height="22" rx="8" transform="rotate(-12 ${cx} ${groundY})" fill="#451a03" stroke="#291102" stroke-width="2" />
            <rect x="${(cx - 68).toFixed(1)}" y="${(groundY - 14).toFixed(1)}" width="136" height="22" rx="8" transform="rotate(12 ${cx} ${groundY})" fill="#3b1502" stroke="#1f0a01" stroke-width="2" />
          </g>

          <!-- Glowing coal bed -->
          <ellipse cx="${cx.toFixed(1)}" cy="${(groundY - 2).toFixed(1)}" rx="44" ry="12" fill="#ef4444" opacity="0.8" />

          <!-- Layered Flame Tongues with SVG Turbulence Displacement Map -->
          <g transform="translate(${cx.toFixed(1)} ${groundY.toFixed(1)})" filter="url(#tactileDoughWarp)">
            <!-- Outer Red/Orange Flame -->
            <path d="M -48 0 C -36 ${-flameHeight * 0.4} ${-18 + f2} ${-flameHeight * 0.8} 0 ${-flameHeight} C ${18 + f3} ${-flameHeight * 0.8} 36 ${-flameHeight * 0.4} 48 0 Z" fill="#ea580c" />
            <!-- Middle Amber Flame -->
            <path d="M -34 0 C -24 ${-flameHeight * 0.35} ${-10 + f1} ${-flameHeight * 0.65} 0 ${-flameHeight * 0.85} C ${10 + f2} ${-flameHeight * 0.65} 24 ${-flameHeight * 0.35} 34 0 Z" fill="#f59e0b" />
            <!-- Inner Yellow Core -->
            <path d="M -20 0 C -12 ${-flameHeight * 0.25} ${-4 + f3} ${-flameHeight * 0.5} 0 ${-flameHeight * 0.65} C ${4 + f1} ${-flameHeight * 0.5} 12 ${-flameHeight * 0.25} 20 0 Z" fill="#fef08a" />
            <!-- White Hot Heart -->
            <ellipse cx="${(f2 * 0.2).toFixed(1)}" cy="${(-flameHeight * 0.2).toFixed(1)}" rx="10" ry="18" fill="#ffffff" />
          </g>

          <!-- 20 Turbulent Rising Embers -->
          ${emberSvg}
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 07. Glossy Twirling Origami Crane (120 Frames) - 360-degree rotation, 8 wing flaps, marker highlights
  {
    id: 'origami-crane-flight',
    title: '07. Glossy Origami Crane (120f)',
    category: 'Craft',
    description: '120-frame 360° rotational flight with glossy specular highlights across paper facets',
    fps: 24,
    pingPong: false,
    background: '#f8fafc',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#f8fafc';
      const cx = w * 0.5;
      const cy = h * 0.48;

      return Array.from({ length: count }, (_, i) => {
        const t = i / count;
        // 360 degree rotation over 120 frames
        const yaw = t * Math.PI * 2;
        // 8 wing flap cycles
        const flap = Math.sin(t * Math.PI * 16) * 38;
        const flightBob = Math.sin(t * Math.PI * 8) * 16;

        // 3D projection factors
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);

        // Marker trick specular glint intensity peaks when facing light source
        const glintIntensity = Math.max(0, cosYaw);

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Shadow cast on ground below -->
          <ellipse cx="${(cx + sinYaw * 20).toFixed(1)}" cy="${(h * 0.84).toFixed(1)}" rx="${(52 * Math.abs(cosYaw) + 24).toFixed(1)}" ry="10" fill="rgba(15,23,42,0.12)" />

          <!-- Origami Crane Group -->
          <g transform="translate(${cx.toFixed(1)} ${(cy + flightBob).toFixed(1)})">
            <!-- Left Wing -->
            <polygon points="0,0 ${(cosYaw * -90).toFixed(1)},${(-20 - flap).toFixed(1)} ${(cosYaw * -40).toFixed(1)},20" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />

            <!-- Right Wing -->
            <polygon points="0,0 ${(cosYaw * 90).toFixed(1)},${(-20 + flap).toFixed(1)} ${(cosYaw * 40).toFixed(1)},20" fill="#0284c7" stroke="#0369a1" stroke-width="1.5" />

            <!-- Origami Diamond Body -->
            <polygon points="0,-36 ${(cosYaw * 24).toFixed(1)},0 0,36 ${(cosYaw * -24).toFixed(1)},0" fill="#0ea5e9" stroke="#0369a1" stroke-width="2" />

            <!-- Crane Head and Neck -->
            <polygon points="0,-36 ${(sinYaw * 18).toFixed(1)},-68 0,-60" fill="#bae6fd" stroke="#0284c7" stroke-width="1.5" />
            <!-- Crane Tail -->
            <polygon points="0,36 ${(sinYaw * -14).toFixed(1)},62 0,54" fill="#0369a1" stroke="#075985" stroke-width="1.5" />

            <!-- The Marker Trick: Specular highlight ellipse on glossy paper facet -->
            ${
              glintIntensity > 0.2
                ? `<ellipse cx="${(cosYaw * 12).toFixed(1)}" cy="-14" rx="${(14 * glintIntensity).toFixed(1)}" ry="6" transform="rotate(-25)" fill="rgba(255,255,255,${(0.8 * glintIntensity).toFixed(2)})" style="mix-blend-mode: screen;" />`
                : ''
            }
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 08. Tactile Cosmic Solar System (120 Frames) - Sun corona turbulence, 3 Keplerian planetary orbits
  {
    id: 'spinning-solar-system',
    title: '08. Tactile Solar System (120f)',
    category: 'Cosmic',
    description: '120-frame planetary Keplerian orbits with Sun corona turbulence & Saturn rings',
    fps: 24,
    pingPong: false,
    background: '#030712',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#030712';
      const cx = w * 0.5;
      const cy = h * 0.5;

      return Array.from({ length: count }, (_, i) => {
        const t = i / count;

        // Mercury: 4 orbits in 120 frames
        const mAngle = t * Math.PI * 8;
        const mx = cx + Math.cos(mAngle) * (w * 0.16);
        const my = cy + Math.sin(mAngle) * (h * 0.1);

        // Earth: 2 orbits in 120 frames
        const eAngle = t * Math.PI * 4;
        const ex = cx + Math.cos(eAngle) * (w * 0.28);
        const ey = cy + Math.sin(eAngle) * (h * 0.18);
        // Moon around Earth: 12 orbits
        const moonAngle = t * Math.PI * 24;
        const moonX = ex + Math.cos(moonAngle) * 16;
        const moonY = ey + Math.sin(moonAngle) * 10;

        // Saturn: 1 orbit in 120 frames
        const sAngle = t * Math.PI * 2;
        const sx = cx + Math.cos(sAngle) * (w * 0.4);
        const sy = cy + Math.sin(sAngle) * (h * 0.26);

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Orbit Trajectory Tracks -->
          <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w * 0.16).toFixed(1)}" ry="${(h * 0.1).toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4" />
          <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w * 0.28).toFixed(1)}" ry="${(h * 0.18).toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4" />
          <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w * 0.4).toFixed(1)}" ry="${(h * 0.26).toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4" />

          <!-- Sun Corona with SVG Turbulence Noise Filter -->
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="38" fill="url(#wetGlazeCaramel)" filter="url(#tactileDoughWarp)" />
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="28" fill="#fef08a" />
          <!-- The Marker Trick: Sun specular core glint -->
          <ellipse cx="${(cx - 8).toFixed(1)}" cy="${(cy - 8).toFixed(1)}" rx="10" ry="6" fill="#ffffff" style="mix-blend-mode: screen;" />

          <!-- Mercury -->
          <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="6" fill="#94a3b8" />

          <!-- Earth & Moon -->
          <g>
            <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="11" fill="url(#wetGlazeCyan)" />
            <circle cx="${moonX.toFixed(1)}" cy="${moonY.toFixed(1)}" r="3" fill="#e2e8f0" />
            <!-- The Marker Trick: Earth ocean highlight -->
            <circle cx="${(ex - 3).toFixed(1)}" cy="${(ey - 3).toFixed(1)}" r="3" fill="rgba(255,255,255,0.8)" style="mix-blend-mode: screen;" />
          </g>

          <!-- Saturn & Tilted Ring System -->
          <g transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})">
            <!-- Back ring half -->
            <ellipse cx="0" cy="0" rx="34" ry="11" transform="rotate(-18)" fill="none" stroke="#fed7aa" stroke-width="6" opacity="0.45" />
            <!-- Planet body -->
            <circle cx="0" cy="0" r="16" fill="url(#wetGlazeCaramel)" />
            <!-- Front ring half -->
            <path d="M -32 10 A 34 11 0 0 0 32 -10" transform="rotate(-18)" fill="none" stroke="#fed7aa" stroke-width="6" />
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 09. Precision Mechanical Clockwork (120 Frames) - 32-tooth brass master gear, 16-tooth pinion
  {
    id: 'mechanical-clock-gears',
    title: '09. Mechanical Clockwork (120f)',
    category: 'Kinematics',
    description: '120-frame interlocking brass gears, swinging pendulum & metallic specular highlights',
    fps: 24,
    pingPong: false,
    background: '#18181b',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#18181b';
      const g1x = w * 0.42;
      const g1y = h * 0.48;
      const g1r = 72;
      const g2r = 36;
      const g2x = g1x + g1r + g2r - 4;
      const g2y = g1y;

      return Array.from({ length: count }, (_, i) => {
        const t = i / count;
        // Gear 1: 1 revolution in 120 frames
        const g1Angle = t * 360;
        // Gear 2: exactly 2 revolutions in opposite direction (seamless tooth mesh)
        const g2Angle = -t * 720;
        // Pendulum: 2 complete sinusoidal swings
        const pendAngle = Math.sin(t * Math.PI * 4) * 22;

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Clockwork Frame Plate with procedural noise -->
          <rect x="${(w * 0.1).toFixed(1)}" y="${(h * 0.1).toFixed(1)}" width="${(w * 0.8).toFixed(1)}" height="${(h * 0.8).toFixed(1)}" rx="18" fill="#27272a" stroke="#3f3f46" stroke-width="3" filter="url(#tactileOrganicNoise)" />

          <!-- Swinging Brass Pendulum -->
          <g transform="translate(${(w * 0.5).toFixed(1)} ${(h * 0.18).toFixed(1)}) rotate(${pendAngle.toFixed(1)})">
            <line x1="0" y1="0" x2="0" y2="${(h * 0.6).toFixed(1)}" stroke="#eab308" stroke-width="4" />
            <circle cx="0" cy="${(h * 0.6).toFixed(1)}" r="22" fill="url(#wetGlazeCaramel)" stroke="#a16207" stroke-width="2.5" />
            <!-- The Marker Trick: Pendulum specular sheen -->
            <ellipse cx="-6" cy="${(h * 0.6 - 6).toFixed(1)}" rx="7" ry="4" transform="rotate(-30 -6 ${(h * 0.6 - 6).toFixed(1)})" fill="rgba(255,255,255,0.75)" style="mix-blend-mode: screen;" />
          </g>

          <!-- Master Brass Gear (32 Teeth) -->
          <g transform="translate(${g1x.toFixed(1)} ${g1y.toFixed(1)}) rotate(${g1Angle.toFixed(1)})">
            <circle cx="0" cy="0" r="${g1r}" fill="url(#wetGlazeCaramel)" stroke="#854d0e" stroke-width="2" />
            <!-- 16 Teeth Stubs -->
            ${Array.from({ length: 16 }, (_, idx) => {
              const ang = (idx / 16) * 360;
              return `<rect x="-5" y="${-g1r - 6}" width="10" height="12" rx="2" transform="rotate(${ang})" fill="#ca8a04" stroke="#854d0e" stroke-width="1" />`;
            }).join('')}
            <!-- Gear spokes -->
            <circle cx="0" cy="0" r="${g1r * 0.65}" fill="#27272a" />
            <line x1="${-g1r * 0.65}" y1="0" x2="${g1r * 0.65}" y2="0" stroke="#ca8a04" stroke-width="6" />
            <line x1="0" y1="${-g1r * 0.65}" x2="0" y2="${g1r * 0.65}" stroke="#ca8a04" stroke-width="6" />
            <circle cx="0" cy="0" r="14" fill="#fef08a" />
          </g>

          <!-- Secondary Pinion Gear (16 Teeth) -->
          <g transform="translate(${g2x.toFixed(1)} ${g2y.toFixed(1)}) rotate(${g2Angle.toFixed(1)})">
            <circle cx="0" cy="0" r="${g2r}" fill="url(#wetGlazeCaramel)" stroke="#854d0e" stroke-width="2" />
            ${Array.from({ length: 8 }, (_, idx) => {
              const ang = (idx / 8) * 360;
              return `<rect x="-4" y="${-g2r - 5}" width="8" height="10" rx="1.5" transform="rotate(${ang})" fill="#ca8a04" />`;
            }).join('')}
            <circle cx="0" cy="0" r="10" fill="#fef08a" />
          </g>
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },

  // 10. Curling Emerald Ocean Barrel Wave (120 Frames) - Swell rising, hollow tube barrel, spray foam explosion
  {
    id: 'ocean-wave-crest',
    title: '10. Ocean Barrel Wave (120f)',
    category: 'Elements',
    description: '120-frame curling pipeline wave with turbulence spray foam explosion & caustic glaze',
    fps: 24,
    pingPong: false,
    background: '#042f2e',
    buildFrames: (w, h) => {
      const count = 120;
      const bg = '#042f2e';
      const seaY = h * 0.72;

      return Array.from({ length: count }, (_, i) => {
        const t = i / count;
        // Wave cycle:
        // 0..35: swell builds & rises
        // 36..70: lip curls into hollow barrel
        // 71..95: lip crashes down & creates spray
        // 96..120: foam washes forward into next swell
        const swellPeak = Math.sin(t * Math.PI) * (h * 0.42);
        const curlX = w * (0.2 + t * 0.6);
        const curlY = seaY - swellPeak;
        const sprayRadius = i > 70 ? (i - 70) * 1.8 : 0;

        const svg = `
          ${TACTILE_SVG_FILTERS_DEFS}
          <!-- Ocean Gradient Sky -->
          <rect x="0" y="0" width="${w}" height="${h}" fill="#0f172a" />
          <circle cx="${(w * 0.8).toFixed(1)}" cy="${(h * 0.28).toFixed(1)}" r="32" fill="url(#wetGlazeCaramel)" opacity="0.6" />

          <!-- Deep Ocean Water Base -->
          <rect x="0" y="${seaY.toFixed(1)}" width="${w}" height="${(h - seaY).toFixed(1)}" fill="#042f2e" />

          <!-- Rolling Emerald Barrel Wave with SVG Displacement Warping -->
          <g filter="url(#tactileDoughWarp)">
            <path d="M 0 ${seaY} Q ${(curlX * 0.5).toFixed(1)} ${seaY} ${(curlX * 0.8).toFixed(1)} ${(curlY + 20).toFixed(1)} Q ${curlX.toFixed(1)} ${curlY.toFixed(1)} ${(curlX + 30).toFixed(1)} ${(curlY + 40).toFixed(1)} L ${(curlX + 50).toFixed(1)} ${seaY} L ${w} ${seaY} L ${w} ${h} L 0 ${h} Z" fill="url(#wetGlazeCyan)" />
          </g>

          <!-- White Water Barrel Lip with The Marker Trick Specular Highlight -->
          <path d="M ${(curlX - 20).toFixed(1)} ${(curlY + 8).toFixed(1)} Q ${curlX.toFixed(1)} ${curlY.toFixed(1)} ${(curlX + 32).toFixed(1)} ${(curlY + 42).toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" style="mix-blend-mode: screen;" />

          <!-- Turbulent Foam Spray Explosion -->
          ${
            sprayRadius > 0
              ? Array.from({ length: 14 }, (_, idx) => {
                  const spAngle = (idx / 14) * Math.PI * 1.6 - 0.8;
                  const dist = sprayRadius * (0.6 + (idx % 3) * 0.35);
                  const spX = curlX + Math.cos(spAngle) * dist;
                  const spY = curlY + Math.sin(spAngle) * dist;
                  return `<circle cx="${spX.toFixed(1)}" cy="${spY.toFixed(1)}" r="${(2 + (idx % 3) * 1.5).toFixed(1)}" fill="#f0fdfa" opacity="${Math.max(0, 0.85 - sprayRadius * 0.015).toFixed(2)}" filter="url(#tactileOrganicNoise)" />`;
                }).join('')
              : ''
          }
        `;
        return makeVectorFrame(svg, w, h, bg, 1, i);
      });
    },
  },
];
