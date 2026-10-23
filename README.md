# KartRider 5136 web port — local playable work in progress

Main game: [http://127.0.0.1:4174/](http://127.0.0.1:4174/).
Physics/telemetry test page: [http://127.0.0.1:4174/debug.html](http://127.0.0.1:4174/debug.html).
The main page now composes unchanged P5136 GUI PNGs according to the supplied
lobby/race screenshots and `stage/mainMenu`, `stage/timeAttackReady`,
`dialog/garageDialog`, `dialog2/selectTrackEx`, and `stage/speedIndiGame`
layouts. Its mountain/clock-tower/roof backdrop and
decorative riders come from `myRoom/2022_Facelift_main`, and its white bottom
taskbar comes from `gui/window/menu`. It uses
the supplied kart/character/track meshes, track cards, minimap, speed-number
sheet, timer-number sheet, V1 N₂O slot/gauge and tachometer, and taskbar icons. Dynamic labels and
native account fields are text, not newly drawn UI art. The account-entry
layout remains provisional because an original account-login screen was not
found in the extracted files.
Validated local tracks use original `.1s` road-tagged collision
triangles. Full wall-contact stability remains under investigation. Their original `.1s` ToRoad checkpoint routes, lap counts and a
basic finish result are connected to C/Wasm. Multiplayer is not implemented.

The browser game now links the **unmodified** `kart_dynamics.c`,
`kart_simulation.c`, `kart_camera.c`, `kart_countdown.c`, `kart_course.c`,
`kart_course_data.c`, `kart_engine_sound.c`, `kart_input.c`, and track C modules from
[KartriderDemoPhysics](https://github.com/overjoy1008/KartriderDemoPhysics)
plus `kart_demo_data.c`, `kart_track_texture.c` and `demo/kart_gauge.h` into WebAssembly. The local builder compiles all 13 C files in the supplied `src` directory, including the KTEX/KTXZ texture reader, and rejects an unreviewed source-count change. Its simulation uses the demo's 5ms maximum substep, four
wheel contacts, suspension, longitudinal and lateral/drift force pipeline,
drag, pose integration, collision response, and chase-camera update. Our
`src-demo/demo_bridge.c` supplies a temporary flat debug test world, square walls,
and an adapter for original `.1s` road-tagged triangle collision. The demo's
7-second countdown, start-boost window, steering-key ownership, gauge's
200-unit/two-slot hypothesis, course-gate graph, warp, recovery, and sound
driving laws are linked. This is **2004 demo physics**, not verified P5136
physics. The rendered chase camera now consumes the C position, forward/up vectors and
full 75–110 degree FOV; C performs the follow smoothing. The race camera position is applied without a web occlusion override. Lobby and top-down presentation remain separate. Kart and character presentation is enlarged by 1.5x, while the physics keeps
the source cotten5 geometry and dynamics. Kart selection changes the model,
not invented V1 dynamics. Input handedness is converted once at the browser boundary.
Its Windows renderer/playback and experimental multi-gear sound are
not part of the physics Wasm. The demo's 2004 course tables are not silently
applied to the 5136 tracks: local 5136 ToRoad gates are decoded separately
from the supplied `track.1s`. The former Rust physics investigation
is preserved in [`OLD_PYS`](OLD_PYS/README.md) and is not loaded in the browser.

## Build and play locally (Windows)

The tested demo C sources are now included at `third_party/KartriderDemoPhysics`
(revision and hashes in `SOURCE.json`); no Downloads checkout is needed.
Install Node.js (with `node:sqlite`; Node 22.13+ or newer) and, for original course/model conversion, Python 3.
From a fresh checkout:

```powershell
.\tools\build-demo-physics.ps1 -Bootstrap
node server.mjs
```

`-Bootstrap` downloads Zig 0.13.0 into ignored `.tools/` and verifies its official
SHA-256. Existing Zig can be supplied with `-ZigExe`. Without game assets,
`/debug.html` runs standalone physics; the original game/lobby needs local assets.
The builder emits no 5136 gates when resources are absent and rejects partial
three-track inputs. It never substitutes the demo's 2004 gates for 5136 tracks.
Original files go in [`local-assets/`](local-assets/README.md); all prepare scripts
default there. Empty inputs report `WAITING` without scanning former Downloads.

Before starting the server, prepare the track cards and minimaps from the
user's unpacked original files in `local-assets/rhoOut/`:

```powershell
.\tools\prepare-local-tracks.ps1
.\tools\prepare-local-ui.ps1
.\tools\prepare-local-audio.ps1
# Required for model conversion (not for standalone debug physics):
python -m pip install usd-core==25.5.1 Pillow numpy==2.3.5
# Native collision conversion additionally requires the .NET 8 SDK and Git.
.\tools\prepare-local-all.ps1
```

The locally copied artwork, 5136-derived C gate table, and collision outputs
are Git-ignored. The new
main page drives on `beach_I01`, `beach_I02`, and `village_R01` visual meshes
with KTRK collision selected by original inherited `property/road` metadata.
`prepare-local-all.ps1` discovers every supplied USDA model, retains original
Korean track labels/lap data, builds all valid ToRoad tables and verifies each
advertised start through Wasm. Unsupported inputs stay disabled with a reason
in ignored `assets/catalog.json`. It caches unchanged successes and failures.
.NET 8 SDK, Git, usd-core 25.5.1, Pillow and NumPy 2.3.5 are required for full preparation. Its checkpoint gates are decoded
from those tracks' original `.1s` ToRoad records and use 3/3/2 laps
respectively. The web track, collision triangles, and `.1s` gates are all
enlarged tenfold relative to the earlier prototype while the kart/character
and its C body originally remained the same size. The later 1.5x model-only
enlargement leaves native physics unchanged. This deliberately changes the prototype
world scale; it is **not** a claim about original 5136 physical metres. The
original-scale start heights had agreed with KTRK within 0.005 m before this
uniform enlargement. The square test course
remains on `/debug.html`. Model inputs are detected by signature (USD ASCII/binary or FBX); FBX uses
Blender before the existing USD converter. Full FBX conversion awaits input files.
See [`DEVELOPMENT_PROGRESS.md`](DEVELOPMENT_PROGRESS.md).

Open [http://127.0.0.1:4174/](http://127.0.0.1:4174/). The generated
`web-preview/demo_physics.wasm` is ignored by Git and must be built locally.
The pinned upstream snapshot has no license file; its notices and provenance
are preserved in [`third_party/README.md`](third_party/README.md). Original game
assets and generated Wasm/course tables remain ignored.

Controls: arrows or numpad 8/2/4/6 (W/A/S/D also work), Shift drift, Ctrl
booster after a full gauge is banked at drift end, R reset, F3 collision wireframe. On `/debug.html`, use the slider to set the demo's
`max_steer_angle_deg` from 1° to 30° in 0.1° increments; the adjacent number
box accepts an exact value and the setting is saved locally. The source
default is 10°. `Space`/Exceed is disabled until later P5136 integration.
The separate demo physics selector loads the source's `cotten5`, `practice1`,
`saber5`, or `solid5` dynamics and body geometry; the P5136 V1 mesh selection
is visual only and does not pretend to be that demo kart. The start has the
demo's 7-second countdown and ±100 ms acceleration-press boost window. The
square debug test course is not an original P5136 race. The demo gauge rule is
explicitly a hypothesis, not a recovered original charging formula. The two
V1 passive-charger API remains experimental and is disabled in the main game;
the original demo SLIP gauge is used. Stored debug steering-angle settings do
not override the main game's source preset. Both input paths use the original
last-key ownership; aliases and touch inputs share that same state. The visible lap
totals come from original `track@zz.xml`; original `.1s` ToRoad checkpoints
drive the Wasm lap and finish state. On imported tracks, `R` requests a
course checkpoint respawn; deep-fall recovery can still use a temporary
grounded safety pose without clearing the timer.

`server.mjs` provides independent web-game accounts (not Nexon/P5136 accounts):
`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, and
`POST /api/auth/logout`. `/login.html` provides a local account form using the
original menu panel and generic red button sprites. Passwords are scrypt-hashed; hashed session tokens
are stored in ignored `local-data/accounts-4174.sqlite`; cookies are HttpOnly and
SameSite=Strict. Set `KART_COOKIE_SECURE=1` behind HTTPS. The original
`stage/authenStage` is a separate challenge screen, not evidence for a P5136
account-login layout.

The local original `.1s` kart geometry can be converted without committing
copyrighted assets:

```powershell
python .\tools\convert-1s-preview.py '..\..\work\original-assets\whiteKnight1-model.1s' '.\web-preview\assets\whiteKnight1.mesh.json'
python .\tools\convert-1s-preview.py '..\..\work\original-assets\cotton11-model.1s' '.\web-preview\assets\cotton11.mesh.json'
```

If those ignored local meshes are absent, the 3D renderer shows a temporary
geometric kart. Converted kart wheels now steer/spin from the C physics state,
and timed boost shows a basic exhaust effect. The newer USD path additionally
loads original kart/character textures and three original track scenes. The
main page uses original collision metadata; skeletal animation and
full wall-contact stability remain unfinished. After changing track conversion
scale, rerun `prepare-local-usd.ps1` and `build-demo-physics.ps1` together so
visual road, KTRK hitboxes and ToRoad checkpoint gates stay aligned.

## Verification

The demo C speed-steering formula is linked unchanged:
`maxSteer × exp(-abs(forwardVelocity / steer_constraint))`. Direct Wasm
measurements at the same 10° slider setting yielded 10.00° at 0 m/s,
5.77° at 15.50 m/s, and 3.54° at 29.15 m/s. The new regression test checks
this trend. Drift slip calculation can use a separate maximum-steer path,
so this evidence applies to non-drift steering only.

```powershell
.\tools\build-demo-physics.ps1
.\tools\test-5136-course.ps1
.\tools\test-physics-parity.ps1
python tools/test-usd-conversion.py
node --test tools\test-auth-server.mjs tools\test-demo-physics.mjs tools\test-frame-interpolation.mjs tools\test-local-ui-assets.mjs tools\test-recovery.mjs tools\test-wheel-basis.mjs tools\test-track-collision.mjs tools\test-local-models.mjs tools\test-demo-input.mjs tools\test-kart-pose.mjs tools\test-local-catalog.mjs
```

The recovery run passes 17 Node checks and one Python format check; eight
asset-dependent checks are skipped. Zig bootstrap and identical offline rebuilds
are verified. The historical asset-backed run passed 22 Node checks plus native synthetic traversal
of all three complete original routes. These checks include V1 speed-threshold
charging, original GUI asset
hash verification, imported track
collision, clear launch directions on all three tracks, speed-dependent steering, demo gauge/countdown/input/course
behavior, and register/login/logout.
In direct Wasm tests, the default
demo kart accelerated to about 156 km/h after 1.6 seconds on the flat test world; with
identical short inputs, 5°/10°/20° steering produced increasing heading
changes. Browser QA confirmed Wasm loading, the actual `.1s` kart, the slider,
and the race countdown; browser QA also confirmed Beach I01's corrected
original start-line direction. Native traversal tests feed the gate quads
directly and do **not** establish that a human can drive full laps through
every original collision route. Full human-driven lap completion and original-client
trajectory equivalence are **not** verified. See [`reader.md`](reader.md) for
remaining work and limitations.

The official local server now defaults to port **4174** and the persistent
`local-data/accounts-4174.sqlite` database. `KART_PORT`/`KART_DATABASE_PATH`
can explicitly select another port/database. The old port-4173 database
`local-data/accounts.sqlite` is retained separately; it is not overwritten.
Session cookies are isolated by port to prevent test servers replacing a login.
To back up users/progress safely while the server is running:

```powershell
node tools/backup-user-db.mjs
```

This writes a consistent SQLite snapshot including WAL contents into ignored
`local-data/backups/`. Do not back up only the live `.sqlite` file without its
WAL. Account databases/backups contain private account records and stay out of Git.
