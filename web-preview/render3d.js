import * as THREE from './vendor/three.module.js';

// Rendering only: position and heading come from the Rust/Wasm preview state.
export function createPreviewRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bc8d4);
  scene.fog = new THREE.Fog(0x9bc8d4, 85, 200);
  scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x456357, 2.4));
  const sun = new THREE.DirectionalLight(0xfff2d6, 3.2);
  sun.position.set(-25, 48, 30);
  scene.add(sun);

  const material = (color, metalness = 0, roughness = 0.8) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), material(0x3f6c68));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);
  const grid = new THREE.GridHelper(160, 16, 0x8cb5aa, 0x71968e);
  grid.position.y = 0.005;
  scene.add(grid);

  const road = material(0x394b55);
  const barrier = material(0xea8055, 0.1, 0.55);
  const barrierTop = material(0xffe4b3);
  function box(parent, width, height, depth, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  // The visible walls use the same ±80 m square as the provisional Wasm collision.
  box(scene, 160, 0.03, 7, 0, 0.01, 0, road);
  box(scene, 7, 0.03, 160, 0, 0.012, 0, road);
  for (const edge of [-80, 80]) {
    box(scene, 160, 1.8, 1, 0, 0.9, edge, barrier);
    box(scene, 1, 1.8, 160, edge, 0.9, 0, barrier);
    box(scene, 160, 0.16, 1.1, 0, 1.86, edge, barrierTop);
    box(scene, 1.1, 0.16, 160, edge, 1.86, 0, barrierTop);
  }
  const stripe = material(0xf9e8c4);
  for (let i = -70; i <= 70; i += 10) {
    box(scene, 4, 0.015, 0.15, i, 0.035, 0, stripe);
    box(scene, 0.15, 0.015, 4, 0, 0.037, i, stripe);
  }
  const start = material(0xffffff);
  for (let i = 0; i < 8; i++) {
    box(scene, 0.5, 0.02, 0.8, 3.5, 0.04, -2.8 + i * 0.8, i % 2 ? road : start);
  }

  const kart = new THREE.Group();
  scene.add(kart);
  const proxy = new THREE.Group();
  kart.add(proxy);
  let original = null;
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
  // Temporary geometric driver, not an original .1s character model.
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 12), material(0xffdf7b));
  helmet.position.set(-0.38, 1.43, 0);
  proxy.add(helmet);
  box(proxy, 0.6, 0.43, 0.6, -0.38, 0.99, 0, material(0x4562b5));
  box(proxy, 0.09, 0.16, 0.55, -0.03, 1.12, 0, dark);

  async function setKart(name) {
    const response = await fetch(`./assets/${name}.mesh.json`);
    if (!response.ok) throw new Error(`원본 카트 변환 파일 없음 (${response.status})`);
    const data = await response.json();
    if (data.format !== 'p5136-preview-mesh-v1' || !Array.isArray(data.parts)) {
      throw new Error('알 수 없는 카트 메시 형식');
    }
    const group = new THREE.Group();
    for (const part of data.parts) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      geometry.setIndex(part.indices);
      geometry.computeVertexNormals();
      const color = part.name.startsWith('wheel') ? 0x262a31
        : part.name.startsWith('lamp') ? 0xe4f0f2
        : part.name === 'seat' ? 0xcbd4da : 0x556b79;
      group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })));
    }
    if (original) {
      kart.remove(original);
      original.traverse((node) => {
        if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); }
      });
    }
    original = group;
    kart.add(group);
    proxy.visible = false;
    return `${data.source}: ${data.parts.length}개 부품`;
  }

  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 350);
  camera.position.set(-8, 5, 0);
  let overhead = false;
  let firstFrame = true;
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const targetLook = new THREE.Vector3();

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
    kart.position.set(x, 0, -y);
    kart.rotation.y = heading;
    shell.color.setHex(boost > 0 ? 0xffcd4f : drifting ? 0xf779a8 : 0x33b6e4);
    const localSpeed = vx * Math.cos(heading) + vy * Math.sin(heading);
    for (const wheel of wheels) wheel.rotation.z -= localSpeed * Math.min(frameDeltaMs, 50) / 1000 / 0.43;

    if (overhead) desired.set(x, 28, -y + 0.01);
    else desired.set(x - Math.cos(heading) * 8.8, 5.3, -y + Math.sin(heading) * 8.8);
    targetLook.set(x + Math.cos(heading) * (overhead ? 0 : 3.2), 0.8,
      -y - Math.sin(heading) * (overhead ? 0 : 3.2));
    if (firstFrame) {
      camera.position.copy(desired);
      look.copy(targetLook);
      firstFrame = false;
    } else {
      const follow = 1 - Math.exp(-Math.min(frameDeltaMs, 50) / (overhead ? 90 : 115));
      camera.position.lerp(desired, follow);
      look.lerp(targetLook, follow);
    }
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  return {
    render,
    setKart,
    resetCamera: () => { firstFrame = true; },
    toggleCamera: () => { overhead = !overhead; firstFrame = true; return overhead; },
  };
}
