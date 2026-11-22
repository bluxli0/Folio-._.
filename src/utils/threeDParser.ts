import { ThreeDSceneSpec } from '../types/threeD';

export function parseThreeDCode(rawCode: string): { spec?: ThreeDSceneSpec; error?: string } {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { error: '3D scene code is empty.' };
  }

  const unfenced = trimmed
    .replace(/^```(?:threejs|three|bbmodel|json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (unfenced.startsWith('{') || unfenced.startsWith('[')) {
    try {
      const parsed = JSON.parse(unfenced) as
        | (ThreeDSceneSpec & Record<string, unknown>)
        | Array<unknown>;

      if (!Array.isArray(parsed) && Array.isArray(parsed.elements) && ('outliner' in parsed || 'meta' in parsed || 'resolution' in parsed)) {
        return {
          spec: {
            title:
              typeof parsed.name === 'string' && parsed.name
                ? parsed.name
                : typeof parsed.model_identifier === 'string' && parsed.model_identifier
                ? parsed.model_identifier
                : 'Blockbench Model',
            background: '#0f172a',
            lighting: 'studio',
            autoRotate: true,
            bloom: false,
            shadows: true,
            objects: [],
            bbmodel: parsed,
          },
        };
      }

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
      customJsCode: unfenced,
    },
  };
}

export function serializeThreeDToCode(spec: ThreeDSceneSpec): string {
  if (spec.bbmodel) {
    return JSON.stringify(spec.bbmodel, null, 2);
  }
  return JSON.stringify(spec, null, 2);
}

function sanitizeCustomThreeJsCode(raw: string): string {
  return raw
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/\bnew\s+OrbitControls\s*\(/g, 'new THREE.OrbitControls(')
    .replace(/<\/script>/gi, '<\\/script>')
    .trim();
}

export function buildThreeJsHtml(spec: ThreeDSceneSpec): string {
  const bg = spec.background || '#090d16';
  const objectsJson = JSON.stringify(spec.objects || []).replace(/<\/script>/gi, '<\\/script>');
  const bbmodelJson = spec.bbmodel
    ? JSON.stringify(spec.bbmodel).replace(/<\/script>/gi, '<\\/script>')
    : 'null';
  const voxelsJson = spec.voxels
    ? JSON.stringify(spec.voxels).replace(/<\/script>/gi, '<\\/script>')
    : 'null';
  const lighting = spec.lighting || 'studio';
  const autoRotate = Boolean(spec.autoRotate);

  const vendorOrigin =
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
      ? window.location.origin
      : '';
  const vendorScriptUrl = `${vendorOrigin}/api/vendor/three.min.js`;

  const cleanedCustomCode = spec.customJsCode
    ? sanitizeCustomThreeJsCode(spec.customJsCode)
    : '';
  const customOwnsScene =
    Boolean(cleanedCustomCode) &&
    /\bnew\s+THREE\.(Scene|WebGLRenderer)\b/.test(cleanedCustomCode);

  const customScript = cleanedCustomCode
    ? customOwnsScene
      ? `
        try {
          (function(THREE, OrbitControls, container) {
            ${cleanedCustomCode}
          })(window.THREE, window.THREE && window.THREE.OrbitControls, container);
          if (!document.querySelector('canvas')) {
            const firstBodyCanvas = Array.from(document.body.children).find((el) => el.tagName === 'CANVAS');
            if (firstBodyCanvas) container.appendChild(firstBodyCanvas);
          }
        } catch (e) {
          showThreeError('3D script error: ' + (e && e.message ? e.message : String(e)));
          console.error(e);
        }
      `
      : `
        const setup = setupDefaultStudioScene();
        if (setup) {
          const { scene, camera, renderer, updateOrbitCamera } = setup;
          let customStartedLoop = false;
          const origRaf = window.requestAnimationFrame;
          window.requestAnimationFrame = function(cb) {
            customStartedLoop = true;
            return origRaf.call(window, cb);
          };
          try {
            (function(THREE, OrbitControls, scene, camera, renderer, container) {
              ${cleanedCustomCode}
            })(window.THREE, window.THREE && window.THREE.OrbitControls, scene, camera, renderer, container);
          } catch (e) {
            showThreeError('3D script error: ' + (e && e.message ? e.message : String(e)));
            console.error(e);
          } finally {
            window.requestAnimationFrame = origRaf;
          }
          if (!customStartedLoop) {
            function fallbackAnimate() {
              requestAnimationFrame(fallbackAnimate);
              updateOrbitCamera();
              renderer.render(scene, camera);
            }
            fallbackAnimate();
          }
        }
      `
    : spec.bbmodel
    ? `
      const setup = setupDefaultStudioScene();
      if (setup) {
        const { scene, camera, renderer, updateOrbitCamera, getOrbitState, setOrbitYaw, setCameraTargetDist } = setup;
        const bbData = ${bbmodelJson};
        const SCALE = 1 / 16;
        const rootGroup = new THREE.Group();
        scene.add(rootGroup);

        const texEntries = (bbData.textures || []).map((t) => {
          if (!t || !t.source) return null;
          const img = new Image();
          const tex = new THREE.Texture(img);
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          img.onload = () => { tex.needsUpdate = true; };
          img.src = t.source;
          return { id: String(t.id ?? t.uuid ?? ''), tex };
        }).filter(Boolean);

        const paletteHex = ['#38bdf8','#f43f5e','#f59e0b','#10b981','#a855f7','#94a3b8','#f97316','#ec4899'];
        const elemByUuid = new Map();
        const pivotNodes = new Map();

        function buildElementMesh(el, idx) {
          if (!el || !Array.isArray(el.from) || !Array.isArray(el.to)) return null;
          const dx = Math.max(0.01, Math.abs(el.to[0] - el.from[0])) * SCALE;
          const dy = Math.max(0.01, Math.abs(el.to[1] - el.from[1])) * SCALE;
          const dz = Math.max(0.01, Math.abs(el.to[2] - el.from[2])) * SCALE;
          const cx = ((el.from[0] + el.to[0]) / 2) * SCALE;
          const cy = ((el.from[1] + el.to[1]) / 2) * SCALE;
          const cz = ((el.from[2] + el.to[2]) / 2) * SCALE;

          const geom = new THREE.BoxGeometry(dx, dy, dz);
          const col = typeof el.color === 'string'
            ? el.color
            : paletteHex[(typeof el.color === 'number' ? el.color : idx) % paletteHex.length];

          let chosenTex = null;
          if (el.faces && texEntries.length > 0) {
            for (const faceKey of ['north','south','east','west','up','down']) {
              const f = el.faces[faceKey];
              if (f && f.texture !== undefined && f.texture !== false && f.texture !== null) {
                const found = texEntries[Number(f.texture)] || texEntries.find((t) => t.id === String(f.texture));
                if (found) { chosenTex = found.tex; break; }
              }
            }
          }
          const mat = chosenTex
            ? new THREE.MeshStandardMaterial({ map: chosenTex, roughness: 0.65, metalness: 0.08, transparent: true, alphaTest: 0.1 })
            : new THREE.MeshStandardMaterial({ color: col, roughness: 0.52, metalness: 0.12 });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const orig = Array.isArray(el.origin) ? el.origin.map((v) => v * SCALE) : [cx, cy, cz];
          const pivot = new THREE.Group();
          pivot.position.set(orig[0], orig[1], orig[2]);
          if (Array.isArray(el.rotation)) {
            pivot.rotation.set(
              THREE.MathUtils.degToRad(el.rotation[0] || 0),
              THREE.MathUtils.degToRad(el.rotation[1] || 0),
              THREE.MathUtils.degToRad(el.rotation[2] || 0)
            );
          }
          mesh.position.set(cx - orig[0], cy - orig[1], cz - orig[2]);
          pivot.add(mesh);
          return pivot;
        }

        (bbData.elements || []).forEach((el, idx) => {
          const obj = buildElementMesh(el, idx);
          if (obj) {
            const key = el.uuid || ('el-' + idx);
            elemByUuid.set(key, obj);
          }
        });

        const placedUuids = new Set();
        function attachOutlinerNode(node, parentGroup, parentOrigin) {
          if (typeof node === 'string') {
            const m = elemByUuid.get(node);
            if (m) {
              m.position.x -= parentOrigin[0];
              m.position.y -= parentOrigin[1];
              m.position.z -= parentOrigin[2];
              parentGroup.add(m);
              placedUuids.add(node);
            }
            return;
          }
          if (node && typeof node === 'object') {
            const g = new THREE.Group();
            const orig = Array.isArray(node.origin) ? node.origin.map((v) => v * SCALE) : [0, 0, 0];
            g.position.set(orig[0] - parentOrigin[0], orig[1] - parentOrigin[1], orig[2] - parentOrigin[2]);
            if (Array.isArray(node.rotation)) {
              g.rotation.set(
                THREE.MathUtils.degToRad(node.rotation[0] || 0),
                THREE.MathUtils.degToRad(node.rotation[1] || 0),
                THREE.MathUtils.degToRad(node.rotation[2] || 0)
              );
            }
            g.userData.baseRot = [g.rotation.x, g.rotation.y, g.rotation.z];
            g.userData.basePos = [g.position.x, g.position.y, g.position.z];
            if (node.uuid) pivotNodes.set(node.uuid, g);
            if (node.name) pivotNodes.set(node.name, g);
            parentGroup.add(g);
            if (Array.isArray(node.children)) {
              node.children.forEach((ch) => attachOutlinerNode(ch, g, orig));
            }
          }
        }

        if (Array.isArray(bbData.outliner) && bbData.outliner.length > 0) {
          bbData.outliner.forEach((n) => attachOutlinerNode(n, rootGroup, [0, 0, 0]));
        }
        elemByUuid.forEach((obj, uuid) => {
          if (!placedUuids.has(uuid)) rootGroup.add(obj);
        });

        const box = new THREE.Box3().setFromObject(rootGroup);
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const sizeVec = box.getSize(new THREE.Vector3());
          rootGroup.position.sub(center);
          const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 1.5);
          setCameraTargetDist(maxDim * 2.1);
        }

        const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
        gridHelper.position.y = -((box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).y) / 2);
        scene.add(gridHelper);

        const animations = Array.isArray(bbData.animations) ? bbData.animations : [];
        const clock = new THREE.Clock();

        function evalKfVec(kfs, timeSec, fallback) {
          if (!Array.isArray(kfs) || kfs.length === 0) return fallback;
          const sorted = [...kfs].sort((a, b) => (a.time || 0) - (b.time || 0));
          const len = sorted[sorted.length - 1].time || 1;
          const t = len > 0 ? timeSec % len : 0;
          let a = sorted[0], b = sorted[sorted.length - 1];
          for (let i = 0; i < sorted.length - 1; i += 1) {
            if (t >= (sorted[i].time || 0) && t <= (sorted[i + 1].time || 0)) {
              a = sorted[i]; b = sorted[i + 1]; break;
            }
          }
          const span = ((b.time || 0) - (a.time || 0)) || 1;
          const u = Math.max(0, Math.min(1, (t - (a.time || 0)) / span));
          const dpA = (a.data_points && a.data_points[0]) || {};
          const dpB = (b.data_points && b.data_points[0]) || {};
          return [
            Number(dpA.x || 0) + (Number(dpB.x || 0) - Number(dpA.x || 0)) * u,
            Number(dpA.y || 0) + (Number(dpB.y || 0) - Number(dpA.y || 0)) * u,
            Number(dpA.z || 0) + (Number(dpB.z || 0) - Number(dpA.z || 0)) * u,
          ];
        }

        function animate() {
          requestAnimationFrame(animate);
          const time = clock.getElapsedTime();
          updateOrbitCamera();
          const st = getOrbitState();
          if (${autoRotate} && !st.isDragging) {
            setOrbitYaw(st.yaw + 0.004);
          }
          if (animations.length > 0 && animations[0].animators) {
            const anim = animations[0];
            Object.entries(anim.animators).forEach(([key, animData]) => {
              const grp = pivotNodes.get(key) || pivotNodes.get(animData.name);
              if (!grp || !Array.isArray(animData.keyframes)) return;
              const rotKfs = animData.keyframes.filter((k) => k.channel === 'rotation');
              const posKfs = animData.keyframes.filter((k) => k.channel === 'position');
              if (rotKfs.length > 0 && grp.userData.baseRot) {
                const r = evalKfVec(rotKfs, time, [0,0,0]);
                grp.rotation.set(
                  grp.userData.baseRot[0] + THREE.MathUtils.degToRad(r[0]),
                  grp.userData.baseRot[1] + THREE.MathUtils.degToRad(r[1]),
                  grp.userData.baseRot[2] + THREE.MathUtils.degToRad(r[2])
                );
              }
              if (posKfs.length > 0 && grp.userData.basePos) {
                const p = evalKfVec(posKfs, time, [0,0,0]);
                grp.position.set(
                  grp.userData.basePos[0] + p[0] * SCALE,
                  grp.userData.basePos[1] + p[1] * SCALE,
                  grp.userData.basePos[2] + p[2] * SCALE
                );
              }
            });
          }
          renderer.render(scene, camera);
        }
        animate();
      }
    `
    : spec.voxels
    ? `
      const setup = setupDefaultStudioScene();
      if (setup) {
        const { scene, camera, renderer, updateOrbitCamera, getOrbitState, setOrbitYaw, setCameraTargetDist } = setup;
        const voxelsData = ${voxelsJson} || [];
        const voxelGroup = new THREE.Group();
        scene.add(voxelGroup);
        voxelsData.forEach((v) => {
          const s = v.size || 0.96;
          const g = new THREE.BoxGeometry(s, s, s);
          const m = new THREE.MeshStandardMaterial({ color: v.color || '#38bdf8', roughness: 0.45, metalness: 0.15 });
          const mesh = new THREE.Mesh(g, m);
          mesh.position.set(v.x || 0, v.y || 0, v.z || 0);
          voxelGroup.add(mesh);
        });
        const vbox = new THREE.Box3().setFromObject(voxelGroup);
        if (!vbox.isEmpty()) {
          const center = vbox.getCenter(new THREE.Vector3());
          const sizeVec = vbox.getSize(new THREE.Vector3());
          voxelGroup.position.sub(center);
          setCameraTargetDist(Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 2) * 2.1);
        }
        function animate() {
          requestAnimationFrame(animate);
          updateOrbitCamera();
          const st = getOrbitState();
          if (${autoRotate} && !st.isDragging) setOrbitYaw(st.yaw + 0.004);
          renderer.render(scene, camera);
        }
        animate();
      }
    `
    : `
      const setup = setupDefaultStudioScene();
      if (setup) {
        const { scene, camera, renderer, updateOrbitCamera, getOrbitState, setOrbitYaw } = setup;
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

        const clock = new THREE.Clock();
        function animate() {
          requestAnimationFrame(animate);
          const delta = clock.getDelta();
          const time = clock.getElapsedTime();
          updateOrbitCamera();
          const st = getOrbitState();

          if (${autoRotate} && !st.isDragging) {
            setOrbitYaw(st.yaw + 0.003);
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
      }
    `;

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; overflow: hidden; background: ${bg}; font-family: system-ui, sans-serif; width: 100%; height: 100%; cursor: grab; }
    body:active { cursor: grabbing; }
    #canvas-container { width: 100%; height: 100%; display: block; position: relative; }
    #three-error-banner {
      display: none; position: absolute; inset: 12px; padding: 14px 16px;
      border-radius: 10px; background: rgba(127, 29, 29, 0.9); color: #fecaca;
      border: 1px solid rgba(248, 113, 113, 0.45); font-size: 12px; line-height: 1.5;
      font-family: ui-monospace, monospace; z-index: 20; overflow: auto;
    }
  </style>
  <script src="${vendorScriptUrl}" onerror="window.__threeVendorFailed=true;"></script>
</head>
<body>
  <div id="canvas-container">
    <div id="three-error-banner"></div>
  </div>
  <script>
    const container = document.getElementById('canvas-container');
    const errorBanner = document.getElementById('three-error-banner');

    function showThreeError(msg) {
      if (!errorBanner) return;
      errorBanner.style.display = 'block';
      errorBanner.textContent = msg;
    }

    function setupDefaultStudioScene() {
      if (typeof THREE === 'undefined') {
        showThreeError('Three.js runtime failed to load.');
        return null;
      }
      const w = Math.max(container.clientWidth || window.innerWidth || 520, 120);
      const h = Math.max(container.clientHeight || window.innerHeight || 325, 120);

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      } catch (err) {
        showThreeError('WebGL initialization failed: ' + (err && err.message ? err.message : String(err)));
        return null;
      }
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('${bg}');

      const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 1000);
      let orbitYaw = 0.65;
      let orbitPitch = 0.32;
      let cameraTargetDist = 6.2;
      let isDraggingOrbit = false;
      let lastPtrX = 0;
      let lastPtrY = 0;

      function updateOrbitCamera() {
        const dist = Math.max(1.8, Math.min(36, cameraTargetDist));
        const cp = Math.cos(orbitPitch);
        camera.position.set(
          dist * Math.sin(orbitYaw) * cp,
          dist * Math.sin(orbitPitch),
          dist * Math.cos(orbitYaw) * cp
        );
        camera.lookAt(0, 0, 0);
      }
      updateOrbitCamera();

      container.addEventListener('pointerdown', (e) => {
        isDraggingOrbit = true;
        lastPtrX = e.clientX;
        lastPtrY = e.clientY;
      });
      window.addEventListener('pointerup', () => { isDraggingOrbit = false; });
      window.addEventListener('pointermove', (e) => {
        if (!isDraggingOrbit) return;
        const dx = e.clientX - lastPtrX;
        const dy = e.clientY - lastPtrY;
        lastPtrX = e.clientX;
        lastPtrY = e.clientY;
        orbitYaw -= dx * 0.01;
        orbitPitch = Math.max(-1.35, Math.min(1.35, orbitPitch + dy * 0.01));
      });
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        cameraTargetDist = Math.max(1.8, Math.min(36, cameraTargetDist + e.deltaY * 0.008));
      }, { passive: false });

      const ambientLight = new THREE.AmbientLight(
        '${lighting === 'sunset' ? '#fed7aa' : lighting === 'cyberpunk' ? '#06b6d4' : lighting === 'matrix' ? '#4ade80' : '#ffffff'}',
        ${lighting === 'dramatic' ? 0.8 : 1.45}
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

      const handleResize = () => {
        const nw = Math.max(container.clientWidth || window.innerWidth || 520, 120);
        const nh = Math.max(container.clientHeight || window.innerHeight || 325, 120);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener('resize', handleResize);
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(handleResize).observe(container);
      }

      return {
        scene,
        camera,
        renderer,
        updateOrbitCamera,
        getOrbitState: () => ({ yaw: orbitYaw, pitch: orbitPitch, isDragging: isDraggingOrbit }),
        setOrbitYaw: (v) => { orbitYaw = v; },
        setCameraTargetDist: (v) => { cameraTargetDist = v; },
      };
    }

    window.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === 'folio-three-snapshot-request') {
        const c = document.querySelector('canvas');
        if (c) {
          try {
            parent.postMessage({
              type: 'folio-three-snapshot-data',
              requestId: ev.data.requestId,
              dataUrl: c.toDataURL('image/png'),
            }, '*');
          } catch (err) {}
        }
      }
    });

    function bootThreeScene() {
      if (typeof THREE === 'undefined') {
        showThreeError('Three.js failed to load from local runtime.');
        return;
      }
      ${customScript}
    }

    if (typeof THREE !== 'undefined') {
      bootThreeScene();
    } else {
      const cdnFallback = document.createElement('script');
      cdnFallback.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
      cdnFallback.onload = bootThreeScene;
      cdnFallback.onerror = () => showThreeError('Could not load Three.js library.');
      document.head.appendChild(cdnFallback);
    }
  </script>
</body>
</html>`;
}

