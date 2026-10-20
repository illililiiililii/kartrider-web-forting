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

## Targeted native decompilation

A saved Ghidra project was built from the analysis-only PE and a deterministic exporter captured 30 physics functions, including all principal tick callees and the pinned collision/gauge functions. The resulting 129,254-byte report has SHA-256 `39F40949F66076561B6E57D0D10CA771487B8D5466088F3C895EDC46BFAECE30`. The REA evidence record for the initial decompilation is `ev_7d6ac7d98fb177ac98c72766d417c44fd8c006cfe793da633584234729174ec7`.

The following roles are supported strongly enough to guide the next probes:

- `0x00A35B20` projects the world linear velocity at `+0xC0` onto three body axes stored from `+0xA38`, `+0xA44`, and `+0xA50`. It writes body-local velocity components at `+0xA5C`, `+0xA6C`, and `+0xA70`.
- `0x00A35D00` performs four wheel contact tests, writing one byte per wheel at `+0x9C4..+0x9C7`, suspension/contact values at `+0x9D4` and deltas at `+0x9E4`, and wheel contact points beginning at `+0x994`. It also writes the aggregate contact byte at `+0x188`.
- `0x00A36E30` iterates the four wheels. For a contacting wheel it applies a suspension force shaped as `spring * compression + damping * compression_delta / dt`; the code chooses between two damping values according to the sign of the compression delta and applies the force along the body's vertical axis at the wheel point. Protected getters supplying the three coefficients are not named yet.
- `0x00A37920` contains the main tire/grip/steering/drift force and torque integration. It has a low-speed boundary of `5.0`, reads fields around `+0xA74`, `+0xA78`, `+0xA88`, `+0xA8C`, and `+0xA9C`, and applies transformed forces/torques through the orientation matrix. Those fields remain candidates until runtime transitions and protected getters are correlated.

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

The telemetry source now records the `+0x9C` orientation matrix, `+0xCC` angular-velocity candidate, local velocity, four individual contact bytes, and candidate steering/drift fields explicitly. The extended DLL builds cleanly with MSVC `/W4 /WX` and has SHA-256 `78AC352DE469B4C5D242301B3708ADA8D6A7171A1BFC550463F34AAAC08DF540`. A new client launch and reinjection are required before those additional columns can be captured.

## Rust and WebAssembly evidence boundary

The fresh Rust crate implements only evidence-closed behavior at this stage:

- exact 500 ms clamp and 2/1 ms substep planning;
- the recovered P5136 scalar substitution decoder;
- all 70 named fields and exact length validation for the 235-byte effective `KartSpec` block;
- a dependency-free raw WebAssembly ABI for the substep planner.

Six unit tests pass. The release `wasm32-unknown-unknown` module is 15,705 bytes with SHA-256 `48E4BC5B9C7C54D125B8BA7D1F8D6104F5A72C78F7F3ED1601CE91826DDBCA62`. It exports memory plus `p5136_abi_version`, `p5136_plan_substeps`, and `p5136_substep_count`. No JavaScript physics integrator exists, and no unverified native force formula is represented as equivalent yet.

## Required runtime comparison schema

Every original and WebAssembly replay row will contain:

`tick,time_ms,input_bits,kart_id,track_id,pos_x,pos_y,pos_z,vel_x,vel_y,vel_z,speed,yaw,pitch,roll,angular_velocity,drift_state,booster_gauge,booster_count,booster_remaining_ms,wheel_contact_mask,lap,checkpoint`

The same input event stream and initial state will be used on both implementations. Error reports will include absolute and relative speed error, position error, wrapped heading error, drift-state mismatches, and gauge error over time.

