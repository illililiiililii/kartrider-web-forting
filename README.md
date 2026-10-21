# KartRider demo C physics — local WebAssembly prototype

The active browser game now links the **unmodified** `kart_dynamics.c`,
`kart_simulation.c`, and `kart_camera.c` from
[KartriderDemoPhysics](https://github.com/overjoy1008/KartriderDemoPhysics)
plus `kart_demo_data.c` into WebAssembly. Its simulation uses the demo's 5ms maximum substep, four
wheel contacts, suspension, longitudinal and lateral/drift force pipeline,
drag, pose integration, collision response, and chase-camera update. Our
`src-demo/demo_bridge.c` supplies a temporary flat test world, square walls,
drift-gauge hypothesis, and three-lap test race. This is a **2004 demo physics
prototype**, not a verified P5136 game. The former Rust physics investigation
is preserved in [`OLD_PYS`](OLD_PYS/README.md) and is not loaded in the browser.

## Build and play locally (Windows)

1. Obtain the demo source in a separate directory. This project was tested
   against commit `a9eade1f343764b10fb6dce5fec3828756fad2e6`.
2. Obtain Zig 0.13.0 from the [official downloads](https://ziglang.org/download/0.13.0/)
   and extract it outside this repository.
3. Run the local-only builder, passing the actual paths if they differ from
   the sibling `work` defaults:

```powershell
.\tools\build-demo-physics.ps1 -DemoSource 'C:\path\to\KartriderDemoPhysics' -ZigExe 'C:\path\to\zig.exe'
python -m http.server 4173 --bind 127.0.0.1 --directory web-preview
```

Before starting the server, prepare the track cards and minimaps from the
user's unpacked original files (the script default points at the supplied
`C:\Users\user\Downloads\kart web` folder):

```powershell
.\tools\prepare-local-tracks.ps1
```

The locally copied artwork is Git-ignored. The three choices currently show
the original `beach_I01`, `beach_I02`, and `village_R01` artwork, **not** their
playable 3D courses. The active physics still collides with a temporary square
test world and its ring-shaped four-gate course.

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The generated
`web-preview/demo_physics.wasm` is ignored by Git and must be built locally.
The demo repository snapshot inspected here has no visible redistribution
license. Neither its C source nor a compiled derivative is committed here.
The bridge and build recipe alone cannot make a fresh public checkout playable
until the user provides a locally obtained demo source and builds its Wasm.

Controls: arrows or numpad 8/2/4/6 (W/A/S/D also work), Shift drift, Ctrl
booster after gauge fills, R reset. Use the slider to set the demo's
`max_steer_angle_deg` from 1° to 30° in 0.1° increments; the adjacent number
box accepts an exact value and the setting is saved locally. The source
default is 10°. `Space`/Exceed is disabled until later P5136 integration.
The separate demo physics selector loads the source's `cotten5`, `practice1`,
`saber5`, or `solid5` dynamics and body geometry; the P5136 V1 mesh selection
is visual only and does not pretend to be that demo kart. Click “3랩 테스트 레이스
시작” for a 3-second countdown and four ordered test
checkpoints per lap. The course and gauge storage rules are not original data.

The local original `.1s` kart geometry can be converted without committing
copyrighted assets:

```powershell
python .\tools\convert-1s-preview.py '..\..\work\original-assets\whiteKnight1-model.1s' '.\web-preview\assets\whiteKnight1.mesh.json'
python .\tools\convert-1s-preview.py '..\..\work\original-assets\cotton11-model.1s' '.\web-preview\assets\cotton11.mesh.json'
```

If those ignored local meshes are absent, the 3D renderer shows a temporary
geometric kart. Converted kart wheels now steer/spin from the C physics state,
and timed boost shows a basic exhaust effect. Character and track asset
conversion remains incomplete.

## Verification

```powershell
.\tools\build-demo-physics.ps1
node --test tools\test-demo-physics.mjs tools\test-frame-interpolation.mjs
```

The current local build is about 755 KB. In direct Wasm tests, the default
demo kart accelerated to about 156 km/h after 1.6 seconds on the flat test world; with
identical short inputs, 5°/10°/20° steering produced increasing heading
changes. Browser QA confirmed Wasm loading, the actual `.1s` kart, the slider,
and the race countdown. Full human-driven lap completion and original-client
trajectory equivalence are **not** verified. See [`reader.md`](reader.md) for
remaining work and limitations.
