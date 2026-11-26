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
      spec.objects = spec.objects.map((o) => {
        const anyO = o as unknown as Record<string, unknown>;
        const resolvedShape = (o.shape || anyO.type || anyO.geometry) as ThreeDSceneSpec['objects'][number]['shape'] | undefined;
        return resolvedShape ? { ...o, shape: resolvedShape } : o;
      });
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
  const ikChainsJson = JSON.stringify(spec.ikChains || []).replace(/<\/script>/gi, '<\\/script>');
  const bbmodelJson = spec.bbmodel
    ? JSON.stringify(spec.bbmodel).replace(/<\/script>/gi, '<\\/script>')
    : 'null';
  const voxelsJson = spec.voxels
    ? JSON.stringify(spec.voxels).replace(/<\/script>/gi, '<\\/script>')
    : 'null';
  const lighting = spec.lighting || 'studio';
  const autoRotate = Boolean(spec.autoRotate);
  const showHitboxes = Boolean(spec.showHitboxes);
  const defaultFloorY = typeof spec.physicsFloorY === 'number' ? spec.physicsFloorY : -1.8;
  const fogColor = spec.fogColor || '';
  const fogDensity = typeof spec.fogDensity === 'number' ? spec.fogDensity : 0;
  const starfieldCount = spec.starfield === true ? 280 : typeof spec.starfield === 'number' ? Math.max(0, Math.min(2000, spec.starfield)) : 0;
  const showGridFloor = Boolean(spec.gridFloor);
  const cameraFov = typeof spec.cameraFov === 'number' ? Math.max(20, Math.min(110, spec.cameraFov)) : 48;
  const exposure = typeof spec.exposure === 'number' ? spec.exposure : 1.05;

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
        const ikChainsData = ${ikChainsJson};
        const showGlobalHitboxes = ${showHitboxes};
        const defaultFloorY = ${defaultFloorY};
        const hasAnyPhysics = objectsData.some((o) => (o.physics && o.physics.enabled !== false) || o.animation === 'physicsBounce');
        if (hasAnyPhysics || showGlobalHitboxes) {
          const physGrid = new THREE.GridHelper(10, 16, 0x38bdf8, 0x1e293b);
          physGrid.position.y = defaultFloorY;
          scene.add(physGrid);
        }

        const meshes = [];
        const meshById = new Map();

        objectsData.forEach((obj) => {
          const repCount = typeof obj.repeat === 'number'
            ? Math.max(1, Math.min(24, obj.repeat))
            : obj.repeat && typeof obj.repeat === 'object'
            ? Math.max(1, Math.min(24, obj.repeat.count || 1))
            : 1;
          const repRadius = obj.repeat && typeof obj.repeat === 'object' ? (obj.repeat.radius ?? 1.8) : 1.8;
          const repDy = obj.repeat && typeof obj.repeat === 'object' ? (obj.repeat.dy ?? 0) : 0;

          for (let rIdx = 0; rIdx < repCount; rIdx += 1) {
          let geom;
          const resolvedShape = obj.shape || obj.type || obj.geometry || 'icosahedron';
          switch (resolvedShape) {
            case 'box': geom = new THREE.BoxGeometry(1, 1, 1); break;
            case 'sphere': geom = new THREE.SphereGeometry(0.8, 32, 32); break;
            case 'torus': geom = new THREE.TorusGeometry(0.8, 0.3, 24, 48); break;
            case 'torusKnot': geom = new THREE.TorusKnotGeometry(0.6, 0.2, 64, 16); break;
            case 'cylinder': geom = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 32); break;
            case 'cone': geom = new THREE.ConeGeometry(0.8, 1.6, 32); break;
            case 'icosahedron': geom = new THREE.IcosahedronGeometry(1.0, 0); break;
            case 'octahedron': geom = new THREE.OctahedronGeometry(1.0, 0); break;
            case 'dodecahedron': geom = new THREE.DodecahedronGeometry(1.0, 0); break;
            case 'tetrahedron': geom = new THREE.TetrahedronGeometry(1.0, 0); break;
            case 'ring': geom = new THREE.TorusGeometry(0.95, 0.08, 12, 48); break;
            case 'plane': geom = new THREE.PlaneGeometry(3.2, 3.2); break;
            case 'capsule': geom = new THREE.CylinderGeometry(0.45, 0.45, 1.0, 24); break;
            case 'pyramid': geom = new THREE.ConeGeometry(0.9, 1.5, 4); break;
            case 'prism': geom = new THREE.CylinderGeometry(0.7, 0.7, 1.3, 6); break;
            case 'crystal': geom = new THREE.OctahedronGeometry(0.85, 0); break;
            case 'helix':
            case 'dnaHelix':
            case 'splineTube': {
              const pts = [];
              const count = 84;
              for (let idx = 0; idx <= count; idx += 1) {
                const u = idx / count;
                const ang = u * Math.PI * 6 + (obj.shape === 'dnaHelix' && rIdx % 2 === 1 ? Math.PI : 0);
                pts.push(new THREE.Vector3(Math.cos(ang) * 0.75, (u - 0.5) * 2.6, Math.sin(ang) * 0.75));
              }
              geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 84, 0.08, 12, false);
              break;
            }
            case 'mobius': {
              geom = new THREE.PlaneGeometry(1, 1, 48, 8);
              const pos = geom.attributes.position;
              for (let i = 0; i < pos.count; i += 1) {
                const u = (pos.getX(i) + 0.5) * Math.PI * 2;
                const v = pos.getY(i) * 0.42;
                pos.setXYZ(i, (0.9 + v * Math.cos(u * 0.5)) * Math.cos(u), (0.9 + v * Math.cos(u * 0.5)) * Math.sin(u), v * Math.sin(u * 0.5));
              }
              geom.computeVertexNormals();
              break;
            }
            case 'gear': {
              const teeth = 10;
              const shape = new THREE.Shape();
              for (let i = 0; i <= teeth * 4; i += 1) {
                const a = (i / (teeth * 4)) * Math.PI * 2;
                const rad = i % 4 === 1 || i % 4 === 2 ? 1.0 : 0.72;
                if (i === 0) shape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else shape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
              }
              geom = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02 });
              geom.center();
              break;
            }
            case 'star': {
              const shape = new THREE.Shape();
              for (let i = 0; i <= 10; i += 1) {
                const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const rad = i % 2 === 0 ? 1.05 : 0.44;
                if (i === 0) shape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else shape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
              }
              geom = new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02 });
              geom.center();
              break;
            }
            case 'terrain':
            case 'waveSurface': {
              geom = new THREE.PlaneGeometry(3.6, 3.6, 44, 44);
              geom.rotateX(-Math.PI / 2);
              const pos = geom.attributes.position;
              for (let idx = 0; idx < pos.count; idx += 1) {
                const vx = pos.getX(idx);
                const vz = pos.getZ(idx);
                const r = Math.hypot(vx, vz);
                const vy = obj.shape === 'terrain'
                  ? 0.42 * Math.sin(vx * 1.9) * Math.cos(vz * 1.9) + 0.22 * Math.sin(vx * 3.7 + vz * 2.1)
                  : 0.45 * Math.sin(r * 2.8) * Math.exp(-r * 0.22) + 0.16 * Math.cos(vx * 2.2) * Math.sin(vz * 2.2);
                pos.setY(idx, vy);
              }
              geom.computeVertexNormals();
              break;
            }
            case 'klein': {
              geom = new THREE.PlaneGeometry(1, 1, 36, 18);
              const pos = geom.attributes.position;
              for (let i = 0; i < pos.count; i += 1) {
                const u = (pos.getX(i) + 0.5) * Math.PI * 2;
                const v = (pos.getY(i) + 0.5) * Math.PI * 2;
                const rad = 4 * (1 - Math.cos(u) / 2);
                const x = u < Math.PI
                  ? 6 * Math.cos(u) * (1 + Math.sin(u)) + rad * Math.cos(u) * Math.cos(v)
                  : 6 * Math.cos(u) * (1 + Math.sin(u)) + rad * Math.cos(v + Math.PI);
                const y = u < Math.PI
                  ? 16 * Math.sin(u) + rad * Math.sin(u) * Math.cos(v)
                  : 16 * Math.sin(u);
                const z = rad * Math.sin(v);
                pos.setXYZ(i, x * 0.06, y * 0.06, z * 0.06);
              }
              geom.computeVertexNormals();
              break;
            }
            case 'metaball': {
              geom = new THREE.IcosahedronGeometry(0.75, 3);
              const pos = geom.attributes.position;
              for (let i = 0; i < pos.count; i += 1) {
                const vx = pos.getX(i);
                const vy = pos.getY(i);
                const vz = pos.getZ(i);
                const len = Math.hypot(vx, vy, vz) || 1;
                const nx = vx / len, ny = vy / len, nz = vz / len;
                const disp = 1 + 0.16 * Math.sin(nx * 3.2) * Math.cos(ny * 3.2) + 0.09 * Math.sin(nz * 4.5 + nx * 2.1);
                pos.setXYZ(i, vx * disp, vy * disp, vz * disp);
              }
              geom.computeVertexNormals();
              break;
            }
            case 'ikJoint': geom = new THREE.CapsuleGeometry(0.24, 0.9, 8, 20); break;
            case 'star3d': {
              const sShape = new THREE.Shape();
              for (let i = 0; i <= 10; i += 1) {
                const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const rad = i % 2 === 0 ? 1.05 : 0.44;
                if (i === 0) sShape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else sShape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
              }
              geom = new THREE.ExtrudeGeometry(sShape, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02 });
              geom.center();
              break;
            }
            case 'lathe': {
              const lPts = [
                new THREE.Vector2(0.02, -0.7),
                new THREE.Vector2(0.7, -0.45),
                new THREE.Vector2(0.35, 0),
                new THREE.Vector2(0.75, 0.45),
                new THREE.Vector2(0.4, 0.7),
              ];
              geom = new THREE.LatheGeometry(lPts, 28);
              break;
            }
            case 'graphRibbon': {
              const pts = [];
              const count = 96;
              for (let idx = 0; idx <= count; idx += 1) {
                const u = idx / count;
                const x = -1.6 + u * 3.2;
                const y = Math.sin(u * Math.PI * 4) * 0.55 + Math.cos(u * Math.PI * 2) * 0.25;
                const z = Math.cos(u * Math.PI * 4) * 0.45;
                pts.push(new THREE.Vector3(x, y, z));
              }
              const curve = new THREE.CatmullRomCurve3(pts);
              geom = new THREE.TubeGeometry(curve, 96, 0.09, 14, false);
              break;
            }
            default: geom = new THREE.IcosahedronGeometry(0.85, 1);
          }

          let useVertexGradient = false;
          if (Array.isArray(obj.gradientColors) && obj.gradientColors.length >= 2) {
            const pos = geom.attributes.position;
            geom.computeBoundingBox();
            const bb = geom.boundingBox;
            if (pos && bb) {
              const spanX = Math.max(1e-4, bb.max.x - bb.min.x);
              const stops = obj.gradientColors.map((c) => new THREE.Color(c));
              const cols = new Float32Array(pos.count * 3);
              const tmp = new THREE.Color();
              for (let idx = 0; idx < pos.count; idx += 1) {
                const u = Math.max(0, Math.min(1, (pos.getX(idx) - bb.min.x) / spanX));
                const scaled = u * (stops.length - 1);
                const i0 = Math.min(stops.length - 1, Math.floor(scaled));
                const i1 = Math.min(stops.length - 1, i0 + 1);
                tmp.copy(stops[i0]).lerp(stops[i1], scaled - i0);
                cols[idx * 3] = tmp.r;
                cols[idx * 3 + 1] = tmp.g;
                cols[idx * 3 + 2] = tmp.b;
              }
              geom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
              useVertexGradient = true;
            }
          }

          let mat;
          const color = useVertexGradient ? '#ffffff' : (obj.color || '#38bdf8');
          const roughness = obj.roughness ?? 0.3;
          const metalness = obj.metalness ?? 0.8;
          const wireframe = Boolean(obj.wireframe);
          const flatShading = Boolean(obj.flatShading);
          const opacity = typeof obj.opacity === 'number' ? obj.opacity : 1;
          const sideOpt = resolvedShape === 'waveSurface' || resolvedShape === 'terrain' || resolvedShape === 'mobius' || resolvedShape === 'klein' || resolvedShape === 'plane' ? THREE.DoubleSide : THREE.FrontSide;
          const emColor = obj.emissive || '#000000';
          const emInt = obj.emissiveIntensity ?? (obj.emissive ? 0.8 : 0);

          switch (obj.material) {
            case 'glass':
            case 'glassTinted':
              mat = new THREE.MeshPhysicalMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, roughness: 0.08, metalness: 0.08, transmission: 0.88, thickness: 1.2, ior: 1.5, transparent: true, opacity: obj.material === 'glassTinted' ? 0.65 : 0.85, wireframe });
              break;
            case 'gold':
              mat = new THREE.MeshStandardMaterial({ color: useVertexGradient ? '#ffffff' : '#facc15', vertexColors: useVertexGradient, side: sideOpt, roughness: 0.15, metalness: 0.95, wireframe, flatShading });
              break;
            case 'chrome':
              mat = new THREE.MeshStandardMaterial({ color: useVertexGradient ? '#ffffff' : '#e2e8f0', vertexColors: useVertexGradient, side: sideOpt, roughness: 0.06, metalness: 0.98, wireframe });
              break;
            case 'copper':
              mat = new THREE.MeshStandardMaterial({ color: useVertexGradient ? '#ffffff' : '#d97757', vertexColors: useVertexGradient, side: sideOpt, roughness: 0.22, metalness: 0.92, wireframe });
              break;
            case 'carbon':
              mat = new THREE.MeshStandardMaterial({ color: '#1e293b', vertexColors: useVertexGradient, side: sideOpt, roughness: 0.36, metalness: 0.65, wireframe });
              break;
            case 'obsidian':
              mat = new THREE.MeshStandardMaterial({ color: '#09090b', vertexColors: useVertexGradient, side: sideOpt, roughness: 0.08, metalness: 0.85, wireframe });
              break;
            case 'lava':
              mat = new THREE.MeshStandardMaterial({ color: '#ea580c', emissive: '#f97316', emissiveIntensity: 1.35, side: sideOpt, roughness: 0.5, metalness: 0.15, wireframe });
              break;
            case 'ice':
              mat = new THREE.MeshPhysicalMaterial({ color: '#bae6fd', side: sideOpt, roughness: 0.12, metalness: 0.08, transmission: 0.78, ior: 1.31, transparent: true, opacity: 0.88, wireframe });
              break;
            case 'emerald':
              mat = new THREE.MeshPhysicalMaterial({ color: '#10b981', side: sideOpt, roughness: 0.1, metalness: 0.15, transmission: 0.68, ior: 1.57, transparent: true, opacity: 0.9, wireframe });
              break;
            case 'hologram':
            case 'iridescent':
              mat = new THREE.MeshPhysicalMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, roughness: 0.14, metalness: 0.25, iridescence: 1.0, emissive: obj.emissive || '#38bdf8', emissiveIntensity: 0.55, transparent: true, opacity: obj.material === 'hologram' ? 0.68 : opacity, wireframe });
              break;
            case 'additiveGlow':
              mat = new THREE.MeshBasicMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, wireframe });
              break;
            case 'neon':
              mat = new THREE.MeshBasicMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, wireframe: true });
              break;
            case 'clay':
            case 'matte':
              mat = new THREE.MeshStandardMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, roughness: 0.94, metalness: 0.03, wireframe, flatShading });
              break;
            case 'wireframe':
              mat = new THREE.MeshBasicMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, wireframe: true });
              break;
            case 'toon':
              mat = new THREE.MeshToonMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, wireframe });
              break;
            case 'normal':
              mat = new THREE.MeshNormalMaterial({ side: sideOpt, wireframe, flatShading });
              break;
            default:
              mat = new THREE.MeshStandardMaterial({ color, vertexColors: useVertexGradient, side: sideOpt, roughness, metalness, emissive: emColor, emissiveIntensity: emInt, transparent: opacity < 1, opacity, wireframe, flatShading });
          }

          let mesh;
          if (obj.shape === 'particleCloud') {
            const pCount = 260;
            const pPos = new Float32Array(pCount * 3);
            for (let pi = 0; pi < pCount; pi += 1) {
              const a = (pi * 2.39996) % (Math.PI * 2);
              const phi = Math.acos(1 - 2 * ((pi + 0.5) / pCount));
              const rr = 0.4 + 0.9 * ((pi % 9) / 8);
              pPos[pi * 3] = Math.sin(phi) * Math.cos(a) * rr;
              pPos[pi * 3 + 1] = Math.cos(phi) * rr;
              pPos[pi * 3 + 2] = Math.sin(phi) * Math.sin(a) * rr;
            }
            const pg = new THREE.BufferGeometry();
            pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
            const pm = new THREE.PointsMaterial({ color: obj.color || '#38bdf8', size: 0.07, transparent: true, opacity: opacity });
            mesh = new THREE.Points(pg, pm);
          } else {
            mesh = new THREE.Mesh(geom, mat);
          }

          const baseP = obj.position || [0,0,0];
          const repAngle = repCount > 1 ? (rIdx / repCount) * Math.PI * 2 : 0;
          const offX = repCount > 1 ? Math.cos(repAngle) * repRadius : 0;
          const offZ = repCount > 1 ? Math.sin(repAngle) * repRadius : 0;
          const offY = repCount > 1 ? repDy * rIdx : 0;
          mesh.position.set(baseP[0] + offX, baseP[1] + offY, baseP[2] + offZ);
          mesh.rotation.set(...(obj.rotation || [0,0,0]));
          const baseScale = obj.scale || [1,1,1];
          mesh.scale.set(...baseScale);

          geom.computeBoundingBox();
          const localBb = geom.boundingBox;
          const halfSize = new THREE.Vector3(0.5, 0.5, 0.5);
          if (localBb) {
            const sz = localBb.getSize(new THREE.Vector3());
            halfSize.set(
              Math.max(0.1, sz.x * Math.abs(mesh.scale.x) * 0.5),
              Math.max(0.1, sz.y * Math.abs(mesh.scale.y) * 0.5),
              Math.max(0.1, sz.z * Math.abs(mesh.scale.z) * 0.5)
            );
          }

          const physEnabled = Boolean((obj.physics && obj.physics.enabled !== false) || obj.animation === 'physicsBounce');
          const showHb = Boolean(showGlobalHitboxes || obj.hitbox || physEnabled);
          const hbIdleHex = obj.hitboxColor || '#22d3ee';
          const hbCollideHex = obj.collideColor || '#f43f5e';
          let boxHelper = null;
          if (showHb && !(mesh instanceof THREE.Points)) {
            boxHelper = new THREE.BoxHelper(mesh, new THREE.Color(hbIdleHex));
            scene.add(boxHelper);
          }

          mesh.userData = {
            id: obj.id,
            trackTo: obj.trackTo,
            anim: obj.animation || 'rotate',
            speed: obj.speed ?? 1.0,
            basePos: [mesh.position.x, mesh.position.y, mesh.position.z],
            baseScale: [...baseScale],
            physEnabled,
            vel: new THREE.Vector3(
              obj.physics && typeof obj.physics.vx === 'number' ? obj.physics.vx : (physEnabled ? 1.2 : 0),
              obj.physics && typeof obj.physics.vy === 'number' ? obj.physics.vy : 0,
              obj.physics && typeof obj.physics.vz === 'number' ? obj.physics.vz : 0
            ),
            gravity: obj.physics && typeof obj.physics.gravity === 'number' ? obj.physics.gravity : -9.8,
            restitution: obj.physics && typeof obj.physics.restitution === 'number' ? obj.physics.restitution : 0.85,
            drag: obj.physics && typeof obj.physics.drag === 'number' ? obj.physics.drag : 0,
            attractor: obj.physics && obj.physics.attractor ? obj.physics.attractor : null,
            floorY: obj.physics && typeof obj.physics.floorY === 'number' ? obj.physics.floorY : defaultFloorY,
            walls: (obj.physics && Array.isArray(obj.physics.walls) ? obj.physics.walls : [3.2, 3.6, 3.2]),
            mass: (obj.physics && typeof obj.physics.mass === 'number' ? obj.physics.mass : 1.0),
            halfSize,
            boxHelper,
            hbIdleColor: new THREE.Color(hbIdleHex),
            hbCollideColor: new THREE.Color(hbCollideHex),
            hitFlash: 0,
            box3: new THREE.Box3(),
          };
          scene.add(mesh);
          meshes.push(mesh);
          if (obj.id && !meshById.has(obj.id)) meshById.set(obj.id, mesh);
          }
        });

        const ikChainLengths = new Map();
        (ikChainsData || []).forEach((chain) => {
          if (!chain || !Array.isArray(chain.nodes) || chain.nodes.length < 2) return;
          const lens = [];
          for (let k = 0; k < chain.nodes.length - 1; k += 1) {
            const j0 = meshById.get(chain.nodes[k]);
            const j1 = meshById.get(chain.nodes[k + 1]);
            lens.push(j0 && j1 ? Math.max(0.1, j0.position.distanceTo(j1.position)) : 1.0);
          }
          ikChainLengths.set(chain, lens);
        });

        const clock = new THREE.Clock();
        function animate() {
          requestAnimationFrame(animate);
          const delta = Math.min(0.05, Math.max(0.001, clock.getDelta()));
          const time = clock.getElapsedTime();
          updateOrbitCamera();
          const st = getOrbitState();

          if (${autoRotate} && !st.isDragging) {
            setOrbitYaw(st.yaw + 0.003);
          }

          meshes.forEach((m) => {
            const ud = m.userData;
            if (ud.hitFlash > 0) ud.hitFlash = Math.max(0, ud.hitFlash - delta);
            const anim = ud.anim;
            const spd = ud.speed;
            if (ud.physEnabled) {
              ud.vel.y += ud.gravity * delta;
              if (ud.attractor) {
                const ax = (ud.attractor.x || 0) - m.position.x;
                const ay = (ud.attractor.y || 0) - m.position.y;
                const az = (ud.attractor.z || 0) - m.position.z;
                const d2 = Math.max(0.25, ax * ax + ay * ay + az * az);
                const str = ud.attractor.strength ?? 5;
                ud.vel.x += (ax / Math.sqrt(d2)) * (str / d2) * delta;
                ud.vel.y += (ay / Math.sqrt(d2)) * (str / d2) * delta;
                ud.vel.z += (az / Math.sqrt(d2)) * (str / d2) * delta;
              }
              if (ud.drag) ud.vel.multiplyScalar(Math.max(0, 1 - ud.drag * delta));
              m.position.x += ud.vel.x * delta;
              m.position.y += ud.vel.y * delta;
              m.position.z += ud.vel.z * delta;
              m.rotation.x += delta * spd * 0.45;
              m.rotation.y += delta * spd * 0.65;

              const minY = ud.floorY + ud.halfSize.y;
              if (m.position.y < minY) {
                m.position.y = minY;
                if (Math.abs(ud.vel.y) > 0.25) {
                  ud.vel.y = Math.abs(ud.vel.y) * ud.restitution;
                  ud.hitFlash = 0.14;
                } else {
                  ud.vel.y = 0;
                }
              }
              const wx = Math.max(0.6, ud.walls[0] - ud.halfSize.x);
              const wz = Math.max(0.6, ud.walls[2] - ud.halfSize.z);
              if (m.position.x > wx) { m.position.x = wx; ud.vel.x = -Math.abs(ud.vel.x) * ud.restitution; ud.hitFlash = 0.14; }
              else if (m.position.x < -wx) { m.position.x = -wx; ud.vel.x = Math.abs(ud.vel.x) * ud.restitution; ud.hitFlash = 0.14; }
              if (m.position.z > wz) { m.position.z = wz; ud.vel.z = -Math.abs(ud.vel.z) * ud.restitution; ud.hitFlash = 0.14; }
              else if (m.position.z < -wz) { m.position.z = -wz; ud.vel.z = Math.abs(ud.vel.z) * ud.restitution; ud.hitFlash = 0.14; }
            } else if (anim === 'rotate') {
              m.rotation.x += delta * spd * 0.8;
              m.rotation.y += delta * spd * 1.0;
            } else if (anim === 'spinX') {
              m.rotation.x += delta * spd * 1.4;
            } else if (anim === 'spinZ') {
              m.rotation.z += delta * spd * 1.4;
            } else if (anim === 'bounce') {
              m.position.y = ud.basePos[1] + Math.abs(Math.sin(time * spd * 2.5)) * 0.8;
            } else if (anim === 'pulse' || anim === 'breathing') {
              const amp = anim === 'breathing' ? 0.08 : 0.15;
              const sc = 1 + Math.sin(time * spd * 3) * amp;
              m.scale.set(ud.baseScale[0] * sc, ud.baseScale[1] * sc, ud.baseScale[2] * sc);
            } else if (anim === 'float') {
              m.position.y = ud.basePos[1] + Math.sin(time * spd * 2) * 0.28;
              m.rotation.z += delta * spd * 0.4;
            } else if (anim === 'orbit') {
              const r = Math.max(1.2, Math.hypot(ud.basePos[0], ud.basePos[2]));
              const a = time * spd * 1.2;
              m.position.x = Math.cos(a) * r;
              m.position.z = Math.sin(a) * r;
              m.rotation.y += delta * spd;
            } else if (anim === 'figure8' || anim === 'lissajous') {
              const a = time * spd * 1.4;
              m.position.x = ud.basePos[0] + Math.sin(a * 2) * 1.4;
              m.position.y = ud.basePos[1] + Math.sin(a * 3) * 0.6;
              m.position.z = ud.basePos[2] + Math.cos(a) * 1.1;
            } else if (anim === 'spiral') {
              const u = (time * spd * 0.25) % 1;
              const ang = u * Math.PI * 6;
              const rad = 0.4 + u * 2.2;
              m.position.x = Math.cos(ang) * rad;
              m.position.z = Math.sin(ang) * rad;
              m.position.y = (u - 0.5) * 2.4;
            } else if (anim === 'pendulum' || anim === 'wobble') {
              m.rotation.z = Math.sin(time * spd * 2.8) * (anim === 'pendulum' ? 0.65 : 0.25);
            } else if (anim === 'spring') {
              const u = (time * spd * 0.5) % 1;
              m.position.y = ud.basePos[1] + Math.exp(-3.5 * u) * Math.cos(u * Math.PI * 8) * 0.7;
            } else if (anim === 'explodeLoop') {
              const s = 1 + 0.5 * (0.5 - 0.5 * Math.cos(time * spd * 2));
              m.position.set(ud.basePos[0] * s, ud.basePos[1] * s, ud.basePos[2] * s);
            } else if (anim === 'chaos') {
              m.rotation.x += delta * spd * 1.2;
              m.rotation.z += delta * spd * 0.9;
            }
          });

          // Pairwise Box3 hitbox collision detection & impulse
          meshes.forEach((m) => m.userData.box3.setFromObject(m));
          for (let i = 0; i < meshes.length; i += 1) {
            for (let j = i + 1; j < meshes.length; j += 1) {
              const a = meshes[i];
              const b = meshes[j];
              if (!a.userData.boxHelper && !b.userData.boxHelper && !a.userData.physEnabled && !b.userData.physEnabled) continue;
              if (a.userData.box3.intersectsBox(b.userData.box3)) {
                a.userData.hitFlash = 0.18;
                b.userData.hitFlash = 0.18;
                if (a.userData.physEnabled && b.userData.physEnabled) {
                  const dx = a.position.x - b.position.x;
                  const dy = a.position.y - b.position.y;
                  const dz = a.position.z - b.position.z;
                  const len = Math.hypot(dx, dy, dz) || 1;
                  const nx = dx / len, ny = dy / len, nz = dz / len;
                  a.position.x += nx * 0.04; a.position.y += ny * 0.04; a.position.z += nz * 0.04;
                  b.position.x -= nx * 0.04; b.position.y -= ny * 0.04; b.position.z -= nz * 0.04;
                  const rvx = a.userData.vel.x - b.userData.vel.x;
                  const rvy = a.userData.vel.y - b.userData.vel.y;
                  const rvz = a.userData.vel.z - b.userData.vel.z;
                  const vn = rvx * nx + rvy * ny + rvz * nz;
                  if (vn < 0) {
                    const e = Math.min(a.userData.restitution, b.userData.restitution);
                    const imp = (-(1 + e) * vn) / (1 / a.userData.mass + 1 / b.userData.mass);
                    a.userData.vel.x += (imp / a.userData.mass) * nx;
                    a.userData.vel.y += (imp / a.userData.mass) * ny;
                    a.userData.vel.z += (imp / a.userData.mass) * nz;
                    b.userData.vel.x -= (imp / b.userData.mass) * nx;
                    b.userData.vel.y -= (imp / b.userData.mass) * ny;
                    b.userData.vel.z -= (imp / b.userData.mass) * nz;
                  }
                }
              }
            }
          }

          // Solve FABRIK IK chains & trackTo constraints
          if (Array.isArray(ikChainsData) && ikChainsData.length > 0) {
            const upVec = new THREE.Vector3(0, 1, 0);
            ikChainsData.forEach((chain) => {
              if (!chain || !Array.isArray(chain.nodes) || chain.nodes.length < 2) return;
              const joints = chain.nodes.map((id) => meshById.get(id)).filter(Boolean);
              if (joints.length < 2) return;
              const lens = ikChainLengths.get(chain) || joints.slice(0, -1).map(() => 1.0);
              let tVec = joints[joints.length - 1].position.clone();
              if (chain.targetId && meshById.get(chain.targetId)) {
                tVec = meshById.get(chain.targetId).position.clone();
              } else if (Array.isArray(chain.targetPos)) {
                tVec.set(chain.targetPos[0] || 0, chain.targetPos[1] || 0, chain.targetPos[2] || 0);
              }
              const rootP = joints[0].position.clone();
              const pts = joints.map((j) => j.position.clone());
              const iters = Math.max(1, Math.min(20, chain.iterations || 8));
              for (let it = 0; it < iters; it += 1) {
                pts[pts.length - 1].copy(tVec);
                for (let k = pts.length - 2; k >= 0; k -= 1) {
                  const diff = pts[k].clone().sub(pts[k + 1]);
                  const d = diff.length() || 1e-5;
                  pts[k].copy(pts[k + 1]).addScaledVector(diff, lens[k] / d);
                }
                pts[0].copy(rootP);
                for (let k = 0; k < pts.length - 1; k += 1) {
                  const diff = pts[k + 1].clone().sub(pts[k]);
                  const d = diff.length() || 1e-5;
                  pts[k + 1].copy(pts[k]).addScaledVector(diff, lens[k] / d);
                }
              }
              joints.forEach((j, k) => j.position.copy(pts[k]));
              if (chain.aimNodes !== false) {
                for (let k = 0; k < joints.length - 1; k += 1) {
                  const dir = pts[k + 1].clone().sub(pts[k]);
                  if (dir.lengthSq() > 1e-6) {
                    joints[k].quaternion.setFromUnitVectors(upVec, dir.normalize());
                  }
                }
              }
            });
          }

          meshes.forEach((m) => {
            if (m.userData.trackTo) {
              const target = meshById.get(m.userData.trackTo);
              if (target) m.lookAt(target.position);
            }
            if (m.userData.boxHelper) {
              m.userData.boxHelper.update();
              m.userData.boxHelper.material.color.copy(
                m.userData.hitFlash > 0 ? m.userData.hbCollideColor : m.userData.hbIdleColor
              );
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

    // Shared Inverse Kinematics (IK) & Aim Helpers available to all Three.js scenes & custom scripts
    function _ik2dSolve(tx, ty, l1, l2, bend) {
      const a1 = Math.max(1e-4, Number(l1) || 1);
      const a2 = Math.max(1e-4, Number(l2) || 1);
      const dist = Math.min(a1 + a2 - 1e-4, Math.max(Math.abs(a1 - a2) + 1e-4, Math.hypot(tx, ty)));
      const cos2 = Math.max(-1, Math.min(1, (dist * dist - a1 * a1 - a2 * a2) / (2 * a1 * a2)));
      const sgn = Number(bend ?? 1) < 0 ? -1 : 1;
      const t2 = sgn * Math.acos(cos2);
      const t1 = Math.atan2(ty, tx) - Math.atan2(a2 * Math.sin(t2), a1 + a2 * Math.cos(t2));
      return [t1, t2];
    }
    window.ik2d_theta1 = (tx, ty, l1, l2, bend = 1) => _ik2dSolve(tx, ty, l1, l2, bend)[0];
    window.ik2d_theta2 = (tx, ty, l1, l2, bend = 1) => _ik2dSolve(tx, ty, l1, l2, bend)[1];
    window.ik2d_deg1 = (tx, ty, l1, l2, bend = 1) => (_ik2dSolve(tx, ty, l1, l2, bend)[0] * 180) / Math.PI;
    window.ik2d_deg2 = (tx, ty, l1, l2, bend = 1) => (_ik2dSolve(tx, ty, l1, l2, bend)[1] * 180) / Math.PI;
    window.ik2d_elbow_x = (tx, ty, l1, l2, bend = 1) => Math.cos(window.ik2d_theta1(tx, ty, l1, l2, bend)) * (Number(l1) || 1);
    window.ik2d_elbow_y = (tx, ty, l1, l2, bend = 1) => Math.sin(window.ik2d_theta1(tx, ty, l1, l2, bend)) * (Number(l1) || 1);
    function _ik3dMid(ax, ay, az, tx, ty, tz, l1, l2, px = 0, py = 1, pz = 0) {
      const a1 = Math.max(1e-4, Number(l1) || 1);
      const a2 = Math.max(1e-4, Number(l2) || 1);
      const dx = tx - ax, dy = ty - ay, dz = tz - az;
      const rawD = Math.hypot(dx, dy, dz) || 1e-4;
      const d = Math.min(a1 + a2 - 1e-4, Math.max(Math.abs(a1 - a2) + 1e-4, rawD));
      const ux = dx / rawD, uy = dy / rawD, uz = dz / rawD;
      const along = (a1 * a1 - a2 * a2 + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, a1 * a1 - along * along));
      const pvx = px - ax, pvy = py - ay, pvz = pz - az;
      const dot = pvx * ux + pvy * uy + pvz * uz;
      let ox = pvx - dot * ux, oy = pvy - dot * uy, oz = pvz - dot * uz;
      let oLen = Math.hypot(ox, oy, oz);
      if (oLen < 1e-5) {
        ox = Math.abs(uy) < 0.9 ? -uz : 1; oy = 0; oz = Math.abs(uy) < 0.9 ? ux : 0;
        oLen = Math.hypot(ox, oy, oz) || 1;
      }
      return [ax + ux * along + (ox / oLen) * h, ay + uy * along + (oy / oLen) * h, az + uz * along + (oz / oLen) * h];
    }
    window.ik3d_mid_x = (ax, ay, az, tx, ty, tz, l1, l2, px = 0, py = 1, pz = 0) => _ik3dMid(ax, ay, az, tx, ty, tz, l1, l2, px, py, pz)[0];
    window.ik3d_mid_y = (ax, ay, az, tx, ty, tz, l1, l2, px = 0, py = 1, pz = 0) => _ik3dMid(ax, ay, az, tx, ty, tz, l1, l2, px, py, pz)[1];
    window.ik3d_mid_z = (ax, ay, az, tx, ty, tz, l1, l2, px = 0, py = 1, pz = 0) => _ik3dMid(ax, ay, az, tx, ty, tz, l1, l2, px, py, pz)[2];
    window.lookat_yaw = (ax, az, tx, tz) => (Math.atan2(tx - ax, tz - az) * 180) / Math.PI;
    window.lookat_pitch = (ax, ay, az, tx, ty, tz) => (-Math.atan2(ty - ay, Math.hypot(tx - ax, tz - az) || 1e-5) * 180) / Math.PI;

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
      renderer.toneMappingExposure = ${exposure};
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('${bg}');
      if (${fogDensity} > 0 || '${fogColor}') {
        scene.fog = new THREE.FogExp2('${fogColor || bg}', ${fogDensity || 0.03});
      }

      if (${starfieldCount} > 0) {
        const sPos = new Float32Array(${starfieldCount} * 3);
        for (let si = 0; si < ${starfieldCount}; si += 1) {
          const theta = (si * 2.39996) % (Math.PI * 2);
          const phi = Math.acos(1 - 2 * ((si + 0.5) / ${starfieldCount}));
          const rad = 16 + (si % 9) * 1.5;
          sPos[si * 3] = Math.sin(phi) * Math.cos(theta) * rad;
          sPos[si * 3 + 1] = Math.cos(phi) * rad * 0.7;
          sPos[si * 3 + 2] = Math.sin(phi) * Math.sin(theta) * rad;
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.12, transparent: true, opacity: 0.85 })));
      }
      if (${showGridFloor}) {
        const gf = new THREE.GridHelper(16, 24, 0x334155, 0x1e293b);
        gf.position.y = ${defaultFloorY};
        scene.add(gf);
      }

      const camera = new THREE.PerspectiveCamera(${cameraFov}, w / h, 0.1, 1000);
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
        '${lighting === 'sunset' || lighting === 'goldenHour' ? '#fed7aa' : lighting === 'cyberpunk' || lighting === 'arctic' ? '#06b6d4' : lighting === 'vaporwave' ? '#f472b6' : lighting === 'matrix' || lighting === 'emeraldForest' ? '#4ade80' : lighting === 'volcanic' ? '#fb923c' : '#ffffff'}',
        ${lighting === 'dramatic' || lighting === 'noir' || lighting === 'void' ? 0.65 : 1.45}
      );
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(
        '${lighting === 'sunset' || lighting === 'volcanic' ? '#f97316' : lighting === 'cyberpunk' || lighting === 'vaporwave' ? '#ec4899' : lighting === 'arctic' ? '#7dd3fc' : '#ffffff'}',
        ${lighting === 'dramatic' || lighting === 'noir' ? 2.6 : 2.0}
      );
      dirLight.position.set(5, 8, 5);
      dirLight.castShadow = true;
      scene.add(dirLight);

      const pointLight = new THREE.PointLight('${lighting === 'volcanic' ? '#ef4444' : lighting === 'vaporwave' ? '#c084fc' : '#38bdf8'}', 1.5, 50);
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

