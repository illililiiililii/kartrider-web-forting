# P5136 WebAssembly port

This is a new, from-scratch browser port based on the supplied Korean KartRider P5136 client, its expanded data, and measurements taken from that client. No code or tuning values from the rejected earlier web project are used.

The repository is still at the physics-evidence gate. The temporary 2D browser sandbox below is for input and Wasm smoke testing, **not** a playable P5136 port or original-physics validation.

## Try the temporary 2D sandbox

The local server is currently available at [http://127.0.0.1:4173/](http://127.0.0.1:4173/) on this computer. To rebuild and restart later, run these commands in this repository:

```powershell
.\tools\build-preview.ps1
python -m http.server 4173 --bind 127.0.0.1 --directory web-preview
```

Use W/↑ to accelerate, S/↓ to brake/reverse, A/D or ←/→ to steer, Shift to drift, Space for boost, and R to reset. Touch buttons are also provided. The canvas and controls are JavaScript, while all 2D state updates run in Rust/Wasm. Following user test feedback, the preview turns more slowly, visibly rebounds from square walls, and keeps sliding after drift-key release until countersteer or lower speed ends it. Slip angle and drift time are displayed. The 1–2 ms substep schedule, steering expressions, and speed-squared drift-release scalar are recovered from the client; **how that scalar affects tire forces remains unknown**. Its use as a 2D persistence timer, the steering settings, wall restitution, drive force, grip, gauge, and boost are provisional. This sandbox is intentionally separate from the required original-client time-series comparison.

## Implemented now

- Rust core with the original tick scheduler: elapsed time is clamped to 500 ms and split into 2 ms substeps plus a possible 1 ms tail.
- Exact decoder and all 70 named fields for the 235-byte effective `KartSpec` race-start block.
- Version-pinned native layout constants, exact body-axis velocity projection and speed magnitude, recovered scalar suspension, input-channel selection, drift-input transitions and release countdown, the initial plus speed-attenuated steering target, the forward force-vector path, the normal linear-velocity substep, one upward-surface contact velocity branch, and the post-collision position substep.
- Dependency-free raw WebAssembly ABI for querying and writing substep plans.
- Version-pinned 32-bit native telemetry, injector, and scan-code input driver for controlled original-client captures.
- Checked-in controlled-run evidence and a deterministic PowerShell slicer/summary generator.
- Static and runtime evidence ledger in [`docs/physics-evidence.md`](docs/physics-evidence.md).

Unresolved work is listed without euphemism in [`reader.md`](reader.md).

## Rust tests and WebAssembly build

The commands below keep downloaded toolchains and build artifacts outside the repository. They assume Rust with the `wasm32-unknown-unknown` target is available.

```powershell
$env:CARGO_HOME = 'C:\Users\user\Documents\Codex\2026-10-20\p5136-webassembly-windows-url-c-rust-2\work\.toolchains\cargo'
$env:RUSTUP_HOME = 'C:\Users\user\Documents\Codex\2026-10-20\p5136-webassembly-windows-url-c-rust-2\work\.toolchains\rustup'
$env:PATH = "$env:CARGO_HOME\bin;$env:PATH"

cargo test --target-dir '..\..\work\kart-web-target'
cargo build --target wasm32-unknown-unknown --release --target-dir '..\..\work\kart-web-target'
```

The verified release artifact is:

`..\..\work\kart-web-target\wasm32-unknown-unknown\release\p5136_wasm_core.wasm`

The current preview Wasm SHA-256 is `E639A0D6394449D5F04C5F7B3557503432EA8EC49E5B33F903DC965D564B0882` (38,714 bytes). It exports WebAssembly memory plus:

- `p5136_abi_version`
- `p5136_plan_substeps` and `p5136_substep_count`
- `p5136_validate_kart_spec`
- `p5136_project_world_velocity`
- `p5136_speed_magnitude`
- `p5136_suspension_scalar_force`
- `p5136_apply_drift_input`
- `p5136_drift_release_scalar`
- `p5136_decay_drift_release_scalar`
- `p5136_base_steer_radians`
- `p5136_speed_attenuated_steer_radians`
- `p5136_forward_drive_input` and `p5136_reverse_brake_input`
- `p5136_forward_force_vector`
- `p5136_integrate_linear_velocity`
- `p5136_integrate_position_after_collision`
- `p5136_upward_contact_velocity`
- `p5136_uses_upward_contact_velocity_branch`
- `p5136_wall_contact_reported_speed`
- `p5136_preview_new`, `p5136_preview_step`, `p5136_preview_reset`

Forty-one Rust unit tests pass. The preview page and Wasm return HTTP 200 locally, and direct Wasm calls verify acceleration, sustained drift with countersteer decay, and wall rebound. Browser feel still needs user testing.

## Native original-client instrumentation

This requires 32-bit MSVC because the supplied client is 32-bit.

```powershell
cmake -S tools\native-telemetry -B '..\..\work\telemetry-build' -A Win32
cmake --build '..\..\work\telemetry-build' --config Release --parallel
```

The telemetry DLL refuses to hook a client whose nine-byte physics-tick prologue differs from the pinned P5136 build. The callback only fills a preallocated ring buffer; CSV I/O runs on a separate below-normal-priority thread. Input uses keyboard scan codes because virtual-key events reached the old UI but not the game's DirectInput driving path.

The extended telemetry DLL was rebuilt with `/W4 /WX`; its current SHA-256 is `1F7E43DFE5B0F16FC5B85575A188FDFC962726895F8AE8438CE8789D3467B01E`.

## Reproduce the checked-in controlled trace

```powershell
.\tools\trace-slice.ps1 `
  -TelemetryPath '..\..\work\analysis\controlled-input-telemetry-04.csv' `
  -EventsPath '..\..\work\analysis\controlled-input-events-04.csv' `
  -OutputDirectory '.\evidence'
```

The committed outputs are:

- `evidence/controlled-input-events-04.csv`: exact injected input events.
- `evidence/original-controlled-04.csv`: 822 original-client tick samples aligned to the driven interval.
- `evidence/original-controlled-04-summary.csv`: phase-level speed, gauge, and displacement measurements.

There is no browser URL yet. The next completion gate is a Rust replay that produces the same comparison schema and quantifies its error against this original trace; browser rendering and UI remain behind that gate.

## Source boundary

Allowed inputs are the supplied original folders, the supplied `P5136_Rust-main` protocol/asset reference, and newly acquired REA/Ghidra and runtime evidence. The quarantined prior web project is explicitly not an input.
