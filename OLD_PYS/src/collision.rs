use crate::body_frame::Vec3;

/// Main-tick upward-normal threshold passed to `0x00A3AB30`.
pub const UPWARD_CONTACT_NORMAL_Z_THRESHOLD: f32 = 0.65;

/// Entry predicate for the upward-contact velocity branch of `0x00A3AB30`.
///
/// Query `0x00969200` copies the selected triangle's normal into collision
/// result offsets `+0x0C..+0x14`. The native comparison at `0x00A3AD1F`
/// reads its Z component, not an independent query scalar. `iteration` is
/// zero-based, matching the native `+0xE5C` loop limit.
#[must_use]
pub fn uses_upward_contact_velocity_branch(
    has_collision_hit: bool,
    iteration: u32,
    maximum_iterations_at_e5c: u32,
    contact_normal: Vec3,
    world_velocity: Vec3,
    override_at_db0: bool,
) -> bool {
    has_collision_hit
        && iteration < maximum_iterations_at_e5c
        && contact_normal.dot(world_velocity) < 0.0
        && (contact_normal.z > UPWARD_CONTACT_NORMAL_Z_THRESHOLD || override_at_db0)
}

/// The wall-side branch and its reported impact magnitude in `0x00A3AB30`.
///
/// The native function records `length(normal * dot(velocity, normal))` in the
/// optional collision report before performing further wall response. This
/// function does not implement that subsequent force or angular response.
#[must_use]
pub fn wall_contact_reported_speed(
    has_collision_hit: bool,
    iteration: u32,
    maximum_iterations_at_e5c: u32,
    contact_normal: Vec3,
    world_velocity: Vec3,
    override_at_db0: bool,
) -> Option<f32> {
    let normal_speed = contact_normal.dot(world_velocity);
    if !has_collision_hit
        || iteration >= maximum_iterations_at_e5c
        || !(normal_speed < 0.0)
        || contact_normal.z > UPWARD_CONTACT_NORMAL_Z_THRESHOLD
        || override_at_db0
    {
        return None;
    }
    let normal_component = contact_normal.scaled(normal_speed);
    Some(
        (normal_component.x * normal_component.x
            + normal_component.y * normal_component.y
            + normal_component.z * normal_component.z)
            .sqrt(),
    )
}

/// Velocity replacement in the upward-contact branch of native `0x00A3AB30`.
///
/// The collision normal is the vector supplied by the native contact query.
/// The caller is responsible for applying `uses_upward_contact_velocity_branch`
/// to a normal returned by the native-style triangle contact query.
#[must_use]
pub fn upward_contact_velocity(
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
    fn vertical_impact_reverses_normal_velocity_at_original_scale() {
        let after = upward_contact_velocity(
            Vec3::new(3.0, 0.0, -10.0),
            Vec3::new(0.0, 0.0, 1.0),
            Vec3::new(0.0, 0.0, 1.0),
        );
        assert_eq!(after, Vec3::new(3.0, 0.0, 7.0));
    }

    #[test]
    fn glancing_impact_preserves_tangent_and_scales_reflection_by_alignment() {
        let after = upward_contact_velocity(
            Vec3::new(3.0, 0.0, -10.0),
            Vec3::new(0.0, 0.0, 1.0),
            Vec3::new(0.0, 0.5, 0.5),
        );
        assert_eq!(after, Vec3::new(3.0, 0.0, 3.5));
    }

    #[test]
    fn native_impact_branch_requires_hit_limit_and_incoming_motion() {
        let normal = Vec3::new(0.0, 0.0, 1.0);
        let incoming = Vec3::new(0.0, 0.0, -1.0);
        assert!(uses_upward_contact_velocity_branch(
            true, 0, 1, normal, incoming, false
        ));
        assert!(!uses_upward_contact_velocity_branch(
            false, 0, 1, normal, incoming, false
        ));
        assert!(!uses_upward_contact_velocity_branch(
            true, 1, 1, normal, incoming, false
        ));
        assert!(!uses_upward_contact_velocity_branch(
            true,
            0,
            1,
            normal,
            Vec3::new(0.0, 0.0, 1.0),
            false
        ));
    }

    #[test]
    fn native_impact_branch_compares_normal_z_or_override() {
        let incoming = Vec3::new(-1.0, 0.0, -1.0);
        assert!(!uses_upward_contact_velocity_branch(
            true,
            0,
            1,
            Vec3::new(0.0, 0.0, 0.65),
            incoming,
            false
        ));
        assert!(uses_upward_contact_velocity_branch(
            true,
            0,
            1,
            Vec3::new(0.0, 0.0, 0.65),
            incoming,
            true
        ));
    }

    #[test]
    fn wall_side_branch_reports_normal_component_magnitude() {
        let report = wall_contact_reported_speed(
            true,
            0,
            1,
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(-8.0, 3.0, 0.0),
            false,
        );
        assert_eq!(report, Some(8.0));
    }

    #[test]
    fn upward_contact_and_override_do_not_report_wall_impact() {
        let incoming = Vec3::new(-8.0, 0.0, -8.0);
        assert_eq!(
            wall_contact_reported_speed(true, 0, 1, Vec3::new(0.0, 0.0, 1.0), incoming, false),
            None
        );
        assert_eq!(
            wall_contact_reported_speed(true, 0, 1, Vec3::new(1.0, 0.0, 0.0), incoming, true),
            None
        );
    }
}
