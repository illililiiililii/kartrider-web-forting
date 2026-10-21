# P5136 web port — development progress

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
2. Read track configuration/checkpoint data and replace the test ring gates.
   Verify lap/finish by manually driving one complete original course.
3. Read USDA seat/attachment points and skeleton/animation to align and animate
   the driver and kart parts. Eliminate the manual offset.
4. Map original UI XML/sprite atlases for HUD/lobby and connect selections to
   real race state. Verify the original audio's per-track mapping and timing.
5. Add room multiplayer after a stable single-player track race; compare
   P5136 behavior separately rather than claiming 2004 demo equivalence.

## Distribution boundary

Generated USD JSON, copied PNG/audio, and the demo C derivative Wasm remain
Git-ignored. The user plans to make the GitHub repository private later, but
it is currently public. A future privacy change does not itself grant
redistribution rights, so do not push these extracted assets or the demo C
source/compiled derivative without clear permission. Source conversion scripts
and local build instructions are tracked.
