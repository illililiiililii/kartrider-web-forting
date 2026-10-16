# Sources and attribution

- REA: https://github.com/morluto/rea — installed using the official `rea-agents@6.5.0` npm package. REA registration was verified; no claim of native decompilation is made.
- Kartrider-File-Reader: https://github.com/xpoi5010/Kartrider-File-Reader — GPL-3.0. Used locally to decode RHO5 and `.1s` assets. A read-only `TexProperty.Additional` accessor was added in the workspace to expose its decoded `tmpTag`. The library is not bundled into the browser runtime.
- KartriderDemoPhysics: https://github.com/overjoy1008/KartriderDemoPhysics — local mesh/course conversion tools and its documented 2004 demo dynamics recovery were used as references for the 5 ms force pipeline. The browser implementation is separate code and is not the original P5136 engine.
- P5136_Rust: https://github.com/ILoveKartrider/P5136_Rust — `p5136-core/src/kart_physics.rs` is used to reproduce the S7 speed-spec plus kart BodyParam composition and speed-start acceleration calculation. This project does not use its network server or claim that its protocol snapshots reveal the P5136 client simulation implementation.
- Three.js 0.180.0: https://github.com/mrdoob/three.js — MIT, license included in `vendor/THREE-LICENSE.txt`.
- Original game assets: extracted from the user's local `KartRider_5136.zip` and `KartRider_5136_01_UNPACK.zip`. Original assets retain their respective owners' rights. This output is a local development copy, not a public deployment or a relicensing of those assets.

Exact checked-out conversion-tool revisions are recorded in `source-versions.json`.
