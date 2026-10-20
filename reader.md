# Open analysis and implementation gaps

This file is deliberately candid. A value is not described as original-client behavior until static or runtime evidence supports it.

## Closed evidence items

- Main tick timing is recovered: clamp elapsed time to 500 ms, then integrate in 2 ms chunks with an optional 1 ms tail.
- The principal native call order has been recovered at address level.
- `GoPlayKart + 0x90` and `+0xC0` are runtime-confirmed world position and linear velocity.
- `+0x188` is a wheel-contact aggregate, not a drift state. Four per-wheel contact bytes begin at `+0x9C4`.
- The wheel suspension loop and its compression/damping shape have been decompiled.
- The exact 235-byte effective `KartSpec` layout and legacy scalar decoding are implemented in Rust and compile to WebAssembly.
- A controlled scan-code run and deterministic phase summary are checked into `evidence/`.

## Physics gate still open

- Longitudinal force integration, air-friction/drag application, and the terminal-speed equation still need protected getter calls resolved to `KartSpec` field names.
- Front/rear slip angle and lateral-force curves in `0x00A37920` need expression recovery and a controlled, collision-free trace.
- Drift entry, hold, chained-drift, and exit predicates need state-field labels. `+0xA9C` is only a candidate gate, not a proven full drift state.
- Start boost and post-drift instant boost predicates are not yet recovered.
- The suspension formula shape is known, but the protected spring/damper parameter getters and contact ray geometry are not fully named.
- Gravity, jump, airborne attitude, floor/wall collision response, and recovery require additional static labeling and isolated runs.
- The current controlled trace hits or follows track geometry during recovery. It is valid evidence of client response but is not an isolated straight-line calibration run.
- No Rust force integrator is claimed equivalent yet. The Rust core currently implements only evidence-closed scheduling and protocol decoding.

## Comparison gate

- The Rust state row must be extended to position, orientation, linear/angular/local velocity, contact mask, drift state, and booster state.
- The same effective kart block, track start transform, and input timestamps must be replayed in native and Rust runs.
- Time-series comparison must report speed, three-dimensional position, wrapped orientation, angular velocity, contact, drift state, and gauge errors.
- Large mismatches must be corrected and rerun before browser UI work starts.

## Assets

- The expanded `_rhoOut` tree has character and track data; supplied `Data\kart.rho` contains 930 `model.1s` entries.
- Exact extracted fixtures exist for White Knight and Cotton kart models and BML parameters.
- `.1s` geometry, skeleton, animation, material, and collision semantics still require a new converter with golden fixtures.
- No model from the rejected previous web project will be copied.

## Browser systems not started

Renderer bridge, converted original assets, audio, lobby, HUD, mobile input, race/checkpoint/lap state, and multiplayer remain intentionally unimplemented until the physics comparison gate closes. Consequently there is no playable URL yet.

## Rejected evidence

Controlled runs `01` through `03` used virtual-key injection. They operated menu UI but did not reach the game's DirectInput driving state, so the kart remained stationary. They are retained only as failed-method notes and are excluded from physics fitting. Run `04` uses scan-code input and is the first valid controlled driving trace.
