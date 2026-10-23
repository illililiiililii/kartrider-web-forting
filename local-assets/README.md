# Local P5136 assets (never committed)

Put the original PC KartRider **5136** resources here. No KartRider: Drift assets.

- `rhoOut/`: unpacked resources, directly containing `gui/`, `stage/`, `sound/`, `track/`, etc.
- `track/`: track folders, e.g. `beach_I01/beach_I01.usda`, original
  `track.1s` and `xt_bigmap.png` beside the model. Preparation prefers this
  folder, then `rhoOut/track/<map>`, then the configured unpack root.
- `kart/`: converted kart folders, e.g. `whiteKnightV1/whiteKnightV1_demo.usda`.
- `character/`: converted character folders, e.g. `dao/dao.usda`.

Keep referenced textures beside the model with their original relative paths.
Keep `skydome.1s` and its referenced sky texture beside each track too.
Preparation reuses the native reader for the sky, keeps authored USD normals
(including weighted seated normals), and reads alpha flags from bound materials.
The reference flower-logo ads use the exact `20221222_facelift` theme/slot;
no unrelated kart atlas is substituted for missing regional number plates.
If unpacked resources live elsewhere, save an ignored `local-data/asset-paths.json`:

```json
{"rhoRoot":"D:\\path\\to\\_rhoOut","trackSourceScale":1.0}
```

All preparation/build scripts and GUI hash tests read this mapping; explicit path
arguments and `KART_ASSET_ROOT` take priority. `trackSourceScale` defaults to 1.
Current supplied exports match native `.1s` coordinates at 1.0; the earlier
2/3 setting belonged to different exports and must not be reused blindly.
Native collision preparation rejects a scene-wide coordinate mismatch.
This input normalization preserves the established tenfold web track scale,
kart size and checkpoint units.
Kart/character conversions keep 0.01. The source files are never rewritten.

USD ASCII/binary and FBX are detected from file signatures. FBX requires Blender
(`-BlenderExe`) and is exported into ignored `local-data/fbx-usd/` first; source
models are never changed. Converted USD uses the existing OpenUSD pipeline.

From the project root (PowerShell; Python with usd-core 25.5.1, Pillow and NumPy 2.3.5,
.NET 8 SDK and Git for original `.1s` collision extraction):

```powershell
.\tools\prepare-local-tracks.ps1
.\tools\prepare-local-ui.ps1
.\tools\prepare-local-audio.ps1
.\tools\prepare-local-usd.ps1
.\tools\build-demo-physics.ps1 -Bootstrap
node server.mjs
```

To upgrade already converted models without rebuilding collision data, run
`tools/prepare-local-normals.py`, then `tools/prepare-local-riders.py`;
`tools/prepare-local-sky.py --rho-root local-assets/rhoOut` prepares original skies.
Run `tools/prepare-local-ui.ps1` for the XML-based V1 exceed dashboard. Its EX
decoration stays idle because the recovered demo does not simulate V1 exceed.

Empty inputs are reported as waiting. Partial/malformed inputs fail explicitly.
The physics build needs no game assets: without all three `track.1s` files it
builds debug physics with **no 5136 courses**, never the 2004 course substitutes.
After supplying all three original tracks, rebuild to generate their own gates.
GUI/XML and audio are copied/resolved from `rhoOut/` by existing scripts; missing
original GUI, textures, sound and full race validation remain waiting for assets.

`prepare-local-usd.ps1` automatically calls `prepare-local-collision.ps1` when
all three original `track.1s` files exist. It downloads a pinned reader into
ignored `.tools/` and uses the original demo exporter and inherited `property/road`
flags. `collision-info.json` records visual alignment and unmatched objects.
F3 in the race, or the debug page's collision button, displays the actual KTRK
triangles. Prolonged wall contact still has a reproduced native-engine sinking
issue, and Beach I02 has 19 collision meshes without a matching USD world box;
full laps are not certified. Raw sources are never rewritten.

For all supplied USDA tracks, kart bodies and character variants:

```powershell
.\tools\prepare-local-all.ps1
```

This reuses the same USD/native collision converters, copies available original
track images, generates a local catalog, compiles every valid original course,
and tests all enabled spawns in Wasm. Logs and incremental caches stay in
`local-data/catalog-logs/` and `local-data/catalog-cache/`. Original Korean
track names and lap counts come from the supplied XML. Missing lap data,
unsupported native types, non-finite source geometry and coordinate mismatches
remain disabled; no guessed start, collision flags or lap counts are invented.
The main game uses the source cotten5 dynamics/geometry. The requested 1.5x
kart/character enlargement changes presentation only. Other themes' BGM stays
silent until its exact original music selection is connected; Beach/Village
BGM and original drift/boost effects remain connected.

`prepare-local-all.ps1` also copies the selected original booster/flare/wave/
blur images and both solo/team item icons with `prepare-local-effects.ps1`.
The current single-player race uses the solo icon. All copied effects remain
ignored. The settings button switches boost blur and remembers that choice.
Original `ToMinimap` registration is extracted from each map's own `.1s`;
the enlarged `xt_bigmap.png` pans beneath the vehicle marker. Missing mappings
retain an explicitly labelled collision schematic, without guessed calibration.

`prepare-local-riders.py` derives a seated web driving pose from retained original
joints/weights for the supplied character families, preserving the rest mesh.
`prepare-local-hud.py` copies original lap atlas rectangles and timings from XML.
The main account store grants only practiceV1 and cottonV1. Other prepared karts
remain available in the local Lucci shop; prices/rewards are provisional local
policy in player-store.mjs, not extracted original 5136 economy data. Accounts,
owned items and balances live in ignored local-data/accounts-4174.sqlite. Back up
that database separately to retain progress after a PC format.

For a consistent live account backup, run `node tools/backup-user-db.mjs`.
