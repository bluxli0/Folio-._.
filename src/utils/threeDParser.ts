import { ThreeDSceneSpec } from '../types/threeD';

export function parseThreeDCode(rawCode: string): { spec?: ThreeDSceneSpec; error?: string } {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { error: '3D scene code is empty.' };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as ThreeDSceneSpec | Array<unknown>;
      const spec: ThreeDSceneSpec = Array.isArray(parsed)
        ? {
            title: 'Custom 3D Scene',
            background: '#090d16',
            lighting: 'studio',
            autoRotate: true,
            bloom: true,
            shadows: true,
            objects: [],
          }
        : parsed;

      if (!spec.objects) spec.objects = [];
      if (!spec.background) spec.background = '#090d16';
      if (!spec.lighting) spec.lighting = 'studio';
      return { spec };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid 3D JSON spec.' };
    }
  }

  // If raw Three.js JavaScript / HTML code
  return {
    spec: {
      title: 'Custom Three.js Script',
      background: '#090d16',
      lighting: 'studio',
      autoRotate: false,
      bloom: false,
      shadows: true,
      objects: [],
      customJsCode: trimmed,
    },
  };
}

export function serializeThreeDToCode(spec: ThreeDSceneSpec): string {
  return JSON.stringify(spec, null, 2);
}

export function buildThreeJsHtml(spec: ThreeDSceneSpec): string {
  const bg = spec.background || '#090d16';
  const objectsJson = JSON.stringify(spec.objects || []);
  const lighting = spec.lighting || 'studio';
  const autoRotate = Boolean(spec.autoRotate);

  const customScript = spec.customJsCode
    ? `try { ${spec.customJsCode} } catch(e) { console.error(e); }`
    : `
      const objectsData = ${objectsJson};
      const meshes = [];

      objectsData.forEach((obj) => {
        let geom;
        switch (obj.shape) {
          case 'box': geom = new THREE.BoxGeometry(1, 1, 1); break;
          case 'sphere': geom = new THREE.SphereGeometry(0.8, 32, 32); break;
          case 'torus': geom = new THREE.TorusGeometry(0.8, 0.3, 24, 48); break;
          case 'torusKnot': geom = new THREE.TorusKnotGeometry(0.6, 0.2, 64, 16); break;
          case 'cylinder': geom = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 32); break;
          case 'cone': geom = new THREE.ConeGeometry(0.8, 1.6, 32); break;
          case 'icosahedron': geom = new THREE.IcosahedronGeometry(1.0, 0); break;
          case 'octahedron': geom = new THREE.OctahedronGeometry(1.0, 0); break;
          case 'dodecahedron': geom = new THREE.DodecahedronGeometry(1.0, 0); break;
          default: geom = new THREE.BoxGeometry(1, 1, 1);
        }

        let mat;
        const color = obj.color || '#38bdf8';
        const roughness = obj.roughness ?? 0.3;
        const metalness = obj.metalness ?? 0.8;
        const wireframe = Boolean(obj.wireframe);

        switch (obj.material) {
          case 'glass':
            mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, metalness: 0.1, transmission: 0.9, thickness: 1.2, ior: 1.5, transparent: true, opacity: 0.85, wireframe });
            break;
          case 'gold':
            mat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.15, metalness: 0.95, wireframe });
            break;
          case 'neon':
            mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
            break;
          case 'clay':
            mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, wireframe });
            break;
          case 'wireframe':
            mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
            break;
          case 'toon':
            mat = new THREE.MeshToonMaterial({ color, wireframe });
            break;
          case 'normal':
            mat = new THREE.MeshNormalMaterial({ wireframe });
            break;
          default:
            mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, wireframe });
        }

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(...(obj.position || [0,0,0]));
        mesh.rotation.set(...(obj.rotation || [0,0,0]));
        mesh.scale.set(...(obj.scale || [1,1,1]));
        mesh.userData = { anim: obj.animation || 'rotate', speed: obj.speed ?? 1.0 };
        scene.add(mesh);
        meshes.push(mesh);
      });

      // Animation loop
      const clock = new THREE.Clock();
      function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        if (${autoRotate}) {
          scene.rotation.y = time * 0.25;
        }

        meshes.forEach((m) => {
          const anim = m.userData.anim;
          const spd = m.userData.speed;
          if (anim === 'rotate') {
            m.rotation.x += delta * spd * 0.8;
            m.rotation.y += delta * spd * 1.0;
          } else if (anim === 'bounce') {
            m.position.y += Math.sin(time * spd * 3) * 0.01;
          } else if (anim === 'pulse') {
            const sc = 1 + Math.sin(time * spd * 3) * 0.12;
            m.scale.set(sc, sc, sc);
          } else if (anim === 'float') {
            m.position.y += Math.sin(time * spd * 2) * 0.008;
            m.rotation.z += delta * spd * 0.4;
          } else if (anim === 'orbit') {
            m.rotation.y += delta * spd * 1.5;
          } else if (anim === 'chaos') {
            m.rotation.x += delta * spd * 1.2;
            m.rotation.z += delta * spd * 0.9;
          }
        });

        renderer.render(scene, camera);
      }
      animate();
    `;

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; overflow: hidden; background: ${bg}; font-family: system-ui, sans-serif; width: 100vw; height: 100vh; }
    #canvas-container { width: 100%; height: 100%; display: block; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/three@0.174.0/build/three.min.js"></script>
</head>
<body>
  <div id="canvas-container"></div>
  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('${bg}');

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting setup (${lighting})
    const ambientLight = new THREE.AmbientLight(
      '${lighting === 'sunset' ? '#fed7aa' : lighting === 'cyberpunk' ? '#06b6d4' : lighting === 'matrix' ? '#4ade80' : '#ffffff'}',
      ${lighting === 'dramatic' ? 0.8 : 1.4}
    );
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(
      '${lighting === 'sunset' ? '#f97316' : lighting === 'cyberpunk' ? '#ec4899' : '#ffffff'}',
      ${lighting === 'dramatic' ? 2.5 : 2.0}
    );
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight('#38bdf8', 1.5, 50);
    pointLight.position.set(-5, -3, -3);
    scene.add(pointLight);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    ${customScript}
  </script>
</body>
</html>`;
}
