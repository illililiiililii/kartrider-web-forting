/// Initial steering angle calculation recovered from native `0x00A41DC0`
/// and `0x00A41CF0`, before the speed-dependent factor in `0x00A37920`.
///
/// The native `KartSpec` object begins at `GoPlayKart + 0x644`, so its `+0xA8`
/// field is the effective maximum steer angle at `GoPlayKart + 0x6EC`.
pub const NATIVE_PI: f32 = f32::from_bits(0x4049_0fd8);
pub const NATIVE_DEGREES_PER_HALF_TURN: f32 = 180.0;

#[must_use]
pub fn base_steer_radians(
    input_at_native_offset_20: f32,
    negate_direction_flag_at_2c: bool,
    max_steer_angle_degrees: f32,
) -> f32 {
    let sign = if negate_direction_flag_at_2c {
        -1.0_f32
    } else {
        1.0_f32
    };
    let signed_input = sign * input_at_native_offset_20;
    let radians_per_input = (NATIVE_PI * max_steer_angle_degrees) / NATIVE_DEGREES_PER_HALF_TURN;
    signed_input * radians_per_input
}

/// Speed attenuation from native `0x00A37A4F..0x00A37ADE`.
///
/// `0x0067A7D0` takes the absolute value and `0x00A420D0` converts the
/// float argument to double, calls the native exponential routine at
/// `0x01013710`, and converts the result back to float. The protected value
/// at `GoPlayKart + 0xB38` is passed explicitly until its role is confirmed.
#[must_use]
pub fn speed_attenuated_steer_radians(
    base_steer_radians: f32,
    forward_velocity: f32,
    steer_constraint: f32,
    native_b38_factor: f32,
) -> f32 {
    let speed_ratio = forward_velocity / steer_constraint;
    let scaled_ratio = speed_ratio * native_b38_factor;
    let exponent = -scaled_ratio.abs();
    let attenuation = f64::from(exponent).exp() as f32;
    base_steer_radians * attenuation
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_sign_byte_reverses_the_initial_steer_angle() {
        let positive = base_steer_radians(0.5, false, 30.0);
        let negative = base_steer_radians(0.5, true, 30.0);
        assert!((positive - 0.261_799_34).abs() < 1e-6);
        assert_eq!(negative, -positive);
    }

    #[test]
    fn native_exponential_reduces_steering_at_speed() {
        let base = base_steer_radians(0.5, false, 30.0);
        let attenuated = speed_attenuated_steer_radians(base, 23.0, 2.3, 0.1);
        assert!((attenuated / base - core::f32::consts::E.recip()).abs() < 1e-6);
        assert_eq!(speed_attenuated_steer_radians(base, 0.0, 2.3, 0.1), base);
    }
}
