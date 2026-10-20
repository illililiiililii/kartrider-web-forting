# P5136 physics evidence ledger

Confidence labels:

- **confirmed/static**: exact supplied bytes or version-pinned native call site.
- **confirmed/runtime**: directly observed in a newly captured original-client run.
- **inferred**: supported by names/layout but not yet verified in execution.
- **unknown**: no adequate evidence yet.

## Build identity

| Artifact | SHA-256 | Status |
|---|---|---|
| supplied protected `KartRider.exe` | `629F084E2A12C6FA1FF0EA603B90F8768454D13A1BC2DF6A8504F8AA06FD6194` | confirmed/static |
| P5136_Rust pinned unpacked executable | `FD9444C057090C3BB524AF03BFF5EC995620FBB951B9A823D2CD4E9B0494956F` | reference only; locally reacquired bytes pending |
| fresh full dump of the launched original client | `78F8FE65EEF8807A507EC237CEC56AD38CAB2F44121B234759D3BA9BD0A508EC` | confirmed/runtime |
| contiguous live module image at `0x00400000` | `085ABCB979A518225C88DBFFB55E3767857FB92E38AA68072488484EAEE92DA3` | confirmed/runtime |
| analysis-only PE reconstructed from that live image | `8C0952F42CDE04400A076A17C85F80F5BB0D40AA4C556A0F2C75A2432F619E31` | derived from confirmed/runtime bytes |

The captured module reports PE timestamp `0x6407DD11`, image base `0x00400000`, and live image size `0x01418000`. The reconstruction changes section-table file offsets only so Ghidra can map the memory-layout bytes; it is not treated as an original executable hash.

## KartSpec transport

The P5136 race-start physics block is 235 bytes and contains 70 fields: 49 encoded `f32`, 6 encoded `i32`, and 15 encoded `u8` values. The supplied P5136_Rust field map establishes offsets for mass, air friction, drag, forward/backward acceleration force, braking, steering, front/rear grip, drift thresholds, drift escape, booster timing, and instant-acceleration gauges. This is parameter-layout evidence, not proof of the client integration formulas.

The fresh bounded BML decoder also successfully consumed two exact files extracted from the supplied `Data\kart.rho` with no trailing bytes:

| Fixture | SHA-256 | Selected `BodyParam` attributes |
|---|---|---|
| `whiteKnight1/param_kr.bml` | `9AA182C3E56303624B570D23B4869D993CAD2FF95B2C4D78EF266B0370BAA73` | `ForwardAccelForce=146.0`, `BackwardAccelForce=100.0`, `DragFactor=-0.075`, `SteerConstraint=2.3`, `DriftEscapeForce=1200`, `CornerDrawFactor=0.075`, `TransAccelFactor=1.832`, `StartForwardAccelFactorSpeed=1.5`, `StartBoosterTimeSpeed=1200`, `NormalBoosterTime=-50`, `TeamBoosterTime=-100`, `DriftMaxGauge=-450`, `DriftGaguePreservePercent=0.5` |
| `cotton11/param.bml` | `F907ACC8182D3DEECC32E564C656FEE35E84D21C212825500601DE7B28B7E68E` | `ForwardAccelForce=140.0`, `BackwardAccelForce=100.0`, `DragFactor=-0.075`, `SteerConstraint=2.3`, `DriftEscapeForce=900`, `CornerDrawFactor=0.07`, `BoostAccelFactor=1.5`, `TransAccelFactor=1.85`, `StartForwardAccelFactorSpeed=1.6`, `StartBoosterTime=1200` |

These kart values are not treated as complete standalone physical constants. The supplied race-start block builder shows that the client receives effective values composed from the speed profile, kart `BodyParam`, parts, pets, tuning, level, patch, and version-specific additions. For example, effective forward acceleration is an ordered sum beginning with `speed.forward_accel_force + kart.forward_accel_force`, while drag, grip, drift escape, booster time, and other fields have their own ordered compositions and override cases. The WebAssembly implementation must consume the same effective 235-byte semantics or reproduce that composition; copying only the kart BML values would be incorrect.

## Native anchors

Version-pinned P5136_Rust sidecar sites map the unpacked image at base `0x00400000`:

| Role | Virtual address | Status |
|---|---:|---|
| drive-event handler | `0x00A2D84D` | confirmed/static call site |
| main physics tick | `0x00A33420` | confirmed/static function entry |
| speed-derived boost-gauge additions | `0x00A3481D`, `0x00A3486C`, `0x00A348AB` | confirmed/static call sites |
| drift gauge addition | `0x00A349B0` | confirmed/static call site |
| collision response selection | `0x00A3B058` | confirmed/static call site |
| anti-collision balance | `0x00A3DBC1`, `0x00A3DC36` | confirmed/static call sites |
| wall Exceed gauge | `0x00A3F8B9` | confirmed/static call site |
| booster Exceed gauge | `0x00A3FC13` | confirmed/static call site |

These addresses provide decompilation and trace anchors. The principal call order is now recovered below; the addresses alone still do not prove the meaning of every formula.

## Main-tick stepping

**Confirmed/static from the freshly captured live image:** `0x00A33420` receives a millisecond clock value. It subtracts the previous clock, clamps the elapsed value to `500` ms, and processes the remainder in chunks computed as `min(remaining_ms, 2)`. Each chunk is converted to seconds by multiplication with the `f32` constant at `0x01087AF8`, whose captured value is exactly `0.001`. Therefore the ordinary physics substep passed down the call chain is at most `0.002` seconds (500 Hz), with a possible final `0.001`-second step for an odd millisecond remainder.

The assembly sequence is visible at `0x00A339B5`–`0x00A33A1B`: initialize remaining elapsed milliseconds, choose at most two milliseconds, subtract the chosen chunk, convert it to `f32`, and multiply by `0.001`. A later loop at `0x00A340E9`–`0x00A34163` applies the same two-millisecond split before calling `0x00A401E0`. A separate accumulator near the tick prologue uses the captured constant `0.016666668` at `0x0108C8DC`; its exact role still needs runtime confirmation and is not being labeled as the core physics step.

Within the principal substep path, the currently recovered direct call order includes:

`0x00A34A60 → 0x00A35380 → 0x00A35B20 → 0x00A35D00 → [conditional 0x00A36310] → [conditional 0x00A36E30, 0x00A370A0, 0x00A37920] → 0x00A3A030 → 0x00A39540 → 0x00A39740 → 0x00A399C0/0x00A3A270 → 0x00A3A480 → 0x00A3A780 → [conditional 0x00A34BC0, 0x00A34E90] → 0x00A3A7F0 → 0x00A34640 → 0x00A348E0 → 0x00A401E0 → 0x00A3F980 → 0x00A3FB70`.

This is an address-level call-order result. Function roles beyond the already pinned gauge/collision sites remain under decompilation and runtime tracing, so semantic names are intentionally not invented yet.

The full saved decompilation of `0x00A33420` (`work/analysis/main-tick-full.md`, SHA-256 `6143C692B7D77A2C999CCC5ECDA314F5A295C6A211E32FC6D95C855CB1E92068`) confirms that `0x00A3A7F0` updates velocity before collision/movement calls `0x00A3AB30` and `0x00A3B860` in the ordinary branch. A separate state branch calls `0x00A3A930`; its instruction sequence `0x00A3A93E..0x00A3A968` adds `world_velocity(+0xC0) * substep_seconds` to world position `+0x90`. The separate-branch position listing is `work/analysis/position-integrator-listing.md`, SHA-256 `2EDCB5519A1776D5281C1391F640ACE052D446B1BCAB4D741A6FCC65B466584C`. The ordinary branch also calls `0x00A3CB90` after collision response. Its instructions `0x00A3CCA0..0x00A3CCCB` multiply the then-current `+0xC0` velocity by the substep seconds (`0x00667B30`) and add the result to world position `+0x90` (`0x00679940`). This establishes collision-before-position order, but not the collision response itself. The exact listing is `work/analysis/normal-position-listing.md`, SHA-256 `384E1C376C6D07A5A92235E8CF65B0CC5E4B3371EDD7A4D43F3A7A45AABCBE03`.

## Targeted native decompilation

A saved Ghidra project was built from the analysis-only PE and a deterministic exporter captured 30 physics functions, including all principal tick callees and the pinned collision/gauge functions. The resulting 129,254-byte report has SHA-256 `39F40949F66076561B6E57D0D10CA771487B8D5466088F3C895EDC46BFAECE30`. The REA evidence record for the initial decompilation is `ev_7d6ac7d98fb177ac98c72766d417c44fd8c006cfe793da633584234729174ec7`.

The following roles are supported strongly enough to guide the next probes:

- `0x00A35B20` projects world linear velocity `+0xC0` onto the forward axis at `+0xA50`, the lateral axis at `+0xA38`, and the vertical axis at `+0xA44`. It writes forward velocity to raw `+0xA5C`, lateral velocity through the protected-float setter at `+0xA60`, and vertical velocity to raw `+0xA6C`. It separately writes `sqrt(vx²+vy²+vz²)` to `+0xA70`; this is world-speed magnitude, not a fourth local component.
- `0x00A35D00` performs four wheel contact tests, writing one byte per wheel at `+0x9C4..+0x9C7`, suspension/contact values at `+0x9D4` and deltas at `+0x9E4`, and wheel contact points beginning at `+0x994`. It also writes the aggregate contact byte at `+0x188`.
- `0x00A36E30` iterates the four wheels. For a contacting wheel it applies a suspension force shaped as `spring * compression + damping * compression_delta / dt`; the code chooses between two damping values according to the sign of the compression delta and applies the force along the body's vertical axis at the wheel point. Protected getters supplying the three coefficients are not named yet.
- `0x00A37920` contains the main tire/grip/steering/drift force and torque integration. It has a low-speed boundary of `5.0`, reads fields around `+0xA74`, `+0xA78`, `+0xA88`, `+0xA8C`, and `+0xA9C`, and applies transformed forces/torques through the orientation matrix. Those fields remain candidates until runtime transitions and protected getters are correlated.

The initial steering target is now **confirmed/static** from `0x00A41DC0`, `0x00A41CF0`, and call sequence `0x00A37A05..0x00A37ADE`. A sign byte at the steering subobject's `+0x2C` selects `+1` or `-1`; this multiplies the subobject's `+0x20` input. The result multiplies `(π_native * MaxSteerAngle / 180)`, with `π_native` stored as `f32` bits `0x40490FD8`. The following attenuation is `exp(-abs((forward_velocity / SteerConstraint) * protected(+0xB38)))`. Native `0x0067A7D0` performs the absolute value, while `0x00A420D0` converts to double, calls the exponential routine at `0x01013710`, then converts back to float. The `+0xB38` value's role and runtime magnitude are still unknown, as is the later steering memory and tire-force path. The targeted instruction listing is retained at `work/analysis/steer-listing.md` with SHA-256 `0C2AC94A016FCE8765934CDC8F1456F0307A68FA1B0EC161DC2592E992CB39EC`.

The sole identified writer wrapper for `+0xB38` is `0x00A2F090`. Its callers `0x00AD9BE0` and `0x00AD9D60` assign `1.0` when two compared identities/values coincide; otherwise they derive a value of the form `1 - min(constant, nonnegative_difference / denominator)`. Captured constants in those caller branches include `0.05`, `0.1`, `400`, `500`, `1000`, and `16000`. The compared identities and the difference's gameplay meaning remain unverified, so a fixed `+0xB38 = 1` is not justified for all races. The decompilation report is `work/analysis/steer-factor-functions.md`, SHA-256 `17CFC813CAF2BE35164BE96B4E88A7738069F16D3A09D1F31F69800753A7AD6C`.

Native drift-input function `0x00A2D540` also has a **confirmed/static** release-side scalar update. If `+0x1D0 == 1`, `+0xA74` was pressed, and raw `+0x640 <= 0`, releasing drift sets `+0x640 = 10 * (world_speed(+0xA70) / 120)^2` before clearing `+0xA74` and `+0xE7C`.

The subsequent consumer is now partly identified: `0x00A37920` checks whether `+0x640 > 0` in its drift-related force predicate, then within the `+0x1D0 == 1` path writes `+0x640 = max(+0x640 - substep_seconds, 0)`. The helper at `0x00604140` is confirmed as maximum of two floats. This supports describing `+0x640` as a speed-dependent drift-release continuation timer, though the exact force/torque effect while positive remains unresolved. The operand report is `work/analysis/scalar-640-operands.md` with SHA-256 `8A80905767BA44FB5F8C956839A36008D8AA644ED14479B2F44AC1FA290A1D76`; the min/max helper report is `work/analysis/minmax-functions.md` with SHA-256 `74EB85B649CE0B82FE0271C8507448C2590CE497A42CBAA44986C5AB9E1D204F`.

The accelerator/brake input object at `GoPlayKart+0xA00` has two protected floats at `+0xA04` and `+0xA10`. Native `0x0067ECA0` reads the first when byte `+0xA1C` is zero and the second otherwise; `0x00A41D80` reads the complementary channel. The former is tested as the forward input at the start of `0x00A370A0`; the latter is used in its reverse/brake branch. Native `0x00679940` adds a three-component force vector to the existing force accumulator. The helper decompilation report is `work/analysis/longitudinal-helper-functions.md`, SHA-256 `46FA885D3E929EA1A72D727DE609ED0AC17A557BAF2CDE54B05F9CF1085E89D2`. This establishes channel selection, not the complete longitudinal force equation.

The positive-input force-vector segment at `0x00A370A0` is **confirmed/static** through its call sequence: `0x00660CC0` computes `cross(body_lateral_axis(+0xA38), vector(+0x9C8))`; three calls to `0x00667B30` multiply that vector by the selected base force, selected forward input, and resolved mode multiplier in that order; `0x00679940` adds the result to the force accumulator at `+0x5FC`. Rust/Wasm reproduces this segment with the base force and multiplier passed explicitly. The runtime meaning and value of `+0x9C8` and base-force selection in all modes still need confirmation. The extended telemetry now includes all three `+0x9C8` components.

The normal linear-velocity substep is now **confirmed/static** in `0x00A3A7F0`: add auxiliary force `+0xB2C` to accumulated force `+0x5FC`, divide componentwise by protected mass `+0x644` using helper `0x00660530`, multiply each component by the native substep seconds using `0x00667B30`, and add to world velocity `+0xC0` using `0x00679940`. Rust/Wasm reproduces that arithmetic order for the normal valid-force branch. An earlier `0x009C96E0` guard can reset world velocity to zero; its full predicate and angular update remain outside this primitive. The exact instruction listing is `work/analysis/integrator-listing.md`, SHA-256 `ECE1F7748C4B5E383DFB3493F4430F28DCF7174FAA1A8E04F74B2DC50D497BEC`; helper report SHA-256 is `1E4D4E1A40FFBD33344F2EEA617DB94B4BF5C03239F4BA4A9BA7CA24D5160FF5`.

Correction: this is the **upward-surface contact** branch of `0x00A3AB30`, not a generic wall-impact branch. Query `0x00969200` copies the selected triangle's three-component normal from triangle offset `+0x28` to result offset `+0x0C`; the scalar read at the caller's `0x00A3AD1F` is result offset `+0x14`, its **Z component**. The branch requires a collision-query hit, an iteration below `+0xE5C`, `dot(contact_normal, world_velocity) < 0` (`0x00A3AC93..0x00A3ACBC`), and either `contact_normal.z > 0.65` or a nonzero `+0xDB0` override (`0x00A3AD1F..0x00A3AD39`). The `0.65` comes from original address `0x01087B04`. Instructions `0x00A3ACD4..0x00A3ADD0` separate `normal_component = normal * dot(velocity, normal)` and `tangent = velocity - normal_component`; replacement velocity is `tangent - normal_component * (abs(dot(body_forward, normal)) * 0.7)`. The `0.7` is the original float at `0x0105808C`, not a tuning guess. Rust/Wasm implements this branch predicate and arithmetic, but not the contact query, angular response, or later collision loops. Query decompilation: `work/analysis/collision-query-functions.md`, SHA-256 `D2532BD3C2EF01FA839283681435D1FF00146C801FE89EA0F9275627E395AD6E`; query listing: `work/analysis/collision-query-listing.md`, SHA-256 `70C69775E22856AC052D41B3BB748F25E39B72C322F0141650AC999C8F9C4DA7`; caller listing: `work/analysis/collision-movement-listing.md`, SHA-256 `7B76D57E3CB6B8635F72CCBBB9E9F53F50FC0C39C5A2E0F2483577279F9F890B`; constant bytes: `work/analysis/collision-constants.md`, SHA-256 `29EA69768C9EE2BAC4DDBB6A7FEFEC191C744F2CE79F71EA727B764232D326BD`; main-tick threshold bytes: `work/analysis/collision-threshold.md`, SHA-256 `3078885FAB8FEB851D9EADFD6E69223B7980B81E8D6A34C6A41B362CA3FFDF52`.

Native function `0x00A3DCD0` serializes the parameter object rooted at `GoPlayKart+0x644`. Its field order matches the recovered `KartSpec` order through the core and dual-booster fields. This closes the following direct layout map:

| Effective field | `GoPlayKart` offset | Native storage |
|---|---:|---|
| mass | `+0x644` | protected float |
| forward / backward acceleration force | `+0x6BC` / `+0x6C8` | protected float |
| air friction / drag factor | `+0x6D4` / `+0x6E0` | protected float |
| max steer angle / steer constraint | `+0x6EC` / `+0x6F0` | protected float / raw float |
| grip / slip brake force | `+0x6F4` / `+0x6F8` | raw float |
| drift trigger factor / time / slip factor | `+0x6FC` / `+0x708` / `+0x714` | protected float |
| drift escape force | `+0x720` | protected float |
| drift lean / steer lean | `+0x72C` / `+0x730` | raw float |
| drift max gauge / corner draw | `+0x734` / `+0x740` | protected float |
| front / rear grip factor | `+0x74C` / `+0x750` | raw float |
| normal through super booster time | `+0x7A0` through `+0x7D0` in 12-byte protected-value strides | protected float |
| transform / boost acceleration factor | `+0x7DC` / `+0x7E8` | protected float |
| item / speed start-booster time | `+0x7F4` / `+0x800` | protected float |
| item / speed start-forward force | `+0x80C` / `+0x818` | protected float |
| boost-only-item / anti-collision / gauge preserve | `+0x824` / `+0x834` / `+0x84C` | protected float |
| dual multiplier / low-speed transition | `+0x880` / `+0x88C` | protected float |

The serializer omits the six parts-lock bytes present in the 235-byte race-start block, so it is not being asserted as a byte-for-byte wire serializer. It is nevertheless direct static evidence for the listed field identities. Its 28,752-byte instruction report has SHA-256 `FF557CC8E49991A34112CDB3481B080C27388E8C521D03A624E92E50B41986A7`.

Captured native constants used around these functions include `0.001`, `0.002`, `0.004`, `0.005`, `0.11`, `0.5`, `0.8`, `0.9`, `0.99`, `1.08`, `1.14`, `1.2`, `5`, `7`, `10`, `15`, `24`, `200`, `-0.35`, `-0.5`, `-1`, and `-4`. A constant's presence is not treated as a named physical parameter until its call/data flow is recovered.

## Fresh runtime telemetry

A new 32-bit MSVC telemetry DLL in `tools/native-telemetry` was built from this repository and injected into a freshly launched supplied client. It verifies the exact nine-byte prologue at main-tick RVA `0x00633420`, preserves integer/FPU/SSE state, forwards through a trampoline, and writes from a separate below-normal-priority thread. The physics hook itself only fills a preallocated ring buffer.

The first immutable CSV snapshot contains 2,427 main-tick rows over client times `1920049205` through `1920130566`, from one `GoPlayKart*` value (`0x21B0A010`). Its SHA-256 is `845917B3287BE88F8EC096569279EB342AA5E15C8D67412EFB254AAF00EF5D6D`. The observed main-tick cadence was primarily 15–18 ms while foregrounded and 51–54 ms while the client was background-throttled. This frame cadence is distinct from the internal 1–2 ms physics substeps recovered above.

Two state vectors are now **confirmed/runtime**:

- `GoPlayKart + 0x90` is world position `(x,y,z)`.
- `GoPlayKart + 0xC0` is world linear velocity `(x,y,z)`.

For consecutive samples with a positive interval no greater than 100 ms and a component speed above 1, the median of `(position[t+1]-position[t]) / dt / mean(velocity[t],velocity[t+1])` was `1.0000716611` on X, `0.9999880869` on Y, and `0.9999559987` on Z (1,907 / 1,792 / 574 component samples). This near-unity derivative agreement is the basis for the labels, not visual guesswork.

The same capture reads the client's protected-float fields through its own getter at RVA `0x00269050`: ordinary booster gauge at `+0x0A90`, speed-derived gauge accumulator at `+0x0AA0`, combined/addition target at `+0x0AAC`, and gauge capacity at `+0x0734`. The snapshot observed an ordinary-gauge range of `0..3486.47461`, a speed accumulator range of `0..2.36599898`, and a capacity of `3810` in the sampled kart. Exact semantic transitions still require controlled inputs.

## Controlled input run 04

Virtual-key runs `01`–`03` were rejected because they reached menu UI but not the DirectInput driving path. Run `04` used scan-code injection and is the first valid controlled drive. Its source telemetry snapshot has SHA-256 `904729E30C6D8302A55F7ADD3D1412FEBCA749B9C0A56A2144A84F437A423750`.

The exact input events and the 822 tick rows overlapping the driven interval are committed in `evidence/`. Their SHA-256 values are:

| File | SHA-256 |
|---|---|
| `controlled-input-events-04.csv` | `2E1A35ACC0350E6B9721D4E6AA65D58581B2E07BBAA8C367FCF36F1B4B60EEBB` |
| `original-controlled-04.csv` | `5AC363F8ADA9FBBEB5E1295B6AFC9DC33AFF89CDA89411213556785C05EB258D` |
| `original-controlled-04-summary.csv` | `701C0D46B3B4A670E166CE4262FC11394CF2CA671DC8479603D3DF18407F11DA` |

The measured phase summary is:

| Phase | Samples | Duration ms | Speed start → end (max) | Ordinary gauge start → end (max) |
|---|---:|---:|---:|---:|
| straight | 238 | 3983 | `0.000 → 51.977 (51.977)` | `0.000 → 460.603 (460.603)` |
| left drift | 60 | 1000 | `52.032 → 34.207 (52.202)` | `466.203 → 536.204 (536.204)` |
| recovery | 121 | 2001 | `33.946 → 0.277 (33.946)` | `536.204 → 1173.444 (1173.444)` |
| right drift | 59 | 982 | `0.186 → 2.885 (6.691)` | `1173.444 → 1173.444 (1173.444)` |
| coast | 60 | 1001 | `3.242 → 0.364 (4.088)` | `1173.444 → 1173.444 (1173.444)` |
| boost window | 193 | 3202 | `0.187 → 21.621 (21.621)` | `1173.444 → 0.000 (3777.716)` |
| brake | 91 | 1482 | `21.987 → 5.896 (21.987)` | `0.000 → 0.000 (0.000)` |

The full valid run moved 16.777 world units in X, 173.981 in Y, and 7.201 in Z and reached a vector speed of 52.202. The recovery segment is affected by track geometry/collision, so it must not be fitted as isolated longitudinal deceleration. Candidate `+0xCC/+0xD0/+0xD4` values ranged approximately `-0.62..1.05`, `-0.71..0.72`, and `-7.27..4.30`; static force/torque data flow supports treating this triplet as angular velocity in the next extended capture, but that label remains pending runtime orientation correlation.

The telemetry source now records the `+0x9C` orientation matrix, `+0xCC` angular-velocity candidate, local velocity, four individual contact bytes, candidate steering/drift fields, mapped core `KartSpec` values, the three suspension coefficients, the two decoded driving input channels, their selector byte, the `+0x640` release timer, the three `+0x9C8` force-direction components, and the three `+0xB2C` auxiliary-force components explicitly. The extended DLL builds cleanly with MSVC `/W4 /WX` and has SHA-256 `1F7E43DFE5B0F16FC5B85575A188FDFC962726895F8AE8438CE8789D3467B01E`. A new original client was launched, but Windows denied launching the remote-injection helper against the elevated process. That control was not bypassed, so capture of these new columns remains pending.

## Rust and WebAssembly evidence boundary

The fresh Rust crate implements only evidence-closed behavior at this stage:

- exact 500 ms clamp and 2/1 ms substep planning;
- the recovered P5136 scalar substitution decoder;
- all 70 named fields and exact length validation for the 235-byte effective `KartSpec` block;
- native layout constants for evidence-mapped `KartSpec` and state fields;
- the exact three-dot-product world-to-body velocity projection from `0x00A35B20`;
- the world-speed magnitude stored at `+0xA70` by `0x006612B0`;
- the contact-gated scalar suspension spring/damper branch from `0x00A36E30`;
- the input-side drift state transition from `0x00A2D540`, excluding unresolved downstream gauge and force effects;
- the conditional speed-squared `+0x640` scalar written on drift release and its per-substep countdown; its force effect is unresolved;
- the `+0xA04`/`+0xA10` forward versus reverse/brake input-channel selector;
- the positive-input forward force-vector calculation and accumulation operand order from `0x00A370A0`, with unresolved base-force/mode selection supplied by the caller;
- the normal-input linear-velocity update from `0x00A3A7F0`, with unresolved validity/exception branches excluded;
- the initial steering target and speed-dependent exponential attenuation from the native steering path, with `+0xB38` supplied as an unresolved input;
- a dependency-free raw WebAssembly ABI for these operations.

Forty-one unit tests pass. The current release `wasm32-unknown-unknown` module is 38,714 bytes with SHA-256 `E639A0D6394449D5F04C5F7B3557503432EA8EC49E5B33F903DC965D564B0882`. In addition to the native-evidence primitives, it exports `p5136_wall_contact_reported_speed` and the explicitly provisional `p5136_preview_new`, `p5136_preview_step`, and `p5136_preview_reset` functions. Following user feedback, the temporary 2D tester uses the native speed-squared release scalar as a visible persistence timer; this mapping and its `×3.6` speed conversion are **preview hypotheses**, not recovered native tire-force equations. Steering response and wall rebound values are likewise temporary. No JavaScript physics integrator exists, and no unverified native force formula is represented as equivalent yet.

## Required runtime comparison schema

Every original and WebAssembly replay row will contain:

`tick,time_ms,input_bits,kart_id,track_id,pos_x,pos_y,pos_z,vel_x,vel_y,vel_z,speed,yaw,pitch,roll,angular_velocity,drift_state,booster_gauge,booster_count,booster_remaining_ms,wheel_contact_mask,lap,checkpoint`

The same input event stream and initial state will be used on both implementations. Error reports will include absolute and relative speed error, position error, wrapped heading error, drift-state mismatches, and gauge error over time.

