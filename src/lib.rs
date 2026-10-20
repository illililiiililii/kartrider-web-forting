#![forbid(unsafe_op_in_unsafe_fn)]

pub mod body_frame;
pub mod drift;
pub mod drive_input;
pub mod encoded;
pub mod kart_spec;
pub mod longitudinal;
pub mod native_layout;
pub mod scheduler;
pub mod steering;
pub mod suspension;

pub use kart_spec::{KartSpec, KartSpecDecodeError, KART_SPEC_LENGTH};
pub use scheduler::{SubstepPlan, MAX_ELAPSED_MS, MAX_SUBSTEP_MS};

use body_frame::{BodyAxes, Vec3};
use drift::DriftInputState;
use drive_input::DriveInputChannels;
use suspension::SuspensionParameters;

/// Version of the raw WebAssembly ABI exposed by this crate.
#[no_mangle]
pub extern "C" fn p5136_abi_version() -> u32 {
    1
}

/// Return the number of 1-2 ms P5136 physics substeps for an elapsed frame.
#[no_mangle]
pub extern "C" fn p5136_substep_count(elapsed_ms: u32) -> u32 {
    SubstepPlan::new(elapsed_ms).len() as u32
}

/// Validate and decode one exact P5136 effective `KartSpec` block.
///
/// Return codes are 0 for valid, 1 for a null input pointer, 2 for a wrong
/// byte length, and 3 for a non-finite decoded float.
#[no_mangle]
pub unsafe extern "C" fn p5136_validate_kart_spec(input: *const u8, length: usize) -> u32 {
    if input.is_null() {
        return 1;
    }
    let bytes = unsafe { core::slice::from_raw_parts(input, length) };
    match KartSpec::decode(bytes) {
        Ok(_) => 0,
        Err(KartSpecDecodeError::WrongLength { .. }) => 2,
        Err(KartSpecDecodeError::NonFiniteFloat { .. }) => 3,
    }
}

/// Project world velocity onto P5136's forward, vertical, and lateral axes.
///
/// `world_xyz` points to three floats, `axes` to nine floats ordered as the
/// three axes, and `output_xyz` to writable storage for three floats. Returns
/// 1 on success or 0 when any pointer is null.
#[no_mangle]
pub unsafe extern "C" fn p5136_project_world_velocity(
    world_xyz: *const f32,
    axes: *const f32,
    output_xyz: *mut f32,
) -> u32 {
    if world_xyz.is_null() || axes.is_null() || output_xyz.is_null() {
        return 0;
    }
    let world = unsafe { core::slice::from_raw_parts(world_xyz, 3) };
    let axes = unsafe { core::slice::from_raw_parts(axes, 9) };
    let local = BodyAxes {
        forward: Vec3::new(axes[0], axes[1], axes[2]),
        vertical: Vec3::new(axes[3], axes[4], axes[5]),
        lateral: Vec3::new(axes[6], axes[7], axes[8]),
    }
    .project_world_velocity(Vec3::new(world[0], world[1], world[2]));
    unsafe {
        output_xyz.write(local.x);
        output_xyz.add(1).write(local.y);
        output_xyz.add(2).write(local.z);
    }
    1
}

/// Exact contact-gated scalar spring/damper term from native `0x00A36E30`.
#[no_mangle]
pub extern "C" fn p5136_suspension_scalar_force(
    contact: u32,
    compression: f32,
    compression_delta: f32,
    dt_seconds: f32,
    spring: f32,
    positive_delta_damping: f32,
    non_positive_delta_damping: f32,
) -> f32 {
    if dt_seconds <= 0.0 {
        return f32::NAN;
    }
    SuspensionParameters {
        spring,
        positive_delta_damping,
        non_positive_delta_damping,
    }
    .scalar_force(contact != 0, compression, compression_delta, dt_seconds)
}

/// Apply the evidence-closed drift-input transition and return packed state.
#[no_mangle]
pub extern "C" fn p5136_apply_drift_input(
    state_bits: u32,
    request_pressed: u32,
    input_allowed: u32,
    lockout_remaining: f32,
    forward_velocity: f32,
    any_wheel_contact: u32,
) -> u32 {
    let mut state = DriftInputState::from_bits(state_bits);
    state.apply_input(
        request_pressed != 0,
        input_allowed != 0,
        lockout_remaining,
        forward_velocity,
        any_wheel_contact != 0,
    );
    state.to_bits()
}

/// Native `+0x640` state update performed when the drift input is released.
#[no_mangle]
pub extern "C" fn p5136_drift_release_scalar(
    mode_at_1d0: i32,
    was_pressed: u32,
    current_scalar_at_640: f32,
    world_speed_at_a70: f32,
) -> f32 {
    drift::scalar_after_release(
        mode_at_1d0,
        was_pressed != 0,
        current_scalar_at_640,
        world_speed_at_a70,
    )
}

/// Native `+0x640` countdown operation within the applicable drift-force path.
#[no_mangle]
pub extern "C" fn p5136_decay_drift_release_scalar(
    current_scalar_at_640: f32,
    dt_seconds: f32,
) -> f32 {
    drift::decay_release_scalar(current_scalar_at_640, dt_seconds)
}

/// Magnitude calculation used by native `0x006612B0` and stored at `+0xA70`.
#[no_mangle]
pub extern "C" fn p5136_speed_magnitude(x: f32, y: f32, z: f32) -> f32 {
    (x * x + y * y + z * z).sqrt()
}

/// Forward channel selected by native `0x0067ECA0` from decoded inputs.
#[no_mangle]
pub extern "C" fn p5136_forward_drive_input(
    protected_a04: f32,
    protected_a10: f32,
    channels_swapped_at_a1c: u32,
) -> f32 {
    DriveInputChannels {
        protected_a04,
        protected_a10,
        channels_swapped: channels_swapped_at_a1c != 0,
    }
    .forward()
}

/// Complementary reverse/brake channel selected by native `0x00A41D80`.
#[no_mangle]
pub extern "C" fn p5136_reverse_brake_input(
    protected_a04: f32,
    protected_a10: f32,
    channels_swapped_at_a1c: u32,
) -> f32 {
    DriveInputChannels {
        protected_a04,
        protected_a10,
        channels_swapped: channels_swapped_at_a1c != 0,
    }
    .reverse_or_brake()
}

/// Forward force vector before it is added to the native force accumulator.
/// Input and output pointers each address three consecutive `f32` values.
#[no_mangle]
pub unsafe extern "C" fn p5136_forward_force_vector(
    body_lateral_axis: *const f32,
    contact_vector_at_9c8: *const f32,
    selected_base_force: f32,
    forward_input: f32,
    resolved_mode_multiplier: f32,
    output_xyz: *mut f32,
) -> u32 {
    if body_lateral_axis.is_null() || contact_vector_at_9c8.is_null() || output_xyz.is_null() {
        return 0;
    }
    let lateral = unsafe { core::slice::from_raw_parts(body_lateral_axis, 3) };
    let contact = unsafe { core::slice::from_raw_parts(contact_vector_at_9c8, 3) };
    let force = longitudinal::forward_force_vector(
        Vec3::new(lateral[0], lateral[1], lateral[2]),
        Vec3::new(contact[0], contact[1], contact[2]),
        selected_base_force,
        forward_input,
        resolved_mode_multiplier,
    );
    unsafe {
        output_xyz.write(force.x);
        output_xyz.add(1).write(force.y);
        output_xyz.add(2).write(force.z);
    }
    1
}

/// Native initial steer angle in radians, before speed attenuation and tire forces.
#[no_mangle]
pub extern "C" fn p5136_base_steer_radians(
    input_at_native_offset_20: f32,
    negate_direction_flag_at_2c: u32,
    max_steer_angle_degrees: f32,
) -> f32 {
    steering::base_steer_radians(
        input_at_native_offset_20,
        negate_direction_flag_at_2c != 0,
        max_steer_angle_degrees,
    )
}

/// Apply the original speed-dependent exponential attenuation to a steer angle.
#[no_mangle]
pub extern "C" fn p5136_speed_attenuated_steer_radians(
    base_steer_radians: f32,
    forward_velocity: f32,
    steer_constraint: f32,
    native_b38_factor: f32,
) -> f32 {
    steering::speed_attenuated_steer_radians(
        base_steer_radians,
        forward_velocity,
        steer_constraint,
        native_b38_factor,
    )
}

/// Fill `output` with substep lengths in seconds and return the required count.
///
/// If `capacity` is smaller than the required count, only that prefix is
/// written. Passing a null pointer is allowed only when `capacity == 0`.
#[no_mangle]
pub unsafe extern "C" fn p5136_plan_substeps(
    elapsed_ms: u32,
    output: *mut f32,
    capacity: usize,
) -> usize {
    let plan = SubstepPlan::new(elapsed_ms);
    let write_count = plan.len().min(capacity);
    if write_count != 0 {
        assert!(!output.is_null());
        for (index, seconds) in plan.seconds().take(write_count).enumerate() {
            unsafe { output.add(index).write(seconds) };
        }
    }
    plan.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_abi_reports_the_expected_substeps() {
        let mut output = [0.0_f32; 4];
        let required = unsafe { p5136_plan_substeps(5, output.as_mut_ptr(), output.len()) };
        assert_eq!(required, 3);
        assert_eq!(&output[..3], &[0.002, 0.002, 0.001]);
    }

    #[test]
    fn raw_projection_abi_writes_all_three_body_components() {
        let world = [3.0, 4.0, 5.0];
        let axes = [0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0];
        let mut output = [0.0; 3];
        let success = unsafe {
            p5136_project_world_velocity(world.as_ptr(), axes.as_ptr(), output.as_mut_ptr())
        };
        assert_eq!(success, 1);
        assert_eq!(output, [4.0, 5.0, 3.0]);
    }

    #[test]
    fn raw_suspension_abi_rejects_an_invalid_step() {
        assert!(p5136_suspension_scalar_force(1, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0).is_nan());
    }

    #[test]
    fn raw_kart_spec_abi_rejects_wrong_length_before_decode() {
        let bytes = [0_u8; 1];
        assert_eq!(unsafe { p5136_validate_kart_spec(bytes.as_ptr(), 1) }, 2);
    }

    #[test]
    fn raw_drift_abi_matches_the_accepted_press_transition() {
        let bits = p5136_apply_drift_input(0, 1, 1, 0.0, 1.0, 0);
        assert_eq!(bits, 0b1111);
    }

    #[test]
    fn raw_speed_magnitude_matches_three_dimensional_length() {
        assert_eq!(p5136_speed_magnitude(3.0, 4.0, 12.0), 13.0);
    }
}
