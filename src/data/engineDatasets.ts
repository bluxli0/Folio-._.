export type EngineDatasetId =
  | 'evo3d'
  | 'threejs'
  | 'stopmotion'
  | 'pixelart'
  | 'hybrid'
  | 'ik-math';

export interface EngineParameterSpec {
  param: string;
  type: string;
  recommendedValues: string;
  rangeOrOptions: string;
  notes: string;
}

export interface EngineDatasetExample {
  id: string;
  title: string;
  prompt: string;
  description: string;
  language: string;
  code: string;
  keyValues: Record<string, string | number>;
}

export interface EngineDataset {
  id: EngineDatasetId;
  engineName: string;
  format: string;
  summary: string;
  designRule: string;
  parameters: EngineParameterSpec[];
  examples: EngineDatasetExample[];
}

export const CHRONO_SINGULARITY_EVO_SPEC = {
  format: 'evo/v1',
  title: 'Chrono-Singularity Manifold: Hardest EVO Architecture',
  environment: 'cosmic',
  camera: {
    fov: 52,
    position: [0, 6.5, 16],
    target: [0, 1.5, 0],
    exposure: 1.15,
  },
  fog: {
    color: '#050714',
    density: 0.022,
  },
  starfield: {
    count: 280,
    radius: 65,
    color: '#a5d8ff',
  },
  nodes: [
    {
      id: 'singularity_core',
      geometry: 'klein',
      position: [0, 2.2, 0],
      scale: [1.35, 1.35, 1.35],
      material: {
        preset: 'hologram',
        color: '#00f5d4',
        emissive: '#00bbf9',
        emissivePulse: 0.75,
        sheen: 1.0,
      },
      modifiers: [
        { type: 'twist', axis: 'y', strength: 1.8, speed: 0.9 },
        { type: 'wave', axis: 'x', strength: 0.28, frequency: 3.5, speed: 2.2 },
        { type: 'noise', axis: 'z', strength: 0.14, frequency: 4.0, speed: 1.4 },
      ],
      morphTargets: [
        { name: 'breathe', scale: [1.18, 0.88, 1.18], twist: 0.6, bulge: 0.35, weight: 0.65 },
      ],
      motion: {
        spinY: 0.45,
        spinX: 0.18,
      },
    },
    {
      id: 'mobius_halo',
      geometry: 'mobius',
      position: [0, 2.2, 0],
      scale: [2.4, 2.4, 2.4],
      material: {
        preset: 'chrome',
        color: '#e0aaff',
        sheen: 0.9,
      },
      modifiers: [
        { type: 'bend', axis: 'z', strength: 0.45, speed: 1.1 },
        { type: 'taper', axis: 'y', strength: 0.25 },
      ],
      motion: {
        spinZ: 0.35,
        spinY: -0.25,
      },
    },
    {
      id: 'hyper_knot_cage',
      geometry: 'torusKnot',
      position: [0, 2.2, 0],
      scale: [1.8, 1.8, 1.8],
      material: {
        preset: 'neon',
        color: '#ff006e',
        emissive: '#ff006e',
        emissivePulse: 0.5,
      },
      modifiers: [
        { type: 'wave', axis: 'y', strength: 0.18, frequency: 5.0, speed: 3.0 },
      ],
      motion: {
        spinX: -0.3,
        spinY: 0.2,
      },
    },
    {
      id: 'ik_target_orb',
      geometry: 'metaball',
      position: [4.5, 3.2, 1.5],
      scale: [0.55, 0.55, 0.55],
      material: {
        preset: 'lava',
        color: '#ffbe0b',
        emissive: '#fb5607',
        emissivePulse: 0.9,
      },
      softBody: {
        stiffness: 0.45,
        damping: 0.12,
        squash: 0.35,
      },
      pathFollow: {
        points: [
          [4.8, 3.2, 0],
          [2.4, 5.0, 4.2],
          [-3.8, 2.6, 3.5],
          [-4.5, 4.4, -2.5],
          [1.5, 1.6, -4.6],
          [4.8, 3.2, 0],
        ],
        closed: true,
        orientToPath: true,
        speed: 0.42,
      },
    },
    {
      id: 'arm_shoulder',
      geometry: 'ikJoint',
      position: [-4.5, 0.4, 0],
      scale: [0.5, 1.8, 0.5],
      material: {
        preset: 'obsidian',
        color: '#2b2d42',
      },
    },
    {
      id: 'arm_elbow',
      geometry: 'ikJoint',
      position: [-2.2, 2.2, 0],
      scale: [0.42, 1.7, 0.42],
      material: {
        preset: 'copper',
        color: '#ff9f1c',
      },
    },
    {
      id: 'arm_wrist',
      geometry: 'octahedron',
      position: [0.2, 3.5, 0],
      scale: [0.45, 0.45, 0.45],
      material: {
        preset: 'emerald',
        color: '#06d6a0',
        emissive: '#06d6a0',
        emissivePulse: 0.6,
      },
    },
    {
      id: 'sentinel_gear_east',
      geometry: 'gear',
      position: [5.5, 2.2, -2.0],
      scale: [1.1, 1.1, 1.1],
      material: {
        preset: 'gold',
        color: '#ffd166',
      },
      constraints: [
        { type: 'trackTo', targetId: 'singularity_core', influence: 1.0 },
      ],
      motion: {
        spinZ: 1.2,
      },
    },
    {
      id: 'sentinel_prism_west',
      geometry: 'icosahedron',
      position: [-5.5, 4.0, -2.5],
      scale: [0.85, 0.85, 0.85],
      material: {
        preset: 'glass',
        color: '#90e0ef',
        iridescence: 1.0,
      },
      constraints: [
        { type: 'copyRotation', targetId: 'singularity_core', influence: 0.85 },
        { type: 'limitDistance', targetId: 'singularity_core', influence: 0.9 },
      ],
    },
    {
      id: 'quantum_terrain',
      geometry: 'terrain',
      position: [0, -1.8, 0],
      scale: [18, 1.2, 18],
      material: {
        preset: 'carbon',
        color: '#14213d',
        flatShading: true,
      },
      modifiers: [
        { type: 'wave', axis: 'y', strength: 0.45, frequency: 1.8, speed: 0.8 },
      ],
    },
    {
      id: 'nebula_particles',
      geometry: 'particles3d',
      position: [0, 2.2, 0],
      scale: [9, 6, 9],
      material: {
        preset: 'pearl',
        color: '#caf0f8',
      },
      physics: {
        drag: 0.04,
        restitution: 0.7,
      },
    },
  ],
  ikChains: [
    {
      nodes: ['arm_shoulder', 'arm_elbow', 'arm_wrist'],
      targetId: 'ik_target_orb',
      pole: [0, 4.5, 2.0],
      iterations: 10,
      aimNodes: true,
    },
  ],
  forceFields: [
    {
      id: 'singularity_attractor',
      type: 'attractor',
      position: [0, 2.2, 0],
      strength: 2.4,
      radius: 10.0,
    },
  ],
  triggers: [
    {
      id: 'core_proximity_pulse',
      position: [0, 2.2, 0],
      radius: 3.5,
      targetId: 'ik_target_orb',
      action: 'pulse',
    },
  ],
  storyboard: {
    shots: [
      { name: 'Establishing Orbit', position: [0, 6.5, 16], target: [0, 2.2, 0], duration: 4.0 },
      { name: 'IK Manipulator Close-Up', position: [-2.5, 3.8, 7.5], target: [-1.0, 2.6, 0.5], duration: 3.5 },
      { name: 'Singularity Core', position: [3.5, 2.5, 5.2], target: [0, 2.2, 0], duration: 3.5 },
    ],
  },
};

export const ENGINE_DATASETS: EngineDataset[] = [
  {
    id: 'evo3d',
    engineName: 'EVO 3D Engine (evo/v1)',
    format: 'evo/v1',
    summary:
      'Reference training dataset for non-Euclidean manifolds, FABRIK Inverse Kinematics chains, Blender-style vertex modifiers, constraints, soft-body metaballs, force fields, and triggers.',
    designRule:
      'NEVER default to plain boxes/cubes. Always compose varied geometries (klein, mobius, torusKnot, helix, lathe, metaball, terrain, gear, icosahedron, octahedron, ikJoint, customMesh) with matching PBR material presets.',
    parameters: [
      {
        param: 'node.type / node.geometry',
        type: 'EvoGeometryType',
        recommendedValues: 'klein, mobius, torusKnot, metaball, ikJoint, terrain, gear, icosahedron',
        rangeOrOptions: '33 non-cube & sculptural primitives',
        notes: 'Parser normalizes geometry/shape -> type automatically.',
      },
      {
        param: 'material.preset',
        type: 'EvoMaterialPreset',
        recommendedValues: 'hologram, chrome, neon, lava, obsidian, copper, emerald, gold, glass, carbon, pearl',
        rangeOrOptions: '14 calibrated PBR shaders',
        notes: 'Combine with sheen (0..1), iridescence (0..1), and emissivePulse (0.5..1.2).',
      },
      {
        param: 'modifiers[]',
        type: 'EvoModifierSpec[]',
        recommendedValues: 'twist(strength=1.8, speed=0.9), wave(strength=0.18..0.45, freq=1.8..5.0), bend(0.45)',
        rangeOrOptions: 'twist | bend | taper | wave | noise | squash | mirror',
        notes: 'Stack multiple modifiers on dense meshes like klein, mobius, or terrain.',
      },
      {
        param: 'morphTargets[]',
        type: 'EvoMorphTargetSpec[]',
        recommendedValues: 'weight=0.45..0.85, scale=[1.18,0.88,1.18], twist=0.6, bulge=0.35',
        rangeOrOptions: 'weight: 0..1.5 or math expr',
        notes: 'Ideal for rhythmic breathing and organic pulsation.',
      },
      {
        param: 'ikChains[]',
        type: 'EvoIkChainSpec[]',
        recommendedValues: 'iterations=8..12, pole=[0,4.5,2], aimNodes=true, damping=0.85..1.0',
        rangeOrOptions: '2..8 joint IDs targeting targetId or [x,y,z]',
        notes: 'FABRIK converges within 8-10 iterations at 60fps.',
      },
      {
        param: 'softBody',
        type: 'EvoSoftBodySpec',
        recommendedValues: 'stiffness=0.45..6.5, damping=0.12..0.35, squash=0.25..0.45',
        rangeOrOptions: 'Works on both physics and pathFollow nodes',
        notes: 'Drives squash-and-stretch volume conservation.',
      },
      {
        param: 'forceFields[] & triggers[]',
        type: 'top-level or node-attached',
        recommendedValues: 'attractor(strength=2.4..6.5, radius=5..10), trigger(radius=3.5, action="pulse")',
        rangeOrOptions: 'attractor|repulsor|vortex; pulse|bounce|glow|reverse',
        notes: 'Swirls particles3d & pulls rigid bodies within radius.',
      },
      {
        param: 'storyboard.shots[]',
        type: 'EvoStoryboardShot[]',
        recommendedValues: 'duration=3.0..4.5s OR normalized start/end (0..1), fov=45..55',
        rangeOrOptions: 'Supports position/target arrays or cameraCut presets',
        notes: 'Total durationSec auto-computed from shot durations if omitted.',
      },
    ],
    examples: [
      {
        id: 'chrono-singularity',
        title: 'Chrono-Singularity Manifold (Hardest EVO Architecture)',
        prompt:
          'Generate the Chrono-Singularity Manifold evo/v1 scene with a nested klein/mobius/torusKnot core, 3-joint FABRIK IK arm chasing a spline metaball, trackTo gear, copyRotation+limitDistance prism, quantum terrain, nebula particles, forceFields, and proximity trigger.',
        description:
          'Triple non-Euclidean core + 10-iteration FABRIK IK + Catmull-Rom pathFollow + Blender constraints + attractor & proximity pulse.',
        language: 'evo',
        code: JSON.stringify(CHRONO_SINGULARITY_EVO_SPEC, null, 2),
        keyValues: {
          nodes: 11,
          ikIterations: 10,
          attractorRadius: 10.0,
          triggerRadius: 3.5,
          durationSec: 11,
        },
      },
      {
        id: 'lathe-helix-reactor',
        title: 'Sculpted Lathe & Double-Helix Cryo Reactor',
        prompt:
          'Build an evo/v1 cryo-reactor using a sculpted lathe containment vessel, twin helix plasma coils, gear stabilizer, and radial particle vortex.',
        description: 'Demonstrates non-cube parametric vessels, helix coils, and vortex force fields.',
        language: 'evo',
        code: JSON.stringify(
          {
            format: 'evo/v1',
            title: 'Cryo-Helix Containment Vessel',
            environment: 'arctic',
            starfield: { count: 220, radius: 40, color: '#bae6fd' },
            exposure: 1.15,
            durationSec: 8,
            nodes: [
              {
                id: 'vessel_shell',
                geometry: 'lathe',
                position: [0, 0.2, 0],
                scale: [1.3, 1.8, 1.3],
                profile: [[0.05, -0.7], [0.85, -0.45], [0.42, 0], [0.95, 0.45], [0.3, 0.7]],
                material: { preset: 'ice', iridescence: 0.9, opacity: 0.72 },
                motion: { spinY: 0.25 },
              },
              {
                id: 'plasma_coil',
                geometry: 'helix',
                turns: 4,
                radius: 0.55,
                height: 1.9,
                tube: 0.06,
                position: [0, 0.2, 0],
                material: { preset: 'neon', color: '#38bdf8', emissive: '#0ea5e9', emissivePulse: { min: 0.4, max: 1.9, freq: 2 } },
                modifiers: [{ type: 'twist', axis: 'y', strength: 0.8, speed: 1.2 }],
              },
              {
                id: 'turbine_ring',
                geometry: 'gear',
                teeth: 14,
                radius: 1.45,
                position: [0, -1.1, 0],
                rotation: [90, 0, 0],
                material: { preset: 'chrome', color: '#e2e8f0' },
                motion: { spinZ: -0.6 },
              },
              {
                id: 'cryo_mist',
                geometry: 'particles3d',
                count: 260,
                radius: 2.2,
                position: [0, 0.2, 0],
                material: { color: '#7dd3fc', blending: 'additive', opacity: 0.8 },
              },
            ],
            forceFields: [{ id: 'cryo_vortex', type: 'vortex', position: [0, 0.2, 0], strength: 3.2, radius: 5.5 }],
          },
          null,
          2
        ),
        keyValues: { lathePoints: 5, helixTurns: 4, gearTeeth: 14, vortexStrength: 3.2 },
      },
      {
        id: 'softbody-bounce-pit',
        title: 'Elastic Polyhedra Soft-Body & Trigger Bounce Stage',
        prompt:
          'Create an evo/v1 physics playground with icosahedron, dodecahedron, and octahedron rigid-soft bodies bouncing into a repulsor/glow trigger zone.',
        description: 'Shows collision hitboxes, Euler bounce restitution, soft-body squash, and trigger actions.',
        language: 'evo',
        code: JSON.stringify(
          {
            format: 'evo/v1',
            title: 'Polyhedral Elastic Collision Stage',
            environment: 'sunset',
            durationSec: 6,
            nodes: [
              {
                id: 'ico_diver',
                geometry: 'icosahedron',
                radius: 0.55,
                position: [-1.6, 2.2, 0],
                material: { preset: 'emerald', gradient: { colors: ['#10b981', '#38bdf8'], axis: 'y' } },
                softBody: { stiffness: 6.5, squashOnBounce: 0.32, wobble: 0.08 },
                physics: { velocity: [2.1, 0.5, 0.2], gravity: -9.8, restitution: 0.9, floorY: -1.35 },
                hitbox: { shape: 'sphere', radius: 0.55, show: true },
              },
              {
                id: 'dodeca_striker',
                geometry: 'dodecahedron',
                radius: 0.52,
                position: [1.5, 2.4, 0],
                material: { preset: 'gold', color: '#fbbf24' },
                softBody: { stiffness: 7.2, squashOnBounce: 0.28 },
                physics: { velocity: [-2.0, 0.2, -0.3], gravity: -9.8, restitution: 0.88, floorY: -1.35 },
                hitbox: { shape: 'sphere', radius: 0.52, show: true },
              },
              {
                id: 'repulsor_beacon',
                geometry: 'octahedron',
                radius: 0.45,
                position: [0, -0.3, 0],
                material: { preset: 'lava', emissivePulse: 0.8 },
                forceField: { type: 'repulsor', strength: 4.2, radius: 2.8 },
                triggerZone: { radius: 2.2, action: 'bounce', show: true, color: '#f43f5e' },
              },
            ],
          },
          null,
          2
        ),
        keyValues: { gravity: -9.8, restitution: 0.9, repulsorStrength: 4.2, triggerRadius: 2.2 },
      },
    ],
  },
  {
    id: 'threejs',
    engineName: 'Three.js Studio (threejs/v1)',
    format: 'threejs/v1',
    summary:
      'Real-time WebGL scene dataset covering 27 non-cube shapes, 20 PBR materials, lighting rigs, FABRIK IK chains, and trackTo constraints.',
    designRule:
      'Prefer sculptural shapes (helix, torusKnot, gear, icosahedron, dodecahedron, star, dnaHelix, terrain, waveSurface, capsule) paired with trackTo / ikChains.',
    parameters: [
      {
        param: 'object.shape',
        type: 'ThreeDShapeType',
        recommendedValues: 'torusKnot, helix, gear, dnaHelix, waveSurface, crystal, star, terrain, capsule',
        rangeOrOptions: '27 Three.js primitives & parametric meshes',
        notes: 'Avoid defaulting new objects to plain boxes.',
      },
      {
        param: 'material',
        type: 'ThreeDMaterialType',
        recommendedValues: 'hologram, chrome, glass, neon, gold, iridescent, obsidian, toon',
        rangeOrOptions: '20 PBR presets + roughness (0.05..0.95) & metalness (0..1)',
        notes: 'Combine bloom: true with neon/hologram for emissive glow.',
      },
      {
        param: 'lighting',
        type: 'ThreeDLightingPreset',
        recommendedValues: 'cyberpunk, cosmic, studio, sunset, neon, arctic',
        rangeOrOptions: '12 lighting rigs with fogDensity (0.01..0.06) & exposure (0.8..1.4)',
        notes: 'Cosmic & cyberpunk pair best with starfield: true.',
      },
      {
        param: 'ikChains[] & trackTo',
        type: 'FABRIK + Aim',
        recommendedValues: 'iterations=6..10, pole=[0,2.2,2.0], aimBones=true',
        rangeOrOptions: 'Resolves joint positions & quaternion orientation per frame',
        notes: 'Objects can chase any orbiting or path-animated target.',
      },
    ],
    examples: [
      {
        id: 'three-dna-observatory',
        title: 'Non-Euclidean DNA Helix & Gear Observatory',
        prompt:
          'Generate a threejs/v1 scene with a spinning dnaHelix core, twin gold gears, crystal dodecahedron satellites, and cosmic starfield.',
        description: 'Pure non-cube WebGL scene demonstrating parametric DNA, gears, and faceted gems.',
        language: 'threejs',
        code: JSON.stringify(
          {
            format: 'threejs/v1',
            title: 'Quantum DNA Observatory',
            lighting: 'cosmic',
            background: '#050816',
            starfield: true,
            bloom: true,
            fogDensity: 0.028,
            objects: [
              { id: 'dna_core', shape: 'dnaHelix', material: 'hologram', color: '#38bdf8', position: [0, 0.4, 0], scale: [1.1, 1.3, 1.1], animation: 'spinY', speed: 0.8 },
              { id: 'base_gear', shape: 'gear', material: 'gold', color: '#fbbf24', position: [0, -1.2, 0], rotation: [1.57, 0, 0], scale: [1.8, 1.8, 0.35], animation: 'spinZ', speed: -0.6 },
              { id: 'gem_sat', shape: 'dodecahedron', material: 'neon', color: '#f472b6', position: [2.5, 0.8, 0], scale: [0.5, 0.5, 0.5], animation: 'orbit', speed: 1.2 },
            ],
          },
          null,
          2
        ),
        keyValues: { fogDensity: 0.028, bloom: 'true', shapes: 'dnaHelix, gear, dodecahedron' },
      },
      {
        id: 'three-fabrik-arm',
        title: '6-Iteration FABRIK Articulated Scanner',
        prompt: 'Build a threejs/v1 robotic arm with capsule joints using FABRIK ikChains tracking an orbiting crystal sphere.',
        description: 'Demonstrates articulated 3-joint IK with pole vector stabilization.',
        language: 'threejs',
        code: JSON.stringify(
          {
            format: 'threejs/v1',
            title: 'FABRIK Articulated Scanner',
            lighting: 'cyberpunk',
            background: '#070b18',
            starfield: true,
            objects: [
              { id: 'arm_base', shape: 'capsule', material: 'chrome', color: '#94a3b8', position: [0, 0, 0], scale: [0.4, 1.4, 0.4] },
              { id: 'arm_mid', shape: 'capsule', material: 'copper', color: '#fb923c', position: [0, 1.4, 0], scale: [0.34, 1.3, 0.34] },
              { id: 'arm_head', shape: 'octahedron', material: 'neon', color: '#22d3ee', position: [0, 2.7, 0], scale: [0.42, 0.42, 0.42] },
              { id: 'beacon', shape: 'icosahedron', material: 'hologram', color: '#f472b6', position: [2.0, 1.6, 0.8], scale: [0.36, 0.36, 0.36], animation: 'orbit', speed: 1.1 },
            ],
            ikChains: [
              { nodes: ['arm_base', 'arm_mid', 'arm_head'], target: 'beacon', pole: [0, 2.5, 2.2], iterations: 8, aimBones: true },
            ],
          },
          null,
          2
        ),
        keyValues: { ikIterations: 8, poleVector: '[0, 2.5, 2.2]', speed: 1.1 },
      },
    ],
  },
  {
    id: 'stopmotion',
    engineName: 'Stop Motion v3 Engine (stopmotion/v3)',
    format: 'stopmotion/v3',
    summary:
      'Procedural SVG vector choreography dataset covering 16 brushes, 22 studio defs, 21 math curves, 2-bone analytical IK expressions, particles, and camera cuts.',
    designRule:
      'Layer 5–12 atmospheric SVG elements using built-in <defs> (wetGlaze*, metallic*), parallax depth, contact shadows, math easings, and synced audio.',
    parameters: [
      {
        param: 'fps & durationSec',
        type: 'number',
        recommendedValues: 'fps=24..30, durationSec=3..6',
        rangeOrOptions: 'fps: 1..60, frameCount <= 216,000',
        notes: 'Higher durationSec smooths orbital curves.',
      },
      {
        param: 'fill / filter defs',
        type: 'SVG URL ref',
        recommendedValues: 'url(#wetGlazeCyan), url(#metallicGold), url(#iridescentHologram), url(#neonBloom)',
        rangeOrOptions: '22 built-in gradients + filters',
        notes: 'Zero external asset URLs required.',
      },
      {
        param: 'curve',
        type: 'string',
        recommendedValues: 'spirograph, lissajous, hilbert, rose, butterfly, phyllotaxis, fourier',
        rangeOrOptions: '21 parametric & fractal curve generators',
        notes: 'Combine with stroke brushes like neon, sparkle, or calligraphy.',
      },
      {
        param: 'motion.* expressions',
        type: 'AST string',
        recommendedValues: 'ik2d_elbow_x(tx,ty,110,90,1), backOut(clamp(t*1.6,0,1)), lerp(a,b,u)',
        rangeOrOptions: '130+ math & IK functions + 36 easings',
        notes: 'Supports time t (0..1), TAU, PI, and sec.',
      },
    ],
    examples: [
      {
        id: 'stopmotion-spirograph-stage',
        title: 'Luminous Spirograph + Orbiting WetGlaze Pendulum',
        prompt:
          'Generate a stopmotion/v3 scene combining a neon spirograph curve, parallax stardust particles, a wetGlazeCyan pendulum orb, and ambient chime audio.',
        description: 'Combines procedural curve paths, built-in studio glazes, particles, and WebAudio synthesis.',
        language: 'stopmotion',
        code: JSON.stringify(
          {
            format: 'stopmotion/v3',
            title: 'Harmonic Spirograph Observatory',
            width: 640,
            height: 360,
            fps: 24,
            durationSec: 4,
            background: 'linear-gradient(180deg, #050816 0%, #1e1b4b 100%)',
            effect: 'cyberpunk',
            particles: { count: 32, color: '#38bdf8', style: 'spark' },
            layers: [
              {
                id: 'harmonic_rose',
                type: 'curve',
                curve: 'spirograph',
                cx: 320,
                cy: 180,
                R: 110,
                r: 38,
                d: 58,
                stroke: '#22d3ee',
                strokeWidth: 2.5,
                brush: 'neon',
                motion: { rotation: 't * 180', scale: '0.9 + 0.1 * sin(t * TAU)' },
              },
              {
                id: 'glaze_satellite',
                type: 'circle',
                cx: 320,
                cy: 180,
                r: 22,
                fill: 'url(#wetGlazePink)',
                filter: 'url(#softGlow)',
                motion: {
                  x: 'orbitx(320, 115, t * TAU)',
                  y: 'orbity(180, 75, t * TAU)',
                  trail: true,
                },
              },
            ],
            audio: { mode: 'preset', preset: 'chime_celesta', durationSec: 4 },
          },
          null,
          2
        ),
        keyValues: { fps: 24, durationSec: 4, brush: 'neon', curve: 'spirograph' },
      },
    ],
  },
  {
    id: 'pixelart',
    engineName: 'Pixel Engine v3 (pixelart/v3)',
    format: 'pixelart/v3',
    summary:
      'High-speed procedural raster dataset up to 512x512 featuring named palettes, Bayer4/Bayer8 dither gradients, Phong sphere3d, aurora/plasma shaders, and 18 post effects.',
    designRule:
      'Use procedural "draw" ops (aurora, plasma, sphere3d, ring, star, stardust, waves) with Bayer dithering and shaders — no manual frames array needed.',
    parameters: [
      {
        param: 'width x height',
        type: 'number',
        recommendedValues: '64x64, 128x128, 256x256, 512x512',
        rangeOrOptions: '1..512 px',
        notes: '128x128 or 256x256 balances crisp pixel art & fast baking.',
      },
      {
        param: 'palette',
        type: 'string | string[]',
        recommendedValues: 'cyberpunk, synthwave, pico8, sweetie16, endesga32, fantasy24',
        rangeOrOptions: '13 built-in palettes or custom hex arrays',
        notes: 'Applies harmonious quantization across dither ops.',
      },
      {
        param: 'draw[] ops',
        type: 'PixelDrawOp[]',
        recommendedValues: 'gradient(dither="bayer4"), aurora, plasma, stardust, sphere3d, waves, hitbox',
        rangeOrOptions: '30+ procedural draw ops',
        notes: 'Blend with opacity (0..1) and blendMode ("add"|"screen"|"overlay").',
      },
      {
        param: 'shaders[]',
        type: 'PixelShader[]',
        recommendedValues: 'bloom(0.45), crt(0.35), vignette(0.4), chromatic(0.2)',
        rangeOrOptions: '18 post-processing shaders',
        notes: 'Stack 2-3 light shaders for arcade finish.',
      },
    ],
    examples: [
      {
        id: 'pixel-dithered-planet',
        title: '128x128 Bayer-Dithered Exoplanet & Aurora',
        prompt:
          'Generate a 128x128 pixelart/v3 nightscape with Bayer4 linear sky gradient, shimmering aurora, stardust, Phong-shaded sphere3d planet, and bloom+crt shaders.',
        description: 'Multi-pass procedural pixel shader composition without manual frame bitmaps.',
        language: 'pixelart',
        code: JSON.stringify(
          {
            format: 'pixelart/v3',
            title: 'Dithered Exoplanet Dawn',
            width: 128,
            height: 128,
            fps: 12,
            frameCount: 16,
            palette: 'synthwave',
            draw: [
              { op: 'gradient', type: 'linear', colors: ['#0b0d1f', '#1e1b4b', '#312e81'], dither: 'bayer4' },
              { op: 'stardust', count: 65, color: '#e0f2fe' },
              { op: 'aurora', y: 18, amp: 8, h: 24, colors: ['#22d3ee', '#818cf8', '#f472b6'] },
              { op: 'sphere3d', cx: 64, cy: 66, r: 26, color: '#38bdf8', light: [-0.6, -0.7, 0.5], dither: 'bayer4' },
              { op: 'ring', cx: 64, cy: 66, rx: 40, ry: 11, color: '#f472b6', tilt: -0.22 },
            ],
            shaders: [
              { type: 'bloom', intensity: 0.45 },
              { type: 'vignette', intensity: 0.35 },
            ],
          },
          null,
          2
        ),
        keyValues: { resolution: '128x128', dither: 'bayer4', frameCount: 16, palette: 'synthwave' },
      },
    ],
  },
  {
    id: 'hybrid',
    engineName: 'Hybrid Engine (liquidmotion/v1)',
    format: 'liquidmotion/v1',
    summary:
      'Dual-pipeline compositing dataset blending procedural Pixel Engine v3 backdrops beneath 60fps Stop Motion v3 vector silhouettes and particle emitters.',
    designRule:
      'Pair a 160x90 pixelBackdrop (dithered plasma/aurora/water) using "screen" or "add" blending with high-contrast SVG hero layers and rim lighting.',
    parameters: [
      {
        param: 'pixelBlendMode & pixelOpacity',
        type: 'string / number',
        recommendedValues: 'pixelBlendMode="screen"|"add", pixelOpacity=0.85..0.95, pixelScale=2',
        rangeOrOptions: 'screen | add | overlay | normal; opacity 0..1',
        notes: 'Screen blend lifts bright stars/auroras over SVG skies.',
      },
      {
        param: 'letterbox & postFilter',
        type: 'number / CSS filter',
        recommendedValues: 'letterbox=20..28, postFilter="contrast(1.08) saturate(1.18)"',
        rangeOrOptions: 'letterbox: 0..48 px',
        notes: 'Adds anamorphic cinema framing cleanly.',
      },
    ],
    examples: [
      {
        id: 'hybrid-lantern-glade',
        title: 'Bioluminescent Pixel Bayou + Vector Fireflies',
        prompt:
          'Generate a liquidmotion/v1 hybrid clip combining a 160x90 pixelart plasma/aurora bayou backdrop with vector firefly orbs and ambient audio.',
        description: 'Shows pixelBackdrop + vector motion layer + particle FX + math audio.',
        language: 'liquidmotion',
        code: JSON.stringify(
          {
            format: 'liquidmotion/v1',
            title: 'Bioluminescent Bayou Hybrid',
            width: 640,
            height: 360,
            fps: 30,
            durationSec: 5,
            pixelScale: 2,
            pixelBlendMode: 'screen',
            pixelOpacity: 0.9,
            letterbox: 22,
            pixelBackdrop: {
              format: 'pixelart/v3',
              width: 160,
              height: 90,
              draw: [
                { op: 'gradient', type: 'linear', colors: ['#050816', '#0f172a', '#134e4a'], dither: 'bayer4' },
                { op: 'aurora', y: 12, amp: 5, h: 18, colors: ['#2dd4bf', '#38bdf8'] },
                { op: 'water', y: 62, h: 28, color: '#0f766e', highlight: '#5eead4' },
              ],
            },
            particles: { count: 40, color: '#fde047', style: 'sparkle', speed: 1.2 },
            layers: [
              {
                id: 'firefly_leader',
                type: 'circle',
                cx: 320,
                cy: 170,
                r: 18,
                fill: 'url(#wetGlazeCyan)',
                filter: 'url(#neonBloom)',
                motion: { x: 'lissajousx(320, 180, t * TAU, 2)', y: 'lissajousy(165, 55, t * TAU, 3)', trail: true },
              },
            ],
            audio: { mode: 'preset', preset: 'ambient_chime', durationSec: 5 },
          },
          null,
          2
        ),
        keyValues: { pixelBackdrop: '160x90', pixelBlendMode: 'screen', letterbox: 22 },
      },
    ],
  },
  {
    id: 'ik-math',
    engineName: 'Unified IK & Math Kernel (130+ Functions)',
    format: 'math-ast',
    summary:
      'Calibrated numeric dataset for the 11 Inverse Kinematics & LookAt solvers plus physics, noise, and easing expressions shared across every Folio engine.',
    designRule:
      'Keep limb reach d <= l1 + l2 and >= |l1 - l2| for smooth joint bending; the kernel clamps distances safely even at full extension.',
    parameters: [
      {
        param: 'ik2d_theta1 / ik2d_theta2',
        type: '(tx, ty, l1, l2, bend?) => rad',
        recommendedValues: 'l1=120, l2=100, bend=1 (elbow up) or -1 (elbow down)',
        rangeOrOptions: 'Law-of-cosines analytical 2-bone solver (radians)',
        notes: 'Use ik2d_deg1/2 for degrees in SVG transform="rotate(...)".',
      },
      {
        param: 'ik2d_elbow_x / ik2d_elbow_y',
        type: '(tx, ty, l1, l2, bend?) => px',
        recommendedValues: 'ik2d_elbow_x(tx, ty, 120, 100, 1)',
        rangeOrOptions: 'Exact intermediate joint coordinate',
        notes: 'Connect shoulder -> elbow -> target directly in Stop Motion v3.',
      },
      {
        param: 'ik3d_mid_x / _y / _z',
        type: '(ax,ay,az, tx,ty,tz, l1,l2, px,py,pz) => unit',
        recommendedValues: 'pole=[0, 4.5, 2.0], l1=2.2, l2=2.2',
        rangeOrOptions: '3D 2-bone IK with arbitrary pole vector',
        notes: 'Guarantees zero gimbal flip along pole plane.',
      },
      {
        param: 'lookat_yaw / lookat_pitch',
        type: '(ax,az,tx,tz) / (ax,ay,az,tx,ty,tz) => deg',
        recommendedValues: 'rotationY: lookat_yaw(0, 0, tx, tz)',
        rangeOrOptions: 'Returns degrees in [-180, 180]',
        notes: 'Pairs cleanly with procedural orbitx/orbity targets.',
      },
    ],
    examples: [
      {
        id: 'ik-2bone-svg',
        title: 'Stop Motion v3 Analytical 2-Bone IK Limb Dataset Example',
        prompt:
          'Show an exact numeric Stop Motion v3 arm rig using ik2d_elbow_x, ik2d_elbow_y, and ik2d_deg1 reaching an orbiting target.',
        description: 'Demonstrates exact IK parameter values plugged straight into live SVG expressions.',
        language: 'stopmotion',
        code: JSON.stringify(
          {
            format: 'stopmotion/v3',
            title: '2-Bone Analytical IK Limb',
            width: 640,
            height: 360,
            fps: 24,
            durationSec: 4,
            background: '#090d16',
            layers: [
              {
                id: 'upper_arm',
                type: 'rect',
                x: 240,
                y: 220,
                width: 110,
                height: 16,
                rx: 8,
                fill: 'url(#metallicChrome)',
                motion: { rotation: 'ik2d_deg1(140 * cos(t * TAU), -60 + 50 * sin(t * TAU), 110, 95, 1)' },
              },
              {
                id: 'effector_orb',
                type: 'circle',
                cx: 240,
                cy: 220,
                r: 14,
                fill: 'url(#wetGlazeCyan)',
                motion: { x: '240 + 140 * cos(t * TAU)', y: '160 + 50 * sin(t * TAU)' },
              },
            ],
          },
          null,
          2
        ),
        keyValues: { l1: 110, l2: 95, bend: 1, fps: 24 },
      },
    ],
  },
];

export function searchEngineDatasets(query: string, engineId?: string): EngineDataset[] {
  const base = engineId
    ? ENGINE_DATASETS.filter((d) => d.id === engineId)
    : ENGINE_DATASETS;
  const q = query.trim().toLowerCase();
  if (!q) return base;
  const terms = q.split(/[^a-z0-9_.-]+/).filter((t) => t.length >= 2);
  if (terms.length === 0) return base;
  return base.filter((ds) => {
    const hay = [
      ds.id,
      ds.engineName,
      ds.format,
      ds.summary,
      ds.designRule,
      ...ds.parameters.map((p) => `${p.param} ${p.recommendedValues} ${p.rangeOrOptions} ${p.notes}`),
      ...ds.examples.map((ex) => `${ex.title} ${ex.prompt} ${ex.description}`),
    ]
      .join(' ')
      .toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
}
