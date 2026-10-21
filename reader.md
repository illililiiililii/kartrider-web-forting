# Remaining work and exact boundaries

- Active driving calls the unmodified C demo source (pinned commit in README),
  but this is the **2004 demo**. KartRider P5136 `BodyParam`, `KartSpec`, S0–S8,
  V1/XUN, Charger, Exceed, and boost timings are not integrated. The archived
  investigation and fixtures are in `OLD_PYS/`. Future comparison should run
  the same P5136 input trace against the demo Wasm before mixing formulas.
- `src-demo/demo_bridge.c` supplies a flat ground ray query and square wall
  callback. Its boundary clamp is test-world code, not part of the demo's
  collision response. Original track meshes, slopes, jumps, checkpoints, and
  recovery are not connected. Next: feed converted track collision triangles
  into `KartSimulationWorld` ground/body callbacks.
- The drift gauge uses the demo's **hypothesis** `4 * |speed| * |rearSlip| * dt`
  while grounded/drifting. Its 100-unit capacity and direct Ctrl consumption
  are bridge rules, not recovered original boost-slot logic. The coefficient
  is currently in `src-demo/demo_bridge.c`; expose it in the UI if tuning is
  needed later.
- The camera pose and FOV come from `kart_camera.c`; the renderer maps them into
  Three.js coordinates and clamps the camera inside the temporary walls. This
  is not proven to be P5136's camera. Overhead view remains a renderer option.
- Local USD conversion now supplies actual White Knight V1/Saber V1 karts,
  Dao/Bazzi characters, three textured track scenes, and a dashboard sprite.
  The USD hierarchy was exported to browser JSON with UVs; skeleton weights,
  animation, seat attachment alignment, track drive surfaces, and material
  nuances are not integrated. Kart front-wheel steering for USD meshes still
  needs visual verification. Do not commit extracted models or textures.
- Original `track/beach_I01`, `track/beach_I02`, and `track/village_R01`
  `xt_trackCard.png`/`xt_minimap.png` are now locally copied and shown by
  `tools/prepare-local-tracks.ps1`. This is artwork selection only. Attempting
  `tools/convert-1s-preview.py` on `track/beach_I01/track.1s` fails at offset
  `0x86`: its `AA 47 F8 03 FC 14` geometry nodes differ from the kart mesh
  parser's `AA 47 F6 04 2A 19` nodes. Next: implement the track-specific 1S
  geometry/triangle parser if USD is unavailable. The separate provided USDA
  files now render as 3D previews, but their drive/collision surfaces must
  still be classified and fed to the C world query. Do not represent card
  selection or the 3D viewer as a playable original track.
- The ring race has a countdown, ordered gates, lap timer, and finish state in
  the C bridge; it is a test course, not a finished game. A complete manually
  driven 3-lap race has not yet been verified. Kart/character and 3D track
  viewers exist, with one original tachometer sprite tied to Wasm speed; lobby,
  playable original track selection, complete HUD, audio, room multiplayer,
  and results remain missing.
- The demo repository snapshot has no visible `LICENSE`/`COPYING` file. This
  repository does not distribute its source or generated Wasm. Local users must
  supply it and run `tools/build-demo-physics.ps1`. Publishing a compiled build
  requires permission or a compatible license from the source author.
