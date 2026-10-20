# P5136 WebAssembly port

This repository is a clean-room, from-scratch browser port derived from the supplied Korean KartRider P5136 client data and newly acquired runtime observations. It does not reuse the previously existing web project.

## Current gate

The project is intentionally held at the physics-analysis gate. UI and gameplay presentation are not considered started until the original client time step, call order, state transitions, and kart-specific parameters have been captured and replayed in the Rust/WebAssembly core.

Evidence and confidence labels are recorded in [`docs/physics-evidence.md`](docs/physics-evidence.md). Known gaps are recorded in [`reader.md`](reader.md).

## Source boundary

Allowed source inputs:

- `C:\Users\user\Downloads\kart web\KartRider_5136`
- `C:\Users\user\Downloads\kart web\KartRider_5136_01_UNPACK\KartRider_5136_01_UNPACK`
- `C:\Users\user\Downloads\kart web\P5136_Rust-main`
- newly generated REA/Ghidra reports and original-client telemetry

The quarantined previous web project is not an input.

