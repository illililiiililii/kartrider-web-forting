# Remaining work and exact boundaries

Update 2026-10-21: `/` is a provisional game-facing lobby/HUD and `/debug.html` is
the old physics test UI. The new page drives on local KTRK triangles generated
from the supplied USDA `beach_I01`, `beach_I02`, and `village_R01` scenes.
`tools/convert-usd-local.py` chooses collision candidates by mesh/texture
names; these are **not verified original collision meshes**. Track-specific
route/checkpoint/lap data are not wired, so the UI correctly says practice.
The Three.js renderer now mirrors X like `kart_track_scene_world_vertex`,
tests camera occlusion, scales the character by 0.42 times the new 0.72 kart
display calibration, alpha-tests PNG foliage,
and hides kart USD `mod*` nodes except White Knight's attached `mod1b*` panels;
the other static transforms leave pieces detached. These nodes need original bind/animation transforms,
not permanent removal. Other opaque/transparent material mismatches may remain.

- Active driving calls the unmodified C demo source (pinned commit in README),
  but this is the **2004 demo**. KartRider P5136 `BodyParam`, `KartSpec`, S0–S8,
  V1/XUN, Charger, Exceed, and boost timings are not integrated. The archived
  investigation and fixtures are in `OLD_PYS/`. Future comparison should run
  the same P5136 input trace against the demo Wasm before mixing formulas.
- `src-demo/demo_bridge.c` retains the flat ground and square walls only for
  `/debug.html`. The new page loads heuristic USDA triangle candidates into
  `KartSimulationWorld` ground/body callbacks. The original slope, jump, wall
  tags and checkpoint/recovery data are still unverified. Next: inspect the
  original track data and replace name-based classification.
- On imported proxy tracks only, the bridge zeros horizontal velocity below
  0.15 m/s when grounded with no controls. This is a compatibility deadzone,
  **not an upstream demo formula**: nearly-flat extracted triangles otherwise
  moved an idle kart about 37 m in eight minutes. The regression test covers
  480 simulated seconds. Remove/reassess it when original collision geometry
  and static friction are identified.
- The drift gauge now calls the demo's own `kart_gauge_update` with its
  **hypothesis** `4 * |speed| * |rearSlip| * dt`, 200-unit capacity, two-slot
  storage, and handoff on drift exit. `demo_set_gauge_factor` exposes its
  coefficient. The formula itself is not recovered from either the 2004 EXE
  or P5136. The original demo's 7-second countdown and ±100 ms start-boost
  press window are linked; P5136 equivalence has not been checked.
- The camera pose and FOV come from `kart_camera.c`; the new renderer adds
  raycast occlusion avoidance on track meshes. This is not proven P5136 camera
  behavior, and some scene pieces may still intrude into the view.
- Local USD conversion now supplies actual White Knight V1/Saber V1 karts,
  Dao/Bazzi characters, three textured track scenes, and a dashboard sprite.
  The USD hierarchy was exported to browser JSON with UVs; skeleton weights,
  animation, seat attachment alignment, verified track drive surfaces, and material
  nuances are not integrated. The displayed kart/driver are scaled to 0.55
  relative to the previous browser view, but the demo collision body is still
  the source preset geometry; their exact overlap is unverified. Kart
  front-wheel steering for USD meshes still needs visual verification. Do not
  commit extracted models or textures without verified redistribution rights.
- Original `track/beach_I01`, `track/beach_I02`, and `track/village_R01`
  `xt_trackCard.png`/`xt_minimap.png` are now locally copied and shown by
  `tools/prepare-local-tracks.ps1`. The new game also loads converted USDA
  scene/collision candidates; original race markers remain missing. Attempting
  `tools/convert-1s-preview.py` on `track/beach_I01/track.1s` fails at offset
  `0x86`: its `AA 47 F8 03 FC 14` geometry nodes differ from the kart mesh
  parser's `AA 47 F6 04 2A 19` nodes. Next: implement the track-specific 1S
  geometry/triangle parser if USD is unavailable. The separate provided USDA
  files now render as 3D scenes, but the drive/collision subset must be
  checked against original metadata before claiming original parity.
- The demo's 13 course gate graphs are compiled and testable in Wasm, but only
  the synthetic debug world is playable on `/debug.html`; the P5136 imported
  tracks are practice runs without original checkpoint/lap mapping. A complete manually
  driven 3-lap race has not yet been verified. Kart/character and 3D track
  scenes and a new lobby/HUD exist. Full original UI atlas mapping, route/lap
  logic, animation, room multiplayer, and results remain missing. `server.mjs`
  implements register/login/logout/session endpoints, but no original-derived
  login screen is attached. `stage/authenStage/stage_window@zz.xml` describes a
  matrix/OTP challenge, not an account login. The extracted `stage/mainMenu/
  mq_window@kr.xml` does establish original lobby panel and mode coordinates.
- Missing USDA track art includes `ad_board_a.png`, `ad_board_b.png`,
  `ad_fence_a/b/c.png`, `ad_start.png` on Beach I01; these are referenced by
  the supplied USDA but absent from its sibling texture folder, exact
  `_rhoOut/track/beach_I01` path, and same-theme localized PPL folder.
  Village R01's six missing advertisement images *were* found at
  `_rhoOut/zeta/kr/ppl/ingame/hangul/village/` and are now selected by the
  local converter, bringing that scene to zero missing textures. Same-named
  assets in unrelated themes are not substituted. Next: trace Beach's runtime
  theme selection or inspect original P5136 resource-load calls. Native REA
  code search was unavailable because Ghidra/IDA was not configured.
- The demo repository snapshot has no visible `LICENSE`/`COPYING` file. This
  repository does not distribute its source or generated Wasm. Local users must
  supply it and run `tools/build-demo-physics.ps1`. Publishing a compiled build
  requires permission or a compatible license from the source author.
