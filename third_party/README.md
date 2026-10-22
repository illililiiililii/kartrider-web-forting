# Physics source provenance

`KartriderDemoPhysics/` contains the 13 unchanged `src/*.c` modules, their
headers, demo gauge, ToRoad extraction script and inspected Win32 minimap/sound
references from https://github.com/overjoy1008/KartriderDemoPhysics at
`a9eade1f343764b10fb6dce5fec3828756fad2e6` (the previously tested revision).
`SOURCE.json` records LF-normalized SHA-256 values; the builder rejects changes.
Keep upstream comments and README. No LICENSE/COPYING file or redistribution
grant was found in that snapshot; this project does not invent a license for it.
Upstream assets, executables and platform playback/rendering are not included.

Our compatibility changes remain in `src-demo/demo_bridge.c` and the web code.
To update: review a new revision, replace selected files, regenerate the manifest,
then rebuild and run regression tests. Record the new revision and behavior here.

The unchanged demo `asset_tools/track-mesh-exporter/Program.cs` is also pinned
in `SOURCE.json`. `tools/prepare-local-collision.ps1` builds it with .NET 8 and
downloads [Kartrider-File-Reader](https://github.com/xpoi5010/Kartrider-File-Reader)
at `37fab6415360afa83e8034f8cedb2cc6766d2fe0` into ignored `.tools/`.
That dependency retains its GPL-3.0 LICENSE. Our bootstrap exposes its already
decoded private `TexProperty.tmpTag` as a public read-only `Additional` property;
no binary decoding is replaced. Dependency provenance and the exact patch are
recorded in `tools/native-collision-exporter/SOURCE.json`. Generated binaries
and original game assets are not committed.
