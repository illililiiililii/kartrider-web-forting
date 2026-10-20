use crate::body_frame::Vec3;

/// Velocity replacement in the impact branch of native `0x00A3AB30`.
///
/// The collision normal is the vector supplied by the native contact query.
/// The caller is responsible for reproducing the native branch predicates,
/// including `dot(normal, velocity) < 0`, the collision threshold, and the
/// `+0xDB0` override. The normal must already have native query semantics.
#[must_use]
pub fn wall_impact_velocity(
    world_velocity: Vec3,
    contact_normal: Vec3,
    body_forward_axis: Vec3,
) -> Vec3 {
    let normal_speed = world_velocity.dot(contact_normal);
    let normal_component = contact_normal.scaled(normal_speed);
    let tangent = Vec3::new(
        world_velocity.x - normal_component.x,
        world_velocity.y - normal_component.y,
        world_velocity.z - normal_component.z,
    );
    let bounce_scale = body_forward_axis.dot(contact_normal).abs() * 0.7_f32;
    let reflected_component = normal_component.scaled(-bounce_scale);
    tangent.added(reflected_component)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn head_on_impact_reverses_normal_velocity_at_original_scale() {
        let after = wall_impact_velocity(
            Vec3::new(-10.0, 3.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
        );
        assert_eq!(after, Vec3::new(7.0, 3.0, 0.0));
    }

    #[test]
    fn glancing_impact_preserves_tangent_and_scales_reflection_by_alignment() {
        let after = wall_impact_velocity(
            Vec3::new(-10.0, 3.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.5, 0.5, 0.0),
        );
        assert_eq!(after, Vec3::new(3.5, 3.0, 0.0));
    }
}
