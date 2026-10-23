import * as THREE from './vendor/three.module.js';
import { readChasePose } from './camera-pose.mjs';
import { mountWheel } from './wheel-basis.mjs';
import { applyKartOrientation } from './kart-pose.mjs';
import { collisionPositions } from './collision-wireframe.mjs';
import { addOpaqueDepthPass } from './material-depth.mjs';
import { createRaceEffects } from './race-effects.mjs';

// Rendering only: position and heading come from the C/Wasm demo state.
export function createPreviewRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  const skyBackground = new THREE.Color(0x9bc8d4);
  scene.background = skyBackground;
  scene.fog = new THREE.Fog(0x9bc8d4, 85, 200);
  const testFog = scene.fog;
  scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x456357, 2.4));
  const sun = new THREE.DirectionalLight(0xfff2d6, 3.2);
  sun.position.set(-25, 48, 30);
  scene.add(sun);
  const testWorld = new THREE.Group();
  scene.add(testWorld);

  const material = (color, metalness = 0, roughness = 0.8) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), material(0x3f6c68));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  testWorld.add(ground);
  const grid = new THREE.GridHelper(160, 16, 0x8cb5aa, 0x71968e);
  grid.position.y = 0.005;
  testWorld.add(grid);

  const road = material(0x394b55);
  const circuit = new THREE.Mesh(new THREE.RingGeometry(31, 53, 96), road);
  circuit.rotation.x = -Math.PI / 2;
  circuit.position.y = 0.018;
  testWorld.add(circuit);
  const gateColors = [0x55dfff, 0xffca6b, 0xd889ff, 0xffffff];
  [[0, 42], [-42, 0], [0, -42], [42, 0]].forEach(([gx, gy], index) => {
    const gate = new THREE.Mesh(new THREE.BoxGeometry(18, 0.025, 1.2), material(gateColors[index]));
    gate.position.set(gx, 0.045, -gy);
    gate.rotation.y = -Math.atan2(gy, gx);
    testWorld.add(gate);
  });
  const barrier = material(0xea8055, 0.1, 0.55);
  const barrierTop = material(0xffe4b3);
  function box(parent, width, height, depth, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  // The visible walls use the same ±80 m square as the provisional Wasm collision.
  box(testWorld, 160, 0.03, 7, 0, 0.01, 0, road);
  box(testWorld, 7, 0.03, 160, 0, 0.012, 0, road);
  for (const edge of [-80, 80]) {
    box(testWorld, 160, 1.8, 1, 0, 0.9, edge, barrier);
    box(testWorld, 1, 1.8, 160, edge, 0.9, 0, barrier);
    box(testWorld, 160, 0.16, 1.1, 0, 1.86, edge, barrierTop);
    box(testWorld, 1.1, 0.16, 160, edge, 1.86, 0, barrierTop);
  }
  const stripe = material(0xf9e8c4);
  for (let i = -70; i <= 70; i += 10) {
    box(testWorld, 4, 0.015, 0.15, i, 0.035, 0, stripe);
    box(testWorld, 0.15, 0.015, 4, 0, 0.037, i, stripe);
  }
  const start = material(0xffffff);
  for (let i = 0; i < 8; i++) {
    box(testWorld, 0.5, 0.02, 0.8, 3.5, 0.04, -2.8 + i * 0.8, i % 2 ? road : start);
  }

  const kart = new THREE.Group();
  scene.add(kart);
  const proxy = new THREE.Group();
  kart.add(proxy);
  let original = null;
  let originalCharacter = null;
  let originalTrack = null;
  let trackPreview = false;
  let trackDrive = false;
  let lobbyMode = false;
  let lobbyCharacter = null;
  const trackCenter = new THREE.Vector3();
  let trackRadius = 100;
  let originalWheels = [];
  // Presentation-only enlargement. Native C keeps its source kart geometry.
  const kartVisualScale = 1.25 * 1.5;
  const lobbyVisualScale = 0.75 * 1.5;
  let originalBase = 0;
  const shell = material(0x33b6e4, 0.32, 0.32);
  const dark = material(0x192936, 0.18, 0.6);
  const rubber = material(0x161a21);
  const light = material(0xe7faff, 0.1, 0.3);
  const red = material(0xff554e, 0.1, 0.4);
  box(proxy, 2.55, 0.42, 1.65, 0, 0.48, 0, shell);
  box(proxy, 0.7, 0.34, 1.68, 1.15, 0.55, 0, shell);
  box(proxy, 0.35, 0.2, 1.7, -1.38, 0.5, 0, dark);
  box(proxy, 0.35, 0.2, 1.7, 1.48, 0.5, 0, shell);
  box(proxy, 0.75, 0.22, 1.1, -0.22, 0.82, 0, dark);
  box(proxy, 0.26, 0.12, 0.42, 1.58, 0.59, -0.45, light);
  box(proxy, 0.26, 0.12, 0.42, 1.58, 0.59, 0.45, light);
  box(proxy, 0.13, 0.12, 0.3, -1.58, 0.58, -0.48, red);
  box(proxy, 0.13, 0.12, 0.3, -1.58, 0.58, 0.48, red);
  const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.3, 16);
  const wheels = [];
  for (const x of [-0.95, 0.95]) for (const z of [-0.94, 0.94]) {
    const wheel = new THREE.Mesh(wheelGeometry, rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.43, z);
    proxy.add(wheel);
    wheels.push(wheel);
  }
  // Fallback driver only when the locally converted original USD model is absent.
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 12), material(0xffdf7b));
  helmet.position.set(-0.38, 1.43, 0);
  proxy.add(helmet);
  box(proxy, 0.6, 0.43, 0.6, -0.38, 0.99, 0, material(0x4562b5));
  box(proxy, 0.09, 0.16, 0.55, -0.03, 1.12, 0, dark);
  const raceEffects = createRaceEffects(renderer,scene,kart);

  async function loadAsset(name, type) {
    const usd = type !== 'kart' || !['whiteKnight1','cotton11'].includes(name);
    const path = usd ? `./assets/usd/${name}/model.mesh.json` : `./assets/${name}.mesh.json`;
    const response = await fetch(path);
    if (!response.ok) throw new Error(`원본 모델 변환 파일 없음 (${response.status})`);
    const data = await response.json();
    if (!['p5136-preview-mesh-v1', 'p5136-usd-mesh-v1'].includes(data.format) || !Array.isArray(data.parts)) {
      throw new Error('알 수 없는 메시 형식');
    }
    const group = new THREE.Group();
    const nextWheels = [];
    const textures = new Map();
    for (const part of data.parts) {
      // Missing referenced artwork is not replaced with unrelated images.
      if (part.missingTexture) continue;
      const partName = part.name.split('/').at(-2) || part.name;
      // Detachable/animated "mod" nodes have no verified bind transform in
      // this static export. White Knight's attached mod1b side panels are the
      // only such nodes we can safely display without loose triangles.
      if (type === 'kart' && /^mod/i.test(partName) && !/^mod1b/i.test(partName)) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      if (part.uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(part.uvs, 2));
      geometry.setIndex(part.indices);
      geometry.computeVertexNormals();
      const color = partName.startsWith('wheel') ? 0x262a31
        : partName.startsWith('lamp') ? 0xe4f0f2
        : partName === 'seat' ? 0xcbd4da : 0xeeeeee;
      let texture = null;
      if (part.texture) {
        if (!textures.has(part.texture)) {
          textures.set(part.texture, new THREE.TextureLoader().load(`./assets/usd/${name}/${part.texture}`));
        }
        texture = textures.get(part.texture);
      }
      if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        const wrap = value => value === 'clamp' ? THREE.ClampToEdgeWrapping :
          value === 'mirror' ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
        texture.wrapS = wrap(part.wrapS); texture.wrapT = wrap(part.wrapT);
      }
      let alphaMap = null;
      if (part.alphaTexture) {
        if (!textures.has(part.alphaTexture)) {
          textures.set(part.alphaTexture, new THREE.TextureLoader().load(
            `./assets/usd/${name}/${part.alphaTexture}`));
        }
        alphaMap = textures.get(part.alphaTexture);
      }
      // The supplied Dao/Bazzi body atlas is intentionally neutral greyscale;
      // the face is a separate original texture. Apply the body colour at the
      // material stage without altering or replacing either source image.
      const family = name.split('--')[0];
      const characterTint = type === 'character' && partName === 'body'
        ? family === 'dao' ? 0x42b8ff : family === 'bazzi' ? 0xffbb52 : 0xffffff
        : null;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: characterTint ?? (part.baseColor ? new THREE.Color(...part.baseColor) : texture ? 0xffffff : color), map: texture, alphaMap,
        side: part.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
        transparent: Boolean(part.alphaBlend), depthWrite: !part.alphaBlend,
        opacity: part.opacity ?? 1,
        roughness: part.roughness ?? 0.8, metalness: part.metalness ?? 0.08,
        alphaTest: part.alphaTest ? (part.alphaRef ?? 0) / 255 : 0,
      }));
      mesh.userData.sourceName = part.name;
      mesh.userData.textureName = part.texture || '';
      addOpaqueDepthPass(THREE,mesh);
      if (type === 'kart' && partName.startsWith('wheel')) {
        const wheel = mountWheel(mesh);
        group.add(wheel.pivot);
        nextWheels.push(wheel);
      } else group.add(mesh);
    }
    if (usd && type !== 'track') group.rotation.y = Math.PI / 2;
    return { group, nextWheels, data };
  }

  async function setKart(name) {
    const { group, nextWheels, data } = await loadAsset(name, 'kart');
    if (original) {
      kart.remove(original);
      original.traverse((node) => {
        if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); }
      });
    }
    original = group;
    group.updateMatrixWorld(true);
    const modelBounds = new THREE.Box3().setFromObject(group);
    originalBase = -modelBounds.min.y;
    raceEffects.mountKart(modelBounds,kartVisualScale);
    group.scale.setScalar(lobbyMode ? lobbyVisualScale : kartVisualScale);
    group.position.y = originalBase * (lobbyMode ? lobbyVisualScale : kartVisualScale);
    originalWheels = nextWheels;
    kart.add(group);
    proxy.visible = false;
    return `${data.source}: ${data.parts.length}개 부품`;
  }

  async function setCharacter(name) {
    const { group } = await loadAsset(name, 'character');
    if (originalCharacter) {
      kart.remove(originalCharacter);
      originalCharacter.traverse((node) => {
        if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); }
      });
    }
    group.scale.setScalar(0.42 * kartVisualScale);
    group.position.set(-0.25 * kartVisualScale, 0.5 * kartVisualScale, 0);
    originalCharacter = group;
    kart.add(group);
    if (lobbyMode) setLobbyMode(true);
  }

  let collisionOverlay;
  async function toggleCollision() {
    if (!originalTrack) return false;
    if (collisionOverlay?.userData.trackName !== originalTrack.userData.trackName) {
      if (collisionOverlay) { scene.remove(collisionOverlay); collisionOverlay.geometry.dispose(); collisionOverlay.material.dispose(); }
      const response = await fetch(`./assets/usd/${originalTrack.userData.trackName}/collision.ktrk`);
      if (!response.ok) throw new Error('원본 충돌 메시가 없습니다');
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(collisionPositions(new Uint8Array(await response.arrayBuffer())),3));
      collisionOverlay=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x00ffcc,wireframe:true,transparent:true,opacity:0.35,depthWrite:false,side:THREE.DoubleSide}));
      collisionOverlay.userData.trackName=originalTrack.userData.trackName;
      collisionOverlay.visible=false;scene.add(collisionOverlay);
    }
    collisionOverlay.visible=!collisionOverlay.visible;
    return collisionOverlay.visible;
  }
  async function loadTrack(name) {
    if (originalTrack?.userData.trackName === name) return;
    const { group } = await loadAsset(name, 'track');
    if (originalTrack) {
      scene.remove(originalTrack);
      originalTrack.traverse((node) => {
        if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); }
      });
    }
    if (collisionOverlay) collisionOverlay.visible=false;
    originalTrack = group;
    originalTrack.userData.trackName = name;
    // The local KTRK exporter cancels the demo loader's X mirror; visible
    // USD and collision mesh now share their original horizontal orientation.
    originalTrack.scale.x = 1;
    scene.add(group);
    originalTrack.updateMatrixWorld(true);
    const trackFocus = new THREE.Box3();
    group.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      const size = box.getSize(new THREE.Vector3());
      const tag = `${node.userData.sourceName} ${node.userData.textureName}`.toLowerCase();
      if (Math.max(size.x, size.z) < 700 && box.getCenter(new THREE.Vector3()).y > 100) {
        trackFocus.union(box);
      }

    });
    const bounds = new THREE.Box3().setFromObject(group);
    const focus = trackFocus.isEmpty() ? bounds : trackFocus;
    focus.getCenter(trackCenter);
    const size = focus.getSize(new THREE.Vector3());
    trackRadius = Math.max(Math.max(size.x, size.z) * 0.55, 30);
  }

  async function setTrackDrive(name) {
    await loadTrack(name);
    trackPreview = false;
    trackDrive = true;
    originalTrack.visible = !lobbyMode;
    testWorld.visible = false;
    kart.visible = true;
    scene.fog = null;
    camera.far = 650;
    firstFrame = true;
  }

  function setLobbyMode(enabled) {
    lobbyMode = enabled;
    scene.background = enabled ? null : skyBackground;
    if (original) {
      const scale = enabled ? lobbyVisualScale : kartVisualScale;
      original.scale.setScalar(scale);
      original.position.y = originalBase * scale;
    }
    if (originalCharacter) originalCharacter.scale.setScalar(
      0.42 * (enabled ? lobbyVisualScale : kartVisualScale));
    if (originalCharacter) originalCharacter.position.set(
      -0.25 * (enabled ? lobbyVisualScale : kartVisualScale),
      0.5 * (enabled ? lobbyVisualScale : kartVisualScale), 0);
    if (originalTrack && trackDrive) originalTrack.visible = !enabled;
    if (lobbyCharacter) {
      kart.remove(lobbyCharacter);
      lobbyCharacter = null;
    }
    if (originalCharacter) {
      originalCharacter.visible = !enabled;
      if (enabled) {
        lobbyCharacter = originalCharacter.clone(true);
        lobbyCharacter.visible = true;
        lobbyCharacter.scale.setScalar(0.80);
        lobbyCharacter.position.set(-1.4, -0.05, 0.45);
        lobbyCharacter.rotation.y = Math.PI;
        kart.add(lobbyCharacter);
      }
    }
    firstFrame = true;
  }

  async function toggleTrackPreview(name) {
    if (trackPreview) {
      trackPreview = false;
      scene.fog = testFog;
      testWorld.visible = true;
      kart.visible = true;
      if (originalTrack) originalTrack.visible = false;
      firstFrame = true;
      return false;
    }
    await loadTrack(name);
    trackPreview = true;
    scene.fog = null;
    originalTrack.visible = true;
    testWorld.visible = false;
    kart.visible = false;
    firstFrame = true;
    return true;
  }

  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 350);
  // Match the game's landscape horizontal field of view even when the app's
  // browser panel is tall; a fixed vertical FOV made the kart fill that panel.
  const fittedFov = (landscapeFov) => camera.aspect >= 16 / 9 ? landscapeFov :
    Math.min(104, THREE.MathUtils.radToDeg(2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(landscapeFov / 2)) * (16 / 9) / camera.aspect)));
  camera.position.set(-8, 5, 0);
  let overhead = false;
  let firstFrame = true;
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const smoothedLook = new THREE.Vector3();
  const previews = new WeakMap();

  function renderPreview(previewCanvas) {
    if (!original || !previewCanvas) return;
    let preview = previews.get(previewCanvas);
    if (!preview) {
      const miniRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
      miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      miniRenderer.outputColorSpace = THREE.SRGBColorSpace;
      const miniScene = new THREE.Scene();
      miniScene.add(new THREE.HemisphereLight(0xffffff, 0x55667d, 3));
      const miniSun = new THREE.DirectionalLight(0xffffff, 2);
      miniSun.position.set(3, 6, 4);
      miniScene.add(miniSun);
      const miniCamera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
      preview = { renderer: miniRenderer, scene: miniScene, camera: miniCamera, display: null };
      previews.set(previewCanvas, preview);
    }
    if (preview.display) preview.scene.remove(preview.display);
    const display = new THREE.Group();
    const kartCopy = original.clone(true);
    kartCopy.scale.setScalar(lobbyVisualScale);
    kartCopy.position.y = originalBase * lobbyVisualScale;
    display.add(kartCopy);
    if (originalCharacter) {
      const characterCopy = originalCharacter.clone(true);
      characterCopy.visible = true;
      characterCopy.scale.setScalar(0.42 * lobbyVisualScale);
      characterCopy.position.set(-0.25 * lobbyVisualScale, 0.5 * lobbyVisualScale, 0);
      display.add(characterCopy);
    }
    preview.scene.add(display);
    preview.display = display;
    const bounds = new THREE.Box3().setFromObject(display);
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() * 0.5;
    const width = Math.max(previewCanvas.clientWidth, 1);
    const height = Math.max(previewCanvas.clientHeight, 1);
    preview.renderer.setSize(width, height, false);
    preview.camera.aspect = width / height;
    preview.camera.position.copy(center).add(new THREE.Vector3(radius * 1.8, radius * 1.1, radius * 1.8));
    preview.camera.lookAt(center);
    preview.camera.updateProjectionMatrix();
    preview.renderer.render(preview.scene, preview.camera);
  }
  const lobbyRight = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function render(state, frameDeltaMs = 16) {
    const [x, y, heading, vx, vy, , speed, , boost, drifting] = state;
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    if (canvas.width !== Math.round(width * renderer.getPixelRatio()) ||
        canvas.height !== Math.round(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    // Native suspension equilibrates at road height (four contacts each at
    // 0.5 compression), not at the initial airborne spawn height of +0.5.
    // originalBase already mounts the visual wheel bottoms at that origin.
    kart.position.set(x, state[14] || 0, -y);
    if (lobbyMode) kart.rotation.y = heading + Math.PI / 2;
    else applyKartOrientation(kart, state);
    if (originalCharacter && !lobbyMode) {
      // Pose the imported original mesh as a single rigid rider until its
      // 1s skeleton/bind animation can be recovered from the local archive.
      originalCharacter.rotation.x = originalCharacter.rotation.z = 0;
    }
    shell.color.setHex(boost > 0 ? 0xffcd4f : drifting ? 0xf779a8 : 0x33b6e4);
    raceEffects.update(state,frameDeltaMs,!lobbyMode && !trackPreview);
    const localSpeed = vx * Math.cos(heading) + vy * Math.sin(heading);
    for (const wheel of wheels) wheel.rotation.z -= localSpeed * Math.min(frameDeltaMs, 50) / 1000 / 0.43;
    for (const wheel of originalWheels) {
      wheel.mesh.rotation.z -= localSpeed * Math.min(frameDeltaMs, 50) / 1000 /
        (wheel.radius * kartVisualScale);
      wheel.pivot.rotation.y = wheel.front ? state[13] : 0;
    }

    if (trackPreview) {
      const orbit = performance.now() * 0.00012;
      desired.set(trackCenter.x + Math.cos(orbit) * trackRadius * 1.25,
        trackCenter.y + trackRadius * 0.7,
        trackCenter.z + Math.sin(orbit) * trackRadius * 1.25);
      targetLook.copy(trackCenter);
      camera.far = Math.max(1000, trackRadius * 5);
      camera.fov = fittedFov(62);
      camera.updateProjectionMatrix();
    } else if (lobbyMode) {
      desired.set(state[25], state[27], -state[26]);
      targetLook.set(x, (state[14] || 0) + 0.35, -y);
      camera.fov = fittedFov(55);
      camera.updateProjectionMatrix();
      // Original lobby composition leaves the right side for pass/event UI.
      // Translate the presentation camera only; Wasm race pose is untouched.
      const distance = desired.distanceTo(targetLook);
      lobbyRight.subVectors(targetLook, desired).cross(up).normalize();
      const viewHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const viewWidth = viewHeight * camera.aspect;
      desired.addScaledVector(lobbyRight, viewWidth * 0.30);
      targetLook.addScaledVector(lobbyRight, viewWidth * 0.30);
      desired.y += viewHeight * 0.12;
      targetLook.y += viewHeight * 0.12;
    } else if (overhead) {
      desired.set(x, (state[14] || 0) + 28, -y + 0.01);
      targetLook.set(x, state[14] || 0, -y);
    } else {
      // C already smooths orientation, speed, height and FOV. Map Z-up to Y-up.
      const pose = readChasePose(state);
      desired.fromArray(pose.position);
      cameraDirection.fromArray(pose.forward).normalize();
      targetLook.copy(desired).add(cameraDirection);
      camera.up.fromArray(pose.up).normalize();
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    if (lobbyMode || trackPreview || overhead) camera.up.set(0, 1, 0);
    const follow = 1; // Never smooth the source chase result twice.
    camera.position.lerp(desired, follow);
    smoothedLook.lerp(targetLook, follow);
    look.copy(smoothedLook);
    firstFrame = false;
    camera.lookAt(look);
    raceEffects.render(camera);
  }

  return {
    render,
    setKart,
    setCharacter,
    setTrackDrive,
    setLobbyMode,
    renderPreview,
    toggleTrackPreview,
    toggleCollision,
    resetCamera: () => { firstFrame = true; raceEffects.clear(); },
    setBoostBlur: value => raceEffects.setBlurEnabled(value),
    toggleCamera: () => { overhead = !overhead; firstFrame = true; return overhead; },
  };
}
