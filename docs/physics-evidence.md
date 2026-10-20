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

## KartSpec transport

The P5136 race-start physics block is 235 bytes and contains 70 fields: 49 encoded `f32`, 6 encoded `i32`, and 15 encoded `u8` values. The supplied P5136_Rust field map establishes offsets for mass, air friction, drag, forward/backward acceleration force, braking, steering, front/rear grip, drift thresholds, drift escape, booster timing, and instant-acceleration gauges. This is parameter-layout evidence, not proof of the client integration formulas.

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

These addresses provide decompilation and trace anchors. They do not yet establish the entire per-frame call order or formulas.

## Required runtime comparison schema

Every original and WebAssembly replay row will contain:

`tick,time_ms,input_bits,kart_id,track_id,pos_x,pos_y,pos_z,vel_x,vel_y,vel_z,speed,yaw,pitch,roll,angular_velocity,drift_state,booster_gauge,booster_count,booster_remaining_ms,wheel_contact_mask,lap,checkpoint`

The same input event stream and initial state will be used on both implementations. Error reports will include absolute and relative speed error, position error, wrapped heading error, drift-state mismatches, and gauge error over time.

