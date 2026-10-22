# Local P5136 assets (never committed)

Put the original PC KartRider **5136** resources here. No KartRider: Drift assets.

- `rhoOut/`: unpacked resources, directly containing `gui/`, `stage/`, `sound/`, `track/`, etc.
- `track/`: converted track folders, e.g. `beach_I01/beach_I01.usda`.
- `kart/`: converted kart folders, e.g. `whiteKnightV1/whiteKnightV1_demo.usda`.
- `character/`: converted character folders, e.g. `dao/dao.usda`.

Keep referenced textures beside the model with their original relative paths.
If unpacked resources live elsewhere, save an ignored `local-data/asset-paths.json`:

```json
{"rhoRoot":"D:\\path\\to\\_rhoOut","trackSourceScale":0.6666666666666666}
```

All preparation/build scripts and GUI hash tests read this mapping; explicit path
arguments and `KART_ASSET_ROOT` take priority. `trackSourceScale` defaults to 1.
Use 2/3 only for the supplied `usda_relement` 1.2.0 track exports: their start
stripe is 1.5 times the original `.1s` coordinates. This input normalization
preserves the established tenfold web track scale, kart size and checkpoint units.
Kart/character conversions keep 0.01. The source files are never rewritten.

USD ASCII/binary and FBX are detected from file signatures. FBX requires Blender
(`-BlenderExe`) and is exported into ignored `local-data/fbx-usd/` first; source
models are never changed. Converted USD uses the existing OpenUSD pipeline.

From the project root (PowerShell; Python on PATH, usd-core 25.5.1 for models):

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
