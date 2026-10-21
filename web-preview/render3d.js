import * as THREE from './vendor/three.module.js';

// Rendering only: position and heading come from the C/Wasm demo state.
export function createPreviewRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bc8d4);
  scene.fog = new THREE.Fog(0x9bc8d4, 85, 200);
  const testFog = scene.fog;
  scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x456357, 2.4));
  const sun = new THREE.DirectionalLight(0xfff2d6, 3.2);
  sun.position.set(-25, 48, 30);
  scene.add(sun);
  const testWorld = new THREE.Group();
  scene.add(testWorld);
  const showroom = new THREE.Group();
  scene.add(showroom);
  const showroomPad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.25, 64),
    new THREE.MeshStandardMaterial({ color: 0x13669b, metalness: 0.25, roughness: 0.5 }));
  showroom.add(showroomPad);
  showroom.visible = false;

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
  let trackMeshes = [];
  let originalWheels = [];
  // The supplied kart USDA and track USDA were authored in different units.
  // Keep the demo's physical dimensions untouched; calibrate only presentation
  // against the 6.5-unit original road mesh while P5136 BodyParam is pending.
  const kartVisualScale = 0.55;
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
  const boostFlames = new THREE.Group();
  for (const side of [-0.43, 0.43]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.8 }));
    flame.rotation.z = Math.PI / 2;
    flame.position.set(-1.55, 0.45, side);
    boostFlames.add(flame);
  }
  kart.add(boostFlames);

  async function loadAsset(name, type) {
    const usd = type !== 'kart' || name === 'whiteKnightV1' || name === 'saberV1';
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
      // The converted USD includes dynamic advertisement materials whose PNGs
      // are absent from this P5136 extract. Do not render them as opaque grey
      // geometry; their original artwork must be resolved before displaying.
      if (type === 'track' && !part.texture) continue;
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
      if (texture) texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: texture ? 0xffffff : color, map: texture, side: THREE.DoubleSide,
        roughness: 0.8, metalness: 0.08,
        // Original foliage/fences use PNG alpha. Without alphaTest, their
        // transparent pixels render as opaque square cards.
        alphaTest: texture ? 0.35 : 0,
      }));
      mesh.userData.sourceName = part.name;
      mesh.userData.textureName = part.texture || '';
      if (type === 'kart' && partName.startsWith('wheel')) {
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
        const pivot = new THREE.Group();
        pivot.position.copy(center);
        pivot.add(mesh);
        group.add(pivot);
        nextWheels.push({ pivot, mesh, front: usd ? center.z > 0 : center.x > 0 });
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
    group.scale.setScalar(kartVisualScale);
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

  async function loadTrack(name) {
    if (originalTrack?.userData.trackName === name) return;
    const { group } = await loadAsset(name, 'track');
    if (originalTrack) {
      scene.remove(originalTrack);
      originalTrack.traverse((node) => {
        if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); }
      });
    }
    originalTrack = group;
    originalTrack.userData.trackName = name;
    // kart_track_scene_world_vertex mirrors X for this demo track spec.
    // Render the same world-space transform or the kart drives off the visible road.
    originalTrack.scale.x = -1;
    scene.add(group);
    originalTrack.updateMatrixWorld(true);
    trackMeshes = [];
    const trackFocus = new THREE.Box3();
    group.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      const size = box.getSize(new THREE.Vector3());
      const tag = `${node.userData.sourceName} ${node.userData.textureName}`.toLowerCase();
      if (Math.max(size.x, size.y, size.z) > 500 ||
          /skydome|water|sea0|bird|transparency/.test(tag)) {
        node.visible = false;
      } else if (Math.max(size.x, size.z) < 70 && box.getCenter(new THREE.Vector3()).y > 10) {
        trackFocus.union(box);
      }
      if (node.visible) trackMeshes.push(node);
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
    showroom.visible = enabled;
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
        lobbyCharacter.position.set(0, -0.15, -2.4);
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
  camera.position.set(-8, 5, 0);
  let overhead = false;
  let firstFrame = true;
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  const cameraRay = new THREE.Raycaster();
  const cameraDirection = new THREE.Vector3();

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
    // The demo pose is the body centre (~0.5 m above contact); USDA kart
    // wheels are authored at local Y=0. Align their base to the road.
    kart.position.set(x, (state[14] || 0) - 0.48, -y);
    showroom.position.set(x, (state[14] || 0) - 0.75, -y);
    kart.rotation.y = heading;
    shell.color.setHex(boost > 0 ? 0xffcd4f : drifting ? 0xf779a8 : 0x33b6e4);
    boostFlames.visible = boost > 0;
    const localSpeed = vx * Math.cos(heading) + vy * Math.sin(heading);
    for (const wheel of wheels) wheel.rotation.z -= localSpeed * Math.min(frameDeltaMs, 50) / 1000 / 0.43;
    for (const wheel of originalWheels) {
      wheel.mesh.rotation.z -= localSpeed * Math.min(frameDeltaMs, 50) / 1000 /
        (0.2 * kartVisualScale);
      wheel.pivot.rotation.y = wheel.front ? state[13] : 0;
    }

    if (trackPreview) {
      const orbit = performance.now() * 0.00012;
      desired.set(trackCenter.x + Math.cos(orbit) * trackRadius * 1.25,
        trackCenter.y + trackRadius * 0.7,
        trackCenter.z + Math.sin(orbit) * trackRadius * 1.25);
      targetLook.copy(trackCenter);
      camera.far = Math.max(1000, trackRadius * 5);
      camera.fov = 62;
      camera.updateProjectionMatrix();
    } else if (lobbyMode) {
      desired.set(x - 8, (state[14] || 0) + 5, -y - 9);
      targetLook.set(x, (state[14] || 0) + 1, -y - 1);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    } else if (overhead) {
      desired.set(x, 28, -y + 0.01);
      targetLook.set(x, 0, -y);
    } else {
      desired.set(trackDrive ? state[25] : Math.max(-78.5, Math.min(78.5, state[25])), state[27],
        trackDrive ? -state[26] : Math.max(-78.5, Math.min(78.5, -state[26])));
      targetLook.set(x + Math.cos(heading) * 3, (state[14] || 0) + 1.4,
        -y - Math.sin(heading) * 3);
      if (trackDrive && originalTrack) {
        const origin = new THREE.Vector3(x, (state[14] || 0) + 1.2, -y);
        cameraDirection.subVectors(desired, origin);
        const distance = cameraDirection.length();
        if (distance > 0.01) {
          cameraDirection.divideScalar(distance);
          cameraRay.set(origin, cameraDirection);
          cameraRay.far = distance;
          const hit = cameraRay.intersectObjects(trackMeshes, false)[0];
          if (hit && hit.distance < distance - 0.3) {
            desired.copy(origin).addScaledVector(cameraDirection, Math.max(0.8, hit.distance - 0.3));
          }
        }
      }
      camera.fov = state[31] || 75;
      camera.updateProjectionMatrix();
    }
    if (firstFrame) {
      camera.position.copy(desired);
      look.copy(targetLook);
      firstFrame = false;
    } else {
      const follow = 1 - Math.exp(-Math.min(frameDeltaMs, 50) / (overhead ? 90 : 40));
      camera.position.lerp(desired, follow);
      look.lerp(targetLook, follow);
    }
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  return {
    render,
    setKart,
    setCharacter,
    setTrackDrive,
    setLobbyMode,
    toggleTrackPreview,
    resetCamera: () => { firstFrame = true; },
    toggleCamera: () => { overhead = !overhead; firstFrame = true; return overhead; },
  };
}
