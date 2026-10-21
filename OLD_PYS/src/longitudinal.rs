use crate::body_frame::Vec3;

/// Evidence-closed force-vector part of the forward branch in native
/// `0x00A370A0`, call sequence `0x00A3740F..0x00A37474`.
///
/// The caller supplies the selected base force (`ForwardAccelForce * +0xB44`,
/// a start force, or drift escape force) and the resolved mode multiplier.
/// Their selection predicates and the downstream integrator are separate.
#[must_use]
pub fn forward_force_vector(
    body_lateral_axis: Vec3,
    contact_vector_at_9c8: Vec3,
    selected_base_force: f32,
    forward_input: f32,
    resolved_mode_multiplier: f32,
) -> Vec3 {
    body_lateral_axis
        .cross(contact_vector_at_9c8)
        .scaled(selected_base_force)
        .scaled(forward_input)
        .scaled(resolved_mode_multiplier)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_cross_product_and_scalar_order_set_forward_force_direction() {
        let force = forward_force_vector(
            Vec3::new(-1.0, 0.0, 0.0),
            Vec3::new(0.0, 0.0, 1.0),
            100.0,
            0.5,
            2.0,
        );
        assert_eq!(force, Vec3::new(0.0, 100.0, 0.0));
    }
}
