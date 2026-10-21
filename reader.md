# Remaining work and exact boundaries

Update 2026-10-22: `/` is a game-facing lobby/HUD and `/debug.html` is
the old physics test UI. The new page drives on local KTRK triangles generated
from the supplied USDA `beach_I01`, `beach_I02`, and `village_R01` scenes.
`tools/convert-usd-local.py` chooses collision candidates by mesh/texture
names; these are **not verified original collision meshes**. Track-specific
ToRoad route/checkpoint/lap data are now wired from each original `track.1s`.
Complete human-driven lap/finish through the provisional collision mesh is
not yet verified.
The Three.js renderer now leaves original USD X unmirrored while the KTRK
exporter cancels `kart_track_scene_world_vertex`'s internal X mirror,
tests camera occlusion, scales the character by 0.42 times the new 0.72 kart
display calibration, alpha-tests PNG foliage,
and hides kart USD `mod*` nodes except White Knight's attached `mod1b*` panels;
the other static transforms leave pieces detached. These nodes need original bind/animation transforms,
not permanent removal. Other opaque/transparent material mismatches may remain.

- Active driving calls the unmodified C demo source (pinned commit in README),
  but this is the **2004 demo**. KartRider P5136 `BodyParam`, `KartSpec`, S0–S8,
  V1/XUN, Charger, Exceed, and boost timings are not integrated. The archived
  investigation and fixtures are in `OLD_PYS/`. Per the user's current
  direction, the 2004 demo C simulation is the chosen driving model;
  P5136-versus-demo numerical parity work is not planned.
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
  press window are linked. These remain demo behavior, not asserted P5136 formulas.
- `kart_camera.c` still updates in Wasm and supplies the speed/boost FOV,
  but the main renderer currently computes a closer body-relative chase pose
  for the scaled P5136 mesh, widens portrait FOV, and raycasts selected track
  meshes for occlusion. It is not the unchanged demo camera pose or proven
  P5136 camera behavior; some scenery may still intrude into the view.
- Local USD conversion now supplies actual White Knight V1/Saber V1 karts,
  Dao/Bazzi characters, three textured track scenes, and a dashboard sprite.
  The USD hierarchy was exported to browser JSON with UVs; skeleton weights,
  animation, seat attachment alignment, verified track drive surfaces, and material
  nuances are not integrated. The race kart/driver display calibration is
  0.50 (lobby kart 0.75, standing character 0.80), while the bridge sets
  0.42 m half-width and 0.62 m half-length for the provisional kart body.
  Exact original wheel/body overlap is still unverified. Kart
  front-wheel steering for USD meshes still needs visual verification. Do not
  commit extracted models or textures without verified redistribution rights.
- The source Beach I01 USD `Scene_Root/Object49s0` and
  `Object274363279s0` with `bc_br_002.png` export as uncollidable opaque
  green cards across the starting lane. The renderer hides only these two
  placements. Next: inspect their original scene transform/material binding
  in `track/beach_I01/track.1s` or runtime and restore correctly.
- The main-page three-track spawn poses are locally validated for an initial
  1.6-second straight drive, not a complete route. P5136 V1 automatic N₂O
  charging is now isolated in `src-demo/demo_bridge.c`, enabled for the two
  currently selectable V1 models. The 25 m/s threshold and 2 gauge units/s
  are **estimates** rather than source-derived constants. Next: extract V1
  KartSpec/BodyParam or record exact speed/gauge samples to replace them.
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
- The demo's 13 course gate graphs are compiled and testable in Wasm. The P5136
  imported tracks now use their own original `.1s` ToRoad gate graphs (36, 23,
  and 61 built graph nodes) and 3/3/2-lap finish rules. A complete manually
  driven race has not yet been verified. Kart/character and 3D track
  scenes and a new lobby/HUD exist. The visible lobby/HUD now uses unchanged
  original GUI sprites and XML-derived positioning rather than fabricated
  panel/button artwork. The supplied 1280×720 screenshot now guides the
  lobby composition, with `myRoom/2022_Facelift_main` background tiles and
  rider atlas. Their screen-space placement is approximate; original room
  transforms/camera, the exact event advertisement, route/lap
  collision quality, animation, room multiplayer, and accurate results remain missing. `server.mjs`
  implements register/login/logout/session endpoints with a provisional
  account-entry page; an original account-login layout is still missing.
  `stage/authenStage/stage_window@zz.xml` describes a matrix/OTP challenge,
  not an account login. The extracted `stage/mainMenu/mq_window@kr.xml`
  establishes original lobby panel and mode coordinates.
- `_rhoOut/track/common/track@zz.xml` establishes 3 laps for `beach_I01`
  and `beach_I02`, and 2 for `village_R01`. `tools/prepare-local-course.py`
  now decodes ToRoad in each original `track.1s`, scales its positions by
  0.1 and emits a local-only C table. Native synthetic gate traversal passes
  all 3/3/2 laps. It does not prove a driveable route with the provisional
  USDA-derived KTRK collision. `R` now requests source-course respawn where
  a gate has been reached; deep-fall recovery still has a rolling grounded
  fallback if no suitable course pose is available. Next: drive each full
  course in-browser, repair KTRK missing walls/road transitions, and compare
  gate pass order against original track metadata. The `.kap` AI paths remain
  encoded and are not used.
- The Dao/Bazzi body atlases (`character/dao/1.png`, `character/bazzi/1.png`)
  are neutral and now tinted on the imported mesh; face atlas `f00.png` is
  separate. The tint is a visual approximation. The supplied `.1s` files
  contain additional animation frames, but the USD export has not preserved
  the skeleton/bind sequence. Next: decode/import original armature actions
  and replace the rigid steering/slip pose.
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
