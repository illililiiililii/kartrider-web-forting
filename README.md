# KartRider 5136 web port — local playable work in progress

Main game: [http://127.0.0.1:4173/](http://127.0.0.1:4173/).
Physics/telemetry test page: [http://127.0.0.1:4173/debug.html](http://127.0.0.1:4173/debug.html).
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
All three converted original tracks can be driven with experimental collision
triangles. Their original `.1s` ToRoad checkpoint routes, lap counts and a
basic finish result are connected to C/Wasm. Multiplayer is not implemented.

The browser game now links the **unmodified** `kart_dynamics.c`,
`kart_simulation.c`, `kart_camera.c`, `kart_countdown.c`, `kart_course.c`,
`kart_course_data.c`, `kart_engine_sound.c`, `kart_input.c`, and track C modules from
[KartriderDemoPhysics](https://github.com/overjoy1008/KartriderDemoPhysics)
plus `kart_demo_data.c` and `demo/kart_gauge.h` into WebAssembly. Its simulation uses the demo's 5ms maximum substep, four
wheel contacts, suspension, longitudinal and lateral/drift force pipeline,
drag, pose integration, collision response, and chase-camera update. Our
`src-demo/demo_bridge.c` supplies a temporary flat debug test world, square walls,
and an adapter for heuristic original-track triangle collision. The demo's
7-second countdown, start-boost window, steering-key ownership, gauge's
200-unit/two-slot hypothesis, course-gate graph, warp, recovery, and sound
driving laws are linked. This is **2004 demo physics**, not verified P5136
physics. Its Windows renderer/playback and experimental multi-gear sound are
not part of the physics Wasm. The demo's 2004 course tables are not silently
applied to the 5136 tracks: local 5136 ToRoad gates are decoded separately
from the supplied `track.1s`. The former Rust physics investigation
is preserved in [`OLD_PYS`](OLD_PYS/README.md) and is not loaded in the browser.

## Build and play locally (Windows)

1. Obtain the demo source in a separate directory. This project was tested
   against commit `a9eade1f343764b10fb6dce5fec3828756fad2e6`.
2. Obtain Zig 0.13.0 from the [official downloads](https://ziglang.org/download/0.13.0/)
   and extract it outside this repository.
3. Run the local-only builder, passing the actual paths if they differ from
   the sibling `work` defaults. The builder also requires the supplied
   unpacked 5136 `_rhoOut` folder; override it with `-RhoRoot` if needed:

```powershell
.\tools\build-demo-physics.ps1 -DemoSource 'C:\path\to\KartriderDemoPhysics' -ZigExe 'C:\path\to\zig.exe'
node server.mjs
```

Before starting the server, prepare the track cards and minimaps from the
user's unpacked original files (the script default points at the supplied
`C:\Users\user\Downloads\kart web` folder):

```powershell
.\tools\prepare-local-tracks.ps1
.\tools\prepare-local-ui.ps1
.\tools\prepare-local-audio.ps1
# Needed only if the local work/usd-python runtime is unavailable:
python -m pip install usd-core==25.5.1
.\tools\prepare-local-usd.ps1
```

The locally copied artwork, 5136-derived C gate table, and collision candidates
are Git-ignored. The new
main page drives on `beach_I01`, `beach_I02`, and `village_R01` visual meshes
with heuristic KTRK collision candidates. Its checkpoint gates are decoded
from those tracks' original `.1s` ToRoad records and use 3/3/2 laps
respectively. Source coordinates scale by 0.1 into the converted scene; all
three original start heights agree with KTRK within 0.005 m. The square test course
remains on `/debug.html`. The supplied converted models are USDA, not FBX.
See [`DEVELOPMENT_PROGRESS.md`](DEVELOPMENT_PROGRESS.md).

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The generated
`web-preview/demo_physics.wasm` is ignored by Git and must be built locally.
The demo repository snapshot inspected here has no visible redistribution
license. Neither its C source nor a compiled derivative is committed here.
The bridge and build recipe alone cannot make a fresh public checkout playable
until the user provides a locally obtained demo source and builds its Wasm.

Controls: arrows or numpad 8/2/4/6 (W/A/S/D also work), Shift drift, Ctrl
booster after a full gauge is banked at drift end, R reset. On `/debug.html`, use the slider to set the demo's
`max_steer_angle_deg` from 1° to 30° in 0.1° increments; the adjacent number
box accepts an exact value and the setting is saved locally. The source
default is 10°. `Space`/Exceed is disabled until later P5136 integration.
The separate demo physics selector loads the source's `cotten5`, `practice1`,
`saber5`, or `solid5` dynamics and body geometry; the P5136 V1 mesh selection
is visual only and does not pretend to be that demo kart. The start has the
demo's 7-second countdown and ±100 ms acceleration-press boost window. The
square debug test course is not an original P5136 race. The demo gauge rule is
explicitly a hypothesis, not a recovered original charging formula. The two
selectable V1 karts additionally use a configurable passive charger in the
C/Wasm bridge: grounded forward speed above 25 m/s adds 2 gauge units/s.
These values are provisional, not recovered P5136 constants. The visible lap
totals come from original `track@zz.xml`; original `.1s` ToRoad checkpoints
drive the Wasm lap and finish state. On imported tracks, `R` requests a
course checkpoint respawn; deep-fall recovery can still use a temporary
grounded safety pose without clearing the timer.

`server.mjs` provides independent web-game accounts (not Nexon/P5136 accounts):
`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, and
`POST /api/auth/logout`. `/login.html` provides a local account form using the
original menu panel and generic red button sprites. Passwords are scrypt-hashed; hashed session tokens
are stored in ignored `local-data/accounts.sqlite`; cookies are HttpOnly and
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
main page drives on heuristic collision triangles; skeletal animation and
verified original collision remain missing.

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
node --test tools\test-auth-server.mjs tools\test-demo-physics.mjs tools\test-frame-interpolation.mjs tools\test-local-ui-assets.mjs
```

The current local test run passed 20 Node checks plus native synthetic traversal
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
the provisional collision mesh. Full human-driven lap completion and original-client
trajectory equivalence are **not** verified. See [`reader.md`](reader.md) for
remaining work and limitations.
