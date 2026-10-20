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

/// Normal-branch position update in native `0x00A3CB90`.
///
/// The caller must supply velocity after the preceding collision-response
/// calls (`0x00A3AB30` and `0x00A3B860`). This primitive does not implement
/// either collision response or the later orientation update.
#[must_use]
pub fn position_after_collision_step(
    world_position: Vec3,
    collision_corrected_velocity: Vec3,
    dt_seconds: f32,
) -> Vec3 {
    world_position.added(collision_corrected_velocity.scaled(dt_seconds))
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

    #[test]
    fn position_uses_velocity_after_collision_response() {
        let before = Vec3::new(1.0, 2.0, 3.0);
        let corrected_velocity = Vec3::new(0.0, -4.0, 5.0);
        let after = position_after_collision_step(before, corrected_velocity, 0.002);
        assert_eq!(after.x, 1.0);
        assert!((after.y - 1.992).abs() < 1e-6);
        assert!((after.z - 3.01).abs() < 1e-6);
    }
}
