# P5136 web port — development progress

## 2026-10-22 race framing, mirrored track correction, original setup GUI

- Rebuilt the single-play setup, My Items, and track selection overlays around
  unchanged local P5136 dialog/stage sprites. The race HUD now uses the
  original V1 tachometer base, booster bar, and `item/slot/slot_v1.png`, with
  rank/time/map positioned against the supplied race screenshots. Buttons
  for the available karts, characters, tracks, race start, and lobby return
  are wired; missing original inventory content is not fabricated.
- The USDA track had been mirrored in both rendering and demo collision, so
  the three scenes now render in original USD horizontal orientation and
  the KTRK exporter cancels the demo reader's X mirror. Verified solid spawn
  heights and clear initial forward motion on Beach I01, Beach I02, and
  Village R01. Village's old spawn faced a building; it now starts on the
  roadway at (14.5, 49) toward the visible original start banner.
- Race model scale 0.50 is matched by bridge body half-width 0.42 m and
  half-length 0.62 m. Lobby-only kart/character scales are 0.75/0.80 after
  screenshot calibration. In tall app panels, horizontal camera field of
  view is retained so the kart does not grow disproportionately. Camera and
  road framing were checked in the live browser at 1280×720.
- The extracted Beach I01 `bc_br_002.png` cards at `Object49s0` and
  `Object274363279s0` formed an opaque green bar across the drivable lane;
  only these broken visual placements are hidden pending native transform
  recovery. UV orientation and PNG alpha flags were corrected in the local
  USDA converter. Track edge rebound/floor support and wall-count debounce
  live only in the bridge, leaving upstream demo C unchanged.
- The V1 speed-threshold automatic gauge charge reported by the user remains
  a separate future V1 behavior; no unsupported threshold/rate was guessed
  into the demo gauge hypothesis. Browser QA confirmed original lobby,
  setup, My Items, track selection, Beach I01 race, and Village R01 race.

## 2026-10-22 original-only game GUI pass

- Matched the user-supplied 1280×720 lobby reference using unchanged
  `myRoom/2022_Facelift_main/backboard_01`–`06.png` and `obj.png` for the
  mountain/clock-tower/roof and decorative riders. Mode choice, right-hand
  pass/event stack, account bars, and 66-pixel white taskbar now follow the
  screenshot's principal placement. The tiled backboard is a screen-space
  approximation, not recovered original room geometry/camera.
- Separated the lobby backdrop from the original track drive scene. The
  transparent WebGL layer shows the real 3D kart and character in the lobby;
  entering the race restores the original track scene and demo camera.
  Lobby-only framing and scale were adjusted against the supplied reference.
  Browser QA at 1280×720 confirmed lobby, race entry, and lobby return.
- Rebuilt `/` rather than layering another style over the provisional UI.
  Lobby modes, list/promotion frames, arrows, start button, notice, taskbar,
  race rank/time digit sheets, REC sheet, N₂O gauge/slot, tachometer, and
  minimap frame are unchanged PNGs from original `_rhoOut` stage/gui folders.
  Their positioning follows `mq_window@kr.xml`, `taskBar@kr.xml`,
  `rankBoard.xml`, `timeInfo.xml`, `boostGauge.xml`, and `tachometer.xml` where
  the present practice-mode game has matching state. No new UI artwork was
  generated. The account form uses the original list frame and generic red
  button art; its precise P5136 login layout is unavailable.
- Original fonts now load locally. A SHA-256 regression test checks each
  referenced local GUI file against `_rhoOut` and rejects CSS gradients.
  The sprite assets remain Git-ignored and are copied by
  `tools/prepare-local-ui.ps1` from the user's installation.
- Mobile race touch buttons use the original `gui/tablet` direction,
  Drift, and Item sprites, including their pressed-state images.
- Browser QA confirmed lobby selection labels/button and race rank, timer,
  speed, N₂O, REC, and minimap render. Removed a static fake minimap player
  marker; actual map-coordinate mapping is still unimplemented.

## 2026-10-21 original GUI, visual scale, camera, and local login

- Retained the upstream demo C physics as the chosen driving model; removed
  P5136 numerical-parity comparison from the active work plan.
- Race kart/driver visual scale is now 0.22 by default (previously 0.55),
  adjustable from `/debug.html` without changing collision or speed. The
  original C camera pose/forward vector is used directly: removed an extra JS
  smoothing pass and independent look-at pitch. Camera obstruction tests now
  ignore obvious non-solid decorative meshes.
- Removed the fabricated blue showroom pad. The lobby shows original Beach
  track geometry and the original kart and character with separate lobby
  display calibration. Visual placement remains provisional.
- Replaced the custom lobby panel/button graphics with the unchanged P5136
  `stage/mainMenu` / Korean override PNGs chosen from `mq_window@kr.xml`;
  HUD N₂O frame/bar now uses `stage/speedIndiGame/boostGauge.xml` assets.
  Some layout/text controls are still browser-native rather than XML-complete.
- Added a local-account login/register screen using the original menu panel
  art because no normal account-entry screen was found; `authenStage` is an
  additional challenge screen. The login page calls the existing SQLite
  server APIs. The lobby displays account state and supports logout.
- Replaced the old 4173 static preview server with `node server.mjs` on the
  same URL. Browser QA confirmed the lobby and login page load. The race
  kart is visibly smaller, but original attachment/collision data remain
  unresolved.

## 2026-10-21 idle collision and original localized textures

- Reproduced ~37 m of idle creep over eight simulated minutes on the imported
  Beach I01 collision proxy. A bridge-only sub-0.15 m/s grounded/no-input
  deadzone now holds the kart in place without changing upstream demo C.
  Added a 480-second local-track regression; all 14 automated tests pass.
- Reduced the original kart/driver presentation scale from 0.72 to 0.55 after
  visual comparison against the imported Beach I01 roadway. This does not
  change the demo's collision body and still needs original unit verification.
  Bumped module URLs so an already-open browser reload actually receives the
  new scale; visually verified a narrower kart on the road.
- Found Village R01's six previously missing dynamic ad images in the
  original `_rhoOut/zeta/kr/ppl/ingame/hangul/village/` folder. The local
  converter resolves them by exact filename and theme; no generated image or
  cross-theme substitution is used. Beach's equivalent files remain missing.
- Original collision tags and source GUI/login layout are still unverified;
  no new speculative UI was added in this update.
- Inspected `stage/mainMenu/mq_window@kr.xml` and prepared its original base
  and Korean override sprite namespaces plus `stage/speedIndiGame` locally:
  404 + 984 + 92 PNGs. These are ignored local assets; the current provisional
  page has **not** yet been replaced by the XML-derived layout.

## 2026-10-21 demo C integration, model calibration, and account server

- Kept the upstream demo C dynamics/simulation/camera/track code unmodified and
  additionally linked its countdown, input, course graph/data, engine-sound
  laws, and `demo/kart_gauge.h` into the locally built Wasm. Restored the
  demo's 7-second start sequence, ±100 ms start boost, last-pressed steering
  ownership, gauge handoff at drift exit (200 units / two slots), and course
  gate/warp/500 ms recovery functions. Upstream gauge charging is explicitly
  a simulator hypothesis, not original-client recovery.
- The demo's 13 course tables build in Wasm, but P5136 Beach track selection
  still does not attach them: they refer to different track versions. The new
  game remains practice mode until P5136 gate geometry is established.
- Browser screenshot showed an oversized kart on the Beach I01 road. Scaled
  only the displayed original kart and driver model to 0.72; physical demo
  body dimensions are unchanged pending P5136 BodyParam mapping. Missing
  dynamic advertisement textures no longer appear as opaque grey planes.
  The USD converter now checks inherited material bindings and an exact
  same-category `_rhoOut` fallback; it does not substitute other-track art.
- Added local Node/SQLite account endpoints with scrypt password hashes,
  hashed sessions, HttpOnly SameSite=Strict cookies, origin check, and request
  throttling. This is not Nexon login. No invented account UI was added.
- Browser QA: new Wasm loads and race screen shows the smaller original kart.
  `node --test` reports 13 passing checks. Separate auth server was served at
  `http://127.0.0.1:4174/` during QA.

Next: validate P5136 source collision/route metadata, original GUI layout and
missing material references, then wire account forms using verified original
assets. Native REA decompilation was unavailable because no Ghidra/IDA provider
was configured; source XML and PNG assets were inspected directly instead.

## 2026-10-21 new game page and rendering fixes

- Replaced the public-facing prototype page with a new lobby and race HUD at
  `/`; the old telemetry/steering test UI now lives at `/debug.html`.
- The new page loads supplied White Knight/Saber, Dao/Bazzi, three original
  track scenes, original menu button, track cards/minimaps and tachometer.
  Its converted USD collision candidates feed demo C ground/body callbacks.
  This permits practice driving, not verified original-course laps.
- Confirmed in the linked Wasm that normal steering decreases from 10.00° at
  rest to 5.77° at 15.50 m/s and 3.54° at 29.15 m/s with the same setting.
  Added a regression test; demo drift slip uses a different steer path.
- Matched the track X mirror used by the C collision reader in Three.js;
  added camera occlusion checks. Set the default Beach I01 spawn on the road.
- Reduced character visual scale from 0.60 to 0.42. PNG alpha cutouts now use
  alpha testing, fixing opaque rectangular leaf/fence cards. Static USD nodes
  with missing effect transforms are hidden until animation support exists;
  the static Saber V1 still has small red triangles near its body, requiring
  a material/mesh attachment pass rather than another blind scale change.
  Offset the kart mesh from the demo body-centre pose so wheels meet the road.
- Browser QA confirmed all three track loads, the new lobby, countdown/HUD,
  Beach I01 road view, and the separate debug page. Automated tests: 10 passed.
  Additional material/UV alignment and collision validation remain needed.

## Current playable state

- Active driving uses the locally built 2004 KartRider demo C physics in Wasm.
  The old experimental Rust physics is archived in `OLD_PYS`. The C bridge
  still provides a flat test surface, square walls, a hypothesized drift gauge,
  and a four-gate test race; it does not claim to reproduce P5136 formulas.
- Original P5136 kart and character USDA geometry and referenced PNG textures
  now render together in the browser: White Knight V1, Saber V1, Dao, and
  Bazzi. Their positions currently use manual seat scaling/offset; the USDA
  attach points and skeletal animation are not yet applied.
- Three original P5136 tracks (`beach_I01`, `beach_I02`, `village_R01`) can be
  selected and driven using textured 3D scene meshes and heuristic collision
  triangles. Original checkpoint/lap metadata remain unconnected.
- Original P5136 tachometer sprite is locally copied from
  `gui/tachometer/default/tachometer.png`. Speed and gauge displays read live
  Wasm state; the present CSS crop/placement is provisional.
- A user-gesture button starts locally copied original OGG audio: beach/village
  BGM selected by theme and drift/booster effects triggered by live Wasm state.
  This is a provisional audio mapping, not recovered per-track sound metadata.

## Supplied asset inventory (recursive `_rhoOut` scan, 2026-10-21)

The user-supplied `_rhoOut` tree contains approximately 50,175 PNG, 33,054
`.1s`, 7,254 DDS, 5,209 XML, 4,172 OGG, 2,100 KAP, 603 KSV, 452 JPG,
48 FLAC, and 2 OTF files. Notable top-level directories include `character`,
`effect`, `gui`, `sound`, `stage`, `theme`, `track`, and `zeta`. These counts are
inventory only; filenames do not establish runtime semantics.

The separate `KartRider_5136_02_CONVERT` tree described as FBX by the request
actually contains **USD ASCII (`.usda`)**, not FBX: 419 track, 214 kart, and
183 character USDA files. The track tree additionally contains 47,971 PNG
textures. The USDA files have mesh topology, UVs, material texture references,
scene transforms, and some animation metadata. `tools/convert-usd-local.py`
uses OpenUSD's `pxr` parser and exports browser JSON with textures, avoiding a
second reverse-engineering pass over `.1s` for geometry.

## Verification performed

- Local USD conversion: 2 karts, 2 characters, 3 tracks. `beach_I01` exported
  885 meshes / 7.16 MB JSON; its local texture+JSON folder is about 10.7 MB.
- Browser QA at `http://127.0.0.1:4173/`: original White Knight V1 with Dao
  visibly rendered; original Beach I01 track overview visibly rendered; local
  demo Wasm running. Direct visual QA identified and corrected an oversized
  skydome/fog issue in the track viewer.
- `node --test tools/test-demo-physics.mjs tools/test-frame-interpolation.mjs`:
  9 passed. JavaScript syntax checks passed.

## Next implementation order

1. Verify the imported track collision candidates against original drive,
   wall, ramp and jump surfaces; repair material/attachment transforms.
2. Manually drive one complete original `.1s` ToRoad course in the browser,
   confirming each lap and finish through the provisional collision mesh.
3. Read USDA seat/attachment points and skeleton/animation to align and animate
   the driver and kart parts. Eliminate the manual offset.
4. Map original UI XML/sprite atlases for HUD/lobby and connect selections to
   real race state. Verify the original audio's per-track mapping and timing.
5. Add room multiplayer after a stable single-player track race. Continue
   labeling the driving simulation as the chosen 2004 demo model.

## Distribution boundary

Generated USD JSON, copied PNG/audio, and the demo C derivative Wasm remain
Git-ignored. The user plans to make the GitHub repository private later, but
it is currently public. A future privacy change does not itself grant
redistribution rights, so do not push these extracted assets or the demo C
source/compiled derivative without clear permission. Source conversion scripts
and local build instructions are tracked.

## 2026-10-22: V1 passive charging and rider material pass

- The C/Wasm bridge now supports a separate V1 passive N₂O charger. Above a
  configurable forward-speed threshold, a grounded kart gains gauge even
  without drifting. The initial 25 m/s threshold and 2 gauge units/s rate are
  **provisional**, not recovered P5136 constants. The demo's original drift
  calculation and charge formula remain unchanged.
- Dao and Bazzi's supplied neutral body atlas now receives a material tint;
  their separately textured original face is unchanged. A small rigid-body
  steering/slip pose is applied to the original imported character mesh. This
  is not the original skeletal animation, which remains unconverted.
- The HUD's total-lap denominator now follows `_rhoOut/track/common/track@zz.xml`:
  Beach I01/I02 have 3, Village R01 has 2. The numerator/finish still require
  5136-compatible checkpoint gates; the practice UI explicitly says so.
- On imported tracks, `R` or a deep fall now returns to the most recently
  verified grounded pose after 500 ms without resetting the race clock. This
  rolling safety point is a temporary fallback, not an original checkpoint.
- New-browser visual QA confirmed the blue Dao lobby model, original race
  scenery/HUD, and Beach I01 `/3` readout. Automated tests: 19/19 passed.

## 2026-10-22: original 5136 ToRoad checkpoints and finish

- `tools/prepare-local-course.py` reads the supplied original `track.1s`
  files with the separately obtained demo ToRoad parser. It emits ignored
  local C tables for Beach I01, Beach I02 and Village R01; the Wasm builder
  links those tables to the unchanged demo course implementation.
- Original start positions divided by 10 agree with the converted road surface
  within 0.005 m. Spawn headings now follow the original course instead of
  manually guessed directions. Three 5136 route graphs contain 36/23/61
  built nodes and use the original metadata's 3/3/2 laps.
- The race HUD shows live lap and best-lap time. On C/Wasm finish it opens a
  minimal result view using the original `stage/timeAttack/mq_window@zz.xml`
  panel dimensions and supplied `laptime_*`/button sprites, with retry/lobby.
- Native synthetic traversal tests pass all three complete course graphs;
  Node/Wasm tests pass 20 checks including original spawn/first gate. Browser
  QA confirmed the Beach I01 start stripe is ahead of the kart. A complete
  human-driven lap still needs collision/route QA and is not claimed here.

## 2026-10-22: tenfold track-to-kart scale correction

- Regenerated all three local original 3D tracks and their KTRK collision
  meshes at 10× the previous conversion size. Their original `.1s` ToRoad
  course positions receive the identical 10× transform in generated C/Wasm.
  The imported kart/character, physical kart footprint and chase-camera
  distance stay at their prior size, so the body is now one-tenth as large
  relative to the track instead of merely looking smaller.
- Browser QA at Beach I01 confirms the full road fills the view while the kart
  remains visible, and the original start stripe/course still align. Added
  a side-wall steering collision regression alongside ground, spawn and gate
  tests. Full manual racing on all three enlarged tracks remains to verify.
