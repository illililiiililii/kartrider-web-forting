use crate::body_frame::Vec3;

/// Normal-input linear-velocity path of native `0x00A3A7F0`.
///
/// The native sequence first adds `+0xB2C` to the `+0x5FC` force accumulator,
/// divides by protected mass `+0x644`, multiplies by the substep seconds, and
/// adds the result to world linear velocity `+0xC0`. The preceding validity
/// guard and the angular-velocity branch are still separate work.
#[must_use]
pub fn linear_velocity_after_step(
    world_velocity: Vec3,
    accumulated_force: Vec3,
    additional_force_at_b2c: Vec3,
    mass: f32,
    dt_seconds: f32,
) -> Vec3 {
    let total_force = accumulated_force.added(additional_force_at_b2c);
    let acceleration = total_force.divided(mass);
    let velocity_delta = acceleration.scaled(dt_seconds);
    world_velocity.added(velocity_delta)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn force_sum_is_divided_by_mass_before_substep_update() {
        let velocity = linear_velocity_after_step(
            Vec3::new(0.0, 1.0, 0.0),
            Vec3::new(0.0, 80.0, 0.0),
            Vec3::new(0.0, 20.0, 0.0),
            200.0,
            0.002,
        );
        assert!((velocity.y - 1.001).abs() < 1e-6);
        assert_eq!(velocity.x, 0.0);
        assert_eq!(velocity.z, 0.0);
    }
}
