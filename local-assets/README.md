# Local P5136 assets (never committed)

Put the original PC KartRider **5136** resources here. No KartRider: Drift assets.

- `rhoOut/`: unpacked resources, directly containing `gui/`, `stage/`, `sound/`, `track/`, etc.
- `track/`: converted track folders, e.g. `beach_I01/beach_I01.usda`.
- `kart/`: converted kart folders, e.g. `whiteKnightV1/whiteKnightV1_demo.usda`.
- `character/`: converted character folders, e.g. `dao/dao.usda`.

Keep referenced textures beside the model with their original relative paths.
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

From the project root (PowerShell; Python with usd-core 25.5.1 and Pillow,
.NET 8 SDK and Git for original `.1s` collision extraction):

```powershell
.\tools\prepare-local-tracks.ps1
.\tools\prepare-local-ui.ps1
.\tools\prepare-local-audio.ps1
.\tools\prepare-local-usd.ps1
.\tools\build-demo-physics.ps1 -Bootstrap
node server.mjs
```

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
