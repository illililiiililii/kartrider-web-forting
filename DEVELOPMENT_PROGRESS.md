# P5136 web port — development progress

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
  selected and viewed as actual textured 3D scene meshes. This is **a viewer**:
  the race still uses the temporary test course. Track collision and original
  checkpoint/lap metadata have not been connected to the C world callbacks.
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
  8 passed. JavaScript syntax checks passed.

## Next implementation order

1. Extract the original track's drive and collision surfaces and map the
   kart spawn pose into its coordinate frame. Feed triangle ground/wall
   queries to the C demo world callbacks before permitting track racing.
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
