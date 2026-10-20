# Open analysis and implementation gaps

This file is deliberately candid. A value is not described as original-client behavior until static or runtime evidence supports it.

## Physics gate

- Fixed or variable time-step policy and substep count: runtime capture pending.
- Full `GoPlayKart` main-tick call order: decompilation and runtime trace pending.
- Longitudinal force integration and terminal-speed equation: pending.
- Front/rear slip-angle and lateral-force curves: pending.
- Drift entry, hold, chained-drift, and exit transition predicates: pending.
- Start boost and post-drift boost timing predicates: pending.
- Suspension ray/contact layout, gravity, jump, and airborne attitude: pending.
- Track floor/wall collision response and recovery: pending.

## Assets

- The supplied expanded `_rhoOut` tree contains character and track assets, but no top-level kart model tree was observed in the first inventory. `Data\kart.rho` is present and must be independently decoded before any claim that kart models are unavailable.
- `.1s` geometry, skeleton, animation, material, and collision semantics still require a from-scratch converter with golden fixtures.

## Browser systems

- Rust/WebAssembly physics, race state, checkpoints, lap logic, renderer bridge, audio, lobby, HUD, mobile input, and multiplayer are not implemented yet because the required physics gate is still open.

