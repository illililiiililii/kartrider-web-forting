# Archived P5136 physics investigation

This directory preserves the former Rust/Wasm physics prototype, original-client
telemetry, evidence, and its historical documentation. It is **not** loaded by
the active browser game. The former entry point is `src/lib.rs`; its last
working browser artifact is `p5136_wasm_core.wasm`. The user requested this
archive before switching the active game to the 2004 C demo physics.

The historical README and `reader.md` describe work at that earlier point in
time. Their root-relative build commands and live-status statements are not
current instructions for the active game. Run the archived Rust tests with:

```powershell
cargo test --manifest-path .\OLD_PYS\Cargo.toml --target-dir '..\..\work\kart-web-target'
```

Do not mix the archive's 1–2ms P5136 substep assumptions into the active
demo's 5ms scheduler without an explicit future integration decision.
